/**
 * ภาวะโภชนาการเด็ก — weight, height, and what the three of them mean.
 *
 * The other group activities in this app record that a person was served. A
 * child health check does not: the whole point of standing a four-year-old
 * on a scale is the number, and the number means nothing on its own. 14.4 kg
 * is a healthy two-year-old and a wasted five-year-old, and the difference
 * is a table.
 *
 * So this is that table, and the three readings taken off it:
 *
 *   น้ำหนักตามเกณฑ์อายุ   — is the child growing at all
 *   ส่วนสูงตามเกณฑ์อายุ    — has growth been short for a long time (stunting)
 *   น้ำหนักตามเกณฑ์ส่วนสูง — is the child thin RIGHT NOW (wasting)
 *
 * The third is the one that decides whether somebody has to go back to the
 * house this month, which is why all three are read and shown rather than
 * one summary word.
 *
 * ── On the numbers ──────────────────────────────────────────────────────
 *
 * The tables run from birth to twelve, which is the app's own span: a ศพด.
 * weighs nought-to-fives and a school health round weighs ป.1 to ป.6. They
 * stop at twelve rather than at nineteen because that is where the app's
 * work stops, and a curve invented past its own data is how a screen ends
 * up telling a carer something confident and wrong — `at` holds at the last
 * row rather than extrapolating, so a thirteen-year-old would be read
 * against a twelve-year-old's line and the screen would say so by saying
 * nothing.
 *
 * An abridged reference: the median and the ±2SD lines at anchor ages, with
 * everything between them interpolated. The real กรมอนามัย tables are LMS
 * parameters at every month for both sexes, and a production build has to
 * bind to that dataset — `REFERENCE_NOTE` says so on the screen, because a
 * carer reading −2.1 SD off a phone is entitled to know how it was worked
 * out. What this gives is the right shape, the right bands and the right
 * thresholds, which is what the screens around it are built against.
 *
 * Nothing here touches the file system or React. It is arithmetic over
 * records, so it can be run from a script and checked.
 */

export type Sex = "ชาย" | "หญิง";

/** What the screen says about where these figures come from. */
export const REFERENCE_NOTE =
  "คำนวณจากเกณฑ์อ้างอิงการเจริญเติบโตตามอายุและเพศ — ต้นแบบนี้ใช้ตารางย่อ ค่าจริงต้องผูกกับชุดข้อมูลอ้างอิงของกรมอนามัย";

/* ------------------------------------------------------------------ *
 * The reference
 * ------------------------------------------------------------------ */

/**
 * One row of a growth table: where it is read, and the three lines on it.
 *
 * `[at, median, minus2, plus2]` — the age in months (or, for weight-for-
 * height, the height in centimetres), then the three printed curves.
 *
 * Two half-deviations rather than one, because growth is skewed: the gap
 * from the median down to −2SD is not the gap up to +2SD, and treating them
 * as one number puts every heavy child a full band too high. This is the
 * same approximation a printed chart makes when it is read by eye.
 */
type Curve = readonly (readonly [number, number, number, number])[];

