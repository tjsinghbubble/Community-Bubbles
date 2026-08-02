#!/usr/bin/env zsh
# bench_sims.zsh — bench across one or more sims/emulators (any platform).
#
# Per sim, per round: timed boot (→ device-manager history), then the selected test scope,
# then kill + settle. Sequential by design — iOS+Android share bubble_test/Metro and collide
# if run concurrently.
#
# This script ONLY orchestrates + logs progress. The DATA lives in two places, read back
# with one command each AFTER the run:
#   boot times : python3 scripts/manage_devices --history
#   run times  : python3 scripts/testctl.py inspect recent     (Run Time col; per-test
#                durationMs is in each tests/output/run-*/summary.json)
#
# Usage (all options are SWITCHES; no positional/env args):
#   # start the API + Metro first (separate terminals), THEN:
#   zsh scripts/bench_sims.zsh                              # default: --smoke, last-ios, 2 rounds
#   zsh scripts/bench_sims.zsh --all --sims JFK,Kennedy --rounds 3
#   zsh scripts/bench_sims.zsh --e2e --sims last-android
#   zsh scripts/bench_sims.zsh --flow tests/e2e/auth/auth-0100-signin-smoke.yaml --sims Ryder
#
# Switches:
#   --rounds N        samples per sim (averaging + variability).      default 2
#   --settle N        seconds idle between sims (CPU calm).           default 30
#   --abort-after N   give up the WHOLE bench after N runs that signal a BROKEN test
#                     environment (0% pass / 0 tests started / no result at all — e.g. DB
#                     down on a full disk, API or Metro crashed, all AVDs corrupted). The
#                     point: stop wasting hours once tests have stopped meaning anything.
#                     Startup health is checked separately by preflight and isn't counted.
#                     default 3
#   --sims LIST       comma- or space-separated sim ids/aliases; any
#                     format/platform manage_devices recognizes
#                     (e.g. Jane,last-android,Pixel_9_Pro_XL,<UDID>). default last-ios
#   --prep            shut down ALL stray iOS sims + Android emulators first (clean host).
#   --dry-run         print scope/sims/time-estimate and exit (no preflight, no runs).
#   -y, --yes         confirm long runs up front (REQUIRED for non-interactive/overnight
#                     long runs — otherwise a piped/detached long run aborts as a safety guard).
#   Scope (mutually exclusive; pick one):
#     --smoke         smoke-tagged subset, headless + e2e.            (DEFAULT)
#     --all           whole suite, headless + e2e.
#     --e2e           e2e layer only (whole layer).
#     --headless      headless layer only (whole layer).
#     --flow FLOW     run a single flow via qa:flow (FLOW = yaml path).
#
# Env overrides (rarely needed) live in the CONFIG block below.
#
# Long-run confirmation & how launch method affects it (keys off STDIN, not stdout):
#   A run whose ESTIMATE ≥ WARN_MINUTES (default 60) needs confirmation. What you get:
#     • plain interactive run            → y/N prompt (asked on /dev/tty)
#     • output redirected/piped          → STILL prompts on the terminal even though stdout/
#       (`> log 2>&1`, `| tee log`)        stderr go to the file (stdin is still your terminal)
#     • stdin redirected (`< /dev/null`),→ NO terminal to ask → ABORTS unless you pass -y
#       piped-in, or `nohup` (detaches      (this is the guard against accidental hours-long runs)
#       stdin to /dev/null)
#   Runs estimated UNDER WARN_MINUTES never prompt and never abort — they just run.
#   ⇒ For a detached/overnight run, pass -y:  nohup zsh scripts/bench_sims.zsh --all -y ... &

set -u
cd ${0:A:h}/..                               # repo root
zmodload zsh/datetime 2>/dev/null            # $EPOCHSECONDS

# ════════════════════════ CONFIG (all tunables in one place) ════════════════════════
# Switch defaults
DEFAULT_ROUNDS=2
DEFAULT_SETTLE=30                            # seconds idle between sims (observer-effect calm)
DEFAULT_ABORT_AFTER=3                        # zero-pass runs before abandoning the whole bench
DEFAULT_SCOPE=smoke                          # smoke | all | e2e | headless | flow
DEFAULT_SIMS=(last-ios)

