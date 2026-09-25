import { useEffect, useState, type ReactNode } from "react";
import { Text, View, type TextStyle } from "react-native";
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
  G,
  LinearGradient,
  Rect,
  Stop,
} from "react-native-svg";

import { Card } from "./Card";
import { Glass } from "./Glass";
import { useIsFocused } from "@react-navigation/native";

import { currentDisplay } from "../models/display";
import {
  PRIMARY_500,
  RADIUS,
  SPACE,
  SURFACE,
  SURFACE_SUNK,
  TEXT_MUTED,
  TEXT_PRIMARY,
  shadow,
} from "../theme/tokens";

/**
 * A colour moved towards another one, for the ends of a gradient.
 *
 * Mixing towards white and black rather than dropping the opacity. A
 * translucent arc lets the track show through underneath it, so the pale
 * end of every ring came out muddied by its own wash and the gradient read
 * as a fault in the drawing rather than as light falling across it. These
 * are opaque colours the whole way round.
 */
const mix = (hex: string, towards: string, amount: number) => {
  const ch = (at: number) => parseInt(hex.slice(at, at + 2), 16);
  const to = (at: number) => parseInt(towards.slice(at, at + 2), 16);
  const one = (at: number) =>
    Math.round(ch(at) + (to(at) - ch(at)) * amount)
      .toString(16)
      .padStart(2, "0");
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? `#${one(1)}${one(3)}${one(5)}` : hex;
};
const lighter = (hex: string, by: number) => mix(hex, "#FFFFFF", by);
const deeper = (hex: string, by: number) => mix(hex, "#000000", by);

/** One kind of group work: what it is called, how far it has got, its ink. */
export type KindCount = {
  label: string;
  done: number;
  total: number;
  ink: string;
};

/** The visits, counted the three ways the strip on the plan screen counts them. */
export type VisitCount = { total: number; todo: number; done: number };

/**
 * How tall both cards stand.
 *
 * Fixed, and the same for each, because the two are read across: a gauge is
 * sixteen points tall and a donut is seventy-six, so left to themselves the
 * two cards would put their figures at different heights and the row of six
 * would stop being a row. With a height to fill, each card spaces its three
 * bands out to meet it and the headings line up at the top, the figures at
 * the foot, and the chart in the middle of whatever is left.
 *
 * It counts the card's own padding in — height is a border box in Yoga —
 * so it is thirty-two of padding, the hundred and forty-one the taller of
 * the two has to fit, and the rest handed to the gaps between the bands.
 * The surplus is the point: at the height that merely fitted, the heading
 * sat on the chart and the chart sat on the figures, and three things
 * touching read as one squeezed thing rather than as three.
 */
const COLUMN_H = 196;

/** How many ticks the visit gauge is divided into, whatever the day holds. */
const TICKS = 18;

/** One tick: a rounded stroke, tall enough to read, thin enough to count. */
const TICK_W = 4;
const TICK_H = 16;

/*
  How the charts arrive.

  The home page is the first thing anybody sees each morning and the card
  is the first thing on it, so the two charts are what the eye lands on
  while the rest of the page is still settling. Arriving rather than
  already-there is worth a little: it says the figures were worked out just
  now, for today, which is what they were.

  Nothing inside the SVG is animated. Driving `strokeDashoffset` through
  React Native's own Animated stutters — it is not a transform, so every
  frame crosses to the JS thread and rebuilds the path — and through
  Reanimated it has taken this app down with an exception out of the SVG
  view; see Sparkline, where the same thing was tried and abandoned. So the
  drawing is finished before it is shown and only whole views are moved:
  one opacity and one transform each, on the UI thread.

  The gauge goes first and the rings follow it, which is the order they are
  read in — and the pause between them is what stops the pair reading as
  one thing flashing on.

  It runs every time the page is looked at, not once. The home page is a
  tab: it is mounted at launch and never unmounted, so an entrance hung on
  mount plays once in the morning and never again — a carer who steps into
  a visit and comes back sees a still card and reasonably reports that
  there is no animation. Focus is the event that matters, and on the way
  out each chart is put back to nothing while nobody is looking, so
  returning starts from the beginning rather than blinking out first.
*/
const RISE_MS = 520;
const WIPE_MS = 700;
const COUNT_MS = 760;
const RINGS_AFTER = 140;

