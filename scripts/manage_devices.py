#!/usr/bin/env python3
"""
manage_devices — one syntax to start / stop / list / loop / tune simulated
devices, backed by a small SQLite database used as a test-time oracle.

  -r, --running [-v]         running (or mid-boot) devices, same table as --list filtered
  -l, --list [-v]            list ALL devices + aliases, grouped Running then Available,
                             each in platform order; -v dumps the full record (TSV)
      --resolve ID           print the maestro device id (android adb serial / iOS UDID)
                             for an id/alias; bare id on stdout, rich line on stderr
      --mark-used ID         record an id/alias as last-ios/last-android (no stdout id);
                             a manual qa:flow run calls this to mark the device it ran on
      --history [ID]         dump warmup/bake/start/kill timings (all, or one id/alias)
      --start ID             start device(s) with perf flags (software GPU, cores, …)
      --start:headless ID    start headless + read-only + perf flags (CI)
      --start-basic ID       start device(s), legacy windowed behaviour
  -k, --kill ID              stop device(s)  (no-op if not running);
                             `--kill all` = narrated full stop with escalation ladder
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
      --dry-run              with a mutating action: print the low-level commands
                             (and implicit loops) it WOULD run; change nothing
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
import shlex
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

# Shared internals live in scripts/helpers/. This script runs as a path (not an
# installed package), so make its own dir importable, then pull the DB schema/migration.
_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))
from helpers import helper_manage_devices as hmd  # noqa: E402  # type: ignore[import-not-found]
from helpers import helper_toolchain as htc  # noqa: E402  # type: ignore[import-not-found]

REPO = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get("MANAGE_DEVICES_DB",
                              REPO / ".device-manager" / "devices.db"))

STOP = "\U0001F6D1"  # 🛑
END_OF_LIST = "end-of-list"

# Grace before escalating a SIGQUIT to SIGKILL when stopping an emulator. An Android
# emulator told to stop (`adb emu kill` / SIGQUIT) writes its quick-boot snapshot
# (default_boot) on the way out — the window flickers/bounces while it serialises RAM
# to disk. SIGKILL mid-save tears the snapshot (torn default_boot ⇒ false-ready / boot
# failures next start). Doubled from 2s → 4s so the save finishes before we GTFO it.
# Override with EMU_KILL_GRACE_S for slow hosts / large-RAM AVDs.
EMU_KILL_GRACE_S = float(os.environ.get("EMU_KILL_GRACE_S", "4"))

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

# --dry-run: when set, the mutating actions print the low-level commands (and the
# implicit loops/waits) they WOULD run, and change no device state. Set from argv
# in main(); the action commands branch on it.
DRY_RUN = False

def dry(argv, note=""):
    """Show one low-level command --dry-run WOULD execute (shell-quoted)."""
    line = " ".join(shlex.quote(str(a)) for a in argv)
    print(f"  would run: {line}" + (f"    # {note}" if note else ""), flush=True)

def dry_note(msg):
    """Annotate the dry-run plan with something that isn't a single command —
    an implicit loop, a wait/sleep, timing, or a short-circuit rule."""
    print(f"  · {msg}", flush=True)

def run(cmd, capture=True):
    """Run a command. stderr always inherits (never swallowed)."""
    return subprocess.run(cmd, stdout=subprocess.PIPE if capture else None,
                          stderr=None, text=True)

def run_cap(cmd):
    """Like run(), but capture stdout+stderr together so the caller can parse the
    result. Used where success must be inspected rather than assumed: the AOT
    `cmd package compile` step, and the emulator-console snapshot save (which
    replies 'OK' on success or 'KO: <reason>' on failure)."""
    return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                          text=True)

def pids_matching(pattern):
    # A leading '-' in `pattern` would be read as a pgrep flag; callers strip it (we also
    # silence stderr so a no-match / odd pattern doesn't print BSD pgrep's usage banner).
    r = subprocess.run(["pgrep", "-f", pattern], stdout=subprocess.PIPE,
                       stderr=subprocess.DEVNULL, text=True)
    return [int(p) for p in r.stdout.split()] if r.returncode == 0 else []

# ── database ───────────────────────────────────────────────────────────────────

# Schema (CREATE TABLE …), REF_SEED, and the one-time versioned migration live in
# scripts/helpers/helper_manage_devices.py — see hmd.SCHEMA / init_db / migrate_db.
_conn = None

# (devices-table columns + one-time versioned migration now live in
#  scripts/helpers/helper_manage_devices.py: hmd.SCHEMA / init_db / migrate_db.)

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
        hmd.init_db(_conn, name_pool=human_names())  # canonical schema + ref/name seed
        hmd.migrate_db(_conn)                         # one-time, versioned (no per-open ALTERs)
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
            raw = d.get("state", "Unknown")
            # Preserve a mid-boot sim as "Booting" (otherwise _norm_state hides it as
            # Shutdown and it never shows in the running list — issue: started-not-shown).
            state = "Booting" if raw == "Booting" else _norm_state(raw)
            out.append({"kind": "ios", "id": d["udid"], "serial": None,
                        "name": d.get("name", d["udid"]),
                        "os_version": ver,
                        "state": state})
    return out

def ios_booted():
    return [d for d in ios_devices() if d["state"] == "Running"]

def android_avds():
    r = run([emulator_bin(), "-list-avds"])
    return [l.strip() for l in (r.stdout or "").splitlines() if l.strip()]

# Android API level → marketing release, to mirror iOS's os_version style ("14" vs "26.5").
# A running device reports its release directly via getprop; a shutdown AVD only exposes its
# API level on disk, so we map it (unknown levels fall back to "API NN").
_API_TO_RELEASE = {
    28: "9", 29: "10", 30: "11", 31: "12", 32: "12", 33: "13",
    34: "14", 35: "15", 36: "16",
}

def _release_from_api(api):
    return _API_TO_RELEASE.get(api, f"API {api}") if api else None

def _avd_os_version(avd):
    """Marketing release of a (possibly shutdown) AVD, parsed from its config.ini's
    `image.sysdir`/`target` (android-NN) and mapped to a release. None if not found —
    unlike _avd_api, never guesses a default level."""
    cfg = Path.home() / ".android" / "avd" / f"{avd}.avd" / "config.ini"
    ini = Path.home() / ".android" / "avd" / f"{avd}.ini"
    for p in (cfg, ini):
        if p.exists():
            m = re.search(r"android-(\d+)", p.read_text())
            if m:
                return _release_from_api(int(m.group(1)))
    return None

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
        # Marketing release straight from the live device (authoritative); one-shot getprop.
        rel = run([adb_bin(), "-s", serial, "shell", "getprop", "ro.build.version.release"])
        os_version = (rel.stdout or "").strip() or None
        out.append({"kind": "android", "id": name, "serial": serial,
                    "name": name, "os_version": os_version, "state": "Running",
                    "flavor": "Simulated"})  # emulator console / Genymotion VM (ip:port)
    return out

def android_real():
    """USB-attached PHYSICAL Android phones — serials that are NEITHER `emulator-*`
    NOR `ip:port` (Genymotion/adb-connect VMs, which stay Simulated). flavor='Real'.
    `id` is the adb serial (a stable identifier); `name` is the device model."""
    if not htc.capabilities()["adb"]:
        return []
    r = run([adb_bin(), "devices"])
    out = []
    for line in (r.stdout or "").splitlines()[1:]:
        parts = line.split()
        if len(parts) < 2 or parts[1] != "device":
            continue
        serial = parts[0]
        is_emu = serial.startswith("emulator-")
        is_net = bool(re.match(r"^[\w.-]+:\d+$", serial))
        if is_emu or is_net:
            continue                                       # not a physical device

        def _gp(prop):
            x = run([adb_bin(), "-s", serial, "shell", "getprop", prop])
            return (x.stdout or "").strip()
        manuf = _gp("ro.product.manufacturer") or None
        model = _gp("ro.product.model") or serial
        rel = _gp("ro.build.version.release") or None
        out.append({"kind": "android", "id": serial, "serial": serial,
                    "name": model, "os_version": rel, "state": "Running",
                    "flavor": "Real", "manufacturer": manuf, "model": model})
    return out

def ios_real():
    """Physical iOS devices — LIST-ONLY this phase (no install/launch; signing
    unresolved). Best-effort parse of `xcrun xctrace list devices`; returns [] if
    xcrun is absent or nothing parses. Entries carry real_unsupported=True so the
    resolve/runner paths can refuse execution with a clear message."""
    if not htc.capabilities()["xcode"]:
        return []
    try:
        r = run(["xcrun", "xctrace", "list", "devices"])
    except Exception:
        return []
    out, in_devices = [], False
    for line in (r.stdout or "").splitlines():
        s = line.strip()
        if s.startswith("== Devices"):
            in_devices = True
            continue
        if s.startswith("== "):                            # Simulators / Offline / …
            in_devices = False
            continue
        if not in_devices or not s or "Mac" in s:          # skip the host Mac entry
            continue
        m = re.match(r"^(.*?) \(([0-9.]+)\) \(([0-9A-Fa-f-]{8,})\)$", s)
        if not m:
            continue                                       # host line has no iOS version shape
        name, ver, udid = m.group(1), m.group(2), m.group(3)
        out.append({"kind": "ios", "id": udid, "serial": None, "name": name,
                    "os_version": ver, "state": "Running", "flavor": "Real",
                    "manufacturer": "Apple", "model": name, "real_unsupported": True})
    return out

def android_booting_names():
    """AVDs whose emulator (qemu) process is alive but which adb has NOT yet promoted to
    'device' state — i.e. mid-boot. Lets a just-started emulator show in the running list
    before it's fully up. One `ps` scan, WHOLE-TOKEN match on `-avd <name>` / `@<name>` so
    e.g. 'Pixel_9_Pro_XL' does not falsely match 'Pixel_9_Pro_XL_copy_Lainey'."""
    candidates = [n for n in android_avds()
                  if n not in {d["id"] for d in android_running()}]
    if not candidates:
        return set()
    r = subprocess.run(["ps", "-axo", "command"], stdout=subprocess.PIPE,
                       stderr=subprocess.DEVNULL, text=True)
    cmds = r.stdout or ""
    booting = set()
    for name in candidates:
        if re.search(rf"(?:-avd\s+|@){re.escape(name)}(?=\s|$)", cmds, re.M):
            booting.add(name)
    return booting

def android_all():
    """AVDs (defined) merged with running emulators (serial attached)."""
    running = {d["id"]: d for d in android_running()}
    booting = android_booting_names()
    out = []
    for name in android_avds():
        if name in running:
            out.append(running.pop(name))
        else:
            out.append({"kind": "android", "id": name, "serial": None,
                        "name": name, "os_version": _avd_os_version(name),
                        "state": "Booting" if name in booting else "Shutdown"})
    out.extend(running.values())  # running but not in -list-avds (rare)
    return out

def live_index():
    """udid/avd -> live device dict, for current state during resolve/sync.
    Includes real (physical) devices alongside sims/emulators."""
    idx = {}
    for d in ios_devices() + android_all() + android_real() + ios_real():
        idx[d["id"]] = d
    return idx

def is_real(dev):
    """True if dev is a physical device (flavor='Real'). Falls back to the DB row
    when the live dict doesn't carry a flavor (ios_devices()/android_all() omit it)."""
    if dev is None:
        return False
    fl = dev.get("flavor")
    if fl is None:
        row = db().execute("SELECT flavor FROM devices WHERE udid=?",
                           (dev.get("id"),)).fetchone()
        fl = row["flavor"] if row else None
    return fl == "Real"

