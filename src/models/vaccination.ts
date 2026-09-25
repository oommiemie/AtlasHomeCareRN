import { useSyncExternalStore } from "react";

import { planToday } from "./clock";
import { schedule } from "./calendar";
import {
  assess as assessDspm,
  windowFor,
  windowsUpTo,
  type Domain,
  type DspmLevel,
  type DspmRecord,
} from "./dspm";
import {
  atSd,
  headMedian,
  heightBandAt,
  weightBandAt,
  type GrowthRecord,
  type Sex,
} from "./growth";
import { startOfDay } from "../utils/thaiDate";

/**
 * Bulk immunisation: a session, a roster, and the checks that stand between
 * them.
 *
 * The rest of this app records one visit to one person. This does not. A
 * carer stands in a classroom with fifty children in front of them and one
 * vial in their hand, and the thing that makes it safe is that the details
 * of the vial are entered ONCE and then apply to everybody — and that the
 * app, not the carer, is the one remembering who has already had this dose
 * and who had their last one too recently.
 *
 * So the shape here is: a session carries the lot, and every person on the
 * roster is checked against it before anything is written. Nothing is
 * recorded for somebody the check has stopped until a human has overruled
 * it in writing.
 */

export type VaccineKind = "MMR" | "DTP-HB" | "OPV" | "JE" | "HPV";

/**
 * What a course of each vaccine requires.
 *
 * `minIntervalDays` is the rule the roster is judged by, and it is the
 * reason this exists as data rather than as a number typed into a screen: a
 * child who had their last dose twenty-four days ago is not ready, and the
 * only way for the app to know that is to hold the interval.
 */
export type VaccineCourse = {
  kind: VaccineKind;
  /** How many doses the full course runs to. */
  doses: number;
  /** The shortest gap allowed between two of them. */
  minIntervalDays: number;
  route: string;
};

export const COURSES: VaccineCourse[] = [
  { kind: "MMR", doses: 2, minIntervalDays: 28, route: "SC" },
  { kind: "DTP-HB", doses: 5, minIntervalDays: 28, route: "IM" },
  { kind: "OPV", doses: 5, minIntervalDays: 28, route: "Oral" },
  { kind: "JE", doses: 2, minIntervalDays: 90, route: "SC" },
  { kind: "HPV", doses: 2, minIntervalDays: 180, route: "IM" },
];

export const courseOf = (kind: VaccineKind): VaccineCourse =>
  COURSES.find((c) => c.kind === kind) ?? COURSES[0];

/**
 * One batch, as the master data holds it.
 *
 * The maker, the expiry and the dose are NOT typed in. A carer reads the
 * lot number off the vial and the rest is looked up, because a mistyped
 * expiry date is a mistyped expiry date on fifty records at once.
 */
export type Lot = {
  lot: string;
  kind: VaccineKind;
  maker: string;
  expiresAt: Date;
  /** Which dose of the course this batch is being given as. */
  dose: number;
  site: string;
};

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

export const LOTS: Lot[] = [
  {
    lot: "MMR260917A",
    kind: "MMR",
    maker: "Serum Institute of India",
    expiresAt: day(2026, 12, 31),
    dose: 2,
    site: "Left arm",
  },
  {
    lot: "DTP260901B",
    kind: "DTP-HB",
    maker: "GPO-MBP",
    expiresAt: day(2027, 3, 31),
    dose: 5,
    site: "Left arm",
  },
  {
    lot: "OPV260820C",
    kind: "OPV",
    maker: "Bio Farma",
    expiresAt: day(2026, 11, 30),
    dose: 5,
    site: "Oral",
  },
  {
    lot: "JE260705D",
    kind: "JE",
    maker: "GPO",
    expiresAt: day(2027, 1, 31),
    dose: 2,
    site: "Right arm",
  },
  {
    lot: "HPV260612E",
    kind: "HPV",
    maker: "MSD",
    expiresAt: day(2027, 6, 30),
    dose: 2,
    site: "Right arm",
  },
];

export const lotsOf = (kind: VaccineKind) =>
  LOTS.filter((l) => l.kind === kind);

/* ------------------------------------------------------------------ *
 * The day's activities
 * ------------------------------------------------------------------ */

export type ActivityKind = "vaccination" | "schoolHealth" | "screening";
export type ActivityState = "ready" | "draft" | "pendingSync";

/**
 * What one sitting actually writes down about a child.
 *
 * The kind says which service it belongs to and which page it is reached
 * from; this says what the roster DOES, and they are not the same question.
 * Two sittings can both be "ตรวจสุขภาพ" and one of them stands every child
 * on a scale while the other looks in their ears.
 *
 *   dose     — a vial, checked against the child's record. One tick each.
 *   growth   — น้ำหนัก, ส่วนสูง, เส้นรอบศีรษะ, read against the reference
 *              tables. A page each, because there is nothing to tick.
 *   dspm     — the developmental items due at this child's age window,
 *              passed or not. A page each, for the same reason.
 *   presence — the child was seen. One tick each, and no vial to check.
 *
 * It was implied by the kind, which is how a weighing round came to be a
 * roster of tick boxes: there was no way for the model to say that this
 * sitting has numbers in it.
 */
export type Records = "dose" | "growth" | "dspm" | "presence";

export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  vaccination: "VACCINATION",
  schoolHealth: "SCHOOL HEALTH",
  screening: "PRESCHOOL SCREENING",
};

/*
  In Thai, like the rest of the card it sits on.

  These were "Ready", "Draft" and "Pending Sync" from the prototype — three
  English words on a card whose every other line is Thai, saying things a
  carer reading the page has no reason to know in English.
*/
export const ACTIVITY_STATE_LABEL: Record<ActivityState, string> = {
  ready: "พร้อม",
  draft: "ฉบับร่าง",
  pendingSync: "รอซิงก์",
};

