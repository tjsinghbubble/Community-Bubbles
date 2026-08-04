"""Offline-testable core of manage_devices: resolution, aliases, claims,
schema/migration, ini editing, AVD clone/rename on disk, renderers, filters,
sync scoping. No real toolchain calls — subprocess-facing seams are stubbed."""
import sqlite3
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest


def _seed(md, udid, *, flavor="Simulated", typ="iOS", state="Shutdown",
          present=1, personal=0, serial=None, display=None, **cols):
    # `serial` is accepted for call-site compatibility but no longer stored — the
    # devices.serial column was dropped in schema v2 (transient adb handle; now
    # derived live / cached in device_transports).
    extra_keys = "".join(f",{k}" for k in cols)
    extra_qs = ",?" * len(cols)
    md.db().execute(
        f"INSERT INTO devices(udid,flavor,type,os_name,display_name,"
        f"state,present,personal{extra_keys}) VALUES(?,?,?,?,?,?,?,?{extra_qs})",
        (udid, flavor, typ, "iOS" if typ == "iOS" else "AndroidOS",
         display or udid, state, present, personal, *cols.values()))
    md.db().commit()


# ── schema / migration ─────────────────────────────────────────────────────────

def test_fresh_db_schema_and_version(md):
    cols = {r[1] for r in md.db().execute("PRAGMA table_info(devices)")}
    assert {"personal", "claim_owner", "claim_pid", "compile_level",
            "has_default_boot", "api_level", "default_boot_windowed",
            "resolution", "density", "boot_option", "google_support"} <= cols
    assert "serial" not in cols                 # v2: dropped
    # v2 reference/resolution tables exist and ref_api_level is seeded ('API NN').
    tabs = {r[0] for r in md.db().execute(
        "SELECT name FROM sqlite_master WHERE type='table'")}
    assert {"ref_api_level", "device_transports"} <= tabs
    apis = {r[0] for r in md.db().execute("SELECT name FROM ref_api_level")}
    assert {"API 34", "API 37"} <= apis
    ver = md.db().execute("PRAGMA user_version").fetchone()[0]
    assert ver == md.hmd.SCHEMA_VERSION


def test_migrate_db_upgrades_legacy(tmp_path, md):
    legacy = sqlite3.connect(tmp_path / "legacy.db")
    # A v0 devices table that still carries the old `serial` column + a row using it.
    legacy.execute("CREATE TABLE devices (udid TEXT PRIMARY KEY, flavor TEXT,"
                   " type TEXT, os_name TEXT, state TEXT, present INTEGER, serial TEXT)")
    legacy.execute("INSERT INTO devices(udid,serial) VALUES('ZL1','ZL1')")
    md.hmd.migrate_db(legacy)
    cols = {r[1] for r in legacy.execute("PRAGMA table_info(devices)")}
    assert {"compile_level", "claim_heartbeat_at", "personal", "api_level"} <= cols
    assert "serial" not in cols                 # v2: dropped, row preserved
    assert legacy.execute("SELECT udid FROM devices").fetchone()[0] == "ZL1"
    assert legacy.execute("PRAGMA user_version").fetchone()[0] == md.hmd.SCHEMA_VERSION
    legacy.close()


# ── android api level / os_version (no API-string leakage into os_version) ─────

def test_api_level_and_release_mapping(md):
    assert md._release_from_api(34) == "14" and md._release_from_api(37) == "17"
    assert md._release_from_api(999) is None    # unknown → None, never 'API 999'
    assert md._api_level_str(37) == "API 37" and md._api_level_str("34") == "API 34"
    assert md._api_level_str(None) is None and md._api_level_str("") is None


def test_android_real_canonical_identity_and_transports(md, monkeypatch):
    """One phone on USB *and* WiFi collapses to a single dict keyed by ro.serialno;
    both live handles are recorded, WiFi supplies ipv4, USB is the primary handle."""
    monkeypatch.setattr(md.htc, "capabilities", lambda: {"adb": True, "xcode": False})
    monkeypatch.setattr(md, "_adb_serials", lambda: [
        ("ZL8325PRBD", False, False, True),         # USB
        ("192.168.4.60:5555", False, True, True)])  # WiFi (same phone)
    props = {"ro.serialno": "ZL8325PRBD", "ro.kernel.qemu": "",
             "ro.product.model": "moto g play - 2024",
             "ro.build.version.release": "14", "ro.build.version.sdk": "34"}
    monkeypatch.setattr(md, "_getprop", lambda serial, prop: props.get(prop, ""))
    devs = md.android_real()
    assert len(devs) == 1
    d = devs[0]
    assert d["id"] == "ZL8325PRBD" and d["serial"] == "ZL8325PRBD"    # USB primary
    assert d["api_level"] == "API 34" and d["os_version"] == "14"
    assert d["ipv4"] == "192.168.4.60"
    assert {h for h, *_ in d["transports"]} == {"ZL8325PRBD", "192.168.4.60:5555"}


