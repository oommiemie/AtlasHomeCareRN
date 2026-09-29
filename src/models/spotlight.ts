/**
 * App-wide search — the index behind the Spotlight screen.
 *
 * Every screen already had a search of its own, each over one list: visits on
 * the plan, houses in a village, pins on the map. This is the other kind: one
 * field that reaches everything the app holds, so a carer who remembers only
 * a patient's name does not first have to work out which screen keeps them.
 *
 * The model knows nothing about navigation. Each hit carries a `target`
 * describing where it lives, and the screen turns that into a route — so
 * adding a searchable thing here never means touching the navigator.
 */
import type { NavigatorScreenParams } from "@react-navigation/native";

import type {
  MainTabParamList,
  RootStackParamList,
} from "../navigation/RootStack";
import {
  sampleVillages,
  villageFullName,
  type House,
  type Resident,
  type Village,
} from "./household";
import { givenName, sampleTasks, todayTasks, isDone, type Task } from "./task";
import { taskRoute } from "../navigation/openTask";
import { thaiShortDate } from "../utils/thaiDate";
import { isEn, tr } from "../i18n";

/** What a hit is — decides its icon, its tint, and the group it lands in. */
export type SpotKind =
  | "visit"
  | "posting"
  | "resident"
  | "house"
  | "village"
  | "service"
  | "setting";

export type SpotTarget =
  /** A screen on the root stack. */
  | { go: "stack"; route: keyof RootStackParamList; params?: object }
  /** One of the four tabs, reached through the tab host. */
  | { go: "tab"; tab: keyof MainTabParamList }
  /** Indexed so it can be found, but not built yet. */
  | { go: "none"; message: string };

export type SpotHit = {
  id: string;
  kind: SpotKind;
  title: string;
  subtitle?: string;
  /**
   * Matched but never shown — an address, a phone number, a หมู่ label. It is
   * what lets a carer who knows the soi and not the house number still land
   * on the record.
   */
  extra?: string;
  /**
   * A second name to rank a prefix against. Thai names carry an honorific, so
   * "สมชาย" is not the start of "นายสมชาย" and would score as a weak middle
   * match against every other one.
   */
  alias?: string;
  target: SpotTarget;
};

export type SpotGroup = {
  kind: SpotKind;
  label: string;
  hits: SpotHit[];
  /** Before the cap, so the group can say how many it is not showing. */
  total: number;
};

export const SPOT_KIND_LABEL: Record<SpotKind, string> = {
  visit: tr("ภารกิจของฉัน", "My tasks"),
  posting: tr("ภารกิจใหม่", "New tasks"),
  resident: tr("ผู้ป่วยและผู้อยู่อาศัย", "Patients and residents"),
  house: tr("บ้าน", "Houses"),
  village: tr("หมู่บ้าน", "Villages"),
  service: tr("บริการ", "Services"),
  setting: tr("การตั้งค่าและหน้าจอ", "Settings and screens"),
};

/*
  The fixed entries carry both languages in `extra`, whichever one is on
  screen: an English title and "หน้าแรก" hidden behind it, or the other way
  round. A carer who thinks of a page by the name it had in the other
  language still finds it, and the English words that are not its title —
  "calendar", "faq" — go on working in Thai as they always have.
*/
const both = (th: string, en: string, more = "") =>
  `${tr(en, th)} ${more}`.trim();

/** Groups come out in this order however the matches fell. */
const KIND_ORDER: SpotKind[] = [
  "visit",
  "posting",
  "resident",
  "house",
  "village",
  "service",
  "setting",
];

/** How many hits a group shows before it starts counting the rest. */
const GROUP_LIMIT = 4;

// ---------------------------------------------------------------------------
// The fixed half of the index: places rather than records.
// ---------------------------------------------------------------------------

