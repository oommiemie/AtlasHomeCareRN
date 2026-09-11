import { useSyncExternalStore } from "react";

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
};

/** The three things a session can record — Figma 94:11702. */
export type SessionTask = "screening" | "assessment" | "lab";

/*
  What this visit has recorded so far.

  Kept per Authen Code, because that is what a visit *is* — one card, one
  read, one code — and kept here rather than in a screen's state because the
  saving happens two screens away from the page that has to know about it.
  A form saves, pops back to the record, and the record's "finish" appears:
  the page cannot end a visit that has nothing in it, so the way out is not
  offered until there is something to end.

  A module-level map and a listener set: three pages and one fact do not
  need a store library. `useSessionDone` is a plain external-store hook.
*/
const progress = new Map<string, Set<SessionTask>>();
const watchers = new Set<() => void>();
const NONE: ReadonlySet<SessionTask> = new Set();

/** Record that one of the session's tasks has been saved. */
export function markDone(authenCode: string, task: SessionTask): void {
  const was = progress.get(authenCode);
  // A fresh set each time, so a subscriber comparing by identity sees it.
  const next = new Set(was ?? []);
  next.add(task);
  progress.set(authenCode, next);
  for (const w of watchers) w();
}

/** Which of the session's tasks have been saved — live. */
export function useSessionDone(authenCode: string): ReadonlySet<SessionTask> {
  return useSyncExternalStore(
    (onChange) => {
      watchers.add(onChange);
      return () => {
        watchers.delete(onChange);
      };
    },
    () => progress.get(authenCode) ?? NONE,
  );
}

export const SESSION_TASKS: {
  key: SessionTask;
  label: string;
  detail: string;
}[] = [
  {
    key: "screening",
    label: "คัดกรองข้อมูลสุขภาพ",
    detail: "บันทึกอาการสำคัญ สัญญาณชีพพื้นฐาน และคัดกรองความเสี่ยง",
  },
  {
    key: "assessment",
    label: "แบบประเมิน",
    detail: "ทำแบบประเมินสุขภาพ เช่น ADL สุขภาพจิต และดูแลผู้สูงอายุ",
  },
  {
    key: "lab",
    label: "สั่งแลป",
    detail: "ส่งคำสั่งตรวจทางห้องปฏิบัติการออนไลน์",
  },
];

/** The vital signs the screening form takes — Figma 98:12765. */
export const SCREENING_FIELDS: {
  key: string;
  label: string;
  unit: string;
  keyboard: "numeric" | "decimal";
  /** "120/80" rather than one number. */
  pair?: boolean;
}[] = [
  { key: "bp", label: "ความดัน", unit: "mmHg", keyboard: "numeric", pair: true },
  { key: "temp", label: "อุณหภูมิ", unit: "°C", keyboard: "decimal" },
  { key: "pulse", label: "ชีพจร", unit: "ครั้ง/นาที", keyboard: "numeric" },
  { key: "spo2", label: "ออกซิเจน", unit: "%", keyboard: "numeric" },
  { key: "glucose", label: "น้ำตาลในเลือด", unit: "mg/dl", keyboard: "numeric" },
  { key: "weight", label: "น้ำหนัก", unit: "kg", keyboard: "decimal" },
  { key: "height", label: "ส่วนสูง", unit: "cm", keyboard: "numeric" },
  { key: "waist", label: "รอบเอว", unit: "cm", keyboard: "numeric" },
];

/** The forms the assessment page lists — Figma 98:13058. */
export const ASSESSMENTS: { key: string; label: string; detail: string }[] = [
  {
    key: "risk35",
    label: "แบบคัดกรองภาวะเสี่ยง 35 ปี ขึ้นไป",
    detail: "คัดกรองเบาหวาน ความดัน และความเสี่ยงโรคหัวใจและหลอดเลือด",
  },
  {
    key: "asthma",
    label: "แบบประเมินผู้ป่วยหอบหืด",
    detail: "ประเมินการควบคุมอาการและความถี่ของการกำเริบ",
  },
  {
    key: "dyspnea",
    label: "แบบประเมินผู้ป่วยหายใจลำบาก",
    detail: "ประเมินระดับความเหนื่อยและข้อจำกัดในการใช้ชีวิต",
  },
  {
    key: "barthel",
    label: "แบบประเมิน Barthel Index Score",
    detail: "ประเมินความสามารถในการช่วยเหลือตนเองของผู้สูงอายุ",
  },
  {
    key: "adl",
    label: "แบบประเมินกิจวัตรประจำวัน ADL",
    detail: "ประเมินการทำกิจวัตรประจำวันพื้นฐาน",
  },
  {
    key: "mental",
    label: "แบบประเมินสุขภาพจิต 2Q / 9Q",
    detail: "คัดกรองภาวะซึมเศร้าเบื้องต้น",
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
        }),
      1400,
    ),
  );
}

/** "1234567890123" → "1 2345 67890 12 3", the way the card prints it. */
export function formatCitizenId(id: string): string {
  const d = id.replace(/\D/g, "");
  if (d.length !== 13) return id;
  return `${d[0]} ${d.slice(1, 5)} ${d.slice(5, 10)} ${d.slice(10, 12)} ${d[12]}`;
}
