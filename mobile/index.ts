// Pre-initialise node-forge before any other module can require it.
// node-forge uses a CommonJS require chain to build its `forge` object
// incrementally (forge.md, forge.pki, etc.). In Hermes the module cache
// can hand out a partially-built object when a sub-module is requested
// mid-initialisation. Requiring the package once here, synchronously,
// populates the cache with the fully-constructed object so every later
// require('node-forge') gets the complete version.
// With inlineRequires enabled this side-effect require (no return value
// stored) stays at module-evaluation time and therefore runs first.
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('node-forge');

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
