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

// ── Diagnostic: log which file is importing the CometChat SDK at bundle time ──
// Remove this block once the startup crash is fixed.
const _origResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@cometchat/chat-sdk-react-native') {
    console.error(
      '\n[METRO DIAGNOSTIC] @cometchat/chat-sdk-react-native imported by:\n  ' +
      context.originModulePath +
      '\n',
    );
  }
  if (_origResolve) {
    return _origResolve(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Enable inline requires so that all require() calls throughout the bundle are
// evaluated lazily (only when the enclosing function is first called, not at
// module load time). This fixes module initialisation-order issues — most
// notably forge.md being undefined when node-forge sub-modules are accessed
// before the forge object is fully built up during the Hermes cold start.
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
