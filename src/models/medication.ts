import { useSyncExternalStore } from "react";

import { saveTask, type TaskRecord } from "./community";

/**
 * The order: medicines, and the supplies and services that go with them.
 *
 * The hospital's own screen is three pages of dropdowns — drug, price,
 * helper label, mode, route, dose, unit, frequency, time, days, quantity,
 * package, total, prescriber, language. What a nurse decides at the
 * bedside is smaller: which item, how much, how often, when, for how many
 * days. The rest follows from those or from the item itself, and is
 * worked out here rather than asked.
 *
 * The formulary is a stand-in: the items a community round actually
 * writes, in the hospital's own naming. Prices are illustrative.
 */

export type DrugForm = "TAB" | "CAP" | "INJ" | "MDI" | "SYR" | "DROP" | "CREAM";

export type Drug = {
  code: string;
  /** As the hospital prints it: "(BRAND) GENERIC STRENGTH FORM". */
  name: string;
  /** What it is, in a carer's words. */
  th: string;
  form: DrugForm;
  /** The package the count is in — เม็ด, AMP, ขวด, หลอด. */
  pack: string;
  /** Baht per pack. */
  price: number;
};

export const DRUGS: Drug[] = [
  { code: "MET500", name: "(GLUCOPHAGE) METFORMIN 500 MG TAB", th: "ยาเบาหวาน เมทฟอร์มิน", form: "TAB", pack: "เม็ด", price: 1 },
  { code: "GLP5", name: "(MINIDIAB) GLIPIZIDE 5 MG TAB", th: "ยาเบาหวาน ไกลพิไซด์", form: "TAB", pack: "เม็ด", price: 1 },
  { code: "INSN", name: "(INSULATARD) INSULIN NPH 100 IU/ML 10 ML VIAL", th: "อินซูลินชนิดออกฤทธิ์ปานกลาง", form: "INJ", pack: "ขวด", price: 180 },
  { code: "AML5", name: "(NORVASC) AMLODIPINE 5 MG TAB", th: "ยาลดความดัน แอมโลดิพีน", form: "TAB", pack: "เม็ด", price: 1.5 },
  { code: "ENA5", name: "(ENARIL) ENALAPRIL 5 MG TAB", th: "ยาลดความดัน อีนาลาพริล", form: "TAB", pack: "เม็ด", price: 1 },
  { code: "LOS50", name: "(COZAAR) LOSARTAN 50 MG TAB", th: "ยาลดความดัน โลซาร์แทน", form: "TAB", pack: "เม็ด", price: 3 },
  { code: "HCTZ25", name: "(DICHLOTRIDE) HYDROCHLOROTHIAZIDE 25 MG TAB", th: "ยาขับปัสสาวะ", form: "TAB", pack: "เม็ด", price: 0.5 },
  { code: "SIM20", name: "(ZOCOR) SIMVASTATIN 20 MG TAB", th: "ยาลดไขมัน ซิมวาสแตติน", form: "TAB", pack: "เม็ด", price: 2 },
  { code: "ATV20", name: "(LIPITOR) ATORVASTATIN 20 MG TAB", th: "ยาลดไขมัน อะทอร์วาสแตติน", form: "TAB", pack: "เม็ด", price: 4 },
  { code: "ASA81", name: "(ASPENT) ASPIRIN 81 MG TAB", th: "แอสไพรินขนาดต่ำ", form: "TAB", pack: "เม็ด", price: 0.5 },
  { code: "OME20", name: "(MIRACID) OMEPRAZOLE 20 MG CAP", th: "ยาลดกรด โอเมพราโซล", form: "CAP", pack: "แคปซูล", price: 2 },
  { code: "PARA500", name: "(TYLENOL) PARACETAMOL 500 MG TAB", th: "ยาแก้ปวดลดไข้ พาราเซตามอล", form: "TAB", pack: "เม็ด", price: 0.5 },
  { code: "IBU400", name: "(BRUFEN) IBUPROFEN 400 MG TAB", th: "ยาแก้ปวดอักเสบ ไอบูโพรเฟน", form: "TAB", pack: "เม็ด", price: 1 },
  { code: "AMX500", name: "(AMOKSIKLAV) AMOXICILLIN 500 MG CAP", th: "ยาปฏิชีวนะ อะม็อกซีซิลลิน (กลุ่มเพนิซิลลิน)", form: "CAP", pack: "แคปซูล", price: 2 },
  { code: "CTM4", name: "(CHLORPHENIRAMINE) CPM 4 MG TAB", th: "ยาแก้แพ้ คลอร์เฟนิรามีน", form: "TAB", pack: "เม็ด", price: 0.25 },
  { code: "CET10", name: "(ZYRTEC) CETIRIZINE 10 MG TAB", th: "ยาแก้แพ้ เซทิริซีน", form: "TAB", pack: "เม็ด", price: 1 },
  { code: "SAL100", name: "(VENTOLIN MDI) SALBUTAMOL 100 MCG/DOSE 200 DOSE INHALER", th: "ยาพ่นขยายหลอดลม", form: "MDI", pack: "หลอด", price: 120 },
  { code: "BUD200", name: "(PULMICORT) BUDESONIDE 200 MCG/DOSE 200 DOSE INHALER", th: "ยาพ่นสเตียรอยด์ควบคุมหืด", form: "MDI", pack: "หลอด", price: 350 },
  { code: "DOM10", name: "(MOTILIUM) DOMPERIDONE 10 MG TAB", th: "ยาแก้คลื่นไส้", form: "TAB", pack: "เม็ด", price: 1 },
  { code: "SEN", name: "(SENOKOT) SENNA 7.5 MG TAB", th: "ยาระบาย มะขามแขก", form: "TAB", pack: "เม็ด", price: 0.5 },
  { code: "LAC", name: "(DUPHALAC) LACTULOSE SYRUP 100 ML", th: "ยาระบาย แลคทูโลส", form: "SYR", pack: "ขวด", price: 60 },
  { code: "ORS", name: "(ORS) ORAL REHYDRATION SALT SACHET", th: "ผงเกลือแร่", form: "SYR", pack: "ซอง", price: 5 },
  { code: "FEF", name: "(FERROUS FUMARATE) 200 MG TAB", th: "ธาตุเหล็ก", form: "TAB", pack: "เม็ด", price: 0.5 },
  { code: "FOL5", name: "(FOLIC ACID) 5 MG TAB", th: "โฟลิก", form: "TAB", pack: "เม็ด", price: 0.25 },
  { code: "VITB", name: "(VITAMIN B COMPLEX) TAB", th: "วิตามินบีรวม", form: "TAB", pack: "เม็ด", price: 0.5 },
  { code: "CAL", name: "(CALTAB) CALCIUM CARBONATE 1500 MG TAB", th: "แคลเซียม", form: "TAB", pack: "เม็ด", price: 1.5 },
  { code: "CLOT", name: "(CANESTEN) CLOTRIMAZOLE 1% CREAM 5 G", th: "ครีมฆ่าเชื้อรา", form: "CREAM", pack: "หลอด", price: 25 },
  { code: "BET", name: "(BETNOVATE) BETAMETHASONE 0.1% CREAM 5 G", th: "ครีมสเตียรอยด์", form: "CREAM", pack: "หลอด", price: 30 },
  { code: "TEARS", name: "(NATEAR) ARTIFICIAL TEARS EYE DROP 10 ML", th: "น้ำตาเทียม", form: "DROP", pack: "ขวด", price: 45 },
  { code: "VITC", name: "(ASCOBIC ACID) VITAMIN C 500 MG/2 ML INJ 500 MG/2 ML AMP", th: "วิตามินซี ฉีด", form: "INJ", pack: "AMP", price: 4.5 },
];

