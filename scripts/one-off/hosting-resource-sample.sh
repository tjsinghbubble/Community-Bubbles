#!/usr/bin/env bash
# hosting-resource-sample.sh — sample docker container CPU/RAM into a TSV
# while a load test runs. Part of hosting research; not wired into any runner.
#
# Usage: hosting-resource-sample.sh <out.tsv> [interval_seconds]
# Stop with Ctrl-C or kill; samples until killed.

set -euo pipefail
OUT="${1:?usage: hosting-resource-sample.sh <out.tsv> [interval]}"
INTERVAL="${2:-5}"

echo -e "epoch\tcontainer\tcpu_pct\tmem_used\tmem_limit\tnet_io\tblock_io" > "$OUT"
while true; do
  ts=$(date +%s)
  docker stats --no-stream --format '{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}' \
    | rg 'bubble-hosting-research' \
    | while IFS=$'\t' read -r name cpu mem net blk; do
        mem_used="${mem%% /*}"
        mem_limit="${mem##*/ }"
        echo -e "${ts}\t${name}\t${cpu%\%}\t${mem_used}\t${mem_limit}\t${net}\t${blk}" >> "$OUT"
      done
  sleep "$INTERVAL"
done
