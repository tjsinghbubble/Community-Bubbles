#!/usr/bin/env zsh
# verify_gpu_args.zsh — report the -gpu mode an Android emulator ACTUALLY launched with.
#
# The whole GPU sweep is only valid if the mode we INTENDED is the mode that was
# INVOKED. The `emulator` wrapper forks a qemu-system child that carries the real argv;
# this script waits a few seconds for that child to exist, prints its full command line,
# extracts the `-gpu <mode>` token, and (optionally) compares it to what we expected.
#
# Run it as a background probe right after starting an emulator:
#   zsh scripts/verify_gpu_args.zsh --avd Small_Phone_copy_JFK --expect lavapipe &
#   zsh scripts/verify_gpu_args.zsh --pid 12345 --expect host --sleep 6
#
# Flags:
#   --avd NAME     match the qemu-system process by `-avd NAME` (boundary-anchored)
#   --pid PID      inspect this exact pid instead of searching
#   --expect MODE  compare the launched mode to MODE (exit 1 on mismatch)
#   --sleep SECS   settle time before probing (default 4)
#
# Exit: 0 = found (and matched --expect if given); 1 = mismatch; 2 = bad args;
#       3 = no emulator process found.
set -u

print_usage() {
  print -r -- "usage: verify_gpu_args.zsh (--avd NAME | --pid PID) [--expect MODE] [--sleep SECS]" >&2
}

SLEEP=4 AVD="" PID="" EXPECT=""
while (( $# )); do
  case "$1" in
    --avd)    AVD="${2:-}";    shift 2 ;;
    --pid)    PID="${2:-}";    shift 2 ;;
    --expect) EXPECT="${2:-}"; shift 2 ;;
    --sleep)  SLEEP="${2:-}";  shift 2 ;;
    -h|--help) print_usage; exit 0 ;;
    *) print -r -- "verify_gpu_args: unknown arg '$1'" >&2; print_usage; exit 2 ;;
  esac
done

if [[ -z "$AVD" && -z "$PID" ]]; then
  print -r -- "verify_gpu_args: need --avd NAME or --pid PID" >&2
  print_usage; exit 2
fi

print -r -- "verify_gpu_args: settling ${SLEEP}s before probing…" >&2
sleep "$SLEEP"

# Resolve target pid(s). Prefer the qemu-system child (it holds the real -gpu argv);
# fall back to the emulator wrapper. Anchor the AVD match so 'Small_Phone' does not also
# match 'Small_Phone_copy_JFK'.
typeset -a pids
if [[ -n "$PID" ]]; then
  pids=("$PID")
else
  pids=(${(f)"$(pgrep -f "qemu-system.*-avd ${AVD}([[:space:]]|\$)" 2>/dev/null)"})
  if (( ${#pids} == 0 )); then
    pids=(${(f)"$(pgrep -f "emulator.*-avd ${AVD}([[:space:]]|\$)" 2>/dev/null)"})
  fi
fi

if (( ${#pids} == 0 )); then
  print -r -- "verify_gpu_args: ❌ no running emulator process for ${AVD:-pid $PID}" >&2
  exit 3
fi

rc=0
for p in $pids; do
  # -ww prevents macOS ps from truncating the command line (and clipping -gpu).
  cmd="$(ps -ww -o command= -p "$p" 2>/dev/null)"
  [[ -z "$cmd" ]] && continue
  print -r -- "── PID $p ──"
  print -r -- "$cmd"
  mode="$(print -r -- "$cmd" | awk '{for(i=1;i<NF;i++) if($i=="-gpu"){print $(i+1); exit}}')"
  if [[ -z "$mode" ]]; then
    print -r -- "  -gpu: (none on command line — emulator used the AVD/auto default)"
  else
    print -r -- "  -gpu: $mode"
  fi
  if [[ -n "$EXPECT" ]]; then
    if [[ "$mode" == "$EXPECT" ]]; then
      print -r -- "  ✅ matches expected '$EXPECT'"
    else
      print -r -- "  ❌ expected '$EXPECT' but launched with '${mode:-<none>}'"
      rc=1
    fi
  fi
done
exit $rc
