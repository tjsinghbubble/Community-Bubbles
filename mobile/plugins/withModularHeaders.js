const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# withModularHeaders-applied';

module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      if (podfile.includes(MARKER)) {
        console.log('[withModularHeaders] Already patched, skipping.');
        return config;
      }

      // Insert use_modular_headers! after the platform line
      podfile = podfile.replace(
        /(platform :ios,[^\n]*\n)/,
        `$1use_modular_headers! ${MARKER}\n`
      );

      fs.writeFileSync(podfilePath, podfile);
      console.log('[withModularHeaders] Injected use_modular_headers! into Podfile.');
      return config;
    },
  ]);
};
