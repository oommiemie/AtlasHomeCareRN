import { useSyncExternalStore } from "react";
import { File, Paths } from "expo-file-system";

import {
  sexOfName,
  type ActivityKind,
  type Outcome,
  type Records,
  type Session,
} from "./vaccination";
import {
  assess as assessDspm,
  windowFor,
  type Answers,
  type DspmLevel,
} from "./dspm";
import {
  assess,
  atSd,
  heightBandAt,
  weightBandAt,
  type GrowthLevel,
  type Sex,
} from "./growth";

/**
 * The sessions already run, kept on the phone.
 *
 * Split from `vaccination`, which holds the rules: that half is arithmetic
 * over records and can be run and checked anywhere, and it would stop being
 * checkable the moment it imported a store that reaches for the file
 * system. The part that must not be wrong stays testable.
 *
 * Why it is written down at all: a carer who has just immunised fifty
 * children is asked, days later, who was absent — by a head teacher, by the
 * district, by a parent. Without this the only answer is the one the server
 * has, and the whole point of the offline flow is that the phone is
 * sometimes the only place the work exists yet.
 *
 * What is kept is what was written: who, what outcome, and who overruled a
 * warning and said why. That last one is the audit trail the result screen
 * promises.
 */
export type Person = {
  name: string;
  hn: string;
  room: string;
  outcome: Outcome;
  /** The reason given, where a warning was overruled. */
  override?: string;
  /**
   * Why they were not served, where they were not.
   *
   * The figure on the card says six did not get it; this is what turns that
   * into a follow-up list. Two off sick come back next round, one who has
   * left the school does not, and without the reason nobody can tell them
   * apart three weeks later.
   */
  note?: string;
  /** The finding a dose was recorded over, where nobody was asked why. */
  flag?: string;
  /**
   * What was weighed, where the sitting weighed.
   *
   * "recorded" is the whole outcome of a vaccination; on a nutrition round
   * it says only that the child turned up. The register is read by the
   * verdict, so the verdict travels with the person into the history rather
   * than being recomputed — the reference tables can be revised, and a
   * record has to go on saying what was decided at the time.
   */
  growth?: {
    kg: number;
    cm: number;
    level: GrowthLevel;
    label: string;
  };
  /** And what the developmental screening found, on a round that screened. */
  dspm?: {
    window: number;
    passed: number;
    total: number;
    level: DspmLevel;
    label: string;
  };
};

export type Done = {
  id: string;
  /** When the session was last written to, in milliseconds. */
  savedAt: number;
  /** When the service was given. */
  servedAt: number;
  title: string;
  place: string;
  group: string;
  /** What kind of work this was — and, for a vaccination, which vaccine. */
  kind: ActivityKind;
  /**
   * What the sitting wrote down.
   *
   * Optional because entries saved before weighing rounds existed have no
   * such field, and a history that failed to load because of it would lose
   * a carer's whole year. Absent reads as "dose".
   */
  records?: Records;
  /** The three that only an immunisation has. */
  vaccine?: string;
  lot?: string;
  dose?: number;
  provider: string;
  providerCode: string;
  people: Person[];
};

/**
 * The vial, as one line — or nothing, for a sitting that had none.
 *
 * Written once here rather than at each place that shows it: three screens
 * were interpolating the three fields straight into a string, which for a
 * school health check printed "undefined เข็ม undefined · Lot undefined".
 */
export const vialOf = (d: Done): string | null =>
  d.vaccine == null ? null : `${d.vaccine} เข็ม ${d.dose} · Lot ${d.lot}`;

/** The three figures a weighing round is read by, from a saved sitting. */
export const growthCountsOf = (d: Done) => {
  // Both kinds of per-child round, counted into the same three buckets —
  // see `growthTally`, which does this for a sitting still open.
  const seen = d.people.filter((p) => p.growth != null || p.dspm != null);
  return {
    measured: seen.length,
    abnormal: seen.filter(
      (p) => p.growth?.level === "abnormal" || p.dspm?.level === "delayed",
    ).length,
    watch: seen.filter(
      (p) => p.growth?.level === "watch" || p.dspm?.level === "suspect",
    ).length,
  };
};

