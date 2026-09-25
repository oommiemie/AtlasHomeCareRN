import { useRef, useState } from "react";
import { PanResponder, View, type LayoutChangeEvent } from "react-native";

import { GROOVE, PRIMARY_500, shadow, SURFACE } from "../theme/tokens";

/**
 * A slider that moves in whole steps, drawn to Apple's proportions.
 *
 * The real control is SwiftUI's, hosted by a native module of this app's
 * own (modules/glass-slider), and it is iOS 26 and up. Everywhere else —
 * an older iPhone, and every Android — that module is absent, and what
 * stood in for it was a 44pt gap: the text-size setting, the one control on
 * the display page that a carer with tired eyes actually came for, was
 * simply not there.
 *
 * So it is drawn. A 4pt track, a tick at each stop, and a 28pt white thumb
 * that covers the tick it rests on, which is what SwiftUI's own does.
 */

const TRACK_H = 4;
const THUMB = 28;
const TICK = 5;

export function IosStepSlider({
  value,
  steps,
  onSlide,
  onSettle,
  accessibilityLabel,
  height = 44,
}: {
  /** The step the thumb sits on, 0 to `steps` - 1. */
  value: number;
  steps: number;
  /** Every step crossed while the finger is down. */
  onSlide?: (step: number) => void;
  /** The step it came to rest on, when the finger lifts. */
  onSettle?: (step: number) => void;
  accessibilityLabel?: string;
  height?: number;
}) {
  const [width, setWidth] = useState(0);
  // The travel the thumb has, which is the width less its own diameter: the
  // thumb is inside the track at both ends rather than hanging off them.
  const span = Math.max(0, width - THUMB);
  const last = Math.max(1, steps - 1);

  // Read by the gesture, which is created once and would otherwise close
  // over the first render's values forever.
  const live = useRef({ span, last, value });
  live.current = { span, last, value };
  const held = useRef(value);

  const stepAt = (x: number) => {
    const { span: s, last: l } = live.current;
    if (s <= 0) return 0;
    const t = Math.min(1, Math.max(0, (x - THUMB / 2) / s));
    return Math.round(t * l);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const next = stepAt(e.nativeEvent.locationX);
        held.current = next;
        onSlide?.(next);
      },
      onPanResponderMove: (e) => {
        const next = stepAt(e.nativeEvent.locationX);
        // Only when it crosses into a new one: the handler ticks the haptic
        // and moves the preview, and both belong to the step, not the pixel.
        if (next !== held.current) {
          held.current = next;
          onSlide?.(next);
        }
      },
      onPanResponderRelease: () => onSettle?.(held.current),
      onPanResponderTerminate: () => onSettle?.(held.current),
    }),
  ).current;

  const at = span * (value / last);

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: last, now: value }}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={{ height, justifyContent: "center" }}
      {...pan.panHandlers}
    >
      {/* The groove, inset by half a thumb at each end so it runs exactly
          as far as the thumb's centre can travel. */}
      <View
        style={{
          position: "absolute",
          left: THUMB / 2,
          right: THUMB / 2,
          height: TRACK_H,
          borderRadius: TRACK_H / 2,
          backgroundColor: GROOVE[0],
        }}
      />
      <View
        style={{
          position: "absolute",
          left: THUMB / 2,
          width: at,
          height: TRACK_H,
          borderRadius: TRACK_H / 2,
          backgroundColor: PRIMARY_500,
        }}
      />

      {Array.from({ length: steps }, (_, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{
            position: "absolute",
            left: THUMB / 2 + (span * i) / last - TICK / 2,
            width: TICK,
            height: TICK,
            borderRadius: TICK / 2,
            backgroundColor: i <= value ? PRIMARY_500 : GROOVE[0],
          }}
        />
      ))}

      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: at,
          width: THUMB,
          height: THUMB,
          borderRadius: THUMB / 2,
          backgroundColor: SURFACE,
          boxShadow: shadow({ blur: 4, y: 2, opacity: 0.2 }),
        }}
      />
    </View>
  );
}
