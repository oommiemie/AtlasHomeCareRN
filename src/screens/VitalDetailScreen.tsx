import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, type RouteProp } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { CalendarDays } from "lucide-react-native";

import { dismissDatePopover } from "../../modules/date-popover";
import { SegmentedControlNative } from "../../modules/segmented-control";
import { Avatar } from "../components/Avatar";
import { Card } from "../components/Card";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { OPEN_MS, rangeInk, shade, tone } from "../components/Sparkline";
import { StatTile } from "../components/StatTile";
import { TrendChart } from "../components/TrendChart";
import { UIcon, type UIconName } from "../components/UIcon";
import type { RootStackParamList } from "../navigation/RootStack";
import { givenName, initialOf } from "../models/household";
import { planToday } from "../models/task";
import {
  bandsFor,
  HISTORY_DAYS,
  metricOf,
  normalBand,
  periodGrid,
  PERIOD_LABEL,
  severityOf,
  severityOfPart,
  statusOf,
  summarise,
  trendFor,
  WEEKDAY_TH,
  type MetricKind,
  type Period,
  type Reading,
  type Tone,
} from "../models/vitals";
import {
  buddhistYear,
  isSameDay,
  screeningStamp,
  startOfDay,
  thaiMonthShort,
  thaiShortDate,
} from "../utils/thaiDate";
import {
  DANGER,
  GROUPED_BG,
  PRIMARY_100,
  PRIMARY_500,
  RADIUS,
  SPACE,
  SUCCESS,
  TEXT_MUTED,
  TEXT_PRIMARY,
  WARNING,
} from "../theme/tokens";

/** The card's own measurements, the CGM page's — Figma 390:46831. */
const PAGE = { pad: 16, gap: 10 } as const;

/** The pale tile the reading sits on — Figma 390:47160. */
const TILE = { fill: "#F4FAFF", height: 109, overhang: 2 } as const;

/** The one number the page exists to show, at the top of the app's scale. */
/** The verdict's own colour — the same three the whole app reads it in. */
const TONE_INK: Record<Tone, string> = {
  normal: SUCCESS,
  warn: WARNING,
  alert: DANGER,
};

const FIGURE = {
  fontSize: 24,
  lineHeight: 30,
  fontWeight: "700",
  color: TEXT_PRIMARY,
} as const;

/** How long the tile's illustration takes to rise into place. */
const MARK = { ms: 560 } as const;

/**
 * A picture on the tile, at the size and in the corner the design puts it.
 *
 * Each one is placed by hand because each one is a different shape: the lungs
 * hang off the bottom and the right, the blood cells sit on the bottom edge
 * and only off the right. What they share is that the tile clips them — cut
 * by the edge rather than floated inside it, which is what makes a picture
 * sit in the card instead of on it.
 */
type Art = {
  source: ImageSourcePropType;
  width: number;
  height: number;
  /** How far past the tile's own edges, in points. */
  right: number;
  bottom: number;
};

/** The four windows, in the order a health app puts them. */
const PERIODS: Period[] = ["day", "week", "month", "year"];

/**
 * How a point's time is written along the foot of the chart.
 *
 * The thing that tells one point from the next: the hour within a day, the
 * weekday within a week, the date within a month and the month within a year.
 * Written any other way the axis repeats itself.
 */
const STAMP: Record<Period, (at: Date) => string> = {
  day: (at) =>
    `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`,
  // A week is drawn as its days and a month as its own, so their feet are
  // written in weekdays and dates; a year is drawn as its months.
  week: (at) => WEEKDAY_TH[at.getDay()],
  month: (at) => `${at.getDate()}`,
  year: thaiMonthShort,
};

/** How the summary names the window it is talking about. */
const OVER: Record<Period, string> = {
  day: "ในวันนี้",
  week: "ในสัปดาห์ที่ผ่านมา",
  month: "ในเดือนที่ผ่านมา",
  year: "ในปีที่ผ่านมา",
};

/**
 * A round number to step an axis by: 1, 2, 2.5, 5 or 10 of whatever size.
 *
 * So every gridline lands on a number somebody would say out loud. Fitted to
 * the readings and then rounded outwards, the axis holds still while it can
 * and grows in steps rather than by a point at a time.
 */
function niceScale(
  low: number,
  high: number,
  want: number,
): { range: [number, number]; steps: number } {
  const raw = Math.max((high - low) / want, 0.001);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v >= raw) ?? 10 * mag;
  const from = Math.floor(low / step) * step;
  const to = Math.ceil(high / step) * step;
  return {
    range: [from, to],
    steps: Math.max(1, Math.round((to - from) / step)),
  };
}

/**
 * What this page is of.
 *
 * Everything on it that is not the same for every reading — the picture, the
 * window it opens on, the side of the chart, which three figures are worth a
 * card, and which way is the wrong way. The rest of the page cannot tell one
 * metric from another and does not need to.
 */
