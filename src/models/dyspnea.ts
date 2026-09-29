import { tr } from "../i18n";
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
  { grade: 0, text: tr("รู้สึกหายใจหอบขณะออกกำลังกายอย่างหนักเท่านั้น", "I only get breathless with strenuous exercise") },
  { grade: 1, text: tr("หายใจหอบเมื่อเดินอย่างเร่งรีบบนพื้นราบ หรือเมื่อเดินขึ้นที่สูงชัน", "I get short of breath when hurrying on the level or walking up a slight hill") },
  {
    grade: 2,
    text: tr("เดินบนพื้นราบได้ช้ากว่าคนอื่นที่อยู่ในวัยเดียวกันเพราะหายใจหอบ หรือต้องหยุดเพื่อหายใจเมื่อเดินตามปกติบนพื้นราบ", "I walk slower than people of the same age on the level because of breathlessness, or I have to stop for breath when walking at my own pace on the level"),
  },
  {
    grade: 3,
    text: tr("ต้องหยุดเพื่อหายใจหลังจากเดินได้ประมาณ 100 เมตร หรือหลังจากเดินได้สักพักบนพื้นราบ", "I stop for breath after walking about 100 meters or after a few minutes on the level"),
  },
  {
    grade: 4,
    text: tr("หายใจหอบมากเกินกว่าที่จะออกจากบ้าน หรือหอบมากขณะแต่งตัวหรือเปลี่ยนเครื่องแต่งตัว", "I am too breathless to leave the house or I am breathless when dressing or undressing"),
  },
] as const;

export type DyspneaResult = {
  grade: number;
  /** tr("อาการน้อย", "Fewer symptoms") (0–1) or tr("อาการมาก", "More symptoms") (≥2), the guideline's two groups. */
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
  const group = grade >= 2 ? tr("อาการมาก", "More symptoms") : tr("อาการน้อย", "Fewer symptoms");
  const tone: Tone = lowOxygen || grade >= 3 ? "bad" : grade === 2 ? "warn" : "good";

  let advice: string;
  if (grade >= 4) {
    advice =
      tr("หายใจลำบากรุนแรง ส่งพบแพทย์โดยเร็ว ประเมินความจำเป็นในการใช้ออกซิเจนที่บ้านและการดูแลต่อเนื่อง", "Severe breathlessness. Refer to a physician soon and assess the need for home oxygen and continuing care.");
  } else if (grade >= 2) {
    advice =
      tr("อาการมาก (mMRC ≥ 2) ควรพบแพทย์เพื่อประเมินและปรับการรักษา พิจารณาส่งฟื้นฟูสมรรถภาพปอด", "More symptoms (mMRC ≥ 2). See a physician to assess and adjust treatment; consider pulmonary rehabilitation.");
  } else if (grade === 1) {
    advice = tr("อาการน้อย (mMRC 0–1) แนะนำออกกำลังกายสม่ำเสมอ เลิกบุหรี่ และติดตามตามนัด", "Fewer symptoms (mMRC 0–1). Advise regular exercise and stopping smoking; follow up as scheduled.");
  } else {
    advice = tr("หายใจหอบเฉพาะออกแรงหนัก ไม่รบกวนกิจวัตร ติดตามตามนัดตามปกติ", "Breathless only on strenuous exertion, daily life unaffected. Routine follow-up as scheduled.");
  }
  if (lowOxygen) {
    advice = tr(
      `ออกซิเจนปลายนิ้ว ${spo2}% ต่ำกว่า 90% ส่งต่อพบแพทย์วันนี้ · ${advice}`,
      `SpO₂ ${spo2}% is below 90%: refer to a physician today · ${advice}`,
    );
  }
  return { grade, group, tone, advice, lowOxygen };
}
