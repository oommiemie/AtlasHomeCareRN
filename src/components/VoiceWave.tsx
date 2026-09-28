import { useEffect, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { Canvas, Path, Skia, useClock } from "@shopify/react-native-skia";
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

/**
 * The voice mode's wave — one row of bars that takes a different shape for
 * each thing the assistant can be doing, and melts from one into the next.
 *
 * - **Listening**: the carer's own voice. Each bar follows the microphone's
 *   level, louder toward the middle, and each flickers on its own so the
 *   row reads as speech rather than a block moving up and down.
 * - **Thinking**: the bars sink to dots and a single swell of light runs
 *   along them, left to right, over and over — the shape of work going on.
 * - **Speaking**: the answer, as rings from the middle outward, rising and
 *   falling in the uneven rhythm of a sentence being said.
 * - **Idle**: the microphone off — a still row of dots.
 *
 * The change of shape is the point. Every frame, each bar's height is the
 * mix of what the four shapes would make it, weighted by how far the wave
 * is into each; a change of state moves the weights over half a second, so
 * listening sinks into thinking and thinking swells into speech rather than
 * one picture replacing another.
 *
 * Drawn by Skia on the UI thread, one path per frame: thirty animated
 * views driven from JavaScript stuttered whenever the thread was busy — and
 * it is busy exactly while the assistant is answering.
 *
 * Everything inside the frame callback is plain arithmetic written in
 * place. The UI runtime cannot call an ordinary function from this module
 * (see `Aurora`), and a throw there takes the app with it.
 */

export type WaveMode = "idle" | "listening" | "thinking" | "speaking";

const BARS = 30;
/** How long one shape takes to become the next. */
const MORPH = { duration: 520, easing: Easing.inOut(Easing.cubic) };

export function VoiceWave({
  mode,
  level,
  color,
  height,
  still = false,
}: {
  mode: WaveMode;
  /** The microphone's level, 0 to 1, as the recogniser reports it. */
  level: SharedValue<number>;
  color: string;
  height: number;
  /** Reduce motion: the shapes hold still; only the voice moves them. */
  still?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const clock = useClock();

  // How far the wave is into each shape; they always sum to one.
  const idle = useSharedValue(mode === "idle" ? 1 : 0);
  const listening = useSharedValue(mode === "listening" ? 1 : 0);
  const thinking = useSharedValue(mode === "thinking" ? 1 : 0);
  const speaking = useSharedValue(mode === "speaking" ? 1 : 0);

  useEffect(() => {
    const to = (on: boolean) =>
      still ? (on ? 1 : 0) : withTiming(on ? 1 : 0, MORPH);
    idle.value = to(mode === "idle");
    listening.value = to(mode === "listening");
    thinking.value = to(mode === "thinking");
    speaking.value = to(mode === "speaking");
  }, [mode, still, idle, listening, thinking, speaking]);

  const path = useDerivedValue(() => {
    const p = Skia.Path.Make();
    if (width <= 0) return p;
    const t = still ? 0 : clock.value / 1000;
    const n = BARS;
    const slot = width / n;
    const bw = Math.min(3.5, slot * 0.5);
    const mid = (n - 1) / 2;

    const wI = idle.value;
    const wL = listening.value;
    const wT = thinking.value;
    const wS = speaking.value;
    const sum = wI + wL + wT + wS || 1;
    const lvl = level.value;

    // Thinking: where the swell is, sweeping past both ends before it wraps.
    const sweep = ((t * 0.6) % 1.5) - 0.25;
    const at = sweep * (n - 1);
    // Speaking: the loudness of the sentence — two slow beats that seldom
    // line up, so it never settles into a metronome.
    const say =
      0.35 + 0.65 * Math.abs(Math.sin(t * 2.7) * Math.sin(t * 1.3 + 1.1));

    for (let i = 0; i < n; i++) {
      const edge = Math.abs(i - mid) / mid;
      // Louder in the middle, the way a voice is drawn.
      const shape = 0.25 + 0.75 * (1 - edge);

      const hIdle = 0.08;

      const flicker =
        0.55 + 0.45 * Math.sin(t * 9.3 + i * 1.7) * Math.sin(t * 5.1 + i * 0.6);
      // Even in a silence it breathes, a slow ripple across the row, so an
      // open microphone never looks like a closed one.
      const breath = 0.06 * (0.5 + 0.5 * Math.sin(t * 3 - i * 0.45));
      const hListen = 0.12 + breath + lvl * shape * flicker * 0.9;

      const d = i - at;
      const swell = Math.exp(-(d * d) / (2 * 2.4 * 2.4));
      const hThink = 0.08 + 0.55 * swell + 0.04 * Math.sin(t * 4 - i * 0.5);

      const ring = 0.5 + 0.5 * Math.sin(t * 10 - Math.abs(i - mid) * 0.75);
      const hSpeak = 0.12 + say * shape * (0.3 + 0.7 * ring);

      const h01 = (wI * hIdle + wL * hListen + wT * hThink + wS * hSpeak) / sum;
      const h = Math.max(bw, Math.min(1, h01) * height);
      const x = slot * i + (slot - bw) / 2;
      const y = (height - h) / 2;
      p.addRRect(Skia.RRectXY(Skia.XYWHRect(x, y, bw, h), bw / 2, bw / 2));
    }
    return p;
  });

  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width);

  return (
    <View onLayout={onLayout} pointerEvents="none" style={{ flex: 1, height }}>
      {width > 0 && (
        <Canvas style={{ flex: 1 }}>
          <Path path={path} color={color} />
        </Canvas>
      )}
    </View>
  );
}
