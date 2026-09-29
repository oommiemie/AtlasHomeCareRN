import { tr } from "../i18n";
import type { Tone } from "./assessments";

/**
 * แบบประเมินผู้ป่วยหอบหืด — the Asthma Control Test (ACT).
 *
 * Five questions about the last four weeks, each answered on a five-point
 * scale, summed to 5–25. It is the instrument the Thai asthma guidelines
 * (TAC 2565; สมาคมอุรเวชช์ฯ 2566) name for assessing control in practice,
 * and the wording is the Thai version hospitals here print, not our own
 * rendering of the English.
 *
 * Bands are the validated ones the TAC guideline works to: 20 and over is
 * controlled, 16–19 partly, 15 and under not. (The 2566 guideline prints
 * 19–25 / 16–18 / 5–15; the one-point difference is theirs to settle, and
 * this follows the cut-off the test was validated at.)
 */
export const ACT: { text: string; short: string; options: readonly string[] }[] = [
  {
    short: tr("กระทบการทำงาน / กิจวัตร", "Kept from work / activities"),
    text: tr("ในช่วง 4 สัปดาห์ที่ผ่านมา บ่อยแค่ไหนที่โรคหืดทำให้คุณไม่สามารถทำงานได้ ไม่ว่าจะเป็นที่ทำงาน ที่โรงเรียน หรือที่บ้าน", "In the past 4 weeks, how much of the time did your asthma keep you from getting as much done at work, school or at home?"),
    options: tr(
      ["ตลอดเวลา", "บ่อยมาก", "บางครั้ง", "น้อยมาก", "ไม่เคยเลย"],
      ["All of the time", "Most of the time", "Some of the time", "A little of the time", "None of the time"],
    ),
  },
  {
    short: tr("หายใจไม่อิ่ม", "Shortness of breath"),
    text: tr("ในช่วง 4 สัปดาห์ที่ผ่านมา บ่อยแค่ไหนที่คุณรู้สึกหายใจไม่อิ่ม", "During the past 4 weeks, how often have you had shortness of breath?"),
    options: [
      tr("มากกว่า 1 ครั้งต่อวัน", "More than once a day"),
      tr("วันละครั้ง", "Once a day"),
      tr("3–6 ครั้งต่อสัปดาห์", "3 to 6 times a week"),
      tr("1–2 ครั้งต่อสัปดาห์", "Once or twice a week"),
      tr("ไม่เคยเลย", "Not at all"),
    ],
  },
  {
    short: tr("ตื่นกลางคืนจากอาการ", "Night waking"),
    text: tr("ในช่วง 4 สัปดาห์ที่ผ่านมา บ่อยแค่ไหนที่คุณมีอาการของโรคหืด (หายใจมีเสียงหวีด ไอ หายใจไม่อิ่ม แน่นหน้าอก หรือเจ็บหน้าอก) จนทำให้ต้องตื่นขึ้นกลางดึก หรือตื่นเช้ากว่าปกติ", "During the past 4 weeks, how often did your asthma symptoms (wheezing, coughing, shortness of breath, chest tightness or pain) wake you up at night or earlier than usual in the morning?"),
    options: [
      tr("4 คืนหรือมากกว่าต่อสัปดาห์", "4 or more nights a week"),
      tr("2–3 คืนต่อสัปดาห์", "2 or 3 nights a week"),
      tr("1 คืนต่อสัปดาห์", "Once a week"),
      tr("1–2 คืน", "Once or twice"),
      tr("ไม่เคยเลย", "Not at all"),
    ],
  },
  {
    short: tr("ใช้ยาพ่นบรรเทาอาการ", "Reliever use"),
    text: tr("ในช่วง 4 สัปดาห์ที่ผ่านมา คุณต้องใช้ยาสูดพ่นขยายหลอดลมชนิดออกฤทธิ์เร็ว (ยาบรรเทาอาการ เช่น ซัลบูทามอล) บ่อยแค่ไหน", "During the past 4 weeks, how often have you used your rescue inhaler or nebulizer medication (such as salbutamol)?"),
    options: [
      tr("3 ครั้งต่อวันหรือมากกว่า", "3 or more times per day"),
      tr("1–2 ครั้งต่อวัน", "1 or 2 times per day"),
      tr("2–3 ครั้งต่อสัปดาห์", "2 or 3 times per week"),
      tr("1 ครั้งต่อสัปดาห์หรือน้อยกว่า", "Once a week or less"),
      tr("ไม่เคยเลย", "Not at all"),
    ],
  },
  {
    short: tr("ควบคุมโรคได้", "Asthma control"),
    text: tr("ในช่วง 4 สัปดาห์ที่ผ่านมา คุณคิดว่าสามารถควบคุมโรคหืดของคุณได้มากน้อยแค่ไหน", "How would you rate your asthma control during the past 4 weeks?"),
    options: [
      tr("ควบคุมไม่ได้เลย", "Not controlled at all"),
      tr("ควบคุมได้ไม่ค่อยดี", "Poorly controlled"),
      tr("ควบคุมได้บ้าง", "Somewhat controlled"),
      tr("ควบคุมได้ดี", "Well controlled"),
      tr("ควบคุมได้สมบูรณ์", "Completely controlled"),
    ],
  },
];