export type Service = {
  code: string;
  name: string;
  category: string;
  price: number;
  /** ครั้ง, ชิ้น, ชุด, ผืน … */
  unit: string;
};

export const SERVICES: Service[] = [
  { code: "OPD", name: "บริการผู้ป่วยนอก ในเวลาราชการ", category: "ค่าบริการทางพยาบาล", price: 50, unit: "ครั้ง" },
  { code: "HHC", name: "ค่าบริการเยี่ยมบ้าน", category: "ค่าบริการทางพยาบาล", price: 100, unit: "ครั้ง" },
  { code: "WOUND", name: "ทำแผล", category: "หัตถการ", price: 50, unit: "ครั้ง" },
  { code: "INJ", name: "ฉีดยา", category: "หัตถการ", price: 30, unit: "ครั้ง" },
  { code: "BLOOD", name: "เจาะเลือดส่งตรวจ", category: "หัตถการ", price: 40, unit: "ครั้ง" },
  { code: "CATH", name: "ใส่สายสวนปัสสาวะ", category: "หัตถการ", price: 150, unit: "ครั้ง" },
  { code: "FOLEY", name: "สายสวนปัสสาวะ Foley เบอร์ 16", category: "เวชภัณฑ์", price: 45, unit: "ชิ้น" },
  { code: "UBAG", name: "ถุงปัสสาวะ", category: "เวชภัณฑ์", price: 25, unit: "ชิ้น" },
  { code: "GAUZE", name: "ผ้าก๊อซปลอดเชื้อ 3x3 นิ้ว", category: "เวชภัณฑ์", price: 5, unit: "ซอง" },
  { code: "NSS", name: "น้ำเกลือล้างแผล NSS 1000 ML", category: "เวชภัณฑ์", price: 35, unit: "ขวด" },
  { code: "GLOVE", name: "ถุงมือตรวจโรค (กล่อง 100 ชิ้น)", category: "เวชภัณฑ์", price: 120, unit: "กล่อง" },
  { code: "DIAPER", name: "ผ้าอ้อมผู้ใหญ่ (แพ็ก 10 ชิ้น)", category: "เวชภัณฑ์", price: 180, unit: "แพ็ก" },
  { code: "PAD", name: "แผ่นรองซับ (แพ็ก 10 ชิ้น)", category: "เวชภัณฑ์", price: 90, unit: "แพ็ก" },
  { code: "STRIP", name: "แถบตรวจน้ำตาลปลายนิ้ว (กล่อง 25 ชิ้น)", category: "เวชภัณฑ์", price: 250, unit: "กล่อง" },
  { code: "INSNEED", name: "เข็มปากกาอินซูลิน (กล่อง 100 ชิ้น)", category: "เวชภัณฑ์", price: 350, unit: "กล่อง" },
  { code: "O2", name: "ออกซิเจนที่บ้าน (ถัง)", category: "เวชภัณฑ์", price: 300, unit: "ถัง" },
];