def refuse_on_real(dev, op):
    """Guard for sim/emulator-only operations: if dev is a real (physical) device,
    print a clear refusal and return True so the caller skips it. A real phone is
    already running and can't be booted/cloned/snapshotted — install + run only."""
    if is_real(dev):
        err(f"{op}: {dev.get('name') or dev.get('id')!r} is a REAL device — already "
            f"running; cannot boot/clone/snapshot it (real devices: install + run only).")
        return True
    return False

def reachable(dev):
    """Fast best-effort liveness for a REAL device. Android: its adb serial is in
    `adb devices`. iOS-real: not executable this phase → always False (caller drops it
    with a note). Non-real devices are considered reachable here (handled elsewhere)."""
    if not is_real(dev):
        return True
    if dev.get("kind") == "android":
        serial = dev.get("serial") or dev.get("id")
        r = run([adb_bin(), "devices"])
        for line in (r.stdout or "").splitlines()[1:]:
            parts = line.split()
            if len(parts) >= 2 and parts[0] == serial and parts[1] == "device":
                return True
        return False
    return False  # iOS-real: listing only

def android_pids(dev):
    pids = pids_matching(dev["id"])
    if not pids and (dev.get("serial") or "").startswith("emulator-"):
        pids = pids_matching(f"-port {dev['serial'].split('-', 1)[1]}")
    return pids

def _proc_argv(pid):
    """Full command line of a pid (one string), via `ps -o command=`. '' if gone."""
    r = subprocess.run(["ps", "-o", "command=", "-p", str(pid)],
                       stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    return (r.stdout or "").strip()

def looks_headless(dev):
    """Best-effort: is THIS running device headless (screenshots come back BLACK)?

    'Headless' is a BOOT MODE, not a persisted property, so this inspects the live
    emulator process args for `-no-window` (how --start:headless / the qa runner boot
    it on this host). Returns True/False for a running Android emulator, None when it
    can't be told (not running, no pid, or iOS — sims are always windowed). Keep the
    terminology 'headless'/'likely headless' consistent with testctl's surfacing."""
    if dev["kind"] != "android" or not is_running(dev):
        return None
    pids = android_pids(dev)
    if not pids:
        return None
    argv = _proc_argv(pids[0])
    if not argv:
        return None
    return "-no-window" in argv.split()

def is_running(dev):
    return dev["state"] in ("Booted", "Running")

def is_booting(dev):
    return dev.get("state") == "Booting"

def is_live(dev):
    """Running OR mid-boot — the membership test for the 'running' list/section."""
    return is_running(dev) or is_booting(dev)

def _state_label(dev):
    """Display state for the STATE column: Running | Booting | Shutdown."""
    if is_running(dev):
        return "Running"
    if is_booting(dev):
        return "Booting"
    return "Shutdown"

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
    """Upsert live devices (sims/emulators AND real phones), auto-allocate names.
    Sim/emulator devices that vanish are marked present=0; REAL devices persist
    (present stays 1) and are flipped to state='Offline' when not currently attached —
    a real phone is still 'a device we own' when unplugged. personal/claim_* are never
    clobbered by a sync."""
    live = ios_devices() + android_all() + android_real() + ios_real()
    live_ids = {d["id"] for d in live}
    now = now_iso()
    for d in live:
        flavor = d.get("flavor", "Simulated")
        if d["kind"] == "ios":
            typ, osn = "iOS", "iOS"
            manuf = d.get("manufacturer", "Apple")
            model = d.get("model") or d["name"].split(" / ")[0]
        else:
            typ, osn = "Android", "AndroidOS"
            manuf = d.get("manufacturer")
            model = d.get("model") or d["name"]
        reach = now if flavor == "Real" else None
        existing = db().execute("SELECT udid FROM devices WHERE udid=?",
                                (d["id"],)).fetchone()
        if existing:
            db().execute(
                "UPDATE devices SET flavor=?, state=?, serial=?,"
                " os_version=COALESCE(?,os_version), display_name=?,"
                " manufacturer=COALESCE(?,manufacturer), model=COALESCE(?,model),"
                " last_reachable_at=COALESCE(?,last_reachable_at), present=1,"
                " last_seen=? WHERE udid=?",
                (flavor, d["state"], d.get("serial"), d.get("os_version"),
                 d["name"], manuf, model, reach, now, d["id"]))
        else:
            db().execute(
                "INSERT INTO devices(udid,flavor,type,os_name,os_version,manufacturer,"
                "model,display_name,serial,state,last_reachable_at,present,first_seen,last_seen) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,?)",
                (d["id"], flavor, typ, osn, d.get("os_version"), manuf, model,
                 d["name"], d.get("serial"), d["state"], reach, now, now))
        allocate_name(d["id"])
    if live_ids:
        q = ",".join("?" * len(live_ids))
        # sims/emulators that vanished are gone (present=0); real phones merely unplugged
        # stay present=1 but show Offline.
        db().execute("UPDATE devices SET present=0 WHERE flavor!='Real' "
                     "AND udid NOT IN (" + q + ")", tuple(live_ids))
        db().execute("UPDATE devices SET state='Offline' WHERE flavor='Real' "
                     "AND udid NOT IN (" + q + ")", tuple(live_ids))
    else:
        db().execute("UPDATE devices SET present=0 WHERE flavor!='Real'")
        db().execute("UPDATE devices SET state='Offline' WHERE flavor='Real'")
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
                "os_version": row["os_version"], "state": row["state"] or "Unknown",
                "flavor": row["flavor"]}
    return None

