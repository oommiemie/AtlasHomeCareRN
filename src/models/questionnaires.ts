import { tr } from "../i18n";
import type { Tone } from "./assessments";

/**
 * The remaining assessments, as data.
 *
 * Eight of the twelve forms on the list are the same shape once you look:
 * a list of questions, each answered from a few scored options (or on a
 * 0–10 line), summed and read against bands. One screen runs them all off
 * the specs here; what differs per form is the wording, the points, and
 * how the total is read — which is what a spec holds.
 *
 * Wording is the instrument's own Thai where a Thai version exists and was
 * found — the Barthel ADL form the LTC programme prints, PPS Adult Suandok,
 * Nestlé's Thai MNA, the Department of Mental Health's ST-5 — and a plain
 * translation of the standard instrument where it does not (Katz, ESAS,
 * ZBI-12, INHOMESSS). Each spec says which.
 */

export type Option = { label: string; points: number };

export type Item =
  | { kind: "choice"; short: string; text: string; options: Option[] }
  /** A 0–max line, tapped — for symptom intensity. */
  | { kind: "scale"; short: string; text: string; max: number; low: string; high: string };

export type Verdict = {
  badge: string;
  tone: Tone;
  result: string;
  advice: string;
};

export type Questionnaire = {
  key: string;
  title: string;
  /** The line of guidance over every question. */
  lead: string;
  /** Where the wording and the bands come from, printed under the result. */
  source: string;
  items: Item[];
  /** The total's ceiling, for "12 / 20". */
  max: number;
  /**
   * The figure shown against `max`. Left off, every item's points are
   * summed; a form whose pages include something outside its score — the
   * two depression questions after ST-5 — says which items count.
   */
  total?: (points: (number | null)[]) => number;
  /** Read the points — one per item, null while unanswered — into a verdict. */
  read: (points: (number | null)[]) => Verdict;
  /**
   * Answers the screening already knows, as option indexes by item index.
   * MNA's BMI question is filled from the weight and height taken earlier.
   */
  prefill?: (screening: Record<string, string>) => Record<number, number>;
};

const sum = (p: (number | null)[]) => p.reduce<number>((s, v) => s + (v ?? 0), 0);
const answered = (p: (number | null)[]) => p.filter((v) => v != null).length;

/* ----------------------------------------------------------- Barthel ADL */

/**
 * The LTC programme's own form (แบบประเมินคัดกรอง Barthel ADL, กรมอนามัย /
 * สปสช.), verbatim: ten items to twenty, and the three groups the
 * programme registers people under.
 */
