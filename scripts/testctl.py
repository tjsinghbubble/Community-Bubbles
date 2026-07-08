#!/usr/bin/env python3
"""
testctl — status / nuke / health for the Bubble test platform.

One tool callable by every entity that pokes at tests: Claude Code, shell
health scripts, humans, and the test scripts themselves.

  testctl.py status            what is running right now (test, step, runner, invoker, timings)
                               [the default command when none is given]
  testctl.py nuke LIST         stop test runners (known method first, else SIGQUIT → 2s → SIGKILL)
  testctl.py health            diagnose the environment (are machines running)
  testctl.py ability           diagnose the testing possibilities with this environment (WIP)
  testctl.py driver-health     probe the Maestro device driver (Android; details under -v)
  testctl.py inspect [last|all|recent|<N> [<B>]] [RUN_DIR]   artifact inspector
  testctl.py --json <cmd>      machine-readable output for any command
  testctl.py --env ENV <cmd>   target LOCAL (default), PROD (trybubble.io), or STAGING
                               ($STAGING_HOSTNAME — fatal if unset); L/P/S accepted

Inspect is a menu app; CLI args are deep-links into its nav tree (RUNS → RUN →
TEST). With no RUN_DIR it uses the current run (heartbeat) or the newest
tests/output/run-*. `inspect` lists the run's non-OK tests; `inspect all` lists
them all; `inspect last` is the explicit last run; `inspect <N>` drills into test
N (canonical # = execution order, stable across filters); `inspect <N> <B>` runs
menu item B on it; `inspect recent` browses every run in the window. A test name
still parses forgivingly ("auth 100, site admin", a pasted summary line, "uc-182").
The per-test menu: failure, code, use case, images, run cmd, movie, params, dir,
prompt, trello draft, internal log, configure. `--cmd <name>` runs one step.

Nuke targets (comma list, positional or --nuke=LIST): qa, mcp, cli, xcodebuild,
headless (vitest+newman), playwright, maestro (= cli+mcp+xcodebuild), all | them-all.

Known stop methods:
  qa   → write tests/PANIC (the runner aborts between tests), then ladder its tree.
         The marker is only written when a live qa-runner process exists — an
         abandoned heartbeat (runner pid gone) gets no marker.
  rest → SIGQUIT, wait 2s, SIGKILL          (JVMs ignore SIGQUIT — the KILL lands)

stdlib only; no third-party deps.
"""

import argparse
import concurrent.futures
import fcntl
import inspect
import json
import os
import plistlib
import re
import shutil
import signal
import socket
import subprocess
import sys
import time
from collections import namedtuple
from datetime import datetime
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

# Sibling dev-tools imported as modules (same pattern scripts/helpers/selftest_* uses):
# manage_devices for device discovery + aliases, helper_toolchain for the toolchain
# capability probe. Both are pure at import (no DB or subprocess side effects).
_SCRIPTS_DIR = str(Path(__file__).resolve().parent)
if _SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, _SCRIPTS_DIR)
import manage_devices as md
from helpers import helper_toolchain as htc

REPO = Path(__file__).resolve().parent.parent
OUTPUT_ROOT = REPO / "tests" / "output"
HEARTBEAT = OUTPUT_ROOT / "current-run.json"
PANIC_MARKER = REPO / "tests" / "PANIC"

# Test-runner mutual-exclusion lock (see the "lock" subcommand / cmd_lock).
LOCK_FILE = OUTPUT_ROOT / ".test-runner.lock"
LOCK_GUARD = OUTPUT_ROOT / ".test-runner.lock.guard"
LOCK_STALE_HOURS = 8

API_PORT = int(os.environ.get("API_PORT", "3000"))
METRO_PORT = int(os.environ.get("METRO_PORT", "8081"))
APP_ID = os.environ.get("QA_APP_ID", "com.bubble.mobile")
LOAD_CEILING = float(os.environ.get("QA_LOAD_CEILING", "75"))

# ── target environment (--env LOCAL|PROD|STAGING; L/P/S accepted) ──────────────
# Selects which deployment the env-aware commands (health, ability) probe.
# LOCAL is the default and the only env where testctl may start anything.

EnvCfg = namedtuple("EnvCfg", "name host api_base is_local")

_ENV_ALIASES = {"L": "LOCAL", "P": "PROD", "S": "STAGING"}
PROD_HOSTNAME = "trybubble.io"


def resolve_env(raw):
    """--env value → EnvCfg. Fatal (SystemExit) on STAGING without STAGING_HOSTNAME
    and on unknown names — a typo must not silently probe the wrong deployment."""
    key = (raw or "LOCAL").strip().upper()
    key = _ENV_ALIASES.get(key, key)
    if key == "LOCAL":
        host = f"127.0.0.1:{API_PORT}"
        return EnvCfg("LOCAL", host, f"http://{host}", True)
    if key == "PROD":
        return EnvCfg("PROD", PROD_HOSTNAME, f"https://{PROD_HOSTNAME}", False)
    if key == "STAGING":
        host = os.environ.get("STAGING_HOSTNAME", "").strip()
        if not host:
            raise SystemExit(
                "testctl: --env STAGING needs the STAGING_HOSTNAME environment variable.\n"
                "The staging deployment has no fixed hostname (it moves between hosting "
                "providers), so testctl refuses to guess. Set it first, e.g.\n"
                "    export STAGING_HOSTNAME=staging.trybubble.io")
        return EnvCfg("STAGING", host, f"https://{host}", False)
    raise SystemExit(f"testctl: unknown --env {raw!r} — use LOCAL, PROD, or STAGING "
                     "(L, P, S also accepted)")


# The active target. Module-level so the health/ability check registry (zero-arg
# functions) can read it; main() reassigns it from --env before dispatch.
ENV = resolve_env(None)

# health: per-check wall-clock budget. Checks run in parallel worker threads; one
# wedged tool (adb/simctl are the usual suspects) degrades to a warn instead of
# blanking the whole report.
QA_HEALTH_CHECK_TIMEOUT_S = float(os.environ.get("QA_HEALTH_CHECK_TIMEOUT_S", "25"))
CHECK_ENV_CMD = "./scripts/check-env.sh --fix"

# Maestro Android driver gRPC server (see driver-health / cmd_driver_health). The
# maestro JVM serves `maestro_android.MaestroDriver` on host localhost:7001, opened
# via a dadb tunnel (NOT `adb forward` — so `adb forward --list` is empty even when
# up; lsof is the reliable presence check). The driver is EPHEMERAL: it exists only
# during a live maestro test/studio/hierarchy session. There is no reflection or
# standard health service, so the gRPC probe needs the schema via -protoset. The
# `deviceInfo` RPC is the de-facto heartbeat (same call-path as the inputText
# DEADLINE_EXCEEDED failure mode). Protoset is gitignored/regenerable.
DRIVER_PORT = int(os.environ.get("MAESTRO_DRIVER_PORT", "7001"))
DRIVER_SERVICE = "maestro_android.MaestroDriver"
DRIVER_PROTOSET = Path(os.environ.get("MAESTRO_DRIVER_PROTOSET",
                                      str(REPO / "tmp" / "maestro_android.protoset")))
DRIVER_LATENCY_WARN_S = float(os.environ.get("QA_DRIVER_LATENCY_WARN_S", "2.0"))

# FIXME: the `Event` structure is not formally defined. In practice, it is dynamically created
# by whatever is written into the per-test results that appear in the summary.json, so it's
# not locked down at the moment.
#
# The informal definition is that each Event is a dictionary with about a dozen entries, many of which
# also appear as arguments to "npm run qa" or "npm run qa:flow". The dictionary is dynamically created by
# iterating over the Results
#
# * id - a string identifier for the test, e.g, "bubble-admin-0600"
# * reason -- what does it test?  why does the test exist?
# * tool - a string identifier for the testing tool: maestro FIXME
# * role - which specific role will be set up for the logged in user: role-user, role-bubble-admin, role-site-admin
# * tags - a set of string identifiers taken from the test definition
# * status - either "success" or "fail". older tests have more meanings.
# * durationMs - the length of the test in milliseconds.
# * expectedFinding - true or false
# * knownBug - true or false
# * artifactsDir = where all the snapshots, params, logs will be stored for each test run.
#
#     {
#       "id": 
#       "tool": "maestro",
#       "layer": "e2e",
#       "role": "role-bubble-admin",
#       "tags": [
#         "e2e",
#         "android",
#         "role-bubble-admin"
#       ],
#       "status": "fail",
#       "durationMs": 150776,
#       "expectedFinding": false,
#       "knownBug": false,
#       "reason": "Bubble-admin creates a new bubble end-to-end (UC 129)",
#       "artifactsDir": "/Users/traviswinfrey/Documents/src/bubble/Bubble/tests/output/run-manual-bubble-admin-0600-create-bubble-smoke-20260628t004342Z",
#       "message": "(manual qa:flow run)"
#     }
#   ]
# }





# ── small utils ───────────────────────────────────────────────────────────────

def interval_into_string(seconds):
    """
    Turn a time interval into a more human-friendly format, where only necessary info is broken out.

    Args:
        seconds: integer, or parsable into one

    Returns:
        returns one of three formats: "HH h MM m SS s", or "MM m SS s", or "SS s"

    Raises:
        ValueError: If `seconds` cannot be forced into an integer format

    Example:
        >>> interval_into_string(87)
        1m 27s
        >>> interval_into_string(3*3600 + 28*60 + 59)
        3h 28m 59s
    """
    if seconds is None:
        return "?"
    seconds = int(seconds)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h}h {m}m {s}s"
    if m:
        return f"{m}m {s}s"
    return f"{s}s"


def parse_elapsedtime_into_seconds(etime):
    """
    Turn a time interval in several formats into seconds

    Args:
        etime: [[dd-]hh:]mm:ss shows the three formats. Only mm:ss is required.

    Returns
        seconds of that interval
    """
    days = 0
    if "-" in etime:
        d, etime = etime.split("-", 1)
        days = int(d)
    parts = [int(p) for p in etime.split(":")]
    while len(parts) < 3:
        parts.insert(0, 0)
    h, m, s = parts
    return days * 86400 + h * 3600 + m * 60 + s


def convert_iso_timestamp(ts):
    """
    Turn a timestamp in ISO 8601 format with a "Zulu" timezone into a timestamp with a UTC offset

    Args:
        ts: string timestamp

    Returns:
        same timestamp, but with UTC+0 offset

    Raises:
        ValueError: If `seconds` cannot be forced into an integer format

    Example:
        >>> convert_iso_timestamp("2025-06-10T19:49:00.000Z")
        2025-06-10T19:49:00.000Z+00:00
        >>> convert_iso("I like cheese")
        throws ValueError
    """
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()
    except (ValueError, AttributeError):
        return None


def http_get(url, timeout=5):
    """Return (status_code, body_str) or (None, error_str)."""
    try:
        with urlopen(url, timeout=timeout) as res:
            return res.status, res.read().decode("utf-8", "replace")
    except HTTPError as e:  # got an HTTP response — that still proves liveness
        return e.code, e.read().decode("utf-8", "replace") if e.fp else ""
    except (URLError, OSError, TimeoutError) as e:
        return None, str(e)


def http_post_json(url, payload, timeout=8):
    """POST JSON; return (status_code, body_str) or (None, error_str)."""
    req = Request(url, data=json.dumps(payload).encode(),
                  headers={"Content-Type": "application/json"})
    try:
        with urlopen(req, timeout=timeout) as res:
            return res.status, res.read().decode("utf-8", "replace")
    except HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace") if e.fp else ""
    except (URLError, OSError, TimeoutError) as e:
        return None, str(e)


def tcp_open(host, port, timeout=2):
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


# ── process table ─────────────────────────────────────────────────────────────

PS_LINE = re.compile(r"^\s*(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(.*)$")


def ps_snapshot():
    out = subprocess.run(
        ["ps", "-axo", "pid=,ppid=,tty=,etime=,command="],
        capture_output=True, text=True,
    ).stdout
    procs = {}
    for line in out.splitlines():
        m = PS_LINE.match(line)
        if not m:
            continue
        pid = int(m.group(1))
        procs[pid] = {
            "pid": pid,
            "ppid": int(m.group(2)),
            "tty": m.group(3),
            "etime_s": parse_elapsedtime_into_seconds(m.group(4)),
            "cmd": m.group(5),
        }
    return procs


def ancestors(pid, procs):
    """Yield ancestor proc dicts, nearest first (excludes pid itself)."""
    seen = set()
    cur = procs.get(pid)
    while cur and cur["ppid"] not in seen and cur["ppid"] > 0:
        seen.add(cur["pid"])
        cur = procs.get(cur["ppid"])
        if cur:
            yield cur


def descendants(pid, procs):
    kids = [p for p in procs.values() if p["ppid"] == pid]
    out = []
    for k in kids:
        out.append(k)
        out.extend(descendants(k["pid"], procs))
    return out


# What a process IS (the runner / engine):
RUNNER_RULES = [
    # (kind, predicate) — order matters: mcp before cli (both contain "maestro").
    ("maestro-mcp",     lambda c: "maestro" in c and re.search(r"\bmcp\b", c)),
    ("maestro-cli",     lambda c: "maestro" in c and re.search(r"\btest\b", c)),
    ("xcuitest-driver", lambda c: ("xcodebuild" in c and "maestro-driver" in c)
                                  or "maestro-driver-iosUITests-Runner" in c),
    ("qa-runner",       lambda c: "tests/runner/qa.ts" in c),
    ("vitest",          lambda c: "vitest" in c),
    ("newman",          lambda c: re.search(r"\bnewman\b", c) is not None),
    ("playwright",      lambda c: "playwright" in c and "test" in c),
]


def classify_runner(cmd):
    low = cmd.lower()
    if "testctl" in low or low.startswith("grep") or "/ps " in low:
        return None
    for kind, pred in RUNNER_RULES:
        if pred(cmd):
            return kind
    return None


def invoker_chain(pid, procs):
    """Walk ancestry; return ('CC'|'MCP'|'npm'|'user'|'unknown', 'a ← b' chain)."""
    markers = []
    for anc in ancestors(pid, procs):
        c = anc["cmd"]
        low = c.lower()
        if "maestro" in low and re.search(r"\bmcp\b", low):
            markers.append("MCP")
        elif re.search(r"\bclaude\b", low):
            markers.append("CC")
        elif "tests/runner/qa.ts" in c:
            markers.append("qa.ts")
        elif re.search(r"\bnpm\b", low):
            markers.append("npm")
    me = procs.get(pid, {})
    for label in ("CC", "MCP"):
        if label in markers:
            return label, " ← ".join(dict.fromkeys(markers)) or label
    if "npm" in markers or "qa.ts" in markers:
        chain = " ← ".join(dict.fromkeys(markers))
        return "npm", chain
    if me.get("tty", "??") != "??":
        return "user", "interactive terminal"
    return "unknown", ""


def find_test_processes(procs):
    found = []
    for p in procs.values():
        kind = classify_runner(p["cmd"])
        if kind is None:
            continue
        # The maestro launcher is a shell script that runs a java child with the
        # same argv tail; suppress the wrapper when its child is also matched.
        found.append({**p, "kind": kind})
    by_pid = {f["pid"] for f in found}
    found = [f for f in found if not (f["ppid"] in by_pid
                                      and classify_runner(procs[f["ppid"]]["cmd"]) == f["kind"])]
    for f in found:
        f["invoker"], f["invoker_chain"] = invoker_chain(f["pid"], procs)
    return found


# ── status ────────────────────────────────────────────────────────────────────

STEP_RE = re.compile(
    r"^(\d\d:\d\d:\d\d)\.\d+ \[ ?\w+\] maestro\.cli\.runner\.MaestroCommandRunner[^:]*: (.*?)(?: metadata |$)"
)


def _iter_maestro_logs(search_dirs):
    for d in search_dirs:
        d = Path(d)
        if not d.is_dir():
            continue
        try:
            for pattern in ("maestro.log", "internal-maestro-log*.log"):
                yield from d.rglob(pattern)
        except OSError:
            continue


def _newest_maestro_log(search_dirs):
    newest, newest_mtime = None, 0
    for f in _iter_maestro_logs(search_dirs):
        try:
            mt = f.stat().st_mtime
        except OSError:
            continue
        if mt > newest_mtime:
            newest, newest_mtime = f, mt
    return newest, newest_mtime


def _last_step_in_lines(lines, log_mtime):
    """(step_text, step_started_epoch) from the newest STEP_RE line, or (None, None)."""
    for line in reversed(lines):
        m = STEP_RE.match(line)
        if not m:
            continue
        step = m.group(2).strip()[:140]
        # Log lines carry time-of-day only; borrow the date from the file mtime.
        day = datetime.fromtimestamp(log_mtime).strftime("%Y-%m-%d")
        t = datetime.strptime(f"{day} {m.group(1)}", "%Y-%m-%d %H:%M:%S").timestamp()
        if t > log_mtime + 60:  # log line written "later" than mtime → midnight wrap
            t -= 86400
        return step, t
    return None, None


def latest_maestro_step(search_dirs, max_age_s=3600):
    """Newest maestro log under any of search_dirs → (step_text, step_started_epoch, log_path).

    Two names: maestro.log (live, still under .maestro/tests/<ts>/ while the flow runs)
    and internal-maestro-log.log (post-run, after the qa runner flattens/renames it).
    """
    newest, newest_mtime = _newest_maestro_log(search_dirs)
    if newest is None or time.time() - newest_mtime > max_age_s:
        return None, None, None
    try:
        lines = newest.read_text(errors="replace").splitlines()[-400:]
    except OSError:
        return None, None, None
    step, t = _last_step_in_lines(lines, newest_mtime)
    return step, t, str(newest)


def read_heartbeat(procs):
    if not HEARTBEAT.exists():
        return None
    try:
        hb = json.loads(HEARTBEAT.read_text())
    except (OSError, json.JSONDecodeError):
        return None
    pid = hb.get("pid")
    hb["runnerAlive"] = bool(pid and pid in procs)
    hb["abandoned"] = False
    if not hb["runnerAlive"] and hb.get("state") not in ("done", "canceled"):
        hb["abandoned"] = True
        hb["state"] = f"ABANDONED (runner pid {pid} is gone)"
    return hb


DEVICE_DB = REPO / ".device-manager" / "devices.db"


def _device_label(device_id):
    """(friendly_name, os_version) for a run's deviceId, from the device-manager DB.
    deviceId is an iOS udid or an android adb serial; match either column. Best-effort:
    returns (deviceId, None) if the DB or row is absent."""
    if not device_id or not DEVICE_DB.exists():
        return device_id, None
    try:
        import sqlite3
        con = sqlite3.connect(f"file:{DEVICE_DB}?mode=ro", uri=True, timeout=2)
        con.row_factory = sqlite3.Row
        row = con.execute(
            "SELECT udid, os_version FROM devices WHERE udid=? OR serial=?",
            (device_id, device_id)).fetchone()
        if not row:
            return device_id, None
        # Prefer a human name/user alias (e.g. 'Lainey') over the raw udid/AVD name.
        al = con.execute(
            "SELECT alias FROM aliases WHERE udid=? AND kind IN ('name','user') "
            "ORDER BY kind LIMIT 1", (row["udid"],)).fetchone()
        con.close()
        return (al["alias"] if al else row["udid"]), row["os_version"]
    except Exception:
        return device_id, None


def _device_udid(device_id):
    """Resolve a device id (iOS udid OR android adb serial) to its canonical udid."""
    if not device_id or not DEVICE_DB.exists():
        return device_id
    try:
        import sqlite3
        con = sqlite3.connect(f"file:{DEVICE_DB}?mode=ro", uri=True, timeout=2)
        row = con.execute("SELECT udid FROM devices WHERE udid=? OR serial=?",
                          (device_id, device_id)).fetchone()
        con.close()
        return row[0] if row else device_id
    except Exception:
        return device_id


def _last_alias_for(device_id):
    """'last-ios'/'last-android' if device_id is the recorded last device, else None."""
    if not device_id or not DEVICE_DB.exists():
        return None
    try:
        import sqlite3
        con = sqlite3.connect(f"file:{DEVICE_DB}?mode=ro", uri=True, timeout=2)
        udid = _device_udid(device_id)
        out = None
        for key, alias in (("last_ios", "last-ios"), ("last_android", "last-android")):
            row = con.execute("SELECT v FROM kv WHERE k=?", (key,)).fetchone()
            if row and row[0] == udid:
                out = alias
                break
        con.close()
        return out
    except Exception:
        return None


def _device_aliases(device_id):
    """Every human handle for a device — name alias, last-<platform>, raw id — so any
    place that prints a deviceId can show all the ways to name it (Travis, Low item)."""
    out = []
    name, _os = _device_label(device_id)
    if name and name != device_id:
        out.append(name)
    last = _last_alias_for(device_id)
    if last:
        out.append(last)
    if device_id:
        out.append(device_id)
    return out


def _sim_token(device_id, platform):
    """Best `--sim` token for a re-run, in priority order: name alias → last-<platform>
    → raw id. The raw adb serial often does NOT resolve (`manage_devices --resolve
    emulator-5554` fails) while the name alias / last-android do — so name/last-* first."""
    if not device_id:
        return f"last-{platform}" if platform in ("ios", "android") else None
    name, _os = _device_label(device_id)
    if name and name != device_id:
        return name
    return _last_alias_for(device_id) or device_id


def _looks_headless(_device_id, platform):
    """Best-effort 'will the screen be black?' check. On this host the Android emulator
    boots -no-window + swiftshader (screenshots/recordings come back BLACK); iOS sims are
    windowed. There is no persisted headless flag, so this is a 'likely', not a certainty."""
    return platform == "android"


def _fmt_started(epoch):
    if not epoch:
        return "—"
    dt = datetime.fromtimestamp(epoch)
    today = datetime.now().date()
    delta_days = (today - dt.date()).days
    when = {0: "today", 1: "yesterday"}.get(delta_days, dt.strftime("%b %-d"))
    return f"{when} {dt.strftime('%H:%M')}"  # 24-hour local time


def _summary_meta(run_dir):
    """The summary.json `meta` block (new shape) or the top-level dict (old shape),
    or None when there is no readable summary."""
    sm = run_dir / "summary.json"
    if not sm.exists():
        return None
    try:
        d = json.loads(sm.read_text())
    except Exception:
        return None
    return d.get("meta") or d


# Result-column styling. GREEN (bold) = mostly good news; RED = mostly bad; "" = mixed.
_ANSI = {"green": "\033[1;32m", "red": "\033[31m", "bold": "\033[1m",
         "cyan": "\033[36m", "reset": "\033[0m"}


def _style(text, style):
    if not style or not sys.stdout.isatty():
        return text
    return f"{_ANSI[style]}{text}{_ANSI['reset']}"


def _run_result(run_dir):
    """(label, style) summarizing a run, per the agreed decision table.

    style ∈ {"green","red",""}: green = highlight good news, red = bad, "" = mixed.
    The pass-rate denominator is `targeted` (jobs the run set out to run), so an
    aborted run reports its honest fraction (18/37, not 18/18)."""
    m = _summary_meta(run_dir)
    if m is None:
        return "No summary (crashed/killed?)", "red"
    ran, targeted, passed, new_fail, backlog = _run_totals(m)

    if m.get("canceled"):
        return _canceled_label(m, ran, targeted)
    if ran == 0:
        return "No tests ran", "red"

    pct = round(100 * passed / targeted) if targeted else 0
    carried = f" · {backlog} carried" if backlog else ""

    # ── good news (GREEN, bold) ─────────────────────────────────────────────
    # No new failures. 100% with nothing carried is an unqualified Success; otherwise
    # it's still a pass, with a plain carried-count (no 🐞/🔎 icons — Travis A/B/D).
    if new_fail == 0:
        return f"Success: ({passed}/{targeted}){carried}", "green"

    # ── 0% pass WITH real failures (RED) — the bench case ────────────────────
    # Label it as the failure it is; the per-bucket breakdown lives in `inspect`.
    if passed == 0:
        return f"Fail: 0% pass (0/{targeted})", "red"

    # ── mixed (no highlight) — spell out "new failures", drop the ✗ glyph ────
    return f"{pct}% pass ({passed}/{targeted}) · {new_fail} new failures{carried}", ""


def _run_totals(m):
    """(ran, targeted, passed, new_fail, backlog) from a summary's totals block."""
    t = m.get("totals") or {}
    ran = t.get("total", 0)
    return (ran, t.get("targeted") or ran, t.get("passed", 0), t.get("failed", 0),
            t.get("knownBugs", 0) + t.get("findings", 0))


