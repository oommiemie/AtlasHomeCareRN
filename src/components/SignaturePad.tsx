import { useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import {
  GROUPED_BG,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";

/**
 * Somewhere to sign.
 *
 * Strokes as SVG paths, captured off a `PanResponder` — there is no
 * signature library here and one would be a native dependency for something
 * that is three event handlers and a `<Path>`. The finished signature is
 * handed up as the path data itself rather than as a picture: it is a few
 * hundred bytes instead of a few hundred kilobytes, it redraws crisp at any
 * size, and it can be rendered back into the record without a file store.
 *
 * Undo removes the last stroke rather than everything. A signature taken on
 * a phone held at the end of someone's bed is often two or three goes at
 * the same loop, and clearing all of it to fix the tail of it is the reason
 * people sign these things four times.
 */
export function SignaturePad({
  value,
  onChange,
  height = 180,
}: {
  /** The strokes, as SVG path data, one per stroke. */
  value: string[];
  onChange: (strokes: string[]) => void;
  height?: number;
}) {
  const [live, setLive] = useState("");
  const path = useRef("");

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const { locationX: x, locationY: y } = e.nativeEvent;
          path.current = `M${x.toFixed(1)},${y.toFixed(1)}`;
          setLive(path.current);
        },
        onPanResponderMove: (e) => {
          const { locationX: x, locationY: y } = e.nativeEvent;
          path.current += ` L${x.toFixed(1)},${y.toFixed(1)}`;
          setLive(path.current);
        },
        onPanResponderRelease: () => {
          // A tap with no travel is not a stroke; it is a dot of ink that
          // makes "has signed" true without anything being signed.
          if (path.current.includes("L")) onChange([...value, path.current]);
          path.current = "";
          setLive("");
        },
      }),
    [value, onChange],
  );

  const empty = value.length === 0 && live === "";

  return (
    <View style={{ gap: SPACE.sm }}>
      <View
        {...responder.panHandlers}
        style={{
          height,
          borderRadius: RADIUS.lg,
          backgroundColor: GROUPED_BG,
          overflow: "hidden",
          justifyContent: "center",
        }}
      >
        {empty && (
          <Text
            style={{
              textAlign: "center",
              fontSize: 14,
              color: TEXT_MUTED,
            }}
          >
            เซ็นชื่อในกรอบนี้
          </Text>
        )}
        <Svg style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}>
          {[...value, live].filter(Boolean).map((d, i) => (
            <Path
              key={i}
              d={d}
              stroke={TEXT_PRIMARY}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </Svg>
        {/* The line people sign above, as on paper. */}
        <View
          style={{
            position: "absolute",
            left: SPACE.lg,
            right: SPACE.lg,
            bottom: 34,
            height: 1,
            backgroundColor: SEPARATOR,
          }}
        />
      </View>

      <View style={{ flexDirection: "row", gap: SPACE.lg }}>
        <Pressable
          onPress={() => onChange(value.slice(0, -1))}
          disabled={value.length === 0}
          accessibilityRole="button"
          accessibilityLabel="ย้อนเส้นล่าสุด"
          hitSlop={8}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "500",
              color: value.length === 0 ? TEXT_MUTED : PRIMARY_500,
            }}
          >
            ย้อนกลับ
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onChange([])}
          disabled={value.length === 0}
          accessibilityRole="button"
          accessibilityLabel="ล้างลายเซ็น"
          hitSlop={8}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "500",
              color: value.length === 0 ? TEXT_MUTED : PRIMARY_500,
            }}
          >
            ล้างทั้งหมด
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
