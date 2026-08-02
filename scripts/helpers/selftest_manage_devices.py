#!/usr/bin/env python3
"""Native-functionality self-tests for manage_devices (logic level).

Runs against a THROWAWAY DB via MANAGE_DEVICES_DB (the real override) so it never
touches the developer's .device-manager DB. Invoked by scripts/check_tooling.zsh after
the syntax/import checks. Pure-logic assertions only (no real device required).

Usage: MANAGE_DEVICES_DB=<tmp> python3 scripts/helpers/selftest_manage_devices.py
"""
import contextlib
import io
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent
sys.path.insert(0, str(SCRIPTS))

# manage_devices is an extensionless CLI script; load it via the helpers loader.
from helpers import load_script  # noqa: E402

m = load_script("manage_devices")

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


def main():
    c = m.db()

    # canonical schema: native + readiness columns present, version stamped
    cols = {r[1] for r in c.execute("PRAGMA table_info(devices)")}
    native = {"personal", "last_reachable_at", "claim_owner", "claim_pid", "claim_heartbeat_at"}
    old = {"compile_level", "has_default_boot", "last_warmed_at", "last_used"}
    check("fresh DB has native columns", native <= cols)
    check("fresh DB has readiness columns", old <= cols)
    check("fresh DB has api_level column (v2)", "api_level" in cols)
    check("fresh DB dropped serial column (v2)", "serial" not in cols)
    check("fresh DB has v3 screen/boot/google columns",
          {"resolution", "density", "boot_option", "google_support"} <= cols)
    check("fresh DB has v4 default_boot_windowed column", "default_boot_windowed" in cols)
    check("fresh DB user_version == SCHEMA_VERSION",
          c.execute("PRAGMA user_version").fetchone()[0] == m.hmd.SCHEMA_VERSION)
    check("ref_flavor seeds Real",
          "Real" in {r[0] for r in c.execute("SELECT name FROM ref_flavor")})
    tabs = {r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    check("v2 tables ref_api_level + device_transports exist",
          {"ref_api_level", "device_transports"} <= tabs)
    check("ref_api_level seeds 'API 34' and 'API 37'",
          {"API 34", "API 37"} <= {r[0] for r in c.execute("SELECT name FROM ref_api_level")})

    # api level ↔ marketing release: os_version stays a release, api_level is 'API NN'
    check("release_from_api maps 34→14, 37→17",
          m._release_from_api(34) == "14" and m._release_from_api(37) == "17")
    check("release_from_api(unknown) is None (no 'API NN' leak into os_version)",
          m._release_from_api(999) is None)
    check("api_level_str formats 'API 37'", m._api_level_str(37) == "API 37")

    # gpu decision
    check("gpu_default() == 'auto'", m.gpu_default() == "auto")
    src = (SCRIPTS / "manage_devices").read_text()
    code = "\n".join(l for l in src.splitlines() if not l.lstrip().startswith("#"))
    check("no swiftshader_indirect in code (comments aside)", "swiftshader" not in code)

    # seed two real devices (one personal, one test) + one sim
    c.execute("INSERT INTO devices(udid,flavor,type,os_name,display_name,api_level,state,present,personal)"
              " VALUES('SER-A','Real','Android','AndroidOS','Pixel 8','API 34','Running',1,0)")
    c.execute("INSERT INTO devices(udid,flavor,type,os_name,display_name,state,present,personal)"
              " VALUES('UD-I','Real','iOS','iOS','Schmante','Running',1,1)")
    c.execute("INSERT INTO devices(udid,flavor,type,os_name,display_name,state,present,personal)"
              " VALUES('SIM-1','Simulated','iOS','iOS','iPhone 17','Shutdown',1,0)")
    c.commit()

    # computed groups
    real = {d["id"] for d in m._resolve_many_raw("real")}
    mine = {d["id"] for d in m._resolve_many_raw("mine")}
    check("'real' group = test-pool real devices", real == {"SER-A"})
    check("'mine' group = personal real devices", mine == {"UD-I"})

    # is_real
    check("is_real True for real row", m.is_real({"id": "SER-A"}) is True)
    check("is_real False for sim row", m.is_real({"id": "SIM-1"}) is False)

    # refuse_on_real returns True for a real device AND prints a refusal to stderr; suppress
    # that expected message so the self-test output stays clean (it's not an error).
    with contextlib.redirect_stderr(io.StringIO()):
        refused_real = m.refuse_on_real({"id": "SER-A", "name": "Pixel 8"}, "start")
        refused_sim = m.refuse_on_real({"id": "SIM-1", "name": "iPhone 17"}, "start")
    check("refuse_on_real True for real", refused_real is True)
    check("refuse_on_real False for sim", refused_sim is False)

    # claim_state transitions
    row = c.execute("SELECT * FROM devices WHERE udid='SER-A'").fetchone()
    check("claim_state free when unclaimed", m.claim_state(row)[0] == "free")
    c.execute("UPDATE devices SET claim_owner='qa', claim_pid=?, claim_heartbeat_at=? WHERE udid='SER-A'",
              (os.getpid(), m.now_iso()))
    c.commit()
    row = c.execute("SELECT * FROM devices WHERE udid='SER-A'").fetchone()
    check("claim_state held for live pid + fresh hb", m.claim_state(row)[0] == "held")
    c.execute("UPDATE devices SET claim_pid=999999 WHERE udid='SER-A'")
    c.commit()
    row = c.execute("SELECT * FROM devices WHERE udid='SER-A'").fetchone()
    check("claim_state stale for dead pid", m.claim_state(row)[0] == "stale")
    m.release_claim(pid=999999)
    row = c.execute("SELECT claim_owner FROM devices WHERE udid='SER-A'").fetchone()
    check("release_claim by pid clears owner", row["claim_owner"] is None)

    # filters
    m.FILTER_FLAVOR, m.FILTER_PLATFORM = "real", None
    check("--real filter keeps only real", {d["id"] for d in m._resolve_many_raw("all")} == {"SER-A", "UD-I"})
    m.FILTER_FLAVOR, m.FILTER_PLATFORM = None, "ios"
    check("--ios filter keeps only iOS", {d["id"] for d in m._resolve_many_raw("all")} == {"UD-I", "SIM-1"})
    m.FILTER_FLAVOR = m.FILTER_PLATFORM = None

    print(f"\nselftest_manage_devices: {_passed} passed, {_failed} failed")
    return 1 if _failed else 0


if __name__ == "__main__":
    sys.exit(main())
