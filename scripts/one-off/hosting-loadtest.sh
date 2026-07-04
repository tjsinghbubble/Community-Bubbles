#!/usr/bin/env bash
# hosting-loadtest.sh — run one scenario load test against the local experiment
# stack, with resource sampling. Part of hosting research (docs/research/perf-test-plan.md).
# NOT wired into any runner or CI; `npm run qa --all` never runs this.
#
# Usage: hosting-loadtest.sh <scenario> [duration]
#   scenario: zero-growth | low-usage | moderate-usage | fast-usage | insane-usage | headroom
#   duration: k6 duration (default 10m; keep total wall time well under 1h)
#
# Prereqs: stack up (docker compose -f scripts/one-off/docker/compose.yaml up -d),
#          seeded (DATABASE_URL=postgres://bubble:bubble_local_only@127.0.0.1:5433/bubble \
#                    npx tsx scripts/seed-test-data.ts), k6 installed.

set -euo pipefail
cd "$(dirname "$0")/../.."

SCENARIO="${1:?usage: hosting-loadtest.sh <scenario> [duration]}"
DURATION="${2:-10m}"
BASE_URL="${BASE_URL:-http://127.0.0.1:5000}"

RUN_DIR="tmp/hosting-perf/run-${SCENARIO}-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$RUN_DIR"
echo "==> output: $RUN_DIR"

curl -fsS "$BASE_URL/api/v1/ping" > /dev/null || {
  echo "API not reachable at $BASE_URL — is the compose stack up?" >&2; exit 1; }

scripts/one-off/hosting-resource-sample.sh "$RUN_DIR/resources.tsv" 5 &
SAMPLER_PID=$!
trap 'kill "$SAMPLER_PID" 2>/dev/null || true' EXIT

k6 run \
  -e SCENARIO="$SCENARIO" \
  -e BASE_URL="$BASE_URL" \
  -e DURATION="$DURATION" \
  --summary-export "$RUN_DIR/k6-summary.json" \
  scripts/one-off/hosting-loadtest.js \
  | tee "$RUN_DIR/k6-stdout.txt"

kill "$SAMPLER_PID" 2>/dev/null || true
trap - EXIT

scripts/one-off/hosting-egress-report.sh "$RUN_DIR" "$SCENARIO" || true
echo "==> done: $RUN_DIR"