/*
  Every service reaches its page.

  Five of these were indexed so they could be found and then said they were
  not open — which is the search telling somebody where a thing is and then
  refusing to take them. Three already had a page and were simply never
  wired to it; the other two have one now.
*/
const SERVICES: SpotHit[] = [
  {
    id: "svc-community",
    kind: "service",
    title: tr("บริการงานชุมชน", "Community services"),
    subtitle: tr("บันทึกเยี่ยมบ้าน คัดกรองความเสี่ยง", "Home visit records, risk screening"),
    extra: both("บริการงานชุมชน", "Community services", "community home visit screening card reader"),
    target: { go: "stack", route: "CardReader" },
  },
  {
    id: "svc-medicine",
    kind: "service",
    title: tr("ส่งเวชภัณฑ์และยา", "Medical supplies and medicines"),
    subtitle: tr("ติดตามจัดส่งยาถึงบ้านผู้ป่วย", "Track medicine deliveries to patients' homes"),
    extra: both("ส่งเวชภัณฑ์และยา", "Medical supplies and medicines", "supplies medication delivery drugs"),
    target: { go: "stack", route: "Supplies" },
  },
  {
    id: "svc-health",
    kind: "service",
    title: tr("ติดตามสุขภาพ", "Health follow-up"),
    subtitle: tr("เฝ้าระวังข้อมูลสุขภาพ", "Monitor health data"),
    extra: both("ติดตามสุขภาพ", "Health follow-up", "follow-up follow up monitoring vitals"),
    target: { go: "stack", route: "FollowUp" },
  },
  {
    id: "svc-houses",
    kind: "service",
    title: tr("บ้านที่ดูแล", "Households in my care"),
    subtitle: tr("ข้อมูลสิ่งแวดล้อมของผู้ป่วย", "Patients' home environment"),
    extra: both("บ้านที่ดูแล", "Households in my care", "houses households homes"),
    target: { go: "stack", route: "Houses" },
  },
  {
    id: "svc-dental",
    kind: "service",
    title: tr("ทันตสุขภาพในโรงเรียน", "School dental health"),
    subtitle: tr("กิจกรรมตรวจสุขภาพช่องปาก", "Oral health check activities"),
    extra: both("ทันตสุขภาพในโรงเรียน", "School dental health", "dental teeth school oral"),
    target: {
      go: "stack",
      route: "CareActivities",
      params: { kind: "dental" },
    },
  },
  {
    id: "svc-vaccine",
    kind: "service",
    title: tr("วัคซีนโรงเรียน", "School vaccination"),
    subtitle: tr("บริการฉีดวัคซีนสร้างภูมิคุ้มกัน", "Immunization services"),
    extra: both("วัคซีนโรงเรียน", "School vaccination", "vaccine vaccination immunization school"),
    target: {
      go: "stack",
      route: "CareActivities",
      params: { kind: "vaccination" },
    },
  },
];