/** น้ำหนักตามเกณฑ์อายุ — kg at a given age in months. */
const WEIGHT_FOR_AGE: Record<Sex, Curve> = {
  ชาย: [
    [0, 3.3, 2.5, 4.4],
    [3, 6.4, 5.0, 8.0],
    [6, 7.9, 6.4, 9.8],
    [9, 8.9, 7.1, 11.0],
    [12, 9.6, 7.7, 12.0],
    [18, 10.9, 8.8, 13.7],
    [24, 12.2, 9.7, 15.3],
    [30, 13.3, 10.5, 16.9],
    [36, 14.3, 11.3, 18.3],
    [42, 15.3, 12.0, 19.7],
    [48, 16.3, 12.7, 21.2],
    [54, 17.3, 13.4, 22.7],
    [60, 18.3, 14.1, 24.2],
    [66, 19.4, 14.8, 25.9],
    [72, 20.5, 15.5, 27.6],
    [84, 22.9, 17.0, 31.4],
    [96, 25.4, 18.6, 35.6],
    [108, 28.1, 20.4, 40.3],
    [120, 31.2, 22.4, 45.6],
    [132, 34.7, 24.7, 51.5],
    [144, 38.8, 27.4, 58.0],
  ],
  หญิง: [
    [0, 3.2, 2.4, 4.2],
    [3, 5.8, 4.5, 7.5],
    [6, 7.3, 5.7, 9.3],
    [9, 8.2, 6.5, 10.5],
    [12, 8.9, 7.0, 11.5],
    [18, 10.2, 8.1, 13.2],
    [24, 11.5, 9.0, 14.8],
    [30, 12.7, 10.0, 16.5],
    [36, 13.9, 10.8, 18.1],
    [42, 15.0, 11.6, 19.8],
    [48, 16.1, 12.3, 21.5],
    [54, 17.2, 13.0, 23.2],
    [60, 18.2, 13.7, 24.9],
    [66, 19.3, 14.4, 26.6],
    [72, 20.2, 15.0, 28.2],
    [84, 22.4, 16.3, 31.9],
    [96, 25.0, 17.8, 36.4],
    [108, 28.2, 19.8, 41.8],
    [120, 31.9, 22.0, 47.6],
    [132, 36.0, 24.7, 53.6],
    [144, 40.0, 27.6, 59.0],
  ],
};

/** ส่วนสูงตามเกณฑ์อายุ — cm at a given age in months. */
const HEIGHT_FOR_AGE: Record<Sex, Curve> = {
  ชาย: [
    [0, 49.9, 46.1, 53.7],
    [3, 61.4, 57.3, 65.5],
    [6, 67.6, 63.3, 71.9],
    [9, 72.0, 67.5, 76.5],
    [12, 75.7, 71.0, 80.5],
    [18, 82.3, 76.9, 87.7],
    [24, 87.1, 81.0, 93.2],
    [30, 91.9, 85.1, 98.7],
    [36, 96.1, 88.7, 103.5],
    [42, 99.9, 91.9, 107.8],
    [48, 103.3, 94.9, 111.7],
    [54, 106.7, 97.8, 115.5],
    [60, 110.0, 100.7, 119.2],
    [66, 113.0, 103.4, 122.6],
    [72, 116.0, 106.1, 125.8],
    [84, 121.7, 111.2, 132.2],
    [96, 127.3, 116.0, 138.6],
    [108, 132.6, 120.5, 144.6],
    [120, 137.8, 125.0, 150.5],
    [132, 143.1, 129.7, 156.5],
    [144, 149.1, 134.9, 163.2],
  ],
  หญิง: [
    [0, 49.1, 45.4, 52.9],
    [3, 59.8, 55.6, 64.0],
    [6, 65.7, 61.2, 70.3],
    [9, 70.1, 65.3, 75.0],
    [12, 74.0, 68.9, 79.2],
    [18, 80.7, 74.9, 86.5],
    [24, 85.7, 79.3, 92.2],
    [30, 90.7, 83.6, 97.7],
    [36, 95.1, 87.4, 102.7],
    [42, 99.0, 90.9, 107.2],
    [48, 102.7, 94.1, 111.3],
    [54, 106.2, 97.1, 115.2],
    [60, 109.4, 99.9, 118.9],
    [66, 112.2, 102.3, 122.0],
    [72, 115.1, 104.9, 125.4],
    [84, 120.8, 109.9, 131.7],
    [96, 126.6, 115.0, 138.2],
    [108, 132.5, 120.3, 144.8],
    [120, 138.6, 125.8, 151.4],
    [132, 145.0, 131.7, 158.4],
    [144, 151.2, 137.6, 164.8],
  ],
};