def test_upsert_records_transports_and_api_level(md, monkeypatch):
    monkeypatch.setattr(md, "allocate_name", lambda udid: None)
    md._upsert_live_device({
        "kind": "android", "id": "ZL8325PRBD", "serial": "ZL8325PRBD",
        "name": "moto g play - 2024", "os_version": "14", "api_level": "API 34",
        "flavor": "Real", "manufacturer": "motorola", "model": "moto g play - 2024",
        "ipv4": "192.168.4.60", "state": "Running",
        "transports": [("ZL8325PRBD", "usb", None, None),
                       ("192.168.4.60:5555", "wifi", "192.168.4.60", 5555)],
    }, "2026-07-23T00:00:00+00:00")
    row = md.db().execute("SELECT api_level, ipv4 FROM devices WHERE udid='ZL8325PRBD'"
                          ).fetchone()
    assert row["api_level"] == "API 34" and row["ipv4"] == "192.168.4.60"
    # A later WiFi-only handle resolves to the canonical udid via the cache (no probe).
    assert md._resolve_handle_udid("192.168.4.60:5555") == "ZL8325PRBD"


def test_human_names_unique_and_seeded(md):
    names = md.human_names()
    assert len(names) == len(set(names)) > 300
    pool = md.db().execute("SELECT COUNT(*) FROM name_pool").fetchone()[0]
    assert pool == len(names)


# ── kv / history / claims ──────────────────────────────────────────────────────

def test_kv_roundtrip_and_overwrite(md):
    assert md.kv_get("nope", "dflt") == "dflt"
    md.kv_set("k", "v1")
    md.kv_set("k", "v2")
    assert md.kv_get("k") == "v2"


def test_log_history_row(md):
    md.log_history("U1", "warmup", detail="start:optimized", duration_ms=1234)
    r = md.db().execute("SELECT * FROM history").fetchone()
    assert (r["udid"], r["event"], r["duration_ms"]) == ("U1", "warmup", 1234)


def test_claim_state_transitions(md):
    import os
    free = {"claim_owner": None, "claim_pid": None, "claim_heartbeat_at": None}
    assert md.claim_state(free)[0] == "free"
    held = {"claim_owner": "qa", "claim_pid": os.getpid(),
            "claim_heartbeat_at": md.now_iso()}
    assert md.claim_state(held)[0] == "held"
    dead = dict(held, claim_pid=99999999)
    assert md.claim_state(dead)[0] == "stale"
    old_hb = (datetime.now(timezone.utc)
              - timedelta(seconds=md.CLAIM_TTL_SECONDS + 60)).isoformat()
    stale_hb = dict(held, claim_heartbeat_at=old_hb)
    assert md.claim_state(stale_hb)[0] == "stale"


def test_release_claim_by_pid(md):
    _seed(md, "D1", flavor="Real", typ="Android",
          claim_owner="qa", claim_pid=4242, claim_heartbeat_at=md.now_iso())
    assert md.release_claim(pid=4242) == 0
    assert md.db().execute(
        "SELECT claim_owner FROM devices WHERE udid='D1'").fetchone()[0] is None


# ── name allocation ────────────────────────────────────────────────────────────

def test_allocate_name_idempotent(md):
    n1 = md.allocate_name("UD-1")
    n2 = md.allocate_name("UD-1")
    assert n1 == n2 and n1 in md.human_names()


def test_allocate_name_reuses_existing_alias(md):
    # a device already carrying a user alias must NOT get a second human name
    # (the --copy 'Lainey'+'Esther' double-name bug)
    md.db().execute("INSERT INTO aliases(alias,udid,kind,created_at)"
                    " VALUES('Zeus','UD-2','user',?)", (md.now_iso(),))
    md.db().commit()
    assert md.allocate_name("UD-2") == "Zeus"


# ── identifier resolution (offline: idx={} / stubbed probes) ───────────────────

def test_resolve_invalid_uuid_rejected(md):
    with pytest.raises(md.ResolveError, match="invalid iOS UUID"):
        md._resolve_many_raw("ABC-123", idx={})


def test_resolve_unknown_identifier(md):
    with pytest.raises(md.ResolveError, match="unknown identifier"):
        md._resolve_many_raw("NoSuchAVD", idx={})


def test_resolve_uuid_via_db_fallback(md):
    u = "8020A3AC-E330-495C-8C27-870188656C0A"
    _seed(md, u, display="iPhone 16 Pro")
    (d,) = md._resolve_many_raw(f"({u[:8]}) {u[8:]}", idx={})  # parens/space trimmed
    assert d["id"] == u and d["kind"] == "ios"


def test_resolve_stored_alias_case_insensitive(md):
    _seed(md, "AVD_X", typ="Android")
    md.db().execute("INSERT INTO aliases(alias,udid,kind,created_at)"
                    " VALUES('Liam','AVD_X','name',?)", (md.now_iso(),))
    md.db().commit()
    (d,) = md._resolve_many_raw("liam", idx={})
    assert d["id"] == "AVD_X" and d["kind"] == "android"


def test_resolve_groups_mine_real_all(md):
    _seed(md, "PHONE-T", flavor="Real", typ="Android", state="Running", personal=0)
    _seed(md, "PHONE-P", flavor="Real", typ="iOS", state="Running", personal=1)
    _seed(md, "SIM-1", typ="iOS")
    assert {d["id"] for d in md._resolve_many_raw("real", idx={})} == {"PHONE-T"}
    assert {d["id"] for d in md._resolve_many_raw("mine", idx={})} == {"PHONE-P"}
    assert {d["id"] for d in md._resolve_many_raw("all", idx={})} == {
        "PHONE-T", "PHONE-P", "SIM-1"}
    assert {d["id"] for d in md._resolve_many_raw("all-ios", idx={})} == {
        "PHONE-P", "SIM-1"}
    assert {d["id"] for d in md._resolve_many_raw("all-android", idx={})} == {
        "PHONE-T"}