/** How often, and what that is a day for the count. */
export const FREQUENCIES: { label: string; perDay: number }[] = [
  { label: "วันละ 1 ครั้ง", perDay: 1 },
  { label: "วันละ 2 ครั้ง", perDay: 2 },
  { label: "วันละ 3 ครั้ง", perDay: 3 },
  { label: "วันละ 4 ครั้ง", perDay: 4 },
  { label: "เมื่อมีอาการ", perDay: 3 },
  { label: "สัปดาห์ละครั้ง", perDay: 1 / 7 },
];

export const TIMINGS = ["หลังอาหาร", "ก่อนอาหาร", "ก่อนนอน", "เช้า", "เย็น", "ไม่ระบุ"] as const;

/** The doses a form is measured in; the first is the default. */
export function doseUnits(form: DrugForm): string[] {
  switch (form) {
    case "TAB":
      return ["เม็ด"];
    case "CAP":
      return ["แคปซูล"];
    case "INJ":
      return ["ยูนิต", "ml", "AMP"];
    case "MDI":
      return ["พัฟ"];
    case "SYR":
      return ["ml", "ช้อนชา", "ซอง"];
    case "DROP":
      return ["หยด"];
    case "CREAM":
      return ["ครั้ง"];
  }
}

export const PRESCRIBERS = [
  "พญ.ศิริพร วงศ์สุวรรณ",
  "นพ.ธนกร พิพัฒน์กุล",
  "พยาบาลวิชาชีพ (ตามคำสั่งแพทย์)",
] as const;

export const PAYMENTS = ["เบิกได้", "ชำระเอง"] as const;

/** One medicine on the order. */
export type DrugLine = {
  kind: "drug";
  id: string;
  drug: Drug;
  dose: number;
  doseUnit: string;
  frequency: string;
  timing: string;
  days: number;
  /** Packs to dispense. */
  qty: number;
  /** Free-form instructions instead of the built ones (the hospital's "Mode 2"). */
  custom: string;
  note: string;
  prescriber: string;
};

/** One supply or service on the order. */
export type ServiceLine = {
  kind: "service";
  id: string;
  service: Service;
  qty: number;
  payment: string;
  note: string;
  prescriber: string;
};

export type OrderLine = DrugLine | ServiceLine;

/** How many packs the built instructions add up to, where the count is in the same unit. */
export function packsFor(drug: Drug, dose: number, doseUnit: string, frequency: string, days: number): number {
  const perDay = FREQUENCIES.find((f) => f.label === frequency)?.perDay ?? 1;
  if (doseUnit === drug.pack || doseUnit === "ซอง") return Math.max(1, Math.ceil(dose * perDay * days));
  // A bottle, tube or inhaler: one, unless the days say otherwise.
  return 1;
}

