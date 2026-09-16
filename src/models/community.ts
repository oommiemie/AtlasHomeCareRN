import { useSyncExternalStore } from "react";

import { statusOf, type MetricKind, type Tone } from "./vitals";

/**
 * The community-service visit: a card in a reader, a panel to work under, and
 * one patient's session.
 *
 * The rest of the app works off the household registry — people the carer
 * already looks after. This does not. A community clinic sees whoever turns
 * up, and the record it opens is the one the national ID card unlocks: the
 * card is the identity, the reader is the only way in, and the patient may
 * never have been seen before.
 *
 * All of it is stood in for here, the way the rest of the sample data is.
 * Swap `readReader` and `readCard` for the real terminal when there is one.
 */

/** What the reader is doing, which decides whether the flow can start at all. */
export type ReaderState = "checking" | "ready" | "missing" | "reading";

export const READER_LABEL: Record<ReaderState, string> = {
  checking: "กำลังตรวจสอบเครื่องอ่าน",
  ready: "เครื่องพร้อมใช้งาน",
  missing: "ไม่พบเครื่องอ่านบัตร",
  reading: "กำลังอ่านบัตร",
};

/**
 * The rooms a community day is run out of, as the hospital names them.
 *
 * What the carer chooses is a *room*: the day is laid out as doors with
 * names on them, and the patient is sent to one. The list is the
 * hospital's own and the names are kept exactly as written on the doors,
 * because that is what the patient will be looking for. Nothing else — no
 * queue, no name on the door — a list is what was asked for.
 */
export type ExamRoomKey = "r1" | "r2" | "r3" | "r4" | "r5" | "r6" | "r7" | "r8" | "r9";

export const EXAM_ROOMS: { key: ExamRoomKey; name: string }[] = [
  { key: "r1", name: "ห้องตรวจโรคทั่วไป 1" },
  { key: "r2", name: "คลินิกโรคทางเดินหายใจ" },
  { key: "r3", name: "ห้องตรวจอายุรกรรม 1" },
  { key: "r4", name: "คลินิกเบาหวาน / ความดัน (NCD)" },
  { key: "r5", name: "คลินิกโรคหัวใจ" },
  { key: "r6", name: "ห้องตรวจศัลยกรรมทั่วไป" },
  { key: "r7", name: "ห้องตรวจกุมารเวชกรรม" },
  { key: "r8", name: "คลินิกฝากครรภ์" },
  { key: "r9", name: "คลินิกจิตเวช / ยาเสพติด" },
];

/** What the card and the registry together say about who is in front of you. */
export type CardHolder = {
  name: string;
  age: number;
  gender: string;
  /** เลขประจำตัวประชาชน, thirteen digits. */
  citizenId: string;
  /** The hospital number this person is known by here. */
  hn: string;
  /** สิทธิการรักษา — which scheme pays. */
  entitlement: string;
  /**
   * The code the authentication returned for this visit.
   *
   * Proof that the card was read and the holder verified at this moment; it
   * goes on every claim the visit produces, so the page shows it rather than
   * hiding it behind a success tick.
   */
  authenCode: string;
  /** Drug allergies — empty means none on record. */
  allergies: string[];
  /** Chronic conditions the patient is known for. */
  conditions: string[];
  /** The number to ring or call on — none if the record has none. */
  phone?: string;
  /** The admission this visit follows on from, where there was one. */
  an?: string;
  dischargeDate?: string;
  /** The ward or clinic that sent the visit. */
  referredBy?: string;
};

/**
 * What a session can record — Figma 94:11702, plus the home visit.
 *
 * The design draws three; the fourth is the round itself. A community
 * visit happens in somebody's house, and what the carer sees there — who
 * is looking after them, whether the pills are being taken, whether the
 * bathroom is a fall waiting to happen — is not a vital sign and not a
 * questionnaire. It is its own record, and it is often the one that
 * changes what happens next.
 */
export type SessionTask =
  | "screening"
  | "assessment"
  | "diagnosis"
  | "homevisit"
  | "medication"
  | "physio"
  | "lab";

/*
  What this visit has recorded so far, and what was written down.

  Kept per Authen Code, because that is what a visit *is* — one card, one
  read, one code — and kept here rather than in a screen's state because
  three pages need it: the form that writes it, the record that lists what
  has been done, and the form again when the carer goes back in to change
  something. A form that opened empty over an answer already given would be
  asking the carer to type it twice and would lose the first copy.

  A module-level map and a listener set: three pages and one fact do not
  need a store library. `useSessionRecords` is a plain external-store hook.
*/