/**
 * The day in two halves: the houses on the left, the schools on the right.
 *
 * These are two different days happening at once — worked in different
 * places, with different equipment, against different registers — and a
 * single figure over the pair of them answers a question nobody asks. So
 * the card is split down the middle, each half gets a chart in the shape of
 * the work it stands for, and the three figures underneath say what the
 * chart cannot: how many.
 *
 * The gauge and the donut are different on purpose. Visits are a queue —
 * one thing after another, and what a carer wants from it is how much of
 * the row is behind them, which is what a bar filling from the left says
 * fastest. Group work is three services running in parallel, none of which
 * waits for the others, and three arcs of three colours say that where
 * three more bars would have read as one long queue in three pieces.
 */
export function DaySummary({
  date,
  visits,
  kinds,
}: {
  /** The day this is a summary of, written out. */
  date: string;
  visits: VisitCount;
  /** In the order the figures are read: outermost arc first. */
  kinds: KindCount[];
}) {
  const shown = useIsFocused();

  return (
    /*
      Glass around the card, not instead of it.

      The figures have to be read at a glance, and glass is the wrong
      surface to read anything small off — it refracts the page moving
      behind it. So the numbers keep an opaque white card of their own and
      the glass becomes the frame it sits in, carrying the heading and the
      date. That is also the only arrangement in which the material has
      anything to do: Liquid Glass samples what is BEHIND a view, and a
      glass panel laid straight over a white card has nothing to sample and
      comes out as bare text on a flat patch. Here it stands on the page
      itself, so the card's own margin of glass picks up the ground and
      whatever scrolls under it.

      Nothing between this and the screen may carry a transform or an alpha
      below 1 — UIVisualEffectView refuses to draw its material under
      either, silently.
    */
    /*
      The shadow goes on a wrapper, never on the glass.

      Two reasons, and they pull the same way. A shadow set on the glass
      itself is painted OVER the material — UIGlassEffect already draws its
      own rim, highlight and inner shadow, and ours lands on top of them and
      flattens the whole panel into a uniform patch with no edge. And the
      corners are clipped here, which cuts a shadow away with them. Cast
      from outside, it falls on the page BEHIND the glass, which is where a
      shadow belongs and the one place it lifts the panel rather than
      dirtying it.

      Wider and softer than the app's own card lift, because this is a
      bigger box standing further off the page — but the same ink at the
      same strength, so it reads as one family of cards.
    */
    <View
      style={{
        marginHorizontal: SPACE.lg,
        borderRadius: RADIUS.card,
        boxShadow: shadow({ blur: 14, y: 5, opacity: 0.1 }),
      }}
    >
      <Glass
        /*
          Blurred where the material is missing.

          The frame's whole job is to pick up the page it is standing on —
          on iOS the material does that by refraction, and below it there
          was nothing doing it at all: a flat wash, and the card came out
          as a white box inside a slightly different white box. A blur of
          what is behind is the part of refraction that can be had off
          Apple's platform, and it is what the frame is for.
        */
        blurred
        style={{
          borderRadius: RADIUS.card,
          overflow: "hidden",
        }}
      >
        {/*
        What the card is, above the card rather than inside it.

        The title and the date used to sit in the figures' own top-left,
        which cost them a line of the card's height and set them against
        the numbers as though they were one of them. Up here they are a
        heading: the frame says what is coming, the card says it. The date
        rides in a pill beside the title rather than under it, because it
        is a fact about the heading and not a second line of it.
      */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: SPACE.sm,
            paddingHorizontal: SPACE.lg,
            paddingTop: SPACE.lg,
            paddingBottom: SPACE.sm,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              fontSize: 16,
              lineHeight: 25,
              fontWeight: "800",
              color: TEXT_PRIMARY,
            }}
          >
            สรุปงานของคุณวันนี้
          </Text>
          {/*
          A translucent fill, not one of the grey tokens: an opaque chip on
          glass reads as a sticker stuck to it, where a wash lets the
          material carry on through and the pill belongs to the frame.
        */}
          <View
            style={{
              paddingHorizontal: SPACE.sm,
              paddingVertical: 2,
              borderRadius: 100,
              backgroundColor: "rgba(204,204,204,0.2)",
            }}
          >
            <Text style={{ fontSize: 13, lineHeight: 21, color: TEXT_MUTED }}>
              {date}
            </Text>
          </View>
        </View>

        {/* The glass shows as a margin all the way round the card. */}
        {/*
          A box each, not one box with a line down it.

          A rule between two halves says they are the same thing divided.
          These are not: a morning of houses and a morning of classrooms are
          two separate rounds, kept in two registers, and either can be
          finished while the other has not started. Two cards with the
          material showing between them say that — the gap is the glass, so
          the frame does the separating and nothing has to be drawn to do
          it.
        */}
        <View
          style={{
            flexDirection: "row",
            gap: SPACE.sm,
            paddingHorizontal: SPACE.sm,
            paddingBottom: SPACE.sm,
          }}
        >
          <Panel heading="งานเยี่ยมบ้าน">
            <Rise shown={shown} stretch>
              <Share done={visits.done} total={visits.total} shown={shown} />
            </Rise>
            {/*
              Three words, and none of them repeats the heading.

              "งานทั้งหมด" under a card already headed "งานเยี่ยมบ้าน" spends
              a third of the narrowest label in the app saying "งาน" a
              second time, and the three read at three different lengths
              besides. Shortened they line up: a total, what is left, what
              is behind — which is the order a carer reads them in anyway.
            */}
            <Figures
              cells={[
                { value: `${visits.total}`, label: "ทั้งหมด" },
                { value: `${visits.todo}`, label: "รอทำ" },
                { value: `${visits.done}`, label: "เสร็จแล้ว" },
              ]}
            />
          </Panel>

          <Panel heading="งานอนามัยโรงเรียน">
            <Rise shown={shown} delay={RINGS_AFTER} spin={40}>
              <Donut kinds={kinds} />
            </Rise>
            <Figures
              cells={kinds.map((k) => ({
                value: `${k.done}`,
                of: `/${k.total}`,
                label: k.label,
              }))}
            />
          </Panel>
        </View>
      </Glass>
    </View>
  );
}

