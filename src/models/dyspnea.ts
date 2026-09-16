import type { Tone } from "./assessments";

/**
 * แบบประเมินผู้ป่วยหายใจลำบาก — the mMRC dyspnoea scale.
 *
 * The Modified Medical Research Council scale: five sentences, the patient
 * picks the one that is them, graded 0 to 4. It is what the Thai COPD
 * guideline (สมาคมอุรเวชช์ฯ, 2565) uses to sort symptom burden — 0–1 is
 * the low-symptom group, 2 and over the high — and the wording below is the
 * guideline's own, taken from its teaching set, not a translation of ours.
 */
export const MMRC = [
  { grade: 0, text: "รู้สึกหายใจหอบขณะออกกำลังกายอย่างหนักเท่านั้น" },
  { grade: 1, text: "หายใจหอบเมื่อเดินอย่างเร่งรีบบนพื้นราบ หรือเมื่อเดินขึ้นที่สูงชัน" },
  {
    grade: 2,
    text: "เดินบนพื้นราบได้ช้ากว่าคนอื่นที่อยู่ในวัยเดียวกันเพราะหายใจหอบ หรือต้องหยุดเพื่อหายใจเมื่อเดินตามปกติบนพื้นราบ",
  },
  {
    grade: 3,
    text: "ต้องหยุดเพื่อหายใจหลังจากเดินได้ประมาณ 100 เมตร หรือหลังจากเดินได้สักพักบนพื้นราบ",
  },
  {
    grade: 4,
    text: "หายใจหอบมากเกินกว่าที่จะออกจากบ้าน หรือหอบมากขณะแต่งตัวหรือเปลี่ยนเครื่องแต่งตัว",
  },
] as const;

export type DyspneaResult = {
  grade: number;
  /** "อาการน้อย" (0–1) or "อาการมาก" (≥2), the guideline's two groups. */
  group: string;
  tone: Tone;
  advice: string;
  /** Oxygen under 90% — a separate alarm whatever the grade. */
  lowOxygen: boolean;
};

/**
 * Read a grade, and the oxygen if the screening took one, into advice.
 *
 * The guideline's line is at 2: under it the advice is to keep moving and
 * keep the appointment; at it and over, to be seen and have the treatment
 * looked at, and at 4 to be seen soon. A saturation under 90% is called out
 * on its own — a person can pick sentence 1 and still be short of air.
 */
export function dyspneaResult(grade: number, spo2: number | null): DyspneaResult {
  const lowOxygen = spo2 != null && spo2 < 90;
  const group = grade >= 2 ? "อาการมาก" : "อาการน้อย";
  const tone: Tone = lowOxygen || grade >= 3 ? "bad" : grade === 2 ? "warn" : "good";

  let advice: string;
  if (grade >= 4) {
    advice =
      "หายใจลำบากรุนแรง ส่งพบแพทย์โดยเร็ว ประเมินความจำเป็นในการใช้ออกซิเจนที่บ้านและการดูแลต่อเนื่อง";
  } else if (grade >= 2) {
    advice =
      "อาการมาก (mMRC ≥ 2) ควรพบแพทย์เพื่อประเมินและปรับการรักษา พิจารณาส่งฟื้นฟูสมรรถภาพปอด";
  } else if (grade === 1) {
    advice = "อาการน้อย (mMRC 0–1) แนะนำออกกำลังกายสม่ำเสมอ เลิกบุหรี่ และติดตามตามนัด";
  } else {
    advice = "หายใจหอบเฉพาะออกแรงหนัก ไม่รบกวนกิจวัตร ติดตามตามนัดตามปกติ";
  }
  if (lowOxygen) {
    advice = `ออกซิเจนปลายนิ้ว ${spo2}% ต่ำกว่า 90% ส่งต่อพบแพทย์วันนี้ · ${advice}`;
  }
  return { grade, group, tone, advice, lowOxygen };
}