def test_resolve_groups_empty_raise(md):
    with pytest.raises(md.ResolveError, match="no present devices"):
        md._resolve_many_raw("all", idx={})
    with pytest.raises(md.ResolveError, match="no matching real devices"):
        md._resolve_many_raw("mine", idx={})


def test_resolve_all_respects_filters(md):
    _seed(md, "PHONE-T", flavor="Real", typ="Android", state="Running")
    _seed(md, "SIM-1", typ="iOS")
    md.FILTER_FLAVOR = "real"
    try:
        assert {d["id"] for d in md._resolve_many_raw("all", idx={})} == {"PHONE-T"}
    finally:
        md.FILTER_FLAVOR = None


def test_resolve_last_ios(md):
    _seed(md, "SIM-9", typ="iOS")
    with pytest.raises(md.ResolveError, match="no last-ios recorded"):
        md._resolve_many_raw("last-ios", idx={})
    md.kv_set("last_ios", "SIM-9")
    (d,) = md._resolve_many_raw("last-ios", idx={})
    assert d["id"] == "SIM-9"


def test_resolve_platform_default_single_and_ambiguous(md, monkeypatch):
    one = {"kind": "ios", "id": "U-1", "serial": None, "name": "A",
           "os_version": "26.5", "state": "Running"}
    monkeypatch.setattr(md, "ios_booted", lambda: [one])
    assert md._resolve_many_raw("ios", idx={}) == [one]
    monkeypatch.setattr(md, "ios_booted", lambda: [one, dict(one, id="U-2")])
    with pytest.raises(md.ResolveError, match="ambiguous"):
        md._resolve_many_raw("ios", idx={})


def test_resolve_many_drops_unreachable_real(md, monkeypatch):
    _seed(md, "PHONE-A", flavor="Real", typ="Android", state="Running")
    _seed(md, "PHONE-B", flavor="Real", typ="Android", state="Running")
    monkeypatch.setattr(md, "reachable", lambda d: d["id"] == "PHONE-B")
    kept = md.resolve_many("real", idx={})
    assert [d["id"] for d in kept] == ["PHONE-B"]
    monkeypatch.setattr(md, "reachable", lambda d: False)
    with pytest.raises(md.ResolveError, match="unreachable"):
        md.resolve_many("real", idx={})


# ── adb parsing / discovery seams ──────────────────────────────────────────────

ADB_OUT = ("List of devices attached\n"
           "emulator-5554\tdevice\n"
           "192.168.56.101:5555\tdevice\n"
           "ZL8325PRBD\tdevice\n"
           "ZL9999NOAUTH\tunauthorized\n"
           "dead-device\toffline\n")


def test_adb_serials_classification(md, monkeypatch):
    """State 'device' → authorized; 'unauthorized' → included with authorized=False
    (an attached phone belongs in the running list even before the RSA dialog);
    'offline' etc. are still skipped."""
    monkeypatch.setattr(md, "run",
                        lambda cmd, capture=True: SimpleNamespace(stdout=ADB_OUT))
    assert md._adb_serials() == [("emulator-5554", True, False, True),
                                 ("192.168.56.101:5555", False, True, True),
                                 ("ZL8325PRBD", False, False, True),
                                 ("ZL9999NOAUTH", False, False, False)]


def test_android_real_uses_getprop(md, monkeypatch):
    monkeypatch.setattr(md.htc, "capabilities",
                        lambda: {"adb": True, "xcode": False})
    monkeypatch.setattr(md, "_adb_serials",
                        lambda: [("ZL1", False, False, True),
                                 ("emulator-5554", True, False, True)])
    props = {"ro.product.manufacturer": "motorola",
             "ro.product.model": "moto g play",
             "ro.build.version.release": "14"}
    monkeypatch.setattr(md, "_getprop", lambda serial, prop: props.get(prop, ""))
    (d,) = md.android_real()
    assert d["id"] == "ZL1" and d["flavor"] == "Real" and d["model"] == "moto g play"


def test_android_real_unauthorized_attached_phone(md, monkeypatch):
    """An adb-unauthorized phone is still ATTACHED: it must surface as a Real device
    with state 'Unauthorized' (→ RUNNING section, flagged), its fields recovered from
    the stored DB row since every getprop fails, and it must count as live but NOT
    running/reachable (nothing can execute on it)."""
    _seed(md, "ZL1", flavor="Real", typ="Android", serial="ZL1",
          display="moto g play - 2024", model="moto g play - 2024",
          os_version="14")
    monkeypatch.setattr(md.htc, "capabilities",
                        lambda: {"adb": True, "xcode": False})
    monkeypatch.setattr(md, "_adb_serials", lambda: [("ZL1", False, False, False)])
    monkeypatch.setattr(md, "_getprop", lambda serial, prop: "")   # unauthorized: all fail
    (d,) = md.android_real()
    assert d["id"] == "ZL1" and d["flavor"] == "Real"
    assert d["state"] == "Unauthorized"
    assert d["name"] == "moto g play - 2024" and d["model"] == "moto g play - 2024"
    assert d["os_version"] == "14"
    assert md.is_live(d) and not md.is_running(d)
    assert md._state_label(d) == "Unauthorized"
    assert md.reachable(d) is False


