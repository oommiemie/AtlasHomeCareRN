import { requireNativeViewManager } from "expo-modules-core";
import type { ViewProps } from "react-native";

export type SegmentedControlProps = ViewProps & {
  segments: string[];
  selectedIndex: number;
  onSegmentChange?: (event: { nativeEvent: { index: number } }) => void;
};

/** UIKit's segmented control. Null when the native module is not in this build. */
export const SegmentedControlNative = (() => {
  try {
    return requireNativeViewManager<SegmentedControlProps>("SegmentedControl");
  } catch {
    return null;
  }
})();