const PLACES: SpotHit[] = [
  {
    id: "nav-home",
    kind: "setting",
    title: tr("หน้าแรก", "Home"),
    subtitle: tr("ภารกิจวันนี้และงานใหม่", "Today's tasks and new tasks"),
    extra: both("หน้าแรก", "Home", "home main today"),
    target: { go: "tab", tab: "Home" },
  },
  {
    id: "nav-plan",
    kind: "setting",
    title: tr("แผนเยี่ยม", "Visit plan"),
    subtitle: tr("ปฏิทิน ตารางเวลา และรายการ", "Calendar, schedule and list"),
    extra: both("แผนเยี่ยม", "Visit plan", "plan calendar schedule ปฏิทิน"),
    target: { go: "tab", tab: "Plan" },
  },
  {
    id: "nav-services",
    kind: "setting",
    title: tr("บริการ", "Services"),
    subtitle: tr("งานเยี่ยมบ้านและงานอนามัยโรงเรียน", "Home visits and school health"),
    extra: both("บริการ", "Services", "services"),
    target: { go: "tab", tab: "Services" },
  },
  {
    id: "nav-profile",
    kind: "setting",
    title: tr("โปรไฟล์ของฉัน", "My profile"),
    subtitle: tr("บัญชีและการตั้งค่าทั้งหมด", "Account and all settings"),
    extra: both("โปรไฟล์ของฉัน", "My profile", "ฉัน profile account settings"),
    target: { go: "tab", tab: "Profile" },
  },
  {
    id: "nav-map",
    kind: "setting",
    title: tr("สำรวจพื้นที่", "Explore area"),
    subtitle: tr("แผนที่ผู้ป่วยและเส้นทางเยี่ยมบ้าน", "Patient map and home visit routes"),
    extra: both("สำรวจพื้นที่", "Explore area", "map แผนที่ นำทาง explore route directions navigate"),
    target: { go: "stack", route: "ExploreMap" },
  },
  {
    id: "nav-tasklist",
    kind: "setting",
    title: tr("ภารกิจทั้งหมด", "All tasks"),
    subtitle: tr("งานที่ยังเปิดรับ", "Tasks still open"),
    extra: both("ภารกิจทั้งหมด", "All tasks", "all tasks postings"),
    target: { go: "stack", route: "TaskList" },
  },
  {
    id: "set-notifications",
    kind: "setting",
    title: tr("การแจ้งเตือน", "Notifications"),
    subtitle: tr("จัดการการแจ้งเตือนที่ต้องการรับ", "Choose which notifications you get"),
    extra: both("การแจ้งเตือน", "Notifications", "notifications alerts"),
    target: { go: "stack", route: "NotificationSettings" },
  },
  {
    id: "set-language",
    kind: "setting",
    title: tr("ภาษา", "Language"),
    subtitle: tr("ภาษาที่ใช้แสดงผลในแอพ", "The language the app is shown in"),
    extra: both("ภาษา", "Language", "language ไทย thai english อังกฤษ"),
    target: { go: "stack", route: "LanguageSettings" },
  },
  {
    id: "set-help",
    kind: "setting",
    title: tr("ศูนย์ช่วยเหลือ", "Help center"),
    subtitle: tr("คำถามที่พบบ่อยเกี่ยวกับการใช้งาน", "Frequently asked questions"),
    extra: both("ศูนย์ช่วยเหลือ", "Help center", "help faq support"),
    target: { go: "stack", route: "HelpCenter" },
  },
  {
    id: "set-report",
    kind: "setting",
    title: tr("รายงานปัญหา", "Report a problem"),
    subtitle: tr("แจ้งปัญหาการใช้งานให้ทีมงาน", "Tell the team about a problem"),
    extra: both("รายงานปัญหา", "Report a problem", "report bug problem issue feedback"),
    target: { go: "stack", route: "ReportProblem" },
  },
];

/** What the screen offers before anything has been typed. */
export const SPOT_SHORTCUTS: SpotHit[] = [
  PLACES[4], // สำรวจพื้นที่
  SERVICES[3], // บ้านที่ดูแล
  PLACES[5], // ภารกิจทั้งหมด
  PLACES[1], // แผนเยี่ยม
];

// ---------------------------------------------------------------------------
// The moving half: records, rebuilt from the current feeds.
// ---------------------------------------------------------------------------

const taskHit = (t: Task, kind: SpotKind): SpotHit => ({
  id: `${kind}-${t.id}`,
  kind,
  title: t.name,
  alias: givenName(t.name),
  subtitle:
    kind === "visit"
      ? `${isDone(t) ? tr("เสร็จแล้ว", "Done") : tr("รอดำเนินการ", "Pending")} · ${t.detail}`
      : `${thaiShortDate(t.dueAt)} · ${t.detail}`,
  extra: t.address,
  target: {
    go: "stack",
    route: taskRoute(t).name,
    params: taskRoute(t).params,
  },
});

const residentHit = (r: Resident, h: House, v: Village): SpotHit => ({
  id: `res-${r.id}`,
  kind: "resident",
  title: r.name,
  alias: givenName(r.name),
  subtitle: `${tr(`${r.age} ปี`, `${r.age} yrs`)} · ${h.number} ${villageFullName(v)}`,
  extra: `${r.phone} ${h.address}`,
  target: { go: "stack", route: "HealthTracking", params: { resident: r } },
});

const houseHit = (h: House, v: Village): SpotHit => ({
  id: `house-${h.id}`,
  kind: "house",
  title: `${h.number} ${villageFullName(v)}`,
  alias: h.number,
  subtitle: h.address,
  extra: `${h.registrationNo} ${h.residents.map((r) => r.name).join(" ")}`,
  target: { go: "stack", route: "HouseDetail", params: { house: h } },
});