def _canceled_label(m, ran, targeted):
    """Canceled / aborted runs are all RED; the reason picks the wording."""
    reason = (m.get("cancelReason") or "").lower()
    note = f" · {ran}/{targeted} ran" if ran else ""
    if reason == "user":
        return f"Canceled by user{note}", "red"
    if reason == "panic" or "incomplete" in reason or "placeholder" in reason:
        return f"Crashed/incomplete{note}", "red"
    return "Failed gating", "red"


def _hyperlink(label, path, width):
    """label left-padded to `width`, wrapped as an OSC-8 file:// hyperlink on a TTY."""
    padded = label.ljust(width)
    if not sys.stdout.isatty():
        return padded
    uri = path.resolve().as_uri()
    return f"\033]8;;{uri}\033\\{padded}\033]8;;\033\\"


RUNS_WINDOW_H = 72  # how far back the recent-runs table reaches


def _run_platform_cols(p):
    """(driver, platform) table cells for one run's params."""
    if "e2e" not in (p.get("layers") or []):
        # Headless runs are host-side HTTP tests — no device, no platform. Don't claim one
        # (the old code showed a phantom "iOS" with a "—" driver).
        return "—", "—"
    # Prefer the stable device NAME (AVD name / iOS device name) the run recorded —
    # the adb serial (deviceId, e.g. emulator-5556) is reused across back-to-back
    # bench sims, so labelling by it collapses every android run to one alias. Fall
    # back to --sim, then the serial, for pre-change runs that lack a name.
    dev_key = p.get("deviceName") or p.get("sim") or p.get("deviceId")
    driver, osv = _device_label(dev_key)
    plat = {"ios": "iOS", "android": "Android", "web": "Web"}.get(
        p.get("platform"), (p.get("platform") or "—").capitalize())
    return driver or "—", (f"{plat} / {osv}" if osv else plat)


def _run_flavor(p):
    """Flavor = layers + selection scope, so 'e2e' alone vs the full sweep are
    distinguishable (Travis F). Scope mirrors qa.ts: smoke tag → smoke; no tags+no
    areas → all; else the explicit tags/areas."""
    ptags, pareas = p.get("tags") or [], p.get("areas") or []
    if "smoke" in ptags:
        scope = "smoke"
    elif not ptags and not pareas:
        scope = "all"
    else:
        scope = ", ".join(pareas or ptags)
    layer_s = "+".join(p.get("layers") or [])
    return f"{layer_s}/{scope}" if layer_s else "—"


def _recent_run_row(d, now, window_h):
    """Table row for one run dir, or None (not a qa run / outside the window)."""
    params = d / "run-params.json"
    if not d.is_dir() or not params.exists():
        return None  # qa runs only (manual single-flow runs don't write params)
    try:
        p = json.loads(params.read_text())
    except Exception:
        return None
    started = convert_iso_timestamp(p.get("startedAt"))
    if not started or (now - started) > window_h * 3600:
        return None
    m = _summary_meta(d)
    fin = convert_iso_timestamp(m.get("finishedAt")) if m else None
    driver, platform = _run_platform_cols(p)
    label, rstyle = _run_result(d)
    return {"dir": d, "driver": driver, "platform": platform,
            "started": _fmt_started(started), "started_epoch": started,
            "runtime": f"{(fin - started) / 3600:.2f}" if fin else "—",
            "flavor": _run_flavor(p), "result": label, "result_style": rstyle}


def _collect_recent_runs(window_h=RUNS_WINDOW_H):
    """All qa runs started within `window_h` hours, newest first. One row dict each."""
    now = time.time()
    rows = [_recent_run_row(d, now, window_h) for d in OUTPUT_ROOT.glob("run-*")]
    rows = [r for r in rows if r]
    rows.sort(key=lambda r: r["started_epoch"], reverse=True)
    return rows


def _recent_runs_table(rows=None, window_h=RUNS_WINDOW_H, numbered=False):
    """Render the recent-runs table (no row cap, reverse-chronological). With
    numbered=True each row gets a 1-based index for `inspect recent` selection.
    Returns the rows so callers can map an index back to a run dir."""
    if rows is None:
        rows = _collect_recent_runs(window_h)
    if not rows:
        return rows

    cols = [("driver", "Driver"), ("platform", "Platform"),
            ("started", "Started"), ("runtime", "Run Time"),
            ("flavor", "Flavor"), ("result", "Result")]
    widths = {k: len(h) for k, h in cols}
    for r in rows:
        for k, _ in cols:
            widths[k] = max(widths[k], len(str(r[k])))

    numw = len(str(len(rows)))
    pad = (" " * (numw + 4)) if numbered else "  "  # "  {i}) " is numw+4 wide
    print(f"\nQA runs in the past {window_h}h (driver = clickable link to artifacts):")
    header = "  ".join(h.ljust(widths[k]) for k, h in cols)
    print(pad + header)
    print(pad + "  ".join("-" * widths[k] for k, _ in cols))
    for i, r in enumerate(rows, 1):
        prefix = f"  {str(i).rjust(numw)}) " if numbered else "  "
        driver_cell = _hyperlink(str(r["driver"]), r["dir"], widths["driver"])
        mid = "  ".join(str(r[k]).ljust(widths[k]) for k, _ in cols[1:-1])
        result_cell = _style(str(r["result"]).ljust(widths["result"]), r["result_style"])
        print(prefix + driver_cell + "  " + mid + "  " + result_cell)
    return rows


def _active_job_entry(job, hb, now):
    jstart = convert_iso_timestamp(job.get("startedAt"))
    entry = {
        "test": job.get("id"),
        "tool": job.get("tool"),
        "role": job.get("role"),
        "tags": job.get("tags"),
        "testElapsedS": (now - jstart) if jstart else None,
        "step": None,
        "stepElapsedS": None,
    }
    if job.get("tool") == "maestro" and hb.get("runDir"):
        step, t0, _ = latest_maestro_step([Path(hb["runDir"]) / "e2e"])
        if step:
            entry["step"] = step
            entry["stepElapsedS"] = now - t0 if t0 else None
    return entry


def _heartbeat_run(hb, procs, now):
    """One qaRuns payload entry from a live/abandoned heartbeat."""
    started = convert_iso_timestamp(hb.get("startedAt"))
    run = {
        "runId": hb.get("runId"),
        "state": hb.get("state"),
        "abandoned": hb["abandoned"],
        "invoker": None,
        "totalElapsedS": (now - started) if started else None,
        "completed": hb.get("completed"),
        "totalJobs": hb.get("totalJobs"),
        "active": [_active_job_entry(job, hb, now) for job in hb.get("active") or []],
    }
    if hb.get("pid") in procs:
        run["invoker"], _ = invoker_chain(hb["pid"], procs)
    return run


def _adhoc_maestro_step(test_procs, runs, now):
    """Ad-hoc maestro CLI / MCP flows that the qa heartbeat knows nothing about."""
    if runs or not any(p["kind"] in ("maestro-cli", "maestro-mcp") for p in test_procs):
        return None
    step, t0, log = latest_maestro_step(
        [REPO / "tmp" / "maestro", Path.home() / ".maestro" / "tests"], max_age_s=1800)
    if not step:
        return None
    return {"step": step, "stepElapsedS": now - t0 if t0 else None, "log": log}


def _print_qa_run(run):
    if run["abandoned"]:
        print(f"🚨🚨🚨😵🪦🪦  qa run {run['runId']}  state={run['state']}")
    else:
        print(f"🏃  qa run {run['runId']}  state={run['state']}  invoker={run['invoker'] or '?'}")
    print(f"    run elapsed {interval_into_string(run['totalElapsedS'])}, "
          f"jobs {run['completed']}/{run['totalJobs'] if run['totalJobs'] is not None else '?'} done")
    for j in run["active"]:
        role = f"  role={j['role']}" if j.get("role") else ""
        tags = f"  tags=[{', '.join(j['tags'])}]" if j.get("tags") else ""
        print(f"    ▶ {j['test']} ({j['tool']}){role}{tags}  — in test {interval_into_string(j['testElapsedS'])}")
        if j.get("step"):
            print(f"      step: {j['step']}  ({interval_into_string(j['stepElapsedS'])} in step)")


def _print_test_processes(processes):
    print("\nTest processes:")
    for p in processes:
        chain = f" [{p['invokerChain']}]" if p["invokerChain"] else ""
        print(f"  {p['pid']:>7}  {p['kind']:<16} invoker={p['invoker']:<7}{chain} "
              f"up {interval_into_string(p['elapsedS'])}")


def _print_idle_status(payload):
    print("✅  No tests in progress.")
    if payload["panicMarker"]:
        print("⚠️   Stale PANIC marker present (tests/PANIC) — qa clears it on next start.")
    _recent_runs_table()


def _print_status_text(payload, runs, adhoc_step, test_procs):
    # A lingering maestro MCP server is not "a test running" — don't let it suppress
    # the idle view + recent-runs table (it's the common leftover state).
    non_mcp_procs = [p for p in test_procs if p["kind"] != "maestro-mcp"]
    if not runs and not non_mcp_procs:
        return _print_idle_status(payload)
    for run in runs:
        _print_qa_run(run)
    if adhoc_step:
        print(f"▶   Ad-hoc maestro flow step: {adhoc_step['step']} "
              f"({interval_into_string(adhoc_step['stepElapsedS'])} in step)\n    log: {adhoc_step['log']}")
    if payload["processes"]:
        _print_test_processes(payload["processes"])
    if payload["panicMarker"]:
        print("\n⚠️   PANIC marker present (tests/PANIC).")


def cmd_status(as_json):
    now = time.time()
    procs = ps_snapshot()
    hb = read_heartbeat(procs)
    test_procs = find_test_processes(procs)
    runs = []
    if hb and (hb["runnerAlive"] or hb["abandoned"]):
        runs.append(_heartbeat_run(hb, procs, now))
    adhoc_step = _adhoc_maestro_step(test_procs, runs, now)
    payload = {
        "timestamp": datetime.now().astimezone().isoformat(timespec="seconds"),
        "qaRuns": runs,
        "adhocMaestroStep": adhoc_step,
        "processes": [
            {"pid": p["pid"], "kind": p["kind"], "invoker": p["invoker"],
             "invokerChain": p["invoker_chain"], "elapsedS": p["etime_s"],
             "cmd": p["cmd"][:160]}
            for p in sorted(test_procs, key=lambda x: x["kind"])
        ],
        "panicMarker": PANIC_MARKER.exists(),
    }
    if as_json:
        print(json.dumps(payload, indent=2))
        return 0
    _print_status_text(payload, runs, adhoc_step, test_procs)
    return 0


# ── nuke ──────────────────────────────────────────────────────────────────────

NUKE_ALIASES = {
    "all": ["qa", "cli", "mcp", "xcodebuild", "headless", "playwright"],
    "them-all": ["qa", "cli", "mcp", "xcodebuild", "headless", "playwright"],
    "maestro": ["cli", "mcp", "xcodebuild"],
    "headless": ["vitest", "newman"],
    "npm": ["qa"],
}
TARGET_TO_KINDS = {
    "qa": ["qa-runner"],
    "cli": ["maestro-cli"],
   # FIXME: mcp is disabled because of test interference. "mcp": ["maestro-mcp"],
    "xcodebuild": ["xcuitest-driver"],
    "vitest": ["vitest"],
    "newman": ["newman"],
    "playwright": ["playwright"],
}


def _expand_one_target(t, out):
    for x in NUKE_ALIASES.get(t, [t]):
        for y in NUKE_ALIASES.get(x, [x]):  # headless inside all
            if y not in out:
                out.append(y)


def expand_targets(spec):
    raw = [t.strip().lower() for t in spec.split(",") if t.strip()]
    out = []
    for t in raw:
        _expand_one_target(t, out)
    unknown = [t for t in out if t not in TARGET_TO_KINDS]
    return [t for t in out if t in TARGET_TO_KINDS], unknown


def alive(pid):
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    # os.kill(pid, 0) succeeds on zombies; treat them as dead.
    state = subprocess.run(["ps", "-o", "state=", "-p", str(pid)],
                           capture_output=True, text=True).stdout.strip()
    return bool(state) and not state.startswith("Z")


def signal_ladder(pids, actions):
    """One SIGQUIT to each, wait 2s, SIGKILL survivors (per spec)."""
    pids = [p for p in pids if alive(p)]
    if not pids:
        return
    for pid in pids:
        try:
            os.kill(pid, signal.SIGQUIT)
            actions.append({"pid": pid, "signal": "SIGQUIT"})
        except OSError as e:
            actions.append({"pid": pid, "signal": "SIGQUIT", "error": str(e)})
    time.sleep(2)
    for pid in pids:
        if alive(pid):
            try:
                os.kill(pid, signal.SIGKILL)
                actions.append({"pid": pid, "signal": "SIGKILL"})
            except OSError as e:
                actions.append({"pid": pid, "signal": "SIGKILL", "error": str(e)})


def _nuke_qa(test_procs, procs, actions, killed_kinds):
    # Known method: PANIC marker — the runner aborts between tests and
    # finalizes its summary. Then ladder the runner tree anyway: a test
    # mid-flight (maestro/vitest/newman child) won't be aborted by the marker.
    # No live qa-runner (e.g. an ABANDONED heartbeat) → no marker: there is
    # nothing to abort, and a stale marker only pollutes the next run's start.
    qa_runners = [tp for tp in test_procs if tp["kind"] == "qa-runner"]
    if qa_runners:
        PANIC_MARKER.write_text(f"testctl nuke at {datetime.now().isoformat()}\n")
        actions.append({"method": "panic-marker", "path": str(PANIC_MARKER)})
    for p in qa_runners:
        tree = [p["pid"]] + [d["pid"] for d in descendants(p["pid"], procs)]
        signal_ladder(tree, actions)
        killed_kinds.append("qa-runner")


def _nuke_mcp(test_procs, procs, actions, killed_kinds):
    mcp_pids = [p["pid"] for p in test_procs if p["kind"] == "maestro-mcp"]
    # MCP-owned XCUITest drivers go too — orphaned drivers are exactly what
    # holds the simulator/port and wedges later CLI runs.
    owned = [p["pid"] for p in test_procs if p["kind"] == "xcuitest-driver"
             and any(a["pid"] in mcp_pids for a in ancestors(p["pid"], procs))]
    if mcp_pids or owned:
        signal_ladder(mcp_pids + owned, actions)
        killed_kinds.append("maestro-mcp")


def _nuke_plain_kinds(targets, test_procs, actions, killed_kinds):
    plain = {"cli": "maestro-cli", "xcodebuild": "xcuitest-driver",
             "vitest": "vitest", "newman": "newman", "playwright": "playwright"}
    for t, kind in plain.items():
        if t not in targets:
            continue
        pids = [p["pid"] for p in test_procs if p["kind"] == kind]
        if pids:
            signal_ladder(pids, actions)
            killed_kinds.append(kind)


def _nuke_action_line(a):
    if "method" in a:
        return f"📍  wrote {a['method']} → {a['path']}"
    err = f"  ({a['error']})" if "error" in a else ""
    return f"🛑  {a['signal']} → pid {a['pid']}{err}"


def _print_nuke_text(spec, targets, unknown, actions, killed_kinds):
    if unknown:
        print(f"⚠️   Unknown nuke target(s) ignored: {', '.join(unknown)}")
    if not actions:
        print(f"✅  Nothing to nuke for: {', '.join(targets) or spec}")
    for a in actions:
        print(_nuke_action_line(a))
    if "qa-runner" in killed_kinds:
        print("ℹ️   Remove is not needed: qa clears the PANIC marker on next start.")


def cmd_nuke(spec, as_json):
    targets, unknown = expand_targets(spec)
    procs = ps_snapshot()
    test_procs = find_test_processes(procs)
    actions, killed_kinds = [], []
    if "qa" in targets:
        _nuke_qa(test_procs, procs, actions, killed_kinds)
    if "mcp" in targets:
        _nuke_mcp(test_procs, procs, actions, killed_kinds)
    _nuke_plain_kinds(targets, test_procs, actions, killed_kinds)
    payload = {"targets": targets, "unknownTargets": unknown, "actions": actions}
    if as_json:
        print(json.dumps(payload, indent=2))
    else:
        _print_nuke_text(spec, targets, unknown, actions, killed_kinds)
    return 0


# ── health ────────────────────────────────────────────────────────────────────
# All environment checking lives here (scripts/local_bubble_health was folded in
# and deleted). Checks are small functions returning the dict shape below; they run
# in PARALLEL (thread pool) and print in the fixed HEALTH_CHECKS registry order, so
# output stays deterministic while the slow device probes overlap.
#
# Check dict:
#   name/status/detail        as before (status: ok | warn | fail)
#   alarm: bool               🚨 severity (secrets protection issues) instead of ❌
#   lines: [str]              indented per-device/per-hit lines under the detail
#   why: str                  what/why narration, shown under -v
#   quiet: bool               suppress this ok result unless -v (per-result override)
#   fix: str                  human advice (existing)
#   fix_kind: "auto"|"manual" --fix executes "auto" ones; everything else is advice.
#                             sudo / brew / >5-min tasks / image downloads are NEVER auto.
#   fix_cmd: [argv]           command --fix runs (auto only)
#   fix_bg: bool              run in a background shell (servers) vs foreground
#   fix_log: str              repo-relative log path shown to the user (bg only)
#   fix_probe: str            FIX_PROBES key re-checked before acting (double-start guard)


def plural(n, noun):
    """'emulator' -> 'emulators' when n != 1. Our nouns are all regular."""
    return noun if n == 1 else noun + "s"


def is_are(n):
    return "is" if n == 1 else "are"


def count_phrase(n, noun, verb_ing=None):
    """Grammatical count: (1,'Android emulator','running') -> '1 Android emulator is
    running'; 0 -> 'No Android emulator is running'; 2 -> '2 Android emulators are
    running'. verb_ing=None omits the verb clause ('2 Android devices')."""
    head = f"No {noun}" if n == 0 else f"{n} {plural(n, noun)}"
    if verb_ing is None:
        return head
    return f"{head} {is_are(n or 1) if n else 'is'} {verb_ing}"


def _ro_device_db():
    """Fresh READ-ONLY connection to the device-manager DB (one per call). Health
    checks run in worker threads, so manage_devices' single global connection
    (md.db()) must never be used here — same pattern as _device_label above.
    None if the DB is absent or unopenable."""
    if not DEVICE_DB.exists():
        return None
    try:
        import sqlite3
        con = sqlite3.connect(f"file:{DEVICE_DB}?mode=ro", uri=True, timeout=2)
        con.row_factory = sqlite3.Row
        return con
    except Exception:
        return None


def _shortest_alias(names):
    """Display alias policy: the shortest name wins ('Bo' before 'Charlotte'),
    ties broken alphabetically. None when there are no aliases."""
    return min(names, key=lambda a: (len(a), a.lower())) if names else None


def pick_alias(udid, con=None):
    """Shortest human alias for a device from the device-manager DB, or None.
    Pass an open read-only connection to batch lookups; otherwise opens its own."""
    own = con is None
    if own:
        con = _ro_device_db()
    if con is None:
        return None
    try:
        rows = [r[0] for r in con.execute(
            "SELECT alias FROM aliases WHERE udid=? AND kind IN ('name','user')",
            (udid,))]
    except Exception:
        rows = []
    finally:
        if own:
            con.close()
    return _shortest_alias(rows)


def _compile_levels():
    """udid -> compile_level (low|medium|hot) for devices with a recorded warmup."""
    con = _ro_device_db()
    if con is None:
        return {}
    try:
        return {r["udid"]: r["compile_level"] for r in con.execute(
            "SELECT udid, compile_level FROM devices WHERE compile_level IS NOT NULL")}
    except Exception:
        return {}
    finally:
        con.close()


def _last_device_fix(platform):
    """Auto-fix fields to boot the last-used device of a platform — only when the
    device-manager kv table has one recorded; {} otherwise (caller falls back to
    manual advice)."""
    con = _ro_device_db()
    if con is None:
        return {}
    try:
        row = con.execute("SELECT v FROM kv WHERE k=?", (f"last_{platform}",)).fetchone()
    except Exception:
        row = None
    finally:
        con.close()
    if not row:
        return {}
    return {"fix": f"boot the last-used {platform} device: "
                   f"`manage_devices.py --start last-{platform}`",
            "fix_kind": "auto",
            "fix_cmd": ["python3", "scripts/manage_devices.py", "--start", f"last-{platform}"]}


def _device_line(alias, name, os_label, extras=()):
    """One indented device line: 'Charlotte - Pixel_10… - Android 17 - API 37 -
    optimized/hot'. alias is dropped when absent or identical to the name."""
    parts = ([alias] if alias and alias != name else []) + [name, os_label]
    parts += [e for e in extras if e]
    return " - ".join(parts)


def _adb_getprop(serial, prop):
    try:
        r = subprocess.run([md.adb_bin(), "-s", serial, "shell", "getprop", prop],
                           capture_output=True, text=True, timeout=8)
        return (r.stdout or "").strip() or None
    except (subprocess.SubprocessError, OSError):
        return None


def check_load():
    one, five, _ = os.getloadavg()
    status = "ok" if one <= LOAD_CEILING else "fail"
    return {"name": "load-average", "status": status,
            "detail": f"1-min {one:.1f}, 5-min {five:.1f} (ceiling {LOAD_CEILING:.0f})",
            **({} if status == "ok" else
               {"fix": "wait, or close heavy apps; check `xcrun simctl shutdown all` if a stale sim is grinding"})}


def api_listener_pid():
    out = subprocess.run(["lsof", "-nP", f"-iTCP:{API_PORT}", "-sTCP:LISTEN", "-Fp"],
                         capture_output=True, text=True).stdout
    m = re.search(r"^p(\d+)", out, re.M)
    return int(m.group(1)) if m else None


# How the local API server was started → what testing it can support. Keyed by
# npm_lifecycle_event (primary) / BUBBLE_SERVER_MODE (fallback) read from the
# listener's environment (`ps eww`).
SERVER_MODE_SUITABILITY = {
    "qa:server": "Ok for all testing",
    "qa": "Ok for writeable but non-destructive tests (an active qa run owns the seeds)",
    "prod": "Ok for readonly testing",
    "start": "Ok for readonly testing",
    "dev": "Ok for tests that don't depend on seeded data (serves the dev DB, not bubble_test)",
}


def api_server_mode():
    """(pid, mode) of the local API listener. mode is a SERVER_MODE_SUITABILITY key
    or None when undetectable."""
    pid = api_listener_pid()
    if pid is None:
        return None, None
    envout = subprocess.run(["ps", "eww", "-p", str(pid)],
                            capture_output=True, text=True).stdout
    m = re.search(r"npm_lifecycle_event=(\S+)", envout)
    if m and m.group(1) in SERVER_MODE_SUITABILITY:
        return pid, m.group(1)
    m = re.search(r"BUBBLE_SERVER_MODE=(\w+)", envout)
    if m:
        mode = {"qa": "qa:server"}.get(m.group(1), m.group(1))
        return pid, mode if mode in SERVER_MODE_SUITABILITY else None
    return pid, None


def _local_mode_note():
    pid, mode = api_server_mode()
    if mode is None:
        return f" (pid {pid}, start mode undetected)" if pid else ""
    return f" — started via `npm run {mode}`: {SERVER_MODE_SUITABILITY[mode]}"


def _api_state(code, body):
    """/api/v1/health HTTP result → (state word, check status, detail). States:
    Healthy (200 + status ok), Partial Fail (answers but degraded/odd), Not Running."""
    if code is None:
        return "Not Running", "fail", body or "no HTTP response"
    try:
        health = json.loads(body)
    except (json.JSONDecodeError, TypeError):
        return "Partial Fail", "warn", f"/api/v1/health → {code} (non-JSON body)"
    db = health.get("services", {}).get("database", {}).get("status")
    line = f"/api/v1/health → {code}, status={health.get('status')}, db={db}"
    if code == 200 and health.get("status") == "ok":
        return "Healthy", "ok", line
    return ("Partial Fail", "warn",
            f"{line} — the endpoint answers but reports a degraded or critical service")


def _check_api_remote():
    code, body = http_get(f"{ENV.api_base}/api/v1/health", timeout=10)
    word, status, extra = _api_state(code, body)
    result = {"name": "api-server", "status": status,
              "detail": f"{word} — {ENV.name} ({ENV.host}): {extra}"}
    if status != "ok":
        result["fix"] = (f"{ENV.name} is remote — check the hosting console and deploy "
                         f"logs for {ENV.host}; nothing testctl can start from here")
    return result


