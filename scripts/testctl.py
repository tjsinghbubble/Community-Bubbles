#!/usr/bin/env python3
"""
testctl — status / nuke / health for the Bubble test platform.

One tool callable by every entity that pokes at tests: Claude Code, shell
health scripts, humans, and the test scripts themselves.

  testctl.py status            what is running right now (test, step, runner, invoker, timings)
  testctl.py nuke LIST         stop test runners (known method first, else SIGQUIT → 2s → SIGKILL)
  testctl.py health            diagnose the local test environment
  testctl.py --json <cmd>      machine-readable output for any command

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
    """Newest maestro.log under any of search_dirs → (step_text, step_started_epoch, log_path)."""
    newest, newest_mtime = None, 0
    for d in search_dirs:
        d = Path(d)
        if not d.is_dir():
            continue
        try:
            for f in d.rglob("maestro.log"):
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

    if not runs and not test_procs:
        print("✅  No tests in progress (no qa run, no maestro/vitest/newman/playwright processes).")
        if payload["panicMarker"]:
            print("⚠️   Stale PANIC marker present (tests/PANIC) — qa clears it on next start.")
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
    for p in (p_status, p_nuke, p_health):
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
    return 2


if __name__ == "__main__":
    sys.exit(main())
