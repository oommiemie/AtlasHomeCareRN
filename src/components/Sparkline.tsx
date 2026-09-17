import React, { useEffect, useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  FeDropShadow,
  Filter,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";

import { DANGER, SUCCESS, SURFACE, TEXT_MUTED, WARNING } from "../theme/tokens";

/**
 * The line draws itself in, left to right, as the page opens.
 *
 * Not by animating the stroke: `strokeDashoffset` through React Native's own
 * `Animated` stutters — it is not a transform, so every frame crosses to the
 * JS thread and rebuilds the path — and through Reanimated it took the app
 * down with an exception out of the SVG view.
 *
 * So the drawing is finished before it is shown, and a card-coloured cover
 * slides off it. One `translateX` on the UI thread, nothing inside the SVG
 * touched, and the line appears to be drawn because the eye cannot tell the
 * difference between a stroke arriving and a cover leaving.
 */
const DRAW_MS = 820;

/**
 * How long the page takes to slide in over it.
 *
 * The chart measures itself as soon as it is mounted, which is before the
 * screen it is on has finished pushing. Anything that starts then is partly
 * over by the time it can be seen.
 */
export const OPEN_MS = 320;

type Series = {
  values: number[];
  ink: string;
  /** How far outside its band each of this line's points sits, 0 if normal. */
  severity?: number[];
};

/** The ramp a reading takes as it leaves its band: edge, out, far out. */
const GRADE = ["#FACC15", "#F97316", "#FF383C"];

const hex = (c: string) => [
  parseInt(c.slice(1, 3), 16),
  parseInt(c.slice(3, 5), 16),
  parseInt(c.slice(5, 7), 16),
];

const mix = (a: string, b: string, t: number) => {
  const [ar, ag, ab] = hex(a);
  const [br, bg, bb] = hex(b);
  const to = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${to(ar, br)},${to(ag, bg)},${to(ab, bb)})`;
};

/**
 * The colour a point is drawn in.
 *
 * The metric's own ink while the reading is normal, then off the ramp: just
 * past the edge is yellow and it runs to red as the reading does. The step
 * out of the ink is deliberately abrupt — a reading is either inside its band
 * or it is not, and fading gently out of normal would blur the one boundary
 * that matters.
 */
export function shade(ink: string, severity: number): string {
  if (severity <= 0) return ink;
  const t = Math.min(1, severity) * (GRADE.length - 1);
  const i = Math.min(GRADE.length - 2, Math.floor(t));
  return mix(GRADE[i], GRADE[i + 1], t - i);
}

/**
 * The two ends of a "time in range" bar's gradient, by how the window went.
 *
 * One scale for all six readings rather than each metric's own ink. The bars
 * were drawn in the colour of the thing being measured — pressure red,
 * temperature blue, the monitor teal — so the same eighty per cent looked
 * alarming on one page and calm on the next, and the colour said which
 * reading it was rather than how it was doing. Here it says only the second:
 * green while the window held, amber once it slipped, red once it slipped
 * well past. Pale to deep across the bar, which is the shape it already had,
 * so only the hue has changed and not the weight.
 *
 * `holds` is the share each page counts as holding — ninety per cent for
 * oxygen, seventy for the continuous monitor — so the colour turns at the
 * same number the wording above it does, and the amber band is the twenty
 * points under that.
 */
export function rangeInk(inRange: number, holds: number): [string, string] {
  const ink =
    inRange >= holds ? SUCCESS : inRange >= holds - 0.2 ? WARNING : DANGER;
  return [tone(ink, 0.18), tone(ink, 0.68)];
}

/**
 * The metric's own colour, lightened or deepened: 0 is the palest, 1 the
 * deepest, and a half is the colour itself.
 *
 * For a fill that has to have some depth to it without saying anything. A bar
 * is a whole day and its length already says how far the day ranged; colouring
 * it by its worst hour as well says the same thing twice, and says it as an
 * alarm — a month of bars came out mostly orange, which is a month nobody
 * would look twice at because everything in it is shouting.
 */
export function tone(ink: string, t: number): string {
  const at = (v: number) => {
    const light = v + (255 - v) * 0.55;
    const deep = v * 0.66;
    return Math.round(
      t <= 0.5
        ? light + (v - light) * (t / 0.5)
        : v + (deep - v) * ((t - 0.5) / 0.5),
    );
  };
  const [r, g, b] = hex(ink);
  return `rgb(${at(r)},${at(g)},${at(b)})`;
}

/**
 * The same ramp as `shade`, run together rather than stepped.
 *
 * For a fill rather than a mark. `shade` steps out of the metric's colour the
 * moment a reading leaves its band, which is right for a dot or a length of
 * line — each of those is one reading, and one reading is either inside its
 * band or it is not. A bar is not one reading: it is the whole of a day, and
 * the colour has to change along it at the height the day crossed the line.
 * Stepped there it is a seam; run together it shows the crossing.
 *
 * By way of a pale tint rather than straight from one to the other. Mixed
 * directly, a blue and a yellow pass through the grey-green halfway between
 * them, and a bar with mud in the middle is worse than the seam. Washing that
 * midpoint out to a light tint is what lets the two run into each other.
 */
export function blend(ink: string, severity: number): string {
  const t = Math.min(1, Math.max(0, severity));
  const base = hex(ink);
  const warm = GRADE.map(hex);
  const pale = base.map((c, i) => {
    const mid = c + (warm[0][i] - c) * 0.5;
    return mid + (255 - mid) * 0.55;
  });

  const stops: [number, number[]][] = [
    [0, base],
    [0.16, pale],
    [0.38, warm[0]],
    [0.66, warm[1]],
    [1, warm[2]],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [from, a] = stops[i];
    const [to, b] = stops[i + 1];
    if (t > to) continue;
    const f = (t - from) / (to - from);
    const at = (k: number) => Math.round(a[k] + (b[k] - a[k]) * f);
    return `rgb(${at(0)},${at(1)},${at(2)})`;
  }
  return `rgb(${warm[2].join(",")})`;
}

/**
 * A curve through the points, as one cubic per span.
 *
 * The control points are pulled off the neighbours (Catmull-Rom) and then
 * clamped inside each span, so the curve never bulges past a reading and
 * invents a high the patient never had.
 */
export function curve(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  const t = 0.22;
  let d = `M ${pts[0].x} ${pts[0].y}`;

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const lo = Math.min(p1.y, p2.y);
    const hi = Math.max(p1.y, p2.y);
    const clamp = (v: number) => Math.min(hi, Math.max(lo, v));

    d += ` C ${p1.x + (p2.x - p0.x) * t} ${clamp(p1.y + (p2.y - p0.y) * t)}`;
    d += ` ${p2.x - (p3.x - p1.x) * t} ${clamp(p2.y - (p3.y - p1.y) * t)}`;
    d += ` ${p2.x} ${p2.y}`;
  }
  return d;
}

/**
 * The chart on a health card — Figma 371:45763.
 *
 * A line over a wash of its own colour that fades to nothing by the foot,
 * which is how the design draws every one of them. No axis and no gridlines;
 * the captions along the bottom are only there where the design puts them,
 * which is under the one chart wide enough to space seven of them out.
 */
export function Sparkline({
  series,
  height = 56,
  labels,
  plain,
}: {
  /**
   * One or two series — blood pressure is the only one with two.
   *
   * Two series are drawn as two lines, never as a bar spanning them: systolic
   * and diastolic are read as two trends, and the space between them is not
   * the measurement. That is how a blood pressure chart is read on a ward,
   * and a chart that invents a different convention is a chart that has to be
   * relearned before it can be trusted.
   */
  series: Series[];
  height?: number;
  /** Captions spread along the foot, first under the first point. */
  labels?: string[];
  /**
   * Draws the lines in their own colour and marks the readings that left
   * their band with a dot, instead of shading the line itself.
   *
   * For one line, shading is the quieter answer — the line says it itself and
   * nothing is added to the chart. For two it is not: two curves each changing
   * colour along their length is four things moving at once, and the chart
   * stops being readable at a glance. Blood pressure takes the dots.
   */
  plain?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width);

  const all = series.flatMap((s) => s.values);
  const ready = width > 0 && all.length > 1;

  // 0 while the cover still hides the whole chart, 1 once it has slid clear.
  const shown = useSharedValue(0);
  useEffect(() => {
    if (!ready) return;
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
  }, [ready, shown]);

  const wipe = useAnimatedStyle(() => ({
    transform: [{ translateX: shown.value * width }],
  }));

  const low = Math.min(...all);
  const high = Math.max(...all);
  // A floor under the span, so a week that never moved is a level line rather
  // than a division by zero.
  const span = Math.max(high - low, 0.001);

  const top = 4;
  const plotH = height - top - 4;
  const x = (i: number, n: number) => 2 + (i / (n - 1)) * (width - 4);
  const y = (v: number) => top + plotH - ((v - low) / span) * plotH;

  return (
    <View onLayout={onLayout}>
      {/* Clips the cover to the chart's own box, so it cannot wipe across
          anything else on the card. */}
      <View style={{ height, overflow: "hidden" }}>
        {ready && (
          <Svg width={width} height={height}>
            <Defs>
              {series.map((s, k) => (
                <React.Fragment key={k}>
                  {/*
                    The line's colour along its own length: a stop at every
                    reading, so a day that ran high is red where it happened
                    and the days either side of it are not.
                  */}
                  <LinearGradient id={`ink${k}`} x1="0" y1="0" x2="1" y2="0">
                    {s.values.map((v, i) => (
                      <Stop
                        key={i}
                        offset={
                          s.values.length === 1 ? 0 : i / (s.values.length - 1)
                        }
                        stopColor={
                          plain === true
                            ? s.ink
                            : shade(s.ink, s.severity?.[i] ?? 0)
                        }
                      />
                    ))}
                  </LinearGradient>
                  <LinearGradient id={`wash${k}`} x1="0" y1="0" x2="0" y2="1">
                    {/* Faint, and gone by the middle: the wash is there to seat
                        the line on the card, not to colour the card in. */}
                    <Stop offset="0" stopColor={s.ink} stopOpacity={0.12} />
                    <Stop offset="0.6" stopColor={s.ink} stopOpacity={0} />
                  </LinearGradient>
                  {/*
                    What lifts the line off the card.

                    A shadow in the line's own colour rather than a grey one:
                    grey under a coloured line reads as dirt, and the point is
                    depth, not weight. Cast short and soft — the line is
                    hovering a millimetre above the paper, not flying.
                  */}
                  <Filter
                    id={`lift${k}`}
                    x="-20%"
                    y="-30%"
                    width="140%"
                    height="180%"
                  >
                    <FeDropShadow
                      dx="0"
                      dy="2"
                      stdDeviation="1.8"
                      floodColor={s.ink}
                      floodOpacity="0.45"
                    />
                  </Filter>
                </React.Fragment>
              ))}
            </Defs>
            {series.map((s, k) => {
              const n = s.values.length;
              const pts = s.values.map((v, i) => ({ x: x(i, n), y: y(v) }));
              const line = curve(pts);
              return (
                <React.Fragment key={k}>
                  <Path
                    d={`${line} L ${pts[n - 1].x} ${height} L ${pts[0].x} ${height} Z`}
                    fill={`url(#wash${k})`}
                  />
                  {plain === true &&
                    s.values.map((v, i) =>
                      (s.severity?.[i] ?? 0) > 0 ? (
                        <Circle
                          key={`d${i}`}
                          cx={x(i, n)}
                          cy={y(v)}
                          r={2.5}
                          fill={shade(s.ink, s.severity?.[i] ?? 0)}
                          stroke={SURFACE}
                          strokeWidth={1}
                        />
                      ) : null,
                    )}
                  {/* The filter goes on the line itself, not on a copy
                      behind it: a renderer that declines it draws the line
                      unchanged and costs the shadow, where a separate copy
                      would come through as a second line. */}
                  <Path
                    d={line}
                    stroke={`url(#ink${k})`}
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    filter={`url(#lift${k})`}
                  />
                </React.Fragment>
              );
            })}
          </Svg>
        )}

        {/* The card's own white, sliding off to the right. */}
        {ready && (
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
        )}
      </View>

      {labels != null && labels.length > 1 && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 6,
          }}
        >
          {labels.map((l, i) => (
            <Text
              key={`${l}-${i}`}
              // The app's smallest body size, not the design's 8: nothing
              // else in the app is set below 10, and at 8 the captions were
              // a grey rule rather than a row of days.
              style={{ fontSize: 10, lineHeight: 14, color: TEXT_MUTED }}
            >
              {l}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
