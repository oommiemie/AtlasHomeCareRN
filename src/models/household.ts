import { tr } from "../i18n";
import { daysFromToday } from "./clock";

/**
 * The "บ้านที่ดูแล" registry: villages, the houses in them, and the people
 * living in each house.
 *
 * Three nested levels, each its own screen: Village → House → Resident.
 * Stand-in data until this is wired to a backend; coordinates sit around
 * Pracha Uthit, matching the visits on the map.
 */

/** How a screening result reads. Drives the colour, so a row can be scanned. */
export type ScreeningStatus = "normal" | "atRisk" | "unknown";

/**
 * Which screening it is.
 *
 * Carried alongside the Thai name so the screen can pick a mark for it. The
 * name is display text and will be translated the day the app is; a key that
 * artwork is looked up by cannot be.
 */
export type ScreeningKind = "diabetes" | "pressure" | "stroke" | "obesity";

export const SCREENING_LABEL: Record<ScreeningStatus, string> = {
  normal: tr("ปกติ", "Normal"),
  atRisk: tr("เสี่ยง", "At risk"),
  unknown: tr("ยังไม่ประเมิน", "Not assessed"),
};

/** One chronic-disease screening. The date matters as much as the result: a
 *  "ปกติ" from two years ago is not reassurance. */
export type Screening = {
  kind: ScreeningKind;
  name: string;
  status: ScreeningStatus;
  takenAt: Date;
};

export type Resident = {
  id: string;
  name: string;
  age: number;
  /** "ชาย" / "หญิง" — the value, whatever the app speaks; see `genderLabel`. */
  gender: string;
  bloodType: string;
  phone: string;
  weightKg: number;
  heightCm: number;
  screenings: Screening[];
  /** Something needs following up — the avatar carries a red mark. */
  needsAttention?: boolean;
  /** A local file URI for their photograph, where one has been taken. */
  photo?: string;
};

export type House = {
  id: string;
  /** "บ้านเลขที่ 1" — how the house is known locally. */
  number: string;
  /** เลขทะเบียนบ้าน. */
  registrationNo: string;
  address: string;
  lat: number;
  lng: number;
  residents: Resident[];
};

export type Village = {
  id: string;
  name: string;
  /** "หมู่1" — the badge beside the name. */
  mooLabel: string;
  /**
   * Where it is — "แขวง… เขต… กรุงเทพฯ 10140".
   *
   * On the record rather than parsed back out of a house's address: village
   * names repeat around the country, and picking one from a list means
   * telling two of the same name apart.
   */
  district: string;
  houses: House[];
};

/**
 * Weight over height squared, or 0 where the record has neither.
 *
 * A house added in the app starts with members whose measurements have not
 * been taken yet. Without the guard that is a divide by zero, and NaN goes
 * on to poison the gauge's arc geometry as well as its caption.
 */
export const bmiOf = (r: Resident) =>
  r.heightCm > 0 && r.weightKg > 0
    ? r.weightKg / ((r.heightCm / 100) * (r.heightCm / 100))
    : 0;

/**
 * The Thai band label. WHO Asia-Pacific cut-offs, which are lower than the
 * global ones and are what Thai practice uses — 23 is overweight here, not 25.
 */
export function bmiLabel(r: Resident): string {
  const b = bmiOf(r);
  if (b === 0) return tr("ยังไม่ได้ชั่งน้ำหนัก", "Not yet weighed");
  if (b < 18.5) return tr("น้ำหนักน้อยกว่าเกณฑ์", "Underweight");
  if (b < 23) return tr("อยู่ในเกณฑ์ปกติ", "Normal");
  if (b < 25) return tr("น้ำหนักเกิน", "Overweight");
  if (b < 30) return tr("โรคอ้วนระดับ 1", "Obese class 1");
  return tr("โรคอ้วนระดับ 2", "Obese class 2");
}

