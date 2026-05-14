const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# withCxx20-applied';

module.exports = function withCxx20(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      if (!podfile.includes(MARKER)) {
        podfile += `\n${MARKER}\npost_install do |installer|\n  installer.pods_project.targets.each do |target|\n    target.build_configurations.each do |config|\n      config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++20'\n    end\n  end\nend\n`;
        fs.writeFileSync(podfilePath, podfile);
        console.log('[withCxx20] Appended C++20 language standard to Podfile');
      }

      return config;
    },
  ]);
};
