#!/usr/bin/env python3
"""
hot_processes.py

Identifies important spawning processes (terminals, IDEs, AI apps, containers)
and reports interesting child processes under each one.

Usage:
    hot_processes.py [--all] [--process PID]
"""

import argparse
import json
import os
import re
import socket
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    import psutil
except ImportError:
    print("Missing dependency: psutil\nInstall with: pip install psutil", file=sys.stderr)
    sys.exit(1)


# ── Configuration ─────────────────────────────────────────────────────────────

LOG_FILE = Path.home() / ".hot_processes.log"

# Substring-matched against process name and exe basename (case-insensitive).
SPAWNING_NAMES = [
    # Terminals
    "Terminal", "iTerm", "iTerm2", "Warp", "Kitty", "Alacritty", "Hyper",
    # Apple
    "Xcode",
    # JetBrains
    "PyCharm", "IntelliJ IDEA", "WebStorm", "GoLand", "CLion", "DataGrip",
    "Rider", "RubyMine", "Fleet", "PhpStorm",
    # Other editors / IDEs
    "Visual Studio Code", "Code", "Cursor", "Windsurf", "Zed",
    "Sublime Text", "Nova", "Emacs", "Aquamacs", "vim", "nvim", "Neovim",
    "Eclipse",
    # Mobile / device
    "Android Studio", "Simulator",
    # Containers / VMs
    "Docker", "Podman",
    # AI applications
    "Claude", "Ollama", "LM Studio", "GPT4All", "AnythingLLM",
    # Notebooks / data
    "Jupyter", "RStudio",
]

INTERESTING_CMD_PATTERNS: list[re.Pattern] = [
    re.compile(r"\bnode\b",  re.IGNORECASE),
    re.compile(r"\bqemu\b",  re.IGNORECASE),
]

WATCHED_HOSTS: list[str] = [
    "example.com",
    "*.example.com",
]

# ── High-CPU thresholds ───────────────────────────────────────────────────────

CPU_NEW_PROCESS_MAX_AGE   = 10.0   # seconds: process must be younger than this
CPU_NEW_PROCESS_RATIO     = 0.50   # fraction of age used as CPU
CPU_VS_SPAWNING_RATIO     = 0.10   # CPU > 10% of spawning uptime
CPU_ABSOLUTE_SECS         = 3600.0 # 1 hour absolute CPU
CPU_VS_PREV_RATIO         = 0.20   # delta_cpu > 20% of elapsed since last run

LOG_ROTATION_HOURS        = 36


# ── Utilities ─────────────────────────────────────────────────────────────────

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def fmt_dur(seconds: float) -> str:
    s = int(seconds)
    if s < 60:   return f"{s}s"
    if s < 3600: return f"{s // 60}m{s % 60:02d}s"
    return f"{s // 3600}h{(s % 3600) // 60:02d}m"


def safe(proc, attr, default=None):
    """Call proc.attr() (or read attr), swallowing psutil errors."""
    try:
        val = getattr(proc, attr)
        return val() if callable(val) else val
    except (psutil.NoSuchProcess, psutil.AccessDenied,
            psutil.ZombieProcess, OSError):
        return default


# ── Process snapshot ──────────────────────────────────────────────────────────

def snapshot(proc: psutil.Process) -> dict | None:
    """Capture a stable attribute dict for a process. Returns None on error."""
    try:
        with proc.oneshot():
            ct = safe(proc, "cpu_times")
            cmdline = safe(proc, "cmdline", []) or []
            return {
                "pid":         proc.pid,
                "ppid":        safe(proc, "ppid",        -1),
                "name":        safe(proc, "name",         ""),
                "exe":         safe(proc, "exe",          ""),
                "cmdline":     " ".join(cmdline),
                "create_time": safe(proc, "create_time",  0.0),
                "status":      safe(proc, "status",       ""),
                "username":    safe(proc, "username",     ""),
                "cpu_user":    ct.user   if ct else 0.0,
                "cpu_system":  ct.system if ct else 0.0,
            }
    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
        return None


def connections(proc: psutil.Process) -> list[dict]:
    """Return list of inet connection dicts for proc."""
    try:
        return [
            {
                "status":      c.status,
                "local_ip":    c.laddr.ip   if c.laddr else "",
                "local_port":  c.laddr.port if c.laddr else 0,
                "remote_ip":   c.raddr.ip   if c.raddr else "",
                "remote_port": c.raddr.port if c.raddr else 0,
            }
            for c in proc.net_connections(kind="inet")
        ]
    except (psutil.NoSuchProcess, psutil.AccessDenied, OSError):
        return []


# ── Spawning process discovery ────────────────────────────────────────────────