/** One task's answers, flattened to strings so any form can hold its own. */
export type TaskRecord = Record<string, string>;

const saved = new Map<string, Partial<Record<SessionTask, TaskRecord>>>();
const watchers = new Set<() => void>();
const NONE: Partial<Record<SessionTask, TaskRecord>> = {};

/** Write one task's answers, replacing whatever was there. */
export function saveTask(
  authenCode: string,
  task: SessionTask,
  data: TaskRecord,
): void {
  // A fresh object each time, so a subscriber comparing by identity sees it.
  saved.set(authenCode, { ...(saved.get(authenCode) ?? {}), [task]: data });
  for (const w of watchers) w();
}

/** What this visit has written down so far — live. */
export function useSessionRecords(
  authenCode: string,
): Partial<Record<SessionTask, TaskRecord>> {
  return useSyncExternalStore(
    (onChange) => {
      watchers.add(onChange);
      return () => {
        watchers.delete(onChange);
      };
    },
    () => saved.get(authenCode) ?? NONE,
  );
}

/** What one task holds, for a form reopening on it. */
export function recordOf(authenCode: string, task: SessionTask): TaskRecord {
  return saved.get(authenCode)?.[task] ?? {};
}

export const SESSION_TASKS: {
  key: SessionTask;
  label: string;
  detail: string;
}[] = [
  {
    key: "screening",
    label: "คัดกรองสุขภาพ",
    detail: "บันทึกอาการสำคัญ สัญญาณชีพพื้นฐาน และคัดกรองความเสี่ยง",
  },
  {
    key: "assessment",
    label: "แบบประเมิน",
    detail: "ทำแบบประเมินสุขภาพ เช่น ADL สุขภาพจิต และดูแลผู้สูงอายุ",
  },
  {
    key: "diagnosis",
    label: "วินิจฉัยโรค",
    detail: "บันทึกการวินิจฉัย รหัส ICD-10 และแผนการรักษา",
  },
  {
    key: "homevisit",
    label: "บันทึกเยี่ยมบ้านผู้ป่วย",
    detail: "สภาพบ้าน ผู้ดูแล การใช้ยา และสิ่งที่พบระหว่างเยี่ยม",
  },
  {
    key: "medication",
    label: "สั่งยา",
    detail: "สั่งจ่ายยา ระบุขนาดและวิธีใช้ และตรวจสอบการแพ้ยา",
  },
  // The physiotherapy row is out of the list for now — the type stays, so
  // anything already written against it is still readable, and putting the
  // row back is one entry rather than a migration.
  {
    key: "lab",
    label: "สั่งแลป",
    detail: "ส่งคำสั่งตรวจทางห้องปฏิบัติการออนไลน์",
  },
];

/**
 * One line of what a task holds, for the row that leads back into it.
 *
 * The point of the preview is to answer "did I already put the pressure
 * in?" without opening the form, so it leads with the things a carer would
 * be checking for. The row clamps it at two lines and the rest is a tap
 * away, so what is written here is everything that would fit rather than a
 * fixed few — and no trailing ellipsis of our own, which would sit in the
 * middle of a line the clamp has already cut.
 */
export function summarise(task: SessionTask, data: TaskRecord): string {
  if (task === "screening") {
    const parts = SCREENING_FIELDS.filter(
      (f) => (data[f.key] ?? "").trim() !== "",
    ).map((f) => `${f.label} ${data[f.key]}`);
    const complaint = (data.complaint ?? "").trim();
    if (parts.length === 0) return complaint;
    // The complaint leads where there is one: it is why the rest was taken.
    return [complaint, ...parts].filter((t) => t !== "").join(" · ");
  }
  if (task === "homevisit") {
    // The summary first, where there is one: it is the line a carer wrote
    // precisely so that somebody could read one line and know the visit.
    const summary = (data.summary ?? "").trim();
    if (summary !== "") return summary;
    const parts = [data.kind, data.dependency, data.adherence, data.caregiver].filter(
      (v) => v != null && v !== "",
    );
    return parts.join(" · ");
  }
  if (task === "assessment") {
    // Every assessment done this visit, newest first, as each scored itself.
    return (data.result ?? "").trim();
  }
  if (task === "medication") {
    // The order's own digest: counts and the total.
    return data.result ?? "";
  }
  if (task === "diagnosis") {
    // The principal diagnosis, and how many more ride with it.
    const n = Number(data.count ?? "0");
    const more = n > 1 ? ` +${n - 1}` : "";
    const parts = [`${data.principal ?? ""}${more}`.trim()];
    const px = Number(data.procedureCount ?? "0");
    if (px > 0) parts.push(`หัตถการ ${px}`);
    const pp = Number(data.ppCount ?? "0");
    if (pp > 0) parts.push(`PP ${pp}`);
    const text = (data.dxText ?? "").trim();
    if (parts[0] === "" && text !== "") parts[0] = text;
    return parts.filter((p) => p !== "").join(" · ");
  }
  return "";
}

