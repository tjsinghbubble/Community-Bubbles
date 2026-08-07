"""DB schema + one-time versioned migration for manage_devices.

Extracted from manage_devices.py so the schema and migration live in ONE place and
run ONCE per database — not as a per-open `ALTER TABLE` loop (the old anti-pattern).

- `SCHEMA` is canonical: the `devices` table already declares every column, so a
  fresh DB is correct after `init_db()` with no ALTERs.
- `migrate_db()` brings a PRE-EXISTING database up to `SCHEMA_VERSION`, adding only
  the columns `PRAGMA table_info` shows are missing (so it is safe on fresh,
  partially-migrated, and fully-migrated DBs alike) and then bumping
  `PRAGMA user_version`.

Functions take a sqlite3 connection and use positional row access only, so they do
not depend on the caller's `row_factory`. SQL identifiers (table/column names)
cannot be parameterized; the few that are interpolated come only from the trusted
constants in this module, never user input.
"""

# Bump when the canonical schema changes; add new columns to _DEVICE_COLUMNS_ADDED
# and columns to remove to _DEVICE_COLUMNS_DROPPED so existing DBs converge.
#   v1: initial versioned schema (readiness + native real-device columns).
#   v2: + devices.api_level (Android API, e.g. 'API 37') + ref_api_level table
#       + device_transports (adb handle -> canonical udid resolution cache);
#       - devices.serial (transient adb handle; now derived live / cached in
#         device_transports, never a stored device identity).
#   v3: + devices.resolution ('1080x2424' px), density (dpi int), boot_option
#       ('Quick Boot'|'Cold Boot'), google_support ('Full'|'APIs only'|'None')
#       — Android screen/boot/system-image facts surfaced in verbose listings.
#   v4: + devices.default_boot_windowed (1 = the default_boot snapshot was baked
#       WINDOWED, so a windowed --start can quick-boot it; 0/NULL = headless-baked,
#       windowed --start must cold-boot). See --bake:windowed.
SCHEMA_VERSION = 4

SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- Reference tables instead of native ENUMs: the mobile market changes fast, so
-- new flavors/types/OSes are INSERTed as rows, never schema migrations.
CREATE TABLE IF NOT EXISTS ref_flavor (name TEXT PRIMARY KEY);   -- Simulated|Real|Native|Remote
CREATE TABLE IF NOT EXISTS ref_type   (name TEXT PRIMARY KEY);   -- Android|iOS|web
CREATE TABLE IF NOT EXISTS ref_os     (name TEXT PRIMARY KEY);   -- AndroidOS|MacOS|iOS|Graphene|CalyxOS|Other
CREATE TABLE IF NOT EXISTS ref_api_level (name TEXT PRIMARY KEY);-- Android API levels: 'API 21' … 'API 37'

