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
        const block = `
${MARKER}
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |build_config|
      build_config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'gnu++20'
      build_config.build_settings['OTHER_CPLUSPLUSFLAGS'] = '$(inherited) -std=gnu++20'
    end
  end
  Dir.glob(File.join(installer.sandbox.root, '**', '*.xcconfig')).each do |xcconfig_path|
    content = File.read(xcconfig_path)
    if content.include?('CLANG_CXX_LANGUAGE_STANDARD')
      content = content.gsub(/CLANG_CXX_LANGUAGE_STANDARD = [^\\n]+/, 'CLANG_CXX_LANGUAGE_STANDARD = gnu++20')
      File.write(xcconfig_path, content)
    end
  end
end
`;
        fs.writeFileSync(podfilePath, podfile + block);
        console.log('[withCxx20] Patched Podfile with gnu++20 (build settings + xcconfigs)');
      }

      return config;
    },
  ]);
};
