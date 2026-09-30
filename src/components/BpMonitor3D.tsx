import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { PixelRatio, StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import {
  Canvas,
  useFrame,
  useLoader,
  useThree,
} from "@react-three/fiber/native";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import {
  AGAIN,
  buildMonitor,
  INTRO,
  RESULT_AT,
  sceneAt,
  type Reading,
} from "./bpMonitorModel";
import { currentDisplay } from "../models/display";
import { PRIMARY_300 } from "../theme/tokens";

/**
 * A soft coloured light behind the unit: a round pool, blue at its heart
 * with a little aqua toward the cuff, centred on the scene. It is a circle
 * no wider than the canvas is tall and fades to nothing at its rim, so it
 * never reaches an edge and nothing shows where the canvas stops.
 */
function Glow({ width, height }: { width: number; height: number }) {
  const r = Math.min(width, height) / 2;
  const cx = width / 2;
  const cy = height / 2;
  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient
          id="bp-glow"
          gradientUnits="userSpaceOnUse"
          cx={cx}
          cy={cy}
          r={r}
        >
          <Stop offset="0" stopColor={PRIMARY_300} stopOpacity={0.42} />
          <Stop offset="0.5" stopColor={PRIMARY_300} stopOpacity={0.2} />
          <Stop offset="1" stopColor={PRIMARY_300} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient
          id="bp-aqua"
          gradientUnits="userSpaceOnUse"
          cx={cx + r * 0.3}
          cy={cy + r * 0.1}
          r={r * 0.6}
        >
          <Stop offset="0" stopColor="#5CD6C9" stopOpacity={0.26} />
          <Stop offset="1" stopColor="#5CD6C9" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={width} height={height} fill="url(#bp-glow)" />
      <Rect width={width} height={height} fill="url(#bp-aqua)" />
    </Svg>
  );
}

/*
  The blood pressure monitor, shown while a reading is being taken, in
  place of a spinner. The model itself is `bpMonitorModel`, kept apart
  from React so it can be rendered on its own while it is being made;
  this is only its stage and its film: the camera close on the rolled
  cuff as it curls into its loop, then in on the unit's screen, which
  runs a minute's measurement to the device's result — once.

  The minute is counted from when the numbers start, not from when the
  scene opened: the opening is only the cuff being got ready.
*/

/** A room for the gloss to reflect — without it the white reads as paper. */
function Studio() {
  const { gl, scene } = useThree();
  useEffect(() => {
    try {
      const pm = new THREE.PMREMGenerator(gl);
      scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.45;
      pm.dispose();
    } catch {
      // The lamps alone still light it.
    }
  }, [gl, scene]);
  return null;
}

/** How long the result stays on the screen before the page moves on. */
const HOLD = 2.5;

function Monitor({
  result,
  onDone,
  run,
}: {
  result: Reading | null;
  onDone?: () => void;
  run: number;
}) {
  const [face, key, lcd, fabric, outer, lining] = useLoader(
    THREE.TextureLoader,
    [
      require("../../assets/images/bp_face_print.png"),
      require("../../assets/images/bp_key_print.png"),
      require("../../assets/images/bp_lcd_print.png"),
      require("../../assets/images/bp_fabric.png"),
      require("../../assets/images/bp_cuff_outer.png"),
      require("../../assets/images/bp_cuff_lining.png"),
    ],
  );
  const model = useMemo(
    () => buildMonitor(THREE, { face, key, lcd, fabric, outer, lining }),
    [face, key, lcd, fabric, outer, lining],
  );
  const still = currentDisplay().reduceMotion;
  // The film starts when the model is first drawn, not when the canvas
  // opened — its pictures take a moment to load.
  const start = useRef<number | null>(null);
  // The first frames compile the model's shaders and send its pictures to
  // the GPU, and stall doing it; the film waits for them, so its opening
  // is not the part that stutters.
  const warm = useRef(0);
  const shown = useRef("");
  const finished = useRef(false);
  /*
    A new `run` is the carer measuring again: the same monitor, not a new
    one, so rather than cutting back to the start the film begins by
    drawing back from the screen as the cuff comes off and lies flat.
  */
  const again = useRef(false);
  const firstRun = useRef(run);
  useEffect(() => {
    if (run === firstRun.current) return;
    again.current = true;
    start.current = null;
    finished.current = false;
  }, [run]);
  // Read on each frame, so a result arriving mid-film is picked up.
  const latest = useRef({ result, onDone });
  latest.current = { result, onDone };
  useFrame(({ camera, clock }) => {
    const now = clock.getElapsedTime();
    if (warm.current < 3) {
      warm.current += 1;
      start.current = now;
    }
    start.current ??= now;
    // Held still, it skips the opening and goes straight to the numbers;
    // the minute they take is the measurement, not decoration.
    const lead = again.current ? AGAIN : 0;
    const elapsed = now - start.current + (still ? lead + INTRO : 0);
    const end = lead + INTRO + RESULT_AT + HOLD;
    const t = Math.min(elapsed, end);
    const s = sceneAt(t, latest.current.result ?? undefined, again.current);
    if (!finished.current && elapsed >= end) {
      finished.current = true;
      latest.current.onDone?.();
    }
    camera.position.set(...s.cam);
    camera.lookAt(...s.look);
    model.setCuff(s.cuff);
    const tag = `${s.reading.sys}/${s.reading.dia}/${s.reading.pulse}`;
    if (tag !== shown.current) {
      shown.current = tag;
      model.setReading(s.reading);
    }
  });
  return <primitive object={model.group} />;
}

