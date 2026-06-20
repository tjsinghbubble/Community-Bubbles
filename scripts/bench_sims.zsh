#!/usr/bin/env zsh
# bench_sims.zsh — overnight Android bench across baked sims.
#
# Per sim, per round: timed boot (→ device-manager history), then `qa --layer headless
# --all` (host baseline) and `qa --layer e2e --all` (the real per-level signal), then kill
# + settle. Sequential by design — iOS+Android share bubble_test/Metro and collide if run
# concurrently.
#
# This script ONLY orchestrates + logs progress. The DATA lives in two places, read back
# with one command each AFTER the run:
#   boot times : python3 scripts/manage_devices.py --history
#   run times  : python3 scripts/testctl.py inspect recent     (Run Time col; per-test
#                durationMs is in each tests/output/run-*/summary.json)
#
# Defaults match the current baked copies (override by passing sims as args):
#   RFKjr=low  JoeJr=medium  JFK=hot  Kennedy=none(baseline)
#
# Usage:
#   # start the API + Metro first (separate terminals), THEN:
#   ROUNDS=3 zsh scripts/bench_sims.zsh                 # all 4, 3 rounds
#   zsh scripts/bench_sims.zsh RFKjr JFK                # just two sims
#   BENCH_PREP=1 zsh scripts/bench_sims.zsh             # shut down stray sims first
#
# Env:
#   ROUNDS=3      rounds (samples per sim, for averaging + variability)
#   SETTLE=30     seconds to idle between sims (CPU calm + observer-effect settle)
#   BENCH_PREP=0  1 = shut down ALL iOS sims + android emulators before starting
#   SKIP_HEADLESS=0 / SKIP_E2E=0   drop a layer
#
# NOTE: `e2e --all` on Android has been ~50-57 min/run here; 4 sims × 3 rounds ≈ 9-18h.
# Tune ROUNDS / the sim list / swap --all for `--tag smoke` if that's too long.

set -u
cd ${0:A:h}/..                               # repo root

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
LOGDIR=tmp/bench-$STAMP
mkdir -p $LOGDIR
PROGRESS=$LOGDIR/progress.log

note() { print -r -- "$(date +'%H:%M:%S')  $*" | tee -a $PROGRESS }

MD=scripts/manage_devices.py
TC=scripts/testctl.py

# zsh `arr=(${@:-a b c})` does NOT field-split the default into elements (bash does),
# so with no args SIMS became one value "RFKjr JoeJr JFK Kennedy". Use an explicit if/else.
if (( $# )); then SIMS=("$@"); else SIMS=(RFKjr JoeJr JFK Kennedy); fi
ROUNDS=${ROUNDS:-2}
SETTLE=${SETTLE:-30}
BENCH_PREP=${BENCH_PREP:-0}
SKIP_HEADLESS=${SKIP_HEADLESS:-0}
SKIP_E2E=${SKIP_E2E:-0}


# qa output is large; keep it OUT of the progress log — one file per invocation, and the
# real artifacts (summary.json etc.) land under tests/output/ as usual.
run_qa() {                                   # $1=layer  $2=label  $3..=extra qa args
  local layer=$1 label=$2; shift 2
  local out=$LOGDIR/qa-$label.out
  note "    qa $layer --all ($label) → $out"
  local t0=$EPOCHSECONDS
  npm run qa -- --layer $layer --all "$@" >$out 2>&1
  local rc=$? dt=$((EPOCHSECONDS - t0))
  note "    qa $layer done rc=$rc wall=${dt}s (authoritative time: summary.json / testctl)"
}

preflight() {
  note "preflight: qa:health (API + Metro reachable?)"
  if ! npm run qa:health >$LOGDIR/qa-health.out 2>&1; then
    note "✗ qa:health failed — start 'npm run qa:server' + 'npm run mobile:start' first."
    note "  see $LOGDIR/qa-health.out"
    exit 1
  fi
  if [[ $BENCH_PREP == 1 ]]; then
    note "BENCH_PREP=1: shutting down stray iOS sims + Android emulators for a clean host"
    xcrun simctl shutdown all >/dev/null 2>&1
    adb devices | awk '/emulator-/{print $1}' | while read s; do adb -s $s emu kill >/dev/null 2>&1; done
  fi
}

zmodload zsh/datetime 2>/dev/null            # $EPOCHSECONDS
preflight
note "bench start: sims=(${SIMS}) rounds=$ROUNDS settle=${SETTLE}s log=$LOGDIR"

for round in {1..$ROUNDS}; do
  note "================= round $round / $ROUNDS ================="
  for sim in $SIMS; do
    note "----- $sim : round $round -----"
    note "  timed boot (--warmup → history)"
    if ! python3 $MD --warmup $sim >$LOGDIR/warmup-$sim-r$round.out 2>&1; then
      note "  ✗ $sim warmup failed (see $LOGDIR/warmup-$sim-r$round.out) — skipping sim"
      continue
    fi
    [[ $SKIP_HEADLESS == 1 ]] || run_qa headless "$sim-r$round-headless"
    [[ $SKIP_E2E == 1 ]]      || run_qa e2e "$sim-r$round-e2e" --platform android --sim $sim
    note "  kill $sim + settle ${SETTLE}s"
    python3 $MD --kill $sim >/dev/null 2>&1
    sleep $SETTLE
  done
done

note "================= bench done ================="
# Matrix: boot times + per-layer result counts + per-test speed + count-change analysis.
python3 scripts/bench_report.py $LOGDIR 2>&1 | tee -a $PROGRESS
note "boot times : python3 $MD --history"
note "run  times : python3 $TC inspect recent"
note "logs       : $LOGDIR/"
