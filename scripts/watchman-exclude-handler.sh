#!/usr/bin/env bash
# Watchman trigger handler: applies iCloud/Spotlight/TM exclusions to build
# directories the moment they are created during expo prebuild or native builds.
#
# Called by watchman; receives new directory paths relative to the watch root
# on stdin (one per line). Never called directly.

set -euo pipefail

# Watchman invokes this handler with cwd set to the watch root.
PROJECT="$(pwd)"

warn() { echo "watchman-exclude: ⚠ $1" >&2; }

ICLOUD_DOCS=false
TM_ENABLED=false
[ -d "$HOME/Library/Mobile Documents/com~apple~CloudDocs" ] && ICLOUD_DOCS=true
tmutil destinationinfo 2>/dev/null | grep -q 'Name :' && TM_ENABLED=true

while IFS= read -r relpath; do
  dir="${PROJECT}/${relpath}"
  [ -d "$dir" ] || continue

  if $ICLOUD_DOCS; then
    # fileprovider.ignore#P is the attribute that actually stops iCloud Drive *sync*;
    # donotbackup only excludes from backup. See scripts/icloud-ignore-churn.zsh.
    xattr -w 'com.apple.fileprovider.ignore#P' 1 "$dir" 2>/dev/null \
      || warn "iCloud sync-ignore FAILED: $dir"
    xattr -w com.apple.icloud.donotbackup 1 "$dir" 2>/dev/null \
      || warn "iCloud donotbackup FAILED: $dir"
  fi

  touch "${dir}/.metadata_never_index" 2>/dev/null \
    || warn "Spotlight FAILED: $dir"

  if $TM_ENABLED; then
    tmutil addexclusion "$dir" 2>/dev/null \
      || warn "TimeMachine FAILED: $dir"
  fi
done