/** The instructions in one line — "1 เม็ด วันละ 3 ครั้ง หลังอาหาร 7 วัน". */
export function sigOf(line: DrugLine): string {
  if (line.custom.trim() !== "") return line.custom.trim();
  const dose = Number.isInteger(line.dose) ? String(line.dose) : String(line.dose).replace(/^0/, "");
  const parts = [`${dose} ${line.doseUnit}`, line.frequency];
  if (line.timing !== "ไม่ระบุ") parts.push(line.timing);
  parts.push(`${line.days} วัน`);
  return parts.join(" ");
}

export function lineTotal(line: OrderLine): number {
  return line.kind === "drug" ? line.qty * line.drug.price : line.qty * line.service.price;
}

export function orderTotal(lines: OrderLine[]): number {
  return lines.reduce((s, l) => s + lineTotal(l), 0);
}

/**
 * Whether a medicine trips one of the card's allergies.
 *
 * A plain word match on the name, in both languages, plus the one family
 * a carer is most likely to be caught by — penicillin covers the whole
 * -cillin group. Not a drug-interaction checker; a nudge.
 */
export function allergyHit(drug: Drug, allergies: string[]): string | null {
  const hay = `${drug.name} ${drug.th}`.toLowerCase();
  for (const a of allergies) {
    const k = a.trim().toLowerCase();
    if (k === "") continue;
    if (hay.includes(k)) return a;
    if (/penicillin|เพนิซิลลิน|เพนนิซิลิน/.test(k) && /cillin|เพนิซิลลิน/.test(hay)) return a;
    if (/sulfa|ซัลฟา/.test(k) && /sulfa|ซัลฟา/.test(hay)) return a;
  }
  return null;
}

/** Search both lists on any part of the name or the Thai gloss. */
export function searchDrugs(q: string): Drug[] {
  const k = q.trim().toLowerCase();
  if (k === "") return DRUGS;
  return DRUGS.filter((d) => d.name.toLowerCase().includes(k) || d.th.toLowerCase().includes(k) || d.code.toLowerCase().includes(k));
}
export function searchServices(q: string): Service[] {
  const k = q.trim().toLowerCase();
  if (k === "") return SERVICES;
  return SERVICES.filter((s) => s.name.toLowerCase().includes(k) || s.category.toLowerCase().includes(k));
}

/* ------------------------------------------------------------- the store */

const store = new Map<string, OrderLine[]>();
const watchers = new Set<() => void>();
const NONE: OrderLine[] = [];

/** Write the visit's order, and the one-line digest the patient page reads. */
export function saveOrder(authenCode: string, lines: OrderLine[]): void {
  store.set(authenCode, lines);
  const drugs = lines.filter((l) => l.kind === "drug").length;
  const items = lines.length - drugs;
  const parts: string[] = [];
  if (drugs > 0) parts.push(`ยา ${drugs} รายการ`);
  if (items > 0) parts.push(`เวชภัณฑ์/บริการ ${items} รายการ`);
  const rec: TaskRecord = {
    result: parts.length ? `${parts.join(" · ")} · รวม ${orderTotal(lines).toLocaleString("th-TH")} บาท` : "",
    count: String(lines.length),
    total: String(orderTotal(lines)),
    lines: JSON.stringify(lines),
  };
  saveTask(authenCode, "medication", rec);
  for (const w of watchers) w();
}

/** This visit's order — live. */
export function useOrder(authenCode: string): OrderLine[] {
  return useSyncExternalStore(
    (onChange) => {
      watchers.add(onChange);
      return () => {
        watchers.delete(onChange);
      };
    },
    () => store.get(authenCode) ?? NONE,
  );
}

export function orderOf(authenCode: string): OrderLine[] {
  return store.get(authenCode) ?? NONE;
}

/* ------------------------------------------------------- what was given before */

/** One line of a past order, by code, so it can be put on today's. */
export type PastOrderLine =
  | { kind: "drug"; code: string; dose: number; doseUnit: string; frequency: string; timing: string; days: number; qty: number }
  | { kind: "service"; code: string; qty: number; payment: string };

export type PastOrder = {
  id: string;
  /** Days ago. */
  daysAgo: number;
  clinic: string;
  prescriber: string;
  lines: PastOrderLine[];
};

