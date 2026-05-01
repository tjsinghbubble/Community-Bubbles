#!/usr/bin/env node
/**
 * Creates (or updates) a Sentry dashboard with three stability widgets:
 *   1. Crash-Free Sessions % — line chart over time
 *   2. Error Volume by Screen — top-N bar chart grouped by `screen` tag
 *   3. Top Errors by User Count — table sorted by affected users
 *
 * Required environment variables:
 *   SENTRY_AUTH_TOKEN  — Internal integration token with org:read + dashboards:write scopes
 *   SENTRY_ORG         — Organisation slug (visible in Sentry Settings → General)
 *   SENTRY_PROJECT     — Project slug (visible in Sentry Settings → Projects)
 *
 * Usage:
 *   SENTRY_AUTH_TOKEN=sntrys_... SENTRY_ORG=my-org SENTRY_PROJECT=my-project \
 *     node mobile/scripts/setup-sentry-dashboard.js
 *
 * The script is idempotent — running it again will update the existing dashboard
 * rather than create a duplicate. The dashboard URL is printed at the end; paste
 * it into mobile/README.md under the "Sentry Dashboard" section.
 */

const SENTRY_BASE = 'https://sentry.io/api/0';
const DASHBOARD_TITLE = 'Bubble — App Stability';

const AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const ORG = process.env.SENTRY_ORG;
const PROJECT = process.env.SENTRY_PROJECT;

if (!AUTH_TOKEN || !ORG || !PROJECT) {
  console.error(
    'ERROR: Missing required environment variables.\n' +
    'Set SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT before running this script.\n\n' +
    'Example:\n' +
    '  SENTRY_AUTH_TOKEN=sntrys_... SENTRY_ORG=acme SENTRY_PROJECT=mobile-app \\\n' +
    '    node mobile/scripts/setup-sentry-dashboard.js\n\n' +
    'Generate an auth token at: https://sentry.io/settings/account/api/auth-tokens/\n' +
    'Required scopes: org:read, dashboards:write'
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

function buildDashboard() {
  return {
    title: DASHBOARD_TITLE,
    widgets: [
      {
        title: 'Crash-Free Sessions %',
        displayType: 'line',
        interval: '1d',
        widgetType: 'release',
        queries: [
          {
            name: 'Crash-Free Sessions',
            fields: ['crash_free_rate(session)'],
            columns: [],
            aggregates: ['crash_free_rate(session)'],
            conditions: `project:${PROJECT}`,
            orderby: '',
          },
        ],
        layout: { x: 0, y: 0, w: 6, h: 2, minH: 2 },
      },
      {
        title: 'Error Volume by Screen',
        displayType: 'top_n',
        interval: '1h',
        widgetType: 'discover',
        queries: [
          {
            name: '',
            fields: ['screen', 'count()'],
            columns: ['screen'],
            aggregates: ['count()'],
            conditions: `project:${PROJECT} event.type:error has:screen`,
            orderby: '-count()',
          },
        ],
        layout: { x: 6, y: 0, w: 6, h: 2, minH: 2 },
      },
      {
        title: 'Top Errors by User Count',
        displayType: 'table',
        interval: '1h',
        widgetType: 'discover',
        queries: [
          {
            name: '',
            fields: ['issue', 'title', 'count_unique(user)', 'count()'],
            columns: ['issue', 'title'],
            aggregates: ['count_unique(user)', 'count()'],
            conditions: `project:${PROJECT} event.type:error`,
            orderby: '-count_unique(user)',
          },
        ],
        layout: { x: 0, y: 2, w: 12, h: 3, minH: 2 },
      },
    ],
  };
}

async function findExistingDashboard() {
  const dashboards = await sentryRequest('GET', `/organizations/${ORG}/dashboards/`);
  return dashboards.find((d) => d.title === DASHBOARD_TITLE);
}

async function main() {
  console.log(`Configuring Sentry dashboard for org="${ORG}" project="${PROJECT}"...\n`);

  const existing = await findExistingDashboard();
  const payload = buildDashboard();

  let dashboard;
  if (existing) {
    console.log(`Dashboard already exists (id=${existing.id}). Updating...`);
    dashboard = await sentryRequest(
      'PUT',
      `/organizations/${ORG}/dashboards/${existing.id}/`,
      payload
    );
    console.log(`\nUpdated dashboard: "${dashboard.title}" (id=${dashboard.id})`);
  } else {
    dashboard = await sentryRequest('POST', `/organizations/${ORG}/dashboards/`, payload);
    console.log(`\nCreated dashboard: "${dashboard.title}" (id=${dashboard.id})`);
  }

  const dashboardUrl = `https://sentry.io/organizations/${ORG}/dashboards/${dashboard.id}/`;
  console.log('\nDashboard URL:');
  console.log(`  ${dashboardUrl}`);
  console.log('\nPaste this URL into mobile/README.md under the "Sentry Dashboard" section.');
  console.log('\nWidgets created:');
  console.log('  1. Crash-Free Sessions % — daily line chart (release dataset)');
  console.log('  2. Error Volume by Screen — top-N chart grouped by screen tag');
  console.log('  3. Top Errors by User Count — table sorted by affected users');
}

main().catch((err) => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