def resolve_many(ident, idx=None) -> "list[dict]":
    """Resolve an id/alias to device dicts, then DROP any real device that is currently
    unreachable (don't fail the whole run because one phone is unplugged). Raise
    ResolveError only if nothing usable remains."""
    devs = _resolve_many_raw(ident, idx)
    kept, dropped = [], []
    for d in devs:
        if is_real(d) and not reachable(d):
            dropped.append(d)
        else:
            kept.append(d)
    for d in dropped:
        err(f"  ⚠ skipping unreachable real device {d.get('name') or d.get('id')!r}")
    if devs and not kept:
        raise ResolveError(f"alias {ident!r}: matching real device(s) are unreachable")
    return kept

def _resolve_many_raw(ident, idx=None) -> "list[dict]":
    """Resolve an id/alias to a list of device dicts. Raise ResolveError if none."""
    if idx is None:
        idx = live_index()
    a = ident.strip()
    low = a.lower()

    # group / system aliases ----------------------------------------------------
    # 'mine' / 'real' are COMPUTED groups over real (physical) devices: 'mine' = all
    # personal phones, 'real' = all test-pool phones. Computed (not stored) so they
    # naturally cover multiple devices, unlike a single-target stored alias.
    if low in ("mine", "real"):
        want_personal = 1 if low == "mine" else 0
        rows = db().execute("SELECT udid FROM devices WHERE flavor='Real' AND present=1 "
                            "AND personal=?", (want_personal,)).fetchall()
        out = [d for d in (_enrich(r["udid"], idx) for r in rows) if d]
        if not out:
            raise ResolveError(f"alias {ident!r}: no matching real devices")
        return out
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
        out = _apply_filters(out)
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

def resolve_one_raw(ident, idx=None) -> "dict":
    """Like resolve_one but WITHOUT the reachability drop — for offline metadata
    queries (kind-of / flavor-of) that must answer even for an unplugged real device."""
    return _resolve_many_raw(ident, idx)[0]

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
    """Android launch flags: -gpu auto picks the best renderer for the host,
    -no-boot-anim/-no-audio trim startup, -cores/-memory are host-tuned. Headless
    adds -no-window -read-only (parallel CI instances)."""
    # GPU mode is always `auto` (see gpu_default()): swiftshader_indirect is deprecated
    # (emulator 36.4.9, Feb 2026) and `-gpu host` failed to render the RN Fabric app on
    # this Intel/Radeon Mac. `auto` lets the emulator select the best backend.
    flags = ["-no-boot-anim", "-no-audio", "-gpu", gpu_default(),
             "-cores", str(recommended_cores()),
             "-memory", str(recommended_memory_mb())]
    # NB: -no-window makes screencap/takeScreenshot return BLACK pixels here (tests
    # still pass — Maestro asserts on the a11y tree — but visual artifacts are useless).
    # Boot WINDOWED when you need real screenshots.
    if headless:
        flags += ["-no-window", "-read-only"]
    return flags

def gpu_default():
    # BUG-REGISTRY:a — the old code forced `-gpu swiftshader_indirect`, deprecated in
    # emulator 36.4.9 (Feb 2026). `auto` is the standing decision (both this launch flag
    # AND the AVD config.ini default via normalize_gpu_config()). Do not reintroduce a
    # specific renderer without falsifying `auto`.
    return "auto"


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

def cmd_running(verbose=False):
    """Running (or mid-boot) devices only — same renderer + verbose behaviour as --list,
    just filtered to the live set (issue: running must share list's output code)."""
    sync()
    host_profile()  # keep this machine's specs (table F) current
    devices = _apply_filters(ios_devices() + android_all() + android_real() + ios_real())
    live = [d for d in devices if is_live(d)]
    if not live:
        print("No running devices")
        return 0
    sysmap = _system_alias_map()
    sections = [("RUNNING", live)]
    if verbose:
        _list_long(sections, sysmap)
        return 0
    _render_short(sections, live, sysmap)
    return 0

# ── --list rendering ─────────────────────────────────────────────────────────────
_USE_COLOR = sys.stdout.isatty()
# "Headless" column dropped 2026-06-26: the headless marker is unreliable (bug-registry
# b/e) and headless is no longer a user-facing mode. looks_headless() is kept for
# --headless-of (qa:flow --require-screen).
SHORT_HEADERS = ["Aliases", "Kind", "Device", "State", "Ready", "Last Used"]
DEVICE_COL = 2          # index of the Device column in _short_cells
DEVICE_CAP = 28         # non-verbose cap for the Device name (verbose: uncapped)
ALIAS_COLOR = (1, 31)   # bold red — same for Running and Available (Available's was nicer)
PLATFORM_ORDER = ["iOS", "Android", "Genymotion"]

def _cap(s, n=DEVICE_CAP):
    """Truncate to n chars with a trailing … (U+2026). Non-verbose display only."""
    return s if len(s) <= n else s[: n - 1] + "…"

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
    if ver:
        label += f" / {ver}"
    return label

def _display_short(d, row):
    # Personal display names pack the OS after a ' / ' — show only the model half.
    name = (row["display_name"] if row else None) or d.get("name") or ""
    return name.split(" / ")[0].strip()

def _ready_marker(d, row):
    """Hybrid liveness + bake (Travis): the bake/warm marker (compile level + default_boot)
    whenever it exists, else 'live' for a running-but-unbaked device, else blank. A running
    device therefore never reads blank, without any per-device boot_completed probing."""
    lvl = row["compile_level"] if row else None
    baked = row["has_default_boot"] if row else None
    if lvl and baked:
        return f"baked/{lvl}"
    if baked:
        return "baked"
    if lvl:
        return lvl
    return "live" if is_running(d) else ""

def _relative_last_used(row):
    """Coarse, human relative time for the Last Used column when the device was used
    within the last 7 days; absolute (YYYY-MM-DD HH:MM) beyond that. Time-of-day phrasing
    keys off the LOCAL clock at the time of use.

      ≤ 50 min ago                  → "within the hour"
      ≤ 18 h ago (same local day)   → "this morning/afternoon/evening", "early this morning"
      ≤ 18 h ago (crossed midnight) → "last evening", "yesterday morning/afternoon", …
      > 18 h ago, within 7 days     → "Today" / "Yesterday" / weekday name
      > 7 days                      → absolute timestamp

    NOTE (underspecified in the request, decided here): the 50–90 min band folds into the
    "this <time-of-day>" bucket (no gap), and the dangling ">3 hours ago" rule is omitted
    as it conflicts with the 18 h day-naming boundary."""
    iso = (row["last_used"] if row else None)
    if not iso:
        return ""
    try:
        t = datetime.fromisoformat(iso)
    except ValueError:
        return iso.replace("T", " ")[:16]
    if t.tzinfo is None:
        t = t.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    secs = (now - t).total_seconds()
    if secs < 0:
        return "just now"
    tl, nl = t.astimezone(), now.astimezone()        # local for clock-of-day + calendar day
    if secs > 7 * 86400:
        return tl.strftime("%Y-%m-%d %H:%M")
    days = (nl.date() - tl.date()).days
    if secs <= 50 * 60:
        label = "within the hour"
    elif secs <= 18 * 3600:
        h = tl.hour
        part = ("early morning" if h < 5 else "morning" if h < 12
                else "afternoon" if h < 18 else "evening")
        if days == 0:
            label = "early this morning" if part == "early morning" else f"this {part}"
        elif part == "evening":
            label = "last evening"
        else:
            label = ("early yesterday morning" if part == "early morning"
                     else f"yesterday {part}")
    elif days == 0:
        label = "Today"
    elif days == 1:
        label = "Yesterday"
    elif days <= 6:
        label = tl.strftime("%A")
    else:
        return tl.strftime("%Y-%m-%d %H:%M")
    # Within the last 24h, pin the coarse phrase to an exact local clock time (Travis): the
    # relative bucket says roughly when, the appended (HH:MM) says exactly when.
    if secs <= 24 * 3600:
        label += f" ({tl.strftime('%H:%M')})"
    return label

def _headless_marker(d):
    """Cell for the HEADLESS column. Only a RUNNING android emulator can be probed;
    everything else (iOS, shutdown) is blank. 'headless' = -no-window seen in the live
    process args; '' = windowed; 'headless?' = running but un-probeable (a 'likely')."""
    hl = looks_headless(d)
    if hl is None:
        return ""
    return "headless" if hl else ""

def _short_cells(d, sysmap):
    row = _device_row(d["id"])
    return [", ".join(all_aliases_for(d["id"], sysmap)),
            _flavor_label(d, row), _display_short(d, row),
            _state_label(d),
            _ready_marker(d, row), _relative_last_used(row)]

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