export const countsOf = (d: Done) => ({
  targets: d.people.length,
  recorded: d.people.filter((p) => p.outcome === "recorded").length,
  absent: d.people.filter((p) => p.outcome === "absent").length,
  refused: d.people.filter((p) => p.outcome === "refused").length,
  waiting: d.people.filter((p) => p.outcome === "waiting").length,
});

/* ------------------------------------------------------------------ *
 * Sample history
 * ------------------------------------------------------------------ */

const NAMES = [
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
  "พิชญา",
  "รวิสรา",
  "อติวิชญ์",
  "ญาณิศา",
];
const SURNAMES = [
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
  "แก้วประเสริฐ",
  "ชื่นบาน",
];

/**
 * A session's roster, worked out from its size and its outcome counts.
 *
 * Built rather than written: five sessions of fifty is two hundred and
 * fifty lines of names nobody would read, and the only thing that has to
 * be true of them is that the outcomes add up to the counts on the card.
 */
function people(
  seed: number,
  size: number,
  absent: number,
  refused: number,
  overrides: number,
  /** How the school calls the room these children are in. */
  rooms: string[],
): Person[] {
  return Array.from({ length: size }, (_, i) => {
    const n = seed * 31 + i * 7;
    const outcome: Outcome =
      i < absent ? "absent" : i < absent + refused ? "refused" : "recorded";
    const room = rooms[i % rooms.length];
    return {
      name: `${NAMES[n % NAMES.length]} ${SURNAMES[(n + i) % SURNAMES.length]}`,
      hn: String(600000 + seed * 1000 + i * 7),
      room,
      outcome,
      // The overridden ones sit at the end of the recorded block, so a
      // reader scrolling down meets the ordinary rows first.
      override:
        outcome === "recorded" && i >= size - overrides
          ? "ตรวจสอบประวัติวัคซีนแล้ว"
          : undefined,
      /*
        Why they were not served.

        Spread across the reasons the sheet actually offers, so a month of
        history shows what a month looks like — and so the difference the
        follow-up list is built on is visible in the samples: off sick comes
        back next round, moved away does not.
      */
      note:
        outcome === "absent"
          ? ABSENT_NOTES[(seed + i) % ABSENT_NOTES.length]
          : outcome === "refused"
            ? REFUSED_NOTES[(seed + i) % REFUSED_NOTES.length]
            : undefined,
    };
  });
}

/*
  The same room the live roster generates, frozen into the history.

  Written from the reference tables rather than as typed-in numbers: a saved
  sitting where the verdicts do not follow from the weights is worse than no
  sample at all, because it is the one thing a reader would check.
*/
/*
  Twelve slots, not the live roster's eight, and gentler.

  A saved sitting is read as a report on a nursery, and the eight-slot
  pattern the live roster is built from — three of its eight children
  outside the bands, because the point of THAT list is to exercise every
  verdict — came out of a room of fourteen as five ผิดปกติ. That is not a
  Thai nursery; it is an emergency, and a history full of them teaches a
  reader to ignore the red.

  So: one clearly wasted child, one stunted, two on the watch line, and
  eight unremarkable, which is about what a centre actually finds.
*/
const WEIGH_MONTHS = [66, 58, 54, 48, 42, 36, 30, 24, 18, 14, 10, 6];
const WEIGH_W = [-2.1, -0.3, 0.4, -0.6, 1.0, -0.9, -1.7, 0.1, 0.6, -0.4, 1.6, -1.2];
const WEIGH_H = [-0.8, 0.2, 0.6, -0.4, 0.3, -1.0, -2.2, -0.2, 0.5, -0.6, 0.1, -1.6];

