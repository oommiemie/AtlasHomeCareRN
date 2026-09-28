import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import { Check, Minus } from "lucide-react-native";

import { currentDisplay } from "../models/display";
import { FILL_SUBTLE, PRIMARY_500 } from "../theme/tokens";

/**
 * The app's check box — a rounded square, empty with a thin edge, or filled
 * blue with a white tick.
 *
 * Five screens drew their own and all of them snapped: a frame empty, the
 * next frame filled. This one fills: the blue comes in over the edge as the
 * tick springs up from half its size, and goes back the same way. With
 * reduce motion on, it changes at once.
 *
 * Only the box. The row it sits in — its label, its press feedback, whether
 * the whole line is the target — is the screen's.
 */
export function CheckBox({
  on,
  mixed = false,
  size = 22,
  radius = 7,
  edge = FILL_SUBTLE,
}: {
  on: boolean;
  /** Some but not all — a line rather than a tick, filled the same. */
  mixed?: boolean;
  size?: number;
  radius?: number;
  /** The empty box's edge. */
  edge?: string;
}) {
  const still = currentDisplay().reduceMotion;
  const filled = on || mixed;

  // The fill and the edge, which only the JS driver can colour.
  const fill = useRef(new Animated.Value(filled ? 1 : 0)).current;
  // The tick's own size and presence, on the native driver.
  const tick = useRef(new Animated.Value(filled ? 1 : 0)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const to = filled ? 1 : 0;
    if (still) {
      fill.setValue(to);
      tick.setValue(to);
      return;
    }
    Animated.timing(fill, {
      toValue: to,
      duration: 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    if (filled) {
      tick.setValue(0);
      Animated.spring(tick, {
        toValue: 1,
        friction: 5,
        tension: 220,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(tick, {
        toValue: 0,
        duration: 120,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [filled, still, fill, tick]);

  const Glyph = mixed ? Minus : Check;
  const glyph = Math.round(size * 0.64);

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.5,
        backgroundColor: fill.interpolate({
          inputRange: [0, 1],
          outputRange: ["rgba(0,0,0,0)", PRIMARY_500],
        }),
        borderColor: fill.interpolate({
          inputRange: [0, 1],
          outputRange: [edge, PRIMARY_500],
        }),
      }}
    >
      <Animated.View
        style={{
          opacity: tick.interpolate({
            inputRange: [0, 0.3, 1],
            outputRange: [0, 1, 1],
          }),
          transform: [
            {
              scale: tick.interpolate({
                inputRange: [0, 1],
                outputRange: [0.4, 1],
              }),
            },
          ],
        }}
      >
        <Glyph size={glyph} color="#FFFFFF" strokeWidth={3} />
      </Animated.View>
    </Animated.View>
  );
}
