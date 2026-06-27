#!/usr/bin/env python3
"""Native-functionality self-tests for manage_devices (logic level).

Runs against a THROWAWAY DB via MANAGE_DEVICES_DB (the real override) so it never
touches the developer's .device-manager DB. Invoked by scripts/check_tooling.zsh after
the syntax/import checks. Pure-logic assertions only (no real device required).

Usage: MANAGE_DEVICES_DB=<tmp> python3 scripts/helpers/selftest_manage_devices.py
"""
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent
sys.path.insert(0, str(SCRIPTS))

import manage_devices as m  # noqa: E402

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
    check("fresh DB user_version == SCHEMA_VERSION",
          c.execute("PRAGMA user_version").fetchone()[0] == m.hmd.SCHEMA_VERSION)
    check("ref_flavor seeds Real",
          "Real" in {r[0] for r in c.execute("SELECT name FROM ref_flavor")})

    # gpu decision
    check("gpu_default() == 'auto'", m.gpu_default() == "auto")
    src = (SCRIPTS / "manage_devices.py").read_text()
    code = "\n".join(l for l in src.splitlines() if not l.lstrip().startswith("#"))
    check("no swiftshader_indirect in code (comments aside)", "swiftshader" not in code)

    # seed two real devices (one personal, one test) + one sim
    c.execute("INSERT INTO devices(udid,flavor,type,os_name,display_name,serial,state,present,personal)"
              " VALUES('SER-A','Real','Android','AndroidOS','Pixel 8','SER-A','Running',1,0)")
    c.execute("INSERT INTO devices(udid,flavor,type,os_name,display_name,serial,state,present,personal)"
              " VALUES('UD-I','Real','iOS','iOS','Schmante',NULL,'Running',1,1)")
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

    # refuse_on_real returns True (and would print) for a real device
    check("refuse_on_real True for real", m.refuse_on_real({"id": "SER-A", "name": "Pixel 8"}, "start") is True)
    check("refuse_on_real False for sim", m.refuse_on_real({"id": "SIM-1", "name": "iPhone 17"}, "start") is False)

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
