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
#   BENCH_SCOPE=all   'all' = --all (whole suite); 'smoke' = --tag smoke (fast subset)
#   ZERO_ABANDON=3    abandon the whole bench after this many 0%-pass e2e runs
#   LOAD_WARN=50      warn when 1-min load exceeds this; drop a sim if it won't fall below it
#   LOAD_PAUSE=100    warn + pause 30s when 1-min load exceeds this before the quiesce wait
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
BENCH_SCOPE=${BENCH_SCOPE:-all}   # 'all' = --all (whole suite); 'smoke' = --tag smoke
if [[ $BENCH_SCOPE == smoke ]]; then SCOPE_ARGS=(--tag smoke); else SCOPE_ARGS=(--all); fi

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
  note "    qa $layer $SCOPE_ARGS ($label) → $out"
  local t0=$EPOCHSECONDS
  npm run qa -- --layer $layer $SCOPE_ARGS "$@" >$out 2>&1
  local rc=$? dt=$((EPOCHSECONDS - t0))
  local summary; summary=$(summarize_run $out); local src=$?
  RUN_ZERO=$(( src == 1 ))
  note "    qa $layer done rc=$rc wall=${dt}s — $summary"
}

# Integer 1-minute load average (host-side, cheap — sysctl, no guest probing).
_load1() { sysctl -n vm.loadavg | awk '{print int($2)}' }

# Intra-run host-load guard, run before each sim's turn. A bench that hammers the host into a
# high load average produces ANR-contaminated, untrustworthy results (the SystemUI ANR at load
# ~44–134 corrupted the e2e layer). Thresholds (Travis): warn >50; warn + pause 30s >100; if it
# won't fall below 50 within 60s, kill + DROP the sim (its run wouldn't be trustworthy anyway).
# Returns 0 = proceed, 1 = drop this sim.
LOAD_WARN=${LOAD_WARN:-50}
LOAD_PAUSE=${LOAD_PAUSE:-100}
load_guard() {                               # $1 = sim (for messages)
  local sim=$1 l=$(_load1)
  (( l > LOAD_WARN )) && note "  ⚠️  1-min load ${l} > ${LOAD_WARN} (host busy)"
  if (( l > LOAD_PAUSE )); then
    note "  ⚠️  1-min load ${l} > ${LOAD_PAUSE} — pausing 30s to let the host settle"
    sleep 30
    l=$(_load1)
  fi
  if (( l >= LOAD_WARN )); then              # give it up to 60s to quiesce below the warn line
    local waited=0
    while (( l >= LOAD_WARN && waited < 60 )); do
      sleep 10; waited=$((waited + 10)); l=$(_load1)
    done
    if (( l >= LOAD_WARN )); then
      note "  ✗✗ 1-min load ${l} still ≥${LOAD_WARN} after ${waited}s — KILLING + DROPPING $sim (untrustworthy under load)"
      python3 $MD --kill $sim >/dev/null 2>&1
      return 1
    fi
    note "  1-min load settled to ${l} after ${waited}s — proceeding"
  fi
  return 0
}

preflight() {
  note "preflight: API + Metro reachable? (health, ignoring iOS-sim-only gates)"
  local j=$LOGDIR/qa-health.json
  # Call testctl directly, not via `npm run` — npm prepends a banner that breaks JSON parsing.
  python3 $TC health --json >$j 2>/dev/null
  # A headless/android bench needs API + Metro + the bubble_test qa:server — NOT a booted iOS
  # sim. qa:health includes iOS-sim gates that fail with the sim shut down; gate only on the
  # checks this bench actually depends on (qa.ts re-gates the android device per run anyway).
  if ! python3 -c "
import json, sys
try:
    d = json.load(open('$j'))
except Exception as e:
    print(f'health output unreadable: {e}'); sys.exit(1)
need = {'api-server', 'metro', 'qa-server-identity'}
bad = [c['name'] for c in d.get('checks', []) if c['name'] in need and c['status'] != 'ok']
if bad:
    print('not ok: ' + ', '.join(bad)); sys.exit(1)
"; then
    note "✗ preflight: API/Metro/qa-server not ready — start 'npm run qa:server' + 'npm run mobile:start'."
    note "  see $j"
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
    # Host-load guard before any work — a busy host yields ANR-contaminated, untrustworthy runs.
    if ! load_guard $sim; then
      DEAD_SIMS+=($sim)
      LIVE=(${LIVE:#$sim})
      continue
    fi
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
(( ${#DEAD_SIMS} )) && note "⚠️  DROPPED (boot failure or sustained high load): ${DEAD_SIMS}"
[[ -n $abandoned ]] && note "🛑 BENCH ABANDONED EARLY: $abandoned"
# Matrix: boot times + per-layer result counts + per-test speed + count-change analysis.
python3 scripts/bench_report.py $LOGDIR 2>&1 | tee -a $PROGRESS
note "boot times : python3 $MD --history"
note "run  times : python3 $TC inspect recent"
note "logs       : $LOGDIR/"
