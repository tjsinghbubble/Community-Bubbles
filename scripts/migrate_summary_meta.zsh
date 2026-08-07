#!/usr/bin/env zsh
# migrate_summary_meta.zsh — convert old-shape tests/output/**/summary.json files
# to the new "meta"-nested schema (in place).
#
#   old: { runId, finishedAt, canceled, cancelReason?, totals, gates, results }
#   new: { meta: { runId, startedAt, finishedAt, canceled, cancelReason?, totals },
#          gates, results }
#
# "startedAt" did not exist in old summaries. We recover it from the sibling
# run-params.json if present, else from the runId stamp (run-<UTC>-<nonce>).
#
# Idempotent: a file that already has .meta is left untouched.
#
# Usage:
#   scripts/migrate_summary_meta.zsh [-n] [FILE_OR_DIR ...]
#     -n        dry-run: print what WOULD change, write nothing.
#     no args   defaults to every summary.json under tests/output/.
#
# Requires: jq.
set -euo pipefail

dry=0
if [[ "${1:-}" == "-n" ]]; then dry=1; shift; fi

repo_root=${0:A:h:h}            # scripts/<this>  -> repo root
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

# Derive an ISO-8601 Zulu timestamp from a run id like run-20260618t064926Z-b3cf20.
runid_to_started() {
  local rid="$1"
  if [[ "$rid" =~ '([0-9]{8})t([0-9]{6})Z' ]]; then
    local d="$match[1]" t="$match[2]"
    print -- "${d[1,4]}-${d[5,6]}-${d[7,8]}T${t[1,2]}:${t[3,4]}:${t[5,6]}Z"
  else
    print -- ""
  fi
}

converted=0 skipped=0 broken=0
for f in $files; do
  [[ -s "$f" ]] || { print -- "BROKEN (empty): $f"; (( broken += 1 )); continue; }
  if ! jq -e . "$f" >/dev/null 2>&1; then
    print -- "BROKEN (invalid JSON): $f"; (( broken += 1 )); continue
  fi
  if jq -e 'has("meta")' "$f" >/dev/null 2>&1; then
    (( skipped += 1 )); continue            # already new-shape
  fi

  rid=$(jq -r '.runId // ""' "$f")
  started=""
  params="${f:h}/run-params.json"
  if [[ -f "$params" ]]; then
    started=$(jq -r '.startedAt // ""' "$params")
  fi
  [[ -z "$started" || "$started" == "null" ]] && started=$(runid_to_started "$rid")

  program='
    {
      meta: ({
        runId:       .runId,
        startedAt:   $started,
        finishedAt:  .finishedAt,
        canceled:    (.canceled // false),
        cancelReason: .cancelReason,
        totals:      (.totals // {})
      } | with_entries(select(.value != null))),
      gates:   .gates,
      results: .results
    }'

  if (( dry )); then
    print -- "WOULD convert: $f  (startedAt=${started:-?})"
  else
    tmp=$(mktemp)
    jq --arg started "$started" "$program" "$f" > "$tmp" && mv "$tmp" "$f"
    print -- "converted: $f  (startedAt=${started:-?})"
    (( converted += 1 ))
  fi
done

print -- "----"
print -- "converted=$converted  already-new=$skipped  broken=$broken  (dry-run=$dry)"