# Intra-run host-load guard (env-overridable). A bench that hammers the host into a high load
# average produces ANR-contaminated, untrustworthy results (the SystemUI ANR at load ~44–134
# corrupted the e2e layer). Thresholds (Travis): warn >LOAD_WARN; warn + pause 30s >LOAD_PAUSE;
# if load won't fall below LOAD_WARN within 60s, kill + DROP the sim (its run is untrustworthy).
: ${LOAD_WARN:=50}                           # warn when 1-min load exceeds this
: ${LOAD_PAUSE:=100}                         # warn + pause 30s when 1-min load exceeds this

# Long-run guard: if the estimate ≥ this many minutes, ask for confirmation on a TTY.
: ${WARN_MINUTES:=60}

# Rough wall-clock cost PER SIM-ROUND, in minutes, by scope. These are estimates for the
# confirmation prompt ONLY (real numbers: manage_devices --history + testctl inspect recent).
# Grounded in project history: android `e2e --all` ≈ 50–57 min/run; smoke is the fast subset.
typeset -A TIME_COST_MIN=( smoke 12  all 62  e2e 55  headless 6  flow 3 )
BOOT_SETTLE_OVERHEAD_MIN=5                   # cold boot + settle, added per sim-round
# ════════════════════════════════════════════════════════════════════════════════════

SELF=${0:A}                                  # captured here: inside a function $0 is the fn name
usage() { sed -n '2,40p' $SELF; }

# ──────────────────────────── arg parsing (switches only) ────────────────────────────
ROUNDS=$DEFAULT_ROUNDS
SETTLE=$DEFAULT_SETTLE
ABORT_AFTER=$DEFAULT_ABORT_AFTER
SCOPE=$DEFAULT_SCOPE
SIMS=($DEFAULT_SIMS)
PREP=0
ASSUME_YES=0
DRY_RUN=0
FLOW=""
typeset -i scope_set=0

set_scope() {                                # enforce mutual exclusivity
  (( scope_set )) && { print -u2 "error: pick only one scope switch (got --$SCOPE and --$1)"; exit 2; }
  SCOPE=$1; scope_set=1
}

while (( $# )); do
  case $1 in
    --rounds)              ROUNDS=$2; shift 2;;
    --settle)              SETTLE=$2; shift 2;;
    --abort-after|--abort_after) ABORT_AFTER=$2; shift 2;;
    --smoke)               set_scope smoke; shift;;
    --all)                 set_scope all; shift;;
    --e2e)                 set_scope e2e; shift;;
    --headless)            set_scope headless; shift;;
    --flow)                set_scope flow; shift
                           FLOW=${1:?--flow needs a FLOW yaml path}; shift
                           [[ $FLOW == qa:flow ]] && { FLOW=${1:?}; shift; }  # tolerate `--flow qa:flow <path>`
                           ;;
    --sims)                shift; SIMS=()
                           while (( $# )) && [[ $1 != -* ]]; do
                             SIMS+=(${(s:,:)1}); shift  # split commas → individual ids
                           done
                           (( ${#SIMS} )) || { print -u2 "error: --sims needs at least one id"; exit 2; }
                           ;;
    --prep)                PREP=1; shift;;
    --dry-run|--plan)      DRY_RUN=1; shift;;
    -y|--yes)              ASSUME_YES=1; shift;;
    -h|--help)             usage; exit 0;;
    *)                     print -u2 "unknown arg: $1  (see --help)"; exit 2;;
  esac
done