const BARTHEL: Questionnaire = {
  key: "barthel",
  title: "Barthel ADL Index",
  lead: tr("ความสามารถในการดำเนินชีวิตประจำวัน · เลือกข้อที่ตรงกับผู้ป่วยมากที่สุด", "Activities of daily living · Choose the statement that best describes the patient"),
  source: tr("แบบประเมินคัดกรอง Barthel ADL ฉบับกรมอนามัย / สปสช. (LTC)", "Barthel ADL screening form, Department of Health / NHSO edition (LTC)"),
  max: 20,
  items: [
    {
      kind: "choice",
      short: tr("รับประทานอาหาร", "Feeding"),
      text: tr("Feeding · รับประทานอาหารเมื่อเตรียมสำรับไว้ให้เรียบร้อยต่อหน้า", "Feeding · Eating when a meal is set out in front of them"),
      options: [
        { label: tr("ไม่สามารถตักอาหารเข้าปากได้ ต้องมีคนป้อนให้", "Unable to bring food to mouth; must be fed"), points: 0 },
        { label: tr("ตักอาหารเองได้แต่ต้องมีคนช่วย เช่น ช่วยใช้ช้อนตักเตรียมไว้ให้ หรือตัดเป็นชิ้นเล็กไว้ล่วงหน้า", "Feeds self but needs help, e.g. food scooped onto the spoon or cut into small pieces beforehand"), points: 1 },
        { label: tr("ตักอาหารและช่วยตัวเองได้เป็นปกติ", "Independent"), points: 2 },
      ],
    },
    {
      kind: "choice",
      short: tr("ล้างหน้า หวีผม แปรงฟัน", "Grooming"),
      text: tr("Grooming · ล้างหน้า หวีผม แปรงฟัน โกนหนวด ในระยะเวลา 24–48 ชั่วโมงที่ผ่านมา", "Grooming · Face, hair, teeth, shaving during the past 24–48 hours"),
      options: [
        { label: tr("ต้องการความช่วยเหลือ", "Needs help with personal care"), points: 0 },
        { label: tr("ทำเองได้ (รวมทั้งที่ทำได้เองถ้าเตรียมอุปกรณ์ไว้ให้)", "Independent (including when implements are provided)"), points: 1 },
      ],
    },
    {
      kind: "choice",
      short: tr("ลุกนั่ง / ย้ายจากเตียง", "Transfer"),
      text: tr("Transfer · ลุกนั่งจากที่นอน หรือจากเตียงไปยังเก้าอี้", "Transfer · Sitting up from lying, or bed to chair"),
      options: [
        { label: tr("ไม่สามารถนั่งได้ (นั่งแล้วจะล้มเสมอ) หรือต้องใช้คนสองคนช่วยกันยกขึ้น", "Unable to sit (always falls when seated) or needs two people to lift"), points: 0 },
        { label: tr("ต้องการความช่วยเหลืออย่างมากจึงจะนั่งได้ เช่น ใช้คนที่แข็งแรงหรือมีทักษะ 1 คน หรือคนทั่วไป 2 คนพยุงหรือดันขึ้นมา", "Major help needed to sit, e.g. one strong or skilled person, or two ordinary people to support or push up"), points: 1 },
        { label: tr("ต้องการความช่วยเหลือบ้าง เช่น บอกให้ทำตาม หรือช่วยพยุงเล็กน้อย หรือต้องมีคนดูแลเพื่อความปลอดภัย", "Minor help needed, e.g. verbal prompting, slight physical support, or supervision for safety"), points: 2 },
        { label: tr("ทำได้เอง", "Independent"), points: 3 },
      ],
    },
    {
      kind: "choice",
      short: tr("ใช้ห้องน้ำ", "Toilet use"),
      text: tr("Toilet use · การใช้ห้องน้ำ", "Toilet use"),
      options: [
        { label: tr("ช่วยตัวเองไม่ได้", "Dependent"), points: 0 },
        { label: tr("ทำเองได้บ้าง (อย่างน้อยทำความสะอาดตัวเองได้หลังเสร็จธุระ) แต่ต้องการความช่วยเหลือในบางสิ่ง", "Needs some help but can do some things alone (at least cleaning self afterwards)"), points: 1 },
        { label: tr("ช่วยตัวเองได้ดี (ขึ้นนั่งและลงจากโถส้วมเองได้ ทำความสะอาดได้เรียบร้อย ถอดใส่เสื้อผ้าได้เรียบร้อย)", "Independent (on and off the toilet, wiping, dressing)"), points: 2 },
      ],
    },
    {
      kind: "choice",
      short: tr("การเคลื่อนที่ในบ้าน", "Mobility"),
      text: tr("Mobility · การเคลื่อนที่ภายในห้องหรือบ้าน", "Mobility · Moving about the room or house"),
      options: [
        { label: tr("เคลื่อนที่ไปไหนไม่ได้", "Immobile"), points: 0 },
        { label: tr("ต้องใช้รถเข็นช่วยตัวเองให้เคลื่อนที่ได้เอง (ไม่ต้องมีคนเข็นให้) และเข้าออกมุมห้องหรือประตูได้", "Wheelchair independent (no one pushing), including corners and doorways"), points: 1 },
        { label: tr("เดินหรือเคลื่อนที่โดยมีคนช่วย เช่น พยุง หรือบอกให้ทำตาม หรือต้องดูแลเพื่อความปลอดภัย", "Walks or moves with help of one person (physical support, verbal prompting or supervision for safety)"), points: 2 },
        { label: tr("เดินหรือเคลื่อนที่ได้เอง", "Independent"), points: 3 },
      ],
    },
    {
      kind: "choice",
      short: tr("สวมใส่เสื้อผ้า", "Dressing"),
      text: tr("Dressing · การสวมใส่เสื้อผ้า", "Dressing"),
      options: [
        { label: tr("ต้องมีคนสวมใส่ให้ ช่วยตัวเองแทบไม่ได้หรือได้น้อย", "Dependent; can do little or nothing unaided"), points: 0 },
        { label: tr("ช่วยตัวเองได้ประมาณร้อยละ 50 ที่เหลือต้องมีคนช่วย", "Needs help but can do about half unaided"), points: 1 },
        { label: tr("ช่วยตัวเองได้ดี (รวมทั้งการติดกระดุม รูดซิป หรือใช้เสื้อผ้าที่ดัดแปลงให้เหมาะสม)", "Independent (including buttons, zips, or adapted clothing)"), points: 2 },
      ],
    },
    {
      kind: "choice",
      short: tr("ขึ้นลงบันได", "Stairs"),
      text: tr("Stairs · การขึ้นลงบันได 1 ชั้น", "Stairs · Up and down one flight"),
      options: [
        { label: tr("ไม่สามารถทำได้", "Unable"), points: 0 },
        { label: tr("ต้องการคนช่วย", "Needs help"), points: 1 },
        { label: tr("ขึ้นลงได้เอง (ถ้าต้องใช้เครื่องช่วยเดิน เช่น walker จะต้องเอาขึ้นลงได้ด้วย)", "Independent (if a walking aid such as a walker is used, carries it up and down too)"), points: 2 },
      ],
    },
    {
      kind: "choice",
      short: tr("อาบน้ำ", "Bathing"),
      text: tr("Bathing · การอาบน้ำ", "Bathing"),
      options: [
        { label: tr("ต้องมีคนช่วยหรือทำให้", "Dependent"), points: 0 },
        { label: tr("อาบน้ำเองได้", "Independent"), points: 1 },
      ],
    },
    {
      kind: "choice",
      short: tr("กลั้นอุจจาระ", "Bowels"),
      text: tr("Bowels · การกลั้นการถ่ายอุจจาระในระยะ 1 สัปดาห์ที่ผ่านมา", "Bowels · Continence during the past week"),
      options: [
        { label: tr("กลั้นไม่ได้ หรือต้องการการสวนอุจจาระอยู่เสมอ", "Incontinent, or needs enemas regularly"), points: 0 },
        { label: tr("กลั้นไม่ได้บางครั้ง (น้อยกว่า 1 ครั้งต่อสัปดาห์)", "Occasional accident (less than once a week)"), points: 1 },
        { label: tr("กลั้นได้เป็นปกติ", "Continent"), points: 2 },
      ],
    },
    {
      kind: "choice",
      short: tr("กลั้นปัสสาวะ", "Bladder"),
      text: tr("Bladder · การกลั้นปัสสาวะในระยะ 1 สัปดาห์ที่ผ่านมา", "Bladder · Continence during the past week"),
      options: [
        { label: tr("กลั้นไม่ได้ หรือใส่สายสวนปัสสาวะแต่ไม่สามารถดูแลเองได้", "Incontinent, or catheterized and unable to manage alone"), points: 0 },
        { label: tr("กลั้นไม่ได้บางครั้ง (น้อยกว่าวันละ 1 ครั้ง)", "Occasional accident (less than once a day)"), points: 1 },
        { label: tr("กลั้นได้เป็นปกติ", "Continent"), points: 2 },
      ],
    },
  ],
  read: (p) => {
    const t = sum(p);
    if (t >= 12)
      return {
        badge: tr("กลุ่มติดสังคม", "Socially active"),
        tone: "good",
        result: tr(`Barthel ADL ${t}/20 · ติดสังคม`, `Barthel ADL ${t}/20 · Socially active`),
        advice: tr("พึ่งตนเองได้ ส่งเสริมสุขภาพและกิจกรรมทางสังคม คัดกรองซ้ำปีละครั้ง", "Self-reliant. Promote health and social activity; rescreen yearly."),
      };
    if (t >= 5)
      return {
        badge: tr("กลุ่มติดบ้าน", "Homebound"),
        tone: "warn",
        result: tr(`Barthel ADL ${t}/20 · ติดบ้าน`, `Barthel ADL ${t}/20 · Homebound`),
        advice:
          tr("ช่วยเหลือตนเองได้บ้าง ขึ้นทะเบียนผู้มีภาวะพึ่งพิง จัดทำแผนการดูแลรายบุคคล (care plan) และเยี่ยมบ้านตามแผน", "Partly self-reliant. Register as a dependent person, draw up an individual care plan, and make home visits per the plan."),
      };
    return {
      badge: tr("กลุ่มติดเตียง", "Bedbound"),
      tone: "bad",
      result: tr(`Barthel ADL ${t}/20 · ติดเตียง`, `Barthel ADL ${t}/20 · Bedbound`),
      advice:
        tr("พึ่งตนเองไม่ได้ ขึ้นทะเบียนผู้มีภาวะพึ่งพิง จัดทำ care plan ป้องกันแผลกดทับ ประเมินผู้ดูแลและอุปกรณ์ที่บ้าน", "Fully dependent. Register as a dependent person, draw up a care plan, prevent pressure injuries, and assess the caregiver and home equipment."),
    };
  },
};

/* --------------------------------------------------------------- Katz ADL */

/** The Katz Index of Independence in ADL — six basic activities, one point each. */
const yesNo = (yes: string, no: string): Option[] => [
  { label: yes, points: 1 },
  { label: no, points: 0 },
];

