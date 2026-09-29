/**
 * The diagnoses a community round actually writes, with their codes.
 *
 * Not the whole of ICD-10 — a phone in a house does not need seventy
 * thousand codes — but the set the Ministry's ICD-10-TM for PCU lists for
 * primary care units, which is what a รพ.สต. codes against and what the 43
 * files carry up to HDC. The Thai names are the ones printed on that list.
 * Anything not here is written as words without a code and coded later.
 * The English names are the WHO ICD-10 titles for the same codes.
 */
import { isEn, tr } from "../i18n";

export type Icd = { code: string; th: string; en: string };

export const ICD10: Icd[] = [
  // Chronic disease — most of what a round is for.
  { code: "E11.9", th: "เบาหวานชนิดที่ 2 ไม่มีภาวะแทรกซ้อน", en: "Type 2 diabetes mellitus without complications" },
  { code: "E11.4", th: "เบาหวานชนิดที่ 2 มีภาวะแทรกซ้อนทางระบบประสาท", en: "Type 2 diabetes mellitus with neurological complications" },
  { code: "E11.5", th: "เบาหวานชนิดที่ 2 มีภาวะแทรกซ้อนหลอดเลือดส่วนปลาย", en: "Type 2 diabetes mellitus with peripheral circulatory complications" },
  { code: "I10", th: "ความดันโลหิตสูงไม่ทราบสาเหตุ", en: "Essential (primary) hypertension" },
  { code: "E78.5", th: "ไขมันในเลือดสูง ไม่ระบุชนิด", en: "Hyperlipidaemia, unspecified" },
  { code: "E66.9", th: "โรคอ้วน ไม่ระบุชนิด", en: "Obesity, unspecified" },
  { code: "N18.9", th: "ไตวายเรื้อรัง ไม่ระบุระยะ", en: "Chronic kidney disease, unspecified" },
  { code: "I25.9", th: "โรคหัวใจขาดเลือดเรื้อรัง", en: "Chronic ischaemic heart disease, unspecified" },
  { code: "I50.9", th: "หัวใจล้มเหลว", en: "Heart failure, unspecified" },
  { code: "I69.4", th: "ผลตามหลังโรคหลอดเลือดสมอง", en: "Sequelae of stroke, not specified as haemorrhage or infarction" },
  { code: "G81.9", th: "อัมพาตครึ่งซีก", en: "Hemiplegia, unspecified" },
  { code: "J44.9", th: "ปอดอุดกั้นเรื้อรัง", en: "Chronic obstructive pulmonary disease, unspecified" },
  { code: "J45.9", th: "หืด", en: "Asthma, unspecified" },
  { code: "M10.9", th: "เก๊าท์", en: "Gout, unspecified" },
  { code: "E03.9", th: "ไทรอยด์ทำงานต่ำ", en: "Hypothyroidism, unspecified" },
  { code: "E05.9", th: "ไทรอยด์เป็นพิษ", en: "Thyrotoxicosis, unspecified" },
  { code: "D64.9", th: "โลหิตจาง ไม่ระบุชนิด", en: "Anaemia, unspecified" },
  { code: "G20", th: "โรคพาร์กินสัน", en: "Parkinson disease" },
  { code: "F03", th: "สมองเสื่อม ไม่ระบุชนิด", en: "Unspecified dementia" },
  { code: "G40.9", th: "โรคลมชัก", en: "Epilepsy, unspecified" },
  { code: "F20.9", th: "จิตเภท", en: "Schizophrenia, unspecified" },
  { code: "F32.9", th: "โรคซึมเศร้า", en: "Depressive episode, unspecified" },
  { code: "F41.9", th: "โรควิตกกังวล", en: "Anxiety disorder, unspecified" },
  { code: "F10.2", th: "ติดสุรา", en: "Alcohol dependence syndrome" },
  { code: "F17.2", th: "ติดบุหรี่", en: "Tobacco dependence syndrome" },
  // Acute — the things a person is unwell with today.
  { code: "J06.9", th: "ติดเชื้อทางเดินหายใจส่วนบนเฉียบพลัน", en: "Acute upper respiratory infection, unspecified" },
  { code: "J02.9", th: "คออักเสบเฉียบพลัน", en: "Acute pharyngitis, unspecified" },
  { code: "J18.9", th: "ปอดอักเสบ", en: "Pneumonia, unspecified" },
  { code: "J20.9", th: "หลอดลมอักเสบเฉียบพลัน", en: "Acute bronchitis, unspecified" },
  { code: "A09", th: "ท้องร่วง / กระเพาะลำไส้อักเสบ", en: "Other gastroenteritis and colitis of infectious and unspecified origin" },
  { code: "K30", th: "อาหารไม่ย่อย ท้องอืด", en: "Functional dyspepsia" },
  { code: "K29.7", th: "กระเพาะอาหารอักเสบ", en: "Gastritis, unspecified" },
  { code: "K21.0", th: "กรดไหลย้อน", en: "Gastro-oesophageal reflux disease with oesophagitis" },
  { code: "K59.0", th: "ท้องผูก", en: "Constipation" },
  { code: "N39.0", th: "ติดเชื้อทางเดินปัสสาวะ", en: "Urinary tract infection, site not specified" },
  { code: "R50.9", th: "ไข้ ไม่ทราบสาเหตุ", en: "Fever, unspecified" },
  { code: "R51", th: "ปวดศีรษะ", en: "Headache" },
  { code: "R42", th: "เวียนศีรษะ", en: "Dizziness and giddiness" },
  { code: "R53", th: "อ่อนเพลีย", en: "Malaise and fatigue" },
  { code: "R73.0", th: "น้ำตาลในเลือดสูงผิดปกติ (IFG)", en: "Abnormal glucose tolerance test (IFG)" },
  // Musculoskeletal.
  { code: "M54.5", th: "ปวดหลังส่วนล่าง", en: "Low back pain" },
  { code: "M17.9", th: "ข้อเข่าเสื่อม", en: "Gonarthrosis, unspecified" },
  { code: "M79.1", th: "ปวดกล้ามเนื้อ", en: "Myalgia" },
  { code: "M25.5", th: "ปวดข้อ", en: "Pain in joint" },
  { code: "M81.9", th: "กระดูกพรุน", en: "Osteoporosis, unspecified" },
  // Skin, eye, ear.
  { code: "L89.9", th: "แผลกดทับ", en: "Pressure ulcer of unspecified grade" },
  { code: "L30.9", th: "ผิวหนังอักเสบ", en: "Dermatitis, unspecified" },
  { code: "L03.9", th: "ผิวหนังติดเชื้อ (cellulitis)", en: "Cellulitis, unspecified" },
  { code: "B35.9", th: "เชื้อราที่ผิวหนัง", en: "Dermatophytosis, unspecified" },
  { code: "H25.9", th: "ต้อกระจกในผู้สูงอายุ", en: "Senile cataract, unspecified" },
  { code: "H10.9", th: "เยื่อบุตาอักเสบ", en: "Conjunctivitis, unspecified" },
  { code: "H90.5", th: "หูตึงจากประสาทหู", en: "Sensorineural hearing loss, unspecified" },
  // Injury.
  { code: "T14.0", th: "บาดแผลผิวหนัง ไม่ระบุตำแหน่ง", en: "Superficial injury of unspecified body region" },
  { code: "W19", th: "หกล้ม ไม่ระบุสาเหตุ", en: "Unspecified fall" },
  // Z — the reasons for a visit that are not a disease.
  { code: "Z00.0", th: "ตรวจสุขภาพทั่วไป", en: "General medical examination" },
  { code: "Z71.3", th: "ให้คำแนะนำด้านโภชนาการ", en: "Dietary counselling and surveillance" },
  { code: "Z71.4", th: "ให้คำปรึกษาเรื่องสุรา", en: "Alcohol abuse counselling and surveillance" },
  { code: "Z71.6", th: "ให้คำปรึกษาเรื่องบุหรี่", en: "Tobacco abuse counselling" },
  { code: "Z74.0", th: "ต้องการความช่วยเหลือเนื่องจากเคลื่อนไหวได้จำกัด", en: "Need for assistance due to reduced mobility" },
  { code: "Z74.1", th: "ต้องการความช่วยเหลือในการดูแลตนเอง", en: "Need for assistance with personal care" },
  { code: "Z74.3", th: "ต้องการการดูแลต่อเนื่อง (ติดเตียง)", en: "Need for continuous supervision" },
  { code: "Z51.5", th: "การดูแลแบบประคับประคอง", en: "Palliative care" },
  { code: "Z76.0", th: "รับยาต่อเนื่อง", en: "Issue of repeat prescription" },
  { code: "Z09.8", th: "ติดตามหลังการรักษา", en: "Follow-up examination after other treatment" },
];

