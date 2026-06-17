#!/usr/bin/env python3
"""
manage_devices — one syntax to start / stop / list / loop / tune simulated
devices, backed by a small SQLite database used as a test-time oracle.

  -r, --running              list running devices (or "No running devices")
  -l, --list [-v]            list ALL devices + aliases, grouped Running then Available,
                             each in platform order; -v dumps the full record (TSV)
      --resolve ID           print the maestro device id (android adb serial / iOS UDID)
                             for an id/alias; bare id on stdout, rich line on stderr
  -s, --start ID             start device(s) with perf flags (software GPU, cores, …)
      --start:headless ID    start headless + read-only + perf flags (CI)
  -S, --start-basic ID       start device(s), legacy windowed behaviour
  -k, --kill ID              stop device(s)  (no-op if not running)
      --nuke                 stop everything, narrated, with escalation
  -w, --warmup ID            boot + wait until responsive; record timing
      --warm:low|medium|hot ID   warmup, then dexopt/compile at that level
  -c, --copy ID [ALIAS]      clone an Android AVD: ATD-ify (sdkmanager) + bake
      --copy:orig ID [ALIAS] clone a device as-is, just add the alias
      --bake ID              boot headless, apply opts, save default_boot, halt
      --save-quickboot ID    save a running AVD as its default_boot snapshot
  -m, --monitor [SECONDS]    periodically sample host-side load of all devices
  -a, --alias ID ALIAS       create a user alias for device(s)
      --loop NAME CSV        define a named, ordered loop of ids/aliases
  -n, --next [NAME]          advance the loop cursor; print the next device
  -h, --help

Identifiers
  iOS:     a 36-char UUID (parens/spaces trimmed; rejected if not 36 chars).
  Android: a free-form AVD name, e.g. Pixel_9_Pro_XL.

System aliases (computed)        User/auto aliases (stored in DB)
  ios, android                     human names (auto, e.g. "Liam"), -a aliases,
  last-ios, last-android           UDID alt-names.
  all, all-ios, all-android, loop  (the platform-agnostic `last` was removed —
                                   too ambiguous; say last-ios / last-android)

DB: $MANAGE_DEVICES_DB, default <repo>/.device-manager/devices.db (WAL, ACID).
stdlib only.
"""

import argparse
import os
import platform
import random
import re
import shutil
import signal
import sqlite3
import subprocess
import sys
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

REPO = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get("MANAGE_DEVICES_DB",
                              REPO / ".device-manager" / "devices.db"))

STOP = "\U0001F6D1"  # 🛑
END_OF_LIST = "end-of-list"

UUID_RE = re.compile(r"[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-"
                     r"[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}")

# This list of human names is for aliasing UDIDs. The list was taken by lightly
# massaging the first ~350 entries in
# https://github.com/aruljohn/popular-baby-names. Add or subtract any names you
# like, but ONLY if uniqueness is maintained.
HUMAN_NAMES_RAW = """
Olivia,Liam,Emma,Noah,Amelia,Oliver,Charlotte,Theodore,Mia,James,Sophia,Henry,
Isabella,Mateo,Evelyn,Elijah,Ava,Lucas,Sofia,William,Camila,Benjamin,Harper,
Levi,Luna,Ezra,Eleanor,Sebastian,Violet,Jack,Aurora,Daniel,Elizabeth,Samuel,
Eliana,Michael,Hazel,Ethan,Chloe,Asher,Ellie,John,Nora,Hudson,Gianna,Luca,Lily,
Leo,Emily,Elias,Aria,Owen,Scarlett,Alexander,Penelope,Dylan,Zoe,Santiago,Ella,
Julian,Avery,David,Abigail,Joseph,Mila,Matthew,Lucy,Luke,Isla,Jackson,Ivy,
Maverick,Layla,Miles,Lainey,Wyatt,Nova,Thomas,Grace,Isaac,Willow,Jacob,Riley,
Mason,Emilia,Gabriel,Naomi,Anthony,Elena,Carter,Madison,Logan,Valentina,Aiden,
Victoria,Grayson,Stella,Caleb,Delilah,Cooper,Maya,Charles,Hannah,Roman,Leah,
Josiah,Lillian,Ezekiel,Genesis,Thiago,Josephine,Isaiah,Sadie,Joshua,Adeline,
Wesley,Zoey,Jayden,Sophie,Bennett,Paisley,Christopher,Alice,Nathan,Ruby,Angel,
Eloise,Nolan,Madelyn,Waylon,Leilani,Cameron,Claire,Brooks,Addison,Andrew,Ayla,
Beau,Emery,Weston,Iris,Rowan,Eden,Adrian,Natalie,Lincoln,Maria,Enzo,Maeve,Ian,
Daisy,Kai,Vivian,Christian,Clara,Axel,Autumn,Aaron,Liliana,Theo,Everly,Silas,
Audrey,Walker,Lyla,Jonathan,Jade,Leonardo,Kinsley,Everett,Millie,Micah,Madeline,
Ryan,Josie,August,Kennedy,Gael,Athena,Robert,Melody,Jose,Caroline,Eli,Aaliyah,
Jeremiah,Anna,Luka,Sarah,Amir,Quinn,Jaxon,Lydia,Parker,Lucia,Colton,Allison,
Myles,Hailey,Adam,Ailany,Atlas,Cora,Xavier,Ariana,Easton,Jordan,Natalia,Arthur,
Gabriella,Landon,Savannah,Austin,Brooklyn,Dominic,Bella,Adriel,Georgia,Damian,
Juniper,Vincent,Alaia,River,Raelynn,Emiliano,Hadley,Jace,Rose,Archer,Julia,
Lorenzo,Serenity,Jameson,Eliza,Nicholas,Margaret,Emmett,Eva,Milo,Amara,Harrison,
Melanie,Giovanni,Cecilia,Carson,Ashley,George,Rylee,Kayden,Margot,Jonah,Samantha,
Greyson,Catalina,Hunter,Juliette,Graham,Aubrey,Luis,Esther,Declan,Mary,Sawyer,
Nevaeh,Jasper,Skylar,Ryder,Alina,Carlos,Amira,Connor,Ember,Juan,Magnolia,Matteo,
Sienna,Dawson,Charlie,Calvin,Elliana,Leon,Summer,Dean,Alana,Evan,Brielle,
Nathaniel,Remi,Diego,Sage,Arlo,Valerie,Bryson,Hallie,Jason,Wrenley,Malachi,
Kehlani,Elliot,Emerson,Zion,June,Emilio,Sloane,Ivan,Emersyn,Hayden,Elsie,Stetson,
Oaklynn,Jude,Oakley,Legend,Blakely,Matias,Freya,Callum,Piper,Hayes,Valeria,Jett,
Arya,Cole,Adalynn,Elliott
"""

def human_names():
    seen, out = set(), []
    for n in (x.strip() for x in HUMAN_NAMES_RAW.split(",")):
        if n and n not in seen:
            seen.add(n)
            out.append(n)
    return out

# ── tool locations ─────────────────────────────────────────────────────────────

def android_home():
    return Path(os.environ.get("ANDROID_HOME")
                or os.environ.get("ANDROID_SDK_ROOT")
                or (Path.home() / "Library/Android/sdk"))

def _find(name, candidates):
    for c in candidates:
        if c and Path(c).exists():
            return str(c)
    return name

def adb_bin():
    return _find("adb", [android_home() / "platform-tools/adb"])

def emulator_bin():
    h = android_home()
    return _find("emulator", [h / "emulator/emulator", h / "tools/emulator"])

# ── small utils ────────────────────────────────────────────────────────────────

def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")

def narrate(msg):
    print(f"{datetime.now().strftime('%H:%M:%S.%f')[:-3]}    {msg}", flush=True)

def err(msg):
    print(msg, file=sys.stderr, flush=True)

def run(cmd, capture=True):
    """Run a command. stderr always inherits (never swallowed)."""
    return subprocess.run(cmd, stdout=subprocess.PIPE if capture else None,
                          stderr=None, text=True)

def pids_matching(pattern):
    r = subprocess.run(["pgrep", "-f", pattern], stdout=subprocess.PIPE, text=True)
    return [int(p) for p in r.stdout.split()] if r.returncode == 0 else []

# ── database ───────────────────────────────────────────────────────────────────

SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- Reference tables instead of native ENUMs: the mobile market changes fast, so
-- new flavors/types/OSes are INSERTed as rows, never schema migrations.
CREATE TABLE IF NOT EXISTS ref_flavor (name TEXT PRIMARY KEY);   -- Simulated|Real|Native|Remote
CREATE TABLE IF NOT EXISTS ref_type   (name TEXT PRIMARY KEY);   -- Android|iOS|web
CREATE TABLE IF NOT EXISTS ref_os     (name TEXT PRIMARY KEY);   -- AndroidOS|MacOS|iOS|Graphene|CalyxOS|Other

