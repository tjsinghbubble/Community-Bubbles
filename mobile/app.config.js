const baseConfig = require('./app.json');

const buildNumber = process.env.EAS_BUILD_BUILD_NUMBER ?? '';

module.exports = {
  ...baseConfig.expo,
  plugins: baseConfig.expo.plugins,
  extra: {
    eas: {
      projectId: '87aa84ba-0626-4ec1-b569-7276843813d9',
    },
    crashReporterUrl: process.env.EXPO_PUBLIC_API_URL ||
      'https://163cfc20-e221-41ad-b2c3-67afe2df4e33-00-15yrg27byh3aa.spock.replit.dev',
  },
};
