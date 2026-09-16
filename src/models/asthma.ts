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
    short: "กระทบการทำงาน / กิจวัตร",
    text: "ในช่วง 4 สัปดาห์ที่ผ่านมา บ่อยแค่ไหนที่โรคหืดทำให้คุณไม่สามารถทำงานได้ ไม่ว่าจะเป็นที่ทำงาน ที่โรงเรียน หรือที่บ้าน",
    options: ["ตลอดเวลา", "บ่อยมาก", "บางครั้ง", "น้อยมาก", "ไม่เคยเลย"],
  },
  {
    short: "หายใจไม่อิ่ม",
    text: "ในช่วง 4 สัปดาห์ที่ผ่านมา บ่อยแค่ไหนที่คุณรู้สึกหายใจไม่อิ่ม",
    options: [
      "มากกว่า 1 ครั้งต่อวัน",
      "วันละครั้ง",
      "3–6 ครั้งต่อสัปดาห์",
      "1–2 ครั้งต่อสัปดาห์",
      "ไม่เคยเลย",
    ],
  },
  {
    short: "ตื่นกลางคืนจากอาการ",
    text: "ในช่วง 4 สัปดาห์ที่ผ่านมา บ่อยแค่ไหนที่คุณมีอาการของโรคหืด (หายใจมีเสียงหวีด ไอ หายใจไม่อิ่ม แน่นหน้าอก หรือเจ็บหน้าอก) จนทำให้ต้องตื่นขึ้นกลางดึก หรือตื่นเช้ากว่าปกติ",
    options: [
      "4 คืนหรือมากกว่าต่อสัปดาห์",
      "2–3 คืนต่อสัปดาห์",
      "1 คืนต่อสัปดาห์",
      "1–2 คืน",
      "ไม่เคยเลย",
    ],
  },
  {
    short: "ใช้ยาพ่นบรรเทาอาการ",
    text: "ในช่วง 4 สัปดาห์ที่ผ่านมา คุณต้องใช้ยาสูดพ่นขยายหลอดลมชนิดออกฤทธิ์เร็ว (ยาบรรเทาอาการ เช่น ซัลบูทามอล) บ่อยแค่ไหน",
    options: [
      "3 ครั้งต่อวันหรือมากกว่า",
      "1–2 ครั้งต่อวัน",
      "2–3 ครั้งต่อสัปดาห์",
      "1 ครั้งต่อสัปดาห์หรือน้อยกว่า",
      "ไม่เคยเลย",
    ],
  },
  {
    short: "ควบคุมโรคได้",
    text: "ในช่วง 4 สัปดาห์ที่ผ่านมา คุณคิดว่าสามารถควบคุมโรคหืดของคุณได้มากน้อยแค่ไหน",
    options: [
      "ควบคุมไม่ได้เลย",
      "ควบคุมได้ไม่ค่อยดี",
      "ควบคุมได้บ้าง",
      "ควบคุมได้ดี",
      "ควบคุมได้สมบูรณ์",
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
  controlled: "ควบคุมได้ดี",
  partly: "ควบคุมได้บางส่วน",
  uncontrolled: "ควบคุมไม่ได้",
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
  if (points[3] === 1) flags.push("ใช้ยาพ่นบรรเทาอาการตั้งแต่ 3 ครั้งต่อวัน");
  if (points[2] === 1) flags.push("ตื่นกลางคืนจากอาการตั้งแต่ 4 คืนต่อสัปดาห์");

  const advice =
    level === "controlled"
      ? total === ACT_MAX
        ? "ควบคุมโรคหืดได้สมบูรณ์ ใช้ยาควบคุมต่อเนื่องตามแผน และประเมินซ้ำทุกครั้งที่มาติดตาม"
        : "ควบคุมโรคหืดได้ดี ใช้ยาควบคุมต่อเนื่องตามแผน ทบทวนเทคนิคพ่นยา และประเมินซ้ำทุกครั้งที่มาติดตาม"
      : level === "partly"
        ? "ควบคุมได้บางส่วน ทบทวนเทคนิคพ่นยาและความสม่ำเสมอในการใช้ยาควบคุม หลีกเลี่ยงสิ่งกระตุ้น และนัดแพทย์ประเมินปรับยา"
        : "ควบคุมไม่ได้ ส่งพบแพทย์เพื่อปรับแผนการรักษา (step up) ตรวจสอบยาบรรเทาอาการที่ใช้ และประเมินการกำเริบ";

  return { total, level, label: ACT_LABEL[level], tone, advice, flags, complete };
}