-- A. Devices. Dynamically reconciled with the live toolchain each sync.
CREATE TABLE IF NOT EXISTS devices (
  udid         TEXT PRIMARY KEY,      -- iOS UUID, AVD name, or real-device serial
  flavor       TEXT REFERENCES ref_flavor(name),
  type         TEXT REFERENCES ref_type(name),
  os_name      TEXT REFERENCES ref_os(name),
  os_version   TEXT,
  manufacturer TEXT,
  model        TEXT,
  display_name TEXT,
  serial       TEXT,                  -- adb serial when running (android)
  ipv4 TEXT, ipv6 TEXT, hostname TEXT DEFAULT 'localhost',
  state        TEXT,                  -- last-seen state
  present      INTEGER DEFAULT 1,     -- still exists in the toolchain (0 = gone)
  notes        TEXT,
  first_seen   TEXT, last_seen TEXT
);

-- E + auto names + user aliases. Aliases bind a name to a UDID and OUTLIVE the
-- device (deleting a sim does not free its human name).
CREATE TABLE IF NOT EXISTS aliases (
  alias      TEXT PRIMARY KEY,
  udid       TEXT NOT NULL,
  kind       TEXT NOT NULL,           -- 'name' | 'user' | 'altname'
  created_at TEXT
);

-- 350 human names, allocated first-come, freed never (mapping kept by udid).
CREATE TABLE IF NOT EXISTS name_pool (
  name         TEXT PRIMARY KEY,
  udid         TEXT,                  -- NULL = free
  allocated_at TEXT
);

-- B. Loops: named, ORDERED, may repeat a device. Cursor is per-loop.
CREATE TABLE IF NOT EXISTS loops (name TEXT PRIMARY KEY, created_at TEXT);
CREATE TABLE IF NOT EXISTS loop_members (
  loop TEXT REFERENCES loops(name) ON DELETE CASCADE,
  pos  INTEGER,
  ident TEXT,                         -- stored raw (resolved at --next time)
  PRIMARY KEY (loop, pos)
);
CREATE TABLE IF NOT EXISTS loop_cursor (loop TEXT PRIMARY KEY, pos INTEGER);

-- C. Coarse history: availability, reboots, pings, soft-realtime load samples.
CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT, udid TEXT, event TEXT,     -- created|reboot|warmup|ping|available|load|...
  detail TEXT, duration_ms INTEGER, sys_load REAL, dev_load REAL
);

-- D. Coverage requirements (Apple/Google), refreshed ~quarterly. Skeleton only.
CREATE TABLE IF NOT EXISTS requirements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor TEXT, type TEXT, os_version TEXT,
  bound TEXT,                         -- 'min' | 'max' | 'required'
  effective_date TEXT, source TEXT, notes TEXT
);

-- Cross-process scalar state (last-ios / last-android), kept in the DB
-- so concurrent invocations agree.
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);

