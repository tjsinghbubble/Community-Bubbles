#!/usr/bin/env python3
"""Logic-level self-tests for testctl.py (the test-runner control script).

Pure-logic + lock/heartbeat assertions only — no real test runner, device, or
network required. The lock and heartbeat state is redirected to a THROWAWAY temp
dir (the module's path constants are monkeypatched) so it never touches the real
tests/output/ lock or current-run.json. Invoked by scripts/check_tooling.zsh
after the syntax/import checks.

Usage: python3 scripts/helpers/selftest_testctl.py
"""
import contextlib
import io
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from types import SimpleNamespace

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent
sys.path.insert(0, str(SCRIPTS))

import testctl as t  # noqa: E402

_passed = 0
_failed = 0


def check(name, cond):
    global _passed, _failed
    if cond:
        _passed += 1
        print(f"  ✅ {name}")
    else:
        _failed += 1
        print(f"  ❌ {name}")


def _redirect_lock_state_to(tmp):
    """Point every lock/heartbeat path at a throwaway dir (constants are module globals
    read at call time, so reassigning them reroutes all the I/O)."""
    t.OUTPUT_ROOT = tmp
    t.LOCK_FILE = tmp / ".test-runner.lock"
    t.LOCK_GUARD = tmp / ".test-runner.lock.guard"
    t.HEARTBEAT = tmp / "current-run.json"


def test_time_parsers():
    check("parse_elapsedtime mm:ss", t.parse_elapsedtime_into_seconds("01:02") == 62)
    check("parse_elapsedtime hh:mm:ss", t.parse_elapsedtime_into_seconds("01:02:03") == 3723)
    check("parse_elapsedtime dd-hh:mm:ss",
          t.parse_elapsedtime_into_seconds("2-03:04:05") == 2 * 86400 + 3 * 3600 + 4 * 60 + 5)
    check("interval_into_string seconds-only", t.interval_into_string(45) == "45s")
    check("interval_into_string minutes", t.interval_into_string(87) == "1m 27s")
    check("interval_into_string hours", t.interval_into_string(3 * 3600 + 28 * 60 + 59) == "3h 28m 59s")
    check("interval_into_string None", t.interval_into_string(None) == "?")
    check("convert_iso_timestamp valid → float",
          isinstance(t.convert_iso_timestamp("2025-06-10T19:49:00.000Z"), float))
    check("convert_iso_timestamp garbage → None", t.convert_iso_timestamp("I like cheese") is None)


def test_classify_runner():
    check("classify maestro mcp", t.classify_runner("java ... maestro.cli.AppKt mcp") == "maestro-mcp")
    check("classify maestro test", t.classify_runner("maestro test foo.yaml") == "maestro-cli")
    check("classify qa.ts", t.classify_runner("node tests/runner/qa.ts --all") == "qa-runner")
    check("classify newman", t.classify_runner("node newman run coll.json") == "newman")
    check("classify self (testctl) excluded", t.classify_runner("python3 scripts/testctl.py status") is None)
    check("classify unrelated → None", t.classify_runner("vim notes.md") is None)


def test_expand_targets():
    known, unknown = t.expand_targets("all")
    check("expand all → qa known", "qa" in known)
    check("expand all → newman known (via headless)", "newman" in known)
    check("expand all → mcp unknown (disabled)", "mcp" in unknown)
    known, unknown = t.expand_targets("maestro")
    check("expand maestro → cli+xcodebuild known", "cli" in known and "xcodebuild" in known)
    known, unknown = t.expand_targets("bogus")
    check("expand bogus → unknown only", known == [] and unknown == ["bogus"])


def test_small_helpers():
    check("_short truncates + flattens newlines",
          t._short("a" * 50 + "\n" + "b" * 60, 100).endswith("…")
          and "\n" not in t._short("x\ny", 100))
    check("_age_hours from startedEpoch",
          abs(t._age_hours({"startedEpoch": int(time.time()) - 7200}) - 2.0) < 0.1)