/**
 * Why the carer is standing in the house today.
 *
 * A first visit is a survey and a follow-up is a comparison, and the
 * record reads differently depending on which — so it is asked first and
 * asked as a choice, not typed.
 */
export const VISIT_KINDS = ["เยี่ยมครั้งแรก", "ติดตามอาการ", "เยี่ยมฉุกเฉิน"] as const;

/**
 * How far the patient can still get on their own — the three the Thai
 * community-health service files everyone under.
 */
export const DEPENDENCY = ["ติดสังคม", "ติดบ้าน", "ติดเตียง"] as const;

/** Whether the pills are being taken, in the three ways they are not. */
export const ADHERENCE = ["กินยาสม่ำเสมอ", "กินยาไม่สม่ำเสมอ", "ไม่ได้กินยา"] as const;

/**
 * What the carer looks for in the house, as things that are either true or
 * not.
 *
 * Each is written so that ticking it is the good outcome — a form where
 * some ticks are good news and others are bad is one nobody can read at a
 * glance afterwards.
 */
export const HOME_CHECKS: { key: string; label: string }[] = [
  { key: "clean", label: "บ้านสะอาด ถูกสุขลักษณะ" },
  { key: "safe", label: "สภาพแวดล้อมปลอดภัย ไม่มีจุดเสี่ยงล้ม" },
  { key: "water", label: "มีน้ำสะอาดสำหรับอุปโภคบริโภค" },
  { key: "toilet", label: "มีห้องน้ำที่ใช้งานได้สะดวก" },
  { key: "caregiver", label: "มีผู้ดูแลหลักอยู่ด้วย" },
];

/**
 * The vital signs the screening form takes — Figma 98:12765.
 *
 * `hint` is what stands in the empty box: a plausible reading for a well
 * adult, not a dash. A dash says "a value goes here" and nothing else,
 * which the label already said; a number says what *shape* of value —
 * whether this box wants one figure or three, whether it takes a decimal,
 * whether 36 would be low or normal. It is grey and it is not a value, so
 * it saves nothing and counts for nothing; it is there to be recognised
 * and typed over.
 */
export const SCREENING_FIELDS: {
  key: string;
  label: string;
  unit: string;
  keyboard: "numeric" | "decimal";
  /** What shows in the empty box. */
  hint: string;
  /** "120/80" rather than one number. */
  pair?: boolean;
  /**
   * Which metric this is, where the app already knows one.
   *
   * The bands that decide whether a reading is worth colouring live in
   * `vitals`, and are the same ones the charts shade against — a number
   * typed into this form and the same number plotted on the detail page
   * cannot disagree about whether it is normal. A weight or a height has
   * no band: there is no reading of either that is abnormal on its own.
   */
  metric?: MetricKind;
}[] = [
  { key: "bp", label: "ความดัน", unit: "mmHg", keyboard: "numeric", hint: "120/80", pair: true, metric: "bp" },
  { key: "temp", label: "อุณหภูมิ", unit: "°C", keyboard: "decimal", hint: "36.5", metric: "temp" },
  { key: "pulse", label: "ชีพจร", unit: "ครั้ง/นาที", keyboard: "numeric", hint: "72", metric: "pulse" },
  { key: "spo2", label: "ออกซิเจน", unit: "%", keyboard: "numeric", hint: "98", metric: "spo2" },
  { key: "glucose", label: "น้ำตาลในเลือด", unit: "mg/dl", keyboard: "numeric", hint: "95", metric: "glucose" },
  { key: "weight", label: "น้ำหนัก", unit: "kg", keyboard: "decimal", hint: "62.5" },
  { key: "height", label: "ส่วนสูง", unit: "cm", keyboard: "numeric", hint: "165" },
  { key: "waist", label: "รอบเอว", unit: "cm", keyboard: "numeric", hint: "80" },
];

