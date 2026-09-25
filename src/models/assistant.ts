/**
 * The work assistant — the thing behind the sparkles on the home screen.
 *
 * It answers two kinds of question and nothing else: how the carer's own
 * round is going, and what the record says about a patient on it. Both are
 * answered from data the phone already holds, which is what makes the answer
 * checkable — every figure it quotes can be found on the plan screen.
 *
 * The model is asked to WRITE the answer, not to work it out. The counting,
 * the date arithmetic and the "which patient is this about" are all done here
 * first and handed over as facts, because a model asked to count visits in a
 * list will sometimes get it wrong and there is no way to tell from the reply
 * that it has. When the cluster cannot be reached the same facts are written
 * out on the phone instead, so the assistant still answers — more plainly,
 * but never wrongly.
 */
import { askModel } from "./aiHost";
import { planToday } from "./clock";
import { residentById } from "./household";
import { bmiLabel, bmiOf, detailOf, type PatientDetail } from "./patientDetail";
import {
  abnormalNow,
  formatReading,
  latestVitals,
  metricOf,
  statusOf,
  type MetricKind,
} from "./vitals";
import {
  byScheduleTime,
  genderOf,
  hasLocation,
  givenName,
  isDone,
  visitStateOf,
  yearTasks,
  type Task,
} from "./task";
import {
  isSameDay,
  startOfDay,
  thaiFullDate,
  thaiTime,
} from "../utils/thaiDate";
import { currentHere } from "./here";

/** One line of the conversation. */
export type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  /**
   * Pictures the carer attached, as local file URIs — for showing in the
   * thread. Their pixels went up with the question; these are only the
   * copies the phone keeps so the bubble has something to draw.
   */
  images?: string[];
  /**
   * Visits this answer is about, by task id.
   *
   * The model does not write these out. It is given the round as facts and
   * asked for a sentence; the list underneath is drawn by the app from the
   * same records the plan screen uses, so every row is a real visit the
   * carer can open rather than a line of text about one.
   */
  visits?: string[];
  /**
   * A panel the app draws above the list, chosen here rather than by the
   * model — "counts" is the four figures the plan screen's sheet opens with.
   *
   * A question about how the round is going is answered better by the same
   * strip the carer already reads it off than by a sentence with four
   * numbers in it.
   */
  widget?: "counts";
};

/** How many pictures one question may carry. */
export const MAX_PHOTOS = 4;

/** A picture on its way to the model: where it lives, and what it is made of. */
export type Attachment = {
  /** The local file, for the bubble. */
  uri: string;
  /** The same image as base64 JPEG, which is what goes on the wire. */
  base64: string;
};

/**
 * What an empty conversation offers to ask.
 *
 * A pool rather than a fixed four: the page shows a handful at a time and
 * changes them, so somebody who opens the assistant every morning is shown
 * something they have not tried instead of the same four questions until
 * they stop reading them.
 *
 * Every one of these resolves to something the picker actually handles —
 * a suggestion the app answers badly is worse than no suggestion.
 */
export const OPENERS = [
  "วันนี้มีงานอะไรบ้าง",
  "ยังเหลืองานไหนที่ยังไม่ได้ทำ",
  "มีงานเกินกำหนดไหม",
  "สัปดาห์นี้ต้องไปบ้านใครบ้าง",
  "ใครอยู่ใกล้ฉันมากที่สุด",
  "เรียงงานวันนี้ตามระยะทาง",
  "วันนี้ใครมีค่าผิดปกติบ้าง",
  "ใครน่าห่วงที่สุด",
  "วันนี้ทำเสร็จไปกี่รายการ",
  "สรุปงานวันนี้ให้หน่อย",
  "บ้านไหนไกลที่สุด",
  "เจ็ดวันข้างหน้ามีนัดกี่รายการ",
] as const;

/**
 * A few of them, never the same one twice in a set.
 *
 * `avoid` is the set on screen now, so a change actually changes something:
 * picking at random from twelve will otherwise land on one of the four
 * already showing about as often as not.
 */
