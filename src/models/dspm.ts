/**
 * DSPM — คัดกรองพัฒนาการเด็กปฐมวัย, and what a round of it records.
 *
 * The other nursery round weighs a child and reads three tables. This one
 * asks them to do things: walk a line, draw a square, tell a story from a
 * picture. Each thing is one item, every item belongs to one of five
 * domains, and the whole instrument is organised by AGE WINDOW — the set of
 * items a child is due at nine months is not the set they are due at five
 * years, and a screening that asked all of them would take an afternoon a
 * child.
 *
 * So the shape here is: windows hold items, items belong to domains, and a
 * child is screened against the one window their birthday puts them in. A
 * domain passes when every item in it passed; the child is สมวัย when every
 * domain did.
 *
 * ── On the content ──────────────────────────────────────────────────────
 *
 * An abridged instrument. The real DSPM is the Ministry's own manual —
 * seventeen windows, over a hundred items, each with its own materials and
 * its own way of being administered — and a production build has to bind to
 * that, which `SOURCE_NOTE` says on the screen. What this holds is the
 * right structure, the right five domains and a believable handful of items
 * per window, which is what the screens around it are built against.
 *
 * Nothing here touches the file system or React.
 */

/** The five domains, in the order the manual prints them. */
export const DOMAINS = ["GM", "FM", "RL", "EL", "PS"] as const;
export type Domain = (typeof DOMAINS)[number];

export const DOMAIN_LABEL: Record<Domain, string> = {
  GM: "กล้ามเนื้อมัดใหญ่",
  FM: "กล้ามเนื้อมัดเล็ก",
  RL: "การเข้าใจภาษา",
  EL: "การใช้ภาษา",
  PS: "สังคมและการช่วยเหลือตนเอง",
};

/** What the screen says about where these items come from. */
export const SOURCE_NOTE =
  "ข้อประเมินอ้างอิงคู่มือ DSPM ของกรมอนามัย — ต้นแบบนี้ใช้ชุดย่อ ค่าจริงต้องผูกกับชุดข้อมูลฉบับเต็ม";

/** One thing a child is asked to do. */
export type Item = {
  /** Its number within the window, which is what a carer calls it. */
  no: number;
  domain: Domain;
  text: string;
};

/**
 * The age windows, in months, and what each one asks.
 *
 * Fewer than the manual's seventeen and chosen for the ages a ศพด. actually
 * holds: a nursery's roster is nine months to five years, and the windows
 * below cover it at the intervals the manual screens on.
 */
export type Window = { months: number; items: Item[] };

const item = (no: number, domain: Domain, text: string): Item => ({
  no,
  domain,
  text,
});

