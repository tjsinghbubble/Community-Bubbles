const baseConfig = require('./app.json');

const appVersion = baseConfig.expo.version;
const buildNumber = process.env.EAS_BUILD_BUILD_NUMBER ?? '';
const releaseSlug = buildNumber ? `${appVersion}+${buildNumber}` : appVersion;

const sentryOrg = process.env.SENTRY_ORG ?? '';
const sentryProject = process.env.SENTRY_PROJECT ?? '';
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN ?? '';
const sentryEnabled = sentryOrg && sentryProject && sentryAuthToken;

const sentryPlugin = sentryEnabled
  ? [
      [
        '@sentry/react-native/expo',
        {
          organization: sentryOrg,
          project: sentryProject,
          url: 'https://sentry.io/',
          authToken: sentryAuthToken,
          release: releaseSlug,
          dist: buildNumber,
        },
      ],
    ]
  : [];

module.exports = {
  ...baseConfig.expo,
  plugins: [
    ...baseConfig.expo.plugins.filter((p) => p !== '@sentry/react-native'),
    ...sentryPlugin,
  ],
  extra: {
    sentryDsn: process.env.SENTRY_DSN ?? '',
    eas: {
      projectId: '87aa84ba-0626-4ec1-b569-7276843813d9',
    },
  },
};
