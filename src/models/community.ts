import { useSyncExternalStore } from "react";

import { tr } from "../i18n";
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
  checking: tr("กำลังตรวจสอบเครื่องอ่าน", "Checking the reader"),
  ready: tr("เครื่องพร้อมใช้งาน", "Reader ready"),
  missing: tr("ไม่พบเครื่องอ่านบัตร", "No card reader found"),
  reading: tr("กำลังอ่านบัตร", "Reading card"),
};

/**
 * The rooms a community day is run out of, as the hospital names them.
 *
 * What the carer chooses is a *room*: the day is laid out as doors with
 * names on them, and the patient is sent to one. The list is the
 * hospital's own and the names are kept exactly as written on the doors,
 * because that is what the patient will be looking for. Nothing else — no
 * queue, no name on the door — a list is what was asked for. In English the
 * doors are named in English; the key, not the name, is what is kept.
 */
export type ExamRoomKey = "r1" | "r2" | "r3" | "r4" | "r5" | "r6" | "r7" | "r8" | "r9";

export const EXAM_ROOMS: { key: ExamRoomKey; name: string }[] = [
  { key: "r1", name: tr("ห้องตรวจโรคทั่วไป 1", "General examination room 1") },
  { key: "r2", name: tr("คลินิกโรคทางเดินหายใจ", "Respiratory clinic") },
  { key: "r3", name: tr("ห้องตรวจอายุรกรรม 1", "Internal medicine room 1") },
  { key: "r4", name: tr("คลินิกเบาหวาน / ความดัน (NCD)", "Diabetes / hypertension clinic (NCD)") },
  { key: "r5", name: tr("คลินิกโรคหัวใจ", "Cardiology clinic") },
  { key: "r6", name: tr("ห้องตรวจศัลยกรรมทั่วไป", "General surgery room") },
  { key: "r7", name: tr("ห้องตรวจกุมารเวชกรรม", "Pediatrics room") },
  { key: "r8", name: tr("คลินิกฝากครรภ์", "Antenatal clinic") },
  { key: "r9", name: tr("คลินิกจิตเวช / ยาเสพติด", "Psychiatry / substance use clinic") },
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
  /** What kind of appointment the visit is, where it came from the plan. */
  visitType?: string;
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
    label: tr("คัดกรองสุขภาพ", "Health screening"),
    detail: tr("บันทึกอาการสำคัญ สัญญาณชีพพื้นฐาน และคัดกรองความเสี่ยง", "Chief complaint, basic vital signs and risk screening"),
  },
  {
    key: "assessment",
    label: tr("แบบประเมิน", "Assessments"),
    detail: tr("ทำแบบประเมินสุขภาพ เช่น ADL สุขภาพจิต และดูแลผู้สูงอายุ", "Health assessments such as ADL, mental health and elderly care"),
  },
  {
    key: "diagnosis",
    label: tr("วินิจฉัยโรค", "Diagnosis"),
    detail: tr("บันทึกการวินิจฉัย รหัส ICD-10 และแผนการรักษา", "Diagnosis, ICD-10 codes and treatment plan"),
  },
  {
    key: "homevisit",
    label: tr("บันทึกเยี่ยมบ้านผู้ป่วย", "Home visit record"),
    detail: tr("สภาพบ้าน ผู้ดูแล การใช้ยา และสิ่งที่พบระหว่างเยี่ยม", "Home conditions, caregiver, medication use and findings"),
  },
  {
    key: "medication",
    label: tr("สั่งยา", "Prescribe"),
    detail: tr("สั่งจ่ายยา ระบุขนาดและวิธีใช้ และตรวจสอบการแพ้ยา", "Prescribe with dose and directions, and check drug allergies"),
  },
  // The physiotherapy row is out of the list for now — the type stays, so
  // anything already written against it is still readable, and putting the
  // row back is one entry rather than a migration.
  {
    key: "lab",
    label: tr("สั่งแลป", "Order labs"),
    detail: tr("ส่งคำสั่งตรวจทางห้องปฏิบัติการออนไลน์", "Send lab orders online"),
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
    const parts = [
      homeVisitLabel(data.kind),
      homeVisitLabel(data.dependency),
      homeVisitLabel(data.adherence),
      data.caregiver,
    ].filter((v) => v != null && v !== "");
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
    if (px > 0) parts.push(tr(`หัตถการ ${px}`, `Procedures ${px}`));
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
/** The kinds of home visit — the appointment types the plan carries. */
export const VISIT_KINDS = [
  "เยี่ยมตามนัด",
  "เยี่ยมหลัง D/C",
  "เยี่ยมก่อน Admit",
  "เยี่ยมต่อเนื่อง",
] as const;

/**
 * How far the patient can still get on their own — the three the Thai
 * community-health service files everyone under.
 */
export const DEPENDENCY = ["ติดสังคม", "ติดบ้าน", "ติดเตียง"] as const;

/** Whether the pills are being taken, in the three ways they are not. */
export const ADHERENCE = ["กินยาสม่ำเสมอ", "กินยาไม่สม่ำเสมอ", "ไม่ได้กินยา"] as const;

/*
  The three lists above are values, not labels: the Thai is what a visit
  record holds, what the templates and the scribe's answers are matched
  against, so it stays whatever the app is speaking. What the carer reads is
  `homeVisitLabel` of it.
*/
const HOME_VISIT_EN: Record<string, string> = {
  เยี่ยมตามนัด: "Scheduled visit",
  "เยี่ยมหลัง D/C": "Post-discharge visit",
  "เยี่ยมก่อน Admit": "Pre-admission visit",
  เยี่ยมต่อเนื่อง: "Continuing care visit",
  ติดสังคม: "Socially active",
  ติดบ้าน: "Homebound",
  ติดเตียง: "Bedbound",
  กินยาสม่ำเสมอ: "Takes medication regularly",
  กินยาไม่สม่ำเสมอ: "Takes medication irregularly",
  ไม่ได้กินยา: "Not taking medication",
};

/** A visit kind, dependency group or adherence value, as the carer reads it. */
export function homeVisitLabel(value: string): string;
export function homeVisitLabel(value: string | undefined): string | undefined;
export function homeVisitLabel(value: string | undefined): string | undefined {
  if (value == null) return value;
  return tr(value, HOME_VISIT_EN[value] ?? value);
}

/**
 * What the carer looks for in the house, as things that are either true or
 * not.
 *
 * Each is written so that ticking it is the good outcome — a form where
 * some ticks are good news and others are bad is one nobody can read at a
 * glance afterwards.
 */
export const HOME_CHECKS: { key: string; label: string }[] = [
  { key: "clean", label: tr("บ้านสะอาด ถูกสุขลักษณะ", "Clean and hygienic home") },
  { key: "safe", label: tr("สภาพแวดล้อมปลอดภัย ไม่มีจุดเสี่ยงล้ม", "Safe surroundings with no fall hazards") },
  { key: "water", label: tr("มีน้ำสะอาดสำหรับอุปโภคบริโภค", "Clean water for drinking and use") },
  { key: "toilet", label: tr("มีห้องน้ำที่ใช้งานได้สะดวก", "Bathroom that is easy to use") },
  { key: "caregiver", label: tr("มีผู้ดูแลหลักอยู่ด้วย", "Main caregiver present") },
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
  { key: "bp", label: tr("ความดัน", "Blood pressure"), unit: "mmHg", keyboard: "numeric", hint: "120/80", pair: true, metric: "bp" },
  { key: "temp", label: tr("อุณหภูมิ", "Temperature"), unit: "°C", keyboard: "decimal", hint: "36.5", metric: "temp" },
  { key: "pulse", label: tr("ชีพจร", "Pulse"), unit: tr("ครั้ง/นาที", "bpm"), keyboard: "numeric", hint: "72", metric: "pulse" },
  { key: "spo2", label: tr("ออกซิเจน", "Oxygen"), unit: "%", keyboard: "numeric", hint: "98", metric: "spo2" },
  { key: "glucose", label: tr("น้ำตาลในเลือด", "Blood glucose"), unit: "mg/dl", keyboard: "numeric", hint: "95", metric: "glucose" },
  { key: "weight", label: tr("น้ำหนัก", "Weight"), unit: "kg", keyboard: "decimal", hint: "62.5" },
  { key: "height", label: tr("ส่วนสูง", "Height"), unit: "cm", keyboard: "numeric", hint: "165" },
  { key: "waist", label: tr("รอบเอว", "Waist"), unit: "cm", keyboard: "numeric", hint: "80" },
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
  if (value < 18.5) return { value, label: tr("น้ำหนักน้อยกว่าเกณฑ์", "Underweight"), tone: "warn" };
  if (value < 23) return { value, label: tr("อยู่ในเกณฑ์ปกติ", "Normal"), tone: "normal" };
  if (value < 25) return { value, label: tr("น้ำหนักเกิน", "Overweight"), tone: "warn" };
  if (value < 30) return { value, label: tr("โรคอ้วนระดับ 1", "Obese class 1"), tone: "alert" };
  return { value, label: tr("โรคอ้วนระดับ 2", "Obese class 2"), tone: "alert" };
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
    if (!Number.isFinite(sys) || !Number.isFinite(dia)) return tr("กรอกเป็นตัวเลข เช่น 120/80", "Enter numbers, e.g. 120/80");
    if (sys < limit.min || sys > limit.max)
      return tr(
        `ตัวบนต้องอยู่ระหว่าง ${limit.min}–${limit.max}`,
        `Systolic must be ${limit.min}–${limit.max}`,
      );
    const d = limit.also!;
    if (dia < d.min || dia > d.max)
      return tr(
        `ตัวล่างต้องอยู่ระหว่าง ${d.min}–${d.max}`,
        `Diastolic must be ${d.min}–${d.max}`,
      );
    // The one relation between them that is not a matter of degree.
    if (dia >= sys) return tr("ตัวบนต้องมากกว่าตัวล่าง", "Systolic must be higher than diastolic");
    return null;
  }

  const value = Number(text);
  if (!Number.isFinite(value)) return tr("กรอกเป็นตัวเลข", "Enter a number");
  if (value < limit.min || value > limit.max)
    return tr(
      `ค่าต้องอยู่ระหว่าง ${limit.min}–${limit.max} ${field.unit}`,
      `Must be ${limit.min}–${limit.max} ${field.unit}`,
    );
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
    label: tr("แบบคัดกรองภาวะเสี่ยง 35 ปีขึ้นไป", "Risk screening, age 35 and over"),
    detail: tr("คัดกรองเบาหวาน ความดัน และความเสี่ยงโรคหัวใจและหลอดเลือด", "Screens for diabetes, hypertension and cardiovascular risk"),
  },
  {
    key: "asthma",
    items: 5,
    minutes: 1,
    label: tr("แบบประเมินผู้ป่วยหอบหืด", "Asthma assessment"),
    detail: tr("ประเมินการควบคุมอาการและความถี่ของการกำเริบ", "Symptom control and how often attacks occur"),
  },
  {
    key: "dyspnea",
    items: 1,
    minutes: 1,
    label: tr("แบบประเมินผู้ป่วยหายใจลำบาก", "Dyspnea assessment"),
    detail: tr("ประเมินระดับความเหนื่อยและข้อจำกัดในการใช้ชีวิต", "Breathlessness and its limits on daily life"),
  },
  {
    key: "barthel",
    items: 10,
    minutes: 5,
    label: tr("แบบประเมิน Barthel Index Score", "Barthel Index Score"),
    detail: tr("ประเมินความสามารถช่วยเหลือตนเอง 10 กิจกรรม", "Self-care ability across 10 activities"),
  },
  {
    key: "adl",
    items: 6,
    minutes: 2,
    label: tr("แบบประเมินกิจวัตรประจำวัน ADL", "Activities of daily living (ADL)"),
    detail: tr("ประเมินการทำกิจวัตรประจำวันพื้นฐาน", "Basic activities of daily living"),
  },
  {
    key: "ncd",
    items: 8,
    minutes: 3,
    label: tr("แบบประเมินผู้ป่วยเบาหวานความดัน", "Diabetes and hypertension assessment"),
    detail: tr("ติดตามการควบคุมน้ำตาลและความดันในผู้ป่วยเรื้อรัง", "Glucose and blood pressure control in chronic patients"),
  },
  {
    key: "palliative",
    items: 1,
    minutes: 2,
    label: tr("แบบประเมินผู้ป่วย Palliative Care", "Palliative care assessment"),
    detail: tr("ประเมินความต้องการการดูแลแบบประคับประคองและระดับ PPS", "Palliative care needs and PPS level"),
  },
  {
    key: "inhomesss",
    items: 9,
    minutes: 5,
    label: tr("แบบประเมิน INHOMESSS", "INHOMESSS assessment"),
    detail: tr("ประเมินผู้ป่วยที่บ้าน 9 ด้าน ตั้งแต่การเคลื่อนไหวถึงบริการที่ได้รับ", "Nine home domains, from mobility to services received"),
  },
  {
    key: "crisis",
    items: 7,
    minutes: 3,
    label: tr("แบบประเมินผู้ประสบภาวะวิกฤต", "Crisis survivor assessment"),
    detail: tr("ประเมินภาวะเครียดและความต้องการช่วยเหลือหลังเหตุวิกฤต", "Stress and support needs after a crisis"),
  },
  {
    key: "esas",
    items: 9,
    minutes: 3,
    label: tr("แบบประเมิน ESAS", "ESAS assessment"),
    detail: tr("ประเมินความรุนแรงของอาการ 9 ด้านในผู้ป่วยระยะท้าย", "Severity of nine symptoms in end-of-life patients"),
  },
  {
    key: "homecare",
    items: 12,
    minutes: 5,
    label: tr("แบบประเมินการดูแลผู้ป่วยที่บ้าน", "Home care assessment"),
    detail: tr("ประเมินความพร้อมของผู้ดูแลและแผนการดูแลต่อเนื่อง", "Caregiver readiness and the continuing care plan"),
  },
  {
    key: "mna",
    items: 6,
    minutes: 3,
    label: tr("แบบประเมินภาวะโภชนาการ (MNA)", "Nutritional assessment (MNA)"),
    detail: tr("คัดกรองภาวะทุพโภชนาการในผู้สูงอายุ", "Screens older adults for malnutrition"),
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
          entitlement: tr("UC 30 บาท", "UC 30 baht"),
          authenCode: stamp,
          allergies: ["Penicillin", "Sulfa", tr("อาหารทะเล", "Seafood")],
          conditions: tr(
            ["เบาหวานชนิดที่ 2", "ความดันโลหิตสูง", "ไขมันในเลือดสูง"],
            ["Type 2 diabetes", "Hypertension", "Hyperlipidemia"],
          ),
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
    clinic: tr("คลินิกเบาหวาน / ความดัน (NCD)", "Diabetes / hypertension clinic (NCD)"),
    staff: "พญ.ศิริพร วงศ์สุวรรณ",
    did: [tr("คัดกรองสุขภาพ", "Health screening"), tr("แบบประเมิน", "Assessments")],
    summary:
      tr("น้ำตาลปลายนิ้ว 148 mg/dl ความดัน 142/88 ปรับยาเบาหวาน นัดติดตาม 2 สัปดาห์", "Fingerstick glucose 148 mg/dl, BP 142/88. Diabetes medication adjusted; follow-up in 2 weeks"),
    complaint: tr("มาตามนัดติดตามเบาหวานและความดัน รู้สึกเวียนศีรษะเป็นบางครั้ง", "Scheduled diabetes and hypertension follow-up; occasional dizziness"),
    hpi: tr("เป็นเบาหวานชนิดที่ 2 มา 6 ปี ความดันโลหิตสูง 4 ปี รับยาต่อเนื่องที่ รพ.สต. ไม่มีประวัติแพ้ยา", "Type 2 diabetes for 6 years, hypertension for 4 years, on regular medication from the SHPH. No known drug allergies"),
    vitals: [
      { label: tr("ความดัน", "Blood pressure"), value: "142/88", unit: "mmHg", note: tr("สูงเล็กน้อย", "Slightly high") },
      { label: tr("อุณหภูมิ", "Temperature"), value: "36.6", unit: "°C" },
      { label: tr("ชีพจร", "Pulse"), value: "78", unit: tr("ครั้ง/นาที", "bpm") },
      { label: tr("ออกซิเจน", "Oxygen"), value: "98", unit: "%" },
      { label: tr("น้ำตาลในเลือด", "Blood glucose"), value: "148", unit: "mg/dl", note: tr("สูงกว่าเป้าหมาย", "Above target") },
      { label: tr("น้ำหนัก", "Weight"), value: "62.5", unit: "kg" },
      { label: tr("ส่วนสูง", "Height"), value: "158", unit: "cm" },
      { label: tr("รอบเอว", "Waist"), value: "86", unit: "cm", note: tr("เกินเกณฑ์", "Above threshold") },
    ],
    assessments: [
      { name: tr("แบบคัดกรองภาวะเสี่ยง 35 ปีขึ้นไป", "Risk screening, age 35 and over"), score: tr("เสี่ยงปานกลาง", "Moderate risk"), result: tr("ควรควบคุมอาหารและออกกำลังกาย", "Should watch diet and exercise") },
      { name: tr("แบบประเมินผู้ป่วยเบาหวานความดัน", "Diabetes and hypertension assessment"), score: "8/12", result: tr("ควบคุมได้ปานกลาง ติดตามต่อเนื่อง", "Moderately controlled; keep following up") },
    ],
    labs: [],
  },
  {
    daysAgo: 45,
    clinic: tr("ห้องตรวจโรคทั่วไป 1", "General examination room 1"),
    staff: "นพ.ธนกร พูลสวัสดิ์",
    did: [tr("คัดกรองสุขภาพ", "Health screening")],
    summary: tr("มาด้วยอาการปวดเข่าทั้งสองข้าง จ่ายยาแก้ปวด แนะนำการบริหารกล้ามเนื้อ", "Came in with pain in both knees. Analgesics given; muscle exercises advised"),
    complaint: tr("ปวดเข่าทั้งสองข้างเวลาเดินขึ้นลงบันได เป็นมา 1 เดือน", "Pain in both knees on stairs for 1 month"),
    hpi: tr("ปวดเข่ามากขึ้นตอนเช้าและเวลาอากาศเย็น ไม่มีอาการบวมแดง เคยกินยาแก้ปวดเองแล้วดีขึ้นชั่วคราว", "Worse in the morning and in cold weather. No swelling or redness. Self-medicated with analgesics, with temporary relief"),
    vitals: [
      { label: tr("ความดัน", "Blood pressure"), value: "138/84", unit: "mmHg" },
      { label: tr("อุณหภูมิ", "Temperature"), value: "36.8", unit: "°C" },
      { label: tr("ชีพจร", "Pulse"), value: "76", unit: tr("ครั้ง/นาที", "bpm") },
      { label: tr("ออกซิเจน", "Oxygen"), value: "99", unit: "%" },
      { label: tr("น้ำตาลในเลือด", "Blood glucose"), value: "132", unit: "mg/dl" },
      { label: tr("น้ำหนัก", "Weight"), value: "63.0", unit: "kg" },
    ],
    assessments: [],
    labs: [],
  },
  {
    daysAgo: 92,
    clinic: tr("คลินิกเบาหวาน / ความดัน (NCD)", "Diabetes / hypertension clinic (NCD)"),
    staff: "พญ.ศิริพร วงศ์สุวรรณ",
    did: [tr("คัดกรองสุขภาพ", "Health screening"), tr("บันทึกเยี่ยมบ้านผู้ป่วย", "Home visit record")],
    summary: tr("เยี่ยมบ้าน พบพื้นห้องน้ำลื่น แนะนำติดราวจับ ผู้ดูแลเป็นบุตรสาว", "Home visit: slippery bathroom floor, grab bars advised. Caregiver is the daughter"),
    complaint: tr("เยี่ยมบ้านตามแผนดูแลผู้ป่วยเรื้อรัง", "Home visit under the chronic care plan"),
    hpi: tr("ผู้ป่วยอยู่บ้านคนเดียวช่วงกลางวัน บุตรสาวไปทำงาน กลับมาดูแลตอนเย็น", "Alone at home during the day; the daughter works and cares for her in the evening"),
    vitals: [
      { label: tr("ความดัน", "Blood pressure"), value: "146/90", unit: "mmHg", note: tr("สูงเล็กน้อย", "Slightly high") },
      { label: tr("อุณหภูมิ", "Temperature"), value: "36.5", unit: "°C" },
      { label: tr("ชีพจร", "Pulse"), value: "80", unit: tr("ครั้ง/นาที", "bpm") },
      { label: tr("ออกซิเจน", "Oxygen"), value: "97", unit: "%" },
      { label: tr("น้ำตาลในเลือด", "Blood glucose"), value: "155", unit: "mg/dl", note: tr("สูงกว่าเป้าหมาย", "Above target") },
    ],
    assessments: [
      { name: tr("แบบประเมิน Barthel Index Score", "Barthel Index Score"), score: "18/20", result: tr("ช่วยเหลือตนเองได้เกือบทั้งหมด", "Almost fully independent") },
    ],
    homeVisit: {
      kind: homeVisitLabel("เยี่ยมต่อเนื่อง"),
      dependency: homeVisitLabel("ติดบ้าน"),
      adherence: homeVisitLabel("กินยาไม่สม่ำเสมอ"),
      caregiver: tr("บุตรสาว (ทำงานกลางวัน)", "Daughter (works days)"),
      checks: [
        { label: tr("บ้านสะอาด ถูกสุขลักษณะ", "Clean and hygienic home"), ok: true },
        { label: tr("สภาพแวดล้อมปลอดภัย ไม่มีจุดเสี่ยงล้ม", "Safe surroundings with no fall hazards"), ok: false },
        { label: tr("มีน้ำสะอาดสำหรับอุปโภคบริโภค", "Clean water for drinking and use"), ok: true },
        { label: tr("มีห้องน้ำที่ใช้งานได้สะดวก", "Bathroom that is easy to use"), ok: true },
        { label: tr("มีผู้ดูแลหลักอยู่ด้วย", "Main caregiver present"), ok: false },
      ],
      history: tr("เวียนศีรษะขณะลุกจากเตียงตอนเช้า เป็นมาประมาณ 2 สัปดาห์ รับประทานยาเบาหวานไม่สม่ำเสมอ มักลืมมื้อเย็น", "Dizzy on getting out of bed in the morning for about 2 weeks. Takes diabetes medication irregularly, often missing the evening dose"),
      exam: tr("รู้สึกชาปลายเท้าข้างขวา เดินไม่มั่นคง ไม่พบแผลที่เท้า", "Numbness in the right foot, unsteady gait, no foot wounds"),
      psychosocial: tr("นอนหลับไม่สนิท อยู่บ้านคนเดียวช่วงกลางวัน รู้สึกเหงา ยังช่วยเหลือตนเองได้", "Poor sleep, alone during the day, feels lonely, still independent in self-care"),
      problems: tr("1. เวียนศีรษะเมื่อเปลี่ยนท่า เสี่ยงล้ม\n2. กินยาไม่สม่ำเสมอ\n3. พื้นห้องน้ำลื่น ไม่มีราวจับ", "1. Postural dizziness, fall risk\n2. Irregular medication use\n3. Slippery bathroom floor, no grab bars"),
      plan: tr("1. ติดราวจับในห้องน้ำ ปูแผ่นกันลื่น\n2. จัดยาใส่ตลับรายสัปดาห์ โดยบุตรสาวช่วยจัด\n3. นัดเยี่ยมซ้ำใน 2 สัปดาห์", "1. Install bathroom grab bars and non-slip mats\n2. Weekly pill organizer, filled with the daughter's help\n3. Revisit in 2 weeks"),
      advice: tr("สอนวิธีลุกจากเตียงอย่างปลอดภัย ให้นั่งพักก่อนยืน ให้ความรู้เรื่องการดูแลเท้าในผู้ป่วยเบาหวาน", "Taught safe getting out of bed, sitting before standing, and diabetic foot care"),
    },
    labs: [],
  },
  {
    daysAgo: 180,
    clinic: tr("ห้องตรวจอายุรกรรม 1", "Internal medicine room 1"),
    staff: "นพ.วีรพล อินทรักษ์",
    did: [tr("คัดกรองสุขภาพ", "Health screening"), tr("สั่งแลป", "Order labs")],
    summary: tr("ตรวจสุขภาพประจำปี ผลเลือดปกติ ยกเว้นไขมันในเลือดสูงเล็กน้อย", "Annual check-up. Blood results normal except slightly high lipids"),
    complaint: tr("ตรวจสุขภาพประจำปี ไม่มีอาการผิดปกติ", "Annual check-up, no symptoms"),
    hpi: tr("ไม่มีอาการเจ็บป่วยเฉียบพลัน มาตรวจตามโปรแกรมสุขภาพประจำปี", "No acute illness; attending the annual health program"),
    vitals: [
      { label: tr("ความดัน", "Blood pressure"), value: "134/82", unit: "mmHg" },
      { label: tr("อุณหภูมิ", "Temperature"), value: "36.7", unit: "°C" },
      { label: tr("ชีพจร", "Pulse"), value: "74", unit: tr("ครั้ง/นาที", "bpm") },
      { label: tr("ออกซิเจน", "Oxygen"), value: "99", unit: "%" },
      { label: tr("น้ำตาลในเลือด", "Blood glucose"), value: "126", unit: "mg/dl" },
      { label: tr("น้ำหนัก", "Weight"), value: "63.5", unit: "kg" },
      { label: tr("ส่วนสูง", "Height"), value: "158", unit: "cm" },
      { label: tr("รอบเอว", "Waist"), value: "85", unit: "cm" },
    ],
    assessments: [],
    labs: [
      { name: tr("น้ำตาลสะสม (HbA1c)", "HbA1c"), value: "7.2", ref: "< 7.0 %", flag: "high" },
      { name: tr("คอเลสเตอรอลรวม", "Total cholesterol"), value: "218", ref: "< 200 mg/dl", flag: "high" },
      { name: tr("ไตรกลีเซอไรด์", "Triglycerides"), value: "165", ref: "< 150 mg/dl", flag: "high" },
      { name: tr("การทำงานของไต (eGFR)", "Kidney function (eGFR)"), value: "88", ref: "> 60 mL/min", },
      { name: tr("การทำงานของตับ (SGPT)", "Liver function (SGPT)"), value: "28", ref: "< 40 U/L", },
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
