const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so Metro sees changes in root packages.
config.watchFolders = [workspaceRoot];

// Resolve node_modules from mobile/ first, then root/.
// This prevents packages installed in root (e.g. @expo/vector-icons pulled
// in by root's expo-image-picker) from failing to resolve their peers that
// only exist in mobile/node_modules (e.g. react-native-css-interop).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