const round1 = (n: number) => Math.round(n * 10) / 10;

/** A past weighing round, with every child's verdict read off the tables. */
function weighed(
  seed: number,
  size: number,
  absent: number,
  rooms: string[],
  /** A class's own twelve months, where the round was held at a school. */
  ages?: [number, number],
): Person[] {
  return Array.from({ length: size }, (_, i) => {
    const n = seed * 31 + i * 7;
    const slot = i % WEIGH_MONTHS.length;
    const wave = Math.floor(i / WEIGH_MONTHS.length);
    // The nursery spread, or the class's — the same split the live roster
    // makes, for the same reason.
    const months =
      ages == null
        ? Math.max(3, WEIGH_MONTHS[slot] - wave * 5)
        : ages[0] + ((i * 7) % (ages[1] - ages[0] + 1));
    const given = NAMES[n % NAMES.length];
    const sex: Sex = sexOfName(given);
    /*
      Halved on the second pass through the table.

      A room of fourteen reads the eight-slot pattern twice, so the one
      clearly wasted child in it became two — and a history where a seventh
      of every nursery is ผอม teaches a reader to ignore the red. The second
      pass is the same children, less pronounced.
    */
    const damp = wave === 0 ? 1 : 0.5;
    const kg = round1(atSd(weightBandAt(sex, months), WEIGH_W[slot] * damp));
    const cm = round1(atSd(heightBandAt(sex, months), WEIGH_H[slot] * damp));
    const verdict = assess({ sex, months, kg, cm });
    /*
      The ones who were not brought come at the END of the room.

      Taken off the front, as the vaccination samples do, the absent slice
      swallowed slot 0 — which is the one deliberately wasted child in the
      table above. A sample nutrition round whose only finding is the child
      who did not turn up is a sample that demonstrates nothing.
    */
    const outcome: Outcome = i >= size - absent ? "absent" : "recorded";
    return {
      name: `${given} ${SURNAMES[(n + i) % SURNAMES.length]}`,
      hn: String(690000 + seed * 1000 + i * 11),
      room: rooms[i % rooms.length],
      outcome,
      note:
        outcome === "absent"
          ? ABSENT_NOTES[(seed + i) % ABSENT_NOTES.length]
          : undefined,
      growth:
        outcome === "recorded"
          ? { kg, cm, level: verdict.level, label: verdict.label }
          : undefined,
    };
  });
}

/**
 * A past screening round, with every child read against their own window.
 *
 * Built the same way the weighing samples are: the ages come from the
 * nursery spread, the window comes from the age, and the verdict is worked
 * out by the instrument rather than typed in — a saved round whose results
 * do not follow from its answers is the one thing a reader would check.
 */
function screened(
  seed: number,
  size: number,
  absent: number,
  rooms: string[],
): Person[] {
  return Array.from({ length: size }, (_, i) => {
    const n = seed * 31 + i * 7;
    const slot = i % WEIGH_MONTHS.length;
    const wave = Math.floor(i / WEIGH_MONTHS.length);
    const months = Math.max(6, WEIGH_MONTHS[slot] - wave * 5);
    const given = NAMES[n % NAMES.length];
    const outcome: Outcome = i >= size - absent ? "absent" : "recorded";
    const w = windowFor(months);

    /*
      Almost everybody passes, and two children do not.

      A nursery where a third of the room misses a milestone is not a
      nursery; a sample where nobody does teaches a reader that the amber
      and the red never happen. So two of every room miss one item each,
      and the instrument decides what that makes them.
    */
    const answers: Answers =
      w == null
        ? {}
        : Object.fromEntries(
            w.items.map((it) => [
              it.no,
              !(i % 7 === 3 && it.no === w.items[1].no),
            ]),
          );
    const r = w == null ? null : assessDspm(w, answers, i % 13 === 3 ? 2 : 1);

    return {
      name: `${given} ${SURNAMES[(n + i) % SURNAMES.length]}`,
      hn: String(690000 + seed * 1000 + i * 11),
      room: rooms[i % rooms.length],
      outcome,
      note:
        outcome === "absent"
          ? ABSENT_NOTES[(seed + i) % ABSENT_NOTES.length]
          : undefined,
      dspm:
        outcome === "recorded" && r != null
          ? {
              window: r.window,
              passed: r.passed,
              total: r.total,
              level: r.level,
              label: r.label,
            }
          : undefined,
    };
  });
}

