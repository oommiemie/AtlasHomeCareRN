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
import { modelTurn, type ToolCall } from "./aiHost";
import type { Focus } from "./assistantFocus";
import {
  TOOLS,
  prefetchFor,
  runTool,
  type AssistantAction,
  type ToolEffects,
} from "./assistantTools";
import { planToday } from "./clock";
import { everyResident, residentById, type Resident } from "./household";
import { followUpPatients } from "./followUp";
import { bmiLabel, bmiOf, detailFor, detailOf, type PatientDetail } from "./patientDetail";
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
import { isEn, tr } from "../i18n";

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
  widget?: "counts" | "route" | "health" | "healthList" | "tour";
  /**
   * The person a health answer is about, by resident id — the card of their
   * latest readings is drawn from it, not from anything the model wrote.
   */
  resident?: string;
  /** The people a "who is unwell" answer lists, worst first, by resident id. */
  residents?: string[];
  /** The reading a "who is unwell" answer was narrowed to, if any. */
  metric?: MetricKind;
  /**
   * What the answer offers to do — open her page, call, drive there, start
   * the visit — as buttons under it. Offered by the model, done only when
   * the carer presses one (see `offer_action` in assistantTools).
   */
  actions?: AssistantAction[];
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
export const OPENERS: readonly string[] = tr(
  [
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
    "เช้านี้ควรเริ่มจากใครก่อน",
    "ใครในกลุ่มติดตามที่ต้องดูด่วน",
    "สองสัปดาห์นี้มีคลินิกวัคซีนที่ไหนบ้าง",
    "ใครความดันสูงบ้าง โทรหาคนที่น่าห่วงที่สุดให้หน่อย",
    "สรุปส่งเวรวันนี้ให้หน่อย",
    "วันนี้มีของต้องไปส่งใครบ้าง",
  ],
  // Each worded so the English patterns below read it the way the Thai
  // one is read — the same card comes back under it in either language.
  [
    "What tasks do I have today?",
    "Which tasks are still left to do?",
    "Is anything overdue?",
    "Whose houses do I visit this week?",
    "Who is nearest to me?",
    "Sort today's tasks by distance",
    "Who has abnormal readings today?",
    "Who is the most worrying?",
    "How many have I completed today?",
    "Summarize today's tasks",
    "Which house is the farthest?",
    "How many appointments in the next 7 days?",
    "Who should I start with this morning?",
    "Who in the follow-up group needs attention?",
    "Which vaccine clinics are in the next two weeks?",
    "Who has high blood pressure? Call the most worrying one.",
    "Give me today's handover summary",
    "Who do I have supplies to deliver to today?",
  ],
);

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
/**
 * How well a question names somebody: the whole name 3, the first name 2,
 * the surname alone 1, not at all 0.
 *
 * Ranked, because a surname is shared: "สมชาย ก้องเกียรติ" also contains
 * บุญมี ก้องเกียรติ's surname, and taking whoever came first in the list
 * answered about the wrong man.
 */
function nameScore(q: string, name: string): number {
  // Compared folded — no tone marks, no spaces — because a question that
  // was spoken comes back from recognition as "มา นพ ยิงเจริญ" as often as
  // "มานพ ยิ่งเจริญ".
  const fq = foldThai(q);
  const given = givenName(name).toLowerCase();
  if (given.length >= 3 && fq.includes(foldThai(given))) return 3;
  const [first, ...rest] = given.split(/\s+/);
  if (first != null && first.length >= 3 && fq.includes(foldThai(first))) return 2;
  return rest.some((p) => p.length >= 3 && fq.includes(foldThai(p))) ? 1 : 0;
}

/**
 * Thai for comparing, not for showing: lower case, without tone marks,
 * the silent-letter mark or spaces. What speech recognition most often
 * gets wrong in a name is exactly those.
 */
export function foldThai(s: string): string {
  return s.toLowerCase().replace(/[\u0E47-\u0E4E\s]/g, "");
}

/** Keep the best-named only: a surname match yields to a first-name one. */
function bestNamed<T>(scored: { item: T; score: number }[]): T[] {
  const top = Math.max(0, ...scored.map((x) => x.score));
  return top === 0
    ? []
    : scored
        .filter((x) => x.score === top || (top < 2 && x.score > 0))
        .map((x) => x.item);
}

