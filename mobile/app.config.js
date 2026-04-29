const baseConfig = require('./app.json');

const appVersion = baseConfig.expo.version;

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
        release: appVersion,
      },
    ],
  ],
  extra: {
    sentryDsn: process.env.SENTRY_DSN ?? '',
  },
};