/**
 * The body-mass index of a weight and a height as they are typed.
 *
 * Both come off the same card and the carer has just written them, so the
 * form works it out rather than making them do the arithmetic. Null until
 * both are there and make sense — a height of 0 would divide by nothing,
 * and a half-typed "16" for 165 would say something alarming and wrong.
 *
 * The bands are the WHO Asia-Pacific cut-offs, which are what Thai
 * practice uses, and the same ones the patient record's gauge shades.
 */
export function bmiFrom(weight: string, height: string): { value: number; label: string; tone: Tone } | null {
  const kg = Number(weight);
  const cm = Number(height);
  if (!Number.isFinite(kg) || !Number.isFinite(cm) || kg <= 0 || cm < 80 || cm > 250) return null;
  const m = cm / 100;
  const value = kg / (m * m);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value < 18.5) return { value, label: "น้ำหนักน้อยกว่าเกณฑ์", tone: "warn" };
  if (value < 23) return { value, label: "อยู่ในเกณฑ์ปกติ", tone: "normal" };
  if (value < 25) return { value, label: "น้ำหนักเกิน", tone: "warn" };
  if (value < 30) return { value, label: "โรคอ้วนระดับ 1", tone: "alert" };
  return { value, label: "โรคอ้วนระดับ 2", tone: "alert" };
}

/**
 * What a reading can possibly be — not what is healthy, what is *real*.
 *
 * A separate question from the bands above, and the two must not be
 * confused. 39°C is abnormal and true; 390°C is a slipped decimal point. The
 * bands colour the first; this catches the second, and it is the only one of
 * the two that should stop the form being saved — the point of a screening
 * form is to record the alarming readings, so refusing to save them would
 * defeat it, while saving a temperature of 390 puts a number in the record
 * that nobody can ever trust.
 *
 * Wide on purpose. These are the edges of what has been survived, not the
 * edges of normal: a pulse of 30 and a pulse of 200 are both things a carer
 * may genuinely be looking at, and a form that argues with a real reading is
 * worse than one that lets it through.
 */
const LIMITS: Record<string, { min: number; max: number; also?: { min: number; max: number } }> = {
  bp: { min: 50, max: 300, also: { min: 20, max: 200 } },
  temp: { min: 30, max: 45 },
  pulse: { min: 20, max: 250 },
  spo2: { min: 50, max: 100 },
  glucose: { min: 20, max: 600 },
  weight: { min: 1, max: 300 },
  height: { min: 30, max: 250 },
  waist: { min: 20, max: 200 },
};

/**
 * What is wrong with what has been typed, in words, or nothing.
 *
 * Silent while the box is empty and silent while it is half-typed: "12" on
 * the way to "120" is not a mistake yet, and a field that scolds you between
 * keystrokes is a field people learn to ignore. A pressure is only checked
 * once the slash and a second number are there.
 */
export function readingError(
  field: (typeof SCREENING_FIELDS)[number],
  raw: string,
): string | null {
  const limit = LIMITS[field.key];
  const text = raw.trim();
  if (limit == null || text === "") return null;

  if (field.pair === true) {
    const parts = text.split("/");
    if (parts.length !== 2 || parts[1].trim() === "") return null;
    const sys = Number(parts[0]);
    const dia = Number(parts[1]);
    if (!Number.isFinite(sys) || !Number.isFinite(dia)) return "กรอกเป็นตัวเลข เช่น 120/80";
    if (sys < limit.min || sys > limit.max)
      return `ตัวบนต้องอยู่ระหว่าง ${limit.min}–${limit.max}`;
    const d = limit.also!;
    if (dia < d.min || dia > d.max)
      return `ตัวล่างต้องอยู่ระหว่าง ${d.min}–${d.max}`;
    // The one relation between them that is not a matter of degree.
    if (dia >= sys) return "ตัวบนต้องมากกว่าตัวล่าง";
    return null;
  }

  const value = Number(text);
  if (!Number.isFinite(value)) return "กรอกเป็นตัวเลข";
  if (value < limit.min || value > limit.max)
    return `ค่าต้องอยู่ระหว่าง ${limit.min}–${limit.max} ${field.unit}`;
  return null;
}

