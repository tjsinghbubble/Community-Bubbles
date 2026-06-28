#!/usr/bin/env python3
"""
testctl — status / nuke / health for the Bubble test platform.

One tool callable by every entity that pokes at tests: Claude Code, shell
health scripts, humans, and the test scripts themselves.

  testctl.py status            what is running right now (test, step, runner, invoker, timings)
  testctl.py nuke LIST         stop test runners (known method first, else SIGQUIT → 2s → SIGKILL)
  testctl.py health            diagnose the local test environment
  testctl.py driver-health     probe the Maestro Android driver: gRPC deviceInfo (aliveness+latency)
                               if a live session holds :7001, else an lsof port-only check
  testctl.py inspect [last|all|recent|<N> [<B>]] [RUN_DIR]   artifact inspector
  testctl.py --json <cmd>      machine-readable output for any command

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
import fcntl
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
from datetime import datetime
from pathlib import Path
from urllib.request import urlopen
from urllib.error import URLError, HTTPError

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


def latest_maestro_step(search_dirs, max_age_s=3600):
    """Newest maestro log under any of search_dirs → (step_text, step_started_epoch, log_path).

    Two names: maestro.log (live, still under .maestro/tests/<ts>/ while the flow runs)
    and internal-maestro-log.log (post-run, after the qa runner flattens/renames it).
    """
    newest, newest_mtime = None, 0
    for d in search_dirs:
        d = Path(d)
        if not d.is_dir():
            continue
        try:
            for pattern in ("maestro.log", "internal-maestro-log*.log"):
                for f in d.rglob(pattern):
                    mt = f.stat().st_mtime
                    if mt > newest_mtime:
                        newest, newest_mtime = f, mt
        except OSError:
            continue
    if newest is None or time.time() - newest_mtime > max_age_s:
        return None, None, None
    try:
        lines = newest.read_text(errors="replace").splitlines()[-400:]
    except OSError:
        return None, None, None
    for line in reversed(lines):
        m = STEP_RE.match(line)
        if m:
            step = m.group(2).strip()[:140]
            # Log lines carry time-of-day only; borrow the date from the file mtime.
            day = datetime.fromtimestamp(newest_mtime).strftime("%Y-%m-%d")
            t = datetime.strptime(f"{day} {m.group(1)}", "%Y-%m-%d %H:%M:%S").timestamp()
            if t > newest_mtime + 60:  # log line written "later" than mtime → midnight wrap
                t -= 86400
            return step, t, str(newest)
    return None, None, str(newest)


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
_ANSI = {"green": "\033[1;32m", "red": "\033[31m", "reset": "\033[0m"}


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
    t = m.get("totals") or {}
    ran = t.get("total", 0)
    targeted = t.get("targeted") or ran
    passed = t.get("passed", 0)
    new_fail = t.get("failed", 0)
    backlog = t.get("knownBugs", 0) + t.get("findings", 0)

    # ── canceled / aborted (RED) ────────────────────────────────────────────
    if m.get("canceled"):
        reason = (m.get("cancelReason") or "").lower()
        note = f" · {ran}/{targeted} ran" if ran else ""
        if reason == "user":
            return f"Canceled by user{note}", "red"
        if reason == "panic" or "incomplete" in reason or "placeholder" in reason:
            return f"Crashed/incomplete{note}", "red"
        return "Failed gating", "red"

    # ── bad news (RED) ──────────────────────────────────────────────────────
    if ran == 0:
        return "No tests ran", "red"

    pct = round(100 * passed / targeted) if targeted else 0
    carried = f" · {backlog} carried" if backlog else ""

    # ── good news (GREEN, bold) ─────────────────────────────────────────────
    # No new failures. 100% with nothing carried is an unqualified Success; otherwise
    # it's still a pass, with a plain carried-count (no 🐞/🔎 icons — Travis A/B/D).
    if new_fail == 0:
        if backlog == 0:
            return f"Success: ({passed}/{targeted})", "green"
        return f"Success: ({passed}/{targeted}){carried}", "green"

    # ── 0% pass WITH real failures (RED) — the bench case ────────────────────
    # Label it as the failure it is; the per-bucket breakdown lives in `inspect`.
    if passed == 0:
        return f"Fail: 0% pass (0/{targeted})", "red"

    # ── mixed (no highlight) — spell out "new failures", drop the ✗ glyph ────
    return f"{pct}% pass ({passed}/{targeted}) · {new_fail} new failures{carried}", ""


def _hyperlink(label, path, width):
    """label left-padded to `width`, wrapped as an OSC-8 file:// hyperlink on a TTY."""
    padded = label.ljust(width)
    if not sys.stdout.isatty():
        return padded
    uri = path.resolve().as_uri()
    return f"\033]8;;{uri}\033\\{padded}\033]8;;\033\\"


RUNS_WINDOW_H = 72  # how far back the recent-runs table reaches