type Setup = {
  /** The picture on the tile, where the design has given one. */
  art?: Art;
  /** The mark beside "สรุปภาพรวม". */
  icon: UIconName;
  /** What the summary calls the thing being watched. */
  noun: string;
  /** The window the page opens on. */
  opens: Period;
  /** The share of readings inside the band that counts as holding. */
  holds: number;
  /** Which direction is the wrong one, for the trend. */
  worse: "up" | "down";
  /** Three figures, or the low and how often it went under. */
  stats: "range" | "low";
  /**
   * How the readings are drawn.
   *
   * A line where the thing being measured is a level that moves and the
   * readings are samples off it — sugar is that, which is why the continuous
   * monitor's page draws one. Bars where a wider window has to keep the ends
   * of each day: a night that fell to 88 and a day that never left 97 average
   * to the same 96, and for oxygen the low is the whole of the question.
   */
  chart: "line" | "bars";
  /** The side of the chart, given what the window covers. */
  scale: (
    low: number,
    high: number,
  ) => { range: [number, number]; steps: number };
};

const SETUP: Partial<Record<MetricKind, Setup>> = {
  temp: {
    // Figma 427:47425 — the infrared forehead thermometer, hanging off the
    // tile's bottom right and cropped by it on both edges, the way the
    // design's own frame clips it: 37 points past the right and 63 below, so
    // the grip runs out of the corner rather than sitting in it.
    //
    // The page had no picture until this arrived; there was no thermometer
    // drawn at the size a tile wants, and the 48pt mark off the screening
    // icons blown up to fill one is the stretched photograph the pulse page's
    // own note warns against.
    art: {
      source: require("../../assets/images/temp_3d.png"),
      width: 165,
      height: 162,
      right: -37,
      bottom: -63,
    },
    icon: "thermometerHalf",
    noun: "อุณหภูมิ",
    // Taken once a day, so a day is a single reading — the page opens on the
    // window where a temperature first has a shape to read.
    opens: "week",
    // A temperature is expected to be normal, and one day off in ten is
    // already worth looking at.
    holds: 0.9,
    // It fails both ways and both are worth knowing — a temperature under 35
    // is its own emergency — but what a home visit follows is the fever.
    worse: "up",
    stats: "range",
    // A line: a bar is a day from its low to its high and there is only one
    // reading in a day, so every bar would be a sliver the height of nothing.
    chart: "line",
    /*
      Held to the range a body actually lives in rather than fitted to the
      window. A fortnight of 36.4 to 36.9 fitted to itself fills the chart
      top to bottom and reads as a fever coming on; against 35 to 39 it reads
      as what it is, which is a flat line. Half a degree to a gridline, and a
      reading past either end still widens it.
    */
    scale: (low, high) => niceScale(Math.min(low, 35), Math.max(high, 39), 4),
  },
  bp: {
    // No picture. The art on the other pages is drawn at the size it sits at
    // — the heart at 70 by 100, the sugar at 133 by 94 — and the only
    // pressure image this project has is the 48pt mark off the screening
    // panel. Blown up to fill a tile it is exactly the stretched photograph
    // the pulse page's own note warns against, and a tile with a clean gauge
    // on its heading reads better than one with a soft picture on it.
    icon: "gauge",
    noun: "ความดันโลหิต",
    // Two readings a day, so a day is two dots and a line between them is
    // not a trend. A week is fourteen, which is where a cuff record starts
    // to have a shape — the same reason the finger-prick page opens on one.
    opens: "week",
    holds: 0.9,
    // Systolic fails both ways and diastolic only upward, but what the page
    // is followed for is the climb.
    worse: "up",
    // It fails at both ends, so both are worth a card.
    stats: "range",
    // A line, never bars: a bar is one number's low to its high and there are
    // two numbers here — and the pair is what a pressure is read as.
    chart: "line",
    /*
      Anchored on the reading's own range, like the sugar pages: fitted to
      each window the axis redraws itself on every tab, and a fortnight that
      never left the band looks exactly like one that swung through it because
      the ruler moved with the line. Sixty to a hundred and eighty holds both
      numbers with the band in the middle of the chart rather than crushed
      against an edge, and a reading past either end still widens it.
    */
    scale: (low, high) => niceScale(Math.min(low, 60), Math.max(high, 180), 4),
  },
  spo2: {
    // Figma 409:47280.
    art: {
      source: require("../../assets/images/lungs_3d.png"),
      width: 114,
      height: 112,
      right: -11,
      bottom: -11,
    },
    icon: "lungs",
    noun: "ระดับออกซิเจน",
    // The day, which for a worn oximeter is a night and a day: the overnight
    // dip is the thing a patient on home oxygen is followed for.
    opens: "day",
    holds: 0.9,
    worse: "down",
    // Oxygen has no upper fault — a hundred per cent is a lung doing its job
    // — and a figure that can only ever read "fine" is a third of the strip
    // spent saying nothing.
    stats: "low",
    chart: "bars",
    /*
      Fixed rather than fitted: saturation lives in a band a few points wide,
      and an axis that redrew itself around each window would make a quiet
      week and a bad one look identical. A hundred is the top because there is
      no more than that, and the foot drops to the next five below the lowest
      reading, ten points down at least.
    */
    scale: (low) => ({
      range: [100 - Math.ceil(Math.max(100 - low + 1, 10) / 5) * 5, 100],
      steps: 5,
    }),
  },
  pulse: {
    // The heart the overview card carries, at the size the art is drawn at:
    // enlarged it goes soft, and a photograph that has been stretched is the
    // one thing on a page like this that looks like a mistake.
    art: {
      source: require("../../assets/images/heart_3d.png"),
      width: 70,
      height: 100,
      right: 4,
      bottom: -6,
    },
    icon: "heartRate",
    noun: "อัตราการเต้นหัวใจ",
    // The day, which for a heart is the difference between what it does awake
    // and what it does asleep.
    opens: "day",
    holds: 0.9,
    // Both ends are faults, but the one a home visit is watching for is the
    // fast end.
    worse: "up",
    stats: "range",
    chart: "line",
    // Held still on the reading's own range, the way the continuous monitor's
    // page holds its own: 40 to 120, and only a reading past either end moves
    // it.
    scale: (low, high) => niceScale(Math.min(low, 50), Math.max(high, 120), 4),
  },
  glucose: {
    // Figma 410:47351 — red cells and sugar cubes, sitting on the tile's
    // bottom edge and off its right.
    art: {
      source: require("../../assets/images/glucose_3d.png"),
      width: 133,
      height: 94,
      right: -9,
      bottom: 0,
    },
    icon: "meterDroplet",
    noun: "ระดับน้ำตาล",
    // Four readings a day is a thin chart of one; the week is where a
    // finger-prick record starts to have a shape.
    opens: "week",
    holds: 0.7,
    worse: "up",
    // It fails both ways, so both ends of the window are worth a card.
    stats: "range",
    chart: "line",
    /*
      Held still, the way the continuous monitor's page holds its own.

      Fitted to each window, the axis redrew itself on every tab and every
      change of date, and a week that never left the band came out looking
      exactly like a week that swung through it — the line moved the same
      distance because the ruler had moved with it. Anchored on the reading's
      own range instead, it comes out at 50 to 200 and stays there: a flat
      week is flat, a bad one climbs, and the two can be told apart at a
      glance. A reading past either end still widens it, in steps of a round
      number, rather than being drawn outside the chart.
    */
    scale: (low, high) => niceScale(Math.min(low, 70), Math.max(high, 200), 4),
  },
};