def test_reachable_real_android(md, monkeypatch):
    _seed(md, "ZL1", flavor="Real", typ="Android", serial="ZL1")
    monkeypatch.setattr(md, "_adb_serials", lambda: [("ZL1", False, False, True)])
    assert md.reachable({"kind": "android", "id": "ZL1", "serial": "ZL1"}) is True
    monkeypatch.setattr(md, "_adb_serials", lambda: [])
    assert md.reachable({"kind": "android", "id": "ZL1", "serial": "ZL1"}) is False


# ── sync scoping (the --ios/--android skip contract) ───────────────────────────

@pytest.fixture()
def quiet_discovery(md, monkeypatch):
    for fn in ("ios_devices", "ios_real", "android_all", "android_real"):
        monkeypatch.setattr(md, fn, lambda: [])
    return md


def test_scoped_sync_never_zeroes_other_platform(quiet_discovery):
    md = quiet_discovery
    _seed(md, "SIM-IOS", typ="iOS")
    _seed(md, "AVD-AND", typ="Android")
    md.sync(platform="android")           # android probe sees nothing
    rows = {r["udid"]: r["present"] for r in
            md.db().execute("SELECT udid,present FROM devices")}
    assert rows == {"SIM-IOS": 1, "AVD-AND": 0}   # iOS untouched, android gone


def test_simulated_sync_never_offlines_real(quiet_discovery):
    md = quiet_discovery
    _seed(md, "PHONE", flavor="Real", typ="Android", state="Running")
    md.sync(flavor="simulated")
    assert md.db().execute("SELECT state FROM devices WHERE udid='PHONE'"
                           ).fetchone()[0] == "Running"
    md.sync()                              # full sync DOES reconcile it
    assert md.db().execute("SELECT state FROM devices WHERE udid='PHONE'"
                           ).fetchone()[0] == "Offline"


def test_real_sync_never_hides_sims(quiet_discovery):
    md = quiet_discovery
    _seed(md, "SIM-1", typ="iOS")
    md.sync(flavor="real")
    assert md.db().execute("SELECT present FROM devices WHERE udid='SIM-1'"
                           ).fetchone()[0] == 1


def test_sync_upserts_and_names(md, monkeypatch):
    live = [{"kind": "ios", "id": "U-NEW", "serial": None, "name": "iPhone 20",
             "os_version": "27.0", "state": "Booted"}]
    monkeypatch.setattr(md, "ios_devices", lambda: live)
    for fn in ("ios_real", "android_all", "android_real"):
        monkeypatch.setattr(md, fn, lambda: [])
    md.sync()
    row = md.db().execute("SELECT * FROM devices WHERE udid='U-NEW'").fetchone()
    assert row["type"] == "iOS" and row["present"] == 1 and row["state"] == "Booted"
    assert md.aliases_for("U-NEW")         # auto human name allocated


# ── filters / small pure helpers ───────────────────────────────────────────────

def test_apply_filters(md):
    _seed(md, "PHONE", flavor="Real", typ="Android")
    devs = [{"kind": "ios", "id": "A"}, {"kind": "android", "id": "PHONE"}]
    md.FILTER_PLATFORM, md.FILTER_FLAVOR = "ios", None
    assert [d["id"] for d in md._apply_filters(devs)] == ["A"]
    md.FILTER_PLATFORM, md.FILTER_FLAVOR = None, "real"
    assert [d["id"] for d in md._apply_filters(devs)] == ["PHONE"]
    md.FILTER_PLATFORM = md.FILTER_FLAVOR = None
    assert md._apply_filters(devs) == devs


def test_norm_state_and_release_map(md):
    assert md._norm_state("Booted") == "Running"
    assert md._norm_state("Running") == "Running"
    assert md._norm_state("Shutting Down") == "Shutdown"
    assert md._release_from_api(34) == "14"
    assert md._release_from_api(37) == "17"
    assert md._release_from_api(99) is None      # unknown → None (never leaks into os_version)
    assert md._release_from_api(None) is None


def test_maestro_id(md):
    assert md._maestro_id({"kind": "android", "serial": "emulator-5554"}) == "emulator-5554"
    assert md._maestro_id({"kind": "android", "serial": None}) is None
    assert md._maestro_id({"kind": "ios", "id": "UUID-1"}) == "UUID-1"


def test_cap_and_color(md, monkeypatch):
    assert md._cap("x" * 40) == "x" * (md.DEVICE_CAP - 1) + "…"
    assert md._cap("short") == "short"
    # middle-elide keeps a long UUID's head AND tail
    assert md._mid("8020A3AC-E330-495C-8C27-870188656C0A", 16) == "8020A3A…88656C0A"
    monkeypatch.setattr(md, "_USE_COLOR", False)
    assert md._c("t", 1) == "t"
    monkeypatch.setattr(md, "_USE_COLOR", True)
    assert md._c("t", 1) == "\033[1mt\033[0m"


def test_table_widths(md):
    assert md._table_widths(["ab", "c"], [["x", "yyyy"], ["zzz", ""]]) == [3, 4]


def test_section_layout(md):
    """AVAILABLE renames Kind→OS / Ready→Optimized and drops State; RUNNING keeps
    the full column set (State varies there: Running/Booting/Unauthorized)."""
    hdrs, cols = md._section_layout("RUNNING")
    assert hdrs == md.SHORT_HEADERS and len(cols) == len(md.SHORT_HEADERS)
    hdrs, cols = md._section_layout("AVAILABLE")
    assert hdrs == md.AVAILABLE_HEADERS
    assert "State" not in hdrs and "Kind" not in hdrs and "Ready" not in hdrs
    assert "OS" in hdrs and "Optimized" in hdrs
    assert md.STATE_COL not in cols and len(hdrs) == len(cols)