export type Activity = {
  id: string;
  kind: ActivityKind;
  /** What working through the roster writes down. */
  records: Records;
  state: ActivityState;
  title: string;
  /** Where it happens, and who it is for. */
  place: string;
  group: string;
  at: Date;
  /** How many people are on the roster. */
  targets: number;
  /**
   * How old the group is, in months, oldest and youngest.
   *
   * Only a sitting that measures needs it, and only one held at a school:
   * a ศพด. roster is the whole nought-to-five span and the generator has a
   * spread of its own for that, while a class is twelve months wide and has
   * to be generated inside it — a ป.1 register with a two-year-old in it is
   * not a register anybody would trust.
   */
  ages?: [number, number];
  /**
   * The rooms the group is called in, where it is called in rooms.
   *
   * A school register is read by classroom and a nursery's is not, so this
   * is what a roster row shows where the centre's name would otherwise go.
   * It was hardcoded as "ป.1/1" and "ป.1/2" inside the generator, which put
   * ป.1 rooms on the ป.6 register.
   */
  rooms?: string[];
};

/**
 * When a sitting is due, counting forward from today.
 *
 * Deliberately off the hour. A morning at a school starts when the head
 * teacher has the class in the hall, and fifteen activities all beginning
 * at 09:00 or 13:30 read as a table somebody filled in rather than as a
 * fortnight of work.
 */
const at = (d: number, h: number, m: number) => {
  const t = new Date(planToday);
  t.setDate(t.getDate() + d);
  t.setHours(h, m, 0, 0);
  return t;
};

/**
 * The day's group work, of all three kinds.
 *
 * They live together because they are the same shape — a place, a group, a
 * time and a roster — and because the day is one day. The Services page
 * shows them as three separate errands, which is how a carer picks work up;
 * `activitiesOf` is what splits them.
 */
/**
 * A fortnight of group work, five sittings of each kind.
 *
 * Enough of each to show what the page is for: a day with more than one
 * thing on it, and a week ahead with things on it that are not today. Two
 * per kind — the page opened on one card to do and one card to look at,
 * which reads as an app with nothing in it rather than as a quiet week.
 *
 * Dated relative to the app's own today, so the split into what is due now
 * and what is not stays true however long this is left running.
 */
/**
 * The fortnight of sittings this used to hold, replaced by a calendar.
 *
 * It was thirty activities written out by hand and dated in days either
 * side of today. That could only ever show a fortnight, every sitting in
 * it was somebody's invention, and the register behind it was a separate
 * list of ten made-up mornings that agreed with the plan by accident. The
 * rules a รพ.สต. runs on are in `calendar`, and both the plan and the
 * history are now the one list split at today.
 */
export const ACTIVITIES: Activity[] = schedule(planToday);

/**
 * Whole days between an activity's date and today — 0 for today or later.
 *
 * Counted in days rather than hours: a round that slipped past four
 * o'clock yesterday and one that slipped past nine this morning are both
 * "yesterday's", and a figure that rounded by the clock would have called
 * them different things.
 */
export const daysLate = (a: Activity, on: Date = planToday): number => {
  const gap = startOfDay(on).getTime() - startOfDay(a.at).getTime();
  return gap <= 0 ? 0 : Math.round(gap / 86_400_000);
};

/** Due today, whichever hour it is at. */
export const isToday = (a: Activity, on: Date = planToday): boolean =>
  startOfDay(a.at).getTime() === startOfDay(on).getTime();

/** The day's work of one kind, soonest first. */
export const activitiesOf = (kind: ActivityKind): Activity[] =>
  ACTIVITIES.filter((a) => a.kind === kind).sort(
    (a, b) => a.at.getTime() - b.at.getTime(),
  );

/** What the Services page calls each kind of errand. */
/**
 * What one sitting of each kind records, in the words its screens use.
 *
 * The flow is the same for all three — open, pick the group, record the
 * batch, clear the exceptions — and only the noun changes. Kept here so the
 * screens do not each carry their own copy of it.
 */
export const ACTIVITY_NOUN: Record<ActivityKind, string> = {
  vaccination: "ฉีดวัคซีน",
  schoolHealth: "ตรวจสุขภาพ",
  screening: "คัดกรอง",
};

/*
  The page title each kind of work gets, and they are a set.

  "งานวัคซีน" and "งานตรวจสุขภาพ" are two words; the third was six, long
  enough to be truncated in the header it names. A title in a set is read
  against the others, so it is cut to their shape — what it is a screening
  OF is on every card underneath it.
*/
export const ACTIVITY_TITLE: Record<ActivityKind, string> = {
  vaccination: "งานวัคซีน",
  schoolHealth: "งานตรวจสุขภาพ",
  screening: "งานคัดกรองเด็กเล็ก",
};

/* ------------------------------------------------------------------ *
 * The roster
 * ------------------------------------------------------------------ */

/** A dose somebody has already had. */
export type Given = { kind: VaccineKind; dose: number; at: Date };

/**
 * A weighing that has already happened.
 *
 * Kept on the child rather than worked out again, because the point of it
 * is the trend: one reading says a child is thin and three say whether
 * anybody has done anything about it. `months` is the age AT the weighing —
 * a record read next year cannot re-derive it, and a growth chart plotted
 * against today's age would put every past dot in the wrong place.
 */
export type Measured = {
  at: Date;
  months: number;
  kg: number;
  cm: number;
  head?: number;
  place: string;
  /** ไตรมาส 1–4 of the budget year, which is how the register is filed. */
  quarter: number;
};

/**
 * A developmental screening that has already happened.
 *
 * The sibling of `Measured`, and kept for the same reason: one screening
 * says whether a child can do the things their age asks, and a run of them
 * says whether anybody did anything about the time they could not. `months`
 * is the age AT the screening and `window` the set it was carried out
 * against — for most children they are close, and for a child screened late
 * they are not, which is exactly the case worth being able to see.
 */
export type Screened = {
  at: Date;
  months: number;
  window: number;
  /** Which time this child was screened on that window. */
  round: number;
  passed: number;
  total: number;
  failed: Domain[];
  level: DspmLevel;
  label: string;
  /** Who carried it out — a screening is a person's judgement. */
  by: string;
};

