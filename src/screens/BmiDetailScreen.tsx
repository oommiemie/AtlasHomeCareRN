import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Image, ScrollView, Text, View } from "react-native";
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { DateHitLayer } from "../components/DateHitLayer";
import { CalendarDays } from "lucide-react-native";

import { dismissDatePopover } from "../../modules/date-popover";

import { SegmentedControlNative } from "../../modules/segmented-control";
import { PaintedSegments } from "../components/PaintedSegments";
import { Avatar } from "../components/Avatar";
import { Card } from "../components/Card";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { OPEN_MS } from "../components/Sparkline";
import { StatTile } from "../components/StatTile";
import { TrendChart } from "../components/TrendChart";
import { UIcon } from "../components/UIcon";
import type { RootStackParamList } from "../navigation/RootStack";
import { initialOf, type Resident } from "../models/household";
import { planToday } from "../models/task";
import {
  bmiBreach,
  bmiSeries,
  bmiSeverity,
  bmiStatus,
  BMI_NORMAL,
  BMI_PERIODS,
  BMI_PERIOD_LABEL,
  HISTORY_DAYS,
  periodRange,
  WEEKDAY_TH,
  type BmiPeriod,
  type Tone,
} from "../models/vitals";
import {
  buddhistYear,
  startOfDay,
  thaiDayMonth,
  thaiMonthShort,
  thaiShortDate,
} from "../utils/thaiDate";
import {
  DANGER,
  PRIMARY_500,
  SEPARATOR,
  SPACE,
  SUCCESS,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TINT_BG,
  WARNING,
} from "../theme/tokens";
import { useLayout, GUTTER } from "../theme/layout";
import { tr } from "../i18n";

/**
 * Figma 434:47500, at the size it is drawn: the artboard is 440 wide, which is
 * this phone's own width, so the numbers below are the design's and not a
 * conversion of it.
 */
const D = {
  /** The page's margin, and the card's own padding. */
  pad: 16,
  gap: 10,
  radius: 24,
  /**
   * The panel inside the card — the readings' pages' own tile, in the
   * design's pale blue. That fill is TINT_BG, read where the panel is drawn
   * rather than held here: a colour in a module const keeps the ground it
   * was imported on.
   *
   * 109 as a floor rather than 185 as a height. The design drew 185 around
   * a figure, a rule and two stacked measurements; with the three figures on
   * one line and the rule gone there is nothing to fill it, and the panel sat
   * a good sixty points taller than the same tile on every other detail page.
   * The peers' number, used the peers' way: a minimum the content grows past
   * if it needs to, with the whole lot centred in whatever it comes to.
   */
  panel: { height: 109 },
  /**
   * The scale, rising out of the panel's bottom edge.
   *
   * Drawn at its full size and cut off by the panel, not fitted inside it —
   * the frame clips, so the bottom third of the picture goes and what is left
   * reads as an object coming up out of the edge rather than a sticker parked
   * in the corner. That is what the design draws, and what the readings'
   * pages do with their sensor and their lungs.
   *
   * The crop is measured from the foot so it stays the same share of the
   * picture however tall the type makes the panel: at 45 of 145 the dial and
   * the tread are both in, and only the shadow and the floor under it are
   * lost — which is the part that was never saying anything.
   */
  art: { width: 148, height: 145, crop: 45 },
  /** How long the scale takes to rise into place — the peers' own. */
  markMs: 560,
  /**
   * The left half of the panel — everything but the scale.
   *
   * The design's 182 was measured against 10-point type, and against a figure
   * with nothing beside it. On the app's scale, with the height and the weight
   * up on the same line, the row wants about 200: at 196 the widest of them
   * ("63.0 kg") was being cut to an ellipsis. The picture's left edge is 212
   * in from the text edge, so this is as wide as the row can be and still
   * clear it.
   */
  column: 210,
  /**
   * The trend, at the height the other detail pages draw theirs.
   *
   * The design's own frame is 157, which is what a 650-tall artboard had room
   * for. On the phone this page is a scroll and the card may be as tall as it
   * needs — and a reader moving between this page and the readings' pages
   * should be looking at the same size of chart, not a shorter one that makes
   * the same movement look smaller. So the card grows instead.
   */
  chart: { height: 224 },
  divider: SEPARATOR,
  tile: { height: 80 },
} as const;

