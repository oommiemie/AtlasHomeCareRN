/**
 * A home-visit assignment.
 *
 * Two separate feeds share this shape:
 *   • `sampleTasks` — open postings nobody has taken yet ("ภารกิจใหม่")
 *   • `todayTasks`  — work this carer already accepted, due today
 * They are different jobs for different patients; neither is a slice of the
 * other.
 */
import { daysFromToday, planToday } from "./clock";
import {
  everyResident,
  sampleVillages,
  type Village,
  visitPatients,
} from "./household";
import type { CardHolder } from "./community";
import type { PatientDetail } from "./patientDetail";
import { isSameDay, startOfDay } from "../utils/thaiDate";

export type TaskStatus = "pending" | "done";

export type Task = {
  id: string;
  /**
   * Who the visit is for, as a registry id.
   *
   * The name and age below are the same person's, copied so that a card can
   * be drawn without a lookup — but this is the link that lets a visit reach
   * their readings, their screenings and their household.
   */
  residentId: string;
  name: string;
  age: number;
  detail: string;
  /** When the visit is scheduled. */
  dueAt: Date;
  /** When the job was posted — the carousel orders by this, newest first. */
  postedAt: Date;
  status?: TaskStatus;
  /** Where the visit happens. Only accepted visits carry coordinates. */
  lat?: number;
  lng?: number;
  /**
   * The whole address on one line, the way it is written on an envelope:
   * number, moo, village, soi or road, then sub-district, district, province
   * and postcode.
   */
  address?: string;
};

/**
 * The village as an address line writes it: "หมู่17" becomes "ม.17" and
 * "บ้านประชาอุทิศ" becomes "บ.ประชาอุทิศ".
 */
function villagePart(v: Village): string {
  return `${v.mooLabel.replace(/^หมู่/, "ม.")} ${v.name.replace(/^บ้าน/, "บ.")}`;
}

/**
 * The village written into an address, straight after the house number.
 *
 * Composed here rather than kept as separate fields for the screens to lay
 * out. An address is read as one run of text — at a gate, over the phone, into
 * a map — and splitting it into labelled boxes made the reader reassemble it
 * every time.
 */
function addressIn(line: string, v: Village): string {
  const [number, ...rest] = line.trim().split(/\s+/);
  return [number, villagePart(v), ...rest].join(" ");
}

const HONORIFICS = ["นางสาว", "นาง", "นาย", "เด็กชาย", "เด็กหญิง"];

/** The name without its honorific, so avatars don't all show the same letter. */
export function givenName(name: string): string {
  for (const h of HONORIFICS) {
    if (name.startsWith(h)) return name.slice(h.length).trim();
  }
  return name;
}

export const initialOf = (t: Task) => givenName(t.name)[0] ?? "?";

/**
 * "ชาย" / "หญิง", read off the Thai honorific rather than stored — the two
 * can then never disagree, and every feed has it without extra data.
 */
export function genderOf(name: string): string | undefined {
  if (name.startsWith("นางสาว") || name.startsWith("นาง")) return "หญิง";
  if (name.startsWith("เด็กหญิง")) return "หญิง";
  if (name.startsWith("นาย") || name.startsWith("เด็กชาย")) return "ชาย";
  return undefined;
}

export const hasLocation = (t: Task) => t.lat != null && t.lng != null;

/**
 * The task's patient as the record page's card holder.
 *
 * The community-service page opens on whoever the ID card said; a home
 * visit opens on whoever the task names, and this is the same shape built
 * from the task and its record instead of from a card read. The visit
 * code is minted from the task, so everything written on this visit is
 * kept against it and comes back if the page is opened again.
 */
export function visitHolder(t: Task, d: PatientDetail): CardHolder {
  const allergies =
    d.allergies.trim() === "" || /ปฏิเสธ|ไม่มี/.test(d.allergies)
      ? []
      : d.allergies.split(/[,/]/).map((a) => a.trim()).filter((a) => a !== "");
  return {
    name: givenName(t.name),
    age: t.age,
    gender: genderOf(t.name) ?? "",
    citizenId: d.nationalId,
    hn: d.hn,
    entitlement: d.coverage,
    authenCode: `VISIT-${t.id}`,
    allergies,
    conditions: d.condition.trim() === "" ? [] : [d.condition],
    phone: d.phone,
    an: d.an,
    dischargeDate: d.dischargeDate,
    referredBy: d.referredBy,
  };
}
export const isDone = (t: Task) => t.status === "done";
export const dayOf = (t: Task) => startOfDay(t.dueAt);