/**
 * The monitor, across the whole width it is given and played from its
 * opening each time it appears. `result` is what the screen ends on;
 * `onDone` is called once it has been shown. No box round it: the canvas
 * is clear and reaches the page's edges, so the scene is only ever cut
 * where the page itself ends.
 *
 * `compact` shrinks it — to make room for the figures under it once the
 * reading is in. The canvas keeps its size and is scaled down within a
 * band that closes up round it: resizing a GL surface on every frame of
 * an animation is what makes one stutter.
 */
export function BpMonitor3D({
  result = null,
  onDone,
  run = 0,
  compact = false,
  maxHeight = 340,
  compactHeight = 210,
}: {
  result?: Reading | null;
  onDone?: () => void;
  /** Changed to measure again, with the same monitor. */
  run?: number;
  compact?: boolean;
  maxHeight?: number;
  compactHeight?: number;
}) {
  const [width, setWidth] = useState(0);
  const height = Math.min(maxHeight, Math.round(width * 0.8));
  const small = Math.min(compactHeight, height);
  const k = useSharedValue(compact ? 1 : 0);
  useEffect(() => {
    k.value = currentDisplay().reduceMotion
      ? Number(compact)
      : withTiming(Number(compact), {
          duration: 650,
          easing: Easing.inOut(Easing.cubic),
        });
  }, [compact, k]);
  const band = useAnimatedStyle(() => ({
    height: (height || 1) + (small - height) * k.value,
  }));
  const stage = useAnimatedStyle(() => {
    const h = height + (small - height) * k.value;
    const f = height > 0 ? h / height : 1;
    return { transform: [{ translateY: (h - height) / 2 }, { scale: f }] };
  });
  return (
    <Animated.View
      style={[{ alignSelf: "stretch" }, band]}
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
    >
      <Animated.View
        style={[
          { position: "absolute", left: 0, top: 0, width, height },
          stage,
        ]}
      >
        {width > 0 && <Glow width={width} height={height} />}
        {width > 0 && (
          <Canvas
            style={{ width, height, backgroundColor: "transparent" }}
            gl={{ alpha: true, antialias: true }}
            camera={{ position: [0.4, 0.5, 9], fov: 40, near: 0.1, far: 100 }}
            onCreated={({ gl, setDpr }) => {
              gl.setClearColor(0x000000, 0);
              // Twice the points is sharp enough at this size; three times
              // fills half again as many pixels every frame for nothing seen.
              setDpr(Math.min(PixelRatio.get(), 2));
            }}
          >
            {/* A soft studio: sky and floor fill, a key from the upper right,
              and a rim from behind to lift the edges off the page. */}
            <hemisphereLight args={["#FFFFFF", "#D5DAE2", 1.1]} />
            <directionalLight position={[4, 6, 7]} intensity={1.8} />
            <directionalLight position={[-5, 2, 4]} intensity={0.45} />
            <directionalLight position={[0, 3, -6]} intensity={0.6} />
            <Studio />
            <Suspense fallback={null}>
              <Monitor result={result} onDone={onDone} run={run} />
            </Suspense>
          </Canvas>
        )}
      </Animated.View>
    </Animated.View>
  );
}
