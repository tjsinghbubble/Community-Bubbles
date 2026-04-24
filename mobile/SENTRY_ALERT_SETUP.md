# Sentry Alert Setup: Consistently Slow API Endpoints

This document explains how to configure Sentry to send automated notifications when a particular API endpoint is consistently slow.

## How It Works

Every API call that takes longer than **2,000 ms** emits a Sentry `captureMessage` event at level `warning` with the following searchable tags:

| Tag | Value |
|---|---|
| `alert_type` | `slow_api_response` |
| `endpoint` | e.g. `/api/bubbles` |
| `method` | e.g. `GET` |

Because each device emits these events independently to Sentry's ingestion pipeline, **Sentry aggregates them globally across all users**. A Sentry **Metric Alert** on event `count()` therefore reflects real cross-user endpoint latency.

### Configuration Constant (in `mobile/src/services/api.service.ts`)

| Constant | Default | Meaning |
|---|---|---|
| `SLOW_CALL_THRESHOLD_MS` | 2000 ms | A call is "slow" if it takes longer than this |

---

## Option A — Automated Setup Script (recommended)

A Node.js script creates (or updates) the Metric Alert rule via Sentry's REST API.

### Prerequisites

Generate a Sentry **Internal Integration** token at:
> https://sentry.io/settings/{your-org}/developer-settings/

Required token scopes: `alert:write`, `project:read`

### Run the Script

```bash
SENTRY_AUTH_TOKEN=sntrys_...  \
SENTRY_ORG=your-org-slug      \
SENTRY_PROJECT=your-project-slug \
SENTRY_ALERT_EMAIL=team@yourapp.com \
node mobile/scripts/setup-sentry-slow-call-alert.js
```

For Slack notifications instead of (or in addition to) email:

```bash
SENTRY_AUTH_TOKEN=sntrys_...  \
SENTRY_ORG=your-org-slug      \
SENTRY_PROJECT=your-project-slug \
SENTRY_SLACK_WORKSPACE_ID=<integration-id> \
SENTRY_SLACK_CHANNEL_ID=<channel-id> \
node mobile/scripts/setup-sentry-slow-call-alert.js
```

Find the Slack `integration-id` at **Settings → Integrations → Slack → Configure**.

The script is idempotent — running it again will update the existing rule rather than create a duplicate.

---

## Option B — Manual Dashboard Setup

1. Go to [sentry.io](https://sentry.io) → your project → **Alerts** → **Create Alert**.
2. Choose **Metric Alert** (not Issues alert).
3. Fill in the form:

| Field | Value |
|---|---|
| **Dataset** | Errors |
| **Metric** | `count()` |
| **Filter** | `alert_type:slow_api_response` |
| **Group by** | `endpoint` |
| **Environment** | `production` |
| **Time window** | 5 minutes |
| **Critical threshold** | > 10 |
| **Resolve threshold** | ≤ 5 |

4. Under **Actions**, add your notification target (email address, Slack channel, or PagerDuty).
5. Name the rule **"API Slow Response Threshold"** and save.

---

## Verifying the Alert

Once the rule is active, you can verify it by:

1. Temporarily lowering `SLOW_CALL_THRESHOLD_MS` to a very small value (e.g., `1`) in `mobile/src/services/api.service.ts` and making a few API calls in the production build — this will generate slow-response events immediately.
2. Checking **Alerts → Alert History** in Sentry to confirm the rule fires.
3. Restoring `SLOW_CALL_THRESHOLD_MS` to `2000`.

Alternatively, use Sentry's **Alert Simulator** (if available in your plan) to test the rule without code changes.
