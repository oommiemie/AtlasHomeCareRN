/**
 * Starts the app on the web build (GitHub Pages): Skia's CanvasKit has to be
 * loaded before any module that draws with it is evaluated, so the app is
 * started only once it has. A file of its own, so its import of CanvasKit
 * never reaches the iOS and Android bundles, whose runtime has no `fs`.
 */
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";

export function boot(start: () => void): void {
  // public/canvaskit.wasm, served under the site's base path.
  const base = process.env.EXPO_BASE_URL ?? "";
  LoadSkiaWeb({ locateFile: (file: string) => `${base}/${file}` }).then(start);
}
