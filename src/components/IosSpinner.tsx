import { useEffect, useRef } from "react";
import { Animated, Easing, View, type ColorValue } from "react-native";

import { TEXT_SECONDARY } from "../theme/tokens";

/**
 * Apple's spinner, drawn, for the platform that draws a different one.
 *
 * `ActivityIndicator` is one component with two appearances. On iOS it is
 * `UIActivityIndicatorView`: a ring of short tapered spokes, all present at
 * once, fading around the circle. On Android it is Material's progress
 * circle: a single arc that grows, shrinks and sweeps. They are not the
 * same mark, and this app shows one wherever it is waiting — on a search, a
 * photo, a reading, an answer from the model.
 *
 * Twelve spokes at Apple's proportions, turning once a second. Apple steps
 * the rotation rather than sweeping it, which at twelve steps a second is a
 * distinction no eye makes at this size; the sweep is smoother on a phone
 * that is also laying out a list.
 */

const SPOKES = 12;

/** RN's two named sizes, in points. */
const NAMED = { small: 20, large: 36 } as const;

export function IosSpinner({
  size = "small",
  color,
  animating = true,
  hidesWhenStopped = true,
  style,
}: {
  size?: "small" | "large" | number;
  color?: ColorValue;
  animating?: boolean;
  hidesWhenStopped?: boolean;
  style?: unknown;
}) {
  const d = typeof size === "number" ? size : NAMED[size];
  const turn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animating) return;
    const spin = Animated.loop(
      Animated.timing(turn, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spin.start();
    return () => {
      spin.stop();
    };
  }, [animating, turn]);

  if (!animating && hidesWhenStopped) return null;

  // Apple's spoke is a little over a third of the radius long and about a
  // sixth of that wide, with its outer end just short of the edge.
  const len = d * 0.27;
  const thick = Math.max(1.5, d * 0.08);

  return (
    <Animated.View
      style={[
        {
          width: d,
          height: d,
          alignItems: "center",
          justifyContent: "center",
          transform: [
            {
              rotate: turn.interpolate({
                inputRange: [0, 1],
                outputRange: ["0deg", "360deg"],
              }),
            },
          ],
        },
        style as never,
      ]}
    >
      {Array.from({ length: SPOKES }, (_, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            width: thick,
            height: len,
            borderRadius: thick / 2,
            backgroundColor: color ?? TEXT_SECONDARY,
            // Brightest at the head and fading backwards, which is what
            // makes a ring of identical marks read as a direction.
            opacity: 1 - (i / SPOKES) * 0.85,
            transform: [
              { rotate: `${(i * 360) / SPOKES}deg` },
              // Pushed out from the centre along its own axis, so one
              // rotation places it rather than a rotation and an offset.
              { translateY: -(d / 2 - len / 2 - thick / 2) },
            ],
          }}
        />
      ))}
    </Animated.View>
  );
}
