#!/usr/bin/env bash
# Watchman trigger handler: logs iCloud conflict-copy events (" 2", " 3" files/dirs).
#
# Fires when Watchman detects a file or directory whose basename matches
# "* 2", "* 2.*", "* 3", "* 3.*" — iCloud's conflict-resolution naming pattern.
#
# Watchman delivers stdin as a JSON ARRAY of objects, one per changed path.
# Log: $PROJECT/tmp/icloud-conflicts.log

set -euo pipefail

PROJECT="$(pwd)"
LOG_DIR="${PROJECT}/tmp"
LOG="${LOG_DIR}/icloud-conflicts.log"

mkdir -p "$LOG_DIR"

# Snapshot active build processes at the moment of the trigger.
build_context() {
  local ctx=""
  pgrep -lf "GradleDaemon"  >/dev/null 2>&1 && ctx="${ctx}gradle "
  pgrep -lf "java.*gradle"  >/dev/null 2>&1 && ctx="${ctx}gradle-worker "
  pgrep -lf "xcodebuild"    >/dev/null 2>&1 && ctx="${ctx}xcodebuild "
  pgrep -lf "clang"         >/dev/null 2>&1 && ctx="${ctx}clang "
  pgrep -lf "swiftc"        >/dev/null 2>&1 && ctx="${ctx}swiftc "
  pgrep -lf "metro"         >/dev/null 2>&1 && ctx="${ctx}metro "
  pgrep -lf "npm"           >/dev/null 2>&1 && ctx="${ctx}npm "
  echo "${ctx:-idle}"
}

CTX="$(build_context)"
INVOCATION_TS="$(date '+%Y-%m-%d %H:%M:%S')"
INVOCATION_ID="$$-$RANDOM"

# Read the entire JSON array from stdin and process it with Python.
# Watchman format: [{"name":"...", "exists":true, "new":true, "size":N, "mtime":N}, ...]
python3 - "$PROJECT" "$LOG" "$CTX" "$INVOCATION_TS" "$INVOCATION_ID" <<'PYEOF'
import json, sys, os, subprocess, hashlib

project       = sys.argv[1]
log_path      = sys.argv[2]
ctx           = sys.argv[3]
invocation_ts = sys.argv[4]
invocation_id = sys.argv[5]

try:
    items = json.load(sys.stdin)
except Exception as e:
    with open(log_path, 'a') as f:
        f.write(f"--- conflict logger JSON parse error [{invocation_id}] {invocation_ts} ---\n")
        f.write(f"  error: {e}\n\n")
    sys.exit(0)

def md5_file(path):
    try:
        h = hashlib.md5()
        with open(path, 'rb') as f:
            h.update(f.read())
        return h.hexdigest()
    except:
        return 'n/a'

def file_info(path):
    try:
        st = os.stat(path)
        return st.st_size, int(st.st_mtime)
    except:
        return None, None

with open(log_path, 'a') as log:
    for item in items:
        name    = item.get('name', '?')
        exists  = item.get('exists', '?')
        isnew   = item.get('new', '?')
        size    = item.get('size', '?')
        mtime   = item.get('mtime', '?')

        full_path = os.path.join(project, name)
        basename  = os.path.basename(name)

        # Derive the suffix: " 2", " 3", " 2.dex", etc.
        import re
        m = re.search(r' (\d+)(\.[^/]*)?$', basename)
        suffix = m.group(0) if m else 'unknown'

        # Derive the original counterpart path by removing the suffix number.
        original_name = re.sub(r' \d+(\.[^/]*)$', r'\1', name)
        original_path = os.path.join(project, original_name)

        log.write(f"--- conflict event [{invocation_id}] {invocation_ts} ---\n")
        log.write(f"  conflict: {full_path}\n")
        log.write(f"  suffix:   '{suffix}'\n")
        log.write(f"  exists: {exists}   new: {isnew}   size: {size} bytes   mtime: {mtime}\n")
        log.write(f"  build context: {ctx}\n")

        if original_path != full_path and os.path.exists(original_path):
            orig_size, orig_mtime = file_info(original_path)
            conf_md5 = md5_file(full_path)
            orig_md5 = md5_file(original_path)
            identical = 'IDENTICAL' if conf_md5 == orig_md5 and conf_md5 != 'n/a' else 'DIFFERENT'
            log.write(f"  original: {original_path}\n")
            log.write(f"    size: {orig_size}   mtime: {orig_mtime}   md5: {orig_md5}\n")
            log.write(f"  conflict md5: {conf_md5}\n")
            log.write(f"  contents: {identical}\n")
        else:
            log.write(f"  original not found at: {original_path}\n")

        log.write("\n")

PYEOF