# numeric validation
for pair in "rounds:$ROUNDS" "settle:$SETTLE" "abort-after:$ABORT_AFTER"; do
  [[ ${pair#*:} == <-> ]] || { print -u2 "error: --${pair%%:*} must be a non-negative integer (got '${pair#*:}')"; exit 2; }
done
[[ $SCOPE == flow && ! -f $FLOW ]] && { print -u2 "error: --flow file not found: $FLOW"; exit 2; }

MD=scripts/manage_devices
TC=scripts/testctl.py

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
LOGDIR=tmp/bench-$STAMP
mkdir -p $LOGDIR
PROGRESS=$LOGDIR/progress.log
note() { print -r -- "$(date +'%H:%M:%S')  $*" | tee -a $PROGRESS }

# Validate every sim id up front (a typo shouldn't surface 50 minutes into an overnight run).
typeset -a BAD_SIMS
for s in $SIMS; do python3 $MD --kind-of $s >/dev/null 2>&1 || BAD_SIMS+=($s); done
(( ${#BAD_SIMS} )) && { print -u2 "error: manage_devices does not recognize: ${BAD_SIMS}"; exit 2; }

# scope → qa args. headless/e2e/flow run the WHOLE layer (--all); smoke is the tagged subset.
if [[ $SCOPE == smoke ]]; then SCOPE_ARGS=(--tag smoke); else SCOPE_ARGS=(--all); fi

typeset -a DEAD_SIMS              # sims dropped mid-bench (boot fail / sustained load)
typeset -i BROKEN_RUNS=0         # running count of broken-environment runs (the abandon trigger)
RUN_BROKEN=0

# ──────────────────────────── time estimate + confirm ────────────────────────────
per=${TIME_COST_MIN[$SCOPE]:-30}
total_min=$(( (per + BOOT_SETTLE_OVERHEAD_MIN) * ROUNDS * ${#SIMS} ))
note "scope=$SCOPE${FLOW:+ ($FLOW)}  sims=(${SIMS})  rounds=$ROUNDS  settle=${SETTLE}s"
note "estimated wall-clock: ~${total_min} min  (≈${per}min/run + ${BOOT_SETTLE_OVERHEAD_MIN}min boot/settle × ${ROUNDS} rounds × ${#SIMS} sims)"
note "  (estimate only — real per-run times: $TC inspect recent; boot: $MD --history)"
(( DRY_RUN )) && { note "--dry-run: plan only — exiting before preflight/runs"; exit 0; }
if (( total_min >= WARN_MINUTES )); then
  note "⚠️  this is a long/expensive run (~$((total_min/60))h$((total_min%60))m)."
  if (( ASSUME_YES )); then
    note "  (-y/--yes: proceeding without prompt)"
  elif [[ -t 0 ]]; then
    # STDIN is a real terminal. Prompt/read on /dev/tty (the controlling terminal) so the
    # question is visible and answerable EVEN IF stdout/stderr are redirected to a file.
    print -n -- "  Continue? [y/N] " >/dev/tty
    read -r ans </dev/tty
    [[ $ans == [yY]* ]] || { note "aborted by user before start"; exit 0; }
  else
    # No terminal on STDIN (stdin redirected/piped-in, or detached via nohup, which points
    # stdin at /dev/null): there's no one to ask, so refuse a long run unless -y was given.
    # This is what stops an accidental detached invocation from silently burning hours.
    note "  🛑 refusing a long run with no terminal on stdin and no -y/--yes (guard against accidental hours-long runs)."
    note "     for an intentional detached/overnight bench, add -y:  nohup zsh scripts/bench_sims.zsh ... -y &"
    exit 0
  fi
fi

# ──────────────────────────── helpers ────────────────────────────
# Read the just-finished run's summary.json and print a one-line result. Exit status encodes
# whether the run looks like a BROKEN ENVIRONMENT (the abandon signal):
#   0 = healthy   (≥1 test passed)
#   1 = broken    (0 passed with real failures, OR 0 tests were even started/targeted)
#   2 = broken    (no readable summary at all — the run likely crashed: API/Metro/DB down)
# Both 1 and 2 increment the abort-after counter.
summarize_run() {                            # $1 = qa .out file
  local out=$1
  local rundir="$(grep -oE '/[^ ]*/tests/output/run-[A-Za-z0-9_-]+' $out | tail -1)"
  if [[ -z $rundir || ! -f $rundir/summary.json ]]; then print -r -- "(no result — run produced no summary)"; return 2; fi
  python3 - "$rundir/summary.json" <<'PY'
import json, sys
t = (json.load(open(sys.argv[1])).get("meta") or {}).get("totals") or {}
p, tg = t.get("passed", 0), t.get("targeted") or t.get("total", 0)
f, carried = t.get("failed", 0), t.get("knownBugs", 0) + t.get("findings", 0)
print(f"{p}/{tg} pass · {f} failed · {carried} carried" if tg else "0 tests started")
# Broken-environment signals: nothing ran, or everything that ran failed.
sys.exit(1 if (tg == 0 or (p == 0 and f > 0)) else 0)
PY
}

# qa output is large; keep it OUT of the progress log — one file per invocation. Echoes the
# result summary. Sets RUN_BROKEN=1 iff this run signals a broken environment (see summarize_run).
run_qa() {                                   # $1=layer  $2=label  $3..=extra qa args
  local layer=$1 label=$2; shift 2
  local out=$LOGDIR/qa-$label.out
  note "    qa $layer $SCOPE_ARGS ($label) → $out"
  local t0=$EPOCHSECONDS
  npm run qa -- --layer $layer $SCOPE_ARGS "$@" >$out 2>&1
  local rc=$? dt=$((EPOCHSECONDS - t0))
  local summary; summary=$(summarize_run $out); local src=$?
  RUN_BROKEN=$(( src == 1 || src == 2 ))
  note "    qa $layer done rc=$rc wall=${dt}s — $summary"
}

# Single-flow run via qa:flow (the --flow scope). Pins the sim; qa:flow infers --platform.
run_flow() {                                 # $1=label  $2=sim
  local label=$1 sim=$2 out=$LOGDIR/qa-$label.out
  note "    qa:flow $FLOW --sim $sim ($label) → $out"
  local t0=$EPOCHSECONDS
  npm run qa:flow -- $FLOW --sim $sim >$out 2>&1
  local rc=$? dt=$((EPOCHSECONDS - t0))
  local summary; summary=$(summarize_run $out); local src=$?
  RUN_BROKEN=$(( src == 1 || src == 2 ))
  note "    qa:flow done rc=$rc wall=${dt}s — $summary"
}

# Run the selected scope for one sim-round. e2e/flow get --sim; headless is host-side. For the
# combined scopes (smoke/all) e2e runs LAST so RUN_BROKEN reflects the e2e (primary) result.
run_scope() {                                # $1=sim  $2=label-base
  local sim=$1 base=$2
  case $SCOPE in
    smoke|all) run_qa headless "$base-headless"; run_qa e2e "$base-e2e" --sim $sim;;
    e2e)       run_qa e2e "$base-e2e" --sim $sim;;
    headless)  run_qa headless "$base-headless";;
    flow)      run_flow "$base-flow" $sim;;
  esac
}

# Integer 1-minute load average (host-side, cheap — sysctl, no guest probing).
_load1() { sysctl -n vm.loadavg | awk '{print int($2)}' }

# Intra-run host-load guard, run before each sim's turn. Returns 0 = proceed, 1 = drop this sim.
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
  # The bench needs API + Metro + the bubble_test qa:server — NOT a booted iOS sim. qa:health
  # includes iOS-sim gates that fail with the sim shut down; gate only on what the bench needs.
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
  if (( PREP )); then
    note "--prep: shutting down stray iOS sims + Android emulators for a clean host"
    xcrun simctl shutdown all >/dev/null 2>&1
    adb devices | awk '/emulator-/{print $1}' | while read s; do adb -s $s emu kill >/dev/null 2>&1; done
  fi
}

# ──────────────────────────── run ────────────────────────────
preflight
note "bench start: log=$LOGDIR"

# Sims that fail to boot are dropped for the REST of the bench. LIVE shrinks as sims die.
typeset -a LIVE; LIVE=($SIMS)
abandoned=""

for round in {1..$ROUNDS}; do
  [[ -n $abandoned ]] && break
  note "================= round $round / $ROUNDS ================="
  (( ${#LIVE} )) || { note "no live sims left — stopping"; break; }
  for sim in $LIVE; do
    note "----- $sim : round $round -----"
    if ! load_guard $sim; then
      DEAD_SIMS+=($sim); LIVE=(${LIVE:#$sim}); continue
    fi
    plat=$(python3 $MD --kind-of $sim 2>/dev/null) || plat="?"
    note "  platform=$plat  (per-sim; qa infers --platform from --sim)"
    note "  timed boot (--start:headless → history)"
    if ! python3 $MD --start:headless $sim >$LOGDIR/warmup-$sim-r$round.out 2>&1; then
      note "  ✗✗ $sim FAILED TO BOOT — DROPPING it from all remaining rounds"
      note "      (see $LOGDIR/warmup-$sim-r$round.out)"
      DEAD_SIMS+=($sim); LIVE=(${LIVE:#$sim}); continue
    fi

    run_scope $sim "$sim-r$round"

    if (( RUN_BROKEN )); then
      BROKEN_RUNS+=1
      note "  ⚠️  broken-environment run — 0% pass / 0 tests / no result ($BROKEN_RUNS / $ABORT_AFTER before abandon)"
      if (( BROKEN_RUNS >= ABORT_AFTER )); then
        abandoned="$BROKEN_RUNS runs signaled a broken test environment (0% pass, 0 tests started, or "
        abandoned+="no result) — the environment is broken (DB/API/Metro/AVDs), not just the subject; "
        abandoned+="continuing would burn hours producing no usable signal"
        note "  🛑 ABANDONING BENCH: $abandoned"
        python3 $MD --kill $sim >/dev/null 2>&1
        break
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