def _check_api_local():
    v4 = tcp_open("127.0.0.1", API_PORT)
    v6 = tcp_open("::1", API_PORT)
    if not v4 and not v6:
        return {"name": "api-server", "status": "fail",
                "detail": f"Not Running — nothing listening on port {API_PORT} (v4 or v6)",
                "fix": "start it: `npm run qa:server` (serves bubble_test; plain dev server breaks seeded logins)",
                "fix_kind": "auto", "fix_cmd": ["npm", "run", "qa:server"],
                "fix_bg": True, "fix_log": "tests/output/qa-server.log",
                "fix_probe": "api-port",
                "why": f"e2e/headless tests hit the API on :{API_PORT}; qa:server is the default because it serves the bubble_test DB the seeded logins need"}
    code, body = http_get(f"http://127.0.0.1:{API_PORT}/api/v1/health", timeout=8)
    if code is None:
        return {"name": "api-server", "status": "fail",
                "detail": f"Partial Fail — port {API_PORT} accepts connections but "
                          f"/api/v1/health gave no HTTP response ({body})",
                "fix": f"kill listener (pid {api_listener_pid()}) and restart: `npm run qa:server`"}
    note = ""
    if v4 != v6:
        which = "IPv4-only" if v4 else "IPv6-only"
        note = (f"; ⚠ {which} listener — localhost may resolve to the other family "
                "(qa:server binds dual-stack via API_BIND_HOST=::)")
    word, status, extra = _api_state(code, body)
    return {"name": "api-server", "status": status,
            "detail": f"{word} — {extra}{note}{_local_mode_note()}"}


def check_api():
    return _check_api_local() if ENV.is_local else _check_api_remote()


def check_qa_server_identity():
    pid = api_listener_pid()
    if pid is None:
        return {"name": "qa-server-identity", "status": "fail",
                "detail": f"no listener on {API_PORT} to inspect",
                "fix": "start it: `npm run qa:server`"}
    envout = subprocess.run(["ps", "eww", "-p", str(pid)],
                            capture_output=True, text=True).stdout
    if "bubble_test" in envout:
        return {"name": "qa-server-identity", "status": "ok",
                "detail": f"pid {pid} serves bubble_test (qa:server)"}
    m = re.search(r"DATABASE_URL=\S*/(\w+)", envout)
    db = m.group(1) if m else "unknown"
    return {"name": "qa-server-identity", "status": "fail",
            "detail": f"pid {pid} serves DB '{db}', not bubble_test — seeded logins will 401",
            "fix": f"kill pid {pid}, then `npm run qa:server`"}


def check_metro():
    code, _ = http_get(f"http://localhost:{METRO_PORT}/status", timeout=4)
    if code == 200:
        return {"name": "metro", "status": "ok", "detail": f"Metro bundler up on :{METRO_PORT}"}
    if code is None and not tcp_open("127.0.0.1", METRO_PORT):
        return {"name": "metro", "status": "fail",
                "detail": f"DOWN — nothing on :{METRO_PORT}",
                "fix": "start it: `npm run metro_bundler`. If watchman EPERM after a brew upgrade: `watchman shutdown-server`",
                "fix_kind": "auto", "fix_cmd": ["npm", "run", "metro_bundler"],
                "fix_bg": True, "fix_log": "tests/output/metro.log",
                "fix_probe": "metro-port",
                "why": f"the dev-build app loads its JS bundle from Metro on :{METRO_PORT}; e2e flows hang on a white screen without it"}
    return {"name": "metro", "status": "fail",
            "detail": f"HUNG/odd — :{METRO_PORT} open but /status → {code or 'no response'}",
            "fix": "restart Metro: `npm run mobile:start`"}


def booted_sims():
    try:
        out = subprocess.run(["xcrun", "simctl", "list", "-j", "devices", "booted"],
                             capture_output=True, text=True, timeout=20).stdout
        data = json.loads(out)
    except (subprocess.SubprocessError, json.JSONDecodeError, OSError):
        return []
    sims = []
    for runtime, devs in data.get("devices", {}).items():
        ver = runtime.rsplit(".", 1)[-1].replace("iOS-", "").replace("-", ".")
        for d in devs:
            sims.append({"udid": d["udid"], "name": d["name"], "runtime": ver,
                         "bootedAt": convert_iso_timestamp(d.get("lastBootedAt"))})
    return sims


# Simulators booted longer than ~500,000s have shown instability (crashing sim-side
# processes). Mandatory restart at 95% of that age; warnings start at 80%.
# The qa runner's sim-boot-age gate (tests/runner/gating.ts) shares these thresholds
# and performs the restart itself; health only reports.
SIM_INSTABILITY_S = 500_000
SIM_RESTART_S = SIM_INSTABILITY_S * 0.95   # 475,000 s
SIM_WARN_S = SIM_INSTABILITY_S * 0.80      # 400,000 s


def fmt_deadline(epoch):
    dt = datetime.fromtimestamp(epoch)
    return f"{dt.day} {dt.strftime('%b %H:%M')}"


def check_sim_age():
    now = time.time()
    sims = [{**s, "age_s": now - s["bootedAt"]} for s in booted_sims() if s.get("bootedAt")]
    over = [s for s in sims if s["age_s"] >= SIM_RESTART_S]
    aging = [s for s in sims if SIM_WARN_S <= s["age_s"] < SIM_RESTART_S]
    if over:
        names = "; ".join(f"'{s['name']}' booted {s['age_s'] / 86400:.1f} days ago" for s in over)
        return {"name": "sim-boot-age", "status": "fail",
                "detail": f"RESTART REQUIRED — {names} — past 95% of the "
                          f"{SIM_INSTABILITY_S:,}s age where sims grow crashing processes",
                "fix": "restart: `xcrun simctl shutdown <udid> && xcrun simctl boot <udid>` "
                       "(the qa runner's sim-boot-age gate does this automatically before e2e runs)"}
    if aging:
        names = "; ".join(f"'{s['name']}' booted {s['age_s'] / 86400:.1f} days ago, restart by "
                          f"{fmt_deadline(s['bootedAt'] + SIM_RESTART_S)}" for s in aging)
        return {"name": "sim-boot-age", "status": "warn",
                "detail": f"{names} — sims grow unstable past {SIM_INSTABILITY_S:,}s booted",
                "fix": "restart it at the next convenient break: `xcrun simctl shutdown <udid> && xcrun simctl boot <udid>`"}
    if not sims:
        return {"name": "sim-boot-age", "status": "ok", "detail": "no booted simulator to age-check"}
    oldest = max(sims, key=lambda s: s["age_s"])
    return {"name": "sim-boot-age", "status": "ok",
            "detail": f"oldest booted sim '{oldest['name']}' up {oldest['age_s'] / 86400:.1f} days "
                      f"(warn at {SIM_WARN_S / 86400:.1f}d, restart at {SIM_RESTART_S / 86400:.1f}d)"}


def check_sim_binary():
    sims = booted_sims()
    if not sims:
        return {"name": "sim-app-binary", "status": "fail",
                "detail": "no booted iOS simulator",
                "fix": "boot one (Simulator.app or `xcrun simctl boot <udid>`); shut down when idle to avoid the mediaanalysisd CPU grind"}
    sim = sims[0]
    try:
        app_path = subprocess.run(
            ["xcrun", "simctl", "get_app_container", sim["udid"], APP_ID, "app"],
            capture_output=True, text=True, timeout=20).stdout.strip()
    except (subprocess.SubprocessError, OSError):
        app_path = ""
    if not app_path or not Path(app_path).exists():
        return {"name": "sim-app-binary", "status": "fail",
                "detail": f"{APP_ID} not installed on booted sim '{sim['name']}' (iOS {sim['runtime']})",
                "fix": "build + install: `npm run mobile:build:ios-sim`"}
    info = Path(app_path) / "Info.plist"
    sdk, exe = "?", None
    try:
        pl = plistlib.loads(info.read_bytes())
        sdk = pl.get("DTSDKName", "?")            # e.g. iphonesimulator26.1
        exe = Path(app_path) / pl.get("CFBundleExecutable", "")
    except (OSError, plistlib.InvalidFileException):
        pass
    mtime = (exe if exe and exe.exists() else Path(app_path)).stat().st_mtime
    age = interval_into_string(time.time() - mtime)
    sdk_ver = re.sub(r"[^0-9.]", "", sdk)
    mismatch = sdk_ver and not (sim["runtime"].startswith(sdk_ver) or sdk_ver.startswith(sim["runtime"]))
    if mismatch:
        return {"name": "sim-app-binary", "status": "warn",
                "detail": f"installed binary built against {sdk}, booted runtime is iOS {sim['runtime']} "
                          f"(binary {age} old) — stale-binary territory (scroll bugs, ghost behavior)",
                "fix": "rebuild: `npm run mobile:build:ios-sim`"}
    return {"name": "sim-app-binary", "status": "ok",
            "detail": f"{APP_ID} on '{sim['name']}' iOS {sim['runtime']}, SDK {sdk}, binary {age} old"}


def _adb_shell(serial, *args):
    try:
        r = subprocess.run([md.adb_bin(), "-s", serial, "shell", *args],
                           capture_output=True, text=True, timeout=8)
        return (r.stdout or "").strip()
    except (subprocess.SubprocessError, OSError):
        return ""


REQUIRED_TOOLS = ("node", "npm", "npx", "psql", "maestro", "watchman")


def check_tooling():
    """Fast presence gate only. Installing is check-env.sh's job — never duplicated
    here, never run automatically (brew/installers can want sudo or network)."""
    cap = htc.capabilities()
    missing = []
    if not cap["xcode"]:
        missing.append("Xcode/xcrun")
    if not cap["adb"]:
        missing.append("adb (Android platform-tools)")
    if not cap["emulator"]:
        missing.append("emulator (Android SDK)")
    missing += [t for t in REQUIRED_TOOLS if not shutil.which(t)]
    why = ("the e2e/headless suites shell out to these; health only detects gaps — "
           "installs go through check-env.sh")
    if missing:
        return {"name": "tooling", "status": "fail",
                "detail": f"missing: {', '.join(missing)}",
                "fix": f"install what's missing: `{CHECK_ENV_CMD}` "
                       "(brew/installer steps are never run automatically)",
                "fix_kind": "manual", "why": why}
    note = ("" if cap["avd_images"]
            else " — but no Android AVD images yet (create one in Android Studio's Device Manager)")
    return {"name": "tooling", "status": "ok",
            "detail": "Xcode, Android SDK/adb/emulator, " + ", ".join(REQUIRED_TOOLS)
                      + " all present" + note,
            "why": why}


def check_ios_sims():
    if not htc.capabilities()["simctl"]:
        return {"name": "ios-simulators", "status": "fail",
                "detail": "xcrun/simctl unavailable — cannot query iOS simulators",
                "fix": f"install Xcode, then `{CHECK_ENV_CMD}` for the rest",
                "fix_kind": "manual"}
    devs = md.ios_devices()
    live = [d for d in devs if d["state"] in ("Running", "Booting")]
    installed = len(devs)
    if not devs:
        return {"name": "ios-simulators", "status": "fail",
                "detail": "no iOS simulators installed",
                "fix": "add one in Xcode (Settings → Platforms / Devices & Simulators)",
                "fix_kind": "manual"}
    if not live:
        base = {"name": "ios-simulators", "status": "fail",
                "detail": f"{count_phrase(0, 'iOS simulator', 'running')} — "
                          f"{installed} {is_are(installed)} installed",
                "fix": "boot one: `manage_devices.py --start <alias>` "
                       "(list: `manage_devices.py -l`)",
                "fix_kind": "manual"}
        base.update(_last_device_fix("ios"))
        return base
    con = _ro_device_db()
    lines = []
    try:
        for d in live:
            alias = pick_alias(d["id"], con)
            booting = "booting" if d["state"] == "Booting" else None
            lines.append(_device_line(alias, d["name"], f"iOS {d['os_version']}", [booting]))
    finally:
        if con is not None:
            con.close()
    return {"name": "ios-simulators", "status": "ok",
            "detail": f"{count_phrase(len(live), 'iOS simulator', 'running')} — "
                      f"{installed} installed",
            "lines": lines}


def check_android_emulators():
    cap = htc.capabilities()
    if not (cap["adb"] and cap["emulator"]):
        return {"name": "android-emulators", "status": "fail",
                "detail": "Android SDK tooling (adb/emulator) unavailable",
                "fix": f"install Android Studio + platform-tools: `{CHECK_ENV_CMD}`",
                "fix_kind": "manual"}
    devs = md.android_all()
    live = [d for d in devs if d["state"] in ("Running", "Booting")]
    installed = len(devs)
    levels = _compile_levels()
    optimized = sum(1 for d in devs if levels.get(d["id"]))
    counts = f"{installed} {is_are(installed)} installed, {optimized} optimized"
    why = ("'optimized' = a recorded AOT warmup level (low/medium/hot) from "
           "`manage_devices --warmup`; warmups take 20-90 min so they are never auto-run")
    if not devs:
        return {"name": "android-emulators", "status": "fail",
                "detail": "no Android emulator AVDs defined",
                "fix": "create one in Android Studio's Device Manager "
                       "(system-image downloads are never automatic)",
                "fix_kind": "manual", "why": why}
    if not live:
        base = {"name": "android-emulators", "status": "fail",
                "detail": f"{count_phrase(0, 'Android emulator', 'running')} — {counts}",
                "fix": "boot one: `manage_devices.py --start <alias>` "
                       "(list: `manage_devices.py -l`)",
                "fix_kind": "manual", "why": why}
        base.update(_last_device_fix("android"))
        return base
    return {"name": "android-emulators", "status": "ok",
            "detail": f"{count_phrase(len(live), 'Android emulator', 'running')} — {counts}",
            "lines": _android_device_lines(live, levels), "why": why}


def _android_extras(d, levels):
    api = _adb_getprop(d["serial"], "ro.build.version.sdk") if d.get("serial") else None
    level = levels.get(d["id"])
    return [f"API {api}" if api else None,
            f"optimized/{level}" if level else "not optimized",
            "booting" if d["state"] == "Booting" else None,
            "headless" if md.looks_headless(d) else None]


def _android_device_lines(live, levels):
    con = _ro_device_db()
    try:
        return [_device_line(pick_alias(d["id"], con), d["name"],
                             f"Android {d['os_version'] or '?'}",
                             _android_extras(d, levels))
                for d in live]
    finally:
        if con is not None:
            con.close()


def check_genymotion():
    if not htc.capabilities()["genymotion"]:
        return {"name": "genymotion", "status": "ok",
                "detail": "gmtool not installed (Genymotion is optional)"}
    try:
        r = subprocess.run(["gmtool", "admin", "list"],
                           capture_output=True, text=True, timeout=10)
    except (subprocess.SubprocessError, OSError):
        return {"name": "genymotion", "status": "warn",
                "detail": "`gmtool admin list` failed/timed out — Genymotion state unknown"}
    rows = [l.split("|") for l in (r.stdout or "").splitlines() if "|" in l]
    on = [row for row in rows if len(row) >= 4 and "On" in row[2]]
    if not on:
        return {"name": "genymotion", "status": "ok",
                "detail": "no Genymotion VM running (gmtool present)"}
    lines = [f"{row[1].strip()} ({row[3].strip()}:5555)" for row in on]
    return {"name": "genymotion", "status": "ok",
            "detail": count_phrase(len(on), "Genymotion emulator", "running"),
            "lines": lines}


def check_real_devices():
    """Native/physical devices — previously invisible to the health view. Android
    real devices run e2e like emulators; iOS real devices are list-only (signing
    unresolved — see manage_devices.ios_real)."""
    cap = htc.capabilities()
    droids = md.android_real() if cap["adb"] else []
    iphones = md.ios_real() if cap["xcode"] else []
    n = len(droids) + len(iphones)
    if n == 0:
        return {"name": "real-devices", "status": "ok",
                "detail": "no real (physical) devices attached"}
    con = _ro_device_db()
    try:
        lines = [_device_line(pick_alias(d["id"], con), d["name"],
                              f"Android {d['os_version'] or '?'}", [f"serial {d['serial']}"])
                 for d in droids]
        lines += [_device_line(pick_alias(d["id"], con), d["name"],
                               f"iOS {d['os_version']}",
                               ["list-only; e2e execution unsupported"])
                  for d in iphones]
    finally:
        if con is not None:
            con.close()
    return {"name": "real-devices", "status": "ok",
            "detail": count_phrase(n, "real device", "attached"), "lines": lines}


def check_db():
    if not shutil.which("psql"):
        return {"name": "db-server", "status": "fail",
                "detail": "psql not on PATH — cannot check PostgreSQL",
                "fix": f"install tooling: `{CHECK_ENV_CMD}`", "fix_kind": "manual"}
    try:
        r = subprocess.run(["psql", "-d", "postgres", "-tAc", "SELECT 1"],
                           capture_output=True, text=True, timeout=10)
    except subprocess.TimeoutExpired:
        return {"name": "db-server", "status": "warn",
                "detail": "psql hung for 10s — PostgreSQL wedged?"}
    if r.returncode != 0 or r.stdout.strip() != "1":
        return {"name": "db-server", "status": "fail",
                "detail": "PostgreSQL is not answering on the default socket",
                "fix": "start it: `brew services start postgresql@16` "
                       "(service management is left to you)",
                "fix_kind": "manual"}
    try:
        l = subprocess.run(["psql", "-lqt"], capture_output=True, text=True, timeout=10)
        dbs = {line.split("|")[0].strip() for line in l.stdout.splitlines() if "|" in line}
    except subprocess.TimeoutExpired:
        dbs = set()
    if "bubble_test" not in dbs:
        return {"name": "db-server", "status": "warn",
                "detail": "PostgreSQL up, but the test DB 'bubble_test' does not exist "
                          "— qa:server and seeded logins need it",
                "fix": "create + seed it (see tests/README.md): TEST_DATABASE_URL drives "
                       "`npm run qa:provision` / `npm run qa:seed`",
                "fix_kind": "manual"}
    return {"name": "db-server", "status": "ok",
            "detail": "PostgreSQL up; bubble_test present"}


def check_adb_reverse():
    """On-device connectivity: the app reaches the Mac's API/Metro via `adb reverse`
    tunnels (scripts/dev-connect.sh, docs/dev-hosts.md). Checked per adb target."""
    if not htc.capabilities()["adb"]:
        return {"name": "adb-reverse", "status": "ok", "quiet": True,
                "detail": "adb unavailable — reverse tunnel n/a"}
    targets = md.android_running() + md.android_real()
    if not targets:
        return {"name": "adb-reverse", "status": "ok", "quiet": True,
                "detail": "no running Android device — reverse tunnel not applicable"}
    problems = []
    for d in targets:
        serial = d.get("serial") or d["id"]
        try:
            r = subprocess.run([md.adb_bin(), "-s", serial, "reverse", "--list"],
                               capture_output=True, text=True, timeout=8)
            listed = r.stdout or ""
        except (subprocess.SubprocessError, OSError):
            problems.append(f"{d['name']}: adb reverse --list failed/timed out")
            continue
        absent = [f"tcp:{p}" for p in (API_PORT, METRO_PORT) if f"tcp:{p}" not in listed]
        if absent:
            problems.append(f"{d['name']}: missing {', '.join(absent)}")
    why = (f"the on-device app reaches the Mac's API (:{API_PORT}) and Metro "
           f"(:{METRO_PORT}) through adb reverse tunnels; without them e2e flows "
           "can't even log in")
    if problems:
        return {"name": "adb-reverse", "status": "fail",
                "detail": f"reverse tunnel incomplete on "
                          f"{count_phrase(len(problems), 'Android device')}",
                "lines": problems,
                "fix": "set up tunnels: `bash scripts/dev-connect.sh android`",
                "fix_kind": "auto",
                "fix_cmd": ["bash", "scripts/dev-connect.sh", "android"],
                "why": why}
    return {"name": "adb-reverse", "status": "ok",
            "detail": f"tcp:{API_PORT} + tcp:{METRO_PORT} reversed on "
                      f"{count_phrase(len(targets), 'Android device')}",
            "why": why}


# ── health: secrets (ported from the retired scripts/local_bubble_health) ──────
# Required client vars mirror mobile/scripts/check-secrets.sh (the build gate is the
# single source of truth — parsed, not forked). Server vars have no better source
# than this constant (.env.example is prose). Values are NEVER printed.

CLIENT_REQUIRED_FALLBACK = ("EXPO_PUBLIC_API_URL", "EXPO_PUBLIC_GOOGLE_PLACES_API_KEY",
                            "EXPO_PUBLIC_COMETCHAT_APP_ID")
SERVER_REQUIRED_VARS = ("DATABASE_URL", "JWT_SECRET", "ENCRYPTION_KEY",
                        "GOOGLE_PLACES_API_KEY")  # Places proxy (server/routes.ts) — events-0500 fails without it

# Live-looking secrets in TRACKED files. The hex pattern (NAME_SECRET=<32+ hex>)
# exists because real committed values in that shape were missed by the original
# three (rotation is tracked on Trello; this alarm is the forcing function).
LEAK_PATTERNS = (
    r"AIza[0-9A-Za-z_-]{35}",                      # Google API key
    r"sk_live_[0-9A-Za-z]+",                       # Stripe live key
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----",         # PEM private key
    r"[A-Z_]*(SECRET|PASSWORD)[A-Z_]*[[:space:]]*=[[:space:]]*[\"']?[0-9a-f]{32,}",
)
# Excludes: examples/docs, images + locks (base64 blobs false-positive on AIza…).
LEAK_EXCLUDES = (
    ":(exclude)*.example", ":(exclude)docs/*",
    ":(exclude)*.svg", ":(exclude)*.png", ":(exclude)*.jpg", ":(exclude)*.jpeg",
    ":(exclude)*.gif", ":(exclude)*.lock", ":(exclude)*lock.json",
    ":(exclude)*/assets/*",
)


def parse_required_client_vars(text):
    """The REQUIRED=( … ) array from mobile/scripts/check-secrets.sh."""
    m = re.search(r"REQUIRED=\(([^)]*)\)", text or "")
    if not m:
        return list(CLIENT_REQUIRED_FALLBACK)
    found = [w for w in m.group(1).split() if re.fullmatch(r"[A-Z][A-Z0-9_]*", w)]
    return found or list(CLIENT_REQUIRED_FALLBACK)


def _client_required_vars():
    gate = REPO / "mobile" / "scripts" / "check-secrets.sh"
    try:
        return parse_required_client_vars(gate.read_text())
    except OSError:
        return list(CLIENT_REQUIRED_FALLBACK)


def _env_file_has(text, var):
    """VAR=<non-empty> present in env-file text."""
    return bool(re.search(rf"^{re.escape(var)}=.+", text or "", re.M))


def _redact_hit(line):
    """git-grep hit 'path:NN:content' → 'path:NN: content' with every secret-shaped
    substring replaced. Belt and braces: the known patterns AND any long hex/base64
    run, so a value can never reach the terminal."""
    m = re.match(r"([^:]+:\d+):", line)
    loc, rest = (m.group(1), line[m.end():]) if m else ("?", line)
    for pat in (r"AIza[0-9A-Za-z_-]{35}", r"sk_live_[0-9A-Za-z]+",
                r"[0-9a-fA-F]{16,}",
                # long mixed token (base64-ish) — must contain a lowercase AND a
                # digit, so ALL-CAPS var names stay readable in the report
                r"(?=[A-Za-z0-9+/=_-]*[a-z])(?=[A-Za-z0-9+/=_-]*[0-9])[A-Za-z0-9+/=_-]{28,}"):
        rest = re.sub(pat, "‹redacted›", rest)
    return f"{loc}: {rest.strip()[:100]}"


def check_secrets_gitignore():
    gi = REPO / ".gitignore"
    try:
        ignored = re.search(r"^\.env$", gi.read_text(), re.M)
    except OSError:
        ignored = None
    if ignored:
        return {"name": "secrets-gitignore", "status": "ok",
                "detail": ".env is gitignored"}
    return {"name": "secrets-gitignore", "status": "fail", "alarm": True,
            "detail": ".env is NOT gitignored — secrets could be committed",
            "fix": "add a `.env` line to .gitignore — see docs/SECRETS_MANAGEMENT.md",
            "fix_kind": "manual"}