def _matches_spawning_name(proc: psutil.Process) -> bool:
    try:
        name     = (safe(proc, "name", "") or "").lower()
        exe_base = os.path.basename(safe(proc, "exe", "") or "").lower()
        for s in SPAWNING_NAMES:
            lo = s.lower()
            if lo in name or lo in exe_base:
                return True
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        pass
    return False


def find_spawning_processes() -> list[psutil.Process]:
    result, seen = [], set()
    for proc in psutil.process_iter(["pid", "name", "exe"]):
        try:
            if proc.pid not in seen and _matches_spawning_name(proc):
                result.append(proc)
                seen.add(proc.pid)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return result


# ── Analysis-set collection ───────────────────────────────────────────────────

def _recurse(proc: psutil.Process, spawning_pid: int,
             depth: int, visited: set) -> list[dict]:
    result = []
    try:
        for child in proc.children(recursive=False):
            if child.pid in visited:
                continue
            visited.add(child.pid)
            info = snapshot(child)
            if info:
                info["spawning_pid"] = spawning_pid
                info["depth"]        = depth + 1
                info["connections"]  = connections(child)
                result.append(info)
            result.extend(_recurse(child, spawning_pid, depth + 1, visited))
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        pass
    return result


def collect_analysis_set(
    spawning_procs: list[psutil.Process],
) -> tuple[list[dict], list[dict]]:
    """
    Returns (spawning_infos, child_infos).
    Spawning processes are included in the analysis set per spec.
    """
    spawning_infos, child_infos = [], []
    seen = set()

    for proc in spawning_procs:
        if proc.pid in seen:
            continue
        seen.add(proc.pid)
        info = snapshot(proc)
        if not info:
            continue
        info["spawning_pid"] = proc.pid
        info["depth"]        = 0
        info["connections"]  = connections(proc)
        spawning_infos.append(info)
        child_infos.extend(_recurse(proc, proc.pid, 0, {proc.pid}))

    return spawning_infos, child_infos


# ── Interesting-process evaluators ───────────────────────────────────────────
#
# Each returns (label: str, interesting_pids: set[int]).
# Evaluation is NOT short-circuiting: a process may receive multiple labels.

def eval_by_name(infos: list[dict]) -> tuple[str, set[int]]:
    """NAME — cmdline or process name matches an interesting-name pattern."""
    pids = set()
    for info in infos:
        text = (info.get("cmdline") or info.get("name") or "")
        if any(p.search(text) for p in INTERESTING_CMD_PATTERNS):
            pids.add(info["pid"])
    return "NAME", pids


def eval_listening_port(infos: list[dict]) -> tuple[str, set[int]]:
    """PORT — process is listening on at least one TCP/UDP port."""
    pids = set()
    for info in infos:
        if any(c.get("status") == "LISTEN" for c in info.get("connections", [])):
            pids.add(info["pid"])
    return "PORT", pids


_watched_ips: set[str] | None = None


def _resolve_watched_ips() -> set[str]:
    ips: set[str] = set()
    for h in WATCHED_HOSTS:
        if h.startswith("*."):
            continue
        try:
            for r in socket.getaddrinfo(h, None):
                ips.add(r[4][0])
        except (socket.gaierror, OSError):
            pass
    return ips


def eval_host_connections(infos: list[dict]) -> tuple[str, set[int]]:
    """HOST — process has a connection to a watched hostname."""
    global _watched_ips
    if _watched_ips is None:
        _watched_ips = _resolve_watched_ips()

    wildcard_suffixes = [h[2:] for h in WATCHED_HOSTS if h.startswith("*.")]
    pids = set()

    for info in infos:
        for c in info.get("connections", []):
            remote = c.get("remote_ip", "")
            if not remote:
                continue
            if remote in _watched_ips:
                pids.add(info["pid"])
                break
            if wildcard_suffixes:
                try:
                    hostname = socket.gethostbyaddr(remote)[0].lower()
                    if any(hostname.endswith(sfx) for sfx in wildcard_suffixes):
                        pids.add(info["pid"])
                        break
                except (socket.herror, socket.gaierror, OSError):
                    pass

    return "HOST", pids


def eval_high_cpu(
    infos: list[dict],
    spawning_by_pid: dict[int, dict],
    now: float,
    prev_infos: list[dict],
    elapsed_since_prev: float,
) -> tuple[str, set[int]]:
    """HIGH_CPU — process meets any high-CPU predicate (short-circuiting within)."""
    pids: set[int] = set()
    for info in infos:
        spawning = spawning_by_pid.get(info.get("spawning_pid", -1), {})
        high, _ = _is_high_cpu(info, spawning, now, prev_infos, elapsed_since_prev)
        if high:
            pids.add(info["pid"])
    return "HIGH_CPU", pids