/**
 * One round's own card: a name at the top, a chart, three figures.
 *
 * Sixteen-point corners inside the frame's twenty-four with eight between
 * them, so the two sets of corners run parallel instead of one bulging out
 * of the other. Twelve of padding rather than the app's usual sixteen —
 * there are three figures to fit across half a phone, and the four points
 * are the difference between the longest Thai label sitting in its third of
 * the card and being cut off in it.
 */
function Panel({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      style={{
        flex: 1,
        borderRadius: RADIUS.lg,
        paddingHorizontal: SPACE.md,
        paddingVertical: SPACE.lg,
        alignItems: "center",
        justifyContent: "space-between",
        height: COLUMN_H,
      }}
    >
      <Text
        numberOfLines={1}
        style={{ fontSize: 14, lineHeight: 22, color: TEXT_MUTED }}
      >
        {heading}
      </Text>
      {children}
    </Card>
  );
}

/**
 * The visits as a row of ticks, filling from the left.
 *
 * A fixed count rather than one tick per visit. A carer with two visits
 * would otherwise get a gauge of two marks, which is not a gauge — it is
 * two marks — and a carer with thirty would get a solid bar. Eighteen is
 * the width of the column divided by something that still reads as separate
 * strokes, and what it measures is the share, which is what a gauge is for;
 * the count itself is on the line underneath, where it is exact.
 *
 * A day with nothing done lights nothing: rounding a first visit's worth of
 * progress up to a tick would say the day had started when it had not.
 */
