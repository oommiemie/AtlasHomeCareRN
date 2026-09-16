import { useSyncExternalStore } from "react";

/**
 * The assistant that sits in on a home visit and writes it up.
 *
 * A carer on a round is doing two jobs at once: talking to the patient, and
 * remembering to ask everything, and then writing down what was said — and
 * the third of those is what gets done in the car afterwards, badly. This
 * listens instead, keeps the questions in front of them as they go, and
 * hands back a draft of the form at the end.
 *
 * Simulated here, the way the card reader and the instruments are: there is
 * no speech recogniser and no model in this build, so the conversation
 * arrives on a timer and the draft is written from a table. What is real is
 * the shape — a transcript that builds, a checklist that ticks itself off as
 * subjects are covered, and a draft that must be read and confirmed before
 * a single box on the form is touched. Swapping in a real recogniser and a
 * real model means replacing what is below and nothing above it.
 */

/** One line of what was said. */
export type Turn = {
  at: number;
  who: "carer" | "patient";
  text: string;
  /** Which of the form's sections this line fed, if any. */
  covers?: string;
};

/**
 * The subjects a home visit has to cover, in the order they come up.
 *
 * Held as a checklist rather than a script to be read aloud: a visit is a
 * conversation, and a carer reading questions off a phone is a carer not
 * looking at the patient. What this is for is the one at the bottom of the
 * list that always gets forgotten.
 */
export const SCRIBE_TOPICS: { key: string; label: string; ask: string }[] = [
  { key: "history", label: "การซักประวัติ", ask: "อาการเป็นมานานเท่าไหร่ กินยาอะไรอยู่บ้าง" },
  { key: "exam", label: "การตรวจร่างกาย", ask: "ขอวัดความดันและดูแผล/ข้อจำกัดการเคลื่อนไหว" },
  { key: "psychosocial", label: "จิตใจและสังคม", ask: "นอนหลับดีไหม มีใครดูแลช่วงกลางวัน" },
  { key: "problems", label: "ปัญหาที่พบ", ask: "มีอะไรที่ทำเองไม่ไหว หรือกังวลเป็นพิเศษ" },
  { key: "plan", label: "แผนการดูแล", ask: "ตกลงเรื่องนัดหมายและสิ่งที่ต้องทำต่อ" },
  { key: "advice", label: "ความรู้และข้อแนะนำ", ask: "อธิบายวิธีดูแลและสิ่งที่ต้องระวัง" },
];

/**
 * The conversation, as it arrives.
 *
 * Written as one plausible visit — an elderly diabetic living with her
 * daughter — because a demonstration needs a case, and a generic one
 * demonstrates nothing. `at` is seconds from the start.
 */
export const SCRIBE_TRANSCRIPT: Turn[] = [
  { at: 1.5, who: "carer", text: "สวัสดีค่ะคุณยาย วันนี้มาดูอาการนะคะ ช่วงนี้เป็นยังไงบ้างคะ" },
  { at: 4.5, who: "patient", text: "ก็เรื่อยๆ นะ แต่เวียนหัวบ่อย ตอนลุกจากเตียงตอนเช้า", covers: "history" },
  { at: 8, who: "carer", text: "เวียนมานานเท่าไหร่แล้วคะ แล้วยาเบาหวานยังกินครบไหม" },
  { at: 11.5, who: "patient", text: "ประมาณสองอาทิตย์ ยากินบ้างลืมบ้าง ตอนเย็นมักลืม", covers: "history" },
  { at: 15.5, who: "carer", text: "ขอวัดความดันหน่อยนะคะ แล้วขอดูเท้าด้วยค่ะ" },
  { at: 19, who: "patient", text: "เท้าข้างขวามันชาๆ มาสักพักแล้ว เดินแล้วไม่ค่อยมั่นใจ", covers: "exam" },
  { at: 23, who: "carer", text: "กลางคืนนอนหลับดีไหมคะ แล้วกลางวันมีใครอยู่เป็นเพื่อนบ้าง" },
  { at: 26.5, who: "patient", text: "หลับไม่ค่อยสนิท ลูกสาวไปทำงาน กลางวันอยู่คนเดียว เหงาเหมือนกัน", covers: "psychosocial" },
  { at: 31, who: "carer", text: "มีอะไรที่ทำเองไม่ค่อยไหวบ้างคะ" },
  { at: 34, who: "patient", text: "อาบน้ำเองได้ แต่ก้าวเข้าห้องน้ำลำบาก พื้นมันลื่น ไม่มีที่จับ", covers: "problems" },
  { at: 38.5, who: "carer", text: "งั้นเดี๋ยวแนะนำให้ติดราวจับนะคะ แล้วเรื่องยาจะจัดใส่ตลับรายสัปดาห์ให้" },
  { at: 43, who: "patient", text: "ได้ค่ะ เดี๋ยวบอกลูกสาวให้ช่วยจัด", covers: "plan" },
  { at: 46.5, who: "carer", text: "เรื่องเวียนหัว ให้ลุกช้าๆ นั่งก่อนสักครู่แล้วค่อยยืนนะคะ ถ้าเป็นถี่ขึ้นให้โทรมาเลย" },
  { at: 51, who: "patient", text: "จำได้ค่ะ ลุกช้าๆ", covers: "advice" },
  { at: 54, who: "carer", text: "อีกสองสัปดาห์จะมาดูใหม่นะคะ ขอบคุณค่ะคุณยาย" },
];

