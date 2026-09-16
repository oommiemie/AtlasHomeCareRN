/**
 * The procedures a community round performs.
 *
 * Two lists, because the record wants two things. The hospital's own
 * procedure list carries the name a nurse recognises and the fee it is
 * billed at; ICD-9-CM carries the code the claim is coded to. Most of the
 * time one implies the other, so picking a procedure fills the code in —
 * but the code stays a field of its own, because the coder may disagree.
 *
 * Both are stands-in for the hospital's masters. Prices are illustrative.
 */
export type ProcedureItem = {
  /** The hospital's own item code. */
  code: string;
  name: string;
  /** What it is usually coded to. */
  icd9: string;
  price: number;
};

export const PROCEDURES: ProcedureItem[] = [
  { code: "P001", name: "ทำแผล / เปลี่ยนผ้าปิดแผล", icd9: "93.57", price: 50 },
  { code: "P002", name: "ล้างแผลและตัดเนื้อตาย (แผลกดทับ)", icd9: "86.28", price: 150 },
  { code: "P003", name: "ฉีดยาเข้ากล้าม / ใต้ผิวหนัง", icd9: "99.29", price: 30 },
  { code: "P004", name: "ให้สารน้ำทางหลอดเลือดดำ", icd9: "99.18", price: 120 },
  { code: "P005", name: "เจาะเลือดส่งตรวจ", icd9: "38.99", price: 40 },
  { code: "P006", name: "ใส่สายสวนปัสสาวะ", icd9: "57.94", price: 150 },
  { code: "P007", name: "ถอดสายสวนปัสสาวะ", icd9: "97.64", price: 50 },
  { code: "P008", name: "ใส่สายให้อาหารทางจมูก (NG tube)", icd9: "96.07", price: 150 },
  { code: "P009", name: "ให้อาหารทางสายยาง", icd9: "96.35", price: 50 },
  { code: "P010", name: "ดูดเสมหะ", icd9: "96.56", price: 80 },
  { code: "P011", name: "พ่นยาขยายหลอดลม", icd9: "93.94", price: 80 },
  { code: "P012", name: "ให้ออกซิเจน", icd9: "93.96", price: 100 },
  { code: "P013", name: "กายภาพบำบัดที่บ้าน", icd9: "93.39", price: 200 },
  { code: "P014", name: "ตัดไหม", icd9: "86.05", price: 50 },
  { code: "P015", name: "วัดสัญญาณชีพและประเมินผู้ป่วย", icd9: "89.7", price: 0 },
];

/** One ICD-9-CM procedure code. */
export type Icd9 = { code: string; th: string; en: string };

export const ICD9: Icd9[] = [
  { code: "86.05", th: "ตัดไหม / เปิดแผลเอาสิ่งแปลกปลอมออก", en: "Incision with removal of foreign body from skin" },
  { code: "86.28", th: "ตัดเนื้อตายที่แผลโดยไม่ใช้มีด", en: "Nonexcisional debridement of wound" },
  { code: "86.59", th: "เย็บปิดผิวหนัง", en: "Closure of skin and subcutaneous tissue" },
  { code: "38.99", th: "เจาะหลอดเลือดดำ", en: "Other puncture of vein" },
  { code: "57.94", th: "ใส่สายสวนปัสสาวะคาไว้", en: "Insertion of indwelling urinary catheter" },
  { code: "97.64", th: "ถอดสายระบายปัสสาวะ", en: "Removal of other urinary drainage device" },
  { code: "93.39", th: "กายภาพบำบัดอื่น", en: "Other physical therapy" },
  { code: "93.57", th: "ปิดแผลด้วยวัสดุปิดแผล", en: "Application of other wound dressing" },
  { code: "93.94", th: "พ่นยาทางเดินหายใจ", en: "Respiratory medication by nebulizer" },
  { code: "93.96", th: "ให้ออกซิเจน", en: "Other oxygen enrichment" },
  { code: "96.07", th: "ใส่สายให้อาหารทางจมูก", en: "Insertion of other (naso-)gastric tube" },
  { code: "96.35", th: "ให้อาหารทางสายยาง", en: "Gastric gavage" },
  { code: "96.56", th: "ดูดเสมหะทางเดินหายใจ", en: "Other lavage of bronchus and trachea" },
  { code: "99.18", th: "ให้สารน้ำและเกลือแร่ทางหลอดเลือด", en: "Injection or infusion of electrolytes" },
  { code: "99.29", th: "ฉีดยาหรือสารรักษาอื่น", en: "Injection of other therapeutic substance" },
  { code: "89.03", th: "ซักประวัติและตรวจประเมินอย่างละเอียด", en: "Interview and evaluation, comprehensive" },
  { code: "89.7", th: "ตรวจร่างกายทั่วไป", en: "General physical examination" },
];

/** One person helping, and what they are doing. */
export type Assistant = { name: string; role: string };

/** One procedure done on the visit. */
export type ProcedureLine = {
  id: string;
  /** The hospital item's code. */
  code: string;
  name: string;
  price: number;
  /** As coded for the claim. */
  icd9: string;
  /** When it began and ended, ISO. */
  start: string;
  end: string;
  /** Who did it, and who ordered it. */
  by: string;
  orderedBy: string;
  assistants: Assistant[];
  note: string;
};

export function searchProcedures(q: string): ProcedureItem[] {
  const k = q.trim().toLowerCase();
  if (k === "") return PROCEDURES;
  return PROCEDURES.filter(
    (p) => p.code.toLowerCase().includes(k) || p.name.toLowerCase().includes(k) || p.icd9.startsWith(k),
  );
}

export function searchIcd9(q: string): Icd9[] {
  const k = q.trim().toLowerCase();
  if (k === "") return ICD9;
  return ICD9.filter((i) => i.code.startsWith(k) || i.th.toLowerCase().includes(k) || i.en.toLowerCase().includes(k));
}

export function icd9Of(code: string): Icd9 | undefined {
  return ICD9.find((i) => i.code === code);
}

/**
 * How long it took, in the units a note is written in.
 *
 * Minutes are what a dressing takes and days are what a course of
 * something takes, so the same field has to say both; anything under a
 * minute reads as "น้อยกว่า 1 นาที" rather than as zero, which would look
 * like the times had not been filled in.
 */
export function durationOf(startIso: string, endIso: string): string {
  const from = new Date(startIso).getTime();
  const to = new Date(endIso).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return "";
  const ms = to - from;
  if (ms < 0) return "เวลาเสร็จก่อนเวลาเริ่ม";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "น้อยกว่า 1 นาที";
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const minutes = mins % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} วัน`);
  if (hours > 0) parts.push(`${hours} ชั่วโมง`);
  if (minutes > 0) parts.push(`${minutes} นาที`);
  return parts.join(" ");
}