const ABSENT_NOTES = [
  "ลาป่วย",
  "ลากิจ / ติดธุระ",
  "ไม่มาโรงเรียนวันนี้",
  "ย้าย / ออกจากโรงเรียนแล้ว",
];
const REFUSED_NOTES = [
  "ผู้ปกครองไม่ยินยอม",
  "ขอเลื่อนไปครั้งหน้า",
  "มีข้อห้ามทางการแพทย์",
];

/**
 * When a sitting was served, counting back from today.
 *
 * The times are deliberately not round. A morning at a school starts when
 * the head teacher has the class in the hall, which is 08:42 rather than
 * 09:00 — and nine sample sittings that all began exactly on the hour or
 * the half read as a table somebody filled in, not as a month of work.
 */
const daysAgo = (d: number, h: number, m: number) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(h, m, 0, 0);
  return t.getTime();
};

/**
 * When it was written up: the end of the sitting, not a fixed offset.
 *
 * About twenty minutes to set the vials out and take the register, then
 * something over a minute a child. Fifty children is nearly two hours;
 * twenty-four is under an hour. Those are different mornings and the
 * history should say so.
 */
const wroteUp = (served: number, size: number) =>
  served + (20 + Math.round(size * 1.4)) * 60_000;

/**
 * What the history opens on before anybody has run a session.
 *
 * Seeded only when there is no file at all — so it is what a new install
 * sees, and never something that could overwrite work somebody has actually
 * done.
 */