const KATZ: Questionnaire = {
  key: "adl",
  title: tr("กิจวัตรประจำวัน ADL", "Activities of daily living (ADL)"),
  lead: tr("Katz Index · กิจวัตรพื้นฐาน 6 ด้าน ทำได้เองหรือต้องมีคนช่วย", "Katz Index · Six basic activities, independent or needs help"),
  source: tr("Katz Index of Independence in Activities of Daily Living (แปล)", "Katz Index of Independence in Activities of Daily Living"),
  max: 6,
  items: [
    {
      kind: "choice",
      short: tr("อาบน้ำ", "Bathing"),
      text: tr("การอาบน้ำ", "Bathing"),
      options: yesNo(
        tr("อาบน้ำได้เอง หรือต้องการความช่วยเหลือเพียงส่วนเดียวของร่างกาย เช่น หลัง", "Bathes self completely or needs help with only one part of the body, such as the back"),
        tr("ต้องมีคนช่วยอาบน้ำมากกว่าหนึ่งส่วน หรือช่วยทั้งหมด", "Needs help with bathing more than one part of the body, or total help"),
      ),
    },
    {
      kind: "choice",
      short: tr("แต่งตัว", "Dressing"),
      text: tr("การแต่งตัว", "Dressing"),
      options: yesNo(
        tr("หยิบเสื้อผ้าและแต่งตัวได้เอง (อาจต้องช่วยผูกเชือกรองเท้า)", "Gets clothes and dresses without help (may need help tying shoes)"),
        tr("ต้องมีคนช่วยแต่งตัว", "Needs help with dressing"),
      ),
    },
    {
      kind: "choice",
      short: tr("เข้าห้องน้ำ", "Toileting"),
      text: tr("การเข้าห้องน้ำ", "Toileting"),
      options: yesNo(
        tr("ไปห้องน้ำ ทำธุระ และจัดเสื้อผ้าได้เอง", "Goes to the toilet, cleans self and arranges clothes without help"),
        tr("ต้องมีคนช่วย หรือใช้กระโถน / ผ้าอ้อม", "Needs help, or uses a bedpan / diapers"),
      ),
    },
    {
      kind: "choice",
      short: tr("เคลื่อนย้าย", "Transferring"),
      text: tr("การเคลื่อนย้าย ลุกจากเตียงหรือเก้าอี้", "Transferring in and out of bed or chair"),
      options: yesNo(tr("ลุกจากเตียงหรือเก้าอี้ได้เอง (ใช้อุปกรณ์ช่วยได้)", "Moves in and out of bed or chair unassisted (aids acceptable)"), tr("ต้องมีคนช่วยเคลื่อนย้าย", "Needs help to transfer")),
    },
    {
      kind: "choice",
      short: tr("กลั้นขับถ่าย", "Continence"),
      text: tr("การกลั้นปัสสาวะและอุจจาระ", "Bladder and bowel continence"),
      options: yesNo(tr("กลั้นได้เอง", "Fully continent"), tr("กลั้นไม่ได้บางส่วนหรือทั้งหมด", "Partially or totally incontinent")),
    },
    {
      kind: "choice",
      short: tr("รับประทานอาหาร", "Feeding"),
      text: tr("การรับประทานอาหาร", "Feeding"),
      options: yesNo(tr("ตักอาหารเข้าปากได้เอง", "Gets food from plate to mouth without help"), tr("ต้องมีคนป้อน หรือให้อาหารทางสาย", "Needs to be fed, or tube-fed")),
    },
  ],
  read: (p) => {
    const t = sum(p);
    if (t === 6)
      return {
        badge: tr("ช่วยเหลือตัวเองได้", "Independent"),
        tone: "good",
        result: tr(`Katz ADL ${t}/6 · ทำได้เองทุกด้าน`, `Katz ADL ${t}/6 · Independent in all six`),
        advice: tr("ทำกิจวัตรพื้นฐานได้เองทั้งหมด ส่งเสริมการเคลื่อนไหวและป้องกันการหกล้ม", "Independent in all basic activities. Encourage mobility and prevent falls."),
      };
    if (t >= 3)
      return {
        badge: tr("พึ่งพาบางส่วน", "Partly dependent"),
        tone: "warn",
        result: tr(`Katz ADL ${t}/6 · ต้องช่วย ${6 - t} ด้าน`, `Katz ADL ${t}/6 · Needs help with ${6 - t}`),
        advice: tr("ต้องการความช่วยเหลือบางด้าน จัดผู้ดูแลและอุปกรณ์ช่วยเหลือให้ตรงด้านที่ทำไม่ได้ ประเมินซ้ำทุก 6 เดือน", "Needs help in some activities. Arrange a caregiver and aids for those activities; reassess every 6 months."),
      };
    return {
      badge: tr("พึ่งพามาก", "Highly dependent"),
      tone: "bad",
      result: tr(`Katz ADL ${t}/6 · ต้องช่วย ${6 - t} ด้าน`, `Katz ADL ${t}/6 · Needs help with ${6 - t}`),
      advice: tr("พึ่งพาผู้อื่นเกือบทั้งหมด จัดทำแผนการดูแล ประเมินภาระผู้ดูแล และป้องกันภาวะแทรกซ้อนจากการนอนติดเตียง", "Dependent in nearly all activities. Draw up a care plan, assess caregiver burden, and prevent complications of being bedbound."),
    };
  },
};

/* --------------------------------------------------------------------- PPS */

/**
 * PPS Adult Suandok — the Thai PPSv2, as translated by Maharaj Nakorn
 * Chiang Mai's palliative care committee (2551) and validated since. One
 * question: which row is this person. Each row is the five columns in one
 * line.
 */