/** น้ำหนักตามเกณฑ์ส่วนสูง — kg at a given height in cm. */
const WEIGHT_FOR_HEIGHT: Record<Sex, Curve> = {
  ชาย: [
    [65, 7.4, 6.3, 8.8],
    [70, 8.4, 7.1, 10.0],
    [75, 9.6, 8.1, 11.4],
    [80, 10.4, 8.8, 12.4],
    [85, 11.7, 9.9, 14.0],
    [90, 12.9, 10.9, 15.3],
    [95, 14.1, 11.9, 16.9],
    [100, 15.4, 12.9, 18.7],
    [105, 16.8, 14.0, 20.7],
    [110, 18.3, 15.2, 23.0],
    [115, 20.0, 16.6, 25.7],
    [120, 21.9, 18.0, 28.8],
    [130, 26.5, 21.5, 35.5],
    [140, 32.0, 25.5, 44.0],
    [150, 38.5, 30.0, 54.0],
    [160, 46.5, 35.5, 66.0],
  ],
  หญิง: [
    [65, 7.2, 6.1, 8.7],
    [70, 8.2, 6.9, 9.9],
    [75, 9.1, 7.6, 11.0],
    [80, 10.1, 8.5, 12.3],
    [85, 11.4, 9.6, 13.9],
    [90, 12.5, 10.5, 15.3],
    [95, 13.8, 11.5, 17.0],
    [100, 15.2, 12.6, 18.9],
    [105, 16.8, 13.8, 21.1],
    [110, 18.5, 15.1, 23.6],
    [115, 20.4, 16.5, 26.4],
    [120, 22.4, 18.0, 29.5],
    [130, 27.0, 21.5, 37.0],
    [140, 33.0, 26.0, 46.0],
    [150, 40.0, 31.0, 56.5],
    [160, 47.5, 36.5, 67.0],
  ],
};

/**
 * เส้นรอบศีรษะตามเกณฑ์อายุ — cm at a given age in months.
 *
 * Only worth taking under two, where it is the cheapest sign of something
 * going wrong with the brain that nothing else on this form would catch. It
 * is on the form up to five because a centre weighs a whole room of
 * children at once and the tape is already out; past that it is off the
 * form altogether, which is why this table stops at six and the field that
 * reads it is hidden for a school round.
 */
const HEAD_FOR_AGE: Record<Sex, Curve> = {
  ชาย: [
    [0, 34.5, 32.0, 37.0],
    [3, 40.5, 38.1, 43.0],
    [6, 43.3, 41.0, 45.8],
    [12, 45.8, 43.5, 48.2],
    [24, 48.3, 46.0, 50.6],
    [36, 49.8, 47.5, 52.1],
    [48, 50.6, 48.2, 53.0],
    [60, 51.2, 48.8, 53.6],
    [72, 51.9, 49.4, 54.3],
  ],
  หญิง: [
    [0, 33.9, 31.5, 36.2],
    [3, 39.5, 37.1, 41.9],
    [6, 42.2, 39.7, 44.6],
    [12, 44.6, 42.2, 47.0],
    [24, 47.2, 44.8, 49.6],
    [36, 48.8, 46.3, 51.2],
    [48, 49.7, 47.2, 52.1],
    [60, 50.3, 47.8, 52.7],
    [72, 51.0, 48.5, 53.4],
  ],
};

/**
 * The three curves at one point, read off the table.
 *
 * Interpolated between the anchors, and held at the ends: a child of eleven
 * weeks is read between the birth row and the three-month row, and one past
 * the last row is read against the last row rather than off the end of an
 * array. Nothing here extrapolates — a curve invented past its own data is
 * how a screen ends up telling a carer something confident and wrong.
 */
