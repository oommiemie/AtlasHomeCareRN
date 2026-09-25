import type { Activity, ActivityKind, ActivityState } from "./vaccination";

/**
 * Two years of group work, generated from the rules a รพ.สต. actually runs on.
 *
 * The samples used to be a fortnight written out by hand, dated in days
 * either side of today — which meant the app could only ever show a
 * fortnight, every sitting in it was somebody's invention, and the history
 * behind it was a separate list of ten made-up mornings that agreed with
 * the plan only by accident.
 *
 * This is one calendar instead: the first of January 2568 to the last of
 * December 2569, built from the cadences the work really has — a well-baby
 * clinic twice a week, school health once a term, a weighing round every
 * quarter, the school EPI rounds in June and December, the developmental
 * screening campaign in July. The plan and the history are then the same
 * list split at today, so a sitting in the register is a sitting that was
 * on the calendar, with the same place, the same class and the same size.
 *
 * Dates are absolute. The app's "today" is the device's own, so the page
 * shows whatever the real date lands on — a Friday in September is a
 * clinic morning, a Tuesday in June is a school. That is the point of a
 * calendar: it is not rearranged to flatter whoever is looking at it.
 */

/** The first and last days the calendar covers. */
export const SPAN = {
  from: new Date(2025, 0, 1),
  to: new Date(2026, 11, 31),
};

/**
 * The unit this carer works out of — the one the session signs in under.
 *
 * It was a รพ.สต. in a tambon while the household registry was five
 * Bangkok communities and the map opened on Pracha Uthit, which is two
 * different districts describing one carer's round. The registry and the
 * map are the harder half to move, so the calendar came to them.
 */
export const CLINIC = "ศูนย์บริการสาธารณสุข 58 ล้อม-พิมเสน ฟักอุดม";

/**
 * The schools on the round, and how big a class is at each.
 *
 * Sizes differ because schools differ: a tambon school with two rooms a
 * year takes a morning a class, and the one-room school up the road takes
 * an hour. A register where every class is thirty is a register nobody
 * planned a day around.
 */
const SCHOOLS = [
  { id: "s1", name: "โรงเรียนวัดพุทธบูชา", rooms: 2, size: 25 },
  { id: "s2", name: "โรงเรียนบางมดใต้", rooms: 2, size: 19 },
  { id: "s3", name: "โรงเรียนวัดทุ่งครุ", rooms: 1, size: 23 },
];

/** The nurseries, which are counted by centre rather than by room. */
/** The part of a centre's name a sitting is titled by. */
const shortName = (name: string) => name.split(" ").slice(0, 3).join(" ");

const NURSERIES = [
  { id: "n1", name: "ศพด. ชุมชนบางมดใต้", size: 16 },
  { id: "n2", name: "ศพด. ชุมชนประชาอุทิศ", size: 12 },
  { id: "n3", name: "ศพด. ชุมชนคลองบางปะกอก", size: 9 },
];

/* ------------------------------------------------------------------ *
 * Dates
 * ------------------------------------------------------------------ */

const iso = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

const at = (y: number, m: number, d: number, h: number, mi: number) =>
  new Date(y, m - 1, d, h, mi, 0, 0);

/** Every date in a month falling on one weekday. 1 = Monday, 5 = Friday. */
function weekdaysIn(y: number, m: number, weekday: number): number[] {
  const out: number[] = [];
  const last = new Date(y, m, 0).getDate();
  for (let d = 1; d <= last; d++) {
    if (new Date(y, m - 1, d).getDay() === weekday) out.push(d);
  }
  return out;
}

/** The n-th such weekday of a month, or the last one if there is no n-th. */
const nthWeekday = (y: number, m: number, weekday: number, n: number) => {
  const all = weekdaysIn(y, m, weekday);
  return all[Math.min(n - 1, all.length - 1)] ?? 1;
};

/**
 * A run of consecutive school days from a starting weekday.
 *
 * A school health round is not one morning: the nurse takes a class at a
 * time and works through the school over several days. Weekends are
 * stepped over rather than worked, which is the only rule about a school
 * timetable this needs to know.
 */
