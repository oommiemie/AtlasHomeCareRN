import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
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
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import { OPEN_MS, blend, curve, shade, tone } from "./Sparkline";
import {
  breachOf,
  severityOf,
  severityOfPart,
  type MetricKind,
  type Reading,
} from "../models/vitals";
import { DANGER, SURFACE, TEXT_MUTED } from "../theme/tokens";

/**
 * Room on the left for three digits, under the plot for the clock, and on the
 * right for the halo around the newest reading — which is drawn at radius 11
 * on a point that sits at the very end of the line, so anything less than that
 * clips it against the edge of the drawing.
 */
const PAD = { left: 32, right: 14, top: 14, bottom: 20 };

/** The hour and the minute — what a day's worth of readings is read by. */
const clockStamp = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** How many gaps to divide the side into. Four gaps, five numbers. */
const Y_STEPS = 4;

/** How many times to write along the foot. */
const X_TICKS = 4;

/**
 * How much air to leave above and below whatever the window covers, in the
 * reading's own units.
 *
 * Twelve is a dozen mg/dl, which is what this was written for. A page whose
 * numbers live in a range of eight — oxygen spends its life between 92 and
 * 100 — says so, or its axis runs to a hundred and eleven per cent.
 */
const HEADROOM = 12;

/**
 * How finely the ramp up the chart is sampled.
 *
 * Enough that the step out of the band lands within a point or so of where it
 * belongs. That step is meant to be abrupt — a reading is either inside its
 * band or it is not — and too few samples smear it into a wash a third of the
 * chart tall.
 */
const RAMP_STOPS = 41;

/** How long the trace takes to draw itself in, matching the overview's. */
const DRAW_MS = 900;

/**
 * A detail page's trace, in the overview page's own hand, with a reading you
 * can pick out of it.
 *
 * One chart for every metric that has a page of its own. What changes between
 * them is the band a value is judged against and the way the foot is written —
 * hours under a day of readings, months under a year of them — and both of
 * those arrive as props. Nothing else about a chart of glucose differs from a
 * chart of oxygen, and two copies of this would have drifted apart by the
 * third page.
 *
 * Everything about the line — the curve through the points, the wash under
 * it, the shadow that lifts it, the shading where a reading left its band, the
 * cover that slides off as the page opens — is the same drawing the cards on
 * the overview use, and most of it is literally their code. A detail page that
 * drew its own kind of line would make the reader learn the chart twice.
 *
 * What this adds is what a detail page is for: the axis written out, a grid to
 * measure against, and a reading that can be picked. The picked value is read
 * out on the tile above rather than in a caption of its own — the tile is
 * already the page's readout, and a second one under the chart would be two
 * places to look for one number.
 *
 * The in-range band is not drawn here. It was, as a green strip; the summary
 * below the chart states the same thing as a percentage, and the strip forced
 * the axis to span the band whether the readings went near it or not.
 */
