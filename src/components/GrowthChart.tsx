import { useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import Svg, {
  Circle,
  Line,
  Path,
  Polyline,
  Text as SvgText,
} from "react-native-svg";

import { weightBandAt, type Sex } from "../models/growth";
import { tr } from "../i18n";
import {
  DANGER_INK,
  INK_OK,
  PRIMARY_500,
  SEPARATOR,
  SPACE,
  SURFACE,
  TEXT_DISABLED,
  TEXT_MUTED,
  TEXT_SECONDARY,
} from "../theme/tokens";

/** One weighing, as the chart plots it. */
export type Plot = { months: number; kg: number };

/**
 * How far the chart runs.
 *
 * Six years for a nursery round and twelve for a school one — the axis is
 * chosen for the child rather than fixed, because a seven-year-old plotted
 * on a nought-to-six chart is a dot jammed against the right-hand edge with
 * nowhere for next term's to go, and a two-year-old on a nought-to-twelve
 * chart is three dots in the first sixth of it.
 */
const spanFor = (months: number) => (months > 66 ? 144 : 72);

/**
 * Room for the labels, and only for the labels.
 *
 * The plot used to reserve exactly this much and then draw nothing in it,
 * which is why the chart read as a grey box with some lines adrift in the
 * middle of it: no weight down the side, no age along the foot, nothing to
 * read a dot against.
 */
const PAD = { top: 14, right: 12, bottom: 22, left: 34 };

/** A step for the weight axis that lands on numbers a person would say. */
function niceStep(top: number): number {
  const rough = top / 3;
  for (const step of [2, 5, 10, 20, 25, 50]) if (rough <= step) return step;
  return 100;
}

/**
 * กราฟน้ำหนักตามเกณฑ์อายุ — the printed chart, as the parent reads it.
 *
 * The verdict rows above it already say −2.1 SD in words. This says the
 * thing the words cannot: which way the child is going. A single reading
 * under the line is a thin child; three readings walking down out of the
 * band is a child nobody has got to yet, and that is the difference between
 * advice and a visit.
 *
 * It is also the half of the form a parent can be shown, and that is what
 * the shading is for. "น้ำหนัก/อายุ น้อยกว่าเกณฑ์" means nothing across a
 * table in a nursery hall; a dot that has walked out of the green does. The
 * band between the two dashed lines is the whole of the normal range, so
 * being inside it is a thing you can see rather than a number you have to
 * be told.
 *
 * The child's own line is the app's blue, not red. It was red for every
 * child, which made a chart of a perfectly healthy four-year-old look like
 * an alarm; the line is just this child's data, and the only thing that
 * turns red is the latest dot, and only when it has actually left the band.
 */
export function GrowthChart({
  sex,
  points,
  height = 186,
}: {
  sex: Sex;
  /** The child's own weighings, oldest first. */
  points: Plot[];
  height?: number;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width);

  // The oldest reading on the chart decides how far the axis has to run.
  const SPAN = spanFor(points.reduce((m, p) => Math.max(m, p.months), 0));

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;

  /*
    The scale, taken from the reference rather than from the data.

    A chart auto-scaled to whatever this child weighs would redraw its axis
    for every child in the room, and the shape of the band — the thing being
    read — would look the same for a healthy four-year-old and a wasted one.
    So the top is the +2SD line at the end of the axis, rounded up to the
    next label, and the bottom is nought.
  */
  const step = niceStep(weightBandAt(sex, SPAN).hi);
  const top = Math.ceil((weightBandAt(sex, SPAN).hi + 1) / step) * step;

  const x = (months: number) =>
    PAD.left + (Math.min(months, SPAN) / SPAN) * plotW;
  const y = (kg: number) => PAD.top + plotH - (Math.min(kg, top) / top) * plotH;

  /** One reference line, sampled every three months. */
  const curve = (pick: (m: number) => number) => {
    const steps: string[] = [];
    for (let m = 0; m <= SPAN; m += 3) {
      steps.push(`${steps.length === 0 ? "M" : "L"}${x(m)} ${y(pick(m))}`);
    }
    return steps.join(" ");
  };

  /*
    The normal range as a shape, not as two lines with a gap between them.

    Down the upper limit and back along the lower one, closed — which is the
    only way to fill between two curves in SVG, and the reason the band can
    be read at a glance rather than worked out.
  */
  const band = () => {
    const up: string[] = [];
    const down: string[] = [];
    for (let m = 0; m <= SPAN; m += 3) {
      up.push(
        `${up.length === 0 ? "M" : "L"}${x(m)} ${y(weightBandAt(sex, m).hi)}`,
      );
      down.unshift(`L${x(m)} ${y(weightBandAt(sex, m).lo)}`);
    }
    return `${up.join(" ")} ${down.join(" ")} Z`;
  };

  const drawable = plotW > 0 && plotH > 0;
  const dots = points.map((p) => ({
    x: x(p.months),
    y: y(p.kg),
    kg: p.kg,
    // Outside the printed lines, which is the one thing a dot can say by
    // itself and the only thing worth colouring it for.
    out:
      p.kg < weightBandAt(sex, p.months).lo ||
      p.kg > weightBandAt(sex, p.months).hi,
  }));
  const last = dots[dots.length - 1];

  const years = Array.from({ length: SPAN / 12 + 1 }, (_, k) => k);
  const ticks = Array.from(
    { length: Math.floor(top / step) + 1 },
    (_, k) => k * step,
  );

  return (
    <View style={{ gap: SPACE.sm }}>
      <View onLayout={onLayout} style={{ height }}>
        {drawable && (
          <Svg width={width} height={height}>
            {/* The normal range, filled. Everything else is drawn over it. */}
            <Path d={band()} fill="rgba(21,128,61,0.08)" />

            {/* The grid: a line at every weight label and every birthday,
                at a weight that cannot be mistaken for a reference line. */}
            {ticks.map((t) => (
              <Line
                key={`h${t}`}
                x1={PAD.left}
                y1={y(t)}
                x2={PAD.left + plotW}
                y2={y(t)}
                stroke={SEPARATOR}
                strokeWidth={1}
              />
            ))}
            {years.map((yr) => (
              <Line
                key={`v${yr}`}
                x1={x(yr * 12)}
                y1={PAD.top}
                x2={x(yr * 12)}
                y2={PAD.top + plotH}
                stroke={SEPARATOR}
                strokeWidth={1}
              />
            ))}

            {/* ±2SD dashed, the median solid between them. Dashes because
                they are limits rather than values: nothing is supposed to
                sit on them. */}
            <Path
              d={curve((m) => weightBandAt(sex, m).hi)}
              stroke={INK_OK}
              strokeOpacity={0.45}
              strokeWidth={1.2}
              strokeDasharray="5 4"
              fill="none"
            />
            <Path
              d={curve((m) => weightBandAt(sex, m).lo)}
              stroke={INK_OK}
              strokeOpacity={0.45}
              strokeWidth={1.2}
              strokeDasharray="5 4"
              fill="none"
            />
            <Path
              d={curve((m) => weightBandAt(sex, m).median)}
              stroke={TEXT_SECONDARY}
              strokeOpacity={0.55}
              strokeWidth={1.4}
              fill="none"
            />

            {/* The weight axis, down the side. */}
            {ticks.map((t) => (
              <SvgText
                key={`ty${t}`}
                x={PAD.left - 6}
                y={y(t) + 3.5}
                fontSize={9}
                fill={TEXT_MUTED}
                textAnchor="end"
              >
                {String(t)}
              </SvgText>
            ))}

            {/* And the years along the foot. */}
            {years.map((yr) => (
              <SvgText
                key={`tx${yr}`}
                x={x(yr * 12)}
                y={PAD.top + plotH + 14}
                fontSize={9}
                fill={TEXT_MUTED}
                textAnchor="middle"
              >
                {String(yr)}
              </SvgText>
            ))}

            {/* And the child, on top of all of it. */}
            {dots.length > 1 && (
              <Polyline
                points={dots.map((d) => `${d.x},${d.y}`).join(" ")}
                stroke={PRIMARY_500}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            )}
            {/* The readings before this one, plain. The newest is drawn
                below, with a ring, so it is never covered by the line or
                by the dot before it. */}
            {dots.slice(0, -1).map((d, i) => (
              <Circle
                key={i}
                cx={d.x}
                cy={d.y}
                r={3}
                fill={d.out ? DANGER_INK : PRIMARY_500}
              />
            ))}
            {last != null && (
              <>
                {/* A ring around the newest reading, so it stands off the
                    line it ends and off whatever it is sitting on. */}
                <Circle cx={last.x} cy={last.y} r={6.5} fill={SURFACE} />
                <Circle
                  cx={last.x}
                  cy={last.y}
                  r={4.5}
                  fill={last.out ? DANGER_INK : PRIMARY_500}
                />
                {/* The number, beside the dot. A chart that has to be
                    measured against its own axis to give a weight is a
                    chart somebody reads the table instead of. */}
                <SvgText
                  x={Math.min(last.x + 9, PAD.left + plotW)}
                  y={last.y - 9}
                  fontSize={11}
                  fontWeight="700"
                  fill={last.out ? DANGER_INK : PRIMARY_500}
                  textAnchor={last.x > PAD.left + plotW - 40 ? "end" : "start"}
                >
                  {tr(`${last.kg.toFixed(1)} กก.`, `${last.kg.toFixed(1)} kg`)}
                </SvgText>
              </>
            )}
          </Svg>
        )}
      </View>

      {/* What the shapes mean, in the order the eye meets them. */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: SPACE.md,
        }}
      >
        <Key ink="rgba(21,128,61,0.28)" label={tr("ช่วงปกติ (±2SD)", "Normal range (±2SD)")} solid />
        <Key ink={TEXT_DISABLED} label={tr("ค่ากลาง", "Median")} />
        <Key ink={PRIMARY_500} label={tr("เด็กรายนี้", "This child")} />
      </View>
      <Text style={{ fontSize: 11, lineHeight: 18, color: TEXT_MUTED }}>
        {tr(
          "แกนนอน = อายุ (ปี) · แกนตั้ง = น้ำหนัก (กก.) · รวมค่าที่กำลังกรอก",
          "Horizontal = age (years) · Vertical = weight (kg) · Includes the value being entered",
        )}
      </Text>
    </View>
  );
}

/** One entry in the key: a mark the size of the thing it stands for. */
function Key({
  ink,
  label,
  solid,
}: {
  ink: string;
  label: string;
  solid?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <View
        style={{
          width: solid === true ? 14 : 12,
          height: solid === true ? 10 : 3,
          borderRadius: solid === true ? 3 : 2,
          backgroundColor: ink,
        }}
      />
      <Text style={{ fontSize: 11, lineHeight: 17, color: TEXT_MUTED }}>
        {label}
      </Text>
    </View>
  );
}
