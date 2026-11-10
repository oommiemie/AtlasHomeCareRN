import { Animated, View } from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LivingGradient } from "./LivingGradient";
import { CANVAS } from "../theme/tokens";

/**
 * Keeps the clock clear of what scrolls under it, on the tab pages.
 *
 * Those pages have no header in flow: their cards run on up behind the status
 * bar, and the clock ended up written across somebody's name. So a strip of
 * the page's own background is laid over the top, and dissolves along its
 * lower edge. Cut from the same gradient at the same height, it is the same
 * pixels as the ground around it, and at rest it cannot be seen.
 *
 * It sits over the list and under the glass, and has no glass in it, because a
 * mask over the material stops the material drawing (see `HeaderFade`, which
 * is why that is not used on these pages: they have glass among their cards).
 */
export function StatusVeil({
  ground,
  canvas,
  title = 0,
}: {
  /** The height the page gives its `LivingGradient`. */
  ground: number;
  /**
   * How far below the status bar a title is held still, where the page has
   * one over its list: the strip covers it too, and is gone by where the
   * list starts, so nothing at rest is touched.
   */
  title?: number;
  /**
   * 0 to 1, how far the page's canvas has come up under the clock — for a page
   * whose canvas scrolls up over its gradient, where a blue strip would be the
   * wrong colour by then.
   */
  canvas?: Animated.AnimatedInterpolation<number>;
}) {
  const { top } = useSafeAreaInsets();
  // No status bar to keep clear: a browser, or a window without one.
  if (top <= 0) return null;

  const height = top + (title > 0 ? title : 34);
  // Where it stops being solid: the clock's foot, or the title's.
  const solid = title > 0 ? top + title - 18 : top - 4;
  return (
    <MaskedView
      pointerEvents="none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, height }}
      maskElement={
        <LinearGradient
          colors={[
            "#000000",
            "#000000",
            "rgba(0,0,0,0.72)",
            "rgba(0,0,0,0.3)",
            "transparent",
          ]}
          locations={[
            0,
            solid / height,
            (solid + (height - solid) * 0.3) / height,
            (solid + (height - solid) * 0.65) / height,
            1,
          ]}
          style={{ flex: 1 }}
        />
      }
    >
      <View style={{ height, overflow: "hidden" }}>
        <LivingGradient height={ground} />
        {canvas != null && (
          <Animated.View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: CANVAS,
              opacity: canvas,
            }}
          />
        )}
      </View>
    </MaskedView>
  );
}
