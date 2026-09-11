import { useContext } from "react";
import { BottomTabBarHeightContext } from "react-native-bottom-tabs";

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
  return useContext(BottomTabBarHeightContext) ?? 0;
}
