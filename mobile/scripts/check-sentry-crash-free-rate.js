#!/usr/bin/env node
/**
 * Pre-release health check — Sentry crash-free session rate gate.
 *
 * Queries the Sentry Sessions API for the crash-free session rate over the
 * past 24 hours in the production environment.  Exits with a non-zero code
 * (blocking the EAS build or CI step) when the rate is below THRESHOLD_PCT.
 *
 * Add this as a step in your GitHub Actions workflow BEFORE the EAS build:
 *
 *   - name: Crash-free rate health check
 *     run: node mobile/scripts/check-sentry-crash-free-rate.js
 *     env:
 *       SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
 *       SENTRY_ORG:        ${{ secrets.SENTRY_ORG }}
 *       SENTRY_PROJECT:    ${{ secrets.SENTRY_PROJECT }}
 *
 * Or call it manually before a local production build:
 *
 *   SENTRY_AUTH_TOKEN=sntrys_... SENTRY_ORG=my-org SENTRY_PROJECT=my-project \
 *     node mobile/scripts/check-sentry-crash-free-rate.js
 *
 * Required environment variables:
 *   SENTRY_AUTH_TOKEN  — Auth token with org:read + project:read scopes
 *   SENTRY_ORG         — Organisation slug
 *   SENTRY_PROJECT     — Project slug
 *
 * Optional:
 *   CRASH_FREE_THRESHOLD  — Minimum acceptable crash-free rate (default: 95)
 *   SENTRY_ENVIRONMENT    — Sentry environment to query  (default: production)
 *   LOOKBACK_HOURS        — Hours of history to query    (default: 1)
 *                           Matches the 1-hour evaluation window of the Sentry
 *                           alert rule created by setup-sentry-crash-free-alert.js,
 *                           so the CI gate reflects the same stability signal.
 */

const SENTRY_BASE = 'https://sentry.io/api/0';

const AUTH_TOKEN  = process.env.SENTRY_AUTH_TOKEN;
const ORG         = process.env.SENTRY_ORG;
const PROJECT     = process.env.SENTRY_PROJECT;
const THRESHOLD   = Number(process.env.CRASH_FREE_THRESHOLD ?? 95);
const ENVIRONMENT = process.env.SENTRY_ENVIRONMENT ?? 'production';
const LOOKBACK_H  = Number(process.env.LOOKBACK_HOURS ?? 1);

if (!AUTH_TOKEN || !ORG || !PROJECT) {
  console.error(
    'ERROR: Missing required environment variables.\n' +
    'Set SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT before running this script.\n\n' +
    'Example:\n' +
    '  SENTRY_AUTH_TOKEN=sntrys_... SENTRY_ORG=acme SENTRY_PROJECT=mobile-app \\\n' +
    '    node mobile/scripts/check-sentry-crash-free-rate.js\n\n' +
    'Generate an auth token at: https://sentry.io/settings/account/api/auth-tokens/\n' +
    'Required scopes: org:read, project:read'
  );
  process.exit(2);
}

if (isNaN(THRESHOLD) || THRESHOLD < 0 || THRESHOLD > 100) {
  console.error(`ERROR: CRASH_FREE_THRESHOLD must be a number between 0 and 100 (got "${process.env.CRASH_FREE_THRESHOLD}").`);
  process.exit(2);
}

async function sentryRequest(path) {
  const res = await fetch(`${SENTRY_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Sentry API GET ${path} → ${res.status}: ${text}`);
  }
  return JSON.parse(text);
}

/**
 * Fetches session stats from the Sentry Sessions API and returns the
 * crash-free session rate as a percentage (0–100).
 *
 * The Sessions API aggregates session counts grouped by `session.status`.
 * We derive crash-free rate as:
 *
 *   crash_free_rate = (1 - crashed_sessions / total_sessions) * 100
 *
 * where total_sessions excludes sessions still in the "started" state
 * (i.e. sessions that have not yet been closed) to avoid undercount bias.
 */