export type Target = {
  id: string;
  name: string;
  hn: string;
  /** "ป.1/1" — the room, which is how a teacher calls the register. */
  room: string;
  sex: Sex;
  ageYears: number;
  ageMonths: number;
  /**
   * Age in whole months.
   *
   * The years-and-months pair above is how it is said out loud; this is how
   * the growth tables are read, and rebuilding it at every call site from
   * the other two is how one of them ends up off by a year.
   */
  months: number;
  history: Given[];
  /** Past weighings, oldest first. Only a growth roster carries them. */
  measures?: Measured[];
  /** Past developmental screenings, oldest first. */
  screenings?: Screened[];
  /**
   * What this child would weigh today, for the probe that walks a roster.
   *
   * Not a prediction and never written to a record: a real round has a
   * scale, and the carer types what it says. It exists so
   * `scripts/probe-vaccination.ts` can weigh a whole room and check that
   * the verdicts it gets back are the ones the seed asked for — a roster
   * where every child is exactly on the median would prove nothing about
   * the tables.
   */
  expected?: { kg: number; cm: number; head?: number };
};

/**
 * One answer a carer can give, with the line that says what it means.
 *
 * Kept here rather than in the sheet that shows them: they are the
 * vocabulary the records are written in — a month of "ไม่มารับบริการ" is
 * only worth counting if it can be broken into the ones who were off sick
 * and the ones whose parents said no. A free text box gives "ไม่มา", which
 * counts as nothing.
 */
export type ReasonOption = {
  id: string;
  label: string;
  detail: string;
  /** Opens a field instead of standing for itself. */
  needsDetail?: boolean;
};

const OTHER: ReasonOption = {
  id: "other",
  label: "อื่นๆ",
  detail: "ระบุเหตุผลเอง",
  needsDetail: true,
};

/** Why a warning was overruled and the dose given anyway. */
export const OVERRIDE_REASONS: ReasonOption[] = [
  {
    id: "guardian",
    label: "ผู้ปกครองยืนยันว่ายังไม่ได้รับเข็มนี้",
    detail: "สอบถามผู้ปกครองหรือดูสมุดวัคซีนแล้ว",
  },
  {
    id: "record",
    label: "ตรวจสอบประวัติกับ HOSxP แล้ว ข้อมูลซ้ำผิดพลาด",
    detail: "ประวัติในระบบบันทึกซ้ำ ไม่ใช่การได้รับวัคซีนจริง",
  },
  {
    id: "doctor",
    label: "แพทย์ผู้รับผิดชอบอนุมัติให้ฉีดได้",
    detail: "มีคำสั่งแพทย์หรือได้ปรึกษาแล้ว",
  },
  OTHER,
];

/**
 * Why somebody was not there to be served.
 *
 * The first three decide what happens next and are worth separating: off
 * sick comes back on the follow-up round, away on business likewise, and a
 * child who has left the school should come off the roster rather than be
 * chased.
 */
export const ABSENT_REASONS: ReasonOption[] = [
  { id: "sick", label: "ลาป่วย", detail: "ไม่สบาย ไม่ได้มาวันนี้" },
  { id: "leave", label: "ลากิจ / ติดธุระ", detail: "ลาล่วงหน้าหรือติดธุระ" },
  {
    id: "noshow",
    label: "ไม่มาโรงเรียนวันนี้",
    detail: "ไม่ได้ลา และไม่พบตัวในวันให้บริการ",
  },
  {
    id: "moved",
    label: "ย้าย / ออกจากโรงเรียนแล้ว",
    detail: "ไม่ต้องติดตามรอบหน้า — แจ้งแก้ทะเบียน",
  },
  OTHER,
];

/**
 * Why somebody there in person did not receive it.
 *
 * "ขอเลื่อน" is deliberately its own answer rather than a kind of refusal:
 * a parent putting it off to the next round is a follow-up, and a parent who
 * has said no is not — filing both as "ปฏิเสธ" loses the difference the
 * follow-up list is built on.
 */
export const REFUSED_REASONS: ReasonOption[] = [
  {
    id: "noconsent",
    label: "ผู้ปกครองไม่ยินยอม",
    detail: "ไม่ได้รับความยินยอมให้บริการ",
  },
  {
    id: "postpone",
    label: "ขอเลื่อนไปครั้งหน้า",
    detail: "ยังไม่ปฏิเสธถาวร — เข้าคิวติดตามรอบหน้า",
  },
  {
    id: "contra",
    label: "มีข้อห้ามทางการแพทย์",
    detail: "มีไข้ แพ้วัคซีน หรือแพทย์สั่งงด",
  },
  {
    id: "child",
    label: "เด็กไม่ยินยอม",
    detail: "กลัวเข็ม หรือไม่ยอมให้บริการ",
  },
  OTHER,
];

/** What this session does to one person. */
export type Outcome = "waiting" | "recorded" | "absent" | "refused";

/*
  What each outcome is called, and why "absent" is not "ขาดเรียน".

  This roster is worked through at a school, so "ขาดเรียน" reads as a
  statement about attendance — and a child who is at school but was in the
  toilet, or whose class had games, has not missed school. What the app
  actually knows, and the only thing it is entitled to record, is that they
  were not there to be given the dose. "ไม่มารับบริการ" says that, in the
  same word the rest of the app uses for the thing being given.

  It also has to be true of the other two kinds of session this roster runs:
  a nursery screening has no lessons to be absent from.
*/
export const OUTCOME_LABEL: Record<Outcome, string> = {
  waiting: "รอบันทึก",
  recorded: "บันทึกแล้ว",
  absent: "ไม่มารับบริการ",
  refused: "ปฏิเสธ",
};

const GIVEN = [
  "กวิน",
  "ณิชา",
  "ปุณณภา",
  "ธนกฤต",
  "ศิริวรรณ",
  "อนันต์",
  "พิมพ์ชนก",
  "วีรภัทร",
  "จิรัฏฐิกาล",
  "ภูริช",
  "ชนาภา",
  "ธีรเดช",
  "กันติชา",
  "ปัณณวิชญ์",
  "แพรวา",
  "สรวิชญ์",
  "ณัฐธิดา",
  "กิตติภพ",
  "อารยา",
  "ชยพล",
  "พรปวีณ์",
  "ธนวัฒน์",
  "ศุภกร",
  "เบญญาภา",
  "ปรมินทร์",
];
/*
  Which of the given names above belong to girls.

  Needed because the roster now says "หญิง · 3 ปี 6 ด." on every row, and a
  register that offers ชนาภา as a boy is read — correctly — as data nobody
  checked. The names were picked for a list that never printed a sex; now
  that one is printed, it has to be the name's own.
*/
const GIRLS = new Set([
  "ณิชา",
  "ปุณณภา",
  "ศิริวรรณ",
  "พิมพ์ชนก",
  "จิรัฏฐิกาล",
  "ชนาภา",
  "กันติชา",
  "แพรวา",
  "ณัฐธิดา",
  "อารยา",
  "พรปวีณ์",
  "เบญญาภา",
  // Four the history's own pool adds on top of the list above.
  "พิชญา",
  "รวิสรา",
  "ญาณิศา",
]);