/** Whether a scheduled visit has been carried out, is due, or is late. */
export type VisitState = "done" | "pending" | "overdue";

export function visitStateOf(t: Task, now: Date): VisitState {
  if (isDone(t)) return "done";
  return t.dueAt.getTime() < now.getTime() ? "overdue" : "pending";
}

export const newestFirst = (list: Task[]) =>
  [...list].sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());

export const byScheduleTime = (list: Task[]) =>
  [...list].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

export const visitsOn = (day: Date, list: Task[]) =>
  list.filter((t) => isSameDay(t.dueAt, day));

/** Outstanding work first — what is still to do outranks what is finished. */
export const outstandingFirst = (list: Task[]) =>
  [...list].sort((a, b) => Number(isDone(a)) - Number(isDone(b)));

/** Matches on the patient's name or what the visit is for. */
export function searchVisits(query: string, list: Task[]): Task[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (t) =>
      t.name.toLowerCase().includes(q) || t.detail.toLowerCase().includes(q),
  );
}

/** The home carousel shows only the newest few. */
export const CAROUSEL_LIMIT = 5;

export type TaskFilter = "all" | "pending" | "done" | "overdue";

export const TASK_FILTER_LABEL: Record<TaskFilter, string> = {
  all: "ทั้งหมด",
  pending: "กำลังจะทำ",
  done: "เสร็จสิ้นแล้ว",
  overdue: "เกินกำหนด",
};

export function matchesFilter(t: Task, f: TaskFilter, today: Date): boolean {
  switch (f) {
    case "all":
      return true;
    case "done":
      return isDone(t);
    case "pending":
      return !isDone(t) && t.dueAt.getTime() >= today.getTime();
    case "overdue":
      return !isDone(t) && t.dueAt.getTime() < today.getTime();
  }
}

/** Open postings, newest first — the same feed the home carousel shows. */
/**
 * Open postings, generated rather than listed.
 *
 * Written out by hand the list stayed at ten and every entry had to be typed;
 * generated, the feed is long enough to scroll and to exercise search, and the
 * reasons for a visit vary the way a real board would.
 *
 * Deterministic: no randomness, so the same postings appear on every launch.
 */
const POSTING_REASONS = [
  "ติดตามระดับความดันโลหิตและปรับยาตามแผนการรักษาเพื่อลดความเสี่ยงโรคหัวใจ",
  "เตรียมยาเบาหวานชนิดฉีดอินซูลินและสอนวิธีฉีดยาให้ผู้ดูแลที่บ้าน",
  "ประเมินแผลกดทับบริเวณสะโพกและเปลี่ยนผ้าปิดแผลตามมาตรฐาน",
  "ตรวจระดับออกซิเจนในเลือดและสอนการใช้เครื่องผลิตออกซิเจนที่บ้าน",
  "ประเมินความสามารถในการทำกิจวัตรประจำวันและวางแผนกายภาพบำบัด",
  "ติดตามอาการหลังผ่าตัดและประเมินสัญญาณการติดเชื้อบริเวณแผล",
  "ทบทวนรายการยาทั้งหมดและตรวจสอบการใช้ยาซ้ำซ้อนกับแพทย์",
  "ติดตามอาการหอบหืดและสอนผู้ปกครองใช้ยาพ่นขยายหลอดลมอย่างถูกวิธี",
  "ตรวจพัฒนาการตามวัยและให้คำแนะนำโภชนาการแก่ผู้ปกครอง",
  "เยี่ยมมารดาหลังคลอดและประเมินภาวะซึมเศร้าหลังคลอด",
  "ดูแลผู้ป่วยติดเตียงและสอนญาติเรื่องการพลิกตะแคงตัวป้องกันแผลกดทับ",
  "ประเมินภาวะสมองเสื่อมและแนะนำการจัดสภาพแวดล้อมในบ้านให้ปลอดภัย",
  "ล้างไตทางช่องท้องที่บ้านและตรวจสอบภาวะติดเชื้อบริเวณสายล้างไต",
  "ติดตามผู้ป่วยวัณโรคระหว่างกินยาและกำกับการกินยาต่อหน้า",
  "ประเมินภาวะโภชนาการผู้สูงอายุและวางแผนอาหารร่วมกับผู้ดูแล",
  "ดูแลแผลเบาหวานที่เท้าและประเมินการไหลเวียนเลือดปลายเท้า",
  "ฟื้นฟูการกลืนหลังโรคหลอดเลือดสมองและฝึกการรับประทานอาหาร",
  "ตรวจคัดกรองมะเร็งปากมดลูกและให้ความรู้เรื่องการตรวจเต้านมด้วยตนเอง",
];