# ── High-CPU predicates (short-circuiting within is_high_cpu) ────────────────

def _cpu_total(info: dict) -> float:
    return info.get("cpu_user", 0.0) + info.get("cpu_system", 0.0)


def cpu_pred_new_and_high(info: dict, now: float) -> bool:
    """Process started < 10s ago and used > 50% of its age as CPU."""
    age = now - info.get("create_time", now)
    if age <= 0 or age >= CPU_NEW_PROCESS_MAX_AGE:
        return False
    return _cpu_total(info) / age > CPU_NEW_PROCESS_RATIO


def cpu_pred_vs_spawning_uptime(info: dict, spawning: dict, now: float) -> bool:
    """CPU time > 10% of the spawning process's total uptime."""
    uptime = now - spawning.get("create_time", now)
    if uptime <= 0:
        return False
    return _cpu_total(info) > CPU_VS_SPAWNING_RATIO * uptime


def cpu_pred_absolute(info: dict) -> bool:
    """Accumulated CPU time exceeds 1 hour."""
    return _cpu_total(info) > CPU_ABSOLUTE_SECS


def cpu_pred_vs_previous_run(
    info: dict, prev_infos: list[dict], elapsed: float
) -> bool:
    """CPU advanced more than 20% of elapsed time since last invocation."""
    if elapsed <= 0:
        return False
    pid, ct = info["pid"], info.get("create_time", 0.0)
    prev = next(
        (r for r in prev_infos
         if r.get("pid") == pid and abs(r.get("create_time", -1) - ct) < 1.0),
        None,
    )
    if not prev:
        return False
    delta = _cpu_total(info) - _cpu_total(prev)
    return delta > CPU_VS_PREV_RATIO * elapsed


def _is_high_cpu(
    info: dict,
    spawning: dict,
    now: float,
    prev_infos: list[dict],
    elapsed: float,
) -> tuple[bool, str]:
    """Short-circuiting check: first True predicate wins."""
    if cpu_pred_new_and_high(info, now):
        return True, "new_high"
    if cpu_pred_vs_spawning_uptime(info, spawning, now):
        return True, "vs_spawning"
    if cpu_pred_absolute(info):
        return True, "absolute"
    if cpu_pred_vs_previous_run(info, prev_infos, elapsed):
        return True, "vs_prev_run"
    return False, ""


# ── Log management ────────────────────────────────────────────────────────────

