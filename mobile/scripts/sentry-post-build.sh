#!/bin/bash
# sentry-post-build.sh
# EAS Build on-success hook: uploads source maps (if present on disk), finalises
# the Sentry release, and records a production deploy.
#
# The @sentry/react-native/expo plugin already uploads source maps during the
# native build step (via the Sentry Gradle plugin / Xcode build phase).  This
# script serves as an explicit belt-and-suspenders upload for any maps that
# remain on disk, then unconditionally finalises the release so that the Sentry
# dashboard shows a clean, finalized entry with an accurate deploy record.
#
# Called by the `eas-build-on-success` npm script (package.json) which EAS
# Build runs automatically after every successful build.

set -euo pipefail

# Only run Sentry steps for production builds.
if [ "${EAS_BUILD_PROFILE:-}" != "production" ]; then
  echo "sentry-post-build: profile is '${EAS_BUILD_PROFILE:-<unset>}', skipping (production only)."
  exit 0
fi

APP_VERSION=$(node -p "require('./app.json').expo.version")
BUILD_NUMBER="${EAS_BUILD_BUILD_NUMBER:-}"
if [ -n "$BUILD_NUMBER" ]; then
  RELEASE_SLUG="${APP_VERSION}+${BUILD_NUMBER}"
else
  RELEASE_SLUG="${APP_VERSION}"
fi
DIST_NUM="${BUILD_NUMBER:-0}"
PLATFORM="${EAS_BUILD_PLATFORM:-}"

echo "sentry-post-build: release=$RELEASE_SLUG  platform=$PLATFORM"

# --------------------------------------------------------------------------
# 1. Source map upload
# --------------------------------------------------------------------------
# Determine the expected source map path based on the EAS build platform.
# These paths are produced by React Native's Metro bundler and the Hermes
# compiler during the native build phase.
if [ "$PLATFORM" = "android" ]; then
  BUNDLE_MAP="android/app/build/generated/sourcemaps/react/release/index.android.bundle.packager.map"
elif [ "$PLATFORM" = "ios" ]; then
  BUNDLE_MAP="ios/main.jsbundle.map"
else
  echo "sentry-post-build: unknown platform '$PLATFORM', skipping source map upload."
  BUNDLE_MAP=""
fi

if [ -n "$BUNDLE_MAP" ]; then
  if [ -f "$BUNDLE_MAP" ]; then
    echo "sentry-post-build: uploading source map: $BUNDLE_MAP"
    npx sentry-cli releases files "$RELEASE_SLUG" upload-sourcemaps \
      "$BUNDLE_MAP" \
      --dist "$DIST_NUM" \
      --url-prefix '~/' \
      --rewrite
    echo "sentry-post-build: source map upload complete."
  else
    # The Sentry Expo plugin (Gradle / Xcode build phase) already uploaded
    # source maps during the native build; the map file is no longer on disk.
    echo "sentry-post-build: source map file not found at '$BUNDLE_MAP'."
    echo "  This is expected when the @sentry/react-native/expo plugin has"
    echo "  already uploaded source maps during the native build phase."
  fi
fi

# --------------------------------------------------------------------------
# 2. Finalise the release
# --------------------------------------------------------------------------
echo "sentry-post-build: finalising release $RELEASE_SLUG"
npx sentry-cli releases finalize "$RELEASE_SLUG"

# --------------------------------------------------------------------------
# 3. Record a production deploy
# --------------------------------------------------------------------------
echo "sentry-post-build: recording production deploy"
npx sentry-cli releases deploys "$RELEASE_SLUG" new -e production \
  || echo "sentry-post-build: deploy record failed (non-fatal)"

echo "sentry-post-build: done."
