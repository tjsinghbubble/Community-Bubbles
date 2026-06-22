#!/usr/bin/env zsh
# sweep_gpu_modes.zsh — find the fastest WORKING -gpu mode for the render-probe on one
# (already-identical) Android SIM, on emulator 36.5.x.
#
# Per mode: cold-boot (-no-snapshot = non-mutating), confirm the INVOKED -gpu matches,
# install the app, adb-reverse Metro to the host, run the render-probe, classify the
# screenshot (VALID/BLACK via classify_screenshot.py), time each phase, tear down. One
# TSV row per mode.
#
# PROVE-BEFORE-LOOP: mode #1 (swiftshader, known-functional) is a gate — if the pipeline
# can't even produce a usable probe result there, ABORT instead of looping a broken
# harness. host is last (most likely to fail-render on this Intel/Radeon Mac).
#
# Usage: zsh scripts/sweep_gpu_modes.zsh [AVD_NAME]   (default Small_Phone = Kennedy)
set -u

SIM="${1:-Small_Phone}"
SDK=~/Library/Android/sdk
EMU="$SDK/emulator/emulator"
ADB="$(command -v adb || print -r -- "$SDK/platform-tools/adb")"
MAESTRO="$HOME/.maestro/bin/maestro"
APK="mobile/android/app/build/outputs/apk/debug/app-debug.apk"
PROBE="tests/experiments/gpu-sweep/render-probe.yaml"
SERIAL="emulator-5554"
METRO_PORT=8081
MODES=(swiftshader auto software lavapipe swangle host)   # swiftshader first = prove gate

TS=$(date -u +%Y%m%dT%H%M%SZ)
OUT="tmp/gpu-sweep-$TS"; mkdir -p "$OUT/shots"
LOG="$OUT/run.log"; TSV="$OUT/results.tsv"
printf 'mode\tboot_ms\tgpu_match\tinstall\tprobe\tprobe_ms\tverdict\tlit_frac\tnotes\n' > "$TSV"

log(){ print -r -- "[$(date -u +%H:%M:%S)] $*" | tee -a "$LOG"; }
now_ms(){ python3 -c 'import time;print(int(time.time()*1000))'; }

