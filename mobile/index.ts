// 1. Polyfill crypto.getRandomValues — must be first.
import 'react-native-get-random-values';

// 2. Pre-initialise node-forge before any other module can require it.
//    node-forge uses a CommonJS require chain to build its `forge` object
//    incrementally (forge.md, forge.pki, etc.). In Hermes the module cache
//    can hand out a partially-built object when a sub-module is requested
//    mid-initialisation. Requiring the package once here, synchronously,
//    populates the cache with the fully-constructed object so every later
//    require('node-forge') gets the complete version.
//    With inlineRequires enabled this side-effect require (no return value
//    stored) stays at module-evaluation time and therefore runs first.
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('node-forge');

import { registerRootComponent } from 'expo';
import App from './App';

// Wrap registration so any startup crash logs the full stack before React
// Native's runtime is torn down. The [runtime not ready] error swallows the
// call stack; this surfaces it in the Metro terminal.
try {
  registerRootComponent(App);
} catch (e: any) {
  // eslint-disable-next-line no-console
  console.error('STARTUP CRASH — message:', e?.message);
  // eslint-disable-next-line no-console
  console.error('STARTUP CRASH — stack:\n', e?.stack);
}
