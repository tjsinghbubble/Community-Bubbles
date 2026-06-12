#!/usr/bin/env zsh
# quiet-run.zsh — suspend the CPU-storming media/analysis daemons for the duration of a command,
# then resume them. These run as user agents (gui/$UID owns mediaanalysisd), so SIGSTOP/SIGCONT
# work WITHOUT sudo. A background watcher re-suspends any instance macOS restarts mid-run (its
# health-check relaunches mediaanalysisd a minute or so after a STOP).
#
# Usage:
#   zsh scripts/quiet-run.zsh npm run qa -- --layer e2e
#   DAEMONS="mediaanalysisd photoanalysisd" zsh scripts/quiet-run.zsh <cmd...>
#
# Resumes the daemons on any exit (normal, Ctrl-C, error). Suspending mediaanalysisd also pauses
# Photos/QuickLook visual analysis for the duration — fine for a test run.
emulate -L zsh
setopt pipe_fail

: ${DAEMONS:="mediaanalysisd mediaanalysisd-access photoanalysisd fraudanalysisd"}
daemons=(${=DAEMONS})

suspend_all() {
  local n p
  for n in $daemons; do
    for p in ${(f)"$(pgrep -x $n 2>/dev/null)"}; do kill -STOP $p 2>/dev/null; done
  done
}
resume_all() {
  local n p
  for n in $daemons; do
    for p in ${(f)"$(pgrep -x $n 2>/dev/null)"}; do kill -CONT $p 2>/dev/null; done
  done
}

watcher_pid=""
cleanup() {
  [[ -n $watcher_pid ]] && kill $watcher_pid 2>/dev/null
  resume_all
  print -r -- "[quiet-run] resumed: $daemons" >&2
}
trap cleanup EXIT INT TERM

print -r -- "[quiet-run] suspending: $daemons" >&2
suspend_all
# Keep them down even if macOS relaunches one mid-run.
( while :; do suspend_all; sleep 3; done ) &
watcher_pid=$!

rc=0
if (( $# )); then
  "$@"; rc=$?
else
  print -r -- "[quiet-run] no command given — daemons suspended; press Enter to resume." >&2
  read -r _
fi
exit $rc
