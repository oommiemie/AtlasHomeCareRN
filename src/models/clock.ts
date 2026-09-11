import { startOfDay } from "../utils/thaiDate";

/**
 * The day the app treats as today.
 *
 * Read from the real clock once, when the module is first loaded, and held
 * for the life of the process. Every generated record is placed relative to
 * this rather than written as a calendar date, so the demo reads as current
 * whenever it is opened instead of ageing into a fixed week of 2026 — and
 * because it is read once rather than per call, the dates cannot shift under
 * a screen that is already open.
 *
 * Swap this for the backend's clock once the data comes from one.
 */
export const planToday = startOfDay(new Date());

/**
 * `planToday` moved by whole days, at a given time of day.
 *
 * Negative for the past. Built from the parts rather than by adding
 * milliseconds so it lands on the right wall-clock hour across a daylight
 * saving change — Thailand has none, but the arithmetic should not be the
 * reason for that.
 */
export const daysFromToday = (days: number, hour = 0, minute = 0) =>
  new Date(
    planToday.getFullYear(),
    planToday.getMonth(),
    planToday.getDate() + days,
    hour,
    minute,
  );

/**
 * The current moment.
 *
 * `planToday` is the calendar day and is read once; this is the wall clock and
 * is read every time. A record that is being generated for today has to stop
 * here rather than at midnight — see `recordEnd` in `vitals`.
 */
export const rightNow = () => new Date();