def test_order_within_descending_os_then_device(md):
    """Rows sort by DESCENDING OS version (numeric, '26.5' > '18.6' > '9'), then
    DESCENDING Device name within the same version."""
    devs = [
        {"kind": "ios", "id": "A", "name": "iPad Air", "os_version": "18.6"},
        {"kind": "ios", "id": "B", "name": "iPhone 17", "os_version": "26.5"},
        {"kind": "ios", "id": "C", "name": "iPhone Air", "os_version": "26.5"},
        {"kind": "ios", "id": "D", "name": "iPhone 16e", "os_version": "9"},
        {"kind": "ios", "id": "E", "name": "iPhone 16", "os_version": None},
    ]
    assert [d["id"] for d in md._order_within(devs)] == ["C", "B", "A", "D", "E"]


def test_display_short_prefers_model_for_real(md):
    """A real device's Device cell is the HARDWARE model, not the personal name
    ('Schmante' stays in display_name/aliases); sims keep display_name."""
    real = {"kind": "ios", "id": "U1", "flavor": "Real", "model": "iPhone 14 Pro"}
    assert md._display_short(real, None) == "iPhone 14 Pro"
    _seed(md, "U2", flavor="Real", typ="iOS", display="Schmante",
          model="iPhone 14 Pro")
    row = md.db().execute("SELECT * FROM devices WHERE udid='U2'").fetchone()
    assert md._display_short({"kind": "ios", "id": "U2"}, row) == "iPhone 14 Pro"
    sim = {"kind": "ios", "id": "U3", "name": "iPhone 16 / iOS 18.6"}
    assert md._display_short(sim, None) == "iPhone 16"


BOOTSTATUS_FEED = (
    "Monitoring boot status for iPhone 17 Pro Max / 26.5 (8A5DD49C).\n"
    "[2026-08-04 20:34:05 +0000] Status=1, isTerminal=NO, Elapsed=00:03.\n"
    "\tWaiting on BackBoard\n"
    "\n"
    "[2026-08-04 20:34:10 +0000] Status=4, isTerminal=NO, Elapsed=00:09.\n"
    "\tWaiting on System App\n"
    "\n"
    "[2026-08-04 20:34:20 +0000] Status=4, isTerminal=NO, Elapsed=00:19.\n"
    "\tWaiting on System App\n"
    "\n"
    "[2026-08-04 20:34:28 +0000] Status=4294967295, isTerminal=YES, Elapsed=00:26.\n"
    "\tFinished\n")


def _fake_popen(feed):
    return lambda *a, **k: SimpleNamespace(stdout=iter(feed.splitlines(True)),
                                           wait=lambda: 0)


def test_stream_bootstatus_parses_dedupes_and_signs(md, monkeypatch, capsys):
    """Monitor entries re-emit as narrated '[not] ready for use: <detail>' lines,
    consecutive repeats collapse, and the unsigned -1 status prints signed."""
    monkeypatch.setattr(md.subprocess, "Popen", _fake_popen(BOOTSTATUS_FEED))
    final = md._stream_bootstatus("8A5DD49C")
    assert final == (-1, True, "Finished")
    out = capsys.readouterr().out
    lines = [l.split("    ", 1)[1] for l in out.splitlines()]   # strip HH:MM:SS.mmm
    assert lines == ["    not ready for use: Waiting on BackBoard",
                     "    not ready for use: Waiting on System App",
                     "    ready for use: Finished"]
    assert "4294967295" not in out


def test_stream_bootstatus_surfaces_nonzero_terminal_status(md, monkeypatch, capsys):
    feed = ("[2026-08-04 21:19:45 +0000] Status=3, isTerminal=YES, Elapsed=00:11.\n"
            "\tData Migration Failed\n")
    monkeypatch.setattr(md.subprocess, "Popen", _fake_popen(feed))
    assert md._stream_bootstatus("X") == (3, True, "Data Migration Failed")
    assert "ready for use: Data Migration Failed (status 3)" in capsys.readouterr().out


def test_boot_ios_reprobes_actual_state(md, monkeypatch):
    """Readiness comes from a FRESH simctl probe, not the stale pre-boot dict
    (bug: every fresh boot was declared NOT ready) and not bootstatus's verdict."""
    monkeypatch.setattr(md, "run", lambda cmd, capture=True: SimpleNamespace(stdout=""))
    monkeypatch.setattr(md, "_stream_bootstatus", lambda udid: (-1, True, "Finished"))
    monkeypatch.setattr(md, "_ios_sim_state", lambda udid: "Running")
    dev = {"kind": "ios", "id": "U1", "name": "iPhone Air / 26.5", "state": "Shutdown"}
    ok, reason = md._boot_ios(dev, "optimized")
    assert ok and reason is None and dev["state"] == "Running"
    # sim never reaches Booted → honest failure (no sleep: stub the retry clock)
    monkeypatch.setattr(md.time, "sleep", lambda s: None)
    monkeypatch.setattr(md, "_ios_sim_state", lambda udid: "Shutdown")
    dev = {"kind": "ios", "id": "U1", "name": "iPhone Air / 26.5", "state": "Shutdown"}
    ok, reason = md._boot_ios(dev, "optimized")
    assert not ok and "Booted" in reason