export const WINDOWS: Window[] = [
  {
    months: 6,
    items: [
      item(1, "GM", "พลิกคว่ำพลิกหงายได้เอง"),
      item(2, "FM", "คว้าของมือเดียวและเปลี่ยนมือถือได้"),
      item(3, "RL", "หันหาเสียงที่ดังข้างตัว"),
      item(4, "EL", "ส่งเสียงอ้อแอ้โต้ตอบ"),
      item(5, "PS", "ยิ้มและมองหน้าคนคุ้นเคย"),
    ],
  },
  {
    months: 9,
    items: [
      item(1, "GM", "นั่งได้มั่นคงและเอื้อมหยิบของ"),
      item(2, "FM", "ใช้นิ้วหัวแม่มือและนิ้วชี้หยิบของชิ้นเล็ก"),
      item(3, "RL", "หันตามเสียงเรียกชื่อ"),
      item(4, "EL", "เล่นเสียงพยางค์ซ้ำ ๆ เช่น จ๊ะ ๆ"),
      item(5, "PS", "เล่นจ๊ะเอ๋และแสดงท่าทางโต้ตอบ"),
    ],
  },
  {
    months: 12,
    items: [
      item(1, "GM", "เกาะยืนและก้าวเดินข้าง ๆ เครื่องเรือน"),
      item(2, "FM", "หยิบของใส่ภาชนะและหยิบออก"),
      item(3, "RL", "ทำตามคำสั่งง่าย ๆ พร้อมท่าทาง"),
      item(4, "EL", "พูดคำที่มีความหมายได้ 1 คำ"),
      item(5, "PS", "โบกมือลาหรือปรบมือตามแบบ"),
    ],
  },
  {
    months: 18,
    items: [
      item(1, "GM", "เดินได้เองอย่างมั่นคง"),
      item(2, "FM", "ขีดเขียนเป็นเส้นยุ่ง ๆ ด้วยดินสอสี"),
      item(3, "RL", "ชี้อวัยวะบนร่างกายได้ 1 ส่วน"),
      item(4, "EL", "พูดคำที่มีความหมายได้ 3–5 คำ"),
      item(5, "PS", "ใช้ช้อนตักอาหารเข้าปากเองได้บ้าง"),
    ],
  },
  {
    months: 24,
    items: [
      item(1, "GM", "วิ่งได้และเตะลูกบอล"),
      item(2, "FM", "ต่อก้อนไม้ซ้อนกันได้ 4 ก้อน"),
      item(3, "RL", "ชี้รูปภาพตามคำบอกได้ 2 รูป"),
      item(4, "EL", "พูดต่อกัน 2 คำเป็นวลี"),
      item(5, "PS", "ถอดกางเกงหรือรองเท้าเองได้"),
    ],
  },
  {
    months: 36,
    items: [
      item(1, "GM", "ยืนขาเดียวได้นาน 1–2 วินาที"),
      item(2, "FM", "วาดวงกลมตามแบบ"),
      item(3, "RL", "เข้าใจคำบอกตำแหน่ง บน–ใต้"),
      item(4, "EL", "บอกชื่อและเพศของตนเองได้"),
      item(5, "PS", "เล่นร่วมกับเด็กอื่นและรอคอยได้"),
    ],
  },
  {
    months: 42,
    items: [
      item(1, "GM", "กระโดดสองเท้าพร้อมกันไปข้างหน้า"),
      item(2, "FM", "วาดกากบาทตามแบบ"),
      item(3, "RL", "เข้าใจคำถาม ใคร ที่ไหน"),
      item(4, "EL", "เล่าเหตุการณ์ที่เพิ่งเกิดขึ้นได้"),
      item(5, "PS", "ล้างและเช็ดมือเองได้"),
    ],
  },
  {
    months: 48,
    items: [
      item(1, "GM", "ยืนขาเดียวได้นาน 5 วินาที"),
      item(2, "FM", "วาดรูปคนที่มีส่วนประกอบ 3 ส่วน"),
      item(3, "RL", "เข้าใจคำเปรียบเทียบ ใหญ่–เล็ก มาก–น้อย"),
      item(4, "EL", "พูดเป็นประโยคที่คนนอกบ้านฟังเข้าใจ"),
      item(5, "PS", "แต่งตัวเองได้โดยมีคนช่วยเล็กน้อย"),
    ],
  },
  {
    months: 54,
    items: [
      item(1, "GM", "กระโดดขาเดียวต่อเนื่องได้"),
      item(2, "FM", "วาดสามเหลี่ยมตามแบบ"),
      item(3, "RL", "เข้าใจคำบอกลำดับ ที่หนึ่ง ที่สอง"),
      item(4, "EL", "ตอบคำถามว่าทำไมได้"),
      item(5, "PS", "เก็บของเล่นเข้าที่เมื่อเล่นเสร็จ"),
    ],
  },
  {
    months: 60,
    items: [
      item(1, "GM", "เดินต่อเท้าบนเส้นตรง 5 ก้าว"),
      item(2, "FM", "เขียนชื่อตัวเองตามแบบ"),
      item(3, "FM", "วาดสี่เหลี่ยมตามแบบ"),
      item(4, "RL", "เข้าใจลำดับก่อน–หลัง และจำนวน 1–10"),
      item(5, "EL", "เล่าเรื่องจากภาพได้ต่อเนื่อง"),
      item(6, "PS", "ช่วยงานบ้านง่าย ๆ และบอกที่อยู่ตนเองได้"),
    ],
  },
];

/**
 * Which window a child of this age is due.
 *
 * The largest window they have reached — a child of sixty-four months is
 * screened on the sixty-month set, because that is the last one their
 * birthday has taken them past. A child younger than the first window has
 * nothing due and the screen says so rather than inventing a set.
 */
export const windowFor = (months: number): Window | null => {
  let due: Window | null = null;
  for (const w of WINDOWS) if (months >= w.months) due = w;
  return due;
};

/** The windows already behind this child, newest last — what the chips show. */
export const windowsUpTo = (months: number): Window[] =>
  WINDOWS.filter((w) => months >= w.months);

/* ------------------------------------------------------------------ *
 * The verdict
 * ------------------------------------------------------------------ */

/**
 * What a screening can come out as.
 *
 * Three, and the middle one is the instrument's whole point. DSPM is not a
 * diagnosis: a child who misses an item is not delayed, they are a child
 * to be taught the skill and re-screened in a month — "สงสัยล่าช้า". Only a
 * child who misses again, or who is well past the window, is referred.
 */
