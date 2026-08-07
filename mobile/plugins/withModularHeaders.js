const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# withModularHeaders-applied';

// @react-native-google-signin pulls in AppCheckCore (Swift), which cannot be
// integrated as a static library unless these Obj-C deps generate module maps.
// Scoped :modular_headers on exactly these two pods is the fix verified green
// on a real macOS build (2026-07-03). Do NOT switch back to a global
// use_modular_headers! — that applies to every pod and is a known source of
// unrelated React Native pod breakage, and it was never build-verified.
const SNIPPET = `  pod 'GoogleUtilities', :modular_headers => true ${MARKER}\n  pod 'RecaptchaInterop', :modular_headers => true\n`;

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

      const anchor = /(target '[^']+' do\n(?:  use_expo_modules!\n)?)/;
      if (!anchor.test(podfile)) {
        throw new Error('[withModularHeaders] Could not find target block in Podfile');
      }
      podfile = podfile.replace(anchor, `$1${SNIPPET}`);

      fs.writeFileSync(podfilePath, podfile);
      console.log('[withModularHeaders] Injected :modular_headers pods into Podfile.');
      return config;
    },
  ]);
};