/**
 * Oxygen in the blood, over a day, a week, a month or a year.
 *
 * The CGM page's build, because the two are the same page: a window to choose,
 * one reading called out large, the trace under it and what the window adds up
 * to below. What differs is what the window is — the continuous monitor is
 * read in hours because it produces a reading every quarter of an hour, and
 * the oximeter is read in days because it produces four.
 *
 * And what is worth saying about it. Oxygen fails in one direction: 100% is
 * perfect and the lowest reading of the day is the one that matters, so the
 * strip under the chart carries the low and the count of readings that fell
 * under the line rather than a high nobody would read.
 */
export function VitalDetailScreen() {
  const { resident, kind } =
    useRoute<RouteProp<RootStackParamList, "VitalDetail">>().params;
  const insets = useSafeAreaInsets();
  const setup = SETUP[kind] ?? SETUP.spo2!;

  /**
   * The window on show.
   *
   * The day, which for a worn oximeter is a night and a day: twenty-four
   * hourly readings with the overnight dip in the middle of them, which is
   * the thing a patient on home oxygen is being followed for. The wider
   * windows are there to be reached for.
   */
  const [period, setPeriod] = useState<Period>(setup.opens);
  /** Which point the tile is reading out, or null for the newest. */
  const [picked, setPicked] = useState<number | null>(null);
  /**
   * The day being read. The record holds a year; the page opens on the one
   * the app calls today.
   *
   * The window is the calendar period this day falls in: the week it is in,
   * the month it is in, the year it is in — not the seven or thirty days
   * before it. Pick the fifth and ask for a week and you get the week the
   * fifth is in, labelled Sunday to Saturday, the way somebody pointing at a
   * date and saying "that week" means it.
   */
  const [day, setDay] = useState<Date>(planToday);

  const metric = metricOf(kind);
  const band = normalBand(kind);
  /** How far back the record goes, and no further forward than today. */
  const earliest = useMemo(() => {
    const d = startOfDay(planToday);
    d.setDate(d.getDate() - HISTORY_DAYS);
    return d;
  }, []);

  /**
   * A day is drawn as its readings; anything wider, as its days.
   *
   * Twenty-four hourly readings is a day, and each one is a fact about its
   * hour. A week of them is a hundred and sixty-eight, which cannot be drawn
   * one to a point and must not be averaged one to a day: a night that fell
   * to 88 and a day that never left 97 come out as the same 96, and for
   * oxygen the low is the whole of what is being watched for. So a week, a
   * month and a year are bars — each one a day from its low to its high.
   */
  const byDay = setup.chart === "bars" && period !== "day";
  const { readings, points: hours } = useMemo(
    () => trendFor(resident, kind, period, day),
    [resident, period, day],
  );
  const bands = useMemo(
    () => (byDay ? bandsFor(resident, kind, period, day) : []),
    [byDay, resident, period, day],
  );
  /** What the chart is scaled and picked by: the reading, or the day's mean. */
  const points = useMemo(
    () =>
      byDay
        ? bands.map((b) => ({
            at: b.at,
            value: b.average,
            // Kept even though bars draw one number: the tile above still
            // reads out whatever the chart has marked, and a pressure that
            // lost its lower figure on the way into a bar would be read out
            // as half of itself.
            value2: b.average2,
          }))
        : hours,
    [byDay, bands, hours],
  );

  /**
   * The summary is built on the readings themselves, never on the bars.
   *
   * A low read off daily means is the lowest day, not the lowest reading —
   * the difference between "one dip to 89" and "a quiet month".
   */
  /**
   * Where the chosen day sits in what is on show.
   *
   * What the chart marks and the tile reads out until something is tapped.
   * The page was asked about a date, and a week that marked its last day
   * instead would answer a question nobody asked — picking Tuesday out of a
   * month has to land on Tuesday.
   */
  const focus = useMemo(() => {
    if (period === "day" || points.length === 0) return points.length - 1;
    const i = points.findIndex((p) =>
      period === "year"
        ? p.at.getFullYear() === day.getFullYear() &&
          p.at.getMonth() === day.getMonth()
        : isSameDay(p.at, day),
    );
    return i >= 0 ? i : points.length - 1;
  }, [period, points, day]);

  const summary = summarise(kind, readings);
  const at = picked ?? focus;
  const shown = points[at];
  /*
    One figure, and the verdict on that figure.

    A bar used to read out as its two ends — "97 – 93" — which is what the bar
    itself already draws, in the same place, at the same time. What the tile
    is for is the one number the window comes to; the ends of it are on the
    chart, and how far they went is on the cards underneath.
  */
  // Both numbers, where there are two: a systolic of 118 under a diastolic
  // of 96 is not a normal reading, and judged on the first figure alone the
  // page would call it one.
  const status =
    shown == null ? null : statusOf(kind, shown.value, shown.value2);
  /** "140/90" for a pressure, "97" for everything else. */
  const readOut = (r: Reading) =>
    r.value2 == null
      ? r.value.toFixed(metric.decimals)
      : `${r.value.toFixed(metric.decimals)}/${r.value2.toFixed(metric.decimals)}`;

  /**
   * The side of the chart, in whole numbers, running up to a hundred.
   *
   * Fixed rather than fitted to the window: saturation lives in a band a few
   * points wide, and an axis that redrew itself around each window would make
   * a quiet week and a bad one look identical. A hundred is the top because
   * there is no more than that — an axis running to 101% is a chart nobody
   * would trust twice — and the foot drops to the next five below the lowest
   * reading, ten points down at least, so every gridline lands on a whole
   * number.
   */
  const scale = useMemo(() => {
    // The ends of the bars, not their middles: an axis fitted to the daily
    // means would cut the bars off at the foot.
    const lows = byDay ? bands.map((b) => b.low) : points.map((p) => p.value);
    const highs = byDay ? bands.map((b) => b.high) : points.map((p) => p.value);
    if (lows.length === 0) return setup.scale(0, 0);
    return setup.scale(Math.min(...lows), Math.max(...highs));
  }, [setup, byDay, bands, points]);

  /**
   * The places the window is laid out over: the whole of it, whether or not
   * every part has happened.
   *
   * Wednesday is halfway through a week and drawing three bars across the
   * whole width says the week is over. Given the week's own seven places the
   * days so far sit at its start, with the rest of it ahead of them — and a
   * month and a year the same.
   */
  const grid = useMemo(() => {
    if (period === "day") return undefined;
    const { from, to } = periodGrid(period, day);

    if (period === "year") {
      // A year is twelve places, one to a month, counted from the first month
      // the record covers rather than from January.
      const start = new Date(from.getFullYear(), from.getMonth(), 1);
      const slots =
        (to.getFullYear() - start.getFullYear()) * 12 +
        (to.getMonth() - start.getMonth()) +
        1;
      return {
        slots,
        at: (i: number) =>
          new Date(start.getFullYear(), start.getMonth() + i, 1),
      };
    }

    const slots = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
    return {
      slots,
      at: (i: number) => {
        const d = new Date(from);
        d.setDate(d.getDate() + i);
        return d;
      },
    };
  }, [period, day]);

  /**
   * The day as a ruler, midnight to midnight.
   *
   * Every wider window lays its readings out one to a place — a week is seven
   * days whether or not all seven have happened — and for a day that was left
   * to the readings themselves. It works only while there are enough of them
   * to be the hours: the oximeter's twenty-four and the monitor's ninety-six
   * are evenly spaced from midnight, so evenly spread across the plot is
   * where they were taken anyway.
   *
   * A pressure is taken twice. Spread evenly, morning and evening sat at the
   * two ends of the chart with a line drawn between them, which says the day
   * ran from one reading to the other. On the hour they sit where they were
   * taken, the empty stretch between reads as an empty stretch, and the foot
   * is marked in hours like every other day view on the app.
   */
  const dayAxis = useMemo(() => {
    if (period !== "day") return undefined;
    return {
      xOf: (r: Reading) =>
        (r.at.getHours() * 60 + r.at.getMinutes()) / (24 * 60),
      // Every six hours: enough to read the shape of a day against without
      // the foot turning into a row of numbers.
      ticks: [0, 6, 12, 18, 24].map((h) => ({
        at: h / 24,
        label: `${String(h % 24).padStart(2, "0")}:00`,
      })),
    };
  }, [period]);

  /**
   * How the point being read out is dated.
   *
   * By the hour where it is a reading somebody took, and by the day or the
   * month where it is a whole day or a whole month averaged into one — a
   * time of day on a monthly mean is precision the figure does not have.
   */
  const stampOf = (at: Date) => {
    if (period === "day") return screeningStamp(at);
    // A year's points are its months; a week's and a month's are days.
    if (period === "year") return `${thaiMonthShort(at)} ${buddhistYear(at)}`;
    return thaiShortDate(at);
  };

  /** The colour a figure is drawn in on the chart, or nothing if it is fine. */
  const outOfBand = (value: number) => {
    const severity = severityOf(kind, value);
    return severity === 0 ? undefined : shade(metric.ink, severity);
  };

  /**
   * The lungs rising out of the tile's bottom edge as the page arrives, the
   * way the sensor does on the continuous monitor's page. Once, on the way in:
   * changing the window changes the readings, not what took them.
   */
  const rise = useSharedValue(0);
  useEffect(() => {
    rise.value = withDelay(
      // The same wait the trace takes, so the two arrive together.
      OPEN_MS,
      withTiming(1, { duration: MARK.ms, easing: Easing.out(Easing.cubic) }),
    );
  }, [rise]);
  const rising = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - rise.value) * (setup.art?.height ?? 0) }],
  }));

  /**
   * The band, written out, and how often the window left it in each
   * direction.
   *
   * Off the same table the colours come from, so the words and the shading
   * cannot drift apart — and it reads the way the reading is spoken about: a
   * range where the reading can fail both ways, a floor or a ceiling where it
   * can only fail one.
   */
  const inBand =
    // A pressure is spoken about as one figure over another and its band is
    // spoken about the same way: "ไม่เกิน 140/90", never "90–140", which
    // reads as one range and buries the fact that the ninety is the ceiling
    // on the other number rather than the floor under this one.
    metric.ceiling != null && metric.ceiling2 != null
      ? `อยู่ในเกณฑ์ (ไม่เกิน ${metric.ceiling}/${metric.ceiling2})`
      : band.low != null && band.high != null
        ? `อยู่ในเกณฑ์ (${band.low}–${band.high})`
        : band.low != null
          ? `อยู่ในเกณฑ์ (ไม่ต่ำกว่า ${band.low}${metric.unit})`
          : `อยู่ในเกณฑ์ (ไม่เกิน ${band.high}${metric.unit})`;

  const outside = useMemo(
    () => ({
      // A reading counts as over if either of its numbers is: a 128/98 is a
      // high pressure, and counted on the systolic alone the strip would say
      // the fortnight never left its band while the card above it said the
      // latest reading had.
      above: readings.filter(
        (r) =>
          (band.high != null && r.value > band.high) ||
          (r.value2 != null && severityOfPart(kind, r.value2, "second") > 0),
      ).length,
      below: readings.filter((r) => band.low != null && r.value < band.low)
        .length,
    }),
    [readings, band.low, band.high, kind],
  );

  /** How much of the window sat inside the band. */
  const inRange =
    summary == null ? 0 : 1 - summary.outOfRange / Math.max(summary.count, 1);
  const holding = inRange >= setup.holds;

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={metric.name} />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: SPACE.lg,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + SPACE.huge,
            gap: PAGE.gap,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Card padded={false}>
            <View style={{ padding: PAGE.pad, gap: PAGE.pad }}>
              {/*
                UIKit's own segmented control, through the `segmented-control`
                module — on iOS 26 the selected segment is a Liquid Glass
                capsule that slides, presses under the finger and takes the
                device's accent.

                The painted one is kept for a build the native module is
                missing from; same four choices in the same order, so nothing
                moves if it is ever needed.
              */}
              {SegmentedControlNative != null ? (
                <SegmentedControlNative
                  style={{ height: 32 }}
                  segments={PERIODS.map((p) => PERIOD_LABEL[p])}
                  selectedIndex={PERIODS.indexOf(period)}
                  onSegmentChange={(e) => {
                    setPeriod(PERIODS[e.nativeEvent.index] ?? period);
                    setPicked(null);
                  }}
                />
              ) : (
                <View
                  style={{
                    flexDirection: "row",
                    backgroundColor: GROUPED_BG,
                    borderRadius: RADIUS.capsule,
                    padding: 3,
                  }}
                >
                  {PERIODS.map((p) => (
                    <Segment
                      key={p}
                      label={PERIOD_LABEL[p]}
                      on={p === period}
                      onPress={() => {
                        setPeriod(p);
                        setPicked(null);
                      }}
                    />
                  ))}
                </View>
              )}

              {/* A card of its own inside the card — Figma 390:47160. Pale
                  blue so the reading and the mark read as one object sitting
                  on the page, with the chart below it as a second. */}
              <View
                style={{
                  backgroundColor: TILE.fill,
                  borderRadius: RADIUS.card,
                  padding: PAGE.pad,
                  minHeight: TILE.height,
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.sm,
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
                      flex: 1,
                      fontSize: 14,
                      lineHeight: 20,
                      fontWeight: "600",
                      color: TEXT_PRIMARY,
                    }}
                  >
                    {givenName(resident.name)}
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    gap: SPACE.xs,
                    marginTop: PAGE.pad,
                  }}
                >
                  <Text
                    style={[
                      FIGURE,
                      {
                        color:
                          status == null || status.tone === "normal"
                            ? TEXT_PRIMARY
                            : DANGER,
                      },
                    ]}
                  >
                    {shown == null ? "-" : readOut(shown)}
                  </Text>
                  <Text
                    style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}
                  >
                    {metric.unit}
                  </Text>

                </View>

                {/*
                  When it was taken, and whether it is the newest.

                  Without the words the two states are told apart only by a
                  timestamp the reader would have to know the current time to
                  judge — and the way back to the newest is a second tap on the
                  chosen point, which nobody looks for unless they know they
                  have left it.

                  Past a week the point is an average of a day or a month, so
                  it is named by its day rather than given a time it was never
                  taken at.
                */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.sm,
                    marginTop: SPACE.xs,
                  }}
                >
                  {/*
                    The date is the control: tapping it opens the system's own
                    calendar popover and the window moves to end on that day.

                    Three layers, and the order is the whole trick. The picker
                    is underneath, magnified so the touch lands on it anywhere
                    across the date. Over it goes an opaque patch of the
                    tile's own colour, because a control at two per cent is
                    still visible once enlarged. Over that, the date as it is
                    meant to be read. The patch passes touches through, and
                    the box clips the enlarged control back to the words.
                  */}
                  <View style={{ overflow: "hidden" }}>
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
                      <DateTimePicker
                        value={day}
                        mode="date"
                        display="compact"
                        locale="th-TH"
                        minimumDate={earliest}
                        maximumDate={planToday}
                        accessibilityLabel="เลือกวันที่"
                        style={{
                          // 0.02, not 0: UIKit skips hit testing on anything
                          // under one per cent, and the control would never
                          // see the touch.
                          opacity: 0.02,
                          transform: [{ scaleX: 2 }],
                        }}
                        onChange={(_e: unknown, next?: Date) => {
                          if (next == null) return;
                          setDay(startOfDay(next));
                          setPicked(null);
                          // A day is the whole of what there is to choose
                          // here, so choosing one is also the way out.
                          dismissDatePopover();
                        }}
                      />
                    </View>

                    <View
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: 0,
                        bottom: 0,
                        backgroundColor: TILE.fill,
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
                      <Text style={{ fontSize: 12, color: TEXT_MUTED }}>
                        {shown == null ? "ยังไม่มีข้อมูล" : stampOf(shown.at)}
                      </Text>
                    </View>
                  </View>

                  {/* Only while what is on show reaches today: the last
                      reading of a week gone by is the newest of that week,
                      not the newest there is. Read off the point rather than
                      off the chosen day, so a day picked earlier this month
                      still says so on the month's own view. */}
                  {picked == null &&
                    shown != null &&
                    isSameDay(shown.at, planToday) && (
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "600",
                          color: SUCCESS,
                        }}
                      >
                        {byDay ? "ล่าสุด" : "ค่าล่าสุด"}
                      </Text>
                    )}

                  {/*
                    The way back, and only while there is somewhere to come
                    back from.

                    A filled capsule rather than a word in blue: bare text
                    beside a timestamp reads as a label saying what the date
                    is, not as something to press.
                  */}
                  {!isSameDay(day, planToday) && (
                    <Pressable
                      onPress={() => {
                        setDay(planToday);
                        setPicked(null);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="กลับไปวันนี้"
                      hitSlop={6}
                      style={{
                        paddingHorizontal: SPACE.sm,
                        paddingVertical: 3,
                        borderRadius: RADIUS.capsule,
                        backgroundColor: PRIMARY_100,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          lineHeight: 16,
                          fontWeight: "600",
                          color: PRIMARY_500,
                        }}
                      >
                        วันนี้
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* The design's own illustration — Figma 409:47280 for the
                    lungs. The box is where it ends up and it clips, so the
                    picture is revealed from the bottom edge upwards as it
                    rises into place.

                    Only where there is one. A reading the design has not drawn
                    yet keeps the tile it already fills with a name, a number
                    and a date, rather than borrowing another reading's
                    picture or wearing a blurred-up icon. */}
                {setup.art != null && (
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      right: setup.art.right,
                      bottom: setup.art.bottom,
                      width: setup.art.width,
                      height: setup.art.height,
                      overflow: "hidden",
                    }}
                  >
                    <Reanimated.View style={rising}>
                      <Image
                        source={setup.art.source}
                        style={{
                          width: setup.art.width,
                          height: setup.art.height,
                        }}
                        resizeMode="contain"
                        accessibilityRole="none"
                      />
                    </Reanimated.View>
                  </View>
                )}
              </View>
            </View>

            {/* Inset from the card's edges and clear of its foot: run to the
                edges the line reaches the corner radius and the chart looks
                cropped rather than full-bleed. */}
            <View
              style={{ paddingHorizontal: PAGE.pad, paddingBottom: PAGE.pad }}
            >
              <TrendChart
                readings={points}
                kind={kind}
                ink={metric.ink}
                ink2={metric.ink2}
                // The pair keeps its own two colours rather than being shaded
                // off the warning ramp: red and purple is how the systolic is
                // told from the diastolic, and a bad window shaded both the
                // same red takes that away. Only a metric drawn as a pair —
                // which is only this one — asks for it. The card's own
                // sparkline already draws it this way.
                plain={metric.ink2 != null}
                height={224}
                picked={picked}
                onPick={setPicked}
                scale={scale.range}
                // The scale is already the whole band with room to spare;
                // more air on top of it would push the readings into a strip
                // across the middle.
                headroom={0}
                // As many gaps as the axis was rounded into, so every number
                // up the side is a whole one.
                steps={scale.steps}
                stamp={STAMP[period]}
                /*
                  Dots for a day, with nothing drawn between them: each is a
                  reading the oximeter took on that hour rather than a point
                  on a curve, and a line through them would invent the values
                  in between — rounding the bottom off every dip, which is the
                  one thing an oximetry trace is read for.

                  Bars for anything wider: a day from its low to its high.
                */
                mark={setup.chart === "line" ? "line" : byDay ? "bars" : "dots"}
                bands={byDay ? bands : undefined}
                slots={grid?.slots}
                slotAt={grid?.at}
                xOf={dayAxis?.xOf}
                axisTicks={dayAxis?.ticks}
                focus={focus}
              />
            </View>
          </Card>

          {summary != null && (
            <>
              {/*
                Three to a row, and which three depends on which way the
                reading can fail. One that fails at both ends is worth its
                high and its low; one that fails at a single end has a figure
                that can only ever read "fine" if it carries both, and a third
                of the strip is then spent saying nothing.
              */}
              <View style={{ flexDirection: "row", gap: PAGE.gap }}>
                <StatTile
                  label="เฉลี่ย"
                  value={
                    summary.average2 == null
                      ? summary.average.toFixed(metric.decimals)
                      : `${summary.average.toFixed(metric.decimals)}/${summary.average2.toFixed(metric.decimals)}`
                  }
                  unit={metric.unit}
                />
                {setup.stats === "range" ? (
                  <StatTile
                    label="สูงสุด"
                    value={summary.high.toFixed(metric.decimals)}
                    unit={metric.unit}
                    ink={outOfBand(summary.high)}
                  />
                ) : null}
                <StatTile
                  label="ต่ำสุด"
                  value={summary.low.toFixed(metric.decimals)}
                  unit={metric.unit}
                  ink={outOfBand(summary.low)}
                />
                {setup.stats === "low" ? (
                  <StatTile
                    label="ต่ำกว่าเกณฑ์"
                    value={`${summary.outOfRange}`}
                    unit="ครั้ง"
                    ink={summary.outOfRange > 0 ? WARNING : undefined}
                  />
                ) : null}
              </View>

              <Card>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.sm,
                  }}
                >
                  <UIcon name={setup.icon} size={16} color={TEXT_PRIMARY} />
                  <Text
                    style={{
                      fontSize: 16,
                      lineHeight: 22,
                      fontWeight: "600",
                      color: TEXT_PRIMARY,
                    }}
                  >
                    สรุปภาพรวม
                  </Text>
                </View>

                {/*
                  The share of the window spent in the band, first.

                  An average of 96 can be a steady 96 or a week of 99s with two
                  mornings at 88, and only the share of readings inside the
                  band tells those apart — which for oxygen is the whole of
                  what is being watched for.
                */}
                <View style={{ marginTop: SPACE.lg, gap: SPACE.sm }}>
                  <View
                    style={{ flexDirection: "row", alignItems: "baseline" }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 14,
                        lineHeight: 20,
                        color: TEXT_MUTED,
                      }}
                    >
                      {inBand}
                    </Text>
                    {/* Green while the week held, and the app's own black
                        when it did not. A figure that turns brown to say so
                        is the page raising its voice at a number the reader
                        can already see is short — and the line under this one
                        says how short, in readings. */}
                    <Text
                      style={{
                        fontSize: 20,
                        lineHeight: 26,
                        fontWeight: "700",
                        color: holding ? SUCCESS : TEXT_PRIMARY,
                      }}
                    >
                      {`${Math.round(inRange * 100)}%`}
                    </Text>
                  </View>

                  {/*
                    The same number as a bar, so it is read before it is
                    counted.

                    Thin, and in the verdict's colour rather than the
                    reading's — green holding, amber slipped, red well past.
                    It used to take the metric's own ink, which made the same
                    eighty per cent read as alarm on the pressure page and as
                    calm on the oxygen one; the hue said which reading it was,
                    which the heading already says. It still runs pale to deep
                    the way the bars above it do, so only the colour has
                    changed and not the weight. See `rangeInk`.
                  */}
                  <View
                    style={{
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: PRIMARY_100,
                      overflow: "hidden",
                    }}
                  >
                    <LinearGradient
                      colors={rangeInk(inRange, setup.holds)}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        width: `${Math.round(inRange * 100)}%`,
                        height: 6,
                        borderRadius: 3,
                      }}
                    />
                  </View>
                </View>

                {/*
                  The verdict, in the summary rather than beside the figure.

                  It rode next to the reading as a tinted capsule, which put a
                  coloured badge over the one number the page exists to show
                  and said in two words what the three lines under it say
                  properly. Here it is the first of them, in the same voice as
                  the rest, and the figure is left to be a figure.
                */}
                {status != null && shown != null && (
                  <Bullet
                    ink={TONE_INK[status.tone]}
                    text={`ค่าที่อ่าน ${readOut(shown)} ${metric.unit} · ${status.label}`}
                  />
                )}
                <Bullet
                  ink={summary.outOfRange > 0 ? WARNING : SUCCESS}
                  text={
                    setup.stats === "range"
                      ? `สูงกว่าเกณฑ์ ${outside.above} ครั้ง · ต่ำกว่าเกณฑ์ ${outside.below} ครั้ง จาก ${summary.count} ค่า`
                      : `ต่ำกว่าเกณฑ์ ${summary.outOfRange} ครั้ง จาก ${summary.count} ค่า · ต่ำสุด ${summary.low.toFixed(metric.decimals)}${metric.unit}`
                  }
                />
                <Bullet
                  ink={summary.trend === setup.worse ? WARNING : SUCCESS}
                  text={
                    summary.trend === "flat"
                      ? `${setup.noun}${OVER[period]}ค่อนข้างคงที่`
                      : summary.trend === "up"
                        ? `${setup.noun}${OVER[period]}มีแนวโน้มสูงขึ้น`
                        : `${setup.noun}${OVER[period]}มีแนวโน้มลดลง`
                  }
                />
              </Card>
            </>
          )}
        </ScrollView>
      </HeaderFade>
    </View>
  );
}

function Bullet({ ink, text }: { ink: string; text: string }) {
  return (
    <View style={{ flexDirection: "row", gap: SPACE.sm, marginTop: SPACE.md }}>
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          marginTop: 8,
          backgroundColor: ink,
        }}
      />
      <Text
        style={{ flex: 1, fontSize: 14, lineHeight: 22, color: TEXT_PRIMARY }}
      >
        {text}
      </Text>
    </View>
  );
}

function Segment({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={{
        flex: 1,
        height: 34,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: RADIUS.capsule,
        backgroundColor: on ? PRIMARY_500 : "transparent",
      }}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: on ? "700" : "500",
          color: on ? "#FFFFFF" : TEXT_PRIMARY,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
