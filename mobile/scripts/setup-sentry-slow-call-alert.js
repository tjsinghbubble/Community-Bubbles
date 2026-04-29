#!/usr/bin/env node
/**
 * Sets up Sentry alert rules that notify the team when:
 *   1. The Login screen p75 transaction duration exceeds 3 s  (Performance alert)
 *   2. The main feed (ExploreScreen) p75 duration exceeds 3 s  (Performance alert)
 *   3. Slow-API-response warning events exceed 10 in a 5-minute window  (Metric/error alert)
 *
 * Note: API calls are recorded as child spans (op: http.client) on navigation
 * transactions, not as standalone top-level transactions.  Sentry Performance
 * alerts require top-level transactions, so a count-based error-event rule is
 * used for API latency alerting instead of a p95 performance rule.
 *
 * Required environment variables:
 *   SENTRY_AUTH_TOKEN  — Internal integration token with alert:write + project:read scopes
 *   SENTRY_ORG         — Organisation slug (visible in Sentry Settings → General)
 *   SENTRY_PROJECT     — Project slug (visible in Sentry Settings → Projects)
 *
 * Optional (at least one notification channel is required):
 *   SENTRY_ALERT_EMAIL          — Email address for alert notifications
 *   SENTRY_SLACK_WORKSPACE_ID   — Slack integration workspace ID
 *   SENTRY_SLACK_CHANNEL_ID     — Slack channel ID
 *
 * Usage:
 *   SENTRY_AUTH_TOKEN=sntrys_... SENTRY_ORG=my-org SENTRY_PROJECT=my-project \
 *   SENTRY_ALERT_EMAIL=team@example.com \
 *     node mobile/scripts/setup-sentry-slow-call-alert.js
 */

const SENTRY_BASE = 'https://sentry.io/api/0';

const AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const ORG = process.env.SENTRY_ORG;
const PROJECT = process.env.SENTRY_PROJECT;

if (!AUTH_TOKEN || !ORG || !PROJECT) {
  console.error(
    'ERROR: Missing required environment variables.\n' +
    'Set SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT before running this script.\n\n' +
    'Example:\n' +
    '  SENTRY_AUTH_TOKEN=sntrys_... SENTRY_ORG=acme SENTRY_PROJECT=mobile-app \\\n' +
    '    node mobile/scripts/setup-sentry-slow-call-alert.js\n\n' +
    'Generate an auth token at: https://sentry.io/settings/account/api/auth-tokens/\n' +
    'Required scopes: alert:write, project:read'
  );
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json',
};

async function sentryRequest(method, path, body) {
  const res = await fetch(`${SENTRY_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Sentry API ${method} ${path} → ${res.status}: ${text}`);
  }
  return JSON.parse(text);
}

async function getProjectId() {
  const projects = await sentryRequest('GET', `/organizations/${ORG}/projects/`);
  const project = projects.find((p) => p.slug === PROJECT);
  if (!project) {
    const slugs = projects.map((p) => p.slug).join(', ');
    throw new Error(`Project "${PROJECT}" not found in org "${ORG}". Available: ${slugs}`);
  }
  return project.id;
}

function buildActions() {
  const actions = [];

  if (process.env.SENTRY_ALERT_EMAIL) {
    actions.push({
      type: 'email',
      targetType: 'user',
      targetIdentifier: process.env.SENTRY_ALERT_EMAIL,
    });
  }

  if (process.env.SENTRY_SLACK_WORKSPACE_ID && process.env.SENTRY_SLACK_CHANNEL_ID) {
    actions.push({
      type: 'slack',
      targetType: 'specific',
      targetIdentifier: process.env.SENTRY_SLACK_CHANNEL_ID,
      integrationId: process.env.SENTRY_SLACK_WORKSPACE_ID,
    });
  }

  if (actions.length === 0) {
    console.error(
      'ERROR: No notification actions configured.\n' +
      '  At least one notification channel is required so the team receives alerts.\n\n' +
      '  Set one or both of the following:\n' +
      '    SENTRY_ALERT_EMAIL=team@example.com\n' +
      '    SENTRY_SLACK_WORKSPACE_ID=<id>  SENTRY_SLACK_CHANNEL_ID=<id>\n\n' +
      '  Find the Slack integration ID at:\n' +
      '    https://sentry.io/settings/{your-org}/integrations/slack/'
    );
    process.exit(1);
  }

  return actions;
}

