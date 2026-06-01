#!/usr/bin/env bash
# check-secrets.sh — BUILD GATE for required client secrets.
#
# Fails the build if any required EXPO_PUBLIC_* var is missing, so a misconfigured
# build breaks HERE (at build time) instead of producing a binary that throws at
# startup on a user's device (the requireEnv() calls in src/config are the runtime
# backstop; this is the earlier, friendlier failure).
#
# Runs in two contexts:
#   - EAS Build:    via the `eas-build-pre-install` npm hook. Values come from the
#                   EAS build environment (eas.json `env` + EAS env vars/secrets).
#   - Local builds: via `preandroid` / `preios`. Values come from the process env,
#                   or, if unset there, from mobile/.env.
#
# It never prints secret VALUES — only names and present/missing status.
#
# Keep REQUIRED in sync with the requireEnv() calls in:
#   mobile/src/config/api.ts, mobile/src/constants/cometchat.ts
# See docs/SECRETS_MANAGEMENT.md.
set -uo pipefail

REQUIRED=(
  EXPO_PUBLIC_API_URL
  EXPO_PUBLIC_GOOGLE_PLACES_API_KEY
  EXPO_PUBLIC_COMETCHAT_APP_ID
)

# mobile/.env lives one level up from this script (mobile/scripts/).
ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"

env_file_val() {  # $1=name -> value from mobile/.env, or empty
  [ -f "$ENV_FILE" ] || return 0
  grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-
}

missing=()
for name in "${REQUIRED[@]}"; do
  val="${!name:-}"                                  # process env first (EAS sets these)
  [ -z "$val" ] && val="$(env_file_val "$name")"    # fall back to mobile/.env (local dev)
  [ -z "$val" ] && missing+=("$name")
done

if [ "${#missing[@]}" -gt 0 ]; then
  {
    echo ""
    echo "❌ check-secrets: required client env var(s) missing:"
    for m in "${missing[@]}"; do echo "     - $m"; done
    cat <<'EOF'

These EXPO_PUBLIC_* vars are inlined into the app bundle and are required at build
time. Set them where this build runs:
  - Replit:    Tools -> Secrets (sensitive) or the .replit [env] block (non-secret ids)
  - EAS Build: eas.json `env`, or `eas env:create` (legacy: `eas secret:create`)
  - Local dev: mobile/.env  (copy from mobile/.env.example)

See docs/SECRETS_MANAGEMENT.md -> "Why is my build breaking?"
EOF
  } >&2
  exit 1
fi

echo "✅ check-secrets: all ${#REQUIRED[@]} required client env vars present."