function namedIn(question: string): Task[] {
  const q = question.toLowerCase();
  const seen = new Set<string>();
  const scored: { item: Task; score: number }[] = [];
  for (const t of yearTasks) {
    // Given name, and each word of it: a carer types "สมศรี", not the whole
    // name as the record spells it.
    const score = nameScore(q, t.name);
    if (score === 0) continue;
    // One entry per person, not per name: two women called ศิริพร
    // ศรีสมบัติ live in the same house, and folding them into one by name
    // answered about whichever came first.
    if (seen.has(t.residentId)) continue;
    seen.add(t.residentId);
    scored.push({ item: t, score });
  }
  return bestNamed(scored);
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
    /ใกล้|ไกล|ระยะ|ที่อยู่|บ้านอยู่|ตำแหน่ง|เส้นทาง|ไปไหน|แวะ|ไปก่อน|ลำดับ|\b(near|close|closest|far|farthest|furthest|distance|address|where|location|route|directions?|order|stops?)\b/.test(
      q,
    )
  ) {
    lines.push("", "ตำแหน่งของนัดในรอบนี้:", ...placeLines(round, now));
  }

  if (
    /ผิดปกติ|ค่าไหน|ความดัน|น้ำตาล|ออกซิเจน|ชีพจร|อุณหภูมิ|สุขภาพ|อาการ|น่าห่วง|เร่งด่วน|abnormal|reading|blood pressure|\bbp\b|sugar|glucose|oxygen|spo2|pulse|temperature|fever|health|symptom|worr|urgent|vital|unwell/.test(
      q,
    )
  ) {
    lines.push(
      "",
      // Only what is off is listed; somebody missing from it has readings
      // too, all in range — and was being reported as having none.
      "สุขภาพของคนในรอบนี้ ค่าที่หลุดเกณฑ์ (ค่าที่อยู่ในเกณฑ์ไม่ได้แสดงในรายการนี้ ถ้าคนที่ถูกถามไม่อยู่ในรายการ ไม่ได้แปลว่าไม่มีข้อมูล ให้เรียก patient_record หรือ vital_trend):",
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
      `ผู้ป่วยที่ถูกถามถึง: ${named.map((t) => `${givenName(t.name)} (รหัส ${t.residentId})`).join(", ")}`,
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
  /ที่สุด|ใกล้สุด|ไกลสุด|ด่วนสุด|แรกสุด|คนแรก|อันแรก|ครั้งหน้า|ครั้งต่อไป|ถัดไป|ต่อไปคือ|\b(nearest|closest|farthest|furthest|most|worst|shortest|who'?s next|what'?s next)\b|\b(next|first) (one|visit|appointment|stop|house|patient)\b/i;

/**
 * A question about how to get somewhere — answered with the way there on a
 * map, not a sentence about roads.
 */
export const ROUTE =
  /เส้นทาง|นำทาง|ทางไป|ไปยังไง|ไปทางไหน|ไปอย่างไร|บอกทาง|แผนที่|ขับไป|ไปถึง|\b(route|directions?|navigate|navigation|maps?|way to|get there|drive (to|there)|take me)\b|how (do|can|should) i get|how to get/i;

/**
 * The one visit a route question is about: the named patient's next visit,
 * the nearest where nearness is asked, and otherwise the next visit still
 * to be made — the house the carer is about to drive to.
 */
function routeTarget(question: string, now: Date): Task | undefined {
  const q = question.toLowerCase();
  const named = namedIn(question);
  const r = roundOf(now);
  const pending = (list: Task[]) =>
    list.filter((t) => !isDone(t) && hasLocation(t));
  if (named.length > 0) {
    const theirs = visitsOfNamed(named, now).filter(hasLocation);
    return (
      theirs.find((t) => !isDone(t) && t.dueAt >= startOfDay(now)) ??
      theirs[theirs.length - 1]
    );
  }
  const round =
    pending(r.today).length > 0 ? pending(r.today) : pending(r.week);
  if (/ใกล้|\b(near|clos)/.test(q))
    return byDistance(round, currentHere().here)[0]?.task;
  if (/ไกล|\bfar/.test(q)) {
    const far = byDistance(round, currentHere().here);
    return far[far.length - 1]?.task;
  }
  return [...round].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())[0];
}

/** A question about somebody's readings or how they are. */
export const HEALTH =
  /สุขภาพ|น่าห่วง|ผิดปกติ|เร่งด่วน|หลุดเกณฑ์|ความดัน|น้ำตาล|ชีพจร|หัวใจ|ออกซิเจน|อุณหภูมิ|ไข้|bmi|น้ำหนัก|ส่วนสูง|สัญญาณชีพ|ค่า|อาการ|vital|รอบเอว|cgm|เป็นยังไง|เป็นอย่างไร|\b(health|healthy|worr(y|ied|ying|isome)|abnormal|urgent|out of range|blood pressure|bp|sugar|glucose|pulse|heart|oxygen|spo2|temperature|temp|fever|weight|height|readings?|waist|symptoms?|unwell|sick)\b|how('?s| is| are)\b.*\b(doing|feeling)/i;

/**
 * Whose readings a question asks about — a named patient and a question
 * about their health — for the answer to carry the card of their latest
 * figures. None for anything else.
 */
export function healthResidentFor(question: string): string | undefined {
  if (!HEALTH.test(question)) return undefined;
  const onPlan = namedIn(question)[0]?.residentId;
  if (onPlan != null) return onPlan;
  // Anybody on the register, not only the people on the plan: a carer asks
  // after a grandmother in a house they look after as readily as after a
  // patient they are visiting.
  const q = question.toLowerCase();
  const hit = everyResident.find((r) => {
    const given = givenName(r.name);
    const parts = [given, ...given.split(/\s+/)].filter((p) => p.length >= 3);
    return parts.some((p) => q.includes(p.toLowerCase()));
  });
  return hit?.id;
}

/** Which reading a question names, where it names one. */
const METRIC_WORDS: [RegExp, MetricKind][] = [
  [/ความดัน|blood pressure|\bbp\b/i, "bp"],
  [/น้ำตาล|เบาหวาน|sugar|glucose|diabet/i, "glucose"],
  [/cgm/i, "cgm"],
  [/ออกซิเจน|spo2|oxygen|\bo2\b/i, "spo2"],
  [/ชีพจร|หัวใจเต้น|pulse|heart ?rate/i, "pulse"],
  [/ไข้|อุณหภูมิ|fever|temperature|\btemp\b/i, "temp"],
  [/รอบเอว|ลงพุง|waist|belly/i, "waist"],
];
export const metricIn = (question: string): MetricKind | undefined =>
  METRIC_WORDS.find(([re]) => re.test(question))?.[1];

/**
 * Who is unwell, for a question about the round's health rather than one
 * person's: the people with a reading out of band, worst first — today's
 * round first, and the follow-up register where the round has nobody —
 * narrowed to the one reading asked about where one is named.
 */
export function unwellFor(
  question: string,
  now: Date = planToday,
): { residents: string[]; metric?: MetricKind } | undefined {
  if (!HEALTH.test(question)) return undefined;
  if (healthResidentFor(question) != null) return undefined;
  const metric = metricIn(question);
  const worst = (ids: string[]) =>
    ids
      .map((id) => residentById(id))
      .filter((r): r is Resident => r != null)
      .map((r) => ({
        r,
        off: abnormalNow(r, now).filter(
          (a) => metric == null || a.metric.kind === metric,
        ),
      }))
      .filter((x) => x.off.length > 0)
      .sort(
        (a, b) =>
          Number(b.off[0].tone === "alert") -
            Number(a.off[0].tone === "alert") || b.off.length - a.off.length,
      )
      .map((x) => x.r.id);
  const round = roundOf(now);
  const unique = (ids: string[]) => [...new Set(ids)];
  let ids = worst(unique(round.today.map((t) => t.residentId)));
  if (ids.length === 0)
    ids = worst(unique(round.week.map((t) => t.residentId)));
  if (ids.length === 0) ids = worst(followUpPatients.map((p) => p.resident.id));
  return { residents: ids.slice(0, SHOWN_MAX), metric };
}

/*
  The slices of the round a question can ask for, shared by the cards and
  the answer written on the phone so the two always pick the same one. In
  English "done" also turns up inside "not done yet", which asks the
  opposite — so DONE declines a question that negates it.
*/
const OVERDUE =
  /เกินกำหนด|เลยกำหนด|ตกค้าง|\b(overdue|late|missed|past due|behind)\b/;
const DONE =
  /เสร็จ|ทำแล้ว|ทำไปแล้ว|เรียบร้อย|^(?!.*(\bnot|n't|\byet to be|\bstill to be)( \w+)? (done|completed|finished)).*\b(done|completed?|finished)\b/;
const WEEK = /สัปดาห์|อาทิตย์|เจ็ดวัน|7 วัน|\bweek\b|\b(7|seven) days\b/;
const LEFT =
  /ยังไม่|เหลือ|ค้าง|รอทำ|\b(left|remaining|not (yet )?(done|completed|finished)|pending|to do|outstanding|still)\b|n't (been )?(done|completed|finished)/;

export function visitsFor(question: string, now: Date = planToday): Task[] {
  const q = question.toLowerCase();
  const only = <T>(list: T[]) => (ONE_OF.test(q) ? list.slice(0, 1) : list);

  // The way to one house: that visit alone, which the map is drawn to.
  if (ROUTE.test(q)) {
    const t = routeTarget(question, now);
    return t != null ? [t] : [];
  }

  const named = namedIn(question);
  if (named.length > 0) {
    // Their diary, but only when the diary is what was asked about. "What is
    // she allergic to" is answered in a sentence; five appointment cards
    // under it are five things to scroll past to get back to the answer. One
    // card stays, as the way through to her.
    const diary =
      /นัด|เมื่อไหร่|วันไหน|กี่โมง|ตาราง|เยี่ยม|ครั้งหน้า|ครั้งต่อไป|ถัดไป|\b(appointments?|visits?|when|which day|what time|schedule|next)\b/.test(
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
  if (
    /ใกล้|ไกล|ระยะ|ตำแหน่ง|เส้นทาง|แวะ|ไปก่อน|ลำดับ|\b(near|nearest|close|closest|far|farthest|furthest|distance|location|order|stops?)\b/.test(
      q,
    )
  ) {
    // Nearest first — or farthest first, where that is what was asked.
    const sorted = byDistance(round, currentHere().here).map((n) => n.task);
    return only(/ไกล|\bfar/.test(q) ? sorted.reverse() : sorted);
  }

  // "Who is not doing well" is a filter on the round, not a slice of the
  // calendar: only the people whose readings are actually out of band.
  if (
    /ผิดปกติ|น่าห่วง|เร่งด่วน|ค่าไหน|สุขภาพ|อาการ|abnormal|worr|urgent|health|symptom|unwell|out of range/.test(
      q,
    )
  ) {
    const unwell = round.filter((t) => {
      const who = residentById(t.residentId);
      return who != null && abnormalNow(who, now).length > 0;
    });
    if (unwell.length > 0) return only(unwell);
  }

  // The oldest first, and only a handful of them: a year's worth of overdue
  // work is fifty cards, which is a wall rather than an answer. The count in
  // the facts is the true one, so the sentence above still says fifty-one.
  if (OVERDUE.test(q)) return only(r.overdue.slice(0, SHOWN_MAX));
  if (DONE.test(q)) {
    return only(r.doneLately.slice(-SHOWN_MAX));
  }
  if (WEEK.test(q)) return only(r.week);
  // "Who is next" is the first visit still to make — not the first of the
  // day, which by the afternoon is long done.
  if (/ถัดไป|ต่อไป|\bnext\b/.test(q)) {
    const ahead = [...r.today, ...r.week]
      .filter((t) => !isDone(t))
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
    return ahead.slice(0, 1);
  }
  if (LEFT.test(q)) return only(r.today.filter((t) => !isDone(t)));
  if (
    /วันนี้|งาน|นัด|เยี่ยม|ไปบ้าน|ตาราง|\b(today|tasks?|work|appointments?|visits?|schedule)\b/.test(
      q,
    )
  )
    return only(r.today);
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
  // Asked the way: the route, on a map, to the one visit it is about.
  if (ROUTE.test(q))
    return visitsFor(question, now).length > 0 ? "route" : undefined;
  // Asked how somebody is: their readings, as figures and trends.
  if (healthResidentFor(question) != null) return "health";
  // Asked who is unwell: the people, and which of their readings are off.
  if (
    /ใคร|ผิดปกติ|น่าห่วง|ค่าไหน|คนไหน|รายไหน|\b(who|which (patients?|people|persons?|ones?))\b|abnormal|worr/.test(
      q,
    ) &&
    unwellFor(question, now) != null
  )
    return "healthList";
  if (namedIn(question).length > 0) return undefined;
  // Asked for one thing, shown one thing: a scoreboard over a single card
  // is three figures about a question nobody put.
  if (ONE_OF.test(q)) return undefined;
  // And only where the question is about the shape of the round. "Who is
  // nearest" and "whose readings are off" are answered by which cards come
  // back, not by how many of them there are.
  const overview =
    /สรุป|ภาพรวม|กี่|ทั้งหมด|เหลือ|ค้าง|เสร็จ|เกินกำหนด|วันนี้มีงาน|ตาราง|สัปดาห์|summar|overview|how many|\b(total|left|remaining|done|completed|overdue|schedule|week|tasks)\b/.test(
      q,
    );
  if (!overview) return undefined;
  return visitsFor(question, now).length > 0 ? "counts" : undefined;
}

/**
 * Planning the round: which houses, in what order, and the way through them
 * — answered with the stops numbered on one map.
 */
export const TOUR =
  /วางแผน|แผนเส้นทาง|แผนการเดินทาง|จัดเส้นทาง|จัดลำดับ|ลำดับการเยี่ยม|เส้นทางวันนี้|เส้นทางเยี่ยม|ปักหมุด|หลายบ้าน|ทุกบ้าน|ไปบ้านใครบ้าง|ต้องไปไหนบ้าง|แวะ|\b(plan|planning|round|itinerary|all (the |my )?(stops|houses|visits)|every (house|stop)|order of (my )?visits|pin (them|the houses))\b|whose houses|which houses|where (do|should) i go/i;

/**
 * The stops of a round, in the order to drive them: the visits still to do
 * today (or the next day that has any), each with a place on the map — by
 * appointment time, or, where the shortest way is asked for, each next stop
 * the nearest of those left, starting from where the carer is.
 */
export function tourFor(
  question: string,
  now: Date = planToday,
  given?: Task[],
): Task[] {
  const r = roundOf(now);
  const left = (list: Task[]) =>
    list.filter((t) => !isDone(t) && hasLocation(t));
  let stops = given?.filter(hasLocation) ?? left(r.today);
  if (stops.length === 0 && given == null) {
    const firstDay = left(r.week)[0];
    stops =
      firstDay == null
        ? []
        : left(r.week).filter((t) => isSameDay(t.dueAt, firstDay.dueAt));
  }
  if (
    !/สั้น|ใกล้|ระยะ|ประหยัด|เร็วที่สุด|เร็วสุด|ไม่อ้อม|shortest|nearest|closest|efficient|fastest|quickest|distance|optimi[sz]/i.test(
      question,
    )
  ) {
    return [...stops].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  }
  const ordered: Task[] = [];
  let at = currentHere().here;
  const rest = [...stops];
  while (rest.length > 0) {
    let best = 0;
    let bestM = Infinity;
    rest.forEach((t, i) => {
      const m = metresBetween(at, {
        lat: t.lat as number,
        lng: t.lng as number,
      });
      if (m < bestM) {
        bestM = m;
        best = i;
      }
    });
    const next = rest.splice(best, 1)[0];
    ordered.push(next);
    at = { latitude: next.lat as number, longitude: next.lng as number };
  }
  return ordered;
}

/** Every one of the people just listed — "all three", "everyone". */
const ALL_OF =
  /ทั้ง\s*(หมด|สอง|สาม|สี่|ห้า|หก|\d+)|ทุกคน|ทุกบ้าน|ทุกจุด|ทุกราย|หลายคน|หลายจุด|รวมกัน|พร้อมกัน|\b(all (of them|two|three|four|five|six|\d+)|both( of them)?|everyone|everybody|all (the |these |those )?(houses|stops|patients|people|places)|every (one|house|stop)|together)\b/i;

/** The visits the last answer listed, as it listed them. */
function lastListed(history: ChatTurn[]): Task[] {
  for (let i = history.length - 1; i >= 0; i--) {
    const t = history[i];
    if (t.role === "assistant" && (t.visits?.length ?? 0) > 1) {
      return visitsByIds(t.visits ?? []);
    }
  }
  return [];
}

/** The visits the answer just before listed, where it listed several. */
function justListed(history: ChatTurn[]): Task[] {
  const last = [...history].reverse().find((t) => t.role === "assistant");
  return (last?.visits?.length ?? 0) > 1 ? visitsByIds(last?.visits ?? []) : [];
}

/** A question about visits themselves — when, which, how many. */
const VISITS_ASKED =
  /นัด|เยี่ยม|ภารกิจ|งาน|เมื่อไหร่|วันไหน|กี่โมง|ตาราง|ครั้งหน้า|ครั้งต่อไป|ถัดไป|รับงาน|\b(appointments?|visits?|visited|tasks?|when|which day|what time|schedule[ds]?|next)\b/i;

/** Asking about people in general, not about one. */
const WHO =
  /ใคร|คนไหน|รายไหน|ทุกคน|กี่คน|\b(who|whom|which (patients?|people|persons?|ones?)|everyone|everybody|how many (people|patients))\b/i;

/**
 * The person a question names, on the plan or on the register — the name
 * as a carer would type it, the given name or any word of it.
 */
function personIn(question: string): string | undefined {
  const c = candidatesIn(question);
  return c.length === 1 ? c[0].id : undefined;
}

/**
 * Everyone a question could mean, narrowed as a carer would narrow it.
 *
 * "คุณปุณณภา" is sixteen children on a school register. Taking the first
 * answered about one of them as if she had been named — confidently, and
 * about the wrong child. So: everyone the name fits best; of those, the one
 * on the carer's own round if exactly one is (that is who a carer means);
 * otherwise all of them, and the assistant asks which.
 */
export function candidatesIn(question: string): Resident[] {
  const q = question.toLowerCase();
  const best = bestNamed(
    everyResident.map((r) => ({ item: r, score: nameScore(q, r.name) })),
  );
  if (best.length <= 1) return best;
  const onRound = new Set(namedIn(question).map((t) => t.residentId));
  const mine = best.filter((r) => onRound.has(r.id));
  return mine.length === 1 ? mine : best;
}

/**
 * An English ordinal pointing into a list: "the second one", "the 2nd
 * patient", "the last house" — but not "the first visit tomorrow", which
 * asks after the calendar rather than the list on screen.
 */
const enOrdinal = (words: string) =>
  new RegExp(
    `\\b(${words}) (one|patient|person|house|stop)\\b|\\bthe (${words})\\b(?!\\s+(visit|appointment|task|day|week|time))`,
    "i",
  );

/** A position given as a number: "คนที่ 3", "#3", "number 3". */
const ORDINAL_DIGITS =
  /(คน|ราย|อัน)ที่\s*(\d+)|#\s*(\d+)|\b(?:number|no\.?)\s*(\d+)\b/i;

/** Thai and English ordinals as a carer says them, to a position in a list. */
const ORDINAL: [RegExp, (n: number) => number][] = [
  [/(คน|ราย|อัน|ข้อ)แรก/, () => 0],
  [/(คน|ราย|อัน)สุดท้าย/, (n) => n - 1],
  [ORDINAL_DIGITS, () => -1],
  [/(คน|ราย|อัน)ที่\s*สอง/, () => 1],
  [/(คน|ราย|อัน)ที่\s*สาม/, () => 2],
  [/(คน|ราย|อัน)ที่\s*สี่/, () => 3],
  [/(คน|ราย|อัน)ที่\s*ห้า/, () => 4],
  [enOrdinal("first|1st"), () => 0],
  [enOrdinal("last|final"), (n) => n - 1],
  [enOrdinal("second|2nd"), () => 1],
  [enOrdinal("third|3rd"), () => 2],
  [enOrdinal("fourth|4th"), () => 3],
  [enOrdinal("fifth|5th"), () => 4],
];

/**
 * The person a question points to in the last list the assistant gave —
 * "the first one", "the second", "the last" — by resident id. A carer
 * reading down a list of visits asks about the one they are looking at,
 * not by name.
 */
function ordinalIn(question: string, history: ChatTurn[]): string | undefined {
  const hit = ORDINAL.find(([re]) => re.test(question));
  if (hit == null) return undefined;
  for (let i = history.length - 1; i >= 0; i--) {
    const t = history[i];
    if (t.role !== "assistant") continue;
    const people =
      t.residents != null && t.residents.length > 0
        ? t.residents
        : visitsByIds(t.visits ?? []).map((v) => v.residentId);
    if (people.length === 0) continue;
    const digits = question.match(ORDINAL_DIGITS);
    const at =
      digits != null
        ? Number(digits[2] ?? digits[3] ?? digits[4]) - 1
        : hit[1](people.length);
    return people[at];
  }
  return undefined;
}

/**
 * Questions about the round or about people in general — answered for
 * everybody, whoever the conversation is about.
 */
const GENERAL =
  /ใคร|คนไหน|รายไหน|ทุกคน|กี่คน|ทั้งหมด|วันนี้มีงาน|งานวันนี้|สรุปงาน|สัปดาห์|เกินกำหนด|ใกล้ฉัน|ใกล้ที่สุด|ไกลที่สุด|ไกลสุด|ใกล้สุด|บ้านไหน|\b(who|which (patients?|people|persons?|houses?|ones?)|everyone|everybody|how many|in total|all of them|today'?s (tasks|work|visits)|tasks today|summar(y|i[sz]e)|this week|overdue|nearest|closest|farthest|furthest|near me)\b/i;

/**
 * Who the conversation is about: the last person named, by the carer or in
 * an answer about one person. It holds until somebody else is named —
 * "and her blood pressure?", "and when is her next visit?", "how do I get
 * there?" all go on being about the person the carer brought up, so she is
 * named once, not in every question. Answers about everybody in between do
 * not change it.
 */
function subjectOf(history: ChatTurn[]): string | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    const t = history[i];
    if (t.role === "user") {
      const named = personIn(t.text);
      if (named != null) return named;
    } else if (t.resident != null) {
      return t.resident;
    }
  }
  return undefined;
}

/** What an answer carries under its sentence, decided in one place. */
export type AnswerShape = {
  widget?: ChatTurn["widget"];
  visits: Task[];
  /** The person the answer is about — the conversation's focus. */
  resident?: string;
  residents?: string[];
  metric?: MetricKind;
  /**
   * The question as the rest of the pipeline reads it: with the focused
   * person's name added where the carer did not repeat it, so the facts,
   * the visits and the route are that person's.
   */
  asked: string;
};

/**
 * What goes under an answer — the cards, and which one — read off the
 * question and the conversation so far.
 *
 * One place, because the answer's sentence and its cards have to agree:
 * the model is told what will be shown, and the thread shows exactly that.
 * Once a person is named, everything is about them — their figures, their
 * visits, the way to their house — and nobody else is shown, until another
 * person is named. Only a question about people in general lists people.
 */
export function answerShape(
  question: string,
  history: ChatTurn[],
  now: Date = planToday,
  /**
   * The patient whose page the assistant was opened over. Who a question
   * with no name in it is about when the conversation has nobody yet.
   */
  onScreen?: string,
): AnswerShape {
  const q = question.toLowerCase();
  // "The way to all three": the people in the list just shown, every one
  // of them — done or not, since the carer counted them — as one round.
  // And the way asked for straight after a list of several, with nobody
  // named: the way through that list, not to whoever was talked of before.
  const listed = ALL_OF.test(q)
    ? lastListed(history)
    : personIn(question) == null && ordinalIn(question, history) == null
      ? justListed(history)
      : [];
  const together =
    listed.length > 1 && (ROUTE.test(q) || TOUR.test(q));
  // The round planned: every stop, in order, on one map.
  if (together || (TOUR.test(q) && personIn(question) == null)) {
    const stops = tourFor(question, now, together ? listed : undefined);
    return {
      widget: stops.length > 0 ? "tour" : undefined,
      visits: stops,
      asked: question,
    };
  }
  // Named, or pointed at in the last list ("the first one").
  const named = personIn(question) ?? ordinalIn(question, history);
  const general = named == null && GENERAL.test(q);
  // A name that fits several people is nobody yet — unless the one already
  // being talked about, or on the page, is among them.
  const fits = candidatesIn(question);
  const already = subjectOf(history) ?? onScreen;
  const focus =
    named ??
    (fits.length > 1
      ? fits.find((r) => r.id === already)?.id
      : general
        ? undefined
        : already);
  const person = focus != null ? residentById(focus) : undefined;
  // The focused person's name, where the question leaves it out.
  const asked =
    person != null && personIn(question) == null
      ? `${question} (${givenName(person.name)})`
      : question;
  const a = asked.toLowerCase();

  if (focus != null) {
    // Theirs only: the plan's visits for this person, where the question
    // is about when, or the next one as the way through to them.
    const theirs = visitsFor(asked, now).filter((t) => t.residentId === focus);
    if (ROUTE.test(a)) {
      return {
        widget: theirs.length > 0 ? "route" : undefined,
        visits: theirs.slice(0, 1),
        resident: focus,
        asked,
      };
    }
    if (HEALTH.test(asked)) {
      return { widget: "health", resident: focus, visits: [], asked };
    }
    // Their visits only when their visits are what was asked about: an
    // answer about her allergies does not need her diary under it. What is
    // planned is what is still to come — from today on, in date order —
    // unless the question looks back.
    if (!VISITS_ASKED.test(q)) return { visits: [], resident: focus, asked };
    const mine = yearTasks.filter((t) => t.residentId === focus);
    const looksBack =
      /ที่ผ่านมา|ประวัติ|เคย|ครั้งก่อน|ครั้งที่แล้ว|ย้อนหลัง|เมื่อก่อน|\b(history|previous|past (visits|appointments)|in the past|last time|before|earlier|ever|used to)\b/.test(
        q,
      );
    const planned = looksBack
      ? mine
          .filter((t) => t.dueAt < startOfDay(now))
          .sort((x, y) => y.dueAt.getTime() - x.dueAt.getTime())
      : mine
          .filter((t) => t.dueAt >= startOfDay(now))
          .sort((x, y) => x.dueAt.getTime() - y.dueAt.getTime());
    return { visits: planned.slice(0, SHOWN_MAX), resident: focus, asked };
  }

  if (ROUTE.test(q)) {
    const v = visitsFor(question, now);
    // The house it is the way to is who the conversation is now about.
    return {
      widget: v.length > 0 ? "route" : undefined,
      visits: v,
      resident: v[0]?.residentId,
      asked,
    };
  }
  if (HEALTH.test(question)) {
    if (
      WHO.test(q) ||
      /ผิดปกติ|น่าห่วง|เร่งด่วน|หลุดเกณฑ์|abnormal|worr|urgent|out of range/.test(
        q,
      )
    ) {
      const u = unwellFor(question, now) ?? { residents: [] };
      // "Who is the most worrying" is one person: their card, not a list —
      // and from then on, the person the conversation is about.
      if (ONE_OF.test(q) && u.residents.length > 0)
        return {
          widget: "health",
          resident: u.residents[0],
          visits: [],
          asked,
        };
      return { widget: "healthList", ...u, visits: [], asked };
    }
    // A health question about nobody in particular, with nobody in the
    // conversation: the model asks who is meant, and nothing is listed.
    return { visits: [], asked };
  }
  const v = visitsFor(question, now);
  return {
    widget: widgetFor(question, now),
    visits: v,
    // An answer that comes down to one person — the nearest, the farthest,
    // the next — makes them who the conversation is about, so "and the
    // map?" or "any visits planned?" goes on being about them.
    resident: v.length === 1 ? v[0].residentId : undefined,
    asked,
  };
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
    // In English the record's first line is left off: it is written in
    // Thai for the model, and a Thai fragment in an English sentence reads
    // as a fault rather than a fact.
    return count === 0
      ? tr(`ไม่พบนัดของ ${who} ในระบบค่ะ`, `No appointments found for ${who}.`)
      : tr(
          `${who} มีนัดทั้งหมด ${all.length} ครั้งค่ะ`,
          `${who} has ${all.length} appointment${all.length === 1 ? "" : "s"} in all.`,
        ) +
          (next == null
            ? tr(" ตอนนี้ไม่มีนัดที่ค้างอยู่", " Nothing is pending right now.")
            : tr(
                ` นัดถัดไป ${thaiFullDate(next.dueAt)} ${thaiTime(next.dueAt)}`,
                ` The next one is ${thaiFullDate(next.dueAt)} at ${thaiTime(next.dueAt)}.`,
              )) +
          (named[0] == null || isEn
            ? ""
            : ` · ${recordLines(named[0], now).slice(0, 1).join("")}`);
  }

  const items = (n: number) => `${n} task${n === 1 ? "" : "s"}`;
  if (/ค้างนาน/.test(q) || OVERDUE.test(q)) {
    return count === 0
      ? tr("ไม่มีงานเกินกำหนดค่ะ", "Nothing is overdue.")
      : tr(
          `มีงานเกินกำหนดอยู่ ${count} รายการค่ะ`,
          `${items(count)} ${count === 1 ? "is" : "are"} overdue.`,
        );
  }
  if (DONE.test(q)) {
    return count === 0
      ? tr(
          "เจ็ดวันที่ผ่านมายังไม่มีงานที่ทำเสร็จค่ะ",
          "Nothing has been completed in the past 7 days.",
        )
      : tr(
          `เจ็ดวันที่ผ่านมาทำเสร็จไปแล้ว ${count} รายการค่ะ`,
          `${items(count)} completed in the past 7 days.`,
        );
  }
  if (WEEK.test(q)) {
    return count === 0
      ? tr("เจ็ดวันข้างหน้ายังไม่มีงานค่ะ", "Nothing is scheduled for the next 7 days.")
      : tr(
          `เจ็ดวันข้างหน้ามี ${count} รายการค่ะ`,
          `${items(count)} in the next 7 days.`,
        );
  }
  if (/ต้องทำ/.test(q) || LEFT.test(q)) {
    return count === 0
      ? tr("วันนี้ทำครบแล้วค่ะ", "Everything is done for today.")
      : tr(
          `วันนี้ยังเหลืออยู่ ${count} รายการค่ะ`,
          `${items(count)} still left today.`,
        );
  }

  const left = r.today.filter((t) => !isDone(t)).length;
  if (r.today.length === 0) return tr("วันนี้ไม่มีงานค่ะ", "No tasks today.");
  return tr(
    `วันนี้มีงาน ${r.today.length} รายการ ` +
      `เสร็จแล้ว ${r.today.filter(isDone).length} เหลืออีก ${left} ค่ะ` +
      (r.overdue.length > 0
        ? ` และมีงานเกินกำหนดค้างอยู่ ${r.overdue.length} รายการ`
        : ""),
    `${items(r.today.length)} today: ${r.today.filter(isDone).length} done, ${left} left.` +
      (r.overdue.length > 0
        ? ` ${items(r.overdue.length)} ${r.overdue.length === 1 ? "is" : "are"} also overdue.`
        : ""),
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
/*
  In English the first two lines change: the language to answer in, and the
  Thai particles, which have no English counterpart. The rest stays in Thai —
  it is what the model is told, not what the carer reads, and the facts
  block it describes is Thai whatever the language on screen.
*/
const SYSTEM = [
  tr(
    "คุณเป็นผู้ช่วยของพยาบาลเยี่ยมบ้าน ตอบเป็นภาษาไทยด้วยน้ำเสียงสุภาพเป็นกันเอง เหมือนเพื่อนร่วมงานที่คุยกัน",
    "You are the assistant of a home-visit nurse. Always answer in English, in a polite, friendly tone, like a colleague talking — even though the data and these instructions are in Thai.",
  ),
  tr(
    "ลงท้ายด้วย ค่ะ หรือ นะคะ เสมอ ห้ามใช้ ครับ",
    "Write patients' names exactly as they appear in the data (in Thai script). Translate everything else — conditions, statuses, dates — into natural English.",
  ),
  "ตอบจากข้อมูลที่ให้มาเท่านั้น ห้ามเดา ห้ามเพิ่มชื่อ วันที่ ตัวเลข หรืออาการที่ไม่มีในข้อมูล",
  "ถ้าข้อมูลที่ให้มาไม่มีคำตอบ ให้บอกตรงๆ ว่าไม่มีข้อมูลในระบบ",
  "ตอบเป็นประโยคพูดคุย 1-3 ประโยค ไม่ต้องยาว",
  "ห้ามไล่รายการเป็นบรรทัดๆ ห้ามขึ้นต้นบรรทัดด้วย - หรือตัวเลขลำดับ",
  "ถ้าคำถามเกี่ยวกับรายการงานหรือนัด ให้สรุปเป็นคำพูดว่ามีกี่รายการและมีอะไรที่ต้องสังเกต และบอกว่าดูรายการด้านล่างได้ เฉพาะเมื่อหมายเหตุบอกว่าแอปจะแสดงรายการให้",
  "ตอบเฉพาะสิ่งที่ถูกถาม ถ้าถามหาคนเดียวให้พูดถึงคนเดียว อย่าไล่คนอื่นที่ไม่ได้ถูกถามถึง",
  "ถ้าถามเรื่องตำแหน่งหรือระยะทาง ให้ตอบจากบรรทัดระยะทางที่ให้มา และบอกว่าเป็นระยะเส้นตรงโดยประมาณ",
  "ถ้าในข้อมูลมีบรรทัดระยะทางหรือที่อยู่ ถือว่ามีข้อมูลตำแหน่งแล้ว ห้ามตอบว่าไม่มีข้อมูลตำแหน่ง",
  "ถ้าถามเรื่องค่าสุขภาพ ให้บอกค่าที่วัดได้และคำตัดสินที่ให้มาเท่านั้น",
  "ห้ามวินิจฉัยโรค ห้ามแนะนำยาหรือขนาดยา ห้ามบอกให้ปรับยาเอง ถ้าถูกถามให้บอกว่าต้องปรึกษาแพทย์ผู้รักษา",
  "ถ้าถามว่าให้ยาได้ไหม ห้ามตอบว่าให้ได้ บอกได้เพียงว่ายานั้นตรงหรือไม่ตรงกับประวัติแพ้ที่บันทึกไว้ และการให้ยาต้องเป็นไปตามคำสั่งแพทย์",
  "เรียก offer_action เฉพาะเมื่อพยาบาลขอให้ทำ หรือคำตอบเป็นเรื่องผู้ป่วยคนเดียวที่ต้องทำต่อทันที ไม่ต้องเสนอปุ่มให้ทุกคนในรายการ",
  "ห้ามเปิดหัวด้วยคำว่า 'แน่นอน' หรือ 'ได้เลย' ให้เข้าเรื่องทันที",
  "ห้ามพูดถึงเครื่องมือ ระบบภายใน รหัสผู้ป่วย หรือหมายเหตุเหล่านี้กับพยาบาล ถ้าถูกถามเรื่องนอกงาน ให้ตอบสุภาพสั้น ๆ ประโยคเดียวว่าช่วยได้เรื่องงานเยี่ยมบ้านและข้อมูลผู้ป่วย",
  /*
    The tools. Looked up rather than guessed: the facts block covers the
    round, and anything past it — medicines, the last visit's plan, how a
    reading has run this month, the clinics coming up — is a tool away.
  */
  "ข้อมูลในระบบที่ให้มาเป็นแค่ภาพรวมของรอบงาน ไม่มียา ประวัติการรักษา แนวโน้มค่า กิจกรรมบริการ หรือกลุ่มติดตาม ถ้าถูกถามเรื่องเหล่านี้ต้องเรียกเครื่องมือเสมอ ห้ามตอบว่าไม่มีข้อมูลถ้ายังไม่ได้เรียกเครื่องมือ",
  "รหัสผู้ป่วยต้องมาจากข้อมูลหรือผลของเครื่องมือเท่านั้น ห้ามเดารหัส ถ้ายังไม่รู้รหัสให้เรียก find_patient หรือ who_needs_attention ก่อน ถ้าพบหลายคนให้ถามกลับว่าหมายถึงคนไหน",
  "ผลจาก medication_history, treatment_history, care_activities, follow_up_list และ patient_record ไม่ได้แสดงเป็นการ์ด ให้เล่าสาระสำคัญในคำตอบเอง ยาวได้ไม่เกิน 5 ประโยค และห้ามบอกว่าดูด้านล่าง",
  "ตัวเลข วันที่ ชื่อยา และผลตรวจทุกอย่างในคำตอบต้องมาจากข้อมูลหรือผลของเครื่องมือเท่านั้น",
  "ถ้าคำตอบนำไปสู่การทำต่อกับผู้ป่วย เช่น โทร นำทาง เปิดหน้าผู้ป่วย เริ่มบันทึกเยี่ยม หรือวางเส้นทาง ให้เรียก offer_action เพื่อเสนอปุ่ม แล้วบอกว่ากดปุ่มด้านล่างได้ ห้ามบอกว่าทำให้แล้ว",
  "ถ้าถูกถามว่าควรเริ่มจากใคร หรือขอสรุปภาพรวมวันนี้ ให้เรียก daily_brief แล้วบอกเหตุผลของลำดับสั้น ๆ",
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
  /** Asked aloud, and to be answered aloud (see `VoiceBar`). */
  spoken = false,
  /**
   * The answer as it is written, for the voice mode to start speaking at
   * its first sentence. Given, the reply is streamed.
   */
  onText?: (soFar: string) => void,
  /** The page the question was asked over, and who it is about. */
  focus?: Focus | null,
): Promise<AssistantReply> {
  const recent = history
    .slice(-4)
    .map((t) => ({ role: t.role, content: t.text }));
  const shape = answerShape(question, history, now, focus?.resident?.id);
  /*
    "แล้วคุณบุญเรือนล่ะ" — the same question again, about somebody else.
    Read alone it asks nothing; read after "what is he allergic to" it asks
    exactly that. The question before it is carried in, for the look-ups
    and for the model.
  */
  const before = [...history].reverse().find((t) => t.role === "user")?.text;
  const elliptic =
    before != null &&
    question.trim().length < 40 &&
    /^(แล้ว|และ|ส่วน)|(ล่ะ|ละ|บ้างล่ะ)\s*[?？]?$|^(and|what about|how about)\b/i.test(question.trim());
  const topic = elliptic ? `${before} ${shape.asked}` : shape.asked;

  /*
    The look-ups the question plainly needs, done now (see `prefetchFor`)
    and handed over with the facts; their cards count as if the model had
    asked for them.
  */
  const effects: ToolEffects = {};
  // A "who…?" that names nobody is about everyone: the person the old
  // shaping settled on (the first on the list) is a guess, and fetching
  // only her record told the model she was all there was.
  const general =
    /ใคร|\bwho\b/i.test(question) && candidatesIn(question).length === 0;
  const fetched = prefetchFor(topic, general ? undefined : shape.resident).map((c) => {
    const result = runTool(c.name, c.args, now);
    mergeEffects(effects, { ...result.effects, used: [c.name] });
    return `ผลจาก ${c.name}:\n${result.text}`;
  });
  // A look-up that tells its own story replaces the visit cards the
  // wording matched (see `send`), so the model is not told of them.
  const told = (effects.used ?? []).some((n) => TELLING.includes(n));
  const listed = told ? 0 : shape.visits.length;
  const asked = [
    `ข้อมูลในระบบ ณ ตอนนี้:\n${facts(shape.asked, now)}`,
    shape.resident != null
      ? `หมายเหตุ: บทสนทนานี้กำลังพูดถึง ${residentById(shape.resident)?.name ?? ""} ให้ตอบเฉพาะเรื่องของผู้ป่วยรายนี้ ห้ามพูดถึงผู้ป่วยคนอื่น`
      : "",
    (shape.widget == null || told) && listed === 0
      ? ""
      : shape.widget === "tour"
        ? `หมายเหตุ: แอปจะแสดงแผนที่เส้นทางเยี่ยม ${listed} จุด ปักหมุดเป็นลำดับ 1 ถึง ${listed} ตามลำดับที่ควรไป (${shape.visits.map((t, i) => `${i + 1}. ${givenName(t.name)} ${thaiTime(t.dueAt)}`).join(", ")}) พร้อมระยะทางรวม ใต้คำตอบของคุณอยู่แล้ว ให้บอกลำดับการไปสั้น ๆ ตามนี้ ห้ามเปลี่ยนลำดับ`
        : shape.widget === "healthList"
          ? `หมายเหตุ: แอปจะแสดงรายชื่อผู้ป่วย ${shape.residents?.length ?? 0} คนที่มีค่าผิดปกติ พร้อมค่าที่ผิดปกติของแต่ละคน ใต้คำตอบของคุณอยู่แล้ว ให้สรุปสั้น ๆ ว่ามีกี่คนและใครน่าห่วงที่สุด ไม่ต้องไล่ทุกคน`
          : shape.widget === "health"
            ? `หมายเหตุ: คำถามนี้หมายถึง ${residentById(shape.resident ?? "")?.name ?? "ผู้ป่วยรายนี้"} แอปจะแสดงการ์ดค่าสุขภาพล่าสุดของผู้ป่วยรายนี้ (ความดัน น้ำตาล ออกซิเจน ชีพจร อุณหภูมิ BMI พร้อมกราฟแนวโน้ม) ใต้คำตอบของคุณอยู่แล้ว ให้สรุปสั้น ๆ ว่าภาพรวมเป็นอย่างไรและค่าไหนที่ควรระวัง ไม่ต้องไล่ตัวเลขทุกค่า และไม่ต้องพูดถึงผู้ป่วยคนอื่น`
            : shape.widget === "route"
              ? "หมายเหตุ: แอปจะแสดงแผนที่เส้นทางจากตำแหน่งปัจจุบันไปบ้านผู้ป่วย พร้อมระยะทาง เวลาเดินทาง และปุ่มนำทาง ใต้คำตอบของคุณอยู่แล้ว ให้บอกสั้น ๆ ว่าแผนที่เส้นทางไปบ้านใครอยู่ด้านล่าง กดนำทางได้ ห้ามบอกว่าส่งหรือนำทางให้แล้ว ห้ามอธิบายเส้นทางเป็นข้อความ"
              : `หมายเหตุ: แอปจะแสดงรายการ ${listed} รายการเป็นการ์ดที่กดเปิดได้ใต้คำตอบของคุณอยู่แล้ว ห้ามพิมพ์รายการซ้ำ`,
    /*
      An answer that will be heard, not read: a list read aloud is a string
      of numbers and fragments, and a paragraph is longer than anyone keeps
      in their head while they drive to the next house.
    */
    /*
      And a conversation, not a reading. Said the way one colleague answers
      another across a car: the answer first, in a sentence or two; more
      only if asked for, and offered rather than recited; times and numbers
      as people say them, because "10:30" read aloud is "สิบ ทวิภาค สามศูนย์".
      "ค่ะ", to match the assistant's voice and its written replies.
    */
    spoken
      ? tr(
          [
            "หมายเหตุ: คำถามนี้ถามด้วยเสียง และคำตอบจะถูกอ่านออกเสียงให้ฟัง ให้ตอบเหมือนคุยกันจริง ๆ",
            "พูดเป็นภาษาพูดที่เป็นธรรมชาติ อบอุ่น ลงท้ายด้วย ค่ะ หรือ นะคะ (ห้ามใช้ ครับ)",
            "ตอบสิ่งที่ถูกถามก่อนใน 1–2 ประโยคสั้น ๆ ถ้ายังมีรายละเอียดอีก ให้สรุปสั้น ๆ แล้วถามกลับว่าอยากฟังเพิ่มไหม",
            // The app says the figures itself (see `sayable`); spelled out by
            // the model they came out wrong — "บ่ายสามสี่สิบห้า", a pressure
            // with no "ทับ" in it.
            "เขียนเวลา ตัวเลข และค่าที่วัดเป็นตัวเลขตามข้อมูล เช่น 10:30 หรือ 132/91 mmHg ห้ามแปลงเป็นคำเอง แอปจะอ่านออกเสียงให้ถูกเอง",
            "ห้ามใช้รายการ หัวข้อ สัญลักษณ์ วงเล็บ หรืออีโมจิ",
            // Heard, perhaps while driving: "below" is nowhere.
            "ห้ามพูดว่าดูด้านล่าง ดูรายการ หรือกดปุ่มด้านล่าง ถ้าแอปแสดงการ์ดหรือปุ่มไว้ ให้พูดว่าแสดงไว้บนจอแล้ว",
            "ถ้ามีหลายคนหรือหลายรายการ พูดแค่จำนวนและคนที่สำคัญที่สุดหนึ่งหรือสองคน ไม่ต้องไล่ทุกคน",
          ],
          [
            "Note: this question was asked by voice and the answer will be read aloud. Answer the way people actually talk.",
            "Use natural, warm spoken English.",
            "Answer what was asked first, in one or two short sentences. If there is more, summarize it briefly and ask whether they would like to hear more.",
            "Write times, numbers and readings as digits exactly as in the data, e.g. 10:30 or 132/91 mmHg; the app reads them aloud correctly.",
            "No lists, headings, symbols, brackets or emoji.",
            "Never say 'see below' or 'tap the button below'; if the app shows a card or button, say it is on the screen.",
            "With several people or items, say how many and name only the one or two that matter most.",
          ],
        ).join("\n")
      : "",
    focus?.resident != null
      ? `หมายเหตุ: พยาบาลถามขณะเปิด${focus.screen}ของ ${focus.resident.name} (รหัส ${focus.resident.id}) อยู่ ถ้าคำถามไม่ได้ระบุชื่อ ให้ถือว่าหมายถึงผู้ป่วยรายนี้`
      : "",
    shape.resident != null
      ? `รหัสของผู้ป่วยที่กำลังพูดถึง: ${shape.resident}`
      : "",
    (() => {
      const fits = candidatesIn(question);
      if (fits.length < 2 || fits.some((r) => r.id === shape.resident)) return "";
      return [
        `หมายเหตุ: ชื่อในคำถามตรงกับผู้ป่วย ${fits.length} คน ห้ามเลือกเอง ห้ามตอบข้อมูลของคนใดคนหนึ่ง ให้ถามกลับว่าหมายถึงคนไหน โดยบอกชื่อเต็มและอายุให้เลือก:`,
        ...fits.slice(0, 6).map((r) => `- ${r.name} อายุ ${r.age} ปี`),
      ].join("\n");
    })(),
    elliptic
      ? `หมายเหตุ: คำถามนี้ต่อจากคำถามก่อนหน้า "${before}" ให้ตอบเรื่องเดียวกันนั้น แต่สำหรับคนที่ถูกถามถึงตอนนี้`
      : "",
    `คำถาม: ${shape.asked}`,
    isEn ? "Answer in English." : "",
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
  const prompt =
    fetched.length === 0
      ? asked
      : `${asked}\n\nข้อมูลที่ค้นมาให้แล้ว:\n${fetched.join("\n\n")}`;

  const content =
    photos.length === 0
      ? prompt
      : [
          { type: "text", text: prompt },
          ...photos.map((p) => ({
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${p.base64}` },
          })),
        ];

  const messages: unknown[] = [
    { role: "system", content: SYSTEM },
    ...recent,
    { role: "user", content },
  ];

  /*
    The model looks things up, a few rounds at most, then answers.

    Each round it may ask for tools; they are run here, on the phone, from
    the app's own records, and what they found goes back to it. Four rounds
    is enough for "find her, read her record, check her sugar, offer to
    call" and short enough that a carer is not left waiting on a loop.
  */
  const wait =
    photos.length === 0 ? 25_000 : 45_000 + photos.length * 15_000;
  let text: string | undefined;
  let nudged = false;
  for (let round = 0; round < 5; round++) {
    const last = round === 4;
    const turn = await modelTurn(messages, {
      // The last round is told to answer with what it has.
      tools: last ? undefined : TOOLS,
      onText,
      maxTokens: onText != null ? 300 : 500,
      // Spoken: a little warmth in the wording — the same answer twice in
      // the same words is what makes a voice sound like a machine.
      temperature: onText != null ? 0.5 : 0,
      timeoutMs: wait,
    });
    // Looked things up and then said nothing — or a stray word: after
    // offering a button the model will sometimes treat the button as the
    // answer. Asked once more, for words and nothing else.
    const mute =
      turn == null ||
      (round > 0 &&
        turn.toolCalls.length === 0 &&
        turn.content.trim().length < 8);
    if (mute) {
      if (round > 0 && !last) {
        messages.push({
          role: "user",
          content:
            "ตอบพยาบาลเป็นข้อความสั้น ๆ ตอนนี้ จากข้อมูลที่ค้นมา ถ้าเสนอปุ่มไว้ ให้บอกว่ากดปุ่มด้านล่างได้",
        });
        const again = await modelTurn(messages, {
          onText,
          maxTokens: onText != null ? 300 : 500,
          timeoutMs: wait,
        });
        text = again?.content.trim();
      }
      break;
    }
    if (turn == null) break;
    /*
      "There is nothing on file" from a model that never looked.

      It happens: asked for an average it would say the system had none
      and suggest the carer go and find it, with the tool that finds it
      right there. Before an answer like that is believed, the model is
      sent back once to look.
    */
    if (
      turn.toolCalls.length === 0 &&
      !last &&
      !nudged &&
      (effects.used ?? []).length === 0 &&
      /ไม่มีข้อมูล|ไม่พบข้อมูล|ไม่มีในระบบ|เรียกดู|no (data|record|information)|not (in|on) (the )?(system|file)|(don'?t|do not|doesn'?t) have (any )?\w*\s*(data|record|information|readings?)|(couldn'?t|could not|can'?t|cannot) find|not available|no [\w ]{0,30}(data|readings?|records?|information)( is)? (available|on file|in the system)/i.test(
        turn.content,
      )
    ) {
      nudged = true;
      messages.push(
        { role: "assistant", content: turn.content },
        {
          role: "user",
          content:
            "ยังไม่ได้ค้นข้อมูลเลย ให้เรียกเครื่องมือที่เกี่ยวข้องก่อน แล้วค่อยตอบใหม่ ถ้าค้นแล้วยังไม่มีจริงจึงบอกว่าไม่มี",
        },
      );
      continue;
    }
    if (turn.toolCalls.length === 0 || last) {
      text = turn.content.trim();
      break;
    }
    messages.push({
      role: "assistant",
      content: turn.content === "" ? null : turn.content,
      tool_calls: turn.toolCalls,
    });
    for (const call of turn.toolCalls) {
      const result = runTool(call.function.name, argsOf(call), now);
      mergeEffects(effects, { ...result.effects, used: [call.function.name] });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result.text,
      });
    }
  }

  /*
    Every figure checked against what the model was given.

    The model is told to quote only what is in front of it, and nearly
    always does — but a home-visit record is the wrong place for "nearly".
    Any number of two or more digits in the answer that appears nowhere in
    the facts or the tools' results is sent back once to be corrected.
    Not when spoken: those words are already being said.
  */
  if (text != null && text !== "" && onText == null) {
    const sources = messages
      .map((x) => {
        const c = (x as { content?: unknown }).content;
        return typeof c === "string" ? c : JSON.stringify(c ?? "");
      })
      .join("\n");
    const stray = strayNumbers(text, sources);
    if (stray.length > 0) {
      messages.push(
        { role: "assistant", content: text },
        {
          role: "user",
          content: `ตัวเลข ${stray.join(", ")} ในคำตอบไม่มีอยู่ในข้อมูลที่ให้มา เขียนคำตอบใหม่โดยใช้เฉพาะตัวเลขที่อยู่ในข้อมูล ถ้าไม่มีข้อมูลให้บอกว่าไม่มี ตอบแค่คำตอบใหม่`,
        },
      );
      const fixed = await modelTurn(messages, { maxTokens: 500, timeoutMs: wait });
      const better = fixed?.content.trim();
      if (better != null && better !== "" && strayNumbers(better, sources).length === 0)
        text = better;
    }
  }

  /*
    Asked to do something, and all that happened was a button offered:
    the sentence is the app's, not the model's. Left to it, the model
    would offer the button and then ask what else the carer wanted, or
    talk about the distance to the house.
  */
  const only = effects.used ?? [];
  // A command, not a question: "call her", not "when is her visit?".
  const command =
    /โทร|นำทาง|พาไป|เริ่มบันทึก|เปิดหน้า|วางเส้นทาง|\b(call|ring|navigate|directions|take me|start|open|plan)\b/i.test(question) &&
    !/อะไร|เมื่อไหร่|เมื่อไร|วันไหน|เท่าไหร่|เท่าไร|ไหม|กี่|ใคร|ยังไง|อย่างไร|ที่ไหน|\b(what|when|how|who|which|where)\b|\?/i.test(question);
  if (
    command &&
    onText == null &&
    only.length > 0 &&
    only.every((n) => n === "offer_action") &&
    (effects.actions ?? []).length > 0
  ) {
    return { text: offered(effects.actions ?? []), effects };
  }

  /*
    An allergy is never left out of a briefing about the patient.

    Asked what to get ready for a visit, the model listed the readings to
    recheck and the rails in the bathroom and, now and then, not the
    penicillin. That is the one line that cannot be optional, so where the
    answer is a briefing on one patient with an allergy on file and the
    allergy is not in it, the app says it.
  */
  if (text != null && text !== "") {
    // A briefing: getting ready for her, or her record summed up — not
    // every answer that happened to read her record on the way.
    const briefed =
      onText == null &&
      ((effects.used ?? []).includes("prepare_visit") ||
        ((effects.used ?? []).includes("patient_record") &&
          /สรุป|ภาพรวม|เตรียม|ข้อควรระวัง|ต้องระวัง|ข้อมูลทั้งหมด|summar|overview|prepare|precaution/i.test(question)));
    const who = residentById(effects.subject ?? "");
    if (briefed && who != null) {
      const allergy = detailFor(who).allergies.trim();
      const none = allergy === "" || /ปฏิเสธ|ไม่มี|^none|^no known|denie/i.test(allergy);
      const said = allergy
        .split(/[,،、/]|และ/)
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean)
        .every((x) => text!.toLowerCase().includes(x));
      if (!none && !said)
        text = `${text}\n\n${tr(`⚠️ แพ้ยา: ${allergy}`, `⚠️ Drug allergy: ${allergy}`)}`;
    }
  }

  if (text != null && text !== "") return { text: plain(text), effects };
  // Nothing on the phone can read a photograph, so say so rather than
  // answering the words and quietly ignoring the pictures.
  return {
    text:
      photos.length === 0
        ? localAnswer(question, now)
        : tr(
            "ตอนนี้ติดต่อผู้ช่วยไม่ได้ จึงยังอ่านรูปให้ไม่ได้ ลองใหม่เมื่อมีสัญญาณ",
            "Can't reach the assistant right now, so the photos can't be read yet. Try again when you have a signal.",
          ),
    effects: {},
  };
}

/** Tools whose answer is told in words, with no card of its own. */
export const TELLING = [
  "care_activities",
  "follow_up_list",
  "medication_history",
  "treatment_history",
  "patient_record",
];

/** An answer, and what the tools it used add under it. */
export type AssistantReply = { text: string; effects: ToolEffects };

/** "กดปุ่มโทรหาสมชายด้านล่างได้เลยค่ะ" — for answers that are only buttons. */
function offered(actions: AssistantAction[]): string {
  const said = actions.map((a) => {
    const who = residentById(a.residentId ?? "");
    const name = who != null ? givenName(who.name) : "";
    switch (a.kind) {
      case "call":
        return tr(`โทรหาคุณ${name}`, `call ${name}`);
      case "navigate":
        return tr(`นำทางไปบ้านคุณ${name}`, `get directions to ${name}'s house`);
      case "start_visit":
        return tr(`เริ่มบันทึกเยี่ยมคุณ${name}`, `start ${name}'s visit`);
      case "open_patient":
        return tr(`เปิดหน้าคุณ${name}`, `open ${name}'s page`);
      case "open_health":
        return tr(`ดูค่าสุขภาพคุณ${name}`, `see ${name}'s readings`);
      case "plan_route":
        return tr("วางเส้นทางรอบวันนี้", "plan today's route");
      case "open_household":
        return tr(`เปิดหน้าบ้านของคุณ${name}`, `open ${name}'s household`);
      case "call_caregiver":
        return tr(`โทรหาผู้ดูแลของคุณ${name}`, `call ${name}'s caregiver`);
    }
  });
  return tr(
    `กดปุ่มด้านล่างเพื่อ${said.join(" หรือ")}ได้เลยค่ะ`,
    `Tap the button below to ${said.join(" or ")}.`,
  );
}

/**
 * The answer as the thread shows it: the model's markdown taken off.
 * The bubble is plain text, so "**" arrives as asterisks.
 */
function plain(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/gs, "$1")
    .replace(/(^|\s)\*(\S.*?\S)\*(?=\s|$)/g, "$1$2")
    .replace(/^#+\s*/gm, "")
    .trim();
}

/**
 * Numbers in an answer that its sources never mention.
 *
 * Two digits and up: a "1 เม็ด" or "2 ครั้ง" is the model's own counting
 * of things it was told, and checking those would mostly catch Thai being
 * written naturally. Thousands separators are ignored on both sides, and a
 * reading "132/91" counts as its two halves.
 */
export function strayNumbers(answer: string, sources: string): string[] {
  const src = sources.replace(/(\d),(\d)/g, "$1$2");
  const nums = answer.replace(/(\d),(\d)/g, "$1$2").match(/\d+(?:\.\d+)?/g) ?? [];
  return [
    ...new Set(
      nums.filter(
        (n) =>
          n.replace(".", "").length >= 2 &&
          !new RegExp(`(^|[^0-9.])${n.replace(".", "\\.")}([^0-9]|$)`).test(src),
      ),
    ),
  ];
}

/** A tool call's arguments, or none where the model wrote them badly. */
function argsOf(call: ToolCall): Record<string, unknown> {
  try {
    const v = JSON.parse(call.function.arguments) as unknown;
    return v != null && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** One tool's additions folded into the answer's, the later ones winning. */
function mergeEffects(into: ToolEffects, add: ToolEffects): void {
  if (add.resident != null) into.resident = add.resident;
  if (add.residents != null) into.residents = add.residents;
  if (add.visits != null) into.visits = add.visits;
  if (add.subject != null) into.subject = add.subject;
  if (add.used != null) into.used = [...(into.used ?? []), ...add.used];
  if (add.actions != null) {
    // One button per thing to do: asked twice for "call her", it is one call.
    const all = [...(into.actions ?? []), ...add.actions];
    into.actions = all.filter(
      (a, i) =>
        all.findIndex(
          (b) => b.kind === a.kind && b.residentId === a.residentId,
        ) === i,
    );
  }
}