def check_secrets_leaks():
    pattern = "|".join(LEAK_PATTERNS)
    try:
        r = subprocess.run(["git", "-C", str(REPO), "grep", "-nIE", pattern,
                            "--", *LEAK_EXCLUDES],
                           capture_output=True, text=True, timeout=30)
    except (subprocess.SubprocessError, OSError):
        return {"name": "secrets-leak-scan", "status": "warn",
                "detail": "leak scan failed/timed out (git grep)"}
    if r.returncode not in (0, 1):                 # 1 = clean (no match)
        return {"name": "secrets-leak-scan", "status": "warn",
                "detail": f"leak scan errored: {(r.stderr or '').strip()[:120]}"}
    hits = [l for l in r.stdout.splitlines() if l.strip()]
    if not hits:
        return {"name": "secrets-leak-scan", "status": "ok",
                "detail": "no obvious live secrets in tracked files"}
    shown = [_redact_hit(h) for h in hits[:20]]
    if len(hits) > 20:
        shown.append(f"… and {len(hits) - 20} more")
    return {"name": "secrets-leak-scan", "status": "fail", "alarm": True,
            "detail": f"possible live {plural(len(hits), 'secret')} committed "
                      f"({len(hits)} {plural(len(hits), 'hit')}) — values redacted here",
            "lines": shown,
            "fix": "rotate the value, remove it from tracked files — "
                   "see docs/SECRETS_MANAGEMENT.md",
            "fix_kind": "manual",
            "why": "scans TRACKED files for key-shaped strings (Google/Stripe/PEM/"
                   "NAME_SECRET=hex); a hit means rotate + purge, not just delete"}


def check_secrets_env():
    problems = []
    client_req = _client_required_vars()
    mobile_env = REPO / "mobile" / ".env"
    if not mobile_env.exists():
        problems.append("mobile/.env not found (copy from mobile/.env.example)")
    else:
        text = mobile_env.read_text()
        miss = [v for v in client_req if not _env_file_has(text, v)]
        if miss:
            problems.append(f"mobile/.env missing/empty: {', '.join(miss)}")
    root_env = REPO / ".env"
    if not root_env.exists():
        problems.append(".env not found at the repo root")
    else:
        text = root_env.read_text()
        miss = [v for v in SERVER_REQUIRED_VARS if not _env_file_has(text, v)]
        if miss:
            problems.append(f"root .env missing/empty: {', '.join(miss)}")
    if problems:
        return {"name": "secrets-env", "status": "fail",
                "detail": "; ".join(problems),
                "fix": "fill the listed vars — docs/SECRETS_MANAGEMENT.md says where "
                       "each value lives (values are never printed here)",
                "fix_kind": "manual"}
    return {"name": "secrets-env", "status": "ok",
            "detail": f"mobile/.env has all {len(client_req)} required client vars; "
                      f"root .env has all {len(SERVER_REQUIRED_VARS)} required server vars"}


# Social login (Google/Apple) is wired in code but unconfigured team-wide: the app
# reads these in WelcomeAuthScreen, the server verifies token audience against the
# same names (server/social-auth-handler.ts). Missing = Google button shows an
# 'Unavailable' alert and /api/auth/google 503s. warn, not fail — no e2e flow
# exercises the actual social login round-trip yet, so a missing value cannot
# fail a run.
SOCIAL_AUTH_VARS = ("EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS", "EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID")


def check_social_auth_env():
    gaps = []
    for label, path in (("mobile/.env", REPO / "mobile" / ".env"),
                        ("root .env", REPO / ".env")):
        try:
            text = path.read_text()
        except OSError:
            continue  # secrets-env already fails loudly on a missing file
        miss = [v for v in SOCIAL_AUTH_VARS if not _env_file_has(text, v)]
        if miss:
            gaps.append(f"{label}: {', '.join(miss)}")
    if gaps:
        return {"name": "social-auth-env", "status": "warn",
                "detail": "Google sign-in unconfigured — " + "; ".join(gaps),
                "fix": "create iOS/Android/Web OAuth clients in Google Cloud Console, "
                       "set the vars in BOTH env files (server verifies audience too)",
                "fix_kind": "manual",
                "why": "app guards configure() so this no longer crashes iOS, but the "
                       "Google button is dead and /api/auth/google 503s until set"}
    return {"name": "social-auth-env", "status": "ok",
            "detail": "Google sign-in client IDs present in mobile/.env and root .env"}


# ── health: EAS (Expo Application Services) ────────────────────────────────────

def _ver_ge(version, constraint):
    """'16.30.1' satisfies '>= 16.28.0'. eas.json only uses >= constraints; anything
    unparseable passes (never block on a version-string quirk)."""
    m = re.match(r">=\s*([\d.]+)", (constraint or "").strip())
    have = [int(x) for x in re.findall(r"\d+", version or "")[:3]]
    if not m or not have:
        return True
    need = [int(x) for x in re.findall(r"\d+", m.group(1))[:3]]
    have += [0] * (len(need) - len(have))
    return have[:len(need)] >= need


def eas_profile_gaps(cfg, client_required):
    """{profile: [required client vars not in its eas.json env block]} for the
    local-build-relevant profiles. A gap is NOT an error — real secrets must not
    live in eas.json — but it means the var has to come from EAS env vars, which
    is unverifiable offline."""
    gaps = {}
    for prof in ("development", "preview", "production"):
        b = (cfg.get("build") or {}).get(prof)
        if b is None:
            gaps[prof] = ["<profile missing>"]
            continue
        env = b.get("env") or {}
        missing = [v for v in client_required if v not in env]
        if missing:
            gaps[prof] = missing
    return gaps


def _eas_config():
    """(cfg, early-result) — exactly one is None."""
    eas_json = REPO / "mobile" / "eas.json"
    if not eas_json.exists():
        return None, {"name": "eas", "status": "ok",
                      "detail": "no mobile/eas.json — EAS builds not configured here"}
    try:
        return json.loads(eas_json.read_text()), None
    except (OSError, ValueError) as e:
        return None, {"name": "eas", "status": "warn",
                      "detail": f"mobile/eas.json unreadable/invalid: {e}",
                      "fix": "fix the JSON — every EAS build (cloud and --local) parses it",
                      "fix_kind": "manual"}


def _eas_cli_version():
    try:
        r = subprocess.run(["eas", "--version"], capture_output=True, text=True,
                           timeout=15)
    except (subprocess.SubprocessError, OSError):
        return None
    m = re.search(r"eas-cli/(\d+(?:\.\d+)*)", r.stdout or "")
    return m.group(1) if m else (r.stdout or "").strip() or None


def _eas_whoami_line():
    try:
        w = subprocess.run(["eas", "whoami"], capture_output=True, text=True,
                           timeout=10, cwd=str(REPO / "mobile"))
    except (subprocess.SubprocessError, OSError):
        return "`eas whoami` failed/timed out (offline?)"
    acct = (w.stdout or "").strip()
    return (f"logged in as {acct}" if w.returncode == 0 and acct
            else "not logged in — `eas login` before `eas build --local`")


def check_eas(verbose=False):
    """EAS local builds (`eas build --local`) are one team workflow. Offline checks
    only by default: CLI presence/version + eas.json shape. `eas whoami` (network)
    runs under -v; `eas env:list` (auth + project scope) is advice, never a probe."""
    cfg, early = _eas_config()
    if cfg is None:
        return early
    if not shutil.which("eas"):
        return {"name": "eas", "status": "warn",
                "detail": "EAS CLI is not installed — `eas build --local` will not work",
                "fix": "install it: `npm install -g eas-cli` "
                       "(global npm installs are never run automatically)",
                "fix_kind": "manual",
                "why": "one team workflow builds the mobile binary locally with "
                       "`eas build --local`; e2e testing itself does not require EAS"}
    status, lines = "ok", []
    ver = _eas_cli_version()
    constraint = (cfg.get("cli") or {}).get("version")
    if ver and constraint and not _ver_ge(ver, constraint):
        status = "warn"
        lines.append(f"eas-cli {ver} is older than eas.json's required {constraint} "
                     f"— update: `npm install -g eas-cli`")
    lines += _eas_gap_lines(cfg)
    if verbose:
        lines.append(_eas_whoami_line())
    return {"name": "eas", "status": status, "detail": _eas_detail(ver, constraint),
            "lines": lines,
            "why": "offline-only checks by default; login/secret state needs network "
                   "and auth, so it is reported as advice (or probed under -v)"}


def _eas_gap_lines(cfg):
    return [f"profile '{prof}': {', '.join(miss)} not in eas.json env — must "
            f"come from EAS env vars (unverifiable offline; check "
            f"`eas env:list --environment {prof}`)"
            for prof, miss in sorted(eas_profile_gaps(cfg, _client_required_vars()).items())]


def _eas_detail(ver, constraint):
    return (f"EAS CLI {ver or '?'} installed"
            + (f" (eas.json wants {constraint})" if constraint else ""))


def check_on_device_binary():
    """Android analog of check_sim_binary (which covers the booted iOS sim): which
    app binary is on each running Android device, and its attributes (version,
    dev/release, dexopt level). Verbose-only — several adb round-trips per device."""
    if not htc.capabilities()["adb"]:
        return {"name": "on-device-binary", "status": "ok", "quiet": True,
                "detail": "adb unavailable — on-device binary checks n/a"}
    targets = md.android_running() + md.android_real()
    if not targets:
        return {"name": "on-device-binary", "status": "ok", "quiet": True,
                "detail": "no running Android device"}
    lines, status = [], "ok"
    con = _ro_device_db()
    try:
        for d in targets:
            serial = d.get("serial") or d["id"]
            label = pick_alias(d["id"], con) or d["name"]
            if not _adb_shell(serial, "pm", "path", APP_ID):
                status = "warn"
                lines.append(f"{label}: {APP_ID} NOT installed — "
                             f"`npm run mobile:build:android-emu` "
                             f"(a build takes >5 min; never run automatically)")
                continue
            dump = _adb_shell(serial, "dumpsys", "package", APP_ID)
            vm = re.search(r"versionName=(\S+)", dump)
            dex = _adb_shell(serial, "dumpsys", "package", "dexopt")
            dm = re.search(re.escape(APP_ID) + r".*?\[status=([^\]]+)\]", dex, re.S)
            lines.append(f"{label}: {APP_ID} {vm.group(1) if vm else '?'}, "
                         f"{'dev/debuggable' if 'DEBUGGABLE' in dump else 'release'} build, "
                         f"dexopt {dm.group(1) if dm else 'unknown'}")
    finally:
        if con is not None:
            con.close()
    return {"name": "on-device-binary", "status": status,
            "detail": f"app binary on {count_phrase(len(targets), 'running Android device')}",
            "lines": lines,
            "why": "stale, missing, or release binaries make e2e flows fail in "
                   "confusing ways; this shows exactly what each device runs"}


# ── health: registry + engine ───────────────────────────────────────────────────
# Order IS the print order (deterministic even though execution is parallel):
# secrets alarms first, then tooling, devices, servers, secrets detail, EAS.
# suppress_ok: an always/usually-green check prints only when non-ok (or under -v).
# verbose_only: runs only under -v (expensive on-device probing).
# local_only: introspects the LOCAL backend — skipped when --env is PROD/STAGING
# (a remote deployment exposes no pid, DB socket, or adb tunnel to inspect).

HealthSpec = namedtuple("HealthSpec", "name fn suppress_ok verbose_only local_only")

HEALTH_CHECKS = [
    HealthSpec("secrets-gitignore",  check_secrets_gitignore,  True,  False, False),
    HealthSpec("secrets-leak-scan",  check_secrets_leaks,      True,  False, False),
    HealthSpec("tooling",            check_tooling,            True,  False, False),
    HealthSpec("ios-simulators",     check_ios_sims,           False, False, False),
    HealthSpec("sim-app-binary",     check_sim_binary,         True,  False, False),
    HealthSpec("sim-boot-age",       check_sim_age,            True,  False, False),
    HealthSpec("android-emulators",  check_android_emulators,  False, False, False),
    HealthSpec("genymotion",         check_genymotion,         True,  False, False),
    HealthSpec("real-devices",       check_real_devices,       True,  False, False),
    HealthSpec("api-server",         check_api,                False, False, False),
    HealthSpec("qa-server-identity", check_qa_server_identity, True,  False, True),
    HealthSpec("metro",              check_metro,              False, False, False),
    HealthSpec("db-server",          check_db,                 False, False, True),
    HealthSpec("adb-reverse",        check_adb_reverse,        False, False, True),
    HealthSpec("secrets-env",        check_secrets_env,        True,  False, False),
    HealthSpec("social-auth-env",    check_social_auth_env,    True,  False, False),
    HealthSpec("eas",                check_eas,                True,  False, False),
    HealthSpec("load-average",       check_load,               True,  False, False),
    HealthSpec("on-device-binary",   check_on_device_binary,   False, True,  False),
]


def _run_one_check(spec, verbose):
    fn = spec.fn
    if "verbose" in inspect.signature(fn).parameters:
        return fn(verbose=verbose)
    return fn()


def run_health_checks(verbose=False):
    """Run every applicable check in a thread pool (subprocess/IO-bound; adb and
    simctl are the slow ones) and return [(spec, result)] in REGISTRY order.

    Thread rules: workers may call subprocess-only manage_devices functions
    (ios_devices/android_all/android_real/ios_real/looks_headless) and HTTP/TCP
    probes. Device-DB reads go through _ro_device_db() — one fresh read-only
    connection per call — NEVER md.db()/md.kv_get()/md.aliases_for() (a single
    shared connection that is not thread-safe and would mutate/lock the DB).

    A check that exceeds QA_HEALTH_CHECK_TIMEOUT_S degrades to a warn; the stuck
    flag tells cmd_health to os._exit (a wedged thread would hang the interpreter's
    atexit join)."""
    specs = [s for s in HEALTH_CHECKS
             if (verbose or not s.verbose_only) and (ENV.is_local or not s.local_only)]
    ex = concurrent.futures.ThreadPoolExecutor(max_workers=8)
    futures = {s.name: ex.submit(_run_one_check, s, verbose) for s in specs}
    deadline = time.time() + QA_HEALTH_CHECK_TIMEOUT_S
    results, stuck = [], False
    for s in specs:
        res, timed_out = _collect_check_result(futures[s.name], deadline - time.time())
        stuck = stuck or timed_out
        res.setdefault("name", s.name)
        results.append((s, res))
    ex.shutdown(wait=False, cancel_futures=True)
    return results, stuck


def _collect_check_result(future, remaining_s):
    """(result-dict, timed_out) for one worker future."""
    try:
        res = future.result(timeout=max(0.1, remaining_s))
        if not isinstance(res, dict):
            return {"status": "warn", "detail": f"check returned {type(res).__name__}"}, False
        return res, False
    except concurrent.futures.TimeoutError:
        return {"status": "warn",
                "detail": f"check timed out after {QA_HEALTH_CHECK_TIMEOUT_S:.0f}s "
                          f"(adb/simctl may be wedged)"}, True
    except Exception as e:
        return {"status": "warn", "detail": f"check errored: {e}"}, False


ICONS = {"ok": "✅", "warn": "⚠️ ", "fail": "❌"}


def _check_suppressed(spec, r, verbose):
    return r["status"] == "ok" and not verbose and (spec.suppress_ok or r.get("quiet"))


def _check_icon(r):
    if r.get("alarm") and r["status"] != "ok":
        return "🚨"
    return ICONS[r["status"]]


def _render_check_text(spec, r, verbose, show_fix):
    """One check's report lines. Fix advice (↳) prints only when show_fix — i.e.
    --fix or -v; a bare `health` just states what is wrong."""
    if _check_suppressed(spec, r, verbose):
        return
    print(f"{_check_icon(r)}  {r['name']}: {r['detail']}")
    for ln in r.get("lines", []):
        print(f"\t{ln}")
    if show_fix and r.get("fix") and r["status"] != "ok":
        print(f"      ↳ {r['fix']}")
    if verbose and r.get("why"):
        print(f"      · why: {r['why']}")


def render_health(results, verbose=False, as_json=False, fixes_applied=None, show_fix=True):
    """Print the report. Text: registry order, 🚨 for non-ok alarms, always-green
    checks suppressed unless non-ok or -v. JSON: EVERY executed check (suppression
    is text-only). Returns overall ok."""
    ok = all(r["status"] == "ok" for _, r in results)
    if as_json:
        payload = {"ok": ok, "env": ENV.name, "checks": [r for _, r in results]}
        if fixes_applied is not None:
            payload["fixesApplied"] = fixes_applied
        print(json.dumps(payload, indent=2))
        return ok
    for spec, r in results:
        _render_check_text(spec, r, verbose, show_fix)
    return ok


# ── health: --fix ────────────────────────────────────────────────────────────────

FIX_PROBES = {
    "api-port": lambda: tcp_open("127.0.0.1", API_PORT) or tcp_open("::1", API_PORT),
    "metro-port": lambda: tcp_open("127.0.0.1", METRO_PORT),
}


def plan_fixes(results):
    """Split non-ok checks into auto-executable actions and manual advice, in
    registry order. Pure — no execution, no probing — so selftests can assert it.
    Duplicate fix_cmds collapse to one action (e.g. two checks both wanting
    qa:server)."""
    auto, manual, seen = [], [], set()
    for spec, r in results:
        if r.get("status") == "ok":
            continue
        if r.get("fix_kind") == "auto" and r.get("fix_cmd"):
            key = tuple(r["fix_cmd"])
            if key in seen:
                continue
            seen.add(key)
            auto.append({"name": r.get("name", spec.name), "cmd": list(r["fix_cmd"]),
                         "bg": bool(r.get("fix_bg")), "log": r.get("fix_log"),
                         "probe": r.get("fix_probe"), "why": r.get("why")})
        elif r.get("fix"):
            manual.append({"name": r.get("name", spec.name), "fix": r["fix"]})
    return {"auto": auto, "manual": manual}


def _fix_skip_reason(a, android_just_started):
    """Why an auto fix should be skipped, or None to proceed."""
    probe = FIX_PROBES.get(a["probe"]) if a.get("probe") else None
    if probe and probe():
        return "already up (raced with another start) — skipping"
    if a["name"] == "adb-reverse" and android_just_started:
        return ("skipped — the emulator only just started booting; "
                "re-run `npm run qa:health -- --fix` once it's up")
    return None


def _start_background_fix(a, say):
    """Launch one background (unmonitored subshell) fix; returns the applied record."""
    with open(REPO / a["log"], "ab") as log_fh:
        p = subprocess.Popen(a["cmd"], stdout=log_fh, stderr=subprocess.STDOUT,
                             start_new_session=True, cwd=str(REPO))
    say(f"→ {a['name']}: started `{' '.join(a['cmd'])}` in the background "
        f"(log: {a['log']}, pid {p.pid})")
    return {"name": a["name"], "cmd": a["cmd"], "pid": p.pid, "log": a["log"]}


def _run_foreground_fix(a, say, narrate):
    """Run one blocking fix to completion; returns the applied record."""
    say(f"→ {a['name']}: running `{' '.join(a['cmd'])}` …")
    try:
        rc = subprocess.run(a["cmd"], cwd=str(REPO), timeout=120,
                            capture_output=not narrate).returncode
    except (subprocess.TimeoutExpired, OSError) as e:
        rc = -1
        say(f"→ {a['name']}: failed/timed out ({e}) — run it yourself to see why")
    return {"name": a["name"], "cmd": a["cmd"], "exit": rc}


def _apply_one_auto_fix(a, ctx, verbose, narrate, say):
    """One auto fix: skip / background / foreground. Returns the applied record or
    None when skipped. ctx carries the android-just-started ordering flag."""
    skip = _fix_skip_reason(a, ctx["android_just_started"])
    if skip:
        say(f"→ {a['name']}: {skip}")
        return None
    if verbose and a.get("why"):
        say(f"      · why: {a['why']}")
    if a["bg"]:
        return _start_background_fix(a, say)
    rec = _run_foreground_fix(a, say, narrate)
    if rec["exit"] == 0 and "last-android" in a["cmd"]:
        ctx["android_just_started"] = True
    return rec


def apply_auto_fixes(plan, verbose=False, narrate=True):
    """Execute the plan's auto fixes. Auto = background server restarts (log path +
    pid shown), adb reverse tunnels, booting the last-used device. NEVER auto: sudo,
    brew/installers, >5-min tasks (AOT warmup, builds), device-image downloads,
    signups. Returns the applied list (--json fixesApplied)."""
    sys.stdout.flush()      # the report must land before any child's own output

    def say(msg):
        if narrate:
            print(msg, flush=True)

    if plan["auto"]:
        OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    ctx = {"android_just_started": False}
    recs = [_apply_one_auto_fix(a, ctx, verbose, narrate, say) for a in plan["auto"]]
    applied = [r for r in recs if r]
    if any("pid" in x for x in applied):
        say("→ re-run `npm run qa:health` in ~30-60s to confirm the background "
            "restarts came up.")
    return applied


def apply_fixes(results, verbose=False, narrate=True):
    """Non-interactive fix pass (--json path and selftests): run every auto fix,
    then list the manual advice."""
    plan = plan_fixes(results)

    def say(msg):
        if narrate:
            print(msg, flush=True)

    if not plan["auto"] and not plan["manual"]:
        say("→ nothing to fix — environment is healthy")
        return []
    applied = apply_auto_fixes(plan, verbose, narrate)
    for m in plan["manual"]:
        say(f"→ manual: {m['name']}: {m['fix']}")
    return applied


# `health --fix` (interactive, LOCAL): the alternative when the user declines the
# auto-start offer. Each entry: (what, terminal-window name or None, command).
MANUAL_START_ADVICE = {
    "api-server": ("the API server", "QA Server", "npm run qa:server"),
    "metro": ("the Metro Server", "Metro Bundler", "npm run metro_bundler"),
    "ios-simulators": ("an iOS simulator", None, "manage_devices.py --start last-ios"),
    "android-emulators": ("an Android emulator", None,
                          "manage_devices.py --start last-android"),
    "adb-reverse": ("the adb reverse tunnels", None, "bash scripts/dev-connect.sh android"),
}


def _print_manual_start(name):
    what, window, cmd = MANUAL_START_ADVICE.get(
        name, (f"`{name}`", None, "see the ↳ line above"))
    if window:
        print(f"→ To start {what} manually, go to the \"{window}\" terminal window "
              f"and type 'go'")
        print(f"  Alternatively, go into a terminal window and type '{cmd}'")
    else:
        print(f"→ To start {what} manually, go into a terminal window and type '{cmd}'")


def offer_fixes(results, verbose=False):
    """`health --fix`, text mode. LOCAL: offer to start only the missing servers/
    emulators (unmonitored subshells) behind a y/N prompt; declining prints the
    manual instructions instead. PROD/STAGING: advice only (already rendered as
    ↳ lines) — testctl never starts anything on a remote deployment."""
    if not ENV.is_local:
        return
    plan = plan_fixes(results)
    if not plan["auto"]:
        if not plan["manual"]:
            print("→ nothing to fix — environment is healthy")
        return
    if _ask_yes("Should I start the non-running applications?"):
        apply_auto_fixes(plan, verbose, narrate=True)
    else:
        for a in plan["auto"]:
            _print_manual_start(a["name"])


def cmd_health(as_json, verbose=False, fix=False):
    results, stuck = run_health_checks(verbose)
    if as_json:
        fixes = apply_fixes(results, verbose, narrate=False) if fix else None
        ok = render_health(results, verbose, as_json=True, fixes_applied=fixes)
    else:
        ok = render_health(results, verbose, as_json=False, show_fix=fix or verbose)
        if fix:
            offer_fixes(results, verbose)
    rc = 0 if ok else 1
    if stuck:
        sys.stdout.flush()
        sys.stderr.flush()
        os._exit(rc)      # a wedged worker thread would hang the atexit thread-join
    return rc


# ── maestro driver health ───────────────────────────────────────────────────────
# Health-probe the Maestro Android driver's gRPC server (localhost:7001).
#   A. Live session  (:7001 LISTENing)  → gRPC `deviceInfo` probe: aliveness + latency.
#   B. Otherwise (no listener)          → port-only check via lsof; driver is down/idle.
# The driver is ephemeral (up only during maestro test/studio/hierarchy), opens its
# socket via a dadb tunnel not `adb forward`, and serves no reflection/health RPC, so
# the live probe needs `-protoset`. deviceInfo is the de-facto heartbeat.