-- F. Host machine profile, so emulator launch flags (cores/memory) can travel
-- to a faster machine: the script tunes per the host it currently runs on.
CREATE TABLE IF NOT EXISTS hosts (
  hostname TEXT PRIMARY KEY, arch TEXT, cpu_brand TEXT,
  logical_cores INTEGER, physical_cores INTEGER, mem_gb REAL,
  os_version TEXT, updated_at TEXT
);
"""

REF_SEED = {
    "ref_flavor": ["Simulated", "Real", "Native", "Remote"],
    "ref_type":   ["Android", "iOS", "web"],
    "ref_os":     ["AndroidOS", "MacOS", "iOS", "Graphene", "CalyxOS", "Other"],
}

_conn = None

# Columns added after the original `devices` schema shipped. CREATE TABLE IF NOT
# EXISTS never alters an existing table, so add them idempotently on every open.
# These record device READINESS (so callers can ask the row, not scan history):
#   compile_level   last AOT/dexopt level baked in (low|medium|hot|NULL)
#   has_default_boot 1 once a default_boot snapshot has been written
#   last_warmed_at  ISO ts of the last warm/bake/save-quickboot
#   last_used       ISO ts of the last resolve/start/kill/warm (touch())
_DEVICE_MIGRATIONS = [
    ("compile_level",    "TEXT"),
    ("has_default_boot", "INTEGER DEFAULT 0"),
    ("last_warmed_at",   "TEXT"),
    ("last_used",        "TEXT"),
]

def _migrate(conn):
    have = {r["name"] for r in conn.execute("PRAGMA table_info(devices)")}
    for col, decl in _DEVICE_MIGRATIONS:
        if col not in have:
            conn.execute(f"ALTER TABLE devices ADD COLUMN {col} {decl}")
    conn.commit()

def _norm_state(s):
    """Collapse platform-specific liveness to two values: Running | Shutdown.
    iOS reports 'Booted'; Android reports 'Running'. Everything else (Unknown,
    Shutting Down, …) maps to Shutdown for listing purposes."""
    return "Running" if s in ("Booted", "Running") else "Shutdown"

def db():
    global _conn
    if _conn is None:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        _conn = sqlite3.connect(str(DB_PATH), timeout=10)
        _conn.row_factory = sqlite3.Row
        _conn.isolation_level = None  # autocommit; immediate() owns explicit txns
        _conn.execute("PRAGMA busy_timeout=5000")
        _conn.executescript(SCHEMA)
        _migrate(_conn)
        for table, vals in REF_SEED.items():
            _conn.executemany(f"INSERT OR IGNORE INTO {table}(name) VALUES (?)",
                              [(v,) for v in vals])
        cur = _conn.execute("SELECT COUNT(*) c FROM name_pool")
        if cur.fetchone()["c"] == 0:
            _conn.executemany("INSERT OR IGNORE INTO name_pool(name) VALUES (?)",
                              [(n,) for n in human_names()])
        _conn.commit()
    return _conn

@contextmanager
def immediate():
    """A serialized write transaction (BEGIN IMMEDIATE) for ACID cursor bumps."""
    c = db()
    c.execute("BEGIN IMMEDIATE")
    try:
        yield c
        c.execute("COMMIT")
    except Exception:
        c.execute("ROLLBACK")
        raise

def kv_get(k, default=None):
    row = db().execute("SELECT v FROM kv WHERE k=?", (k,)).fetchone()
    return row["v"] if row else default

def kv_set(k, v):
    db().execute("INSERT INTO kv(k,v) VALUES(?,?) "
                 "ON CONFLICT(k) DO UPDATE SET v=excluded.v", (k, v))
    db().commit()

def log_history(udid, event, detail=None, duration_ms=None,
                sys_load=None, dev_load=None):
    db().execute("INSERT INTO history(ts,udid,event,detail,duration_ms,sys_load,dev_load)"
                 " VALUES (?,?,?,?,?,?,?)",
                 (now_iso(), udid, event, detail, duration_ms, sys_load, dev_load))
    db().commit()

def _device_set(udid, **cols):
    """Update arbitrary devices columns for one udid. No-op if the row is absent
    (a device not yet sync'd) so warm/bake on a fresh clone never throws."""
    if not cols:
        return
    if not db().execute("SELECT 1 FROM devices WHERE udid=?", (udid,)).fetchone():
        return
    sets = ", ".join(f"{k}=?" for k in cols)
    db().execute(f"UPDATE devices SET {sets} WHERE udid=?",
                 (*cols.values(), udid))
    db().commit()

# ── live discovery ─────────────────────────────────────────────────────────────

def ios_devices():
    import json
    r = run(["xcrun", "simctl", "list", "devices", "--json"])
    out = []
    try:
        data = json.loads(r.stdout)
    except ValueError:
        return out
    for rt, devs in data.get("devices", {}).items():
        ver = rt.rsplit(".", 1)[-1].replace("iOS-", "").replace("-", ".")
        for d in devs:
            if not d.get("isAvailable", True):
                continue
            out.append({"kind": "ios", "id": d["udid"], "serial": None,
                        "name": d.get("name", d["udid"]),
                        "os_version": ver,
                        "state": _norm_state(d.get("state", "Unknown"))})
    return out

def ios_booted():
    return [d for d in ios_devices() if d["state"] == "Running"]

def android_avds():
    r = run([emulator_bin(), "-list-avds"])
    return [l.strip() for l in (r.stdout or "").splitlines() if l.strip()]

def android_running():
    r = run([adb_bin(), "devices"])
    out = []
    for line in (r.stdout or "").splitlines()[1:]:
        parts = line.split()
        if len(parts) < 2 or parts[1] != "device":
            continue
        serial = parts[0]
        is_emu = serial.startswith("emulator-")
        is_net = bool(re.match(r"^[\w.-]+:\d+$", serial))  # Genymotion / adb connect (ip:port)
        if not (is_emu or is_net):
            continue                                       # skip USB-attached physical devices
        name = ""
        if is_emu:                                         # local emulator console
            nr = run([adb_bin(), "-s", serial, "emu", "avd", "name"])
            name = (nr.stdout or "").splitlines()[0].strip() if nr.stdout else ""
        if not name:                                       # Genymotion: emu console n/a → getprop
            for prop in ("ro.boot.qemu.avd_name",
                         "ro.kernel.androidboot.qemu.avd_name", "ro.product.model"):
                gp = run([adb_bin(), "-s", serial, "shell", "getprop", prop])
                name = (gp.stdout or "").strip()
                if name:
                    break
            name = name or serial
        out.append({"kind": "android", "id": name, "serial": serial,
                    "name": name, "os_version": None, "state": "Running"})
    return out

def android_all():
    """AVDs (defined) merged with running emulators (serial attached)."""
    running = {d["id"]: d for d in android_running()}
    out = []
    for name in android_avds():
        if name in running:
            out.append(running.pop(name))
        else:
            out.append({"kind": "android", "id": name, "serial": None,
                        "name": name, "os_version": None, "state": "Shutdown"})
    out.extend(running.values())  # running but not in -list-avds (rare)
    return out

def live_index():
    """udid/avd -> live device dict, for current state during resolve/sync."""
    idx = {}
    for d in ios_devices() + android_all():
        idx[d["id"]] = d
    return idx

def android_pids(dev):
    pids = pids_matching(dev["id"])
    if not pids and (dev.get("serial") or "").startswith("emulator-"):
        pids = pids_matching(f"-port {dev['serial'].split('-', 1)[1]}")
    return pids

def is_running(dev):
    return dev["state"] in ("Booted", "Running")

def _android_await_boot(dev, tries=300):
    """Poll until THIS avd is attached AND sys.boot_completed==1. Returns its
    serial (resolved from android_running, so it's right even with several
    emulators up), or None on timeout."""
    serial = dev.get("serial") if is_running(dev) else None
    for _ in range(tries):
        if not serial:
            rd = next((d for d in android_running() if d["id"] == dev["id"]), None)
            serial = rd["serial"] if rd else None
        if serial:
            r = run([adb_bin(), "-s", serial, "shell", "getprop", "sys.boot_completed"])
            if (r.stdout or "").strip() == "1":
                return serial
        time.sleep(1)
    return None

def _android_pm_ready(serial, tries=90):
    """Layer 3: wait until the package manager answers, so install/launch are safe.
    sys.boot_completed alone races PM/launcher readiness (see the readiness layers)."""
    for _ in range(tries):
        r = run([adb_bin(), "-s", serial, "shell", "cmd", "package", "list", "packages"])
        if "package:" in (r.stdout or ""):
            return True
        time.sleep(1)
    return False

def host_load_sample(dev, interval=5):
    """Settled host-side CPU%% for the device's primary process + host loadavg.

    Reads macOS `top` against the qemu/sim PID — it NEVER touches the guest
    (no adb/simctl), so it does not perturb what it measures (the guest-side
    observer effect that makes adb/dumpsys spike the emulator). `top -l 2`
    returns the real interval %% in its 2nd sample. Returns (dev_cpu, sys_load);
    dev_cpu is None when the process is gone — i.e. a dead/crashed device, which
    is exactly the overnight-failure signal history table C exists to catch.
    """
    pids = android_pids(dev) if dev["kind"] == "android" else pids_matching(dev["id"])
    try:
        sys_load = os.getloadavg()[0]
    except OSError:
        sys_load = None
    if not pids:
        return None, sys_load
    pid = pids[0]
    # stdin=DEVNULL so `top` never reaches for a controlling tty (it otherwise
    # stalls/stops when --monitor runs detached in the background).
    r = subprocess.run(["top", "-l", "2", "-s", str(interval), "-pid", str(pid),
                        "-stats", "pid,cpu"], stdout=subprocess.PIPE,
                       stdin=subprocess.DEVNULL, text=True)
    cpu = None
    for line in r.stdout.splitlines():        # keep the LAST match = 2nd (real) sample
        parts = line.split()
        if len(parts) == 2 and parts[0] == str(pid):
            try:
                cpu = float(parts[1])
            except ValueError:
                pass
    return cpu, sys_load

# ── sync: reconcile DB.devices with the live toolchain ──────────────────────────

def allocate_name(udid):
    """First-come random human name; persists by udid. Returns name or None.
    Idempotent: if this udid already owns a pooled name OR already carries a
    name/user alias, reuse it — never hand a device a SECOND human name (the
    `--copy` double-name bug: the copy claimed a free name as its alias, then a
    later sync() auto-allocated another, leaving e.g. both 'Lainey' and 'Esther')."""
    row = db().execute("SELECT name FROM name_pool WHERE udid=?", (udid,)).fetchone()
    if row:
        return row["name"]
    existing = db().execute(
        "SELECT alias FROM aliases WHERE udid=? AND kind IN ('name','user') "
        "ORDER BY kind LIMIT 1", (udid,)).fetchone()
    if existing:
        return existing["alias"]
    free = [r["name"] for r in
            db().execute("SELECT name FROM name_pool WHERE udid IS NULL")]
    if not free:
        return None
    name = random.choice(free)
    db().execute("UPDATE name_pool SET udid=?, allocated_at=? WHERE name=?",
                 (udid, now_iso(), name))
    db().execute("INSERT OR IGNORE INTO aliases(alias,udid,kind,created_at) "
                 "VALUES (?,?,?,?)", (name, udid, "name", now_iso()))
    db().commit()
    return name

def sync():
    """Upsert live devices, mark vanished ones present=0, auto-allocate names."""
    live = ios_devices() + android_all()
    live_ids = {d["id"] for d in live}
    now = now_iso()
    for d in live:
        if d["kind"] == "ios":
            flavor, typ, osn = "Simulated", "iOS", "iOS"
            manuf, model = "Apple", d["name"].split(" / ")[0]
        else:
            flavor, typ, osn = "Simulated", "Android", "AndroidOS"
            manuf, model = None, d["name"]
        existing = db().execute("SELECT udid FROM devices WHERE udid=?",
                                (d["id"],)).fetchone()
        if existing:
            db().execute(
                "UPDATE devices SET state=?, serial=?, os_version=COALESCE(?,os_version),"
                " display_name=?, present=1, last_seen=? WHERE udid=?",
                (d["state"], d.get("serial"), d.get("os_version"),
                 d["name"], now, d["id"]))
        else:
            db().execute(
                "INSERT INTO devices(udid,flavor,type,os_name,os_version,manufacturer,"
                "model,display_name,serial,state,present,first_seen,last_seen) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?)",
                (d["id"], flavor, typ, osn, d.get("os_version"), manuf, model,
                 d["name"], d.get("serial"), d["state"], now, now))
        allocate_name(d["id"])
    if live_ids:
        q = ",".join("?" * len(live_ids))
        db().execute(f"UPDATE devices SET present=0 WHERE udid NOT IN ({q})",
                     tuple(live_ids))
    db().commit()

# ── identifier resolution ──────────────────────────────────────────────────────

class ResolveError(Exception):
    pass

def _enrich(udid, idx) -> "dict | None":
    """Build a device dict from the live index, falling back to the DB row."""
    if udid in idx:
        return idx[udid]
    row = db().execute("SELECT * FROM devices WHERE udid=?", (udid,)).fetchone()
    if row:
        return {"kind": "ios" if row["type"] == "iOS" else "android",
                "id": udid, "serial": row["serial"], "name": row["display_name"] or udid,
                "os_version": row["os_version"], "state": row["state"] or "Unknown"}
    return None

def resolve_many(ident, idx=None) -> "list[dict]":
    """Resolve an id/alias to a list of device dicts. Raise ResolveError if none."""
    if idx is None:
        idx = live_index()
    a = ident.strip()
    low = a.lower()

    # group / system aliases ----------------------------------------------------
    if low in ("all", "all-ios", "all-android"):
        rows = db().execute("SELECT udid,type FROM devices WHERE present=1").fetchall()
        out = []
        for r in rows:
            if low == "all-ios" and r["type"] != "iOS":
                continue
            if low == "all-android" and r["type"] != "Android":
                continue
            d = _enrich(r["udid"], idx)
            if d:
                out.append(d)
        if not out:
            raise ResolveError(f"alias {ident!r} matches no present devices")
        return out
    if low == "loop":
        return resolve_many(kv_get("default_loop", "default"), idx)

    # Default platform aliases: prefer the running device for that platform; if none
    # is running, fall back to the LAST device in the standard listing. >1 running is
    # ambiguous and refused — pass an explicit id/alias (or the runner's --sim) instead.
    if low == "ios":
        b = ios_booted()
        if len(b) == 1:
            return b
        if len(b) > 1:
            raise ResolveError(f"alias 'ios': {len(b)} sims booted — ambiguous; "
                               f"pass an explicit id/alias")
        devs = ios_devices()
        if devs:
            return [devs[-1]]
        raise ResolveError("alias 'ios': no iOS simulators found")
    if low == "android":
        r = android_running()
        if len(r) == 1:
            return r
        if len(r) > 1:
            raise ResolveError(f"alias 'android': {len(r)} emulators running — ambiguous; "
                               f"pass an explicit id/alias")
        avds = android_all()
        if avds:
            return [avds[-1]]
        raise ResolveError("alias 'android': no Android emulators found")
    for key, kv in (("last-ios", "last_ios"), ("last-android", "last_android")):
        if low == key:
            udid = kv_get(kv)
            if not udid:
                raise ResolveError(f"no {key} recorded yet")
            d = _enrich(udid, idx)
            if not d:
                raise ResolveError(f"{key} {udid} no longer exists")
            return [d]

    # stored aliases (human name, user alias, altname) --------------------------
    rows = db().execute("SELECT udid FROM aliases WHERE alias=? COLLATE NOCASE",
                         (a,)).fetchall()
    if rows:
        out = [d for d in (_enrich(r["udid"], idx) for r in rows) if d]
        if out:
            return out

    # raw identifier ------------------------------------------------------------
    trimmed = a.replace("(", "").replace(")", "").replace(" ", "")
    if "-" in trimmed and re.fullmatch(r"[0-9A-Fa-f-]+", trimmed):
        if len(trimmed) != 36 or not UUID_RE.fullmatch(trimmed):
            raise ResolveError(f"invalid iOS UUID (must be 36 chars): {trimmed!r}")
        d = _enrich(trimmed, idx)
        if not d:
            raise ResolveError(f"unknown iOS device: {trimmed}")
        return [d]

    # android AVD name
    d = idx.get(trimmed)
    if d:
        return [d]
    d = _enrich(trimmed, idx)
    if d:
        return [d]
    raise ResolveError(f"unknown identifier: {ident!r}")

def resolve_one(ident, idx=None) -> "dict":
    return resolve_many(ident, idx)[0]

def touch(dev):
    # `last` (platform-agnostic) was removed — too ambiguous. Callers must say
    # last-ios / last-android explicitly.
    kv_set("last_ios" if dev["kind"] == "ios" else "last_android", dev["id"])
    _device_set(dev["id"], last_used=now_iso())

def aliases_for(udid):
    return [r["alias"] for r in
            db().execute("SELECT alias FROM aliases WHERE udid=? ORDER BY kind", (udid,))]

# ── host profile + emulator launch tuning ──────────────────────────────────────

def _sysctl(key, cast: Callable[[str], Any] = str, default=None):
    r = subprocess.run(["sysctl", "-n", key], stdout=subprocess.PIPE,
                       stderr=subprocess.DEVNULL, text=True)
    val = (r.stdout or "").strip()
    if not val:
        return default
    try:
        return cast(val)
    except ValueError:
        return default

def host_profile():
    """Detect + persist this machine's specs (table F) so emulator launch flags
    can travel to a faster machine later — cores/memory are tuned per host."""
    hostname = platform.node() or "localhost"
    prof = {
        "hostname": hostname,
        "arch": platform.machine(),
        "cpu_brand": _sysctl("machdep.cpu.brand_string", str, "unknown"),
        "logical_cores": _sysctl("hw.logicalcpu", int, os.cpu_count() or 1),
        "physical_cores": _sysctl("hw.physicalcpu", int, os.cpu_count() or 1),
        "mem_gb": round((_sysctl("hw.memsize", int, 0) or 0) / 1024 ** 3, 1),
        "os_version": platform.mac_ver()[0] or platform.release(),
    }
    db().execute(
        "INSERT INTO hosts(hostname,arch,cpu_brand,logical_cores,physical_cores,"
        "mem_gb,os_version,updated_at) VALUES (?,?,?,?,?,?,?,?) "
        "ON CONFLICT(hostname) DO UPDATE SET arch=excluded.arch,"
        "cpu_brand=excluded.cpu_brand,logical_cores=excluded.logical_cores,"
        "physical_cores=excluded.physical_cores,mem_gb=excluded.mem_gb,"
        "os_version=excluded.os_version,updated_at=excluded.updated_at",
        (prof["hostname"], prof["arch"], prof["cpu_brand"], prof["logical_cores"],
         prof["physical_cores"], prof["mem_gb"], prof["os_version"], now_iso()))
    db().commit()
    return prof

def recommended_cores():
    """Physical cores minus headroom for the host + this CLI, clamped to [2,8]."""
    phys = host_profile()["physical_cores"] or (os.cpu_count() or 4)
    return max(2, min(8, phys - 2))

def recommended_memory_mb():
    """Judicious guest RAM bump: more cuts in-guest GC/paging (helps when the
    guest is memory-starved), but does NOT relieve host-CPU starvation."""
    gb = host_profile()["mem_gb"] or 8
    if gb >= 32:
        return 4096
    if gb >= 16:
        return 3072
    return 2048

def emulator_flags(headless=False):
    """Android launch flags: -gpu host offloads rendering, -no-boot-anim/-no-audio
    trim startup, -cores/-memory are host-tuned. Headless adds -no-window
    -read-only (parallel CI instances)."""
    # -gpu swiftshader_indirect (software GL), NOT host: on this Intel/Radeon Mac the
    # host-GPU path FAILS to render the RN 0.83.6 New-Architecture (Fabric) app →
    # black screen + system_server ANR → e2e hangs at "Log In" (proven 2026-06-16;
    # swiftshader made auth-0100 pass the full login). Software GL costs more host CPU
    # but actually renders — correctness > the saving.
    flags = ["-no-boot-anim", "-no-audio", "-gpu", "swiftshader_indirect",
             "-cores", str(recommended_cores()),
             "-memory", str(recommended_memory_mb())]
    # NB: -no-window makes screencap/takeScreenshot return BLACK pixels here (tests
    # still pass — Maestro asserts on the a11y tree — but visual artifacts are useless).
    # Boot WINDOWED when you need real screenshots.
    if headless:
        flags += ["-no-window", "-read-only"]
    return flags

def _android_start(dev, flags):
    if dev["id"] not in android_avds():
        err(f"start: unknown AVD {dev['id']!r}")
        return False
    subprocess.Popen([emulator_bin(), "-avd", dev["id"]] + flags,
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                     start_new_session=True)
    return True

# ── commands ───────────────────────────────────────────────────────────────────

def _system_alias_map():
    m = {}
    if kv_get("last_ios"):
        m.setdefault(kv_get("last_ios"), []).append("last-ios")
    if kv_get("last_android"):
        m.setdefault(kv_get("last_android"), []).append("last-android")
    b = ios_booted()
    if len(b) == 1:
        m.setdefault(b[0]["id"], []).append("ios")
    r = android_running()
    if len(r) == 1:
        m.setdefault(r[0]["id"], []).append("android")
    return m

def all_aliases_for(udid, sysmap):
    return sysmap.get(udid, []) + aliases_for(udid)

def _maestro_id(dev):
    """The id Maestro's --device wants: adb serial for a running Android emulator,
    UDID for an iOS sim. None for an Android device that isn't running yet (no serial)."""
    if dev["kind"] == "android":
        return dev.get("serial")
    return dev["id"]

def _device_line(d, sysmap):
    al = all_aliases_for(d["id"], sysmap)
    prefix = f"[ {', '.join(al)} ]" if al else ""
    ident = d["serial"] if (d["kind"] == "android" and d.get("serial")) else d["id"]
    plat = "iOS" if d["kind"] == "ios" else "Android"
    ver = f" {d['os_version']}" if d.get("os_version") else ""
    return f"{prefix:<34}{d['name']} ({ident}) [{plat}{ver}] {d['state']}"

def cmd_running():
    sync()
    host_profile()  # keep this machine's specs (table F) current
    devices = ios_booted() + android_running()
    if not devices:
        print("No running devices")
        return 0
    sysmap = _system_alias_map()
    for d in devices:
        print(_device_line(d, sysmap))
    return 0

# ── --list rendering ─────────────────────────────────────────────────────────────
_USE_COLOR = sys.stdout.isatty()
SHORT_HEADERS = ["ALIASES", "KIND", "DEVICE", "STATE", "READY", "LAST USED"]
PLATFORM_ORDER = ["iOS", "Android", "Genymotion"]

def _c(s, *codes):
    """ANSI-wrap s (no-op when stdout isn't a TTY, so pipes/captures stay clean)."""
    if not _USE_COLOR or not codes:
        return s
    return f"\033[{';'.join(str(x) for x in codes)}m{s}\033[0m"

def _device_row(udid):
    return db().execute("SELECT * FROM devices WHERE udid=?", (udid,)).fetchone()

def _is_genymotion(d):
    return (d["kind"] == "android" and bool(d.get("serial"))
            and bool(re.match(r"^[\w.-]+:\d+$", d["serial"])))

def _platform_of(d):
    if d["kind"] == "ios":
        return "iOS"
    return "Genymotion" if _is_genymotion(d) else "Android"

def _flavor_label(d, row):
    """Combined Flavor/Type/OS, e.g. 'iOS / 26.5', 'Android', 'Native iOS'.
    'Simulated' is dropped (nearly every row is it); 'iOS ' stripped from version."""
    flavor = (row["flavor"] if row else None) or "Simulated"
    typ = _platform_of(d)
    label = (f"{flavor} " if flavor != "Simulated" else "") + typ
    ver = d.get("os_version") or (row["os_version"] if row else None)
    if typ == "iOS" and ver:
        label += f" / {ver}"
    return label

def _display_short(d, row):
    # Personal display names pack the OS after a ' / ' — show only the model half.
    name = (row["display_name"] if row else None) or d.get("name") or ""
    return name.split(" / ")[0].strip()

def _ready_marker(row):
    """Surface bake/warm readiness: compile level and whether a default_boot exists."""
    if not row:
        return ""
    lvl, baked = row["compile_level"], row["has_default_boot"]
    if lvl and baked:
        return f"{lvl}/baked"
    return "baked" if baked else (lvl or "")

def _last_used_short(row):
    return ((row["last_used"] if row else None) or "").replace("T", " ")[:16]

def _short_cells(d, sysmap):
    row = _device_row(d["id"])
    return [", ".join(all_aliases_for(d["id"], sysmap)),
            _flavor_label(d, row), _display_short(d, row),
            _norm_state(d["state"]), _ready_marker(row), _last_used_short(row)]

def _order_within(devs, plat, sysmap):
    """Within a platform, the default-alias holder (ios/last-ios, android/last-android)
    sorts first; then alphabetical."""
    firsts = {"iOS": {"ios", "last-ios"},
              "Android": {"android", "last-android"}}.get(plat, set())
    return sorted(devs, key=lambda d: (
        0 if set(all_aliases_for(d["id"], sysmap)) & firsts else 1, d["name"].lower()))

def _list_long(sections, sysmap):
    """Verbose: short columns + UDID + every remaining devices column, TAB-separated
    (no alignment — built for copy/paste). First pass; intentionally dense."""
    extra = ["UDID", "SERIAL", "MANUFACTURER", "MODEL", "DISPLAY_NAME", "PRESENT",
             "COMPILE_LEVEL", "HAS_DEFAULT_BOOT", "LAST_WARMED_AT", "FIRST_SEEN",
             "LAST_SEEN", "NOTES"]
    print("\t".join(["SECTION", "PLATFORM"] + SHORT_HEADERS + extra))
    for label, devs in sections:
        for plat in PLATFORM_ORDER:
            for d in _order_within([x for x in devs if _platform_of(x) == plat],
                                   plat, sysmap):
                row = _device_row(d["id"])
                vals = ([label, plat] + _short_cells(d, sysmap) +
                        [d["id"], d.get("serial") or "",
                         (row["manufacturer"] if row else "") or "",
                         (row["model"] if row else "") or "",
                         (row["display_name"] if row else "") or "",
                         (row["present"] if row else "") if row else "",
                         (row["compile_level"] if row else "") or "",
                         (row["has_default_boot"] if row else "") if row else "",
                         (row["last_warmed_at"] if row else "") or "",
                         (row["first_seen"] if row else "") or "",
                         (row["last_seen"] if row else "") or "",
                         (row["notes"] if row else "") or ""])
                print("\t".join(str(v) for v in vals))

def cmd_list(verbose=False):
    """Every in-scope device (iOS sims + Android emulators), grouped Running then
    Available, each in platform order (iOS, Android, Genymotion). Reminds testers
    what's around. -v/--verbose dumps the full per-device record (tab-separated)."""
    sync()
    host_profile()
    devices = ios_devices() + android_all()
    sysmap = _system_alias_map()
    sections = [("RUNNING", [d for d in devices if is_running(d)]),
                ("AVAILABLE", [d for d in devices if not is_running(d)])]
    if verbose:
        _list_long(sections, sysmap)
        return 0

    plain = {d["id"]: _short_cells(d, sysmap) for d in devices}
    widths = [len(h) for h in SHORT_HEADERS]
    for cells in plain.values():
        for i, c in enumerate(cells):
            widths[i] = max(widths[i], len(c))
    header = "  ".join(h.ljust(widths[i]) for i, h in enumerate(SHORT_HEADERS))

    for label, devs in sections:
        print(_c(label, 1))
        for plat in PLATFORM_ORDER:
            pdevs = [d for d in devs if _platform_of(d) == plat]
            if plat == "Genymotion" and not pdevs:
                continue                       # only surface Genymotion when present
            print("  " + _c(plat, 4))
            if not pdevs:
                print("    No devices available")
                continue
            print("    " + _c(header, 2))
            for d in _order_within(pdevs, plat, sysmap):
                acolor = (1, 91) if is_running(d) else (1, 31)  # bold; bright-red vs red
                cells = [c.ljust(widths[i]) for i, c in enumerate(plain[d["id"]])]
                cells[0] = _c(cells[0], *acolor)
                print("    " + "  ".join(cells))
        print()
    return 0

def cmd_resolve(ident):
    """Resolve an id/alias (incl. 'ios'/'android') to a single device and print the
    Maestro device id (stdout, bare) plus a rich description (stderr) — the runner
    captures stdout for `maestro --device` and echoes stderr so the chosen device
    is visible in the run log."""
    sync()
    try:
        dev = resolve_one(ident)
    except ResolveError as e:
        err(f"resolve: {e}")
        return 2
    mid = _maestro_id(dev)
    if not mid:
        err(f"resolve: {dev['name']} is not running — no adb serial yet "
            f"(start/warm it before resolving for a test run)")
        return 1
    touch(dev)
    print(mid)  # bare, maestro-consumable
    sysmap = _system_alias_map()
    al = all_aliases_for(dev["id"], sysmap)
    plat = "iOS" if dev["kind"] == "ios" else "Android"
    rich = f'{plat}: name="{dev["name"]}", id={mid}'
    err(f"[ {', '.join(al)} ] {rich}" if al else rich)
    return 0

def cmd_start(ident, mode="optimized"):
    """mode: 'basic' (legacy windowed), 'optimized' (perf flags), 'headless'."""
    sync()
    try:
        devs = resolve_many(ident)
    except ResolveError as e:
        err(f"start: {e}")
        return 2
    for dev in devs:
        if is_running(dev):
            print(f"{dev['name']} already running")
            touch(dev)
            continue
        if dev["kind"] == "ios":
            run(["xcrun", "simctl", "boot", dev["id"]], capture=False)
            if mode != "headless":
                run(["open", "-a", "Simulator"], capture=False)
            print(f"Starting {dev['name']}"
                  + (" (headless)" if mode == "headless" else ""))
        else:
            flags = [] if mode == "basic" else emulator_flags(headless=(mode == "headless"))
            if not _android_start(dev, flags):
                continue
            print(f"Starting {dev['name']}"
                  + (f" [{' '.join(flags)}]" if flags else " (basic)"))
        log_history(dev["id"], f"start:{mode}")
        touch(dev)
    return 0

def cmd_kill(ident):
    sync()
    try:
        devs = resolve_many(ident)
    except ResolveError as e:
        err(f"kill: {e}")
        return 2
    for dev in devs:
        touch(dev)
        if not is_running(dev):
            print(f"{dev['name']} not running")
            continue
        if dev["kind"] == "ios":
            run(["xcrun", "simctl", "shutdown", dev["id"]], capture=False)
        else:
            run([adb_bin(), "-s", dev["serial"], "emu", "kill"], capture=False)
        print(f"Stopped {dev['name']}")
        log_history(dev["id"], "kill")
    return 0

def cmd_alias(ident, alias):
    sync()
    try:
        devs = resolve_many(ident)
    except ResolveError as e:
        err(f"alias: {e}")
        return 2
    for dev in devs:
        db().execute("INSERT INTO aliases(alias,udid,kind,created_at) VALUES (?,?,?,?) "
                     "ON CONFLICT(alias) DO UPDATE SET udid=excluded.udid",
                     (alias, dev["id"], "user", now_iso()))
    db().commit()
    tgt = ", ".join(d["id"] for d in devs)
    print(f"alias {alias!r} -> {tgt}")
    return 0

def cmd_loop(name, csv):
    sync()
    idents = [x.strip() for x in csv.split(",") if x.strip()]
    if not idents:
        err("loop: empty member list")
        return 2
    # validate each resolves now (members are still stored raw for dynamic resolve)
    idx = live_index()
    for it in idents:
        try:
            resolve_many(it, idx)
        except ResolveError as e:
            err(f"loop: member {it!r}: {e}")
            return 2
    with immediate() as c:
        c.execute("INSERT OR IGNORE INTO loops(name,created_at) VALUES (?,?)",
                  (name, now_iso()))
        c.execute("DELETE FROM loop_members WHERE loop=?", (name,))
        for pos, it in enumerate(idents):
            c.execute("INSERT INTO loop_members(loop,pos,ident) VALUES (?,?,?)",
                      (name, pos, it))
        c.execute("INSERT INTO loop_cursor(loop,pos) VALUES (?,0) "
                  "ON CONFLICT(loop) DO UPDATE SET pos=0", (name,))
    kv_set("default_loop", name)
    print(f"loop {name!r}: {len(idents)} members")
    return 0

def cmd_next(name):
    name = name or kv_get("default_loop", "default")
    members = db().execute(
        "SELECT ident FROM loop_members WHERE loop=? ORDER BY pos", (name,)).fetchall()
    if not members:
        err(f"next: no such loop {name!r}")
        return 1
    n = len(members)
    # ACID advance: read + bump the cursor under an IMMEDIATE transaction.
    with immediate() as c:
        row = c.execute("SELECT pos FROM loop_cursor WHERE loop=?", (name,)).fetchone()
        pos = row[0] if row else 0
        if pos >= n:                       # the artificial end-of-list slot
            c.execute("INSERT INTO loop_cursor(loop,pos) VALUES (?,0) "
                      "ON CONFLICT(loop) DO UPDATE SET pos=0", (name,))
            ident = None
        else:
            ident = members[pos]["ident"]
            c.execute("INSERT INTO loop_cursor(loop,pos) VALUES (?,?) "
                      "ON CONFLICT(loop) DO UPDATE SET pos=excluded.pos",
                      (name, pos + 1))
    if ident is None:
        err(f"next: {END_OF_LIST} for loop {name!r}")
        return 1
    try:
        dev = resolve_one(ident)
    except ResolveError as e:
        err(f"next: member {ident!r}: {e}")
        return 1
    touch(dev)
    # stdout = bare id consumable by `maestro -d`. For a running Android emulator
    # that is the adb serial (emulator-5554), NOT the AVD name; iOS uses the UDID.
    if dev["kind"] == "android":
        out_id = dev.get("serial")
        if not out_id:
            err(f"next: {dev['name']} is not running — no adb serial yet "
                f"(warmup/start it before --next)")
            return 1
    else:
        out_id = dev["id"]
    print(out_id)
    sysmap = _system_alias_map()
    al = all_aliases_for(dev["id"], sysmap)
    if dev["kind"] == "android":
        rich = f'name = "{dev["name"]}", serial={out_id}'
    else:
        rich = f'name = "{dev["name"]}", UDID="{dev["id"]}"'
    err(f"[ {', '.join(al)} ] {rich}" if al else rich)
    return 0

# Android dexopt/compile levels. Time ranges are ROUGH (measured: a full
# bg-dexopt-job took ~28 min on this machine, 2026-06-15). Needs per-host
# calibration — see history table C and the comparison notes.
COMPILE_LEVELS = {
    "low":    (["cmd", "package", "bg-dexopt-job"],
               "~20-30 min (full background dexopt of every package)"),
    "medium": (["cmd", "package", "compile", "-a", "-m", "speed-profile"],
               "~20-40 min (force speed-profile compile, all packages)"),
    "hot":    (["cmd", "package", "compile", "-a", "-m", "everything",
                "--compile-layouts"],
               "~40-90 min (AOT-compile everything + precompile layouts)"),
}

def _warm_estimate(dev):
    rows = db().execute(
        "SELECT duration_ms FROM history WHERE udid=? AND event LIKE 'warmup%' "
        "AND duration_ms IS NOT NULL ORDER BY id DESC LIMIT 5", (dev["id"],)).fetchall()
    if rows:
        med = sorted(r["duration_ms"] for r in rows)[len(rows) // 2]
        return f"~{med/1000:.0f}s (median of {len(rows)} past warmups)"
    if is_running(dev):
        return "a few seconds (already running)"
    return ("~10-40s for an iOS sim cold; ~1-4 min for an Android emulator cold "
            "(much longer on first-ever boot while it dexopts)")

def warmup_one(dev, level=None):
    narrate(f"warmup {dev['name']}: estimated {_warm_estimate(dev)}")
    t0 = time.time()
    if dev["kind"] == "ios":
        if not is_running(dev):
            narrate("  booting simulator …")
            run(["xcrun", "simctl", "boot", dev["id"]], capture=False)
        narrate("  waiting for boot to complete (simctl bootstatus) …")
        run(["xcrun", "simctl", "bootstatus", dev["id"]], capture=False)
        if level:
            narrate("  (compile levels are Android-only; iOS warmup is boot-only)")
    else:
        if not is_running(dev):
            narrate("  launching emulator with optimized flags …")
            _android_start(dev, emulator_flags())
        narrate("  waiting for sys.boot_completed …")
        serial = _android_await_boot(dev)
        if not serial:
            narrate("  device did not reach boot_completed in time; skipping optimize")
        else:
            dev["serial"] = serial
            narrate("  waiting for package manager (install/launch ready) …")
            _android_pm_ready(serial)
            if level:
                cmd, est = COMPILE_LEVELS[level]
                narrate(f"  optimizing [{level}] — estimated {est}; this is the slow part …")
                run([adb_bin(), "-s", serial, "shell"] + cmd, capture=False)
                narrate("  saving 'default_boot' so the speedup survives quick-boot …")
                run([adb_bin(), "-s", serial, "emu", "avd", "snapshot", "save",
                     "default_boot"], capture=False)
    ms = int((time.time() - t0) * 1000)
    cpu, load = host_load_sample(dev)
    # detail carries the level (queryable); event stays the bare 'warmup'.
    log_history(dev["id"], "warmup", detail=(f"warmup:{level}" if level else "warmup"),
                duration_ms=ms, sys_load=load, dev_load=cpu)
    cols: "dict[str, object]" = {"last_warmed_at": now_iso()}
    if level:                       # a level also saves a default_boot snapshot above
        cols["compile_level"] = level
        cols["has_default_boot"] = 1
    _device_set(dev["id"], **cols)
    touch(dev)
    cpu_s = f"{cpu:.1f}% host cpu" if cpu is not None else "process gone"
    load_s = f", load {load:.2f}" if load is not None else ""
    narrate(f"{dev['name']} ready in {ms/1000:.0f}s ({cpu_s}{load_s})")

def cmd_warmup(ident, level=None):
    sync()
    try:
        devs = resolve_many(ident)
    except ResolveError as e:
        err(f"warmup: {e}")
        return 2
    for dev in devs:
        warmup_one(dev, level)
    return 0

# ── monitor (periodic host-side sampler) ────────────────────────────────────────

def cmd_monitor(interval):
    """Sample host-side load of every running device, round-robin and slightly
    staggered, writing a 'monitor' history row each cycle. Host-side only (no
    adb/simctl), so it does not perturb the devices it watches. Runs until
    Ctrl-C — meant to be launched detached for long/overnight runs."""
    interval = interval or 10
    print(f"monitoring host-side load every ~{interval}s "
          f"(staggered across devices); Ctrl-C to stop", flush=True)
    stop = {"v": False}
    signal.signal(signal.SIGINT, lambda *_: stop.__setitem__("v", True))
    signal.signal(signal.SIGTERM, lambda *_: stop.__setitem__("v", True))
    while not stop["v"]:
        devs = ios_booted() + android_running()
        if not devs:
            narrate("no running devices")
            for _ in range(int(interval)):
                if stop["v"]:
                    break
                time.sleep(1)
            continue
        slot = max(1.0, interval / len(devs))      # each device gets a time slot
        win = max(1, int(min(slot - 0.5, 3)))      # top-sampling window per device
        for dev in devs:
            if stop["v"]:
                break
            cpu, load = host_load_sample(dev, interval=win)  # consumes ~win sec
            log_history(dev["id"], "monitor", sys_load=load, dev_load=cpu)
            tag = "DEAD/gone" if cpu is None else f"{cpu:6.1f}% cpu"
            load_s = f"  host-load {load:.2f}" if load is not None else ""
            narrate(f"{dev['name']:<24} {tag}{load_s}")
            rest = slot - win                       # pad the slot to keep cadence
            while rest > 0 and not stop["v"]:
                time.sleep(min(1.0, rest))
                rest -= 1.0
    print("\nmonitor stopped", flush=True)
    return 0

# ── save-quickboot ──────────────────────────────────────────────────────────────

def cmd_save_quickboot(ident):
    """Persist a running AVD's current state as 'default_boot' — the snapshot
    Quick Boot auto-loads. Use case: hand-craft a logged-in/profile state on an
    AVD, then have it relaunch exactly there. (iOS sims persist on disk already.)"""
    sync()
    try:
        dev = resolve_one(ident)
    except ResolveError as e:
        err(f"save-quickboot: {e}")
        return 2
    if dev["kind"] != "android":
        err("save-quickboot: Android-only. iOS simulators persist their data on "
            "disk automatically — just relaunch the same UDID.")
        return 0
    if not is_running(dev) or not dev.get("serial"):
        err(f"save-quickboot: {dev['name']} must be running to snapshot it.")
        return 2
    print(f"Saving 'default_boot' quickboot snapshot of {dev['name']} …")
    run([adb_bin(), "-s", dev["serial"], "emu", "avd", "snapshot", "save",
         "default_boot"], capture=False)
    log_history(dev["id"], "save-quickboot", detail="save-quickboot")
    _device_set(dev["id"], has_default_boot=1, last_warmed_at=now_iso())
    touch(dev)
    print("Saved. Next launch quick-boots into this exact state.")
    return 0

# ── copy / clone ────────────────────────────────────────────────────────────────

def atd_system_image():
    """Path of a downloaded ATD (Automated Test Device) system image, or None.
    ATD images are GMS-stripped and far lighter; ideal for the optimized copy."""
    root = android_home() / "system-images"
    if not root.exists():
        return None
    for tag_dir in root.glob("*/*atd*"):
        for abi in tag_dir.iterdir():
            if abi.is_dir() and (abi / "system.img").exists():
                return abi
    return None

def _strip_runtime_state(avd_dir):
    """Remove runtime lock/state files copied from a RUNNING source AVD. Otherwise
    the clone looks like an already-running instance and the emulator FATALs with
    "multiple emulators with the same AVD … use -read-only" — and -read-only then
    blocks snapshot-save. hardware-qemu.ini is regenerated from config.ini on boot."""
    for pat in ("*.lock", "hardware-qemu.ini", "*.img.lock", "snapshot.lock.*"):
        for p in avd_dir.glob(pat):
            if p.is_dir():
                shutil.rmtree(p, ignore_errors=True)
            else:
                p.unlink(missing_ok=True)

def clone_avd(src, dst):
    """Clone an AVD on disk: copy <src>.avd + <src>.ini to <dst>, fix the
    embedded paths/ids, and drop the source's snapshots so the clone cold-boots."""
    root = Path.home() / ".android" / "avd"
    src_dir, dst_dir = root / f"{src}.avd", root / f"{dst}.avd"
    src_ini, dst_ini = root / f"{src}.ini", root / f"{dst}.ini"
    if not src_dir.exists() or not src_ini.exists():
        raise FileNotFoundError(f"AVD {src!r} not found under {root}")
    if dst_dir.exists() or dst_ini.exists():
        raise FileExistsError(f"AVD {dst!r} already exists")
    shutil.copytree(src_dir, dst_dir)
    dst_ini.write_text(src_ini.read_text().replace(f"{src}.avd", f"{dst}.avd"))
    cfg = dst_dir / "config.ini"
    if cfg.exists():
        out = []
        for ln in cfg.read_text().splitlines():
            if ln.startswith("AvdId="):
                ln = f"AvdId={dst}"
            elif ln.startswith("avd.ini.displayname="):
                ln = f"avd.ini.displayname={dst}"
            out.append(ln)
        cfg.write_text("\n".join(out) + "\n")
    shutil.rmtree(dst_dir / "snapshots", ignore_errors=True)
    _strip_runtime_state(dst_dir)

def sdkmanager_bin():
    h = android_home()
    return _find("sdkmanager",
                 [h / "cmdline-tools/latest/bin/sdkmanager"]
                 + sorted(h.glob("cmdline-tools/*/bin/sdkmanager"), reverse=True)
                 + [h / "tools/bin/sdkmanager"])

def host_abi():
    return "arm64-v8a" if host_profile()["arch"] == "arm64" else "x86_64"

def _avd_api(avd):
    """Source AVD's API level from its config.ini image.sysdir (android-NN)."""
    cfg = Path.home() / ".android" / "avd" / f"{avd}.avd" / "config.ini"
    if cfg.exists():
        m = re.search(r"android-(\d+)", cfg.read_text())
        if m:
            return int(m.group(1))
    return 34

def atd_target(src_avd, tag="google_atd"):
    """Closest ATD package to the source. ATD images exist for api 30-34, so a
    newer source (e.g. android-36) is capped to 34. google_atd keeps GMS (needed
    for Bubble's Google deps); aosp_atd is lighter but GMS-free."""
    api = max(30, min(_avd_api(src_avd), 34))
    abi = host_abi()
    return (f"system-images;android-{api};{tag};{abi}",
            f"system-images/android-{api}/{tag}/{abi}/", tag, api, abi)

def ensure_atd_image(pkg, sysdir):
    """Download the ATD system image via sdkmanager if absent (slow; network)."""
    if (android_home() / sysdir / "system.img").exists():
        return True
    print(f"Downloading ATD image {pkg} via sdkmanager (slow; network) …")
    subprocess.run([sdkmanager_bin(), pkg], input="y\n" * 50, text=True)
    return (android_home() / sysdir / "system.img").exists()

def atd_ify(new_avd, src_avd, tag="google_atd"):
    """Re-point a cloned AVD at an ATD system image + fresh userdata (the Play
    userdata is incompatible with a different system image, so it's wiped)."""
    pkg, sysdir, tag, _, abi = atd_target(src_avd, tag)
    if not ensure_atd_image(pkg, sysdir):
        err(f"copy: could not obtain ATD image {pkg}; keeping original image")
        return False
    disp = "Google APIs ATD" if tag == "google_atd" else "AOSP ATD"
    cpu = "arm64" if abi.startswith("arm") else "x86_64"
    avd_dir = Path.home() / ".android" / "avd" / f"{new_avd}.avd"
    cfg = avd_dir / "config.ini"
    repl = {"image.sysdir.1=": f"image.sysdir.1={sysdir}",
            "tag.id=": f"tag.id={tag}", "tag.ids=": f"tag.ids={tag}",
            "tag.display=": f"tag.display={disp}",
            "tag.displaynames=": f"tag.displaynames={disp}",
            "abi.type=": f"abi.type={abi}", "hw.cpu.arch=": f"hw.cpu.arch={cpu}"}
    out = []
    for ln in cfg.read_text().splitlines():
        for k, v in repl.items():
            if ln.startswith(k):
                ln = v
                break
        out.append(ln)
    cfg.write_text("\n".join(out) + "\n")
    for p in avd_dir.glob("userdata*.img"):    # fresh userdata for the new image
        p.unlink()
    shutil.rmtree(avd_dir / "snapshots", ignore_errors=True)
    _strip_runtime_state(avd_dir)
    print(f"Converted {new_avd} -> {pkg} (fresh userdata)")
    return True

def bake_optimizations(dev, level=None):
    """Boot the device headless, apply SAFE bakeable optimizations, save a
    default_boot snapshot, then shut down — leaving a fast quick-boot.

    Applies battery-saver (mild, persists). Does NOT bake forced-doze (would
    leave the device suspended/unresponsive for tests) and does NOT pm-disable
    GApps (wedges system_server — see the playstore lesson; ATD images need
    nothing disabled anyway). Pass level to also AOT-compile (slow)."""
    narrate(f"bake {dev['name']}: booting headless to apply optimizations …")
    t0 = time.time()
    if not is_running(dev):
        # -no-window but NOT -read-only: read-only DISABLES snapshot save, which
        # is the whole point of baking (we must write default_boot).
        _android_start(dev, emulator_flags(headless=False) + ["-no-window"])
    # _android_await_boot polls android_running() for THIS avd (right even with
    # several emulators up) — no `adb wait-for-device`, which hits the wrong one.
    narrate("  waiting for sys.boot_completed …")
    serial = _android_await_boot(dev)
    if not serial:
        err(f"bake: {dev['name']} did not come up; skipping")
        return
    narrate("  waiting for package manager (install/launch ready) …")
    _android_pm_ready(serial)
    # NB: do NOT bake battery-saver/low_power here. It THROTTLES the guest CPU, which
    # hurts test fidelity and can starve system_server into an ANR on app launch
    # (learned the hard way on Lainey, 2026-06-16). The ATD image is already light;
    # the win is the image + optional AOT compile, not runtime power-saving.
    if level:
        cmd, est = COMPILE_LEVELS[level]
        narrate(f"  compiling [{level}] — estimated {est} …")
        run([adb_bin(), "-s", serial, "shell"] + cmd, capture=False)
    narrate("  saving default_boot snapshot …")
    run([adb_bin(), "-s", serial, "emu", "avd", "snapshot", "save", "default_boot"],
        capture=False)
    narrate("  shutting the baked device down …")
    run([adb_bin(), "-s", serial, "emu", "kill"], capture=False)
    ms = int((time.time() - t0) * 1000)
    # bake used to log no duration (gap #3); record it + the level in detail, and
    # mark device readiness: a bake always writes a default_boot snapshot.
    log_history(dev["id"], "bake", detail=(f"bake:{level}" if level else "bake"),
                duration_ms=ms)
    cols: "dict[str, object]" = {"last_warmed_at": now_iso(), "has_default_boot": 1}
    if level:
        cols["compile_level"] = level
    _device_set(dev["id"], **cols)
    narrate(f"bake done in {ms/1000:.0f}s: {dev['name']} will quick-boot optimized")

def cmd_bake(ident, level=None):
    sync()
    try:
        dev = resolve_one(ident)
    except ResolveError as e:
        err(f"bake: {e}")
        return 2
    if dev["kind"] != "android":
        err("bake: Android-only.")
        return 2
    bake_optimizations(dev, level)
    return 0

def cmd_copy(ident, new_alias, mode="optimized"):
    """Clone a device + give it an alias.
      --copy:orig  -> plain clone (mode='orig').
      --copy       -> clone, then re-point to an ATD image if one is downloaded
                      (mode='optimized'). Runtime opts (low-power/doze) are baked
                      via a later warmup+save-quickboot, not here."""
    sync()
    try:
        dev = resolve_one(ident)            # fails if ID not available under that name
    except ResolveError as e:
        err(f"copy: {e}")
        return 2
    if not new_alias:                        # default: pull a free human name
        row = db().execute("SELECT name FROM name_pool WHERE udid IS NULL "
                           "ORDER BY RANDOM() LIMIT 1").fetchone()
        if not row:
            err("copy: no free human names left — supply an alias explicitly")
            return 2
        new_alias = row["name"]
    if db().execute("SELECT 1 FROM aliases WHERE alias=? COLLATE NOCASE",
                    (new_alias,)).fetchone():
        err(f"copy: alias {new_alias!r} already in use")
        return 2

    if dev["kind"] == "ios":
        err("copy: iOS is a FIXME:RESEARCH item. `xcrun simctl clone` can duplicate "
            "a sim, but no proven boot-speed trick — deferring.")
        return 2

    new_avd = f"{dev['id']}_copy_{new_alias}"
    try:
        clone_avd(dev["id"], new_avd)
    except (FileExistsError, FileNotFoundError) as e:
        err(f"copy: {e}")
        return 2
    print(f"Cloned AVD {dev['id']} -> {new_avd}")

    # Register the alias NOW, before any sync(): sync()->allocate_name would
    # otherwise see a nameless clone and hand it a SECOND human name (the
    # 'Lainey'+'Esther' double-name bug). If the chosen alias is a pooled human
    # name, claim it for this udid (kind 'name'); else it's a 'user' alias.
    pooled = db().execute("SELECT 1 FROM name_pool WHERE name=? COLLATE NOCASE",
                          (new_alias,)).fetchone()
    db().execute("INSERT INTO aliases(alias,udid,kind,created_at) VALUES (?,?,?,?) "
                 "ON CONFLICT(alias) DO UPDATE SET udid=excluded.udid",
                 (new_alias, new_avd, "name" if pooled else "user", now_iso()))
    if pooled:
        db().execute("UPDATE name_pool SET udid=?, allocated_at=? "
                     "WHERE name=? COLLATE NOCASE", (new_avd, now_iso(), new_alias))
    db().commit()
    print(f"alias {new_alias!r} -> {new_avd}")

    if mode == "optimized":
        if atd_ify(new_avd, dev["id"]):     # download ATD + re-point + wipe userdata
            sync()
            new_dev = resolve_one(new_avd)
            bake_optimizations(new_dev)     # boot, low-power, save default_boot, halt
            return 0

    sync()  # at least register the new AVD as a device
    return 0

# ── nuke ─────────────────────────────────────────────────────────────────────

def _quit_kill_ladder(label, list_running):
    remaining = list_running()
    if not remaining:
        return
    narrate(f"{label}: {len(remaining)} emulator(s) remain.")
    for sig, phrase in ((signal.SIGQUIT,
                         "depart with exquisite politeness, hugs, and a goodie bag"),
                        (signal.SIGKILL, "GTFO")):
        if not list_running():
            break
        for dev in list_running():
            pids = (android_pids(dev) if dev["kind"] == "android"
                    else pids_matching(dev["id"]))
            for pid in pids:
                narrate(f"{label}: asking PID {pid} to {phrase}")
                try:
                    os.kill(pid, sig)
                except ProcessLookupError:
                    pass
        time.sleep(2)

def nuke_ios():
    narrate("iOS: Halting all running simulators")
    run(["xcrun", "simctl", "shutdown", "all"], capture=False)
    time.sleep(2)
    for dev in ios_booted():
        narrate(f"iOS: shutting down {dev['name']} ({dev['id']})")
        run(["xcrun", "simctl", "shutdown", dev["id"]], capture=False)
    time.sleep(2)
    _quit_kill_ladder("iOS", ios_booted)
    narrate("iOS: some simulators survived 😱" if ios_booted()
            else f"iOS: full stop. {STOP}")

def nuke_android():
    narrate("Android: Halting all running simulators")
    for dev in android_running():
        run([adb_bin(), "-s", dev["serial"], "emu", "kill"], capture=False)
    time.sleep(2)
    for dev in android_running():
        narrate(f"Android: shutting down {dev['name']} ({dev['serial']})")
        run([adb_bin(), "-s", dev["serial"], "emu", "kill"], capture=False)
    time.sleep(2)
    _quit_kill_ladder("Android", android_running)
    narrate("Android: some emulators survived 😱" if android_running()
            else f"Android: full stop. {STOP}")

def cmd_nuke():
    nuke_ios()
    nuke_android()
    narrate(f"All: full stop. {STOP}")
    return 0

# ── entry ──────────────────────────────────────────────────────────────────────

def main(argv=None):
    p = argparse.ArgumentParser(
        prog="manage_devices.py",
        description="Start / stop / list / loop simulated devices (iOS + Android).",
        formatter_class=argparse.RawDescriptionHelpFormatter)
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("-r", "--running", action="store_true", help="list running devices")
    g.add_argument("-l", "--list", action="store_true", dest="list_all",
                   help="list ALL devices + aliases (non-running first, running last)")
    g.add_argument("--resolve", metavar="ID",
                   help="print the maestro device id (android serial / iOS UDID) for an id/alias")
    g.add_argument("-s", "--start", metavar="ID", help="start device(s) with perf flags")
    g.add_argument("--start:headless", dest="start_headless", metavar="ID",
                   help="start headless + read-only + perf flags (CI)")
    g.add_argument("-S", "--start-basic", dest="start_basic", metavar="ID",
                   help="start device(s), legacy windowed behaviour")
    g.add_argument("-k", "--kill", metavar="ID", help="stop device(s)")
    g.add_argument("--nuke", action="store_true", help="stop everything (narrated)")
    g.add_argument("-w", "--warmup", metavar="ID", help="boot + wait until responsive")
    g.add_argument("--warm:low", dest="warm_low", metavar="ID",
                   help="warmup, then bg-dexopt-job")
    g.add_argument("--warm:medium", dest="warm_medium", metavar="ID",
                   help="warmup, then compile -m speed-profile")
    g.add_argument("--warm:hot", dest="warm_hot", metavar="ID",
                   help="warmup, then compile -m everything --compile-layouts")
    g.add_argument("-c", "--copy", nargs="+", metavar="ID|ALIAS", dest="copy",
                   help="clone an Android AVD (ATD-ify); takes ID [NEW_ALIAS]")
    g.add_argument("--copy:orig", nargs="+", metavar="ID|ALIAS", dest="copy_orig",
                   help="clone a device as-is; takes ID [NEW_ALIAS]")
    g.add_argument("--save-quickboot", dest="save_quickboot", metavar="ID",
                   help="save running AVD as its default_boot snapshot")
    g.add_argument("--bake", metavar="ID",
                   help="boot headless, apply optimizations, save default_boot, halt")
    g.add_argument("-m", "--monitor", nargs="?", const=10, type=int, default=None,
                   metavar="SECONDS", help="periodically sample host-side load")
    g.add_argument("-a", "--alias", nargs=2, metavar=("ID", "ALIAS"),
                   help="create a user alias for device(s)")
    g.add_argument("--loop", nargs=2, metavar=("NAME", "CSV"),
                   help="define an ordered loop from a comma list of ids/aliases")
    g.add_argument("-n", "--next", nargs="?", const=None, default=False,
                   metavar="NAME", help="advance the loop cursor; print next device")
    p.add_argument("-v", "--verbose", action="store_true",
                   help="with --list: dump the full per-device record (tab-separated)")
    args = p.parse_args(argv)

    def _copy_args(lst):
        return (lst[0], lst[1] if len(lst) > 1 else None)

    if args.running:
        return cmd_running()
    if args.list_all:
        return cmd_list(args.verbose)
    if args.resolve:
        return cmd_resolve(args.resolve)
    if args.start:
        return cmd_start(args.start, "optimized")
    if args.start_headless:
        return cmd_start(args.start_headless, "headless")
    if args.start_basic:
        return cmd_start(args.start_basic, "basic")
    if args.kill:
        return cmd_kill(args.kill)
    if args.nuke:
        return cmd_nuke()
    if args.warmup:
        return cmd_warmup(args.warmup)
    if args.warm_low:
        return cmd_warmup(args.warm_low, "low")
    if args.warm_medium:
        return cmd_warmup(args.warm_medium, "medium")
    if args.warm_hot:
        return cmd_warmup(args.warm_hot, "hot")
    if args.copy:
        return cmd_copy(*_copy_args(args.copy), mode="optimized")
    if args.copy_orig:
        return cmd_copy(*_copy_args(args.copy_orig), mode="orig")
    if args.save_quickboot:
        return cmd_save_quickboot(args.save_quickboot)
    if args.bake:
        return cmd_bake(args.bake)
    if args.monitor is not None:
        return cmd_monitor(args.monitor)
    if args.alias:
        return cmd_alias(args.alias[0], args.alias[1])
    if args.loop:
        return cmd_loop(args.loop[0], args.loop[1])
    if args.next is not False:
        return cmd_next(args.next)
    return 1

if __name__ == "__main__":
    sys.exit(main())