-- A. Devices. Dynamically reconciled with the live toolchain each sync.
-- Canonical column set (fresh DBs match this exactly; existing DBs are migrated
-- to it by migrate_db()).
CREATE TABLE IF NOT EXISTS devices (
  udid         TEXT PRIMARY KEY,      -- iOS UUID, AVD name, or real-device serial
  flavor       TEXT REFERENCES ref_flavor(name),
  type         TEXT REFERENCES ref_type(name),
  os_name      TEXT REFERENCES ref_os(name),
  os_version   TEXT,                  -- marketing release ('14', '18.6'); NEVER an API level
  api_level    TEXT REFERENCES ref_api_level(name),  -- Android only ('API 34'); NULL for iOS
  resolution   TEXT,                  -- Android screen pixels 'WxH' ('1080x2424')
  density      INTEGER,               -- Android screen density (dpi), for the diagonal calc
  boot_option  TEXT,                  -- Android AVD boot: 'Quick Boot' | 'Cold Boot'
  google_support TEXT,                -- Android system image: 'Full' | 'APIs only' | 'None'
  manufacturer TEXT,
  model        TEXT,
  display_name TEXT,
  ipv4 TEXT, ipv6 TEXT, hostname TEXT DEFAULT 'localhost',  -- ipv4/ipv6: real device last-seen LAN address
  state        TEXT,                  -- last-seen state
  present      INTEGER DEFAULT 1,     -- still exists in the toolchain (0 = gone)
  notes        TEXT,
  first_seen   TEXT, last_seen TEXT,
  -- readiness columns (shipped before versioning, see _DEVICE_COLUMNS_ADDED):
  compile_level    TEXT,             -- last AOT/dexopt level (low|medium|hot|NULL)
  has_default_boot INTEGER DEFAULT 0,-- 1 once a default_boot snapshot exists
  default_boot_windowed INTEGER DEFAULT 0, -- 1 = snapshot baked windowed (see --bake:windowed)
  last_warmed_at   TEXT,             -- ISO ts of last warm/bake/save-quickboot
  last_used        TEXT,             -- ISO ts of last resolve/start/kill/warm
  -- native real-device support (v1):
  personal          INTEGER DEFAULT 0,-- 1 = personal/"mine"; 0 = test pool
  last_reachable_at TEXT,            -- ISO ts a real device last answered a probe
  claim_owner       TEXT,            -- runner holding an advisory claim/lease
  claim_pid         INTEGER,         -- pid of the claim holder
  claim_heartbeat_at TEXT            -- ISO ts of the claim's last heartbeat
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

-- G. adb-handle → canonical device resolution. One physical phone answers to
-- several TRANSIENT adb handles (USB serial 'ZL8325PRBD', WiFi 'ip:port',
-- emulator 'emulator-5554'); all report the SAME hardware serial (getprop
-- ro.serialno) which we adopt as the canonical devices.udid. This caches the
-- mapping so a WiFi handle resolves without re-probing, and records the
-- last-seen transport/address. Handles are ephemeral rows; devices.udid is not.
CREATE TABLE IF NOT EXISTS device_transports (
  handle    TEXT PRIMARY KEY,       -- adb serial as `adb devices` reports it
  udid      TEXT NOT NULL,          -- canonical devices.udid it resolves to
  transport TEXT,                   -- 'usb' | 'wifi' | 'emulator'
  ipv4      TEXT,
  port      INTEGER,                -- adb tcpip port (WiFi; often 5555, may vary)
  last_seen TEXT
);
"""

# Android API levels we seed as reference values (stored form is 'API NN', per the
# request). Covers everything currently in the pool (API 34 real/34 AVDs … API 37
# Pixel_10) with headroom below and one above; add new levels here as Android ships.
API_LEVELS = [f"API {n}" for n in range(21, 41)]

REF_SEED = {
    "ref_flavor":    ["Simulated", "Real", "Native", "Remote"],
    "ref_type":      ["Android", "iOS", "web"],
    "ref_os":        ["AndroidOS", "MacOS", "iOS", "Graphene", "CalyxOS", "Other"],
    "ref_api_level": API_LEVELS,
}

# Every column ever added to `devices` after its first ship, in order. Folded into
# the canonical CREATE TABLE above for fresh DBs; replayed (table_info-guarded) on
# existing DBs by migrate_db(). Keep this list and the CREATE TABLE in lockstep.
_DEVICE_COLUMNS_ADDED = [
    # readiness columns (pre-versioning)
    ("compile_level",     "TEXT"),
    ("has_default_boot",  "INTEGER DEFAULT 0"),
    ("last_warmed_at",    "TEXT"),
    ("last_used",         "TEXT"),
    # native real-device support (v1)
    ("personal",          "INTEGER DEFAULT 0"),
    ("last_reachable_at", "TEXT"),
    ("claim_owner",       "TEXT"),
    ("claim_pid",         "INTEGER"),
    ("claim_heartbeat_at", "TEXT"),
    # v2
    ("api_level",         "TEXT"),   # 'API NN' (Android); references ref_api_level
    # v3 (Android screen / boot / system-image facts)
    ("resolution",        "TEXT"),
    ("density",           "INTEGER"),
    ("boot_option",       "TEXT"),
    ("google_support",    "TEXT"),
    # v4
    ("default_boot_windowed", "INTEGER DEFAULT 0"),
]

# Columns removed after first ship, dropped once (ALTER TABLE … DROP COLUMN, guarded
# by table_info so fresh/already-migrated DBs are safe). SQLite >= 3.35 (2021).
#   v2: serial — the transient adb handle. Emulator handles are re-probed live each
#       run; real-device handles now live in device_transports keyed to the canonical
#       udid. A stored 'serial' was stale-by-design and duplicated the udid for USB
#       real devices, so it carried no information the live probe / cache doesn't.
_DEVICE_COLUMNS_DROPPED = ["serial"]

# Fixed INSERTs for the reference tables (avoids interpolating the table name).
_REF_INSERTS = {
    "ref_flavor":    "INSERT OR IGNORE INTO ref_flavor(name) VALUES (?)",
    "ref_type":      "INSERT OR IGNORE INTO ref_type(name) VALUES (?)",
    "ref_os":        "INSERT OR IGNORE INTO ref_os(name) VALUES (?)",
    "ref_api_level": "INSERT OR IGNORE INTO ref_api_level(name) VALUES (?)",
}


def init_db(conn, name_pool=None):
    """Create the canonical schema, seed the reference tables, and (if a name_pool
    list is given and the pool is empty) seed the human-name pool. Idempotent."""
    conn.executescript(SCHEMA)
    for table, vals in REF_SEED.items():
        conn.executemany(_REF_INSERTS[table], [(v,) for v in vals])
    if name_pool is not None:
        if conn.execute("SELECT COUNT(*) FROM name_pool").fetchone()[0] == 0:
            conn.executemany("INSERT OR IGNORE INTO name_pool(name) VALUES (?)",
                             [(n,) for n in name_pool])
    conn.commit()


def migrate_db(conn):
    """Bring a pre-existing DB up to SCHEMA_VERSION. Adds only columns that are
    missing (PRAGMA table_info), so fresh/partially/fully migrated DBs are all safe,
    then records PRAGMA user_version. A fresh DB (already canonical) only gets its
    version stamped. Column names come solely from _DEVICE_COLUMNS_ADDED (trusted)."""
    ver = conn.execute("PRAGMA user_version").fetchone()[0]
    if ver >= SCHEMA_VERSION:
        return
    have = {row[1] for row in conn.execute("PRAGMA table_info(devices)")}  # row[1] = name
    for col, decl in _DEVICE_COLUMNS_ADDED:
        if col not in have:
            conn.execute("ALTER TABLE devices ADD COLUMN " + col + " " + decl)
    for col in _DEVICE_COLUMNS_DROPPED:
        if col in have:
            conn.execute("ALTER TABLE devices DROP COLUMN " + col)
    conn.execute("PRAGMA user_version = " + str(int(SCHEMA_VERSION)))
    conn.commit()
