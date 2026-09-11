import { requireNativeViewManager } from "expo-modules-core";
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

/** Apple's map marker. Null when the native module is not in this build. */
export const AppleMarkerNative = (() => {
  try {
    return requireNativeViewManager<AppleMarkerProps>("AppleMarker");
  } catch {
    return null;
  }
})();
