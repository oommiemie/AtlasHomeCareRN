import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Glass } from "./Glass";
import {
  RADIUS,
  SPACE,
  SURFACE,
  SURFACE_SUNK,
  LIQUID_GLASS,
} from "../theme/tokens";

/**
 * The pane an assistant's card sits in: Apple's glass, with the card's own
 * white pieces standing on it — the health figures, the list of people,
 * the map. One pane for all of them, so every card the assistant sends
 * reads as the same kind of thing.
 *
 * Pressed, where it opens something, through the glass's own `interactive`
 * rather than a scale: a transform above the material stops it drawing.
 */
export function GlassWidget({
  children,
  onPress,
  accessibilityLabel,
  padding = SPACE.md,
  plain = false,
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  padding?: number;
  /**
   * White instead of glass — for a card whose pieces are read closely, the
   * health figures, where the page showing through the pane was one more
   * thing behind the numbers.
   */
  plain?: boolean;
}) {
  const pane = plain ? (
    <View
      style={{
        borderRadius: RADIUS.card,
        overflow: "hidden",
        padding,
        gap: SPACE.sm,
        backgroundColor: SURFACE,
      }}
    >
      {children}
    </View>
  ) : (
    // The glass as a layer behind the card's pieces, not around them:
    // iOS 26's material treats what it holds as content on glass and tints
    // it, and the white tiles came out grey. Beside it, they are white.
    <View style={{ borderRadius: RADIUS.card, overflow: "hidden" }}>
      <Glass
        interactive={onPress != null}
        // Apple's clear glass, with no white laid over it: the page shows
        // through the pane rather than a milky film, and the white pieces
        // on it are the only white there is. Painted only where there is
        // no material to be clear.
        effect="clear"
        // A faint grey, not white: over the page's own near-white the clear
        // glass was white too, and the white tiles on it had no edge.
        tintColor={LIQUID_GLASS ? "rgba(120,120,128,0.12)" : SURFACE_SUNK}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          borderRadius: RADIUS.card,
        }}
      />
      <View style={{ padding, gap: SPACE.sm }}>{children}</View>
    </View>
  );
  return onPress != null ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{ alignSelf: "stretch" }}
    >
      {pane}
    </Pressable>
  ) : (
    <View style={{ alignSelf: "stretch" }}>{pane}</View>
  );
}
