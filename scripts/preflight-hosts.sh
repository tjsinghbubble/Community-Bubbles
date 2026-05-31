#!/usr/bin/env bash
# preflight-hosts.sh — fail fast and loudly if the dev hosts the app/build depend on
# are not reachable. Wire into the mobile:build:* / mobile:start npm scripts as a
# pre-step so a misconfigured host produces a clear message instead of a white
# screen + ANR on the device. See docs/dev-hosts.md §6a.
#
# Usage:
#   scripts/preflight-hosts.sh                # checks API + Metro from mobile/.env
#   API_URL=http://localhost:3000 scripts/preflight-hosts.sh
#
# Reads EXPO_PUBLIC_API_URL / METRO_HOST from mobile/.env if not provided in env.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/mobile/.env"

# Load values from mobile/.env without exporting the whole file.
val() { [ -f "$ENV_FILE" ] && grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- || true; }

API_URL="${API_URL:-$(val EXPO_PUBLIC_API_URL)}"
METRO_HOST="${METRO_HOST:-$(val METRO_HOST)}"
METRO_PORT="${METRO_PORT:-8081}"

fail=0

check_http() {  # name url
  local name="$1" url="$2"
  [ -z "$url" ] && { echo "skip: $name (no URL configured)"; return; }
  # --connect-timeout guards against a hanging unreachable host (the failure we hit).
  local code
  code="$(curl -s -o /dev/null -m 6 --connect-timeout 4 -w '%{http_code}' "$url" 2>/dev/null || echo 000)"
  if [ "$code" = "000" ]; then
    echo "FAIL: $name unreachable -> $url"
    echo "      Is the server running? For an Android target, did you run scripts/dev-connect.sh android?"
    fail=1
  else
    echo "ok:   $name -> $url (HTTP $code)"
  fi
}

echo "Preflight: checking dev hosts…"
check_http "API"   "${API_URL%/}/api/config/share-base-url"

# Metro: only meaningful when METRO_HOST resolves to a real address (e.g. localhost
# after dev-connect, or a LAN/dev host). The literal placeholder 'metro_host' is
# skipped unless it is mapped in /etc/hosts.
if [ -n "$METRO_HOST" ] && [ "$METRO_HOST" != "metro_host" ]; then
  check_http "Metro" "http://$METRO_HOST:$METRO_PORT/status"
else
  check_http "Metro" "http://localhost:$METRO_PORT/status"
fi

if [ "$fail" -ne 0 ]; then
  echo "Preflight failed — see docs/dev-hosts.md." >&2
  exit 1
fi
echo "Preflight OK."
