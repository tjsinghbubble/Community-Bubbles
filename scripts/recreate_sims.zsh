#!/usr/bin/env zsh
# recreate_sims.zsh — destroy the four Android SIMS and recreate them IDENTICAL from
# one system image, then audit each (boots? package-manager ready? right image? dims?).
#
# Why: the four SIMS had diverged (Kennedy=Play/Android-16, the rest=ATD/Android-14 —
# see memory project-sims-image-divergence). This rebuilds all four byte-identical from
# the lightweight, e2e-stable ATD-34 image, under the SAME AVD names so device-manager
# aliases (Kennedy/JFK/JoeJr/RFKjr) survive.
#
# SEQUENTIAL by design ("just in case"): one emulator at a time, full teardown between.
# Mutates nothing else; cold audit boots use -no-snapshot (no load, no save).
#
# Usage: zsh scripts/recreate_sims.zsh        (logs to tmp/sims-recreate-<UTC>/run.log)
set -u

SDK=~/Library/Android/sdk
EMU="$SDK/emulator/emulator"
AVDM="$SDK/cmdline-tools/latest/bin/avdmanager"
ADB="$(command -v adb || print -r -- "$SDK/platform-tools/adb")"
PKG="system-images;android-34;google_atd;x86_64"
DEV="small_phone"
SIMS=(Small_Phone Small_Phone_copy_JFK Small_Phone_copy_JoeJr Small_Phone_copy_RFKjr)

TS=$(date -u +%Y%m%dT%H%M%SZ)
OUT="tmp/sims-recreate-$TS"
mkdir -p "$OUT"
LOG="$OUT/run.log"
SUMMARY="$OUT/summary.tsv"
# printf, not `print -r` — `print -r` writes \t LITERALLY (no escape expansion), which
# corrupts the TSV and breaks the cut -f / column -s $'\t' parsing downstream.
printf 'sim\tcreated\tboot\tpm\timage\tdims\tgpu_mode\tverdict\n' > "$SUMMARY"

log() { print -r -- "[$(date -u +%H:%M:%S)] $*" | tee -a "$LOG"; }

# Always leave no emulator running when we exit.
cleanup() { "$ADB" -s emulator-5554 emu kill >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

wait_gone() {  # wait until no qemu emulator process (snapshot save can bounce the window)
  local i
  for i in {1..30}; do
    pgrep -f "qemu-system.*-avd" >/dev/null 2>&1 || return 0
    sleep 2
  done
  return 1
}

boot_wait() {  # poll sys.boot_completed; arg = timeout seconds
  local deadline=$(( $(date +%s) + $1 ))
  while (( $(date +%s) < deadline )); do
    if [[ "$("$ADB" -s emulator-5554 shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; then
      return 0
    fi
    sleep 3
  done
  return 1
}

pm_wait() {  # poll until package manager answers (install/launch safe); arg = timeout
  local deadline=$(( $(date +%s) + $1 ))
  while (( $(date +%s) < deadline )); do
    "$ADB" -s emulator-5554 shell pm list packages >/dev/null 2>&1 && \
      "$ADB" -s emulator-5554 shell pm list packages 2>/dev/null | grep -q android && return 0
    sleep 3
  done
  return 1
}

log "recreate_sims START — image=$PKG device=$DEV  sims=(${SIMS[*]})"
log "output dir: $OUT"

# Refuse to run if an emulator is already up (sequential invariant).
if pgrep -f "qemu-system.*-avd" >/dev/null 2>&1; then
  log "ABORT: an emulator is already running; this script needs a clean serial. Stop it first."
  exit 1
fi

for sim in $SIMS; do
  log "================ $sim ================"
  created=no boot=no pm=no img="?" dims="?" gpu="?" verdict=FAIL

  # 1. delete (AVD + any stray dir/ini)
  log "$sim: deleting old AVD…"
  print -r -- "no" | "$AVDM" delete avd -n "$sim" >>"$LOG" 2>&1 || \
    log "$sim: (avdmanager delete returned nonzero — may not have existed)"
  rm -rf ~/.android/avd/"$sim".avd ~/.android/avd/"$sim".ini 2>/dev/null

  # 2. create fresh identical
  log "$sim: creating fresh from $PKG…"
  if print -r -- "no" | "$AVDM" create avd -n "$sim" -k "$PKG" -d "$DEV" --force >>"$LOG" 2>&1; then
    created=yes
    img="$(grep -E '^image.sysdir.1' ~/.android/avd/"$sim".avd/config.ini 2>/dev/null | cut -d= -f2)"
    gpu="$(grep -E '^hw.gpu.mode' ~/.android/avd/"$sim".avd/config.ini 2>/dev/null | cut -d= -f2)"
  else
    log "$sim: CREATE FAILED — see $LOG"
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$sim" "$created" "$boot" "$pm" "$img" "$dims" "$gpu" "$verdict" >> "$SUMMARY"
    continue
  fi

  # 3. audit boot (cold, headless, supported sw renderer; -no-snapshot = non-mutating)
  log "$sim: audit cold-boot…"
  "$EMU" -avd "$sim" -no-snapshot -no-window -gpu swiftshader \
         -no-boot-anim -no-audio -cores 4 -memory 4096 >>"$OUT/$sim.boot.log" 2>&1 &
  if boot_wait 240; then
    boot=yes
    if pm_wait 90; then pm=yes; fi
    dims="$("$ADB" -s emulator-5554 shell wm size 2>/dev/null | tr -d '\r' | awk -F': ' '{print $2}')"
  else
    log "$sim: BOOT TIMEOUT (240s)"
  fi

  # 4. teardown, wait for full exit before the next sim
  log "$sim: shutting down…"
  "$ADB" -s emulator-5554 emu kill >/dev/null 2>&1 || true
  wait_gone || log "$sim: WARNING emulator process lingered past grace"

  [[ "$created" == yes && "$boot" == yes && "$pm" == yes ]] && verdict=PASS
  log "$sim: created=$created boot=$boot pm=$pm image=$img dims=$dims gpu=$gpu => $verdict"
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$sim" "$created" "$boot" "$pm" "$img" "$dims" "$gpu" "$verdict" >> "$SUMMARY"
done

log "================ DONE ================"
log "summary:"
cat "$SUMMARY" | tee -a "$LOG" | column -t -s $'\t'
# Flag identical-ness: all images + dims should match.
nimg=$(tail -n +2 "$SUMMARY" | cut -f5 | sort -u | grep -c .)
ndim=$(tail -n +2 "$SUMMARY" | cut -f6 | sort -u | grep -c .)
npass=$(tail -n +2 "$SUMMARY" | awk -F'\t' '$8=="PASS"' | grep -c .)
log "identical-check: distinct images=$nimg (want 1), distinct dims=$ndim (want 1), PASS=$npass/4"
[[ "$npass" == 4 && "$nimg" == 1 && "$ndim" == 1 ]] && log "ALL FOUR IDENTICAL + HEALTHY ✅" || log "REVIEW NEEDED ⚠"
