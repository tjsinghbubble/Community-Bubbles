# Release Guide

How to build and ship Bubble to the App Store, Play Store, and TestFlight.

---

## Quick start

```bash
# Staging (TestFlight + Play Store Internal) — bumps patch version
./scripts/release.sh --platform all --profile staging --bump patch

# Production (App Store + Play Store) — bumps minor version
./scripts/release.sh --platform all --profile production --bump minor

# Production — pin exact version
./scripts/release.sh --platform all --profile production --version 2.0.0

# iOS staging build only
./scripts/release.sh --platform ios --profile staging --bump patch
```

---

## Script parameters

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `--platform` | `ios`, `android`, `all`, `web` | `all` | What to build |
| `--profile` | `staging`, `production` | `production` | Which EAS build profile |
| `--version` | `x.y.z` | _(current)_ | Exact version to release |
| `--bump` | `major`, `minor`, `patch` | — | Auto-increment current version |

`--version` and `--bump` are mutually exclusive. If neither is given, the version in `mobile/app.json` is used as-is.

---

## What the script does

1. Validates you are on `main` with a clean working tree
2. Pulls latest `main` from origin
3. Reads the current version from `mobile/app.json`
4. Computes the new version (from `--version`, `--bump`, or current)
5. If version changed: updates `app.json`, commits, pushes to `main`
6. **Production**: creates and pushes git tag `v{version}` → triggers CI (see below)
7. **Staging**: runs `eas build` directly on your machine using `EXPO_TOKEN`

**Web** is not built by this script — Replit redeploys automatically whenever `main` is updated.

---

## Production release flow (CI-driven)

Pushing a `v*` tag triggers `.github/workflows/eas-build.yml`:

```
git tag v1.2.3
git push origin v1.2.3
        ↓
eas-build.yml
  1. Validate tag is strict semver (vMAJOR.MINOR.PATCH)
  2. Sentry crash-free rate check — must be ≥ 95%
  3. eas build --platform ios --profile production --auto-submit
  4. eas build --platform android --profile production --auto-submit
  5. Create GitHub Release with grouped changelog
  6. Append entry to CHANGELOG.md and commit to main
```

If the Sentry gate fails, the build step does not run — fix the crash-free rate before retrying.

---

## Staging release flow (local EAS)

Staging builds go to **TestFlight** (iOS) and **Play Store Internal Testing** (Android).

The script runs `eas build --profile testflight-staging --auto-submit` from your machine.

**Pre-requisite:** `EXPO_TOKEN` must be set in your shell:

```bash
export EXPO_TOKEN=<your-token>
./scripts/release.sh --platform all --profile staging --bump patch
```