const PPS_ROWS: [number, string][] = tr<[number, string][]>([
  [100, "เคลื่อนไหวปกติ · ทำกิจกรรมและทำงานได้ตามปกติ ไม่มีอาการของโรค · ทำกิจวัตรได้เอง · รับประทานปกติ · รู้สึกตัวดี"],
  [90, "เคลื่อนไหวปกติ · ทำกิจกรรมและทำงานได้ตามปกติ มีอาการของโรคบางอาการ · ทำได้เอง · รับประทานปกติ · รู้สึกตัวดี"],
  [80, "เคลื่อนไหวปกติ · ต้องออกแรงอย่างมากในการทำกิจกรรมตามปกติ มีอาการของโรคบางอาการ · ทำได้เอง · รับประทานปกติหรือลดลง · รู้สึกตัวดี"],
  [70, "ความสามารถในการเคลื่อนไหวลดลง · ไม่สามารถทำงานได้ตามปกติ มีอาการของโรคอย่างมาก · ทำได้เอง · รับประทานปกติหรือลดลง · รู้สึกตัวดี"],
  [60, "ความสามารถในการเคลื่อนไหวลดลง · ไม่สามารถทำงานอดิเรกหรืองานบ้านได้ มีอาการของโรคอย่างมาก · ต้องการความช่วยเหลือเป็นบางครั้ง/บางเรื่อง · รับประทานปกติหรือลดลง · รู้สึกตัวดีหรือสับสน"],
  [50, "นั่งหรือนอนเป็นส่วนใหญ่ · ไม่สามารถทำงานได้เลย มีการลุกลามของโรค · ต้องการความช่วยเหลือมากขึ้น · รับประทานปกติหรือลดลง · รู้สึกตัวดีหรือสับสน"],
  [40, "นอนอยู่บนเตียงเป็นส่วนใหญ่ · ทำกิจกรรมได้น้อยมาก มีการลุกลามของโรค · ต้องการความช่วยเหลือเป็นส่วนใหญ่ · รับประทานปกติหรือลดลง · รู้สึกตัวดีหรือง่วงซึม +/- สับสน"],
  [30, "นอนอยู่บนเตียงตลอดเวลา · ไม่สามารถทำกิจกรรมใดๆ มีการลุกลามของโรค · ต้องการความช่วยเหลือทั้งหมด · รับประทานปกติหรือลดลง · รู้สึกตัวดีหรือง่วงซึม +/- สับสน"],
  [20, "นอนอยู่บนเตียงตลอดเวลา · ไม่สามารถทำกิจกรรมใดๆ มีการลุกลามของโรค · ต้องการความช่วยเหลือทั้งหมด · จิบน้ำได้เล็กน้อย · รู้สึกตัวดีหรือง่วงซึม +/- สับสน"],
  [10, "นอนอยู่บนเตียงตลอดเวลา · ไม่สามารถทำกิจกรรมใดๆ มีการลุกลามของโรค · ต้องการความช่วยเหลือทั้งหมด · รับประทานทางปากไม่ได้ · ง่วงซึมหรือไม่รู้สึกตัว +/- สับสน"],
  [0, "เสียชีวิต"],
], [
  [100, "Full ambulation · Normal activity and work, no evidence of disease · Full self-care · Normal intake · Full consciousness"],
  [90, "Full ambulation · Normal activity and work, some evidence of disease · Full self-care · Normal intake · Full consciousness"],
  [80, "Full ambulation · Normal activity with effort, some evidence of disease · Full self-care · Normal or reduced intake · Full consciousness"],
  [70, "Reduced ambulation · Unable to do normal job or work, significant disease · Full self-care · Normal or reduced intake · Full consciousness"],
  [60, "Reduced ambulation · Unable to do hobbies or housework, significant disease · Occasional assistance necessary · Normal or reduced intake · Full or confusion"],
  [50, "Mainly sit/lie · Unable to do any work, extensive disease · Considerable assistance required · Normal or reduced intake · Full or confusion"],
  [40, "Mainly in bed · Unable to do most activity, extensive disease · Mainly assistance · Normal or reduced intake · Full or drowsy +/- confusion"],
  [30, "Totally bed bound · Unable to do any activity, extensive disease · Total care · Normal or reduced intake · Full or drowsy +/- confusion"],
  [20, "Totally bed bound · Unable to do any activity, extensive disease · Total care · Minimal to sips · Full or drowsy +/- confusion"],
  [10, "Totally bed bound · Unable to do any activity, extensive disease · Total care · Mouth care only · Drowsy or coma +/- confusion"],
  [0, "Death"],
]);

const PPS: Questionnaire = {
  key: "palliative",
  title: "Palliative Performance Scale",
  lead: tr("PPS Adult Suandok · เลือกระดับที่ตรงกับผู้ป่วยมากที่สุด อ่านจากซ้ายไปขวา: การเคลื่อนไหว · กิจกรรมและการดำเนินโรค · กิจวัตร · การรับประทาน · ความรู้สึกตัว", "PPS Adult Suandok · Choose the level that best fits the patient, reading left to right: ambulation · activity and evidence of disease · self-care · intake · conscious level"),
  source: tr("PPS Adult Suandok แปลจาก PPSv2 (Victoria Hospice) โดย รพ.มหาราชนครเชียงใหม่ พ.ศ. 2551", "Palliative Performance Scale v2 (Victoria Hospice); Thai PPS Adult Suandok, Maharaj Nakorn Chiang Mai Hospital, 2008"),
  max: 100,
  items: [
    {
      kind: "choice",
      short: tr("ระดับ PPS", "PPS level"),
      text: tr("ผู้ป่วยอยู่ในระดับใด", "Which level is the patient at?"),
      options: PPS_ROWS.map(([pct, text]) => ({ label: `PPS ${pct}% · ${text}`, points: pct })),
    },
  ],
  read: (p) => {
    const t = p[0] ?? 0;
    if (p[0] == null)
      return { badge: tr("ยังไม่ประเมิน", "Not assessed"), tone: "warn", result: tr("PPS ยังไม่ประเมิน", "PPS not yet assessed"), advice: tr("เลือกระดับที่ตรงกับผู้ป่วย", "Choose the level that fits the patient") };
    if (t === 0)
      return { badge: tr("เสียชีวิต", "Deceased"), tone: "bad", result: "PPS 0%", advice: tr("บันทึกการเสียชีวิต และดูแลครอบครัวหลังการสูญเสีย", "Record the death and support the family in bereavement.") };
    if (t >= 70)
      return {
        badge: `PPS ${t}%`,
        tone: "good",
        result: tr(`PPS ${t}% · ช่วยเหลือตัวเองได้`, `PPS ${t}% · Self-caring`),
        advice: tr("ยังช่วยเหลือตัวเองได้ ติดตามตามนัด เริ่มพูดคุยและบันทึกการวางแผนการดูแลล่วงหน้า (advance care plan)", "Still self-caring. Follow up as scheduled; begin discussing and documenting an advance care plan."),
      };
    if (t >= 40)
      return {
        badge: `PPS ${t}%`,
        tone: "warn",
        result: tr(`PPS ${t}% · ต้องการความช่วยเหลือมากขึ้น`, `PPS ${t}% · Needs increasing help`),
        advice:
          tr("ต้องการความช่วยเหลือมากขึ้น ประเมินอาการรบกวนด้วย ESAS จัดผู้ดูแลและอุปกรณ์ที่บ้าน และเข้าสู่การดูแลแบบประคับประคองที่บ้าน", "Needs increasing help. Assess symptoms with ESAS, arrange a caregiver and home equipment, and start palliative home care."),
      };
    return {
      badge: `PPS ${t}%`,
      tone: "bad",
      result: tr(`PPS ${t}% · ระยะท้าย`, `PPS ${t}% · End of life`),
      advice:
        tr("ระยะท้าย ให้การดูแลเพื่อความสุขสบาย ควบคุมอาการ เตรียมครอบครัว และประสานทีมประคับประคองตามความประสงค์ของผู้ป่วย", "End of life. Provide comfort care, control symptoms, prepare the family, and coordinate the palliative team according to the patient's wishes."),
    };
  },
};

/* ---------------------------------------------------------------- INHOMESSS */

/** The home-visit mnemonic, one domain to a page, found a problem or not. */
const problem = (): Option[] => [
  { label: tr("ไม่พบปัญหา", "No problem"), points: 0 },
  { label: tr("พบปัญหา ต้องจัดการ", "Problem found, needs action"), points: 1 },
];