/**
 * How a diagnosis relates to the visit — the 43-file DIAGTYPE codes HDC
 * takes: 1 principal, 2 co-morbidity, 3 complication, 4 other. External
 * cause (5) is left off; a home round does not code injuries.
 */
/**
 * What part a diagnosis plays, as the 43 files code it.
 *
 * Eight, not four: the first three are the ones a round writes, and the
 * rest are what a coder needs when the visit came out of an admission.
 * `label` is the full name the picker shows; `short` is what fits on the
 * chip beside the code.
 */
export const DX_TYPES = [
  { code: "1", label: tr("Principal Diagnosis (โรคหลัก)", "Principal diagnosis"), short: tr("โรคหลัก", "Principal") },
  { code: "2", label: tr("Comorbidity (โรคอื่นที่เป็นร่วมด้วย)", "Comorbidity"), short: tr("โรคร่วม", "Comorbidity") },
  {
    code: "3",
    label: tr("Complication (โรคที่เกิดเมื่อเข้านอนโรงพยาบาลแล้ว)", "Complication (arising after admission)"),
    short: tr("โรคแทรก", "Complication"),
  },
  { code: "4", label: tr("Other (สาเหตุภายนอกอื่น ๆ)", "Other"), short: tr("อื่นๆ", "Other") },
  { code: "5", label: tr("External causes (สาเหตุภายนอก)", "External cause"), short: tr("สาเหตุภายนอก", "External cause") },
  { code: "a", label: tr("Operation (การผ่าตัด)", "Operation"), short: "Operation" },
  { code: "b", label: tr("Non Operation (ไม่ใช่การผ่าตัด)", "Non-operation"), short: tr("Non Operation", "Non-operation") },
  { code: "c", label: tr("Special Investigation (การตรวจพิเศษ)", "Special investigation"), short: "Special Inv." },
] as const;