/** The design draws the trend in the same green it writes "ปกติ" in. */
const INK = SUCCESS;

/** The verdict's own colour — the same three the whole app reads it in. */
// Read as it renders: applyTheme runs inside App's render, after every
// screen module body, so a token in a module const keeps the light
// palette it was imported under.
const TONE_INK = (): Record<Tone, string> => ({
  normal: SUCCESS,
  warn: WARNING,
  alert: DANGER,
});

/**
 * One patient's BMI over time — Figma 434:47500.
 *
 * The design puts the whole reading inside one card: the window across the
 * top, a panel carrying the figure and the two measurements it comes from,
 * and the trend under it. The scale hangs off the panel's corner and over the
 * chart, which is what stops the two from reading as separate cards.
 *
 * The gauge from the overview card is deliberately not repeated here. That
 * card answers "where is this patient now" and this page answers "which way
 * are they going" — a needle would say the first thing twice and the second
 * not at all.
 */
/**
 * The page under its own header, so anywhere that wants this page gets
 * this page — the screening form's history sheet mounts it beside the
 * other readings. `above` is whatever the host puts over the record.
 */
export function BmiDetailView({
  resident,
  above,
}: {
  resident: Resident;
  above?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  // Side by side on a wide window, as the readings' pages are: the chart,
  // and beside it what it adds up to. One centred column otherwise.
  const { regular, wide } = useLayout();
  const split = wide;

  const [period, setPeriod] = useState<BmiPeriod>("quarter");
  const [picked, setPicked] = useState<number | null>(null);
  /** The day the window ends on. The record holds two years behind it. */
  const [day, setDay] = useState<Date>(planToday);

  /** How far back the record goes, and no further forward than today. */
  const earliest = useMemo(() => {
    const d = startOfDay(planToday);
    d.setDate(d.getDate() - HISTORY_DAYS);
    return d;
  }, []);

  const points = useMemo(
    () => bmiSeries(resident, period, day),
    [resident, period, day],
  );
  const at = picked ?? points.length - 1;
  const shown = points[at];
  const status = shown == null ? null : bmiStatus(shown.value);

  const summary = useMemo(() => {
    if (points.length === 0) return null;
    const vs = points.map((p) => p.value);
    const kg = points.map((p) => p.weightKg);
    const half = Math.floor(vs.length / 2);
    const mean = (n: number[]) => n.reduce((a, b) => a + b, 0) / n.length;
    const moved = mean(vs.slice(half)) - mean(vs.slice(0, Math.max(1, half)));
    return {
      average: mean(vs),
      high: Math.max(...vs),
      low: Math.min(...vs),
      /*
        The weighings behind the three figures.

        Height does not vary — it is one number on the record, not something
        measured again at each visit — so the heaviest day is also the highest
        BMI and these line up with the figures above them without having to be
        looked up point by point.
      */
      averageKg: mean(kg),
      highKg: Math.max(...kg),
      lowKg: Math.min(...kg),
      // A tenth of a point either way is a scale read twice, not a patient
      // changing shape.
      trend: Math.abs(moved) < 0.1 ? "flat" : moved > 0 ? "up" : "down",
      inBand: vs.filter((v) => bmiSeverity(v) === 0).length,
      count: vs.length,
    } as const;
  }, [points]);

  /*
    The side of the chart, fitted to what is on it.

    It was pinned to 16–30 so that every window was drawn against the same
    ruler and the bands sat in fixed places. Measured, that turned out to be
    the wrong trade: a record moving between 28.6 and 29.9 used nine per cent
    of the plot's height and ran along its top edge — a chart with no shape in
    it, and the same picture whichever of the four windows was chosen.

    So the axis follows the readings with a point and a half of air either
    side, rounded out to a half. What the fixed ruler was protecting — knowing
    where the thresholds are — is drawn instead, as the lines in `guides`.
  */
  const scale = useMemo((): [number, number] => {
    if (points.length === 0) return [18, 26];
    const vs = points.map((p) => p.value);
    const lo = Math.min(...vs);
    const hi = Math.max(...vs);
    /*
      Air proportional to the movement, with a floor under it.

      A flat point and a half either side was measured at a quarter of the
      plot for a record that moved one point — better than the ninth the fixed
      ruler gave it, and still a line along the top of a mostly empty chart.
      A third of the range keeps the shape filling the plot whatever the
      record does, and the half-point floor stops a week that never moved from
      being drawn as a mountain.
    */
    const air = Math.max(0.5, (hi - lo) * 0.35);
    const round = (n: number, dir: 1 | -1) =>
      dir > 0 ? Math.ceil(n * 2) / 2 : Math.floor(n * 2) / 2;
    return [round(lo - air, -1), round(hi + air, 1)];
  }, [points]);

  /**
   * The scale rising out of the panel's foot as the page arrives — the same
   * entrance the lungs and the sensor make on the readings' pages.
   *
   * Once, on the way in: changing the window changes the readings, not what
   * took them. Held back for `OPEN_MS` so it starts with the trend line
   * rather than ahead of it, and the panel's own clipping is what it rises
   * out of.
   */
  const rise = useSharedValue(0);
  useEffect(() => {
    rise.value = withDelay(
      OPEN_MS,
      withTiming(1, { duration: D.markMs, easing: Easing.out(Easing.cubic) }),
    );
  }, [rise]);
  const rising = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - rise.value) * D.art.height }],
  }));

  /**
   * How the point being read out is dated.
   *
   * No clock on it. The readings' pages stamp theirs to the minute because a
   * reading is a moment — the oximeter was on the finger at 07:15 — and a
   * weighing is not: it is a day, and the generator sets every one of them to
   * midnight. So the stamp read "11 ก.ย. 69 - 00:00", and the 00:00 was not a
   * time anybody took, it was the absence of one.
   *
   * And a year's point is a month rather than a day: it is the mean of every
   * weighing in it, and dating that to the first of the month says it was
   * measured then.
   */
  const stampOf = (at: Date) =>
    period === "year"
      ? `${thaiMonthShort(at)} ${buddhistYear(at)}`
      : thaiShortDate(at);

  /**
   * A week is seven places, whether or not all seven have happened.
   *
   * The same grid the readings' pages lay a week out on. Without it the four
   * days gone by fill the width and Wednesday sits at the right-hand edge as
   * if the week were over; with it they sit at its start and the rest of the
   * week is visibly still ahead. The longer windows are drawn from their own
   * points and need none.
   */
  const grid = useMemo(() => {
    if (period !== "week") return undefined;
    const { from } = periodRange("week", day);
    return {
      slots: 7,
      at: (i: number) => {
        const d = new Date(from);
        d.setDate(d.getDate() + i);
        return d;
      },
    };
  }, [period, day]);

  /** The cut-offs, for the chart to rule itself against. */
  const guides = useMemo(
    () => [
      { at: BMI_NORMAL.low, label: `${BMI_NORMAL.low}` },
      { at: BMI_NORMAL.high, label: `${BMI_NORMAL.high}` },
      { at: 25, label: "25" },
    ],
    [],
  );

  return (
    <View style={{ flex: 1 }}>
      {above}

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: GUTTER,  // The page's margin, as the header's, not the design's fixed 16.
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + SPACE.huge,
            gap: D.gap,
            width: "100%",
            maxWidth: split ? 1180 : 720,
            alignSelf: "center",
          }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={
              split
                ? {
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: SPACE.lg,
                  }
                : { gap: D.gap }
            }
          >
            <View style={split ? { flex: 3 } : undefined}>
              {/* One card holding the window, the reading and the trend.
              `overflow: visible` so the scale may hang off the panel. */}
              <Card padded={false}>
                <View style={{ padding: D.pad, gap: D.pad }}>
                  {SegmentedControlNative != null ? (
                    <SegmentedControlNative
                      style={{ height: 32 }}
                      segments={BMI_PERIODS.map((p) => BMI_PERIOD_LABEL[p])}
                      selectedIndex={BMI_PERIODS.indexOf(period)}
                      onSegmentChange={(e) => {
                        setPeriod(BMI_PERIODS[e.nativeEvent.index] ?? period);
                        setPicked(null);
                      }}
                    />
                  ) : (
                    <PaintedSegments
                      labels={BMI_PERIODS.map((p) => BMI_PERIOD_LABEL[p])}
                      index={BMI_PERIODS.indexOf(period)}
                      onChange={(i) => {
                        setPeriod(BMI_PERIODS[i] ?? period);
                        setPicked(null);
                      }}
                    />
                  )}

                  {/* The panel: who this is, what it comes to, and what it was
                  worked out from. */}
                  <View
                    style={{
                      minHeight: D.panel.height,
                      backgroundColor: TINT_BG,
                      borderRadius: D.radius,
                      padding: D.pad,
                      // The peers centre their tile's content in whatever height
                      // it comes to rather than hanging it from the top.
                      justifyContent: "center",
                      // The design's frame clips: the scale is cropped by this
                      // edge rather than hanging over what comes after it.
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Avatar
                        size={24}
                        initial={initialOf(resident.name)}
                        photo={resident.photo}
                      />
                      <Text
                        numberOfLines={1}
                        style={{
                          flexShrink: 1,
                          fontSize: 14,
                          lineHeight: 20,
                          fontWeight: "600",
                          color: TEXT_PRIMARY,
                        }}
                      >
                        {resident.name}
                      </Text>
                    </View>

                    {/* Held to the panel's left half: the scale stands in the
                    right, and a figure that ran under it would be read
                    through a photograph of a bathroom floor. */}
                    <View style={{ width: D.column, marginTop: D.pad }}>
                      {/* Red once it has left the band, which is what every
                      other detail page does with its figure. */}
                      <Text
                        style={{
                          fontSize: 24,
                          lineHeight: 30,
                          fontWeight: "700",
                          color:
                            status == null || status.tone === "normal"
                              ? TEXT_PRIMARY
                              : DANGER,
                        }}
                      >
                        {shown == null ? "-" : shown.value.toFixed(1)}
                      </Text>

                      <View
                        style={{
                          height: 1,
                          backgroundColor: D.divider,
                          marginTop: 10,
                        }}
                      />

                      {/*
                    The weighing the figure above came from, not the one on
                    the record.

                    The BMI follows whatever the chart has marked, and the two
                    numbers under it did not — pick a point from March and the
                    page read "24.1" over today's 63 kg, which is a sum that
                    does not work. Height is left alone: it is a standing fact
                    about the person, not something that was measured again.
                  */}
                      <View style={{ flexDirection: "row", marginTop: 10 }}>
                        <Measure
                          label={tr("ส่วนสูง", "Height")}
                          value={`${resident.heightCm} cm`}
                        />
                        <Measure
                          label={tr("น้ำหนัก", "Weight")}
                          value={`${(shown?.weightKg ?? resident.weightKg).toFixed(1)} kg`}
                        />
                      </View>

                      {/*
                    The day being read, and the way to change it — the same
                    control the readings' pages carry.

                    The picker itself is stretched over the words at two per
                    cent: UIKit skips hit testing under one per cent, so it
                    has to be visible enough to be touched and faint enough
                    not to be seen. A patch of the panel's own colour covers
                    what shows through, and the date is drawn over the top.
                  */}
                      <View
                        style={{
                          // The rule that used to sit here is gone, and it was
                          // carrying the gap as well as the line — at two points
                          // the date came up against the figures' feet. The row's
                          // own height holds some slack above the words, so this
                          // is the rest of it rather than all of it.
                          marginTop: 4,
                          /*
                        Tall enough to be hit.

                        The box clips the magnified picker back to the words,
                        and at eighteen points it was clipping the control
                        itself: UIKit's compact date picker is about
                        thirty-four tall, so the touch only landed on the
                        middle sliver of it and the date took several stabs to
                        open. At thirty-six the whole control is inside the box
                        and anywhere on the row works. The margin above is
                        given back so the panel barely grows.
                      */
                          height: 30,
                          justifyContent: "center",
                          overflow: "hidden",
                        }}
                      >
                        <DateHitLayer
                          value={day}
                          minimumDate={earliest}
                          maximumDate={planToday}
                          label={tr("เลือกวันที่", "Choose date")}
                          scale={{ x: 2 }}
                          onPick={(next) => {
                            setDay(startOfDay(next));
                            setPicked(null);
                            dismissDatePopover();
                          }}
                        />

                        <View
                          pointerEvents="none"
                          style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: 0,
                            bottom: 0,
                            backgroundColor: TINT_BG,
                          }}
                        />

                        <View
                          pointerEvents="none"
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <CalendarDays size={12} color={TEXT_MUTED} />
                          <Text
                            numberOfLines={1}
                            style={{
                              fontSize: 12,
                              lineHeight: 16,
                              color: TEXT_MUTED,
                            }}
                          >
                            {stampOf(shown?.at ?? day)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Cut off by the panel's foot — see `D.art`. */}
                    <Reanimated.View
                      pointerEvents="none"
                      style={[
                        {
                          position: "absolute",
                          right: 0,
                          bottom: -D.art.crop,
                          width: D.art.width,
                          height: D.art.height,
                        },
                        rising,
                      ]}
                    >
                      <Image
                        source={require("../../assets/images/bmi_art.png")}
                        style={{ width: D.art.width, height: D.art.height }}
                        resizeMode="contain"
                        accessibilityRole="none"
                      />
                    </Reanimated.View>
                  </View>

                  {points.length > 0 && (
                    <TrendChart
                      readings={points}
                      // BMI is not one of the six, so the chart is handed its own
                      // cut-offs rather than a kind to look one up by.
                      kind="temp"
                      severityAt={(v) => bmiSeverity(v)}
                      breachAt={(v) => bmiBreach(v)}
                      ink={INK}
                      // The design's green, left alone rather than shaded off the
                      // warning ramp. Every reading on an obese record scores a
                      // full severity, so the ramp painted the whole line one
                      // flat red — loud, and saying the same thing at every point
                      // on it. The arrows mark which readings are out; see
                      // `plain` in `TrendChart`.
                      plain
                      guides={guides}
                      height={regular ? 300 : D.chart.height}
                      picked={picked}
                      onPick={setPicked}
                      scale={scale}
                      headroom={0}
                      steps={4}
                      /*
                    Each window is read by the unit it is drawn in, the way
                    the readings' pages write theirs: a week by its weekdays,
                    a year by its months, and the two in between by the date.
                  */
                      stamp={
                        period === "week"
                          ? (at) => WEEKDAY_TH[at.getDay()]
                          : period === "year"
                            ? thaiMonthShort
                            : thaiDayMonth
                      }
                      slots={grid?.slots}
                      slotAt={grid?.at}
                      mark="line"
                    />
                  )}
                </View>
              </Card>
            </View>

            {summary != null && (
              <View style={split ? { flex: 2, gap: D.gap } : { gap: D.gap }}>
                <View style={{ flexDirection: "row", gap: D.gap }}>
                  <StatTile
                    label={tr("เฉลี่ย", "Average")}
                    value={summary.average.toFixed(1)}
                    unit=""
                    sub={`${summary.averageKg.toFixed(1)} kg`}
                  />
                  <StatTile
                    label={tr("สูงสุด", "Highest")}
                    value={summary.high.toFixed(1)}
                    unit=""
                    sub={`${summary.highKg.toFixed(1)} kg`}
                    ink={bmiSeverity(summary.high) > 0 ? WARNING : undefined}
                  />
                  <StatTile
                    label={tr("ต่ำสุด", "Lowest")}
                    value={summary.low.toFixed(1)}
                    unit=""
                    sub={`${summary.lowKg.toFixed(1)} kg`}
                    ink={bmiSeverity(summary.low) > 0 ? WARNING : undefined}
                  />
                </View>

                <Card>
                  <View style={{ gap: SPACE.md }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: SPACE.sm,
                      }}
                    >
                      <UIcon name="gauge" size={16} color={PRIMARY_500} />
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: TEXT_PRIMARY,
                        }}
                      >
                        {tr("สรุปภาพรวม", "Overview")}
                      </Text>
                    </View>
                    {/* The verdict, here rather than beside the figure — the
                      same move the readings' pages make. */}
                    {status != null && shown != null && (
                      <Bullet
                        ink={TONE_INK()[status.tone]}
                        text={tr(
                          `ค่าที่อ่าน ${shown.value.toFixed(1)} · ${status.label}`,
                          `Reading ${shown.value.toFixed(1)} · ${status.label}`,
                        )}
                      />
                    )}
                    <Bullet
                      ink={summary.inBand === summary.count ? SUCCESS : WARNING}
                      text={tr(
                        `อยู่ในเกณฑ์ (${BMI_NORMAL.low}–${BMI_NORMAL.high}) ${summary.inBand} ครั้ง จาก ${summary.count} ครั้ง`,
                        `In range (${BMI_NORMAL.low}–${BMI_NORMAL.high}) ${summary.inBand} of ${summary.count} times`,
                      )}
                    />
                    <Bullet
                      ink={summary.trend === "flat" ? SUCCESS : WARNING}
                      text={
                        summary.trend === "flat"
                          ? tr(
                              "น้ำหนักค่อนข้างคงที่ตลอดช่วงที่ผ่านมา",
                              "Weight held fairly steady over this period",
                            )
                          : summary.trend === "up"
                            ? tr(
                                "ดัชนีมวลกายมีแนวโน้มเพิ่มขึ้น",
                                "BMI is trending up",
                              )
                            : tr(
                                "ดัชนีมวลกายมีแนวโน้มลดลง",
                                "BMI is trending down",
                              )
                      }
                    />
                  </View>
                </Card>
              </View>
            )}
          </View>
        </ScrollView>
      </HeaderFade>
    </View>
  );
}

