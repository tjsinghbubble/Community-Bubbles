#!/usr/bin/env bash
# Reproduces the iCloud " 2" conflict-copy naming without involving a build.
#
# Mechanism under test:
#   1. iCloud uploads a file from ~/Documents to its servers.
#   2. "Optimize Mac Storage" evicts the local copy (0-byte placeholder).
#   3. A process overwrites the placeholder with different content.
#   4. iCloud detects a conflict: downloads cloud copy as "name 2.ext",
#      keeps the locally-modified file as "name.ext".
#
# NOTE on brctl evict: crashes with SIGSEGV on macOS 26.5 (Darwin 25.5.0).
# This script uses an alternative: write to a known-iCloud-tracked location
# outside any .metadata_never_index exclusion, wait for natural eviction, or
# test against already-evicted files in the android build directory.
#
# Usage:
#   bash scripts/test-icloud-conflict.sh [--mode=probe|build-files]
#
#   --mode=probe        (default) Create fresh probe files and test.
#   --mode=build-files  Test against existing " 2" files in android build dir
#                       to confirm the conflict mechanism on already-present files.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="${SCRIPT_DIR%/scripts}"
MODE="${1:-}"
LOG="${PROJECT}/tmp/icloud-conflicts.log"

# Test directory must NOT have .metadata_never_index before iCloud uploads —
# that would prevent iCloud from tracking the files at all.
# We place it in ~/Documents directly (one level above the project) so it is
# clearly in iCloud scope with no inherited exclusions from the project tree.
TEST_DIR="$HOME/Documents/icloud-conflict-test-$$"

sep() { echo ""; echo "──────────────────────────────────────────────"; }

mkdir -p "${PROJECT}/tmp"

# ── Mode: build-files ────────────────────────────────────────────────────────
if [ "$MODE" = "--mode=build-files" ]; then
  sep
  echo "Mode: build-files — inspecting existing conflict copies in android build"
  echo "$(date '+%Y-%m-%d %H:%M:%S')"
  echo ""

  BUILD="${PROJECT}/mobile/android/app/build"

  echo "All ' 2' and ' 3' files in build dir:"
  find "$BUILD" \( -name "* 2" -o -name "* 2.*" -o -name "* 3" -o -name "* 3.*" \) \
    ! -name ".metadata_never_index" 2>/dev/null | sort | while read -r f; do
    # Strip " 2" / " 3" suffix: remove the space+number and keep any extension.
    orig=$(echo "$f" | sed 's/ [0-9]\+\(\.[^/]*\)$/\1/;s/ [0-9]\+$//')
    conf_md5="$(md5 -q "$f" 2>/dev/null || echo n/a)"
    orig_md5="$(md5 -q "$orig" 2>/dev/null || echo n/a)"
    echo ""
    echo "  CONFLICT: $f"
    ls -la "$f"
    echo "  ORIGINAL: $orig"
    ls -la "$orig" 2>/dev/null || echo "    (original does not exist)"
    [ "$conf_md5" = "$orig_md5" ] && identical="IDENTICAL" || identical="DIFFERENT"
    echo "  contents: $identical  (conflict md5: $conf_md5  original md5: $orig_md5)"
  done

  echo ""
  echo "Watchman conflict log:"
  cat "$LOG" 2>/dev/null || echo "(no log yet)"
  exit 0
fi

# ── Mode: probe ──────────────────────────────────────────────────────────────
sep
echo "iCloud conflict probe test — $(date '+%Y-%m-%d %H:%M:%S')"
echo "Test dir: ${TEST_DIR}  (outside project, in iCloud scope, no exclusions)"
echo "Log:      ${LOG}"
echo ""
echo "NOTE: brctl evict segfaults on macOS 26.5. This test waits for natural"
echo "eviction by Optimize Mac Storage instead of forcing it."
echo "For immediate results, use --mode=build-files to inspect existing conflicts."

mkdir -p "$TEST_DIR"
# DO NOT touch .metadata_never_index here — that would prevent iCloud tracking.