function schoolDays(
  y: number,
  m: number,
  from: number,
  count: number,
): number[] {
  const out: number[] = [];
  const last = new Date(y, m, 0).getDate();
  let d = from;
  while (out.length < count && d <= last) {
    const wd = new Date(y, m - 1, d).getDay();
    if (wd !== 0 && wd !== 6) out.push(d);
    d++;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * A little determinism
 * ------------------------------------------------------------------ */

/**
 * A number from a string, so a roster's size is the same every launch.
 *
 * Sizes have to vary — a clinic morning is not always eleven children —
 * and they have to vary the SAME way each time the app opens, or a sitting
 * closed yesterday would be a different sitting today. So the variation
 * comes out of the activity's own id rather than out of a random number.
 */
function seedOf(key: string): number {
  let n = 0;
  for (let i = 0; i < key.length; i++) n = (n * 31 + key.charCodeAt(i)) >>> 0;
  return n;
}

/** A figure in [lo, hi], chosen by the key rather than by chance. */
const sized = (key: string, lo: number, hi: number) =>
  lo + (seedOf(key) % (hi - lo + 1));

/* ------------------------------------------------------------------ *
 * The rules
 * ------------------------------------------------------------------ */

/** ป.1 is six to seven; a class is the twelve months after that. */
const classAges = (year: number): [number, number] => [
  60 + year * 12,
  71 + year * 12,
];

const classRooms = (year: number, rooms: number) =>
  Array.from({ length: rooms }, (_, i) => `ป.${year}/${i + 1}`);

type Draft = {
  id: string;
  kind: ActivityKind;
  records: Activity["records"];
  title: string;
  place: string;
  group: string;
  at: Date;
  targets: number;
  ages?: [number, number];
  rooms?: string[];
};

function yearOfWork(y: number): Draft[] {
  const out: Draft[] = [];

  /*
    The well-baby clinic, Tuesdays and Fridays.

    The one thing on the calendar that happens all year: parents bring
    nought-to-fives for whatever is due, and what is due is different for
    every child — which is why it is a clinic list rather than a class
    register, and why it is small.
  */
  for (let m = 1; m <= 12; m++) {
    for (const wd of [2, 5]) {
      for (const d of weekdaysIn(y, m, wd)) {
        const id = `epi-${iso(at(y, m, d, 0, 0))}`;
        out.push({
          id,
          kind: "vaccination",
          records: "dose",
          title: "คลินิกวัคซีนเด็ก 0–5 ปี",
          place: CLINIC,
          group: "เด็กตามนัดสร้างเสริมภูมิคุ้มกันโรค",
          at: at(y, m, d, wd === 2 ? 8 : 9, wd === 2 ? 40 : 10),
          targets: sized(id, 5, 14),
        });
      }
    }
  }

  /*
    คลินิกเด็กดี, the first Thursday of the month.

    Where the developmental screening that is not done at a นursery gets
    done: a child who missed the centre's round, or who was flagged at one
    and is being seen again.
  */
  for (let m = 1; m <= 12; m++) {
    const d = nthWeekday(y, m, 4, 1);
    const id = `wcc-${iso(at(y, m, d, 0, 0))}`;
    out.push({
      id,
      kind: "screening",
      records: "dspm",
      title: "คัดกรองพัฒนาการ คลินิกเด็กดี",
      place: CLINIC,
      group: "DSPM · เด็กตามนัดและรายติดตาม",
      at: at(y, m, d, 13, 20),
      targets: sized(id, 4, 9),
    });
  }

  /*
    The nursery weighing rounds, one a quarter.

    บัญชี 3 wants a child's weight and height four times a year, so the
    centres are walked in January, April, July and October — the month
    after each quarter opens, which is when the term has settled enough
    that everybody is actually there.
  */
  for (const [m, q] of [
    [1, 1],
    [4, 2],
    [7, 3],
    [10, 4],
  ] as const) {
    NURSERIES.forEach((n, i) => {
      const d = nthWeekday(y, m, 3, i + 2);
      const id = `wgh-${n.id}-${iso(at(y, m, d, 0, 0))}`;
      out.push({
        id,
        kind: "schoolHealth",
        records: "growth",
        title: `ชั่งน้ำหนัก–วัดส่วนสูง ${shortName(n.name)}`,
        place: n.name,
        group: `เด็ก 0–5 ปี · ไตรมาส ${q}`,
        at: at(y, m, d, 9, 15 + i * 10),
        targets: sized(id, n.size - 3, n.size + 2),
      });
    });
  }

  /*
    The nursery screening rounds.

    February, July and October: two ordinary rounds and the national
    campaign week in July, which is when every centre in the country is
    walked at once.
  */
  for (const m of [2, 7, 10]) {
    NURSERIES.forEach((n, i) => {
      const d = nthWeekday(y, m, 4, i + 2);
      const id = `dsp-${n.id}-${iso(at(y, m, d, 0, 0))}`;
      out.push({
        id,
        kind: "screening",
        records: "dspm",
        title: `คัดกรองพัฒนาการเด็ก ${shortName(n.name)}`,
        place: n.name,
        group: m === 7 ? "DSPM · สัปดาห์รณรงค์" : "DSPM · เด็ก 0–5 ปี",
        at: at(y, m, d, 9, 30 + i * 15),
        targets: sized(id, n.size - 4, n.size),
      });
    });
  }

  /*
    School health, once a term: June and November.

    A class a day, worked down the school from ป.1. Both terms, because a
    child measured only in June has no second point to draw a line between,
    and a line is the whole of what a growth chart says.
  */
  for (const m of [6, 11]) {
    SCHOOLS.forEach((s, si) => {
      const start = nthWeekday(y, m, 2, si + 1);
      schoolDays(y, m, start, 6).forEach((d, year0) => {
        const year = year0 + 1;
        const id = `sch-${s.id}-p${year}-${iso(at(y, m, d, 0, 0))}`;
        out.push({
          id,
          kind: "schoolHealth",
          records: "growth",
          title: `ตรวจสุขภาพนักเรียน ป.${year}`,
          place: s.name,
          group: `นักเรียนชั้น ป.${year} (${s.rooms} ห้อง) · เทอม ${m === 6 ? 1 : 2}`,
          at: at(y, m, d, 9, 30),
          targets: sized(id, s.size * s.rooms - 4, s.size * s.rooms + 3),
          ages: classAges(year),
          rooms: classRooms(year, s.rooms),
        });
      });
    });
  }

  /*
    The school immunisation rounds.

    June carries the ones a Thai primary school gives: MMR and the polio
    booster to ป.1, the first HPV dose to the girls of ป.5, dT to ป.6. The
    second HPV dose follows in December, six months behind the first, which
    is the interval the course is written with.
  */
  const jabs: { year: number; title: string; girlsOnly?: boolean }[] = [
    { year: 1, title: "ฉีดวัคซีน MMR เข็ม 2" },
    { year: 1, title: "หยอดวัคซีน OPV กระตุ้น" },
    { year: 5, title: "ฉีดวัคซีน HPV เข็ม 1", girlsOnly: true },
    { year: 6, title: "ฉีดวัคซีน dT เข็มกระตุ้น" },
  ];
  SCHOOLS.forEach((s, si) => {
    jabs.forEach((j, ji) => {
      const d = schoolDays(y, 6, nthWeekday(y, 6, 4, si + 1), 4)[ji] ?? 15;
      const id = `jab-${s.id}-p${j.year}-${ji}-${iso(at(y, 6, d, 0, 0))}`;
      const roll = s.size * s.rooms;
      out.push({
        id,
        kind: "vaccination",
        records: "dose",
        title: j.title,
        place: s.name,
        group: `นักเรียนชั้น ป.${j.year}${j.girlsOnly === true ? " (หญิง)" : ` (${s.rooms} ห้อง)`}`,
        at: at(y, 6, d, 8, 45 + ji * 5),
        targets: j.girlsOnly === true ? Math.round(roll * 0.48) : roll,
        rooms: classRooms(j.year, s.rooms),
      });
    });

    const d2 = schoolDays(y, 12, nthWeekday(y, 12, 2, si + 1), 1)[0] ?? 8;
    const id2 = `jab-${s.id}-p5-hpv2-${iso(at(y, 12, d2, 0, 0))}`;
    out.push({
      id: id2,
      kind: "vaccination",
      records: "dose",
      title: "ฉีดวัคซีน HPV เข็ม 2",
      place: s.name,
      group: "นักเรียนชั้น ป.5 (หญิง)",
      at: at(y, 12, d2, 8, 50),
      targets: Math.round(s.size * s.rooms * 0.48),
      rooms: classRooms(5, s.rooms),
    });
  });

  /*
    Fluoride varnish at the nurseries, every quarter.

    The school check is twice a year, which is right for a survey and
    leaves the service with nothing between terms — and the varnish is not
    a survey. It is applied every three to six months to nought-to-fives
    because that is the interval it works over, and it is the half of
    dental care that happens whether or not anybody is being counted.
  */
  for (const m of [3, 6, 9, 12]) {
    NURSERIES.forEach((n, i) => {
      const d = nthWeekday(y, m, 2, i + 2);
      const id = `flu-${n.id}-${iso(at(y, m, d, 0, 0))}`;
      out.push({
        id,
        kind: "dental",
        records: "dental",
        title: `เคลือบฟลูออไรด์ ${shortName(n.name)}`,
        place: n.name,
        group: `เด็ก 0–5 ปี · ไตรมาส ${Math.ceil(m / 3)}`,
        at: at(y, m, d, 9, 45 + i * 10),
        targets: sized(id, n.size - 3, n.size + 1),
      });
    });
  }

  /*
    The school dental round, once a term.

    A class a day like the health check, and in the same months — the two
    are done on the same visit to a school in practice, a day apart so the
    children are only pulled out of a lesson once each way.
  */
  for (const m of [6, 11]) {
    SCHOOLS.forEach((s, si) => {
      const start = nthWeekday(y, m, 4, si + 1);
      schoolDays(y, m, start, 6).forEach((d, year0) => {
        const year = year0 + 1;
        const id = `den-${s.id}-p${year}-${iso(at(y, m, d, 0, 0))}`;
        out.push({
          id,
          kind: "dental",
          records: "dental",
          title: `ตรวจสุขภาพช่องปาก ป.${year}`,
          place: s.name,
          group: `นักเรียนชั้น ป.${year} (${s.rooms} ห้อง) · เทอม ${m === 6 ? 1 : 2}`,
          at: at(y, m, d, 13, 20),
          targets: sized(id, s.size * s.rooms - 4, s.size * s.rooms + 2),
          ages: classAges(year),
          rooms: classRooms(year, s.rooms),
        });
      });
    });
  }

  /*
    Influenza, the two mornings a year the clinic gives it.

    Free to the seven groups the NHSO names, and they all arrive at once —
    which is why it is its own sitting rather than a line on a clinic day.
  */
  [0, 1].forEach((k) => {
    const d = nthWeekday(y, 6, 3, k + 2);
    const id = `flu-${k}-${iso(at(y, 6, d, 0, 0))}`;
    out.push({
      id,
      kind: "vaccination",
      records: "dose",
      title: "ฉีดวัคซีนไข้หวัดใหญ่ตามฤดูกาล",
      place: CLINIC,
      group: "กลุ่มเสี่ยง 7 กลุ่มตามสิทธิ สปสช.",
      at: at(y, 6, d, 8, 30),
      targets: sized(id, 28, 46),
    });
  });

  return out;
}

/**
 * How settled a sitting is, from how far off it is.
 *
 * A roster more than a month out is a draft: the school has not confirmed
 * its numbers and the consent forms have not gone home. Inside a month it
 * is ready. Nothing in the past is a draft — whatever state it was in, the
 * day it was meant to happen has been and gone.
 */
function stateOf(when: Date, now: Date): ActivityState {
  const days = (when.getTime() - now.getTime()) / 86_400_000;
  return days > 30 ? "draft" : "ready";
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** How many sittings of each service a demonstration day should carry. */
const A_DAY_EACH = 4;

/**
 * A full day's work of every kind, whatever today happens to be.
 *
 * The calendar is built from real cadences, and a real Friday in September
 * is one clinic morning and nothing else — which is honest, and useless
 * for showing somebody what the app does. The three services have three
 * different forms behind them, and a day that offers one sitting in one of
 * them leaves the other two invisible and the deck on the panel with
 * nothing to shuffle.
 *
 * So whatever the rules put on today stands, and each service is topped up
 * to four: the places are real ones off the round, the hours are the hours
 * those sittings actually run at, and the whole set is picked by the date,
 * so the same day always produces the same day's work.
 *
 * This is the one place the calendar bends to the person looking at it.
 * Anything dated other than today comes from the rules alone.
 */
function todayTopUp(now: Date, already: Draft[]): Draft[] {
  const key = iso(now);
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  const term = now.getMonth() < 4 || now.getMonth() > 9 ? 2 : 1;

  /** A different starting point each day, so the four are not always these four. */
  const turn = seedOf(key);
  const pick = <T>(list: T[], i: number) => list[(turn + i) % list.length];

  /** The bench of sittings each service can be topped up from. */
  const bench: Record<ActivityKind, ((i: number) => Omit<Draft, "id">)[]> = {
    vaccination: [
      (i) => ({
        kind: "vaccination",
        records: "dose",
        title: "คลินิกวัคซีนเด็ก 0–5 ปี",
        place: CLINIC,
        group: "เด็กตามนัดสร้างเสริมภูมิคุ้มกันโรค",
        at: at(y, m, d, 8, 30 + i * 5),
        targets: 0,
      }),
      (i) => {
        const s = pick(SCHOOLS, i);
        return {
          kind: "vaccination",
          records: "dose",
          title: "ฉีดวัคซีน MMR เข็ม 2",
          place: s.name,
          group: `นักเรียนชั้น ป.1 (${s.rooms} ห้อง)`,
          at: at(y, m, d, 9, 20),
          targets: s.size * s.rooms,
          rooms: classRooms(1, s.rooms),
        };
      },
      (i) => {
        const s = pick(SCHOOLS, i + 1);
        return {
          kind: "vaccination",
          records: "dose",
          title: "ฉีดวัคซีน dT เข็มกระตุ้น",
          place: s.name,
          group: `นักเรียนชั้น ป.6 (${s.rooms} ห้อง)`,
          at: at(y, m, d, 10, 40),
          targets: s.size * s.rooms,
          rooms: classRooms(6, s.rooms),
        };
      },
      () => ({
        kind: "vaccination",
        records: "dose",
        title: "ฉีดวัคซีนไข้หวัดใหญ่ตามฤดูกาล",
        place: CLINIC,
        group: "กลุ่มเสี่ยง 7 กลุ่มตามสิทธิ สปสช.",
        at: at(y, m, d, 13, 15),
        targets: 34,
      }),
      (i) => {
        const s = pick(SCHOOLS, i + 2);
        return {
          kind: "vaccination",
          records: "dose",
          title: "ฉีดวัคซีน HPV เข็ม 1",
          place: s.name,
          group: "นักเรียนชั้น ป.5 (หญิง)",
          at: at(y, m, d, 14, 10),
          targets: Math.round(s.size * s.rooms * 0.48),
          rooms: classRooms(5, s.rooms),
        };
      },
    ],
    schoolHealth: [
      (i) => {
        const n = pick(NURSERIES, i);
        return {
          kind: "schoolHealth",
          records: "growth",
          title: `ชั่งน้ำหนัก–วัดส่วนสูง ${shortName(n.name)}`,
          place: n.name,
          group: `เด็ก 0–5 ปี · ไตรมาส ${quarter}`,
          at: at(y, m, d, 9, 0),
          targets: n.size,
        };
      },
      (i) => {
        const n = pick(NURSERIES, i + 1);
        return {
          kind: "schoolHealth",
          records: "growth",
          title: `ชั่งน้ำหนัก–วัดส่วนสูง ${shortName(n.name)}`,
          place: n.name,
          group: `เด็ก 0–5 ปี · ไตรมาส ${quarter}`,
          at: at(y, m, d, 10, 20),
          targets: n.size,
        };
      },
      (i) => {
        const s = pick(SCHOOLS, i);
        const year = 1 + ((turn + i) % 6);
        return {
          kind: "schoolHealth",
          records: "growth",
          title: `ตรวจสุขภาพนักเรียน ป.${year}`,
          place: s.name,
          group: `นักเรียนชั้น ป.${year} (${s.rooms} ห้อง) · เทอม ${term}`,
          at: at(y, m, d, 11, 10),
          targets: s.size * s.rooms,
          ages: classAges(year),
          rooms: classRooms(year, s.rooms),
        };
      },
      (i) => {
        const s = pick(SCHOOLS, i + 1);
        const year = 1 + ((turn + i + 3) % 6);
        return {
          kind: "schoolHealth",
          records: "growth",
          title: `ตรวจสุขภาพนักเรียน ป.${year}`,
          place: s.name,
          group: `นักเรียนชั้น ป.${year} (${s.rooms} ห้อง) · เทอม ${term}`,
          at: at(y, m, d, 13, 40),
          targets: s.size * s.rooms,
          ages: classAges(year),
          rooms: classRooms(year, s.rooms),
        };
      },
      (i) => {
        const n = pick(NURSERIES, i + 2);
        return {
          kind: "schoolHealth",
          records: "growth",
          title: `ชั่งน้ำหนัก–วัดส่วนสูง ${shortName(n.name)}`,
          place: n.name,
          group: `เด็ก 0–5 ปี · ไตรมาส ${quarter}`,
          at: at(y, m, d, 14, 30),
          targets: n.size,
        };
      },
    ],
    dental: [
      (i) => {
        const s = pick(SCHOOLS, i);
        const year = 1 + ((turn + i) % 6);
        return {
          kind: "dental",
          records: "dental",
          title: `ตรวจสุขภาพช่องปาก ป.${year}`,
          place: s.name,
          group: `นักเรียนชั้น ป.${year} (${s.rooms} ห้อง) · เทอม ${term}`,
          at: at(y, m, d, 13, 20),
          targets: s.size * s.rooms,
          ages: classAges(year),
          rooms: classRooms(year, s.rooms),
        };
      },
      (i) => {
        const s = pick(SCHOOLS, i + 1);
        const year = 1 + ((turn + i + 2) % 6);
        return {
          kind: "dental",
          records: "dental",
          title: `ตรวจสุขภาพช่องปาก ป.${year}`,
          place: s.name,
          group: `นักเรียนชั้น ป.${year} (${s.rooms} ห้อง) · เทอม ${term}`,
          at: at(y, m, d, 14, 10),
          targets: s.size * s.rooms,
          ages: classAges(year),
          rooms: classRooms(year, s.rooms),
        };
      },
      (i) => {
        const n = pick(NURSERIES, i);
        return {
          kind: "dental",
          records: "dental",
          title: `เคลือบฟลูออไรด์ ${shortName(n.name)}`,
          place: n.name,
          group: "เด็ก 0–5 ปี · เคลือบฟลูออไรด์วานิช",
          at: at(y, m, d, 9, 40),
          targets: n.size,
        };
      },
      (i) => {
        const s = pick(SCHOOLS, i + 2);
        const year = 1 + ((turn + i + 4) % 6);
        return {
          kind: "dental",
          records: "dental",
          title: `ตรวจสุขภาพช่องปาก ป.${year}`,
          place: s.name,
          group: `นักเรียนชั้น ป.${year} (${s.rooms} ห้อง) · เทอม ${term}`,
          at: at(y, m, d, 10, 30),
          targets: s.size * s.rooms,
          ages: classAges(year),
          rooms: classRooms(year, s.rooms),
        };
      },
    ],
    screening: [
      (i) => {
        const n = pick(NURSERIES, i);
        return {
          kind: "screening",
          records: "dspm",
          title: `คัดกรองพัฒนาการเด็ก ${shortName(n.name)}`,
          place: n.name,
          group: "DSPM · เด็ก 0–5 ปี",
          at: at(y, m, d, 9, 40),
          targets: n.size - 2,
        };
      },
      (i) => {
        const n = pick(NURSERIES, i + 1);
        return {
          kind: "screening",
          records: "dspm",
          title: `คัดกรองพัฒนาการเด็ก ${shortName(n.name)}`,
          place: n.name,
          group: "DSPM · เด็ก 0–5 ปี",
          at: at(y, m, d, 11, 0),
          targets: n.size - 3,
        };
      },
      () => ({
        kind: "screening",
        records: "dspm",
        title: "คัดกรองพัฒนาการ คลินิกเด็กดี",
        place: CLINIC,
        group: "DSPM · เด็กตามนัดและรายติดตาม",
        at: at(y, m, d, 13, 30),
        targets: 7,
      }),
      (i) => {
        const n = pick(NURSERIES, i + 2);
        return {
          kind: "screening",
          records: "dspm",
          title: `คัดกรองพัฒนาการเด็ก ${shortName(n.name)}`,
          place: n.name,
          group: "DSPM · รอบติดตามรายสงสัยล่าช้า",
          at: at(y, m, d, 14, 40),
          targets: 5,
        };
      },
      () => ({
        kind: "screening",
        records: "dspm",
        title: "คัดกรองพัฒนาการ คลินิกเด็กดี",
        place: CLINIC,
        group: "DSPM · รายส่งต่อจาก ศพด.",
        at: at(y, m, d, 15, 20),
        targets: 4,
      }),
    ],
  };

  /*
    A day a carer could actually work.

    The bench gives each sitting an hour of its own, which is right on its
    own and wrong in a set: the weighing round at eleven and the school
    check at ten past are ten minutes and a district apart. So the hours
    are not the bench's — they come off a ladder of forty-minute slots,
    handed out in order and skipping whatever the rules have already put
    on the day.

    Forty minutes is the shortest gap in these samples that stands for
    packing up at one place and being set up at the next.
  */
  const LADDER = [
    [8, 30],
    [9, 10],
    [9, 50],
    [10, 30],
    [11, 10],
    [13, 10],
    [13, 50],
    [14, 30],
    [11, 50],
    [15, 10],
    [15, 50],
    [16, 30],
  ] as const;
  const taken = new Set(
    already
      .filter((x) => sameDay(x.at, now))
      .map((x) => `${x.at.getHours()}:${x.at.getMinutes()}`),
  );
  let slot = 0;
  const nextHour = () => {
    while (
      slot < LADDER.length &&
      taken.has(`${LADDER[slot][0]}:${LADDER[slot][1]}`)
    ) {
      slot += 1;
    }
    if (slot < LADDER.length) {
      const [h, mi] = LADDER[slot];
      slot += 1;
      return at(y, m, d, h, mi);
    }
    // Past the ladder, carry on stepping by the same forty minutes rather
    // than stacking everything left over onto its last rung.
    const over = slot - LADDER.length + 1;
    slot += 1;
    const [h, mi] = LADDER[LADDER.length - 1];
    return at(y, m, d, h, mi + over * 40);
  };

  const out: Draft[] = [];
  for (const kind of [
    "vaccination",
    "schoolHealth",
    "screening",
    "dental",
  ] as const) {
    const standing = already.filter(
      (x) => x.kind === kind && sameDay(x.at, now),
    );
    // Not the same place twice in a morning: a carer cannot be at one
    // school for two sittings an hour apart, and two cards with the same
    // name on them are the one card a roster gets opened by mistake.
    const taken = new Set(standing.map((x) => x.place + x.title + x.group));
    let i = 0;
    for (const make of bench[kind]) {
      if (
        standing.length + out.filter((o) => o.kind === kind).length >=
        A_DAY_EACH
      )
        break;
      const body = make(i++);
      const mark = body.place + body.title + body.group;
      if (taken.has(mark)) continue;
      taken.add(mark);
      const id = `fill-${kind}-${i}-${key}`;
      out.push({
        ...body,
        id,
        at: nextHour(),
        targets: body.targets > 0 ? body.targets : sized(id, 6, 13),
      });
    }
  }
  return out;
}

/** The whole two years, in the order they happen. */
export function schedule(now: Date): Activity[] {
  const rules = [...yearOfWork(2025), ...yearOfWork(2026)];
  const drafts = [...rules, ...todayTopUp(now, rules)].sort(
    (a, b) => a.at.getTime() - b.at.getTime(),
  );
  return drafts.map((d) => ({ ...d, state: stateOf(d.at, now) }));
}
