import { useMemo, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import {
  Canvas,
  Fill,
  Shader,
  Skia,
  useClock,
} from "@shopify/react-native-skia";
import { useDerivedValue } from "react-native-reanimated";

/**
 * The aurora, as a Skia runtime shader.
 *
 * Ported from React Bits' WebGL original rather than dropped in: that one is
 * a `<div>`, an `ogl` renderer and a `requestAnimationFrame` loop against a
 * DOM canvas, none of which exist here. What carries over is the part that
 * matters — the simplex-noise band and its colour ramp — rewritten in SkSL,
 * which is close enough to GLSL that the noise function is line for line.
 *
 * Two changes to the original's maths, both deliberate:
 *
 *  - Skia's fragment coordinates run top-down where GL's run bottom-up, so
 *    the band that formed along the top of the web version forms along the
 *    bottom here. That is where it was asked for, so the flip is left in.
 *  - The colour ramp was a preprocessor macro. SkSL has no preprocessor, and
 *    with stops fixed at 0, 0.5 and 1 the loop it expanded to is just two
 *    mixes.
 *
 * The shader returns premultiplied alpha, which is what Skia wants, so the
 * original's premultiplied blend function has nothing to set up.
 */
const SOURCE = Skia.RuntimeEffect.Make(`
uniform float  uTime;
uniform float  uAmplitude;
uniform float  uBlend;
uniform float2 uResolution;
uniform float3 uColor0;
uniform float3 uColor1;
uniform float3 uColor2;

float3 permute(float3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(float2 v) {
  const float4 C = float4(
    0.211324865405187, 0.366025403784439,
    -0.577350269189626, 0.024390243902439
  );
  float2 i  = floor(v + dot(v, C.yy));
  float2 x0 = v - i + dot(i, C.xx);
  float2 i1 = (x0.x > x0.y) ? float2(1.0, 0.0) : float2(0.0, 1.0);
  float4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);

  float3 p = permute(
    permute(i.y + float3(0.0, i1.y, 1.0)) + i.x + float3(0.0, i1.x, 1.0)
  );

  float3 m = max(
    0.5 - float3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)),
    0.0
  );
  m = m * m;
  m = m * m;

  float3 x  = 2.0 * fract(p * C.www) - 1.0;
  float3 h  = abs(x) - 0.5;
  float3 ox = floor(x + 0.5);
  float3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

  float3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

half4 main(float2 fragCoord) {
  float2 uv = fragCoord / uResolution;

  float3 ramp = uv.x < 0.5
    ? mix(uColor0, uColor1, uv.x / 0.5)
    : mix(uColor1, uColor2, (uv.x - 0.5) / 0.5);

  float height = snoise(float2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25))
                 * 0.5 * uAmplitude;
  height = exp(height);
  height = uv.y * 2.0 - height + 0.2;

  float intensity = 0.6 * height;
  float midPoint = 0.20;
  float alpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);

  float3 colour = intensity * ramp;
  return half4(half3(colour * alpha), half(alpha));
}
`);

/** `#RRGGBB` to the 0–1 triple the shader wants. */
function rgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace("#", ""), 16);
  return [((v >> 16) & 0xff) / 255, ((v >> 8) & 0xff) / 255, (v & 0xff) / 255];
}

export function Aurora({
  colorStops,
  speed = 1,
  blend = 0.5,
  amplitude = 1,
}: {
  colorStops: [string, string, string];
  speed?: number;
  blend?: number;
  amplitude?: number;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const clock = useClock();

  // Converted here and not in the worklet below. `useDerivedValue` runs on
  // the UI runtime, which cannot call an ordinary function from this module —
  // it throws, and the throw comes back as an abort with the whole app gone.
  // The colours do not change per frame anyway, so this is where they belong.
  const stops = useMemo(
    () => colorStops.map(rgb),
    [colorStops[0], colorStops[1], colorStops[2]],
  );

  const uniforms = useDerivedValue(() => ({
    // The original counts in milliseconds and scales them down twice over;
    // this is the same number, which is seconds against the speed.
    uTime: (clock.value / 1000) * speed,
    uAmplitude: amplitude,
    uBlend: blend,
    uResolution: [size.width, size.height],
    uColor0: stops[0],
    uColor1: stops[1],
    uColor2: stops[2],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  // A shader that failed to compile costs the aurora, never the screen it was
  // decorating.
  if (SOURCE == null) return <View onLayout={onLayout} style={{ flex: 1 }} />;

  return (
    <View onLayout={onLayout} style={{ flex: 1 }}>
      {size.width > 0 && (
        <Canvas style={{ flex: 1 }}>
          <Fill>
            <Shader source={SOURCE} uniforms={uniforms} />
          </Fill>
        </Canvas>
      )}
    </View>
  );
}