/** The page as a screen: its own header, and the record under it. */
export function BmiDetailScreen() {
  const { resident } =
    useRoute<RouteProp<RootStackParamList, "BmiDetail">>().params;
  return (
    <BmiDetailView
      resident={resident}
      above={
        <ScreenHeader
          title={tr("ดัชนีมวลกาย (BMI)", "Body mass index (BMI)")}
        />
      }
    />
  );
}

/** One of the two figures the BMI was worked out from — Figma's Frame 354. */
/**
 * One of the two figures the BMI was worked out from.
 *
 * Sharing what the big figure leaves of the row, and held to one line each:
 * three columns in the panel's left half is tight, and a "63.0 kg" that wrapped
 * onto a second line would push the row's feet out of line with the BMI beside
 * it.
 */
function Measure({ label, value }: { label: string; value: string }) {
  return (
    // Half the row each. Stacked under the figure rather than beside it there
    // is room for both — about a hundred points apiece against the sixty-two
    // the widest of them wants — so neither is cut.
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text
        numberOfLines={1}
        style={{ fontSize: 12, lineHeight: 16, color: TEXT_MUTED }}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          fontSize: 16,
          lineHeight: 20,
          fontWeight: "700",
          color: TEXT_PRIMARY,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function Bullet({ ink, text }: { ink: string; text: string }) {
  return (
    <View
      style={{ flexDirection: "row", gap: SPACE.sm, alignItems: "flex-start" }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: ink,
          marginTop: 7,
        }}
      />
      <Text
        style={{ flex: 1, fontSize: 12, lineHeight: 20, color: TEXT_PRIMARY }}
      >
        {text}
      </Text>
    </View>
  );
}