const BOY_NAMES = GIVEN.filter((n) => !GIRLS.has(n));
const GIRL_NAMES = GIVEN.filter((n) => GIRLS.has(n));

/**
 * Whether a given name belongs to a girl.
 *
 * Exported because the sample history builds its own rosters from a pool
 * that overlaps this one, and two hand-kept lists of Thai given names is
 * one list too many — the second was already out of date by four names the
 * day it was written.
 */
export const sexOfName = (given: string): Sex =>
  GIRLS.has(given) ? "หญิง" : "ชาย";

const FAMILY = [
  "ศรีสุข",
  "บุญมาก",
  "เจริญสุข",
  "ใจดี",
  "แสงทอง",
  "อินทรา",
  "รักไทย",
  "วัฒนกุล",
  "พงษ์ไพบูลย์",
  "ธนาวดี",
];

/**
 * The roster, generated rather than written out.
 *
 * Fifty children with believable spacing in their records, because the
 * checks below are the point of this screen and a roster where nobody has
 * ever had a dose would never exercise them.
 */
export function rosterFor(activity: Activity): Target[] {
  // A weighing round is a different roster: nought to five rather than one
  // class, and every child arrives carrying three quarters of readings.
  if (activity.records === "growth" || activity.records === "dspm") {
    return childRosterFor(activity);
  }

  const kind: VaccineKind = "MMR";
  return Array.from({ length: activity.targets }, (_, i) => {
    const n = i * 7 + 3;
    const history: Given[] = [];

    // Almost everybody has had the first dose, long ago.
    if (n % 11 !== 0) {
      const first = new Date(planToday);
      first.setDate(first.getDate() - (240 + (n % 90)));
      history.push({ kind, dose: 1, at: first });
    }

    // A few had it very recently — those are the ones the interval rule
    // catches.
    if (i === 6 || i === 31) {
      const recent = new Date(planToday);
      recent.setDate(recent.getDate() - 24);
      history[0] = { kind, dose: 1, at: recent };
    }

    // And one has already had the dose this session is giving.
    if (i === 3 || i === 22) {
      const already = new Date(planToday);
      already.setDate(already.getDate() - 92);
      history.push({ kind, dose: 2, at: already });
    }

    const given = GIVEN[i % GIVEN.length];
    return {
      id: `t${i}`,
      name: `${given} ${FAMILY[i % FAMILY.length]}`,
      hn: String(621040 + i * 7),
      // The activity's own rooms where it has them. This used to read
      // "ป.1/1" and "ป.1/2" on every register in the app, including the
      // ones for ป.6 and for a nursery.
      room: roomOf(activity, i),
      sex: sexOfName(given),
      ageYears: 7,
      ageMonths: i % 12,
      months: 7 * 12 + (i % 12),
      history,
    };
  });
}

/* ------------------------------------------------------------------ *
 * The nursery roster
 * ------------------------------------------------------------------ */

/**
 * How far off the middle each child sits, in deviations.
 *
 * Written down rather than generated, because the mix is the point. A room
 * where everybody is at the median exercises none of the bands this feature
 * exists for, and a room of random numbers is a room where a third of the
 * children are wasted, which is not a Thai nursery.
 *
 * So: one child well under on weight and normal in height — thin now, which
 * is the finding that sends somebody back this month; one short for their
 * age with a weight to match — stunted, which is years old and cannot be
 * fixed by the next quarter; one well over; one drifting down through the
 * watch band; and four unremarkable, which is what most of a real room is.
 */
const CHILD_SD: { w: number; h: number }[] = [
  { w: -2.1, h: -0.8 },
  { w: -0.3, h: 0.2 },
  { w: 0.4, h: 0.6 },
  { w: -1.7, h: -2.3 },
  { w: 2.3, h: 0.4 },
  { w: -0.9, h: -1.0 },
  { w: -1.8, h: -0.5 },
  { w: 0.1, h: -0.2 },
];

/**
 * The ages in the room, in months.
 *
 * Spread across the whole nought-to-five span rather than clustered, so the
 * roster's age bands each hold somebody — the bands are how a carer finds
 * the next child, and five of six standing empty would make them furniture.
 */
const CHILD_MONTHS = [66, 58, 54, 42, 30, 22, 14, 8];

const CHILD_SEX: Sex[] = [
  "หญิง",
  "หญิง",
  "ชาย",
  "ชาย",
  "หญิง",
  "ชาย",
  "หญิง",
  "ชาย",
];

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Which room this one is called in — or where they are from, if none. */
const roomOf = (activity: Activity, i: number): string =>
  activity.rooms == null
    ? activity.place
    : activity.rooms[i % activity.rooms.length];

/** A child placed exactly this far off the curve, read off the curve. */
const kgAt = (sex: Sex, months: number, sd: number) =>
  round1(atSd(weightBandAt(sex, months), sd));
const cmAt = (sex: Sex, months: number, sd: number) =>
  round1(atSd(heightBandAt(sex, months), sd));

/** ไตรมาส of the budget year, which starts in October. */
const quarterOf = (d: Date): number =>
  Math.floor(((d.getMonth() + 3) % 12) / 3) + 1;

/**
 * A room of nought-to-fives, with three quarters of history each.
 *
 * The history is the half that makes the screen worth having. A single
 * weighing cannot tell a thin child from a child who has been losing ground
 * since March, and those are the two ends of what a nursery round is for —
 * so the past readings are generated by walking each child's own deviation
 * BACK toward the middle for the light ones and up for the heavy one. The
 * girl at −2.1 was at −1.5 in the spring and −1.2 before that, which is what
 * "ค่อนข้างน้อยต่อเนื่อง" means and what the chart will show as a line
 * leaving the band.
 */
