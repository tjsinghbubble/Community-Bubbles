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

# Bump when the canonical schema gains columns; add the new columns to
# _DEVICE_COLUMNS_ADDED so existing DBs converge.
SCHEMA_VERSION = 1

SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- Reference tables instead of native ENUMs: the mobile market changes fast, so
-- new flavors/types/OSes are INSERTed as rows, never schema migrations.
CREATE TABLE IF NOT EXISTS ref_flavor (name TEXT PRIMARY KEY);   -- Simulated|Real|Native|Remote
CREATE TABLE IF NOT EXISTS ref_type   (name TEXT PRIMARY KEY);   -- Android|iOS|web
CREATE TABLE IF NOT EXISTS ref_os     (name TEXT PRIMARY KEY);   -- AndroidOS|MacOS|iOS|Graphene|CalyxOS|Other

-- A. Devices. Dynamically reconciled with the live toolchain each sync.
-- Canonical column set (fresh DBs match this exactly; existing DBs are migrated
-- to it by migrate_db()).
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
  first_seen   TEXT, last_seen TEXT,
  -- readiness columns (shipped before versioning, see _DEVICE_COLUMNS_ADDED):
  compile_level    TEXT,             -- last AOT/dexopt level (low|medium|hot|NULL)
  has_default_boot INTEGER DEFAULT 0,-- 1 once a default_boot snapshot exists
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
"""

REF_SEED = {
    "ref_flavor": ["Simulated", "Real", "Native", "Remote"],
    "ref_type":   ["Android", "iOS", "web"],
    "ref_os":     ["AndroidOS", "MacOS", "iOS", "Graphene", "CalyxOS", "Other"],
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
]

# Fixed INSERTs for the reference tables (avoids interpolating the table name).
_REF_INSERTS = {
    "ref_flavor": "INSERT OR IGNORE INTO ref_flavor(name) VALUES (?)",
    "ref_type":   "INSERT OR IGNORE INTO ref_type(name) VALUES (?)",
    "ref_os":     "INSERT OR IGNORE INTO ref_os(name) VALUES (?)",
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
    conn.execute("PRAGMA user_version = " + str(int(SCHEMA_VERSION)))
    conn.commit()
