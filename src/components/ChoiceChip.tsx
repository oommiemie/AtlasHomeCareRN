import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Pressable,
  type AccessibilityRole,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { currentDisplay } from "../models/display";
import { feel } from "../utils/haptics";
import {
  GROUPED_BG,
  PRIMARY_500,
  RADIUS,
  SPACE,
  TEXT_PRIMARY,
} from "../theme/tokens";

/**
 * The app's choice chip — a capsule of grey that turns blue when chosen.
 *
 * Nine screens each wrote their own copy of this, all the same capsule and
 * none of them answering the finger: the chip changed colour in one frame
 * and that was all. So it is one component now, and it moves:
 *
 * - pressed, it sinks a little, and springs back when let go;
 * - chosen, the grey fills with blue as the label turns white, over a fifth
 *   of a second, and the chip swells a touch and settles;
 * - and it ticks under the finger as it is chosen.
 *
 * With reduce motion on, it changes colour at once and does not move.
 *
 * Only the chip. How a screen lays its chips out — a wrapping row, a row
 * that stretches each to fill, a grid — stays with the screen, which passes
 * its sizing in through `style`.
 *
 * Not for the glass chips (`FilterChips`): a transform above Apple's
 * material stops it drawing, and those answer the finger through the
 * material instead.
 */
export function ChoiceChip({
  label,
  on,
  onPress,
  color = PRIMARY_500,
  icon,
  style,
  contentStyle,
  numberOfLines,
  accessibilityRole = "radio",
  haptic = true,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  /** The fill when chosen. The app's blue unless the answer has a colour. */
  color?: string;
  /** Drawn before the label, given the ink it should be drawn in. */
  icon?: (ink: string, on: boolean) => ReactNode;
  /** The chip's own box within the screen's layout — flex, min height. */
  style?: StyleProp<ViewStyle>;
  /** The room inside the capsule, where a screen's differs. */
  contentStyle?: StyleProp<ViewStyle>;
  numberOfLines?: number;
  accessibilityRole?: AccessibilityRole;
  /** Off where the caller already ticks for its own reasons. */
  haptic?: boolean;
}) {
  const still = currentDisplay().reduceMotion;

  // How chosen it looks, 0 to 1 — the colours, which the native driver
  // cannot move.
  const fill = useRef(new Animated.Value(on ? 1 : 0)).current;
  // Its size — the press and the settle, on the native driver.
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (still) {
      fill.setValue(on ? 1 : 0);
      return;
    }
    Animated.timing(fill, {
      toValue: on ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    if (on) {
      // A swell and a settle, as the colour arrives.
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.06,
          duration: 110,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 5,
          tension: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [on, still, fill, scale]);

  const press = (to: number) => {
    if (still) return;
    Animated.spring(scale, {
      toValue: to,
      friction: 6,
      tension: 260,
      useNativeDriver: true,
    }).start();
  };

  const ink = fill.interpolate({
    inputRange: [0, 1],
    outputRange: [TEXT_PRIMARY, "#FFFFFF"],
  });

  return (
    // Two layers, because one Animated node cannot be driven by both: the
    // outer takes the transform on the native driver, the inner the colour
    // on the JS one.
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={() => {
          if (haptic) feel("tick");
          onPress();
        }}
        onPressIn={() => press(0.94)}
        onPressOut={() => press(1)}
        accessibilityRole={accessibilityRole}
        accessibilityState={
          accessibilityRole === "checkbox"
            ? { checked: on }
            : { selected: on }
        }
        accessibilityLabel={label}
        style={{ flexGrow: 1 }}
      >
        <Animated.View
          style={[
            {
              flexGrow: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: SPACE.xs,
              paddingHorizontal: SPACE.lg,
              paddingVertical: 9,
              borderRadius: RADIUS.capsule,
              backgroundColor: fill.interpolate({
                inputRange: [0, 1],
                outputRange: [GROUPED_BG, color],
              }),
            },
            contentStyle,
          ]}
        >
          {icon?.(on ? "#FFFFFF" : TEXT_PRIMARY, on)}
          <Animated.Text
            numberOfLines={numberOfLines}
            style={{
              fontSize: 14,
              lineHeight: 20,
              fontWeight: on ? "600" : "400",
              color: ink,
            }}
          >
            {label}
          </Animated.Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
