#!/usr/bin/env bash
# hosting-db-size.sh — capture DB size/IO metrics from the local experiment stack.
# Part of hosting research; not wired into any runner.
#
# Usage: hosting-db-size.sh [outfile]
set -euo pipefail
cd "$(dirname "$0")/../.."

OUT="${1:-tmp/hosting-perf/db-size-$(date -u +%Y%m%dT%H%M%SZ).txt}"
mkdir -p "$(dirname "$OUT")"

docker exec -i "$(docker ps -qf name=bubble-hosting-research-db)" \
  psql -U bubble -d bubble -P pager=off \
  < scripts/one-off/hosting-db-size.sql | tee "$OUT"

echo "wrote $OUT"