const INHOMESSS: Questionnaire = {
  key: "inhomesss",
  title: "INHOMESSS",
  lead: tr("ประเมินผู้ป่วยที่บ้าน 9 ด้าน · แต่ละด้านพบปัญหาที่ต้องจัดการหรือไม่", "Home assessment in 9 domains · Is there a problem that needs action in each?"),
  source: tr("INHOMESSS home visit assessment (เวชศาสตร์ครอบครัว)", "INHOMESSS home visit assessment (family medicine)"),
  max: 9,
  items: [
    { kind: "choice", short: tr("I · การเคลื่อนไหว", "I · Immobility"), text: tr("Immobility · การเคลื่อนไหว การเดิน ความเสี่ยงหกล้ม", "Immobility · Movement, walking, fall risk"), options: problem() },
    { kind: "choice", short: tr("N · โภชนาการ", "N · Nutrition"), text: tr("Nutrition · การกินอาหาร น้ำหนัก การกลืน", "Nutrition · Eating, weight, swallowing"), options: problem() },
    { kind: "choice", short: tr("H · สภาพบ้าน", "H · Home"), text: tr("Home environment · แสงสว่าง พื้น บันได ห้องน้ำ", "Home environment · Lighting, floors, stairs, bathroom"), options: problem() },
    { kind: "choice", short: tr("O · คนในบ้าน", "O · Other people"), text: tr("Other people · ผู้ดูแล คนในบ้าน สัมพันธภาพ", "Other people · Caregiver, household members, relationships"), options: problem() },
    { kind: "choice", short: tr("M · ยา", "M · Medications"), text: tr("Medication · ยาที่ใช้ กินถูกต้อง ยาเหลือ ยาซ้ำซ้อน", "Medications · Current medications, adherence, leftovers, duplicates"), options: problem() },
    { kind: "choice", short: tr("E · ตรวจร่างกาย", "E · Examination"), text: tr("Examination · สัญญาณชีพและอาการที่ตรวจพบ", "Examination · Vital signs and findings"), options: problem() },
    { kind: "choice", short: tr("S · ความปลอดภัย", "S · Safety"), text: tr("Safety · อุบัติเหตุ ไฟ แก๊ส ของมีคม", "Safety · Accidents, fire, gas, sharp objects"), options: problem() },
    { kind: "choice", short: tr("S · จิตวิญญาณ", "S · Spiritual"), text: tr("Spiritual health · ความเชื่อ กำลังใจ ความหวัง", "Spiritual health · Beliefs, morale, hope"), options: problem() },
    { kind: "choice", short: tr("S · บริการ", "S · Services"), text: tr("Services · บริการที่ได้รับและที่ต้องการ (รพ.สต. อสม. สิทธิ)", "Services · Services received and needed (SHPH, VHV, benefits)"), options: problem() },
  ],
  read: (p) => {
    const t = sum(p);
    if (t === 0)
      return { badge: tr("ไม่พบปัญหา", "No problem"), tone: "good", result: tr("INHOMESSS ไม่พบปัญหาทั้ง 9 ด้าน", "INHOMESSS · No problems in any of the 9 domains"), advice: tr("สภาพที่บ้านเหมาะสม เยี่ยมติดตามตามรอบปกติ", "Home situation is suitable. Continue routine follow-up visits.") };
    if (t <= 3)
      return {
        badge: tr(`พบปัญหา ${t} ด้าน`, `${t} problem${t === 1 ? "" : "s"} found`),
        tone: "warn",
        result: tr(`INHOMESSS พบปัญหา ${t}/9 ด้าน`, `INHOMESSS · Problems in ${t}/9 domains`),
        advice: tr("จัดการปัญหาที่พบตามด้าน บันทึกในแผนเยี่ยมบ้าน และติดตามผลในการเยี่ยมครั้งถัดไป", "Address each problem found, record it in the home visit plan, and follow up at the next visit."),
      };
    return {
      badge: tr(`พบปัญหา ${t} ด้าน`, `${t} problem${t === 1 ? "" : "s"} found`),
      tone: "bad",
      result: tr(`INHOMESSS พบปัญหา ${t}/9 ด้าน`, `INHOMESSS · Problems in ${t}/9 domains`),
      advice: tr("ปัญหาหลายด้าน ประชุมทีมสหวิชาชีพ จัดทำแผนการดูแลรายบุคคล และประสานบริการที่ขาด", "Problems in several domains. Hold a multidisciplinary team meeting, draw up an individual care plan, and coordinate missing services."),
    };
  },
};

/* ----------------------------------------------------------- ST-5 + 2Q */

/**
 * The Department of Mental Health's stress screen (ST-5), verbatim, with
 * its two-question depression screen (2Q) after it — the pair the
 * department's crisis teams use.
 */
const ST5_OPTIONS: Option[] = [
  { label: tr("เป็นน้อยมากหรือแทบไม่มี", "Rarely or never"), points: 0 },
  { label: tr("เป็นบางครั้ง", "Sometimes"), points: 1 },
  { label: tr("เป็นบ่อยครั้ง", "Often"), points: 2 },
  { label: tr("เป็นประจำ", "Always"), points: 3 },
];
const TWO_Q: Option[] = [
  { label: tr("ไม่มี", "No"), points: 0 },
  { label: tr("มี", "Yes"), points: 1 },
];

const CRISIS: Questionnaire = {
  key: "crisis",
  title: tr("ผู้ประสบภาวะวิกฤต", "Crisis-affected person"),
  lead: tr("ST-5 · อาการหรือความรู้สึกที่เกิดในระยะ 2–4 สัปดาห์ที่ผ่านมา", "ST-5 · Symptoms or feelings over the past 2–4 weeks"),
  source: tr("แบบประเมินความเครียด ST-5 และ 2Q กรมสุขภาพจิต", "ST-5 stress test and 2Q, Department of Mental Health, Thailand"),
  max: 15,
  // The score is ST-5's; the two depression questions are read on their own.
  total: (p) => sum(p.slice(0, 5)),
  items: [
    { kind: "choice", short: tr("การนอน", "Sleep"), text: tr("มีปัญหาการนอน นอนไม่หลับหรือนอนมาก", "Sleep problems: insomnia or oversleeping"), options: ST5_OPTIONS },
    { kind: "choice", short: tr("สมาธิ", "Concentration"), text: tr("มีสมาธิน้อยลง", "Poorer concentration"), options: ST5_OPTIONS },
    { kind: "choice", short: tr("หงุดหงิด", "Irritability"), text: tr("หงุดหงิด / กระวนกระวาย / ว้าวุ่นใจ", "Irritable / restless / agitated"), options: ST5_OPTIONS },
    { kind: "choice", short: tr("เบื่อ เซ็ง", "Boredom"), text: tr("รู้สึกเบื่อ เซ็ง", "Feeling bored or fed up"), options: ST5_OPTIONS },
    { kind: "choice", short: tr("ไม่อยากพบผู้คน", "Withdrawal"), text: tr("ไม่อยากพบปะผู้คน", "Not wanting to meet people"), options: ST5_OPTIONS },
    {
      kind: "choice",
      short: tr("2Q · หดหู่ เศร้า", "2Q · Depressed mood"),
      text: tr("ใน 2 สัปดาห์ที่ผ่านมารวมวันนี้ ท่านรู้สึกหดหู่ เศร้า หรือท้อแท้สิ้นหวัง หรือไม่", "Over the past 2 weeks, including today, have you felt down, depressed, or hopeless?"),
      options: TWO_Q,
    },
    {
      kind: "choice",
      short: tr("2Q · เบื่อ ไม่เพลิดเพลิน", "2Q · Loss of interest"),
      text: tr("ใน 2 สัปดาห์ที่ผ่านมารวมวันนี้ ท่านรู้สึกเบื่อ ทำอะไรก็ไม่เพลิดเพลิน หรือไม่", "Over the past 2 weeks, including today, have you had little interest or pleasure in doing things?"),
      options: TWO_Q,
    },
  ],
  read: (p) => {
    const st = sum(p.slice(0, 5));
    const dep = p[5] === 1 || p[6] === 1;
    const level =
      st >= 10
        ? tr("มากที่สุด", "Severe")
        : st >= 8
          ? tr("มาก", "High")
          : st >= 5
            ? tr("ปานกลาง", "Moderate")
            : tr("น้อย", "Low");
    const tone: Tone = dep || st >= 8 ? "bad" : st >= 5 ? "warn" : "good";
    const parts = [
      tr(`ST-5 ${st}/15 เครียด${level}`, `ST-5 ${st}/15 · ${level} stress`),
      `2Q ${dep ? tr("ผลบวก", "positive") : tr("ผลลบ", "negative")}`,
    ];
    let advice =
      st >= 8
        ? tr("ความเครียดสูง ให้คำปรึกษาเบื้องต้น สอนการผ่อนคลาย และส่งต่อทีมสุขภาพจิต (MCATT) ติดตามภายใน 1 สัปดาห์", "High stress. Give initial counseling, teach relaxation, refer to the mental health team (MCATT), and follow up within 1 week.")
        : st >= 5
          ? tr("ความเครียดปานกลาง ให้คำปรึกษา รับฟัง แนะนำการจัดการความเครียด และประเมินซ้ำใน 2 สัปดาห์", "Moderate stress. Counsel, listen, advise on stress management, and reassess in 2 weeks.")
          : tr("ความเครียดในระดับปกติ ให้กำลังใจและติดตามตามรอบ", "Normal stress level. Offer encouragement and follow up routinely.");
    if (dep)
      advice = tr(
        `2Q ผลบวก ประเมินต่อด้วย 9Q และ 8Q และส่งต่อประเมินโรคซึมเศร้า · ${advice}`,
        `2Q positive: continue with 9Q and 8Q and refer for depression assessment · ${advice}`,
      );
    return {
      badge: dep ? tr("2Q ผลบวก", "2Q positive") : tr(`เครียด${level}`, `${level} stress`),
      tone,
      result: parts.join(" · "),
      advice,
    };
  },
};

