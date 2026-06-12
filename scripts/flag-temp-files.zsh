#!/usr/bin/env zsh
# Flags developer tool build artifacts, caches, and emulator images to prevent
# Spotlight indexing, and backups from iCloud Drive or Time Machine.
#
# Usage: flag-temp-files.zsh [project-root]
#   project-root  Absolute path to the project root. Defaults to the parent of
#                 the scripts/ directory this script lives in, so it works when
#                 invoked from either the project root or mobile/.
#
# Silent on success; warns to stderr on failure.
# Safe to re-run; skips missing directories and inactive backup systems.
# Re-run after: expo prebuild, ./gradlew clean, SDK updates, new Genymotion VMs.
#
# Travis Winfrey & Claude
# Jun 2026

set -e
set -u
set -o pipefail

SCRIPT_DIR="${0:a:h}"
PROJECT="${1:-"${SCRIPT_DIR%/scripts}"}"
cd $PROJECT

VERBOSE_FLAG=0

this_program="$0"

warn()  { echo "${this_program}  ⚠  $1" >&2; }
debug() { [ ${VERBOSE_FLAG} -gt 0 ] && echo "${this_program}: $*" >&2 }

debug "Removing build directories from backups and indexing"

# ---------------------------------------------------------------------------
# Detect which backup systems are active on this machine.
# iCloud and Time Machine work is skipped if those systems aren't configured.
# Spotlight is always excluded — mds_stores spikes on any path after large
# file operations, regardless of iCloud or Time Machine state.
# ---------------------------------------------------------------------------
ICLOUD_BACKUP_ENABLED=false
TIME_MACHINE_ENABLED=false

# iCloud Drive is active when this container directory exists.
if [ -d "$HOME/Library/Mobile Documents/com~apple~CloudDocs" ] ; then
    ICLOUD_BACKUP_ENABLED=true
    debug "iCloud backups are enabled"
else 
    debug "iCloud backups are not enabled"
fi

# Time Machine is configured when at least one named destination is registered.
if tmutil destinationinfo 2>/dev/null | grep -q 'Name :' ; then
    TIME_MACHINE_ENABLED=true
    debug "Time Machine backups are enabled"
else
    debug "Time Machine backups are not enabled" 
fi



# ---------------------------------------------------------------------------
# Core helpers
# ---------------------------------------------------------------------------

block_icloud_backups() {
  $ICLOUD_BACKUP_ENABLED || return 0
  local dir="$1"
  [ -d "$dir" ] || return 0
  # com.apple.icloud.donotbackup maps to NSURLIsExcludedFromBackupKey.
  # Setting it prevents iCloud Drive from syncing or backing up this directory.
  xattr -w com.apple.icloud.donotbackup 1 "$dir" 2>/dev/null \
    || warn "iCloud FAILED: $dir"
}

block_spotlight_indexing() {
  local dir="$1"
  [ -d "$dir" ] || return 0
  touch "$dir/.metadata_never_index"  \
    || warn "Spotlight FAILED: $dir"
}

block_timemachine_backups() {
  $TIME_MACHINE_ENABLED || return 0
  local dir="$1"
  [ -d "$dir" ] || return 0
  tmutil addexclusion "$dir"  \
    || warn "TimeMachine FAILED: $dir"
}

# All three — for paths inside iCloud Drive scope (~/Documents, ~/Desktop)
block_all_indexing_and_backups() {
  local dir="$1"
  [ -d "$dir" ] || return 0
  block_icloud_backups      "$dir"
  block_spotlight_indexing   "$dir"
  block_timemachine_backups "$dir"
}

# Spotlight + Time Machine only — for paths outside iCloud Drive scope (~/Library)
block_indexing_and_tm_backups() {
  local dir="$1"
  [ -d "$dir" ] || return 0
  block_spotlight_indexing   "$dir"
  block_timemachine_backups "$dir"
}

# ---------------------------------------------------------------------------
debug "    1. Block backups and indexing of directories like node_modules/, .gradle/, tests/output/"
# ---------------------------------------------------------------------------

block_all_indexing_and_backups "${PROJECT}/node_modules"
block_all_indexing_and_backups "${PROJECT}/mobile/node_modules"
block_all_indexing_and_backups "${PROJECT}/mobile/android/build"
block_all_indexing_and_backups "${PROJECT}/mobile/android/.gradle"
block_all_indexing_and_backups "${PROJECT}/mobile/android/app/build"
block_all_indexing_and_backups "${PROJECT}/mobile/android/app/.cxx"
block_all_indexing_and_backups "${PROJECT}/mobile/ios"
block_all_indexing_and_backups "${PROJECT}/dist"
block_all_indexing_and_backups "${PROJECT}/tests/output"
block_all_indexing_and_backups "${PROJECT}/.maestro/output"
block_all_indexing_and_backups "${PROJECT}/.expo"
block_all_indexing_and_backups "${PROJECT}/tmp"

# ---------------------------------------------------------------------------
debug "    2. Block backups and indexing Android SDK & AVDs — ~/Library/Android, ~/.android"
#    Not in iCloud scope; Spotlight indexes aggressively after SDK updates.
# ---------------------------------------------------------------------------

block_indexing_and_tm_backups "${HOME}/Library/Android/sdk/system-images"
block_indexing_and_tm_backups "${HOME}/Library/Android/sdk/emulator"
block_indexing_and_tm_backups "${HOME}/Library/Android/sdk/build-tools"
block_indexing_and_tm_backups "${HOME}/Library/Android/sdk/platforms"
block_indexing_and_tm_backups "${HOME}/Library/Android/sdk/ndk"
block_indexing_and_tm_backups "${HOME}/Library/Android/sdk/cmake"
block_indexing_and_tm_backups "${HOME}/.android/avd"
block_indexing_and_tm_backups "${HOME}/.gradle/caches"
block_indexing_and_tm_backups "${HOME}/.gradle/wrapper"

# ---------------------------------------------------------------------------
debug "    3. Xcode & iOS Simulator — ~/Library/Developer"
# ---------------------------------------------------------------------------

block_indexing_and_tm_backups "${HOME}/Library/Developer/Xcode/DerivedData"
block_indexing_and_tm_backups "${HOME}/Library/Developer/Xcode/iOS DeviceSupport"
block_indexing_and_tm_backups "${HOME}/Library/Developer/CoreSimulator/Devices"
block_indexing_and_tm_backups "${HOME}/Library/Developer/CoreSimulator/Caches"
block_indexing_and_tm_backups "${HOME}/Library/Developer/CoreSimulator/Temp"
block_indexing_and_tm_backups "${HOME}/Library/Caches/com.apple.dt.Xcode"
block_indexing_and_tm_backups "${HOME}/Library/Caches/com.apple.dt.instruments"

# ---------------------------------------------------------------------------
debug "    4. Genymotion — auto-detect VM storage path"
# ---------------------------------------------------------------------------

GENY_VM_PATH=$(defaults read com.genymobile.Genymotion vmStoragePath 2>/dev/null || true)
[ -z "$GENY_VM_PATH" ] && GENY_VM_PATH="${HOME}/Library/Application Support/Genymobile/Genymotion/deployed"

block_indexing_and_tm_backups "${GENY_VM_PATH}"
block_indexing_and_tm_backups "${HOME}/Library/Application Support/Genymobile"
block_indexing_and_tm_backups "${HOME}/Library/Application Support/Genymotion"
block_indexing_and_tm_backups "${HOME}/Library/Caches/Genymobile"

exit 0
