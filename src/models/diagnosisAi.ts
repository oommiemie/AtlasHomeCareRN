import { askModel, jsonIn } from "./aiHost";
import { SCREENING_FIELDS, type TaskRecord } from "./community";
import { ICD10, icdOf, type DxType } from "./icd10";
import { PP_CODES } from "./ppCodes";
import { ICD9, PROCEDURES, icd9Of } from "./procedures";

/**
 * A first draft of the clinical note, read off what this visit has already
 * written down.
 *
 * By the time the carer reaches the diagnosis page the visit has usually
 * said most of it somewhere else — the screening took the complaint and
 * the vitals, an assessment scored the patient, the home visit wrote the
 * history and the plan. This gathers that up and asks the model to put it
 * in the shape the note wants: a complaint, a history, the diagnoses in
 * words and in code, the procedures, and the prevention work to claim.
 *
 * WHAT LEAVES THE DEVICE: the clinical picture only — age, sex, chronic
 * conditions, allergies, and what the forms of this visit hold. Never the
 * name, the citizen ID, the HN or AN, the phone number or the address.
 *
 * Every code that comes back is checked against the app's own tables and
 * dropped if it is not there: a plausible-looking code the model invented
 * would go onto a claim, and nothing about the way it is presented would
 * say it was invented.
 */
export type DxSuggestion = {
  complaint: string;
  hpi: string;
  /** Diagnoses in words, for the record's own text list. */
  dxTexts: string[];
  icd10: { code: string; text: string; type: DxType }[];
  /** Procedures, by ICD-9-CM code. */
  icd9: { code: string; name: string }[];
  pp: { code: string; label: string }[];
};

/** What the visit has written down so far, as the model should read it. */
export type DxContext = {
  age: number;
  gender: string;
  conditions: string[];
  allergies: string[];
  screening?: TaskRecord;
  assessment?: TaskRecord;
  homevisit?: TaskRecord;
  medication?: TaskRecord;
};

const TYPES: DxType[] = ["1", "2", "3", "4", "5", "a", "b", "c"];