def _render_short(sections, universe, sysmap):
    """Shared short-table renderer for `--list` and `--running` (issue: they must be the
    same output code, just filtered). `universe` = every device shown (for column widths).
    Caps the Device name at DEVICE_CAP with … (non-verbose only); aliases use one color for
    all sections; widths size to the shown devices."""
    plain = {}
    for d in universe:
        cells = _short_cells(d, sysmap)
        cells[DEVICE_COL] = _cap(cells[DEVICE_COL])
        plain[d["id"]] = cells
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
                cells = [c.ljust(widths[i]) for i, c in enumerate(plain[d["id"]])]
                cells[0] = _c(cells[0], *ALIAS_COLOR)
                print("    " + "  ".join(cells))
        print()

def cmd_list(verbose=False):
    """Every in-scope device (iOS sims + Android emulators), grouped Running then
    Available, each in platform order (iOS, Android, Genymotion). Reminds testers
    what's around. -v/--verbose dumps the full per-device record (tab-separated)."""
    sync()
    host_profile()
    devices = ios_devices() + android_all() + android_real() + ios_real()
    # Real (physical) devices we know about but that aren't attached right now still
    # belong in the list (shown Offline under AVAILABLE) — a phone we own is "a device".
    live_ids = {d["id"] for d in devices}
    for r in db().execute("SELECT * FROM devices WHERE flavor='Real' AND present=1").fetchall():
        if r["udid"] not in live_ids:
            devices.append({"kind": "ios" if r["type"] == "iOS" else "android",
                            "id": r["udid"], "serial": r["serial"],
                            "name": r["display_name"] or r["udid"],
                            "os_version": r["os_version"],
                            "state": r["state"] or "Offline", "flavor": "Real"})
    devices = _apply_filters(devices)
    sysmap = _system_alias_map()
    sections = [("RUNNING", [d for d in devices if is_live(d)]),
                ("AVAILABLE", [d for d in devices if not is_live(d)])]
    if verbose:
        _list_long(sections, sysmap)
        return 0
    _render_short(sections, devices, sysmap)
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

def cmd_kind_of(ident):
    """Print a device's platform ('ios' or 'android') to stdout for an id/alias, WITHOUT
    requiring it to be running (resolve_one is offline). The qa runner uses this to infer
    --platform from --sim and to validate an explicit --platform against the sim's real
    kind before booting anything."""
    sync()
    try:
        dev = resolve_one_raw(ident)        # offline: answer even if unplugged
    except ResolveError as e:
        err(f"kind-of: {e}")
        return 2
    print(dev["kind"])  # bare: 'ios' | 'android'
    return 0

def cmd_flavor_of(ident):
    """Print a device's flavor ('real' or 'simulated') to stdout for an id/alias
    (offline). The qa runner uses it to choose the right build/install path."""
    sync()
    try:
        dev = resolve_one_raw(ident)        # offline: answer even if unplugged
    except ResolveError as e:
        err(f"flavor-of: {e}")
        return 2
    print("real" if is_real(dev) else "simulated")
    return 0

# Listing/availability filters, set from --ios/--android and --real/--simulated.
FILTER_PLATFORM = None   # None | 'ios' | 'android'
FILTER_FLAVOR = None     # None | 'real' | 'simulated'

def _apply_filters(devices):
    """Restrict a device list by the active platform/flavor filters (no-op if unset)."""
    out = []
    for d in devices:
        if FILTER_PLATFORM and d.get("kind") != FILTER_PLATFORM:
            continue
        if FILTER_FLAVOR:
            real = is_real(d)
            if (FILTER_FLAVOR == "real") != real:
                continue
        out.append(d)
    return out

def cmd_headless_of(ident):
    """Print a RUNNING device's screen mode to stdout: 'headless' | 'windowed' | 'unknown'.
    'headless' = -no-window in the live emulator args (screenshots come back BLACK here);
    'windowed' = a real screen; 'unknown' = iOS (always windowed enough for screenshots),
    not running, or un-probeable. qa:flow --require-screen uses this to refuse a black run."""
    sync()
    try:
        dev = resolve_one(ident)
    except ResolveError as e:
        err(f"headless-of: {e}")
        return 2
    h = looks_headless(dev)
    print("unknown" if h is None else ("headless" if h else "windowed"))
    return 0

def cmd_mark_used(ident):
    """Record an id/alias as the platform's last-used device (kv last_ios/last_android +
    devices.last_used) WITHOUT printing a maestro id — so a manual `qa:flow` run can mark
    the device it actually ran on, making a later `--resolve last-android` point back at it.
    (`--resolve` already touches on every resolve; this is the explicit, side-effect-only
    hook a caller invokes AFTER a successful run.)"""
    sync()
    try:
        dev = resolve_one(ident)
    except ResolveError as e:
        err(f"mark-used: {e}")
        return 2
    touch(dev)
    plat = "last-ios" if dev["kind"] == "ios" else "last-android"
    err(f"marked {dev['name']} ({dev['id']}) as {plat}")
    return 0

def _hist_name(udid):
    a = db().execute("SELECT alias FROM aliases WHERE udid=? AND kind IN ('name','user') "
                     "ORDER BY kind LIMIT 1", (udid,)).fetchone()
    return a["alias"] if a else udid

def cmd_history(ident=None, limit=80):
    """Dump the device-manager event history (warmup/bake/start/kill timings) so the
    overnight bench data is one command, not a hand-written SQL query. Optional ID/alias
    filters to one device. Columns: When (local) · Device · Event · Detail · Dur(s) ·
    CPU% (host-side) · Load. duration_ms on a 'warmup' row is boot-to-ready (or +dexopt
    when detail carries a level)."""
    udid = None
    if ident:
        try:
            udid = resolve_one(ident)["id"]
        except ResolveError as e:
            err(f"history: {e}")
            return 2
    q = ("SELECT ts, udid, event, detail, duration_ms, dev_load, sys_load FROM history"
         + (" WHERE udid=?" if udid else "") + " ORDER BY ts DESC LIMIT ?")
    rows = db().execute(q, ([udid, limit] if udid else [limit])).fetchall()
    if not rows:
        print("No history" + (f" for {ident}" if ident else ""))
        return 0
    cells = []
    for r in rows:
        try:
            when = datetime.fromisoformat(r["ts"]).astimezone().strftime("%m-%d %H:%M:%S")
        except (ValueError, TypeError):
            when = (r["ts"] or "")[:19]
        dur = f"{r['duration_ms'] / 1000:.1f}" if r["duration_ms"] is not None else ""
        cpu = f"{r['dev_load']:.0f}" if r["dev_load"] is not None else ""
        load = f"{r['sys_load']:.2f}" if r["sys_load"] is not None else ""
        cells.append([when, _hist_name(r["udid"]), r["event"] or "", r["detail"] or "",
                      dur, cpu, load])
    headers = ["When", "Device", "Event", "Detail", "Dur(s)", "CPU%", "Load"]
    widths = [len(h) for h in headers]
    for row in cells:
        for i, c in enumerate(row):
            widths[i] = max(widths[i], len(c))
    fmt = lambda row: "  ".join(c.ljust(widths[i]) for i, c in enumerate(row))
    print(_c(fmt(headers), 1))
    for row in cells:
        print(fmt(row))
    return 0

def cmd_start(ident, mode="optimized"):
    """mode: 'basic' (legacy windowed), 'optimized' (perf flags), 'headless'."""
    sync()
    try:
        devs = resolve_many(ident)
    except ResolveError as e:
        err(f"start: {e}")
        return 2
    if DRY_RUN:
        dry_note(f"ident {ident!r} resolves to {len(devs)} device(s); start loops over "
                 f"each (mode={mode}):")
        for dev in devs:
            if refuse_on_real(dev, "start"):
                continue
            if is_running(dev):
                dry_note(f"{dev['name']}: already running → skip (record last-used only)")
                continue
            if dev["kind"] == "ios":
                dry(["xcrun", "simctl", "boot", dev["id"]])
                if mode != "headless":
                    dry(["open", "-a", "Simulator"], note="bring the sim window up")
            else:
                flags = [] if mode == "basic" else emulator_flags(
                    headless=(mode == "headless"))
                dry([emulator_bin(), "-avd", dev["id"]] + flags,
                    note=("legacy windowed, no perf flags" if mode == "basic" else mode))
            dry_note(f"{dev['name']}: record history 'start:{mode}', mark last-used")
        return 0
    for dev in devs:
        if refuse_on_real(dev, "start"):
            continue
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
    # `--kill all` is the narrated full-stop (former `--nuke`): the graceful
    # emu-kill / simctl-shutdown pass plus the SIGQUIT→SIGKILL escalation ladder.
    if (ident or "").strip().lower() == "all":
        return kill_all()
    sync()
    try:
        devs = resolve_many(ident)
    except ResolveError as e:
        err(f"kill: {e}")
        return 2
    if DRY_RUN:
        dry_note(f"ident {ident!r} resolves to {len(devs)} device(s); kill loops over each:")
        for dev in devs:
            if refuse_on_real(dev, "kill"):
                continue
            if not is_running(dev):
                dry_note(f"{dev['name']}: not running → skip")
                continue
            if dev["kind"] == "ios":
                dry(["xcrun", "simctl", "shutdown", dev["id"]])
            else:
                dry([adb_bin(), "-s", dev["serial"], "emu", "kill"],
                    note="graceful: the emulator saves its quick-boot snapshot")
            dry_note(f"{dev['name']}: record history 'kill'")
        return 0
    for dev in devs:
        if refuse_on_real(dev, "kill"):
            continue
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

