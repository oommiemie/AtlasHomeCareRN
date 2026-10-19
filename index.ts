import { registerRootComponent } from 'expo';

import { boot } from './src/boot';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately.
//
// The app is required rather than imported, and started through `boot`: on
// the web, Skia's CanvasKit has to be loaded before any module that draws
// with it is even evaluated (see src/boot.web.ts).
boot(() => registerRootComponent(require('./App').default));
