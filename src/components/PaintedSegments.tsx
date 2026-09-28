import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, View } from "react-native";

import { currentDisplay } from "../models/display";
import { feel } from "../utils/haptics";
import { GROUPED_BG, PRIMARY_500, RADIUS, TEXT_PRIMARY } from "../theme/tokens";

const PAD = 3;
const HEIGHT = 34;

/**
 * The segmented control, drawn — for the build where UIKit's is missing,
 * which is every Android build.
 *
 * The native one on iOS 26 slides its selected capsule from segment to
 * segment and gives under the finger. Drawn as four capsules, one of them
 * blue, this only jumped: the blue went out on one and came on at another
 * in the same frame, and a tap read as a flicker. So the blue is one pill
 * that moves, with a small overshoot as it lands, the tapped segment dips
 * under the finger, and the new label fades up to white as the pill
 * arrives. The phone ticks once when the choice changes.
 *
 * Transform and opacity only, on the native driver, so the slide keeps up
 * while the chart below re-renders for the new range.
 */
export function PaintedSegments({
  labels,
  index,
  onChange,
}: {
  labels: string[];
  /** The selected segment. */
  index: number;
  onChange: (i: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const slot = labels.length > 0 ? (width - PAD * 2) / labels.length : 0;
  const at = useRef(new Animated.Value(index)).current;

  useEffect(() => {
    if (currentDisplay().reduceMotion) {
      at.setValue(index);
      return;
    }
    const anim = Animated.spring(at, {
      toValue: index,
      useNativeDriver: true,
      friction: 8,
      tension: 90,
    });
    anim.start();
    return () => anim.stop();
  }, [index, at]);

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{
        flexDirection: "row",
        backgroundColor: GROUPED_BG,
        borderRadius: RADIUS.capsule,
        padding: PAD,
      }}
    >
      {slot > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: PAD,
            left: PAD,
            width: slot,
            height: HEIGHT,
            borderRadius: RADIUS.capsule,
            backgroundColor: PRIMARY_500,
            transform: [
              {
                translateX: at.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, slot],
                }),
              },
            ],
          }}
        />
      )}
      {labels.map((label, i) => (
        <Segment
          key={label}
          label={label}
          // How far the pill is from this segment, 0 when it sits on it.
          near={at.interpolate({
            inputRange: [i - 1, i, i + 1],
            outputRange: [0, 1, 0],
            extrapolate: "clamp",
          })}
          on={i === index}
          onPress={() => {
            if (i !== index) feel("tick");
            onChange(i);
          }}
        />
      ))}
    </View>
  );
}

function Segment({
  label,
  near,
  on,
  onPress,
}: {
  label: string;
  near: Animated.AnimatedInterpolation<number>;
  on: boolean;
  onPress: () => void;
}) {
  const press = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(press, {
      toValue: v,
      useNativeDriver: true,
      friction: 6,
      tension: 260,
    }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => to(0.94)}
      onPressOut={() => to(1)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      style={{ flex: 1 }}
    >
      <Animated.View
        style={{
          height: HEIGHT,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ scale: press }],
        }}
      >
        {/* Two labels laid over each other, the white one faded in as the
            pill arrives — a colour cannot animate on the native driver, an
            opacity can. */}
        <Animated.Text
          style={{
            fontSize: 14,
            fontWeight: "500",
            color: TEXT_PRIMARY,
            opacity: near.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0],
            }),
          }}
        >
          {label}
        </Animated.Text>
        <Animated.Text
          style={{
            position: "absolute",
            fontSize: 14,
            fontWeight: "700",
            color: "#FFFFFF",
            opacity: near,
          }}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}