def test_shortest_alias_hides_platform_defaults(md):
    """'ios'/'android' never win the Name cell; the holder gets a '*' suffix;
    last-ios/last-android are ignored entirely."""
    md.db().execute("INSERT INTO aliases(alias,udid,kind) VALUES('Melody','U1','name')")
    md.db().commit()
    assert md._shortest_alias("U1", {"U1": ["ios", "last-ios"]}) == "Melody*"
    assert md._shortest_alias("U1", {"U1": ["last-ios"]}) == "Melody"
    assert md._shortest_alias("U1", {}) == "Melody"
    # no named alias at all → udid, still starred when it holds the default
    assert md._shortest_alias("U2", {"U2": ["ios"]}) == "U2*"


def test_alias_summary_humanized_first(md, monkeypatch):
    _seed(md, "U1", flavor="Simulated", typ="iOS", display="iPhone Air / 26.5")
    md.db().execute("INSERT INTO aliases(alias,udid,kind) VALUES('Skylar','U1','name')")
    md.db().commit()
    monkeypatch.setattr(md, "_system_alias_map",
                        lambda live=None: {"U1": ["ios", "last-ios"]})
    dev = {"kind": "ios", "id": "U1", "name": "iPhone Air / 26.5"}
    assert md._alias_summary(dev) == "Skylar, ios, iPhone Air"


def test_ios_real_model_enrichment(md, monkeypatch):
    """ios_real swaps the xctrace personal-name 'model' for the devicectl marketing
    model when available; name keeps the personal device name."""
    monkeypatch.setattr(md.htc, "capabilities", lambda: {"adb": False, "xcode": True})
    xctrace = ("== Devices ==\n"
               "MacBook Pro (AAAAAAAA-111122223333444455556666)\n"
               "Schmante (26.5.2) (00008120-001A795A14D0C01E)\n"
               "== Simulators ==\n")
    monkeypatch.setattr(md, "run",
                        lambda cmd, capture=True: SimpleNamespace(stdout=xctrace))
    monkeypatch.setattr(md, "_ios_real_models",
                        lambda: {"00008120-001A795A14D0C01E": "iPhone 14 Pro"})
    (d,) = md.ios_real()
    assert d["name"] == "Schmante" and d["model"] == "iPhone 14 Pro"
    # devicectl absent → keep the xctrace fallback (personal name)
    monkeypatch.setattr(md, "_ios_real_models", lambda: {})
    (d,) = md.ios_real()
    assert d["model"] == "Schmante"


def test_ready_marker(md):
    def r(compile_level, has_default_boot, windowed=0):
        return {"compile_level": compile_level, "has_default_boot": has_default_boot,
                "default_boot_windowed": windowed}
    running = {"state": "Running"}
    down = {"state": "Shutdown"}
    assert md._ready_marker(down, r("hot", 1)) == "baked/hot"
    assert md._ready_marker(down, r(None, 1)) == "baked"
    assert md._ready_marker(down, r("hot", 0)) == "compiled/hot"
    assert md._ready_marker(running, r(None, 0)) == "live"
    assert md._ready_marker(down, r(None, 0)) == ""
    # windowed-baked snapshots read as +win (they quick-boot windowed → fast + visible)
    assert md._ready_marker(down, r(None, 1, windowed=1)) == "baked+win"
    assert md._ready_marker(down, r("hot", 1, windowed=1)) == "baked/hot+win"


# ── relative-time rendering ────────────────────────────────────────────────────

def test_coarse_when_buckets(md):
    morning = datetime(2026, 7, 15, 9, 0)
    evening = datetime(2026, 7, 15, 20, 0)
    assert md._coarse_when(30 * 60, 0, morning) == "within the hour"
    assert md._coarse_when(4 * 3600, 0, morning) == "this morning"
    assert md._coarse_when(4 * 3600, 1, evening) == "last evening"
    assert md._coarse_when(10 * 3600, 1, morning) == "yesterday morning"
    assert md._coarse_when(4 * 3600, 0, morning.replace(hour=3)) == "early this morning"
    assert md._coarse_when(20 * 3600, 0, morning) == "Today"
    assert md._coarse_when(30 * 3600, 1, morning) == "Yesterday"
    # 2+ days: weekday names dropped (ambiguous near a week) → absolute date
    assert md._coarse_when(2 * 86400, 2, morning) is None
    assert md._coarse_when(4 * 86400, 4, morning) is None
    assert md._coarse_when(7 * 86400, 8, morning) is None


def test_relative_last_used_end_to_end(md):
    now = datetime.now(timezone.utc)
    recent = {"last_used": (now - timedelta(minutes=10)).isoformat()}
    label = md._relative_last_used(recent)
    assert label.startswith("within the hour (") and label.endswith(")")
    assert md._relative_last_used(None) == ""
    assert md._relative_last_used({"last_used": None}) == ""
    assert md._relative_last_used(
        {"last_used": (now + timedelta(hours=1)).isoformat()}) == "just now"
    old = {"last_used": (now - timedelta(days=30)).isoformat()}
    label = md._relative_last_used(old)
    assert label.count("-") == 2 and ":" not in label       # date-only, no HH:MM
    assert len(label) == 10                                 # YYYY-MM-DD
    assert md._relative_last_used({"last_used": "garbage"}) == "garbage"[:10]


# ── ini editing + AVD clone/rename on disk ─────────────────────────────────────

