#!/usr/bin/env bash
# Watchman trigger handler: applies iCloud/Spotlight/TM exclusions to build
# directories the moment they are created during expo prebuild or native builds.
#
# Called by watchman; receives new directory paths relative to the watch root
# on stdin (one per line). Never called directly.

set -euo pipefail

PROJECT="${HOME}/Documents/src/bubble/TJ-branch-20260220"
WATCH_ROOT="${PROJECT}"

warn() { echo "watchman-exclude: ⚠ $1" >&2; }

ICLOUD_DOCS=false
TM_ENABLED=false
xattr "$HOME/Documents" 2>/dev/null | grep -q 'file-provider-domain-id' && ICLOUD_DOCS=true
tmutil destinationinfo &>/dev/null && TM_ENABLED=true

while IFS= read -r relpath; do
  dir="${WATCH_ROOT}/${relpath}"
  [ -d "$dir" ] || continue

  if $ICLOUD_DOCS; then
    xattr -w com.apple.icloud.donotbackup 1 "$dir" 2>/dev/null \
      || warn "iCloud FAILED: $dir"
  fi

  touch "${dir}/.metadata_never_index" 2>/dev/null \
    || warn "Spotlight FAILED: $dir"

  if $TM_ENABLED; then
    tmutil addexclusion "$dir" 2>/dev/null \
      || warn "TimeMachine FAILED: $dir"
  fi
done