/**
 * A sex as the carer reads it.
 *
 * The record keeps "ชาย" / "หญิง" in every language: forms and scores
 * (the 35-plus screening, the growth charts) test for those two words, and
 * a card read or a member added in Thai must still read in English. So the
 * value stays and the page shows this.
 */
export const genderLabel = (g: string): string =>
  g === "ชาย" ? tr(g, "Male") : g === "หญิง" ? tr(g, "Female") : g;

/** Inside the healthy band — the gauge and its caption read green only here. */
export const bmiHealthy = (r: Resident) => {
  const b = bmiOf(r);
  return b >= 18.5 && b < 23;
};

/** Where the reading sits along the gauge, 0 to 1. The arc spans 15 to 35. */
export const bmiFraction = (r: Resident) =>
  Math.min(1, Math.max(0, (bmiOf(r) - 15) / 20));

/** The Thai courtesy titles a resident's name can start with. */
const HONORIFICS = ["นางสาว", "นาง", "นาย", "เด็กชาย", "เด็กหญิง"];

/**
 * The name without its title.
 *
 * Longest first, because "นางสาว" starts with "นาง" — matched the other way
 * round, every นางสาว would keep a stray "สาว" on the front of her name.
 */
export function givenName(name: string): string {
  for (const h of HONORIFICS) {
    if (name.startsWith(h)) return name.slice(h.length).trim();
  }
  return name;
}

/**
 * The letter on an avatar with no photo.
 *
 * Off the given name, not the record's: every adult woman would otherwise
 * carry a "น" and the avatars would stop telling anyone apart.
 */
export const initialOf = (name: string) => givenName(name)[0] ?? "?";

export const populationOf = (h: House) => h.residents.length;
export const houseNeedsAttention = (h: House) =>
  h.residents.some((r) => r.needsAttention);

export const villagePopulation = (v: Village) =>
  v.houses.reduce((sum, h) => sum + h.residents.length, 0);
export const villageFullName = (v: Village) => `${v.name} ${v.mooLabel}`;

/** What the "เพิ่มสมาชิก" form collects. Everything else gets a default. */
export type NewResidentInput = {
  name: string;
  age: number;
  /** "ชาย" / "หญิง". */
  gender: string;
  phone: string;
  bloodType?: string;
  photo?: string;
};

/** What the "เพิ่มบ้าน" form collects. */
export type NewHouseInput = {
  registrationNo: string;
  /** "บ้านเลขที่ 12/3" — the number as it is written on the house. */
  number: string;
  /** The rest of the address: soi, road, landmark. */
  addressDetail: string;
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
  lat: number;
  lng: number;
  residents: NewResidentInput[];
};

/** The address as one line, skipping the parts that were left blank. */
export function composeAddress(i: NewHouseInput): string {
  // The place names are Thai either way; English drops the ต./อ./จ.
  // abbreviations, which mean nothing to its reader, and separates with commas.
  const parts = [
    i.number,
    i.addressDetail,
    i.subdistrict && tr(`ต.${i.subdistrict}`, i.subdistrict),
    i.district && tr(`อ.${i.district}`, i.district),
    i.province && tr(`จ.${i.province}`, i.province),
  ].filter((part) => part && String(part).trim().length > 0);
  const postal = i.postalCode.trim();
  return tr(
    [...parts, postal].filter((p) => p !== "").join(" "),
    `${parts.join(", ")}${postal !== "" ? ` ${postal}` : ""}`,
  );
}

/** A serial for records made in the app, so their ids cannot collide. */
let made = 0;

/**
 * Adds a house to a village.
 *
 * In memory, for as long as the app is running. There is no backend yet, and
 * a form that threw its answers away the moment it closed would be worse than
 * no form — this at least behaves the way the real one will. Screens that
 * show a village's houses re-read them on focus for the same reason.
 */
export function addHouse(village: Village, input: NewHouseInput): House {
  made += 1;
  const id = `new${made}`;
  const house: House = {
    id,
    number: input.number,
    registrationNo: input.registrationNo,
    address: composeAddress(input),
    lat: input.lat,
    lng: input.lng,
    residents: input.residents.map((r, i) => newResident(`${id}r${i}`, r)),
  };
  village.houses.push(house);
  return house;
}