def load_log() -> list[dict]:
    if not LOG_FILE.exists():
        return []
    try:
        data = json.loads(LOG_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        return []


def save_log(entries: list[dict]) -> None:
    try:
        LOG_FILE.write_text(json.dumps(entries, indent=2), encoding="utf-8")
    except OSError as e:
        print(f"Warning: could not write log {LOG_FILE}: {e}", file=sys.stderr)


def rotate_log_if_needed(entries: list[dict], now: float) -> list[dict]:
    """
    If the last entry is > 36 h old OR every process it listed is gone,
    rename the log to .log.old and return [].
    """
    if not entries:
        return entries

    last      = entries[-1]
    old_path  = Path(str(LOG_FILE) + ".old")
    rotate    = False

    # Age check
    try:
        last_dt   = datetime.fromisoformat(last["timestamp"])
        age_hours = (datetime.fromtimestamp(now, tz=timezone.utc) - last_dt).total_seconds() / 3600
        if age_hours > LOG_ROTATION_HOURS:
            rotate = True
    except (KeyError, ValueError):
        pass

    # All-processes-gone check
    if not rotate:
        pid_cts: dict[str, float] = last.get("_pid_create_times", {})
        all_pids = {
            r["pid"]
            for r in last.get("spawning", []) + last.get("analysis", [])
            if "pid" in r
        }
        if all_pids:
            all_gone = True
            for pid in all_pids:
                try:
                    p  = psutil.Process(pid)
                    ct = pid_cts.get(str(pid))
                    # Same process if create_time matches within 1 s
                    if ct is None or abs(p.create_time() - ct) < 1.0:
                        all_gone = False
                        break
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
            if all_gone:
                rotate = True

    if rotate:
        try:
            LOG_FILE.rename(old_path)
        except OSError as e:
            print(f"Warning: could not rotate log: {e}", file=sys.stderr)
        return []

    return entries


def prev_run_info(entries: list[dict]) -> tuple[list[dict], float]:
    """Return (analysis_list, elapsed_seconds) from the most recent log entry."""
    if not entries:
        return [], 0.0
    last = entries[-1]
    try:
        last_dt  = datetime.fromisoformat(last["timestamp"])
        elapsed  = (datetime.now(timezone.utc) - last_dt).total_seconds()
    except (KeyError, ValueError):
        elapsed = 0.0
    return last.get("analysis", []), elapsed


# ── Output ────────────────────────────────────────────────────────────────────

def _listening_ports(info: dict) -> list[int]:
    return [
        c["local_port"]
        for c in info.get("connections", [])
        if c.get("status") == "LISTEN" and c.get("local_port")
    ]


def _print_proc(info: dict, labels: set[str], indent: str = "    ") -> None:
    pid    = info["pid"]
    name   = info.get("name", "?")
    cmd    = (info.get("cmdline") or "")[:80]
    age    = fmt_dur(time.time() - info.get("create_time", time.time()))
    ctotal = _cpu_total(info)
    ports  = _listening_ports(info)

    label_str = ("  ▶ " + " ".join(sorted(labels))) if labels else ""
    port_str  = f"  ports={ports}" if ports else ""
    cpu_str   = f"  cpu={fmt_dur(ctotal)}"

    print(f"{indent}PID {pid:6d}  {name:<26}{label_str}{cpu_str}  (age {age}){port_str}")
    if labels and cmd:
        print(f"{indent}           CMD: {cmd}")


def print_report(
    spawning_infos: list[dict],
    child_infos: list[dict],
    labels_by_pid: dict[int, set[str]],
    show_all: bool,
) -> None:
    print(f"\n=== Hot Processes  {now_iso()} ===\n")

    by_spawning: dict[int, list[dict]] = {}
    for info in child_infos:
        by_spawning.setdefault(info["spawning_pid"], []).append(info)

    for s in spawning_infos:
        age = fmt_dur(time.time() - s.get("create_time", time.time()))
        print(f"Spawning  PID {s['pid']:6d}  {s.get('name', '?'):<26}  (up {age})")

        children  = by_spawning.get(s["pid"], [])
        shown_any = False

        for info in children:
            pid    = info["pid"]
            labels = labels_by_pid.get(pid, set())
            if labels or show_all:
                _print_proc(info, labels)
                shown_any = True

        if not shown_any:
            print("    (no interesting children)")
        print()


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Report interesting processes under IDE / AI / terminal spawners."
    )
    parser.add_argument(
        "--all", action="store_true",
        help="Show every process in the analysis set, not just interesting ones",
    )
    parser.add_argument(
        "--process", metavar="PID", type=int,
        help="Restrict analysis to children of this PID",
    )
    args = parser.parse_args()

    now = time.time()

    # ── Load and rotate log ───────────────────────────────────────────────────
    entries  = load_log()
    entries  = rotate_log_if_needed(entries, now)
    prev_analysis, elapsed_since_prev = prev_run_info(entries)

    # ── Find spawning processes ───────────────────────────────────────────────
    if args.process:
        try:
            spawning_procs = [psutil.Process(args.process)]
        except psutil.NoSuchProcess:
            print(f"No process with PID {args.process}.", file=sys.stderr)
            sys.exit(1)
    else:
        spawning_procs = find_spawning_processes()

    if not spawning_procs:
        print("No spawning processes found.")
        sys.exit(0)

    # ── Collect analysis set ──────────────────────────────────────────────────
    spawning_infos, child_infos = collect_analysis_set(spawning_procs)
    all_infos = spawning_infos + child_infos

    # ── Evaluate interesting labels (non-short-circuiting) ────────────────────
    labels_by_pid: dict[int, set[str]] = {}

    for label, pids in [
        eval_by_name(all_infos),
        eval_listening_port(all_infos),
        eval_host_connections(all_infos),
    ]:
        for pid in pids:
            labels_by_pid.setdefault(pid, set()).add(label)

    spawning_by_pid = {s["pid"]: s for s in spawning_infos}
    _, cpu_pids = eval_high_cpu(
        all_infos, spawning_by_pid, now, prev_analysis, elapsed_since_prev
    )
    for pid in cpu_pids:
        labels_by_pid.setdefault(pid, set()).add("HIGH_CPU")

    # ── Print report ──────────────────────────────────────────────────────────
    print_report(spawning_infos, child_infos, labels_by_pid, args.all)

    # ── Save log entry ────────────────────────────────────────────────────────
    pid_create_times = {str(i["pid"]): i.get("create_time", 0.0) for i in all_infos}
    entry = {
        "timestamp":         now_iso(),
        "spawning":          spawning_infos,
        "analysis":          [
            {**i, "labels": sorted(labels_by_pid.get(i["pid"], set()))}
            for i in all_infos
        ],
        "_pid_create_times": pid_create_times,
    }
    entries.append(entry)
    save_log(entries)


if __name__ == "__main__":
    main()
