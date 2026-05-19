#!/usr/bin/env bash
# Excludes Android build artifact directories from iCloud Drive and Time Machine.
#
# Run once from the project root after the first Android build completes.
# Safe to re-run — it skips directories that don't exist yet and silently
# re-applies attributes to directories that do.
#
# Why two mechanisms:
#   com.apple.icloud.donotbackup  — tells iCloud Drive not to upload this item
#   tmutil addexclusion -p        — removes the item from Time Machine backups
#
# After a full clean build ("cd mobile/android && ./gradlew clean") the build
# directories will be recreated and this script should be run again.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ANDROID_DIR="$(dirname "$SCRIPT_DIR")/mobile/android"

DIRS=(
  "$ANDROID_DIR/build"
  "$ANDROID_DIR/.gradle"
  "$ANDROID_DIR/app/build"
  "$ANDROID_DIR/app/.cxx"
)

echo "Excluding Android build artifacts from iCloud and Time Machine..."
echo ""

for dir in "${DIRS[@]}"; do
  if [ ! -d "$dir" ]; then
    echo "  skip  (does not exist yet) $dir"
    continue
  fi

  # iCloud Drive: mark as "do not backup / upload"
  if xattr -w com.apple.icloud.donotbackup 1 "$dir" 2>/dev/null; then
    echo "  iCloud  excluded: $dir"
  else
    echo "  iCloud  FAILED:   $dir"
  fi

  # Time Machine: permanent path exclusion (survives reboots)
  if tmutil addexclusion -p "$dir" 2>/dev/null; then
    echo "  TM      excluded: $dir"
  else
    echo "  TM      FAILED:   $dir"
  fi
done

echo ""
echo "Done."
echo "Note: run this script again after 'cd mobile/android && ./gradlew clean'"
echo "      because clean deletes and recreates the build directories."