const villageHit = (v: Village): SpotHit => ({
  id: `vil-${v.id}`,
  kind: "village",
  title: villageFullName(v),
  alias: v.name,
  subtitle: tr(
    `${v.houses.length} หลังคาเรือน`,
    `${v.houses.length} household${v.houses.length === 1 ? "" : "s"}`,
  ),
  target: { go: "stack", route: "HouseList", params: { village: v } },
});

/**
 * The registry half of the index, built once.
 *
 * Villages, houses and residents are fixed sample data — roughly four hundred
 * rows — so there is nothing to gain from rebuilding them per keystroke, and
 * the first search would pay for it.
 */
let registry: SpotHit[] | null = null;

function registryIndex(): SpotHit[] {
  if (registry) return registry;
  const out: SpotHit[] = [];
  for (const v of sampleVillages) {
    out.push(villageHit(v));
    for (const h of v.houses) {
      out.push(houseHit(h, v));
      for (const r of h.residents) out.push(residentHit(r, h, v));
    }
  }
  registry = out;
  return out;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/**
 * How well a hit answers the query — lower is better, -1 is no match at all.
 *
 * Rank by where the query landed, not by how much of the field it covered: a
 * name that starts with what was typed is what the carer meant, and a match
 * buried in an address is a long way behind it.
 */
function score(hit: SpotHit, q: string): number {
  const title = hit.title.toLowerCase();
  const alias = hit.alias?.toLowerCase();
  if (title === q || alias === q) return 0;
  if (title.startsWith(q) || alias?.startsWith(q)) return 1;
  if (title.includes(q) || alias?.includes(q)) return 2;
  if (hit.subtitle?.toLowerCase().includes(q)) return 3;
  if (hit.extra?.toLowerCase().includes(q)) return 4;
  return -1;
}

/**
 * Everything matching `query`, grouped by kind.
 *
 * An empty query returns nothing rather than everything — the screen shows
 * shortcuts and recents instead, the way Spotlight does.
 */
export function searchEverything(query: string): SpotGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const pool: SpotHit[] = [
    ...todayTasks().map((t) => taskHit(t, "visit")),
    ...sampleTasks.map((t) => taskHit(t, "posting")),
    ...registryIndex(),
    ...SERVICES,
    ...PLACES,
  ];

  const scored: { hit: SpotHit; rank: number }[] = [];
  for (const hit of pool) {
    const rank = score(hit, q);
    if (rank >= 0) scored.push({ hit, rank });
  }

  const groups: SpotGroup[] = [];
  for (const kind of KIND_ORDER) {
    const mine = scored
      .filter((s) => s.hit.kind === kind)
      .sort(
        (a, b) =>
          a.rank - b.rank ||
          a.hit.title.localeCompare(b.hit.title, isEn ? "en" : "th"),
      );
    if (!mine.length) continue;
    groups.push({
      kind,
      label: SPOT_KIND_LABEL[kind],
      hits: mine.slice(0, GROUP_LIMIT).map((s) => s.hit),
      total: mine.length,
    });
  }
  return groups;
}

/** Total across groups, for the "ไม่พบ" case and the result count. */
export const spotCount = (groups: SpotGroup[]) =>
  groups.reduce((n, g) => n + g.total, 0);

// ---------------------------------------------------------------------------
// Recents
// ---------------------------------------------------------------------------

/**
 * What was opened from search before, newest first.
 *
 * In memory for the session only: the app has no storage dependency yet, and
 * adding one for a convenience list would be the wrong order to do it in.
 */
let recents: SpotHit[] = [];

const RECENT_LIMIT = 5;

export const recentSpots = () => recents;

export function rememberSpot(hit: SpotHit) {
  recents = [hit, ...recents.filter((r) => r.id !== hit.id)].slice(
    0,
    RECENT_LIMIT,
  );
}

export function forgetSpots() {
  recents = [];
}

/** Nested-navigator params for the tab host, for callers dispatching a hit. */
export type MainTarget = NavigatorScreenParams<MainTabParamList>;
