import { askModel, jsonIn } from "./aiHost";
import {
  bmiLabel as residentBmiLabel,
  bmiOf as residentBmi,
  SCREENING_LABEL,
  type Resident,
} from "./household";
import {
  METRICS,
  formatReading,
  statusOf,
  type MetricKind,
  type Reading,
} from "./vitals";
import type { PatientDetail } from "./patientDetail";
import { bmiLabel, bmiOf } from "./patientDetail";
import type { Task } from "./task";
import type { PastVisit } from "./community";
import { isEn } from "../i18n";

/** The line that makes the model write its JSON values in English. */
const IN_ENGLISH = isEn
  ? "Write every text value in the JSON in English (clear clinical English), even though the data below is in Thai. Keep the JSON keys as given."
  : "";

/** What the assistant came back with. */
export type PatientBrief = {
  /** Two or three sentences on the patient and the visit. */
  overview: string;
  /** Why this visit is being made and what it is meant to achieve, in a sentence or two. */
  visit: string;
  /** What happened at the last treatment, in a sentence or two — empty when there was none. */
  lastVisit: string;
  /** What to bring or arrange before going. */
  prepare: string[];
};

/**
 * A summary of the record, written by the model on the hospital's cluster.
 *
 * WHAT LEAVES THE DEVICE: the clinical picture only — age, sex, condition,
 * vitals, ADL, allergies, equipment, caregiver readiness, household and
 * environment. Deliberately NOT the name, the citizen ID, the HN/AN, either
 * phone number or the address: none of them change what the summary says, so
 * there is no reason to put them on a wire. The host is declared in `aiHost`.
 *
 * This never blocks the sheet. `briefFlags` has already read the same record
 * on the phone and is on screen before this is asked for; if the cluster is
 * unreachable the sheet keeps what it has.
 */
export async function summariseForDecision(
  task: Task,
  d: PatientDetail,
  last?: PastVisit,
): Promise<PatientBrief | null> {
  // The last treatment, as the history holds it: when, where, what was
  // found and what was decided. No names of staff — they do not change
  // the summary either.
  const lastRecord =
    last == null
      ? ["การรักษาล่าสุด: ไม่มีข้อมูล"]
      : [
          `การรักษาล่าสุด: ${last.daysAgo} วันก่อน ที่ ${last.clinic}`,
          last.complaint != null ? `  อาการสำคัญ: ${last.complaint}` : "",
          `  สัญญาณชีพ: ${last.vitals.map((v) => `${v.label} ${v.value} ${v.unit}${v.note ? ` (${v.note})` : ""}`).join(", ")}`,
          last.assessments.length > 0
            ? `  แบบประเมิน: ${last.assessments.map((a) => `${a.name} ${a.score} (${a.result})`).join(", ")}`
            : "",
          `  สรุปผล: ${last.summary}`,
          last.homeVisit?.plan ? `  แผนการดูแล: ${last.homeVisit.plan}` : "",
        ].filter((line) => line !== "");

  const record = [
    `อายุ ${task.age} ปี`,
    `โรคประจำตัว: ${d.condition}`,
    `เหตุผลการเยี่ยม: ${d.visitReason}`,
    `วัตถุประสงค์: ${d.visitPurpose}`,
    `สัญญาณชีพ: อุณหภูมิ ${d.temperatureC}, ออกซิเจน ${d.oxygenPercent}, ความดัน ${d.bloodPressure}, ชีพจร ${d.pulseBpm}`,
    `BMI ${bmiOf(d).toFixed(1)} (${bmiLabel(d)})`,
    `ADL: ${d.adl}`,
    `ประวัติการแพ้ยา: ${d.allergies}`,
    `อุปกรณ์ทางการแพทย์: ${d.equipment}`,
    `การรับประทานอาหาร: ${d.feeding}`,
    `การขับถ่าย: ${d.excretion}`,
    `ข้อควรระวังพิเศษ: ${d.precautions}`,
    `ผู้ดูแลหลัก: ${d.caregiverRelation} (${d.caregiverReadiness})`,
    `สมาชิกในบ้าน ${d.householdSize}, รายได้ ${d.householdIncome}, สวัสดิการ ${d.welfare}`,
    `สิ่งแวดล้อมบ้าน: ${d.homeEnvironment}`,
    `สุขภาพจิต/พฤติกรรมเสี่ยง: ${d.mentalHealth}`,
    ...lastRecord,
  ].join("\n");

  const prompt = [
    "คุณเป็นพยาบาลเยี่ยมบ้าน อ่านข้อมูลผู้ป่วยด้านล่างแล้วสรุปสั้นๆ",
    "เพื่อช่วยพยาบาลตัดสินใจว่าจะรับงานเยี่ยมบ้านรายนี้หรือไม่ และเตรียมตัวก่อนไป",
    'ตอบเป็น JSON อย่างเดียว ห้ามมีคำอธิบายหรือ markdown รูปแบบ: {"overview":"","visit":"","lastVisit":"","prepare":["",""]}',
    "overview = 2-3 ประโยค บอกภาพรวมผู้ป่วยและความยากง่ายของการเยี่ยมครั้งนี้",
    "visit = 1-2 ประโยค สรุปเหตุผลและวัตถุประสงค์ของการเยี่ยมครั้งนี้ว่าไปทำอะไร เพื่ออะไร",
    "lastVisit = 1-2 ประโยค สรุปการรักษาล่าสุด ค่าที่ผิดปกติ และสิ่งที่ต้องติดตามต่อจากครั้งนั้น ถ้าไม่มีข้อมูลให้ตอบเป็นข้อความว่าง",
    "prepare = สิ่งที่ควรเตรียมหรือจัดการก่อนไป 2-4 ข้อ ข้อละไม่เกิน 15 คำ",
    "ใช้เฉพาะข้อมูลที่ให้มา ห้ามเดาหรือเพิ่มตัวเลขที่ไม่มีในข้อมูล",
    "ห้ามวินิจฉัยโรคใหม่ และห้ามสั่งยา",
    IN_ENGLISH,
    "",
    record,
  ].join("\n");

  const reply = await askModel([{ role: "user", content: prompt }], {
    // Longer than the ID scanner's: this is prose, and it is not holding up a
    // form the carer is typing into.
    timeoutMs: 30_000,
    maxTokens: 500,
  });
  if (reply == null) return null;

  const parsed = jsonIn(reply);
  if (parsed == null) return null;

  const overview = typeof parsed.overview === "string" ? parsed.overview.trim() : "";
  if (overview.length === 0) return null;

  const prepare = Array.isArray(parsed.prepare)
    ? parsed.prepare
        .filter((line): line is string => typeof line === "string")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .slice(0, 4)
    : [];
  const visit = typeof parsed.visit === "string" ? parsed.visit.trim() : "";
  const lastVisit = typeof parsed.lastVisit === "string" ? parsed.lastVisit.trim() : "";

  return { overview, visit, lastVisit, prepare };
}

