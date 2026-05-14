const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# withCxx20-applied';

const INJECTION = `    ${MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        build_config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'gnu++20'
        build_config.build_settings['OTHER_CPLUSPLUSFLAGS'] = '$(inherited) -std=gnu++20'
      end
    end
    rnd_headers = File.join(installer.sandbox.root, 'ReactNativeDependencies', 'Headers')
    [
      File.join(rnd_headers, 'Public', 'ReactNativeDependencies', 'folly', 'coro'),
      File.join(rnd_headers, 'folly', 'coro'),
    ].each do |dir|
      coroutine_h = File.join(dir, 'Coroutine.h')
      unless File.exist?(coroutine_h)
        FileUtils.mkdir_p(dir)
        File.write(coroutine_h, "#pragma once\\n#if __has_include(<coroutine>)\\n#include <coroutine>\\n#elif __has_include(<experimental/coroutine>)\\n#include <experimental/coroutine>\\n#endif\\n")
        puts "[withCxx20] Created stub: \#{coroutine_h}"
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

      // Match post_install with any leading whitespace
      const postInstallRegex = /^(\s*post_install do \|installer\|)/m;
      if (postInstallRegex.test(podfile)) {
        podfile = podfile.replace(postInstallRegex, `$1\n${INJECTION}\n`);
        fs.writeFileSync(podfilePath, podfile);
        console.log('[withCxx20] Injected Coroutine.h stub + gnu++20 into existing post_install block.');
      } else {
        // Fallback: no post_install found at all
        const block = `\npost_install do |installer|\n${INJECTION}\nend\n`;
        fs.writeFileSync(podfilePath, podfile + block);
        console.log('[withCxx20] Appended new post_install block.');
      }

      return config;
    },
  ]);
};