# ── device claim / lease (advisory, auto-reclaimable) ───────────────────────────
# A claim records that a test run owns a device, so status views can show "taken-by"
# and a multi-device run can skip a busy phone. Advisory + auto-reclaimable, like the
# testctl runner lock — but device-scoped, with its OWN pid+heartbeat staleness rule
# (testctl's lock is a single flat-file mutex with no per-device classifier to reuse).
CLAIM_TTL_SECONDS = 900  # a live runner refreshes its heartbeat well within this

def _pid_alive(pid):
    if not pid:
        return False
    try:
        os.kill(int(pid), 0)
    except (OSError, ValueError):
        return False
    return True

def claim_state(row):
    """(state, label) for a device row's advisory claim. state ∈ free|held|stale.
    'held' = live owner (pid alive AND heartbeat fresh); 'stale' = reclaimable."""
    keys = row.keys()
    owner = row["claim_owner"] if "claim_owner" in keys else None
    if not owner:
        return ("free", "")
    pid = row["claim_pid"] if "claim_pid" in keys else None
    hb = row["claim_heartbeat_at"] if "claim_heartbeat_at" in keys else None
    fresh = False
    if hb:
        try:
            age = (datetime.now(timezone.utc) - datetime.fromisoformat(hb)).total_seconds()
            fresh = age <= CLAIM_TTL_SECONDS
        except ValueError:
            fresh = False
    if _pid_alive(pid) and fresh:
        return ("held", f"taken-by {owner} pid{pid}")
    return ("stale", f"stale claim ({owner} pid{pid})")

def claim_device(ident, owner, pid):
    """Place/refresh an advisory claim by id/alias. Reclaims a stale claim; refuses a
    device currently held by a different live owner. Returns 0 / 2."""
    sync()
    try:
        devs = resolve_many(ident)
    except ResolveError as e:
        err(f"claim: {e}")
        return 2
    now = now_iso()
    for dev in devs:
        row = db().execute("SELECT * FROM devices WHERE udid=?", (dev["id"],)).fetchone()
        if row:
            state, label = claim_state(row)
            same = row["claim_owner"] == owner and str(row["claim_pid"]) == str(pid)
            if state == "held" and not same:
                err(f"claim: {dev['name']} is {label}")
                return 2
        db().execute("UPDATE devices SET claim_owner=?, claim_pid=?, claim_heartbeat_at=? "
                     "WHERE udid=?", (owner, int(pid), now, dev["id"]))
    db().commit()
    return 0

def release_claim(ident=None, pid=None):
    """Clear claims by id/alias OR by pid (the runner clears all its pid's claims)."""
    if pid is not None:
        db().execute("UPDATE devices SET claim_owner=NULL, claim_pid=NULL, "
                     "claim_heartbeat_at=NULL WHERE claim_pid=?", (int(pid),))
    elif ident:
        sync()
        try:
            devs = resolve_many(ident)
        except ResolveError as e:
            err(f"release: {e}")
            return 2
        for dev in devs:
            db().execute("UPDATE devices SET claim_owner=NULL, claim_pid=NULL, "
                         "claim_heartbeat_at=NULL WHERE udid=?", (dev["id"],))
    db().commit()
    return 0

# ── add a real (physical) device ────────────────────────────────────────────────

def _next_real_index(plat):
    """Next free N for a real-<plat>-N name alias (plat is 'iphone' or 'android')."""
    pref = f"real-{plat}-"
    rows = db().execute("SELECT alias FROM aliases WHERE alias LIKE ?",
                        (pref + "%",)).fetchall()
    n = 0
    for r in rows:
        m = re.match(re.escape(pref) + r"(\d+)$", r["alias"])
        if m:
            n = max(n, int(m.group(1)))
    return n + 1

def _add_alias_safe(alias, udid, kind):
    """Upsert an alias; if the name is already taken by a DIFFERENT device, suffix it
    with a short serial tail so we never silently steal another device's alias.
    Returns the alias actually stored."""
    existing = db().execute("SELECT udid FROM aliases WHERE alias=?", (alias,)).fetchone()
    if existing and existing["udid"] != udid:
        alias = f"{alias}-{str(udid)[-4:]}"
    db().execute("INSERT INTO aliases(alias,udid,kind,created_at) VALUES (?,?,?,?) "
                 "ON CONFLICT(alias) DO UPDATE SET udid=excluded.udid, kind=excluded.kind",
                 (alias, udid, kind, now_iso()))
    return alias

def cmd_add(ident=None):
    """Register a real (physical) device: choose personal-vs-test, set up the standard
    three aliases (device-name + role-name + the computed group 'mine'/'real'), and
    auto-name it. Run with the phone attached (Android: USB debugging; iOS: trusted)."""
    sync()
    attached = db().execute(
        "SELECT * FROM devices WHERE flavor='Real' AND present=1 "
        "AND COALESCE(state,'') != 'Offline'").fetchall()
    if ident:
        try:
            devs = resolve_many(ident)
        except ResolveError as e:
            err(f"add: {e}")
            return 2
        row = db().execute("SELECT * FROM devices WHERE udid=?", (devs[0]["id"],)).fetchone()
        if not row or row["flavor"] != "Real":
            err(f"add: {ident!r} is not a real device")
            return 2
    elif not attached:
        err("add: no real device attached. Connect a phone (Android: enable USB "
            "debugging; iOS: trust the Mac + Xcode) and retry.")
        return 2
    elif len(attached) > 1:
        err("add: multiple real devices attached — re-run with an id:")
        for r in attached:
            err(f"  {r['udid']}  {r['display_name']}")
        return 2
    else:
        row = attached[0]

    if not sys.stdin.isatty():
        err("add: needs an interactive prompt but stdin is not a tty.")
        return 2

    plat = "iphone" if row["type"] == "iOS" else "android"
    ans = input(f"Is {row['display_name']!r} YOUR personal device "
                f"(not a shared test phone)? [y/N] ").strip().lower()
    personal = 1 if ans in ("y", "yes") else 0
    db().execute("UPDATE devices SET personal=? WHERE udid=?", (personal, row["udid"]))

    made = []
    made.append(_add_alias_safe(row["display_name"] or row["udid"], row["udid"], "altname"))
    if personal:
        made.append(_add_alias_safe(f"my-{plat}", row["udid"], "name"))
        group = "mine"
    else:
        made.append(_add_alias_safe(f"real-{plat}-{_next_real_index(plat)}",
                                    row["udid"], "name"))
        group = "real"
    pool = allocate_name(row["udid"])
    db().commit()

    kind = "personal" if personal else "test"
    print(f"Registered {row['display_name']} ({kind} {row['type']}).")
    print(f"  aliases: {', '.join(made)}  +  group '{group}' (all your {kind} real devices)")
    if pool:
        print(f"  auto-name: {pool}")
    print("  Change any alias anytime with `--alias <id> <new>` or `--rename <old> <new>`.")
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

# System/computed aliases — not stored in `aliases`, so they can't (and mustn't) be renamed.
INTERNAL_ALIASES = {"ios", "android", "last-ios", "last-android",
                    "all", "all-ios", "all-android", "loop", "mine", "real"}
# avdmanager's AVD-name charset: letters, digits, dot, underscore, hyphen — no spaces.
AVD_NAME_RE = re.compile(r"^[A-Za-z0-9._-]+$")

