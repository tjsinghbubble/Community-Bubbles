# Sentry Dashboard: Bubble App Stability

This document explains how the team's Sentry stability dashboard is structured and how to create or recreate it.

## Dashboard Overview

The **"Bubble — App Stability"** dashboard gives the team a single place to review crash-free session rates, noisy screens, and the highest-impact errors before each release.

| Widget | Dataset | Chart type | Key metric |
|---|---|---|---|
| Crash-Free Sessions % | Release / Sessions | Line (daily) | `crash_free_rate(session)` |
| Error Volume by Screen | Discover (errors) | Top-N bar | `count()` grouped by `screen` tag |
| Top Errors by User Count | Discover (errors) | Table | `count_unique(user)` |

---

## Session Tracking

The React Native SDK is initialised with `autoSessionTracking: true` in
`mobile/src/utils/crashReporter.ts`. This makes the SDK automatically:

- Start a session when the app comes to the foreground.
- End the session when the app backgrounds or the process exits.
- Mark the session as **crashed** if an unhandled error occurs during it.

Sentry uses these session envelopes to compute the **crash-free sessions %** shown
in the first dashboard widget — no additional instrumentation is required.

---

## Option A — Automated Setup Script (recommended)

A Node.js script creates (or updates) the dashboard via Sentry's REST API.

### Prerequisites

Generate a Sentry **auth token** at:
> https://sentry.io/settings/account/api/auth-tokens/

Required token scopes: `org:read`, `dashboards:write`

### Run the Script

```bash
SENTRY_AUTH_TOKEN=sntrys_...     \
SENTRY_ORG=your-org-slug         \
SENTRY_PROJECT=your-project-slug \
node mobile/scripts/setup-sentry-dashboard.js
```

The script is idempotent — running it again updates the existing dashboard instead of
creating a duplicate. It prints the dashboard URL when it finishes; paste that URL into
the `mobile/README.md` "Sentry Dashboard" section.

---

## Option B — Manual Setup

1. In the Sentry web UI, go to **Dashboards → Create Dashboard**.
2. Name the dashboard **"Bubble — App Stability"**.

### Widget 1 — Crash-Free Sessions %

| Field | Value |
|---|---|
| Widget name | Crash-Free Sessions % |
| Dataset | **Releases** |
| Visualisation | Line chart |
| Y-Axis | `crash_free_rate(session)` |
| Time interval | 1 day |
| Filter | *(leave blank or add `project:your-project`)* |

### Widget 2 — Error Volume by Screen

| Field | Value |
|---|---|
| Widget name | Error Volume by Screen |
| Dataset | **Errors** (Discover) |
| Visualisation | Top 5 bars chart |
| Y-Axis | `count()` |
| Group by | `screen` |
| Filter | `event.type:error has:screen` |
| Sort | `count()` descending |

The `screen` tag is set automatically by `ScreenErrorBoundary` and every `reportError`
/ `reportFatalError` call in `mobile/src/utils/crashReporter.ts`.

### Widget 3 — Top Errors by User Count

| Field | Value |
|---|---|
| Widget name | Top Errors by User Count |
| Dataset | **Errors** (Discover) |
| Visualisation | Table |
| Columns | `issue`, `title`, `count_unique(user)`, `count()` |
| Filter | `event.type:error` |
| Sort | `count_unique(user)` descending |

3. Save the dashboard and copy the URL from the browser address bar.
4. Paste the URL into `mobile/README.md` under the **Sentry Dashboard** heading.

---

## Pre-Release Health Check — Crash-Free Rate Gate

Two scripts in `mobile/scripts/` provide an automated stability gate that blocks builds when the crash-free session rate falls below **95 %**.

### `setup-sentry-crash-free-alert.js` — create the Sentry alert rule

Run once (idempotent) to create or update a Sentry metric alert in the `production` environment:

```bash
SENTRY_AUTH_TOKEN=sntrys_...         \
SENTRY_ORG=your-org-slug             \
SENTRY_PROJECT=your-project-slug     \
SENTRY_ALERT_EMAIL=team@example.com  \
node mobile/scripts/setup-sentry-crash-free-alert.js
```

This creates a **Crash-Free Session Rate < 95%** alert rule with two triggers:

| Trigger | Threshold | Effect |
|---|---|---|
| WARNING | crash-free rate < 97 % | Team receives a notification early so issues can be investigated before the 95 % gate is hit |
| CRITICAL | crash-free rate < 95 % | Team receives a notification; the CI gate (below) blocks the build |

The rule evaluates `crash_free_rate(session)` over a rolling **1-hour window** in the `production` environment.

Required token scopes: `alert:write`, `project:read`

### `check-sentry-crash-free-rate.js` — CI gate script

Fetches the live crash-free session rate from the Sentry Sessions API and exits non-zero when the rate is below the threshold, blocking the EAS build.

**Integrate into GitHub Actions** (add before the EAS build steps):

```yaml
- name: Crash-free rate health check
  run: node mobile/scripts/check-sentry-crash-free-rate.js
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG:        ${{ secrets.SENTRY_ORG }}
    SENTRY_PROJECT:    ${{ secrets.SENTRY_PROJECT }}
```

**Run manually** before a local production build:

```bash
SENTRY_AUTH_TOKEN=sntrys_... SENTRY_ORG=my-org SENTRY_PROJECT=my-project \
  node mobile/scripts/check-sentry-crash-free-rate.js
```

Optional environment variables:

| Variable | Default | Description |
|---|---|---|
| `CRASH_FREE_THRESHOLD` | `95` | Minimum acceptable crash-free rate (%) |
| `SENTRY_ENVIRONMENT` | `production` | Sentry environment filter |
| `LOOKBACK_HOURS` | `1` | Hours of session history to evaluate — defaults to 1 h to match the Sentry alert rule's evaluation window |

When the check fails the script prints the session breakdown, the live rate, and a link to open issues in Sentry.  To bypass the gate in an emergency (not recommended), set `CRASH_FREE_THRESHOLD=0`.

---

## Verifying Session Data

After deploying a build with `autoSessionTracking: true`:

1. Open the Sentry project → **Releases** → select the latest release.
2. Confirm **Sessions** and **Crash-free rate** columns are populated.
3. Open the dashboard — the **Crash-Free Sessions %** widget should show data within
   the first hour of the release receiving traffic.

If sessions are not appearing, check that:
- `SENTRY_DSN` is set correctly in the release environment.
- The `environment` passed to `Sentry.init` matches the environment filter on the release.
- The device has network access to Sentry's ingest endpoint.
