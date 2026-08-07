#!/usr/bin/env zsh
# check_summary_schema.zsh — audit tests/output/**/summary.json at scale.
#
# Classifies each summary.json as one of:
#   OK       new schema: { meta:{runId,startedAt,finishedAt,canceled,totals}, gates, results }
#   PLACEHOLDER  new schema but meta.finishedAt == "unknown" (run never finalized)
#   OLD      pre-migration: top-level runId/totals, no .meta  -> run migrate_summary_meta.zsh
#   BROKEN   missing / empty / invalid JSON
#   MALFORMED  valid JSON but neither old nor new shape
#
# Exit status: 0 only if every file is OK or PLACEHOLDER; 1 if any OLD/BROKEN/MALFORMED.
#
# Usage:
#   scripts/check_summary_schema.zsh [FILE_OR_DIR ...]   (default: tests/output/)
#
# Requires: jq.
set -uo pipefail

repo_root=${0:A:h:h}
typeset -a files
if (( $# == 0 )); then
  files=( ${(f)"$(fd -t f '^summary\.json$' "$repo_root/tests/output" 2>/dev/null \
                  || find "$repo_root/tests/output" -name summary.json -type f)"} )
else
  for arg in "$@"; do
    if [[ -d "$arg" ]]; then
      files+=( ${(f)"$(fd -t f '^summary\.json$' "$arg" 2>/dev/null \
                       || find "$arg" -name summary.json -type f)"} )
    else
      files+=( "$arg" )
    fi
  done
fi

typeset -A count
bad=0
for f in $files; do
  cls="MALFORMED"
  if [[ ! -s "$f" ]]; then
    cls="BROKEN"
  elif ! jq -e . "$f" >/dev/null 2>&1; then
    cls="BROKEN"
  elif jq -e '.meta.runId and (.meta.totals != null) and has("gates") and has("results")' \
         "$f" >/dev/null 2>&1; then
    if [[ "$(jq -r '.meta.finishedAt' "$f")" == "unknown" ]]; then
      cls="PLACEHOLDER"
    else
      cls="OK"
    fi
  elif jq -e 'has("runId") and (has("meta")|not)' "$f" >/dev/null 2>&1; then
    cls="OLD"
  fi
  (( count[$cls]++ ))
  if [[ "$cls" != "OK" ]]; then
    print -- "$cls\t$f"
    [[ "$cls" == "OLD" || "$cls" == "BROKEN" || "$cls" == "MALFORMED" ]] && bad=1
  fi
done

print -- "----"
for k in OK PLACEHOLDER OLD BROKEN MALFORMED; do
  (( ${count[$k]:-0} )) && print -- "$k=${count[$k]}"
done
exit $bad
