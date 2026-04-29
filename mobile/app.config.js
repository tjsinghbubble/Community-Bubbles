const baseConfig = require('./app.json');

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
      },
    ],
  ],
  extra: {
    sentryDsn: process.env.SENTRY_DSN ?? '',
  },
};
