import type { Resident } from "./household";
import { rightNow } from "./clock";
import { planToday } from "./task";
import { startOfDay } from "../utils/thaiDate";

/** The six things this app tracks between visits. */
export type MetricKind = "bp" | "pulse" | "temp" | "spo2" | "glucose" | "cgm";

/** How a reading reads at a glance. Drives the colour and nothing else. */
export type Tone = "normal" | "warn" | "alert";

export type Reading = {
  at: Date;
  value: number;
  /** Diastolic, for blood pressure. Nothing else has a second number. */
  value2?: number;
};

export type Metric = {
  kind: MetricKind;
  /** The full name, for the card. */
  name: string;
  /**
   * The short name — what a card or a list row is labelled with.
   *
   * The full name is for a page about that one reading. Anywhere six of them
   * sit together the long forms are the same three words with a different
   * tail ("ออกซิเจนในเลือด", "น้ำตาลในเลือด"), and they wrap or truncate on a
   * half-width card.
   */
  short: string;
  unit: string;
  /** Whole numbers everywhere except temperature. */
  decimals: number;
  /**
   * Where the normal band ends. Drawn on the chart as the line a reading is
   * judged against, so it has to be the same number the status uses.
   */
  ceiling?: number;
  /** The same for the second series. */
  ceiling2?: number;
  /** What the chart should span, before the readings widen it. */
  axis: [number, number];
  /**
   * The card's own ink — Figma 363:44088 gives each metric a colour of its
   * own rather than one accent for all six, which is what makes a column of
   * them readable at a glance.
   */
  ink: string;
  /** Second series' ink, where the metric has two. */
  ink2?: string;
  /**
   * How its card draws it.
   *
   * `ecg` is the pulse and only the pulse: a heart rate on a trend line hides
   * the one thing the number means — eighty and a hundred and twenty are the
   * same shape — where a trace at the rate it is beating says it outright.
   */
  chart: "area" | "ecg";
  /**
   * How much time the card's sparkline covers. Only the continuous monitor
   * gets a day: for everything else a day is one or two readings, which is a
   * dot rather than a line.
   */
  span: "day" | "week";
};

export const METRICS: Metric[] = [
  {
    kind: "bp",
    name: "ความดันโลหิต",
    short: "ความดัน",
    unit: "mmHg",
    decimals: 0,
    ceiling: 140,
    ceiling2: 90,
    axis: [60, 180],
    // Red over purple, the design's own pair. The out-of-range marks on this
    // chart are dots with a white ring rather than a shaded line, so a red
    // line does not swallow them.
    ink: "#FF2D55",
    ink2: "#5856D6",
    chart: "area",
    span: "week",
  },
  {
    kind: "pulse",
    name: "อัตราการเต้นของหัวใจ",
    // What the accept-task screen already calls this.
    short: "ชีพจร",
    unit: "bpm",
    decimals: 0,
    ceiling: 100,
    axis: [50, 120],
    ink: "#BE123C",
    chart: "ecg",
    span: "week",
  },
  {
    kind: "temp",
    name: "อุณหภูมิ",
    short: "อุณหภูมิ",
    unit: "°C",
    decimals: 1,
    ceiling: 37.5,
    axis: [35, 39],
    ink: "#077DD7",
    chart: "area",
    span: "week",
  },
  {
    kind: "spo2",
    name: "ออกซิเจนในเลือด",
    short: "ออกซิเจน",
    unit: "%",
    decimals: 0,
    axis: [88, 100],
    ink: "#36BFFA",
    chart: "area",
    span: "week",
  },
  {
    kind: "glucose",
    name: "น้ำตาลในเลือด",
    short: "น้ำตาล",
    unit: "mg/dl",
    decimals: 0,
    ceiling: 140,
    axis: [70, 200],
    // A deep green, which is where the app parts sugar from the continuous
    // monitor's teal: the two read the same substance and their charts sit on
    // the same page, so they cannot be the same colour.
    ink: "#12805C",
    chart: "area",
    span: "week",
  },
  {
    kind: "cgm",
    name: "น้ำตาลต่อเนื่อง (CGM)",
    short: "CGM",
    unit: "mg/dl",
    decimals: 0,
    ceiling: 140,
    axis: [70, 200],
    ink: "#34C759",
    chart: "area",
    span: "day",
  },
];

export const metricOf = (kind: MetricKind) =>
  METRICS.find((m) => m.kind === kind) ?? METRICS[0];

/**
 * Where each metric's normal band ends, and how far past it counts as serious.
 *
 * `[warn, alert]`: the first number is the edge of normal, the second is where
 * it stops being a note and becomes a problem. `high`/`low` are the two
 * directions a reading can fail in — oxygen only fails low, pressure fails
 * either way — and `high2`/`low2` are the same for a second number, which only
 * blood pressure has.
 *
 * One table, read by both the wording and the colour, so a reading can never
 * be called normal in one place and shaded red in another.
 */
const BANDS: Record<
  MetricKind,
  {
    high?: [number, number];
    low?: [number, number];
    high2?: [number, number];
    low2?: [number, number];
  }
> = {
  bp: { high: [140, 160], low: [90, 80], high2: [90, 100] },
  pulse: { high: [100, 120], low: [50, 40] },
  temp: { high: [37.5, 38.5], low: [35, 34] },
  spo2: { low: [95, 92] },
  glucose: { high: [140, 180], low: [70, 60] },
  cgm: { high: [140, 180], low: [70, 60] },
};

/**
 * Where a reading stops being normal, in each direction.
 *
 * The same table the colours come out of, so a page that writes the threshold
 * out in words cannot drift from the one the chart shades against.
 */