def cmd_rename(old, new):
    """Rename an AVD name (case A) or a USER alias (case B).
      --rename Small_Phone_copy_Lainey Pixel_9   → rename the AVD (android: moves the .avd
                                                    dir, fixes its inis, migrates the DB udid)
      --rename Lainey Janey                       → rename a user alias
      --rename last-android McBoatFace            → error: internal aliases are computed
    NEW is trimmed; an empty NEW is rejected. AVD names are charset-validated. A running
    Android device must be shut down first (its identity files are in use)."""
    sync()
    new = (new or "").strip()
    if not new:
        err("rename: new name is empty")
        return 2
    if old.strip().lower() in INTERNAL_ALIASES:
        err(f"rename: can't rename internal alias {old!r} — it's computed from device state, "
            f"not a stored name")
        return 2

    # ── case B: a USER alias → rename the alias text only (device identity untouched) ──
    arow = db().execute("SELECT alias, udid, kind FROM aliases WHERE alias=? COLLATE NOCASE",
                        (old,)).fetchone()
    if arow and arow["kind"] == "user":
        if db().execute("SELECT 1 FROM aliases WHERE alias=? COLLATE NOCASE", (new,)).fetchone():
            err(f"rename: alias {new!r} already in use")
            return 2
        with immediate() as c:
            c.execute("UPDATE aliases SET alias=? WHERE alias=? COLLATE NOCASE", (new, arow["alias"]))
        print(f"alias {arow['alias']!r} -> {new!r}")
        return 0

    # ── case A: OLD names a device → rename the device ──
    try:
        dev = resolve_one(old)
    except ResolveError as e:
        err(f"rename: {e}")
        return 2

    # iOS: udid is a stable UUID, so only the display name changes — no identity migration.
    # Human aliases (pooled 'name' / 'user') are independent handles and keep their text.
    if dev["kind"] == "ios":
        run(["xcrun", "simctl", "rename", dev["id"], new], capture=False)
        with immediate() as c:
            c.execute("UPDATE devices SET display_name=? WHERE udid=?", (new, dev["id"]))
        sync()
        print(f"renamed iOS sim {dev['name']!r} -> {new!r}")
        return 0

    # Android: the AVD name IS the identity (udid). Validate, move on disk, migrate the DB.
    if is_running(dev):
        err(f"rename: {dev['name']} is running — shut it down first (--kill {old})")
        return 2
    if not AVD_NAME_RE.match(new):
        err(f"rename: {new!r} is not a valid AVD name "
            f"(allowed: letters, digits, '.', '_', '-'; no spaces)")
        return 2
    if (db().execute("SELECT 1 FROM devices WHERE udid=? COLLATE NOCASE", (new,)).fetchone()
            or db().execute("SELECT 1 FROM aliases WHERE alias=? COLLATE NOCASE", (new,)).fetchone()):
        err(f"rename: {new!r} already names a device or alias")
        return 2

    old_udid = dev["id"]
    try:
        rename_avd(old_udid, new)
    except (FileExistsError, FileNotFoundError) as e:
        err(f"rename: {e}")
        return 2
    # Migrate every DB reference from the old AVD-name identity to the new one. Human aliases
    # (pooled 'name' like 'Lainey', plus 'user' aliases) KEEP their text — only their udid
    # repoints — so `--rename <avd> <newavd>` leaves the human handles intact (Travis case A).
    with immediate() as c:
        c.execute("UPDATE devices SET udid=?, display_name=? WHERE udid=?", (new, new, old_udid))
        c.execute("UPDATE aliases SET udid=? WHERE udid=?", (new, old_udid))
        c.execute("UPDATE name_pool SET udid=? WHERE udid=?", (new, old_udid))
        c.execute("UPDATE history SET udid=? WHERE udid=?", (new, old_udid))
    for k in ("last_android", "last_ios"):
        if kv_get(k) == old_udid:
            kv_set(k, new)
    sync()
    print(f"renamed AVD {old_udid!r} -> {new!r}")
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
    # NB: NO `--compile-layouts` — `cmd package compile` does not accept it on
    # current Android (it errored "Unknown option: --compile-layouts" and the
    # step silently proceeded to save a non-optimized snapshot). Layout
    # precompilation was a short-lived, version-specific flag; the durable win
    # here is the `everything` AOT filter.
    "hot":    (["cmd", "package", "compile", "-a", "-m", "everything"],
               "~40-90 min (AOT-compile every package with the 'everything' filter)"),
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
    """Boot a device and wait until it's responsive (optionally apply a compile level).
    Returns True iff the device actually reached a ready state. A boot that times out
    is a FAILURE, not a success: previously this still printed 'ready in Ns' and returned
    0, so a caller (bench, CI) trusted a dead device and only discovered it later when the
    e2e gate found no booted emulator. Now it's reported loudly and returns False."""
    if refuse_on_real(dev, "warmup"):
        return False
    narrate(f"warmup {dev['name']}: estimated {_warm_estimate(dev)}")
    t0 = time.time()
    ok, fail_reason = True, None
    if dev["kind"] == "ios":
        if not is_running(dev):
            narrate("  booting simulator …")
            run(["xcrun", "simctl", "boot", dev["id"]], capture=False)
        narrate("  waiting for boot to complete (simctl bootstatus) …")
        run(["xcrun", "simctl", "bootstatus", dev["id"]], capture=False)
        if not is_running(dev):
            ok, fail_reason = False, "simulator did not reach a booted state (simctl bootstatus)"
        if level:
            narrate("  (compile levels are Android-only; iOS warmup is boot-only)")
    else:
        if not is_running(dev):
            narrate("  launching emulator with optimized flags …")
            _android_start(dev, emulator_flags())
        narrate("  waiting for sys.boot_completed …")
        serial = _android_await_boot(dev)
        if not serial:
            ok, fail_reason = False, "sys.boot_completed not reached (boot timed out)"
        else:
            dev["serial"] = serial
            narrate("  waiting for package manager (install/launch ready) …")
            # The optimize → save steps are sequential and dependent: saving a
            # default_boot snapshot only makes sense if the compile actually
            # succeeded. Short-circuit on the first failure so we exit quickly
            # and never persist a half-optimized snapshot (the two bugs this
            # block used to have: it ran the unknown-option compile, ignored the
            # error, then saved anyway and leaked the console's bare 'OK').
            if not _android_pm_ready(serial):
                ok, fail_reason = False, ("package manager never became ready "
                                          "(install/launch would be unsafe)")
            elif level:
                cmd, est = COMPILE_LEVELS[level]
                narrate(f"  optimizing [{level}] — estimated {est}; this is the slow part …")
                cr = run_cap([adb_bin(), "-s", serial, "shell"] + cmd)
                if cr.stdout:
                    sys.stdout.write(cr.stdout if cr.stdout.endswith("\n")
                                     else cr.stdout + "\n")
                    sys.stdout.flush()
                if cr.returncode != 0 or re.search(r"(^|\n)Error:", cr.stdout or ""):
                    ok, fail_reason = False, (
                        f"compile [{level}] failed (adb exit {cr.returncode}); "
                        f"default_boot NOT saved")
                else:
                    narrate("  saving 'default_boot' so the speedup survives quick-boot …")
                    sr = run_cap([adb_bin(), "-s", serial, "emu", "avd",
                                  "snapshot", "save", "default_boot"])
                    reply = (sr.stdout or "").strip()
                    last = reply.splitlines()[-1].strip() if reply else ""
                    if sr.returncode == 0 and last == "OK":
                        narrate("  default_boot saved (emulator console: OK)")
                    else:
                        ok, fail_reason = False, (
                            "default_boot snapshot save failed "
                            f"(console: {reply or 'no reply'})")
    ms = int((time.time() - t0) * 1000)
    cpu, load = host_load_sample(dev)
    # detail carries the level (queryable); a failed boot is tagged so --history shows it.
    base = f"warmup:{level}" if level else "warmup"
    log_history(dev["id"], "warmup", detail=(base if ok else base + ":FAILED"),
                duration_ms=ms, sys_load=load, dev_load=cpu)
    cpu_s = f"{cpu:.1f}% host cpu" if cpu is not None else "process gone"
    load_s = f", load {load:.2f}" if load is not None else ""
    if not ok:
        # Do NOT record last_warmed_at / compile_level / has_default_boot — the device is not
        # warm, and a level's snapshot was never saved. Touch is also skipped (it isn't usable).
        err(f"✗ {dev['name']} NOT ready after {ms/1000:.0f}s — {fail_reason} "
            f"({cpu_s}{load_s}); left running for inspection")
        return False
    cols: "dict[str, object]" = {"last_warmed_at": now_iso()}
    if level:                       # a level also saves a default_boot snapshot above
        cols["compile_level"] = level
        cols["has_default_boot"] = 1
    _device_set(dev["id"], **cols)
    touch(dev)
    narrate(f"{dev['name']} ready in {ms/1000:.0f}s ({cpu_s}{load_s})")
    return True

