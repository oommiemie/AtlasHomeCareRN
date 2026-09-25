import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  View,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { currentTheme, PRIMARY_500, shadow } from "../theme/tokens";

/**
 * Apple's switch, drawn, for the platform that does not have one.
 *
 * A toggle is the one control in a settings list that is read as a shape
 * rather than as a word, and the two platforms draw completely different
 * shapes for it. iOS is a 51×31 capsule filled edge to edge, with a 27pt
 * white knob that all but fills it. Material 3 is a shorter, narrower track
 * with a knob that sits proud of it, grows when it is on, and carries a
 * tick. Side by side they do not read as the same app — and every settings
 * page in this one is a column of them.
 *
 * So the shape is drawn here to Apple's measurements and used on Android,
 * while iOS keeps the real `Switch`, which already is this.
 */

/** Apple's own geometry, in points. */
const TRACK = { w: 51, h: 31, pad: 2 };
const KNOB = TRACK.h - TRACK.pad * 2;
const TRAVEL = TRACK.w - TRACK.pad * 2 - KNOB;

/** Apple's off track: the same grey the system uses, per theme. */
const offTrack = () => (currentTheme() === "dark" ? "#39393D" : "#E9E9EA");

type Props = {
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  trackColor?: { false?: ColorValue | null; true?: ColorValue | null };
  thumbColor?: ColorValue;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

export function IosSwitch({
  value = false,
  onValueChange,
  disabled = false,
  trackColor,
  thumbColor,
  style,
  accessibilityLabel,
  testID,
}: Props) {
  // One driver for both the slide and the fill, so the knob and the colour
  // cannot arrive at different times the way two animations would.
  const at = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(at, {
      toValue: value ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      // The fill is a colour, and colours are not a thing the native driver
      // can interpolate — so neither half runs on it, and the two stay
      // locked together.
      useNativeDriver: false,
    }).start();
  }, [value, at]);

  const on = trackColor?.true ?? PRIMARY_500;
  const off = trackColor?.false ?? offTrack();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      disabled={disabled}
      onPress={() => onValueChange?.(!value)}
      // Apple's switch dims as a whole when it is off-limits, rather than
      // greying the track and leaving the knob white.
      style={[{ opacity: disabled ? 0.5 : 1 }, style]}
    >
      <Animated.View
        style={{
          width: TRACK.w,
          height: TRACK.h,
          borderRadius: TRACK.h / 2,
          padding: TRACK.pad,
          justifyContent: "center",
          backgroundColor: at.interpolate({
            inputRange: [0, 1],
            outputRange: [String(off), String(on)],
          }),
        }}
      >
        <Animated.View
          style={{
            width: KNOB,
            height: KNOB,
            borderRadius: KNOB / 2,
            backgroundColor: thumbColor ?? "#FFFFFF",
            transform: [
              {
                translateX: at.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, TRAVEL],
                }),
              },
            ],
            // The knob's own lift. Apple's sits on the track rather than in
            // it, and without this it reads as a hole rather than a handle.
            boxShadow: shadow({ blur: 4, y: 2, color: "#000", opacity: 0.15 }),
          }}
        />
      </Animated.View>
    </Pressable>
  );
}