/**
 * The visits as a share, over the bar that shows the same thing.
 *
 * The figure is what the eye lands on and the bar is what it checks
 * against: a percentage on its own is a number to be taken on trust, and a
 * row of ticks on its own has to be counted. Together each one says what
 * the other cannot, and neither needs a label to explain it.
 *
 * It is also what balances the two cards. The rings opposite are
 * eighty-eight points of chart and the gauge is sixteen, so the visits
 * looked like the afterthought of a card they are in fact half of. Set in
 * the gauge's own blue rather than the text black, because the two are one
 * reading and the colour is what says so.
 */
/**
 * Whether the carer has asked the app to hold still.
 *
 * Read once at mount rather than subscribed to: a change to the setting
 * should take on the next page, not re-run an entrance under somebody who
 * has just turned entrances off.
 */
const holdStill = () => currentDisplay().reduceMotion;

/** A chart fading up into place — and, where it is round, turning into it. */
function Rise({
  shown,
  delay = 0,
  spin = 0,
  stretch,
  children,
}: {
  /** True while the page is the one on screen. */
  shown: boolean;
  delay?: number;
  /** Degrees to arrive from. Only the rings use it; a bar has no angle. */
  spin?: number;
  /** For a chart that fills its panel's width — the wrapper must too. */
  stretch?: boolean;
  children: ReactNode;
}) {
  const still = holdStill();
  const t = useSharedValue(still ? 1 : 0);

  useEffect(() => {
    if (still) return;
    if (!shown) {
      t.value = 0;
      return;
    }
    t.value = withDelay(
      delay,
      withTiming(1, { duration: RISE_MS, easing: Easing.out(Easing.cubic) }),
    );
  }, [shown, delay, still, t]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [
      { scale: 0.92 + 0.08 * t.value },
      { rotate: `${-spin * (1 - t.value)}deg` },
    ],
  }));

  return (
    <Reanimated.View
      style={[stretch === true && { alignSelf: "stretch" }, style]}
    >
      {children}
    </Reanimated.View>
  );
}

/**
 * A figure counting up to itself.
 *
 * On its own leaf so that the frames it costs are frames spent re-rendering
 * one Text — put on the panel it sits in, the same loop would redraw
 * eighteen gauge ticks eighteen times for nothing.
 *
 * It eases out on the same curve as the charts, so the number settles at
 * the moment the bar under it finishes filling rather than racing it.
 */
function CountUp({
  to,
  shown,
  style,
}: {
  to: number;
  shown: boolean;
  style: TextStyle;
}) {
  const still = holdStill();
  const [n, setN] = useState(still ? to : 0);

  useEffect(() => {
    if (still) {
      setN(to);
      return;
    }
    if (!shown) {
      setN(0);
      return;
    }
    const start = Date.now();
    let frame = requestAnimationFrame(function tick() {
      const p = Math.min(1, (Date.now() - start) / COUNT_MS);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [to, shown, still]);

  return <Text style={style}>{n}</Text>;
}

function Share({
  done,
  total,
  shown,
}: {
  done: number;
  total: number;
  shown: boolean;
}) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <View style={{ alignSelf: "stretch", alignItems: "center", gap: SPACE.sm }}>
      <View style={{ flexDirection: "row", alignItems: "baseline" }}>
        <CountUp
          to={pct}
          shown={shown}
          style={{
            fontSize: 34,
            lineHeight: 44,
            fontWeight: "800",
            color: PRIMARY_500,
            fontVariant: ["tabular-nums"],
          }}
        />
        <Text
          style={{
            fontSize: 15,
            fontWeight: "800",
            color: lighter(PRIMARY_500, 0.4),
          }}
        >
          %
        </Text>
      </View>
      <TickGauge done={done} total={total} shown={shown} />
    </View>
  );
}

function TickGauge({
  done,
  total,
  shown,
}: {
  done: number;
  total: number;
  shown: boolean;
}) {
  const [width, setWidth] = useState(0);
  const still = holdStill();
  /*
    The bar draws itself in behind a cover, not by animating the ticks.

    A rectangle in the panel's own white lies over the row and slides off
    to the right: one translateX on the UI thread, nothing inside the SVG
    touched, and the row appears to fill because the eye cannot tell the
    difference between marks arriving and a cover leaving. The lit ticks
    are the left of the row, so what it looks like is the day filling up —
    which is what the bar means.
  */
  const wiped = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still || width === 0) return;
    if (!shown) {
      wiped.value = 0;
      return;
    }
    wiped.value = withTiming(1, {
      duration: WIPE_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [shown, still, width, wiped]);
  const cover = useAnimatedStyle(() => ({
    transform: [{ translateX: width * wiped.value }],
  }));

  const lit =
    total === 0 || done === 0
      ? 0
      : Math.max(1, Math.round((done / total) * TICKS));
  const step = TICKS < 2 ? 0 : (width - TICK_W) / (TICKS - 1);

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ alignSelf: "stretch", height: TICK_H }}
    >
      {width === 0 ? null : (
        <Svg width={width} height={TICK_H}>
          <Defs>
            {/*
              One gradient across the whole bar, not one per tick.

              In user space, so each tick takes the colour of the place it
              stands in rather than repeating the same ramp eighteen times —
              the row lightens from left to right as one object, which is
              what gives a line of identical marks any depth. It is laid
              over the bar's full width whatever is lit, so a tick does not
              change colour as the day fills up.
            */}
            <LinearGradient
              id="gauge"
              x1="0"
              y1="0"
              x2={width}
              y2="0"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={lighter(PRIMARY_500, 0.42)} />
              <Stop offset="0.55" stopColor={PRIMARY_500} />
              <Stop offset="1" stopColor={deeper(PRIMARY_500, 0.14)} />
            </LinearGradient>
          </Defs>
          {Array.from({ length: TICKS }, (_, i) => (
            <Rect
              key={i}
              x={i * step}
              y={0}
              width={TICK_W}
              height={TICK_H}
              rx={TICK_W / 2}
              fill={i < lit ? "url(#gauge)" : SURFACE_SUNK}
            />
          ))}
        </Svg>
      )}

      {width > 0 && (
        <Reanimated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width,
              backgroundColor: SURFACE,
            },
            cover,
          ]}
        />
      )}
    </View>
  );
}

