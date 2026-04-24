#!/usr/bin/env node
/**
 * Sets up a Sentry Metric Alert rule that fires when slow API response events
 * exceed 10 occurrences in a 5-minute window, grouped by endpoint.
 *
 * Required environment variables:
 *   SENTRY_AUTH_TOKEN  — Internal integration token with alert:write + project:read scopes
 *   SENTRY_ORG         — Organisation slug (visible in Sentry Settings → General)
 *   SENTRY_PROJECT     — Project slug (visible in Sentry Settings → Projects)
 *
 * Optional:
 *   SENTRY_ALERT_EMAIL — Email address for alert notifications (defaults to team email)
 *   SENTRY_SLACK_WORKSPACE_ID — Slack integration workspace ID
 *   SENTRY_SLACK_CHANNEL_ID   — Slack channel ID
 *
 * Usage:
 *   SENTRY_AUTH_TOKEN=sntrys_... SENTRY_ORG=my-org SENTRY_PROJECT=my-project \
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

function buildAlertRule() {
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

  return {
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
    // Note: Sentry's /api/0/organizations/{org}/alert-rules/ endpoint accepts
    // project slugs in the `projects` array. If your Sentry version requires
    // numeric IDs instead, replace PROJECT with the projectId returned by getProjectId().
    owner: null,
    comparisonDelta: null,
  };
}

async function checkExistingRule() {
  const rules = await sentryRequest('GET', `/organizations/${ORG}/alert-rules/?project=${PROJECT}`);
  return rules.find((r) => r.name === 'API Slow Response Threshold');
}

async function main() {
  console.log(`Configuring Sentry Metric Alert for org="${ORG}" project="${PROJECT}"...\n`);

  const projectId = await getProjectId();
  console.log(`Validated project "${PROJECT}" (id=${projectId}) in org "${ORG}".`);

  const existing = await checkExistingRule();
  const rule = buildAlertRule();
  if (existing) {
    console.log(`Alert rule already exists (id=${existing.id}). Updating...`);
    const updated = await sentryRequest(
      'PUT',
      `/organizations/${ORG}/alert-rules/${existing.id}/`,
      rule
    );
    console.log(`\nUpdated alert rule: ${updated.name} (id=${updated.id})`);
  } else {
    const created = await sentryRequest(
      'POST',
      `/organizations/${ORG}/alert-rules/`,
      rule
    );
    console.log(`\nCreated alert rule: ${created.name} (id=${created.id})`);
  }

  console.log('\nDone. The alert will fire when:');
  console.log('  - More than 10 slow API response events occur within 5 minutes');
  console.log('  - Query filter: alert_type:slow_api_response level:warning');
  console.log('  - Environment: production');
  console.log('\nView alerts at: https://sentry.io/organizations/' + ORG + '/alerts/');
}

main().catch((err) => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
