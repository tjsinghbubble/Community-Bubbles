const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withCxx20(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      if (!podfile.includes('CLANG_CXX_LANGUAGE_STANDARD')) {
        podfile = podfile.replace(
          /post_install do \|installer\|/,
          `post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++20'
    end
  end`
        );
        fs.writeFileSync(podfilePath, podfile);
        console.log('[withCxx20] Added C++20 language standard to Podfile');
      }

      return config;
    },
  ]);
};
