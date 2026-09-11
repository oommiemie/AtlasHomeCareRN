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
  normal: "ปกติ",
  atRisk: "เสี่ยง",
  unknown: "ยังไม่ประเมิน",
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
  /** "ชาย" / "หญิง". */
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
  if (b === 0) return "ยังไม่ได้ชั่งน้ำหนัก";
  if (b < 18.5) return "น้ำหนักน้อยกว่าเกณฑ์";
  if (b < 23) return "อยู่ในเกณฑ์ปกติ";
  if (b < 25) return "น้ำหนักเกิน";
  if (b < 30) return "โรคอ้วนระดับ 1";
  return "โรคอ้วนระดับ 2";
}

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
  return [
    i.number,
    i.addressDetail,
    i.subdistrict && `ต.${i.subdistrict}`,
    i.district && `อ.${i.district}`,
    i.province && `จ.${i.province}`,
    i.postalCode,
  ]
    .filter((part) => part && String(part).trim().length > 0)
    .join(" ");
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
    bloodType: i.bloodType != null && i.bloodType.length > 0 ? i.bloodType : "ไม่ระบุ",
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
export function searchResidents(residents: Resident[], query: string): Resident[] {
  const q = query.trim().toLowerCase();
  if (!q) return residents;
  return residents.filter(
    (r) =>
      r.name.toLowerCase().includes(q) ||
      r.phone.includes(q) ||
      r.gender.includes(q),
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
  { kind: "diabetes", name: "เบาหวาน", status: o.diabetes ?? "normal", takenAt: screened(day) },
  { kind: "pressure", name: "ความดัน", status: o.pressure ?? "normal", takenAt: screened(day) },
  { kind: "stroke", name: "Stroke", status: o.stroke ?? "normal", takenAt: screened(day) },
  { kind: "obesity", name: "ภาวะลงพุง", status: o.obesity ?? "normal", takenAt: screened(day) },
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

const VILLAGE_NAMES = [
  "บ้านร่ำรวย", "บ้านสวนหลวง", "บ้านทุ่งสงบ", "บ้านคลองใหม่", "บ้านหนองบัว",
  "บ้านราษฎร์พัฒนา", "บ้านสามัคคี", "บ้านสวนส้ม", "บ้านโพธิ์ทอง", "บ้านแหลมทอง",
  "บ้านดอนแก้ว", "บ้านท่าเรือ", "บ้านศรีเจริญ", "บ้านบางมดใต้", "บ้านคลองบางปะกอก",
  "บ้านสุขสวัสดิ์", "บ้านประชาอุทิศ", "บ้านทุ่งครุเหนือ", "บ้านวัดพุทธบูชา", "บ้านเกาะกลาง",
];

const SURNAMES = [
  "วงศ์สุวรรณ", "ศรีสุข", "แก้วมณี", "ทองดี", "ใจดี", "พูนผล", "สายทอง",
  "มั่นคง", "ทวีสุข", "เรืองฤทธิ์", "ศรีสมบัติ", "พงษ์ไพบูลย์", "แจ่มใส",
  "ยิ่งเจริญ", "ทองอยู่", "แซ่ลิ้ม", "บุญมาก", "ก้องเกียรติ", "แสงเดือน",
  "ปานทอง", "อินทรแก้ว", "เกียรติยศ", "พรหมมา", "สุวรรณชาติ", "ชื่นบาน",
];

const MALE_NAMES = [
  "ประสิทธิ์", "สมชาย", "ธนกร", "วิชัย", "ณัฐพล", "อนุชา", "เอกชัย",
  "ธีรพงษ์", "ภูมิพัฒน์", "สุรชัย", "อำนวย", "บุญมี", "มานพ", "กิตติศักดิ์",
  "สมบูรณ์", "ชูเกียรติ", "ไพโรจน์", "ธนวัฒน์", "อนันต์", "ประเสริฐ",
];

const FEMALE_NAMES = [
  "มาลี", "ปิยะดา", "อารีย์", "สุนีย์", "กมลวรรณ", "สมหญิง", "จันทร์เพ็ญ",
  "ศิริพร", "บังอร", "พิมพ์ใจ", "ลำดวน", "นภาพร", "ปุณณภา", "ทองสุข",
  "วันเพ็ญ", "อรวรรณ", "ณิชา", "เพ็ญศรี", "รัตนา", "จำเนียร",
];

/** Children get their own pools — an elderly given name on a four-year-old
 *  reads as generated data rather than a household. */
const BOY_NAMES = [
  "ภูมิพัฒน์", "ธนกร", "ปุณณวิช", "กันตพงศ์", "ศุภกร", "ณัฐดนัย",
  "พีรวิชญ์", "ธีรภัทร", "อชิรวิทย์", "ปัณณธร",
];

const GIRL_NAMES = [
  "ปุณณภา", "ณิชา", "พิชญาภา", "กัญญาณัฐ", "ธัญชนก", "ปาลิตา",
  "ชญานิษฐ์", "อริสรา", "พิมพ์มาดา", "ณัฐธิดา",
];

const STREETS = [
  "ถ.ประชาอุทิศ", "ซ.ประชาอุทิศ 33", "ซ.ประชาอุทิศ 45", "ถ.พุทธบูชา",
  "ซ.สุขสวัสดิ์ 26", "ถ.ราษฎร์บูรณะ", "ซ.ประชาอุทิศ 79", "ซ.ประชาอุทิศ 90",
  "ถ.สุขุมวิท", "ซ.ประชาอุทิศ 21", "ถ.บางมด", "ซ.ประชาอุทิศ 59",
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
const pick = <T,>(list: T[], n: number): T => list[n % list.length];

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
      obesity: weightKg / ((heightCm / 100) * (heightCm / 100)) >= 25
        ? "atRisk"
        : "normal",
    }),
  };
}

function makeHouse(vi: number, hi: number): House {
  const n = vi * 17 + hi * 7;
  // One to seven people — households are not uniform, and the summary counts
  // are only interesting when they differ.
  const size = 1 + (n % 7);
  return {
    id: `v${vi}h${hi}`,
    number: `บ้านเลขที่ ${1 + hi + vi * 3}`,
    registrationNo: `${11 + vi}${String(10000000000 + n * 104729).slice(1, 12)}`,
    address:
      `${1 + (n % 220)}/${1 + (n % 9)} ${pick(STREETS, n)} ${districtOf(vi)}`,
    // Spread around Pracha Uthit, where the map opens.
    lat: 13.639 + ((vi * 13 + hi * 5) % 40) * 0.0008,
    lng: 100.487 + ((vi * 7 + hi * 11) % 40) * 0.0009,
    residents: Array.from({ length: size }, (_, ri) => makeResident(vi, hi, ri)),
  };
}

export const sampleVillages: Village[] = VILLAGE_NAMES.map((name, vi) => ({
  id: `v${vi}`,
  name,
  mooLabel: `หมู่${vi + 1}`,
  district: districtOf(vi),
  // Two to six houses, so the village list has visibly different weights.
  houses: Array.from({ length: 2 + (vi % 5) }, (_, hi) => makeHouse(vi, hi)),
}));