/**
 * Adds one person to a house that already exists.
 *
 * In memory, like everything else written here — see `addHouse`. Screens that
 * show a household re-read it on focus for the same reason.
 */
export function addResident(house: House, input: NewResidentInput): Resident {
  made += 1;
  const resident = newResident(`add${made}`, input);
  house.residents.push(resident);
  return resident;
}

/**
 * A resident record from what the form asked for.
 *
 * The screenings are all "ยังไม่ประเมิน" rather than "ปกติ": nobody has
 * assessed this person, and a panel of green ticks would say they had.
 */
export function newResident(id: string, i: NewResidentInput): Resident {
  const takenAt = new Date(0);
  return {
    id,
    name: i.name,
    age: i.age,
    gender: i.gender,
    bloodType:
      i.bloodType != null && i.bloodType.length > 0
        ? i.bloodType
        : tr("ไม่ระบุ", "Not specified"),
    phone: i.phone,
    weightKg: 0,
    heightCm: 0,
    photo: i.photo != null && i.photo.length > 0 ? i.photo : undefined,
    screenings: panel(1).map((s) => ({ ...s, status: "unknown", takenAt })),
  };
}

/** Villages matching a query by name or หมู่. Empty query returns everything. */
export function searchVillages(villages: Village[], query: string): Village[] {
  const q = query.trim().toLowerCase();
  if (!q) return villages;
  return villages.filter(
    (v) =>
      v.name.toLowerCase().includes(q) || v.mooLabel.toLowerCase().includes(q),
  );
}

/** Houses matching by number, registration or address — a carer who knows the
 *  soi but not the house number still needs to find the record. */
export function searchHouses(houses: House[], query: string): House[] {
  const q = query.trim().toLowerCase();
  if (!q) return houses;
  return houses.filter(
    (h) =>
      h.number.toLowerCase().includes(q) ||
      h.registrationNo.includes(q) ||
      h.address.toLowerCase().includes(q),
  );
}

/** Members of one household matching by name, phone or sex. */
export function searchResidents(
  residents: Resident[],
  query: string,
): Resident[] {
  const q = query.trim().toLowerCase();
  if (!q) return residents;
  return residents.filter(
    (r) =>
      r.name.toLowerCase().includes(q) ||
      r.phone.includes(q) ||
      r.gender.includes(q) ||
      // "female" in English; startsWith, or every "female" is also a "male".
      genderLabel(r.gender).toLowerCase().startsWith(q),
  );
}

/**
 * The title a resident is addressed by.
 *
 * Read off age and sex rather than stored, so the two can never disagree.
 * Marital status is not in the record and cannot be — 35 is the line this
 * sample data draws between นางสาว and นาง, which is a stand-in for a field a
 * real registry would carry.
 */
const honorific = (age: number, female: boolean): string => {
  if (age < 18) return female ? "เด็กหญิง" : "เด็กชาย";
  if (!female) return "นาย";
  return age >= 35 ? "นาง" : "นางสาว";
};

/**
 * When a panel was taken — counted back from today rather than written as a
 * calendar date, so a record never opens showing a screening a year stale.
 *
 * `day` keeps the meaning it had as a spread, one to fourteen, and the panel
 * still lands between nineteen and thirty-two days ago: where the sample year
 * put it, and far enough back that "ครบกำหนดคัดกรอง" has something to count.
 */
const screened = (day: number) => daysFromToday(day - 33, 10, 0);