export type DspmLevel = "onTrack" | "suspect" | "delayed";

export const LEVEL_LABEL: Record<DspmLevel, string> = {
  onTrack: "สมวัย",
  suspect: "สงสัยล่าช้า",
  delayed: "ล่าช้า",
};

/** How each item was answered. Absent from the map means unanswered. */
export type Answers = Record<number, boolean>;

export type DspmResult = {
  window: number;
  /** How many of the window's items have been answered at all. */
  answered: number;
  total: number;
  passed: number;
  /** The domains with at least one item not passed. */
  failed: Domain[];
  /** Which domains passed outright, for the strip along the foot. */
  byDomain: { domain: Domain; pass: boolean; answered: boolean }[];
  level: DspmLevel;
  label: string;
};

/**
 * What the answers add up to.
 *
 * A domain passes only when every item in it passed — one missed skill is a
 * missed domain, which is how the manual reads it. `round` is which time
 * this child has been screened on this window: the first time a miss is
 * "สงสัยล่าช้า" and the child comes back in a month; a second round with
 * the same miss is "ล่าช้า" and goes on for referral.
 */
export function assess(
  window: Window,
  answers: Answers,
  round = 1,
): DspmResult {
  const byDomain = DOMAINS.map((domain) => {
    const mine = window.items.filter((i) => i.domain === domain);
    return {
      domain,
      answered: mine.length > 0 && mine.every((i) => answers[i.no] != null),
      pass: mine.length > 0 && mine.every((i) => answers[i.no] === true),
    };
  }).filter((d) => window.items.some((i) => i.domain === d.domain));

  const answered = window.items.filter((i) => answers[i.no] != null).length;
  const passed = window.items.filter((i) => answers[i.no] === true).length;
  const failed = byDomain.filter((d) => d.answered && !d.pass).map((d) => d.domain);

  const level: DspmLevel =
    failed.length === 0 ? "onTrack" : round > 1 ? "delayed" : "suspect";

  return {
    window: window.months,
    answered,
    total: window.items.length,
    passed,
    failed,
    byDomain,
    level,
    label: LEVEL_LABEL[level],
  };
}

/* ------------------------------------------------------------------ *
 * What happens next
 * ------------------------------------------------------------------ */

export type Plan = { title: string; detail: string; level: DspmLevel };

const MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

const monthYear = (d: Date) =>
  `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;

const plus = (from: Date, months: number) => {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
};

/**
 * The plan the system has already lined up, given the result.
 *
 * Written here rather than chosen on the screen because it is the half of
 * the form a carer in a nursery hall has no time to compose, and the half
 * a child with a missed milestone depends on. A child who is สมวัย still
 * gets a plan — the next window — because "nothing wrong" and "nothing
 * booked" are not the same thing.
 */
export function planFor(r: DspmResult, on: Date, nextWindow: number | null): Plan {
  if (r.level === "delayed") {
    return {
      level: "delayed",
      title: "ส่งต่อประเมินโดยผู้เชี่ยวชาญ",
      detail: `พบข้อไม่ผ่านซ้ำในด้าน ${r.failed.join(" · ")} — ส่งต่อ รพ.สต./โรงพยาบาลตามระบบ และแจ้งผู้ปกครองภายในสัปดาห์นี้`,
    };
  }
  if (r.level === "suspect") {
    return {
      level: "suspect",
      title: "สอนพ่อแม่ส่งเสริม และนัดประเมินซ้ำใน 1 เดือน",
      detail: `ฝึกทักษะด้าน ${r.failed.join(" · ")} ตามคู่มือ DSPM ที่บ้านทุกวัน · นัดประเมินซ้ำ ${monthYear(plus(on, 1))}`,
    };
  }
  return {
    level: "onTrack",
    title: "ไม่ต้องติดตามพิเศษ",
    detail:
      nextWindow == null
        ? "แนะนำกิจกรรมส่งเสริมตามวัย — ครบชุดคัดกรองปฐมวัยแล้ว"
        : `แนะนำกิจกรรมส่งเสริมตามวัย และนัดคัดกรองช่วงอายุ ${nextWindow} เดือน`,
  };
}

/** The window after this one, where there is one. */
export const nextWindowAfter = (months: number): number | null =>
  WINDOWS.find((w) => w.months > months)?.months ?? null;

/** One completed screening, as it is written to the record. */
export type DspmRecord = {
  /** The age window it was carried out against. */
  window: number;
  /** Which time this child has been screened on that window. */
  round: number;
  answers: Answers;
  passed: number;
  total: number;
  failed: Domain[];
  level: DspmLevel;
  label: string;
  at: string;
};
