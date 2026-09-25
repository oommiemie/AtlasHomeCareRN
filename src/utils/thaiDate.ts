/**
 * Thai date and time formatting, in the Buddhist era.
 *
 * One module rather than a helper copied into each screen: the donor project
 * scattered `+ 543` across a dozen files and the month arrays drifted apart.
 * Hermes ships a partial ICU, so `toLocaleDateString("th-TH")` can't be
 * trusted on device either — these are hand-rolled on purpose.
 */

const MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/**
 * The seven column heads a calendar is written under, Sunday first.
 *
 * Here rather than beside the one grid that first needed them: the plan
 * screen and the popover the date title opens are two calendars, and two
 * copies of this list is how the donor project ended up with two different
 * abbreviations for Thursday.
 */
export const THAI_WEEKDAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

const pad = (n: number) => String(n).padStart(2, "0");

/** The Buddhist year: 2026 → 2569. */
export const buddhistYear = (d: Date) => d.getFullYear() + 543;

/** "2 ก.ย. 2569" */
export const thaiShortDate = (d: Date) =>
  `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${buddhistYear(d)}`;

/** "2 กันยายน 2569" */
export const thaiFullDate = (d: Date) =>
  `${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${buddhistYear(d)}`;

/** "2 ก.ย." — the day and its month, for a chart's foot. */
export const thaiDayMonth = (d: Date) =>
  `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;

/** "ก.ย." — the month alone, for a year's worth of them along an axis. */
export const thaiMonthShort = (d: Date) => MONTHS_SHORT[d.getMonth()];

/** "กันยายน 2569" — the month a list is grouped under. */
export const thaiMonthYear = (d: Date) =>
  `${MONTHS_FULL[d.getMonth()]} ${buddhistYear(d)}`;

/** "09:00 น." */
export const thaiTime = (d: Date) =>
  `${pad(d.getHours())}:${pad(d.getMinutes())} น.`;

/** "27 สิงหาคม 2569 - 09:00 น." — the full stamp on a visit card. */
export const thaiDateTime = (d: Date) => `${thaiFullDate(d)} - ${thaiTime(d)}`;

/**
 * "10 ส.ค. 69 - 10:00" — the compact stamp under a screening result, with a
 * two-digit year, matching the Figma record sheet.
 */
export const screeningStamp = (d: Date) =>
  `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ` +
  `${pad(buddhistYear(d) % 100)} - ${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** The calendar day, with the time stripped, so two dates compare directly. */
export const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * A month as the rows a calendar draws it in, Sunday first.
 *
 * Two calendars in this app draw one and they disagree about height, for a
 * reason: the plan screen draws only the rows the month needs, so its sheet
 * can rise to meet them, and the card the date title opens is a fixed size
 * that must not grow and shrink as it is paged through the year. So the
 * shape is one piece of arithmetic and the height is the caller's, asked
 * for with `weeks`.
 */
export function monthCells(month: Date, weeks?: number): (number | null)[][] {
  const lead = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const days = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  while (weeks != null && cells.length < weeks * 7) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}