/** The four screenings every record carries, in the order the design shows. */
const panel = (
  day: number,
  o: Partial<Record<ScreeningKind, ScreeningStatus>> = {},
): Screening[] => [
  {
    kind: "diabetes",
    name: tr("เบาหวาน", "Diabetes"),
    status: o.diabetes ?? "normal",
    takenAt: screened(day),
  },
  {
    kind: "pressure",
    name: tr("ความดัน", "Hypertension"),
    status: o.pressure ?? "normal",
    takenAt: screened(day),
  },
  {
    kind: "stroke",
    name: "Stroke",
    status: o.stroke ?? "normal",
    takenAt: screened(day),
  },
  {
    kind: "obesity",
    name: tr("ภาวะลงพุง", "Abdominal obesity"),
    status: o.obesity ?? "normal",
    takenAt: screened(day),
  },
];

/**
 * The registry, generated rather than written out.
 *
 * Hand-listing every household made the file long and the data thin — the same
 * few names repeated and every village the same size. Generating it from name
 * pools and a deterministic index gives a realistic spread (villages of very
 * different sizes, households from one person to seven, a believable mix of
 * ages and screening results) in a fraction of the lines, and one edit here
 * changes the whole set.
 *
 * Deterministic on purpose: no randomness, so the same data appears on every
 * launch and a screenshot taken today matches one taken tomorrow.
 */

/*
  Five villages, because that is a caseload.

  There were twenty, which is a sub-district office's worth of registry
  rather than one carer's round: a community health worker holds five
  villages at the outside and ten households in each, and every figure the
  app adds up — the follow-up counts on a village card, the population on
  the map, the people a posting is drawn from — was ten times the size of
  the day it was meant to describe. Named for the places the group work
  calendar visits, so the school a child is weighed at is in the village
  their house is in.
*/
const VILLAGE_NAMES = [
  "บ้านบางมดใต้",
  "บ้านประชาอุทิศ",
  "บ้านทุ่งครุเหนือ",
  "บ้านวัดพุทธบูชา",
  "บ้านคลองบางปะกอก",
];

/** The หมู่ each carries, which is not its position in the list. */
const VILLAGE_MOO = [2, 4, 5, 7, 9];

const SURNAMES = [
  "วงศ์สุวรรณ",
  "ศรีสุข",
  "แก้วมณี",
  "ทองดี",
  "ใจดี",
  "พูนผล",
  "สายทอง",
  "มั่นคง",
  "ทวีสุข",
  "เรืองฤทธิ์",
  "ศรีสมบัติ",
  "พงษ์ไพบูลย์",
  "แจ่มใส",
  "ยิ่งเจริญ",
  "ทองอยู่",
  "แซ่ลิ้ม",
  "บุญมาก",
  "ก้องเกียรติ",
  "แสงเดือน",
  "ปานทอง",
  "อินทรแก้ว",
  "เกียรติยศ",
  "พรหมมา",
  "สุวรรณชาติ",
  "ชื่นบาน",
];

const MALE_NAMES = [
  "ประสิทธิ์",
  "สมชาย",
  "ธนกร",
  "วิชัย",
  "ณัฐพล",
  "อนุชา",
  "เอกชัย",
  "ธีรพงษ์",
  "ภูมิพัฒน์",
  "สุรชัย",
  "อำนวย",
  "บุญมี",
  "มานพ",
  "กิตติศักดิ์",
  "สมบูรณ์",
  "ชูเกียรติ",
  "ไพโรจน์",
  "ธนวัฒน์",
  "อนันต์",
  "ประเสริฐ",
];

const FEMALE_NAMES = [
  "มาลี",
  "ปิยะดา",
  "อารีย์",
  "สุนีย์",
  "กมลวรรณ",
  "สมหญิง",
  "จันทร์เพ็ญ",
  "ศิริพร",
  "บังอร",
  "พิมพ์ใจ",
  "ลำดวน",
  "นภาพร",
  "ปุณณภา",
  "ทองสุข",
  "วันเพ็ญ",
  "อรวรรณ",
  "ณิชา",
  "เพ็ญศรี",
  "รัตนา",
  "จำเนียร",
];

/** Children get their own pools — an elderly given name on a four-year-old
 *  reads as generated data rather than a household. */