export async function suggestDiagnosis(ctx: DxContext): Promise<DxSuggestion | null> {
  const lines: string[] = [
    `อายุ ${ctx.age} ปี เพศ${ctx.gender}`,
    `โรคประจำตัว: ${ctx.conditions.length > 0 ? ctx.conditions.join(", ") : "ไม่มีข้อมูล"}`,
    `ประวัติแพ้ยา: ${ctx.allergies.length > 0 ? ctx.allergies.join(", ") : "ปฏิเสธการแพ้ยา"}`,
  ];

  const s = ctx.screening;
  if (s != null) {
    const vitals = SCREENING_FIELDS.filter((f) => (s[f.key] ?? "").trim() !== "").map(
      (f) => `${f.label} ${s[f.key]}`,
    );
    if ((s.complaint ?? "").trim() !== "") lines.push(`อาการที่บันทึกจากการคัดกรอง: ${s.complaint}`);
    if (vitals.length > 0) lines.push(`สัญญาณชีพ: ${vitals.join(", ")}`);
  }
  if ((ctx.assessment?.result ?? "").trim() !== "") lines.push(`ผลแบบประเมิน: ${ctx.assessment?.result}`);

  const h = ctx.homevisit;
  if (h != null) {
    const bits = [
      h.kind != null && h.kind !== "" ? `ประเภทการเยี่ยม ${h.kind}` : "",
      h.dependency != null && h.dependency !== "" ? `ภาวะพึ่งพิง ${h.dependency}` : "",
      h.adherence != null && h.adherence !== "" ? `การกินยา ${h.adherence}` : "",
      (h.history ?? "").trim() !== "" ? `ประวัติจากการเยี่ยม: ${h.history}` : "",
      (h.exam ?? "").trim() !== "" ? `ตรวจร่างกาย: ${h.exam}` : "",
      (h.problems ?? "").trim() !== "" ? `ปัญหาที่พบ: ${h.problems}` : "",
      (h.plan ?? "").trim() !== "" ? `แผนการดูแล: ${h.plan}` : "",
    ].filter((b) => b !== "");
    lines.push(...bits);
  }
  if ((ctx.medication?.result ?? "").trim() !== "") lines.push(`รายการยาที่สั่งวันนี้: ${ctx.medication?.result}`);

  // The tables the answer has to come out of, abridged: the model is being
  // asked to choose from a list, not to remember a classification.
  const icd10List = ICD10.slice(0, 64)
    .map((i) => `${i.code}=${i.th}`)
    .join("; ");
  const icd9List = ICD9.map((i) => `${i.code}=${i.th}`).join("; ");
  const ppList = PP_CODES.map((p) => `${p.code}=${p.label}`).join("; ");

  const prompt = [
    "คุณเป็นพยาบาลเวชปฏิบัติที่กำลังสรุปบันทึกการตรวจของการเยี่ยมบ้านครั้งนี้",
    "อ่านข้อมูลผู้ป่วยและสิ่งที่บันทึกไว้แล้วด้านล่าง แล้วร่างบันทึกการวินิจฉัยให้",
    'ตอบเป็น JSON อย่างเดียว ห้ามมีคำอธิบายหรือ markdown รูปแบบ: {"complaint":"","hpi":"","dxTexts":[""],"icd10":[{"code":"","text":"","type":"1"}],"icd9":[""],"pp":[""]}',
    "complaint = อาการสำคัญ 1 ประโยคสั้น",
    "hpi = ประวัติการเจ็บป่วยปัจจุบัน 2-4 ประโยค",
    "dxTexts = คำวินิจฉัยเป็นข้อความ 1-3 ข้อ",
    "icd10 = รหัสที่เข้าได้ 1-4 ข้อ เลือกจากรายการที่ให้เท่านั้น type ใช้ 1=โรคหลัก 2=โรคร่วม 3=โรคแทรก",
    "icd9 = รหัสหัตถการที่ทำในการเยี่ยมครั้งนี้ เลือกจากรายการที่ให้เท่านั้น ถ้าไม่มีให้เป็น []",
    "pp = รหัสงานส่งเสริมป้องกันโรค เลือกจากรายการที่ให้เท่านั้น ถ้าไม่มีให้เป็น []",
    "ใช้เฉพาะข้อมูลที่ให้มา ห้ามเดาตัวเลขหรือรหัสที่ไม่มีในรายการ ห้ามสั่งยา",
    "",
    "ข้อมูลผู้ป่วยและการเยี่ยมครั้งนี้:",
    ...lines,
    "",
    `รายการรหัส ICD-10 ที่เลือกได้: ${icd10List}`,
    `รายการรหัส ICD-9-CM ที่เลือกได้: ${icd9List}`,
    `รายการรหัส Special PP ที่เลือกได้: ${ppList}`,
  ].join("\n");

  const reply = await askModel([{ role: "user", content: prompt }], {
    timeoutMs: 45_000,
    maxTokens: 900,
  });
  if (reply == null) return null;
  const parsed = jsonIn(reply);
  if (parsed == null) return null;

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

  const dxTexts = list(parsed.dxTexts)
    .map(str)
    .filter((t) => t !== "")
    .slice(0, 4);

  const icd10 = list(parsed.icd10)
    .flatMap((raw) => {
      const row = raw as Record<string, unknown>;
      const code = str(row.code).toUpperCase();
      const found = icdOf(code);
      if (found == null) return [];
      const type = TYPES.includes(str(row.type) as DxType) ? (str(row.type) as DxType) : "2";
      return [{ code: found.code, text: str(row.text) !== "" ? str(row.text) : found.th, type }];
    })
    .slice(0, 5);

  const icd9 = list(parsed.icd9)
    .flatMap((raw) => {
      // Either a bare code or an object carrying one.
      const code = str(typeof raw === "string" ? raw : (raw as Record<string, unknown>)?.code).toUpperCase();
      const found = icd9Of(code);
      if (found == null) return [];
      const item = PROCEDURES.find((p) => p.icd9 === found.code);
      return [{ code: found.code, name: item?.name ?? found.th }];
    })
    .slice(0, 4);

  const pp = list(parsed.pp)
    .flatMap((raw) => {
      const code = str(typeof raw === "string" ? raw : (raw as Record<string, unknown>)?.code).toUpperCase();
      const found = PP_CODES.find((p) => p.code.toUpperCase() === code);
      return found == null ? [] : [{ code: found.code, label: found.label }];
    })
    .slice(0, 4);

  const out: DxSuggestion = {
    complaint: str(parsed.complaint),
    hpi: str(parsed.hpi),
    dxTexts,
    icd10,
    icd9,
    pp,
  };
  // Nothing usable came back — better to say so than to open an empty sheet.
  if (
    out.complaint === "" &&
    out.hpi === "" &&
    out.dxTexts.length === 0 &&
    out.icd10.length === 0 &&
    out.icd9.length === 0 &&
    out.pp.length === 0
  ) {
    return null;
  }
  return out;
}