def _collect_recent_runs(window_h=RUNS_WINDOW_H):
    """All qa runs started within `window_h` hours, newest first. One row dict each."""
    now = time.time()
    rows = []
    for d in OUTPUT_ROOT.glob("run-*"):
        if not d.is_dir():
            continue
        params = d / "run-params.json"
        if not params.exists():
            continue  # qa runs only (manual single-flow runs don't write params)
        try:
            p = json.loads(params.read_text())
        except Exception:
            continue
        started = convert_iso_timestamp(p.get("startedAt"))
        if not started or (now - started) > window_h * 3600:
            continue
        m = _summary_meta(d)
        fin = convert_iso_timestamp(m.get("finishedAt")) if m else None
        runtime = f"{(fin - started) / 3600:.2f}" if fin else "—"
        layers = p.get("layers") or []
        is_e2e = "e2e" in layers
        if is_e2e:
            # Prefer the stable device NAME (AVD name / iOS device name) the run recorded —
            # the adb serial (deviceId, e.g. emulator-5556) is reused across back-to-back
            # bench sims, so labelling by it collapses every android run to one alias. Fall
            # back to --sim, then the serial, for pre-change runs that lack a name.
            dev_key = p.get("deviceName") or p.get("sim") or p.get("deviceId")
            driver, osv = _device_label(dev_key)
            plat = {"ios": "iOS", "android": "Android", "web": "Web"}.get(
                p.get("platform"), (p.get("platform") or "—").capitalize())
            platform = f"{plat} / {osv}" if osv else plat
        else:
            # Headless runs are host-side HTTP tests — no device, no platform. Don't claim one
            # (the old code showed a phantom "iOS" with a "—" driver).
            driver, platform = "—", "—"
        # Flavor = layers + selection scope, so 'e2e' alone vs the full sweep are distinguishable
        # (Travis F). Scope mirrors qa.ts: smoke tag → smoke; no tags+no areas → all; else the
        # explicit tags/areas.
        ptags, pareas = p.get("tags") or [], p.get("areas") or []
        if "smoke" in ptags:
            scope = "smoke"
        elif not ptags and not pareas:
            scope = "all"
        else:
            scope = ",".join(pareas or ptags)
        layer_s = "+".join(layers)
        flavor = f"{layer_s}/{scope}" if layer_s else "—"
        label, rstyle = _run_result(d)
        rows.append({
            "dir": d, "driver": driver or "—", "platform": platform,
            "started": _fmt_started(started), "started_epoch": started,
            "runtime": runtime, "flavor": flavor,
            "result": label, "result_style": rstyle,
        })
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


def cmd_status(as_json):
    now = time.time()
    procs = ps_snapshot()
    hb = read_heartbeat(procs)
    test_procs = find_test_processes(procs)

    runs = []
    if hb and (hb["runnerAlive"] or hb["abandoned"]):
        started = convert_iso_timestamp(hb.get("startedAt"))
        run = {
            "runId": hb.get("runId"),
            "state": hb.get("state"),
            "abandoned": hb["abandoned"],
            "invoker": None,
            "totalElapsedS": (now - started) if started else None,
            "completed": hb.get("completed"),
            "totalJobs": hb.get("totalJobs"),
            "active": [],
        }
        if hb.get("pid") in procs:
            run["invoker"], _ = invoker_chain(hb["pid"], procs)
        for job in hb.get("active") or []:
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
            run["active"].append(entry)
        runs.append(run)

    # Ad-hoc maestro CLI / MCP flows that the qa heartbeat knows nothing about.
    adhoc_step = None
    if any(p["kind"] in ("maestro-cli", "maestro-mcp") for p in test_procs) and not runs:
        step, t0, log = latest_maestro_step(
            [REPO / "tmp" / "maestro", Path.home() / ".maestro" / "tests"], max_age_s=1800)
        if step:
            adhoc_step = {"step": step, "stepElapsedS": now - t0 if t0 else None, "log": log}

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

    # A lingering maestro MCP server is not "a test running" — don't let it suppress the
    # idle view + recent-runs table (it's the common leftover state).
    non_mcp_procs = [p for p in test_procs if p["kind"] != "maestro-mcp"]
    if not runs and not non_mcp_procs:
        print("✅  No tests in progress.")
        if payload["panicMarker"]:
            print("⚠️   Stale PANIC marker present (tests/PANIC) — qa clears it on next start.")
        _recent_runs_table()
        return 0

    for run in runs:
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
    if adhoc_step:
        print(f"▶   Ad-hoc maestro flow step: {adhoc_step['step']} "
              f"({interval_into_string(adhoc_step['stepElapsedS'])} in step)\n    log: {adhoc_step['log']}")
    if payload["processes"]:
        print("\nTest processes:")
        for p in payload["processes"]:
            chain = f" [{p['invokerChain']}]" if p["invokerChain"] else ""
            print(f"  {p['pid']:>7}  {p['kind']:<16} invoker={p['invoker']:<7}{chain} "
                  f"up {interval_into_string(p['elapsedS'])}")
    if payload["panicMarker"]:
        print("\n⚠️   PANIC marker present (tests/PANIC).")
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


