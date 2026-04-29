# Sentry Performance & Alert Setup

This document explains how the app instruments performance data and how to configure Sentry to alert the team when key screens or API calls become consistently slow.

---

## How Performance Is Instrumented

### API calls — `http.client` spans

Every call through `ApiService.request()` (`mobile/src/services/api.service.ts`) is wrapped in a Sentry child span with:

| Span field | Value |
|---|---|
| `op` | `http.client` |
| `description` | `<METHOD> <endpoint>` (e.g. `GET /api/bubbles`) |
| `http.status_code` | HTTP response status |
| `duration_ms` | Wall-clock duration in milliseconds |

These spans attach to the active navigation transaction created by `reactNavigationIntegration`.  Sentry Performance can then compute p75/p95 **per transaction** across all sessions.

Additionally, any call that exceeds **2,000 ms** emits a Sentry `warning` event (dataset: Errors) tagged with `alert_type:slow_api_response` and `endpoint`.  This powers the fallback count-based alert below.

### Screen load — custom `screen_load_ms` measurement

`measureScreenLoad(screenName, asyncWork)` (`mobile/src/utils/crashReporter.ts`) times the data-loading phase of a screen and records the result as a custom measurement (`screen_load_ms`) on the active Sentry transaction.

Currently instrumented screens:

| Screen | Transaction name | Notes |
|---|---|---|
| ExploreScreen (main feed) | `ExploreList` | Initial data fetch only; not re-measured on tab revisits |
| Login | `Login` | Navigation transaction covers this automatically via `reactNavigationIntegration`; API span covers the login call |

### Configuration constant

| File | Constant | Default | Meaning |
|---|---|---|---|
| `mobile/src/services/api.service.ts` | `SLOW_CALL_THRESHOLD_MS` | 2000 ms | Calls longer than this emit a Sentry warning event |

---

## Alert Rules

Three alert rules are created by the setup script:

| Rule name | Dataset | Metric | Threshold | Scope |
|---|---|---|---|---|
| **Login Screen P75 > 3s** | Transactions | `p75(transaction.duration)` | > 3000 ms | `transaction:Login op:navigation` |
| **Main Feed (ExploreScreen) P75 > 3s** | Transactions | `p75(transaction.duration)` | > 3000 ms | `transaction:ExploreList op:navigation` |
| **API Slow Response Threshold** | Errors | `count()` | > 10 events / 5 min | `alert_type:slow_api_response` |

All rules fire notifications to the configured email and/or Slack channel.

> **Why no API p95 Performance alert?**  
> API calls are recorded as **child spans** (op: `http.client`) on the active navigation transaction — not as standalone top-level transactions. Sentry's transaction-level performance alerts aggregate `p75/p95(transaction.duration)` across root transactions only, so filtering by `transaction.op:http.client` would match nothing.  
> The count-based **API Slow Response Threshold** rule closes this gap: every call exceeding 2 s emits a warning event tagged with `alert_type:slow_api_response` and `endpoint`, so the rule fires as soon as a specific endpoint becomes **consistently** slow (≥ 10 events in 5 minutes).

---

## Option A — Automated Setup Script (recommended)

A Node.js script creates or updates all three alert rules via the Sentry REST API.

### Prerequisites

Generate a Sentry **Internal Integration** token at:
> https://sentry.io/settings/{your-org}/developer-settings/

Required token scopes: `alert:write`, `project:read`

### Run the Script

```bash
SENTRY_AUTH_TOKEN=sntrys_...         \
SENTRY_ORG=your-org-slug             \
SENTRY_PROJECT=your-project-slug     \
SENTRY_ALERT_EMAIL=team@example.com  \
node mobile/scripts/setup-sentry-slow-call-alert.js
```

For Slack notifications (instead of or in addition to email):

```bash
SENTRY_AUTH_TOKEN=sntrys_...              \
SENTRY_ORG=your-org-slug                  \
SENTRY_PROJECT=your-project-slug          \
SENTRY_SLACK_WORKSPACE_ID=<integration-id>\
SENTRY_SLACK_CHANNEL_ID=<channel-id>      \
node mobile/scripts/setup-sentry-slow-call-alert.js
```

Find the Slack `integration-id` at **Settings → Integrations → Slack → Configure**.

The script is idempotent — running it again updates existing rules rather than creating duplicates.

---

## Option B — Manual Dashboard Setup

### Performance alert (p75 / p95)

1. Go to **sentry.io** → your project → **Alerts** → **Create Alert**.
2. Choose **Performance** (Transactions dataset).
3. Fill in the form — repeat for each rule:

#### Login Screen P75 > 3s

| Field | Value |
|---|---|
| **Metric** | `p75(transaction.duration)` |
| **Filter** | `transaction:Login transaction.op:navigation` |
| **Environment** | `production` |
| **Time window** | 10 minutes |
| **Critical threshold** | > 3000 ms |
| **Resolve threshold** | ≤ 2000 ms |

#### Main Feed (ExploreScreen) P75 > 3s

| Field | Value |
|---|---|
| **Metric** | `p75(transaction.duration)` |
| **Filter** | `transaction:ExploreList transaction.op:navigation` |
| **Environment** | `production` |
| **Time window** | 10 minutes |
| **Critical threshold** | > 3000 ms |
| **Resolve threshold** | ≤ 2000 ms |

### Count-based (error events) alert for API latency

1. Choose **Metric Alert** (Errors dataset).
2. Fill in:

| Field | Value |
|---|---|
| **Dataset** | Errors |
| **Metric** | `count()` |
| **Filter** | `alert_type:slow_api_response level:warning` |
| **Group by** | `endpoint` |
| **Environment** | `production` |
| **Time window** | 5 minutes |
| **Critical threshold** | > 10 |
| **Resolve threshold** | ≤ 5 |

4. Add your notification target (email / Slack) under **Actions** for each rule.

---

## Verifying the Alerts

1. Temporarily lower `SLOW_CALL_THRESHOLD_MS` to `1` in `api.service.ts` and make a few API calls in the production build — this immediately generates slow-response events.
2. Check **Alerts → Alert History** in Sentry to confirm the rules fire.
3. Restore `SLOW_CALL_THRESHOLD_MS` to `2000`.

For Performance alerts: navigate to **Performance → Transactions** and confirm you can see transactions named `Login`, `ExploreList`, and spans with `op:http.client`.
