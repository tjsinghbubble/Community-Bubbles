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
        const block = [
          '',
          MARKER,
          'post_install do |installer|',
          '  installer.pods_project.targets.each do |target|',
          '    target.build_configurations.each do |build_config|',
          "      build_config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'gnu++20'",
          '    end',
          '  end',
          'end',
          '',
        ].join('\n');

        fs.writeFileSync(podfilePath, podfile + block);
        console.log('[withCxx20] Appended gnu++20 language standard to Podfile');
      } else {
        console.log('[withCxx20] Podfile already patched, skipping');
      }

      return config;
    },
  ]);
};