def expand_targets(spec):
    raw = [t.strip().lower() for t in spec.split(",") if t.strip()]
    out = []
    for t in raw:
        for x in NUKE_ALIASES.get(t, [t]):
            for y in NUKE_ALIASES.get(x, [x]):  # headless inside all
                if y not in out:
                    out.append(y)
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


def cmd_nuke(spec, as_json):
    targets, unknown = expand_targets(spec)
    procs = ps_snapshot()
    test_procs = find_test_processes(procs)
    actions = []
    killed_kinds = []

    if "qa" in targets:
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

    if "mcp" in targets:
        mcp_pids = [p["pid"] for p in test_procs if p["kind"] == "maestro-mcp"]
        # MCP-owned XCUITest drivers go too — orphaned drivers are exactly what
        # holds the simulator/port and wedges later CLI runs.
        owned = [p["pid"] for p in test_procs if p["kind"] == "xcuitest-driver"
                 and any(a["pid"] in mcp_pids for a in ancestors(p["pid"], procs))]
        if mcp_pids or owned:
            signal_ladder(mcp_pids + owned, actions)
            killed_kinds.append("maestro-mcp")

    plain = {"cli": "maestro-cli", "xcodebuild": "xcuitest-driver",
             "vitest": "vitest", "newman": "newman", "playwright": "playwright"}
    for t, kind in plain.items():
        if t in targets:
            pids = [p["pid"] for p in test_procs if p["kind"] == kind]
            if pids:
                signal_ladder(pids, actions)
                killed_kinds.append(kind)

    payload = {"targets": targets, "unknownTargets": unknown, "actions": actions}
    if as_json:
        print(json.dumps(payload, indent=2))
    else:
        if unknown:
            print(f"⚠️   Unknown nuke target(s) ignored: {', '.join(unknown)}")
        if not actions:
            print(f"✅  Nothing to nuke for: {', '.join(targets) or spec}")
        for a in actions:
            if "method" in a:
                print(f"📍  wrote {a['method']} → {a['path']}")
            else:
                err = f"  ({a['error']})" if "error" in a else ""
                print(f"🛑  {a['signal']} → pid {a['pid']}{err}")
        if "qa-runner" in killed_kinds:
            print("ℹ️   Remove is not needed: qa clears the PANIC marker on next start.")
    return 0


# ── health ────────────────────────────────────────────────────────────────────

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


def check_api():
    v4 = tcp_open("127.0.0.1", API_PORT)
    v6 = tcp_open("::1", API_PORT)
    if not v4 and not v6:
        return {"name": "api-server", "status": "fail",
                "detail": f"DOWN — nothing listening on port {API_PORT} (v4 or v6)",
                "fix": "start it: `npm run qa:server` (serves bubble_test; plain dev server breaks seeded logins)"}
    code, body = http_get(f"http://127.0.0.1:{API_PORT}/api/v1/health", timeout=8)
    if code is None:
        return {"name": "api-server", "status": "fail",
                "detail": f"HUNG — port {API_PORT} accepts connections but /api/v1/health gave no HTTP response ({body})",
                "fix": f"kill listener (pid {api_listener_pid()}) and restart: `npm run qa:server`"}
    note = ""
    if v4 != v6:
        which = "IPv4-only" if v4 else "IPv6-only"
        note = f"; ⚠ {which} listener — localhost may resolve to the other family (qa:server binds dual-stack via API_BIND_HOST=::)"
    try:
        health = json.loads(body)
        return {"name": "api-server", "status": "ok" if code == 200 else "warn",
                "detail": f"/api/v1/health → {code}, status={health.get('status')}, "
                          f"db={health.get('services', {}).get('database', {}).get('status')}{note}"}
    except json.JSONDecodeError:
        return {"name": "api-server", "status": "warn",
                "detail": f"/api/v1/health → {code} (non-JSON body){note}"}


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
                "fix": "start it: `npm run mobile:start` (or metro_bundler). If watchman EPERM after a brew upgrade: `watchman shutdown-server`"}
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


def cmd_health(as_json):
    checks = [check_load(), check_api(), check_qa_server_identity(), check_metro(),
              check_sim_binary(), check_sim_age()]
    ok = all(c["status"] == "ok" for c in checks)
    if as_json:
        print(json.dumps({"ok": ok, "checks": checks}, indent=2))
    else:
        icons = {"ok": "✅", "warn": "⚠️ ", "fail": "❌"}
        for c in checks:
            print(f"{icons[c['status']]}  {c['name']}: {c['detail']}")
            if c.get("fix"):
                print(f"      ↳ {c['fix']}")
    return 0 if ok else 1


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


