const baseConfig = require('./app.json');

const buildNumber = process.env.EAS_BUILD_BUILD_NUMBER ?? '';

module.exports = {
  ...baseConfig.expo,
  plugins: baseConfig.expo.plugins,
  extra: {
    eas: {
      projectId: '87aa84ba-0626-4ec1-b569-7276843813d9',
    },
  },
};
