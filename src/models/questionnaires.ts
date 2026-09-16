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
  lead: "ความสามารถในการดำเนินชีวิตประจำวัน · เลือกข้อที่ตรงกับผู้ป่วยมากที่สุด",
  source: "แบบประเมินคัดกรอง Barthel ADL ฉบับกรมอนามัย / สปสช. (LTC)",
  max: 20,
  items: [
    {
      kind: "choice",
      short: "รับประทานอาหาร",
      text: "Feeding · รับประทานอาหารเมื่อเตรียมสำรับไว้ให้เรียบร้อยต่อหน้า",
      options: [
        { label: "ไม่สามารถตักอาหารเข้าปากได้ ต้องมีคนป้อนให้", points: 0 },
        { label: "ตักอาหารเองได้แต่ต้องมีคนช่วย เช่น ช่วยใช้ช้อนตักเตรียมไว้ให้ หรือตัดเป็นชิ้นเล็กไว้ล่วงหน้า", points: 1 },
        { label: "ตักอาหารและช่วยตัวเองได้เป็นปกติ", points: 2 },
      ],
    },
    {
      kind: "choice",
      short: "ล้างหน้า หวีผม แปรงฟัน",
      text: "Grooming · ล้างหน้า หวีผม แปรงฟัน โกนหนวด ในระยะเวลา 24–48 ชั่วโมงที่ผ่านมา",
      options: [
        { label: "ต้องการความช่วยเหลือ", points: 0 },
        { label: "ทำเองได้ (รวมทั้งที่ทำได้เองถ้าเตรียมอุปกรณ์ไว้ให้)", points: 1 },
      ],
    },
    {
      kind: "choice",
      short: "ลุกนั่ง / ย้ายจากเตียง",
      text: "Transfer · ลุกนั่งจากที่นอน หรือจากเตียงไปยังเก้าอี้",
      options: [
        { label: "ไม่สามารถนั่งได้ (นั่งแล้วจะล้มเสมอ) หรือต้องใช้คนสองคนช่วยกันยกขึ้น", points: 0 },
        { label: "ต้องการความช่วยเหลืออย่างมากจึงจะนั่งได้ เช่น ใช้คนที่แข็งแรงหรือมีทักษะ 1 คน หรือคนทั่วไป 2 คนพยุงหรือดันขึ้นมา", points: 1 },
        { label: "ต้องการความช่วยเหลือบ้าง เช่น บอกให้ทำตาม หรือช่วยพยุงเล็กน้อย หรือต้องมีคนดูแลเพื่อความปลอดภัย", points: 2 },
        { label: "ทำได้เอง", points: 3 },
      ],
    },
    {
      kind: "choice",
      short: "ใช้ห้องน้ำ",
      text: "Toilet use · การใช้ห้องน้ำ",
      options: [
        { label: "ช่วยตัวเองไม่ได้", points: 0 },
        { label: "ทำเองได้บ้าง (อย่างน้อยทำความสะอาดตัวเองได้หลังเสร็จธุระ) แต่ต้องการความช่วยเหลือในบางสิ่ง", points: 1 },
        { label: "ช่วยตัวเองได้ดี (ขึ้นนั่งและลงจากโถส้วมเองได้ ทำความสะอาดได้เรียบร้อย ถอดใส่เสื้อผ้าได้เรียบร้อย)", points: 2 },
      ],
    },
    {
      kind: "choice",
      short: "การเคลื่อนที่ในบ้าน",
      text: "Mobility · การเคลื่อนที่ภายในห้องหรือบ้าน",
      options: [
        { label: "เคลื่อนที่ไปไหนไม่ได้", points: 0 },
        { label: "ต้องใช้รถเข็นช่วยตัวเองให้เคลื่อนที่ได้เอง (ไม่ต้องมีคนเข็นให้) และเข้าออกมุมห้องหรือประตูได้", points: 1 },
        { label: "เดินหรือเคลื่อนที่โดยมีคนช่วย เช่น พยุง หรือบอกให้ทำตาม หรือต้องดูแลเพื่อความปลอดภัย", points: 2 },
        { label: "เดินหรือเคลื่อนที่ได้เอง", points: 3 },
      ],
    },
    {
      kind: "choice",
      short: "สวมใส่เสื้อผ้า",
      text: "Dressing · การสวมใส่เสื้อผ้า",
      options: [
        { label: "ต้องมีคนสวมใส่ให้ ช่วยตัวเองแทบไม่ได้หรือได้น้อย", points: 0 },
        { label: "ช่วยตัวเองได้ประมาณร้อยละ 50 ที่เหลือต้องมีคนช่วย", points: 1 },
        { label: "ช่วยตัวเองได้ดี (รวมทั้งการติดกระดุม รูดซิป หรือใช้เสื้อผ้าที่ดัดแปลงให้เหมาะสม)", points: 2 },
      ],
    },
    {
      kind: "choice",
      short: "ขึ้นลงบันได",
      text: "Stairs · การขึ้นลงบันได 1 ชั้น",
      options: [
        { label: "ไม่สามารถทำได้", points: 0 },
        { label: "ต้องการคนช่วย", points: 1 },
        { label: "ขึ้นลงได้เอง (ถ้าต้องใช้เครื่องช่วยเดิน เช่น walker จะต้องเอาขึ้นลงได้ด้วย)", points: 2 },
      ],
    },
    {
      kind: "choice",
      short: "อาบน้ำ",
      text: "Bathing · การอาบน้ำ",
      options: [
        { label: "ต้องมีคนช่วยหรือทำให้", points: 0 },
        { label: "อาบน้ำเองได้", points: 1 },
      ],
    },
    {
      kind: "choice",
      short: "กลั้นอุจจาระ",
      text: "Bowels · การกลั้นการถ่ายอุจจาระในระยะ 1 สัปดาห์ที่ผ่านมา",
      options: [
        { label: "กลั้นไม่ได้ หรือต้องการการสวนอุจจาระอยู่เสมอ", points: 0 },
        { label: "กลั้นไม่ได้บางครั้ง (น้อยกว่า 1 ครั้งต่อสัปดาห์)", points: 1 },
        { label: "กลั้นได้เป็นปกติ", points: 2 },
      ],
    },
    {
      kind: "choice",
      short: "กลั้นปัสสาวะ",
      text: "Bladder · การกลั้นปัสสาวะในระยะ 1 สัปดาห์ที่ผ่านมา",
      options: [
        { label: "กลั้นไม่ได้ หรือใส่สายสวนปัสสาวะแต่ไม่สามารถดูแลเองได้", points: 0 },
        { label: "กลั้นไม่ได้บางครั้ง (น้อยกว่าวันละ 1 ครั้ง)", points: 1 },
        { label: "กลั้นได้เป็นปกติ", points: 2 },
      ],
    },
  ],
  read: (p) => {
    const t = sum(p);
    if (t >= 12)
      return {
        badge: "กลุ่มติดสังคม",
        tone: "good",
        result: `Barthel ADL ${t}/20 · ติดสังคม`,
        advice: "พึ่งตนเองได้ ส่งเสริมสุขภาพและกิจกรรมทางสังคม คัดกรองซ้ำปีละครั้ง",
      };
    if (t >= 5)
      return {
        badge: "กลุ่มติดบ้าน",
        tone: "warn",
        result: `Barthel ADL ${t}/20 · ติดบ้าน`,
        advice:
          "ช่วยเหลือตนเองได้บ้าง ขึ้นทะเบียนผู้มีภาวะพึ่งพิง จัดทำแผนการดูแลรายบุคคล (care plan) และเยี่ยมบ้านตามแผน",
      };
    return {
      badge: "กลุ่มติดเตียง",
      tone: "bad",
      result: `Barthel ADL ${t}/20 · ติดเตียง`,
      advice:
        "พึ่งตนเองไม่ได้ ขึ้นทะเบียนผู้มีภาวะพึ่งพิง จัดทำ care plan ป้องกันแผลกดทับ ประเมินผู้ดูแลและอุปกรณ์ที่บ้าน",
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
  title: "กิจวัตรประจำวัน ADL",
  lead: "Katz Index · กิจวัตรพื้นฐาน 6 ด้าน ทำได้เองหรือต้องมีคนช่วย",
  source: "Katz Index of Independence in Activities of Daily Living (แปล)",
  max: 6,
  items: [
    {
      kind: "choice",
      short: "อาบน้ำ",
      text: "การอาบน้ำ",
      options: yesNo(
        "อาบน้ำได้เอง หรือต้องการความช่วยเหลือเพียงส่วนเดียวของร่างกาย เช่น หลัง",
        "ต้องมีคนช่วยอาบน้ำมากกว่าหนึ่งส่วน หรือช่วยทั้งหมด",
      ),
    },
    {
      kind: "choice",
      short: "แต่งตัว",
      text: "การแต่งตัว",
      options: yesNo(
        "หยิบเสื้อผ้าและแต่งตัวได้เอง (อาจต้องช่วยผูกเชือกรองเท้า)",
        "ต้องมีคนช่วยแต่งตัว",
      ),
    },
    {
      kind: "choice",
      short: "เข้าห้องน้ำ",
      text: "การเข้าห้องน้ำ",
      options: yesNo(
        "ไปห้องน้ำ ทำธุระ และจัดเสื้อผ้าได้เอง",
        "ต้องมีคนช่วย หรือใช้กระโถน / ผ้าอ้อม",
      ),
    },
    {
      kind: "choice",
      short: "เคลื่อนย้าย",
      text: "การเคลื่อนย้าย ลุกจากเตียงหรือเก้าอี้",
      options: yesNo("ลุกจากเตียงหรือเก้าอี้ได้เอง (ใช้อุปกรณ์ช่วยได้)", "ต้องมีคนช่วยเคลื่อนย้าย"),
    },
    {
      kind: "choice",
      short: "กลั้นขับถ่าย",
      text: "การกลั้นปัสสาวะและอุจจาระ",
      options: yesNo("กลั้นได้เอง", "กลั้นไม่ได้บางส่วนหรือทั้งหมด"),
    },
    {
      kind: "choice",
      short: "รับประทานอาหาร",
      text: "การรับประทานอาหาร",
      options: yesNo("ตักอาหารเข้าปากได้เอง", "ต้องมีคนป้อน หรือให้อาหารทางสาย"),
    },
  ],
  read: (p) => {
    const t = sum(p);
    if (t === 6)
      return {
        badge: "ช่วยเหลือตัวเองได้",
        tone: "good",
        result: `Katz ADL ${t}/6 · ทำได้เองทุกด้าน`,
        advice: "ทำกิจวัตรพื้นฐานได้เองทั้งหมด ส่งเสริมการเคลื่อนไหวและป้องกันการหกล้ม",
      };
    if (t >= 3)
      return {
        badge: "พึ่งพาบางส่วน",
        tone: "warn",
        result: `Katz ADL ${t}/6 · ต้องช่วย ${6 - t} ด้าน`,
        advice: "ต้องการความช่วยเหลือบางด้าน จัดผู้ดูแลและอุปกรณ์ช่วยเหลือให้ตรงด้านที่ทำไม่ได้ ประเมินซ้ำทุก 6 เดือน",
      };
    return {
      badge: "พึ่งพามาก",
      tone: "bad",
      result: `Katz ADL ${t}/6 · ต้องช่วย ${6 - t} ด้าน`,
      advice: "พึ่งพาผู้อื่นเกือบทั้งหมด จัดทำแผนการดูแล ประเมินภาระผู้ดูแล และป้องกันภาวะแทรกซ้อนจากการนอนติดเตียง",
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
const PPS_ROWS: [number, string][] = [
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
];

const PPS: Questionnaire = {
  key: "palliative",
  title: "Palliative Performance Scale",
  lead: "PPS Adult Suandok · เลือกระดับที่ตรงกับผู้ป่วยมากที่สุด อ่านจากซ้ายไปขวา: การเคลื่อนไหว · กิจกรรมและการดำเนินโรค · กิจวัตร · การรับประทาน · ความรู้สึกตัว",
  source: "PPS Adult Suandok แปลจาก PPSv2 (Victoria Hospice) โดย รพ.มหาราชนครเชียงใหม่ พ.ศ. 2551",
  max: 100,
  items: [
    {
      kind: "choice",
      short: "ระดับ PPS",
      text: "ผู้ป่วยอยู่ในระดับใด",
      options: PPS_ROWS.map(([pct, text]) => ({ label: `PPS ${pct}% · ${text}`, points: pct })),
    },
  ],
  read: (p) => {
    const t = p[0] ?? 0;
    if (p[0] == null)
      return { badge: "ยังไม่ประเมิน", tone: "warn", result: "PPS ยังไม่ประเมิน", advice: "เลือกระดับที่ตรงกับผู้ป่วย" };
    if (t === 0)
      return { badge: "เสียชีวิต", tone: "bad", result: "PPS 0%", advice: "บันทึกการเสียชีวิต และดูแลครอบครัวหลังการสูญเสีย" };
    if (t >= 70)
      return {
        badge: `PPS ${t}%`,
        tone: "good",
        result: `PPS ${t}% · ช่วยเหลือตัวเองได้`,
        advice: "ยังช่วยเหลือตัวเองได้ ติดตามตามนัด เริ่มพูดคุยและบันทึกการวางแผนการดูแลล่วงหน้า (advance care plan)",
      };
    if (t >= 40)
      return {
        badge: `PPS ${t}%`,
        tone: "warn",
        result: `PPS ${t}% · ต้องการความช่วยเหลือมากขึ้น`,
        advice:
          "ต้องการความช่วยเหลือมากขึ้น ประเมินอาการรบกวนด้วย ESAS จัดผู้ดูแลและอุปกรณ์ที่บ้าน และเข้าสู่การดูแลแบบประคับประคองที่บ้าน",
      };
    return {
      badge: `PPS ${t}%`,
      tone: "bad",
      result: `PPS ${t}% · ระยะท้าย`,
      advice:
        "ระยะท้าย ให้การดูแลเพื่อความสุขสบาย ควบคุมอาการ เตรียมครอบครัว และประสานทีมประคับประคองตามความประสงค์ของผู้ป่วย",
    };
  },
};

/* ---------------------------------------------------------------- INHOMESSS */

/** The home-visit mnemonic, one domain to a page, found a problem or not. */
const problem = (): Option[] => [
  { label: "ไม่พบปัญหา", points: 0 },
  { label: "พบปัญหา ต้องจัดการ", points: 1 },
];

const INHOMESSS: Questionnaire = {
  key: "inhomesss",
  title: "INHOMESSS",
  lead: "ประเมินผู้ป่วยที่บ้าน 9 ด้าน · แต่ละด้านพบปัญหาที่ต้องจัดการหรือไม่",
  source: "INHOMESSS home visit assessment (เวชศาสตร์ครอบครัว)",
  max: 9,
  items: [
    { kind: "choice", short: "I · การเคลื่อนไหว", text: "Immobility · การเคลื่อนไหว การเดิน ความเสี่ยงหกล้ม", options: problem() },
    { kind: "choice", short: "N · โภชนาการ", text: "Nutrition · การกินอาหาร น้ำหนัก การกลืน", options: problem() },
    { kind: "choice", short: "H · สภาพบ้าน", text: "Home environment · แสงสว่าง พื้น บันได ห้องน้ำ", options: problem() },
    { kind: "choice", short: "O · คนในบ้าน", text: "Other people · ผู้ดูแล คนในบ้าน สัมพันธภาพ", options: problem() },
    { kind: "choice", short: "M · ยา", text: "Medication · ยาที่ใช้ กินถูกต้อง ยาเหลือ ยาซ้ำซ้อน", options: problem() },
    { kind: "choice", short: "E · ตรวจร่างกาย", text: "Examination · สัญญาณชีพและอาการที่ตรวจพบ", options: problem() },
    { kind: "choice", short: "S · ความปลอดภัย", text: "Safety · อุบัติเหตุ ไฟ แก๊ส ของมีคม", options: problem() },
    { kind: "choice", short: "S · จิตวิญญาณ", text: "Spiritual health · ความเชื่อ กำลังใจ ความหวัง", options: problem() },
    { kind: "choice", short: "S · บริการ", text: "Services · บริการที่ได้รับและที่ต้องการ (รพ.สต. อสม. สิทธิ)", options: problem() },
  ],
  read: (p) => {
    const t = sum(p);
    if (t === 0)
      return { badge: "ไม่พบปัญหา", tone: "good", result: "INHOMESSS ไม่พบปัญหาทั้ง 9 ด้าน", advice: "สภาพที่บ้านเหมาะสม เยี่ยมติดตามตามรอบปกติ" };
    if (t <= 3)
      return {
        badge: `พบปัญหา ${t} ด้าน`,
        tone: "warn",
        result: `INHOMESSS พบปัญหา ${t}/9 ด้าน`,
        advice: "จัดการปัญหาที่พบตามด้าน บันทึกในแผนเยี่ยมบ้าน และติดตามผลในการเยี่ยมครั้งถัดไป",
      };
    return {
      badge: `พบปัญหา ${t} ด้าน`,
      tone: "bad",
      result: `INHOMESSS พบปัญหา ${t}/9 ด้าน`,
      advice: "ปัญหาหลายด้าน ประชุมทีมสหวิชาชีพ จัดทำแผนการดูแลรายบุคคล และประสานบริการที่ขาด",
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
  { label: "เป็นน้อยมากหรือแทบไม่มี", points: 0 },
  { label: "เป็นบางครั้ง", points: 1 },
  { label: "เป็นบ่อยครั้ง", points: 2 },
  { label: "เป็นประจำ", points: 3 },
];
const TWO_Q: Option[] = [
  { label: "ไม่มี", points: 0 },
  { label: "มี", points: 1 },
];

const CRISIS: Questionnaire = {
  key: "crisis",
  title: "ผู้ประสบภาวะวิกฤต",
  lead: "ST-5 · อาการหรือความรู้สึกที่เกิดในระยะ 2–4 สัปดาห์ที่ผ่านมา",
  source: "แบบประเมินความเครียด ST-5 และ 2Q กรมสุขภาพจิต",
  max: 15,
  // The score is ST-5's; the two depression questions are read on their own.
  total: (p) => sum(p.slice(0, 5)),
  items: [
    { kind: "choice", short: "การนอน", text: "มีปัญหาการนอน นอนไม่หลับหรือนอนมาก", options: ST5_OPTIONS },
    { kind: "choice", short: "สมาธิ", text: "มีสมาธิน้อยลง", options: ST5_OPTIONS },
    { kind: "choice", short: "หงุดหงิด", text: "หงุดหงิด / กระวนกระวาย / ว้าวุ่นใจ", options: ST5_OPTIONS },
    { kind: "choice", short: "เบื่อ เซ็ง", text: "รู้สึกเบื่อ เซ็ง", options: ST5_OPTIONS },
    { kind: "choice", short: "ไม่อยากพบผู้คน", text: "ไม่อยากพบปะผู้คน", options: ST5_OPTIONS },
    {
      kind: "choice",
      short: "2Q · หดหู่ เศร้า",
      text: "ใน 2 สัปดาห์ที่ผ่านมารวมวันนี้ ท่านรู้สึกหดหู่ เศร้า หรือท้อแท้สิ้นหวัง หรือไม่",
      options: TWO_Q,
    },
    {
      kind: "choice",
      short: "2Q · เบื่อ ไม่เพลิดเพลิน",
      text: "ใน 2 สัปดาห์ที่ผ่านมารวมวันนี้ ท่านรู้สึกเบื่อ ทำอะไรก็ไม่เพลิดเพลิน หรือไม่",
      options: TWO_Q,
    },
  ],
  read: (p) => {
    const st = sum(p.slice(0, 5));
    const dep = p[5] === 1 || p[6] === 1;
    const level = st >= 10 ? "มากที่สุด" : st >= 8 ? "มาก" : st >= 5 ? "ปานกลาง" : "น้อย";
    const tone: Tone = dep || st >= 8 ? "bad" : st >= 5 ? "warn" : "good";
    const parts = [`ST-5 ${st}/15 เครียด${level}`, `2Q ${dep ? "ผลบวก" : "ผลลบ"}`];
    let advice =
      st >= 8
        ? "ความเครียดสูง ให้คำปรึกษาเบื้องต้น สอนการผ่อนคลาย และส่งต่อทีมสุขภาพจิต (MCATT) ติดตามภายใน 1 สัปดาห์"
        : st >= 5
          ? "ความเครียดปานกลาง ให้คำปรึกษา รับฟัง แนะนำการจัดการความเครียด และประเมินซ้ำใน 2 สัปดาห์"
          : "ความเครียดในระดับปกติ ให้กำลังใจและติดตามตามรอบ";
    if (dep) advice = `2Q ผลบวก ประเมินต่อด้วย 9Q และ 8Q และส่งต่อประเมินโรคซึมเศร้า · ${advice}`;
    return { badge: dep ? "2Q ผลบวก" : `เครียด${level}`, tone, result: parts.join(" · "), advice };
  },
};

/* ------------------------------------------------------------------- ESAS */

/** Edmonton Symptom Assessment System — nine symptoms, 0 none to 10 worst. */
const esas = (short: string, text: string): Item => ({
  kind: "scale",
  short,
  text,
  max: 10,
  low: "ไม่มี",
  high: "รุนแรงที่สุด",
});

const ESAS: Questionnaire = {
  key: "esas",
  title: "ESAS",
  lead: "Edmonton Symptom Assessment · ให้คะแนนอาการตอนนี้ 0 = ไม่มี ถึง 10 = รุนแรงที่สุด",
  source: "Edmonton Symptom Assessment System (ESAS-r) ฉบับใช้ในงานประคับประคองไทย",
  max: 90,
  items: [
    esas("ปวด", "ปวด"),
    esas("เหนื่อย อ่อนเพลีย", "เหนื่อย / อ่อนเพลีย"),
    esas("ง่วงซึม", "ง่วงซึม"),
    esas("คลื่นไส้", "คลื่นไส้"),
    esas("เบื่ออาหาร", "เบื่ออาหาร"),
    esas("หายใจลำบาก", "หายใจลำบาก"),
    esas("ซึมเศร้า", "ซึมเศร้า"),
    esas("วิตกกังวล", "วิตกกังวล"),
    esas("ไม่สบายโดยรวม", "ความรู้สึกไม่สบายโดยรวม (0 = สบายดีที่สุด)"),
  ],
  read: (p) => {
    const t = sum(p);
    const severe = p.map((v, i) => (v != null && v >= 7 ? i : -1)).filter((i) => i >= 0);
    const moderate = p.map((v, i) => (v != null && v >= 4 && v < 7 ? i : -1)).filter((i) => i >= 0);
    const names = (idx: number[]) => idx.map((i) => ESAS.items[i].short).join(", ");
    if (severe.length > 0)
      return {
        badge: `อาการรุนแรง ${severe.length} อาการ`,
        tone: "bad",
        result: `ESAS ${t}/90 · รุนแรง: ${names(severe)}`,
        advice: `จัดการอาการรุนแรง (${names(severe)}) ตามแนวทาง ทบทวนยาและปรึกษาแพทย์วันนี้ ประเมินซ้ำหลังให้การรักษา`,
      };
    if (moderate.length > 0)
      return {
        badge: `อาการปานกลาง ${moderate.length} อาการ`,
        tone: "warn",
        result: `ESAS ${t}/90 · ปานกลาง: ${names(moderate)}`,
        advice: `ให้การดูแลอาการ (${names(moderate)}) ปรับยาตามแผน และประเมินซ้ำในการเยี่ยมครั้งถัดไป`,
      };
    return {
      badge: "อาการน้อย",
      tone: "good",
      result: `ESAS ${t}/90 · ทุกอาการระดับน้อย`,
      advice: "อาการควบคุมได้ดี คงแผนการดูแลเดิม ประเมินซ้ำทุกครั้งที่เยี่ยม",
    };
  },
};

/* ----------------------------------------------------------------- ZBI-12 */

/** The Zarit Burden Interview, short form — the twelve, 0 never to 4 nearly always. */
const ZBI_OPTIONS: Option[] = [
  { label: "ไม่เคย", points: 0 },
  { label: "นานๆ ครั้ง", points: 1 },
  { label: "บางครั้ง", points: 2 },
  { label: "ค่อนข้างบ่อย", points: 3 },
  { label: "เกือบตลอดเวลา", points: 4 },
];
const zbi = (short: string, text: string): Item => ({ kind: "choice", short, text, options: ZBI_OPTIONS });

const ZBI: Questionnaire = {
  key: "homecare",
  title: "ภาระผู้ดูแล",
  lead: "Zarit Burden Interview (ZBI-12) · ถามผู้ดูแลหลัก ท่านรู้สึกเช่นนี้บ่อยเพียงใด",
  source: "Zarit Burden Interview 12 ข้อ ฉบับภาษาไทย (validated)",
  max: 48,
  items: [
    zbi("ไม่มีเวลาให้ตัวเอง", "รู้สึกว่าไม่มีเวลาเพียงพอสำหรับตัวเอง เพราะต้องดูแลผู้ป่วย"),
    zbi("เครียดจากหลายบทบาท", "รู้สึกเครียดระหว่างการดูแลผู้ป่วยกับความรับผิดชอบอื่น เช่น ครอบครัวหรืองาน"),
    zbi("โกรธ", "รู้สึกโกรธเมื่ออยู่ใกล้ผู้ป่วย"),
    zbi("กระทบความสัมพันธ์", "รู้สึกว่าผู้ป่วยส่งผลเสียต่อความสัมพันธ์ของท่านกับคนในครอบครัวหรือเพื่อน"),
    zbi("ตึงเครียด", "รู้สึกตึงเครียดเมื่ออยู่ใกล้ผู้ป่วย"),
    zbi("สุขภาพแย่ลง", "รู้สึกว่าสุขภาพของท่านแย่ลงเพราะต้องดูแลผู้ป่วย"),
    zbi("ไม่มีความเป็นส่วนตัว", "รู้สึกว่าไม่มีความเป็นส่วนตัวเท่าที่ต้องการเพราะผู้ป่วย"),
    zbi("ชีวิตสังคมแย่ลง", "รู้สึกว่าชีวิตทางสังคมของท่านแย่ลงเพราะต้องดูแลผู้ป่วย"),
    zbi("สูญเสียการควบคุมชีวิต", "รู้สึกว่าสูญเสียการควบคุมชีวิตของตนเองตั้งแต่ผู้ป่วยเจ็บป่วย"),
    zbi("ไม่แน่ใจว่าจะทำอย่างไร", "รู้สึกไม่แน่ใจว่าจะทำอย่างไรกับผู้ป่วย"),
    zbi("ควรทำได้มากกว่านี้", "รู้สึกว่าควรทำเพื่อผู้ป่วยได้มากกว่านี้"),
    zbi("น่าจะดูแลได้ดีกว่านี้", "รู้สึกว่าตนเองน่าจะดูแลผู้ป่วยได้ดีกว่านี้"),
  ],
  read: (p) => {
    const t = sum(p);
    if (t >= 21)
      return {
        badge: "ภาระสูง",
        tone: "bad",
        result: `ZBI-12 ${t}/48 · ภาระผู้ดูแลสูง`,
        advice:
          "ภาระผู้ดูแลสูง เสี่ยงหมดไฟและซึมเศร้า จัดการพักผ่อนทดแทน (respite care) หาผู้ดูแลสำรอง ส่งต่อนักสังคมสงเคราะห์/ทีมสุขภาพจิต และคัดกรอง 2Q ผู้ดูแล",
      };
    if (t >= 11)
      return {
        badge: "ภาระปานกลาง",
        tone: "warn",
        result: `ZBI-12 ${t}/48 · ภาระปานกลาง`,
        advice: "ให้ความรู้และทักษะการดูแล แนะนำแหล่งช่วยเหลือในชุมชน วางแผนแบ่งเบาภาระ และประเมินซ้ำทุก 3 เดือน",
      };
    return {
      badge: "ภาระน้อย",
      tone: "good",
      result: `ZBI-12 ${t}/48 · ภาระน้อย`,
      advice: "ผู้ดูแลรับมือได้ดี ให้กำลังใจ และประเมินซ้ำเมื่ออาการผู้ป่วยเปลี่ยนแปลง",
    };
  },
};

/* ----------------------------------------------------------------- MNA-SF */

/** Nestlé's Thai MNA, the screening half (A–F), verbatim. */
const MNA: Questionnaire = {
  key: "mna",
  title: "โภชนาการ MNA-SF",
  lead: "Mini Nutritional Assessment · การคัดกรอง 6 ข้อ",
  source: "Mini Nutritional Assessment MNA® ฉบับภาษาไทย (Nestlé Nutrition Institute)",
  max: 14,
  items: [
    {
      kind: "choice",
      short: "A · กินได้น้อยลง",
      text: "ในช่วง 3 เดือนที่ผ่านมา รับประทานอาหารได้น้อยลงเนื่องจากความอยากอาหารลดลง มีปัญหาการย่อย การเคี้ยว หรือปัญหาการกลืนหรือไม่",
      options: [
        { label: "รับประทานอาหารน้อยลงอย่างมาก", points: 0 },
        { label: "รับประทานอาหารน้อยลงปานกลาง", points: 1 },
        { label: "การรับประทานอาหารไม่เปลี่ยนแปลง", points: 2 },
      ],
    },
    {
      kind: "choice",
      short: "B · น้ำหนักลด",
      text: "ในช่วง 3 เดือนที่ผ่านมา น้ำหนักลดลงหรือไม่",
      options: [
        { label: "น้ำหนักลดมากกว่า 3 กิโลกรัม", points: 0 },
        { label: "ไม่ทราบ", points: 1 },
        { label: "น้ำหนักลดระหว่าง 1–3 กิโลกรัม", points: 2 },
        { label: "น้ำหนักไม่ลดลง", points: 3 },
      ],
    },
    {
      kind: "choice",
      short: "C · การเคลื่อนไหว",
      text: "สามารถเคลื่อนไหวได้เองหรือไม่",
      options: [
        { label: "นอนบนเตียง หรือต้องอาศัยรถเข็นตลอดเวลา", points: 0 },
        { label: "ลุกจากเตียงหรือรถเข็นได้บ้าง แต่ไม่สามารถไปข้างนอกได้เอง", points: 1 },
        { label: "เดินและเคลื่อนไหวได้ตามปกติ", points: 2 },
      ],
    },
    {
      kind: "choice",
      short: "D · เครียด / ป่วยเฉียบพลัน",
      text: "ใน 3 เดือนที่ผ่านมา มีความเครียดรุนแรงหรือป่วยเฉียบพลันหรือไม่",
      options: [
        { label: "มี", points: 0 },
        { label: "ไม่มี", points: 2 },
      ],
    },
    {
      kind: "choice",
      short: "E · จิตประสาท",
      text: "มีปัญหาทางจิตประสาท (Neuropsychological problems) หรือไม่",
      options: [
        { label: "ความจำเสื่อม หรือซึมเศร้าอย่างรุนแรง", points: 0 },
        { label: "ความจำเสื่อมเล็กน้อย", points: 1 },
        { label: "ไม่มีปัญหาทางประสาท", points: 2 },
      ],
    },
    {
      kind: "choice",
      short: "F · ดัชนีมวลกาย",
      text: "ดัชนีมวลกาย (BMI) = น้ำหนัก (กก.) / ส่วนสูง (ม.)²",
      options: [
        { label: "BMI น้อยกว่า 19", points: 0 },
        { label: "BMI ตั้งแต่ 19 แต่น้อยกว่า 21", points: 1 },
        { label: "BMI ตั้งแต่ 21 แต่น้อยกว่า 23", points: 2 },
        { label: "BMI ตั้งแต่ 23 ขึ้นไป", points: 3 },
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
        badge: "ยังไม่ครบ",
        tone: "warn",
        result: `MNA-SF ${t}/14 (ตอบ ${answered(p)}/6 ข้อ)`,
        advice: "ตอบให้ครบ 6 ข้อจึงแปลผลได้",
      };
    if (t >= 12)
      return { badge: "โภชนาการปกติ", tone: "good", result: `MNA-SF ${t}/14 · ภาวะโภชนาการปกติ`, advice: "ภาวะโภชนาการปกติ คัดกรองซ้ำปีละครั้ง หรือเมื่อเจ็บป่วย/น้ำหนักเปลี่ยน" };
    if (t >= 8)
      return {
        badge: "เสี่ยงขาดสารอาหาร",
        tone: "warn",
        result: `MNA-SF ${t}/14 · เสี่ยงต่อภาวะขาดสารอาหาร`,
        advice: "เสี่ยงต่อภาวะขาดสารอาหาร ทำ MNA ฉบับเต็มเพื่อประเมินต่อ แนะนำอาหารโปรตีนและพลังงานเพียงพอ ติดตามน้ำหนักทุกเดือน",
      };
    return {
      badge: "ขาดสารอาหาร",
      tone: "bad",
      result: `MNA-SF ${t}/14 · ขาดสารอาหาร`,
      advice: "ขาดสารอาหาร ส่งต่อนักกำหนดอาหาร/แพทย์เพื่อวางแผนโภชนบำบัด หาสาเหตุ (การกลืน ฟัน ซึมเศร้า โรคร่วม) และติดตามน้ำหนักทุก 2 สัปดาห์",
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
