#!/usr/bin/env zsh
# bench_flow.zsh — benchmark ONE qa:flow across several named sims.
#
# The bench_sims.zsh sibling runs the whole suite per sim; this runs a single flow per sim,
# which is what you want when iterating on one flow (or comparing how one flow behaves across
# baked/compile levels) without paying for a full --all sweep.
#
# Per sim, per round: timed boot (→ device-manager history), then `qa:flow <flow> --sim <sim>`
# (platform is inferred from the sim), then kill + settle. A sim that fails to boot is dropped
# from the remaining rounds and reported loudly at the end. Sequential by design (iOS + Android
# share Metro / bubble_test).
#
# Usage:
#   # start the API + Metro first (separate terminals), THEN:
#   zsh scripts/bench_flow.zsh tests/e2e/auth/auth-0100-*.yaml RFKjr JFK Kennedy
#   ROUNDS=3 zsh scripts/bench_flow.zsh <flow.yaml> June Kennedy        # mixed platforms OK
#   FLOW_ARGS='--role role-user' zsh scripts/bench_flow.zsh <flow.yaml> Kennedy
#
# Env:
#   ROUNDS=2      samples per sim
#   SETTLE=30     idle seconds between sims (CPU calm + observer-effect settle)
#   FLOW_ARGS=""  extra args forwarded verbatim to qa:flow (e.g. '--role role-user -e K=V')
#   BENCH_PREP=0  1 = shut down ALL iOS sims + Android emulators before starting

set -u
cd ${0:A:h}/..                               # repo root
zmodload zsh/datetime 2>/dev/null            # $EPOCHSECONDS

FLOW=${1:-}
if [[ -z $FLOW || ! -f $FLOW ]]; then
  print -u2 "usage: zsh scripts/bench_flow.zsh <flow.yaml> [sim ...]   (flow must exist)"
  exit 2
fi
shift
if (( $# )); then SIMS=("$@"); else SIMS=(Kennedy); fi

ROUNDS=${ROUNDS:-2}
SETTLE=${SETTLE:-30}
BENCH_PREP=${BENCH_PREP:-0}
FLOW_ARGS=${FLOW_ARGS:-}

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
LOGDIR=tmp/benchflow-$STAMP
mkdir -p $LOGDIR
PROGRESS=$LOGDIR/progress.log
MD=scripts/manage_devices.py

note() { print -r -- "$(date +'%H:%M:%S')  $*" | tee -a $PROGRESS }

typeset -a DEAD_SIMS
flowname=${FLOW:t:r}

# qa:flow writes a run-manual-<flow>-<UTC>/ dir; pull its result from that summary.json.
summarize_flow() {                           # $1 = qa:flow .out file
  local out=$1
  local rundir="$(grep -oE '/[^ ]*/tests/output/run-manual-[A-Za-z0-9_-]+' $out | tail -1)"
  if [[ -z $rundir || ! -f $rundir/summary.json ]]; then print -r -- "(no summary)"; return 2; fi
  python3 - "$rundir/summary.json" <<'PY'
import json, sys
m = json.load(open(sys.argv[1])).get("meta") or {}
t = m.get("totals") or {}
print("PASS" if t.get("passed", 0) and not t.get("failed", 0) else "FAIL")
sys.exit(0 if t.get("passed", 0) and not t.get("failed", 0) else 1)
PY
}

run_flow() {                                 # $1 = label  $2 = sim
  local label=$1 sim=$2
  local out=$LOGDIR/flow-$label.out
  note "    qa:flow $flowname --sim $sim → $out"
  local t0=$EPOCHSECONDS
  npm run qa:flow -- "$FLOW" --sim $sim ${=FLOW_ARGS} >$out 2>&1
  local rc=$? dt=$((EPOCHSECONDS - t0))
  local result; result=$(summarize_flow $out)
  note "    qa:flow done rc=$rc wall=${dt}s — $result"
}

if [[ $BENCH_PREP == 1 ]]; then
  note "BENCH_PREP=1: shutting down stray iOS sims + Android emulators for a clean host"
  xcrun simctl shutdown all >/dev/null 2>&1
  adb devices | awk '/emulator-/{print $1}' | while read s; do adb -s $s emu kill >/dev/null 2>&1; done
fi

note "bench-flow start: flow=$flowname sims=(${SIMS}) rounds=$ROUNDS settle=${SETTLE}s log=$LOGDIR"
typeset -a LIVE; LIVE=($SIMS)

for round in {1..$ROUNDS}; do
  note "================= round $round / $ROUNDS ================="
  (( ${#LIVE} )) || { note "no live sims left — stopping"; break; }
  for sim in $LIVE; do
    plat=$(python3 $MD --kind-of $sim 2>/dev/null) || plat="?"
    note "----- $sim ($plat) : round $round -----"
    note "  timed boot (--warmup → history)"
    if ! python3 $MD --warmup $sim >$LOGDIR/warmup-$sim-r$round.out 2>&1; then
      note "  ✗✗ $sim FAILED TO BOOT — DROPPING it from all remaining rounds (see warmup log)"
      DEAD_SIMS+=($sim)
      LIVE=(${LIVE:#$sim})
      continue
    fi
    run_flow "$sim-r$round" "$sim"
    note "  kill $sim + settle ${SETTLE}s"
    python3 $MD --kill $sim >/dev/null 2>&1
    sleep $SETTLE
  done
done

note "================= bench-flow done ================="
(( ${#DEAD_SIMS} )) && note "⚠️  DROPPED (failed to boot): ${DEAD_SIMS}"
note "boot times : python3 $MD --history"
note "run  times : python3 scripts/testctl.py inspect recent"
note "logs       : $LOGDIR/"