async function fetchCrashFreeRate() {
  // Sentry Sessions API: /api/0/organizations/{org}/sessions/
  // statsPeriod (e.g. "24h") is simpler than explicit start/end for this use-case
  // and matches how the Sentry UI constructs relative-time queries.
  const path = `/organizations/${ORG}/sessions/?` +
    `project=${encodeURIComponent(PROJECT)}` +
    `&environment=${encodeURIComponent(ENVIRONMENT)}` +
    `&field=sum(session)` +
    `&groupBy=session.status` +
    `&statsPeriod=${LOOKBACK_H}h`;

  const data = await sentryRequest(path);

  /*
   * Response shape:
   * {
   *   groups: [
   *     { by: { "session.status": "healthy"  }, totals: { "sum(session)": N } },
   *     { by: { "session.status": "crashed"  }, totals: { "sum(session)": N } },
   *     { by: { "session.status": "errored"  }, totals: { "sum(session)": N } },
   *     { by: { "session.status": "abnormal" }, totals: { "sum(session)": N } },
   *   ]
   * }
   */
  if (!data.groups || !Array.isArray(data.groups)) {
    throw new Error(
      `Unexpected Sentry Sessions API response shape:\n${JSON.stringify(data, null, 2)}`
    );
  }

  const sessionsByStatus = {};
  for (const group of data.groups) {
    const status = group.by?.['session.status'] ?? 'unknown';
    sessionsByStatus[status] = group.totals?.['sum(session)'] ?? 0;
  }

  const crashed  = sessionsByStatus['crashed']  ?? 0;
  const healthy  = sessionsByStatus['healthy']  ?? 0;
  const errored  = sessionsByStatus['errored']  ?? 0;
  const abnormal = sessionsByStatus['abnormal'] ?? 0;

  // "started" sessions are still in-flight and excluded from the denominator
  // to match Sentry's own crash_free_rate calculation.
  const total = healthy + crashed + errored + abnormal;

  if (total === 0) {
    return { rate: null, crashed, total, sessionsByStatus };
  }

  const rate = ((total - crashed) / total) * 100;
  return { rate, crashed, total, sessionsByStatus };
}

async function main() {
  console.log(`Sentry crash-free session rate health check`);
  console.log(`  Org:         ${ORG}`);
  console.log(`  Project:     ${PROJECT}`);
  console.log(`  Environment: ${ENVIRONMENT}`);
  console.log(`  Lookback:    ${LOOKBACK_H} hours`);
  console.log(`  Threshold:   ${THRESHOLD}%\n`);

  const { rate, crashed, total, sessionsByStatus } = await fetchCrashFreeRate();

  console.log('Session breakdown:');
  for (const [status, count] of Object.entries(sessionsByStatus)) {
    console.log(`  ${status.padEnd(10)} ${count}`);
  }
  console.log(`  ${'total'.padEnd(10)} ${total}`);
  console.log();

  if (rate === null) {
    console.warn(
      'WARNING: No closed sessions found in the specified time window.\n' +
      '  This usually means the project has no production traffic yet, or the\n' +
      '  environment / time-window filters returned no data.\n' +
      '  Skipping the crash-free rate gate — verify Sentry session tracking is\n' +
      '  configured correctly (autoSessionTracking: true in Sentry.init).'
    );
    // Exit 0 so a brand-new project is not permanently blocked.
    process.exit(0);
  }

  const displayRate = rate.toFixed(2);
  console.log(`Crash-free session rate: ${displayRate}%  (threshold: ${THRESHOLD}%)`);

  if (rate < THRESHOLD) {
    console.error(
      `\nFAIL: Crash-free rate ${displayRate}% is below the ${THRESHOLD}% threshold.\n` +
      `  ${crashed} out of ${total} sessions crashed in the last ${LOOKBACK_H} hours.\n` +
      '\n  Investigate open issues in Sentry before shipping a new release:\n' +
      `  https://sentry.io/organizations/${ORG}/issues/?project=${PROJECT}&query=is:unresolved\n` +
      '\n  To override this gate (not recommended), set:\n' +
      `    CRASH_FREE_THRESHOLD=0 node mobile/scripts/check-sentry-crash-free-rate.js`
    );
    process.exit(1);
  }

  console.log(`\nPASS: Crash-free rate ${displayRate}% meets the ${THRESHOLD}% threshold.`);
  console.log('  Safe to proceed with the production build.');
}

main().catch((err) => {
  console.error('\nFailed to fetch crash-free rate:', err.message);
  // Exit 2 for infrastructure / API errors (distinct from a threshold failure)
  process.exit(2);
});
