import { useEffect } from "react";
import { View } from "react-native";
import Reanimated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Line, Path, Polygon } from "react-native-svg";

import { currentDisplay } from "../models/display";
import type { Sky } from "../models/weather";

/**
 * The sky, drawn and moving: a sun that turns, a moon that rocks, a cloud
 * that drifts, rain that falls from it and lightning that flickers in it.
 *
 * Small and slow — it sits beside a line of text on the home page, and a
 * weather icon that fidgets pulls the eye off everything else on the page.
 * Still, for a carer who has asked the app for less motion.
 *
 * Each moving part is its own layer, moved by a transform on the UI thread;
 * nothing inside an SVG is animated, which in this app has stuttered or
 * crashed every time it was tried (see Sparkline).
 */

const SUN = "#F6A609";
const MOON = "#F4C542";
const CLOUD = "#A9B7CB";
const CLOUD_DARK = "#7F8EA6";
const RAIN = "#3B8FE0";
const BOLT = "#FFC400";

/** A value running 0 → 1 over and over, or held at 0 when motion is off. */
function useLoop(
  ms: number,
  opts: { delay?: number; reverse?: boolean; ease?: boolean } = {},
): SharedValue<number> {
  const v = useSharedValue(0);
  useEffect(() => {
    if (currentDisplay().reduceMotion) return;
    v.value = withDelay(
      opts.delay ?? 0,
      withRepeat(
        withTiming(1, {
          duration: ms,
          easing:
            opts.ease === false ? Easing.linear : Easing.inOut(Easing.sin),
        }),
        -1,
        opts.reverse ?? false,
      ),
    );
    return () => cancelAnimation(v);
    // Once, for the life of the icon.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return v;
}

/** A layer the size of the icon, for the parts to be stacked in. */
function Layer({
  size,
  style,
  children,
}: {
  size: number;
  style?: object;
  children: React.ReactNode;
}) {
  return (
    <Reanimated.View
      pointerEvents="none"
      style={[{ position: "absolute", width: size, height: size }, style]}
    >
      {children}
    </Reanimated.View>
  );
}

function Sun({
  size,
  scale = 1,
  dx = 0,
  dy = 0,
}: {
  size: number;
  scale?: number;
  dx?: number;
  dy?: number;
}) {
  const turn = useLoop(14000, { ease: false });
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: dx },
      { translateY: dy },
      { scale },
      { rotate: `${turn.value * 360}deg` },
    ],
  }));
  const c = 12;
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return {
      x1: c + Math.cos(a) * 7.6,
      y1: c + Math.sin(a) * 7.6,
      x2: c + Math.cos(a) * 10.4,
      y2: c + Math.sin(a) * 10.4,
    };
  });
  return (
    <Layer size={size} style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx={c} cy={c} r={5.2} fill={SUN} />
        {rays.map((r, i) => (
          <Line
            key={i}
            {...r}
            stroke={SUN}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        ))}
      </Svg>
    </Layer>
  );
}

function Moon({ size }: { size: number }) {
  const rock = useLoop(2600, { reverse: true });
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-8 + rock.value * 16}deg` }],
  }));
  return (
    <Layer size={size} style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M15.5 3.5a8.5 8.5 0 1 0 5 15.2A7 7 0 0 1 15.5 3.5z"
          fill={MOON}
        />
      </Svg>
    </Layer>
  );
}

function Cloud({
  size,
  dark = false,
  low = false,
}: {
  size: number;
  dark?: boolean;
  /** Sitting lower in the frame, to leave room for a sun above it. */
  low?: boolean;
}) {
  const drift = useLoop(3200, { reverse: true });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -1.2 + drift.value * 2.4 }],
  }));
  return (
    <Layer size={size} style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d={
            low
              ? "M7 20h10.5a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6-1.3A4.2 4.2 0 0 0 7 20z"
              : "M7 17h10.5a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6-1.3A4.2 4.2 0 0 0 7 17z"
          }
          fill={dark ? CLOUD_DARK : CLOUD}
        />
      </Svg>
    </Layer>
  );
}

function Drop({ size, x, delay }: { size: number; x: number; delay: number }) {
  const fall = useLoop(900, { delay, ease: false });
  const style = useAnimatedStyle(() => ({
    opacity: 1 - fall.value,
    transform: [{ translateY: fall.value * (size * 0.18) }],
  }));
  return (
    <Layer size={size} style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Line
          x1={x}
          y1={18}
          x2={x - 0.8}
          y2={20.5}
          stroke={RAIN}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </Svg>
    </Layer>
  );
}

function Bolt({ size }: { size: number }) {
  const flash = useSharedValue(1);
  useEffect(() => {
    if (currentDisplay().reduceMotion) return;
    // Two quick flickers, then a pause — lightning, not a blinking light.
    flash.value = withRepeat(
      withSequence(
        withTiming(0.15, { duration: 90 }),
        withTiming(1, { duration: 70 }),
        withTiming(0.2, { duration: 90 }),
        withTiming(1, { duration: 80 }),
        withTiming(1, { duration: 1800 }),
      ),
      -1,
    );
    return () => cancelAnimation(flash);
  }, [flash]);
  const style = useAnimatedStyle(() => ({ opacity: flash.value }));
  return (
    <Layer size={size} style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Polygon
          points="12.5,15 9.5,19.5 12,19.5 10.5,23 15,17.5 12.5,17.5 14,15"
          fill={BOLT}
        />
      </Svg>
    </Layer>
  );
}

function Mist({ size }: { size: number }) {
  const drift = useLoop(2400, { reverse: true });
  const a = useAnimatedStyle(() => ({
    transform: [{ translateX: -1.5 + drift.value * 3 }],
  }));
  const b = useAnimatedStyle(() => ({
    transform: [{ translateX: 1.5 - drift.value * 3 }],
  }));
  return (
    <>
      <Layer size={size} style={a}>
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Line
            x1={5}
            y1={18.5}
            x2={17}
            y2={18.5}
            stroke={CLOUD}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </Svg>
      </Layer>
      <Layer size={size} style={b}>
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Line
            x1={8}
            y1={21.5}
            x2={20}
            y2={21.5}
            stroke={CLOUD}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </Svg>
      </Layer>
    </>
  );
}

export function WeatherIcon({
  sky,
  day,
  size = 24,
}: {
  sky: Sky;
  day: boolean;
  size?: number;
}) {
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {sky === "clear" && (day ? <Sun size={size} /> : <Moon size={size} />)}
      {sky === "partly" && (
        <>
          {day ? (
            <Sun size={size} scale={0.72} dx={-size * 0.18} dy={-size * 0.18} />
          ) : (
            <Moon size={size} />
          )}
          <Cloud size={size} low />
        </>
      )}
      {sky === "cloudy" && <Cloud size={size} />}
      {sky === "fog" && (
        <>
          <Cloud size={size} />
          <Mist size={size} />
        </>
      )}
      {(sky === "drizzle" || sky === "rain" || sky === "storm") && (
        <>
          <Cloud size={size} dark={sky !== "drizzle"} />
          {sky === "storm" ? (
            <Bolt size={size} />
          ) : (
            [9, 12.5, 16].map((x, i) =>
              sky === "drizzle" && i === 1 ? null : (
                <Drop key={x} size={size} x={x} delay={i * 300} />
              ),
            )
          )}
        </>
      )}
    </View>
  );
}