const BOY_NAMES = [
  "ภูมิพัฒน์",
  "ธนกร",
  "ปุณณวิช",
  "กันตพงศ์",
  "ศุภกร",
  "ณัฐดนัย",
  "พีรวิชญ์",
  "ธีรภัทร",
  "อชิรวิทย์",
  "ปัณณธร",
];

const GIRL_NAMES = [
  "ปุณณภา",
  "ณิชา",
  "พิชญาภา",
  "กัญญาณัฐ",
  "ธัญชนก",
  "ปาลิตา",
  "ชญานิษฐ์",
  "อริสรา",
  "พิมพ์มาดา",
  "ณัฐธิดา",
];

const STREETS = [
  "ถ.ประชาอุทิศ",
  "ซ.ประชาอุทิศ 33",
  "ซ.ประชาอุทิศ 45",
  "ถ.พุทธบูชา",
  "ซ.สุขสวัสดิ์ 26",
  "ถ.ราษฎร์บูรณะ",
  "ซ.ประชาอุทิศ 79",
  "ซ.ประชาอุทิศ 90",
  "ถ.สุขุมวิท",
  "ซ.ประชาอุทิศ 21",
  "ถ.บางมด",
  "ซ.ประชาอุทิศ 59",
];

/** The district a village sits in. One expression, used by both. */
const districtOf = (vi: number) => pick(DISTRICTS, vi);

const DISTRICTS = [
  "แขวงบางมด เขตทุ่งครุ กรุงเทพฯ 10140",
  "แขวงทุ่งครุ เขตทุ่งครุ กรุงเทพฯ 10140",
  "แขวงบางปะกอก เขตราษฎร์บูรณะ กรุงเทพฯ 10140",
  "แขวงราษฎร์บูรณะ เขตราษฎร์บูรณะ กรุงเทพฯ 10140",
];

const BLOOD = ["A", "B", "AB", "O"];

/** A small integer hash, so every value below is stable across launches. */
const pick = <T>(list: T[], n: number): T => list[n % list.length];

function makeResident(vi: number, hi: number, ri: number): Resident {
  const n = vi * 37 + hi * 11 + ri * 5;
  const female = (n + ri) % 2 === 0;
  const surname = pick(SURNAMES, vi * 3 + hi);

  // A believable spread: a few children, most adults, a fair share elderly.
  const ageBand = n % 10;
  const age =
    ageBand < 2 ? 4 + (n % 14) : ageBand < 7 ? 24 + (n % 38) : 62 + (n % 26);

  const given =
    age < 18
      ? female
        ? pick(GIRL_NAMES, n)
        : pick(BOY_NAMES, n + 3)
      : female
        ? pick(FEMALE_NAMES, n)
        : pick(MALE_NAMES, n + 3);

  // Older residents carry more risk, which is what makes the follow-up counts
  // on the village cards vary in a way that looks like real caseload.
  // Roughly a fifth of the elderly need chasing — enough that the follow-up
  // counts on the village cards carry weight instead of reading as zero.
  const risky = age >= 55 && n % 3 !== 0;
  const veryRisky = age >= 65 && n % 5 !== 0;

  const heightCm = female ? 148 + (n % 14) : 160 + (n % 18);
  const weightKg = Math.round(
    (female ? 44 : 55) + (n % 34) * (risky ? 0.9 : 0.6),
  );

  return {
    id: `v${vi}h${hi}r${ri}`,
    name: `${honorific(age, female)}${given} ${surname}`,
    age,
    gender: female ? "หญิง" : "ชาย",
    bloodType: pick(BLOOD, n),
    phone: `08${String(10000000 + n * 7919).slice(0, 8)}`,
    weightKg,
    heightCm,
    needsAttention: veryRisky,
    screenings: panel(1 + (n % 14), {
      diabetes: risky ? "atRisk" : "normal",
      pressure: veryRisky ? "atRisk" : "normal",
      stroke: age < 18 ? "unknown" : veryRisky ? "atRisk" : "normal",
      obesity:
        weightKg / ((heightCm / 100) * (heightCm / 100)) >= 25
          ? "atRisk"
          : "normal",
    }),
  };
}