export function someOpeners(
  count: number,
  avoid: readonly string[] = [],
): string[] {
  const fresh = OPENERS.filter((q) => !avoid.includes(q));
  const pool = fresh.length >= count ? [...fresh] : [...OPENERS];
  const out: string[] = [];
  while (out.length < count && pool.length > 0) {
    out.push(...pool.splice(Math.floor(Math.random() * pool.length), 1));
  }
  return out;
}

const dayAfter = (d: Date, days: number) => {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
};

/** "รอทำ" / "เสร็จแล้ว" / "เกินกำหนด", the words the screens use. */
const stateWord = (t: Task, now: Date) => {
  const s = visitStateOf(t, now);
  return s === "done" ? "เสร็จแล้ว" : s === "overdue" ? "เกินกำหนด" : "รอทำ";
};

/**
 * One visit, written for the model to read.
 *
 * WHAT LEAVES THE DEVICE: the given name without its honorific, the age, the
 * time, what the visit is for and whether it has been done. Deliberately NOT
 * the citizen ID, the HN or AN, the phone number or the address — a carer
 * asking what is left to do today does not need any of them in the answer,
 * so there is no reason to put them on a wire. The host is declared in
 * `aiHost`; it is the hospital's own cluster.
 */
const visitLine = (t: Task, now: Date) =>
  `- ${givenName(t.name)} (${genderOf(t.name) ?? "ไม่ระบุ"} ${t.age} ปี) ` +
  `${thaiFullDate(t.dueAt)} ${thaiTime(t.dueAt)} · ${t.detail} · ${stateWord(t, now)}`;

/**
 * How far apart two points on the ground are, in metres.
 *
 * Straight line, not road distance: the app has no routing service, and for
 * "who is nearest" the difference between the two does not change the
 * answer. Saying "1.2 กม." when the road is 1.6 would; so the wording that
 * uses this says "ห่างประมาณ".
 */