/* ------------------------------------------------------------------- ESAS */

/** Edmonton Symptom Assessment System — nine symptoms, 0 none to 10 worst. */
const esas = (short: string, text: string): Item => ({
  kind: "scale",
  short,
  text,
  max: 10,
  low: tr("ไม่มี", "None"),
  high: tr("รุนแรงที่สุด", "Worst possible"),
});

const ESAS: Questionnaire = {
  key: "esas",
  title: "ESAS",
  lead: tr("Edmonton Symptom Assessment · ให้คะแนนอาการตอนนี้ 0 = ไม่มี ถึง 10 = รุนแรงที่สุด", "Edmonton Symptom Assessment · Rate each symptom now, from 0 = none to 10 = worst possible"),
  source: tr("Edmonton Symptom Assessment System (ESAS-r) ฉบับใช้ในงานประคับประคองไทย", "Edmonton Symptom Assessment System, revised (ESAS-r)"),
  max: 90,
  items: [
    esas(tr("ปวด", "Pain"), tr("ปวด", "Pain")),
    esas(tr("เหนื่อย อ่อนเพลีย", "Tiredness"), tr("เหนื่อย / อ่อนเพลีย", "Tiredness (lack of energy)")),
    esas(tr("ง่วงซึม", "Drowsiness"), tr("ง่วงซึม", "Drowsiness")),
    esas(tr("คลื่นไส้", "Nausea"), tr("คลื่นไส้", "Nausea")),
    esas(tr("เบื่ออาหาร", "Lack of appetite"), tr("เบื่ออาหาร", "Lack of appetite")),
    esas(tr("หายใจลำบาก", "Shortness of breath"), tr("หายใจลำบาก", "Shortness of breath")),
    esas(tr("ซึมเศร้า", "Depression"), tr("ซึมเศร้า", "Depression")),
    esas(tr("วิตกกังวล", "Anxiety"), tr("วิตกกังวล", "Anxiety")),
    esas(tr("ไม่สบายโดยรวม", "Wellbeing"), tr("ความรู้สึกไม่สบายโดยรวม (0 = สบายดีที่สุด)", "Wellbeing (0 = best wellbeing)")),
  ],
  read: (p) => {
    const t = sum(p);
    const severe = p.map((v, i) => (v != null && v >= 7 ? i : -1)).filter((i) => i >= 0);
    const moderate = p.map((v, i) => (v != null && v >= 4 && v < 7 ? i : -1)).filter((i) => i >= 0);
    const names = (idx: number[]) => idx.map((i) => ESAS.items[i].short).join(", ");
    if (severe.length > 0)
      return {
        badge: tr(`อาการรุนแรง ${severe.length} อาการ`, `${severe.length} severe symptom${severe.length === 1 ? "" : "s"}`),
        tone: "bad",
        result: tr(`ESAS ${t}/90 · รุนแรง: ${names(severe)}`, `ESAS ${t}/90 · Severe: ${names(severe)}`),
        advice: tr(
          `จัดการอาการรุนแรง (${names(severe)}) ตามแนวทาง ทบทวนยาและปรึกษาแพทย์วันนี้ ประเมินซ้ำหลังให้การรักษา`,
          `Manage the severe symptoms (${names(severe)}) per guideline, review medications and consult a physician today; reassess after treatment.`,
        ),
      };
    if (moderate.length > 0)
      return {
        badge: tr(`อาการปานกลาง ${moderate.length} อาการ`, `${moderate.length} moderate symptom${moderate.length === 1 ? "" : "s"}`),
        tone: "warn",
        result: tr(`ESAS ${t}/90 · ปานกลาง: ${names(moderate)}`, `ESAS ${t}/90 · Moderate: ${names(moderate)}`),
        advice: tr(
          `ให้การดูแลอาการ (${names(moderate)}) ปรับยาตามแผน และประเมินซ้ำในการเยี่ยมครั้งถัดไป`,
          `Manage the symptoms (${names(moderate)}), adjust medications per plan, and reassess at the next visit.`,
        ),
      };
    return {
      badge: tr("อาการน้อย", "Mild symptoms"),
      tone: "good",
      result: tr(`ESAS ${t}/90 · ทุกอาการระดับน้อย`, `ESAS ${t}/90 · All symptoms mild`),
      advice: tr("อาการควบคุมได้ดี คงแผนการดูแลเดิม ประเมินซ้ำทุกครั้งที่เยี่ยม", "Symptoms well controlled. Continue the current care plan and reassess at every visit."),
    };
  },
};

/* ----------------------------------------------------------------- ZBI-12 */

/** The Zarit Burden Interview, short form — the twelve, 0 never to 4 nearly always. */
const ZBI_OPTIONS: Option[] = [
  { label: tr("ไม่เคย", "Never"), points: 0 },
  { label: tr("นานๆ ครั้ง", "Rarely"), points: 1 },
  { label: tr("บางครั้ง", "Sometimes"), points: 2 },
  { label: tr("ค่อนข้างบ่อย", "Quite frequently"), points: 3 },
  { label: tr("เกือบตลอดเวลา", "Nearly always"), points: 4 },
];
const zbi = (short: string, text: string): Item => ({ kind: "choice", short, text, options: ZBI_OPTIONS });

