const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  'react-native-qrcode-svg': path.resolve(__dirname, '..', 'node_modules', 'react-native-qrcode-svg'),
};

module.exports = config;
