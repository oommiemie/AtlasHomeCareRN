import { tr } from "../i18n";

/**
 * The people a visit is staffed by, and what an assistant is there to do.
 *
 * A stand-in for the hospital's own directory: the ward's doctors, the
 * nurses who run the round, the therapists and the aides. A real build
 * reads this from the provider register the login belongs to.
 */
export type Staff = { id: string; name: string; role: string };

export const STAFF: Staff[] = [
  { id: "d1", name: "พญ.ศิริพร วงศ์สุวรรณ", role: tr("แพทย์เวชศาสตร์ครอบครัว", "Family physician") },
  { id: "d2", name: "นพ.ธนกร พิพัฒน์กุล", role: tr("อายุรแพทย์", "Internist") },
  { id: "d3", name: "นพ.วีรพล อินทรักษ์", role: tr("แพทย์เวชปฏิบัติทั่วไป", "General practitioner") },
  { id: "n1", name: "สุขภาพดี จิตแจ่มใส", role: tr("พยาบาลวิชาชีพ", "Registered nurse") },
  { id: "n2", name: "น.ส.กัลยา ศิวะกุลรังสรรค์", role: tr("พยาบาลวิชาชีพ", "Registered nurse") },
  { id: "n3", name: "น.ส.นันทิกานต์ ใจงาม", role: tr("พยาบาลวิชาชีพ", "Registered nurse") },
  { id: "n4", name: "นางมาลี ทองดี", role: tr("พยาบาลเวชปฏิบัติ", "Nurse practitioner") },
  { id: "p1", name: "นายสมชาย แข็งแรง", role: tr("นักกายภาพบำบัด", "Physiotherapist") },
  { id: "a1", name: "นางสาวพิมพ์ใจ ดีงาม", role: tr("ผู้ช่วยพยาบาล", "Nurse assistant") },
  { id: "a2", name: "นายกิตติ ช่วยเหลือ", role: tr("ผู้ช่วยเหลือคนไข้", "Patient aide") },
  { id: "v1", name: "นางบุญมา อาสา", role: tr("อสม.", "VHV") },
];

/**
 * The part an assistant plays, as the hospital's own list names them.
 *
 * Kept in that list's own words and order — half of it is English, which
 * is how a theatre roster is written and how the claim reads back.
 */
export const ASSIST_ROLES = [
  tr("ผู้ทำการผ่าตัด", "Surgeon"),
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
  tr("ผู้ช่วยพยาบาล", "Nurse assistant"),
  tr("ผู้ช่วยเหลือคนไข้", "Patient aide"),
  tr("นักกายภาพบำบัด", "Physiotherapist"),
  tr("อสม.", "VHV"),
  tr("ญาติผู้ป่วย", "Patient's relative"),
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
