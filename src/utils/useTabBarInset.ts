import { useContext } from "react";
import { Platform } from "react-native";
import { BottomTabBarHeightContext } from "react-native-bottom-tabs";

import { TAB_BAR_FOOTPRINT } from "../components/IosTabBar";

/**
 * How much bottom padding a scroll view needs to clear the tab bar.
 *
 * The bar is a real `UITabBarController`, so iOS decides its height — and it
 * varies by device, by whether a home indicator is present, and on iOS 26 by
 * the bar's own appearance. Guessing a constant is what put the last card's
 * text behind the labels on the home screen: the guess was 100 plus
 * `insets.bottom`, but a screen hosted inside the native tab controller
 * reports a bottom inset of 0 — the controller has already consumed it — so
 * the padding came up short by the height of the safe area.
 *
 * Returns 0 outside a tab navigator rather than throwing, which is what
 * `useBottomTabBarHeight` does: the pushed screens (house list, resident
 * sheet, accept task) render over the bar, not under it, and must be able to
 * call this unconditionally.
 */
export function useTabBarInset(): number {
  const measured = useContext(BottomTabBarHeightContext);
  // Outside a tab navigator there is no bar to clear.
  if (measured == null) return 0;
  /*
    On Android the bar is our own, and it floats — taken out of the layout
    so the page can pass under it, which also means the navigator measures
    its wrapper at nothing and hands back a zero. The height is the one
    thing about it that is known in advance, so it is stated rather than
    measured.
  */
  if (Platform.OS === "android") return TAB_BAR_FOOTPRINT;
  return measured;
}