def _warmup_plan(dev, level):
    """--dry-run: enumerate the low-level commands + implicit loops a warmup of
    this one device would run (the boot/PM polls are loops, not single calls)."""
    dry_note(f"── {dev['name']} ({dev['kind']}) ──")
    if dev["kind"] == "ios":
        if level:
            dry_note("compile level is ignored on iOS (warmup is boot-only)")
        if not is_running(dev):
            dry(["xcrun", "simctl", "boot", dev["id"]])
        else:
            dry_note("already running → skip boot")
        dry(["xcrun", "simctl", "bootstatus", dev["id"]], note="blocks until booted")
        dry_note("verify booted state; record warmup timing + host load")
        return
    if not is_running(dev):
        dry([emulator_bin(), "-avd", dev["id"]] + emulator_flags(),
            note="launch with perf flags")
    else:
        dry_note("already running → skip launch")
    dry_note("loop ≤300×, 1s apart: adb -s <serial> shell getprop sys.boot_completed "
             "until it returns '1' (timeout ⇒ FAIL, nothing else runs)")
    dry_note("loop ≤90×, 1s apart: adb -s <serial> shell cmd package list packages "
             "until PM answers")
    if level:
        cmd, est = COMPILE_LEVELS[level]
        dry([adb_bin(), "-s", "<serial>", "shell"] + cmd,
            note=f"optimize [{level}] — {est}")
        dry_note("if compile fails (non-zero exit or 'Error:') ⇒ STOP, do NOT save")
        dry([adb_bin(), "-s", "<serial>", "emu", "avd", "snapshot", "save", "default_boot"],
            note="only if compile OK; expect console 'OK' (else 'KO: …' ⇒ FAIL)")
    dry_note("on success: record last_warmed_at"
             + (", compile_level, has_default_boot" if level else ""))

def cmd_warmup(ident, level=None):
    sync()
    try:
        devs = resolve_many(ident)
    except ResolveError as e:
        err(f"warmup: {e}")
        return 2
    if DRY_RUN:
        dry_note(f"ident {ident!r} resolves to {len(devs)} device(s); warmup runs on "
                 f"each in turn (this is the implicit loop):")
        for dev in devs:
            _warmup_plan(dev, level)
        return 0
    all_ok = True
    for dev in devs:
        all_ok = warmup_one(dev, level) and all_ok
    # Non-zero exit when any device failed to warm, so a script (bench, CI) that warms a
    # device and then runs tests against it can stop instead of trusting a dead device.
    return 0 if all_ok else 1

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
    # BROKEN/HIDDEN 2026-06-26: emulator snapshot/bake work is on hold while native
    # device testing is the priority. Switch removed from the CLI; body kept for the
    # later ATD/headless untangling. See docs/TC/device-tooling-bug-registry.md (i).
    err("save-quickboot: DISABLED (emulator snapshot/bake on hold; native testing is "
        "the priority). See docs/TC/device-tooling-bug-registry.md.")
    return 2
    sync()  # noqa: unreachable — retained for the future bake/snapshot rework
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

def normalize_gpu_config(cfg):
    """Force `hw.gpu.mode=auto` (+ hw.gpu.enabled=yes) in an AVD config.ini so a
    manually-launched device (Android Studio Device Manager reads config.ini, not our
    flags) gets the same renderer as our `-gpu auto` launches. See gpu_default()."""
    cfg = Path(cfg)
    if not cfg.exists():
        return
    want = {"hw.gpu.mode": "auto", "hw.gpu.enabled": "yes"}
    seen, out = set(), []
    for ln in cfg.read_text().splitlines():
        k = ln.split("=", 1)[0].strip() if "=" in ln else None
        if k in want:
            out.append(f"{k}={want[k]}")
            seen.add(k)
        else:
            out.append(ln)
    for k, v in want.items():
        if k not in seen:
            out.append(f"{k}={v}")
    cfg.write_text("\n".join(out) + "\n")

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
    normalize_gpu_config(dst_dir / "config.ini")

def rename_avd(src, dst):
    """Rename an AVD in place: move <src>.avd + <src>.ini to <dst> and fix the embedded
    paths/ids. Unlike clone_avd this MOVES (no copy) and PRESERVES snapshots/runtime state —
    a rename keeps the same device, just relabelled. Caller must ensure it isn't running."""
    root = Path.home() / ".android" / "avd"
    src_dir, dst_dir = root / f"{src}.avd", root / f"{dst}.avd"
    src_ini, dst_ini = root / f"{src}.ini", root / f"{dst}.ini"
    if not src_dir.exists() or not src_ini.exists():
        raise FileNotFoundError(f"AVD {src!r} not found under {root}")
    if dst_dir.exists() or dst_ini.exists():
        raise FileExistsError(f"AVD {dst!r} already exists")
    shutil.move(str(src_dir), str(dst_dir))
    dst_ini.write_text(src_ini.read_text().replace(f"{src}.avd", f"{dst}.avd"))
    src_ini.unlink()
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
    normalize_gpu_config(cfg)

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
    normalize_gpu_config(cfg)
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
    # BROKEN/HIDDEN 2026-06-26: bake is on hold (native testing is the priority). No
    # CLI surface; callers (cmd_copy) gate this out. Body kept for the later rework.
    # See docs/TC/device-tooling-bug-registry.md (i).
    err("bake: DISABLED (emulator bake on hold; native testing is the priority).")
    return
    narrate(f"bake {dev['name']}: booting headless to apply optimizations …")  # noqa: unreachable
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
    # BROKEN/HIDDEN 2026-06-26: see bake_optimizations; switch removed from the CLI.
    err("bake: DISABLED (emulator bake on hold; native testing is the priority). "
        "See docs/TC/device-tooling-bug-registry.md.")
    return 2
    sync()  # noqa: unreachable — retained for the future bake rework
    try:
        dev = resolve_one(ident)
    except ResolveError as e:
        err(f"bake: {e}")
        return 2
    if dev["kind"] != "android":
        err("bake: Android-only.")
        return 2
    if DRY_RUN:
        dry_note(f"bake {dev['name']}: boot headless → optimize → save default_boot → halt")
        if not is_running(dev):
            dry([emulator_bin(), "-avd", dev["id"]]
                + emulator_flags(headless=False) + ["-no-window"],
                note="headless but WRITABLE (snapshot save needs write; not -read-only)")
        dry_note("loop ≤300×, 1s: getprop sys.boot_completed; then loop ≤90×, 1s: PM ready")
        if level:
            cmd, est = COMPILE_LEVELS[level]
            dry([adb_bin(), "-s", "<serial>", "shell"] + cmd, note=f"compile [{level}] — {est}")
        dry([adb_bin(), "-s", "<serial>", "emu", "avd", "snapshot", "save", "default_boot"])
        dry([adb_bin(), "-s", "<serial>", "emu", "kill"], note="halt the baked device")
        return 0
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
    if refuse_on_real(dev, "copy"):
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
            # bake step disabled 2026-06-26 (bake_optimizations BROKEN; emulator bake
            # on hold). Clone + ATD-ify still run; no default_boot snapshot is written.
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
        # Longer grace after SIGQUIT so a quick-boot snapshot save can finish before
        # the SIGKILL pass; cheap after SIGKILL (just a settle). See EMU_KILL_GRACE_S.
        time.sleep(EMU_KILL_GRACE_S)

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
    # `adb emu kill` is graceful: the emulator saves its quick-boot snapshot here. Give
    # it the full grace window so the save completes before the SIGQUIT/SIGKILL ladder.
    time.sleep(EMU_KILL_GRACE_S)
    for dev in android_running():
        narrate(f"Android: shutting down {dev['name']} ({dev['serial']})")
        run([adb_bin(), "-s", dev["serial"], "emu", "kill"], capture=False)
    time.sleep(EMU_KILL_GRACE_S)
    _quit_kill_ladder("Android", android_running)
    narrate("Android: some emulators survived 😱" if android_running()
            else f"Android: full stop. {STOP}")