trap 'echo ""; echo "Cleaning up ${TEST_DIR}..."; rm -rf "$TEST_DIR"' EXIT

# ── Phase 1: Create probe file ───────────────────────────────────────────────
sep
echo "[Phase 1] Creating probe file outside project tree..."
PROBE="${TEST_DIR}/probe.bin"
printf "version-A written at %s\n" "$(date '+%H:%M:%S')" > "$PROBE"
ls -la "$PROBE"

echo ""
echo "Checking iCloud sync state..."
brctl status 2>/dev/null | grep -E "needs-sync|in-sync|unclean|probe" | head -5 || true

# ── Phase 2: Wait for upload + eviction ─────────────────────────────────────
sep
echo "[Phase 2] Waiting for iCloud to upload and potentially evict..."
echo ""
echo "  Optimize Mac Storage evicts files on its own schedule (minutes to hours)."
echo "  This test will poll for up to 10 minutes. For a faster result:"
echo "    1. Leave this test running."
echo "    2. Trigger disk pressure: open a large app or duplicate a big file."
echo "    3. Or cancel and run tomorrow with files left overnight."
echo ""

WAIT_LIMIT=600
elapsed=0
evicted=false
while [ $elapsed -lt $WAIT_LIMIT ]; do
  size=$(wc -c < "$PROBE" | tr -d ' ')
  if [ "$size" -eq 0 ]; then
    echo "  ${elapsed}s: EVICTED — file is now a 0-byte placeholder."
    evicted=true
    break
  fi
  printf "  %3ds: file still local (%s bytes)...\r" "$elapsed" "$size"
  sleep 10
  elapsed=$((elapsed + 10))
done

if [ "$evicted" = "false" ]; then
  echo ""
  echo "  File was not evicted within ${WAIT_LIMIT}s."
  echo "  Options:"
  echo "    - Leave probe.bin in ${TEST_DIR} and check tomorrow."
  echo "    - Increase disk pressure to trigger eviction."
  echo "    - Run --mode=build-files to inspect existing conflicts instead."
  exit 0
fi

# ── Phase 3: Overwrite the evicted placeholder ───────────────────────────────
sep
echo "[Phase 3] Overwriting evicted placeholder with version B..."
printf "version-B written at %s — DIFFERENT CONTENT\n" "$(date '+%H:%M:%S')" > "$PROBE"
ls -la "$PROBE"

# ── Phase 4: Watch for conflict copy ────────────────────────────────────────
sep
echo "[Phase 4] Watching for conflict copy (60s timeout)..."
deadline=$(($(date +%s) + 60))
found=false
while [ "$(date +%s)" -lt "$deadline" ]; do
  conflicts=$(find "$TEST_DIR" \( -name "probe 2*" -o -name "probe 3*" \) 2>/dev/null || true)
  if [ -n "$conflicts" ]; then
    echo "  CONFLICT COPY DETECTED:"
    echo "$conflicts"
    found=true
    break
  fi
  sleep 2
done

# ── Phase 5: Results ────────────────────────────────────────────────────────
sep
echo "[Phase 5] Results:"
echo ""
ls -la "$TEST_DIR/"
echo ""

if [ "$found" = "true" ]; then
  echo "✓ MECHANISM CONFIRMED — eviction + overwrite → iCloud creates ' 2' copy."
  echo ""
  echo "  Conflict file is the OLD version (from iCloud cloud store)."
  echo "  Original file is the NEW version (locally written)."
  echo "  This is exactly what happened to MainApplication.dex on May 9→May 26."
else
  echo "✗ No conflict copy within 60s. iCloud may take longer to resolve."
  echo "  Leave the test directory and check back in a few minutes:"
  echo "    ls -la ${TEST_DIR}/"
  # Don't clean up so user can check manually
  trap - EXIT
  echo ""
  echo "  Test dir preserved at: ${TEST_DIR}"
fi

sep
echo "Watchman conflict log:"
tail -30 "$LOG" 2>/dev/null || echo "(no entries yet)"
