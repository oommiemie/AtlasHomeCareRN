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

import { tr } from "../i18n";
import { buddhistYear, thaiMonthShort } from "../utils/thaiDate";

/** The five domains, in the order the manual prints them. */
export const DOMAINS = ["GM", "FM", "RL", "EL", "PS"] as const;
export type Domain = (typeof DOMAINS)[number];

export const DOMAIN_LABEL: Record<Domain, string> = {
  GM: tr("กล้ามเนื้อมัดใหญ่", "Gross motor"),
  FM: tr("กล้ามเนื้อมัดเล็ก", "Fine motor"),
  RL: tr("การเข้าใจภาษา", "Receptive language"),
  EL: tr("การใช้ภาษา", "Expressive language"),
  PS: tr("สังคมและการช่วยเหลือตนเอง", "Personal and social"),
};

/** What the screen says about where these items come from. */
export const SOURCE_NOTE =
  tr("ข้อประเมินอ้างอิงคู่มือ DSPM ของกรมอนามัย — ต้นแบบนี้ใช้ชุดย่อ ค่าจริงต้องผูกกับชุดข้อมูลฉบับเต็ม", "Items follow the Department of Health's DSPM manual — this prototype uses an abridged set; production must bind to the full item bank.");

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
      item(1, "GM", tr("พลิกคว่ำพลิกหงายได้เอง", "Rolls from back to front and front to back")),
      item(2, "FM", tr("คว้าของมือเดียวและเปลี่ยนมือถือได้", "Reaches for an object with one hand and passes it to the other")),
      item(3, "RL", tr("หันหาเสียงที่ดังข้างตัว", "Turns toward a sound at their side")),
      item(4, "EL", tr("ส่งเสียงอ้อแอ้โต้ตอบ", "Babbles back in response")),
      item(5, "PS", tr("ยิ้มและมองหน้าคนคุ้นเคย", "Smiles at and looks at familiar faces")),
    ],
  },
  {
    months: 9,
    items: [
      item(1, "GM", tr("นั่งได้มั่นคงและเอื้อมหยิบของ", "Sits steadily and reaches for objects")),
      item(2, "FM", tr("ใช้นิ้วหัวแม่มือและนิ้วชี้หยิบของชิ้นเล็ก", "Picks up small objects with thumb and index finger")),
      item(3, "RL", tr("หันตามเสียงเรียกชื่อ", "Turns when their name is called")),
      item(4, "EL", tr("เล่นเสียงพยางค์ซ้ำ ๆ เช่น จ๊ะ ๆ", "Repeats syllables, e.g. \"da-da\"")),
      item(5, "PS", tr("เล่นจ๊ะเอ๋และแสดงท่าทางโต้ตอบ", "Plays peekaboo and responds with gestures")),
    ],
  },
  {
    months: 12,
    items: [
      item(1, "GM", tr("เกาะยืนและก้าวเดินข้าง ๆ เครื่องเรือน", "Pulls to stand and cruises along furniture")),
      item(2, "FM", tr("หยิบของใส่ภาชนะและหยิบออก", "Puts objects into a container and takes them out")),
      item(3, "RL", tr("ทำตามคำสั่งง่าย ๆ พร้อมท่าทาง", "Follows simple instructions given with gestures")),
      item(4, "EL", tr("พูดคำที่มีความหมายได้ 1 คำ", "Says 1 meaningful word")),
      item(5, "PS", tr("โบกมือลาหรือปรบมือตามแบบ", "Waves bye-bye or claps when shown")),
    ],
  },
  {
    months: 18,
    items: [
      item(1, "GM", tr("เดินได้เองอย่างมั่นคง", "Walks steadily alone")),
      item(2, "FM", tr("ขีดเขียนเป็นเส้นยุ่ง ๆ ด้วยดินสอสี", "Scribbles with a crayon")),
      item(3, "RL", tr("ชี้อวัยวะบนร่างกายได้ 1 ส่วน", "Points to 1 body part")),
      item(4, "EL", tr("พูดคำที่มีความหมายได้ 3–5 คำ", "Says 3–5 meaningful words")),
      item(5, "PS", tr("ใช้ช้อนตักอาหารเข้าปากเองได้บ้าง", "Feeds self with a spoon, with some spilling")),
    ],
  },
  {
    months: 24,
    items: [
      item(1, "GM", tr("วิ่งได้และเตะลูกบอล", "Runs and kicks a ball")),
      item(2, "FM", tr("ต่อก้อนไม้ซ้อนกันได้ 4 ก้อน", "Stacks 4 blocks")),
      item(3, "RL", tr("ชี้รูปภาพตามคำบอกได้ 2 รูป", "Points to 2 named pictures")),
      item(4, "EL", tr("พูดต่อกัน 2 คำเป็นวลี", "Puts 2 words together in a phrase")),
      item(5, "PS", tr("ถอดกางเกงหรือรองเท้าเองได้", "Takes off trousers or shoes alone")),
    ],
  },
  {
    months: 36,
    items: [
      item(1, "GM", tr("ยืนขาเดียวได้นาน 1–2 วินาที", "Stands on one foot for 1–2 seconds")),
      item(2, "FM", tr("วาดวงกลมตามแบบ", "Copies a circle")),
      item(3, "RL", tr("เข้าใจคำบอกตำแหน่ง บน–ใต้", "Understands position words: on / under")),
      item(4, "EL", tr("บอกชื่อและเพศของตนเองได้", "Says own name and sex")),
      item(5, "PS", tr("เล่นร่วมกับเด็กอื่นและรอคอยได้", "Plays with other children and can wait a turn")),
    ],
  },
  {
    months: 42,
    items: [
      item(1, "GM", tr("กระโดดสองเท้าพร้อมกันไปข้างหน้า", "Jumps forward with both feet together")),
      item(2, "FM", tr("วาดกากบาทตามแบบ", "Copies a cross")),
      item(3, "RL", tr("เข้าใจคำถาม ใคร ที่ไหน", "Understands \"who\" and \"where\" questions")),
      item(4, "EL", tr("เล่าเหตุการณ์ที่เพิ่งเกิดขึ้นได้", "Tells about something that just happened")),
      item(5, "PS", tr("ล้างและเช็ดมือเองได้", "Washes and dries hands alone")),
    ],
  },
  {
    months: 48,
    items: [
      item(1, "GM", tr("ยืนขาเดียวได้นาน 5 วินาที", "Stands on one foot for 5 seconds")),
      item(2, "FM", tr("วาดรูปคนที่มีส่วนประกอบ 3 ส่วน", "Draws a person with 3 body parts")),
      item(3, "RL", tr("เข้าใจคำเปรียบเทียบ ใหญ่–เล็ก มาก–น้อย", "Understands comparisons: big / small, more / less")),
      item(4, "EL", tr("พูดเป็นประโยคที่คนนอกบ้านฟังเข้าใจ", "Speaks in sentences strangers can understand")),
      item(5, "PS", tr("แต่งตัวเองได้โดยมีคนช่วยเล็กน้อย", "Dresses with a little help")),
    ],
  },
  {
    months: 54,
    items: [
      item(1, "GM", tr("กระโดดขาเดียวต่อเนื่องได้", "Hops on one foot repeatedly")),
      item(2, "FM", tr("วาดสามเหลี่ยมตามแบบ", "Copies a triangle")),
      item(3, "RL", tr("เข้าใจคำบอกลำดับ ที่หนึ่ง ที่สอง", "Understands order words: first, second")),
      item(4, "EL", tr("ตอบคำถามว่าทำไมได้", "Answers \"why\" questions")),
      item(5, "PS", tr("เก็บของเล่นเข้าที่เมื่อเล่นเสร็จ", "Puts toys away after playing")),
    ],
  },
  {
    months: 60,
    items: [
      item(1, "GM", tr("เดินต่อเท้าบนเส้นตรง 5 ก้าว", "Walks heel-to-toe along a line for 5 steps")),
      item(2, "FM", tr("เขียนชื่อตัวเองตามแบบ", "Copies own name")),
      item(3, "FM", tr("วาดสี่เหลี่ยมตามแบบ", "Copies a square")),
      item(4, "RL", tr("เข้าใจลำดับก่อน–หลัง และจำนวน 1–10", "Understands before / after and numbers 1–10")),
      item(5, "EL", tr("เล่าเรื่องจากภาพได้ต่อเนื่อง", "Tells a connected story from a picture")),
      item(6, "PS", tr("ช่วยงานบ้านง่าย ๆ และบอกที่อยู่ตนเองได้", "Helps with simple chores and can say their address")),
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
 * to be taught the skill and re-screened in a month — tr("สงสัยล่าช้า", "Suspected delay"). Only a
 * child who misses again, or who is well past the window, is referred.
 */
export type DspmLevel = "onTrack" | "suspect" | "delayed";

export const LEVEL_LABEL: Record<DspmLevel, string> = {
  onTrack: tr("สมวัย", "On track"),
  suspect: tr("สงสัยล่าช้า", "Suspected delay"),
  delayed: tr("ล่าช้า", "Delayed"),
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
 * tr("สงสัยล่าช้า", "Suspected delay") and the child comes back in a month; a second round with
 * the same miss is tr("ล่าช้า", "Delayed") and goes on for referral.
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

const monthYear = (d: Date) => `${thaiMonthShort(d)} ${buddhistYear(d)}`;

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
      title: tr("ส่งต่อประเมินโดยผู้เชี่ยวชาญ", "Refer for specialist assessment"),
      detail: tr(
        `พบข้อไม่ผ่านซ้ำในด้าน ${r.failed.join(" · ")} — ส่งต่อ รพ.สต./โรงพยาบาลตามระบบ และแจ้งผู้ปกครองภายในสัปดาห์นี้`,
        `Failed again in ${r.failed.join(" · ")} — refer to the SHPH / hospital through the usual pathway and inform the parents this week`,
      ),
    };
  }
  if (r.level === "suspect") {
    return {
      level: "suspect",
      title: tr("สอนพ่อแม่ส่งเสริม และนัดประเมินซ้ำใน 1 เดือน", "Coach parents to stimulate and rescreen in 1 month"),
      detail: tr(
        `ฝึกทักษะด้าน ${r.failed.join(" · ")} ตามคู่มือ DSPM ที่บ้านทุกวัน · นัดประเมินซ้ำ ${monthYear(plus(on, 1))}`,
        `Practise ${r.failed.join(" · ")} skills at home every day using the DSPM manual · Rescreen ${monthYear(plus(on, 1))}`,
      ),
    };
  }
  return {
    level: "onTrack",
    title: tr("ไม่ต้องติดตามพิเศษ", "No special follow-up needed"),
    detail:
      nextWindow == null
        ? tr("แนะนำกิจกรรมส่งเสริมตามวัย — ครบชุดคัดกรองปฐมวัยแล้ว", "Suggest age-appropriate activities — early-childhood screening complete")
        : tr(
            `แนะนำกิจกรรมส่งเสริมตามวัย และนัดคัดกรองช่วงอายุ ${nextWindow} เดือน`,
            `Suggest age-appropriate activities and book the ${nextWindow}-month screening`,
          ),
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
