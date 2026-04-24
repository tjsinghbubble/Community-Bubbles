const baseConfig = require('./app.json');

module.exports = {
  ...baseConfig.expo,
  extra: {
    sentryDsn: process.env.SENTRY_DSN ?? '',
  },
};
