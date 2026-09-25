import { useSyncExternalStore } from "react";
import { File, Paths } from "expo-file-system";

import {
  ACTIVITIES,
  isToday,
  sexOfName,
  type Activity,
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
  /**
   * Set on the rows the app makes up for today, and on nothing else.
   *
   * They cannot be told apart by their id — a demonstration sitting for
   * this morning's ป.1 and a real one are the same piece of work filed
   * under the same key — so the flag is what says which of them the app is
   * free to throw away and rebuild. `keep` never sets it, so the moment a
   * carer closes that class for real the row stops being ours.
   */
  sample?: true;
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
const WEIGH_W = [
  -2.1, -0.3, 0.4, -0.6, 1.0, -0.9, -1.7, 0.1, 0.6, -0.4, 1.6, -1.2,
];
const WEIGH_H = [
  -0.8, 0.2, 0.6, -0.4, 0.3, -1.0, -2.2, -0.2, 0.5, -0.6, 0.1, -1.6,
];

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

/** What a nursery calls its two rooms, in the register. */
const NURSERY = ["ห้องเด็กเล็ก", "ห้องอนุบาล"];

/**
 * How far back this phone's own register goes.
 *
 * Not the whole calendar. The schedule runs two years; a carer's phone
 * holds what they have closed on it since it was handed to them, which is
 * months rather than years — and a register that reached back to the first
 * of January the year before last would be claiming to be a server.
 */
const REGISTER_DAYS = 120;

/**
 * How many recent rounds are left unclosed, per service.
 *
 * A real fortnight always has one or two: a class half done when the bell
 * went, a centre visit rained off. None at all would be a fiction, and a
 * page of them would be a carer in trouble rather than a carer at work.
 */
const LEFT_OPEN = 2;

/** The vial a school round gave, worked out from what it was called. */
function vialFor(a: Activity): Pick<Done, "vaccine" | "lot" | "dose"> {
  const stamp = `${String(a.at.getFullYear()).slice(2)}${String(a.at.getMonth() + 1).padStart(2, "0")}`;
  if (a.title.includes("MMR")) {
    return { vaccine: "MMR", lot: `MMR${stamp}17A`, dose: 2 };
  }
  if (a.title.includes("OPV")) {
    return { vaccine: "OPV", lot: `OPV${stamp}04C`, dose: 5 };
  }
  if (a.title.includes("HPV")) {
    return {
      vaccine: "HPV",
      lot: `HPV${stamp}22B`,
      dose: a.title.includes("เข็ม 2") ? 2 : 1,
    };
  }
  if (a.title.includes("dT")) {
    return { vaccine: "DTP-HB", lot: `DTP${stamp}09B`, dose: 5 };
  }
  // A clinic morning and a flu round have no single vial between them:
  // every child on the list is due something different, and a lot number
  // printed over the lot of them would be the one line of the register
  // that was not true.
  return {};
}

/** A number out of an id, so a roster is the same one every launch. */
function seedOf(key: string): number {
  let n = 0;
  for (let i = 0; i < key.length; i++) n = (n * 31 + key.charCodeAt(i)) >>> 0;
  return n;
}

/** The rooms a sitting was called in, which a nursery keeps its own way. */
const roomsOf = (a: Activity): string[] =>
  a.rooms ?? (a.place.startsWith("ศพด.") ? NURSERY : [a.place]);

/** One closed sitting, worked out from the activity it was. */
function filed(a: Activity): Done {
  const seed = seedOf(a.id) % 9973;
  const absent = Math.max(0, Math.round(a.targets * 0.08));
  const rooms = roomsOf(a);
  const who =
    a.records === "growth"
      ? weighed(seed, a.targets, absent, rooms, a.ages)
      : a.records === "dspm"
        ? screened(seed, a.targets, absent, rooms)
        : a.records === "dental"
          ? // A dental round records counts rather than a measurement, and
            // the register only needs who was seen — the counts live on
            // the child, not on the sitting's summary.
            people(seed, a.targets, absent, 0, 0, rooms)
          : people(
              seed,
              a.targets,
              absent,
              Math.round(a.targets * 0.02),
              Math.round(a.targets * 0.04),
              rooms,
            );

  return {
    id: dayKey(a.id, a.at),
    sample: true,
    kind: a.kind,
    records: a.records,
    servedAt: a.at.getTime(),
    savedAt: wroteUp(a.at.getTime(), a.targets),
    title: a.title,
    place: a.place,
    group: a.group,
    provider: "พ.ญ. สุนิสา ก.",
    providerCode: "P-10428",
    people: who,
    ...vialFor(a),
  };
}

/**
 * The register this phone opens on: the calendar's recent past, closed.
 *
 * It used to be ten mornings written out by hand, which agreed with the
 * plan on the activities page only by accident — the same school could be
 * a class of fifty in one and a class of thirty-eight in the other. Both
 * now come off the same calendar, so a sitting in the register is a
 * sitting that was on the plan, with its own place, class and size.
 *
 * Rebuilt at every launch rather than seeded once, because the key carries
 * the DAY: a row filed the morning the app was installed matches nothing
 * the day after, and the whole register would drift out from under the
 * plan as the week went on.
 *
 * Not everything closes. The two most recent rounds of each service are
 * left open so the plan has the overdue work a real fortnight always has,
 * and today's own sittings close only once their hour has gone by — a
 * one-o'clock screening is not finished at nine in the morning.
 */
function samples(now: Date): Done[] {
  const floor = now.getTime() - REGISTER_DAYS * 86_400_000;
  const past = ACTIVITIES.filter(
    (a) => a.at.getTime() >= floor && a.at.getTime() <= now.getTime(),
  ).sort((a, b) => b.at.getTime() - a.at.getTime());

  const open = new Set<string>();
  for (const kind of ["vaccination", "schoolHealth", "screening"] as const) {
    for (const a of past
      .filter((x) => x.kind === kind && !isToday(x, now))
      .slice(0, LEFT_OPEN)) {
      open.add(a.id);
    }
  }

  return past.filter((a) => !open.has(a.id)).map(filed);
}

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
const SEED = 11;

/** The seeded rows are the only ones with these ids — or with this flag. */
const seeded = (d: Done) => d.sample === true || /^h\d+$/.test(d.id);

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
      done = samples(new Date());
      publish();
      save();
      return;
    }
    const saved = JSON.parse(await f.text()) as {
      done?: Done[];
      seed?: number;
    };
    done = Array.isArray(saved.done) ? saved.done : [];

    /*
      The demonstration register, thrown away and made again.

      All of it, not just today's rows: it is generated from a calendar
      whose window moves with the date, so yesterday's edition is keyed to
      days that have fallen out of it and is missing the day that has
      fallen in. Rounds the carer has actually closed are kept and win over
      the made-up row for the same round, which is what checking the ids
      they already hold is for.
    */
    const fresh = (saved.seed ?? 1) < SEED;
    const real = done.filter((d) => d.sample !== true && !seeded(d));
    const held = new Set(real.map((d) => d.id));
    const madeUp = samples(new Date()).filter((d) => !held.has(d.id));
    const rebuilt = fresh || real.length !== done.length;
    done = [...real, ...madeUp];

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
    let changed = fresh || rebuilt;
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
/**
 * What a closed sitting is filed under: the activity, and the day it was
 * served on.
 *
 * Exported because the home page needs to ask the other way round — given
 * an activity due today, has it been finished — and rebuilding this format
 * at the call site is how the two would drift apart.
 */
export const dayKey = (activityId: string, at: Date): string => {
  const day = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
  return `${activityId}-${day}`;
};

const keyOf = (session: Session): string =>
  dayKey(session.activity.id, session.setup.at);

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
