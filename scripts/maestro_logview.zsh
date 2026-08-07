#!/usr/bin/env zsh
# maestro_logview.zsh — find a Maestro flow's failure time and open lnav with the
# test start..failure window highlighted.
#
# Deliverable 1: failure time, read from internal-maestro-log.log via lnav SQL.
# Deliverable 2: a time-window regex that lnav :highlight uses to colourise every
#                log line whose timestamp falls inside [window_start .. failure_time].
#
# Usage:
#   scripts/maestro_logview.zsh                             # newest run under tests/output/
#   scripts/maestro_logview.zsh <run-dir-or-internal-log>   # open lnav, window highlighted
#   scripts/maestro_logview.zsh [path] --regex              # just print the regex
#   scripts/maestro_logview.zsh [path] --time               # just print start/failure
#
# With no path it defaults to the most recently modified internal-maestro-log.log
# anywhere under <repo>/tests/output/.
#
# lnav :highlight is regex-only (no native "highlight a time range"), so we derive
# a regex that matches the HH:MM:SS prefixes inside the window and feed it to
# :highlight. The window edges come from the same SQL the .lnav script uses.

emulate -L zsh
set -euo pipefail

FMT="$HOME/.lnav/formats/installed/maestro_internal.json"
OUTDIR="${0:A:h:h}/tests/output"   # <repo>/tests/output (scripts/ -> repo root)

# Args: first non-flag = path; a leading --flag means "default path, this mode".
target=""
mode="open"
goto="start"   # where lnav lands in open mode: start (default) or fail (--at-fail)
for a in "$@"; do
  case "$a" in
    --regex|--time) mode="$a" ;;
    --at-fail)      goto=fail ;;
    *)              target="$a" ;;
  esac
done

# Resolve the internal log: explicit file, explicit run dir, or newest under tests/output.
if [[ -n "$target" && -f "$target" ]]; then
  logf="$target"
elif [[ -n "$target" && -d "$target" ]]; then
  logf="$target/internal-maestro-log.log"
else
  # newest (om = mtime, newest first; N = nullglob; . = plain files)
  logs=("$OUTDIR"/**/internal-maestro-log.log(.Nom))
  if (( ${#logs} == 0 )); then
    print -u2 "no internal-maestro-log.log found under $OUTDIR"
    exit 1
  fi
  logf="${logs[1]}"
  [[ "$mode" == open ]] && print -u2 "→ newest run: ${logf#$OUTDIR/}"
fi
if [[ ! -f "$logf" ]]; then
  print -u2 "no internal-maestro-log.log at: $logf"
  exit 1
fi

# Ensure the format is installed (idempotent).
[[ -f "$FMT" ]] && lnav -i "$FMT" >/dev/null 2>&1 || true

# --- Deliverable 1: pull window_start + failure_time as HH:MM:SS via lnav SQL ---
read_times() {
  lnav -n -c ";SELECT \
       strftime('%H:%M:%S', (SELECT min(log_time) FROM maestro_internal_log)) AS s, \
       strftime('%H:%M:%S', coalesce( \
         (SELECT log_time FROM maestro_internal_log WHERE log_level='error' AND log_body LIKE '%CommandFailed%' ORDER BY log_time LIMIT 1), \
         (SELECT log_time FROM maestro_internal_log WHERE log_body LIKE '%FAILED%' ORDER BY log_time DESC LIMIT 1) \
       )) AS f" \
    -c ':write-csv-to -' "$logf" 2>/dev/null | tail -1
}

times="$(read_times)"
start="${times%%,*}"
fail="${times##*,}"

if [[ -z "$start" || -z "$fail" || "$start" == "$fail" && "$start" == "" ]]; then
  print -u2 "could not extract times from $logf"
  exit 1
fi

# --- Deliverable 2: build an inclusive HH:MM:SS-range regex via a numeric-range helper ---
# range_re A B -> regex matching zero-padded 2-digit integers in [A,B] (compact-ish).
# Generated regex is verifiable by eye and run-specific.
window_regex="$(python3 - "$start" "$fail" <<'PY'
import sys
start, end = sys.argv[1], sys.argv[2]
sh,sm,ss = map(int, start.split(':'))
eh,em,es = map(int, end.split(':'))

def secs(h,m,s): return h*3600+m*60+s
S, E = secs(sh,sm,ss), secs(eh,em,es)

def num2(a,b):  # 2-digit ints [a,b] as alternation, e.g. 20..59 -> (?:[2-5]\d) when full-decade-ish; else brute
    a,b=max(0,a),min(99,b)
    if a>b: return None
    # compact when full tens align, else brute (still correct, readable)
    if a%10==0 and b%10==9:
        tens=[str(t) for t in range(a//10,b//10+1)]
        return rf"(?:[{tens[0]}-{tens[-1]}]\d)" if len(tens)>1 else rf"(?:{tens[0]}\d)"
    return "(?:"+"|".join(f"{i:02d}" for i in range(a,b+1))+")"

parts=[]
# walk each minute touched by the window; emit HH:MM:SS-prefix clauses
m=sm+sh*60
endm=em+eh*60
while m<=endm:
    h,mm=divmod(m,60)
    lo = ss if m==sm+sh*60 else 0
    hi = es if m==endm else 59
    sec=num2(lo,hi)
    if sec: parts.append(rf"{h:02d}:{mm:02d}:{sec}")
    m+=1
print("^(?:"+"|".join(parts)+")")
PY
)"

case "$mode" in
  --time)
    print -r -- "window_start=$start  failure_time=$fail  ($logf)"
    ;;
  --regex)
    print -r -- "$window_regex"
    ;;
  *)
    [[ "$goto" == fail ]] && landing="$fail" || landing="$start"
    print -r -- "# auth/flow failure window: $start .. $fail  (landing at $landing)"
    print -r -- "# highlight regex: $window_regex"
    exec lnav \
      -c ":highlight $window_regex" \
      -c ":goto $landing" \
      "$logf"
    ;;
esac
