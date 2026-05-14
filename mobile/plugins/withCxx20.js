const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# withCxx20-applied';

const INJECTION = `  ${MARKER}
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
  end`;

module.exports = function withCxx20(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      if (podfile.includes(MARKER)) {
        console.log('[withCxx20] Already patched, skipping.');
        return config;
      }

      const postInstallRegex = /^(post_install do \|installer\|)/m;
      if (postInstallRegex.test(podfile)) {
        podfile = podfile.replace(postInstallRegex, `$1\n${INJECTION}\n`);
        fs.writeFileSync(podfilePath, podfile);
        console.log('[withCxx20] Injected gnu++20 into existing post_install block.');
      } else {
        console.warn('[withCxx20] No post_install block found — appending one.');
        const block = `\n${MARKER}\npost_install do |installer|\n${INJECTION}\nend\n`;
        fs.writeFileSync(podfilePath, podfile + block);
      }

      return config;
    },
  ]);
};
