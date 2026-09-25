import type { ReactNode } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";

import { RADIUS, SPACE, SURFACE, shadow } from "../theme/tokens";

type Props = {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Turn off when children must reach the card's edge (a map, an image). */
  padded?: boolean;
  /**
   * Lifts the card off the page.
   *
   * A shadow cannot go on the card itself: it clips to its rounded corners
   * with `overflow: hidden` so a map or an image cannot spill out, and that
   * clip cuts the shadow away with it. So it is drawn on a wrapper instead —
   * which is why this is a flag rather than something a caller passes
   * through `style`.
   */
  elevated?: boolean;
  accessibilityLabel?: string;
  /** A second action on the same card — deleting, usually. */
  onLongPress?: () => void;
  accessibilityHint?: string;
};

/** The white rounded card the whole app is built from. */
export function Card({
  children,
  onPress,
  onLongPress,
  style,
  padded = true,
  elevated,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const box: StyleProp<ViewStyle> = [
    {
      backgroundColor: SURFACE,
      borderRadius: RADIUS.card,
      overflow: "hidden",
      padding: padded ? SPACE.lg : 0,
    },
    style,
  ];

  const lift: StyleProp<ViewStyle> = elevated && {
    borderRadius: RADIUS.card,
    boxShadow: shadow({ blur: 8, y: 2, opacity: 0.08 }),
  };

  if (!onPress && !onLongPress) {
    const plain = <View style={box}>{children}</View>;
    return elevated ? <View style={lift}>{plain}</View> : plain;
  }

  // A plain Pressable, not PressableScale.
  //
  // That one animates a transform on an inner Animated.View, and a
  // transformed ancestor stops UIVisualEffectView drawing its material —
  // the glass avatars these cards carry would come out as empty circles.
  // The press-scale is worth less than the content rendering at all.
  const pressable = (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={box}
    >
      {children}
    </Pressable>
  );

  return elevated ? <View style={lift}>{pressable}</View> : pressable;
}
