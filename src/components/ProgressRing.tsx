import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Svg, { G, Line } from "react-native-svg";

import { TEXT_PRIMARY } from "../theme/tokens";

const SEGMENTS = 20;

/**
 * The ring's outside diameter.
 *
 * Everything else on the ring is derived from it — the tick lengths already
 * were, and now their weights and the margin are too, so the ring can be
 * resized in one place without the ticks coming out fat or thin for it.
 */
const SIZE = 120;

/** How far this ring is from the 132 the measurements below were drawn at. */
const K = SIZE / 132;

/** A tick's weight, and the gloss that rides the outer part of a lit one. */
const STROKE = 8 * K;
const GLOSS = 3 * K;

/**
 * Where a tick starts, as a fraction of where it ends.
 *
 * It sets both the band's thickness and, with it, the opening left in the
 * middle — the two trade against each other. At 0.80 the ticks are a short
 * 9.6pt and a 104pt ring keeps 77pt clear inside them, which gives the
 * figure air rather than sitting it in a slot.
 */
const BAND = 0.8;

/** Mixes two hex colours, `t` from 0 to 1. */
function mix(a: string, b: string, t: number): string {
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${c(r1, r2)},${c(g1, g2)},${c(b1, b2)})`;
}

/**
 * The day's progress as a ring of ticks.
 *
 * Twenty radial segments rather than a swept arc: at a glance the count of
 * lit ticks reads as "how much of today is done" more directly than an arc's
 * length, and each tick carries its own gloss so the ring has depth.
 */
export function ProgressRing({
  done,
  total,
}: {
  done: number;
  total: number;
}) {
  const fraction = total === 0 ? 0 : done / total;
  const percent = total === 0 ? 0 : Math.round((done * 100) / total);
  const target = Math.round(fraction * SEGMENTS);

  /**
   * The ticks light one after another when the ring appears, and the figure
   * counts up with them.
   *
   * Stepped on a timer that clears itself once the last tick is lit, not a
   * loop: an animation left running keeps the render loop awake, and this
   * screen has been warm before for exactly that reason. Once the ring is
   * full it costs nothing.
   */
  const [filled, setFilled] = useState(0);

  useEffect(() => {
    if (target === 0) {
      setFilled(0);
      return;
    }
    setFilled(0);
    let i = 0;
    // ~700ms across the whole sweep however many ticks it has to cover, so a
    // quiet day and a busy one take the same time to draw.
    const id = setInterval(() => {
      i += 1;
      setFilled(i);
      if (i >= target) clearInterval(id);
    }, Math.max(24, Math.round(700 / target)));
    return () => clearInterval(id);
  }, [target]);

  // The figure keeps step with the ticks, landing on the real percentage as
  // the last one lights.
  const shownPercent =
    target === 0 ? 0 : Math.round(percent * (filled / target));

  /**
   * The figure takes the ring's own colour, read across the whole ring
   * rather than across the lit arc — so it starts blue and travels towards
   * the mint the ticks end on as the day fills up, instead of jumping to
   * mint on the very first tick.
   */
  const numberColor =
    filled === 0 ? "#9AA0A6" : mix("#0088FF", "#5CE0B8", filled / SEGMENTS);

  // Half a stroke in from the edge, plus a point.
  //
  // The ticks are drawn with round caps, which put half the stroke's width
  // past the end of the line — measured to the radius alone the caps fell
  // outside the canvas and the ring came out flattened all the way round.
  const outer = SIZE / 2 - STROKE / 2 - 1;
  const inner = outer * BAND;
  const c = SIZE / 2;

  const ticks = Array.from({ length: SEGMENTS }, (_, i) => {
    // Start at twelve o'clock and run clockwise.
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / SEGMENTS;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const lit = i < filled;
    return {
      i,
      lit,
      x1: c + inner * cos,
      y1: c + inner * sin,
      x2: c + outer * cos,
      y2: c + outer * sin,
      // The gloss sits on the outer 55% of each lit tick.
      gx1: c + (outer - (outer - inner) * 0.45) * cos,
      gy1: c + (outer - (outer - inner) * 0.45) * sin,
      gx2: c + (outer - 1 * K) * cos,
      gy2: c + (outer - 1 * K) * sin,
      color: lit
        ? filled === 1
          ? "#0088FF"
          : mix("#0088FF", "#5CE0B8", i / (filled - 1))
        : "#D9D9D9",
    };
  });

  return (
    <View style={{ width: SIZE, height: SIZE }}>
      <Svg width={SIZE} height={SIZE}>
        <G>
          {ticks.map((t) => (
            <Line
              key={`t${t.i}`}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.color}
              strokeWidth={STROKE}
              strokeLinecap="round"
            />
          ))}
          {ticks
            .filter((t) => t.lit)
            .map((t) => (
              <Line
                key={`g${t.i}`}
                x1={t.gx1}
                y1={t.gy1}
                x2={t.gx2}
                y2={t.gy2}
                stroke="rgba(255,255,255,0.45)"
                strokeWidth={GLOSS}
                strokeLinecap="round"
              />
            ))}
        </G>
      </Svg>
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            // The app's headline figure size, which the smaller ring's
            // opening takes without crowding it.
            fontSize: 20,
            fontWeight: "800",
            color: numberColor,
            // Fixed width digits would be ideal; without them, centring the
            // text keeps the figure from shifting as it counts past 9 and 99.
            textAlign: "center",
            // The count runs against the ticks, so it needs to hold its own
            // against them.
            letterSpacing: -0.5,
          }}
        >
          {shownPercent}%
        </Text>
      </View>
    </View>
  );
}