/**
 * The group work as concentric arcs, one service per ring.
 *
 * Each arc is a gradient of its own colour rather than a flat stroke, and
 * sits on a track tinted from that same colour rather than on grey: a ring
 * then reads as one object with a light end and a deep end, which is what
 * gives a flat chart any depth at all.
 *
 * Eight points of stroke with four between them — the gap half the weight of
 * the ring, which is enough daylight to count three services and not so much
 * that they stop belonging to one chart. Figma draws six on a smaller
 * circle; at the size this card can spare, six came out as wire.
 *
 * Nothing here animates. Sweeping an arc in means driving strokeDashoffset,
 * which in this app's own experience stutters through React Native's
 * Animated and took the screen down through Reanimated — see Sparkline,
 * where the same thing was tried and abandoned.
 */
function Donut({
  kinds,
  size = 88,
  stroke = 8,
  gap = 4,
}: {
  kinds: KindCount[];
  size?: number;
  stroke?: number;
  gap?: number;
}) {
  const centre = size / 2;
  const radii = kinds.map((_, i) => centre - stroke / 2 - i * (stroke + gap));

  /** A wash of the ring's own colour for its track. Plain hex only. */
  const trackOf = (ink: string) =>
    /^#[0-9a-fA-F]{6}$/.test(ink) ? `${ink}26` : ink;

  return (
    <Svg width={size} height={size}>
      {/*
        A gradient along each arc, not across the box it sits in.

        Laid corner to corner, a ring that has only got a fifth of the way
        round lies entirely in one corner of that ramp and comes out a
        single flat colour — which is exactly the arc a carer sees first
        thing in the morning, and exactly the one that looked painted on.
        So each ring gets its own vector, running from where its arc starts
        to where it ends: however short it is, it graduates over its whole
        length.

        In the rotated group's own coordinates, where an arc starts at three
        o'clock and sweeps down — the same space the circles are drawn in,
        so the quarter-turn carries the gradient round with them.

        The sweep is held between an eighth and most of a turn. Below that
        the two ends fall on the same point and a gradient with no length
        renders as one flat stop, which is the fault it was brought in to
        fix; above it they meet again on the far side and the ramp doubles
        back on itself.
      */}
      <Defs>
        {kinds.map((k, i) => {
          const radius = radii[i];
          const part = k.total === 0 ? 0 : Math.min(1, k.done / k.total);
          const sweep = Math.min(Math.max(part, 0.125), 0.85) * 2 * Math.PI;
          return (
            <LinearGradient
              key={k.label}
              id={`arc${i}`}
              gradientUnits="userSpaceOnUse"
              x1={centre + radius}
              y1={centre}
              x2={centre + radius * Math.cos(sweep)}
              y2={centre + radius * Math.sin(sweep)}
            >
              {/*
                Pale to full, and only a breath of shade at the tip.

                A ramp that ended a fifth of the way into black turned the
                peach ring muddy — mixing towards black takes the colour
                out as well as the light, and a washed hue has little to
                spare. A tenth reads as the arc turning away from the
                light; a fifth read as dirt.
              */}
              <Stop offset="0" stopColor={lighter(k.ink, 0.5)} />
              <Stop offset="0.6" stopColor={k.ink} />
              <Stop offset="1" stopColor={deeper(k.ink, 0.1)} />
            </LinearGradient>
          );
        })}
      </Defs>

      {/*
        Turned a quarter, so every ring starts at twelve o'clock.

        A transform on an SVG element, not on a React Native view — the
        material this app is built from stops drawing under one of those,
        and none of it is in here.
      */}
      <G rotation={-90} origin={`${centre}, ${centre}`}>
        {kinds.map((k, i) => {
          const radius = radii[i];
          const c = 2 * Math.PI * radius;
          const part = k.total === 0 ? 0 : Math.min(1, k.done / k.total);
          return (
            <G key={k.label}>
              <Circle
                cx={centre}
                cy={centre}
                r={radius}
                stroke={trackOf(k.ink)}
                strokeWidth={stroke}
                fill="none"
              />
              {/*
                A finished ring is a circle, not an arc that has gone all
                the way round. Dashed to its own full length it still has
                two ends, and two rounded caps landing on the same spot
                leave a bump at twelve o'clock — a lump on the one ring a
                carer should be pleased to see.
              */}
              {part >= 1 ? (
                <Circle
                  cx={centre}
                  cy={centre}
                  r={radius}
                  stroke={`url(#arc${i})`}
                  strokeWidth={stroke}
                  fill="none"
                />
              ) : part > 0 ? (
                <Circle
                  cx={centre}
                  cy={centre}
                  r={radius}
                  stroke={`url(#arc${i})`}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={`${c} ${c}`}
                  strokeDashoffset={c * (1 - part)}
                  fill="none"
                />
              ) : null}
            </G>
          );
        })}
      </G>
    </Svg>
  );
}