function at(curve: Curve, x: number): { median: number; lo: number; hi: number } {
  const first = curve[0];
  const last = curve[curve.length - 1];
  if (x <= first[0]) return { median: first[1], lo: first[2], hi: first[3] };
  if (x >= last[0]) return { median: last[1], lo: last[2], hi: last[3] };

  for (let i = 1; i < curve.length; i += 1) {
    const b = curve[i];
    if (x > b[0]) continue;
    const a = curve[i - 1];
    const k = (x - a[0]) / (b[0] - a[0]);
    return {
      median: a[1] + (b[1] - a[1]) * k,
      lo: a[2] + (b[2] - a[2]) * k,
      hi: a[3] + (b[3] - a[3]) * k,
    };
  }
  return { median: last[1], lo: last[2], hi: last[3] };
}

/** How far off the median, in deviations, on whichever side it falls. */
function sdOf(value: number, line: { median: number; lo: number; hi: number }): number {
  if (value === line.median) return 0;
  const half = value < line.median ? (line.median - line.lo) / 2 : (line.hi - line.median) / 2;
  if (half <= 0) return 0;
  return (value - line.median) / half;
}

/* ------------------------------------------------------------------ *
 * The verdicts
 * ------------------------------------------------------------------ */

/**
 * How hard the finding pulls.
 *
 * Three rather than two, and the middle one is the one the whole register
 * is built to find: a child at −1.8 SD is not malnourished and is not fine,
 * and the only useful thing to do about them is weigh them again next
 * quarter. A form with only "ปกติ" and "ผิดปกติ" files them as normal and
 * nobody goes back.
 */
export type GrowthLevel = "normal" | "watch" | "abnormal";

export const GROWTH_LEVEL_LABEL: Record<GrowthLevel, string> = {
  normal: "ปกติ",
  watch: "เฝ้าระวัง",
  abnormal: "ผิดปกติ",
};

export type GrowthIndex = "weightForAge" | "heightForAge" | "weightForHeight";

export const INDEX_LABEL: Record<GrowthIndex, string> = {
  weightForAge: "น้ำหนัก/อายุ",
  heightForAge: "ส่วนสูง/อายุ",
  weightForHeight: "น้ำหนัก/ส่วนสูง",
};

export type Verdict = {
  index: GrowthIndex;
  /** How many deviations off the median, signed. */
  sd: number;
  /** What that band is called — "ค่อนข้างผอม", "เตี้ย", "สมส่วน". */
  label: string;
  level: GrowthLevel;
  /** What the table says the middle of this age or height is. */
  median: number;
  /** The measured value, so the row can say both. */
  value: number;
};

/** One band of a table: everything at or above `from`, until the next. */
type Band = { from: number; label: string; level: GrowthLevel };

/*
  The bands, exactly as the growth charts print them.

  Read from the top down, so the first one a value clears is its band.
  Written as thresholds rather than ranges because the ranges have to meet
  with no gap — a child at exactly −2.0 SD has to land somewhere, and two
  lists of ranges maintained by hand is how they stop meeting.
*/
const WEIGHT_AGE_BANDS: Band[] = [
  { from: 2, label: "มากกว่าเกณฑ์", level: "abnormal" },
  { from: 1.5, label: "ค่อนข้างมาก", level: "watch" },
  { from: -1.5, label: "ตามเกณฑ์", level: "normal" },
  { from: -2, label: "ค่อนข้างน้อย", level: "watch" },
  { from: -Infinity, label: "น้อยกว่าเกณฑ์", level: "abnormal" },
];

/*
  Tall is not a finding.

  Short is: it is the mark of a shortage that has been going on for years,
  and it is the one thing on this form that cannot be fixed by next quarter.
  So the two bands below the middle carry a level and the two above it do
  not — a child in the 97th centile for height is a tall child.
*/
const HEIGHT_AGE_BANDS: Band[] = [
  { from: 2, label: "สูงกว่าเกณฑ์", level: "normal" },
  { from: 1.5, label: "ค่อนข้างสูง", level: "normal" },
  { from: -1.5, label: "สูงตามเกณฑ์", level: "normal" },
  { from: -2, label: "ค่อนข้างเตี้ย", level: "watch" },
  { from: -Infinity, label: "เตี้ย", level: "abnormal" },
];

