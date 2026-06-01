#!/usr/bin/env bash
# dev-connect.sh — set up local dev connectivity so the logical host names resolve
# to a reachable address on the chosen target. See docs/dev-hosts.md.
#
# Usage:
#   scripts/dev-connect.sh ios        # iOS simulator   — no-op (localhost is native)
#   scripts/dev-connect.sh android    # AOSP emulator / Genymotion / USB device
#   scripts/dev-connect.sh status     # show current adb reverse tunnels
#
# For Android targets this maps the *device's* localhost:PORT to the *Mac's*
# localhost:PORT over the adb channel (works identically for AOSP emulators,
# Genymotion, and USB-attached real devices — no 10.0.2.2 / 10.0.3.2 differences).
set -euo pipefail

API_PORT="${API_PORT:-3000}"
METRO_PORT="${METRO_PORT:-8081}"

reverse() {  # port -> port, idempotent
  adb reverse "tcp:$1" "tcp:$1" >/dev/null
  echo "  adb reverse tcp:$1 -> host:$1"
}

case "${1:-}" in
  ios)
    echo "iOS simulator: no setup needed — localhost maps to the Mac."
    echo "  (A real iOS device needs the Mac LAN IP on-LAN, or a public host off-LAN.)"
    ;;
  android)
    if ! command -v adb >/dev/null 2>&1; then
      echo "error: adb not found on PATH (install Android platform-tools)." >&2; exit 1
    fi
    count="$(adb devices | grep -cE '\sdevice$' || true)"
    if [ "$count" -eq 0 ]; then
      echo "error: no adb device. Start the emulator/Genymotion or attach a device." >&2; exit 1
    fi
    echo "Setting up adb reverse tunnels (API:$API_PORT, Metro:$METRO_PORT):"
    reverse "$API_PORT"
    reverse "$METRO_PORT"
    echo "Done. Use http://localhost:$API_PORT for the API and localhost:$METRO_PORT for Metro."
    ;;
  status)
    echo "Current adb reverse tunnels:"; adb reverse --list || true
    ;;
  *)
    echo "usage: $0 {ios|android|status}" >&2; exit 2
    ;;
esac