const ZBI: Questionnaire = {
  key: "homecare",
  title: tr("ภาระผู้ดูแล", "Caregiver burden"),
  lead: tr("Zarit Burden Interview (ZBI-12) · ถามผู้ดูแลหลัก ท่านรู้สึกเช่นนี้บ่อยเพียงใด", "Zarit Burden Interview (ZBI-12) · Ask the main caregiver: how often do you feel this way?"),
  source: tr("Zarit Burden Interview 12 ข้อ ฉบับภาษาไทย (validated)", "Zarit Burden Interview, 12-item short form (validated Thai version)"),
  max: 48,
  items: [
    zbi(tr("ไม่มีเวลาให้ตัวเอง", "No time for self"), tr("รู้สึกว่าไม่มีเวลาเพียงพอสำหรับตัวเอง เพราะต้องดูแลผู้ป่วย", "Do you feel that because of the time you spend with your relative you don't have enough time for yourself?")),
    zbi(tr("เครียดจากหลายบทบาท", "Stressed by competing roles"), tr("รู้สึกเครียดระหว่างการดูแลผู้ป่วยกับความรับผิดชอบอื่น เช่น ครอบครัวหรืองาน", "Do you feel stressed between caring for your relative and trying to meet other responsibilities (work/family)?")),
    zbi(tr("โกรธ", "Angry"), tr("รู้สึกโกรธเมื่ออยู่ใกล้ผู้ป่วย", "Do you feel angry when you are around your relative?")),
    zbi(tr("กระทบความสัมพันธ์", "Relationships affected"), tr("รู้สึกว่าผู้ป่วยส่งผลเสียต่อความสัมพันธ์ของท่านกับคนในครอบครัวหรือเพื่อน", "Do you feel that your relative currently affects your relationship with family members or friends in a negative way?")),
    zbi(tr("ตึงเครียด", "Strained"), tr("รู้สึกตึงเครียดเมื่ออยู่ใกล้ผู้ป่วย", "Do you feel strained when you are around your relative?")),
    zbi(tr("สุขภาพแย่ลง", "Health suffered"), tr("รู้สึกว่าสุขภาพของท่านแย่ลงเพราะต้องดูแลผู้ป่วย", "Do you feel that your health has suffered because of your involvement with your relative?")),
    zbi(tr("ไม่มีความเป็นส่วนตัว", "Lack of privacy"), tr("รู้สึกว่าไม่มีความเป็นส่วนตัวเท่าที่ต้องการเพราะผู้ป่วย", "Do you feel that you don't have as much privacy as you would like because of your relative?")),
    zbi(tr("ชีวิตสังคมแย่ลง", "Social life suffered"), tr("รู้สึกว่าชีวิตทางสังคมของท่านแย่ลงเพราะต้องดูแลผู้ป่วย", "Do you feel that your social life has suffered because you are caring for your relative?")),
    zbi(tr("สูญเสียการควบคุมชีวิต", "Lost control of life"), tr("รู้สึกว่าสูญเสียการควบคุมชีวิตของตนเองตั้งแต่ผู้ป่วยเจ็บป่วย", "Do you feel that you have lost control of your life since your relative's illness?")),
    zbi(tr("ไม่แน่ใจว่าจะทำอย่างไร", "Uncertain what to do"), tr("รู้สึกไม่แน่ใจว่าจะทำอย่างไรกับผู้ป่วย", "Do you feel uncertain about what to do about your relative?")),
    zbi(tr("ควรทำได้มากกว่านี้", "Should do more"), tr("รู้สึกว่าควรทำเพื่อผู้ป่วยได้มากกว่านี้", "Do you feel you should be doing more for your relative?")),
    zbi(tr("น่าจะดูแลได้ดีกว่านี้", "Could do better"), tr("รู้สึกว่าตนเองน่าจะดูแลผู้ป่วยได้ดีกว่านี้", "Do you feel you could do a better job in caring for your relative?")),
  ],
  read: (p) => {
    const t = sum(p);
    if (t >= 21)
      return {
        badge: tr("ภาระสูง", "High burden"),
        tone: "bad",
        result: tr(`ZBI-12 ${t}/48 · ภาระผู้ดูแลสูง`, `ZBI-12 ${t}/48 · High caregiver burden`),
        advice:
          tr("ภาระผู้ดูแลสูง เสี่ยงหมดไฟและซึมเศร้า จัดการพักผ่อนทดแทน (respite care) หาผู้ดูแลสำรอง ส่งต่อนักสังคมสงเคราะห์/ทีมสุขภาพจิต และคัดกรอง 2Q ผู้ดูแล", "High caregiver burden with risk of burnout and depression. Arrange respite care and a backup caregiver, refer to a social worker / mental health team, and screen the caregiver with 2Q."),
      };
    if (t >= 11)
      return {
        badge: tr("ภาระปานกลาง", "Moderate burden"),
        tone: "warn",
        result: tr(`ZBI-12 ${t}/48 · ภาระปานกลาง`, `ZBI-12 ${t}/48 · Moderate burden`),
        advice: tr("ให้ความรู้และทักษะการดูแล แนะนำแหล่งช่วยเหลือในชุมชน วางแผนแบ่งเบาภาระ และประเมินซ้ำทุก 3 เดือน", "Teach caregiving knowledge and skills, point to community support, plan to share the load, and reassess every 3 months."),
      };
    return {
      badge: tr("ภาระน้อย", "Low burden"),
      tone: "good",
      result: tr(`ZBI-12 ${t}/48 · ภาระน้อย`, `ZBI-12 ${t}/48 · Low burden`),
      advice: tr("ผู้ดูแลรับมือได้ดี ให้กำลังใจ และประเมินซ้ำเมื่ออาการผู้ป่วยเปลี่ยนแปลง", "The caregiver is coping well. Offer encouragement and reassess when the patient's condition changes."),
    };
  },
};

/* ----------------------------------------------------------------- MNA-SF */

