#!/usr/bin/env python3
"""
testctl — status / nuke / health for the Bubble test platform.

One tool callable by every entity that pokes at tests: Claude Code, shell
health scripts, humans, and the test scripts themselves.

  testctl.py status            what is running right now (test, step, runner, invoker, timings)
  testctl.py nuke LIST         stop test runners (known method first, else SIGQUIT → 2s → SIGKILL)
  testctl.py health            diagnose the local test environment
  testctl.py inspect [TEST] [RUN_DIR]   interactive failure inspector for a run's artifacts
  testctl.py --json <cmd>      machine-readable output for any command

Inspect: with no RUN_DIR it uses the current run (heartbeat) or the newest
tests/output/run-*; with no TEST it menus the failing tests. TEST parsing is
forgiving ("auth 100, site admin", a pasted summary line, "uc-182", …).
Inside, a typed/numbered command menu: failure, code, use case, images,
run cmd, movie, params, dir, prompt, trello draft, internal log, configure.
`--cmd <name>` runs a single command non-interactively.

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
import json
import os
import plistlib
import re
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

API_PORT = int(os.environ.get("API_PORT", "3000"))
METRO_PORT = int(os.environ.get("METRO_PORT", "8081"))
APP_ID = os.environ.get("QA_APP_ID", "com.bubble.mobile")
LOAD_CEILING = float(os.environ.get("QA_LOAD_CEILING", "75"))

# ── small utils ───────────────────────────────────────────────────────────────

def humanize(seconds):
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


def parse_etime(etime):
    """ps etime: [[dd-]hh:]mm:ss → seconds."""
    days = 0
    if "-" in etime:
        d, etime = etime.split("-", 1)
        days = int(d)
    parts = [int(p) for p in etime.split(":")]
    while len(parts) < 3:
        parts.insert(0, 0)
    h, m, s = parts
    return days * 86400 + h * 3600 + m * 60 + s


def parse_iso(ts):
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
            "etime_s": parse_etime(m.group(4)),
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


def _fmt_started(epoch):
    if not epoch:
        return "—"
    dt = datetime.fromtimestamp(epoch)
    today = datetime.now().date()
    delta_days = (today - dt.date()).days
    when = {0: "today", 1: "yesterday"}.get(delta_days, dt.strftime("%b %-d"))
    return f"{when} {dt.strftime('%-I:%M%p').lower()}"


def _run_result(run_dir):
    """High-level verdict string from summary.json, or a state if it never finished."""
    sm = run_dir / "summary.json"
    if not sm.exists():
        return "INCOMPLETE (no summary — crashed/killed?)"
    try:
        d = json.loads(sm.read_text())
    except Exception:
        return "INCOMPLETE (unreadable summary)"
    if d.get("canceled"):
        return f"CANCELED: {d.get('cancelReason', 'gating')}"
    t = d.get("totals") or {}
    total, passed, failed = t.get("total", 0), t.get("passed", 0), t.get("failed", 0)
    findings = t.get("findings", 0)
    verdict = "FAIL" if failed else "PASS"
    extra = f" · {findings}🔎" if findings else ""
    return f"{verdict} · {passed}/{total} pass · {failed}✗{extra}"


def _hyperlink(label, path, width):
    """label left-padded to `width`, wrapped as an OSC-8 file:// hyperlink on a TTY."""
    padded = label.ljust(width)
    if not sys.stdout.isatty():
        return padded
    uri = path.resolve().as_uri()
    return f"\033]8;;{uri}\033\\{padded}\033]8;;\033\\"


def _recent_runs_table(limit=5, window_h=24):
    """Table of the last `limit` qa runs started within `window_h` hours. Each row's
    driver cell is a clickable link to that run's artifact directory."""
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
        started = parse_iso(p.get("startedAt"))
        if not started or (now - started) > window_h * 3600:
            continue
        driver, osv = _device_label(p.get("deviceId"))
        plat = {"ios": "iOS", "android": "Android", "web": "Web"}.get(
            p.get("platform"), (p.get("platform") or "—").capitalize())
        platform = f"{plat} / {osv}" if osv else plat
        flavor = "+".join(p.get("layers") or []) or "—"
        rows.append({
            "dir": d, "driver": driver or "—", "platform": platform,
            "started": _fmt_started(started), "started_epoch": started,
            "flavor": flavor, "result": _run_result(d),
        })
    rows.sort(key=lambda r: r["started_epoch"], reverse=True)
    rows = rows[:limit]
    if not rows:
        return

    cols = [("driver", "DRIVER"), ("platform", "PLATFORM"),
            ("started", "STARTED"), ("flavor", "FLAVOR"), ("result", "RESULT")]
    widths = {k: len(h) for k, h in cols}
    for r in rows:
        for k, _ in cols:
            widths[k] = max(widths[k], len(str(r[k])))

    print(f"\nLast {len(rows)} qa run(s) in the past {window_h}h "
          f"(driver = clickable link to artifacts):")
    header = "  ".join(h.ljust(widths[k]) for k, h in cols)
    print("  " + header)
    print("  " + "  ".join("-" * widths[k] for k, _ in cols))
    for r in rows:
        driver_cell = _hyperlink(str(r["driver"]), r["dir"], widths["driver"])
        rest = "  ".join(str(r[k]).ljust(widths[k]) for k, _ in cols[1:])
        print("  " + driver_cell + "  " + rest)


