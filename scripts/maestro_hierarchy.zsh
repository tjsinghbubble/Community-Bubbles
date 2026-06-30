#!/usr/bin/env zsh
# maestro_hierarchy.zsh — dump the connected device's view hierarchy (the objects on
# screen + which one is focused). The parallel companion to testctl's `noisy` decorator.
#
# WHY a separate script: Maestro flow YAML has NO in-flow command to print the
# hierarchy or the focused element — `takeScreenshot` is the only per-step capture.
# `maestro hierarchy` (CLI) is the only dump, and it drives the SAME singleton
# on-device driver that `maestro test` uses. So:
#   • run this while a `maestro test`/`noisy` run is PAUSED or STOPPED, or
#   • point it at a SECOND simulator (the qa pattern for concurrency).
# Running it against the sim mid-`test` will fight the driver (see project memory).
#
# Usage:
#   scripts/maestro_hierarchy.zsh [--sim <token>] [outdir]
#     --sim <token>   resolve a specific device via manage_devices (else Maestro's default)
#     outdir          where to write (default: tmp/maestro/hierarchy)
#
# Writes, timestamped:
#   hierarchy-<ts>.txt   full tree (every element + attributes)
#   hierarchy-<ts>.csv   --compact CSV: element_num,depth,attributes,parent_num
# and prints the focused element(s) to stdout.

emulate -L zsh
set -euo pipefail

REPO="${0:A:h:h}"
sim=""
outdir="$REPO/tmp/maestro/hierarchy"

while (( $# )); do
  case "$1" in
    --sim) sim="$2"; shift 2 ;;
    *)     outdir="$1"; shift ;;
  esac
done

mkdir -p "$outdir"
ts="$(date -u +%Y%m%dt%H%M%SZ)"
full="$outdir/hierarchy-$ts.txt"
csv="$outdir/hierarchy-$ts.csv"

dev_args=()
if [[ -n "$sim" ]]; then
  id="$(python3 "$REPO/scripts/manage_devices.py" --resolve "$sim" 2>/dev/null)" || true
  if [[ -z "$id" ]]; then
    print -u2 "could not resolve --sim '$sim' via manage_devices"
    exit 1
  fi
  dev_args=(--device "$id")
  print -u2 "→ device: $sim ($id)"
fi

# Full tree and compact CSV are two separate driver hits; keep them adjacent in time.
maestro "${dev_args[@]}" hierarchy           > "$full" 2>/dev/null || {
  print -u2 "maestro hierarchy failed — is a device booted, and is no 'maestro test' holding the driver?"
  exit 1
}
maestro "${dev_args[@]}" hierarchy --compact > "$csv"  2>/dev/null || true

print -r -- "wrote: ${full#$REPO/}"
print -r -- "wrote: ${csv#$REPO/}"

# Surface the focused element(s) — the 'object in focus' the user asked about.
print -r -- "── focused element(s) ──"
if ! grep -iE 'focused["= ]*true' "$full"; then
  print -r -- "(none reported focused, or the platform omits the attribute on this screen)"
fi