export function TrendChart({
  readings,
  kind,
  ink,
  ink2,
  plain = false,
  height = 220,
  picked,
  onPick,
  scale,
  headroom = HEADROOM,
  steps = Y_STEPS,
  stamp = clockStamp,
  mark = "line",
  bands,
  slots,
  slotAt,
  xOf,
  axisTicks,
  severityAt,
  breachAt,
  guides,
  focus,
}: {
  readings: Reading[];
  /** Which reading this is, so a value can be judged against its own band. */
  kind: MetricKind;
  ink: string;
  /**
   * The second reading's colour, where the metric has two numbers.
   *
   * Only blood pressure does. Given it, the chart draws the diastolic as a
   * second line over the systolic, on the one axis and picked by the one
   * touch: the pair is the reading — a hundred and forty over ninety is one
   * fact about a patient and two charts of it are two facts about nobody —
   * and the gap between the lines is itself worth seeing.
   *
   * The second line takes no wash of its own. Two washes over each other are
   * a third colour where they meet and neither where they do not, and the
   * ground under the chart is not what tells the two lines apart.
   */
  ink2?: string;
  /**
   * Draw in the reading's own colour, never in the verdict's.
   *
   * The chart's usual habit is to shade a line along its length off the
   * warning ramp — green through yellow to red as a reading leaves its band.
   * That reads well on one line, where the only thing the colour can be
   * saying is how the reading is doing.
   *
   * A pressure has two, and they are told apart by colour: the systolic red
   * and the diastolic purple, the design's own pair. Shade both off the ramp
   * and a bad fortnight turns them the same red, which is the moment the
   * chart stops saying which line is which — the one thing this chart has to
   * say before anything else. So the pair keeps its colours and the verdict
   * is left to the reading above, the band written under it, and the strip of
   * figures below. `Sparkline` takes the same view for the same reason.
   */
  plain?: boolean;
  height?: number;
  /** Which reading is being read out, or null for the latest. */
  picked: number | null;
  onPick: (index: number | null) => void;
  /**
   * The values the axis should span, whatever this window holds.
   *
   * Given so that every window is drawn against the same scale: read off the
   * window alone, three hours of steady readings fill the chart and six hours
   * of the same trace redraw it half the height, and switching between them
   * looks like the line moved when only the ruler did.
   */
  scale?: [number, number];
  /** Air above and below the window, in the reading's own units. */
  headroom?: number;
  /** How many gaps to divide the side into: one more label than gaps. */
  steps?: number;
  /**
   * How a point's time is written along the foot.
   *
   * A day of readings is told apart by the hour and a year of them by the
   * month, and a chart that wrote the hour under twelve months would repeat
   * "00:00" five times.
   */
  stamp?: (at: Date) => string;
  /**
   * A line through the readings, or the readings themselves.
   *
   * A line is right where the thing being drawn really is a curve and the
   * points are samples off it — a monitor reading every quarter of an hour.
   * Dots are right where each reading is a measurement in its own right: an
   * oximeter's hourly reading is a fact about that hour, not a point on a
   * curve, and a line drawn through them rounds the bottom off every dip,
   * which is the one thing that kind of trace is read for.
   *
   * Bars are for a window whose points are each a day rather than a moment: a
   * bar from that day's low to its high, which is the only drawing of a week
   * that does not throw the low away.
   */
  mark?: "line" | "dots" | "bars";
  /**
   * What each reading covered, for the bars — one to each of `readings`.
   *
   * The readings themselves stay the middle of each bar: they are what the
   * chart is scaled and picked by, and what the page reads out. This is the
   * spread around them.
   */
  bands?: { low: number; high: number }[];
  /**
   * How many places the chart is laid out over, when that is more than there
   * are readings for.
   *
   * A week is seven days whether or not they have all happened. Laid out over
   * the readings, the four days gone by fill the width and Wednesday sits at
   * the right-hand edge as if the week were over; laid out over the week,
   * they sit at its start with the rest of it empty ahead of them.
   */
  slots?: number;
  /** What date each of those places is, for writing under the empty ones. */
  slotAt?: (i: number) => Date;
  /**
   * Where along the plot each reading belongs, as a fraction of its width.
   *
   * Without it the readings are spread evenly and a point's place says only
   * which number it is in the list. That is right for a week of daily means —
   * one place per day, whether or not the day has happened. It is wrong for a
   * day: a pressure is taken twice, morning and evening, and spread evenly
   * those two sit at the ends of the chart as if the whole day ran between
   * them. Given the hour instead, they land where they were taken and the
   * empty afternoon between them is visible as an empty afternoon.
   *
   * The readings that already fill their day — the oximeter's twenty-four,
   * the monitor's ninety-six — land where they always did, because evenly
   * spaced from midnight is exactly where they were taken.
   */
  xOf?: (r: Reading) => number;
  /**
   * Fixed places along the foot, as fractions, with what to write under each.
   *
   * The foot is otherwise labelled from the readings themselves, which is
   * right where each place is a reading. A day is a ruler rather than a list:
   * it runs midnight to midnight whatever was taken during it, and the marks
   * on it are hours, not however many times somebody visited.
   */
  axisTicks?: { at: number; label: string }[];
  /**
   * How to judge a value, for a chart of something that is not one of the six.
   *
   * The readings are judged off `kind` against the band table they share.
   * BMI is not one of them — it is derived, it has its own cut-offs and it is
   * deliberately kept out of `MetricKind` — so its page hands its own
   * arithmetic in rather than having a seventh kind invented for it, which
   * would have put BMI on the register's tiles and in the AI summary's list
   * of readings.
   */
  severityAt?: (value: number, part: "first" | "second") => number;
  /** The same for which way a value left its band — see `severityAt`. */
  breachAt?: (value: number, part: "first" | "second") => "high" | "low" | null;
  /**
   * Lines across the plot at the values a reading is judged against.
   *
   * The chart has never drawn one: it says whether a reading left its band by
   * shading the line, which works while the band is a fact the reader already
   * has. On a page whose whole subject is a threshold — where 23 is the line
   * between "ปกติ" and "น้ำหนักเกิน" — a colour is the long way round to say
   * a number that could simply be drawn.
   *
   * Dashed and faint, behind everything: a ruler, not a reading.
   */
  guides?: { at: number; label?: string }[];
  /**
   * Which place is marked while none has been tapped.
   *
   * The last, unless the page has somewhere else it wants the eye. A page
   * whose date has been changed is asking about that date, and marking the
   * end of the chart instead would answer a question nobody asked.
   */
  focus?: number;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width);

  /**
   * The reading under the finger, while the finger is still down.
   *
   * Apart from the chosen one, because they answer different questions. The
   * chosen one is what the tile above is reading out and stays until it is
   * changed; this one is where the touch is right now, and goes the moment it
   * lifts. Without the difference there is no press to see — the mark for the
   * reading already chosen is the same mark, and dragging along the chart
   * feels like nothing is happening.
   */
  const [held, setHeld] = useState<number | null>(null);
  /**
   * The reading under a pointer that is not touching anything.
   *
   * A finger has no hover, so on a phone this stays null and costs nothing.
   * A trackpad or a pencil held above the glass does, and on those the chart
   * answers before it is pressed.
   */
  const [over, setOver] = useState<number | null>(null);

  /** How this chart judges a value: the caller's rule, or the metric's own. */
  const sevOf = (v: number, part: "first" | "second") =>
    severityAt != null
      ? severityAt(v, part)
      : part === "first"
        ? severityOf(kind, v)
        : severityOfPart(kind, v, "second");
  const brOf = (v: number, part: "first" | "second") =>
    breachAt != null ? breachAt(v, part) : breachOf(kind, v, part);

  const values = readings.map((r) => r.value);
  /**
   * The second number, where every reading in the window carries one.
   *
   * All or none: a line broken wherever a reading happened to be taken with
   * one cuff figure missing would read as the pressure having stopped.
   */
  const values2 =
    ink2 != null && readings.every((r) => r.value2 != null)
      ? readings.map((r) => r.value2 as number)
      : null;
  /**
   * Enough to draw at all.
   *
   * One reading is enough. It used to take two, because what the chart draws
   * is a line and a line needs somewhere to go — but the whole plot hung off
   * that, so a window holding a single reading came out as an empty card with
   * an axis on it rather than as a reading. A temperature is taken once a day
   * and a pressure twice; ask either for a day and that is exactly the window
   * you get. The point, its halo and the ruler behind it say what there is;
   * `drawable` below is what the line itself waits for.
   */
  const ready = width > 0 && values.length > 0;
  /** Two points, which is the least a line can be drawn through. */
  const drawable = values.length > 1;

  const shown = useSharedValue(0);
  // The first draw waits for the page to finish arriving; later ones do not.
  const arrived = useRef(false);

  useEffect(() => {
    if (!ready) return;

    /*
      The line draws itself in, on the way in and on every change of window.

      A new window is a different stretch of the same trace, and watching it
      drawn is how the reader sees what it covers: the eye follows the line
      from the oldest reading to the newest instead of being handed the whole
      shape at once. The grid it is drawn over holds still, so there is a
      ruler to read it against the whole way.
    */
    const first = !arrived.current;
    arrived.current = true;

    shown.value = 0;
    shown.value = withDelay(
      first ? OPEN_MS : 0,
      withTiming(1, { duration: DRAW_MS, easing: Easing.out(Easing.cubic) }),
    );
  }, [ready, shown, values.length]);

  const wipe = useAnimatedStyle(() => ({
    transform: [{ translateX: shown.value * width }],
  }));
  // The scale the caller fixed, or this window's own with a little air.
  // Both lines, where there are two: an axis fitted to the systolic alone
  // puts the diastolic off the foot of the chart.
  const spanning = values2 == null ? values : [...values, ...values2];
  const low = (scale?.[0] ?? Math.min(...spanning)) - headroom;
  const high = (scale?.[1] ?? Math.max(...spanning)) + headroom;
  const span = Math.max(high - low, 1);

  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;

  const bars = mark === "bars";
  /**
   * A bar owns a slice of the width rather than a point on it.
   *
   * A line's first and last points sit on the edges of the plot, which for a
   * bar would mean half of the first and last ones drawn outside it.
   */
  const count = Math.max(slots ?? values.length, values.length);
  const slot = plotW / Math.max(count, 1);
  /**
   * Thin, and the same thin whatever the window.
   *
   * A month's bars come out about five points wide because thirty of them
   * have to fit, and that width turned out to be the one worth keeping: at
   * the fourteen a week could afford they read as blocks, and the space
   * between them is what lets a run of days be seen as a shape rather than
   * counted one at a time. So the cap is the width a month lands on, and only
   * a window denser than a month goes under it.
   */
  const barW = Math.max(3, Math.min(6, slot * 0.55));

  const x = (i: number) =>
    bars
      ? PAD.left + slot * (i + 0.5)
      : xOf != null && readings[i] != null
        ? PAD.left + xOf(readings[i]) * plotW
        : PAD.left + (i / Math.max(count - 1, 1)) * plotW;
  const y = (v: number) => PAD.top + plotH - ((v - low) / span) * plotH;

  const pts = values.map((v, i) => ({ x: x(i), y: y(v) }));
  const line = drawable ? curve(pts) : "";
  const pts2 = values2?.map((v, i) => ({ x: x(i), y: y(v) })) ?? null;
  const line2 = drawable && pts2 != null ? curve(pts2) : "";

  const marks = mark === "dots";
  /** The one reading the chart is marking, whoever chose it. */
  const marked = Math.min(
    values.length - 1,
    Math.max(0, picked ?? focus ?? values.length - 1),
  );

  /**
   * Which points get written under the chart.
   *
   * A bar is named where there is room for its name; a line is measured at
   * quarters of its width, which is a ruler rather than a list.
   */
  /**
   * Which places get a line and a name under them.
   *
   * A window made of places — the seven days of a week, the days of a month —
   * is ruled at every one of them there is room for, so the grid is the
   * window's own divisions and every day of a week is named. A window that is
   * a run of readings rather than of places is measured at quarters of its
   * width instead, which is a ruler rather than a list.
   */
  const places = bars || slots != null;
  const ticks = places
    ? Array.from(
        {
          length: Math.ceil(count / Math.max(1, Math.ceil(30 / slot))),
        },
        (_, i) => i * Math.max(1, Math.ceil(30 / slot)),
      ).filter((i) => i < count)
    : Array.from({ length: X_TICKS + 1 }, (_, i) =>
        Math.round((i / X_TICKS) * Math.max(count - 1, 0)),
      );
  /**
   * How big a dot is: as big as the gap between two of them allows.
   *
   * A day of readings is two dozen points across three hundred, and a dot can
   * be a proper mark; a week is a hundred and sixty and it cannot. Rather than
   * give up on dots at that density, they shrink — overlapping into a band
   * that reads as how much of the week was spent where, with the readings
   * that left their band still drawn full size on top of it.
   */
  const dotR = Math.max(
    1.6,
    Math.min(4.5, (plotW / Math.max(count - 1, 1)) * 0.42),
  );
  const area = drawable
    ? `${line} L ${pts[pts.length - 1].x} ${height} L ${pts[0].x} ${height} Z`
    : "";
  const area2 =
    drawable && pts2 != null && line2 !== ""
      ? `${line2} L ${pts2[pts2.length - 1].x} ${height} L ${pts2[0].x} ${height} Z`
      : "";

  /**
   * The reading nearest the finger.
   *
   * A tap on the reading already chosen clears it, which is the way back to
   * the latest value — the page carried a button for that and it read as a
   * label rather than a control. Only a tap toggles: a drag passes over the
   * chosen point on its way somewhere else, and clearing there would drop the
   * selection mid-sweep.
   */
  /** Which reading sits under a point across the chart. */
  const nearest = (at: number) => {
    const raw = bars
      ? Math.floor((at - PAD.left) / slot)
      : Math.round(((at - PAD.left) / plotW) * Math.max(count - 1, 1));
    return Math.min(values.length - 1, Math.max(0, raw));
  };

  const pick = (e: GestureResponderEvent, toggle = false) => {
    if (!ready) return;
    const i = nearest(e.nativeEvent.locationX);
    setHeld(i);
    onPick(toggle && i === picked ? null : i);
  };

  /** Where a pointer is, when it is one that can be somewhere without pressing. */
  const hover = (e: { nativeEvent: object }) => {
    if (!ready) return;
    const at = e.nativeEvent as {
      offsetX?: number;
      x?: number;
      pointerType?: string;
    };
    // A touch is not a hover: it arrives here too, and left alone it would
    // light up the point the finger is already pressing, twice over.
    if (at.pointerType === "touch") return;
    const px = at.offsetX ?? at.x;
    if (px == null) return;
    setOver(nearest(px));
  };

  return (
    <View onLayout={onLayout}>
      <View
        style={{ height, overflow: "hidden" }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => pick(e, true)}
        onResponderMove={(e) => pick(e)}
        onResponderRelease={() => setHeld(null)}
        onResponderTerminate={() => setHeld(null)}
        onPointerMove={hover}
        onPointerLeave={() => setOver(null)}
      >
        {ready && (
          <>
            {/*
              The grid and the axis, in a layer of their own that does not
              move.

              The ruler has to hold still while the line is zoomed against it,
              or the numbers slide past the values they label and the whole
              measurement stops meaning anything.
            */}
            <Svg
              width={width}
              height={height}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            >
              {Array.from({ length: steps + 1 }, (_, i) => {
                const v = low + (span * i) / steps;
                return (
                  <React.Fragment key={`y${i}`}>
                    <Line
                      x1={PAD.left}
                      y1={y(v)}
                      x2={width - PAD.right}
                      y2={y(v)}
                      stroke="#000000"
                      strokeWidth={1}
                      opacity={0.05}
                    />
                    <SvgText
                      x={PAD.left - 6}
                      y={y(v) + 3.5}
                      fontSize={10}
                      fill={TEXT_MUTED}
                      textAnchor="end"
                    >
                      {v.toFixed(0)}
                    </SvgText>
                  </React.Fragment>
                );
              })}

              {/* A ruler of its own, where the caller gave one: fixed places
                  along the foot rather than one under each reading. */}
              {/* The thresholds, across the plot and behind everything on
                  it. Only the ones the axis actually covers — a line for 23
                  drawn off the top of a chart that starts at 26 is a label
                  floating over nothing. */}
              {guides
                ?.filter((g) => g.at > low && g.at < high)
                .map((g, i) => (
                  <React.Fragment key={`g${i}`}>
                    <Line
                      x1={PAD.left}
                      y1={y(g.at)}
                      x2={PAD.left + plotW}
                      y2={y(g.at)}
                      stroke={TEXT_MUTED}
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      opacity={0.35}
                    />
                    {g.label != null && (
                      <SvgText
                        x={PAD.left + plotW}
                        y={y(g.at) - 4}
                        fontSize={9}
                        fill={TEXT_MUTED}
                        textAnchor="end"
                      >
                        {g.label}
                      </SvgText>
                    )}
                  </React.Fragment>
                ))}

              {axisTicks?.map((t, i) => {
                const px = PAD.left + t.at * plotW;
                return (
                  <React.Fragment key={`h${i}`}>
                    <Line
                      x1={px}
                      y1={PAD.top}
                      x2={px}
                      y2={PAD.top + plotH}
                      stroke="#000000"
                      strokeWidth={1}
                      opacity={0.05}
                    />
                    <SvgText
                      x={px}
                      y={height - 6}
                      fontSize={10}
                      fill={TEXT_MUTED}
                      textAnchor={
                        i === 0
                          ? "start"
                          : i === axisTicks.length - 1
                            ? "end"
                            : "middle"
                      }
                    >
                      {t.label}
                    </SvgText>
                  </React.Fragment>
                );
              })}

              {axisTicks == null && ticks.map((at, i) => (
                <React.Fragment key={`x${i}`}>
                  {/* Between the bars, not through them: an upright drawn up
                      the middle of a bar reads as part of the bar rather than
                      as a ruler behind it, so in that mode the line moves to
                      the edge of the place the bar stands in. */}
                  <Line
                    x1={bars ? PAD.left + slot * at : x(at)}
                    y1={PAD.top}
                    x2={bars ? PAD.left + slot * at : x(at)}
                    y2={PAD.top + plotH}
                    stroke="#000000"
                    strokeWidth={1}
                    opacity={0.05}
                  />
                  <SvgText
                    x={x(at)}
                    y={height - 6}
                    fontSize={10}
                    fill={TEXT_MUTED}
                    textAnchor={
                      bars
                        ? "middle"
                        : i === 0
                          ? "start"
                          : i === ticks.length - 1
                            ? "end"
                            : "middle"
                    }
                  >
                    {stamp(readings[at]?.at ?? slotAt?.(at) ?? readings[0].at)}
                  </SvgText>
                </React.Fragment>
              ))}
            </Svg>

            <View style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
              <Svg width={width} height={height}>
                <Defs>
                  {/* The line's colour along its own length, off the same ramp
                  the overview shades with: green while the reading is in the
                  band, then yellow to red as it leaves it. */}
                  <LinearGradient id="trendInk" x1="0" y1="0" x2="1" y2="0">
                    {values.map((v, i) => (
                      <Stop
                        key={i}
                        offset={i / (values.length - 1)}
                        stopColor={plain ? ink : shade(ink, sevOf(v, "first"))}
                      />
                    ))}
                  </LinearGradient>
                  {/* The same ramp for the second line, but judged against
                  the second number's own band: ninety is the edge for a
                  diastolic and nowhere near it for a systolic, and one
                  threshold read across both would shade the pair wrong in
                  opposite directions. */}
                  {values2 != null && ink2 != null && (
                    <LinearGradient id="trendInk2" x1="0" y1="0" x2="1" y2="0">
                      {values2.map((v, i) => (
                        <Stop
                          key={i}
                          offset={i / (values2.length - 1)}
                          stopColor={
                            plain
                              ? ink2
                              : shade(ink2, sevOf(v, "second"))
                          }
                        />
                      ))}
                    </LinearGradient>
                  )}
                  {/* Fainter than the cards', and gone sooner.
                  
                  The same 12% over a chart three times as tall is three times
                  as much colour on the page, and here it has a green band to
                  share the space with. */}
                  {/*
                    The colour of a mark, at every height.

                    One ramp for the whole plot rather than one per mark, and
                    laid out in the chart's own coordinates, so a colour means
                    the same thing everywhere on it. A gradient per bar would
                    run its own two ends together and put the same colour at a
                    different reading in each of them.

                    A dot takes the ramp that says whether the reading left
                    its band: a dot is one reading, and that is a fact about
                    it. A bar does not. A bar is a whole day, its length
                    already says how far the day ranged, and colouring it by
                    its worst hour on top of that turns a month into a wall of
                    orange — which is not a warning, because everything in it
                    is warning. It takes the metric's own colour instead, pale
                    at the top and deep at the foot.
                  */}
                  {mark !== "line" && (
                    <LinearGradient
                      id="valueInk"
                      gradientUnits="userSpaceOnUse"
                      x1="0"
                      y1={y(high)}
                      x2="0"
                      y2={y(low)}
                    >
                      {Array.from({ length: RAMP_STOPS }, (_, k) => {
                        const t = k / (RAMP_STOPS - 1);
                        return (
                          <Stop
                            key={k}
                            offset={t}
                            stopColor={
                              bars
                                ? tone(ink, t)
                                : blend(
                                    ink,
                                    sevOf(high + (low - high) * t, "first"),
                                  )
                            }
                          />
                        );
                      })}
                    </LinearGradient>
                  )}
                  <LinearGradient id="trendWash" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={ink} stopOpacity={0.06} />
                    <Stop offset="0.45" stopColor={ink} stopOpacity={0} />
                  </LinearGradient>
                  {/* The lower line's own ground, on the same terms.
                  
                  It was left bare on the reasoning that two washes over each
                  other make a third colour where they meet. At six per cent
                  fading out by the halfway mark they do not — what they make
                  is a slightly deeper foot to the chart — and a line with
                  nothing under it next to one with something reads as the
                  lesser of the two, which the diastolic is not. */}
                  {ink2 != null && (
                    <LinearGradient id="trendWash2" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor={ink2} stopOpacity={0.06} />
                      <Stop offset="0.45" stopColor={ink2} stopOpacity={0} />
                    </LinearGradient>
                  )}
                  <Filter
                    id="trendLift"
                    x="-20%"
                    y="-30%"
                    width="140%"
                    height="180%"
                  >
                    <FeDropShadow
                      dx="0"
                      dy="2"
                      stdDeviation="1.8"
                      floodColor={ink}
                      floodOpacity="0.45"
                    />
                  </Filter>
                </Defs>

                {/*
                  The line, and the ground under it — only where the reading
                  is a curve. A wash with no line over it is the shadow of
                  something that is not there.
                */}
                {mark === "line" && (
                  <>
                    <Path d={area} fill="url(#trendWash)" />
                    {area2 !== "" && (
                      <Path d={area2} fill="url(#trendWash2)" />
                    )}
                    <Path
                      d={line}
                      stroke="url(#trendInk)"
                      strokeWidth={2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      filter="url(#trendLift)"
                    />
                    {/*
                      The diastolic, over the systolic and under everything
                      the chart marks with.

                      A hair thinner and with no lift under it: the pair is
                      read from the top line down — that is the number a
                      pressure is named by and the one the band is judged on
                      first — and two lines of equal weight left the eye with
                      no way in. It is still the same ramp and the same
                      shading, so a diastolic that has left its own band says
                      so as loudly as a systolic would.
                    */}
                    {line2 !== "" && (
                      <Path
                        d={line2}
                        stroke="url(#trendInk2)"
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    )}
                  </>
                )}

                {/*
                  A red dot on every reading that broke its band.

                  With the warning ramp off there is nothing in the colour of
                  a line to say a reading went out, and on a pair there must
                  not be: the colours are what tell the systolic from the
                  diastolic. So the fact is put in a mark instead.

                  On the reading, not above or below it. This was arrows for a
                  while, set off the point in the direction it failed, and the
                  direction turned out to be the least of what a reader wants
                  from it — a mark standing clear of the line has to be traced
                  back to the point it belongs to, and on two lines close
                  together that is a guess. A dot sitting on the line is the
                  reading, so which line it is and which reading it is are
                  both answered by where it sits. Which way it failed is still
                  there to be read off the chart's own axis.

                  Small: a hair thicker than the line it sits on, and no
                  more. It was drawn at four with a heavy white ring, which
                  came to eleven points across — bigger than the reading it
                  was marking, and a run of bad days turned into a row of
                  buttons laid over the trace. What the mark has to do is be
                  seen, not be counted from across the room.

                  So: a touch wider than the 2.2 stroke, with a hairline of
                  white around it. The cap is what sets it in practice — the
                  chart's own `dotR` only drops below this once a window
                  carries more than about fifty points — but it is read
                  through `dotR` anyway so that a denser window than any of
                  these can still close the mark down rather than have a run
                  of them run together.
                */}
                {plain &&
                  readings.map((r, i) => {
                    const out: { v: number }[] = [];
                    if (brOf(r.value, "first") != null) out.push({ v: r.value });
                    if (
                      r.value2 != null &&
                      ink2 != null &&
                      brOf(r.value2, "second") != null
                    )
                      out.push({ v: r.value2 });
                    return out.map((m, k) => (
                      <Circle
                        key={`b${i}-${k}`}
                        cx={x(i)}
                        cy={y(m.v)}
                        r={Math.max(1.6, Math.min(dotR, 2.2))}
                        fill={DANGER}
                        stroke="#FFFFFF"
                        strokeWidth={0.9}
                      />
                    ));
                  })}

                {/*
                  A bar from each day's low to its high.

                  Rounded at both ends, because the ends are readings and not
                  a floor the bar is standing on. Filled off the chart's own
                  ramp rather than in one flat colour, so the bar says where in
                  the day's range the reading left its band: blue at the top
                  and red at the foot is a day that was fine except at its
                  worst, which is what an overnight dip is.
                */}
                {bars &&
                  bands != null &&
                  bands.map((b, i) => {
                    const top = y(b.high);
                    const foot = y(b.low);
                    // A day whose readings never moved still has to be a bar
                    // rather than a hairline, so the shortest one is a round
                    // end on a round end.
                    const h = Math.max(foot - top, barW);
                    const mid = (top + foot) / 2;
                    return (
                      <Rect
                        key={`b${i}`}
                        x={x(i) - barW / 2}
                        y={mid - h / 2}
                        width={barW}
                        height={h}
                        rx={barW / 2}
                        fill="url(#valueInk)"
                      />
                    );
                  })}

                {/*
                  A dot per reading, and nothing joining them.

                  Every dot the same: one size, one weight, and the colour
                  the only thing that changes — and the colour comes off the
                  chart's own ramp, at the height the dot sits at, so a dot
                  and the foot of a bar at the same reading are the same
                  colour on either side of a tab.

                  A reading that left its band was drawn larger with a wash
                  spreading out of it, which made the chart a set of blooms
                  rather than a set of readings — and size that means the same
                  thing as colour is one signal charged for twice.
                */}
                {marks &&
                  values.map((v, i) => {
                    if (i === marked) return null;
                    const dense = dotR <= 2.4;
                    return (
                      <Circle
                        key={`d${i}`}
                        cx={x(i)}
                        cy={y(v)}
                        r={dotR}
                        fill="url(#valueInk)"
                        // Where they are too close to separate, they stop
                        // being marks and become a density: no ring to run
                        // into the next one, and light enough to read through.
                        opacity={dense ? 0.55 : 1}
                        stroke={dense ? undefined : SURFACE}
                        strokeWidth={dense ? 0 : 1.2}
                      />
                    );
                  })}

                {/*
                  The reading being read out, and how hard it is being read.

                  One mark, in three states rather than three marks. At rest
                  it is the newest reading, or the one chosen: a dot with a
                  halo under it, the way the app marks the end of a line
                  elsewhere. Under a pointer it gains a ring, drawn as an
                  outline rather than a wash so it reads as something the
                  interface put there and not as something about the reading.
                  Under a finger it grows into that ring and the guide firms
                  up, so the press has somewhere to land.

                  Two dots would leave the reader working out which of them
                  the number above belonged to, so there is only ever one.
                */}
                {(() => {
                  const i = marked;
                  const band = bands?.[i];
                  // A bar is ringed in the metric's own colour: the ring
                  // says which bar is being read, not what it says.
                  const paint =
                    bars || plain
                      ? ink
                      : shade(ink, sevOf(values[i], "first"));
                  const live = held === i;
                  const lit = live || over === i;
                  const cx = x(i);
                  const cy = y(values[i]);

                  // A bar is marked by being ringed rather than by having a
                  // dot put on it: the bar is already the mark, and a dot at
                  // its middle would read as a reading that was never taken.
                  if (bars && band != null) {
                    const top = y(band.high);
                    const foot = y(band.low);
                    const h = Math.max(foot - top, barW);
                    const mid = (top + foot) / 2;
                    const pad = live ? 4.5 : 3.5;
                    return (
                      <Rect
                        x={cx - barW / 2 - pad}
                        y={mid - h / 2 - pad}
                        width={barW + pad * 2}
                        height={h + pad * 2}
                        rx={barW / 2 + pad}
                        fill="none"
                        stroke={paint}
                        strokeWidth={live ? 1.8 : 1.4}
                        opacity={live ? 0.75 : lit ? 0.55 : 0.35}
                      />
                    );
                  }

                  return (
                    <>
                      {/* The guide, up to the reading: dashed while the point
                          is merely chosen, and firmer under the finger. */}
                      {(picked != null || live) && (
                        <Line
                          x1={cx}
                          y1={PAD.top}
                          x2={cx}
                          y2={PAD.top + plotH}
                          stroke={live ? paint : TEXT_MUTED}
                          strokeWidth={1}
                          strokeDasharray="3 3"
                          opacity={live ? 0.55 : 1}
                        />
                      )}

                      {/*
                        The diastolic's own point, where there are two lines.

                        The one-dot rule above is what a single reading needs:
                        two marks and one number over them is a question. A
                        pressure reads out as both its numbers, so the second
                        mark has one to belong to — and without it the lower
                        line is the only thing on the chart the touch does not
                        answer for. Small, ringed in the page's own white so
                        it stays legible where the lines close up, and no halo:
                        the halo is what says which point is being read, and
                        there is still only one of those.
                      */}
                      {values2 != null && ink2 != null && (
                        <Circle
                          cx={cx}
                          cy={y(values2[i])}
                          r={live ? 5 : 4.2}
                          fill={
                            plain
                              ? ink2
                              : shade(ink2, sevOf(values2[i], "second"))
                          }
                          stroke="#FFFFFF"
                          strokeWidth={1.4}
                        />
                      )}

                      <Circle
                        cx={cx}
                        cy={cy}
                        r={live ? 14 : 11}
                        fill={paint}
                        opacity={live ? 0.22 : 0.16}
                      />

                      {/* Drawn on the halo's own edge rather than inside it:
                          the soft disc gains a rim, which is one mark
                          sharpening rather than a second appearing. */}
                      {lit && (
                        <Circle
                          cx={cx}
                          cy={cy}
                          r={live ? 14 : 11}
                          fill="none"
                          stroke={paint}
                          strokeWidth={live ? 1.6 : 1.2}
                          opacity={live ? 0.7 : 0.45}
                        />
                      )}

                      <Circle
                        cx={cx}
                        cy={cy}
                        r={live ? 6.6 : 5.5}
                        fill={paint}
                        stroke={SURFACE}
                        strokeWidth={2.5}
                      />
                    </>
                  );
                })()}

                {/*
                  And the reading a pointer is over but has not chosen: a ring
                  where the dot is, and nothing else. It is a question — is
                  this the one? — rather than an answer, so it is drawn as an
                  outline and the reading above does not change.
                */}
                {over != null &&
                  over !== marked &&
                  (bars && bands?.[over] != null ? (
                    <Rect
                      x={x(over) - barW / 2 - 3.5}
                      y={
                        (y(bands[over].high) + y(bands[over].low)) / 2 -
                        Math.max(
                          y(bands[over].low) - y(bands[over].high),
                          barW,
                        ) /
                          2 -
                        3.5
                      }
                      width={barW + 7}
                      height={
                        Math.max(
                          y(bands[over].low) - y(bands[over].high),
                          barW,
                        ) + 7
                      }
                      rx={barW / 2 + 3.5}
                      fill="none"
                      stroke={ink}
                      strokeWidth={1.2}
                      opacity={0.45}
                    />
                  ) : (
                    <Circle
                      cx={x(over)}
                      cy={y(values[over])}
                      r={Math.max(dotR, 3) + 4}
                      fill="none"
                      stroke={plain ? ink : shade(ink, sevOf(values[over], "first"))}
                      strokeWidth={1.2}
                      opacity={0.45}
                    />
                  ))}
              </Svg>

              {/* The card's own white, sliding off to the right — over the
                  line alone, so the grid under it is never hidden. */}
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
            </View>
          </>
        )}
      </View>
    </View>
  );
}