def cmd_status(as_json):
    now = time.time()
    procs = ps_snapshot()
    hb = read_heartbeat(procs)
    test_procs = find_test_processes(procs)

    runs = []
    if hb and (hb["runnerAlive"] or hb["abandoned"]):
        started = parse_iso(hb.get("startedAt"))
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
            jstart = parse_iso(job.get("startedAt"))
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
        if test_procs:
            print("✅  No tests in progress (a maestro MCP server is connected but idle).")
        else:
            print("✅  No tests in progress (no qa run, no maestro/vitest/newman/playwright processes).")
        if payload["panicMarker"]:
            print("⚠️   Stale PANIC marker present (tests/PANIC) — qa clears it on next start.")
        _recent_runs_table()
        return 0

    for run in runs:
        if run["abandoned"]:
            print(f"🚨🚨🚨😵🪦🪦  qa run {run['runId']}  state={run['state']}")
        else:
            print(f"🏃  qa run {run['runId']}  state={run['state']}  invoker={run['invoker'] or '?'}")
        print(f"    run elapsed {humanize(run['totalElapsedS'])}, "
              f"jobs {run['completed']}/{run['totalJobs'] if run['totalJobs'] is not None else '?'} done")
        for j in run["active"]:
            role = f"  role={j['role']}" if j.get("role") else ""
            tags = f"  tags=[{', '.join(j['tags'])}]" if j.get("tags") else ""
            print(f"    ▶ {j['test']} ({j['tool']}){role}{tags}  — in test {humanize(j['testElapsedS'])}")
            if j.get("step"):
                print(f"      step: {j['step']}  ({humanize(j['stepElapsedS'])} in step)")
    if adhoc_step:
        print(f"▶   Ad-hoc maestro flow step: {adhoc_step['step']} "
              f"({humanize(adhoc_step['stepElapsedS'])} in step)\n    log: {adhoc_step['log']}")
    if payload["processes"]:
        print("\nTest processes:")
        for p in payload["processes"]:
            chain = f" [{p['invokerChain']}]" if p["invokerChain"] else ""
            print(f"  {p['pid']:>7}  {p['kind']:<16} invoker={p['invoker']:<7}{chain} "
                  f"up {humanize(p['elapsedS'])}")
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
    "mcp": ["maestro-mcp"],
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
                         "bootedAt": parse_iso(d.get("lastBootedAt"))})
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
    age = humanize(time.time() - mtime)
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
                if v and h.strip():
                    print(f"  {h.strip():<28} {v}")


def cmd_show_images(e, run):
    imgs = sorted(list(e.artifacts.glob("*.png")) + list(e.artifacts.glob("*.jpg")))
    if not imgs:
        print("  No screenshots in the artifact directory.")
        return
    open_with("images", imgs)


def build_run_cmd(e, run):
    params = run["params"]
    envname = params.get("env", "local")
    platform = params.get("platform", "ios")
    if e.tool == "maestro":
        src = find_source_by_qa_id(e.id, e.layer)
        rel = src.relative_to(REPO) if src else f"tests/e2e/<flow for {e.id}>.yaml"
        cmd = f"npm run qa:flow -- {rel}"
        if e.role:
            cmd += f" --role {e.role}"
        if envname != "local":
            cmd += f" --env {envname}"
        if platform == "web":
            cmd += " --platform web"
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
    cmd = build_run_cmd(e, run)
    print(f"  {cmd}")
    if clipboard_copy(cmd):
        print("  📋 copied to the clipboard")