export type DxType = (typeof DX_TYPES)[number]["code"];

/** One diagnosis on the visit. `code` is "" for one written in words only. */
export type Diagnosis = { code: string; text: string; type: DxType };

/**
 * The card's chronic conditions, as codes — what the record already says
 * this person has, offered to be added in one tap rather than typed.
 */
export const CONDITION_CODES: Record<string, string> = {
  "เบาหวานชนิดที่ 2": "E11.9",
  "เบาหวาน": "E11.9",
  "โรคเบาหวาน": "E11.9",
  "ความดันโลหิตสูง": "I10",
  "โรคความดันโลหิตสูง": "I10",
  "ไขมันในเลือดสูง": "E78.5",
  "โรคไขมันในเลือดสูง": "E78.5",
  "ไตวายเรื้อรัง": "N18.9",
  "โรคหัวใจ": "I25.9",
  "หืด": "J45.9",
  "ปอดอุดกั้นเรื้อรัง": "J44.9",
  "เก๊าท์": "M10.9",
  "อัมพาต": "G81.9",
  // The same, as an English record writes them.
  "Type 2 diabetes": "E11.9",
  "Diabetes": "E11.9",
  "Hypertension": "I10",
  "Dyslipidemia": "E78.5",
};

export function icdOf(code: string): Icd | undefined {
  return ICD10.find((i) => i.code === code);
}

/** A code's name in the language on screen: the Thai list's, or WHO's. */
export const icdName = (i: Icd): string => (isEn ? i.en : i.th);

/**
 * A diagnosis's words for display. A text that is exactly the code's Thai
 * name — what picking a code writes into the record — reads as the English
 * name in English; anything the carer typed is theirs and stays as typed.
 */
export function dxText(d: { code: string; text: string }): string {
  const icd = d.code === "" ? undefined : icdOf(d.code);
  if (icd == null) return d.text;
  return d.text === icd.th || d.text === icd.en || d.text.trim() === ""
    ? icdName(icd)
    : d.text;
}

/** Codes, Thai and English matched on any part, most specific first. */
export function searchIcd(query: string): Icd[] {
  const q = query.trim().toLowerCase();
  if (q === "") return ICD10;
  return ICD10.filter(
    (i) =>
      i.code.toLowerCase().startsWith(q) ||
      i.th.toLowerCase().includes(q) ||
      i.en.toLowerCase().includes(q),
  );
}
