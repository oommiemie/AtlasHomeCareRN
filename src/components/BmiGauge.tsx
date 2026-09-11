import { Image, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { SPACE, SUCCESS, DANGER, TEXT_MUTED } from "../theme/tokens";

/** The gauge's geometry — Figma 102:15728, plus room for the knob. */
const GAUGE = {
  /** The arc's own box, stroke included, as the design draws it. */
  width: 188,
  radius: 89,
  track: 10,
  progress: 8,
  /**
   * Slack around the arc.
   *
   * The knob is wider than the stroke it rides, so at either end of the
   * sweep it would be cut off by the edge of the canvas.
   */
  pad: 6,
  /** Green at the top of the sweep, running to pale yellow at the foot. */
  from: "#34C759",
  to: "#FFE785",
} as const;

/** Polar-to-cartesian on the arc's circle. */
const point = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

/** Where the sweep ends, in degrees, for a fraction of the half-circle. */
const endAngle = (fraction: number) =>
  180 + 180 * Math.max(0.001, Math.min(1, fraction));

/** A half-circle arc from 180° sweeping `fraction` of the way to 360°. */
function arcPath(cx: number, cy: number, r: number, fraction: number): string {
  const end = endAngle(fraction);
  const a = point(cx, cy, r, 180);
  const b = point(cx, cy, r, end);
  const large = end - 180 > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The band's colour at a height up the arc — 0 at its foot, 1 at its crown. */
function bandColour(t: number): string {
  const from = [0x34, 0xc7, 0x59];
  const to = [0xff, 0xe7, 0x85];
  const k = Math.max(0, Math.min(1, t));
  const c = from.map((v, i) => Math.round(lerp(to[i], v, k)));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** The arc's drawn width at full size, the knob's slack included. */
export const BMI_GAUGE_WIDTH = GAUGE.width + GAUGE.pad * 2;

type Props = {
  /** The reading itself, e.g. 19.6. */
  value: number;
  /** Where it sits along the arc, 0 to 1. */
  fraction: number;
  label: string;
  healthy: boolean;
  /**
   * How wide to draw the arc. Defaults to the design's own size.
   *
   * Scales the geometry — radius, strokes, slack — and nothing else. The
   * reading and its verdict keep the app's type sizes at every width: a
   * transform on the whole gauge shrinks the type with it, and 20pt at seven
   * tenths is 14, which is a size the app does not have.
   */
  width?: number;
};

/**
 * BMI as a half-circle gauge — Figma 102:15728.
 *
 * A plain grey track with one coloured sweep over it, rather than a band
 * running through five colours at once: the reading is a single point, and a
 * rainbow behind it invited reading the colour under the tip as the verdict.
 * The verdict is the line under the figure, which is where the state colour
 * lives.
 *
 * The depth is built out of stacked strokes rather than filters — SVG filter
 * support is uneven across the two platforms, and every one of these is a
 * path the renderer already draws:
 *
 *   • the track carries a top-down grey gradient, so it reads as a groove cut
 *     into the card rather than a ring laid on it;
 *   • the band is drawn twice, once in near-black and nudged down, which is
 *     the design's own drop shadow;
 *   • a thin white arc rides the band's outer edge as its lit side, which is
 *     what turns a flat stroke into a tube;
 *   • the knob at the tip is a white disc over its own shadow, carrying a dot
 *     of the band's colour where it ended.
 */
export function BmiGauge({
  value,
  fraction,
  label,
  healthy,
  width = BMI_GAUGE_WIDTH,
}: Props) {
  // Geometry only. The type inside keeps its own sizes — see `width`.
  const k = width / BMI_GAUGE_WIDTH;
  const r = GAUGE.radius * k;
  const track = GAUGE.track * k;
  const progress = GAUGE.progress * k;
  const pad = GAUGE.pad * k;

  const W = width;
  const cx = W / 2;
  const cy = pad + r + track / 2;
  const H = cy + track / 2 + pad;

  const end = endAngle(fraction);
  const tip = point(cx, cy, r, end);
  // How far up the arc the tip sits, which is what the band's gradient is
  // painted along — so the knob's dot is the colour of the band under it.
  const tipColour = bandColour((cy - tip.y) / r);

  return (
    <View style={{ width: W, height: H, alignSelf: "center" }}>
      <Svg width={W} height={H}>
        <Defs>
          {/* Down the arc's own box, as the design draws it. */}
          <LinearGradient id="bmiBand" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={GAUGE.from} />
            <Stop offset="1" stopColor={GAUGE.to} />
          </LinearGradient>
          {/* The groove: darker where the design's inner shadow falls. */}
          <LinearGradient id="bmiTrack" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#D2DAE4" />
            <Stop offset="1" stopColor="#EDF1F6" />
          </LinearGradient>
        </Defs>

        <Path
          d={arcPath(cx, cy, r, 1)}
          stroke="url(#bmiTrack)"
          strokeWidth={track}
          strokeLinecap="round"
          fill="none"
        />

        {/* The band's shadow — the design's 0/4/4 at a tenth. */}
        <Path
          d={arcPath(cx, cy + 3 * k, r, fraction)}
          stroke="rgba(15,23,42,0.10)"
          strokeWidth={progress}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d={arcPath(cx, cy, r, fraction)}
          stroke="url(#bmiBand)"
          strokeWidth={progress}
          strokeLinecap="round"
          fill="none"
        />
        {/* Its lit edge, on the outside of the stroke. */}
        <Path
          d={arcPath(cx, cy, r + progress / 2 - 1, fraction)}
          stroke="rgba(255,255,255,0.45)"
          strokeWidth={2 * k}
          strokeLinecap="round"
          fill="none"
        />

        <Circle cx={tip.x} cy={tip.y + 2 * k} r={7 * k} fill="rgba(15,23,42,0.16)" />
        <Circle cx={tip.x} cy={tip.y} r={7 * k} fill="#FFFFFF" />
        <Circle cx={tip.x} cy={tip.y} r={3.5 * k} fill={tipColour} />
      </Svg>

      {/* Bottom-aligned inside the arc, not floated above its foot: the
          design seats the figure on the gauge's own lower edge. */}
      {/* The app's own sizes, not the design's.
          
          Figma draws the reading at 18 and both small labels at 10. The app's
          scale is 10/12/14/16/20/24, where a headline figure is 20 — the plan
          screen's counters, the villages KPI — and 10 is the badge size,
          never body text. Everything else here is the design's. */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: pad + track / 2,
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 20, lineHeight: 26, fontWeight: "800", color: "#000000" }}>
          {value.toFixed(1)}
        </Text>
        <Text
          style={{
            marginTop: SPACE.xs,
            fontSize: 12,
            lineHeight: 16,
            color: healthy ? SUCCESS : DANGER,
          }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

/**
 * The whole BMI card — Figma 102:15728: the heading, the gauge, and the two
 * measurements the reading is worked out from.
 *
 * The scale sits behind the measurements at half opacity, fading out down its
 * lower half. It was missing entirely; the row underneath was two figures on
 * bare white with nothing tying them to what they are for.
 */
export function BmiChart({
  value,
  fraction,
  label,
  healthy,
  weightKg,
  heightCm,
}: Props & { weightKg: number; heightCm: number }) {
  return (
    <View style={{ alignItems: "center", gap: SPACE.lg }}>
      <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>BMI</Text>

      <BmiGauge value={value} fraction={fraction} label={label} healthy={healthy} />

      <View style={{ alignSelf: "stretch" }}>
        {/* Behind the figures and centred on the card, running out at its
            foot — the design hangs it off the card's own bottom edge. */}
        <Image
          source={require("../../assets/images/bmi_scale.png")}
          style={{
            position: "absolute",
            alignSelf: "center",
            bottom: -SPACE.lg,
            width: 102,
            height: 60,
          }}
          resizeMode="contain"
          accessibilityRole="none"
        />

        <View style={{ flexDirection: "row", gap: SPACE.lg }}>
          <Measure value={weightKg} unit="kg" label="น้ำหนัก" />
          <Measure value={heightCm} unit="cm" label="ส่วนสูง" />
        </View>
      </View>
    </View>
  );
}

/** One measurement: the figure with its unit beside it, over its name. */
function Measure({
  value,
  unit,
  label,
}: {
  value: number;
  unit: string;
  label: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: SPACE.xs }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ fontSize: 16, lineHeight: 20, fontWeight: "700", color: "#000000" }}>
          {value}
        </Text>
        <Text style={{ fontSize: 12, lineHeight: 20, color: "#000000" }}>{unit}</Text>
      </View>
      <Text style={{ fontSize: 12, lineHeight: 16, color: "#000000" }}>{label}</Text>
    </View>
  );
}
