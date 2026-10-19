/**
 * Starts the app — on iOS and Android, straight away. The web build has its
 * own (boot.web.ts), which loads Skia's CanvasKit first.
 */
export function boot(start: () => void): void {
  start();
}