/**
 * What a typed reading is, if it is anything yet.
 *
 * Returns nothing while the box is empty or holds something that is not a
 * number — a half-typed "12" on the way to "120" must not flash red, so a
 * pressure is only judged once both of its numbers are there.
 */
export function readingStatus(
  field: (typeof SCREENING_FIELDS)[number],
  raw: string,
): { label: string; tone: Tone } | null {
  if (field.metric == null) return null;
  const text = raw.trim();
  if (text === "") return null;

  if (field.pair === true) {
    const [a, b] = text.split("/");
    const sys = Number(a);
    const dia = Number(b);
    if (b == null || !Number.isFinite(sys) || !Number.isFinite(dia)) return null;
    return statusOf(field.metric, sys, dia);
  }
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return statusOf(field.metric, value);
}

/**
 * The forms the assessment page lists — Figma 98:13058.
 *
 * The twelve a community round actually carries, in the order the service
 * lists them: the screening everyone over 35 gets, the two respiratory
 * ones, the two function scores, the chronic-disease follow-up, then the
 * ones that belong to a house rather than a clinic — palliative, INHOMESSS,
 * crisis, ESAS, the home-care plan, and nutrition.
 */
/**
 * The forms the assessment page lists — Figma 98:13058.
 *
 * `items` and `minutes` are what the row prints under the name: how many
 * questions, and about how long. For the three forms that exist they are
 * counted; for the rest they are the size of the standard instrument the
 * row is named for, to be corrected when each is built.
 */
export const ASSESSMENTS: {
  key: string;
  label: string;
  detail: string;
  items: number;
  minutes: number;
}[] = [
  {
    key: "risk35",
    items: 20,
    minutes: 5,
    label: "แบบคัดกรองภาวะเสี่ยง 35 ปีขึ้นไป",
    detail: "คัดกรองเบาหวาน ความดัน และความเสี่ยงโรคหัวใจและหลอดเลือด",
  },
  {
    key: "asthma",
    items: 5,
    minutes: 1,
    label: "แบบประเมินผู้ป่วยหอบหืด",
    detail: "ประเมินการควบคุมอาการและความถี่ของการกำเริบ",
  },
  {
    key: "dyspnea",
    items: 1,
    minutes: 1,
    label: "แบบประเมินผู้ป่วยหายใจลำบาก",
    detail: "ประเมินระดับความเหนื่อยและข้อจำกัดในการใช้ชีวิต",
  },
  {
    key: "barthel",
    items: 10,
    minutes: 5,
    label: "แบบประเมิน Barthel Index Score",
    detail: "ประเมินความสามารถช่วยเหลือตนเอง 10 กิจกรรม",
  },
  {
    key: "adl",
    items: 6,
    minutes: 2,
    label: "แบบประเมินกิจวัตรประจำวัน ADL",
    detail: "ประเมินการทำกิจวัตรประจำวันพื้นฐาน",
  },
  {
    key: "ncd",
    items: 8,
    minutes: 3,
    label: "แบบประเมินผู้ป่วยเบาหวานความดัน",
    detail: "ติดตามการควบคุมน้ำตาลและความดันในผู้ป่วยเรื้อรัง",
  },
  {
    key: "palliative",
    items: 1,
    minutes: 2,
    label: "แบบประเมินผู้ป่วย Palliative Care",
    detail: "ประเมินความต้องการการดูแลแบบประคับประคองและระดับ PPS",
  },
  {
    key: "inhomesss",
    items: 9,
    minutes: 5,
    label: "แบบประเมิน INHOMESSS",
    detail: "ประเมินผู้ป่วยที่บ้าน 9 ด้าน ตั้งแต่การเคลื่อนไหวถึงบริการที่ได้รับ",
  },
  {
    key: "crisis",
    items: 7,
    minutes: 3,
    label: "แบบประเมินผู้ประสบภาวะวิกฤต",
    detail: "ประเมินภาวะเครียดและความต้องการช่วยเหลือหลังเหตุวิกฤต",
  },
  {
    key: "esas",
    items: 9,
    minutes: 3,
    label: "แบบประเมิน ESAS",
    detail: "ประเมินความรุนแรงของอาการ 9 ด้านในผู้ป่วยระยะท้าย",
  },
  {
    key: "homecare",
    items: 12,
    minutes: 5,
    label: "แบบประเมินการดูแลผู้ป่วยที่บ้าน",
    detail: "ประเมินความพร้อมของผู้ดูแลและแผนการดูแลต่อเนื่อง",
  },
  {
    key: "mna",
    items: 6,
    minutes: 3,
    label: "แบบประเมินภาวะโภชนาการ (MNA)",
    detail: "คัดกรองภาวะทุพโภชนาการในผู้สูงอายุ",
  },
];