type Cell = { value: string; of?: string; label: string };

/**
 * The three figures along the foot of a column.
 *
 * Equal cells, centred, because they are read across rather than down: it
 * is the comparison between them that says where the day stands, and cells
 * sized to their own contents put the three at three different pitches and
 * make that comparison a piece of work.
 *
 * The labels are small, and stay at one size. They are the smallest type on
 * the home page and the longest of them only just fits its third of half a
 * card — which is an argument for shortening the word, and was once an
 * argument for letting the type find its own size, until a label given room
 * to spare grew to two and a half times its neighbours.
 */
function Figures({ cells }: { cells: Cell[] }) {
  return (
    <View style={{ flexDirection: "row", alignSelf: "stretch" }}>
      {cells.map((c) => (
        <View key={c.label} style={{ flex: 1, alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "baseline" }}>
            <Text
              style={{
                fontSize: 15,
                lineHeight: 23,
                fontWeight: "800",
                color: TEXT_PRIMARY,
                fontVariant: ["tabular-nums"],
              }}
            >
              {c.value}
            </Text>
            {c.of == null ? null : (
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: TEXT_MUTED,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {c.of}
              </Text>
            )}
          </View>
          <Text
            numberOfLines={1}
            style={{
              marginTop: SPACE.xs,
              fontSize: 10,
              lineHeight: 16,
              color: TEXT_MUTED,
            }}
          >
            {c.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
