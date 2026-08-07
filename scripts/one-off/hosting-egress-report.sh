#!/usr/bin/env bash
# hosting-egress-report.sh — derive pricing-calculator inputs from a load-test run.
# Part of hosting research; not wired into any runner.
#
# Usage: hosting-egress-report.sh <run_dir> <scenario>
# Reads <run_dir>/k6-summary.json + resources.tsv, writes <run_dir>/report.tsv:
#   avg bytes/response, measured req/s, p95 latency, peak container CPU/mem,
#   and the scenario's projected monthly egress using the load-model arithmetic.

set -euo pipefail
RUN_DIR="${1:?usage: hosting-egress-report.sh <run_dir> <scenario>}"
SCENARIO="${2:?scenario}"
SUMMARY="$RUN_DIR/k6-summary.json"
[ -f "$SUMMARY" ] || { echo "missing $SUMMARY" >&2; exit 1; }

# scenario params: DAU ATS(min); knobs: 2 sessions/day, 30.4 days/mo
case "$SCENARIO" in
  zero-growth)    DAU=3    ATS=5  ;;
  low-usage)      DAU=10   ATS=8  ;;
  moderate-usage) DAU=50   ATS=12 ;;
  fast-usage)     DAU=100  ATS=15 ;;
  insane-usage)   DAU=1500 ATS=15 ;;
  headroom)       DAU=0    ATS=0  ;;
  *) echo "unknown scenario $SCENARIO" >&2; exit 1 ;;
esac

jq -r --arg scenario "$SCENARIO" --argjson dau "$DAU" --argjson ats "$ATS" '
  (.metrics.http_reqs.count)            as $reqs |
  (.metrics.data_received.count)        as $bytes_in_total |
  ($bytes_in_total / $reqs)             as $avg_resp_bytes |
  (.metrics.http_reqs.rate)             as $achieved_rps |
  (.metrics.http_req_duration["p(95)"]) as $p95 |
  (.metrics.http_req_failed.value // 0) as $fail_rate |
  ($dau * 2 * $ats * 10)                as $req_per_day |
  ($req_per_day * 30.4 * $avg_resp_bytes / 1e9) as $api_egress_gb_mo |
  [
    ["metric","value"],
    ["scenario", $scenario],
    ["http_reqs", ($reqs|tostring)],
    ["achieved_rps", ($achieved_rps*100|round/100|tostring)],
    ["avg_response_bytes", ($avg_resp_bytes|round|tostring)],
    ["p95_ms", ($p95*100|round/100|tostring)],
    ["fail_rate", ($fail_rate*10000|round/10000|tostring)],
    ["model_req_per_day", ($req_per_day|tostring)],
    ["model_api_egress_gb_mo", ($api_egress_gb_mo*1000|round/1000|tostring)]
  ] | .[] | @tsv
' "$SUMMARY" > "$RUN_DIR/report.tsv"

# peak resources per container (cpu_pct is a percentage; mem parsed as-is)
if [ -f "$RUN_DIR/resources.tsv" ]; then
  awk -F'\t' 'NR>1 { if ($3+0 > max[$2]) { max[$2]=$3+0; mem[$2]=$4 } }
    END { for (c in max) printf "peak_cpu_pct[%s]\t%s\npeak_mem[%s]\t%s\n", c, max[c], c, mem[c] }' \
    "$RUN_DIR/resources.tsv" >> "$RUN_DIR/report.tsv"
fi

cat "$RUN_DIR/report.tsv"
