#!/usr/bin/env zsh
# failure_summary.zsh — derive failure-summary.json from a summary.json, keeping
# ONLY the failed tests (status "fail" or "error"). Output is schema-valid against
# the new (meta-nested) summary shape.
#
#   - results: filtered to status in {fail, error}
#   - meta.totals: RECOMPUTED to match the filtered results (so the file stays honest)
#   - meta.derivedFrom: the source runId, for provenance
#   - gates / meta.runId / meta.startedAt / meta.finishedAt / meta.canceled: preserved
#
# Reads either the new (.meta) or old (top-level) input shape; always writes new shape.
#
# Usage:
#   scripts/failure_summary.zsh SUMMARY_JSON [OUT_JSON]
#     OUT_JSON defaults to <dir-of-input>/failure-summary.json
#
# Requires: jq.
set -euo pipefail

src="${1:?usage: failure_summary.zsh SUMMARY_JSON [OUT_JSON]}"
out="${2:-${src:h}/failure-summary.json}"

[[ -s "$src" ]] || { print -- "error: $src is empty or missing" >&2; exit 1; }
jq -e . "$src" >/dev/null 2>&1 || { print -- "error: $src is not valid JSON" >&2; exit 1; }

jq '
  # normalize: pull meta out whether nested (new) or top-level (old)
  (.meta // {runId, startedAt, finishedAt, canceled, cancelReason, totals}) as $m
  | [ .results[] | select(.status == "fail" or .status == "error") ] as $fails
  | {
      meta: ($m + {
        derivedFrom: $m.runId,
        totals: {
          total:     ($fails | length),
          passed:    0,
          failed:    ($fails | map(select(.status=="fail" and (.knownBug|not) and (.expectedFinding|not))) | length),
          knownBugs: ($fails | map(select(.status=="fail" and .knownBug))                                  | length),
          findings:  ($fails | map(select(.status=="fail" and (.knownBug|not) and .expectedFinding))       | length)
        }
      } | with_entries(select(.value != null))),
      gates:   .gates,
      results: $fails
    }
' "$src" > "$out"

print -- "wrote $out  ($(jq '.results|length' "$out") failed tests)"