function childRosterFor(activity: Activity): Target[] {
  const span = activity.ages;
  return Array.from({ length: activity.targets }, (_, i) => {
    const slot = i % CHILD_SD.length;
    const wave = Math.floor(i / CHILD_SD.length);
    /*
      A nursery's ages, or a class's.

      The table above is a spread across the whole nought-to-five span,
      tuned so a room of eight fills all six of the age bands the roster is
      read by. A school class is not that: every child in ป.1 is seven, give
      or take the months between the oldest and the youngest in the year, so
      where the activity states its span the ages are dealt inside it.
    */
    const months =
      span == null
        ? // A second room of eight is not the same eight children again.
          Math.max(3, CHILD_MONTHS[slot] - wave * 5)
        : span[0] + ((i * 7) % (span[1] - span[0] + 1));
    const sex = CHILD_SEX[(slot + wave) % CHILD_SEX.length];
    /*
      Halved on the second pass through the table.

      Eight slots with three of them outside the bands is the right mix for
      a room of eight — every verdict the page can show, shown. Read twice
      for a room of fourteen it is six children in trouble, which is not a
      nursery, and a roster like that teaches a carer to skim past the red.
    */
    const damp = wave === 0 ? 1 : 0.5;
    const { w: w0, h: h0 } = CHILD_SD[slot];
    const w = w0 * damp;
    const h = h0 * damp;

    const kg = kgAt(sex, months, w);
    const cm = cmAt(sex, months, h);

    /*
      Three quarters back, and no further than the child has been alive.

      A nine-month-old has been weighed twice, not four times, and a roster
      that invented a reading from before they were born would be the kind
      of wrong that is only noticed by somebody who trusts the screen.
    */
    const measures: Measured[] = [];
    for (let q = 3; q >= 1; q -= 1) {
      const was = months - q * 3;
      if (was < 1) continue;
      const when = new Date(planToday);
      when.setMonth(when.getMonth() - q * 3);
      when.setDate(10 + ((i * 3 + q) % 16));
      when.setHours(9 + (q % 3), (i * 7 + q * 5) % 60, 0, 0);
      // Walked back toward the middle: whatever is true today has been
      // becoming true for a while.
      const drift = w < 0 ? q * 0.3 : -q * 0.2;
      measures.push({
        at: when,
        months: was,
        kg: kgAt(sex, was, w + drift),
        cm: cmAt(sex, was, h + drift * 0.4),
        head:
          was <= 36
            ? round1(headMedian(sex, was) + ((i % 5) - 2) * 0.3)
            : undefined,
        place:
          q === 3 ? "รพ.สต." : activity.place.split(" ").slice(0, 2).join(" "),
        quarter: quarterOf(when),
      });
    }

    /*
      Drawn from the pool the mask above asks for, so no row offers a girl's
      name under "ชาย" — and indexed by the child's own place in the room
      rather than by a stride, which put the same given name on two of eight
      rows.
    */
    const pool = sex === "หญิง" ? GIRL_NAMES : BOY_NAMES;
    /*
      What this child has been screened on before, where the round screens.

      One or two windows back, which is what a nursery's file actually
      holds: DSPM is carried out at the intervals the manual sets, not every
      quarter, so a five-year-old has a handful of past screenings and a
      one-year-old has one. Almost all of them passed — a file where every
      child has a history of misses is not a file anybody would believe —
      and one child in seven carries an old "สงสัยล่าช้า", which is the
      entry that makes the history worth opening.
    */
    const screenings: Screened[] =
      activity.records !== "dspm"
        ? []
        : /*
            Strictly before the one being screened today.

            `windowsUpTo` includes the due window — a child of sixty-six
            months is due the sixty-month set — so without this the history
            carried the very round the carer has just opened, and the form
            reported a screening nobody had done yet.
          */
          windowsUpTo(months)
            .filter((w) => w.months < (windowFor(months)?.months ?? 0))
            .slice(-2)
            .map((w, k, all) => {
              const back = all.length - k;
              const when = new Date(planToday);
              when.setMonth(when.getMonth() - (months - w.months));
              when.setDate(8 + ((i * 5 + k) % 18));
              when.setHours(9 + (k % 4), (i * 11 + k * 7) % 60, 0, 0);
              const slip = i % 7 === 3 && back === 1;
              const answers = Object.fromEntries(
                w.items.map((it) => [
                  it.no,
                  !(slip && it.no === w.items[1].no),
                ]),
              );
              const r = assessDspm(w, answers, 1);
              return {
                at: when,
                months: w.months,
                window: w.months,
                round: 1,
                passed: r.passed,
                total: r.total,
                failed: r.failed,
                level: r.level,
                label: r.label,
                by: k % 2 === 0 ? "สมหญิง ปัญญาดี" : "วราภรณ์ สุขใจ",
              };
            });

    return {
      id: `t${i}`,
      name: `${pool[i % pool.length]} ${FAMILY[(i * 7 + 2) % FAMILY.length]}`,
      hn: String(690120 + i * 11),
      // A class is called by room. A nursery has no rooms, so what stands
      // in for it there is where the child is from, which is what a carer
      // asks to tell two children with the same given name apart.
      room: roomOf(activity, i),
      sex,
      ageYears: Math.floor(months / 12),
      ageMonths: months % 12,
      months,
      history: [],
      measures,
      screenings,
      expected: {
        kg,
        cm,
        head:
          months <= 60
            ? round1(headMedian(sex, months) + ((i % 5) - 2) * 0.4)
            : undefined,
      },
    };
  });
}

/* ------------------------------------------------------------------ *
 * The checks
 * ------------------------------------------------------------------ */

/**
 * How firmly the app is standing in the way.
 *
 * Three levels rather than two, and the middle one matters. "review" is
 * something a carer should look at and can go ahead with; "warn" is
 * something that will not be written at all until it has been overruled,
 * with a reason, by a person. Giving a dose twice is not a matter of
 * judgement.
 */
export type CheckLevel = "ready" | "review" | "warn";

export type Check = { level: CheckLevel; reason?: string };