cleanup(){ "$ADB" -s "$SERIAL" emu kill >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

wait_gone(){ local i; for i in {1..30}; do pgrep -f "qemu-system.*-avd" >/dev/null 2>&1 || return 0; sleep 2; done; return 1; }
boot_wait(){ local d=$(( $(date +%s)+$1 )); while (( $(date +%s)<d )); do [[ "$("$ADB" -s "$SERIAL" shell getprop sys.boot_completed 2>/dev/null|tr -d '\r')" == 1 ]] && return 0; sleep 3; done; return 1; }
pm_wait(){ local d=$(( $(date +%s)+$1 )); while (( $(date +%s)<d )); do "$ADB" -s "$SERIAL" shell pm list packages 2>/dev/null|grep -q android && return 0; sleep 3; done; return 1; }
# macOS has no timeout(1): run "$@" with a deadline; return child rc, or 124 on timeout.
run_to(){ local to=$1; shift; "$@" & local p=$!; local d=$(( $(date +%s)+to ));
  while kill -0 $p 2>/dev/null; do (( $(date +%s)>d )) && { kill -9 $p 2>/dev/null; wait $p 2>/dev/null; return 124; }; sleep 2; done; wait $p; }

# ── preconditions ──
[[ -f "$APK" ]] || { log "ABORT: APK missing ($APK)"; exit 1; }
curl -s -m 3 "http://localhost:$METRO_PORT/status" >/dev/null 2>&1 || { log "ABORT: Metro down on :$METRO_PORT — start it first"; exit 1; }
pgrep -f "qemu-system.*-avd" >/dev/null 2>&1 && { log "ABORT: an emulator is already running (need a clean serial)"; exit 1; }
pkill -f "maestro.*mcp" 2>/dev/null && log "killed stray maestro mcp (singleton instrumentation would fight the CLI runner)"

log "sweep START sim=$SIM modes=(${MODES[*]}) out=$OUT"
first=1
for mode in $MODES; do
  log "================ -gpu $mode ================"
  boot_ms=- gpu_match=- install=- probe=- probe_ms=- verdict=- lit=- notes=""

  curl -s -m 3 "http://localhost:$METRO_PORT/status" >/dev/null 2>&1 || notes="metro-down"

  # cold boot WINDOWED (best chance at non-black pixels); -no-snapshot keeps the SIM pristine
  t0=$(now_ms)
  "$EMU" -avd "$SIM" -gpu "$mode" -no-snapshot -no-boot-anim -no-audio -cores 4 -memory 4096 \
      >>"$OUT/$mode.boot.log" 2>&1 &
  if boot_wait 240; then
    boot_ms=$(( $(now_ms) - t0 ))
  else
    notes="${notes:+$notes,}boot-timeout"; log "  $mode: BOOT TIMEOUT (240s)"
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$mode" "$boot_ms" "$gpu_match" "$install" "$probe" "$probe_ms" "$verdict" "$lit" "$notes" >> "$TSV"
    "$ADB" -s "$SERIAL" emu kill >/dev/null 2>&1; wait_gone
    [[ $first == 1 ]] && { log "ABORT: prove-mode '$mode' failed to boot — not looping."; exit 2; }
    continue
  fi

  # confirm the -gpu the emulator ACTUALLY launched with matches what we asked for
  if zsh scripts/verify_gpu_args.zsh --avd "$SIM" --expect "$mode" --sleep 1 >>"$LOG" 2>&1; then gpu_match=yes; else gpu_match=NO; fi

  pm_wait 90 || notes="${notes:+$notes,}pm-timeout"
  "$ADB" -s "$SERIAL" reverse tcp:$METRO_PORT tcp:$METRO_PORT >/dev/null 2>&1
  "$ADB" -s "$SERIAL" reverse tcp:3000 tcp:3000 >/dev/null 2>&1

  if run_to 180 "$ADB" -s "$SERIAL" install -r -d "$APK" >>"$OUT/$mode.install.log" 2>&1; then install=yes; else install=NO; notes="${notes:+$notes,}install-fail"; fi

  # render-probe = navigate to the rendered login screen (watchdog 150s). No screenshot in
  # the flow — we capture pixels ourselves below via adb (we know the serial).
  tp0=$(now_ms)
  run_to 150 "$MAESTRO" --device "$SERIAL" test \
      -e METRO_HOST=localhost -e METRO_PORT=$METRO_PORT "$PROBE" >>"$OUT/$mode.probe.log" 2>&1
  prc=$?
  probe_ms=$(( $(now_ms) - tp0 ))
  png="$OUT/shots/$mode.png"
  if [[ $prc == 0 ]]; then
    probe=pass
    # capture pixels directly — decoupled from Maestro, on the login screen it just rendered
    "$ADB" -s "$SERIAL" exec-out screencap -p > "$png" 2>>"$OUT/$mode.cap.log"
    "$ADB" -s "$SERIAL" shell am force-stop com.bubble.mobile >/dev/null 2>&1
  else
    probe=fail; [[ $prc == 124 ]] && notes="${notes:+$notes,}probe-timeout"
  fi

  if [[ -s "$png" ]]; then
    cls=$(python3 scripts/classify_screenshot.py "$png" --json 2>/dev/null)
    verdict=$(print -r -- "$cls" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("verdict","?"))' 2>/dev/null || echo "?")
    lit=$(print -r -- "$cls" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("lit_fraction","?"))' 2>/dev/null || echo "?")
  else
    verdict=NO_SHOT; notes="${notes:+$notes,}no-screenshot"
  fi

  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$mode" "$boot_ms" "$gpu_match" "$install" "$probe" "$probe_ms" "$verdict" "$lit" "$notes" >> "$TSV"
  log "  $mode: boot=${boot_ms}ms gpu_match=$gpu_match install=$install probe=$probe probe_ms=${probe_ms} verdict=$verdict lit=$lit ${notes:+($notes)}"

  if [[ $first == 1 ]]; then
    if [[ "$verdict" == "NO_SHOT" || "$probe" == "fail" ]]; then
      log "ABORT after prove-mode '$mode': no usable probe result (verdict=$verdict probe=$probe). NOT looping a broken harness."
      "$ADB" -s "$SERIAL" emu kill >/dev/null 2>&1; wait_gone; exit 3
    fi
    log "prove-mode '$mode' OK — pipeline works end-to-end; continuing the sweep."
    first=0
  fi

  "$ADB" -s "$SERIAL" emu kill >/dev/null 2>&1; wait_gone
done

log "================ SWEEP DONE ================"
column -t -s $'\t' "$TSV" | tee -a "$LOG"
log "results: $TSV   shots: $OUT/shots"
