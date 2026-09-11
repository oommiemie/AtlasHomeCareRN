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
