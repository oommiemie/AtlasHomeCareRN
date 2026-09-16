import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";

import { Glass } from "./Glass";
import { feel } from "../utils/haptics";
import { GROUPED_BG, RADIUS, SPACE, TEXT_PRIMARY } from "../theme/tokens";

const TRACK_H = 48;
const PAD = 4;

/**
 * One of a few, as a glass marker that slides between them.
 *
 * The choices sit still on a plain track and a single capsule of Liquid
 * Glass moves to whichever is chosen, so the change is one object moving
 * rather than two colours swapping. It springs, and it clicks under the
 * finger.
 *
 * The marker travels by its `left`, never by a transform: a transform on
 * an ancestor stops UIVisualEffectView rendering its material, and the
 * capsule would simply go blank on the way across. Nothing here animates
 * an opacity over the glass for the same reason — the text above it is
 * what fades on press, and the text is a sibling, not a parent.
 */
export function GlassChips({
  options,
  value,
  onChange,
  tintColor = "rgba(7,125,215,0.82)",
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  /** What the marker is tinted; the default is the app's blue. */
  tintColor?: string;
}) {
  const [width, setWidth] = useState(0);
  const at = Math.max(0, options.indexOf(value));
  const slot = width > 0 ? (width - PAD * 2) / options.length : 0;

  // Where the marker is, in slots. Springs to the chosen one.
  const pos = useRef(new Animated.Value(at)).current;
  // Mounted at rest, so the first paint does not slide in from the left.
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      pos.setValue(at);
      return;
    }
    Animated.spring(pos, {
      toValue: at,
      useNativeDriver: false,
      damping: 16,
      stiffness: 210,
      mass: 0.7,
    }).start();
  }, [at, pos]);

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{
        height: TRACK_H,
        borderRadius: RADIUS.capsule,
        backgroundColor: GROUPED_BG,
        padding: PAD,
        flexDirection: "row",
      }}
    >
      {slot > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: PAD,
            left: pos.interpolate({
              inputRange: options.map((_, i) => i),
              outputRange: options.map((_, i) => PAD + i * slot),
            }),
            width: slot,
            height: TRACK_H - PAD * 2,
          }}
        >
          <Glass
            interactive
            tintColor={tintColor}
            style={{ flex: 1, borderRadius: RADIUS.capsule, overflow: "hidden" }}
          />
        </Animated.View>
      )}

      {options.map((o) => {
        const on = value === o;
        return (
          <Pressable
            key={o}
            onPress={() => {
              if (on) return;
              feel("tick");
              onChange(o);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: SPACE.xs,
              opacity: pressed && !on ? 0.5 : 1,
            })}
          >
            <Text
              numberOfLines={1}
              style={{
                fontSize: 14,
                fontWeight: on ? "700" : "500",
                color: on ? "#FFFFFF" : TEXT_PRIMARY,
              }}
            >
              {o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
