const baseConfig = require('./app.json');

const appVersion = baseConfig.expo.version;
const buildNumber = process.env.EAS_BUILD_BUILD_NUMBER ?? '';
const releaseSlug = buildNumber ? `${appVersion}+${buildNumber}` : appVersion;

module.exports = {
  ...baseConfig.expo,
  plugins: [
    ...baseConfig.expo.plugins.filter((p) => p !== '@sentry/react-native'),
  ],
  extra: {
    sentryDsn: process.env.SENTRY_DSN ?? '',
    crashReporterUrl: process.env.CRASH_REPORTER_URL ?? '',
  },
};