def test_edit_ini_replace_and_append(md, tmp_path):
    ini = tmp_path / "config.ini"
    ini.write_text("AvdId=old\nhw.gpu.mode=host\nkeep=1\n")
    md._edit_ini(ini, {"AvdId": "new"})
    assert ini.read_text() == "AvdId=new\nhw.gpu.mode=host\nkeep=1\n"
    md._edit_ini(ini, {"hw.gpu.mode": "auto", "hw.gpu.enabled": "yes"},
                 append_missing=True)
    assert "hw.gpu.mode=auto" in ini.read_text()
    assert ini.read_text().rstrip().endswith("hw.gpu.enabled=yes")
    md._edit_ini(tmp_path / "missing.ini", {"a": "b"})      # silent no-op


def _mk_avd(home, name, with_snapshots=True):
    root = home / ".android" / "avd"
    (root / f"{name}.avd").mkdir(parents=True)
    (root / f"{name}.avd" / "config.ini").write_text(
        f"AvdId={name}\navd.ini.displayname={name}\nhw.gpu.mode=host\n")
    if with_snapshots:
        (root / f"{name}.avd" / "snapshots" / "default_boot").mkdir(parents=True)
    (root / f"{name}.ini").write_text(f"path=/x/{name}.avd\n")
    return root


def test_clone_avd_on_disk(md, tmp_path, monkeypatch):
    monkeypatch.setenv("HOME", str(tmp_path))
    root = _mk_avd(tmp_path, "Src")
    md.clone_avd("Src", "Dst")
    cfg = (root / "Dst.avd" / "config.ini").read_text()
    assert "AvdId=Dst" in cfg and "avd.ini.displayname=Dst" in cfg
    assert "hw.gpu.mode=auto" in cfg                       # normalized
    # .ini path= is rewritten to the canonical dst dir (not a stale/bogus src path)
    assert (root / "Dst.ini").read_text() == f"path={root / 'Dst.avd'}\n"
    assert not (root / "Dst.avd" / "snapshots").exists()   # clone cold-boots
    assert (root / "Src.avd").exists()                     # source untouched
    with pytest.raises(FileExistsError):
        md.clone_avd("Src", "Dst")
    with pytest.raises(FileNotFoundError):
        md.clone_avd("Nope", "Other")


def test_rename_avd_on_disk(md, tmp_path, monkeypatch):
    monkeypatch.setenv("HOME", str(tmp_path))
    root = _mk_avd(tmp_path, "Old")
    md.rename_avd("Old", "New")
    assert not (root / "Old.avd").exists() and not (root / "Old.ini").exists()
    cfg = (root / "New.avd" / "config.ini").read_text()
    assert "AvdId=New" in cfg
    assert (root / "New.avd" / "snapshots").exists()       # rename PRESERVES state


def test_rename_avd_when_ini_path_differs_from_name(md, tmp_path, monkeypatch):
    """The bug: an AVD whose .ini `path=` points at a DIFFERENTLY-named dir (not
    <name>.avd). _avd_dir must follow path=, so rename resolves the real dir."""
    monkeypatch.setenv("HOME", str(tmp_path))
    root = tmp_path / ".android" / "avd"
    (root / "RealDir.avd").mkdir(parents=True)
    (root / "RealDir.avd" / "config.ini").write_text("AvdId=x\nhw.gpu.mode=host\n")
    (root / "Oakley.ini").write_text(f"path={root / 'RealDir.avd'}\n")  # name != dir
    assert md._avd_dir("Oakley") == root / "RealDir.avd"
    md.rename_avd("Oakley", "Smokey")
    assert (root / "Smokey.avd" / "config.ini").exists()    # moved to canonical dir
    assert not (root / "Oakley.ini").exists()
    assert (root / "Smokey.ini").read_text() == f"path={root / 'Smokey.avd'}\n"


def test_windowed_bake_boot_decision(md):
    """A windowed --start cold-boots UNLESS a WINDOWED default_boot snapshot exists
    to quick-boot; --bake:windowed records default_boot_windowed=1."""
    _seed(md, "AVD_W", typ="Android", has_default_boot=1, default_boot_windowed=1)
    _seed(md, "AVD_H", typ="Android", has_default_boot=1, default_boot_windowed=0)
    _seed(md, "AVD_N", typ="Android")                       # no snapshot at all
    assert md._windowed_start_is_cold({"id": "AVD_W"}) is False   # quick-boot windowed snap
    assert md._windowed_start_is_cold({"id": "AVD_H"}) is True    # cold (headless snap)
    assert md._windowed_start_is_cold({"id": "AVD_N"}) is True    # cold (no snap)


def test_emulator_flags_cold_and_windowed_bake(md):
    assert "-no-snapshot-load" in md.emulator_flags(cold=True)
    assert "-no-snapshot-load" not in md.emulator_flags(cold=False)
    # windowed bake: WRITABLE (can save, so no -no-snapshot-save), windowed (no
    # -no-window), cold (fresh boot ⇒ the snapshot carries a real display surface)
    wf = md.emulator_flags(headless=False, writable=True, cold=True)
    assert "-no-window" not in wf and "-no-snapshot-save" not in wf
    assert "-no-snapshot-load" in wf
    # headless start: -no-window + -read-only, quick-boots (no -no-snapshot-load)
    hf = md.emulator_flags(headless=True)
    assert "-no-window" in hf and "-read-only" in hf and "-no-snapshot-load" not in hf


