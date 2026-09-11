import { useEffect } from "react";
import { View } from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { DotHalo } from "./DotHalo";

/**
 * How far the light slides from the middle, as a share of the halo — and how
 * much bigger than the halo the sheet carrying it is.
 *
 * These two are read together and the first pass had them wrong. A sheet
 * nearly twice the halo, slid a fifth of the halo's width, moved the gradient
 * by a twelfth of its own length: the brightness at any one dot changed by
 * ten per cent or so, which is a change nobody can see. Tightening the sheet
 * and widening the throw takes that to a third of the gradient's length, and
 * the bright band then sweeps most of the way across the field.
 */
const THROW = 0.45;
const SHEET = 1.35;

/**
 * The dot halo, lit by a sheet of light that follows the device.
 *
 * Tilt the phone and the highlight slides across the field the way it would
 * across a piece of glass — which is the whole point: a flat ring of dots is
 * a decal, and the same ring with light moving over it is a surface the
 * device is holding up to a window.
 *
 * How it is built matters. The obvious way — recompute every dot's colour on
 * each accelerometer reading — means re-rendering a couple of hundred SVG
 * circles about sixty times a second, which is a great deal of work to move a
 * highlight. Instead the dots are a *mask*: they are drawn once and never
 * again, and what moves behind them is a single gradient. One view
 * transforms; the field it shows through does not.
 *
 * Reanimated drives that transform on the UI thread, so the reading never has
 * to cross to JavaScript to be drawn.
 */
export function TiltHalo({
  size,
  ink,
  rings,
  spacing,
  dot,
}: {
  size: number;
  ink: string;
  rings?: number;
  spacing?: number;
  dot?: number;
}) {
  const lx = useSharedValue(0);
  const ly = useSharedValue(0);

  useEffect(() => {
    /*
      Loaded here rather than at the top of the file, and allowed to fail.

      `expo-sensors` re-exports every sensor it has — the pedometer and the
      barometer along with the accelerometer — and each of those looks up its
      native module as the file is read. So a single `import` at the top of
      this file brings the whole set down at load time, and on a build whose
      native side does not carry them the error is thrown while the module is
      being evaluated: the screen never renders, the flow behind it never
      opens, and the message names the pedometer, which nothing here asked
      for.

      Required inside the effect instead, wrapped. The halo is ornament; a
      build without the sensor should show it lit from one fixed angle and
      carry on, not take the page down with it.
    */
    let Accelerometer: typeof import("expo-sensors").Accelerometer;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      Accelerometer = require("expo-sensors").Accelerometer;
      if (Accelerometer?.addListener == null) return;
    } catch {
      return;
    }

    /*
      Sixty a second is the rate the screen refreshes at, and the highlight
      has nowhere finer to move than a pixel — asking for more readings than
      that spends battery on motion nobody can see.
    */
    Accelerometer.setUpdateInterval(16);
    const sub = Accelerometer.addListener(({ x, y }) => {
      /*
        The light comes from where the phone is tipped away from, so it runs
        against the tilt. Clamped to a quarter turn either way: past that the
        reading is a phone being put down, not a phone being looked at.
      */
      const clamp = (n: number) => Math.min(1, Math.max(-1, n / 0.5));
      // Eased rather than snapped to the raw reading: an accelerometer is
      // noisy at rest and an unfiltered highlight jitters while the phone is
      // lying still on a table.
      lx.value = withTiming(-clamp(x), { duration: 120, easing: Easing.out(Easing.quad) });
      ly.value = withTiming(clamp(y), { duration: 120, easing: Easing.out(Easing.quad) });
    });
    return () => sub.remove();
  }, [lx, ly]);

  const sliding = useAnimatedStyle(() => ({
    transform: [
      { translateX: lx.value * size * THROW },
      { translateY: ly.value * size * THROW },
    ],
  }));

  return (
    <MaskedView
      style={{ width: size, height: size }}
      maskElement={
        <View
          style={{
            width: size,
            height: size,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "transparent",
          }}
        >
          {/*
            Near-solid, because this is a mask.

            A mask's alpha is what shows through, so the halo's own taper —
            a third down to a tenth — was being multiplied by the gradient
            behind it and the outer rings came out at a few per cent of a pale
            blue on a near-white page, which is nothing at all. The shape
            belongs here; the shading belongs to the light.
          */}
          <DotHalo
            size={size}
            ink="#000000"
            rings={rings}
            spacing={spacing}
            dot={dot}
            fade={[1, 0.55]}
          />
        </View>
      }
    >
      <Reanimated.View
        style={[
          {
            position: "absolute",
            left: (size - size * SHEET) / 2,
            top: (size - size * SHEET) / 2,
            width: size * SHEET,
            height: size * SHEET,
          },
          sliding,
        ]}
      >
        {/*
          A band of light on a dim ground, both made of the halo's own ink.

          A ramp that fades gently from one corner to the other has no edge to
          watch: tilt it and everything changes a little, which reads as
          nothing changing. A band does — it is a shape with a position, and
          the eye tracks a position. So the ink runs dim, bright, dim across
          the sheet, and what the tilt moves is the bright part.
        */}
        <LinearGradient
          colors={[`${ink}22`, `${ink}33`, ink, `${ink}33`, `${ink}22`]}
          locations={[0, 0.32, 0.5, 0.68, 1]}
          start={{ x: 0.05, y: 0.1 }}
          end={{ x: 0.95, y: 0.9 }}
          style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}
        />
      </Reanimated.View>
    </MaskedView>
  );
}