export const CHECK_LABEL: Record<CheckLevel, string> = {
  ready: "พร้อม",
  review: "ตรวจสอบ",
  warn: "เตือน",
};

const DAY_MS = 24 * 60 * 60 * 1000;

const thaiDay = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;

/**
 * Whether this lot may be given to this person today.
 *
 * Read in order of severity, so the reason a carer is shown is the worst
 * one rather than the first one found.
 */
export function checkTarget(
  target: Target,
  lot: Lot | undefined,
  on: Date = planToday,
): Check {
  // A sitting with no vial — a school health check, a nursery screening —
  // has nothing to check against. There is no dose to duplicate and no
  // interval to be short of, so everyone on the roster is ready. The three
  // findings below are about vaccines and only about vaccines.
  if (lot == null) return { level: "ready" };

  const course = courseOf(lot.kind);

  if (startOfDay(lot.expiresAt).getTime() < startOfDay(on).getTime()) {
    return {
      level: "warn",
      reason: `วัคซีนหมดอายุแล้ว ${thaiDay(lot.expiresAt)} — Expired Lot`,
    };
  }

  const same = target.history.find(
    (g) => g.kind === lot.kind && g.dose === lot.dose,
  );
  if (same != null) {
    return {
      level: "warn",
      reason: `ได้รับ ${lot.kind} เข็ม ${lot.dose} แล้ว ${thaiDay(same.at)} — Duplicate Vaccine`,
    };
  }

  const prior = target.history
    .filter((g) => g.kind === lot.kind && g.dose < lot.dose)
    .sort((a, b) => b.at.getTime() - a.at.getTime())[0];

  if (prior == null && lot.dose > 1) {
    return {
      level: "review",
      reason: `ไม่พบประวัติเข็มก่อนหน้าในระบบ — ตรวจสอบสมุดวัคซีน`,
    };
  }

  if (prior != null) {
    const gap = Math.floor(
      (startOfDay(on).getTime() - startOfDay(prior.at).getTime()) / DAY_MS,
    );
    if (gap < course.minIntervalDays) {
      return {
        level: "review",
        reason: `ระยะห่างจากเข็มก่อน ${gap} วัน (ต่ำกว่า Minimum Interval ${course.minIntervalDays} วัน)`,
      };
    }
  }

  return { level: "ready" };
}

/* ------------------------------------------------------------------ *
 * The session
 * ------------------------------------------------------------------ */

/** The one set of details every record in this session carries. */
export type SessionSetup = {
  /**
   * The vial, where there is one.
   *
   * Immunisation is the only one of the three kinds of group work that
   * gives something out of a bottle. A school health check and a nursery
   * screening run the same roster over the same four steps and record that
   * a person was seen, so they open a session with no lot at all.
   */
  lot?: Lot;
  provider: string;
  providerCode: string;
  at: Date;
};

export type Row = {
  target: Target;
  outcome: Outcome;
  /** Set when a carer has overruled a warning, with their reason. */
  override?: string;
  /**
   * Why this row was settled without a dose.
   *
   * Absent and refused are the two outcomes that are decisions rather than
   * events, and a register that records only which of the two it was cannot
   * answer the question it exists to answer: of the six who did not get it,
   * how many can be caught on the next round. Off sick and moved away are
   * both "ไม่มารับบริการ" and one of them is a follow-up.
   */
  note?: string;
  /**
   * The finding that was standing when this was recorded.
   *
   * A warning does not stop a save. But it cannot be as if nothing
   * happened: a second MMR given to somebody the records say has had one is
   * the single most important line in this whole feature, and if nobody was
   * asked why, the least the record can do is say what was known at the
   * time. Set only where the save went through over a warning with no
   * reason given; where a reason WAS given it is in `override` instead.
   */
  flag?: string;
  /**
   * What was weighed and measured, on a sitting that weighs and measures.
   *
   * Every other outcome on this roster is a word. This one is four numbers,
   * three verdicts read off a table and the advice that follows from them,
   * and it is the record — "recorded" beside a child's name on a weighing
   * round means nothing on its own, because the question the register asks
   * is not whether they were seen but what they weighed.
   */
  growth?: GrowthRecord;
  /**
   * What the developmental screening found, on a round that screens.
   *
   * The sibling of `growth` and kept apart from it on purpose: a child can
   * be weighed and screened in the same morning at the same centre, and one
   * field holding whichever happened last would lose the other.
   */
  dspm?: DspmRecord;
};

export type Session = {
  /**
   * This sitting's own id.
   *
   * The history is keyed by it, so a session saved twice — once when the
   * first batch was recorded and again after the exceptions were cleared —
   * updates its entry rather than making a second one.
   */
  id: string;
  activity: Activity;
  setup: SessionSetup;
  rows: Row[];
};

/** What one press of "record" did. */
export type Recorded = {
  saved: number;
  failed: { target: Target; reason: string }[];
  followUps: number;
};

/*
  Replaced on every change, never edited in place.

  Three functions here used to reassign `session.rows` and leave the session
  object itself alone. The store's own snapshot was new each time, so the
  screens re-rendered — and then read straight through a `useMemo` keyed on
  the session, which had not changed identity, and handed back the rows from
  before the edit. Everything worked and nothing appeared: a reason chosen
  for a child was written to the record, saved to the phone, and shown
  nowhere, because the list on screen was still the one from a moment ago.

  So the session is treated as a value. Anything that changes it makes a new
  one, which is what every `useMemo`, `React.memo` and dependency array in
  the screens above is already written to expect.
*/
let session: Session | null = null;
let outcome: Recorded | null = null;
const watchers = new Set<() => void>();

type Snapshot = { session: Session | null; outcome: Recorded | null };
let snapshot: Snapshot = { session: null, outcome: null };

function publish(): void {
  snapshot = { session, outcome };
  for (const w of watchers) w();
}

export function useSession(): Snapshot {
  return useSyncExternalStore(
    (onChange) => {
      watchers.add(onChange);
      return () => {
        watchers.delete(onChange);
      };
    },
    () => snapshot,
  );
}