function makeHouse(vi: number, hi: number): House {
  /*
    The mix, chosen so it does not collapse.

    It was `vi * 17 + hi * 7`, and a household's size was that modulo
    seven — which for the first village is a multiple of seven every time,
    so every house in it held exactly one person. A village of eight
    one-person households is not a village, and the bug only showed once
    the registry was cut to five: at twenty, the empty one was somewhere
    in the middle of a list nobody counted.
  */
  const n = vi * 31 + hi * 13 + 5;
  // One to seven people — households are not uniform, and the summary counts
  // are only interesting when they differ.
  const size = 1 + (n % 7);
  return {
    id: `v${vi}h${hi}`,
    number: tr(`บ้านเลขที่ ${1 + hi + vi * 3}`, `House no. ${1 + hi + vi * 3}`),
    registrationNo: `${11 + vi}${String(10000000000 + n * 104729).slice(1, 12)}`,
    address: `${1 + (n % 220)}/${1 + (n % 9)} ${pick(STREETS, n)} ${districtOf(vi)}`,
    // Spread around Pracha Uthit, where the map opens.
    lat: 13.639 + ((vi * 13 + hi * 5) % 40) * 0.0008,
    lng: 100.487 + ((vi * 7 + hi * 11) % 40) * 0.0009,
    residents: Array.from({ length: size }, (_, ri) =>
      makeResident(vi, hi, ri),
    ),
  };
}

/**
 * The ten people the visit plan is built from, as residents of the registry.
 *
 * They used to be a list of names inside `task.ts` with no connection to
 * anybody here, which meant the app carried two populations: the patients a
 * carer visits, and the people who live in the villages. Nothing could cross
 * between them — a visit could not reach its patient's readings, their
 * screenings or their household, because its patient did not exist as a
 * person anywhere.
 *
 * So they are people here, and a visit names one by id. Everything the
 * registry can say about a resident is now sayable about a patient too.
 */