def cmd_driver_health(as_json):
    c = check_driver_health()
    if as_json:
        print(json.dumps(c, indent=2))
    else:
        icons = {"ok": "✅", "warn": "⚠️ ", "fail": "❌"}
        print(f"{icons[c['status']]}  {c['name']}: {c['detail']}")
        if c.get("fix"):
            print(f"      ↳ {c['fix']}")
    return 1 if c["status"] == "fail" else 0


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


def find_run_dir(arg):
    """Resolve the run directory: explicit arg (file → its dir, artifact subdir →
    run root) or the heartbeat's current run, else the newest run-* dir."""
    if arg:
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
    hb = read_heartbeat(ps_snapshot())
    if hb and hb.get("runnerAlive") and hb.get("runDir") and Path(hb["runDir"]).is_dir():
        return Path(hb["runDir"])
    runs = sorted((d for d in OUTPUT_ROOT.glob("run-*") if d.is_dir()),
                  key=lambda d: d.stat().st_mtime, reverse=True)
    for d in runs:
        if (d / "summary.json").exists():
            return d
    if runs:
        return runs[0]
    raise SystemExit(f"error: no run directories under {OUTPUT_ROOT}")


def load_run(run_dir):
    """Return {dir, params, gates, summary, entries:[Entry], live:bool}."""
    info = {"dir": run_dir, "params": {}, "gates": [], "summary": None, "entries": [], "live": False}
    try:
        info["params"] = json.loads((run_dir / "run-params.json").read_text())
    except (OSError, json.JSONDecodeError):
        pass
    try:
        s = json.loads((run_dir / "summary.json").read_text())
        info["summary"] = s
        info["gates"] = s.get("gates") or []
        for r in s.get("results", []):
            e = Entry(**r)
            # Artifact dirs are stored absolute; survive a moved/renamed checkout.
            if not e.artifacts.is_dir():
                guess = run_dir / e.layer / (f"{e.id}-{e.role}" if e.role else e.id)
                if guess.is_dir():
                    e.artifacts = guess
            info["entries"].append(e)
        return info
    except (OSError, json.JSONDecodeError):
        pass
    # No summary yet: in-progress or manual run — synthesize entries from disk.
    info["live"] = True
    for layer in ("e2e", "headless"):
        base = run_dir / layer
        if not base.is_dir():
            continue
        for d in sorted(p for p in base.iterdir() if p.is_dir()):
            leaf = d.name
            role = next((r for r in ROLES if leaf.endswith("-" + r)), None)
            tid = leaf[: -len(role) - 1] if role else leaf
            tool = "maestro" if layer == "e2e" else (
                "newman" if list(d.glob("*postman_collection*")) else "vitest")
            status = "?"
            for log in list(d.glob("high-level-*.log")) + list(d.glob("run.log")):
                try:
                    txt = log.read_text(errors="replace")
                    if " FAILED" in txt or "(exit 1)" in txt or "(exit 2)" in txt:
                        status = "fail"
                    elif "(exit 0)" in txt:
                        status = "pass"
                except OSError:
                    pass
            info["entries"].append(Entry(id=tid, role=role, tool=tool, layer=layer,
                                         status=status, artifactsDir=str(d),
                                         message="(no summary.json — run in progress or aborted)"))
    if not info["entries"] and run_dir.name.startswith("run-manual-"):
        info["entries"].append(Entry(id=run_dir.name[len("run-manual-"):], role=None,
                                     tool="maestro", layer="e2e", status="?",
                                     artifactsDir=str(run_dir), message="(manual qa:flow run)"))
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


def parse_test_spec(spec, entries):
    """Parse a forgiving test spec against the run's entries.
    Returns (entry, None) or (None, 'reason it was rejected')."""
    text = spec.strip().lower()
    text = re.sub(r"[✅❌🐞🔎⚠️❔]", " ", text)
    text = re.sub(r"[\[\](),=]", " ", text)
    text = re.sub(r"\b\d+\.\d+s\b", " ", text)       # durations like 51.9740s
    text = re.sub(r"\s+", " ", text).strip()

    # Test id: scan (prefix, number) pairs, match against ids present in the run.
    by_id = {}
    for e in entries:
        by_id.setdefault(e.id, []).append(e)
    tid = None
    id_spans = []
    for m in ID_PAIR_RE.finditer(text):
        prefix = re.sub(r"[\s_]+", "-", m.group(1))
        if prefix in ("uc", "role"):
            continue
        num = int(m.group(2))
        for known in by_id:
            km = re.match(r"(.+)-0*(\d+)$", known)
            if km and km.group(1) == prefix and int(km.group(2)) == num:
                tid = known
                id_spans.append(m.span())
                break
        if tid:
            break

    # Role: explicit role-… first; bare form only outside any matched id span
    # (so "bubble-admin-0600" alone doesn't read as role=bubble-admin).
    role = None
    m = ROLE_EXPLICIT_RE.search(text)
    if m:
        role = canon_role(m.group(1))
    else:
        bare = text
        for a, b in sorted(id_spans, reverse=True):
            bare = bare[:a] + " " * (b - a) + bare[b:]
        m = ROLE_BARE_RE.search(bare)
        if m:
            role = canon_role(m.group(1))

    # UC alias: only if no test id was recognized.
    if tid is None:
        m = UC_RE.search(text)
        if m:
            uc = m.group(1)
            uc_ids = sorted({e.id for e in entries
                             if re.search(rf"\buc\s*0*{uc}\b", e.reason, re.I)})
            if not uc_ids:
                return None, f"No test in this run mentions UC {uc}"
            if len(uc_ids) > 1:
                return None, f"UC {uc} is ambiguous here — tests: {', '.join(uc_ids)}"
            tid = uc_ids[0]

    if tid is None:
        return None, f"Could not find a test name in {spec!r} for this run"

    cands = by_id[tid]
    roles_present = [e.role for e in cands if e.role]
    if role:
        for e in cands:
            if e.role == role:
                return e, None
        if not roles_present:
            return None, f"Test {tid} runs without a role"
        if len(roles_present) == 1:
            return None, f"Test {tid} only runs with role {short_role(roles_present[0])}"
        return None, (f"Test {tid} did not run with role {short_role(role)} here; "
                      f"roles: {', '.join(short_role(r) for r in roles_present)}")
    if len(cands) == 1:
        return cands[0], None
    return None, (f"Test {tid} runs with multiple roles: "
                  + ", ".join(short_role(r) for r in roles_present))


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