/**
 * Open a session and load the roster.
 *
 * Everybody starts waiting. Nothing else is honest: the carer has just
 * pressed "เปิด Session" and has not seen a child yet, so a roster that
 * opens with thirty-seven recorded and six absent is claiming work nobody
 * has done. An earlier version seeded those outcomes to make the screen look
 * busy on the way in, which also meant the counts, the bands and the save
 * tray were all describing a class that had already been half done — and a
 * carer who opened a session twice by accident would have seen the same
 * thirty-seven both times.
 *
 * What the roster DOES arrive with is each child's vaccination history, and
 * that is where the screen gets its texture: the duplicate doses and the
 * short intervals are real findings about real records, worked out by
 * `checkTarget`, not outcomes written in advance.
 */
export function openSession(activity: Activity, setup: SessionSetup): void {
  session = {
    id: `${activity.id}-${Date.now()}`,
    activity,
    setup,
    rows: rosterFor(activity).map((target) => ({
      target,
      outcome: "waiting" as Outcome,
    })),
  };
  outcome = null;
  publish();
}

export function setOutcome(
  targetId: string,
  next: Outcome,
  note?: string,
): void {
  if (session == null) return;
  session = {
    ...session,
    rows: session.rows.map((r) => {
      if (r.target.id !== targetId) return r;
      // Put back to waiting, a row is as it was before anybody touched it:
      // a reason for not being served has no meaning on somebody about to
      // be served, and a warning recorded over has none on a row with no
      // record. The override stays — it is a statement about this child and
      // this vial, and it is as true now as when it was made.
      if (next === "waiting") {
        return { ...r, outcome: next, note: undefined, flag: undefined };
      }
      return { ...r, outcome: next, note };
    }),
  };
  publish();
}

/**
 * Write one child's weighing, and settle their row with it.
 *
 * One at a time and from its own page, not from a tick in a list. A vial is
 * the same vial for fifty children, so a roster of ticks is the honest shape
 * for it; a weight is not, and there is no batch of weights to save. So this
 * both records the numbers and marks the row done — the two cannot come
 * apart, and a flow where they could would allow a child marked "ชั่งแล้ว"
 * with nothing under it.
 *
 * Writing over an existing one is deliberate: a carer who has just noticed
 * the scale was on pounds has to be able to go back in and fix it while the
 * sitting is still open.
 */
export function setDspm(targetId: string, dspm: DspmRecord): void {
  if (session == null) return;
  session = {
    ...session,
    rows: session.rows.map((r) =>
      r.target.id === targetId
        ? { ...r, outcome: "recorded" as Outcome, dspm }
        : r,
    ),
  };
  publish();
}

export function setGrowth(targetId: string, growth: GrowthRecord): void {
  if (session == null) return;
  session = {
    ...session,
    rows: session.rows.map((r) =>
      r.target.id === targetId
        ? { ...r, outcome: "recorded" as Outcome, growth }
        : r,
    ),
  };
  publish();
}

/** Overrule a warning, in writing. */
export function override(targetId: string, reason: string): void {
  if (session == null) return;
  session = {
    ...session,
    rows: session.rows.map((r) =>
      r.target.id === targetId ? { ...r, override: reason } : r,
    ),
  };
  publish();
}

/* ------------------------------------------------------------------ *
 * Putting a half-worked session back
 * ------------------------------------------------------------------ */

/**
 * Enough of a session to rebuild it, and nothing more.
 *
 * Not the session itself. That holds the whole roster, every child's
 * vaccination history and three Dates, and round-tripping it through JSON
 * means reviving all of them — one missed and the expiry check silently
 * compares a string to a date. What is kept instead is the handful of facts
 * that cannot be worked out again: which activity, which vial, who is
 * giving it, and what has been decided about whom. The roster is rebuilt
 * from the activity, which `rosterFor` derives deterministically.
 *
 * Only the rows that have been decided are kept. Fifty "waiting" is the
 * state a fresh roster is already in.
 */
export type SessionSnapshot = {
  id: string;
  activityId: string;
  /** The lot number, looked up again rather than stored whole. */
  lot?: string;
  provider: string;
  providerCode: string;
  /** When the service is being given, as an ISO string. */
  at: string;
  rows: {
    id: string;
    outcome: Outcome;
    override?: string;
    note?: string;
    flag?: string;
    /**
     * Kept whole, unlike the roster around it.
     *
     * Everything else in a snapshot is a key to be looked up again, because
     * the roster can be rebuilt from the activity. A weighing cannot: it is
     * the one thing on this screen that exists nowhere else until the
     * sitting is closed, and a carer who took eight weights and then had
     * the phone die would be asked to weigh eight children again.
     */
    growth?: GrowthRecord;
    dspm?: DspmRecord;
  }[];
};

/** What is open right now, in a form that can be written to a file. */
export function snapshotSession(): SessionSnapshot | null {
  if (session == null) return null;
  return {
    id: session.id,
    activityId: session.activity.id,
    lot: session.setup.lot?.lot,
    provider: session.setup.provider,
    providerCode: session.setup.providerCode,
    at: session.setup.at.toISOString(),
    rows: session.rows
      .filter((r) => r.outcome !== "waiting" || r.override != null)
      .map((r) => ({
        id: r.target.id,
        outcome: r.outcome,
        override: r.override,
        note: r.note,
        flag: r.flag,
        growth: r.growth,
        dspm: r.dspm,
      })),
  };
}

/**
 * Put one back, if it still makes sense.
 *
 * False where the activity or the lot has gone — master data can change
 * between launches, and half a session pinned to a vial the app no longer
 * knows is worse than no session at all.
 */
export function restoreSession(snap: SessionSnapshot): boolean {
  const activity = ACTIVITIES.find((a) => a.id === snap.activityId);
  const lot =
    snap.lot == null ? undefined : LOTS.find((l) => l.lot === snap.lot);
  // A sitting pinned to a vial the app no longer knows is worse than no
  // sitting at all. One that never had a vial is fine.
  if (activity == null || (snap.lot != null && lot == null)) return false;

  const decided = new Map(snap.rows.map((r) => [r.id, r]));
  session = {
    id: snap.id,
    activity,
    setup: {
      lot,
      provider: snap.provider,
      providerCode: snap.providerCode,
      at: new Date(snap.at),
    },
    rows: rosterFor(activity).map((target) => {
      const was = decided.get(target.id);
      return was == null
        ? { target, outcome: "waiting" as Outcome }
        : {
            target,
            outcome: was.outcome,
            override: was.override,
            note: was.note,
            flag: was.flag,
            growth: was.growth,
            dspm: was.dspm,
          };
    }),
  };
  // Not the last save's result. That belongs to a screen the carer has
  // already walked away from, and showing it again on the way back in would
  // report a batch they finished with hours ago.
  outcome = null;
  publish();
  return true;
}