def cmd_run_movie(e, run):
    base = build_run_cmd(e, run)
    if e.tool != "maestro":
        print("  Headless test — there is no screen to record; plain re-run command instead:")
        print(f"  {base}")
        if clipboard_copy(base):
            print("  📋 copied to the clipboard")
        return
    stamp = datetime.now().strftime("%Y%m%dt%H%M%S")
    leaf = f"{e.id}-{e.role}" if e.role else e.id
    mov = f"tmp/maestro/movie-{leaf}-{stamp}.mp4"
    cmd = (f"mkdir -p tmp/maestro; "
           f"xcrun simctl io booted recordVideo --codec h264 --force {mov} & REC=$!; "
           f"{base}; kill -INT $REC; wait $REC; echo movie: {mov}")
    print(f"  {cmd}")
    if clipboard_copy(cmd):
        print("  📋 copied to the clipboard")


def cmd_show_params(e, run):
    print(f"  test     : {e.id}" + (f" [{e.role}]" if e.role else ""))
    print(f"  runner   : {e.tool} (layer {e.layer})")
    print(f"  status   : {e.status}" + (f"  ({(e.duration_ms or 0) / 1000:.4f}s)" if e.duration_ms else ""))
    if e.tags:
        print(f"  tags     : {', '.join(e.tags)}")
    if e.reason:
        print(f"  reason   : {e.reason}")
    p = run["params"]
    if p:
        print("  run-params.json:")
        for k, v in p.items():
            if k == "selectedTestIds":
                v = f"[{len(v)} tests]"
            print(f"    {k:<16} {v}")
    load_gate = next((g for g in run["gates"] if g.get("name") == "load-average"), None)
    if load_gate:
        print(f"  load at run time: {load_gate.get('message')}")
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
    text = fill_template("testctl_prompt_template.md", e, run, sys.stdin.isatty())
    if text is None:
        return
    leaf = f"{e.id}-{short_role(e.role)}" if e.role else e.id
    out = e.artifacts / f"prompt-{leaf}-{datetime.now().strftime('%Y%m%dt%H%M%S')}.md"
    out.write_text(text)
    print(f"  📝 wrote {out}")
    if clipboard_copy(str(out)):
        print("  📋 path copied to the clipboard")


def cmd_create_trello(e, run):
    text = fill_template("testctl_trello_template.md", e, run, sys.stdin.isatty())
    if text is None:
        return
    drafts = REPO / "tmp" / "trello-cards"
    drafts.mkdir(parents=True, exist_ok=True)
    leaf = f"{e.id}-{short_role(e.role)}" if e.role else e.id
    out = drafts / f"draft-{leaf}-{datetime.now().strftime('%Y%m%dt%H%M%S')}.md"
    out.write_text(text)
    print(f"  📝 draft written: {out}")
    print("  Review it, then batch-file via the trello workflow (drafts are never auto-filed).")


def cmd_internal_log(e, run):
    log = first_glob(e.artifacts, "internal-maestro-log*.log", "detailed-log--*.json",
                     "vitest-results--*.json", "*.log", "*.json")
    if not log:
        print("  No internal log found in the artifact directory.")
        return
    open_with("logs", [log])


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


