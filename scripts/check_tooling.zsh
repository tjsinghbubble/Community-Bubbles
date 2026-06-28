#!/usr/bin/env zsh
# check_tooling.zsh — internal regression guard for the dev tooling itself.
# Cheap checks first (syntax/import), then behavioural smoke. Re-run after each
# change to scripts/manage_devices.py, scripts/testctl.py, or scripts/helpers/*.
# See the native-device plan (Phase 9). NOT the app test suite — this exercises
# the TOOLS.
#
# Usage: zsh scripts/check_tooling.zsh
# DB isolation: every check sets MANAGE_DEVICES_DB to a throwaway temp path
# (the real override; NOT --db / BUBBLE_DEVICE_DB, which do not exist).
set -u
emulate -L zsh

SCRIPT_DIR=${0:A:h}
REPO=${SCRIPT_DIR:h}
MD="$SCRIPT_DIR/manage_devices.py"
TC="$SCRIPT_DIR/testctl.py"
fail=0
pass=0

note() { print -r -- "$@" }
ok()   { print -r -- "  ✅ $1"; (( pass++ )) }
bad()  { print -r -- "  ❌ $1"; (( fail++ )) }

# --- 1. syntax (py_compile) -------------------------------------------------
note "▶ syntax / py_compile"
typeset -a pyfiles
pyfiles=("$MD" "$TC")
[[ -d "$SCRIPT_DIR/helpers" ]] && pyfiles+=("$SCRIPT_DIR"/helpers/*.py(N))
for f in $pyfiles; do
  if python3 -m py_compile "$f" 2>/tmp/check_tooling.err; then
    ok "py_compile ${f:t}"
  else
    bad "py_compile ${f:t}"; cat /tmp/check_tooling.err
  fi
done

# --- 2. import (no import-time side effects, lazy DB) ------------------------
note "▶ import"
tmpdb=$(mktemp -u /tmp/check_tooling_import_XXXX.db)
if MANAGE_DEVICES_DB="$tmpdb" python3 -c "import sys; sys.path.insert(0, '$SCRIPT_DIR'); import manage_devices" 2>/tmp/check_tooling.err; then
  ok "import manage_devices"
else
  bad "import manage_devices"; cat /tmp/check_tooling.err
fi
rm -f "$tmpdb"*(N) 2>/dev/null
if python3 -c "import sys; sys.path.insert(0, '$SCRIPT_DIR'); import testctl" 2>/tmp/check_tooling.err; then
  ok "import testctl"
else
  bad "import testctl"; cat /tmp/check_tooling.err
fi

# --- 3. native-functionality logic self-tests (temp DB) ---------------------
note "▶ native logic self-tests"
selfdb=$(mktemp -u /tmp/check_tooling_self_XXXX.db)
if MANAGE_DEVICES_DB="$selfdb" python3 "$SCRIPT_DIR/helpers/selftest_manage_devices.py"; then
  ok "selftest_manage_devices"
else
  bad "selftest_manage_devices"
fi
rm -f "$selfdb"*(N) 2>/dev/null

# testctl logic + lock/heartbeat self-tests (lock state redirected to a temp dir
# inside the selftest, so it never touches the real tests/output/ lock).
if python3 "$SCRIPT_DIR/helpers/selftest_testctl.py"; then
  ok "selftest_testctl"
else
  bad "selftest_testctl"
fi

# --- 4. migration idempotency on a simulated PRE-EXISTING DB -----------------
note "▶ migration on a pre-existing DB"
olddb=$(mktemp -u /tmp/check_tooling_old_XXXX.db)
python3 - "$olddb" <<'PY'
import sqlite3, sys
c = sqlite3.connect(sys.argv[1])
c.executescript("CREATE TABLE devices(udid TEXT PRIMARY KEY, flavor TEXT, type TEXT,"
                " compile_level TEXT, has_default_boot INTEGER DEFAULT 0,"
                " last_warmed_at TEXT, last_used TEXT);")
c.execute("INSERT INTO devices(udid,flavor,type) VALUES('OLD-1','Simulated','iOS')")
c.commit()
PY
if MANAGE_DEVICES_DB="$olddb" python3 -c "
import sys; sys.path.insert(0,'$SCRIPT_DIR'); import manage_devices as m
c=m.db(); cols={r[1] for r in c.execute('PRAGMA table_info(devices)')}
assert {'personal','claim_owner','claim_pid','claim_heartbeat_at','last_reachable_at'} <= cols, 'native cols not added'
assert c.execute('PRAGMA user_version').fetchone()[0]==m.hmd.SCHEMA_VERSION, 'version not bumped'
assert c.execute(\"SELECT udid FROM devices WHERE udid='OLD-1'\").fetchone() is not None, 'row lost'
"; then ok "migrate adds native cols, preserves rows"; else bad "migrate pre-existing DB"; fi
rm -f "$olddb"*(N) 2>/dev/null

# --- 5. CLI behaviour: hidden switches rejected, kept ones live --------------
note "▶ CLI surface"
clidb=$(mktemp -u /tmp/check_tooling_cli_XXXX.db)
for sw in --start:headless --bake --save-quickboot --warm:low; do
  if MANAGE_DEVICES_DB="$clidb" python3 "$MD" $sw X >/dev/null 2>&1; then
    bad "hidden switch $sw should be rejected"
  else
    ok "hidden switch rejected: $sw"
  fi
done
if MANAGE_DEVICES_DB="$clidb" python3 "$MD" --help 2>&1 | grep -q -- '--headless-of'; then
  ok "--headless-of still recognized (help)"
else
  bad "--headless-of missing from help"
fi
if MANAGE_DEVICES_DB="$clidb" python3 "$MD" --help 2>&1 | grep -q -- '--flavor-of'; then
  ok "--flavor-of present (new native query)"
else
  bad "--flavor-of missing from help"
fi
rm -f "$clidb"*(N) 2>/dev/null

note ""
note "check_tooling: $pass passed, $fail failed"
exit $(( fail > 0 ? 1 : 0 ))
