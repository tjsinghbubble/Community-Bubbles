#!/usr/bin/env bash
# Bubble release script
#
# Usage:
#   ./scripts/release.sh --platform <ios|android|all|web> \
#                        [--profile <staging|production>]  \
#                        [--version <x.y.z>]               \
#                        [--bump <major|minor|patch>]
#
# Examples:
#   ./scripts/release.sh --platform all --bump patch
#   ./scripts/release.sh --platform ios --profile staging --bump minor
#   ./scripts/release.sh --platform all --profile production --version 2.0.0
#   ./scripts/release.sh --platform web

set -euo pipefail

PLATFORM="all"
PROFILE="production"
VERSION=""
BUMP=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --platform) PLATFORM="$2"; shift 2 ;;
    --profile)  PROFILE="$2";  shift 2 ;;
    --version)  VERSION="$2";  shift 2 ;;
    --bump)     BUMP="$2";     shift 2 ;;
    -h|--help)
      sed -n '2,10p' "$0" | sed 's/^# //'
      exit 0
      ;;
    *) echo "Error: unknown option '$1'"; exit 1 ;;
  esac
done

# ── validate inputs ──────────────────────────────────────────────────────────

case "$PLATFORM" in
  ios|android|all|web) ;;
  *) echo "Error: --platform must be ios, android, all, or web"; exit 1 ;;
esac

case "$PROFILE" in
  staging|production) ;;
  *) echo "Error: --profile must be staging or production"; exit 1 ;;
esac

if [[ -n "$VERSION" && -n "$BUMP" ]]; then
  echo "Error: --version and --bump are mutually exclusive"
  exit 1
fi

# ── web is Replit-managed ────────────────────────────────────────────────────

if [[ "$PLATFORM" == "web" ]]; then
  echo "Web is automatically deployed by Replit when main is updated."
  echo "Merge your changes to main — the server redeploys automatically."
  exit 0
fi

# ── git state checks ─────────────────────────────────────────────────────────

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" != "main" ]]; then
  echo "Error: must be on 'main' to cut a release (currently on '$BRANCH')"
  echo "  git checkout main && git pull"
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: working directory has uncommitted changes — commit or stash first"
  exit 1
fi

git pull --rebase origin main

# ── version resolution ───────────────────────────────────────────────────────

APP_JSON="mobile/app.json"
CURRENT_VERSION=$(node -p "require('./$APP_JSON').expo.version")

if [[ -n "$BUMP" ]]; then
  IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
  case "$BUMP" in
    major) MAJOR=$((MAJOR+1)); MINOR=0; PATCH=0 ;;
    minor) MINOR=$((MINOR+1)); PATCH=0 ;;
    patch) PATCH=$((PATCH+1)) ;;
    *) echo "Error: --bump must be major, minor, or patch"; exit 1 ;;
  esac
  VERSION="${MAJOR}.${MINOR}.${PATCH}"
elif [[ -z "$VERSION" ]]; then
  VERSION="$CURRENT_VERSION"
fi

if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: '$VERSION' is not valid semver (expected MAJOR.MINOR.PATCH)"
  exit 1
fi

echo "Platform : $PLATFORM"
echo "Profile  : $PROFILE"
echo "Version  : $VERSION (current: $CURRENT_VERSION)"
echo ""

# ── bump app.json if version changed ─────────────────────────────────────────

if [[ "$VERSION" != "$CURRENT_VERSION" ]]; then
  echo "Bumping $APP_JSON: $CURRENT_VERSION → $VERSION"
  node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync('$APP_JSON', 'utf8'));
    data.expo.version = '$VERSION';
    fs.writeFileSync('$APP_JSON', JSON.stringify(data, null, 2) + '\n');
  "
  git add "$APP_JSON"
  git commit -m "chore(release): bump version to $VERSION"
  git push origin main
  echo "Version bump committed and pushed to main."
  echo ""
fi

# ── production: push git tag → GitHub Actions handles the rest ───────────────

if [[ "$PROFILE" == "production" ]]; then
  TAG="v${VERSION}"

  if git ls-remote --tags origin | grep -q "refs/tags/${TAG}$"; then
    echo "Error: tag ${TAG} already exists on origin"
    echo "  Use a different version or delete the tag first: git push origin --delete ${TAG}"
    exit 1
  fi

  git tag "$TAG"
  git push origin "$TAG"

  REPO=$(git remote get-url origin 2>/dev/null \
    | sed 's/.*github\.com[:/]//' \
    | sed 's/\.git$//' || echo "your-org/your-repo")

  echo "Tag ${TAG} pushed."
  echo ""
  echo "GitHub Actions (eas-build.yml) will now:"
  echo "  1. Validate semver tag format"
  echo "  2. Check Sentry crash-free rate (>= 95% required to proceed)"
  echo "  3. Build iOS + Android with EAS profile 'production'"
  echo "  4. Auto-submit to App Store (TestFlight) + Play Store (Production)"
  echo "  5. Create GitHub Release and append entry to CHANGELOG.md"
  echo ""
  echo "  Monitor: https://github.com/${REPO}/actions"

# ── staging: run eas build directly from this machine ────────────────────────

else
  EAS_PROFILE="testflight-staging"

  if [[ -z "${EXPO_TOKEN:-}" ]]; then
    echo "Error: EXPO_TOKEN must be set for staging builds."
    echo ""
    echo "  1. Get your token from: expo.dev → Account Settings → Access Tokens"
    echo "  2. Export it:  export EXPO_TOKEN=<token>"
    echo "  3. Re-run this script."
    exit 1
  fi

  # eas CLI must be available
  if ! command -v eas &>/dev/null; then
    echo "Error: eas CLI not found. Install it with: npm install -g eas-cli"
    exit 1
  fi

  echo "Starting EAS build with profile '$EAS_PROFILE' (TestFlight + Play Store Internal)..."
  echo ""
  cd mobile

  if [[ "$PLATFORM" == "all" ]]; then
    eas build --platform all --profile "$EAS_PROFILE" --non-interactive --auto-submit
  else
    eas build --platform "$PLATFORM" --profile "$EAS_PROFILE" --non-interactive --auto-submit
  fi

  echo ""
  echo "Staging build submitted to EAS."
  echo "  Track progress: https://expo.dev/accounts/[your-account]/projects/bubble-mobile/builds"
  echo "  iOS  → TestFlight (internal testers)"
  echo "  Android → Play Store Internal Testing track"
fi
