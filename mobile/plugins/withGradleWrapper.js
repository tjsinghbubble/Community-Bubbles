const { withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const GRADLE_VERSION = '8.10.2';
const DISTRIBUTION_URL = `https\\://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip`;

module.exports = function withGradleWrapper(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const wrapperPath = path.join(
        config.modRequest.platformProjectRoot,
        'gradle',
        'wrapper',
        'gradle-wrapper.properties'
      );

      if (!fs.existsSync(wrapperPath)) {
        console.warn('[withGradleWrapper] gradle-wrapper.properties not found, skipping.');
        return config;
      }

      let contents = fs.readFileSync(wrapperPath, 'utf8');
      const updated = contents.replace(
        /^distributionUrl=.*$/m,
        `distributionUrl=${DISTRIBUTION_URL}`
      );

      if (updated === contents) {
        console.log(`[withGradleWrapper] Already using Gradle ${GRADLE_VERSION}, no change needed.`);
      } else {
        fs.writeFileSync(wrapperPath, updated, 'utf8');
        console.log(`[withGradleWrapper] Pinned Gradle to ${GRADLE_VERSION} (fixes IBM_SEMERU removal in Gradle 9).`);
      }

      return config;
    },
  ]);
};
