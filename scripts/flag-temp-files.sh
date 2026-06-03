#!/usr/bin/env bash
# Flags developer tool build artifacts, caches, and emulator images to prevent
# iCloud Drive backup, Spotlight indexing, and Time Machine backup.
#
# Usage: flag-temp-files.sh [project-root]
#   project-root  Absolute path to the project root. Defaults to the parent of
#                 the scripts/ directory this script lives in, so it works when
#                 invoked from either the project root or mobile/.
#
# Silent on success; warns to stderr on failure.
# Safe to re-run; skips missing directories and inactive backup systems.
# Re-run after: expo prebuild, ./gradlew clean, SDK updates, new Genymotion VMs.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="${1:-"${SCRIPT_DIR%/scripts}"}"

verbose=1

warn() { echo "  ⚠  $1" >&2; }

# ---------------------------------------------------------------------------
# Detect which backup systems are active on this machine.
# iCloud and Time Machine work is skipped if those systems aren't configured.
# Spotlight is always excluded — mds_stores spikes on any path after large
# file operations, regardless of iCloud or Time Machine state.
# ---------------------------------------------------------------------------
ICLOUD_DOCS=false
TM_ENABLED=false

# iCloud Drive is active when this container directory exists.
[ -d "$HOME/Library/Mobile Documents/com~apple~CloudDocs" ] && ICLOUD_DOCS=true

# Time Machine is configured when at least one named destination is registered.
tmutil destinationinfo 2>/dev/null | grep -q 'Name :' && TM_ENABLED=true


# ---------------------------------------------------------------------------
# Core helpers
# ---------------------------------------------------------------------------

apply_icloud() {
  $ICLOUD_DOCS || return 0
  local dir="$1"
  [ -d "$dir" ] || return 0
  # com.apple.icloud.donotbackup maps to NSURLIsExcludedFromBackupKey.
  # Setting it prevents iCloud Drive from syncing or backing up this directory.
  xattr -w com.apple.icloud.donotbackup 1 "$dir" 2>/dev/null \
    || warn "iCloud FAILED: $dir"
}

apply_spotlight() {
  local dir="$1"
  [ -d "$dir" ] || return 0
  touch "$dir/.metadata_never_index" 2>/dev/null \
    || warn "Spotlight FAILED: $dir"
}

apply_timemachine() {
  $TM_ENABLED || return 0
  local dir="$1"
  [ -d "$dir" ] || return 0
  tmutil addexclusion "$dir" 2>/dev/null \
    || warn "TimeMachine FAILED: $dir"
}

# All three — for paths inside iCloud Drive scope (~/Documents, ~/Desktop)
apply_all_icloud() {
  local dir="$1"
  [ -d "$dir" ] || return 0
  apply_icloud      "$dir"
  apply_spotlight   "$dir"
  apply_timemachine "$dir"
}

# Spotlight + Time Machine only — for paths outside iCloud Drive scope (~/Library)
apply_all_library() {
  local dir="$1"
  [ -d "$dir" ] || return 0
  apply_spotlight   "$dir"
  apply_timemachine "$dir"
}

# ---------------------------------------------------------------------------
[ ${verbose} -gt 0 ] && echo "1. Project source — inside ~/Documents (iCloud Drive scope)"
# ---------------------------------------------------------------------------

apply_all_icloud "${PROJECT}/node_modules"
apply_all_icloud "${PROJECT}/mobile/node_modules"
apply_all_icloud "${PROJECT}/mobile/android/build"
apply_all_icloud "${PROJECT}/mobile/android/.gradle"
apply_all_icloud "${PROJECT}/mobile/android/app/build"
apply_all_icloud "${PROJECT}/mobile/android/app/.cxx"
apply_all_icloud "${PROJECT}/mobile/ios"
apply_all_icloud "${PROJECT}/dist"
apply_all_icloud "${PROJECT}/.maestro/output"
apply_all_icloud "${PROJECT}/tests/output"
apply_all_icloud "${PROJECT}/.expo"

# ---------------------------------------------------------------------------
[ ${verbose} -gt 0 ] && echo "2. Android SDK & AVDs — ~/Library/Android, ~/.android"
#    Not in iCloud scope; Spotlight indexes aggressively after SDK updates.
# ---------------------------------------------------------------------------

apply_all_library "${HOME}/Library/Android/sdk/system-images"
apply_all_library "${HOME}/Library/Android/sdk/emulator"
apply_all_library "${HOME}/Library/Android/sdk/build-tools"
apply_all_library "${HOME}/Library/Android/sdk/platforms"
apply_all_library "${HOME}/Library/Android/sdk/ndk"
apply_all_library "${HOME}/Library/Android/sdk/cmake"
apply_all_library "${HOME}/.android/avd"
apply_all_library "${HOME}/.gradle/caches"
apply_all_library "${HOME}/.gradle/wrapper"

# ---------------------------------------------------------------------------
[ ${verbose} -gt 0 ] && echo "3. Xcode & iOS Simulator — ~/Library/Developer"
# ---------------------------------------------------------------------------

apply_all_library "${HOME}/Library/Developer/Xcode/DerivedData"
apply_all_library "${HOME}/Library/Developer/Xcode/iOS DeviceSupport"
apply_all_library "${HOME}/Library/Developer/CoreSimulator/Devices"
apply_all_library "${HOME}/Library/Developer/CoreSimulator/Caches"
apply_all_library "${HOME}/Library/Developer/CoreSimulator/Temp"
apply_all_library "${HOME}/Library/Caches/com.apple.dt.Xcode"
apply_all_library "${HOME}/Library/Caches/com.apple.dt.instruments"

# ---------------------------------------------------------------------------
[ ${verbose} -gt 0 ] && echo "4. Genymotion — auto-detect VM storage path"
# ---------------------------------------------------------------------------

GENY_VM_PATH=$(defaults read com.genymobile.Genymotion vmStoragePath 2>/dev/null || true)
[ -z "$GENY_VM_PATH" ] && GENY_VM_PATH="${HOME}/Library/Application Support/Genymobile/Genymotion/deployed"

apply_all_library "${GENY_VM_PATH}"
apply_all_library "${HOME}/Library/Application Support/Genymobile"
apply_all_library "${HOME}/Library/Application Support/Genymotion"
apply_all_library "${HOME}/Library/Caches/Genymobile"