const VISIT_SEED: {
  name: string;
  age: number;
  female: boolean;
  /** What the visit is for. Read by `task`, which builds the schedule. */
  detail: string;
  lat: number;
  lng: number;
  address: string;
  /** Which village they belong to, by index. */
  village: number;
}[] = [
  {
    name: "นาง บุญเรือน แก้วประเสริฐ",
    age: 78,
    female: true,
    detail: tr("วัดสัญญาณชีพและประเมินอาการบวมที่ขาหลังปรับยาขับปัสสาวะ", "Take vital signs and assess leg swelling after the diuretic was adjusted"),
    lat: 13.6478,
    lng: 100.4952,
    address: "89/12 ซ.ประชาอุทิศ 33 แขวงบางมด เขตทุ่งครุ กรุงเทพฯ 10140",
    village: 0,
  },
  {
    name: "นาย สุชาติ วงศ์สุวรรณ",
    age: 63,
    female: false,
    detail: tr("เปลี่ยนสายสวนปัสสาวะและตรวจสอบภาวะติดเชื้อทางเดินปัสสาวะ", "Change the urinary catheter and check for urinary tract infection"),
    lat: 13.6521,
    lng: 100.4988,
    address: "145/7 ถ.ประชาอุทิศ แขวงบางมด เขตทุ่งครุ กรุงเทพฯ 10140",
    village: 1,
  },
  {
    name: "เด็กหญิง ณิชากร พูลทรัพย์",
    age: 6,
    female: true,
    detail: tr("ติดตามน้ำหนักและให้คำแนะนำการดูแลผิวหนังผู้ป่วยภูมิแพ้", "Follow up weight and advise on skin care for allergies"),
    lat: 13.6443,
    lng: 100.5021,
    address: "22/4 ซ.ประชาอุทิศ 45 แขวงบางมด เขตทุ่งครุ กรุงเทพฯ 10140",
    village: 2,
  },
  {
    name: "นาง ลำดวน ชื่นบาน",
    age: 84,
    female: true,
    detail: tr("ทำแผลเบาหวานที่เท้าและประเมินการไหลเวียนเลือดปลายเท้า", "Dress a diabetic foot wound and assess foot circulation"),
    lat: 13.656,
    lng: 100.4935,
    address: "301 ถ.พุทธบูชา แขวงบางมด เขตทุ่งครุ กรุงเทพฯ 10140",
    village: 3,
  },
  {
    name: "นาย วิรัตน์ ศรีนวล",
    age: 71,
    female: false,
    detail: tr("ฟื้นฟูการเคลื่อนไหวหลังโรคหลอดเลือดสมองและฝึกเดินด้วยไม้เท้า", "Post-stroke mobility rehabilitation and cane walking practice"),
    lat: 13.6495,
    lng: 100.5064,
    address: "78/3 ซ.ประชาอุทิศ 59 แขวงบางมด เขตทุ่งครุ กรุงเทพฯ 10140",
    village: 4,
  },
  {
    name: "นางสาว อรพรรณ ดีมาก",
    age: 39,
    female: true,
    detail: tr("ให้ยาปฏิชีวนะทางหลอดเลือดดำต่อเนื่องและเฝ้าระวังอาการแพ้ยา", "Continue IV antibiotics and monitor for drug reactions"),
    lat: 13.6412,
    lng: 100.4967,
    address: "56 ซ.ประชาอุทิศ 37 แขวงบางมด เขตทุ่งครุ กรุงเทพฯ 10140",
    village: 0,
  },
  {
    name: "นาย เกรียงไกร มั่นคง",
    age: 55,
    female: false,
    detail: tr("ตรวจการทำงานของเครื่องช่วยหายใจที่บ้านและเปลี่ยนวงจรเครื่อง", "Check the home ventilator and change its circuit"),
    lat: 13.6538,
    lng: 100.5042,
    address: "210/9 ถ.ประชาอุทิศ แขวงบางมด เขตทุ่งครุ กรุงเทพฯ 10140",
    village: 1,
  },
  {
    name: "เด็กชาย ภูมิพัฒน์ แสงทอง",
    age: 7,
    female: false,
    detail: tr("ติดตามอาการหอบหืดและสอนผู้ปกครองใช้ยาพ่นขยายหลอดลมอย่างถูกวิธี", "Follow up asthma and teach parents correct bronchodilator inhaler use"),
    lat: 13.6467,
    lng: 100.4901,
    address: "17/2 ซ.ประชาอุทิศ 21 แขวงบางมด เขตทุ่งครุ กรุงเทพฯ 10140",
    village: 2,
  },
  {
    name: "นาง จันทร์เพ็ญ บุญมี",
    age: 69,
    female: true,
    detail: tr("ทบทวนรายการยาทั้งหมดและตรวจสอบการใช้ยาซ้ำซ้อนกับแพทย์", "Review all medications and check for duplicates with the doctor"),
    lat: 13.6584,
    lng: 100.5007,
    address: "444 ถ.ราษฎร์บูรณะ แขวงบางปะกอก เขตราษฎร์บูรณะ กรุงเทพฯ 10140",
    village: 3,
  },
  {
    name: "นางสาว กมลชนก อินทร์แก้ว",
    age: 28,
    female: true,
    detail: tr("เยี่ยมมารดาหลังคลอดและประเมินภาวะซึมเศร้าหลังคลอด", "Postpartum visit and postpartum depression assessment"),
    lat: 13.6429,
    lng: 100.5098,
    address: "9/15 ซ.ประชาอุทิศ 61 แขวงบางมด เขตทุ่งครุ กรุงเทพฯ 10140",
    village: 4,
  },
];

/** One visit patient: the person, their house, and what the visit is for. */
export type VisitPatient = {
  resident: Resident;
  detail: string;
  lat: number;
  lng: number;
  address: string;
  village: number;
};

