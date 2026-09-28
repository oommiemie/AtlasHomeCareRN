import type { ReactNode } from "react";
import { Animated } from "react-native";

import { Glass } from "./Glass";
import { GROUPED_BG, PLATE, SPACE, shadow } from "../theme/tokens";

/**
 * The sheet a map page keeps its list in — the design's `Madal`, in its two
 * states.
 *
 * Resting, it is a floating card: 8pt clear of each edge, 36 round across
 * the top and 58 along the bottom, white at half strength over the glass,
 * with a shadow lifting it off the map. Pulled to full it is the design's
 * `Sheet - Full Screen`: edge to edge, square along the bottom, 38 across
 * the top, and the page's own opaque grey — at that size there is no map
 * left behind it worth refracting.
 *
 * The shadow is drawn by the outer view, not by the glass: the glass clips
 * to its corners, and a view that clips cuts its own shadow away. A
 * shadow takes the shape of the view that casts it, so the outer view has
 * the glass's corners too. The two map pages each drew it and gave only the
 * glass its corners, so the map showed a square shadow standing out past
 * every rounded corner of the card.
 */
export function FloatingSheet({
  expanded,
  height,
  children,
}: {
  /** Pulled to full height. */
  expanded: boolean;
  /** The sheet's height, driven by the page's drag. */
  height: Animated.Value | Animated.AnimatedInterpolation<number>;
  children: ReactNode;
}) {
  const top = expanded ? 38 : 36;
  const bottom = expanded ? 0 : 58;
  const corners = {
    borderTopLeftRadius: top,
    borderTopRightRadius: top,
    borderBottomLeftRadius: bottom,
    borderBottomRightRadius: bottom,
  };

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: expanded ? 0 : SPACE.sm,
        right: expanded ? 0 : SPACE.sm,
        bottom: expanded ? 0 : SPACE.sm,
        height,
        ...corners,
        // The design's blur radii, halved: iOS shadowRadius is about half
        // the figure a design tool reports.
        boxShadow: shadow({
          blur: expanded ? 37 : 16,
          y: expanded ? -6 : 4,
          opacity: 0.12,
        }),
      }}
    >
      <Glass
        // The tint is painted OVER the glass instead of mixed into it, so
        // it stays at the design's half strength while resting — and goes
        // fully opaque at full height. Both are tokens, so the sheet is the
        // page's own grey on a dark ground.
        tintColor={expanded ? GROUPED_BG : PLATE}
        style={{ flex: 1, ...corners, overflow: "hidden" }}
      >
        {children}
      </Glass>
    </Animated.View>
  );
}