def get_failure_text(e):
    """The failing step + context, per runner. Returns text or None."""
    if e.tool == "maestro":
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
    if e.tool == "vitest":
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
                    out.append(f"✗ {a.get('fullName', a.get('title', '?'))}")
                    for msg in a.get("failureMessages") or []:
                        out.append("  " + "\n  ".join(msg.splitlines()[:25]))
        return "\n".join(out) or None
    if e.tool == "newman":
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
    return None


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


def cmd_show_code(e, run):
    if e.tool == "maestro":
        files = flow_files(e)
        if not files:
            src = find_source_by_qa_id(e.id, e.layer)
            files = [src] if src else []
    else:
        f = first_glob(e.artifacts, "*.headless.test.ts", "*postman_collection*.json")
        files = [f] if f else []
        if not files:
            src = find_source_by_qa_id(e.id, e.layer)
            files = [src] if src else []
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
        hits = [r for r in rows[1:] if len(r) > uc_col and r[uc_col].strip() == uc]
        if not hits:
            print(f"  UC {uc}: not found in {USE_CASES_TSV.name}")
            continue
        for r in hits:
            print(f"\nUC {uc}:")
            for i, h in enumerate(header):
                v = r[i].strip() if i < len(r) else ""
                # The recorded manual-testing status is stale/untrustworthy; the use-case
                # command is slated for rework (deferred). Stub it rather than mislead.
                if "Manual testing status" in h:
                    v = "FIXME - future work"
                if v and h.strip():
                    print(f"  {h.strip():<28} {v}")


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
    envname = params.get("env", "local")
    platform = params.get("platform", "ios")
    device_id = params.get("deviceId")
    if e.tool == "maestro":
        if flow_override is not None:
            rel = flow_override.relative_to(REPO) \
                if str(flow_override).startswith(str(REPO)) else flow_override
        else:
            src = find_source_by_qa_id(e.id, e.layer)
            rel = src.relative_to(REPO) if src else f"tests/e2e/<flow for {e.id}>.yaml"
        cmd = f"npm run qa:flow -- {rel}"
        if e.role:
            cmd += f" --role {e.role}"
        if envname != "local":
            cmd += f" --env {envname}"
        # Preserve the run's platform (qa:flow defaults to iOS) and pin the device by a
        # RESOLVABLE token. Without this, an android run re-ran on iOS — the core bug.
        if platform != "ios":
            cmd += f" --platform {platform}"
        if platform != "web":
            tok = _sim_token(device_id, platform)
            if tok:
                cmd += f" --device {tok}"
            # Debug re-runs (cmd/movie/noisy) must have a visible screen.
            # A headless sim yields BLACK screenshots/recordings, defeating the whole point.
            # when `--require-screen` is present, then "qa" and "qa:flow" refuse to run on a headless device.
            if require_screen:
                cmd += " --require-screen"
        return cmd
    base = params.get("apiBaseUrl", f"http://localhost:{API_PORT}")
    if e.tool == "vitest":
        src = find_source_by_qa_id(e.id, e.layer)
        rel = src.relative_to(REPO) if src else f"tests/headless/<test for {e.id}>.ts"
        return (f"QA_BASE_URL={base} npx vitest run "
                f"--config tests/headless/vitest.headless.config.ts {rel}")
    src = find_source_by_qa_id(e.id, e.layer)
    rel = src.relative_to(REPO) if src else "tests/headless/contract/contract-smoke.postman_collection.json"
    return f"npx newman run {rel} --env-var baseUrl={base} --reporters cli"


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


