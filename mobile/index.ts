// Polyfill crypto.getRandomValues FIRST — required by node-forge (used by the
// CometChat SDK). Without this, forge.md is undefined on iOS and the app
// crashes with a white screen before anything renders.
import 'react-native-get-random-values';

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
