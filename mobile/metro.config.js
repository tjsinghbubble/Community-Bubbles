const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  'react-native-qrcode-svg': path.resolve(__dirname, '..', 'node_modules', 'react-native-qrcode-svg'),
};

// Force ALL React/React-Native imports — from any package, at any depth —
// to resolve to the single copy inside mobile/node_modules.
// This prevents "Invalid hook call / useContext of null" crashes that occur
// when the root-level node_modules contains a different React version.
const mobileReact = path.resolve(projectRoot, 'node_modules/react');
const mobileReactNative = path.resolve(projectRoot, 'node_modules/react-native');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react') {
    return { filePath: path.join(mobileReact, 'index.js'), type: 'sourceFile' };
  }
  if (moduleName.startsWith('react/')) {
    const rest = moduleName.slice('react/'.length);
    return { filePath: path.join(mobileReact, rest + '.js'), type: 'sourceFile' };
  }
  if (moduleName === 'react-native') {
    return { filePath: path.join(mobileReactNative, 'index.js'), type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
