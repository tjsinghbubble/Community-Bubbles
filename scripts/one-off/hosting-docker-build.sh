#!/usr/bin/env bash
# hosting-docker-build.sh — build the Bubble hosting-research container images.
# Part of the hosting research set (docs/research/Move-from-Replit.md).
# NOT wired into any test runner or CI; run manually.
#
# Usage: scripts/one-off/hosting-docker-build.sh [--no-cache]

set -euo pipefail
cd "$(dirname "$0")/../.."   # Bubble/ project root

echo "==> building bubble-api:research (ubuntu 24.04 + node 20)"
docker build \
  -f scripts/one-off/docker/api.Dockerfile \
  -t bubble-api:research \
  "$@" \
  .

echo "==> pulling postgres:16 and fake-gcs-server"
docker pull postgres:16
docker pull fsouza/fake-gcs-server:latest

echo "==> image sizes"
docker image ls --format 'table {{.Repository}}:{{.Tag}}\t{{.Size}}' \
  | grep -E 'bubble-api|postgres:16|fake-gcs' || true