const POST_ADDRESSES = [
  "71/8 ซ.ประชาอุทิศ 27 แขวงบางมด เขตทุ่งครุ กรุงเทพฯ 10140",
  "155 ถ.ประชาอุทิศ แขวงบางมด เขตทุ่งครุ กรุงเทพฯ 10140",
  "9/24 ซ.พุทธบูชา 36 แขวงบางมด เขตทุ่งครุ กรุงเทพฯ 10140",
  "204/5 ถ.สุขสวัสดิ์ แขวงบางปะกอก เขตราษฎร์บูรณะ กรุงเทพฯ 10140",
  "18/2 ซ.ประชาอุทิศ 45 แขวงบางมด เขตทุ่งครุ กรุงเทพฯ 10140",
  "63 ถ.ราษฎร์บูรณะ แขวงราษฎร์บูรณะ เขตราษฎร์บูรณะ กรุงเทพฯ 10140",
  "88/17 ซ.ประชาอุทิศ 79 แขวงทุ่งครุ เขตทุ่งครุ กรุงเทพฯ 10140",
  "42/9 ซ.สุขสวัสดิ์ 26 แขวงบางปะกอก เขตราษฎร์บูรณะ กรุงเทพฯ 10140",
];

function makePosting(i: number): Task {
  const n = i * 13 + 7;
  const reason = POSTING_REASONS[i % POSTING_REASONS.length];

  // The reason decides the age band — a postnatal visit is not for an
  // eighty-year-old, and a developmental check is not for an adult.
  const child = reason.includes("ผู้ปกครอง");
  const postnatal = reason.includes("มารดาหลังคลอด");

  /*
    The person, chosen out of the registry rather than invented here.

    A posting used to build its own name, honorific and surname from three
    more word lists, which meant the feed was full of people who lived
    nowhere. It picks a resident whose age suits the reason instead — a
    postnatal visit goes to somebody of an age to have given birth, a
    developmental check to a child — so an accepted posting leads to a house,
    a household and a set of readings.
  */
  const fits = everyResident.filter((r) =>
    child ? r.age < 15 : postnatal ? r.age >= 20 && r.age <= 40 : r.age >= 30,
  );
  const pool = fits.length > 0 ? fits : everyResident;
  const who = pool[(n + i * 7) % pool.length];

  // Spread across the fortnight either side of today, so the list carries a
  // believable mix of soon and later: yesterday through twelve days out.
  const dayOffset = (i % 14) - 1;
  const hour = 8 + (n % 10);
  const minute = (n % 4) * 15;

  const due = daysFromToday(dayOffset, hour, minute);
  // Posted two days before it falls due, and never before the window opens —
  // a posting older than the feed itself would have no day to sit under.
  const posted = daysFromToday(Math.max(-1, dayOffset - 2), 9, (n % 6) * 10);
  const home = POST_ADDRESSES[n % POST_ADDRESSES.length];
  // Villages come from the registry rather than a second list of names: a
  // posting the carer takes should land in a village they already look after.
  const village = sampleVillages[n % sampleVillages.length];

  return {
    id: `t${i + 1}`,
    residentId: who.id,
    name: who.name,
    age: who.age,
    detail: reason,
    dueAt: due,
    postedAt: posted,
    lat: 13.641 + ((n * 3) % 30) * 0.0009,
    lng: 100.489 + ((n * 5) % 30) * 0.001,
    address: addressIn(home, village),
  };
}

/** Open postings, newest first — the same feed the home carousel shows. */
export const sampleTasks: Task[] = newestFirst(
  Array.from({ length: 24 }, (_, i) => makePosting(i)),
);

/**
 * The "today" the sample year is written around.
 *
 * Re-exported rather than defined here: `household` needs it too, and it
 * imports nothing from this module — the other way round. See `clock`.
 */
export { planToday };

