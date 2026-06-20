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
ZERO_ABANDON=${ZERO_ABANDON:-3}   # abandon the whole bench after this many 0%-pass e2e runs

typeset -a DEAD_SIMS              # sims dropped mid-bench (failed to boot) — reported at the end
typeset -i ZERO_RUNS=0           # running count of 0%-pass e2e runs (the abandon trigger)

# Read the just-finished run's summary.json from a qa .out file and print a one-line result
# (e.g. "31/37 pass · 6 failed · 29 carried"). Exit status: 0 = had ≥1 pass; 1 = ZERO passes
# with real failures (the signal the abandon-counter watches); 2 = no readable summary.
summarize_run() {                            # $1 = qa .out file
  local out=$1
  local rundir="$(grep -oE '/[^ ]*/tests/output/run-[A-Za-z0-9_-]+' $out | tail -1)"
  if [[ -z $rundir || ! -f $rundir/summary.json ]]; then print -r -- "(no summary)"; return 2; fi
  python3 - "$rundir/summary.json" <<'PY'
import json, sys
t = (json.load(open(sys.argv[1])).get("meta") or {}).get("totals") or {}
p, tg = t.get("passed", 0), t.get("targeted") or t.get("total", 0)
f, carried = t.get("failed", 0), t.get("knownBugs", 0) + t.get("findings", 0)
print(f"{p}/{tg} pass · {f} failed · {carried} carried")
sys.exit(1 if (p == 0 and f > 0) else 0)
PY
}

# qa output is large; keep it OUT of the progress log — one file per invocation, and the
# real artifacts (summary.json etc.) land under tests/output/ as usual. Echoes the run's
# result summary line. Sets RUN_ZERO=1 iff this was a 0%-pass run with real failures.
run_qa() {                                   # $1=layer  $2=label  $3..=extra qa args
  local layer=$1 label=$2; shift 2
  local out=$LOGDIR/qa-$label.out
  note "    qa $layer --all ($label) → $out"
  local t0=$EPOCHSECONDS
  npm run qa -- --layer $layer --all "$@" >$out 2>&1
  local rc=$? dt=$((EPOCHSECONDS - t0))
  local summary; summary=$(summarize_run $out); local src=$?
  RUN_ZERO=$(( src == 1 ))
  note "    qa $layer done rc=$rc wall=${dt}s — $summary"
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

# Sims that fail to boot are dropped for the REST of the bench (don't waste rounds retrying a
# dead device). LIVE shrinks as sims die; DEAD_SIMS is reported loudly at the end.
typeset -a LIVE; LIVE=($SIMS)
abandoned=""

for round in {1..$ROUNDS}; do
  [[ -n $abandoned ]] && break
  note "================= round $round / $ROUNDS ================="
  (( ${#LIVE} )) || { note "no live sims left — stopping"; break; }
  for sim in $LIVE; do
    note "----- $sim : round $round -----"
    # No platform assumption: each sim's platform comes from its own type. qa infers it from
    # --sim, but log it here so a mixed-platform bench is legible in the progress log.
    plat=$(python3 $MD --kind-of $sim 2>/dev/null) || plat="?"
    note "  platform=$plat  (per-sim; qa infers --platform from --sim)"
    note "  timed boot (--warmup → history)"
    if ! python3 $MD --warmup $sim >$LOGDIR/warmup-$sim-r$round.out 2>&1; then
      note "  ✗✗ $sim FAILED TO BOOT — DROPPING it from all remaining rounds"
      note "      (see $LOGDIR/warmup-$sim-r$round.out)"
      DEAD_SIMS+=($sim)
      LIVE=(${LIVE:#$sim})                   # remove this sim from future rounds
      continue
    fi
    # headless is host-side (no device) — keep it platform/sim-free.
    [[ $SKIP_HEADLESS == 1 ]] || run_qa headless "$sim-r$round-headless"
    if [[ $SKIP_E2E != 1 ]]; then
      run_qa e2e "$sim-r$round-e2e" --sim $sim      # --platform inferred from the sim
      if (( RUN_ZERO )); then
        ZERO_RUNS+=1
        note "  ⚠️  0%-pass e2e run ($ZERO_RUNS / $ZERO_ABANDON before abandon)"
        if (( ZERO_RUNS >= ZERO_ABANDON )); then
          abandoned="$ZERO_RUNS e2e runs returned 0% pass — the subject is broken, not the bench; "
          abandoned+="continuing would burn hours producing no comparable signal"
          note "  🛑 ABANDONING BENCH: $abandoned"
          python3 $MD --kill $sim >/dev/null 2>&1
          break
        fi
      fi
    fi
    note "  kill $sim + settle ${SETTLE}s"
    python3 $MD --kill $sim >/dev/null 2>&1
    sleep $SETTLE
  done
done

note "================= bench done ================="
(( ${#DEAD_SIMS} )) && note "⚠️  DROPPED (failed to boot): ${DEAD_SIMS}"
[[ -n $abandoned ]] && note "🛑 BENCH ABANDONED EARLY: $abandoned"
# Matrix: boot times + per-layer result counts + per-test speed + count-change analysis.
python3 scripts/bench_report.py $LOGDIR 2>&1 | tee -a $PROGRESS
note "boot times : python3 $MD --history"
note "run  times : python3 $TC inspect recent"
note "logs       : $LOGDIR/"
