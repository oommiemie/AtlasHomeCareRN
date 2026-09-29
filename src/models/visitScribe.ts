import { useSyncExternalStore } from "react";

import { tr } from "../i18n";

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
  { key: "history", label: tr("การซักประวัติ", "History"), ask: tr("อาการเป็นมานานเท่าไหร่ กินยาอะไรอยู่บ้าง", "How long have the symptoms lasted? What medications are they taking?") },
  { key: "exam", label: tr("การตรวจร่างกาย", "Examination"), ask: tr("ขอวัดความดันและดูแผล/ข้อจำกัดการเคลื่อนไหว", "Take blood pressure and check wounds / mobility limits") },
  { key: "psychosocial", label: tr("จิตใจและสังคม", "Psychosocial"), ask: tr("นอนหลับดีไหม มีใครดูแลช่วงกลางวัน", "Are they sleeping well? Who looks after them during the day?") },
  { key: "problems", label: tr("ปัญหาที่พบ", "Problems found"), ask: tr("มีอะไรที่ทำเองไม่ไหว หรือกังวลเป็นพิเศษ", "Anything they can't manage alone, or are especially worried about?") },
  { key: "plan", label: tr("แผนการดูแล", "Care plan"), ask: tr("ตกลงเรื่องนัดหมายและสิ่งที่ต้องทำต่อ", "Agree on the next appointment and what happens next") },
  { key: "advice", label: tr("ความรู้และข้อแนะนำ", "Education and advice"), ask: tr("อธิบายวิธีดูแลและสิ่งที่ต้องระวัง", "Explain how to care for themselves and what to watch for") },
];

/**
 * The conversation, as it arrives.
 *
 * Written as one plausible visit — an elderly diabetic living with her
 * daughter — because a demonstration needs a case, and a generic one
 * demonstrates nothing. `at` is seconds from the start.
 */
