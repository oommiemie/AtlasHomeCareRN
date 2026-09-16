/**
 * The facilities a user can work under.
 *
 * A carer's Provider ID can be attached to more than one — a health centre
 * and the district hospital that runs it — and which one a visit is filed
 * under is chosen at sign-in. The two marked `mine` are the ones this
 * sample account is attached to; the rest are the neighbours a search
 * should find. Codes are five-digit สถานพยาบาล codes in shape only; the
 * list is stood in for, like the rest of the sample data.
 */
export type Facility = {
  /** รหัสสถานพยาบาล, five digits. */
  code: string;
  name: string;
  /** "เขตทุ่งครุ กรุงเทพฯ" — where it is, in a line. */
  district: string;
  /** Attached to this account. */
  mine?: boolean;
};

export const FACILITIES: Facility[] = [
  { code: "11477", name: "ศูนย์บริการสาธารณสุข 58 ล้อม-พิมเสน ฟักอุดม", district: "เขตทุ่งครุ กรุงเทพฯ", mine: true },
  { code: "11463", name: "ศูนย์บริการสาธารณสุข 39 ราษฎร์บูรณะ", district: "เขตราษฎร์บูรณะ กรุงเทพฯ", mine: true },
  { code: "10756", name: "โรงพยาบาลราษฎร์บูรณะ", district: "เขตราษฎร์บูรณะ กรุงเทพฯ" },
  { code: "11614", name: "โรงพยาบาลบางปะกอก 1", district: "เขตราษฎร์บูรณะ กรุงเทพฯ" },
  { code: "11466", name: "ศูนย์บริการสาธารณสุข 42 ถนอม ทองสิมา", district: "เขตบางขุนเทียน กรุงเทพฯ" },
  { code: "13781", name: "โรงพยาบาลสมเด็จพระปิ่นเกล้า", district: "เขตธนบุรี กรุงเทพฯ" },
  { code: "10660", name: "โรงพยาบาลตากสิน", district: "เขตคลองสาน กรุงเทพฯ" },
  { code: "10665", name: "โรงพยาบาลเจริญกรุงประชารักษ์", district: "เขตบางคอแหลม กรุงเทพฯ" },
  { code: "11448", name: "ศูนย์บริการสาธารณสุข 24 บางเขน", district: "เขตบางเขน กรุงเทพฯ" },
  { code: "11445", name: "ศูนย์บริการสาธารณสุข 3 บางซื่อ", district: "เขตบางซื่อ กรุงเทพฯ" },
];

/** Name, code or district matched on any part. */
export function searchFacilities(query: string): Facility[] {
  const q = query.trim().toLowerCase();
  if (q === "") return FACILITIES;
  return FACILITIES.filter(
    (f) =>
      f.name.toLowerCase().includes(q) ||
      f.code.startsWith(q) ||
      f.district.toLowerCase().includes(q),
  );
}