/*
  Both ends matter here, which is why this table has six bands and the
  others have five. Wasting and obesity are the two things a weight read
  against a height can say, and a centre that only looked for the thin half
  would file a five-year-old at +3.4 SD as "not wasted" and move on.
*/
const WEIGHT_HEIGHT_BANDS: Band[] = [
  { from: 3, label: "อ้วน", level: "abnormal" },
  { from: 2, label: "เริ่มอ้วน", level: "watch" },
  { from: 1.5, label: "ท้วม", level: "watch" },
  { from: -1.5, label: "สมส่วน", level: "normal" },
  { from: -2, label: "ค่อนข้างผอม", level: "watch" },
  { from: -Infinity, label: "ผอม", level: "abnormal" },
];

const bandOf = (bands: Band[], sd: number): Band =>
  bands.find((b) => sd >= b.from) ?? bands[bands.length - 1];

/** What a reading is, before the tables have been consulted. */
export type Measurement = {
  sex: Sex;
  /** Age at the moment of measuring, in whole months. */
  months: number;
  kg: number;
  cm: number;
  /** เส้นรอบศีรษะ, where it was taken. */
  head?: number;
};

const verdict = (
  index: GrowthIndex,
  bands: Band[],
  value: number,
  line: { median: number; lo: number; hi: number },
): Verdict => {
  const sd = sdOf(value, line);
  const b = bandOf(bands, sd);
  return { index, sd, label: b.label, level: b.level, median: line.median, value };
};

export const weightForAge = (m: Measurement): Verdict =>
  verdict("weightForAge", WEIGHT_AGE_BANDS, m.kg, at(WEIGHT_FOR_AGE[m.sex], m.months));

export const heightForAge = (m: Measurement): Verdict =>
  verdict("heightForAge", HEIGHT_AGE_BANDS, m.cm, at(HEIGHT_FOR_AGE[m.sex], m.months));

export const weightForHeight = (m: Measurement): Verdict =>
  verdict("weightForHeight", WEIGHT_HEIGHT_BANDS, m.kg, at(WEIGHT_FOR_HEIGHT[m.sex], m.cm));

/**
 * The printed curve itself, for the chart that draws it.
 *
 * The three lines at one age, rather than a verdict about a value: a growth
 * chart is the median with the ±2SD lines either side of it and the child's
 * own dots on top, and the screen cannot draw that from a verdict.
 */
export const weightBandAt = (sex: Sex, months: number) =>
  at(WEIGHT_FOR_AGE[sex], months);

/** The height curve, the same way. */
export const heightBandAt = (sex: Sex, months: number) =>
  at(HEIGHT_FOR_AGE[sex], months);

/**
 * The value that sits exactly this many deviations off a curve.
 *
 * The inverse of `sdOf`, and the only honest way to build a sample child:
 * "a nine-month-old one and a half deviations light" has to be read off the
 * same table that will judge it. Doing it with a percentage of the median
 * instead — a deviation being about an eighth of the weight, say — is right
 * for a five-year-old and half a band out for an infant, so the roster's
 * intended mix and the verdicts the screens then showed were two different
 * things.
 */
export const atSd = (
  line: { median: number; lo: number; hi: number },
  sd: number,
): number =>
  sd < 0
    ? line.median + (sd * (line.median - line.lo)) / 2
    : line.median + (sd * (line.hi - line.median)) / 2;

/** What the middle of this age weighs, for seeding and for hints. */
export const medianWeight = (sex: Sex, months: number): number =>
  at(WEIGHT_FOR_AGE[sex], months).median;

/** And how tall it stands. */
export const medianHeight = (sex: Sex, months: number): number =>
  at(HEIGHT_FOR_AGE[sex], months).median;