/**
 * Whether a reader is plugged in.
 *
 * Stood in for: it answers "ready" after the time a USB terminal takes to
 * enumerate, so the page has a checking state to show rather than flashing
 * straight to green. One in six comes back missing, which is what gives the
 * screen's error path something to be tested against.
 */
export function readReader(): Promise<ReaderState> {
  return new Promise((done) =>
    setTimeout(() => done(Math.random() < 0.17 ? "missing" : "ready"), 900),
  );
}

/**
 * The card, once it is in.
 *
 * The Authen Code is minted from the clock the way the real one is — the date
 * it was issued, then a serial within the day — so two sessions on the same
 * visit do not show the same code.
 */
export function readCard(): Promise<CardHolder> {
  const now = new Date();
  const stamp =
    `${now.getFullYear()}` +
    `${String(now.getMonth() + 1).padStart(2, "0")}` +
    `${String(now.getDate()).padStart(2, "0")}` +
    `${String(now.getHours()).padStart(2, "0")}` +
    `${String(now.getMinutes()).padStart(2, "0")}` +
    `${String(now.getSeconds()).padStart(2, "0")}`;
  return new Promise((done) =>
    setTimeout(
      () =>
        done({
          name: "กมลชนก ธนะสิทธิ์",
          age: 42,
          gender: "ชาย",
          citizenId: "1234567890123",
          hn: "000001",
          entitlement: "UC 30 บาท",
          authenCode: stamp,
          allergies: ["Penicillin", "Sulfa", "อาหารทะเล"],
          conditions: ["เบาหวานชนิดที่ 2", "ความดันโลหิตสูง", "ไขมันในเลือดสูง"],
          phone: "0800000000",
        }),
      1400,
    ),
  );
}

/** "1234567890123" → "1 2345 67890 12 3", the way the card prints it. */
/**
 * A patient's past visits — their treatment history, in full.
 *
 * Simulated, seeded from the hospital number so the same patient always has
 * the same past. Each visit carries everything a real record would: the
 * vital signs as they were taken, the assessments and their scores, the
 * home-visit write-up section by section, and the labs that were ordered
 * with their results. A real record would come from the server; the shape
 * is what the history detail reads.
 */

/** One reading, with the verdict it drew. */
export type PastVital = { label: string; value: string; unit: string; note?: string };

/** One assessment done, and how it came out. */
export type PastAssessment = { name: string; score: string; result: string };

/** One lab ordered, and what it returned. */
export type PastLab = { name: string; value: string; ref: string; flag?: "high" | "low" };

export type PastVisit = {
  id: string;
  /** Days ago. */
  daysAgo: number;
  clinic: string;
  staff: string;
  /** The session tasks that visit recorded. */
  did: string[];
  summary: string;
  /** Vital signs taken that visit. */
  vitals: PastVital[];
  /** อาการสำคัญ / ประวัติปัจจุบัน. */
  complaint?: string;
  hpi?: string;
  /** Assessments done. */
  assessments: PastAssessment[];
  /** The home-visit write-up, where there was one. */
  homeVisit?: {
    kind: string;
    dependency: string;
    adherence: string;
    caregiver: string;
    checks: { label: string; ok: boolean }[];
    history: string;
    exam: string;
    psychosocial: string;
    problems: string;
    plan: string;
    advice: string;
  };
  /** Labs ordered, with results. */
  labs: PastLab[];
};

