#!/usr/bin/env bash
# Installs the debug APK onto a running Genymotion virtual device.
#
# Genymotion devices appear in adb as network addresses (not "emulator-XXXX"),
# so this script identifies them by filtering out emulator-style serials.
#
# Usage: run from project root, with a Genymotion VM already running.
#   npm run mobile:install:android-genymotion
#
# To start a Genymotion VM:
#   /Applications/Genymotion.app/Contents/MacOS/gmtool admin start <vm-name>
# To list available VMs:
#   /Applications/Genymotion.app/Contents/MacOS/gmtool admin list

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="${SCRIPT_DIR%/scripts}"
APK="${PROJECT}/mobile/android/app/build/outputs/apk/debug/app-debug.apk"

if [ ! -f "$APK" ]; then
  echo "APK not found: $APK"
  echo "Run 'npm run mobile:build:android-emu' first."
  exit 1
fi

# Find the first online Genymotion device (network serial, not emulator-XXXX)
DEVICE=$(adb devices | awk 'NR>1 && $2=="device" && $1 !~ /^emulator-/ {print $1; exit}')

if [ -z "$DEVICE" ]; then
  echo "No Genymotion device found in adb."
  echo ""
  echo "Start a VM first:"
  echo "  /Applications/Genymotion.app/Contents/MacOS/gmtool admin list"
  echo "  /Applications/Genymotion.app/Contents/MacOS/gmtool admin start <vm-name>"
  echo ""
  echo "Then reconnect if needed:"
  echo "  adb connect <vm-ip>:5555"
  exit 1
fi

echo "Installing on Genymotion device: $DEVICE"
adb -s "$DEVICE" install -r "$APK"
echo "Done. App installed on $DEVICE."
echo ""
echo "The app will try to reach Metro at the LAN address configured in its dev settings."
echo "Shake the device to open Dev Menu → Change Bundle Location if needed."