def cmd_show_params(e, run):
    p = run["params"]
    platform = p.get("platform", "ios")
    device_id = p.get("deviceId")
    src = find_source_by_qa_id(e.id, e.layer)
    print(f"  test     : {e.id}" + (f" [{e.role}]" if e.role else ""))
    print(f"  runner   : {e.tool} (layer {e.layer})")
    print(f"  status   : {e.status}" + (f"  ({(e.duration_ms or 0) / 1000:.4f}s)" if e.duration_ms else ""))
    begin, end, fail = _maestro_log_times(e.artifacts)
    if begin or end:
        end_label = f"{end}" + ("   ⟵ error" if fail and fail == end else "")
        print(f"  begin    : {begin or '?'}")
        print(f"  end      : {end_label or '?'}")
        if fail and fail != end:
            print(f"  error at : {fail}")
    if e.tags:
        # Flows are iOS-authored, so an 'ios'/'android' tag is about the flow's origin,
        # NOT the platform this run executed on. Call it out to avoid the classic trap.
        note = ""
        if platform != "ios" and "ios" in e.tags:
            note = f"   (⚠ 'ios' is a flow-authoring tag — this run was {platform})"
        elif platform == "ios" and "android" in e.tags:
            note = "   (⚠ 'android' is a flow-authoring tag — this run was ios)"
        print(f"  tags     : {', '.join(e.tags)}{note}")
    if e.reason:
        print(f"  reason   : {e.reason}")
    if e.tool == "maestro":
        print(f"  flow     : {src.relative_to(REPO) if src else '(source not found by qa-id)'}")
    print("  ── how this was run ──────────────────────────────")
    print(f"  platform : {platform}")
    if platform != "web":
        aliases = _device_aliases(device_id)
        hl = "   [likely headless — black screen on this host]" if _looks_headless(device_id, platform) else ""
        print(f"  device   : {' / '.join(aliases) if aliases else '(unknown)'}{hl}")
    print(f"  env      : {p.get('env', 'local')}    api: {p.get('apiBaseUrl', '?')}    db: {p.get('dbClassification', '?')}")
    print(f"  command  : {build_run_cmd(e, run)}")
    load_gate = next((g for g in run["gates"] if g.get("name") == "load-average"), None)
    if load_gate:
        print(f"  load     : {load_gate.get('message')}")
    # Run-level provenance, compact — no 138-id selectedTestIds dump (the old noise).
    scope = []
    if p.get("roles"):
        scope.append(f"{len(p['roles'])} roles")
    if p.get("layers"):
        scope.append("+".join(p["layers"]))
    if p.get("selectedTestIds"):
        scope.append(f"{len(p['selectedTestIds'])} tests selected")
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


def fill_template(template_name, e, run, interactive):
    tpl_path = SCRIPTS_DIR / template_name
    try:
        tpl = _string.Template(tpl_path.read_text())
    except OSError:
        print(f"  ⚠️  template missing: {tpl_path}")
        return None
    params = run["params"]
    platform = params.get("platform", "ios")
    target = ("an iOS simulator" if e.layer == "e2e" and platform == "ios"
              else "a desktop web browser" if e.layer == "e2e"
              else "the API over HTTP (headless)")
    logs = sorted(str(p.relative_to(run["dir"])) for p in e.artifacts.glob("*")
                  if p.suffix in (".log", ".json", ".html"))
    code = ""
    files = flow_files(e) if e.tool == "maestro" else \
        [f for f in [first_glob(e.artifacts, "*.headless.test.ts", "*postman_collection*.json")] if f]
    for f in files[:1]:
        try:
            code = f.read_text(errors="replace")
        except OSError:
            pass
    values = {
        "test_id": e.id,
        "role": short_role(e.role) or "n/a",
        "layer": e.layer,
        "target": target,
        "failing_step": get_failure_text(e) or "(no failing step captured — test may have passed)",
        "test_script": code or "(test source not found)",
        "run_cmd": build_run_cmd(e, run),
        "runner_version": runner_version(e.tool),
        "parameters": json.dumps({k: v for k, v in params.items() if k != "selectedTestIds"}),
        "artifacts_dir": str(e.artifacts),
        "log_files": "\n".join(f"  - {l}" for l in logs) or "  (none)",
        "run_id": params.get("startedAt", run["dir"].name),
        "git_sha": params.get("gitSha", "unknown"),
        "reason": e.reason or "(none)",
        "use_cases": ", ".join(f"UC {u}" for u in use_case_numbers(e)) or "(none)",
    }
    # Tiny wizard: any $placeholder the script can't answer gets asked, with a default.
    for key in sorted(set(re.findall(r"\$\{?(\w+)\}?", tpl.template)) - set(values)):
        default = "(unknown)"
        if interactive:
            ans = input(f"  {key.replace('_', ' ')} [{default}]: ").strip()
            values[key] = ans or default
        else:
            values[key] = default
    return tpl.safe_substitute(values)