export function normalBand(kind: MetricKind): { low?: number; high?: number } {
  const band = BANDS[kind];
  return { low: band.low?.[0], high: band.high?.[0] };
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * How far outside its band a reading sits: 0 while it is normal, 1 once it is
 * as far out as the table calls serious.
 *
 * A number rather than a verdict, because the chart shades by it — a reading
 * a hair over the line and one well past it are not the same colour, and a
 * three-state flag cannot say which is which.
 */
const over = (v: number, pair?: [number, number]) =>
  pair == null || v <= pair[0]
    ? 0
    : clamp01((v - pair[0]) / (pair[1] - pair[0]));
const under = (v: number, pair?: [number, number]) =>
  pair == null || v >= pair[0]
    ? 0
    : clamp01((pair[0] - v) / (pair[0] - pair[1]));

export function severityOf(
  kind: MetricKind,
  value: number,
  value2?: number,
): number {
  const band = BANDS[kind];
  return Math.max(
    over(value, band.high),
    under(value, band.low),
    value2 == null ? 0 : over(value2, band.high2),
    value2 == null ? 0 : under(value2, band.low2),
  );
}

/**
 * The severity of one of the two numbers on its own.
 *
 * A chart marks the line the reading is on, so it has to know which of the
 * two broke its band: a mark on the systolic line for a high diastolic is a
 * mark in the wrong place.
 */
/**
 * Which way a reading left its band, or null while it is inside it.
 *
 * `severityOfPart` says how far out a reading is and this says which side it
 * went out on — the two halves of the same question, off the same table, so a
 * mark drawn from one cannot disagree with a colour drawn from the other.
 *
 * Read by the chart to point an arrow at a reading that broke its band: with
 * the warning ramp off, the arrow is the only thing saying a point is out,
 * and an arrow pointing the wrong way would be worse than none at all.
 */
export function breachOf(
  kind: MetricKind,
  value: number,
  part: "first" | "second" = "first",
): "high" | "low" | null {
  const band = BANDS[kind];
  const high = part === "first" ? band.high : band.high2;
  const low = part === "first" ? band.low : band.low2;
  if (high != null && value > high[0]) return "high";
  if (low != null && value < low[0]) return "low";
  return null;
}

export function severityOfPart(
  kind: MetricKind,
  value: number,
  part: "first" | "second",
): number {
  const band = BANDS[kind];
  return part === "first"
    ? Math.max(over(value, band.high), under(value, band.low))
    : Math.max(over(value, band.high2), under(value, band.low2));
}

/**
 * What a reading means, in the words a carer would use.
 *
 * Ordinary Thai community-nursing thresholds. Written per metric rather than
 * as one comparison against `ceiling`, because "out of range" is not one
 * thing: oxygen and blood pressure fail in opposite directions, and a reading
 * a little over the line is a different sentence from one well over it.
 */
export function statusOf(
  kind: MetricKind,
  value: number,
  value2?: number,
): { label: string; tone: Tone } {
  // The verdict comes off the same table the shading does; only the wording
  // is decided here.
  const severity = severityOf(kind, value, value2);
  const tone: Tone =
    severity === 0 ? "normal" : severity < 1 ? "warn" : "alert";
  if (tone === "normal") return { label: "ปกติ", tone };

  const band = BANDS[kind];
  const high =
    (band.high != null && value > band.high[0]) ||
    (band.high2 != null && value2 != null && value2 > band.high2[0]);

  switch (kind) {
    case "bp":
      return {
        label: high ? (tone === "alert" ? "สูง" : "สูงเล็กน้อย") : "ต่ำ",
        tone,
      };
    case "pulse":
      return { label: high ? "หัวใจเต้นเร็ว" : "หัวใจเต้นช้า", tone };
    case "temp":
      // Graded, like every other reading here. It used to answer "มีไข้" to
      // both 37.6 and 39.2, which are not the same news — and the tone that
      // tells them apart was already being worked out a line above and thrown
      // away. 38.5 is where the table stops calling it a note and calls it a
      // problem, so that is where the word changes too.
      return {
        label: high
          ? tone === "alert"
            ? "ไข้สูง"
            : "ไข้ต่ำ"
          : tone === "alert"
            ? "อุณหภูมิต่ำมาก"
            : "อุณหภูมิต่ำ",
        tone,
      };
    case "spo2":
      return { label: tone === "alert" ? "ออกซิเจนต่ำ" : "ต่ำเล็กน้อย", tone };
    case "glucose":
    case "cgm":
      return {
        label: high
          ? tone === "alert"
            ? "น้ำตาลสูง"
            : "สูงเล็กน้อย"
          : "น้ำตาลต่ำ",
        tone,
      };
  }
}

/** "150/77" for a pressure, "36.5" for a temperature. */
export function formatReading(m: Metric, r: Reading): string {
  const one = r.value.toFixed(m.decimals);
  return r.value2 == null ? one : `${one}/${r.value2.toFixed(m.decimals)}`;
}

/* -------------------------------------------------------------------------
   Sample readings.

   Deterministic from the patient's id and the metric, so a record reads the
   same on every launch and two patients do not share a chart. Until this is
   wired to the devices that take these readings, that is the whole point:
   the shapes have to be stable enough to design against.
   ------------------------------------------------------------------------- */

/** A stable 0–1 from a string and a step. No Math.random anywhere near a chart. */
function noise(seed: string, i: number): number {
  let h = 2166136261;
  const text = `${seed}#${i}`;
  for (let k = 0; k < text.length; k++) {
    h ^= text.charCodeAt(k);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * How often each reading is taken.
 *
 * The continuous monitor every fifteen minutes, which is what one is — hourly
 * points make a three-hour window three dots. Oxygen on the hour, round the
 * clock, because a worn oximeter's day is a night and a day and the night is
 * the half worth having. Sugar on the hour too — a day of it is a day of
 * meals, and four readings cannot draw one — and the pulse, whose day is the
 * difference between what a heart does awake and what it does asleep.
 * Pressure morning and evening, and the rest once, when somebody is there to
 * take them.
 */
const PER_DAY: Record<MetricKind, number> = {
  cgm: 96,
  spo2: 24,
  glucose: 24,
  pulse: 24,
  bp: 2,
  temp: 1,
};

/** The shape each metric wanders around: a centre, a spread, and a drift. */
const SHAPE: Record<
  MetricKind,
  {
    base: number;
    spread: number;
    drift: number;
    base2?: number;
    spread2?: number;
  }
> = {
  bp: { base: 132, spread: 14, drift: 12, base2: 82, spread2: 8 },
  pulse: { base: 86, spread: 16, drift: 6 },
  // A well person's day, and only that. What a fever adds is not noise on top
  // of this — see `feverLift`.
  temp: { base: 36.6, spread: 0.55, drift: 0.15 },
  spo2: { base: 97, spread: 2.5, drift: -0.6 },
  glucose: { base: 128, spread: 26, drift: 10 },
  // Wider than the finger-prick reading and drifting less: it is the same
  // blood, sampled around the clock, so it catches the swings after meals
  // that a single morning reading never sees.
  cgm: { base: 131, spread: 30, drift: 8 },
};

/**
 * The rise and fall of a day's glucose.
 *
 * Three meals and the slow drift between them, which is the shape every
 * continuous trace has: up within the hour of eating, back down over the two
 * after it, and its lowest before breakfast. The times move a little from
 * patient to patient, because a ward where everyone eats at the same minute
 * is not one anybody works on.
 */
function mealCurve(hour: number, seed: string): number {
  const meals: [number, number][] = [
    [7.5 + noise(seed, 7001), 30],
    [12.5 + noise(seed, 7002), 36],
    [18.5 + noise(seed, 7003), 32],
  ];
  // A gaussian each, wide enough to overlap into the plateau between lunch
  // and dinner rather than falling to the floor between them.
  const bumps = meals.reduce((sum, [at, height]) => {
    const d = hour - at;
    return sum + height * Math.exp(-(d * d) / (2 * 1.9 * 1.9));
  }, 0);
  // The overnight fall, deepest around four in the morning.
  const night = -14 * Math.exp(-Math.pow(hour - 4, 2) / (2 * 3 * 3));
  return bumps + night - 12;
}

/**
 * The dip oxygen takes overnight.
 *
 * Saturation falls while a patient sleeps — lying flat, breathing shallower,
 * and deepest in the early hours — and comes back within an hour of waking.
 * It is the reason a night's worth of readings is worth having at all: a day
 * of daytime readings is 97 all the way across and says nothing, and the
 * overnight low is what a patient on home oxygen is being followed for.
 */
function sleepDip(
  hour: number,
  seed: string,
  day: number,
  depths: [number, number],
): number {
  // Around three in the morning, give or take an hour from patient to
  // patient, and about as wide as a night's sleep.
  const at = 3 + (noise(seed, 7101) - 0.5) * 2;
  /*
    How bad this particular night was.

    Per night, not per patient. Nights differ — a cold, a night spent on the
    back, a night the sensor slipped — and drawn from one figure every night
    came out the same depth, which made a week of bars seven copies of one
    bar. A chart of a week exists to show which night was the bad one.
  */
  const depth = depths[0] + noise(seed, day * 96 + 90) * depths[1];
  const d = hour - at;
  return -depth * Math.exp(-(d * d) / (2 * 2.6 * 2.6));
}

/**
 * How far each reading falls overnight, as a floor and a spread.
 *
 * Saturation dips by a point or four; a heart beating eighty in the afternoon
 * beats sixty-five asleep. Both are the reason a night is worth recording,
 * and both are read off the same curve.
 */
const NIGHT_DIP: Partial<Record<MetricKind, [number, number]>> = {
  spo2: [0.7, 3.8],
  pulse: [8, 10],
};

/** How much a single reading of those wanders around the curve. */
const HOUR_WOBBLE: Partial<Record<MetricKind, number>> = {
  spo2: 0.5,
  pulse: 3,
};

/**
 * How much a whole day sat above or below its neighbours.
 *
 * Without it every day of a reading with a shape to it comes out the same
 * day: a meal curve is a meal curve, and a week of them averages to seven
 * identical figures and draws as a flat line. This is what makes one day
 * different from the next rather than one hour different from the last.
 */
const dayLevel = (seed: string, day: number, amplitude: number) =>
  (noise(seed, day * 96 + 91) - 0.5) * 2 * amplitude;

/**
 * The one record that is always ill today — the top row of the follow-up
 * register, so the app's warning states are visible without hunting. See
 * `feverLift`.
 */
const FEVER_TODAY = "v4h0r4";

/**
 * How much a fever adds to a temperature on the day it is read.
 *
 * Written as an episode rather than as wider noise, because widening the
 * noise cannot say what a fever is. `noise` is flat — it has no thin tail —
 * so a spread wide enough to reach 38° put a quarter of every record over the
 * line and left ninety-six in a hundred patients having run a temperature
 * this month, which is not a register anybody would believe. And the readings
 * it produced were scattered: one high day, the next normal, which reads as a
 * thermometer being used badly rather than as somebody being ill.
 *
 * A fever is a few people, for a few days, and it climbs and breaks. So: about
 * one record in six runs them at all, on a cycle of its own, two to four days
 * at a time, peaking in the middle of the run. Everybody else stays inside the
 * band their own noise gives them, which is where a well person belongs.
 *
 * Deterministic like everything else here — the same record and the same day
 * give the same answer, so a page opened twice shows the same illness.
 */
function feverLift(id: string, since: number): number {
  const seed = `${id}:temp`;

  /*
    The record the register opens on is running one now.

    Same reasoning as "today always carries visits" in `task`: the episodes
    below are scattered over two years by a hash, so on any given day the
    handful of patients running a temperature are somewhere down a list of
    three hundred and twenty-four, and the page anybody actually opens first
    shows a flat green line. The warning states then exist but are never seen.

    So the top row of the follow-up register is ill today — climbing over the
    two days before and peaking on the day the app is opened, so the card in
    the list, the week the page opens on and the reading called out large all
    have something to say. It is one record, named, and the rest of the
    register is left to the hash.

    Tied to the id rather than to position: if the register's order changes
    this stops being the first row and becomes an ordinary ill patient, which
    is a wrong demo rather than a broken one.
  */
  if (id === FEVER_TODAY) {
    if (since > 2) return 0;
    return 1.2 + (1 - since / 3) * 0.9;
  }

  // Whether this record runs temperatures at all.
  if (noise(seed, 7717) > 0.25) return 0;

  // Its own rhythm, so two patients are not ill on the same days.
  const cycle = 18 + Math.floor(noise(seed, 7721) * 22);
  const days = 2 + Math.floor(noise(seed, 7723) * 3);
  const phase = Math.floor(noise(seed, 7719) * cycle);
  const into = (((since - phase) % cycle) + cycle) % cycle;
  if (into >= days) return 0;

  // Up and down across the run rather than a step: a temperature that
  // appears at its peak and vanishes from it is not one anybody watched.
  const t = days === 1 ? 1 : 1 - Math.abs((into / (days - 1)) * 2 - 1);
  // Enough to be over the line at the shoulders and well past it at the peak.
  //
  // The first attempt lifted by 0.8 at the shoulders, which on a base of 36.7
  // came to exactly 37.5 — the fever threshold, and the threshold is read as
  // "up to and including", so the day the patient started running a
  // temperature was still reported as ปกติ. A shoulder has to clear the line,
  // not touch it: 1.2 puts it near 37.9, and the peak lands around 38.8,
  // which is over the 38.5 the table calls serious. So an episode is drawn
  // climbing into the warning range and out the other side, which is the
  // shape the page's colours were built to show.
  return 1.2 + t * 0.9;
}

/** How far one day moves from the next, in each reading's own units. */
const DAY_DRIFT: Partial<Record<MetricKind, number>> = {
  spo2: 0.6,
  glucose: 9,
  cgm: 9,
  pulse: 5,
};

/**
 * How far back the record goes: two years.
 *
 * Not a number pulled out of the air. The continuous monitor's page browses a
 * day at a time and the oximeter's browses a year at a time, and both of them
 * offer the calendar every day between here and the far end of this — so this
 * is how much of a patient's past the app claims to hold, and every date the
 * pickers will let a carer land on.
 */
export const HISTORY_DAYS = 730;

/**
 * The last moment the record covers.
 *
 * The app's "today" is a date at midnight, so reading it as the cutoff would
 * throw away every reading taken during today — and the day view, whose whole
 * window is today, would come up empty. The record runs to the end of the day
 * it is being read on.
 */
const recordEnd = (now: Date) => {
  const end = new Date(startOfDay(now));
  end.setDate(end.getDate() + 1);
  const lastOfDay = new Date(end.getTime() - 1);
  // The whole of any day already over, but never later than the clock: with
  // "today" read from the real date, a record that ran to midnight had the
  // continuous monitor reporting readings it has not taken yet, and the card
  // stamped "ค่าล่าสุด" with a time still hours away.
  const clock = rightNow();
  return lastOfDay.getTime() > clock.getTime() ? clock : lastOfDay;
};

/**
 * One patient's readings for one metric, oldest first.
 *
 * The drift is deliberate: a chart of pure noise has no trend to read, and
 * the summary line exists to say which way things are going.
 */
export function readingsFor(
  resident: Resident,
  kind: MetricKind,
  now: Date = planToday,
  days: number = HISTORY_DAYS,
): Reading[] {
  const shape = SHAPE[kind];
  const m = metricOf(kind);
  const seed = `${resident.id}:${kind}`;
  const end = recordEnd(now);
  const out: Reading[] = [];

  /**
   * How often it is taken.
   *
   * The continuous monitor is the only one worth charting over a day, and it
   * has to be sampled like one: hourly, right round the clock, so its card
   * shows a trend rather than four dots between breakfast and dinner. The
   * rest are read once or twice while somebody is at the house.
   */
  const continuous = kind === "cgm";
  /**
   * Worn rather than visited.
   *
   * The continuous monitor and the oximeter both read round the clock, which
   * is what makes a day of either worth charting; the rest are taken when
   * somebody is at the house to take them, which is daytime.
   */
  const clock =
    kind === "cgm" ||
    kind === "spo2" ||
    kind === "glucose" ||
    kind === "pulse";
  /** The ones whose day is a day of meals. */
  const meals = kind === "cgm" || kind === "glucose";
  const perDay = PER_DAY[kind];

  /**
   * How far the day being read back from is from today.
   *
   * The record belongs to the calendar, not to the question being asked of
   * it: a date has to give the same readings whether it is reached by opening
   * the page or by picking it out of a month. Counted from `now` alone, every
   * step back through the calendar rewrote the days it landed on — the second
   * of September held one set of readings from today's window and another
   * from last week's.
   */
  const back = Math.round(
    (startOfDay(planToday).getTime() - startOfDay(now).getTime()) / 86_400_000,
  );

  for (let day = Math.min(days, HISTORY_DAYS); day >= 0; day--) {
    for (let k = 0; k < perDay; k++) {
      // Counted from today rather than from the window: the same date, the
      // same index, the same readings.
      const since = day + back;
      const i = since * 96 + k;
      const progress = Math.max(0, 1 - since / HISTORY_DAYS);
      const wobble = (noise(seed, i) - 0.5) * 2;
      // A continuous trace is a curve with meals on it, not a fresh number
      // every hour: hour-to-hour noise at full spread came out as a scribble,
      // which is the one thing a trend line must not look like.
      // The hour of the day this sample was taken at, as a fraction — the
      // meal curve is drawn against the clock, not against the sample number.
      const hour = (k * 24) / perDay;
      const drifted =
        shape.base +
        shape.drift * progress +
        dayLevel(seed, since, DAY_DRIFT[kind] ?? 0) +
        (kind === "temp" ? feverLift(resident.id, since) : 0);
      // The same reasoning as the glucose trace: a curve with a night in it,
      // not a fresh number every hour. At full spread the wobble came out as
      // a scribble and buried the dip it is drawn around.
      const night = NIGHT_DIP[kind];
      const value = meals
        ? drifted + mealCurve(hour, seed) + wobble * 4
        : night != null
          ? drifted +
            sleepDip(hour, seed, since, night) +
            wobble * (HOUR_WOBBLE[kind] ?? 1)
          : drifted + wobble * shape.spread;

      const at = new Date(startOfDay(now));
      at.setDate(at.getDate() - day);
      if (clock)
        at.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);
      else at.setHours(7 + Math.round((k * 16) / perDay), (i % 4) * 15, 0, 0);
      // Nothing past the end of the day being read: a record cannot hold a
      // reading that has not been taken yet.
      if (at > end) continue;

      const reading: Reading = {
        at,
        value: Number(value.toFixed(m.decimals)),
      };
      if (shape.base2 != null && shape.spread2 != null) {
        const wobble2 = (noise(seed, i + 991) - 0.5) * 2;
        reading.value2 = Number(
          (
            shape.base2 +
            shape.drift * 0.4 * progress +
            wobble2 * shape.spread2
          ).toFixed(m.decimals),
        );
      }
      out.push(reading);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */

export type Period = "day" | "week" | "month" | "year";

export const PERIOD_LABEL: Record<Period, string> = {
  day: "วัน",
  week: "สัปดาห์",
  month: "เดือน",
  year: "ปี",
};

const PERIOD_DAYS: Record<Period, number> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

/** The readings inside a window ending now. */
export function within(
  readings: Reading[],
  period: Period,
  now: Date,
): Reading[] {
  const from = new Date(startOfDay(now));
  from.setDate(from.getDate() - (PERIOD_DAYS[period] - 1));
  const end = recordEnd(now);
  return readings.filter((r) => r.at >= from && r.at <= end);
}

/**
 * The chart's points.
 *
 * A year of daily readings is 365 dots on a 300pt chart, which is a smudge —
 * so anything past a week is averaged into buckets, and the bucket is a day
 * for a month and a month for a year. The day and week views are the readings
 * themselves; at that density every point is worth seeing.
 */
export function series(readings: Reading[], period: Period): Reading[] {
  if (period === "day" || period === "week") return readings;

  const buckets = new Map<string, Reading[]>();
  for (const r of readings) {
    const key =
      period === "month"
        ? `${r.at.getMonth()}-${r.at.getDate()}`
        : `${r.at.getFullYear()}-${r.at.getMonth()}`;
    const list = buckets.get(key);
    if (list == null) buckets.set(key, [r]);
    else list.push(r);
  }

  return [...buckets.values()].map((list) => {
    const mean = (pick: (r: Reading) => number | undefined) => {
      const nums = list.map(pick).filter((n): n is number => n != null);
      return nums.length === 0
        ? undefined
        : nums.reduce((a, b) => a + b, 0) / nums.length;
    };
    return {
      // The middle of the bucket, so a point sits where its readings were.
      at: list[Math.floor(list.length / 2)].at,
      value: Math.round((mean((r) => r.value) ?? 0) * 10) / 10,
      value2:
        mean((r) => r.value2) == null
          ? undefined
          : Math.round((mean((r) => r.value2) ?? 0) * 10) / 10,
    };
  });
}

/**
 * The calendar period a day falls in.
 *
 * The week it is in, not the seven days before it. Asked for a week while
 * standing on a Wednesday, a rolling window answers "last Thursday to this
 * Wednesday", which is a week nobody keeps: the days are labelled Thursday
 * first and the same reading moves across the chart as the days pass. A
 * calendar week has an answer that holds still, and it is the one somebody
 * means when they point at a date and say "that week".
 */
export function periodRange(
  period: Period,
  day: Date,
): { from: Date; to: Date } {
  const from = startOfDay(day);
  const to = startOfDay(day);

  if (period === "week") {
    // Monday to Sunday: the working week, which is the one a round of visits
    // is planned in.
    from.setDate(from.getDate() - ((from.getDay() + 6) % 7));
    to.setTime(from.getTime());
    to.setDate(to.getDate() + 6);
  } else if (period === "month") {
    from.setDate(1);
    // The zeroth of next month is the last of this one, whichever month it is.
    to.setMonth(to.getMonth() + 1, 0);
  } else if (period === "year") {
    from.setMonth(0, 1);
    to.setMonth(11, 31);
  }

  return { from, to };
}

/**
 * What one point of each window is.
 *
 * Each window is one of itself — the week the chosen date falls in, the month
 * it falls in, the year it falls in — and is drawn as the unit below it: a
 * week as its days, a year as its months. Nothing runs across the edge of the
 * window it belongs to, so what is on screen is that week, that month, that
 * year, and no part of any other.
 */
const BUCKET: Record<Period, Period> = {
  day: "day",
  week: "day",
  month: "day",
  year: "month",
};

/**
 * The same window, as far as the record goes back.
 *
 * What a chart of it should be laid out over — the whole of it, including the
 * days that have not happened yet. A week the present is inside of is still a
 * week: drawn over only the days gone by, Wednesday sits at the right-hand
 * edge as though the week were over.
 *
 * Clipped at the start only, where the window reaches back past the record.
 */
export function periodGrid(
  period: Period,
  day: Date,
): { from: Date; to: Date } {
  const { from, to } = periodRange(period, day);
  const floor = startOfDay(planToday);
  floor.setDate(floor.getDate() - HISTORY_DAYS);
  return { from: from < floor ? floor : from, to };
}

/** The first day of the unit a date falls in. */
function unitStart(period: Period, day: Date): Date {
  const d = startOfDay(day);
  // Monday to Sunday, as the visit plan counts a week.
  if (period === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  else if (period === "month") d.setDate(1);
  else if (period === "year") d.setMonth(0, 1);
  return d;
}

/**
 * The readings a window covers, as far as the record goes.
 *
 * Never past today, because a window the present is inside of runs into the
 * future and the future has no readings in it; never before the record
 * starts, for the same reason at the other end.
 */
function readingsIn(
  resident: Resident,
  kind: MetricKind,
  period: Period,
  day: Date,
): Reading[] {
  const { from, to } = periodGrid(period, day);
  const last = to > planToday ? startOfDay(planToday) : to;
  if (last < from) return [];
  const first = from;

  const days = Math.round((last.getTime() - first.getTime()) / 86_400_000);
  return readingsFor(resident, kind, last, days).filter((r) => r.at >= first);
}

/**
 * The readings gathered into one entry per unit of the window.
 *
 * A week's worth of a reading taken hourly is a hundred and sixty-eight
 * points, which draws as a scribble; twelve weeks of it is two thousand. What
 * a window of weeks is for is one figure a week, and what each of those weeks
 * covered.
 */
function bucketed(readings: Reading[], period: Period): Band[] {
  const groups = new Map<string, Reading[]>();
  for (const r of readings) {
    const start = unitStart(period, r.at);
    const key = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
    const list = groups.get(key);
    if (list == null) groups.set(key, [r]);
    else list.push(r);
  }

  // Oldest first: the readings arrive that way and a Map keeps the order it
  // first saw each key in.
  return [...groups.values()].map((list) => {
    const values = list.map((r) => r.value);
    // All or none, the way the chart draws it: a mean over the readings that
    // happened to carry a second number is not a mean of the window.
    const seconds = list.every((r) => r.value2 != null)
      ? list.map((r) => r.value2 as number)
      : null;
    return {
      // The unit itself, not the first reading in it — a week is named by the
      // day it starts on, whether or not anything was recorded that morning.
      at: unitStart(period, list[0].at),
      low: Math.min(...values),
      high: Math.max(...values),
      average: values.reduce((a, b) => a + b, 0) / values.length,
      average2:
        seconds == null
          ? undefined
          : seconds.reduce((a, b) => a + b, 0) / seconds.length,
      count: values.length,
    };
  });
}

/**
 * One metric over one period: what the period holds, and what a chart of it
 * draws.
 *
 * Both, because they are not the same list past a week. The chart's points are
 * daily or monthly averages — a year of readings is a smudge otherwise — and a
 * summary built on those would report the lowest daily average as the lowest
 * reading, which for oxygen is the one figure that matters.
 */
export function trendFor(
  resident: Resident,
  kind: MetricKind,
  period: Period,
  day: Date = planToday,
): { readings: Reading[]; points: Reading[] } {
  const readings = readingsIn(resident, kind, period, day);
  // A day is drawn as the readings themselves; every wider window as one
  // point per unit of it.
  if (period === "day") return { readings, points: readings };
  return {
    readings,
    points: bucketed(readings, BUCKET[period]).map((b) => ({
      at: b.at,
      value: b.average,
      value2: b.average2,
    })),
  };
}

export type Band = {
  /** The day, or the month, this covers. */
  at: Date;
  low: number;
  high: number;
  average: number;
  /**
   * The second number's average, where the readings carry one.
   *
   * Only blood pressure does. Without it a window wider than a day loses the
   * diastolic altogether: the bucket is what every such window is drawn from,
   * and a bucket that kept only the systolic left the pair as a single line
   * the moment the reader asked for a week.
   */
  average2?: number;
  count: number;
};

/**
 * What each day of a window covered, low to high.
 *
 * The honest way to draw a week of a reading taken hourly. Averaged into one
 * point a day, a night that fell to 88 and a day that never left 97 come out
 * as the same 96 — and for oxygen the low is the whole of what is being
 * watched for. A bar from the low to the high says both, and says how far
 * apart they were.
 */
export function bandsFor(
  resident: Resident,
  kind: MetricKind,
  period: Period,
  day: Date = planToday,
): Band[] {
  return bucketed(readingsIn(resident, kind, period, day), BUCKET[period]);
}

export type Summary = {
  latest?: Reading;
  average: number;
  average2?: number;
  high: number;
  low: number;
  /** How many readings in the window fell outside the normal band. */
  outOfRange: number;
  count: number;
  /** The change from the first half of the window to the second. */
  trend: "up" | "down" | "flat";
};

export function summarise(
  kind: MetricKind,
  readings: Reading[],
): Summary | undefined {
  if (readings.length === 0) return undefined;

  const values = readings.map((r) => r.value);
  const seconds = readings
    .map((r) => r.value2)
    .filter((n): n is number => n != null);
  const mean = (nums: number[]) =>
    nums.reduce((a, b) => a + b, 0) / nums.length;

  const half = Math.floor(readings.length / 2);
  const early = mean(values.slice(0, Math.max(1, half)));
  const late = mean(values.slice(half));
  // A tenth of the spread: below that a chart is level and calling it a trend
  // would put an arrow on noise.
  const moved = late - early;
  const threshold = Math.max(...values) - Math.min(...values);

  return {
    latest: readings[readings.length - 1],
    average: mean(values),
    average2: seconds.length > 0 ? mean(seconds) : undefined,
    high: Math.max(...values),
    low: Math.min(...values),
    outOfRange: readings.filter(
      (r) => statusOf(kind, r.value, r.value2).tone !== "normal",
    ).length,
    count: readings.length,
    trend:
      Math.abs(moved) < threshold * 0.1 ? "flat" : moved > 0 ? "up" : "down",
  };
}

/**
 * The most recent reading of each metric.
 *
 * Only the last few days are generated. A list of patients asking every one
 * of them for six metrics would otherwise build four months of history per
 * row and throw all but the final point away.
 */
/**
 * Answers already worked out, by record and by day.
 *
 * The follow-up register draws a row per patient and every row asks for the
 * same six readings. With a hundred and sixty-seven of them that is a hundred
 * thousand readings generated to fill in six numbers each — and generated
 * again on every keystroke in the search field, because the rows re-render
 * when the list narrows.
 *
 * The generator is deterministic: the same record on the same day gives the
 * same six readings, however many times it is asked. So the answer is worth
 * keeping. Keyed by the day as well as the record, so a page walking back
 * through the calendar still gets each day's own.
 *
 * A reading's exact time within today is fixed for the session rather than
 * creeping forward with the clock — the same bargain `planToday` already
 * makes, and the register has nothing that would refresh it anyway.
 */
const latestByRecord = new Map<string, Partial<Record<MetricKind, Reading>>>();

export function latestVitals(
  resident: Resident,
  now: Date = planToday,
): Partial<Record<MetricKind, Reading>> {
  const key = `${resident.id}@${startOfDay(now).getTime()}`;
  const known = latestByRecord.get(key);
  if (known != null) return known;

  const out: Partial<Record<MetricKind, Reading>> = {};
  for (const m of METRICS) {
    const recent = readingsFor(resident, m.kind, now, 3);
    const last = recent[recent.length - 1];
    if (last != null) out[m.kind] = last;
  }
  latestByRecord.set(key, out);
  return out;
}

/** The metrics whose latest reading is not normal, worst first. */
export function abnormalNow(
  resident: Resident,
  now: Date = planToday,
): { metric: Metric; reading: Reading; label: string; tone: Tone }[] {
  const latest = latestVitals(resident, now);
  return METRICS.flatMap((metric) => {
    const reading = latest[metric.kind];
    if (reading == null) return [];
    const status = statusOf(metric.kind, reading.value, reading.value2);
    if (status.tone === "normal") return [];
    return [{ metric, reading, label: status.label, tone: status.tone }];
  }).sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "alert" ? -1 : 1));
}

/** Indexed by `Date.getDay()`, so Sunday sits at nought. */
export const WEEKDAY_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

/**
 * The card-sized series for a metric: seven days, or one day's readings.
 *
 * Averaged per day for the week, because a metric taken twice a day would
 * otherwise draw fourteen points across 180pt and read as a scribble. The
 * labels come out of the same loop as the points, so a Sunday can never end
 * up under a Monday.
 */
export function sparkFor(
  resident: Resident,
  kind: MetricKind,
  now: Date = planToday,
): {
  values: number[];
  values2?: number[];
  labels: string[];
  /**
   * How far outside its band each point sits, 0 while it is normal.
   *
   * Read through `severityOf` rather than compared against one ceiling: out of
   * range is not one direction — oxygen fails low and pressure fails high, and
   * blood pressure fails on either of its two numbers.
   */
  severity: number[];
  /** The same for the second series, where the metric has one. */
  severity2?: number[];
} {
  const m = metricOf(kind);

  if (m.span === "day") {
    // The whole of the day being read — twenty-four hourly points, midnight
    // to midnight, which is what a continuous monitor's trend is.
    const today = within(readingsFor(resident, kind, now, 1), "day", now);
    return {
      values: today.map((r) => r.value),
      labels: today.map(
        (r) => `${String(r.at.getHours()).padStart(2, "0")}:00`,
      ),
      severity: today.map((r) => severityOfPart(kind, r.value, "first")),
    };
  }

  const week = readingsFor(resident, kind, now, 7);
  const values: number[] = [];
  const values2: number[] = [];
  const labels: string[] = [];
  const severity: number[] = [];
  const severity2: number[] = [];

  for (let back = 6; back >= 0; back--) {
    const day = new Date(startOfDay(now));
    day.setDate(day.getDate() - back);
    const onDay = week.filter(
      (r) => startOfDay(r.at).getTime() === day.getTime(),
    );
    if (onDay.length === 0) continue;

    const mean = (nums: number[]) =>
      nums.reduce((a, b) => a + b, 0) / nums.length;
    const first = mean(onDay.map((r) => r.value));
    values.push(first);
    const seconds = onDay
      .map((r) => r.value2)
      .filter((n): n is number => n != null);
    const second = seconds.length > 0 ? mean(seconds) : undefined;
    if (second != null) values2.push(second);
    labels.push(WEEKDAY_TH[day.getDay()]);
    // Each line judged on its own number, so a mark lands on the line that
    // actually left its band.
    severity.push(severityOfPart(kind, first, "first"));
    if (second != null) severity2.push(severityOfPart(kind, second, "second"));
  }

  const paired = values2.length === values.length;
  return {
    values,
    values2: paired ? values2 : undefined,
    labels,
    severity,
    severity2: paired ? severity2 : undefined,
  };
}

/* -------------------------------------------------------------------------
   The continuous monitor's own page.
   ------------------------------------------------------------------------- */

/** The windows the CGM page can be read over. */
export const CGM_HOURS = [3, 6, 12, 24] as const;
export type CgmHours = (typeof CGM_HOURS)[number];

/** Where a CGM reading counts as in range. The band the summary is built on. */
export const CGM_RANGE: [number, number] = [70, 140];

/**
 * The last `hours` of readings, newest last.
 *
 * Measured back from the end of the record rather than from `now`: the app's
 * "today" is a date at midnight, so counting back from it would return a
 * window that ends before the day's readings begin.
 */
export function cgmWindow(
  resident: Resident,
  hours: CgmHours,
  now: Date = planToday,
): Reading[] {
  const all = readingsFor(resident, "cgm", now, 2);
  const last = all[all.length - 1];
  if (last == null) return [];
  const from = last.at.getTime() - hours * 3_600_000;
  return all.filter((r) => r.at.getTime() >= from);
}

export type CgmSummary = {
  average: number;
  high: number;
  low: number;
  /** Share of the window spent inside the band, 0–1. */
  inRange: number;
  /** How many readings sat above the band, and below it. */
  above: number;
  below: number;
  trend: "up" | "down" | "flat";
  count: number;
};

/**
 * What a window of continuous readings adds up to.
 *
 * Time in range is the figure a continuous monitor exists to produce — a mean
 * of 130 can be a steady 130 or a day of swinging between 60 and 200, and only
 * the share of readings inside the band tells the two apart.
 */
export function cgmSummary(readings: Reading[]): CgmSummary | undefined {
  if (readings.length === 0) return undefined;

  const values = readings.map((r) => r.value);
  const mean = (nums: number[]) =>
    nums.reduce((a, b) => a + b, 0) / nums.length;
  const [lo, hi] = CGM_RANGE;

  const above = values.filter((v) => v > hi).length;
  const below = values.filter((v) => v < lo).length;

  const half = Math.floor(values.length / 2);
  const early = mean(values.slice(0, Math.max(1, half)));
  const late = mean(values.slice(half));
  const spread = Math.max(...values) - Math.min(...values);

  return {
    average: mean(values),
    high: Math.max(...values),
    low: Math.min(...values),
    inRange: (values.length - above - below) / values.length,
    above,
    below,
    // A tenth of the window's own spread: below that the line is level, and
    // calling it a trend would put an arrow on noise.
    trend:
      Math.abs(late - early) < spread * 0.1
        ? "flat"
        : late > early
          ? "up"
          : "down",
    count: values.length,
  };
}

/* ---------------------------------------------------------------------------
   BMI over time.

   Kept here with the other generated records rather than in `household`,
   which holds the standing facts: a resident's weight there is one number,
   the one they were last weighed at, and this is the history behind it.

   BMI is deliberately NOT a `MetricKind`. The six are readings taken with an
   instrument between visits and they share a card, a band table and a detail
   page built around all that. This is a derived figure with its own bands,
   its own windows and a gauge of its own, and forcing it into the six would
   have put it on the register's tiles and in the AI summary's list of
   readings, where it does not belong.
   ------------------------------------------------------------------------- */

/** The windows the BMI page offers. Longer than the readings': weight moves slowly. */
export type BmiPeriod = "week" | "quarter" | "half" | "year";

export const BMI_PERIODS: BmiPeriod[] = ["week", "quarter", "half", "year"];

export const BMI_PERIOD_LABEL: Record<BmiPeriod, string> = {
  week: "สัปดาห์",
  quarter: "3 เดือน",
  half: "6 เดือน",
  year: "1 ปี",
};

const BMI_PERIOD_DAYS: Record<BmiPeriod, number> = {
  week: 7,
  quarter: 90,
  half: 180,
  year: 365,
};

/**
 * Where BMI stops being normal, in the same `[warn, alert]` shape the readings
 * use — so the same severity and breach arithmetic reads it.
 *
 * WHO Asia-Pacific cut-offs, which is what `bmiLabel` already uses: 23 is
 * overweight here, not 25. The alert ends are one band further out — 27.5 is
 * the Asia-Pacific line for obesity II, and 16 is where being underweight
 * becomes its own problem.
 */
const BMI_BAND = { high: [23, 27.5] as [number, number], low: [18.5, 16] as [number, number] };

/** How far outside its band a BMI sits: 0 while normal, 1 once serious. */
export function bmiSeverity(value: number): number {
  return Math.max(over(value, BMI_BAND.high), under(value, BMI_BAND.low));
}

/** Which way a BMI left its band, or null while it is inside. */
export function bmiBreach(value: number): "high" | "low" | null {
  if (value > BMI_BAND.high[0]) return "high";
  if (value < BMI_BAND.low[0]) return "low";
  return null;
}

/** The band written out, and how it reads. Same wording as `bmiLabel`. */
export function bmiStatus(value: number): { label: string; tone: Tone } {
  const tone: Tone =
    bmiSeverity(value) === 0 ? "normal" : bmiSeverity(value) < 1 ? "warn" : "alert";
  if (value <= 0) return { label: "ยังไม่ได้ชั่งน้ำหนัก", tone: "normal" };
  if (value < 18.5) return { label: "น้ำหนักน้อยกว่าเกณฑ์", tone };
  if (value < 23) return { label: "อยู่ในเกณฑ์ปกติ", tone };
  if (value < 25) return { label: "น้ำหนักเกิน", tone };
  if (value < 30) return { label: "โรคอ้วนระดับ 1", tone };
  return { label: "โรคอ้วนระดับ 2", tone };
}

/** The normal band, for writing out under the chart. */
export const BMI_NORMAL = { low: BMI_BAND.low[0], high: BMI_BAND.high[0] };

/**
 * What somebody weighed, day by day, ending at what they weigh now.
 *
 * Anchored on the record rather than wandering off its own base: the overview
 * card reads `resident.weightKg` and this page has to agree with it, so today
 * is that number exactly and the history is built backwards from it.
 *
 * Weight moves slowly and in runs — a kilo over a month, not a kilo between
 * Tuesday and Wednesday. So the shape is a slow drift with a little daily
 * scatter on top, and the scatter is small enough that the drift is what the
 * chart shows.
 */
/**
 * What somebody weighed, `back` days before today.
 *
 * A function of the day alone, never of the window being asked for. The first
 * version scaled the year's drift by how far through the *window* a day sat,
 * so the same date came out at one weight in the three-month view and another
 * in the year — which nobody would have noticed until the page let you pick a
 * date, and then it would have looked like the record changing under them.
 *
 * Anchored on the record: `back` of 0 is `resident.weightKg` exactly, because
 * the overview card reads that number and this page has to agree with it. The
 * day's own wobble at zero is subtracted back out to keep that exact.
 */
function weightAt(resident: Resident, back: number): number {
  const seed = `${resident.id}:weight`;
  /*
    Which way the year went, and how far — roughly six kilos either side.

    A narrower drift left every record within about one BMI point of where it
    started, and against an axis that spans underweight to obese that is a
    flat line. Six kilos over a year is what somebody under home care actually
    moves when anything is happening at all.
  */
  const swing = (noise(seed, 31) - 0.45) * 13;
  // A slow curve on top of the drift, so the line has somewhere to turn and
  // does not read as a ruler laid across the chart.
  const wave = (d: number) => Math.sin((d / 47) * Math.PI * 2) * 1.1;
  const scatter = (d: number) => (noise(seed, d) - 0.5) * 0.5;
  const today = wave(0) + scatter(0);
  return (
    resident.weightKg -
    (swing * back) / 365 +
    wave(back) +
    scatter(back) -
    today
  );
}

/**
 * What somebody weighed over the `days` up to `day`, oldest first.
 */
export function weightSeries(
  resident: Resident,
  days: number,
  day: Date = planToday,
): Reading[] {
  const from = Math.round(
    (startOfDay(planToday).getTime() - startOfDay(day).getTime()) / 86_400_000,
  );
  const out: Reading[] = [];
  for (let i = days; i >= 0; i--) {
    const back = from + i;
    const at = new Date(startOfDay(planToday));
    at.setDate(at.getDate() - back);
    out.push({ at, value: Number(weightAt(resident, back).toFixed(1)) });
  }
  return out;
}

/**
 * A point on the BMI trend, and the weighing it came from.
 *
 * The weight travels with it rather than being worked back out of the BMI:
 * the figure is rounded to a tenth before it is drawn, and a weight derived
 * from the rounded figure comes out a hundred grams off the one the record
 * actually holds. The page shows both numbers at once, so they have to be the
 * same pair.
 */
export type BmiPoint = Reading & { weightKg: number };

/** The same history as BMI, which is what the page charts. */
export function bmiSeries(
  resident: Resident,
  period: BmiPeriod,
  day: Date = planToday,
): BmiPoint[] {
  const m = (resident.heightCm / 100) * (resident.heightCm / 100);
  if (m <= 0) return [];
  if (period === "week") {
    /*
      The calendar week the day falls in, Monday to Sunday — the same week
      every other page draws, not the seven days before the date.

      It was a rolling window ending on the chosen day, which reads as a week
      until you put it beside the readings' pages: pick Wednesday there and
      you get the week Wednesday is in, labelled by weekday, with Thursday
      onward left empty. Pick it here and you got last Thursday to this one,
      which is a week nobody points at.
    */
    const { from, to } = periodRange("week", day);
    const today = startOfDay(planToday);
    const end = to.getTime() > today.getTime() ? today : to;
    const out: BmiPoint[] = [];
    for (
      const d = new Date(from);
      d.getTime() <= end.getTime();
      d.setDate(d.getDate() + 1)
    ) {
      const back = Math.round((today.getTime() - d.getTime()) / 86_400_000);
      // A week that has not started yet has nothing in it.
      if (back < 0) continue;
      const kg = Number(weightAt(resident, back).toFixed(1));
      out.push({
        at: new Date(d),
        value: Number((kg / m).toFixed(1)),
        weightKg: kg,
      });
    }
    return out;
  }

  if (period === "year") {
    /*
      A year is drawn as its months, the way every other page draws one.

      Fifty-three weekly points across a chart this wide is a smear with a
      date under every fourth of them, and weight does not move enough in a
      week to be worth a point of a year. One per month, averaged over the
      days in it — which is also what makes the foot readable: twelve month
      names rather than a run of dates.
    */
    const raw = weightSeries(resident, BMI_PERIOD_DAYS.year, day);
    const byMonth = new Map<string, { at: Date; kg: number[] }>();
    for (const r of raw) {
      const key = `${r.at.getFullYear()}-${r.at.getMonth()}`;
      const seen = byMonth.get(key);
      if (seen == null)
        byMonth.set(key, {
          // The month itself, not the first reading in it.
          at: new Date(r.at.getFullYear(), r.at.getMonth(), 1),
          kg: [r.value],
        });
      else seen.kg.push(r.value);
    }
    return [...byMonth.values()].map((b) => {
      const kg = Number(
        (b.kg.reduce((x, y) => x + y, 0) / b.kg.length).toFixed(1),
      );
      return { at: b.at, value: Number((kg / m).toFixed(1)), weightKg: kg };
    });
  }

  const raw = weightSeries(resident, BMI_PERIOD_DAYS[period], day);
  // One point per week. The week itself is drawn day by day and has already
  // returned above; three hundred and sixty-five dots is a smear, and weight
  // has not moved enough between two days to be worth a point each.
  const step = 7;
  const points: Reading[] = [];
  for (let i = raw.length - 1; i >= 0; i -= step) points.unshift(raw[i]);
  return points.map((r) => ({
    at: r.at,
    value: Number((r.value / m).toFixed(1)),
    weightKg: r.value,
  }));
}
