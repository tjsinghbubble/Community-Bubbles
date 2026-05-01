# Bubble Mobile App

React Native mobile app for Bubble - local community building platform.

## Prerequisites

- Node.js 18+ installed
- Expo CLI installed globally: `npm install -g expo-cli`
- iOS Simulator (Mac only) or Android Studio (for Android development)
- Expo Go app on your physical device (optional)

## Setup Instructions

### 1. Install Dependencies

```bash
cd mobile
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the `mobile` directory:

```env
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_IP:3000
COMETCHAT_APP_ID=your_app_id
COMETCHAT_REGION=us
COMETCHAT_AUTH_KEY=your_auth_key
SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
```

**Important**: Replace `YOUR_COMPUTER_IP` with your actual local IP address (not localhost) so the mobile app can connect to the backend server.

#### Sentry Dashboard

The team's stability dashboard lives at:

> **[https://sentry.io/organizations/YOUR-ORG/dashboards/1/](https://sentry.io/organizations/YOUR-ORG/dashboards/1/)**
>
> *(Replace `YOUR-ORG` and the dashboard ID with the values printed after running `setup-sentry-dashboard.js` — see below.)*

The dashboard contains three widgets that give an at-a-glance view of app health before each release:

| Widget | What it shows |
|---|---|
| **Crash-Free Sessions %** | Daily line chart of `crash_free_rate(session)` — the % of sessions that did not end in a crash |
| **Error Volume by Screen** | Top-N bar chart of error counts grouped by the `screen` tag so the noisiest screens are immediately visible |
| **Top Errors by User Count** | Table of issues sorted by the number of distinct affected users |

**Creating the dashboard** (one-time setup, run by a team member with Sentry org-admin access):

```bash
SENTRY_AUTH_TOKEN=sntrys_...   \
SENTRY_ORG=your-org-slug       \
SENTRY_PROJECT=your-project-slug \
node mobile/scripts/setup-sentry-dashboard.js
```

Generate an auth token at **Sentry → Settings → Account → API Auth Tokens** with the `org:read` and `dashboards:write` scopes. The script is idempotent and prints the final dashboard URL — paste it above to replace the placeholder.

See `mobile/SENTRY_DASHBOARD_SETUP.md` for full configuration details and a manual-setup guide.

---

#### Crash Reporting (Sentry)

The app uses Sentry to capture and report screen-level crashes to the team. `ScreenErrorBoundary` automatically sends every caught error to Sentry, tagged with the screen context so issues appear grouped in the Sentry dashboard.

To enable crash reporting:

1. Create a project in [Sentry](https://sentry.io) (React Native platform).
2. Copy the **DSN** from your project's *Settings → Client Keys*.
3. Set `SENTRY_DSN` in your `.env` file (see above) or as an environment secret in your CI/CD pipeline.

`app.config.js` reads `SENTRY_DSN` and passes it to the app at build time via `Constants.expoConfig.extra.sentryDsn`. If the variable is not set, Sentry is silently disabled and a warning is printed to the console — all other app functionality is unaffected.

For production builds (EAS Build / standalone), add `SENTRY_DSN` to your EAS secret environment variables so it is baked into the release bundle.

#### Source-map uploads (readable stack traces in production)

Production JS bundles are minified. Without source maps, stack traces in the
Sentry dashboard show obfuscated identifiers (e.g. `t.apply(n,r)`) instead of
the original TypeScript file names and line numbers.

`app.config.js` registers the `@sentry/react-native/expo` Expo config plugin.
This plugin ships inside the `@sentry/react-native` SDK that is already listed
in `package.json` — no extra dependency (e.g. `sentry-expo`, which is
deprecated) is required. During an EAS build the plugin automatically generates
source maps and uploads them to Sentry so every production stack trace links
back to the original source.

**Required EAS secrets** — set once via the CLI or the EAS dashboard
(*eas.expo.dev → Project → Secrets*):

```bash
eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value <token>
eas secret:create --scope project --name SENTRY_ORG      --value <org-slug>
eas secret:create --scope project --name SENTRY_PROJECT  --value <project-slug>
```

| Secret              | Where to find it |
|---------------------|-----------------|
| `SENTRY_AUTH_TOKEN` | Sentry → Settings → Auth Tokens → Create new token (scopes: `project:releases`, `org:read`) |
| `SENTRY_ORG`        | Slug in your Sentry org URL: `https://sentry.io/organizations/<slug>/` |
| `SENTRY_PROJECT`    | Slug shown in Sentry → Projects → *your project* |