function metresBetween(
  a: { latitude: number; longitude: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371e3;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.latitude) * rad;
  const dLng = (b.lng - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.lat * rad) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const howFar = (m: number) =>
  m < 950 ? `${Math.round(m / 10) * 10} ม.` : `${(m / 1000).toFixed(1)} กม.`;

/** Visits that have a place on the map, nearest first. */
function byDistance(
  list: Task[],
  here: { latitude: number; longitude: number },
): { task: Task; metres: number }[] {
  return list
    .filter(hasLocation)
    .map((task) => ({
      task,
      metres: metresBetween(here, {
        lat: task.lat as number,
        lng: task.lng as number,
      }),
    }))
    .sort((a, b) => a.metres - b.metres);
}

/** Every visit the round holds, split the way a carer thinks about it. */
type Round = {
  today: Task[];
  week: Task[];
  overdue: Task[];
  doneLately: Task[];
};

function roundOf(now: Date): Round {
  const weekEnd = dayAfter(now, 7);
  const weekAgo = dayAfter(now, -7);
  return {
    today: byScheduleTime(yearTasks.filter((t) => isSameDay(t.dueAt, now))),
    week: byScheduleTime(
      yearTasks.filter((t) => t.dueAt >= startOfDay(now) && t.dueAt < weekEnd),
    ),
    overdue: byScheduleTime(
      yearTasks.filter((t) => visitStateOf(t, now) === "overdue"),
    ),
    doneLately: byScheduleTime(
      yearTasks.filter(
        (t) => isDone(t) && t.dueAt >= weekAgo && t.dueAt <= now,
      ),
    ),
  };
}

/**
 * Which patients the question is about, resolved here rather than by the
 * model.
 *
 * A model handed the whole year and asked "what about ป้าสมศรี" has to find
 * her itself, and when it cannot it answers about somebody else with a
 * similar name. Matching on the phone means the record that goes up is
 * either hers or nobody's, and "ไม่พบผู้ป่วยชื่อนี้" is then a fact rather
 * than a guess.
 */
function namedIn(question: string): Task[] {
  const q = question.toLowerCase();
  const seen = new Set<string>();
  const hits: Task[] = [];
  for (const t of yearTasks) {
    const given = givenName(t.name);
    // Given name, and each word of it: a carer types "สมศรี", not the whole
    // name as the record spells it.
    const parts = [given, ...given.split(/\s+/)].filter((p) => p.length >= 3);
    if (!parts.some((p) => q.includes(p.toLowerCase()))) continue;
    if (seen.has(given)) continue;
    seen.add(given);
    hits.push(t);
  }
  return hits;
}

/** The records behind the ids on an answer, in the order they were listed. */
export function visitsByIds(ids: string[]): Task[] {
  return ids
    .map((id) => yearTasks.find((t) => t.id === id))
    .filter((t): t is Task => t != null);
}

/** Every visit belonging to the people the question named. */
const allVisitsOfNamed = (named: Task[]) =>
  byScheduleTime(
    yearTasks.filter((t) =>
      named.some((n) => givenName(n.name) === givenName(t.name)),
    ),
  );

/**
 * The visits of a named patient that are worth putting in front of somebody.
 *
 * A patient on this round has twenty-odd visits across the year, and a
 * question about one of them — what they are allergic to, where they live —
 * answered with all twenty is a wall the carer has to scroll past to reach
 * the answer. The last two that happened and the next three that have not is
 * what "their appointments" means when it is asked out loud.
 */
function visitsOfNamed(named: Task[], now: Date = planToday): Task[] {
  const all = allVisitsOfNamed(named);
  const next = all.filter((t) => t.dueAt >= startOfDay(now));
  const past = all.filter((t) => t.dueAt < startOfDay(now));
  return [...past.slice(-2), ...next.slice(0, 3)];
}

/**
 * One patient's record, as the patient pages read it.
 *
 * This person's, not a stand-in's. Until the visits and the registry were
 * one population there was a single record behind every patient in the app,
 * and every answer about anybody described the same diabetic.
 *
 * Still no identifiers: the fields here are the ones a carer would ask about
 * before going — condition, allergies, what to watch for, and how the
 * readings are running — and the citizen ID, the HN, the phone number and
 * the address are left out of the digest exactly as they are left out of
 * every other thing this app sends.
 */
function recordLines(task: Task, now: Date): string[] {
  const d: PatientDetail = detailOf(task);
  const lines = [
    `โรคประจำตัว: ${d.condition}`,
    `สัญญาณชีพครั้งล่าสุดที่บันทึก: อุณหภูมิ ${d.temperatureC}, ออกซิเจน ${d.oxygenPercent}, ความดัน ${d.bloodPressure}, ชีพจร ${d.pulseBpm}`,
    `น้ำหนัก ${d.weightKg} กก. ส่วนสูง ${d.heightCm} ซม. BMI ${bmiOf(d).toFixed(1)} (${bmiLabel(d)})`,
    `ADL: ${d.adl}`,
    `ประวัติการแพ้ยา: ${d.allergies}`,
    `อุปกรณ์ทางการแพทย์: ${d.equipment}`,
    `ข้อควรระวังพิเศษ: ${d.precautions}`,
    `ผู้ดูแลหลัก: ${d.caregiverRelation} (${d.caregiverReadiness})`,
  ];

  // The readings themselves, which only exist now that a visit knows which
  // person it is for. Every value carries its own verdict, worked out by the
  // same table the charts shade themselves from — so the model is never the
  // one deciding whether a number is high.
  const who = residentById(task.residentId);
  if (who != null) {
    const latest = latestVitals(who, now);
    const said = (Object.keys(latest) as MetricKind[])
      .map((kind) => {
        const r = latest[kind];
        if (r == null) return "";
        const m = metricOf(kind);
        const v = statusOf(kind, r.value, r.value2);
        return `${m.name} ${formatReading(m, r)} ${m.unit} (${v.label})`;
      })
      .filter((line) => line !== "");
    if (said.length > 0) lines.push(`ค่าที่วัดได้ล่าสุด: ${said.join(", ")}`);

    const off = abnormalNow(who, now);
    lines.push(
      off.length === 0
        ? "ค่าที่วัดได้ตอนนี้อยู่ในเกณฑ์ปกติทั้งหมด"
        : `ค่าที่ผิดปกติตอนนี้: ${off.map((a) => `${a.metric.name} ${a.label}`).join(", ")}`,
    );
    lines.push(
      `ผลคัดกรอง: ${who.screenings.map((sc) => `${sc.name} ${sc.status === "atRisk" ? "เสี่ยง" : sc.status === "normal" ? "ปกติ" : "ยังไม่ประเมิน"}`).join(", ")}`,
    );
  }
  return lines;
}

/**
 * Where the visits are, relative to where the carer is standing.
 *
 * WHAT LEAVES THE DEVICE: the address of a visit on the carer's own round,
 * and how far it is from them. The carer's own coordinates do NOT — the
 * distance is worked out here and only the answer goes up, so the cluster is
 * told "1.2 km from the carer" and never where the carer is.
 */
function placeLines(list: Task[], now: Date): string[] {
  const { here, live } = currentHere();
  const near = byDistance(list, here);
  if (near.length === 0) return ["ไม่มีนัดที่ระบุตำแหน่งไว้"];
  /*
    The heading has to read as data, not as a disclaimer.

    It used to open the fallback case with "we do not have the nurse's real
    position", and the model — correctly reading it as a caveat about the
    whole block — answered that the system had no location data at all,
    while a full list of addresses and distances sat underneath it. The
    caveat is now a suffix on the line it qualifies.
  */
  return [
    `มีข้อมูลระยะทางครบ ${near.length} รายการ เรียงจากใกล้ไปไกล (ระยะเส้นตรงโดยประมาณ` +
      `${live ? " จากตำแหน่งปัจจุบันของพยาบาล" : " จากจุดกึ่งกลางพื้นที่รับผิดชอบ"})`,
    ...near.map(
      ({ task, metres }) =>
        `- ${givenName(task.name)} ห่างประมาณ ${howFar(metres)} · ` +
        `${thaiFullDate(task.dueAt)} ${thaiTime(task.dueAt)} · ${task.address ?? "ไม่ระบุที่อยู่"} · ${stateWord(task, now)}`,
    ),
  ];
}

/** Whose readings are out of band today, across the whole round. */
function healthLines(list: Task[], now: Date): string[] {
  const out: string[] = [];
  for (const task of list) {
    const who = residentById(task.residentId);
    if (who == null) continue;
    const off = abnormalNow(who, now);
    if (off.length === 0) continue;
    out.push(
      `- ${givenName(task.name)}: ${off.map((a) => `${a.metric.name} ${a.label}`).join(", ")}`,
    );
  }
  return out.length === 0
    ? ["ค่าที่วัดได้ของทุกคนในรอบนี้อยู่ในเกณฑ์ปกติ"]
    : out;
}

/** Everything the assistant is allowed to answer from, as one block of text. */
export function facts(question: string, now: Date): string {
  const r = roundOf(now);
  const named = namedIn(question);
  const lines: string[] = [
    `วันนี้คือ ${thaiFullDate(now)}`,
    "",
    `งานวันนี้ ${r.today.length} รายการ ` +
      `(เสร็จแล้ว ${r.today.filter(isDone).length}, ` +
      `รอทำ ${r.today.filter((t) => !isDone(t)).length})`,
    ...(r.today.length > 0
      ? r.today.map((t) => visitLine(t, now))
      : ["- ไม่มีงานวันนี้"]),
    "",
    `งานในเจ็ดวันข้างหน้า ${r.week.length} รายการ`,
    ...(r.week.length > 0 ? r.week.map((t) => visitLine(t, now)) : ["- ไม่มี"]),
    "",
    `งานเกินกำหนด ${r.overdue.length} รายการ`,
    ...(r.overdue.length > 0
      ? r.overdue.map((t) => visitLine(t, now))
      : ["- ไม่มี"]),
    "",
    `งานที่ทำเสร็จในเจ็ดวันที่ผ่านมา ${r.doneLately.length} รายการ`,
    ...(r.doneLately.length > 0
      ? r.doneLately.map((t) => visitLine(t, now))
      : ["- ไม่มี"]),
  ];

  const q = question.toLowerCase();
  const round = r.today.length > 0 ? r.today : r.week;

  if (
    /ใกล้|ไกล|ระยะ|ที่อยู่|บ้านอยู่|ตำแหน่ง|เส้นทาง|ไปไหน|แวะ|ไปก่อน|ลำดับ/.test(
      q,
    )
  ) {
    lines.push("", "ตำแหน่งของนัดในรอบนี้:", ...placeLines(round, now));
  }

  if (
    /ผิดปกติ|ค่าไหน|ความดัน|น้ำตาล|ออกซิเจน|ชีพจร|อุณหภูมิ|สุขภาพ|อาการ|น่าห่วง|เร่งด่วน/.test(
      q,
    )
  ) {
    lines.push(
      "",
      "สุขภาพของคนในรอบนี้ ค่าที่หลุดเกณฑ์:",
      ...healthLines(round, now),
    );
  }

  if (named.length > 0) {
    const all = visitsOfNamed(named, now);
    const everything = allVisitsOfNamed(named);
    const first = named[0];
    const place = first.address == null ? [] : [`ที่อยู่: ${first.address}`];
    lines.push(
      "",
      `ผู้ป่วยที่ถูกถามถึง: ${named.map((t) => givenName(t.name)).join(", ")}`,
      ...place,
      ...(hasLocation(first)
        ? [
            `ห่างจากพยาบาลประมาณ ${howFar(
              metresBetween(currentHere().here, {
                lat: first.lat as number,
                lng: first.lng as number,
              }),
            )}`,
          ]
        : []),
      `นัดทั้งหมดของผู้ป่วยรายนี้ในปีนี้ ${everything.length} ครั้ง` +
        ` (เสร็จแล้ว ${everything.filter(isDone).length})`,
      `นัดที่ใกล้ที่สุด ${all.length} ครั้ง:`,
      ...all.map((t) => visitLine(t, now)),
      "",
      "ข้อมูลในเวชระเบียน:",
      ...(named[0] == null
        ? []
        : recordLines(named[0], now).map((l) => `  ${l}`)),
    );
  } else {
    lines.push("", "คำถามนี้ไม่ได้ระบุชื่อผู้ป่วยที่อยู่ในรายการงาน");
  }

  return lines.join("\n");
}

/**
 * The visits a question is asking after, or none.
 *
 * Only questions that are actually about the round get a list under the
 * answer: "จันทร์เพ็ญแพ้ยาอะไร" wants a sentence, not her diary. When this
 * finds nothing the answer is words alone, which is what a conversation
 * mostly is.
 */
/**
 * Whether the question asks for ONE of something.
 *
 * "ใครอยู่ใกล้ที่สุด" is answered by one person. Handing back the whole
 * round sorted by distance answers a question that was not asked and buries
 * the one that was — the nearest patient is then the first of three cards
 * rather than the answer.
 */
/** How many cards an answer may carry before it stops being an answer. */
const SHOWN_MAX = 6;

const ONE_OF =
  /ที่สุด|ใกล้สุด|ไกลสุด|ด่วนสุด|แรกสุด|คนแรก|อันแรก|ครั้งหน้า|ครั้งต่อไป|ถัดไป|ต่อไปคือ/;

export function visitsFor(question: string, now: Date = planToday): Task[] {
  const q = question.toLowerCase();
  const only = <T>(list: T[]) => (ONE_OF.test(q) ? list.slice(0, 1) : list);

  const named = namedIn(question);
  if (named.length > 0) {
    // Their diary, but only when the diary is what was asked about. "What is
    // she allergic to" is answered in a sentence; five appointment cards
    // under it are five things to scroll past to get back to the answer. One
    // card stays, as the way through to her.
    const diary =
      /นัด|เมื่อไหร่|วันไหน|กี่โมง|ตาราง|เยี่ยม|ครั้งหน้า|ครั้งต่อไป|ถัดไป/.test(
        q,
      );
    const theirs = visitsOfNamed(named, now);
    if (diary) return only(theirs);
    const next = theirs.find((t) => !isDone(t) && t.dueAt >= startOfDay(now));
    return next != null ? [next] : theirs.slice(-1);
  }

  const r = roundOf(now);
  const round = r.today.length > 0 ? r.today : r.week;

  // "Who is nearest" wants the same list in a different order, which is the
  // whole answer — so the cards come back sorted by distance rather than by
  // the clock.
  if (/ใกล้|ไกล|ระยะ|ตำแหน่ง|เส้นทาง|แวะ|ไปก่อน|ลำดับ/.test(q)) {
    return only(byDistance(round, currentHere().here).map((n) => n.task));
  }

  // "Who is not doing well" is a filter on the round, not a slice of the
  // calendar: only the people whose readings are actually out of band.
  if (/ผิดปกติ|น่าห่วง|เร่งด่วน|ค่าไหน|สุขภาพ|อาการ/.test(q)) {
    const unwell = round.filter((t) => {
      const who = residentById(t.residentId);
      return who != null && abnormalNow(who, now).length > 0;
    });
    if (unwell.length > 0) return only(unwell);
  }

  // The oldest first, and only a handful of them: a year's worth of overdue
  // work is fifty cards, which is a wall rather than an answer. The count in
  // the facts is the true one, so the sentence above still says fifty-one.
  if (/เกินกำหนด|เลยกำหนด|ตกค้าง/.test(q))
    return only(r.overdue.slice(0, SHOWN_MAX));
  if (/เสร็จ|ทำแล้ว|ทำไปแล้ว|เรียบร้อย/.test(q)) {
    return only(r.doneLately.slice(-SHOWN_MAX));
  }
  if (/สัปดาห์|อาทิตย์|เจ็ดวัน|7 วัน/.test(q)) return only(r.week);
  if (/ยังไม่|เหลือ|ค้าง|รอทำ/.test(q))
    return only(r.today.filter((t) => !isDone(t)));
  if (/วันนี้|งาน|นัด|เยี่ยม|ไปบ้าน|ตาราง/.test(q)) return only(r.today);
  return [];
}

/**
 * Whether an answer should carry the round's own scoreboard.
 *
 * Only for questions about the round as a whole. One person's diary summed
 * into four figures says nothing — three of them would be zero — so a named
 * patient gets the list alone.
 */
export function widgetFor(
  question: string,
  now: Date = planToday,
): ChatTurn["widget"] {
  const q = question.toLowerCase();
  if (namedIn(question).length > 0) return undefined;
  // Asked for one thing, shown one thing: a scoreboard over a single card
  // is three figures about a question nobody put.
  if (ONE_OF.test(q)) return undefined;
  // And only where the question is about the shape of the round. "Who is
  // nearest" and "whose readings are off" are answered by which cards come
  // back, not by how many of them there are.
  const overview =
    /สรุป|ภาพรวม|กี่|ทั้งหมด|เหลือ|ค้าง|เสร็จ|เกินกำหนด|วันนี้มีงาน|ตาราง|สัปดาห์/.test(
      q,
    );
  if (!overview) return undefined;
  return visitsFor(question, now).length > 0 ? "counts" : undefined;
}

/**
 * The answer written on the phone, from the same facts.
 *
 * Not a fallback bolted on afterwards but the floor the whole thing stands
 * on: this is what the carer gets in a house with no signal, which is where
 * a home-visit app spends a good deal of its time. It reads the question for
 * the handful of things carers actually ask and lays the matching list out.
 */
function localAnswer(question: string, now: Date): string {
  const q = question.toLowerCase();
  const r = roundOf(now);
  const named = namedIn(question);
  const count = visitsFor(question, now).length;

  if (named.length > 0) {
    const who = named.map((t) => givenName(t.name)).join(", ");
    const all = allVisitsOfNamed(named);
    const next = all.find((t) => !isDone(t) && t.dueAt >= startOfDay(now));
    return count === 0
      ? `ไม่พบนัดของ ${who} ในระบบค่ะ`
      : `${who} มีนัดทั้งหมด ${all.length} ครั้งค่ะ` +
          (next == null
            ? " ตอนนี้ไม่มีนัดที่ค้างอยู่"
            : ` นัดถัดไป ${thaiFullDate(next.dueAt)} ${thaiTime(next.dueAt)}`) +
          (named[0] == null
            ? ""
            : ` · ${recordLines(named[0], now).slice(0, 1).join("")}`);
  }

  if (/เกินกำหนด|เลยกำหนด|ค้างนาน|ตกค้าง/.test(q)) {
    return count === 0
      ? "ไม่มีงานเกินกำหนดค่ะ"
      : `มีงานเกินกำหนดอยู่ ${count} รายการค่ะ`;
  }
  if (/เสร็จ|ทำแล้ว|ทำไปแล้ว|เรียบร้อย/.test(q)) {
    return count === 0
      ? "เจ็ดวันที่ผ่านมายังไม่มีงานที่ทำเสร็จค่ะ"
      : `เจ็ดวันที่ผ่านมาทำเสร็จไปแล้ว ${count} รายการค่ะ`;
  }
  if (/สัปดาห์|อาทิตย์|เจ็ดวัน|7 วัน/.test(q)) {
    return count === 0
      ? "เจ็ดวันข้างหน้ายังไม่มีงานค่ะ"
      : `เจ็ดวันข้างหน้ามี ${count} รายการค่ะ`;
  }
  if (/ยังไม่|เหลือ|ค้าง|ต้องทำ|รอทำ/.test(q)) {
    return count === 0
      ? "วันนี้ทำครบแล้วค่ะ"
      : `วันนี้ยังเหลืออยู่ ${count} รายการค่ะ`;
  }

  const left = r.today.filter((t) => !isDone(t)).length;
  if (r.today.length === 0) return "วันนี้ไม่มีงานค่ะ";
  return (
    `วันนี้มีงาน ${r.today.length} รายการ ` +
    `เสร็จแล้ว ${r.today.filter(isDone).length} เหลืออีก ${left} ค่ะ` +
    (r.overdue.length > 0
      ? ` และมีงานเกินกำหนดค้างอยู่ ${r.overdue.length} รายการ`
      : "")
  );
}

/**
 * How the assistant talks.
 *
 * It is a colleague answering across a desk, not a report being printed: the
 * carer asked in their own words and the reply should sound like one. What
 * it must never do is invent, so the facts it is handed are the whole of
 * what it may say.
 *
 * The listing rule is the important one. When the question is about the
 * round, the app draws the visits itself as cards the carer can open — so a
 * model that also writes the list out produces the same seven lines twice,
 * once as dead text. It is told to say what the list amounts to and stop.
 */
const SYSTEM = [
  "คุณเป็นผู้ช่วยของพยาบาลเยี่ยมบ้าน ตอบเป็นภาษาไทยด้วยน้ำเสียงสุภาพเป็นกันเอง เหมือนเพื่อนร่วมงานที่คุยกัน",
  "ตอบจากข้อมูลที่ให้มาเท่านั้น ห้ามเดา ห้ามเพิ่มชื่อ วันที่ ตัวเลข หรืออาการที่ไม่มีในข้อมูล",
  "ถ้าข้อมูลที่ให้มาไม่มีคำตอบ ให้บอกตรงๆ ว่าไม่มีข้อมูลในระบบ",
  "ตอบเป็นประโยคพูดคุย 1-3 ประโยค ไม่ต้องยาว",
  "ห้ามไล่รายการเป็นบรรทัดๆ ห้ามขึ้นต้นบรรทัดด้วย - หรือตัวเลขลำดับ",
  "ถ้าคำถามเกี่ยวกับรายการงานหรือนัด ให้สรุปเป็นคำพูดว่ามีกี่รายการและมีอะไรที่ต้องสังเกต แล้วบอกว่าดูรายการด้านล่างได้",
  "ตอบเฉพาะสิ่งที่ถูกถาม ถ้าถามหาคนเดียวให้พูดถึงคนเดียว อย่าไล่คนอื่นที่ไม่ได้ถูกถามถึง",
  "ถ้าถามเรื่องตำแหน่งหรือระยะทาง ให้ตอบจากบรรทัดระยะทางที่ให้มา และบอกว่าเป็นระยะเส้นตรงโดยประมาณ",
  "ถ้าในข้อมูลมีบรรทัดระยะทางหรือที่อยู่ ถือว่ามีข้อมูลตำแหน่งแล้ว ห้ามตอบว่าไม่มีข้อมูลตำแหน่ง",
  "ถ้าถามเรื่องค่าสุขภาพ ให้บอกค่าที่วัดได้และคำตัดสินที่ให้มาเท่านั้น",
  "ห้ามวินิจฉัยโรค ห้ามแนะนำยาหรือขนาดยา ห้ามบอกให้ปรับยาเอง ถ้าถูกถามให้บอกว่าต้องปรึกษาแพทย์ผู้รักษา",
  "ห้ามเปิดหัวด้วยคำว่า 'แน่นอน' หรือ 'ได้เลย' ให้เข้าเรื่องทันที",
].join("\n");

/**
 * Ask the assistant, with the conversation so far for context.
 *
 * `history` is trimmed to the last few turns: the facts block is rebuilt on
 * every question and is the bulk of the prompt, so carrying a long tail of
 * conversation buys little and costs the context it is carried in.
 */
export async function askAssistant(
  question: string,
  history: ChatTurn[],
  photos: Attachment[] = [],
  now: Date = planToday,
): Promise<string> {
  const recent = history
    .slice(-4)
    .map((t) => ({ role: t.role, content: t.text }));
  const listed = visitsFor(question, now).length;
  const asked = [
    `ข้อมูลในระบบ ณ ตอนนี้:\n${facts(question, now)}`,
    listed === 0
      ? ""
      : `หมายเหตุ: แอปจะแสดงรายการ ${listed} รายการเป็นการ์ดที่กดเปิดได้ใต้คำตอบของคุณอยู่แล้ว ห้ามพิมพ์รายการซ้ำ`,
    `คำถาม: ${question}`,
  ]
    .filter((line) => line !== "")
    .join("\n\n");

  /*
    A question with pictures is sent as parts rather than as a string.

    The model on the cluster reads images, and the picture is what the
    question is usually about — a wound, a strip of tablets, a reading on a
    meter the carer cannot interpret. More than one because the answer often
    needs them together: the same wound last week and today, or both sides
    of a box of tablets. The text part still carries the round, so "is this
    the one I am seeing at ten?" has both halves to work from.
  */
  const content =
    photos.length === 0
      ? asked
      : [
          { type: "text", text: asked },
          ...photos.map((p) => ({
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${p.base64}` },
          })),
        ];

  const reply = await askModel(
    [{ role: "system", content: SYSTEM }, ...recent, { role: "user", content }],
    // Pictures are worth a longer answer and a longer wait: each one is a
    // few hundred tokens before the model has read a word of the round.
    {
      maxTokens: 500,
      timeoutMs: photos.length === 0 ? 25_000 : 45_000 + photos.length * 15_000,
    },
  );
  const text = reply?.trim();
  if (text != null && text !== "") return text;
  // Nothing on the phone can read a photograph, so say so rather than
  // answering the words and quietly ignoring the pictures.
  return photos.length === 0
    ? localAnswer(question, now)
    : "ตอนนี้ติดต่อผู้ช่วยไม่ได้ จึงยังอ่านรูปให้ไม่ได้ ลองใหม่เมื่อมีสัญญาณ";
}
