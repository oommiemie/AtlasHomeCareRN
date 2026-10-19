import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately.
//
// The app is required rather than imported: on the web (GitHub Pages) Skia's
// CanvasKit has to be loaded before any module that draws with it is even
// evaluated, so the app is brought in only once it has — and a static import
// would evaluate it first.
const start = () => registerRootComponent(require('./App').default);

if (Platform.OS === 'web') {
  const { LoadSkiaWeb } = require('@shopify/react-native-skia/lib/module/web');
  // public/canvaskit.wasm, served under the site's base path.
  const base = process.env.EXPO_BASE_URL ?? '';
  LoadSkiaWeb({ locateFile: (file: string) => `${base}/${file}` }).then(start);
} else {
  start();
}