def test_lock_lifecycle(tmp):
    _redirect_lock_state_to(tmp)
    check("_read_lock None when no file", t._read_lock() is None)

    t._write_lock({"runner": "qa", "pid": 4242, "ppid": 1})
    rec = t._read_lock()
    check("_write_lock/_read_lock round-trips", rec is not None and rec["runner"] == "qa")

    # dead owner+parent → reclaimable
    dead = 2 ** 30
    reclaimable, _ = t._lock_holder_state({"pid": dead, "ppid": dead})
    check("_lock_holder_state dead pids → reclaimable", reclaimable is True)

    # live pid that is not a genuine runner (this selftest process) → recycled-pid reclaim
    reclaimable, _ = t._lock_holder_state({"pid": os.getpid(), "ppid": os.getppid()})
    check("_lock_holder_state live non-runner → reclaimable", reclaimable is True)

    # cmd_lock status: FREE after the file is gone
    t.LOCK_FILE.unlink(missing_ok=True)
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        t.cmd_lock("status", SimpleNamespace(json=False))
    check("cmd_lock status FREE", "FREE" in out.getvalue())

    # release only by the owning pid
    t._write_lock({"runner": "qa", "pid": 4242, "ppid": 1})
    err = io.StringIO()
    with contextlib.redirect_stderr(err):
        t.cmd_lock("release", SimpleNamespace(pid=999))
    check("release by wrong pid keeps lock", t._read_lock() is not None)
    with contextlib.redirect_stderr(err):
        t.cmd_lock("release", SimpleNamespace(pid=4242))
    check("release by owner pid clears lock", t._read_lock() is None)


def test_heartbeat(tmp):
    _redirect_lock_state_to(tmp)
    t.HEARTBEAT.unlink(missing_ok=True)
    check("read_heartbeat None when no file", t.read_heartbeat({}) is None)

    # runner pid absent from the process table + non-terminal state → ABANDONED
    t.HEARTBEAT.write_text('{"pid": 4242, "state": "running"}')
    hb = t.read_heartbeat({}) or {}
    check("read_heartbeat marks abandoned",
          hb.get("abandoned") is True and hb.get("state", "").startswith("ABANDONED"))

    # terminal state is never re-flagged as abandoned
    t.HEARTBEAT.write_text('{"pid": 4242, "state": "done"}')
    hb = t.read_heartbeat({}) or {}
    check("read_heartbeat keeps terminal state", hb.get("abandoned") is False and hb.get("state") == "done")

    # pid present in the process table → runner alive, not abandoned
    t.HEARTBEAT.write_text('{"pid": 4242, "state": "running"}')
    hb = t.read_heartbeat({4242: {"pid": 4242}}) or {}
    check("read_heartbeat sees live runner", hb.get("runnerAlive") is True and hb.get("abandoned") is False)


def _zsh_syntax_ok(text):
    """zsh -n: parse-only (no execution) syntax check of generated shell."""
    with tempfile.NamedTemporaryFile("w", suffix=".zsh", delete=False) as f:
        f.write(text)
        path = f.name
    try:
        p = subprocess.run(["zsh", "-n", path], capture_output=True, text=True)
        return p.returncode == 0, p.stderr.strip()
    finally:
        os.unlink(path)


# Variables that are legitimately external/special in generated shell, so referencing
# them without a local assignment is fine (NOT a "used-but-undefined" smell).
_SAFE_VARS = {"DEBUG_MOVIE", "REPLY", "PROJ_ROOT", "HOME"}


