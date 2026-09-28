/**
 * The facilities a user can work under.
 *
 * A carer's Provider ID can be attached to more than one — a health centre
 * and the district hospital that runs it — and which one a visit is filed
 * under is chosen at sign-in. The four marked `mine` are the ones this
 * sample account is on the staff of, and the only ones it is offered; the
 * rest stand in for the facilities it is not. Codes are five-digit สถานพยาบาล codes in shape only; the
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
  { code: "11500", name: "โรงพยาบาลแอตลาส โฮมแคร์", district: "เขตทุ่งครุ กรุงเทพฯ", mine: true },
  { code: "11501", name: "โรงพยาบาลบีเอ็มเอส", district: "เขตทุ่งครุ กรุงเทพฯ", mine: true },
  { code: "11502", name: "โรงพยาบาลเฮลโฟล์", district: "เขตราษฎร์บูรณะ กรุงเทพฯ", mine: true },
  { code: "11503", name: "โรงพยาบาลอีเอชพี", district: "เขตบางขุนเทียน กรุงเทพฯ", mine: true },
  { code: "10756", name: "โรงพยาบาลราษฎร์บูรณะ", district: "เขตราษฎร์บูรณะ กรุงเทพฯ" },
  { code: "11614", name: "โรงพยาบาลบางปะกอก 1", district: "เขตราษฎร์บูรณะ กรุงเทพฯ" },
  { code: "11466", name: "ศูนย์บริการสาธารณสุข 42 ถนอม ทองสิมา", district: "เขตบางขุนเทียน กรุงเทพฯ" },
  { code: "13781", name: "โรงพยาบาลสมเด็จพระปิ่นเกล้า", district: "เขตธนบุรี กรุงเทพฯ" },
  { code: "10660", name: "โรงพยาบาลตากสิน", district: "เขตคลองสาน กรุงเทพฯ" },
  { code: "10665", name: "โรงพยาบาลเจริญกรุงประชารักษ์", district: "เขตบางคอแหลม กรุงเทพฯ" },
  { code: "11448", name: "ศูนย์บริการสาธารณสุข 24 บางเขน", district: "เขตบางเขน กรุงเทพฯ" },
  { code: "11445", name: "ศูนย์บริการสาธารณสุข 3 บางซื่อ", district: "เขตบางซื่อ กรุงเทพฯ" },
];

/**
 * The account's own facilities, matched on any part of name, code or
 * district.
 *
 * Only those the carer is on the staff of: a visit is filed under the place
 * that employs the one making it, so a facility they do not belong to is
 * not a choice they have — listing the neighbours offered a filing the
 * record could never be allowed to carry.
 */
export function searchFacilities(query: string): Facility[] {
  const own = FACILITIES.filter((f) => f.mine);
  const q = query.trim().toLowerCase();
  if (q === "") return own;
  return own.filter(
    (f) =>
      f.name.toLowerCase().includes(q) ||
      f.code.startsWith(q) ||
      f.district.toLowerCase().includes(q),
  );
}
