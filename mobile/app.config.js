const baseConfig = require('./app.json');

const appVersion = baseConfig.expo.version;
const buildNumber = process.env.EAS_BUILD_BUILD_NUMBER ?? '';
const releaseSlug = buildNumber ? `${appVersion}+${buildNumber}` : appVersion;

module.exports = {
  ...baseConfig.expo,
  plugins: [
    ...baseConfig.expo.plugins.filter((p) => p !== '@sentry/react-native'),
    './plugins/withCxx20',
  ],
  extra: {
    sentryDsn: process.env.SENTRY_DSN ?? '',
    crashReporterUrl: process.env.CRASH_REPORTER_URL ?? '',
    eas: {
      projectId: '87aa84ba-0626-4ec1-b569-7276843813d9',
    },
    appEnv: process.env.APP_ENV ?? process.env.EAS_BUILD_PROFILE ?? 'development',
    expoSdkVersion: '55',
    cometChatVersion: '4.0.10',
    buildNumber: buildNumber || null,
  },
};
