#!/usr/bin/env bash
# Registers a Watchman trigger that applies iCloud/Spotlight/TM exclusions to
# mobile/android/ and mobile/ios/ directories as they are created during builds.
#
# Run once after cloning. The trigger persists across Watchman daemon restarts.
# Re-run if the trigger is lost (watchman watch-del-all was called, etc.).

set -euo pipefail

PROJECT="${HOME}/Documents/src/bubble/TJ-branch-20260220"
HANDLER="${PROJECT}/scripts/watchman-exclude-handler.sh"

chmod +x "$HANDLER"

# Ensure watchman is watching the project root (Metro may already have done this)
watchman watch "$PROJECT"

# Register trigger: fires for any new directory under mobile/android/ or mobile/ios/
watchman -j <<EOT
["trigger", "${PROJECT}", {
  "name": "exclude-build-dirs",
  "expression": ["allof",
    ["type", "d"],
    ["anyof",
      ["match", "mobile/android/**", "wholename"],
      ["match", "mobile/ios/**", "wholename"]
    ]
  ],
  "command": ["bash", "${HANDLER}"],
  "stdin": ["name"],
  "append_files": false
}]
EOT

echo "Watchman trigger 'exclude-build-dirs' registered on ${PROJECT}"
echo "Verify with: watchman trigger-list '${PROJECT}'"
