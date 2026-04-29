const baseConfig = require('./app.json');

const appVersion = baseConfig.expo.version;
const buildNumber = process.env.EAS_BUILD_BUILD_NUMBER ?? '';
const releaseSlug = buildNumber ? `${appVersion}+${buildNumber}` : appVersion;

module.exports = {
  ...baseConfig.expo,
  plugins: [
    ...baseConfig.expo.plugins.filter((p) => p !== '@sentry/react-native'),
    [
      '@sentry/react-native/expo',
      {
        organization: process.env.SENTRY_ORG ?? '',
        project: process.env.SENTRY_PROJECT ?? '',
        url: 'https://sentry.io/',
        authToken: process.env.SENTRY_AUTH_TOKEN ?? '',
        release: releaseSlug,
      },
    ],
  ],
  extra: {
    sentryDsn: process.env.SENTRY_DSN ?? '',
  },
};
