import { requireNativeViewManager } from "expo-modules-core";
import { Platform } from "react-native";
import type { ViewProps } from "react-native";

export type AppleMarkerProps = ViewProps & {
  /** `#RRGGBB`; MapKit's own red when absent. */
  tint?: string;
  /** A short string on the balloon — an initial, or a number. */
  glyphText?: string;
  /** A bundled image to tint white on the balloon; wins over the symbol. */
  glyphImageUri?: string;
  /** An SF Symbol, used when the bundled image cannot be read. */
  glyphSystemImage?: string;
  /** Selected markers grow, the way they do in Maps. */
  selected?: boolean;
  /** Where in the view the balloon's point sits, from the top. */
  tipY?: number;
};

/**
 * Apple's map marker.
 *
 * Null when the native module is not in this build — and off iOS it never
 * is, because there is only an `ios/` beside this file. The platform check
 * is not belt and braces: `requireNativeViewManager` does not throw on
 * Android, it warns and hands back a view that draws nothing, so without it
 * the caller's fallback is never reached and the pin is simply invisible.
 */
export const AppleMarkerNative = (() => {
  try {
    if (Platform.OS !== "ios") return null;
    return requireNativeViewManager<AppleMarkerProps>("AppleMarker");
  } catch {
    return null;
  }
})();