No extra build step is needed — source maps are uploaded automatically on every
`eas build --profile production` (and `preview`) run once the secrets are set.

**Verifying the upload:** after a production build, trigger a crash and check
the Sentry dashboard — the stack trace should show original TypeScript file
paths and line numbers.

## Production Builds — Version Bumping

Every production build must carry a unique semver version so that Sentry can create a distinct release slug and accurately track regressions across builds.

### How it works

`mobile/scripts/bump-version.js` increments the **patch** component of the semver version (e.g. `1.0.0 → 1.0.1`) and writes the new value to both `mobile/app.json` (`expo.version`) and `mobile/package.json` (`version`) in one atomic step. `app.config.js` reads `app.json` at build time and passes the version as the Sentry `release` identifier, so the three values always stay in sync.

### Required: use `npm run build:production`

**Do not run `eas build --profile production` directly.** Always use the npm script instead:

```bash
cd mobile
npm run build:production
```

This single command:
1. Bumps the patch version in `app.json` and `package.json`.
2. Stages both files and commits the change (`chore: bump version for production build`).
3. Runs `eas build --profile production`.

Running `eas build` directly skips step 1 and 2, causing multiple builds to share the same Sentry release slug and making crash regression tracking unreliable.

### Manual version bump (without building)

```bash
cd mobile
npm run version:bump
```

### CI/CD notes

If your CI pipeline calls `eas build` directly (e.g. GitHub Actions), add a pre-build step that runs `node scripts/bump-version.js`, then commits the result before calling EAS:

```yaml
- run: node scripts/bump-version.js
- run: git config user.email "ci@example.com" && git config user.name "CI"
- run: git add mobile/app.json mobile/package.json && git commit -m "chore: bump version for production build"
- run: cd mobile && eas build --profile production --non-interactive
```

---

## Release Flow (Required Reading)

All production releases must go through the following sequence. Direct pushes to `main` do **not** trigger a production build — only a properly formatted semver tag does.

```
feature branch → Pull Request → merge to main → tag → EAS build
```

### Step-by-step

1. **Develop on a feature branch** — never commit directly to `main`.
2. **Open a Pull Request** from your branch into `main`. Get it reviewed and approved.
3. **Merge the PR** into `main` via GitHub (squash or merge commit — no force-push).
4. **Tag the commit** on `main` that you want to release, using strict `vMAJOR.MINOR.PATCH` format:
   ```bash
   git checkout main && git pull
   git tag v1.2.3
   git push origin v1.2.3
   ```
5. **GitHub Actions takes over** — the `release-gate` job validates the tag format, then the `build` job syncs the version into `app.json` and runs EAS Build + store submission automatically.

> Pushing to `main` without a tag does **not** trigger a production build. The EAS workflow is tag-only.

---

## Branch Protection Setup (One-Time Admin Step)

To enforce the release flow above, configure branch protection for `main` in GitHub:

1. Go to **GitHub → Repository → Settings → Branches**.
2. Click **Add branch protection rule** and set **Branch name pattern** to `main`.
3. Enable the following options:
   - **Require a pull request before merging** — prevents direct pushes.
     - Enable *Require approvals* (at least 1 reviewer).
   - **Require status checks to pass before merging** — once you have CI checks, list them here.
   - **Do not allow bypassing the above settings** — applies the rule to admins too.
4. Click **Save changes**.

With this in place, the only way to get code into `main` is through a reviewed PR, and the only way to trigger a production EAS build is by pushing a `v*` tag.

