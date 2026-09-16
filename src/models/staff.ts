/**
 * The people a visit is staffed by, and what an assistant is there to do.
 *
 * A stand-in for the hospital's own directory: the ward's doctors, the
 * nurses who run the round, the therapists and the aides. A real build
 * reads this from the provider register the login belongs to.
 */
export type Staff = { id: string; name: string; role: string };

export const STAFF: Staff[] = [
  { id: "d1", name: "พญ.ศิริพร วงศ์สุวรรณ", role: "แพทย์เวชศาสตร์ครอบครัว" },
  { id: "d2", name: "นพ.ธนกร พิพัฒน์กุล", role: "อายุรแพทย์" },
  { id: "d3", name: "นพ.วีรพล อินทรักษ์", role: "แพทย์เวชปฏิบัติทั่วไป" },
  { id: "n1", name: "สุขภาพดี จิตแจ่มใส", role: "พยาบาลวิชาชีพ" },
  { id: "n2", name: "น.ส.กัลยา ศิวะกุลรังสรรค์", role: "พยาบาลวิชาชีพ" },
  { id: "n3", name: "น.ส.นันทิกานต์ ใจงาม", role: "พยาบาลวิชาชีพ" },
  { id: "n4", name: "นางมาลี ทองดี", role: "พยาบาลเวชปฏิบัติ" },
  { id: "p1", name: "นายสมชาย แข็งแรง", role: "นักกายภาพบำบัด" },
  { id: "a1", name: "นางสาวพิมพ์ใจ ดีงาม", role: "ผู้ช่วยพยาบาล" },
  { id: "a2", name: "นายกิตติ ช่วยเหลือ", role: "ผู้ช่วยเหลือคนไข้" },
  { id: "v1", name: "นางบุญมา อาสา", role: "อสม." },
];

/**
 * The part an assistant plays, as the hospital's own list names them.
 *
 * Kept in that list's own words and order — half of it is English, which
 * is how a theatre roster is written and how the claim reads back.
 */
export const ASSIST_ROLES = [
  "ผู้ทำการผ่าตัด",
  "Instrument Nurse",
  "Circultate Nurse",
  "Swab Count Nurse",
  "Scrub Nurse",
  "Assistant Doctor",
  "Assistant Nurse",
  "Anesthesist1",
  "Anesthesist2",
  "Anesthesist3",
  "Anesthesiologist",
  "ผู้ช่วยพยาบาล",
  "ผู้ช่วยเหลือคนไข้",
  "นักกายภาพบำบัด",
  "อสม.",
  "ญาติผู้ป่วย",
];

export function searchStaff(q: string): Staff[] {
  const k = q.trim().toLowerCase();
  if (k === "") return STAFF;
  return STAFF.filter((s) => s.name.toLowerCase().includes(k) || s.role.toLowerCase().includes(k));
}

/** The directory entry for a name, where there is one. */
export function staffNamed(name: string): Staff | undefined {
  return STAFF.find((s) => s.name === name);
}