/** How long the whole conversation runs. */
export const SCRIBE_SECONDS =
  SCRIBE_TRANSCRIPT[SCRIBE_TRANSCRIPT.length - 1].at + 3;

/**
 * The draft, section by section.
 *
 * Keyed to the form's own fields, because the point of the exercise is that
 * the carer reads this once and the form fills itself — a summary in prose
 * that then has to be cut up and pasted into eight boxes is the typing back
 * again with extra steps.
 */
export function scribeDraft(): Record<string, string> {
  return {
    history:
      "เวียนศีรษะขณะลุกจากเตียงตอนเช้า เป็นมาประมาณ 2 สัปดาห์ " +
      "เป็นเบาหวานเดิม รับประทานยาไม่สม่ำเสมอ มักลืมมื้อเย็น",
    exam:
      "รู้สึกชาปลายเท้าข้างขวา เดินไม่มั่นคง ไม่พบแผลที่เท้า " +
      "แนะนำให้ตรวจความดันท่านอนและท่ายืนเปรียบเทียบ",
    psychosocial:
      "นอนหลับไม่สนิท อยู่บ้านคนเดียวช่วงกลางวันเนื่องจากบุตรสาวไปทำงาน " +
      "รู้สึกเหงา ยังสื่อสารและช่วยเหลือตนเองได้",
    problems:
      "1. เวียนศีรษะเมื่อเปลี่ยนท่า เสี่ยงต่อการล้ม\n" +
      "2. รับประทานยาเบาหวานไม่สม่ำเสมอ\n" +
      "3. พื้นห้องน้ำลื่นและไม่มีราวจับ\n" +
      "4. ขาดผู้ดูแลช่วงกลางวัน",
    plan:
      "1. แนะนำติดราวจับในห้องน้ำและปูแผ่นกันลื่น\n" +
      "2. จัดยาใส่ตลับรายสัปดาห์ โดยบุตรสาวช่วยจัด\n" +
      "3. ติดตามระดับน้ำตาลและความดันในการเยี่ยมครั้งถัดไป\n" +
      "4. นัดเยี่ยมซ้ำใน 2 สัปดาห์",
    advice:
      "สอนวิธีลุกจากเตียงอย่างปลอดภัย ให้นั่งพักก่อนยืน " +
      "แนะนำให้โทรแจ้งทันทีหากเวียนศีรษะถี่ขึ้นหรือมีอาการหน้ามืดจะเป็นลม " +
      "ให้ความรู้เรื่องการดูแลเท้าในผู้ป่วยเบาหวาน",
    summary:
      "ผู้ป่วยหญิงสูงอายุ โรคเบาหวาน อาการโดยรวมคงที่ " +
      "พบปัญหาเวียนศีรษะเมื่อเปลี่ยนท่าและการรับประทานยาไม่สม่ำเสมอ " +
      "ร่วมกับสภาพบ้านที่เสี่ยงต่อการล้ม ให้คำแนะนำและวางแผนแก้ไขร่วมกับบุตรสาวแล้ว " +
      "นัดติดตามใน 2 สัปดาห์",
    // The choices the form asks for, answered from the same conversation.
    kind: "ติดตามอาการ",
    dependency: "ติดบ้าน",
    adherence: "กินยาไม่สม่ำเสมอ",
    caregiver: "บุตรสาว (ทำงานกลางวัน)",
  };
}

/*
  Every conversation the assistant has listened to, kept.

  A visit can be more than one interview — the patient, then the daughter
  when she gets home, then the patient again once the daughter has said
  what she said — and each one produces a draft. The draft is kept the
  moment the conversation ends, before the carer has decided anything
  about it, so declining to use it now is not the same as losing it: it
  waits in the history, and any of them can be brought back and put into
  the form later. Per Authen Code, like the rest of the visit.
*/

/** One conversation, written up. */
export type ScribeRecord = {
  id: string;
  /** Which conversation of this visit it was, counting from one. */
  n: number;
  /** When it ended. */
  endedAt: Date;
  /** How long it ran, in seconds. */
  seconds: number;
  /** The draft, keyed by the form's fields. */
  draft: Record<string, string>;
};

const history = new Map<string, ScribeRecord[]>();
const watchers = new Set<() => void>();
const NONE: ScribeRecord[] = [];

/** Keep a finished conversation, and hand back its record. */
export function addScribeRecord(
  authenCode: string,
  seconds: number,
  draft: Record<string, string>,
): ScribeRecord {
  const had = history.get(authenCode) ?? [];
  const record: ScribeRecord = {
    id: `${authenCode}-${had.length + 1}-${Date.now()}`,
    n: had.length + 1,
    endedAt: new Date(),
    seconds,
    draft,
  };
  // A fresh array each time, so a subscriber comparing by identity sees it.
  history.set(authenCode, [...had, record]);
  for (const w of watchers) w();
  return record;
}

/** The conversations this visit has had so far, oldest first — live. */
export function useScribeHistory(authenCode: string): ScribeRecord[] {
  return useSyncExternalStore(
    (onChange) => {
      watchers.add(onChange);
      return () => {
        watchers.delete(onChange);
      };
    },
    () => history.get(authenCode) ?? NONE,
  );
}