/** The assistant's read on a resident's whole record. */
export type HealthBrief = {
  /** Two or three sentences on how this person is doing overall. */
  overview: string;
  /** What to keep an eye on, shortest first. */
  watch: string[];
};

/**
 * A summary of everything the health page shows, written by the model on the
 * hospital's cluster.
 *
 * WHAT LEAVES THE DEVICE: age, sex, blood type, the BMI, the six latest
 * readings with the range each fell in, and the screening panel. Deliberately
 * NOT the name, the photograph, the phone number or which house they live in:
 * none of them change what the summary says.
 *
 * Never blocks the page. The readings are on screen before this is asked for,
 * and if the cluster is unreachable the card says so and the page is
 * unaffected.
 */
export async function summariseResident(
  resident: Resident,
  latest: Partial<Record<MetricKind, Reading>>,
): Promise<HealthBrief | null> {
  const readings = METRICS.flatMap((m) => {
    const r = latest[m.kind];
    if (r == null) return [];
    const status = statusOf(m.kind, r.value, r.value2);
    return [`${m.name}: ${formatReading(m, r)} ${m.unit} (${status.label})`];
  });

  const record = [
    `อายุ ${resident.age} ปี เพศ${resident.gender} หมู่เลือด ${resident.bloodType}`,
    `น้ำหนัก ${resident.weightKg} kg ส่วนสูง ${resident.heightCm} cm BMI ${residentBmi(
      resident,
    ).toFixed(1)} (${residentBmiLabel(resident)})`,
    "ค่าล่าสุด:",
    ...readings.map((line) => `- ${line}`),
    "ผลคัดกรอง:",
    ...resident.screenings.map(
      (s) => `- ${s.name}: ${SCREENING_LABEL[s.status]}`,
    ),
  ].join("\n");

  const prompt = [
    "คุณเป็นพยาบาลเยี่ยมบ้าน อ่านข้อมูลสุขภาพด้านล่างแล้วสรุปภาพรวมของผู้ป่วยรายนี้",
    'ตอบเป็น JSON อย่างเดียว ห้ามมีคำอธิบายหรือ markdown รูปแบบ: {"overview":"","watch":["",""]}',
    "overview = 2-3 ประโยค บอกภาพรวมสุขภาพโดยรวมว่าอยู่ในเกณฑ์ไหน และมีอะไรน่ากังวลหรือไม่",
    "watch = สิ่งที่ควรเฝ้าระวังหรือติดตามต่อ 2-4 ข้อ ข้อละไม่เกิน 15 คำ",
    "ใช้เฉพาะข้อมูลที่ให้มา ห้ามเดาหรือเพิ่มตัวเลขที่ไม่มีในข้อมูล",
    "ห้ามวินิจฉัยโรคใหม่ และห้ามสั่งยา",
    IN_ENGLISH,
    "",
    record,
  ].join("\n");

  const reply = await askModel([{ role: "user", content: prompt }], {
    timeoutMs: 30_000,
    maxTokens: 500,
  });
  if (reply == null) return null;

  const parsed = jsonIn(reply);
  if (parsed == null) return null;

  const overview = typeof parsed.overview === "string" ? parsed.overview.trim() : "";
  if (overview.length === 0) return null;

  const watch = Array.isArray(parsed.watch)
    ? parsed.watch
        .filter((line): line is string => typeof line === "string")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .slice(0, 4)
    : [];

  return { overview, watch };
}
