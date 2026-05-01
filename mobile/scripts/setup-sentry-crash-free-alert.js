#!/usr/bin/env node
/**
 * Creates (or updates) a Sentry metric alert that fires when the production
 * crash-free session rate drops below 95 %.
 *
 * The alert uses Sentry's Sessions dataset and the `crash_free_rate(session)`
 * aggregate — the same metric shown in the "Crash-Free Sessions %" dashboard
 * widget.  Two triggers are configured:
 *
 *   • WARNING  — crash-free rate falls below 97 %  (early heads-up)
 *   • CRITICAL — crash-free rate falls below 95 %  (deploy gate breached)
 *
 * A companion script (`check-sentry-crash-free-rate.js`) can be added as a
 * pre-build CI step to read the live rate and fail the build automatically
 * when the threshold is breached.
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
 *     node mobile/scripts/setup-sentry-crash-free-alert.js
 */

const SENTRY_BASE = 'https://sentry.io/api/0';

const AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const ORG       = process.env.SENTRY_ORG;
const PROJECT   = process.env.SENTRY_PROJECT;

if (!AUTH_TOKEN || !ORG || !PROJECT) {
  console.error(
    'ERROR: Missing required environment variables.\n' +
    'Set SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT before running this script.\n\n' +
    'Example:\n' +
    '  SENTRY_AUTH_TOKEN=sntrys_... SENTRY_ORG=acme SENTRY_PROJECT=mobile-app \\\n' +
    '    node mobile/scripts/setup-sentry-crash-free-alert.js\n\n' +
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
  const project  = projects.find((p) => p.slug === PROJECT);
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
      integrationId:    process.env.SENTRY_SLACK_WORKSPACE_ID,
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

function buildRuleDefinition(actions) {
  return {
    name: 'Crash-Free Session Rate < 95%',
    dataset: 'sessions',
    aggregate: 'crash_free_rate(session)',
    query: '',
    // timeWindow is in minutes — 60 = rolling 1-hour window
    timeWindow: 60,
    // thresholdType 1 = BELOW (alert fires when value drops BELOW the threshold)
    thresholdType: 1,
    resolveThreshold: 97.0,
    triggers: [
      {
        label: 'critical',
        // Fires when crash-free rate drops below 95 % — deploy gate threshold
        alertThreshold: 95.0,
        actions,
      },
      {
        label: 'warning',
        // Early warning at 97 % — team is notified before the deploy gate is hit
        alertThreshold: 97.0,
        actions,
      },
    ],
    projects: [PROJECT],
    environment: 'production',
    owner: null,
    comparisonDelta: null,
  };
}

async function getExistingRules() {
  return sentryRequest('GET', `/organizations/${ORG}/alert-rules/?project=${PROJECT}`);
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
  console.log(`Configuring Sentry Crash-Free Rate alert for org="${ORG}" project="${PROJECT}"...\n`);

  const projectId = await getProjectId();
  console.log(`Validated project "${PROJECT}" (id=${projectId}) in org "${ORG}".\n`);

  const actions       = buildActions();
  const rule          = buildRuleDefinition(actions);
  const existingRules = await getExistingRules();
  const existing      = existingRules.find((r) => r.name === rule.name);

  await upsertRule(rule, existing);

  console.log('\nDone. Active alert rule:');
  console.log('  • Crash-Free Session Rate < 95%');
  console.log('      WARNING  when crash-free rate falls below 97 %');
  console.log('      CRITICAL when crash-free rate falls below 95 %');
  console.log('      Evaluated over a rolling 1-hour window in the production environment.');
  console.log('\nPair this with the pre-deploy check script to block EAS builds automatically:');
  console.log('  node mobile/scripts/check-sentry-crash-free-rate.js');
  console.log('\nView alerts at: https://sentry.io/organizations/' + ORG + '/alerts/');
}

main().catch((err) => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
