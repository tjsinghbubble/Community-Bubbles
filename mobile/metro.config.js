const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// ── Diagnostic: log which files import the crash-related modules ──────────────
// Remove once the startup crash is fixed.
const WATCHED = [
  '@cometchat/chat-sdk-react-native',
  'node-forge',
  '@expo/code-signing-certificates',
];
const seen = new Set();
const _origResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  for (const pkg of WATCHED) {
    if (moduleName === pkg || moduleName.startsWith(pkg + '/')) {
      const key = `${pkg} ← ${context.originModulePath}`;
      if (!seen.has(key)) {
        seen.add(key);
        // Use process.stderr so it appears even when Metro filters stdout
        process.stderr.write(
          `\n[METRO IMPORT] ${pkg}\n  imported by: ${context.originModulePath}\n\n`,
        );
      }
    }
  }
  if (_origResolve) return _origResolve(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

// Enable inline requires to defer all require() calls to first use,
// fixing module initialisation-order issues on Hermes cold start.
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

module.exports = withNativeWind(config, { input: './global.css' });