---

## CI/CD — Automated Production Builds (GitHub Actions)

The repository includes a GitHub Actions workflow (`.github/workflows/eas-build.yml`) that automatically triggers EAS production builds and store submissions when a release tag (e.g. `v1.2.3`) is pushed.

### What the workflow does

1. **`release-gate` job** — validates that the pushed tag strictly follows `vMAJOR.MINOR.PATCH` semver. If the tag is malformed (e.g. `v1.2`, `release-1.0`, `v1.2.3-beta`), this job fails immediately and the build is aborted.
2. **`build` job** (runs only if `release-gate` passes):
   - Installs Node.js 20 and `npm ci` in the `mobile/` directory.
   - **Syncs the semantic version from the git tag into `app.json`** *(tag-triggered runs only)* — strips the leading `v` from the tag name (e.g. `v1.2.3` → `1.2.3`) and writes it to the `expo.version` field using `jq`. This means you never need to manually edit `app.json` before a release.
   - Installs the EAS CLI via the official `expo/expo-github-action` action.
   - **Runs the crash-free rate health check** — queries the Sentry Sessions API and fails the build if the production crash-free rate is below 95 % (see [Pre-release health check](#pre-release-health-check--crash-free-rate-gate) below).
   - Runs `eas build --profile production --wait --auto-submit` for **iOS**, then **Android**.
     - `--wait` blocks the GitHub Actions runner until the EAS cloud build finishes, so the job does not exit prematurely.
     - `--auto-submit` tells EAS to automatically submit the completed build to the App Store (iOS) or Play Store (Android) immediately after the build succeeds — no separate submit step required.
   - Sentry source maps are uploaded during the EAS build step (handled by the `@sentry/react-native/expo` plugin — no extra step required).

### Pre-release health check — crash-free rate gate

Before the EAS build runs, the workflow executes `mobile/scripts/check-sentry-crash-free-rate.js`.  This script queries the Sentry Sessions API for the last 24 hours of production session data and **fails the build** (exit code 1) if the crash-free rate is below the threshold (default **95 %**).

**Add this step to your GitHub Actions workflow before the EAS build:**

```yaml
- name: Crash-free rate health check
  run: node mobile/scripts/check-sentry-crash-free-rate.js
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG:        ${{ secrets.SENTRY_ORG }}
    SENTRY_PROJECT:    ${{ secrets.SENTRY_PROJECT }}
    # Optional overrides:
    # CRASH_FREE_THRESHOLD: "95"   # minimum acceptable crash-free % (default 95)
    # LOOKBACK_HOURS: "1"          # hours of history to evaluate (default 1, matches alert window)
```

**Run the check locally** (from the repo root) before a manual production build:

```bash
SENTRY_AUTH_TOKEN=sntrys_... SENTRY_ORG=my-org SENTRY_PROJECT=my-project \
  node mobile/scripts/check-sentry-crash-free-rate.js
```

> **Path note:** The GitHub Actions step above uses `node scripts/check-sentry-crash-free-rate.js` (without the `mobile/` prefix) because the job sets `working-directory: mobile`. When running locally from the repository root, use the `mobile/` prefix as shown above.

When the check fails it prints the full session breakdown and a direct link to open Sentry issues so the team can investigate before retrying the build.

**First-time setup** — create the companion Sentry alert rule that also notifies the team via Slack / email when the rate drops:

```bash
SENTRY_AUTH_TOKEN=sntrys_...         \
SENTRY_ORG=your-org-slug             \
SENTRY_PROJECT=your-project-slug     \
SENTRY_ALERT_EMAIL=team@example.com  \
node mobile/scripts/setup-sentry-crash-free-alert.js
```

See `mobile/SENTRY_DASHBOARD_SETUP.md` for full details on both scripts and the alert rule configuration.

### Releasing a new version

```bash
git checkout main && git pull
git tag v1.2.3
git push origin v1.2.3
```

The `expo.buildNumber` (iOS) and `expo.versionCode` (Android) are managed by EAS via `autoIncrement: true` in `eas.json` — only the human-readable semantic version is derived from the tag.

### Required GitHub repository secrets

Go to **GitHub → Repository → Settings → Secrets and variables → Actions** and add the following:

| Secret | Description |
|---|---|
| `EXPO_TOKEN` | Personal access token from [expo.dev](https://expo.dev/accounts/[account]/settings/access-tokens) — used to authenticate EAS CLI |
| `SENTRY_AUTH_TOKEN` | Sentry auth token with `project:releases` and `org:read` scopes |
| `SENTRY_ORG` | Your Sentry organisation slug |
| `SENTRY_PROJECT` | Your Sentry project slug |
| `SENTRY_DSN` | Sentry DSN baked into the release bundle |

### Required EAS secrets (store credentials)

EAS also needs credentials to submit to the App Store and Play Store. Set these once via the EAS dashboard (*eas.expo.dev → Project → Credentials*) or CLI:

- **iOS**: App Store Connect API key (issuer ID, key ID, and `.p8` file). EAS will prompt you the first time you run `eas submit` interactively.
- **Android**: Google Play service account JSON. Upload it in the EAS credentials UI or via `eas credentials`.

Once stored in EAS, these credentials are reused automatically on every CI run — no further manual steps are needed.

### Triggering a release manually

If you need to kick off a build outside the normal push flow, use the `build:production` script so the version is bumped and committed automatically:

```bash
cd mobile
npm run build:production
```

To target both platforms in a single EAS job, you can add `-- --platform all --wait --auto-submit` after bumping and committing the version:

```bash
npm run version:bump
git add app.json package.json && git commit -m "chore: bump version for production build"
eas build --platform all --profile production --wait --auto-submit
```

### Concurrency

The workflow uses a `concurrency` group (`eas-production-<ref>`) so that if two tags are pushed in quick succession, the second build queues rather than cancelling the running one — this prevents accidentally losing a partially completed submission.

#### Sentry Alert Rules

Configure the following alert rules in **Sentry → Alerts → Create Alert** so the team is notified automatically when crashes spike:

**Rule 1 — New issue (immediate notification)**

| Setting | Value |
|---|---|
| Alert type | Issue alert |
| Condition | "A new issue is created" |
| Action | Send a Slack notification to `#bubble-alerts` (or email the on-call address — see destinations below) |
| Environment | `production` |

This fires once the very first time a brand-new crash type is seen, giving the team early warning before the issue accumulates volume.

**Rule 2 — Error volume spike (threshold alert)**

| Setting | Value |
|---|---|
| Alert type | Metric alert — Error rate |
| Metric | Number of errors |
| Threshold | CRITICAL when errors > **50 in 5 minutes**; WARNING when errors > **20 in 5 minutes** |
| Action | Slack `#bubble-alerts` for WARNING; Slack `#bubble-alerts` + email on-call for CRITICAL |
| Environment | `production` |

Adjust the thresholds to match your typical traffic baseline once the app has a few days of production data.

**Rule 3 — Regression (fixed issue re-appears)**

| Setting | Value |
|---|---|
| Alert type | Issue alert |
| Condition | "A previously resolved issue is seen again" (regression) |
| Action | Send a Slack notification to `#bubble-alerts` |
| Environment | `production` |

#### Alert Destinations

> **Action required:** Replace every placeholder below with real values before the rules go live.

| Destination | Details |
|---|---|
| **Slack channel** | `#bubble-alerts` *(rename to match your actual channel)* — connect via *Sentry → Settings → Integrations → Slack* and follow the OAuth flow |
| **On-call email** | `team@yourdomain.com` *(replace with your team's real distribution list)* — add via *Sentry → Settings → Notifications* |
| **PagerDuty** (optional) | Connect via *Sentry → Settings → Integrations → PagerDuty* if 24/7 paging is required for CRITICAL rules |

> **Tip:** To add the Slack integration, a Sentry org admin must visit *Settings → Integrations → Slack* in the Sentry dashboard, click **Add Workspace**, and authorise the target channel. After that, the channel name is available as an action in any alert rule.

#### Verifying alerts end-to-end

After creating the rules in the Sentry dashboard, do a one-time smoke test to confirm delivery:

1. Temporarily lower the metric-alert WARNING threshold to **1 error in 5 minutes**.
2. Trigger a test error from a development build:
   ```ts
   import * as Sentry from '@sentry/react-native';
   Sentry.captureException(new Error('Alert smoke test'));
   ```
3. Confirm the Slack message or email arrives within a few minutes.
4. Restore the threshold to its production value (`20 errors / 5 min` for WARNING).

Record the date of the test and who performed it in the Sentry alert rule description field so the team knows the rules have been validated.

### 3. Start the Backend Server

In the main project directory (not mobile/):

```bash
npm install
npm run dev
```

The backend will run on `http://localhost:3000`

### 4. Start Expo Development Server

In the `mobile/` directory:

```bash
npm start
```

This will open the Expo Developer Tools in your browser.

### 5. Run on Device/Simulator

Choose one of the following options:

#### Option A: iOS Simulator (Mac only)
Press `i` in the terminal or click "Run on iOS simulator" in Expo DevTools

#### Option B: Android Emulator
Press `a` in the terminal or click "Run on Android device/emulator" in Expo DevTools

#### Option C: Physical Device (Easiest)
1. Install Expo Go from App Store (iOS) or Play Store (Android)
2. Scan the QR code shown in the terminal
3. App will load on your device

## Project Structure

```
mobile/
├── src/
│   ├── navigation/       # Navigation setup (Auth & Main flows)
│   ├── screens/          # All screen components
│   │   ├── auth/         # Signup, Interests, Guidelines
│   │   └── main/         # Explore, MyBubbles, Messages
│   ├── services/         # API & CometChat services
│   ├── types/            # TypeScript type definitions
│   ├── constants/        # App constants
│   └── assets/           # Images, fonts, etc.
├── App.tsx               # Root component
└── package.json
```

## Key Features Implemented

✅ Auth Flow (Signup → Interests → Guidelines)
✅ Bottom Tab Navigation
✅ Explore Bubbles Screen
✅ My Bubbles Screen
✅ Messages Screen (placeholder)
✅ CometChat Integration (ready for real-time chat)
✅ API Service (connects to backend)

## Development Notes

### Navigation Flow
- App starts on **Auth Flow** (Signup screen)
- After completing auth, navigates to **Main Flow** (Bottom tabs)
- Bottom tabs: Explore, Upcoming, Bubbles, Messages, Profile

### Styling
- Uses NativeWind (Tailwind CSS for React Native)
- Custom blue gradient theme matching web design
- iOS/Android-style components

### CometChat Integration
- Initialize on app launch
- Create user on signup
- Create group chat when bubble is created
- Join/leave groups when joining/leaving bubbles

## Next Steps

1. **Install dependencies locally**:
   ```bash
   cd mobile && npm install
   ```

2. **Set up environment variables** with your IP and CometChat credentials

3. **Connect backend**: Ensure the Express server is running and accessible from your network

4. **Test on device**: Use Expo Go for quickest testing

5. **Implement remaining features**:
   - Bubble details screen
   - Chat screen with CometChat UI
   - Create bubble flow
   - Image uploads
   - Push notifications

## Troubleshooting

### "Network request failed"
- Check that EXPO_PUBLIC_API_URL points to your computer's IP (not localhost)
- Ensure backend server is running
- Device and computer must be on same network

### CometChat errors
- Verify credentials in `.env`
- Check CometChat dashboard for app status
- Ensure CometChat SDK is properly initialized

### Build errors
- Clear cache: `expo start -c`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Update Expo: `npm install expo@latest`

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [CometChat React Native SDK](https://www.cometchat.com/docs/react-native-chat-sdk/overview)
- [NativeWind](https://www.nativewind.dev/)