def driver_listener_pids():
    """Procs LISTENing on the driver port. Empty list ⇒ no live session (case B)."""
    out = subprocess.run(["lsof", "-nP", f"-iTCP:{DRIVER_PORT}", "-sTCP:LISTEN", "-Fpc"],
                         capture_output=True, text=True).stdout
    procs = []
    pid, cmd = None, "?"
    for line in out.splitlines():
        if line.startswith("p"):
            if pid is not None:
                procs.append({"pid": pid, "cmd": cmd})
            pid, cmd = int(line[1:]), "?"
        elif line.startswith("c"):
            cmd = line[1:]
    if pid is not None:
        procs.append({"pid": pid, "cmd": cmd})
    return procs


def grpc_device_info(timeout=10):
    """Probe deviceInfo (the heartbeat). Returns (ok, latency_s, detail).
    ok is None when we can't probe at all (no grpcurl / no protoset)."""
    grpcurl = shutil.which("grpcurl")
    if not grpcurl:
        return None, None, "grpcurl not on PATH (`brew install grpcurl`) — can't gRPC-probe; port-only"
    if not DRIVER_PROTOSET.exists():
        rel = DRIVER_PROTOSET.relative_to(REPO) if DRIVER_PROTOSET.is_relative_to(REPO) else DRIVER_PROTOSET
        return None, None, (f"protoset missing at {rel} (gitignored/regenerable — see memory "
                            "project-maestro-android-driver-grpc-health) — port-only")
    t0 = time.monotonic()
    try:
        proc = subprocess.run(
            [grpcurl, "-plaintext", "-protoset", str(DRIVER_PROTOSET), "-d", "{}",
             f"localhost:{DRIVER_PORT}", f"{DRIVER_SERVICE}/deviceInfo"],
            capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return False, float(timeout), (f"deviceInfo DEADLINE — no response in {timeout}s "
                                       "(driver wedged; same call-path as the inputText DEADLINE_EXCEEDED failure)")
    dt = time.monotonic() - t0
    if proc.returncode != 0:
        msg = (proc.stderr or proc.stdout).strip()
        last = msg.splitlines()[-1] if msg else f"exit {proc.returncode}"
        return False, dt, f"deviceInfo failed in {dt:.2f}s: {last}"
    try:
        info = json.loads(proc.stdout)
        shape = f"{info.get('widthPixels', '?')}×{info.get('heightPixels', '?')}px"
    except json.JSONDecodeError:
        shape = "(unparsable response)"
    return True, dt, f"deviceInfo → {shape} in {dt:.2f}s"


def check_driver_health():
    listeners = driver_listener_pids()
    if not listeners:
        # Case B — no live session.
        return {"name": "maestro-driver", "status": "ok", "live": False, "listening": False,
                "responsive": None, "latency_s": None,
                "detail": f"no live session — nothing LISTENing on :{DRIVER_PORT} "
                          "(driver is ephemeral, up only during a maestro test/studio/hierarchy session)"}
    # Case A — live session; gRPC-probe it.
    who = ", ".join(f"{l.get('cmd', '?')}(pid {l['pid']})" for l in listeners)
    base = f"live session — :{DRIVER_PORT} held by {who}"
    ok, latency, gdetail = grpc_device_info()
    if ok is None:  # listening but we can't fully probe
        return {"name": "maestro-driver", "status": "warn", "live": True, "listening": True,
                "responsive": None, "latency_s": None, "detail": f"{base}; {gdetail}"}
    if not ok:
        return {"name": "maestro-driver", "status": "fail", "live": True, "listening": True,
                "responsive": False, "latency_s": round(latency, 3) if latency is not None else None,
                "detail": f"{base}, but {gdetail}",
                "fix": "driver unresponsive — recover with `python3 scripts/testctl.py nuke --nuke=maestro` "
                       "(graceful SIGTERM→SIGKILL), then reinstall dev.mobile.maestro[.test] if instrumentation is stuck"}
    latency = latency or 0.0  # ok path always carries a float; satisfy the type checker
    status = "warn" if latency > DRIVER_LATENCY_WARN_S else "ok"
    note = (f" ⚠ slow (>{DRIVER_LATENCY_WARN_S:.0f}s — UI may be mid-settle/under load; "
            "healthy deviceInfo is ~0.15s)" if status == "warn" else "")
    return {"name": "maestro-driver", "status": status, "live": True, "listening": True,
            "responsive": True, "latency_s": round(latency, 3), "detail": f"{base}; {gdetail}{note}"}


# Shown only under -v: the mechanism is deliberately absent from the help text.
DRIVER_HEALTH_DETAILS = f"""\
When you need this: a Maestro flow is hanging or timing out mid-run (inputText
DEADLINE_EXCEEDED, taps not landing) and you want to know whether the driver JVM
is wedged or the app is just slow — this probes aliveness + latency without
disturbing the run.

How it works:
  A. Live session (:{DRIVER_PORT} LISTENing) → gRPC `deviceInfo` probe (aliveness +
     latency; warn over {DRIVER_LATENCY_WARN_S:.0f}s, healthy is ~0.15s). The driver serves no
     reflection/health RPC, so the probe needs the -protoset file at
     {DRIVER_PROTOSET} (gitignored, regenerable).
  B. No listener → lsof port-only check; the driver is down/idle. It is EPHEMERAL:
     up only during a live `maestro test`/studio/hierarchy session, tunneled via
     dadb (NOT `adb forward`, so `adb forward --list` stays empty).

Why Android only: the Android driver is a host-side gRPC server on
localhost:{DRIVER_PORT} — probeable out-of-band. The iOS driver is an XCUITest runner
inside the simulator, a strict singleton with no host-facing health port; any
out-of-band session (including a probe) kills the live test's driver, so a safe
iOS equivalent does not exist."""


def cmd_driver_health(as_json, verbose=False):
    c = check_driver_health()
    if as_json:
        print(json.dumps(c, indent=2))
    else:
        print(f"{ICONS[c['status']]}  {c['name']}: {c['detail']}")
        if c.get("fix"):
            print(f"      ↳ {c['fix']}")
        if verbose:
            print()
            print(DRIVER_HEALTH_DETAILS)
    return 1 if c["status"] == "fail" else 0


# ── ability ───────────────────────────────────────────────────────────────────
# What testing is POSSIBLE with the current environment (WIP: several rows are
# speculative — deriving them fully needs new tags, new `npm run qa` arguments,
# and new gating; unknowns render as ❔, never as a silent guess).

def _env_text(path):
    try:
        return path.read_text()
    except OSError:
        return ""


def _seed_credentials():
    try:
        cfg = json.loads((REPO / "tests" / "config" / "roles.json").read_text())
    except (OSError, ValueError):
        return None
    cred = (cfg.get("roles") or {}).get("role-user") or {}
    return cred if cred.get("email") and cred.get("password") else None


def _seeded_accounts_present():
    """Mirror the runner's seeded-account gate (tests/runner/gating.ts): authenticate
    the seeded role-user against the LOCAL API. A DB count can't work — emails are
    encrypted at rest. True/False on a definitive answer, None when unknowable
    (no creds, API down, non-LOCAL env)."""
    cred = _seed_credentials()
    if not cred or not ENV.is_local:
        return None
    code, _ = http_post_json(f"{ENV.api_base}/api/auth/login",
                             {"email": cred["email"], "password": cred["password"]})
    if code is None:
        return None
    return True if code == 200 else (False if code in (400, 401, 403, 404) else None)


def _flow_tags(text):
    m = re.search(r"^tags:\n((?:\s*-\s*\S+\n)+)", text, re.M)
    return set(re.findall(r"-\s*(\S+)", m.group(1))) if m else set()


def _count_test_inventory():
    """e2e flow counts by platform tag + headless test count. Env-scoped counts
    are impossible today: no LOCAL/STAGING/PROD tags exist yet (WIP)."""
    counts = {"e2e_total": 0, "e2e_ios": 0, "e2e_android": 0,
              "e2e_untagged": 0, "headless": 0}
    for path in sorted((REPO / "tests" / "e2e").rglob("*.yaml")):
        text = _env_text(path)
        if "# qa-id:" not in text:
            continue                     # subflow/helper, not a runnable test
        tags = _flow_tags(text)
        counts["e2e_total"] += 1
        counts["e2e_ios"] += "ios" in tags
        counts["e2e_android"] += "android" in tags
        counts["e2e_untagged"] += not tags & {"ios", "android"}
    counts["headless"] = len(list((REPO / "tests" / "headless").rglob("*.headless.test.ts")))
    return counts


def _live_device_counts():
    cap = htc.capabilities()
    ios = 0
    if cap["simctl"]:
        ios = len([d for d in md.ios_devices() if d["state"] in ("Running", "Booting")])
    android = len(md.android_running()) + len(md.android_real()) if cap["adb"] else 0
    return ios, android


def gather_ability_facts():
    code, body = http_get(f"{ENV.api_base}/api/v1/health", timeout=8)
    word, _, _ = _api_state(code, body)
    _, mode = api_server_mode() if ENV.is_local else (None, None)
    mobile_env = _env_text(REPO / "mobile" / ".env")
    root_env = _env_text(REPO / ".env")
    ios_live, android_live = _live_device_counts()
    return {
        "api_state": word,                       # Healthy | Partial Fail | Not Running
        "server_mode": mode,                     # qa:server | qa | prod | dev | None
        "seeds": _seeded_accounts_present() if ENV.is_local else None,
        "google_ids": all(_env_file_has(mobile_env, v) for v in SOCIAL_AUTH_VARS),
        "apple_vars": bool(re.search(r"^EXPO_PUBLIC_APPLE\w*=.+", mobile_env, re.M)),
        "cometchat": _env_file_has(mobile_env, "EXPO_PUBLIC_COMETCHAT_APP_ID"),
        "places": (_env_file_has(mobile_env, "EXPO_PUBLIC_GOOGLE_PLACES_API_KEY")
                   and _env_file_has(root_env, "GOOGLE_PLACES_API_KEY")),
        "sentry_dsn": _env_file_has(root_env, "SENTRY_DSN"),
        "sentry_local_on": bool(re.search(r"^BUBBLE_SENTRY_USAGE=local", root_env, re.M)),
        "ios_live": ios_live,
        "android_live": android_live,
        "counts": _count_test_inventory(),
    }


def _cap(rows, label, possible, note="", fix=None):
    rows.append({"label": label, "possible": possible, "note": note, "fix": fix})


def _backend_flags(f):
    """Building blocks for the backend rows. `api_ok` means reachable — a Partial
    Fail (degraded optional service) still supports most testing; only Not Running
    zeroes these out."""
    api_ok = f["api_state"] != "Not Running"
    seeded_env = ENV.is_local and api_ok and f["server_mode"] == "qa:server"
    shared_ok = ENV.name in ("LOCAL", "STAGING") and api_ok
    return api_ok, seeded_env, shared_ok


def _expect_seeds_value(f, seeded_env):
    if not seeded_env:
        return False
    return None if f["seeds"] is None else bool(f["seeds"])


def _derive_caps_backend(rows, f):
    """Rows tied to which API server is up and how it was started."""
    api_ok, seeded_env, shared_ok = _backend_flags(f)
    mode_note = "" if seeded_env else f" — current: {f['server_mode'] or 'down'}"
    _cap(rows, "write seeded values", seeded_env, "qa api server only" + mode_note,
         fix="start it: `npm run qa:server`")
    _cap(rows, "expect seeded values", _expect_seeds_value(f, seeded_env),
         "qa api server + seeded accounts in bubble_test",
         fix="seed it: `npm run qa:seed`")
    _cap(rows, "create accounts (email/pwd)", ENV.is_local and api_ok,
         "LOCAL only — throwaway accounts pollute shared envs",
         fix="start the LOCAL stack (`npm run qa:server`) and use --env LOCAL")
    _cap(rows, "send messages", shared_ok,
         "LOCAL and STAGING only — never spam PROD users")
    _cap(rows, "run performance tests", shared_ok,
         "LOCAL and STAGING only — load must not hit PROD")
    seeds_note = ("based on presence of seeded accounts"
                  + ("" if ENV.is_local else " — unverifiable remotely (WIP)"))
    _cap(rows, "sign in email/pwd (seeded)",
         bool(f["seeds"]) if f["seeds"] is not None else None,
         seeds_note, fix="seed LOCAL: `npm run qa:seed`")


def _tri(prod_val, local_val, staging_val=None):
    """Env-dependent capability value; STAGING defaults to ❔ (WIP)."""
    if ENV.name == "PROD":
        return prod_val
    return local_val if ENV.is_local else staging_val


def _derive_caps_integrations(rows, f):
    """Rows tied to third-party wiring (env vars / deployment)."""
    local = ENV.is_local
    prod = ENV.name == "PROD"
    _cap(rows, "Sign In With Google", _tri(True, f["google_ids"]),
         "PROD always; LOCAL only with EXPO_PUBLIC_GOOGLE_CLIENT_ID_* set",
         fix="create OAuth clients in Google Cloud Console; set the vars in mobile/.env and root .env")
    _cap(rows, "Sign In With Apple", _tri(True, f["apple_vars"]),
         "PROD always; LOCAL only with Apple env vars set (WIP)",
         fix="wire Apple sign-in env vars (none defined yet — WIP)")
    _cap(rows, "create account via email/pwd", ENV.name in ("LOCAL", "STAGING"),
         "LOCAL and STAGING only")
    _cap(rows, "create account via Google", None, "possible on LOCAL? — unverified (WIP)")
    _cap(rows, "create account via Apple", None, "possible on LOCAL? — unverified (WIP)")
    _cap(rows, "Comet Chat flows", ENV.name in ("LOCAL", "STAGING") and f["cometchat"],
         "needs EXPO_PUBLIC_COMETCHAT_APP_ID; LOCAL/STAGING only (no comet-chat tag yet — WIP)",
         fix="set EXPO_PUBLIC_COMETCHAT_APP_ID in mobile/.env")
    sentry_on = f["sentry_dsn"] and (not local or f["sentry_local_on"])
    _cap(rows, "automated runs with Sentry enabled", False if sentry_on else True,
         "Sentry active ⇒ MANUAL ONLY — `npm run qa` must ban automated tests (gating WIP)"
         if sentry_on else "Sentry inactive here — automated runs are safe")
    _cap(rows, "Google Places flows", f["places"] if local else None,
         "needs the key in mobile/.env AND root .env (server proxy); test tagging for "
         "this dependency is WIP",
         fix="set EXPO_PUBLIC_GOOGLE_PLACES_API_KEY (mobile/.env) + GOOGLE_PLACES_API_KEY (root .env)")
    _cap(rows, "Universal Links", prod or None, "production only? — WIP")
    _cap(rows, "email-gated actions", True if local else None,
         "email proof-of-identity is worked around in dev; remote envs need real mail (WIP)")
    _cap(rows, "SSL on API server", not local,
         f"{ENV.api_base} — LOCAL is plain http; check-tls contract tests are the plan (WIP)")


def derive_capabilities(facts):
    rows = []
    _derive_caps_backend(rows, facts)
    _derive_caps_integrations(rows, facts)
    return rows


ABILITY_ICONS = {True: "✅", False: "❌", None: "❔"}


def _render_ability_counts(c, ios_live, android_live):
    print("\nTEST INVENTORY")
    untagged = f", {c['e2e_untagged']} with no platform tag" if c["e2e_untagged"] else ""
    print(f"  e2e flows: {c['e2e_total']} total — {c['e2e_ios']} iOS-tagged, "
          f"{c['e2e_android']} Android-tagged{untagged}")
    print(f"  headless tests: {c['headless']}")
    print("  by environment: no LOCAL/STAGING/PROD tags exist yet — all of the above "
          "count as LOCAL-dev (tagging is WIP)")
    ios_run = c["e2e_ios"] if ios_live else 0
    android_run = c["e2e_android"] if android_live else 0
    print(f"  runnable now: iOS e2e {ios_run} ({count_phrase(ios_live, 'simulator', 'running')}), "
          f"Android e2e {android_run} ({count_phrase(android_live, 'device', 'live')}), "
          f"headless {c['headless']}")


def _render_ability_json(caps, facts):
    print(json.dumps({"env": ENV.name, "host": ENV.host, "facts": {
        k: v for k, v in facts.items() if k != "counts"},
        "capabilities": caps, "counts": facts["counts"]}, indent=2))


def _print_cap_row(r, fix):
    note = f"  — {r['note']}" if r["note"] else ""
    print(f"  {ABILITY_ICONS[r['possible']]} {r['label']:34}{note}")
    if fix and r["possible"] is False and r.get("fix"):
        print(f"      ↳ {r['fix']}")


def render_ability(caps, facts, as_json, fix=False):
    if as_json:
        return _render_ability_json(caps, facts)
    print(f"ability — env {ENV.name} ({ENV.host}); api {facts['api_state']}"
          + (f", server mode {facts['server_mode']}" if facts["server_mode"] else ""))
    print("\nCAPABILITIES (❔ = not derivable yet — WIP)")
    for r in caps:
        _print_cap_row(r, fix)
    _render_ability_counts(facts["counts"], facts["ios_live"], facts["android_live"])


def cmd_ability(as_json, verbose=False, fix=False):
    facts = gather_ability_facts()
    caps = derive_capabilities(facts)
    render_ability(caps, facts, as_json, fix or verbose)   # -v shows the ↳ advice too
    return 0


# ── inspect ───────────────────────────────────────────────────────────────────
#
# Interactive single-test inspector over a qa run's artifact directory.
# Stream-style REPL (stdlib only, like the rest of this file): menus are printed,
# choices are typed — a number, a command name, or any listed alias. Output goes
# to the scrollback; media (images, dirs, big logs) goes to external viewers.

import csv
import shlex
import string as _string

ROLES = ["role-user", "role-bubble-admin", "role-site-admin"]
TESTS_ROOT = REPO / "tests"
USE_CASES_TSV = REPO / "docs" / "use-cases-and-tests.tsv"
SCRIPTS_DIR = Path(__file__).resolve().parent
VIEWER_CONFIG = Path.home() / ".config" / "testctl" / "viewers.json"
# Viewer types a user can configure; None/missing = built-in default.
VIEWER_TYPES = ["directories", "images", "typescript", "json", "logs", "timestamped-logs"]
VIEWER_DEFAULTS = {"directories": "open", "images": "open -a Preview", "logs": "open"}


def short_role(role):
    return role[len("role-"):] if role and role.startswith("role-") else (role or "")


def load_viewer_config():
    try:
        return json.loads(VIEWER_CONFIG.read_text())
    except (OSError, json.JSONDecodeError):
        return {}


def viewer_for(vtype):
    cfg = load_viewer_config()
    return cfg.get(vtype) or VIEWER_DEFAULTS.get(vtype)


def open_with(vtype, paths):
    """Open paths with the configured viewer for vtype (default: macOS open)."""
    cmd = shlex.split(viewer_for(vtype) or "open")
    paths = [str(p) for p in paths]
    try:
        subprocess.run(cmd + paths, check=False)
        print(f"  ↗ {' '.join(cmd)} {' '.join(Path(p).name for p in paths[:6])}"
              + (f" … ({len(paths)} files)" if len(paths) > 6 else ""))
    except OSError as e:
        print(f"  ⚠️  could not run {cmd[0]}: {e}")


def clipboard_copy(text):
    try:
        subprocess.run(["pbcopy"], input=text.encode(), check=False)
        return True
    except OSError:
        return False


# ── run loading ──────────────────────────────────────────────────────────────

class Entry:
    """One (test, role) result inside a run."""

    def __init__(self, **kw):
        self.id = kw.get("id")
        self.role = kw.get("role")
        self.tool = kw.get("tool", "?")
        self.layer = kw.get("layer", "?")
        self.tags = kw.get("tags") or []
        self.status = kw.get("status", "?")
        self.reason = kw.get("reason") or ""
        self.message = kw.get("message") or ""
        self.duration_ms = kw.get("durationMs")
        self.known_bug = kw.get("knownBug", False)
        self.expected_finding = kw.get("expectedFinding", False)
        self.artifacts = Path(kw.get("artifactsDir", ""))

    @property
    def failing(self):
        return self.status in ("fail", "error")

    @property
    def icon(self):
        if self.status == "pass":
            return "✅"
        if self.status == "?":
            return "❔"
        if self.known_bug:
            return "🐞"
        if self.expected_finding:
            return "🔎"
        return "❌" if self.status == "fail" else "⚠️ "

    def label(self):
        """Mirror of the qa summary line, minus the run time."""
        role = f" [{self.role}]" if self.role else ""
        note = "  ".join(x for x in (self.reason, self.message) if x)
        return f"{self.icon} {self.id}{role}  {note}".rstrip()


def _run_root_from_path(arg):
    """Explicit path arg → its run root (file → its dir, artifact subdir → run root)."""
    p = Path(arg).expanduser()
    if not p.exists():
        raise SystemExit(f"error: no such path: {arg}")
    p = p.resolve()
    if p.is_file():
        p = p.parent
    for cand in [p, *p.parents]:
        if (cand / "summary.json").exists() or (cand / "run-params.json").exists() \
                or cand.name.startswith("run-"):
            return cand
        if cand == OUTPUT_ROOT:
            break
    return p


def _newest_run_dir():
    runs = sorted((d for d in OUTPUT_ROOT.glob("run-*") if d.is_dir()),
                  key=lambda d: d.stat().st_mtime, reverse=True)
    for d in runs:
        if (d / "summary.json").exists():
            return d
    if runs:
        return runs[0]
    raise SystemExit(f"error: no run directories under {OUTPUT_ROOT}")


def find_run_dir(arg):
    """Resolve the run directory: explicit arg (file → its dir, artifact subdir →
    run root) or the heartbeat's current run, else the newest run-* dir."""
    if arg:
        return _run_root_from_path(arg)
    hb = read_heartbeat(ps_snapshot())
    if hb and hb.get("runnerAlive") and hb.get("runDir") and Path(hb["runDir"]).is_dir():
        return Path(hb["runDir"])
    return _newest_run_dir()


def _summary_entry(r, run_dir):
    e = Entry(**r)
    # Artifact dirs are stored absolute; survive a moved/renamed checkout.
    if not e.artifacts.is_dir():
        guess = run_dir / e.layer / (f"{e.id}-{e.role}" if e.role else e.id)
        if guess.is_dir():
            e.artifacts = guess
    return e


def _synth_status_from_logs(d):
    status = "?"
    for log in list(d.glob("high-level-*.log")) + list(d.glob("run.log")):
        try:
            txt = log.read_text(errors="replace")
        except OSError:
            continue
        if " FAILED" in txt or "(exit 1)" in txt or "(exit 2)" in txt:
            status = "fail"
        elif "(exit 0)" in txt:
            status = "pass"
    return status


def _synth_entry(d, layer):
    leaf = d.name
    role = next((r for r in ROLES if leaf.endswith("-" + r)), None)
    tid = leaf[: -len(role) - 1] if role else leaf
    tool = "maestro" if layer == "e2e" else (
        "newman" if list(d.glob("*postman_collection*")) else "vitest")
    return Entry(id=tid, role=role, tool=tool, layer=layer,
                 status=_synth_status_from_logs(d), artifactsDir=str(d),
                 message="(no summary.json — run in progress or aborted)")


def _layer_entries(run_dir, layer):
    base = run_dir / layer
    if not base.is_dir():
        return []
    return [_synth_entry(d, layer)
            for d in sorted(p for p in base.iterdir() if p.is_dir())]


def _synthesize_live_entries(info, run_dir):
    """No summary yet: in-progress or manual run — synthesize entries from disk."""
    info["live"] = True
    for layer in ("e2e", "headless"):
        info["entries"] += _layer_entries(run_dir, layer)
    if not info["entries"] and run_dir.name.startswith("run-manual-"):
        info["entries"].append(Entry(id=run_dir.name[len("run-manual-"):], role=None,
                                     tool="maestro", layer="e2e", status="?",
                                     artifactsDir=str(run_dir), message="(manual qa:flow run)"))


def load_run(run_dir):
    """Return {dir, params, gates, summary, entries:[Entry], live:bool}."""
    info = {"dir": run_dir, "params": {}, "gates": [], "summary": None, "entries": [], "live": False}
    try:
        info["params"] = json.loads((run_dir / "run-params.json").read_text())
    except (OSError, json.JSONDecodeError):
        pass
    try:
        s = json.loads((run_dir / "summary.json").read_text())
    except (OSError, json.JSONDecodeError):
        _synthesize_live_entries(info, run_dir)
        return info
    info["summary"] = s
    info["gates"] = s.get("gates") or []
    info["entries"] = [_summary_entry(r, run_dir) for r in s.get("results", [])]
    return info


# ── forgiving test-name parsing ──────────────────────────────────────────────

ID_PAIR_RE = re.compile(r"\b([a-z][a-z-]*[a-z])[\s_-]+0*(\d+)\b")
UC_RE = re.compile(r"\buc[\s=_-]*0*(\d+)\b")
ROLE_EXPLICIT_RE = re.compile(r"\brole[\s=_-]+((?:bubble|site)[\s_-]?admin|user)\b")
ROLE_BARE_RE = re.compile(r"\b((?:bubble|site)[\s_-]?admin|user)\b")


def canon_role(text):
    t = re.sub(r"[\s_]+", "-", text.strip())
    cand = t if t.startswith("role-") else f"role-{t}"
    return cand if cand in ROLES else None


def _normalize_spec_text(spec):
    text = spec.strip().lower()
    text = re.sub(r"[✅❌🐞🔎⚠️❔]", " ", text)
    text = re.sub(r"[\[\](),=]", " ", text)
    text = re.sub(r"\b\d+\.\d+s\b", " ", text)       # durations like 51.9740s
    return re.sub(r"\s+", " ", text).strip()


def _match_test_id(text, by_id):
    """Scan (prefix, number) pairs against ids present in the run.
    Returns (tid, [matched span]) or (None, [])."""
    for m in ID_PAIR_RE.finditer(text):
        prefix = re.sub(r"[\s_]+", "-", m.group(1))
        if prefix in ("uc", "role"):
            continue
        num = int(m.group(2))
        for known in by_id:
            km = re.match(r"(.+)-0*(\d+)$", known)
            if km and km.group(1) == prefix and int(km.group(2)) == num:
                return known, [m.span()]
    return None, []


def _match_role(text, id_spans):
    """Explicit role-… first; bare form only outside any matched id span
    (so "bubble-admin-0600" alone doesn't read as role=bubble-admin)."""
    m = ROLE_EXPLICIT_RE.search(text)
    if m:
        return canon_role(m.group(1))
    bare = text
    for a, b in sorted(id_spans, reverse=True):
        bare = bare[:a] + " " * (b - a) + bare[b:]
    m = ROLE_BARE_RE.search(bare)
    return canon_role(m.group(1)) if m else None


def _match_uc_alias(text, entries):
    """(tid, error) via the UC alias — only used when no test id was recognized."""
    m = UC_RE.search(text)
    if not m:
        return None, None
    uc = m.group(1)
    uc_ids = sorted({e.id for e in entries
                     if re.search(rf"\buc\s*0*{uc}\b", e.reason, re.I)})
    if not uc_ids:
        return None, f"No test in this run mentions UC {uc}"
    if len(uc_ids) > 1:
        return None, f"UC {uc} is ambiguous here — tests: {', '.join(uc_ids)}"
    return uc_ids[0], None


def _role_mismatch_error(tid, role, roles_present):
    if not roles_present:
        return f"Test {tid} runs without a role"
    if len(roles_present) == 1:
        return f"Test {tid} only runs with role {short_role(roles_present[0])}"
    return (f"Test {tid} did not run with role {short_role(role)} here; "
            f"roles: {', '.join(short_role(r) for r in roles_present)}")


def _pick_entry_for_role(tid, cands, role):
    roles_present = [e.role for e in cands if e.role]
    if role:
        for e in cands:
            if e.role == role:
                return e, None
        return None, _role_mismatch_error(tid, role, roles_present)
    if len(cands) == 1:
        return cands[0], None
    return None, (f"Test {tid} runs with multiple roles: "
                  + ", ".join(short_role(r) for r in roles_present))


def parse_test_spec(spec, entries):
    """Parse a forgiving test spec against the run's entries.
    Returns (entry, None) or (None, 'reason it was rejected')."""
    text = _normalize_spec_text(spec)
    by_id = {}
    for e in entries:
        by_id.setdefault(e.id, []).append(e)
    tid, id_spans = _match_test_id(text, by_id)
    role = _match_role(text, id_spans)
    if tid is None:
        tid, err = _match_uc_alias(text, entries)
        if err:
            return None, err
    if tid is None:
        return None, f"Could not find a test name in {spec!r} for this run"
    return _pick_entry_for_role(tid, by_id[tid], role)


# ── repo source lookup ───────────────────────────────────────────────────────

def find_source_by_qa_id(tid, layer):
    """Locate the original test source in the repo by its qa-id marker."""
    pat = re.compile(rf"(?://|#)\s*qa-id:\s*{re.escape(tid)}\s*$", re.M)
    roots = {"e2e": ("e2e", "*.yaml"), "headless": ("headless", "*.headless.test.ts")}
    sub, glob = roots.get(layer, ("", "*"))
    for f in sorted((TESTS_ROOT / sub).rglob(glob)):
        try:
            if pat.search(f.read_text(errors="replace")):
                return f
        except OSError:
            continue
    if layer == "headless" and tid.startswith("contract-"):
        c = TESTS_ROOT / "headless/contract/contract-smoke.postman_collection.json"
        if c.exists():
            return c
    return None


def first_glob(d, *patterns):
    for pat in patterns:
        hits = sorted(d.glob(pat))
        if hits:
            return hits[0]
    return None


# ── command implementations ──────────────────────────────────────────────────

def _maestro_failure_text(e):
    log = first_glob(e.artifacts, "high-level-maestro-output.log", "run.log")
    if not log:
        return None
    lines = log.read_text(errors="replace").splitlines()
    idx = [i for i, l in enumerate(lines) if "FAILED" in l]
    if not idx:
        return None
    i = idx[-1]
    end = len(lines)
    for j in range(i + 1, len(lines)):
        if lines[j].startswith("===="):
            end = j + 1
            break
    return "\n".join(lines[max(0, i - 3):end])


def _vitest_failed_lines(a):
    lines = [f"✗ {a.get('fullName', a.get('title', '?'))}"]
    for msg in a.get("failureMessages") or []:
        lines.append("  " + "\n  ".join(msg.splitlines()[:25]))
    return lines


def _vitest_failure_text(e):
    f = first_glob(e.artifacts, "vitest-results--*.json", "vitest.json")
    if not f:
        return None
    try:
        data = json.loads(f.read_text())
    except (OSError, json.JSONDecodeError):
        return None
    out = []
    for tr in data.get("testResults", []):
        for a in tr.get("assertionResults", []):
            if a.get("status") == "failed":
                out.extend(_vitest_failed_lines(a))
    return "\n".join(out) or None


def _newman_failure_text(e):
    f = first_glob(e.artifacts, "detailed-log--*.json", "newman.json")
    if not f:
        return None
    try:
        failures = json.loads(f.read_text()).get("run", {}).get("failures", [])
    except (OSError, json.JSONDecodeError):
        return None
    out = []
    for fl in failures:
        src = (fl.get("source") or {}).get("name", "?")
        err = fl.get("error") or {}
        out.append(f"✗ {src} — {err.get('test', '')}\n  {err.get('message', '')}")
    return "\n".join(out) or None


_FAILURE_TEXT_FNS = {"maestro": _maestro_failure_text, "vitest": _vitest_failure_text,
                     "newman": _newman_failure_text}


def get_failure_text(e):
    """The failing step + context, per runner. Returns text or None."""
    fn = _FAILURE_TEXT_FNS.get(e.tool)
    return fn(e) if fn else None


def cmd_show_failure(e, run):
    txt = get_failure_text(e)
    if txt is None:
        if e.status == "pass":
            print("  Test passed — no failing step recorded.")
        else:
            print("  No failing step found in the logs; try 'internal log' or 'dir'.")
        return
    print(txt)
    notes = [x for x in (e.reason, e.message) if x]
    if notes:
        print("\nRunner notes: " + "  ".join(notes))


def pretty_dump(path):
    print(f"\n────── {path} ──────")
    try:
        text = path.read_text(errors="replace")
    except OSError as err:
        print(f"  ⚠️  unreadable: {err}")
        return
    long_lines = any(len(l) > 150 for l in text.splitlines())
    if path.suffix == ".json" or (long_lines and text.lstrip()[:1] in "[{"):
        try:
            text = json.dumps(json.loads(text), indent=2)
        except json.JSONDecodeError:
            pass
    print(text)


def flow_files(e):
    """Maestro: the copied flow + subflows, main flow (qa-id match) first."""
    files = sorted((e.artifacts / "flow").rglob("*.yaml")) if (e.artifacts / "flow").is_dir() else []
    pat = re.compile(rf"#\s*qa-id:\s*{re.escape(e.id)}\s*$", re.M)
    files.sort(key=lambda f: 0 if pat.search(f.read_text(errors="replace")) else 1)
    return files


def _code_files_for(e):
    """Test source files: the artifact copy first, else the repo qa-id match."""
    if e.tool == "maestro":
        files = flow_files(e)
    else:
        f = first_glob(e.artifacts, "*.headless.test.ts", "*postman_collection*.json")
        files = [f] if f else []
    if not files:
        src = find_source_by_qa_id(e.id, e.layer)
        files = [src] if src else []
    return files


def cmd_show_code(e, run):
    files = _code_files_for(e)
    if not files:
        print("  No test source found (artifact copy or repo qa-id match).")
        return
    for f in files:
        pretty_dump(f)


def use_case_numbers(e):
    src_text = ""
    src = find_source_by_qa_id(e.id, e.layer)
    if src:
        try:
            src_text = src.read_text(errors="replace")
        except OSError:
            pass
    return sorted({m.group(1) for m in re.finditer(r"\bUC[\s-]*0*(\d+)\b",
                                                   f"{e.reason} {src_text}", re.I)}, key=int)


def _print_uc_fields(header, r):
    for i, h in enumerate(header):
        v = r[i].strip() if i < len(r) else ""
        # The recorded manual-testing status is stale/untrustworthy; the use-case
        # command is slated for rework (deferred). Stub it rather than mislead.
        if "Manual testing status" in h:
            v = "FIXME - future work"
        if v and h.strip():
            print(f"  {h.strip():<28} {v}")


def _print_one_uc(uc, header, rows, uc_col):
    hits = [r for r in rows[1:] if len(r) > uc_col and r[uc_col].strip() == uc]
    if not hits:
        print(f"  UC {uc}: not found in {USE_CASES_TSV.name}")
        return
    for r in hits:
        print(f"\nUC {uc}:")
        _print_uc_fields(header, r)


def cmd_show_use_case(e, run):
    ucs = use_case_numbers(e)
    if not ucs:
        print(f"  No UC number found in the reason/source of {e.id}.")
        return
    try:
        rows = list(csv.reader(USE_CASES_TSV.open(), delimiter="\t"))
    except OSError as err:
        print(f"  ⚠️  cannot read {USE_CASES_TSV}: {err}")
        return
    header = rows[0]
    uc_col = next((i for i, h in enumerate(header) if "Orig Use Case" in h), None)
    if uc_col is None:
        print("  ⚠️  use-case TSV header changed — no 'Orig Use Case Rank' column.")
        return
    for uc in ucs:
        _print_one_uc(uc, header, rows, uc_col)


def cmd_show_images(e, run):
    imgs = sorted(list(e.artifacts.glob("*.png")) + list(e.artifacts.glob("*.jpg")))
    if not imgs:
        print("  No screenshots in the artifact directory.")
        return
    open_with("images", imgs)


def build_run_cmd(e, run, flow_override=None, require_screen=False):
    """
    Constructs a command string to execute a specified run configuration, in support of the
      movie, noisy, and


    Args:
        e (Any): The execution environment containing attributes such as tool,
                 id, layer, and role.
        run (Dict): The run configuration dictionary. This must include the "params"
                key with run-specific parameters such as "env", "platform",
                and "deviceId".
        flow_override (Path, optional): An optional path to override the default
                                    flow YAML location. Default is None.
    require_screen (bool): A flag indicating whether the command should enforce
                           the requirement for a visible screen. Default is False.

    Returns:
    str: A formatted command string based on the provided inputs.

    Raises:
    None
    """
    params = run["params"]
    if e.tool == "maestro":
        return _maestro_run_cmd(e, params, flow_override, require_screen)
    base = params.get("apiBaseUrl", f"http://localhost:{API_PORT}")
    src = find_source_by_qa_id(e.id, e.layer)
    if e.tool == "vitest":
        rel = src.relative_to(REPO) if src else f"tests/headless/<test for {e.id}>.ts"
        return (f"QA_BASE_URL={base} npx vitest run "
                f"--config tests/headless/vitest.headless.config.ts {rel}")
    rel = src.relative_to(REPO) if src else "tests/headless/contract/contract-smoke.postman_collection.json"
    return f"npx newman run {rel} --env-var baseUrl={base} --reporters cli"


def _maestro_flow_rel(e, flow_override):
    if flow_override is not None:
        return (flow_override.relative_to(REPO)
                if str(flow_override).startswith(str(REPO)) else flow_override)
    src = find_source_by_qa_id(e.id, e.layer)
    return src.relative_to(REPO) if src else f"tests/e2e/<flow for {e.id}>.yaml"


def _maestro_run_cmd(e, params, flow_override, require_screen):
    cmd = f"npm run qa:flow -- {_maestro_flow_rel(e, flow_override)}"
    if e.role:
        cmd += f" --role {e.role}"
    envname = params.get("env", "local")
    if envname != "local":
        cmd += f" --env {envname}"
    # Preserve the run's platform (qa:flow defaults to iOS) and pin the device by a
    # RESOLVABLE token. Without this, an android run re-ran on iOS — the core bug.
    platform = params.get("platform", "ios")
    if platform != "ios":
        cmd += f" --platform {platform}"
    if platform == "web":
        return cmd
    tok = _sim_token(params.get("deviceId"), platform)
    if tok:
        cmd += f" --device {tok}"
    # Debug re-runs (cmd/movie/noisy) must have a visible screen.
    # A headless sim yields BLACK screenshots/recordings, defeating the whole point.
    # when `--require-screen` is present, then "qa" and "qa:flow" refuse to run on a headless device.
    if require_screen:
        cmd += " --require-screen"
    return cmd


def cmd_run_cmd(e, run):
    # require_screen: a manual re-run is for watching/debugging — fail loudly on a headless
    # sim rather than silently producing black frames.
    cmd = build_run_cmd(e, run, require_screen=True)
    print(f"  {cmd}")
    if clipboard_copy(cmd):
        print("  📋 copied to the clipboard")



def _movie_function_body(fn, fn_leaf, platform, dev, role, rel, env_arg):
    """The re-runnable zsh function emitted by `movie`, extracted so check_tooling can
    lint the generated shell (`zsh -n` + undefined-variable scan).

    A zsh FUNCTION (not a one-shot line): optional $1 platform, $2 device alias, $3 role.
    The device alias is resolved to a native id at call time (simctl/adb). Warmup is still
    recorded (trim deferred); the mp4 name is computed at call time under tmp/maestro.
    NB: every literal `{`/`}` and `${var}` below is doubled for the f-string — a single
    `{DEBUG_MOVIE}` here would be read as a Python field and raise NameError.
    FIXMEs: no genymotion support; implicit cwd is $PROJ_ROOT (unverified); the natural
    step delays make slow viewing (could speed up with ffprobe/ffmpeg).
    """
    return f"""{fn}() {{
  emulate -L zsh
  local platform="${{1:-{platform}}}" device="${{2:-{dev}}}" role="${{3:-{role}}}"
  set -k   # -k: permit trailing comments mid-command; zsh needs this
  [[ -n "${{DEBUG_MOVIE}}" ]] && set -x
  : platform is $platform, device is $device, role is $role
  local native_ID
  native_ID="$(manage_devices.py --resolve "$device")" || {{ print -u2 "movie: cannot resolve device '$device'"; return 1; }}
  mkdir -p tmp/maestro
  local mp4_file="tmp/maestro/movie-{fn_leaf}-$(date +%Y%m%dt%H%M%S).mp4"
  local -a flow=(npm run qa:flow -- {rel}{env_arg})
  [[ -n "$role" ]] && flow+=(--role "$role")
  # a headless/no-screen recording is worthless, so make qa:flow require a working screen.
  flow+=(--platform "$platform" --device "$device" --require-screen)
  # on either platform, start the recording in the background, then stop it after the tests finish
  if [[ "$platform" == android ]]; then
    print "movie[android]: screenrecord on device $device ($native_ID)"
    adb -s "$native_ID" shell screenrecord --bit-rate 4000000 /sdcard/{fn_leaf}.mp4 & local recorder_PID=$!
    "${{flow[@]}}"
    adb -s "$native_ID" shell pkill -INT screenrecord 2>/dev/null; wait $recorder_PID 2>/dev/null
    adb -s "$native_ID" pull /sdcard/{fn_leaf}.mp4 "$mp4_file" && adb -s "$native_ID" shell rm -f /sdcard/{fn_leaf}.mp4
  else
    print "movie[ios]: simctl recordVideo on device $device ($native_ID)"
    xcrun simctl io "$native_ID" recordVideo --codec h264 --force "$mp4_file" & local recorder_PID=$!
    "${{flow[@]}}"
    kill -INT $recorder_PID; wait $recorder_PID 2>/dev/null
  fi
  print "movie location: $mp4_file"
  movie_q="Do you want to see the movie in the default viewer right now?"
  read -q "REPLY?$movie_q [y/N] "
  print
  if [[ $REPLY == "Y" || $REPLY == "y" ]]; then
    open $mp4_file
  fi
  set +x
}}
alias action={fn}
"""


def cmd_run_movie(e, run):
    """
    Given a specific e2e test flow, run the test again (same device, same args) while recording the entire session.

    This works for simulator/emulators as well for real native devices. The "run again" is achieved by writing
	a small function that replicates the original conditions.

    Args: 
		e 

    """
    if e.tool != "maestro":
        base = build_run_cmd(e, run)
        print("  This was a Headless test — no screen, no movie. Use this re-run command instead")
        print(f"  {base}")
        if clipboard_copy(base):
            print("  📋 copied to the clipboard")
        return
    p = run["params"]
    platform = p.get("platform", "ios")
    device_id = p.get("deviceId")
    src = find_source_by_qa_id(e.id, e.layer)
    rel = src.relative_to(REPO) if src else f"tests/e2e/<flow for {e.id}>.yaml"
    env = p.get("env", "local")
    env_arg = f" --env {env}" if env != "local" else ""
    fn_leaf = re.sub(r"[^a-z0-9]+", "_",
                     (f"{e.id}-{short_role(e.role)}" if e.role else e.id).lower()).strip("_")
    fn = f"movie_run_{fn_leaf}"
    dev = _sim_token(device_id, platform) or platform
    role = e.role or ""
    body = _movie_function_body(fn, fn_leaf, platform, dev, role, rel, env_arg)
    print(body)

    if clipboard_copy(body):
        print("\n  📋 The function is in your cut/paste buffer now. Paste into a shell, then call:")
    else:
        print("\n  📋 Copy the function above, then paste into a shell, then call:")
    print(f"       {fn}                          # defaults: {platform} / {dev} / {short_role(e.role) or 'no role'}")
    print(f"       {fn} ios June role-user       # override platform / device / role\n")
    print(f"     The alias \"action\" is linked to the function, for convenience")


def _print_maestro_times(artifacts):
    begin, end, fail = _maestro_log_times(artifacts)
    if not (begin or end):
        return
    end_label = f"{end}" + ("   ⟵ error" if fail and fail == end else "")
    print(f"  begin    : {begin or '?'}")
    print(f"  end      : {end_label or '?'}")
    if fail and fail != end:
        print(f"  error at : {fail}")


def _print_tags_line(e, platform):
    if not e.tags:
        return
    # Flows are iOS-authored, so an 'ios'/'android' tag is about the flow's origin,
    # NOT the platform this run executed on. Call it out to avoid the classic trap.
    note = ""
    if platform != "ios" and "ios" in e.tags:
        note = f"   (⚠ 'ios' is a flow-authoring tag — this run was {platform})"
    elif platform == "ios" and "android" in e.tags:
        note = "   (⚠ 'android' is a flow-authoring tag — this run was ios)"
    print(f"  tags     : {', '.join(e.tags)}{note}")


def _print_device_line(device_id, platform):
    if platform == "web":
        return
    aliases = _device_aliases(device_id)
    hl = ("   [likely headless — black screen on this host]"
          if _looks_headless(device_id, platform) else "")
    print(f"  device   : {' / '.join(aliases) if aliases else '(unknown)'}{hl}")


def _run_scope_bits(p):
    """Run-level provenance, compact — no 138-id selectedTestIds dump (the old noise)."""
    scope = []
    if p.get("roles"):
        scope.append(f"{len(p['roles'])} roles")
    if p.get("layers"):
        scope.append("+".join(p["layers"]))
    if p.get("selectedTestIds"):
        scope.append(f"{len(p['selectedTestIds'])} tests selected")
    return scope


def _print_params_header(e):
    print(f"  test     : {e.id}" + (f" [{e.role}]" if e.role else ""))
    print(f"  runner   : {e.tool} (layer {e.layer})")
    print(f"  status   : {e.status}" + (f"  ({(e.duration_ms or 0) / 1000:.4f}s)" if e.duration_ms else ""))


def cmd_show_params(e, run):
    p = run["params"]
    platform = p.get("platform", "ios")
    src = find_source_by_qa_id(e.id, e.layer)
    _print_params_header(e)
    _print_maestro_times(e.artifacts)
    _print_tags_line(e, platform)
    if e.reason:
        print(f"  reason   : {e.reason}")
    if e.tool == "maestro":
        print(f"  flow     : {src.relative_to(REPO) if src else '(source not found by qa-id)'}")
    print("  ── how this was run ──────────────────────────────")
    print(f"  platform : {platform}")
    _print_device_line(p.get("deviceId"), platform)
    print(f"  env      : {p.get('env', 'local')}    api: {p.get('apiBaseUrl', '?')}    db: {p.get('dbClassification', '?')}")
    print(f"  command  : {build_run_cmd(e, run)}")
    load_gate = next((g for g in run["gates"] if g.get("name") == "load-average"), None)
    if load_gate:
        print(f"  load     : {load_gate.get('message')}")
    scope = _run_scope_bits(p)
    print(f"  run      : {p.get('startedAt', run['dir'].name)}  @{p.get('gitSha', '?')}"
          + (f"   ({', '.join(scope)})" if scope else ""))
    print(f"  artifacts: {e.artifacts}")


def cmd_go_dir(e, run):
    open_with("directories", [e.artifacts])


def runner_version(tool):
    if tool == "maestro":
        try:
            out = subprocess.run(["maestro", "--version"], capture_output=True,
                                 text=True, timeout=15).stdout.strip()
            return f"maestro {out.splitlines()[-1]}" if out else "maestro (version unknown)"
        except (OSError, subprocess.SubprocessError):
            return "maestro (version unknown)"
    try:
        deps = json.loads((REPO / "package.json").read_text())
        ver = {**deps.get("dependencies", {}), **deps.get("devDependencies", {})}.get(tool)
        return f"{tool} {ver}" if ver else tool
    except (OSError, json.JSONDecodeError):
        return tool


def _template_code_snippet(e):
    files = flow_files(e) if e.tool == "maestro" else \
        [f for f in [first_glob(e.artifacts, "*.headless.test.ts", "*postman_collection*.json")] if f]
    for f in files[:1]:
        try:
            return f.read_text(errors="replace")
        except OSError:
            pass
    return ""


def _template_target(e, platform):
    if e.layer != "e2e":
        return "the API over HTTP (headless)"
    return "an iOS simulator" if platform == "ios" else "a desktop web browser"


def _template_log_list(e, run):
    logs = sorted(str(p.relative_to(run["dir"])) for p in e.artifacts.glob("*")
                  if p.suffix in (".log", ".json", ".html"))
    return "\n".join(f"  - {l}" for l in logs) or "  (none)"


def _template_values(e, run):
    params = run["params"]
    return {
        "test_id": e.id,
        "role": short_role(e.role) or "n/a",
        "layer": e.layer,
        "target": _template_target(e, params.get("platform", "ios")),
        "failing_step": get_failure_text(e) or "(no failing step captured — test may have passed)",
        "test_script": _template_code_snippet(e) or "(test source not found)",
        "run_cmd": build_run_cmd(e, run),
        "runner_version": runner_version(e.tool),
        "parameters": json.dumps({k: v for k, v in params.items() if k != "selectedTestIds"}),
        "artifacts_dir": str(e.artifacts),
        "log_files": _template_log_list(e, run),
        "run_id": params.get("startedAt", run["dir"].name),
        "git_sha": params.get("gitSha", "unknown"),
        "reason": e.reason or "(none)",
        "use_cases": ", ".join(f"UC {u}" for u in use_case_numbers(e)) or "(none)",
    }


def _ask_missing_placeholders(tpl, values, interactive):
    """Tiny wizard: any $placeholder the script can't answer gets asked, with a default."""
    for key in sorted(set(re.findall(r"\$\{?(\w+)\}?", tpl.template)) - set(values)):
        default = "(unknown)"
        if interactive:
            ans = input(f"  {key.replace('_', ' ')} [{default}]: ").strip()
            values[key] = ans or default
        else:
            values[key] = default


def fill_template(template_name, e, run, interactive):
    tpl_path = SCRIPTS_DIR / template_name
    try:
        tpl = _string.Template(tpl_path.read_text())
    except OSError:
        print(f"  ⚠️  template missing: {tpl_path}")
        return None
    values = _template_values(e, run)
    _ask_missing_placeholders(tpl, values, interactive)
    return tpl.safe_substitute(values)


def cmd_create_prompt(e, run):
    text = fill_template("templates/_testctl_prompt_template.md", e, run, sys.stdin.isatty())
    if text is None:
        return
    leaf = f"{e.id}-{short_role(e.role)}" if e.role else e.id
    out = e.artifacts / f"prompt-{leaf}-{datetime.now().strftime('%Y%m%dt%H%M%S')}.md"
    out.write_text(text)
    print(f"  📝 wrote {out}")
    if clipboard_copy(str(out)):
        print("  📋 path copied to the clipboard")


def cmd_create_trello(e, run):
    text = fill_template("templates/_testctl_trello_template.md", e, run, sys.stdin.isatty())
    if text is None:
        return
    drafts = REPO / "tmp" / "trello-cards"
    drafts.mkdir(parents=True, exist_ok=True)
    leaf = f"{e.id}-{short_role(e.role)}" if e.role else e.id
    out = drafts / f"draft-{leaf}-{datetime.now().strftime('%Y%m%dt%H%M%S')}.md"
    out.write_text(text)
    print(f"  📝 draft written: {out}")
    print("  Review it, then batch-file via the trello workflow (drafts are never auto-filed).")


LOGVIEW = REPO / "scripts" / "maestro_logview.zsh"


def _maestro_log_times(artifacts):
    """(begin, end, fail) as HH:MM:SS read straight from a maestro internal log,
    or (None, None, None) if there isn't one. `fail` is the first CommandFailed
    (the actual error time), falling back to the last *FAILED* line."""
    log = first_glob(artifacts, "internal-maestro-log*.log")
    if not log:
        return (None, None, None)
    ts = re.compile(r"^(\d{2}:\d{2}:\d{2})\.\d{3} ")
    begin = end = fail = last_failed = None
    try:
        for line in log.read_text(errors="replace").splitlines():
            m = ts.match(line)
            if not m:
                continue
            t = m.group(1)
            if begin is None:
                begin = t
            end = t
            if "CommandFailed" in line and fail is None:
                fail = t
            elif "FAILED" in line:
                last_failed = t
    except OSError:
        return (None, None, None)
    return (begin, end, fail or last_failed)


def cmd_internal_log(e, run, verbose=False):
    # Maestro: the time-focused lnav view (window highlighted, landing on the error).
    # `/v` (verbose) bypasses that and opens the raw log in the configured viewer.
    if not verbose and e.tool == "maestro" and first_glob(e.artifacts, "internal-maestro-log*.log"):
        if not LOGVIEW.exists():
            print(f"  ⚠️  {LOGVIEW.relative_to(REPO)} missing — falling back to raw log.")
        else:
            try:
                subprocess.run(["zsh", str(LOGVIEW), str(e.artifacts), "--at-fail"], check=False)
                return
            except OSError as err:
                print(f"  ⚠️  could not run the log viewer ({err}) — falling back to raw log.")
    log = first_glob(e.artifacts, "internal-maestro-log*.log", "detailed-log--*.json",
                     "vitest-results--*.json", "*.log", "*.json")
    if not log:
        print("  No internal log found in the artifact directory.")
        return
    open_with("logs", [log])


WIZARD_TEXT = """\
  This is a work-in-progress!  In the future, we'll have more dynamic wizardry.
  Right now, this is fixed text with general guidance.

  And even the fixed test is a WIP.

  Best of luck!
"""


def cmd_wizard(e, run):
    print(WIZARD_TEXT)


def _ask_yes(prompt, default=False):
    if not sys.stdin.isatty():
        return default
    try:
        ans = input(f"{prompt} [{'Y/n' if default else 'y/N'}] ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        return default
    return ans.startswith("y") if ans else default


def _editor_open(paths):
    """Open the generated files in $VISUAL/$EDITOR; if unset, the caller already printed
    the paths, so just hint how to auto-open next time."""
    ed = os.environ.get("VISUAL") or os.environ.get("EDITOR")
    if ed:
        try:
            subprocess.run(shlex.split(ed) + [str(p) for p in paths], check=False)
            print(f"  ✎ opened in {ed}")
            return
        except OSError:
            pass
    print("  (set $EDITOR or $VISUAL to auto-open these)")


def _verbose_flow(text):
    """Best-effort 'extraordinary logging' copy: insert a screenshot after each action
    step. Line-based (Maestro flows are line-oriented); WIP — review before running."""
    out, n = [], 0
    action = re.compile(r"^(\s*)- (tapOn|inputText|runFlow|scroll|swipe|assertVisible|pressKey)\b")
    for line in text.splitlines():
        out.append(line)
        m = action.match(line)
        if m:
            n += 1
            out.append(f"{m.group(1)}- takeScreenshot: ${{SHOT_PREFIX}}verbose-step-{n:02d}")
    return "\n".join(out) + "\n"


# ── noisy: flatten includes + screenshot every action ──────────────────────────
# Maestro flows are line-oriented (no YAML lib here, same reason _verbose_flow is
# line-based). `noisy` is the debug-decorator from the e2e-infra backlog: it inlines
# every `runFlow: file:` include into one self-contained flow, then brackets each
# action with before/after screenshots so a failed run leaves a frame-by-frame trail.

# Commands that change what's on screen — these get bracketed with screenshots.
# Asserts/waits only observe, so they aren't bracketed (the neighbouring shots cover them).
NOISY_ACTIONS = {
    "tapOn", "doubleTapOn", "longPressOn", "inputText", "inputRandomText", "eraseText",
    "pasteText", "copyTextFrom", "scroll", "scrollUntilVisible", "swipe", "openLink",
    "pressKey", "back", "hideKeyboard", "launchApp", "stopApp", "killApp",
    "setLocation", "travel", "addMedia", "runScript", "clearState", "clearKeychain",
}
_STEP_RE = re.compile(r"^-\s")
_CMD_RE = re.compile(r"^-\s+([A-Za-z_]\w*)")


def _flow_header(text):
    """Everything up to and including the first `---` doc separator (appId/tags/env)."""
    out = []
    for line in text.splitlines():
        out.append(line)
        if line.strip() == "---":
            return "\n".join(out)
    return "appId: com.bubble.mobile\n---"  # flow had no header; synthesise a minimal one


def _flow_body(text):
    """The step list — everything after the first `---` separator."""
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if line.strip() == "---":
            return lines[i + 1:]
    return lines  # no separator → whole file is the body (rare)


def _iter_blocks(body_lines):
    """Yield {'leading':[...comments/blanks], 'body':[...], 'cmd':name} per step.
    A step starts at a column-0 `- ` and runs until the next column-0 `- ` or comment."""
    blocks, pending, cur = [], [], None

    def flush():
        nonlocal cur
        if cur is not None:
            m = _CMD_RE.match(cur["body"][0])
            blocks.append({"leading": cur["leading"], "body": cur["body"],
                           "cmd": m.group(1) if m else None})
            cur = None

    for line in body_lines:
        if _STEP_RE.match(line):
            flush()
            cur = {"leading": pending, "body": [line]}
            pending = []
        elif cur is not None and (line[:1] in (" ", "\t") or line.strip() == ""):
            cur["body"].append(line)
        else:  # column-0 comment or blank between steps → leads the next step
            flush()
            pending.append(line)
    flush()
    if pending:
        blocks.append({"leading": pending, "body": [], "cmd": None})
    return blocks


def _runflow_file(body):
    file_path = None
    for line in body:
        m = re.match(r"^\s+file:\s*(.+?)\s*$", line)
        if m:
            file_path = m.group(1).strip().strip("\"'")
    return file_path


def _env_block_start(body):
    """(indent, first-body-index) of the `env:` block, or (None, 0)."""
    for i, line in enumerate(body):
        m = re.match(r"^(\s+)env:\s*$", line)
        if m:
            return len(m.group(1)), i + 1
    return None, 0


def _runflow_env(body):
    env_indent, start = _env_block_start(body)
    if env_indent is None:
        return {}
    env = {}
    for line in body[start:]:
        if not line.strip():
            continue
        if len(line) - len(line.lstrip()) <= env_indent:
            break  # dedent ends the env block
        mm = re.match(r"^\s+([A-Za-z_]\w*):\s*(.*?)\s*$", line)
        if mm:
            env[mm.group(1)] = mm.group(2).strip().strip("\"'")
    return env


def _parse_runflow(body):
    """For a `runFlow` block, return (file_path_or_None, {env KEY: VALUE})."""
    return _runflow_file(body), _runflow_env(body)


def _subst_env(text, env_map):
    """Single-pass ${KEY} substitution (no re-expansion). Vars absent from env_map
    stay literal so the runner's -e values still resolve them at run time."""
    if not env_map:
        return text
    return re.sub(r"\$\{(\w+)\}", lambda m: env_map.get(m.group(1), m.group(0)), text)


def flatten_flow(path, env_map, seen, includes, depth=0):
    """Return a flat list of step blocks with all `runFlow: file:` includes inlined.
    Subflow headers are dropped; their env-mapped bodies are spliced at top level."""
    path = path.resolve()
    if path in seen:
        return [{"leading": [f"# ⚠️ include cycle skipped: {path.name}"], "body": [], "cmd": None}]
    seen = seen | {path}
    try:
        raw = path.read_text(errors="replace")
    except OSError as err:
        return [{"leading": [f"# ⚠️ could not read include {path}: {err}"], "body": [], "cmd": None}]
    text = _subst_env(raw, env_map) if depth else raw
    out = []
    for blk in _iter_blocks(_flow_body(text)):
        spliced = (_flatten_include(blk, path, env_map, seen, includes, depth)
                   if blk["cmd"] == "runFlow" else None)
        out += [blk] if spliced is None else spliced
    return out


def _flatten_include(blk, path, env_map, seen, includes, depth):
    """Inline one runFlow include. None when the block has no file: (the caller
    then emits the block verbatim)."""
    sub_file, sub_env = _parse_runflow(blk["body"])
    if not sub_file:
        return None
    sub_path = (path.parent / sub_file).resolve()
    rel = sub_path.relative_to(REPO) if str(sub_path).startswith(str(REPO)) else sub_path
    includes.append(rel)
    # Map the child's incoming env values through our own substitution first.
    child_env = {k: _subst_env(v, env_map) for k, v in sub_env.items()}
    out = [{"leading": blk["leading"] + [f"# ── begin include: {rel} ──"],
            "body": [], "cmd": None}]
    out += flatten_flow(sub_path, child_env, seen, includes, depth + 1)
    out.append({"leading": [f"# ── end include: {rel} ──"], "body": [], "cmd": None})
    return out


def noisy_decorate(units):
    """Emit the flattened body, bracketing every action with before/after screenshots."""
    out = ["- takeScreenshot: ${SHOT_PREFIX}noisy-000-start"]
    n = 0
    for u in units:
        out += u["leading"]
        if not u["body"]:
            continue
        if u["cmd"] in NOISY_ACTIONS:
            n += 1
            out.append(f"- takeScreenshot: ${{SHOT_PREFIX}}noisy-{n:03d}-before-{u['cmd']}")
            out += u["body"]
            out.append(f"- takeScreenshot: ${{SHOT_PREFIX}}noisy-{n:03d}-after-{u['cmd']}")
        else:
            out += u["body"]
    return "\n".join(out).rstrip() + "\n", n


def cmd_noisy(e, run):
    if e.tool != "maestro":
        print("  'noisy' is for Maestro e2e flows; this is a headless test.")
        return
    files = flow_files(e)
    src = files[0] if files else find_source_by_qa_id(e.id, e.layer)
    if not src:
        print("  No flow source found to decorate.")
        return
    includes = []
    units = flatten_flow(src, {}, set(), includes)
    header = _flow_header(src.read_text(errors="replace"))
    body, n_actions = noisy_decorate(units)
    leaf = f"{src.stem}-{short_role(e.role)}" if e.role else src.stem
    out = e.artifacts / f"noisy-{leaf}.yaml"
    hier_note = (
        "# ── Hierarchy / focus capture ──────────────────────────────────────────\n"
        "# Maestro has NO in-flow command to dump the view hierarchy or the focused\n"
        "# element, so this flow can only screenshot. To capture the on-screen objects\n"
        "# and the focused element (the `focused` attribute), run the parallel helper\n"
        "#   scripts/maestro_hierarchy.zsh\n"
        "# It shares the singleton on-device driver with `maestro test`, so run it while\n"
        "# this flow is PAUSED/STOPPED, or point it at a second simulator.\n"
    )
    out.write_text(header + "\n" + hier_note + body)
    try:
        rel = out.relative_to(REPO)
    except ValueError:
        rel = out
    print(f"  📣 noisy flow written: {rel}")
    print(f"     inlined {len(includes)} include(s): "
          + (", ".join(str(i) for i in dict.fromkeys(includes)) or "none"))
    print(f"     bracketed {n_actions} action(s) with before/after screenshots "
          f"(+ a noisy-000-start frame)")
    print(f"     hierarchy/focus: scripts/maestro_hierarchy.zsh (no in-flow dump exists)")
    # Reuse build_run_cmd so the noisy re-run keeps the ORIGINAL run's platform + sim (an
    # android run must re-run on android, not iOS) and forces a visible screen.
    print(f"  ▶ run it:  {build_run_cmd(e, run, flow_override=out, require_screen=True)}")
    _editor_open([out])


def _write_run_script(e, run, manual):
    """A re-runnable zsh script next to the manual flow, carrying the full invocation."""
    p = run["params"]
    platform = p.get("platform", "ios")
    device_id = p.get("deviceId")
    tok = _sim_token(device_id, platform) or platform
    rel = manual.relative_to(REPO)
    role_arg = f" --role {e.role}" if e.role else ""
    plat_arg = f" --platform {platform}" if platform != "ios" else ""
    env = p.get("env", "local")
    env_arg = f" --env {env}" if env != "local" else ""
    headless_note = ""
    if _looks_headless(device_id, platform):
        alias = _device_label(device_id)[0]
        headless_note = ("# ⚠️ headless device: the screen is BLACK here. To watch it, boot windowed first:\n"
                         f"#    manage_devices --start {alias}\n")
    out = manual.with_name(f"run-{manual.stem}.zsh")
    body = f"""#!/usr/bin/env zsh
# Generated by testctl 'edit' for {e.id}{(' [' + e.role + ']') if e.role else ''} — manual debugging copy.
# flow: {rel}   platform: {platform}   device: {' / '.join(_device_aliases(device_id)) or '?'}
{headless_note}set -e
cd {REPO}

# Preferred: drive through the qa runner (resolves the device, sets METRO/SHOT_PREFIX, seeds).
npm run qa:flow -- {rel}{role_arg}{plat_arg}{env_arg} --sim {tok}

# CHOOSE your preferences by uncommenting one of these lines:
# Bare Maestro (SHOT_PREFIX must stay under tmp/maestro/ per CLAUDE.md):
#   mkdir -p tmp/maestro
#   maestro --device "$( manage_devices --resolve {tok} )" test \\
#     -e METRO_HOST=localhost -e METRO_PORT=8081 -e SHOT_PREFIX=tmp/maestro/ {rel}
# Maestro Studio (interactive selector inspector):
#   maestro --device "$( manage_devices --resolve {tok} )" studio
"""
    out.write_text(body)
    out.chmod(0o755)
    return out


def cmd_edit(e, run):
    if e.tool != "maestro":
        print("  'edit' is for Maestro e2e flows. This is a headless test — use 'test'/'cmd'.")
        return
    p = run["params"]
    platform = p.get("platform", "ios")
    device_id = p.get("deviceId")
    if _looks_headless(device_id, platform):
        alias = _device_label(device_id)[0]
        print("  ⚠️  This device is headless. You can't see progress on the screen and "
              "screenshots will probably not work (you will only collect solid black images).")
        print(f"      To watch the flow, boot a visible {platform} screen first, e.g.:")
        print(f"       manage_devices --start {alias}   (default emulator boot is -no-window)")
    # Prefer the artifact's flow copy (its subflows sit beside it, so runFlow: ../common/…
    # paths resolve, and it lives under gitignored tests/output/). Fall back to the repo src.
    files = flow_files(e)
    src = files[0] if files else find_source_by_qa_id(e.id, e.layer)
    if not src:
        print("  No flow source found to copy.")
        return
    leaf = f"{src.stem}-{short_role(e.role)}" if e.role else src.stem
    text = src.read_text(errors="replace")
    manual = src.with_name(f"manual-{leaf}.yaml")
    manual.write_text(text)
    written = [manual]
    if _ask_yes("  Also generate a max-logging variant (screenshot after each step)?"):
        verbose = src.with_name(f"manual-{leaf}-verbose.yaml")
        verbose.write_text(_verbose_flow(text))
        written.append(verbose)
    written.append(_write_run_script(e, run, manual))
    print("  📝 generated:")
    for f in written:
        try:
            print(f"     {f.relative_to(REPO)}")
        except ValueError:
            print(f"     {f}")
    _editor_open(written)


def cmd_configure(e, run):
    cfg = load_viewer_config()
    print("  Viewer commands per type (Enter keeps current, '-' resets to default):")
    for t in VIEWER_TYPES:
        cur = cfg.get(t) or f"(default: {VIEWER_DEFAULTS.get(t, 'open')})"
        ans = input(f"    {t:<18} [{cur}]: ").strip()
        if ans == "-":
            cfg.pop(t, None)
        elif ans:
            cfg[t] = ans
    VIEWER_CONFIG.parent.mkdir(parents=True, exist_ok=True)
    VIEWER_CONFIG.write_text(json.dumps(cfg, indent=2) + "\n")
    print(f"  saved {VIEWER_CONFIG}")


# (key, [aliases], description, handler, section) — numbered in this order.
# 'configure'/'help' are NOT here: they're global keys handled in inspect_command_loop.
INSPECT_COMMANDS = [
    ("failure",  ["show failure", "failure", "fail"],
     "Show only the failing step, plus any comments from the runner", cmd_show_failure, "SHOW"),
    ("test",     ["show test", "test", "script", "show script", "test code", "code", "show code"],
     "Show the entire test script", cmd_show_code, "SHOW"),
    ("use case", ["show use case", "use case", "uc", "usecase"],
     "Show the use case related to this test (WIP)", cmd_show_use_case, "SHOW"),
    ("images",   ["show images", "images", "screenshots", "shots"],
     "Open all screenshots in an external viewer", cmd_show_images, "SHOW"),
    ("params",   ["show parameters", "parameters", "params"],
     "How this was run: runner, tags, env, device, system load", cmd_show_params, "SHOW"),
    ("dir",      ["go to directory", "directory", "dir", "open dir", "finder"],
     "Open the artifact directory in the directory viewer", cmd_go_dir, "SHOW"),
    ("log",      ["show runner internal log", "internal log", "log", "logs", "internal"],
     "Open the runner's detailed internal log at the time of the error. /v to see everything",
     cmd_internal_log, "SHOW"),
    ("cmd",      ["cmd", "run cmd", "run command", "run", "show run cmd", "show run", "create run cmd"],
     "Command to run just this test again, with the original parameters (auto-copied)", cmd_run_cmd, "RUN"),
    ("movie",    ["movie", "run as a movie", "run movie", "record"],
     "Generates a re-run command that also records an MP4 of the device screen", cmd_run_movie, "RUN"),
    ("edit",     ["edit", "edit script", "manual"],
     "A generated copy of the original script is created to use directly with Maestro or Maestro Studio", cmd_edit, "RUN"),
    ("noisy",    ["noisy", "decorate", "verbose flow", "screenshot every step"],
     "Generates a 'noisy' re-run command. It takes screenshots before and after every action in the Maestro script.",
     cmd_noisy, "RUN"),
    ("wizard",   ["wizard", "wiz", "suggest"],
     "Get debugging suggestions (WIP)", cmd_wizard, "DIG DEEPER"),
    ("prompt",   ["prompt", "create prompt"],
     "Build a prompt for an LLM (WIP)", cmd_create_prompt, "DIG DEEPER"),
    ("bug",      ["bug", "trello", "ticket", "create ticket", "create trello ticket", "draft bug"],
     "Draft a Trello bug card from this test's details (WIP)", cmd_create_trello, "DIG DEEPER"),
]


def norm_input(s):
    return re.sub(r"[^a-z0-9?]+", " ", s.lower()).strip()


def match_command(inp):
    n = norm_input(inp)
    if not n:
        return None
    if n.isdigit():
        i = int(n)
        return INSPECT_COMMANDS[i - 1] if 1 <= i <= len(INSPECT_COMMANDS) else None
    for c in INSPECT_COMMANDS:
        if n in (norm_input(a) for a in c[1]):
            return c
    pref = [c for c in INSPECT_COMMANDS if any(norm_input(a).startswith(n) for a in c[1])]
    return pref[0] if len(pref) == 1 else None


def split_verbose(raw):
    """('log/v' | 'log /v') → ('log', True); anything else → (raw, False).
    The `/v` suffix asks a command to bypass its default view (today: `log`)."""
    m = re.match(r"^(.*\S)\s*/\s*v(?:erbose)?\s*$", raw.strip(), re.I)
    return (m.group(1).strip(), True) if m else (raw, False)


def dispatch_command(cmd, e, run, verbose=False):
    """Invoke an INSPECT_COMMANDS entry; only `log` honours the verbose bypass."""
    if cmd[0] == "log":
        cmd_internal_log(e, run, verbose=verbose)
    else:
        cmd[3](e, run)


def print_command_menu(with_desc=True):
    print("\nCommands (abbreviations ok; 'tests' = test list, 'h' = help, "
          "'c' = configure, 'q' = quit):")
    last_section = None
    for i, (key, _aliases, desc, _h, section) in enumerate(INSPECT_COMMANDS, 1):
        if section != last_section:
            print(f"\n  {section}")
            last_section = section
        if with_desc:
            print(f"  {i:>2}) {key:<14} {desc}")
        else:
            print(f"  {i:>2}) {key}")


TEST_FILTER_TITLE = {"fails": "Failing / non-OK tests",
                     "passes": "Passing tests",
                     "all": "All tests in this run"}


def filter_entries(entries, mode):
    """[(canonical_num, entry)] for the filter mode. The canonical number is the
    test's 1-based position in execution order and is stable across filters — so
    `3` always names the same test whether the view is fails, passes, or all."""
    if mode == "fails":
        keep = lambda e: e.failing
    elif mode == "passes":
        keep = lambda e: not e.failing
    else:
        keep = lambda e: True
    return [(i, e) for i, e in enumerate(entries, 1) if keep(e)]


def print_test_menu(entries, mode):
    shown = filter_entries(entries, mode)
    print(f"\n{TEST_FILTER_TITLE[mode]} ({len(shown)} of {len(entries)}):")
    for num, e in shown:
        print(f"  {num:>2}) {e.label()}")
    return shown


def _safe_configure(e, run):
    try:
        cmd_configure(e, run)
    except (KeyboardInterrupt, EOFError):
        print("\n  (canceled)")


def _safe_dispatch(cmd, e, run, verbose):
    try:
        dispatch_command(cmd, e, run, verbose)
    except (KeyboardInterrupt, EOFError):
        print("\n  (canceled)")
    except Exception as err:  # an inspector command must never kill the session
        print(f"  ⚠️  {cmd[0]} failed: {err}")


def _handle_inspect_input(raw, e, run):
    """One inspector input. Returns 'quit'/'back' to leave the loop, None to stay."""
    n = norm_input(raw)
    if n in ("q", "quit", "exit"):
        return "quit"
    if n in ("t", "tests", "back", "b"):
        return "back"
    if n in ("h", "help", "menu") or raw.strip() == "?":
        print_command_menu()
        return None
    if n in ("c", "config", "configure"):
        _safe_configure(e, run)
        return None
    base, verbose = split_verbose(raw)
    cmd = match_command(base)
    if cmd is None:
        print(f"  ❓ unknown command {raw!r} — type 'h' for the menu")
        return None
    _safe_dispatch(cmd, e, run, verbose)
    return None


def inspect_command_loop(e, run):
    print(f"\n▶ {e.id}" + (f" [{e.role}]" if e.role else "")
          + f" — {e.status} ({e.tool}, {e.layer})")
    print(f"  artifacts: {e.artifacts}")
    print_command_menu()
    while True:
        try:
            raw = input(f"\n{e.id}> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return "quit"
        if not raw:
            continue
        outcome = _handle_inspect_input(raw, e, run)
        if outcome:
            return outcome


RECOGNIZED_KW = {"all", "last", "fails", "failing", "failed",
                 "passes", "passing", "passed"}


def _mode_from_kws(kws):
    mode = "fails"
    for kw in kws:
        if kw == "all":
            mode = "all"
        elif kw in ("passes", "passing", "passed"):
            mode = "passes"
        elif kw in ("fails", "failing", "failed", "last"):
            mode = "fails"
    return mode


# Filter-mode aliases typed at the run menu.
MODE_SWITCH = {"all": "all", "a": "all",
               "fails": "fails", "f": "fails", "failing": "fails", "failed": "fails",
               "passes": "passes", "p": "passes", "passing": "passes", "passed": "passes"}


def _select_run_entry(raw, n, entries):
    """(entry, error-message) from a numeric index or a forgiving spec."""
    if n.isdigit():
        idx = int(n)
        if not (1 <= idx <= len(entries)):
            return None, f"  no test #{idx} (this run has {len(entries)})"
        return entries[idx - 1], None
    sel, perr = parse_test_spec(raw, entries)
    return sel, (f"🔴🥺 {perr}" if perr else None)


def _open_selected_entry(raw, n, run, entries):
    """Drill into the picked test. Returns 'quit' when the user quit from inside."""
    sel, err = _select_run_entry(raw, n, entries)
    if err:
        print(err)
        return None
    return "quit" if inspect_command_loop(sel, run) == "quit" else None


def _run_menu_once(run, entries, mode, from_recent):
    """One run-menu prompt round → (action, mode); action ∈ 'quit'|'back'|None."""
    shown = print_test_menu(entries, mode)
    if not shown:
        print("  (none in this view — try 'all')")
    opts = ["# = test", "all/fails/passes = filter"]
    if from_recent:
        opts.append("'runs' = run list")
    opts.append("'q' quits")
    try:
        raw = input(f"\nSelect ({', '.join(opts)}): ").strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return "quit", mode
    n = norm_input(raw)
    if not raw:
        return None, mode
    if n in ("q", "quit", "exit"):
        return "quit", mode
    if n in MODE_SWITCH:
        return None, MODE_SWITCH[n]
    if from_recent and n in ("runs", "recent", "r", "back", "b"):
        return "back", mode
    return _open_selected_entry(raw, n, run, entries), mode


def run_menu_loop(run, mode="fails", from_recent=False):
    """RUN level: list a run's tests (filtered), drill into one. Returns 'quit' or,
    when from_recent, 'back' to return to the run list."""
    entries = run["entries"]
    while True:
        action, mode = _run_menu_once(run, entries, mode, from_recent)
        if action:
            return action


def recent_browser():
    """RUNS level: numbered table of every run in the window; pick one to drill in."""
    while True:
        rows = _recent_runs_table(numbered=True)
        if not rows:
            print(f"No QA runs in the past {RUNS_WINDOW_H}h.")
            return 0
        try:
            raw = input(f"\nSelect run (1-{len(rows)}; 'q' quits): ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return 0
        n = norm_input(raw)
        if n in ("q", "quit", "exit"):
            return 0
        if not n.isdigit() or not (1 <= int(n) <= len(rows)):
            print(f"  enter a number 1-{len(rows)}")
            continue
        run = load_run(rows[int(n) - 1]["dir"])
        if not run["entries"]:
            print(f"  No test artifacts in {run['dir'].name}")
            continue
        if run_menu_loop(run, from_recent=True) == "quit":
            return 0


def _split_inspect_args(spec_args):
    """Split positionals: a path (or anything with a "/") is the run dir; the rest
    are words — keywords (recent/all/last/fails/passes) and/or numbers."""
    run_arg, words = None, []
    for a in spec_args or []:
        if run_arg is None and ("/" in a or Path(a).expanduser().exists()):
            run_arg = a
        else:
            words.append(a)
    return run_arg, words


def _inspect_recent(as_json, interactive):
    """`inspect recent` → browse ALL runs in the window, then drill in."""
    if as_json:
        rows = _collect_recent_runs()
        print(json.dumps({"recent": [
            {"dir": str(r["dir"]), "started": r["started"], "platform": r["platform"],
             "runtimeHours": r["runtime"], "result": r["result"]} for r in rows]}, indent=2))
        return 0
    if not interactive:
        _recent_runs_table(numbered=True)
        return 0
    return recent_browser()


def _inspect_json_summary(run, entries):
    failing = [e for e in entries if e.failing]
    print(json.dumps({
        "runDir": str(run["dir"]), "live": run["live"],
        "failing": [{"id": e.id, "role": e.role, "tool": e.tool, "status": e.status,
                     "reason": e.reason, "artifactsDir": str(e.artifacts)} for e in failing],
        "total": len(entries),
    }, indent=2))
    return 0


def _select_by_number(leftover, entries):
    idx = int(leftover[0])
    if not (1 <= idx <= len(entries)):
        print(f"🔴🥺 no test #{idx} (this run has {len(entries)})")
        return None, None, 2
    return entries[idx - 1], (leftover[1] if len(leftover) > 1 else None), None


def _select_by_spec(leftover, entries, one_cmd, interactive):
    selected, err = parse_test_spec(" ".join(leftover), entries)
    if err:
        print(f"🔴🥺 {err}")
        if one_cmd or not interactive:
            return None, None, 2
    return selected, None, None


def _select_from_words(words, entries, one_cmd, interactive):
    """Pick the target test from word args → (selected, item, exit_code). Pure-number
    args are canonical indices (test #, then item #); anything with a non-keyword
    word is a forgiving spec ("auth 100, site admin"). exit_code is None unless the
    command must stop now."""
    leftover = [w for w in words if w.lower() not in RECOGNIZED_KW]
    if not leftover:
        return None, None, None
    if all(w.isdigit() for w in leftover):
        return _select_by_number(leftover, entries)
    return _select_by_spec(leftover, entries, one_cmd, interactive)


def _maybe_run_item(selected, run, run_item, interactive):
    """A menu item on the command line (the B in `inspect N B`) or --cmd runs at
    once. Returns an exit code to stop with, or None to continue into the menus."""
    if not (selected and run_item):
        return None
    norm = norm_input(run_item)
    if norm in ("h", "help", "menu") or run_item.strip() == "?":
        print_command_menu()
        return 0
    if norm in ("c", "config", "configure"):
        cmd_configure(selected, run)
        return 0
    base, verbose = split_verbose(run_item)
    cmd = match_command(base)
    if cmd is None:
        print_command_menu()
        return 2
    dispatch_command(cmd, selected, run, verbose)
    return 0 if not interactive else None


def _print_no_tty_menu(entries, mode):
    shown = print_test_menu(entries, mode)
    if not shown:
        print("  (none)")
    print("\n(no tty — `inspect <N>` then a menu number, or --cmd <command>, runs one step)")


def _interactive_inspect(selected, run, mode):
    """A chosen test drops into its menu; 'back' falls through to the run menu, so
    the whole run stays navigable from a deep-link."""
    if selected and inspect_command_loop(selected, run) == "quit":
        return 0
    run_menu_loop(run, mode=mode)
    return 0


def _enable_readline():
    try:
        import readline  # noqa: F401 — line editing + history for input()
    except ImportError:
        pass


def _print_run_header(run, entries):
    failing = sum(1 for e in entries if e.failing)
    state = "in progress / no summary" if run["live"] else "finished"
    print(f"Run {run['dir'].name}  ({state}; {failing} failing of {len(entries)})")


def _inspect_run(run_arg, words, one_cmd, as_json, interactive):
    run = load_run(find_run_dir(run_arg))
    entries = run["entries"]
    if not entries:
        print(f"No test artifacts found in {run['dir']}")
        return 1
    if as_json:
        return _inspect_json_summary(run, entries)
    _print_run_header(run, entries)
    mode = _mode_from_kws([w.lower() for w in words])
    selected, item, code = _select_from_words(words, entries, one_cmd, interactive)
    if code is not None:
        return code
    code = _maybe_run_item(selected, run, item or one_cmd, interactive)
    if code is not None:
        return code
    if not interactive:
        _print_no_tty_menu(entries, mode)
        return 0
    return _interactive_inspect(selected, run, mode)


def cmd_inspect(spec_args, one_cmd, as_json):
    _enable_readline()
    run_arg, words = _split_inspect_args(spec_args)
    interactive = sys.stdin.isatty()
    if words and words[0].lower() in ("recent", "runs"):
        return _inspect_recent(as_json, interactive)
    return _inspect_run(run_arg, words, one_cmd, as_json, interactive)


# ── main ──────────────────────────────────────────────────────────────────────

# ── CLI: root help + parser ──────────────────────────────────────────────────────

_ROOT_HELP_COMMANDS = [
    ("health", "diagnose the environment (are machines running)"),
    ("ability", "diagnose the testing possibilities with this environment"),
    ("status", "show tests in progress [default]"),
    ("inspect", "diagnostic tool to use after a test run"),
    ("nuke", "stop all test runners immediately"),
]
_ROOT_HELP_FRAMEWORK = [
    ("driver-health", "probe the Maestro device driver"),
    ("lock SUB_CMD", "manage mutual-exclusion locks between parallel tests. "
                     "SUB_CMD: status acquire release"),
]
_ROOT_HELP_OPTIONS = [
    ("--fix", 'This option only applies to "health" and "ability".\n'
              "It tries to fix the problem or tells you how"),
    ("--env ENV", "The default environment is LOCAL. PROD and STAGING are two alternatives."),
    ("--json", "Machine-readable output of this command"),
    ("-v, --verbose", "Add more detail to each command's output"),
    ("-h, --help", "show this help message and exit"),
]


def print_root_help():
    print(f"{_style('Usage:', 'bold')} testctl.py [-h] [-v] [--json] [--env=ENV] "
          "[--fix] [COMMAND]\n")
    print("TestCtl is the way to control and check on the environments where tests "
          "will be run.\nYou can dig into the details of a failing test.\n")
    for header, rows in ((_style("COMMANDS", "bold"), _ROOT_HELP_COMMANDS),
                         (_style("TEST FRAMEWORK COMMANDS", "bold"), _ROOT_HELP_FRAMEWORK)):
        print(header + "\n")
        for name, desc in rows:
            print(f"    {_style(name.ljust(16), 'green')}{desc}")
        print()
    print(_style("Options:", "bold") + "\n")
    for flag, desc in _ROOT_HELP_OPTIONS:
        first, *rest = desc.split("\n")
        print(f"  {_style(flag.ljust(18), 'cyan')}{first}")
        for line in rest:
            print(f"  {'':18}{line}")


class _RootHelpAction(argparse.Action):
    def __call__(self, parser, namespace, values, option_string=None):
        print_root_help()
        parser.exit(0)


def build_parser():
    ap = argparse.ArgumentParser(
        add_help=False,
        description="status / nuke / health / ability for the Bubble test platform")
    ap.add_argument("-h", "--help", nargs=0, action=_RootHelpAction,
                    help=argparse.SUPPRESS)
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("-v", "--verbose", action="store_true",
                    help="add more detail to each command's output")
    ap.add_argument("--env", metavar="ENV",
                    help="target environment: LOCAL (default), PROD, STAGING (L/P/S ok)")
    ap.add_argument("--fix", action="store_true",
                    help="health/ability: try to fix problems or say how")
    sub = ap.add_subparsers(dest="command")   # optional — default command is status
    p_status = sub.add_parser("status", help="show tests in progress [default]")
    p_nuke = sub.add_parser("nuke", help="stop all test runners immediately")
    p_nuke.add_argument("targets", nargs="?", metavar="LIST",
                        help="comma list: qa,cli,mcp,xcodebuild,headless,playwright,maestro,all|them-all")
    p_nuke.add_argument("--nuke", metavar="LIST",
                        help="same as the positional LIST (kept for npm qa:nuke compatibility)")
    p_health = sub.add_parser("health", help="diagnose the environment (are machines running)")
    p_ability = sub.add_parser("ability",
                               help="diagnose the testing possibilities with this environment")
    p_driver = sub.add_parser("driver-health", help="probe the Maestro device driver")
    p_lock = sub.add_parser("lock",
                            help="manage mutual-exclusion locks between parallel tests")
    p_lock.add_argument("action", choices=["acquire", "release", "status"])
    p_lock.add_argument("--runner", default="?", help="runner name for the report (qa/qa:flow/…)")
    p_lock.add_argument("--pid", type=int, default=0, help="the runner's own pid (owner)")
    p_lock.add_argument("--ppid", type=int, default=0, help="the runner's parent pid")
    p_lock.add_argument("--cmd", default="", help="invocation string for the report")
    p_lock.add_argument("--retries", type=int, default=3, help="acquire attempts before giving up")
    p_lock.add_argument("--interval", type=int, default=15, help="seconds between acquire attempts")
    p_inspect = sub.add_parser("inspect", help="artifact inspector for a run's tests")
    p_inspect.add_argument("spec", nargs="*", metavar="ARG",
                           help="last | all | recent | <N> [<B>] | a forgiving test name "
                                "('auth 100, site admin', a pasted summary line, 'uc-182') "
                                "and/or a run directory (default: current or newest run)")
    p_inspect.add_argument("--cmd", metavar="NAME",
                           help="run one menu command non-interactively (failure, code, run, …)")
    # Global flags are accepted both before and after the subcommand.
    for p in (p_status, p_nuke, p_health, p_ability, p_driver, p_inspect, p_lock):
        p.add_argument("--json", action="store_true", dest="json_sub", help=argparse.SUPPRESS)
        p.add_argument("-v", "--verbose", action="store_true", dest="verbose_sub",
                       help=argparse.SUPPRESS)
        p.add_argument("--env", dest="env_sub", metavar="ENV", help=argparse.SUPPRESS)
        p.add_argument("--fix", action="store_true", dest="fix_sub", help=argparse.SUPPRESS)
    return ap


def dispatch(cmd, args, ap):
    verbose = args.verbose or args.verbose_sub
    fix = args.fix or args.fix_sub
    if cmd == "nuke":
        spec = args.nuke or args.targets
        if not spec:
            ap.error("nuke needs targets: `nuke all` or `nuke --nuke=LIST`")
        return cmd_nuke(spec, args.json)
    table = {
        "status": lambda: cmd_status(args.json),
        "health": lambda: cmd_health(args.json, verbose=verbose, fix=fix),
        "ability": lambda: cmd_ability(args.json, verbose=verbose, fix=fix),
        "driver-health": lambda: cmd_driver_health(args.json, verbose=verbose),
        "lock": lambda: cmd_lock(args.action, args),
        "inspect": lambda: cmd_inspect(args.spec, args.cmd, args.json),
    }
    fn = table.get(cmd)
    return fn() if fn else 2


def main():
    ap = build_parser()
    args = ap.parse_args()
    if args.command is None:                      # default: `status --env LOCAL`
        args.command = "status"
        args.json_sub = args.verbose_sub = args.fix_sub = False
        args.env_sub = None
    global ENV
    ENV = resolve_env(args.env_sub or args.env)
    args.json = args.json or args.json_sub
    return dispatch(args.command, args, ap)


# ── test-runner mutual-exclusion lock ───────────────────────────────────────────
# Correctness over speed: AT MOST ONE test runner (qa / qa:flow / bench / maestro) runs at a
# time. The lock is a JSON flag file; the read-decide-write is serialized by an flock guard so
# two would-be runners can't both seize it ("two trying to grab at once"). The record carries
# pid/ppid/boottime so a lock left by a crash, `kill -9`, or reboot self-heals on the next
# acquire. Policy (Travis): NEVER auto-kill — a live genuine runner always refuses; passing
# LOCK_STALE_HOURS only escalates the report to "looks hung, clear with nuke". Stray maestro
# (test/studio launched outside our runners) is detected and refused, not killed.
RUNNER_CMD_RE = re.compile(
    r"tests/runner/(qa|run-flow)\.(ts|js)|maestro\s+(test|studio)|"
    r"bench_flow|bench_sims|qa:flow|npm(\s+\S+)*\s+qa\b", re.I)


def _pid_alive(pid):
    if not pid or pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:          # exists but owned by another user
        return True
    except OSError:
        return False


def _pid_cmd(pid):
    if not _pid_alive(pid):
        return ""
    try:
        return subprocess.run(["ps", "-o", "command=", "-p", str(pid)],
                              capture_output=True, text=True, timeout=5).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return ""


def _boottime():
    """Host boot time (epoch int) — a reboot changes it, invalidating any recorded pid."""
    try:
        out = subprocess.run(["sysctl", "-n", "kern.boottime"], capture_output=True,
                             text=True, timeout=5).stdout
        m = re.search(r"sec\s*=\s*(\d+)", out)          # macOS: "{ sec = 1782..., usec = .. }"
        if m:
            return int(m.group(1))
    except (OSError, subprocess.SubprocessError):
        pass
    try:
        for line in Path("/proc/stat").read_text().splitlines():   # linux fallback
            if line.startswith("btime"):
                return int(line.split()[1])
    except OSError:
        pass
    return 0


def _stray_maestro(exclude):
    """Live `maestro test`/`maestro studio` PIDs not in `exclude` — untracked test runners."""
    found = []
    try:
        out = subprocess.run(["ps", "-axo", "pid=,command="], capture_output=True,
                             text=True, timeout=5).stdout
    except (OSError, subprocess.SubprocessError):
        return found
    for line in out.splitlines():
        m = re.match(r"\s*(\d+)\s+(.*)", line)
        if not m:
            continue
        pid, cmd = int(m.group(1)), m.group(2)
        if pid in exclude or "testctl" in cmd:
            continue
        if re.search(r"\bmaestro\b.*\b(test|studio)\b", cmd):
            found.append((pid, cmd))
    return found


def _read_lock():
    try:
        return json.loads(LOCK_FILE.read_text())
    except (OSError, ValueError):
        return None


def _write_lock(rec):
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    tmp = LOCK_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(rec, indent=2) + "\n")
    os.replace(tmp, LOCK_FILE)                          # atomic publish


def _short(s, n=100):
    s = (s or "").replace("\n", " ")
    return s if len(s) <= n else s[:n] + "…"


def _age_hours(rec):
    return (time.time() - rec.get("startedEpoch", 0)) / 3600.0


def _lock_holder_state(rec):
    """Classify the current holder. Returns (reclaimable: bool, reason)."""
    bt = _boottime()
    if rec.get("boottime") and bt and rec["boottime"] != bt:
        return True, "host rebooted since the lock was taken (its pids are gone)"
    pid, ppid = rec.get("pid", 0), rec.get("ppid", 0)
    if not _pid_alive(pid):                             # cases A & C: owner gone
        if _pid_alive(ppid):
            return True, f"owner pid {pid} dead, parent {ppid} ({_short(_pid_cmd(ppid))!r}) alive"
        return True, f"owner pid {pid} and parent {ppid} both dead"
    # owner pid alive — is it a genuine runner, or a recycled pid now belonging to something else?
    if not (RUNNER_CMD_RE.search(_pid_cmd(pid)) or RUNNER_CMD_RE.search(_pid_cmd(ppid))):
        return True, f"pid {pid} alive but not a test runner ({_short(_pid_cmd(pid))!r}) — pid recycled"
    return False, ""                                    # live genuine runner → HELD


def _acquire_once(runner, pid, ppid, cmd):
    """One acquire attempt under the flock guard. Returns (ok, message)."""
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    gfd = os.open(str(LOCK_GUARD), os.O_CREAT | os.O_RDWR, 0o644)
    try:
        fcntl.flock(gfd, fcntl.LOCK_EX)                 # serialize the decision across processes
        rec = _read_lock()
        if rec is not None:
            reclaimable, reason = _lock_holder_state(rec)
            if not reclaimable:
                age = _age_hours(rec)
                hung = (f"\n    ⚠️ older than {LOCK_STALE_HOURS}h — looks HUNG; clear with "
                        "`python3 scripts/testctl.py nuke all`") if age >= LOCK_STALE_HOURS else ""
                return False, (f"a test runner is already running:\n"
                               f"    runner={rec.get('runner')} pid={rec.get('pid')} age={age:.1f}h\n"
                               f"    cmd: {rec.get('cmd')}\n"
                               f"    proc: {_pid_cmd(rec.get('pid', 0)) or '(gone)'}{hung}")
            grab_reason = f"reclaimed stale lock ({reason})"
        else:
            grab_reason = ""
        # About to grab — refuse if an untracked maestro test/studio is live (it's a runner too).
        stray = _stray_maestro(exclude={pid, ppid, os.getpid(), os.getppid(),
                                         (rec or {}).get("pid", 0)})
        if stray:
            lines = "\n".join(f"    pid={p}: {c}" for p, c in stray[:5])
            return False, ("an untracked maestro session is running (not under our lock); stop it "
                           "first (`testctl.py nuke maestro,mcp`):\n" + lines)
        _write_lock({
            "runner": runner, "pid": pid, "ppid": ppid, "cmd": cmd,
            "pidCmd": _pid_cmd(pid), "host": socket.gethostname(), "boottime": _boottime(),
            "startedAt": datetime.now().astimezone().isoformat(), "startedEpoch": int(time.time()),
        })
        return True, grab_reason
    finally:
        fcntl.flock(gfd, fcntl.LOCK_UN)
        os.close(gfd)


def _lock_status(as_json):
    rec = _read_lock()
    if as_json:
        print(json.dumps(rec or {}, indent=2))
        return 0
    if not rec:
        print("test-runner lock: FREE")
        return 0
    reclaimable, reason = _lock_holder_state(rec)
    print(f"test-runner lock: {'STALE/reclaimable' if reclaimable else 'HELD'}")
    print(f"  runner={rec.get('runner')} pid={rec.get('pid')} ppid={rec.get('ppid')} "
          f"age={_age_hours(rec):.1f}h  host={rec.get('host')}")
    print(f"  cmd: {rec.get('cmd')}")
    if reclaimable:
        print(f"  (reclaimable: {reason})")
    return 0


def _lock_release(pid):
    gfd = os.open(str(LOCK_GUARD), os.O_CREAT | os.O_RDWR, 0o644)
    try:
        fcntl.flock(gfd, fcntl.LOCK_EX)
        rec = _read_lock()
        if rec and rec.get("pid") == pid:
            try:
                LOCK_FILE.unlink()
            except OSError:
                pass
            print(f"🔓 lock released (pid {pid})", file=sys.stderr)
        elif rec:
            print(f"lock NOT released — owned by pid {rec.get('pid')}, not {pid}", file=sys.stderr)
        return 0
    finally:
        fcntl.flock(gfd, fcntl.LOCK_UN)
        os.close(gfd)


def _lock_acquire(args):
    attempts = max(1, args.retries)
    for i in range(1, attempts + 1):
        ok, msg = _acquire_once(args.runner, args.pid, args.ppid, args.cmd)
        if ok:
            extra = f" — {msg}" if msg else ""
            print(f"🔒 test-runner lock acquired ({args.runner} pid={args.pid}){extra}",
                  file=sys.stderr)
            return 0
        print(f"⛔ cannot start test runner (attempt {i}/{attempts}):\n{msg}", file=sys.stderr)
        if i < attempts:
            print(f"   retrying in {args.interval}s…", file=sys.stderr)
            time.sleep(args.interval)
    print("✗ giving up — another test runner holds the lock (correctness guard: only one at a time).",
          file=sys.stderr)
    return 1


def cmd_lock(action, args):
    if action == "status":
        return _lock_status(args.json)
    if action == "release":
        return _lock_release(args.pid)
    if action == "acquire":
        return _lock_acquire(args)
    return 2


if __name__ == "__main__":
    sys.exit(main())