/** The middle of the range for a head that age, for the hint under the box. */
export const headMedian = (sex: Sex, months: number): number =>
  at(HEAD_FOR_AGE[sex], months).median;

/** Whether a head is outside the ±2SD lines — the only reading it gives. */
export function headOutlier(sex: Sex, months: number, head: number): "เล็กกว่าเกณฑ์" | "ใหญ่กว่าเกณฑ์" | null {
  const line = at(HEAD_FOR_AGE[sex], months);
  if (head < line.lo) return "เล็กกว่าเกณฑ์";
  if (head > line.hi) return "ใหญ่กว่าเกณฑ์";
  return null;
}

/* ------------------------------------------------------------------ *
 * The whole assessment
 * ------------------------------------------------------------------ */

export type Assessment = {
  verdicts: Verdict[];
  /** The worst of the three, which is what the roster and the tag show. */
  level: GrowthLevel;
  /**
   * The one word the record is filed under.
   *
   * The worst band's own label rather than "ผิดปกติ": a register that says
   * six children were abnormal cannot be acted on, and one that says two
   * were ผอม and four เตี้ย can — those are different visits.
   */
  label: string;
};

const WORST: Record<GrowthLevel, number> = { normal: 0, watch: 1, abnormal: 2 };

/**
 * All three readings, and the one that decides what happens next.
 *
 * Weight-for-height is asked first among equals when two findings tie:
 * wasting is this month's problem and stunting is the last three years', so
 * where a child is both ค่อนข้างผอม and ค่อนข้างเตี้ย the visit is about the
 * weight.
 */
export function assess(m: Measurement): Assessment {
  const wfh = weightForHeight(m);
  const wfa = weightForAge(m);
  const hfa = heightForAge(m);
  const verdicts = [wfa, hfa, wfh];

  const level = verdicts.reduce<GrowthLevel>(
    (worst, v) => (WORST[v.level] > WORST[worst] ? v.level : worst),
    "normal",
  );
  const lead = [wfh, wfa, hfa].find((v) => v.level === level) ?? wfa;
  return { verdicts, level, label: lead.label };
}

/* ------------------------------------------------------------------ *
 * Reading a room
 * ------------------------------------------------------------------ */

/**
 * The bands a nursery roster is grouped under.
 *
 * Children are weighed youngest-last down a list that is otherwise in no
 * order at all, and the band is how a carer finds the next one: the scale
 * is set up differently for a baby than for a five-year-old, so a room is
 * worked through by age whatever order the register is in.
 *
 * Read from the top down, first match wins.
 */
export const AGE_BANDS: { from: number; label: string }[] = [
  { from: 60, label: "อายุ 5 ปีขึ้นไป" },
  { from: 48, label: "อายุ 4–5 ปี" },
  { from: 36, label: "อายุ 3–4 ปี" },
  { from: 24, label: "อายุ 2–3 ปี" },
  { from: 12, label: "อายุ 1–2 ปี" },
  { from: 0, label: "ต่ำกว่า 1 ปี" },
];

export const ageBandOf = (months: number): string =>
  (AGE_BANDS.find((b) => months >= b.from) ?? AGE_BANDS[AGE_BANDS.length - 1])
    .label;

/** "3 ปี 6 ด." — how an age is said out loud on a round. */
export const ageLabel = (months: number): string =>
  `${Math.floor(months / 12)} ปี ${months % 12} ด.`;

/* ------------------------------------------------------------------ *
 * What to do about it
 * ------------------------------------------------------------------ */

export type FollowUp = {
  /** The heading — what kind of follow-up this is. */
  title: string;
  /** The sentence under it: what to say, and when to weigh again. */
  detail: string;
  level: GrowthLevel;
};

/** Three months on, to the nearest month — the next quarter's weighing. */
const nextQuarter = (from: Date): Date => {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 3);
  return d;
};

const MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