const SAMPLE: Done[] = [
  {
    id: "h1",
    servedAt: daysAgo(3, 8, 42),
    savedAt: wroteUp(daysAgo(3, 8, 42), 50),
    title: "ฉีดวัคซีน MMR เข็ม 2",
    place: "โรงเรียนบ้านตัวอย่าง",
    group: "นักเรียนชั้น ป.1 (2 ห้อง)",
    kind: "vaccination",
    records: "dose",
    vaccine: "MMR",
    lot: "MMR260917A",
    dose: 2,
    provider: "พ.ญ. สุนิสา ก.",
    providerCode: "P-10428",
    people: people(1, 50, 6, 1, 2, ["ป.1/1", "ป.1/2"]),
  },
  {
    id: "h2",
    servedAt: daysAgo(6, 13, 12),
    savedAt: wroteUp(daysAgo(6, 13, 12), 32),
    title: "ฉีดวัคซีน dT เข็มกระตุ้น",
    place: "โรงเรียนบ้านหนองแสง",
    group: "นักเรียนชั้น ป.6",
    kind: "vaccination",
    records: "dose",
    vaccine: "DTP-HB",
    lot: "DTP260901B",
    dose: 5,
    provider: "พ.ญ. สุนิสา ก.",
    providerCode: "P-10428",
    people: people(2, 32, 3, 0, 1, ["ป.6/1", "ป.6/2"]),
  },
  {
    id: "h3",
    servedAt: daysAgo(11, 9, 26),
    savedAt: wroteUp(daysAgo(11, 9, 26), 24),
    title: "หยอดวัคซีน OPV เข็ม 5",
    place: "ศพด. หมู่ 4 บ้านหนองแสง",
    group: "เด็ก 2–5 ปี",
    kind: "vaccination",
    records: "dose",
    vaccine: "OPV",
    lot: "OPV260820C",
    dose: 5,
    provider: "นาง วราภรณ์ ส.",
    providerCode: "P-10771",
    people: people(3, 24, 2, 1, 0, ["ห้องเด็กเล็ก", "ห้องอนุบาล"]),
  },
  {
    id: "h4",
    servedAt: daysAgo(19, 10, 8),
    savedAt: wroteUp(daysAgo(19, 10, 8), 45),
    title: "ฉีดวัคซีน JE เข็ม 2",
    place: "โรงเรียนวัดตัวอย่าง",
    group: "นักเรียนชั้น ป.2",
    kind: "vaccination",
    records: "dose",
    vaccine: "JE",
    lot: "JE260705D",
    dose: 2,
    provider: "พ.ญ. สุนิสา ก.",
    providerCode: "P-10428",
    people: people(4, 45, 5, 2, 3, ["ป.2/1", "ป.2/2"]),
  },
  {
    id: "h5",
    servedAt: daysAgo(31, 13, 37),
    savedAt: wroteUp(daysAgo(31, 13, 37), 28),
    title: "ฉีดวัคซีน HPV เข็ม 1",
    place: "โรงเรียนบ้านตัวอย่าง",
    group: "นักเรียนหญิงชั้น ป.5",
    kind: "vaccination",
    records: "dose",
    vaccine: "HPV",
    lot: "HPV260612E",
    dose: 1,
    provider: "นาง วราภรณ์ ส.",
    providerCode: "P-10771",
    people: people(5, 28, 4, 3, 0, ["ป.5/1", "ป.5/2"]),
  },

  /*
    The other two kinds of group work, which record the same way.

    They have no vaccine, no lot and no dose — the roster is run, each
    person is seen or is not, and that is the record. They are in the
    samples because the history is one list across all three kinds, and a
    page that only ever shows immunisations teaches a carer that the other
    two are not kept.
  */
  {
    id: "h6",
    kind: "schoolHealth",
    records: "growth",
    servedAt: daysAgo(8, 8, 55),
    savedAt: wroteUp(daysAgo(8, 8, 55), 38),
    title: "ตรวจสุขภาพนักเรียน ป.4",
    place: "โรงเรียนวัดตัวอย่าง",
    group: "นักเรียนชั้น ป.4 (2 ห้อง)",
    provider: "พ.ญ. สุนิสา ก.",
    providerCode: "P-10428",
    people: weighed(6, 38, 4, ["ป.4/1", "ป.4/2"], [120, 131]),
  },
  {
    id: "h7",
    kind: "schoolHealth",
    records: "growth",
    servedAt: daysAgo(14, 13, 21),
    savedAt: wroteUp(daysAgo(14, 13, 21), 50),
    title: "ตรวจสุขภาพนักเรียน ป.1",
    place: "โรงเรียนบ้านตัวอย่าง",
    group: "นักเรียนชั้น ป.1 (2 ห้อง)",
    provider: "นาง วราภรณ์ ส.",
    providerCode: "P-10771",
    people: weighed(7, 50, 7, ["ป.1/1", "ป.1/2"], [84, 95]),
  },
  {
    id: "h8",
    kind: "screening",
    records: "dspm",
    servedAt: daysAgo(17, 9, 6),
    savedAt: wroteUp(daysAgo(17, 9, 6), 12),
    title: "คัดกรองพัฒนาการเด็ก ศพด. หมู่ 4",
    place: "ศพด. หมู่ 4 บ้านหนองแสง",
    group: "DSPM · เด็ก 0–5 ปี",
    provider: "นาง วราภรณ์ ส.",
    providerCode: "P-10771",
    people: screened(8, 12, 1, ["ห้องเด็กเล็ก", "ห้องอนุบาล"]),
  },
  {
    id: "h9",
    kind: "schoolHealth",
    records: "growth",
    servedAt: daysAgo(25, 10, 44),
    savedAt: wroteUp(daysAgo(25, 10, 44), 31),
    title: "ชั่งน้ำหนัก–วัดส่วนสูง ศพด. หมู่ 2",
    place: "ศพด. หมู่ 2 บ้านคลองใหม่",
    group: "เด็ก 2–5 ปี",
    provider: "พ.ญ. สุนิสา ก.",
    providerCode: "P-10428",
    people: weighed(9, 14, 2, ["ห้องเด็กเล็ก", "ห้องอนุบาล"]),
  },
  /*
    Last quarter at the same centre as today's round.

    Here so the history page has a weighing to show before anybody has run
    one, and so a carer opening today's sitting can see what the same room
    looked like three months ago — which is the comparison the whole
    register is for.
  */
  {
    id: "h10",
    kind: "schoolHealth",
    records: "growth",
    servedAt: daysAgo(94, 9, 18),
    savedAt: wroteUp(daysAgo(94, 9, 18), 8),
    title: "ชั่งน้ำหนัก–วัดส่วนสูง ศพด. หมู่ 4",
    place: "ศพด. หมู่ 4 บ้านหนองแสง",
    group: "เด็ก 0–5 ปี · ไตรมาส 3",
    provider: "พ.ญ. สุนิสา ก.",
    providerCode: "P-10428",
    people: weighed(10, 8, 1, ["ห้องเด็กเล็ก", "ห้องอนุบาล"]),
  },
];