# (key, [aliases], description, handler) — numbered in this order.
INSPECT_COMMANDS = [
    ("failure",  ["show failure", "failure", "fail"],
     "Show only the failing step, plus any comments from the runner", cmd_show_failure),
    ("code",     ["show test code", "test code", "code", "show code"],
     "Show the entire test script", cmd_show_code),
    ("use case", ["show use case", "use case", "uc", "usecase"],
     "Show the use case related to this test", cmd_show_use_case),
    ("images",   ["show images", "images", "screenshots", "shots"],
     "Open all screenshots in the external viewer", cmd_show_images),
    ("run cmd",  ["run cmd", "run command", "run", "show run cmd", "show run", "create run cmd"],
     "Command to run just this test again, with the original parameters (auto-copied)", cmd_run_cmd),
    ("movie",    ["run as a movie", "movie", "run movie", "record"],
     "Re-run command that also records an MP4 of the simulator screen", cmd_run_movie),
    ("params",   ["show parameters", "parameters", "params"],
     "How this was run: runner, tags, env, system load", cmd_show_params),
    ("dir",      ["go to directory", "directory", "dir", "open dir", "finder"],
     "Open the artifact directory in the directory viewer", cmd_go_dir),
    ("prompt",   ["create prompt", "prompt"],
     "Build an LLM-assistance prompt from this test's details", cmd_create_prompt),
    ("trello",   ["create trello ticket", "trello", "ticket", "create ticket"],
     "Draft a Trello bug card from this test's details (to tmp/trello-cards/)", cmd_create_trello),
    ("internal log", ["show runner internal log", "internal log", "log", "logs", "internal"],
     "Open the runner's detailed internal log", cmd_internal_log),
    ("configure", ["configure", "config"],
     "Set preferred viewers for images, dirs, logs, code", cmd_configure),
    ("help",     ["help", "h", "?", "menu"],
     "Show this menu", None),
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


def print_command_menu(with_desc=True):
    print("\nCommands (number or name; 'tests' = back to test list, 'q' = quit):")
    for i, (key, _aliases, desc, _h) in enumerate(INSPECT_COMMANDS, 1):
        if with_desc:
            print(f"  {i:>2}) {key:<14} {desc}")
        else:
            print(f"  {i:>2}) {key}")


def print_test_menu(entries, failing_only):
    shown = [e for e in entries if e.failing] if failing_only else entries
    title = "Failing tests" if failing_only else "Tests in this run"
    print(f"\n{title}:")
    for i, e in enumerate(shown, 1):
        print(f"  {i:>2}) {e.label()}")
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
        cmd = match_command(raw)
        if cmd is None:
            print(f"  ❓ unknown command {raw!r} — type 'help' for the menu")
            continue
        if cmd[0] == "help":
            print_command_menu()
            continue
        try:
            cmd[3](e, run)
        except (KeyboardInterrupt, EOFError):
            print("\n  (canceled)")
        except Exception as err:  # an inspector command must never kill the session
            print(f"  ⚠️  {cmd[0]} failed: {err}")


def cmd_inspect(spec_args, one_cmd, as_json):
    try:
        import readline  # noqa: F401 — line editing + history for input()
    except ImportError:
        pass

    # Positionals are sniffed: an existing path (or anything with a /) is the run
    # directory; the remaining words form the test spec.
    run_arg, spec_words = None, []
    for a in spec_args or []:
        if run_arg is None and ("/" in a or Path(a).expanduser().exists()):
            run_arg = a
        else:
            spec_words.append(a)
    spec = " ".join(spec_words).strip()

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

    selected, err = (None, None)
    if spec:
        selected, err = parse_test_spec(spec, entries)
        if err:
            print(f"🔴🥺 {err}")
            if one_cmd or not sys.stdin.isatty():
                return 2

    interactive = sys.stdin.isatty()
    if selected and one_cmd:
        cmd = match_command(one_cmd)
        if cmd is None or cmd[0] == "help":
            print_command_menu()
            return 0 if cmd else 2
        cmd[3](selected, run)
        return 0
    if not interactive:
        # Non-interactive without --cmd: just list, never hang on input().
        shown = print_test_menu(entries, failing_only=bool(failing))
        if not shown:
            print("  (none)")
        print("\n(no tty — pass a test name and --cmd <command> to run one inspection step)")
        return 0

    failing_only = bool(failing)
    while True:
        if selected is None:
            shown = print_test_menu(entries, failing_only)
            if failing_only and not shown:
                print("  (no failing tests)")
            prompt = "Select test (number or name"
            prompt += "; 'all' lists every test" if failing_only else ""
            try:
                raw = input(prompt + "; 'q' quits): ").strip()
            except (EOFError, KeyboardInterrupt):
                print()
                return 0
            if not raw:
                continue
            n = norm_input(raw)
            if n in ("q", "quit", "exit"):
                return 0
            if n in ("all", "a"):
                failing_only = False
                continue
            if n.isdigit() and 1 <= int(n) <= len(shown):
                selected = shown[int(n) - 1]
            else:
                selected, perr = parse_test_spec(raw, entries)
                if perr:
                    print(f"🔴🥺 {perr}")
                    continue
        if inspect_command_loop(selected, run) == "quit":
            return 0
        selected = None


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
    p_inspect = sub.add_parser("inspect", help="interactive inspector for a run's failing tests")
    p_inspect.add_argument("spec", nargs="*", metavar="TEST|RUN_DIR",
                           help="optional test name (forgiving: 'auth 100, site admin', a pasted "
                                "summary line, 'uc-182') and/or a run directory (default: current "
                                "or newest run)")
    p_inspect.add_argument("--cmd", metavar="NAME",
                           help="run one menu command non-interactively (failure, code, run, …)")
    for p in (p_status, p_nuke, p_health, p_inspect):
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
    if args.command == "inspect":
        return cmd_inspect(args.spec, args.cmd, args.json)
    return 2


if __name__ == "__main__":
    sys.exit(main())
