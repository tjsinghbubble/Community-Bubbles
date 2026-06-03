#!/usr/bin/env bash
# Registers a Watchman trigger that applies iCloud/Spotlight/TM exclusions to
# directories created during native builds and Metro bundling.
#
# Run once after cloning. The trigger persists across Watchman daemon restarts.
# Re-run if the trigger is lost (watchman watch-del-all was called, etc.).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="${SCRIPT_DIR%/scripts}"
HANDLER="${SCRIPT_DIR}/watchman-exclude-handler.sh"

chmod +x "$HANDLER"

# Ensure watchman is watching the project root (Metro may already have done this)
watchman watch "$PROJECT"

# Register trigger: fires for any new directory under build output paths.
# .expo/** covers Metro bundling artifacts created inside the project tree.
watchman -j <<EOT
["trigger", "${PROJECT}", {
  "name": "exclude-build-dirs",
  "expression": ["allof",
    ["type", "d"],
    ["anyof",
      ["match", "mobile/android/**", "wholename"],
      ["match", "mobile/ios/**", "wholename"],
      ["match", ".expo/**", "wholename"]
    ]
  ],
  "command": ["bash", "${HANDLER}"],
  "stdin": ["name"],
  "append_files": false
}]
EOT

echo "Watchman trigger 'exclude-build-dirs' registered on ${PROJECT}"

CONFLICT_LOGGER="${SCRIPT_DIR}/watchman-conflict-logger.sh"
chmod +x "$CONFLICT_LOGGER"

# Register trigger: fires when iCloud creates conflict-copy files/dirs (" 2", " 3", etc).
# These appear when iCloud's Optimize Mac Storage evicts a file and a build tool
# overwrites the placeholder before iCloud can re-sync it.
watchman -j <<EOT
["trigger", "${PROJECT}", {
  "name": "detect-icloud-conflicts",
  "expression": ["anyof",
    ["match", "* 2",   "basename"],
    ["match", "* 2.*", "basename"],
    ["match", "* 3",   "basename"],
    ["match", "* 3.*", "basename"]
  ],
  "command": ["bash", "${CONFLICT_LOGGER}"],
  "stdin": ["name", "exists", "new", "size", "mtime"],
  "append_files": false
}]
EOT

echo "Watchman trigger 'detect-icloud-conflicts' registered on ${PROJECT}"
echo "Conflict log: ${PROJECT}/tmp/icloud-conflicts.log"
echo "Verify with: watchman trigger-list '${PROJECT}'"