def test_avd_snapshot_state_from_disk(md, tmp_path, monkeypatch):
    """Reconcile has_default_boot / default_boot_windowed from disk: no snapshot →
    (0,0); a tiny screenshot → headless (1,0); a large one → windowed (1,1)."""
    monkeypatch.setenv("HOME", str(tmp_path))
    root = tmp_path / ".android" / "avd"

    def mk(name, shot_bytes=None):
        d = root / f"{name}.avd"
        d.mkdir(parents=True)
        (root / f"{name}.ini").write_text(f"path={d}\n")
        if shot_bytes is not None:
            snap = d / "snapshots" / "default_boot"
            snap.mkdir(parents=True)
            (snap / "screenshot.png").write_bytes(b"x" * shot_bytes)

    mk("NoSnap")
    mk("Tiny", 2000)                        # tiny ⇒ AMBIGUOUS ⇒ don't override stored flag
    mk("Win", 60 * 1024)                    # large ⇒ rendered ⇒ upgrade to windowed
    assert md._avd_snapshot_state("NoSnap") == (0, 0)
    assert md._avd_snapshot_state("Tiny") == (1, None)   # None ⇒ COALESCE keeps bake flag
    assert md._avd_snapshot_state("Win") == (1, 1)


def test_google_support_classification(md):
    f = md._google_support_of
    assert f({"tag.id": "google_apis_playstore", "PlayStore.enabled": "true"}) == "Full"
    assert f({"tag.id": "google_atd"}) == "ATD"            # headless CI image (black windowed)
    assert f({"tag.id": "aosp_atd"}) == "ATD"
    assert f({"tag.id": "google_apis"}) == "APIs only"
    assert f({"tag.id": "default"}) == "None"
    assert f({}) is None


# ── cmd_* handlers that stay offline ───────────────────────────────────────────

def test_cmd_loop_rejects_empty(no_sync):
    assert no_sync.cmd_loop("nightly", " , ,") == 2


def test_cmd_next_unknown_loop(md, capsys):
    assert md.cmd_next("nope") == 1
    assert "no such loop" in capsys.readouterr().err


def test_loop_cursor_wraps(md, monkeypatch):
    _seed(md, "AVD_A", typ="Android", state="Running")
    monkeypatch.setattr(md, "sync", lambda *a, **k: [])
    # A running emulator's adb serial now comes from the live probe (the stored
    # `serial` column was dropped), so surface AVD_A live with its handle.
    monkeypatch.setattr(md, "live_index", lambda: {
        "AVD_A": {"kind": "android", "id": "AVD_A", "serial": "emulator-5554",
                  "name": "AVD_A", "state": "Running"}})
    assert md.cmd_loop("l", "AVD_A,AVD_A") == 0
    assert md.cmd_next("l") == 0        # member 1
    assert md.cmd_next("l") == 0        # member 2
    assert md.cmd_next("l") == 1        # end-of-list slot, cursor resets
    assert md.cmd_next("l") == 0        # wrapped


def test_cmd_history_offline(no_sync, capsys):
    no_sync.log_history("U1", "kill")
    assert no_sync.cmd_history() == 0
    out = capsys.readouterr().out
    assert "Event" in out and "kill" in out
    no_sync.db().execute("DELETE FROM history")
    no_sync.db().commit()
    assert no_sync.cmd_history() == 0
    assert "No history" in capsys.readouterr().out


def test_cmd_kind_and_flavor_of(no_sync, capsys):
    _seed(no_sync, "AVD_K", typ="Android")
    assert no_sync.cmd_kind_of("AVD_K") == 0
    assert capsys.readouterr().out.strip() == "android"
    assert no_sync.cmd_flavor_of("AVD_K") == 0
    assert capsys.readouterr().out.strip() == "simulated"
    assert no_sync.cmd_kind_of("missing-device") == 2


def test_cmd_alias_and_rename_user_alias(no_sync, capsys):
    _seed(no_sync, "AVD_R", typ="Android")
    assert no_sync.cmd_alias("AVD_R", "speedy") == 0
    assert no_sync.cmd_rename("speedy", "zippy") == 0
    (d,) = no_sync._resolve_many_raw("zippy", idx={})
    assert d["id"] == "AVD_R"
    assert no_sync.cmd_rename("last-ios", "x") == 2        # internal alias
    assert no_sync.cmd_rename("zippy", "  ") == 2          # empty NEW


# ── argparse plumbing ──────────────────────────────────────────────────────────

def test_parser_mutual_exclusion(md):
    p = md._build_parser()
    args = p.parse_args(["-l", "--ios", "--android"])
    with pytest.raises(SystemExit):
        md._set_filters(args, p)


def test_parser_sets_filters(md):
    p = md._build_parser()
    md._set_filters(p.parse_args(["-l", "--android", "--simulated"]), p)
    assert (md.FILTER_PLATFORM, md.FILTER_FLAVOR) == ("android", "simulated")
    md.FILTER_PLATFORM = md.FILTER_FLAVOR = None


def test_dry_run_refuses_unmodeled(md, capsys):
    p = md._build_parser()
    assert md._dry_run_refused(p.parse_args(["--alias", "a", "b", "--dry-run"])) is True
    assert "no plan is modeled" in capsys.readouterr().out
    assert md._dry_run_refused(p.parse_args(["-k", "x", "--dry-run"])) is False
