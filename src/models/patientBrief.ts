import type { PatientDetail } from "./patientDetail";
import { bmiHealthy, bmiLabel, bmiOf } from "./patientDetail";
import type { Task } from "./task";
import { hasLocation } from "./task";
import { tr } from "../i18n";

/**
 * How much a fact should weigh on the decision.
 *
 * `alert` is something to know before you say yes; `watch` is something to
 * carry with you once you have. Nothing else is listed — a brief that reports
 * what is normal is a brief nobody reads twice.
 */
export type BriefLevel = "alert" | "watch";

export type BriefFlag = {
  level: BriefLevel;
  /** The finding, in three or four words. */
  label: string;
  /** The number or phrase it was read from, so the carer can judge it. */
  detail: string;
};

/** The first number in a string like "36.7 C" or "18 คะแนน ช่วยเหลือได้ดี". */
function numIn(text: string): number | null {
  const found = text.match(/-?\d+(\.\d+)?/);
  return found == null ? null : Number(found[0]);
}

/** "120/90 mmHg" → [120, 90]. */
function pressureIn(text: string): [number, number] | null {
  const found = text.match(/(\d+)\s*\/\s*(\d+)/);
  return found == null ? null : [Number(found[1]), Number(found[2])];
}

/** Fields a form fills with a nothing-to-report answer, in either language. */
const NOTHING = ["ไม่มี", "ไม่ระบุ", "ปฏิเสธ", "-", "", "none", "not specified", "no known", "denies"];
const saysNothing = (text: string) =>
  NOTHING.some((word) =>
    word === "" ? text.trim() === "" : text.toLowerCase().includes(word),
  );

/**
 * What in this record bears on taking the job.
 *
 * Read here, on the phone, from the record already on screen: it is instant,
 * it works with no signal, and — unlike a sentence a model writes — a rule
 * that fires can be pointed at. The assistant's summary sits beside this,
 * never instead of it.
 *
 * The thresholds are ordinary Thai community-nursing ones; ADL is Barthel on
 * the 0–20 scale that long-term care uses, where 0–4 is ติดเตียง and 5–11 is
 * ติดบ้าน.
 */
export function briefFlags(task: Task, d: PatientDetail): BriefFlag[] {
  const flags: BriefFlag[] = [];
  const add = (level: BriefLevel, label: string, detail: string) =>
    flags.push({ level, label, detail });

  const temp = numIn(d.temperatureC);
  if (temp != null && temp >= 37.5) add("alert", tr("มีไข้", "Fever"), d.temperatureC);
  else if (temp != null && temp < 35.5) add("alert", tr("อุณหภูมิต่ำ", "Low temperature"), d.temperatureC);

  const spo2 = numIn(d.oxygenPercent);
  if (spo2 != null && spo2 < 95) add("alert", tr("ออกซิเจนต่ำ", "Low oxygen"), d.oxygenPercent);

  const bp = pressureIn(d.bloodPressure);
  if (bp != null && bp[0] < 90) add("alert", tr("ความดันต่ำ", "Low blood pressure"), d.bloodPressure);
  else if (bp != null && (bp[0] >= 140 || bp[1] >= 90))
    add("watch", tr("ความดันสูงกว่าเกณฑ์", "Blood pressure above target"), d.bloodPressure);

  const pulse = numIn(d.pulseBpm);
  if (pulse != null && pulse > 100) add("watch", tr("ชีพจรเร็ว", "Fast pulse"), d.pulseBpm);
  else if (pulse != null && pulse < 50) add("watch", tr("ชีพจรช้า", "Slow pulse"), d.pulseBpm);

  if (!bmiHealthy(d)) add("watch", bmiLabel(d), `BMI ${bmiOf(d).toFixed(1)}`);

  const adl = numIn(d.adl);
  if (adl != null && adl <= 4) add("alert", tr("ภาวะติดเตียง", "Bedbound"), d.adl);
  else if (adl != null && adl <= 11) add("watch", tr("ภาวะติดบ้าน", "Homebound"), d.adl);

  if (!saysNothing(d.allergies)) add("alert", tr("มีประวัติแพ้ยา", "Drug allergy on record"), d.allergies);
  if (!saysNothing(d.precautions)) add("alert", tr("มีข้อควรระวังพิเศษ", "Special precautions"), d.precautions);

  if (task.age >= 75) add("watch", tr("ผู้สูงอายุ", "Older adult"), tr(`${task.age} ปี`, `${task.age} yrs`));
  if (!saysNothing(d.equipment)) add("watch", tr("มีอุปกรณ์ทางการแพทย์", "Medical equipment in use"), d.equipment);
  if (!saysNothing(d.mentalHealth))
    add("watch", tr("ปัญหาสุขภาพจิต/พฤติกรรมเสี่ยง", "Mental health / risk behavior"), d.mentalHealth);

  // A carer who is not ready is the difference between a visit and a second
  // visit, so it belongs beside the clinical facts rather than four cards down.
  // Read in either language: the record is written in the one on screen.
  if (!/พร้อม|^ready/i.test(d.caregiverReadiness) || /ไม่พร้อม|not ready/i.test(d.caregiverReadiness))
    add("watch", tr("ผู้ดูแลอาจไม่พร้อม", "Caregiver may not be ready"), d.caregiverReadiness);

  if (!hasLocation(task)) add("watch", tr("ไม่มีพิกัดบนแผนที่", "No map location"), task.address ?? tr("ไม่ระบุที่อยู่", "No address"));

  // Alerts first; within a level the order above is the order they are read in.
  return flags.sort((a, b) => (a.level === b.level ? 0 : a.level === "alert" ? -1 : 1));
}