export const ACT_MAX = 25;

export type ActLevel = "controlled" | "partly" | "uncontrolled";

export type ActResult = {
  total: number;
  level: ActLevel;
  label: string;
  tone: Tone;
  advice: string;
  /** Answers that are alarms on their own, whatever the total. */
  flags: string[];
  /** Every question answered — the total means what it says. */
  complete: boolean;
};

export const ACT_LABEL: Record<ActLevel, string> = {
  controlled: tr("ควบคุมได้ดี", "Well controlled"),
  partly: tr("ควบคุมได้บางส่วน", "Partly controlled"),
  uncontrolled: tr("ควบคุมไม่ได้", "Not controlled"),
};

/**
 * Sum the answers and read the band.
 *
 * `points` holds one 1–5 per question, or null while unanswered; the total
 * counts what is there. Two answers are flagged on their own: reliever three
 * times a day or more, and waking four nights a week or more — either is
 * the shape of an exacerbation coming, and a 16 that includes one of them
 * is not the 16 the band suggests.
 */
export function actResult(points: (number | null)[]): ActResult {
  const total = points.reduce<number>((s, p) => s + (p ?? 0), 0);
  const complete = points.length === ACT.length && points.every((p) => p != null);
  const level: ActLevel = total >= 20 ? "controlled" : total >= 16 ? "partly" : "uncontrolled";
  const tone: Tone = level === "controlled" ? "good" : level === "partly" ? "warn" : "bad";

  const flags: string[] = [];
  if (points[3] === 1) flags.push(tr("ใช้ยาพ่นบรรเทาอาการตั้งแต่ 3 ครั้งต่อวัน", "Reliever used 3 or more times a day"));
  if (points[2] === 1) flags.push(tr("ตื่นกลางคืนจากอาการตั้งแต่ 4 คืนต่อสัปดาห์", "Woken by symptoms 4 or more nights a week"));

  const advice =
    level === "controlled"
      ? total === ACT_MAX
        ? tr("ควบคุมโรคหืดได้สมบูรณ์ ใช้ยาควบคุมต่อเนื่องตามแผน และประเมินซ้ำทุกครั้งที่มาติดตาม", "Asthma completely controlled. Continue controller medication as planned and reassess at every follow-up.")
        : tr("ควบคุมโรคหืดได้ดี ใช้ยาควบคุมต่อเนื่องตามแผน ทบทวนเทคนิคพ่นยา และประเมินซ้ำทุกครั้งที่มาติดตาม", "Asthma well controlled. Continue controller medication as planned, review inhaler technique, and reassess at every follow-up.")
      : level === "partly"
        ? tr("ควบคุมได้บางส่วน ทบทวนเทคนิคพ่นยาและความสม่ำเสมอในการใช้ยาควบคุม หลีกเลี่ยงสิ่งกระตุ้น และนัดแพทย์ประเมินปรับยา", "Partly controlled. Review inhaler technique and controller adherence, avoid triggers, and book a physician review to adjust medication.")
        : tr("ควบคุมไม่ได้ ส่งพบแพทย์เพื่อปรับแผนการรักษา (step up) ตรวจสอบยาบรรเทาอาการที่ใช้ และประเมินการกำเริบ", "Not controlled. Refer to a physician to step up treatment, check reliever use, and assess for exacerbation.");

  return { total, level, label: ACT_LABEL[level], tone, advice, flags, complete };
}