const HISTORY_SEED: Omit<PastVisit, "id">[] = [
  {
    daysAgo: 14,
    clinic: "คลินิกเบาหวาน / ความดัน (NCD)",
    staff: "พญ.ศิริพร วงศ์สุวรรณ",
    did: ["คัดกรองสุขภาพ", "แบบประเมิน"],
    summary:
      "น้ำตาลปลายนิ้ว 148 mg/dl ความดัน 142/88 ปรับยาเบาหวาน นัดติดตาม 2 สัปดาห์",
    complaint: "มาตามนัดติดตามเบาหวานและความดัน รู้สึกเวียนศีรษะเป็นบางครั้ง",
    hpi: "เป็นเบาหวานชนิดที่ 2 มา 6 ปี ความดันโลหิตสูง 4 ปี รับยาต่อเนื่องที่ รพ.สต. ไม่มีประวัติแพ้ยา",
    vitals: [
      { label: "ความดัน", value: "142/88", unit: "mmHg", note: "สูงเล็กน้อย" },
      { label: "อุณหภูมิ", value: "36.6", unit: "°C" },
      { label: "ชีพจร", value: "78", unit: "ครั้ง/นาที" },
      { label: "ออกซิเจน", value: "98", unit: "%" },
      { label: "น้ำตาลในเลือด", value: "148", unit: "mg/dl", note: "สูงกว่าเป้าหมาย" },
      { label: "น้ำหนัก", value: "62.5", unit: "kg" },
      { label: "ส่วนสูง", value: "158", unit: "cm" },
      { label: "รอบเอว", value: "86", unit: "cm", note: "เกินเกณฑ์" },
    ],
    assessments: [
      { name: "แบบคัดกรองภาวะเสี่ยง 35 ปีขึ้นไป", score: "เสี่ยงปานกลาง", result: "ควรควบคุมอาหารและออกกำลังกาย" },
      { name: "แบบประเมินผู้ป่วยเบาหวานความดัน", score: "8/12", result: "ควบคุมได้ปานกลาง ติดตามต่อเนื่อง" },
    ],
    labs: [],
  },
  {
    daysAgo: 45,
    clinic: "ห้องตรวจโรคทั่วไป 1",
    staff: "นพ.ธนกร พูลสวัสดิ์",
    did: ["คัดกรองสุขภาพ"],
    summary: "มาด้วยอาการปวดเข่าทั้งสองข้าง จ่ายยาแก้ปวด แนะนำการบริหารกล้ามเนื้อ",
    complaint: "ปวดเข่าทั้งสองข้างเวลาเดินขึ้นลงบันได เป็นมา 1 เดือน",
    hpi: "ปวดเข่ามากขึ้นตอนเช้าและเวลาอากาศเย็น ไม่มีอาการบวมแดง เคยกินยาแก้ปวดเองแล้วดีขึ้นชั่วคราว",
    vitals: [
      { label: "ความดัน", value: "138/84", unit: "mmHg" },
      { label: "อุณหภูมิ", value: "36.8", unit: "°C" },
      { label: "ชีพจร", value: "76", unit: "ครั้ง/นาที" },
      { label: "ออกซิเจน", value: "99", unit: "%" },
      { label: "น้ำตาลในเลือด", value: "132", unit: "mg/dl" },
      { label: "น้ำหนัก", value: "63.0", unit: "kg" },
    ],
    assessments: [],
    labs: [],
  },
  {
    daysAgo: 92,
    clinic: "คลินิกเบาหวาน / ความดัน (NCD)",
    staff: "พญ.ศิริพร วงศ์สุวรรณ",
    did: ["คัดกรองสุขภาพ", "บันทึกเยี่ยมบ้านผู้ป่วย"],
    summary: "เยี่ยมบ้าน พบพื้นห้องน้ำลื่น แนะนำติดราวจับ ผู้ดูแลเป็นบุตรสาว",
    complaint: "เยี่ยมบ้านตามแผนดูแลผู้ป่วยเรื้อรัง",
    hpi: "ผู้ป่วยอยู่บ้านคนเดียวช่วงกลางวัน บุตรสาวไปทำงาน กลับมาดูแลตอนเย็น",
    vitals: [
      { label: "ความดัน", value: "146/90", unit: "mmHg", note: "สูงเล็กน้อย" },
      { label: "อุณหภูมิ", value: "36.5", unit: "°C" },
      { label: "ชีพจร", value: "80", unit: "ครั้ง/นาที" },
      { label: "ออกซิเจน", value: "97", unit: "%" },
      { label: "น้ำตาลในเลือด", value: "155", unit: "mg/dl", note: "สูงกว่าเป้าหมาย" },
    ],
    assessments: [
      { name: "แบบประเมิน Barthel Index Score", score: "18/20", result: "ช่วยเหลือตนเองได้เกือบทั้งหมด" },
    ],
    homeVisit: {
      kind: "ติดตามอาการ",
      dependency: "ติดบ้าน",
      adherence: "กินยาไม่สม่ำเสมอ",
      caregiver: "บุตรสาว (ทำงานกลางวัน)",
      checks: [
        { label: "บ้านสะอาด ถูกสุขลักษณะ", ok: true },
        { label: "สภาพแวดล้อมปลอดภัย ไม่มีจุดเสี่ยงล้ม", ok: false },
        { label: "มีน้ำสะอาดสำหรับอุปโภคบริโภค", ok: true },
        { label: "มีห้องน้ำที่ใช้งานได้สะดวก", ok: true },
        { label: "มีผู้ดูแลหลักอยู่ด้วย", ok: false },
      ],
      history: "เวียนศีรษะขณะลุกจากเตียงตอนเช้า เป็นมาประมาณ 2 สัปดาห์ รับประทานยาเบาหวานไม่สม่ำเสมอ มักลืมมื้อเย็น",
      exam: "รู้สึกชาปลายเท้าข้างขวา เดินไม่มั่นคง ไม่พบแผลที่เท้า",
      psychosocial: "นอนหลับไม่สนิท อยู่บ้านคนเดียวช่วงกลางวัน รู้สึกเหงา ยังช่วยเหลือตนเองได้",
      problems: "1. เวียนศีรษะเมื่อเปลี่ยนท่า เสี่ยงล้ม\n2. กินยาไม่สม่ำเสมอ\n3. พื้นห้องน้ำลื่น ไม่มีราวจับ",
      plan: "1. ติดราวจับในห้องน้ำ ปูแผ่นกันลื่น\n2. จัดยาใส่ตลับรายสัปดาห์ โดยบุตรสาวช่วยจัด\n3. นัดเยี่ยมซ้ำใน 2 สัปดาห์",
      advice: "สอนวิธีลุกจากเตียงอย่างปลอดภัย ให้นั่งพักก่อนยืน ให้ความรู้เรื่องการดูแลเท้าในผู้ป่วยเบาหวาน",
    },
    labs: [],
  },
  {
    daysAgo: 180,
    clinic: "ห้องตรวจอายุรกรรม 1",
    staff: "นพ.วีรพล อินทรักษ์",
    did: ["คัดกรองสุขภาพ", "สั่งแลป"],
    summary: "ตรวจสุขภาพประจำปี ผลเลือดปกติ ยกเว้นไขมันในเลือดสูงเล็กน้อย",
    complaint: "ตรวจสุขภาพประจำปี ไม่มีอาการผิดปกติ",
    hpi: "ไม่มีอาการเจ็บป่วยเฉียบพลัน มาตรวจตามโปรแกรมสุขภาพประจำปี",
    vitals: [
      { label: "ความดัน", value: "134/82", unit: "mmHg" },
      { label: "อุณหภูมิ", value: "36.7", unit: "°C" },
      { label: "ชีพจร", value: "74", unit: "ครั้ง/นาที" },
      { label: "ออกซิเจน", value: "99", unit: "%" },
      { label: "น้ำตาลในเลือด", value: "126", unit: "mg/dl" },
      { label: "น้ำหนัก", value: "63.5", unit: "kg" },
      { label: "ส่วนสูง", value: "158", unit: "cm" },
      { label: "รอบเอว", value: "85", unit: "cm" },
    ],
    assessments: [],
    labs: [
      { name: "น้ำตาลสะสม (HbA1c)", value: "7.2", ref: "< 7.0 %", flag: "high" },
      { name: "คอเลสเตอรอลรวม", value: "218", ref: "< 200 mg/dl", flag: "high" },
      { name: "ไตรกลีเซอไรด์", value: "165", ref: "< 150 mg/dl", flag: "high" },
      { name: "การทำงานของไต (eGFR)", value: "88", ref: "> 60 mL/min", },
      { name: "การทำงานของตับ (SGPT)", value: "28", ref: "< 40 U/L", },
    ],
  },
];

/** The past visits for a patient, most recent first. */
export function treatmentHistory(hn: string): PastVisit[] {
  const n = 2 + (hn.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 3);
  return HISTORY_SEED.slice(0, n).map((v, i) => ({ ...v, id: `${hn}-${i}` }));
}

export function formatCitizenId(id: string): string {
  const d = id.replace(/\D/g, "");
  if (d.length !== 13) return id;
  return `${d[0]} ${d.slice(1, 5)} ${d.slice(5, 10)} ${d.slice(10, 12)} ${d[12]}`;
}