def kill_all():
    """The narrated full-stop reached via `--kill all` (this used to be `--nuke`).
    Two phases (iOS then Android); each is: a graceful stop, a grace window so a
    quick-boot snapshot can save, a second graceful pass on survivors, then a
    SIGQUIT→(grace)→SIGKILL escalation ladder on anything still alive."""
    if DRY_RUN:
        g = f"{EMU_KILL_GRACE_S:.0f}s"
        dry_note("`--kill all`: narrated full stop of EVERY running device, iOS then Android.")
        dry_note("iOS phase:")
        dry(["xcrun", "simctl", "shutdown", "all"], note="ask every booted sim to stop")
        dry_note("  sleep 2s; then for each still-booted sim: xcrun simctl shutdown <udid>; sleep 2s")
        dry_note(f"  ladder on survivors: SIGQUIT each sim PID → sleep {g} → SIGKILL each → sleep {g}")
        dry_note("Android phase:")
        dry([adb_bin(), "-s", "<serial>", "emu", "kill"],
            note="per running emulator; graceful — saves the quick-boot snapshot")
        dry_note(f"  sleep {g} (let the snapshot save finish); repeat `emu kill` on survivors; sleep {g}")
        dry_note(f"  ladder on survivors: SIGQUIT each emulator PID → sleep {g} → SIGKILL each → sleep {g}")
        return 0
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
    g.add_argument("--mark-used", dest="mark_used", metavar="ID",
                   help="record id/alias as last-ios/last-android (no stdout id); for a "
                        "manual qa:flow run to mark the device it ran on")
    g.add_argument("--kind-of", dest="kind_of", metavar="ID",
                   help="print a device's platform ('ios'/'android') for an id/alias "
                        "(offline; the qa runner uses it to infer/validate --platform)")
    g.add_argument("--flavor-of", dest="flavor_of", metavar="ID",
                   help="print a device's flavor ('real'/'simulated') for an id/alias "
                        "(offline; the qa runner uses it to pick the build/install path)")
    g.add_argument("--headless-of", dest="headless_of", metavar="ID",
                   help="print a running device's screen mode ('headless'/'windowed'/"
                        "'unknown'); qa:flow --require-screen uses it to refuse a black run")
    g.add_argument("--history", nargs="?", const="", metavar="ID",
                   help="dump warmup/bake/start/kill timings (all, or one id/alias)")
    g.add_argument("--start", metavar="ID", help="start device(s) with perf flags")
    # HIDDEN 2026-06-26: --start:headless removed from the CLI (headless emulator path
    # is broken; native testing is the priority). cmd_start's "headless" mode is now
    # unreachable from the CLI but retained. See docs/TC/device-tooling-bug-registry.md.
    g.add_argument("--start-basic", dest="start_basic", metavar="ID",
                   help="start device(s), legacy windowed behaviour")
    g.add_argument("-k", "--kill", metavar="ID",
                   help="stop device(s); `--kill all` = narrated full stop with escalation")
    g.add_argument("-w", "--warmup", metavar="ID", help="boot + wait until responsive")
    # HIDDEN 2026-06-26: --warm:low/medium/hot removed from the CLI (compile/bake levels
    # on hold). `-w/--warmup` stays LIVE; cmd_warmup just no longer receives a level from
    # the CLI. See docs/TC/device-tooling-bug-registry.md.
    g.add_argument("-c", "--copy", nargs="+", metavar="ID|ALIAS", dest="copy",
                   help="clone an Android AVD (ATD-ify); takes ID [NEW_ALIAS]")
    g.add_argument("--copy:orig", nargs="+", metavar="ID|ALIAS", dest="copy_orig",
                   help="clone a device as-is; takes ID [NEW_ALIAS]")
    # HIDDEN 2026-06-26: --save-quickboot and --bake removed from the CLI (emulator
    # snapshot/bake on hold; native testing is the priority). Functions kept but marked
    # BROKEN. See docs/TC/device-tooling-bug-registry.md.
    g.add_argument("-m", "--monitor", nargs="?", const=10, type=int, default=None,
                   metavar="SECONDS", help="periodically sample host-side load")
    g.add_argument("-a", "--alias", nargs=2, metavar=("ID", "ALIAS"),
                   help="create a user alias for device(s)")
    g.add_argument("--rename", nargs=2, metavar=("OLD", "NEW"),
                   help="rename an AVD name or a user alias (internal aliases are rejected)")
    g.add_argument("--loop", nargs=2, metavar=("NAME", "CSV"),
                   help="define an ordered loop from a comma list of ids/aliases")
    g.add_argument("-n", "--next", nargs="?", const=None, default=False,
                   metavar="NAME", help="advance the loop cursor; print next device")
    g.add_argument("--add", nargs="?", const="", default=None, metavar="ID",
                   help="register a real (physical) device: personal-vs-test + 3 aliases")
    g.add_argument("--claim", metavar="ID",
                   help="place/refresh an advisory claim on a device (runner use)")
    g.add_argument("--release", nargs="?", const="", default=None, metavar="ID",
                   help="release an advisory claim by id/alias (or use --release-pid)")
    p.add_argument("--ios", action="store_true",
                   help="with --list/--running/all*: restrict to iOS devices")
    p.add_argument("--android", action="store_true",
                   help="with --list/--running/all*: restrict to Android devices")
    p.add_argument("--real", action="store_true",
                   help="with --list/--running/all*: restrict to real (physical) devices")
    p.add_argument("--simulated", action="store_true",
                   help="with --list/--running/all*: restrict to simulated/emulated devices")
    p.add_argument("--owner", metavar="NAME", help="claim owner (with --claim)")
    p.add_argument("--claim-pid", dest="claim_pid", type=int, metavar="PID",
                   help="claim holder pid (with --claim)")
    p.add_argument("--release-pid", dest="release_pid", type=int, metavar="PID",
                   help="release all claims held by PID (with --release)")
    p.add_argument("-v", "--verbose", action="store_true",
                   help="with --list/--running: dump the full per-device record (tab-separated)")
    p.add_argument("--dry-run", action="store_true", dest="dry_run",
                   help="with a mutating action (--start/--kill): print the low-level "
                        "commands and implicit loops it WOULD run, changing nothing")
    args = p.parse_args(argv)

    global FILTER_PLATFORM, FILTER_FLAVOR
    if args.ios and args.android:
        p.error("--ios and --android are mutually exclusive")
    if args.real and args.simulated:
        p.error("--real and --simulated are mutually exclusive")
    FILTER_PLATFORM = "ios" if args.ios else "android" if args.android else None
    FILTER_FLAVOR = "real" if args.real else "simulated" if args.simulated else None

    htc.warn_missing_once(err)  # one consolidated stderr warning if a toolchain is absent

    global DRY_RUN
    DRY_RUN = bool(args.dry_run)
    if DRY_RUN:
        # --dry-run is modeled for the device-lifecycle actions below. For other
        # mutating actions there is no plan, so refuse rather than silently run
        # and change disk/DB state — the contract is "dry-run never mutates".
        unmodeled = {
            "--mark-used": args.mark_used, "--copy": args.copy,
            "--copy:orig": args.copy_orig,
            "--alias": args.alias, "--rename": args.rename, "--loop": args.loop,
            "--monitor": args.monitor is not None, "--next": args.next is not False,
            "--add": args.add is not None, "--claim": args.claim,
            "--release": args.release is not None,
        }
        for name, on in unmodeled.items():
            if on:
                dry_note(f"--dry-run: no plan is modeled for {name}; refusing so no "
                         f"state is changed")
                return 0

    def _copy_args(lst):
        return (lst[0], lst[1] if len(lst) > 1 else None)

    if args.running:
        return cmd_running(args.verbose)
    if args.list_all:
        return cmd_list(args.verbose)
    if args.resolve:
        return cmd_resolve(args.resolve)
    if args.mark_used:
        return cmd_mark_used(args.mark_used)
    if args.kind_of:
        return cmd_kind_of(args.kind_of)
    if args.flavor_of:
        return cmd_flavor_of(args.flavor_of)
    if args.headless_of:
        return cmd_headless_of(args.headless_of)
    if args.history is not None:
        return cmd_history(args.history or None)
    if args.start:
        return cmd_start(args.start, "optimized")
    if args.start_basic:
        return cmd_start(args.start_basic, "basic")
    if args.kill:
        return cmd_kill(args.kill)
    if args.warmup:
        return cmd_warmup(args.warmup)
    if args.copy:
        return cmd_copy(*_copy_args(args.copy), mode="optimized")
    if args.copy_orig:
        return cmd_copy(*_copy_args(args.copy_orig), mode="orig")
    if args.monitor is not None:
        return cmd_monitor(args.monitor)
    if args.alias:
        return cmd_alias(args.alias[0], args.alias[1])
    if args.rename:
        return cmd_rename(args.rename[0], args.rename[1])
    if args.loop:
        return cmd_loop(args.loop[0], args.loop[1])
    if args.next is not False:
        return cmd_next(args.next)
    if args.add is not None:
        return cmd_add(args.add or None)
    if args.claim:
        return claim_device(args.claim, args.owner or "manual",
                            args.claim_pid or os.getpid())
    if args.release is not None:
        return release_claim(ident=(args.release or None), pid=args.release_pid)
    return 1

if __name__ == "__main__":
    sys.exit(main())