export const SCRIBE_TRANSCRIPT: Turn[] = [
  { at: 1.5, who: "carer", text: tr("สวัสดีค่ะคุณยาย วันนี้มาดูอาการนะคะ ช่วงนี้เป็นยังไงบ้างคะ", "Hello, Grandma. I'm here to check on you today. How have you been lately?") },
  { at: 4.5, who: "patient", text: tr("ก็เรื่อยๆ นะ แต่เวียนหัวบ่อย ตอนลุกจากเตียงตอนเช้า", "Getting by, but I often feel dizzy when I get out of bed in the morning."), covers: "history" },
  { at: 8, who: "carer", text: tr("เวียนมานานเท่าไหร่แล้วคะ แล้วยาเบาหวานยังกินครบไหม", "How long has the dizziness been going on? And are you still taking all your diabetes pills?") },
  { at: 11.5, who: "patient", text: tr("ประมาณสองอาทิตย์ ยากินบ้างลืมบ้าง ตอนเย็นมักลืม", "About two weeks. I take them sometimes and forget sometimes — usually the evening ones."), covers: "history" },
  { at: 15.5, who: "carer", text: tr("ขอวัดความดันหน่อยนะคะ แล้วขอดูเท้าด้วยค่ะ", "Let me take your blood pressure, and I'd like to look at your feet too.") },
  { at: 19, who: "patient", text: tr("เท้าข้างขวามันชาๆ มาสักพักแล้ว เดินแล้วไม่ค่อยมั่นใจ", "My right foot has been numb for a while. I don't feel steady when I walk."), covers: "exam" },
  { at: 23, who: "carer", text: tr("กลางคืนนอนหลับดีไหมคะ แล้วกลางวันมีใครอยู่เป็นเพื่อนบ้าง", "Do you sleep well at night? And who is with you during the day?") },
  { at: 26.5, who: "patient", text: tr("หลับไม่ค่อยสนิท ลูกสาวไปทำงาน กลางวันอยู่คนเดียว เหงาเหมือนกัน", "I don't sleep very well. My daughter goes to work, so I'm alone during the day. It gets lonely."), covers: "psychosocial" },
  { at: 31, who: "carer", text: tr("มีอะไรที่ทำเองไม่ค่อยไหวบ้างคะ", "Is there anything you find hard to do on your own?") },
  { at: 34, who: "patient", text: tr("อาบน้ำเองได้ แต่ก้าวเข้าห้องน้ำลำบาก พื้นมันลื่น ไม่มีที่จับ", "I can bathe myself, but stepping into the bathroom is hard. The floor is slippery and there's nothing to hold on to."), covers: "problems" },
  { at: 38.5, who: "carer", text: tr("งั้นเดี๋ยวแนะนำให้ติดราวจับนะคะ แล้วเรื่องยาจะจัดใส่ตลับรายสัปดาห์ให้", "Then I'll recommend putting in a grab bar, and I'll set up your pills in a weekly organizer.") },
  { at: 43, who: "patient", text: tr("ได้ค่ะ เดี๋ยวบอกลูกสาวให้ช่วยจัด", "All right, I'll ask my daughter to help set it up."), covers: "plan" },
  { at: 46.5, who: "carer", text: tr("เรื่องเวียนหัว ให้ลุกช้าๆ นั่งก่อนสักครู่แล้วค่อยยืนนะคะ ถ้าเป็นถี่ขึ้นให้โทรมาเลย", "For the dizziness, get up slowly — sit for a moment before you stand. If it happens more often, call us right away.") },
  { at: 51, who: "patient", text: tr("จำได้ค่ะ ลุกช้าๆ", "Got it. Get up slowly."), covers: "advice" },
  { at: 54, who: "carer", text: tr("อีกสองสัปดาห์จะมาดูใหม่นะคะ ขอบคุณค่ะคุณยาย", "I'll come back to see you in two weeks. Thank you, Grandma.") },
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
    history: tr(
      "เวียนศีรษะขณะลุกจากเตียงตอนเช้า เป็นมาประมาณ 2 สัปดาห์ " +
        "เป็นเบาหวานเดิม รับประทานยาไม่สม่ำเสมอ มักลืมมื้อเย็น",
      "Dizziness on getting out of bed in the morning for about 2 weeks. " +
        "Known diabetic; takes medication irregularly, often misses the evening dose.",
    ),
    exam: tr(
      "รู้สึกชาปลายเท้าข้างขวา เดินไม่มั่นคง ไม่พบแผลที่เท้า " +
        "แนะนำให้ตรวจความดันท่านอนและท่ายืนเปรียบเทียบ",
      "Numbness of the right foot, unsteady gait. No foot wounds. " +
        "Recommend comparing lying and standing blood pressure.",
    ),
    psychosocial: tr(
      "นอนหลับไม่สนิท อยู่บ้านคนเดียวช่วงกลางวันเนื่องจากบุตรสาวไปทำงาน " +
        "รู้สึกเหงา ยังสื่อสารและช่วยเหลือตนเองได้",
      "Poor sleep. Alone at home during the day while her daughter works. " +
        "Feels lonely; still communicates well and is independent in self-care.",
    ),
    problems: tr(
      "1. เวียนศีรษะเมื่อเปลี่ยนท่า เสี่ยงต่อการล้ม\n" +
        "2. รับประทานยาเบาหวานไม่สม่ำเสมอ\n" +
        "3. พื้นห้องน้ำลื่นและไม่มีราวจับ\n" +
        "4. ขาดผู้ดูแลช่วงกลางวัน",
      "1. Dizziness on changing position; fall risk\n" +
        "2. Irregular diabetes medication\n" +
        "3. Slippery bathroom floor with no grab bar\n" +
        "4. No caregiver during the day",
    ),
    plan: tr(
      "1. แนะนำติดราวจับในห้องน้ำและปูแผ่นกันลื่น\n" +
        "2. จัดยาใส่ตลับรายสัปดาห์ โดยบุตรสาวช่วยจัด\n" +
        "3. ติดตามระดับน้ำตาลและความดันในการเยี่ยมครั้งถัดไป\n" +
        "4. นัดเยี่ยมซ้ำใน 2 สัปดาห์",
      "1. Recommend a bathroom grab bar and non-slip mat\n" +
        "2. Set up a weekly pill organizer, with her daughter's help\n" +
        "3. Check blood glucose and blood pressure at the next visit\n" +
        "4. Repeat visit in 2 weeks",
    ),
    advice: tr(
      "สอนวิธีลุกจากเตียงอย่างปลอดภัย ให้นั่งพักก่อนยืน " +
        "แนะนำให้โทรแจ้งทันทีหากเวียนศีรษะถี่ขึ้นหรือมีอาการหน้ามืดจะเป็นลม " +
        "ให้ความรู้เรื่องการดูแลเท้าในผู้ป่วยเบาหวาน",
      "Taught how to get out of bed safely, sitting before standing. " +
        "Advised to call at once if dizziness becomes more frequent or she feels faint. " +
        "Educated on diabetic foot care.",
    ),
    summary: tr(
      "ผู้ป่วยหญิงสูงอายุ โรคเบาหวาน อาการโดยรวมคงที่ " +
        "พบปัญหาเวียนศีรษะเมื่อเปลี่ยนท่าและการรับประทานยาไม่สม่ำเสมอ " +
        "ร่วมกับสภาพบ้านที่เสี่ยงต่อการล้ม ให้คำแนะนำและวางแผนแก้ไขร่วมกับบุตรสาวแล้ว " +
        "นัดติดตามใน 2 สัปดาห์",
      "Older woman with diabetes, overall stable. " +
        "Found orthostatic dizziness and irregular medication taking, " +
        "with fall hazards at home. Advice given and a plan agreed with her daughter. " +
        "Follow-up in 2 weeks.",
    ),
    // The choices the form asks for, answered from the same conversation —
    // the form's own values, which stay Thai; the form translates them.
    kind: "เยี่ยมต่อเนื่อง",
    dependency: "ติดบ้าน",
    adherence: "กินยาไม่สม่ำเสมอ",
    caregiver: tr("บุตรสาว (ทำงานกลางวัน)", "Daughter (works during the day)"),
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