Get your token from expo.dev → Account Settings → Access Tokens (see [Tokens and Secrets](#tokens-and-secrets) below).

---

## EAS build profiles

Defined in `mobile/eas.json`:

| Profile | Distribution | Destination | When to use |
|---------|-------------|-------------|-------------|
| `development` | Internal | Dev client only | PR draft builds (auto via CI) |
| `preview` | Internal | QR code install | Every PR (auto via CI) |
| `testflight-staging` | Store | TestFlight + Play Internal | Pre-production staging release |
| `production` | Store | App Store + Play Store | Public production release |

---

## Tokens and secrets

### What you need locally to run `scripts/release.sh`

| Token | Required for | Where to get it |
|-------|-------------|-----------------|
| `EXPO_TOKEN` | Staging builds (`--profile staging`) | expo.dev → Account Settings → Access Tokens → Create |
| `gh` CLI authenticated | Version bump commit (git push) | `gh auth login` or set `GH_TOKEN` |

Set once in your shell profile:
```bash
export EXPO_TOKEN=expo_...
```

### GitHub Actions secrets (for production CI)

Navigate to: **github.com → repo → Settings → Secrets and variables → Actions**

| Secret | Required for | Where to get it |
|--------|-------------|-----------------|
| `EXPO_TOKEN` | All EAS builds in CI | expo.dev → Account Settings → Access Tokens |
| `SENTRY_AUTH_TOKEN` | Sentry crash-free gate + source maps | sentry.io → Settings → Auth Tokens |
| `SENTRY_ORG` | Same | Your Sentry organization slug |
| `SENTRY_PROJECT` | Same | Your Sentry project slug |
| `SENTRY_DSN` | EAS build + preview | sentry.io → Project → Settings → Client Keys |
| `ADMIN_PAT` | Branch protection workflows | github.com → Settings → Developer Settings → Personal access tokens (classic), `repo` scope |
| `STAGING_URL` | `staging-e2e.yml` | Your Replit staging URL, e.g. `https://staging.trybubble.io` |
| `PRODUCTION_URL` | `pre-release.yml` | `https://trybubble.io` |

### EAS secrets (build-time mobile values)

These are injected into the binary at build time. Set them once per project:

```bash
cd mobile
eas secret:create --scope project --name EXPO_PUBLIC_COMETCHAT_APP_ID --value "your-value"
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_PLACES_API_KEY --value "your-key"
eas secret:create --scope project --name SENTRY_DSN --value "your-dsn"
eas secret:list
```

### Replit secrets (server runtime)

Set in the Replit sidebar → Secrets → + New secret. Separate values for staging and production deployments.

| Secret | Notes |
|--------|-------|
| `JWT_SECRET` | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `DATABASE_URL` | Provided by Replit PostgreSQL integration |
| `ENCRYPTION_KEY` | 32-byte hex key — generate same as JWT_SECRET |
| `RESEND_API_KEY` | From resend.com → API Keys |
| `COMETCHAT_APP_ID` | CometChat dashboard |
| `COMETCHAT_API_KEY` | CometChat dashboard — server only |
| `SENTRY_DSN` | sentry.io → Project → Client Keys |
| `SHARE_BASE_URL` | `https://trybubble.io` (prod) or staging URL |
| `ALLOWED_ORIGINS` | Comma-separated: `https://trybubble.io,https://staging.trybubble.io` |
| `APPLE_TEAM_ID` | developer.apple.com → Membership → Team ID |
| `ANDROID_SHA256_FINGERPRINT` | `cd mobile && eas credentials --platform android` |

See `docs/TESTING_AND_DEPLOYMENT.md` for the complete secrets inventory and rotation process.

---

## How to get EXPO_TOKEN

1. Log in at **expo.dev**
2. Click your avatar → **Account Settings**
3. Scroll to **Access Tokens** → **Create Token**
4. Name it (e.g. `bubble-release-local`) and copy the value
5. It starts with `expo_` — treat it like a password

This same token value goes into the `EXPO_TOKEN` GitHub Actions secret.

---

## How to get GITHUB_TOKEN (ADMIN_PAT)

The `GITHUB_TOKEN` secret used by the release-notes step is the built-in GitHub Actions token — no setup needed. The `ADMIN_PAT` secret is a separate personal access token for workflows that need to push to protected branches:

1. **github.com** → your profile → **Settings** → **Developer settings**
2. **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**
3. Scopes: check **`repo`** (full control of private repositories)
4. Click **Generate token** — copy the value immediately (shown only once)
5. Add to GitHub Actions: repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret** → name: `ADMIN_PAT`

---

## Pre-release checklist

Before running `--profile production`:

- [ ] All feature PRs merged to `main` and CI green
- [ ] Tested on a physical device via a `preview` or `testflight-staging` build
- [ ] Sentry crash-free rate ≥ 95% for the past 24 hours
- [ ] `EXPO_TOKEN`, `SENTRY_AUTH_TOKEN`, and other CI secrets are set in GitHub
- [ ] App Store / Play Store credentials configured in EAS (run `eas credentials`)
- [ ] `eas.json` submit blocks configured with correct track (`internal` for staging, `production` for production)

---

## Versioning convention

Bubble follows [Semantic Versioning](https://semver.org):

| Bump | When | Example |
|------|------|---------|
| `patch` | Bug fixes, small improvements | `1.2.3 → 1.2.4` |
| `minor` | New features, backward-compatible | `1.2.3 → 1.3.0` |
| `major` | Breaking changes, major redesign | `1.2.3 → 2.0.0` |

The version in `mobile/app.json` is the source of truth. EAS `autoIncrement` handles the iOS build number and Android version code automatically.

---

## Troubleshooting

**"tag v1.2.3 already exists on origin"**  
A release at this version was already pushed. Either delete the tag (`git push origin --delete v1.2.3`) and re-push, or bump to a new version.

**"working directory has uncommitted changes"**  
Commit or stash your changes before running the script.

**"must be on 'main'"**  
`git checkout main && git pull`, then re-run.

**Sentry crash-free rate check fails**  
The production build is blocked until crash-free rate is ≥ 95%. Investigate and fix crashes in the current version before releasing.

**EAS submission fails (iOS)**  
Check that App Store Connect credentials are configured: `cd mobile && eas credentials --platform ios`.

**EAS submission fails (Android)**  
Check Play Store credentials and that the `submit.testflight-staging` block in `eas.json` specifies `"track": "internal"`.