/**
 * The sitting as it stands, for callers outside React.
 *
 * `record` replaces the session rather than editing it, so anything that
 * records and then wants to do something with the result — close it, write
 * it to the history — has to read it back rather than hold the one it had.
 */
export const openSessionNow = (): Session | null => session;

/**
 * The next person on the roster who has not been dealt with yet.
 *
 * For the forms that are worked one child at a time. A weighing round is
 * eight children and a school round is fifty, and every one of them used to
 * cost the same four actions: save, land back on the list, find the next
 * name, open it. Three of those four are the app's, not the carer's, and
 * this is what lets the form hand straight over.
 *
 * In roster order from the one just finished, wrapping round to the start —
 * a carer who has skipped somebody and come back to them should be handed
 * whoever is still outstanding rather than the end of the list.
 */
export function nextWaiting(afterId: string): Target | null {
  if (session == null) return null;
  const rows = session.rows;
  const at = rows.findIndex((r) => r.target.id === afterId);
  for (let k = 1; k <= rows.length; k += 1) {
    const row = rows[(at + k) % rows.length];
    if (row.outcome === "waiting") return row.target;
  }
  return null;
}

/** Where this person stands in the roster, and how long it is. */
export function placeOf(targetId: string): { at: number; of: number } | null {
  if (session == null) return null;
  const at = session.rows.findIndex((r) => r.target.id === targetId);
  return at < 0 ? null : { at: at + 1, of: session.rows.length };
}

/** Whether this activity has a sitting already under way. */
export function isOpen(activityId: string): boolean {
  return session != null && session.activity.id === activityId;
}

/**
 * Watch the open session, outside React.
 *
 * For the store that writes it to the phone: it has to hear every change —
 * a name ticked, a batch recorded, the session closed — and it is not a
 * component, so it cannot use the hook.
 */
export function watchSession(fn: () => void): () => void {
  watchers.add(fn);
  return () => {
    watchers.delete(fn);
  };
}

export function closeSession(): void {
  session = null;
  outcome = null;
  publish();
}

/** The counts the header is read by. */
export function tally(s: Session): {
  targets: number;
  recorded: number;
  absent: number;
  refused: number;
  flagged: number;
} {
  const flagged = s.rows.filter(
    (r) =>
      r.outcome === "waiting" &&
      checkTarget(r.target, s.setup.lot).level !== "ready",
  ).length;
  return {
    targets: s.rows.length,
    recorded: s.rows.filter((r) => r.outcome === "recorded").length,
    absent: s.rows.filter((r) => r.outcome === "absent").length,
    refused: s.rows.filter((r) => r.outcome === "refused").length,
    flagged,
  };
}

/**
 * The same counts for a sitting that weighs rather than gives.
 *
 * Different figures because it is a different question. A vaccination round
 * is read by how much of the vial has been given out and what the records
 * objected to; a weighing round is read by how many children are left to
 * stand on the scale and, of the ones who have, how many came out of the
 * tables badly. "ผิดปกติ" and "เฝ้าระวัง" are the two numbers the centre
 * reports and the two that decide who is visited before the next quarter.
 */
export function growthTally(s: Session): {
  targets: number;
  measured: number;
  abnormal: number;
  watch: number;
  waiting: number;
} {
  /*
    Both kinds of per-child round, counted the same way.

    A weighing and a developmental screening produce different words —
    ผิดปกติ against ล่าช้า, เฝ้าระวัง against สงสัยล่าช้า — and the same
    three buckets: seen and fine, seen and worth watching, seen and needing
    something done. The roster shows whichever words its own round uses;
    what it counts is this.
  */
  const done = s.rows.filter((r) => r.growth != null || r.dspm != null);
  const bad = (r: Row) =>
    r.growth?.level === "abnormal" || r.dspm?.level === "delayed";
  const watch = (r: Row) =>
    r.growth?.level === "watch" || r.dspm?.level === "suspect";
  return {
    targets: s.rows.length,
    measured: done.length,
    abnormal: done.filter(bad).length,
    watch: done.filter(watch).length,
    waiting: s.rows.filter((r) => r.outcome === "waiting").length,
  };
}

/**
 * Write the service records for everybody selected.
 *
 * A warning that has not been overruled is not written, and the person is
 * reported back rather than silently skipped — a bulk save that quietly
 * drops a row is how somebody ends up with no record and no follow-up.
 *
 * The follow-ups are the other half of the job: absent, refused and
 * could-not-record all mean the same thing operationally, which is that
 * this person still needs the dose and somebody has to go back for them.
 */
export function record(ids: string[]): Recorded {
  if (session == null) return { saved: 0, failed: [], followUps: 0 };
  const s = session;

  const failed: Recorded["failed"] = [];
  let saved = 0;

  const rows = s.rows.map((row) => {
    if (!ids.includes(row.target.id) || row.outcome !== "waiting") return row;
    saved += 1;
    /*
      Recorded, warning or not — and the warning kept where it happened.

      A tick is a tick, for every row: the person holding the vial is
      looking at the child and the parent, and the app is looking at a
      register that is sometimes weeks out of date. What does not change is
      that the record has to say what was known. Where nobody was asked for
      a reason, the finding itself goes onto the row and travels with it
      into the history; where a reason WAS given it is in `override`.
    */
    const check = checkTarget(row.target, s.setup.lot);
    const flag =
      check.level === "warn" && row.override == null ? check.reason : undefined;
    return { ...row, outcome: "recorded" as Outcome, flag };
  });
  session = { ...s, rows };

  const t = tally(session);
  outcome = {
    saved,
    failed,
    followUps: t.absent + t.refused + failed.length,
  };
  publish();
  return outcome;
}