export const visitPatients: VisitPatient[] = VISIT_SEED.map((p, i) => {
  // The same arithmetic `makeResident` uses, so a hand-written person carries
  // the same kind of body and the same kind of screening panel as a generated
  // one — and `readingsFor`, which works off these, has something real to
  // draw from.
  const n = 97 + i * 31;
  const risky = p.age >= 55 && n % 3 !== 0;
  const veryRisky = p.age >= 65 && n % 5 !== 0;
  const heightCm =
    p.age < 18 ? 104 + p.age * 5 : p.female ? 148 + (n % 14) : 160 + (n % 18);
  const weightKg = Math.round(
    p.age < 18
      ? 16 + p.age * 2.6
      : (p.female ? 44 : 55) + (n % 34) * (risky ? 0.9 : 0.6),
  );
  return {
    ...p,
    resident: {
      id: `p${i}`,
      name: p.name,
      age: p.age,
      gender: p.female ? "หญิง" : "ชาย",
      bloodType: pick(BLOOD, n),
      phone: `08${String(10000000 + n * 7919).slice(0, 8)}`,
      weightKg,
      heightCm,
      needsAttention: veryRisky,
      screenings: panel(1 + (n % 14), {
        diabetes: risky ? "atRisk" : "normal",
        pressure: veryRisky ? "atRisk" : "normal",
        stroke: p.age < 18 ? "unknown" : veryRisky ? "atRisk" : "normal",
        obesity:
          weightKg / ((heightCm / 100) * (heightCm / 100)) >= 25
            ? "atRisk"
            : "normal",
      }),
    },
  };
});

export const sampleVillages: Village[] = VILLAGE_NAMES.map((name, vi) => ({
  id: `v${vi}`,
  name,
  mooLabel: tr(`หมู่${VILLAGE_MOO[vi] ?? vi + 1}`, `Moo ${VILLAGE_MOO[vi] ?? vi + 1}`),
  district: districtOf(vi),
  /*
    Six to eight generated households, and the visited ones on top.

    Ten is the ceiling a carer's round has, and the people on the visit
    plan live in these villages rather than in a cast of their own — so
    the generated count has to leave room for them. Villages still differ
    in weight, which is what makes the counts on the list worth reading.
  */
  houses: [
    ...Array.from({ length: 6 + (vi % 3) }, (_, hi) => makeHouse(vi, hi)),
    // The visit patients live here too, each in their own house, so the
    // village lists and the map show the people a carer actually visits
    // rather than a separate cast.
    ...visitPatients
      .filter((p) => p.village === vi)
      .map((p, i) => ({
        id: `${p.resident.id}h`,
        number: p.address.split(" ")[0] ?? tr(`บ้านเลขที่ ${i + 1}`, `House no. ${i + 1}`),
        registrationNo: `${11 + vi}${String(20000000000 + i * 104729).slice(1, 12)}`,
        address: p.address,
        lat: p.lat,
        lng: p.lng,
        residents: [p.resident],
      })),
  ],
}));

/** Everybody in the registry, flattened — the pool a posting draws from. */
export const everyResident: Resident[] = sampleVillages.flatMap((v) =>
  v.houses.flatMap((h) => h.residents),
);

/**
 * The house a person lives in, where the registry has them in one.
 *
 * A resident record carries no address of its own — the address, the pin
 * and the registration belong to the house — so a page about the person
 * asks here for where they live.
 */
export function houseOfResident(id: string): House | undefined {
  for (const v of sampleVillages) {
    const h = v.houses.find((x) => x.residents.some((r) => r.id === id));
    if (h != null) return h;
  }
  return undefined;
}

/** One person out of the registry, by id — visit patients included. */
export function residentById(id: string): Resident | undefined {
  const known = visitPatients.find((p) => p.resident.id === id);
  if (known != null) return known.resident;
  for (const v of sampleVillages) {
    for (const h of v.houses) {
      const r = h.residents.find((x) => x.id === id);
      if (r != null) return r;
    }
  }
  return undefined;
}