function buildRuleDefinitions(actions) {
  return [
    // ── Performance: Login screen p75 ──────────────────────────────────────
    // The reactNavigationIntegration creates a top-level navigation transaction
    // named "Login" each time the Login screen is entered, so p75 of
    // transaction.duration captures the full screen render time.
    {
      name: 'Login Screen P75 > 3s',
      dataset: 'transactions',
      aggregate: 'p75(transaction.duration)',
      query: 'transaction:Login transaction.op:navigation',
      timeWindow: 10,
      thresholdType: 0,
      resolveThreshold: 2000,
      triggers: [
        {
          label: 'critical',
          alertThreshold: 3000,
          actions,
        },
        {
          label: 'warning',
          alertThreshold: 2000,
          actions: [],
        },
      ],
      projects: [PROJECT],
      environment: 'production',
      owner: null,
      comparisonDelta: null,
    },

    // ── Performance: Main feed (ExploreScreen) p75 ─────────────────────────
    // ExploreScreen wraps its initial data fetch in measureScreenLoad(), which
    // records screen_load_ms on the "ExploreList" navigation transaction.
    // The p75 on the transaction itself covers end-to-end render + fetch time.
    {
      name: 'Main Feed (ExploreScreen) P75 > 3s',
      dataset: 'transactions',
      aggregate: 'p75(transaction.duration)',
      query: 'transaction:ExploreList transaction.op:navigation',
      timeWindow: 10,
      thresholdType: 0,
      resolveThreshold: 2000,
      triggers: [
        {
          label: 'critical',
          alertThreshold: 3000,
          actions,
        },
        {
          label: 'warning',
          alertThreshold: 2000,
          actions: [],
        },
      ],
      projects: [PROJECT],
      environment: 'production',
      owner: null,
      comparisonDelta: null,
    },

    // ── Metric (error events): slow API response count ─────────────────────
    // API calls are instrumented as child spans on navigation transactions
    // (op: 'http.client'), not as standalone top-level transactions.
    // Sentry's transaction-level performance alerts therefore cannot directly
    // aggregate p95 per API endpoint.  Instead, every call that exceeds
    // SLOW_CALL_THRESHOLD_MS (2000 ms) emits a warning-level Sentry event
    // tagged alert_type:slow_api_response + endpoint.  This count-based rule
    // fires when a given endpoint produces 10+ slow events in any 5-minute
    // window — equivalent to "consistently slow" API behaviour.
    {
      name: 'API Slow Response Threshold',
      dataset: 'events',
      query: 'alert_type:slow_api_response level:warning',
      aggregate: 'count()',
      timeWindow: 5,
      thresholdType: 0,
      resolveThreshold: 5,
      groupBy: ['endpoint'],
      triggers: [
        {
          label: 'critical',
          alertThreshold: 10,
          actions,
        },
      ],
      projects: [PROJECT],
      environment: 'production',
      owner: null,
      comparisonDelta: null,
    },
  ];
}

async function getExistingRules() {
  const rules = await sentryRequest('GET', `/organizations/${ORG}/alert-rules/?project=${PROJECT}`);
  return rules;
}

async function upsertRule(rule, existing) {
  if (existing) {
    console.log(`  Updating existing rule "${rule.name}" (id=${existing.id})...`);
    const updated = await sentryRequest(
      'PUT',
      `/organizations/${ORG}/alert-rules/${existing.id}/`,
      rule
    );
    console.log(`  ✓ Updated: ${updated.name} (id=${updated.id})`);
  } else {
    console.log(`  Creating rule "${rule.name}"...`);
    const created = await sentryRequest(
      'POST',
      `/organizations/${ORG}/alert-rules/`,
      rule
    );
    console.log(`  ✓ Created: ${created.name} (id=${created.id})`);
  }
}

async function main() {
  console.log(`Configuring Sentry Performance + Metric Alerts for org="${ORG}" project="${PROJECT}"...\n`);

  const projectId = await getProjectId();
  console.log(`Validated project "${PROJECT}" (id=${projectId}) in org "${ORG}".\n`);

  const actions = buildActions();
  const rules = buildRuleDefinitions(actions);
  const existingRules = await getExistingRules();

  for (const rule of rules) {
    const existing = existingRules.find((r) => r.name === rule.name);
    await upsertRule(rule, existing);
  }

  console.log('\nDone. Active alert rules:');
  console.log('  • Login Screen P75 > 3s           — fires when login navigation is consistently slow');
  console.log('  • Main Feed (ExploreScreen) P75 > 3s — fires when the feed loads consistently slowly');
  console.log('  • API Slow Response Threshold       — fires when an endpoint produces 10+ slow calls in 5 min');
  console.log('\nNote: API calls are tracked as child spans on navigation transactions.');
  console.log('      The count-based alert covers "consistently slow" API behaviour.');
  console.log('\nView alerts at: https://sentry.io/organizations/' + ORG + '/alerts/');
}

main().catch((err) => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