def cmd_create_prompt(e, run):
    text = fill_template("_testctl_prompt_template.md", e, run, sys.stdin.isatty())
    if text is None:
        return
    leaf = f"{e.id}-{short_role(e.role)}" if e.role else e.id
    out = e.artifacts / f"prompt-{leaf}-{datetime.now().strftime('%Y%m%dt%H%M%S')}.md"
    out.write_text(text)
    print(f"  📝 wrote {out}")
    if clipboard_copy(str(out)):
        print("  📋 path copied to the clipboard")


def cmd_create_trello(e, run):
    text = fill_template("_testctl_trello_template.md", e, run, sys.stdin.isatty())
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


def _parse_runflow(body):
    """For a `runFlow` block, return (file_path_or_None, {env KEY: VALUE})."""
    file_path, env, env_indent = None, {}, None
    for line in body:
        m = re.match(r"^\s+file:\s*(.+?)\s*$", line)
        if m:
            file_path = m.group(1).strip().strip("\"'")
    for line in body:
        if env_indent is None:
            m = re.match(r"^(\s+)env:\s*$", line)
            if m:
                env_indent = len(m.group(1))
            continue
        if line.strip() == "":
            continue
        indent = len(line) - len(line.lstrip())
        if indent > env_indent:
            mm = re.match(r"^\s+([A-Za-z_]\w*):\s*(.*?)\s*$", line)
            if mm:
                env[mm.group(1)] = mm.group(2).strip().strip("\"'")
        else:
            break  # dedent ends the env block
    return file_path, env


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
        if blk["cmd"] == "runFlow":
            sub_file, sub_env = _parse_runflow(blk["body"])
            if sub_file:
                sub_path = (path.parent / sub_file).resolve()
                rel = sub_path.relative_to(REPO) if str(sub_path).startswith(str(REPO)) else sub_path
                includes.append(rel)
                # Map the child's incoming env values through our own substitution first.
                child_env = {k: _subst_env(v, env_map) for k, v in sub_env.items()}
                out.append({"leading": blk["leading"] + [f"# ── begin include: {rel} ──"],
                            "body": [], "cmd": None})
                out += flatten_flow(sub_path, child_env, seen, includes, depth + 1)
                out.append({"leading": [f"# ── end include: {rel} ──"], "body": [], "cmd": None})
                continue
        out.append(blk)
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
        n = norm_input(raw)
        if n in ("q", "quit", "exit"):
            return "quit"
        if n in ("t", "tests", "back", "b"):
            return "back"
        if n in ("h", "help", "menu") or raw.strip() == "?":
            print_command_menu()
            continue
        if n in ("c", "config", "configure"):
            try:
                cmd_configure(e, run)
            except (KeyboardInterrupt, EOFError):
                print("\n  (canceled)")
            continue
        base, verbose = split_verbose(raw)
        cmd = match_command(base)
        if cmd is None:
            print(f"  ❓ unknown command {raw!r} — type 'h' for the menu")
            continue
        try:
            dispatch_command(cmd, e, run, verbose)
        except (KeyboardInterrupt, EOFError):
            print("\n  (canceled)")
        except Exception as err:  # an inspector command must never kill the session
            print(f"  ⚠️  {cmd[0]} failed: {err}")


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


def run_menu_loop(run, mode="fails", from_recent=False):
    """RUN level: list a run's tests (filtered), drill into one. Returns 'quit' or,
    when from_recent, 'back' to return to the run list."""
    entries = run["entries"]
    while True:
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
            return "quit"
        if not raw:
            continue
        n = norm_input(raw)
        if n in ("q", "quit", "exit"):
            return "quit"
        if n in ("all", "a"):
            mode = "all"; continue
        if n in ("fails", "f", "failing", "failed"):
            mode = "fails"; continue
        if n in ("passes", "p", "passing", "passed"):
            mode = "passes"; continue
        if from_recent and n in ("runs", "recent", "r", "back", "b"):
            return "back"
        if n.isdigit():
            idx = int(n)
            if not (1 <= idx <= len(entries)):
                print(f"  no test #{idx} (this run has {len(entries)})")
                continue
            sel = entries[idx - 1]
        else:
            sel, perr = parse_test_spec(raw, entries)
            if perr:
                print(f"🔴🥺 {perr}")
                continue
        if inspect_command_loop(sel, run) == "quit":
            return "quit"


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


