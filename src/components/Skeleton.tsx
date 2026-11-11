import { useEffect, useRef } from "react";
import { Animated, Easing, View, type DimensionValue } from "react-native";

import { currentDisplay } from "../models/display";
import { RADIUS, SPACE, SURFACE_SUNK } from "../theme/tokens";

/**
 * Grey bars where text is about to arrive, breathing slowly.
 *
 * A spinner and "กำลังสรุป…" said that something was happening and nothing
 * about what; bars the length of the lines that are coming say where the
 * words will be, so the card does not jump when they land. Held still for
 * reduced motion.
 */
export function SkeletonLines({
  widths = ["100%", "92%", "64%"],
  height = 12,
  gap = SPACE.sm,
}: {
  /** One bar per line, each as wide as its line is likely to be. */
  widths?: DimensionValue[];
  height?: number;
  gap?: number;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (currentDisplay().reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityLabel="loading"
      style={{
        gap,
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }),
      }}
    >
      {widths.map((w, i) => (
        <View
          key={i}
          style={{
            width: w,
            height,
            borderRadius: Math.min(RADIUS.sm, height / 2),
            backgroundColor: SURFACE_SUNK,
          }}
        />
      ))}
    </Animated.View>
  );
}
