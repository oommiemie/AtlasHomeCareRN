import { requireNativeViewManager } from "expo-modules-core";
import { Platform } from "react-native";
import type { ViewProps } from "react-native";

export type SegmentedControlProps = ViewProps & {
  segments: string[];
  selectedIndex: number;
  onSegmentChange?: (event: { nativeEvent: { index: number } }) => void;
};

/**
 * UIKit's segmented control.
 *
 * Null when the native module is not in this build, which off iOS is always
 * — there is only an `ios/` beside this file. Checked by platform because
 * `requireNativeViewManager` does not throw on Android; it warns and returns
 * a view that draws nothing, and the caller's own tabs never get their turn.
 */
export const SegmentedControlNative = (() => {
  try {
    if (Platform.OS !== "ios") return null;
    return requireNativeViewManager<SegmentedControlProps>("SegmentedControl");
  } catch {
    return null;
  }
})();