def cmd_inspect(spec_args, one_cmd, as_json):
    try:
        import readline  # noqa: F401 — line editing + history for input()
    except ImportError:
        pass

    # Split positionals: a path (or anything with a "/") is the run dir; the rest are
    # words — keywords (recent/all/last/fails/passes) and/or numbers (test #, item #).
    run_arg, words = None, []
    for a in spec_args or []:
        if run_arg is None and ("/" in a or Path(a).expanduser().exists()):
            run_arg = a
        else:
            words.append(a)
    first = words[0].lower() if words else ""
    interactive = sys.stdin.isatty()

    # `inspect recent` → browse ALL runs in the window, then drill in.
    if first in ("recent", "runs"):
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

    run = load_run(find_run_dir(run_arg))
    entries = run["entries"]
    if not entries:
        print(f"No test artifacts found in {run['dir']}")
        return 1
    failing = [e for e in entries if e.failing]

    if as_json:
        print(json.dumps({
            "runDir": str(run["dir"]), "live": run["live"],
            "failing": [{"id": e.id, "role": e.role, "tool": e.tool, "status": e.status,
                         "reason": e.reason, "artifactsDir": str(e.artifacts)} for e in failing],
            "total": len(entries),
        }, indent=2))
        return 0

    state = "in progress / no summary" if run["live"] else "finished"
    print(f"Run {run['dir'].name}  ({state}; {len(failing)} failing of {len(entries)})")

    # Parse word args. Pure-number args are canonical indices (test #, then item #);
    # anything with a non-keyword word is a forgiving spec ("auth 100, site admin").
    kws = [w.lower() for w in words]
    mode = _mode_from_kws(kws)
    leftover = [w for w in words if w.lower() not in RECOGNIZED_KW]
    selected, item = None, None
    if leftover and all(w.isdigit() for w in leftover):
        idx = int(leftover[0])
        if not (1 <= idx <= len(entries)):
            print(f"🔴🥺 no test #{idx} (this run has {len(entries)})")
            return 2
        selected = entries[idx - 1]
        item = leftover[1] if len(leftover) > 1 else None
    elif leftover:
        selected, err = parse_test_spec(" ".join(leftover), entries)
        if err:
            print(f"🔴🥺 {err}")
            if one_cmd or not interactive:
                return 2

    # A menu item on the command line (the B in `inspect N B`) or --cmd runs at once.
    run_item = item or one_cmd
    if selected and run_item:
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
        if not interactive:
            return 0

    if not interactive:
        shown = print_test_menu(entries, mode)
        if not shown:
            print("  (none)")
        print("\n(no tty — `inspect <N>` then a menu number, or --cmd <command>, runs one step)")
        return 0

    # Interactive: a chosen test drops into its menu; 'back' falls through to the run
    # menu, so the whole run stays navigable from a deep-link.
    if selected:
        if inspect_command_loop(selected, run) == "quit":
            return 0
    run_menu_loop(run, mode=mode)
    return 0


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="status / nuke / health for the Bubble test platform")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    sub = ap.add_subparsers(dest="command", required=True)
    # --json is accepted both before and after the subcommand.
    p_status = sub.add_parser("status", help="show tests in progress")
    p_nuke = sub.add_parser("nuke", help="stop test runners")
    p_nuke.add_argument("targets", nargs="?", metavar="LIST",
                        help="comma list: qa,cli,mcp,xcodebuild,headless,playwright,maestro,all|them-all")
    p_nuke.add_argument("--nuke", metavar="LIST",
                        help="same as the positional LIST (kept for npm qa:nuke compatibility)")
    p_health = sub.add_parser("health", help="diagnose the local test environment")
    p_driver = sub.add_parser("driver-health",
                              help="probe the Maestro Android driver (gRPC deviceInfo if live, else lsof :7001)")
    p_lock = sub.add_parser("lock", help="test-runner mutual-exclusion lock (acquire/release/status)")
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
    for p in (p_status, p_nuke, p_health, p_driver, p_inspect, p_lock):
        p.add_argument("--json", action="store_true", dest="json_sub", help=argparse.SUPPRESS)
    args = ap.parse_args()
    args.json = args.json or args.json_sub

    if args.command == "status":
        return cmd_status(args.json)
    if args.command == "nuke":
        spec = args.nuke or args.targets
        if not spec:
            ap.error("nuke needs targets: `nuke all` or `nuke --nuke=LIST`")
        return cmd_nuke(spec, args.json)
    if args.command == "health":
        return cmd_health(args.json)
    if args.command == "driver-health":
        return cmd_driver_health(args.json)
    if args.command == "lock":
        return cmd_lock(args.action, args)
    if args.command == "inspect":
        return cmd_inspect(args.spec, args.cmd, args.json)
    return 2


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


def cmd_lock(action, args):
    if action == "status":
        rec = _read_lock()
        if args.json:
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
    if action == "release":
        gfd = os.open(str(LOCK_GUARD), os.O_CREAT | os.O_RDWR, 0o644)
        try:
            fcntl.flock(gfd, fcntl.LOCK_EX)
            rec = _read_lock()
            if rec and rec.get("pid") == args.pid:
                try:
                    LOCK_FILE.unlink()
                except OSError:
                    pass
                print(f"🔓 lock released (pid {args.pid})", file=sys.stderr)
            elif rec:
                print(f"lock NOT released — owned by pid {rec.get('pid')}, not {args.pid}", file=sys.stderr)
            return 0
        finally:
            fcntl.flock(gfd, fcntl.LOCK_UN)
            os.close(gfd)
    if action == "acquire":
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
    return 2


if __name__ == "__main__":
    sys.exit(main())