def _undefined_vars(body):
    """Heuristic: names referenced as $name/${name} that are never assigned in the body.
    Catches the class of bug where a rename leaves a stale reference (e.g. $rec after the
    var became $recorder_PID, or $native after it became $native_ID). zsh -n can't see these
    — an unset var is valid syntax."""
    assigned = set(re.findall(r"(?:^|\s|;|\()(\w+)=", body))            # name=value
    assigned |= set(re.findall(r"\bfor\s+(\w+)\s+in\b", body))         # for name in …
    assigned |= set(re.findall(r'\bread\b[^\n]*?"?(\w+)\?', body))     # read -q "REPLY?…"
    assigned |= set(re.findall(r"\blocal\s+(?:-\w+\s+)?(\w+)\b", body))  # local [-a] name
    refd = set(re.findall(r"\$\{?(\w+)", body))                        # $name / ${name…}
    return {v for v in refd if v not in assigned and v not in _SAFE_VARS and not v.isdigit()}


def test_generated_shell_lints():
    """Lint the shell that the inspect RUN commands emit: movie (zsh function), cmd /
    noisy (re-run command line), edit (written .zsh). zsh -n for syntax + an
    undefined-var scan for the rename-left-a-stale-ref class."""
    if not shutil.which("zsh"):
        check("zsh present for shell lints", True)  # skip gracefully where zsh is absent
        return

    # hermetic: no clipboard, editor, or device-DB side effects; a clean flow path
    t.find_source_by_qa_id = lambda *a, **k: t.REPO / "tests/e2e/auth/auth-0100-signin-smoke.yaml"
    t.clipboard_copy = lambda *a, **k: False
    t._device_aliases = lambda *a, **k: []
    t._device_label = lambda *a, **k: ("dev", "ios")

    e = t.Entry(id="auth-0100", tool="maestro", layer="e2e", role="role-bubble-admin")
    run = {"params": {"platform": "android", "deviceId": None, "env": "local"}}

    # cmd → a single re-run command line
    cmd_ok, cmd_err = _zsh_syntax_ok(t.build_run_cmd(e, run, require_screen=True))
    check(f"cmd output is valid zsh{'' if cmd_ok else ' — ' + cmd_err}", cmd_ok)

    # movie → the re-runnable zsh function (the bug-prone one)
    body = t._movie_function_body("movie_run_x", "auth_0100", "android", "last-android",
                                  "role-bubble-admin", "tests/e2e/auth/auth-0100-signin-smoke.yaml", "")
    mv_ok, mv_err = _zsh_syntax_ok(body)
    check(f"movie output is valid zsh{'' if mv_ok else ' — ' + mv_err}", mv_ok)
    undef = _undefined_vars(body)
    check(f"movie output has no stale/undefined vars{'' if not undef else ' — ' + ','.join(sorted(undef))}",
          not undef)

    # noisy → the re-run command it prints (flow_override path)
    noisy_cmd = t.build_run_cmd(e, run, flow_override=t.REPO / "tests/output/noisy-x.yaml",
                                require_screen=True)
    n_ok, n_err = _zsh_syntax_ok(noisy_cmd)
    check(f"noisy re-run output is valid zsh{'' if n_ok else ' — ' + n_err}", n_ok)

    # edit → a written .zsh script (manual must live under REPO for relative_to to work)
    editdir = t.REPO / "tests" / "output"
    editdir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=str(editdir), prefix="selftest_edit_") as d:
        manual = Path(d) / "auth-0100.yaml"
        manual.write_text("# stub flow\n")
        out = t._write_run_script(e, run, manual)
        e_ok, e_err = _zsh_syntax_ok(out.read_text())
        check(f"edit output is valid zsh{'' if e_ok else ' — ' + e_err}", e_ok)


def main():
    test_time_parsers()
    test_classify_runner()
    test_expand_targets()
    test_small_helpers()
    test_generated_shell_lints()
    with tempfile.TemporaryDirectory(prefix="selftest_testctl_") as d:
        test_lock_lifecycle(Path(d))
        test_heartbeat(Path(d))
    print(f"\nselftest_testctl: {_passed} passed, {_failed} failed")
    return 1 if _failed else 0


if __name__ == "__main__":
    sys.exit(main())