const monthYear = (d: Date) => `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;

/**
 * What the system has already lined up, given the verdict.
 *
 * Written here rather than chosen on the screen because it is the half of
 * this form that a carer standing in a nursery has no time to compose, and
 * the half an unfed child depends on. A normal weighing still produces a
 * follow-up — the next quarter's — because "nothing to do" and "nothing
 * booked" are not the same thing.
 */
export function followUpFor(a: Assessment, on: Date): FollowUp {
  const next = monthYear(nextQuarter(on));

  if (a.level === "abnormal") {
    const wasted = a.verdicts.find(
      (v) => v.index === "weightForHeight" && v.level === "abnormal",
    );
    if (wasted != null && wasted.sd < 0) {
      return {
        level: "abnormal",
        title: "ส่งพบเจ้าหน้าที่ และติดตามทุกเดือน",
        detail:
          "แจ้ง รพ.สต. ประเมินซ้ำและหาสาเหตุ · ให้อาหารเสริมตามเกณฑ์ · นัดชั่งน้ำหนักทุกเดือนจนกลับเข้าเกณฑ์",
      };
    }
    return {
      level: "abnormal",
      title: "ติดตามทุกเดือน และแจ้งผู้ปกครอง",
      detail: `ให้คำแนะนำรายบุคคลตามผลประเมิน · นัดชั่งน้ำหนักเดือนหน้า และทบทวนอีกครั้งไตรมาสถัดไป (${next})`,
    };
  }

  if (a.level === "watch") {
    return {
      level: "watch",
      title: "เฝ้าระวัง นัดชั่งซ้ำใน 1–2 เดือน",
      detail: `ให้คำแนะนำเรื่องอาหารตามวัยแก่ผู้ปกครอง · นัดชั่งน้ำหนักซ้ำก่อนรอบปกติ และชั่งตามรอบไตรมาสถัดไป (${next})`,
    };
  }

  return {
    level: "normal",
    title: "ไม่ต้องติดตามพิเศษ",
    detail: `ให้คำแนะนำตามวัย และนัดชั่งน้ำหนักไตรมาสถัดไป (${next})`,
  };
}

/* ------------------------------------------------------------------ *
 * The rest of the form
 * ------------------------------------------------------------------ */

/**
 * อาหารและขวดนม — what the child is actually being given.
 *
 * The measurements say a child is thin; these say why, and they are the
 * only part of the form that can be acted on the same afternoon. A
 * two-year-old on sweetened UHT and crisps and a two-year-old whose family
 * has run out of food are the same −2 SD and two completely different
 * visits.
 *
 * Several at once, because a real answer usually is several.
 */
export const FEEDING = [
  "นมแม่",
  "นมผสม",
  "อาหารตามวัยครบ 3 มื้อ",
  "นมรสหวาน / UHT",
  "ขนมกรุบกรอบ–น้ำอัดลมบ่อย",
] as const;
export type Feeding = (typeof FEEDING)[number];

/** Which of those the guidance treats as a problem to raise. */
const FEEDING_RISK: Feeding[] = ["นมรสหวาน / UHT", "ขนมกรุบกรอบ–น้ำอัดลมบ่อย"];

/**
 * การใช้ขวดนม — one answer, and the third one is the reason it is asked.
 *
 * A bottle taken to sleep sits against the teeth all night, and it is the
 * single commonest cause of the rotten front teeth a nursery screening
 * finds. It is on the nutrition form because this is the visit where
 * somebody is already asking about milk.
 */
export const BOTTLE = [
  "ไม่ใช้ขวดนม",
  "ใช้ขวดนมปกติ",
  "ใช้ขวดนมขณะนอนหลับ",
] as const;
export type Bottle = (typeof BOTTLE)[number];

/**
 * ระดับพัฒนาการ — the one-line developmental read.
 *
 * Three answers and no more. The full instrument (DSPM) is nine domains and
 * takes twenty minutes a child, which is its own visit; what belongs on a
 * weighing round is whether this child needs that visit. "สมวัย" opens
 * nothing, which is the whole point — a form that asked nine questions about
 * a child who is fine would not get filled in for the child who is not.
 */
export const DEVELOPMENT = ["สมวัย", "สงสัยล่าช้า", "ล่าช้า"] as const;
export type Development = (typeof DEVELOPMENT)[number];

export const DEVELOPMENT_LEVEL: Record<Development, GrowthLevel> = {
  สมวัย: "normal",
  สงสัยล่าช้า: "watch",
  ล่าช้า: "abnormal",
};

/**
 * Where the child was weighed.
 *
 * The first one is wherever the round is being held — a nursery or a
 * school — and the other two are the places a child who missed it gets
 * caught: at the clinic, or at home on a visit.
 */
export const placesFor = (atSchool: boolean): string[] => [
  atSchool ? "โรงเรียน" : "ศพด.",
  "รพ.สต.",
  "บ้าน (เยี่ยมบ้าน)",
];


/** One completed assessment, as it is written to the record. */
export type GrowthRecord = {
  kg: number;
  cm: number;
  head?: number;
  /** Age at measuring, kept because a record read next year cannot re-derive it. */
  months: number;
  place: string;
  feeding: Feeding[];
  bottle: Bottle;
  development: Development;
  /** What the tables made of it, frozen at the time of writing. */
  level: GrowthLevel;
  label: string;
  at: string;
};

/**
 * The advice to read out, in the order it should be said.
 *
 * Built from the verdict and the feeding answers together, because that is
 * how it is actually given: "she is a little thin" is not advice, and "stop
 * the sweetened milk, give three meals" is.
 */
export function adviceFor(
  a: Assessment,
  feeding: Feeding[],
  bottle: Bottle,
  development: Development,
): string[] {
  const out: string[] = [];

  const wfh = a.verdicts.find((v) => v.index === "weightForHeight");
  const hfa = a.verdicts.find((v) => v.index === "heightForAge");

  if (wfh != null && wfh.sd < -1.5) {
    out.push("เพิ่มพลังงานและโปรตีนในมื้อหลัก · เพิ่มมื้อว่างที่มีประโยชน์วันละ 2 มื้อ");
  }
  if (wfh != null && wfh.sd >= 2) {
    out.push("ลดเครื่องดื่มรสหวานและขนมกรุบกรอบ · เพิ่มการเล่นที่ได้ออกแรงวันละ 60 นาที");
  }
  if (hfa != null && hfa.level !== "normal") {
    out.push("เน้นนมจืดวันละ 2–3 แก้ว ไข่ และเนื้อสัตว์ทุกมื้อ · ตรวจสอบการนอนให้พอ");
  }
  if (!feeding.includes("อาหารตามวัยครบ 3 มื้อ")) {
    out.push("จัดอาหารตามวัยให้ครบ 3 มื้อทุกวัน");
  }
  for (const risk of FEEDING_RISK) {
    if (feeding.includes(risk)) {
      out.push(`ลด${risk === "นมรสหวาน / UHT" ? "นมรสหวานและ UHT เปลี่ยนเป็นนมจืด" : "ขนมกรุบกรอบและน้ำอัดลม"}`);
    }
  }
  if (bottle === "ใช้ขวดนมขณะนอนหลับ") {
    out.push("งดขวดนมขณะนอนหลับ · แปรงฟันก่อนนอนทุกคืน เสี่ยงฟันผุจากขวดนม");
  }
  if (development !== "สมวัย") {
    out.push("ส่งประเมินพัฒนาการตามแบบ DSPM และนัดติดตาม");
  }
  if (out.length === 0) {
    out.push("ให้คำแนะนำอาหารตามวัย · นมจืดวันละ 2 แก้ว · เล่นและนอนให้พอ");
  }
  return out;
}
