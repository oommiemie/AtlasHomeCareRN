import { requireNativeViewManager } from "expo-modules-core";
import { Platform } from "react-native";
import type { ViewProps } from "react-native";

export type GlassSliderProps = ViewProps & {
  /** The step the thumb sits on, 0 to `steps` - 1. */
  value: number;
  /** How many stops there are. */
  steps: number;
  /** Every step crossed while the finger is down. */
  onSlide?: (event: { nativeEvent: { value: number } }) => void;
  /** The step it came to rest on, when the finger lifts. */
  onSettle?: (event: { nativeEvent: { value: number } }) => void;
};

/**
 * SwiftUI's slider with its tick marks.
 *
 * Null when the native module is not in this build, so callers can fall
 * back rather than crash — the same shape the segmented control uses.
 *
 * Off iOS that is always: there is only an `ios/` beside this file, and
 * `requireNativeViewManager` answers on Android with a view that draws
 * nothing rather than throwing, which would leave the fallback unreached.
 */
export const GlassSliderNative = (() => {
  try {
    if (Platform.OS !== "ios") return null;
    return requireNativeViewManager<GlassSliderProps>("GlassSlider");
  } catch {
    return null;
  }
})();