/**
 * Which edition of the samples is on the phone.
 *
 * The seeded history is written on the first launch and then left alone,
 * which is right — it would be intolerable for the app to overwrite a
 * carer's records with demonstration data. But it also meant that changing
 * the samples changed nothing on any phone that had already run the app:
 * new sample sittings never appeared, and corrections to the old ones never
 * landed.
 *
 * So the file says which edition it holds. Raise this whenever SAMPLE
 * changes and the next launch replaces the seeded rows — and only those.
 * Anything the carer actually closed is matched by neither id and is kept.
 */
const SEED = 10;

/** The seeded rows are the only ones with these ids. */
const seeded = (d: Done) => /^h\d+$/.test(d.id);

/**
 * The key a record written before `keyOf` existed should have had.
 *
 * Its id was `<activity>-<timestamp>`; what identifies the work is the
 * activity and the day it was served on.
 */
const legacyKey = (d: Done): string => {
  const activity = d.id.split("-")[0];
  const t = new Date(d.servedAt);
  const day = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  return `${activity}-${day}`;
};

let done: Done[] = [];
const watchers = new Set<() => void>();
let snapshot: Done[] = done;

const file = () => new File(Paths.document, "vaccine-history.json");

function publish(): void {
  // Newest first, which is the order anybody looks for a session in.
  snapshot = [...done].sort((a, b) => b.savedAt - a.savedAt);
  for (const w of watchers) w();
}

function save(): void {
  try {
    file().write(JSON.stringify({ done, seed: SEED }));
  } catch {
    // The next save tries again; a failed write lasts the launch.
  }
}

/** Read the past sessions back at launch. A missing file is none. */
export async function hydrateVaccineHistory(): Promise<void> {
  try {
    const f = file();
    if (!f.exists) {
      // A first launch, so the page has something in it. Written straight
      // away, which means the next launch reads it back like any other
      // history and a session deleted from it stays deleted.
      done = SAMPLE;
      publish();
      save();
      return;
    }
    const saved = JSON.parse(await f.text()) as {
      done?: Done[];
      seed?: number;
    };
    done = Array.isArray(saved.done) ? saved.done : [];

    // A newer edition of the samples than the one on the phone: swap the
    // seeded rows for it and leave every real sitting where it is.
    const fresh = (saved.seed ?? 1) < SEED;
    if (fresh) done = [...SAMPLE, ...done.filter((d) => !seeded(d))];

    /*
      Sittings written before the key changed, collapsed onto it.

      The history used to be keyed by the session id, which carries a
      timestamp — so a class opened and closed four times in a morning left
      four records of the same work. Phones that ran that version have the
      pile; nothing in the app would ever clear it, because every row is a
      real sitting that was really closed.

      They are the same work, so they become one record: keyed by activity
      and day like everything written since, keeping the latest write of
      each person.
    */
    const merged = new Map<string, Done>();
    let changed = fresh;
    for (const d of [...done].sort((a, b) => a.savedAt - b.savedAt)) {
      const key = seeded(d) ? d.id : legacyKey(d);
      const was = merged.get(key);
      if (was == null) {
        merged.set(key, { ...d, id: key });
        if (key !== d.id) changed = true;
        continue;
      }
      changed = true;
      const people = new Map(was.people.map((x) => [x.hn, x]));
      for (const x of d.people) people.set(x.hn, x);
      merged.set(key, { ...d, id: key, people: [...people.values()] });
    }
    if (changed) {
      done = [...merged.values()];
      publish();
      save();
      return;
    }
  } catch {
    done = [];
  }
  publish();
}

