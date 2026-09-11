import { useEffect, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { OPEN_MS } from "./Sparkline";
import { SURFACE } from "../theme/tokens";

/** How many seconds of trace the card shows. */
const WINDOW_SECONDS = 5;

/** How finely the wave is sampled across the card. */
const SAMPLES = 320;

/** How long the trace takes to draw itself in. */
const DRAW_MS = 1000;

/**
 * One beat, as the sum of its five deflections.
 *
 * P, Q, R, S and T, each a gaussian at its own place in the cycle: the small
 * atrial bump, the sharp ventricular spike with its dips either side, and the
 * broad recovery wave after it. Written as gaussians rather than as line
 * segments because the trace has to survive being drawn at any width — a
 * polyline of fixed points turns into a comb when the beats crowd together.
 *
 * `phase` runs 0 to 1 across one beat; the result is -1 to 1, R at the top.
 */
function beat(phase: number): number {
  const wave = (at: number, height: number, width: number) =>
    height * Math.exp(-Math.pow(phase - at, 2) / (2 * width * width));

  return (
    wave(0.15, 0.14, 0.035) + // P
    wave(0.29, -0.12, 0.008) + // Q
    wave(0.32, 1.0, 0.01) + // R
    wave(0.355, -0.28, 0.012) + // S
    wave(0.6, 0.3, 0.05) // T
  );
}

/**
 * A heart's trace, at the rate it is beating.
 *
 * The pulse card used to carry the same weekly line as the other five, which
 * for a heart rate is the one chart that hides what the number means: eighty
 * and a hundred and twenty are the same shape on a trend line. Here the rate
 * IS the drawing — a faster heart fits more beats across the card, and the
 * card shows a fixed five seconds of trace, so counting the peaks is reading
 * the rate.
 */
export function EcgTrace({
  bpm,
  ink,
  height = 61,
}: {
  bpm: number;
  ink: string;
  height?: number;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  // A rate of zero would put every beat on top of the last; a record with no
  // reading draws a flat line, which is the honest picture of no data.
  const beats = Math.max(0, (bpm * WINDOW_SECONDS) / 60);
  const mid = height / 2;
  const amp = height * 0.4;

  const points =
    width <= 0 || beats <= 0
      ? []
      : Array.from({ length: SAMPLES }, (_, i) => {
          const t = i / (SAMPLES - 1);
          return {
            x: t * width,
            y: mid - beat((t * beats) % 1) * amp,
          };
        });

  const d =
    points.length === 0
      ? `M 0 ${mid} L ${Math.max(width, 0)} ${mid}`
      : points
          .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
          .join(" ");

  /**
   * It draws itself in once, left to right, and then holds still.
   *
   * It ran continuously for a while — one loop per beat, the way a monitor
   * sweeps. It was the right idea for a live trace and the wrong one for this
   * card: the reading is one number taken at one moment, and a trace that
   * keeps running says the heart is being watched right now, which it is not.
   *
   * The drawing is a cover sliding off a finished trace rather than a stroke
   * revealing itself — see `Sparkline`, where animating the stroke both
   * stuttered and then crashed.
   */
  const shown = useSharedValue(0);
  useEffect(() => {
    if (points.length === 0) return;
    shown.value = 0;
    // Held back until the page has finished arriving.
    //
    // The animation used to start the moment the chart measured itself, which
    // is while the navigation transition is still running — by the time the
    // page was on screen the cover had already cleared the first third, and
    // the line looked like it began somewhere in the middle.
    shown.value = withDelay(
      OPEN_MS,
      withTiming(1, { duration: DRAW_MS, easing: Easing.out(Easing.cubic) }),
    );
  }, [points.length, shown]);

  const wipe = useAnimatedStyle(() => ({
    transform: [{ translateX: shown.value * width }],
  }));

  return (
    <View onLayout={onLayout} style={{ height, overflow: "hidden" }}>
      {width > 0 && (
        <>
          <Svg width={width} height={height}>
            <Path
              d={d}
              stroke={ink}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
          {/* The card's own white, sliding off to the right. */}
          <Reanimated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: SURFACE,
              },
              wipe,
            ]}
          />
        </>
      )}
    </View>
  );
}