/** Nestlé's Thai MNA, the screening half (A–F), verbatim. */
const MNA: Questionnaire = {
  key: "mna",
  title: tr("โภชนาการ MNA-SF", "Nutrition MNA-SF"),
  lead: tr("Mini Nutritional Assessment · การคัดกรอง 6 ข้อ", "Mini Nutritional Assessment · 6-item screening"),
  source: tr("Mini Nutritional Assessment MNA® ฉบับภาษาไทย (Nestlé Nutrition Institute)", "Mini Nutritional Assessment MNA® (Nestlé Nutrition Institute)"),
  max: 14,
  items: [
    {
      kind: "choice",
      short: tr("A · กินได้น้อยลง", "A · Food intake"),
      text: tr("ในช่วง 3 เดือนที่ผ่านมา รับประทานอาหารได้น้อยลงเนื่องจากความอยากอาหารลดลง มีปัญหาการย่อย การเคี้ยว หรือปัญหาการกลืนหรือไม่", "Has food intake declined over the past 3 months due to loss of appetite, digestive problems, chewing or swallowing difficulties?"),
      options: [
        { label: tr("รับประทานอาหารน้อยลงอย่างมาก", "Severe decrease in food intake"), points: 0 },
        { label: tr("รับประทานอาหารน้อยลงปานกลาง", "Moderate decrease in food intake"), points: 1 },
        { label: tr("การรับประทานอาหารไม่เปลี่ยนแปลง", "No decrease in food intake"), points: 2 },
      ],
    },
    {
      kind: "choice",
      short: tr("B · น้ำหนักลด", "B · Weight loss"),
      text: tr("ในช่วง 3 เดือนที่ผ่านมา น้ำหนักลดลงหรือไม่", "Weight loss during the last 3 months"),
      options: [
        { label: tr("น้ำหนักลดมากกว่า 3 กิโลกรัม", "Weight loss greater than 3 kg"), points: 0 },
        { label: tr("ไม่ทราบ", "Does not know"), points: 1 },
        { label: tr("น้ำหนักลดระหว่าง 1–3 กิโลกรัม", "Weight loss between 1 and 3 kg"), points: 2 },
        { label: tr("น้ำหนักไม่ลดลง", "No weight loss"), points: 3 },
      ],
    },
    {
      kind: "choice",
      short: tr("C · การเคลื่อนไหว", "C · Mobility"),
      text: tr("สามารถเคลื่อนไหวได้เองหรือไม่", "Mobility"),
      options: [
        { label: tr("นอนบนเตียง หรือต้องอาศัยรถเข็นตลอดเวลา", "Bed or chair bound"), points: 0 },
        { label: tr("ลุกจากเตียงหรือรถเข็นได้บ้าง แต่ไม่สามารถไปข้างนอกได้เอง", "Able to get out of bed / chair but does not go out"), points: 1 },
        { label: tr("เดินและเคลื่อนไหวได้ตามปกติ", "Goes out"), points: 2 },
      ],
    },
    {
      kind: "choice",
      short: tr("D · เครียด / ป่วยเฉียบพลัน", "D · Stress / acute disease"),
      text: tr("ใน 3 เดือนที่ผ่านมา มีความเครียดรุนแรงหรือป่วยเฉียบพลันหรือไม่", "Has suffered psychological stress or acute disease in the past 3 months?"),
      options: [
        { label: tr("มี", "Yes"), points: 0 },
        { label: tr("ไม่มี", "No"), points: 2 },
      ],
    },
    {
      kind: "choice",
      short: tr("E · จิตประสาท", "E · Neuropsychological"),
      text: tr("มีปัญหาทางจิตประสาท (Neuropsychological problems) หรือไม่", "Neuropsychological problems"),
      options: [
        { label: tr("ความจำเสื่อม หรือซึมเศร้าอย่างรุนแรง", "Severe dementia or depression"), points: 0 },
        { label: tr("ความจำเสื่อมเล็กน้อย", "Mild dementia"), points: 1 },
        { label: tr("ไม่มีปัญหาทางประสาท", "No psychological problems"), points: 2 },
      ],
    },
    {
      kind: "choice",
      short: tr("F · ดัชนีมวลกาย", "F · Body mass index"),
      text: tr("ดัชนีมวลกาย (BMI) = น้ำหนัก (กก.) / ส่วนสูง (ม.)²", "Body mass index (BMI) = weight (kg) / height (m)²"),
      options: [
        { label: tr("BMI น้อยกว่า 19", "BMI less than 19"), points: 0 },
        { label: tr("BMI ตั้งแต่ 19 แต่น้อยกว่า 21", "BMI 19 to less than 21"), points: 1 },
        { label: tr("BMI ตั้งแต่ 21 แต่น้อยกว่า 23", "BMI 21 to less than 23"), points: 2 },
        { label: tr("BMI ตั้งแต่ 23 ขึ้นไป", "BMI 23 or greater"), points: 3 },
      ],
    },
  ],
  prefill: (s): Record<number, number> => {
    const w = Number(s.weight);
    const h = Number(s.height);
    if (!(w > 0) || !(h > 0)) return {};
    const bmi = w / (h / 100) ** 2;
    return { 5: bmi < 19 ? 0 : bmi < 21 ? 1 : bmi < 23 ? 2 : 3 };
  },
  read: (p) => {
    const t = sum(p);
    if (answered(p) < 6)
      return {
        badge: tr("ยังไม่ครบ", "Incomplete"),
        tone: "warn",
        result: tr(`MNA-SF ${t}/14 (ตอบ ${answered(p)}/6 ข้อ)`, `MNA-SF ${t}/14 (${answered(p)}/6 answered)`),
        advice: tr("ตอบให้ครบ 6 ข้อจึงแปลผลได้", "Answer all 6 items to get a result."),
      };
    if (t >= 12)
      return { badge: tr("โภชนาการปกติ", "Normal nutrition"), tone: "good", result: tr(`MNA-SF ${t}/14 · ภาวะโภชนาการปกติ`, `MNA-SF ${t}/14 · Normal nutritional status`), advice: tr("ภาวะโภชนาการปกติ คัดกรองซ้ำปีละครั้ง หรือเมื่อเจ็บป่วย/น้ำหนักเปลี่ยน", "Normal nutritional status. Rescreen yearly, or on illness / weight change.") };
    if (t >= 8)
      return {
        badge: tr("เสี่ยงขาดสารอาหาร", "At risk of malnutrition"),
        tone: "warn",
        result: tr(`MNA-SF ${t}/14 · เสี่ยงต่อภาวะขาดสารอาหาร`, `MNA-SF ${t}/14 · At risk of malnutrition`),
        advice: tr("เสี่ยงต่อภาวะขาดสารอาหาร ทำ MNA ฉบับเต็มเพื่อประเมินต่อ แนะนำอาหารโปรตีนและพลังงานเพียงพอ ติดตามน้ำหนักทุกเดือน", "At risk of malnutrition. Complete the full MNA, advise adequate protein and energy intake, and monitor weight monthly."),
      };
    return {
      badge: tr("ขาดสารอาหาร", "Malnourished"),
      tone: "bad",
      result: tr(`MNA-SF ${t}/14 · ขาดสารอาหาร`, `MNA-SF ${t}/14 · Malnourished`),
      advice: tr("ขาดสารอาหาร ส่งต่อนักกำหนดอาหาร/แพทย์เพื่อวางแผนโภชนบำบัด หาสาเหตุ (การกลืน ฟัน ซึมเศร้า โรคร่วม) และติดตามน้ำหนักทุก 2 สัปดาห์", "Malnourished. Refer to a dietitian / physician for nutrition therapy, look for causes (swallowing, teeth, depression, comorbidities), and monitor weight every 2 weeks."),
    };
  },
};

/** Every data-driven form, by the key the assessment list uses. */
export const QUESTIONNAIRES: Record<string, Questionnaire> = {
  barthel: BARTHEL,
  adl: KATZ,
  palliative: PPS,
  inhomesss: INHOMESSS,
  crisis: CRISIS,
  esas: ESAS,
  homecare: ZBI,
  mna: MNA,
};