/**
 * The people a visit can be for, and where they live.
 *
 * Both used to be written out here — ten names, and ten addresses beside
 * them — with nothing tying either to the registry the rest of the app
 * reads. They are the registry's own residents now; this is the same list,
 * fetched rather than repeated.
 */
const roster = visitPatients;

/** Visit days per month. Chosen to fall on different weekdays so the calendar
 *  grid doesn't come out striped. */
const daysByMonth: Record<number, number[]> = {
  1: [3, 8, 12, 15, 19, 23, 27],
  2: [3, 6, 11, 14, 19, 22, 26],
  3: [2, 5, 9, 12, 16, 20, 24, 28],
  4: [2, 6, 9, 14, 17, 21, 27, 30],
  5: [1, 6, 8, 14, 18, 21, 26, 29],
  6: [4, 8, 11, 15, 18, 23, 25, 29],
  7: [2, 7, 10, 16, 19, 24, 28, 31],
  8: [5, 8, 13, 16, 20, 24, 28],
  9: [2, 4, 9, 11, 15, 17, 22, 24, 29],
  10: [1, 6, 9, 14, 18, 22, 27, 30],
  11: [3, 6, 10, 13, 18, 21, 26, 28],
  12: [1, 4, 8, 11, 16, 19, 23, 26, 29],
};

const times: [number, number][] = [
  [8, 30],
  [10, 0],
  [13, 30],
  [15, 45],
];

function buildYearPlan(): Task[] {
  const out: Task[] = [];
  let n = 0;
  // The calendar runs over the year today falls in, so every month of it is
  // reachable from the month the app opens on.
  const YEAR = planToday.getFullYear();

  /**
   * Today always carries visits.
   *
   * The month maps below are a hand-drawn spread — eight or nine days each,
   * so the calendar has quiet weeks as well as busy ones. That was written
   * against a fixed "today" that was one of them; read from the real clock,
   * today lands on a blank day four times out of five, and the home screen,
   * the plan's day view and every "today" filter open empty. So the day the
   * app is actually opened on is added to its month if it is not already
   * there, and the mixed done/pending shape below gives it a half-worked day.
   */
  const months: Record<number, number[]> = { ...daysByMonth };
  const thisMonth = planToday.getMonth() + 1;
  const dayToday = planToday.getDate();
  if (!months[thisMonth].includes(dayToday)) {
    months[thisMonth] = [...months[thisMonth], dayToday].sort((a, b) => a - b);
  }

  for (const [monthKey, days] of Object.entries(months)) {
    const month = Number(monthKey);
    for (const day of days) {
      // One to four visits per day, varying so the calendar isn't uniform
      // and a busy day looks different from a quiet one.
      const count = 1 + ((day + month) % 4);
      const date = new Date(YEAR, month - 1, day);
      const isPast = date.getTime() < planToday.getTime();
      const isToday = isSameDay(date, planToday);

      for (let i = 0; i < count; i++) {
        const who = roster[n % roster.length];
        const [hh, mm] = times[i % times.length];

        // Past days are done, except every fourth, left pending so the
        // calendar carries red "overdue" markers as well as green.
        //
        // Today is deliberately mixed: the earliest visit is done and the
        // later ones are not, which is what a carer's day actually looks like
        // mid-shift — and it exercises the "completed last" ordering.
        const leaveUndone = isPast && day % 4 === 0;
        const status: TaskStatus = isToday
          ? i === 0
            ? "done"
            : "pending"
          : isPast && !leaveUndone
            ? "done"
            : "pending";

        const posted = new Date(YEAR, month - 1, day);
        posted.setDate(posted.getDate() - 5);

        out.push({
          id: `y${String(month).padStart(2, "0")}-${day}-${i}`,
          residentId: who.resident.id,
          name: who.resident.name,
          age: who.resident.age,
          detail: who.detail,
          dueAt: new Date(YEAR, month - 1, day, hh, mm),
          postedAt: posted,
          status,
          lat: who.lat,
          lng: who.lng,
          address: addressIn(who.address, sampleVillages[who.village]),
        });
        n++;
      }
    }
  }
  return out;
}

/** Every scheduled visit in the sample year — what the plan calendar reads. */
export const yearTasks: Task[] = buildYearPlan();

/** Today's accepted work, earliest first. */
export const todayTasks = (): Task[] =>
  byScheduleTime(visitsOn(planToday, yearTasks));
