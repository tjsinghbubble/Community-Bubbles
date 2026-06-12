#!/usr/bin/env zsh
# icloud-ignore-churn.zsh — stop iCloud Drive from syncing transitory build/test dirs.
#
# Why: flag-temp-files.zsh sets `com.apple.icloud.donotbackup` (NSURLIsExcludedFromBackupKey),
# which excludes from *backup* but does NOT reliably stop iCloud Drive *sync*. The attribute that
# actually makes the iCloud FileProvider ignore a tree is `com.apple.fileprovider.ignore` (this is
# why node_modules — set by the npm ecosystem — never syncs). tests/output currently lacks it, so
# every test artifact churns bird/cloudd. This sets it (idempotent) on the in-iCloud-scope dirs.
#
# Verify after:  xattr <dir>   # should list com.apple.fileprovider.ignore#P
# To undo:       xattr -d 'com.apple.fileprovider.ignore#P' <dir>
#
# TODO: fold this into flag-temp-files.zsh's block_icloud_backups() so it's applied on postinstall.
emulate -L zsh
setopt pipe_fail
PROJ="${1:-${0:a:h:h}}"   # default: parent of scripts/

# Only dirs under iCloud Drive scope (the project lives in ~/Documents). ~/Library dirs aren't
# synced by iCloud, so they don't need this.
dirs=(
  "$PROJ/node_modules"
  "$PROJ/mobile/node_modules"
  "$PROJ/mobile/android/build"
  "$PROJ/mobile/android/.gradle"
  "$PROJ/mobile/android/app/build"
  "$PROJ/mobile/android/app/.cxx"
  "$PROJ/mobile/ios"
  "$PROJ/dist"
  "$PROJ/tests/output"
  "$PROJ/.maestro/output"
  "$PROJ/.expo"
  "$PROJ/tmp"
)

for d in $dirs; do
  [[ -d $d ]] || { print -r -- "skip (absent): $d"; continue; }
  if xattr "$d" 2>/dev/null | grep -q '^com.apple.fileprovider.ignore'; then
    print -r -- "ok (already ignored): $d"
  else
    if xattr -w 'com.apple.fileprovider.ignore#P' 1 "$d" 2>/dev/null; then
      print -r -- "set fileprovider.ignore: $d"
    else
      print -r -- "FAILED: $d" >&2
    fi
  fi
done