const HISTORY_SEED: Omit<PastOrder, "id">[] = [
  {
    daysAgo: 14,
    clinic: "คลินิกเบาหวาน / ความดัน (NCD)",
    prescriber: "พญ.ศิริพร วงศ์สุวรรณ",
    lines: [
      { kind: "drug", code: "MET500", dose: 1, doseUnit: "เม็ด", frequency: "วันละ 2 ครั้ง", timing: "หลังอาหาร", days: 30, qty: 60 },
      { kind: "drug", code: "AML5", dose: 1, doseUnit: "เม็ด", frequency: "วันละ 1 ครั้ง", timing: "เช้า", days: 30, qty: 30 },
      { kind: "drug", code: "SIM20", dose: 1, doseUnit: "เม็ด", frequency: "วันละ 1 ครั้ง", timing: "ก่อนนอน", days: 30, qty: 30 },
      { kind: "service", code: "STRIP", qty: 1, payment: "เบิกได้" },
      { kind: "service", code: "OPD", qty: 1, payment: "เบิกได้" },
    ],
  },
  {
    daysAgo: 45,
    clinic: "เยี่ยมบ้าน (HHC)",
    prescriber: "พยาบาลวิชาชีพ (ตามคำสั่งแพทย์)",
    lines: [
      { kind: "drug", code: "MET500", dose: 1, doseUnit: "เม็ด", frequency: "วันละ 2 ครั้ง", timing: "หลังอาหาร", days: 30, qty: 60 },
      { kind: "drug", code: "AML5", dose: 1, doseUnit: "เม็ด", frequency: "วันละ 1 ครั้ง", timing: "เช้า", days: 30, qty: 30 },
      { kind: "service", code: "HHC", qty: 1, payment: "เบิกได้" },
      { kind: "service", code: "GAUZE", qty: 5, payment: "เบิกได้" },
      { kind: "service", code: "NSS", qty: 1, payment: "เบิกได้" },
    ],
  },
  {
    daysAgo: 76,
    clinic: "ห้องตรวจโรคทั่วไป 1",
    prescriber: "นพ.ธนกร พิพัฒน์กุล",
    lines: [
      { kind: "drug", code: "PARA500", dose: 1, doseUnit: "เม็ด", frequency: "เมื่อมีอาการ", timing: "ไม่ระบุ", days: 5, qty: 15 },
      { kind: "drug", code: "CET10", dose: 1, doseUnit: "เม็ด", frequency: "วันละ 1 ครั้ง", timing: "ก่อนนอน", days: 5, qty: 5 },
      { kind: "service", code: "OPD", qty: 1, payment: "เบิกได้" },
    ],
  },
];

/**
 * What this patient was given before — simulated, seeded from the hospital
 * number so the same patient always has the same past, like the treatment
 * history. A real record would come from the pharmacy system.
 */
export function dispensingHistory(hn: string): PastOrder[] {
  const n = 1 + (hn.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 3);
  return HISTORY_SEED.slice(0, n).map((o, i) => ({ ...o, id: `${hn}-rx-${i}` }));
}

/** The item a past line names, for reading it. */
export function pastItem(line: PastOrderLine): Drug | Service | null {
  return line.kind === "drug" ? (DRUGS.find((d) => d.code === line.code) ?? null) : (SERVICES.find((s) => s.code === line.code) ?? null);
}

/** A past line as a fresh line on today's order — null if the item is no longer stocked. */
export function restoreLine(line: PastOrderLine, id: string, prescriber: string): OrderLine | null {
  if (line.kind === "drug") {
    const drug = DRUGS.find((d) => d.code === line.code);
    if (drug == null) return null;
    return { kind: "drug", id, drug, dose: line.dose, doseUnit: line.doseUnit, frequency: line.frequency, timing: line.timing, days: line.days, qty: line.qty, custom: "", note: "", prescriber };
  }
  const service = SERVICES.find((s) => s.code === line.code);
  if (service == null) return null;
  return { kind: "service", id, service, qty: line.qty, payment: line.payment, note: "", prescriber };
}

/** The instructions a past drug line carries, in the same one line. */
export function pastSig(line: Extract<PastOrderLine, { kind: "drug" }>): string {
  const parts = [`${line.dose} ${line.doseUnit}`, line.frequency];
  if (line.timing !== "ไม่ระบุ") parts.push(line.timing);
  parts.push(`${line.days} วัน`);
  return parts.join(" ");
}