export function useVaccineHistory(): Done[] {
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

export const doneById = (id: string): Done | undefined =>
  done.find((d) => d.id === id);

/**
 * Write this session into the history, or update what is already there.
 *
 * Called whenever a batch has been saved rather than only when the carer
 * presses "finished": somebody who records forty and then walks out of the
 * classroom has still done the work, and it should be in the history
 * whether or not they got back to the last screen.
 */
/**
 * One sitting, one record — keyed by the work, not by the app's session.
 *
 * `Session.id` carries a timestamp, so it is a different id every time a
 * sitting is opened. Closing the same class twice in a morning — reopened
 * to catch the six who came back after games — filed it twice, and the
 * history read as if the school had been vaccinated on two separate
 * occasions.
 *
 * What identifies a record is the activity and the day it was served on. A
 * second pass over the same class on the same day is the same piece of
 * work, and it updates the entry rather than making another.
 */
const keyOf = (session: Session): string => {
  const d = session.setup.at;
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${session.activity.id}-${day}`;
};

export function keep(session: Session): void {
  const entry: Done = {
    id: keyOf(session),
    savedAt: Date.now(),
    servedAt: session.setup.at.getTime(),
    title: session.activity.title,
    place: session.activity.place,
    group: session.activity.group,
    kind: session.activity.kind,
    records: session.activity.records,
    vaccine: session.setup.lot?.kind,
    lot: session.setup.lot?.lot,
    dose: session.setup.lot?.dose,
    provider: session.setup.provider,
    providerCode: session.setup.providerCode,
    people: session.rows.map((r) => ({
      name: r.target.name,
      hn: r.target.hn,
      room: r.target.room,
      outcome: r.outcome,
      override: r.override,
      note: r.note,
      flag: r.flag,
      growth:
        r.growth == null
          ? undefined
          : {
              kg: r.growth.kg,
              cm: r.growth.cm,
              level: r.growth.level,
              label: r.growth.label,
            },
      dspm:
        r.dspm == null
          ? undefined
          : {
              window: r.dspm.window,
              passed: r.dspm.passed,
              total: r.dspm.total,
              level: r.dspm.level,
              label: r.dspm.label,
            },
    })),
  };
  /*
    Merged, not replaced.

    A second pass records the six who came back; it knows nothing about the
    forty-four written in the first. Overwriting would lose them. So the
    people are keyed by HN and the later pass wins per person, which is what
    "the same sitting, continued" means.
  */
  const at = done.findIndex((d) => d.id === entry.id);
  if (at < 0) {
    done = [entry, ...done];
  } else {
    const before = new Map(done[at].people.map((p) => [p.hn, p]));
    for (const p of entry.people) before.set(p.hn, p);
    done = done.map((d) =>
      d.id === entry.id ? { ...entry, people: [...before.values()] } : d,
    );
  }
  publish();
  save();
}

/** Drop one session from the history for good. */
export function forget(id: string): void {
  done = done.filter((d) => d.id !== id);
  publish();
  save();
}
