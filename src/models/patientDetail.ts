import { residentById, type Resident, type ScreeningKind } from "./household";
import { tr } from "../i18n";

/** The clinical record behind a posting. Stand-in until a backend supplies it. */
export type PatientDetail = {
  condition: string;
  phone: string;
  nationalId: string;
  hn: string;
  an: string;
  dischargeDate: string;
  coverage: string;
  referredBy: string;
  visitReason: string;
  visitPurpose: string;
  allergies: string;
  medicalNote: string;
  weightKg: number;
  heightCm: number;
  temperatureC: string;
  oxygenPercent: string;
  bloodPressure: string;
  pulseBpm: string;
  adl: string;
  caregiverName: string;
  caregiverRelation: string;
  caregiverReadiness: string;
  caregiverPhone: string;
  equipment: string;
  feeding: string;
  excretion: string;
  precautions: string;
  householdSize: string;
  householdIncome: string;
  welfare: string;
  homeEnvironment: string;
  mentalHealth: string;
};

export const sampleDetail: PatientDetail = {
  condition: tr("โรคเบาหวาน", "Diabetes"),
  phone: "0800000000",
  nationalId: "1234567890123",
  hn: "000001",
  an: "000001",
  dischargeDate: tr("ยังไม่จำหน่าย", "Not yet discharged"),
  coverage: tr("UC 30 บาท", "UC 30 baht"),
  referredBy: tr("514 เยี่ยมบ้าน(HHC)", "514 Home visit (HHC)"),
  visitReason: tr("ติดตามดูแลผู้ป่วยโรคเรื้อรัง", "Chronic disease follow-up"),
  visitPurpose: tr("ประเมินสุขภาพและให้คำปรึกษา", "Health assessment and counseling"),
  allergies: tr("ปฏิเสธการแพ้ยา", "No known drug allergies"),
  medicalNote: tr("รายละเอียด", "Details"),
  weightKg: 72,
  heightCm: 170,
  temperatureC: "36.7 C",
  oxygenPercent: "99 %",
  bloodPressure: "120/90 mmHg",
  pulseBpm: "90 bpm",
  adl: tr("18 คะแนน  ช่วยเหลือตนเองได้ดี", "18 points  Largely independent"),
  caregiverName: "นายทดลอง ทดสอบ",
  caregiverRelation: tr("ลูกชาย", "Son"),
  caregiverReadiness: tr("พร้อมดูแล", "Ready to provide care"),
  caregiverPhone: "0812345678",
  equipment: tr("ไม่มี", "None"),
  feeding: tr("ทางปาก", "Oral"),
  excretion: tr("ปกติ", "Normal"),
  precautions: tr("ไม่มี", "None"),
  householdSize: tr("5 คน", "5 people"),
  householdIncome: tr("ไม่ระบุ", "Not specified"),
  welfare: tr("บัตรทอง", "Gold Card (UC)"),
  homeEnvironment: tr("ไม่ระบุ", "Not specified"),
  mentalHealth: tr("ไม่มี", "None"),
};

/**
 * The record for one person, built from who they actually are.
 *
 * `sampleDetail` above is one record, and until now every patient in the app
 * was handed it: ask about anybody's allergies and you were told about the
 * same diabetic. It stays as the shape and the defaults; this fills in the
 * fields that belong to a person from the registry entry that IS that person
 * — their body, their screening results, their age — so two patients read
 * differently because they are different.
 *
 * Deterministic, not random: the same resident gives the same record on every
 * launch, which is what lets an answer be checked against a screen.
 */
export function detailFor(resident: Resident): PatientDetail {
  const n = [...resident.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const flag = (kind: ScreeningKind) =>
    resident.screenings.find((s) => s.kind === kind)?.status === "atRisk";

  const conditions = [
    flag("diabetes") ? tr("เบาหวานชนิดที่ 2", "Type 2 diabetes") : "",
    flag("pressure") ? tr("ความดันโลหิตสูง", "Hypertension") : "",
    flag("stroke") ? tr("หลอดเลือดสมอง", "Stroke") : "",
    flag("obesity") ? tr("ภาวะน้ำหนักเกิน", "Overweight") : "",
  ].filter((c) => c !== "");

  // The readings move with the screening panel: somebody flagged for
  // pressure should not be reading 120/80 on the page that says so.
  const systolic = flag("pressure") ? 142 + (n % 18) : 112 + (n % 16);
  const diastolic = flag("pressure") ? 88 + (n % 10) : 68 + (n % 12);
  const pulse = 62 + (n % 28);
  const spo2 = resident.age >= 70 ? 94 + (n % 4) : 96 + (n % 4);

  // A carer's own question: how much of this person's day is their own.
  const adl =
    resident.age >= 80
      ? tr(`${7 + (n % 5)} คะแนน  ต้องการผู้ดูแลเกือบตลอดเวลา`, `${7 + (n % 5)} points  Needs a caregiver almost all the time`)
      : resident.age >= 65
        ? tr(`${12 + (n % 6)} คะแนน  ช่วยเหลือตนเองได้บางส่วน`, `${12 + (n % 6)} points  Partly independent`)
        : tr(`${18 + (n % 3)} คะแนน  ช่วยเหลือตนเองได้ดี`, `${18 + (n % 3)} points  Largely independent`);

  return {
    ...sampleDetail,
    condition: conditions.length > 0 ? conditions.join(tr(" ", ", ")) : tr("ไม่มีโรคประจำตัว", "No chronic conditions"),
    phone: resident.phone,
    // Kept out of the record on purpose: these identify a person, and the
    // stand-in data is not the place to mint numbers that look real.
    nationalId: sampleDetail.nationalId,
    weightKg: resident.weightKg,
    heightCm: resident.heightCm,
    temperatureC: `${(36.4 + (n % 9) / 10).toFixed(1)} C`,
    oxygenPercent: `${spo2} %`,
    bloodPressure: `${systolic}/${diastolic} mmHg`,
    pulseBpm: `${pulse} bpm`,
    adl,
    allergies: ALLERGIES[n % ALLERGIES.length],
    precautions:
      resident.age >= 75
        ? tr("เสี่ยงต่อการหกล้ม ต้องมีผู้ดูแลขณะเดิน", "Fall risk; needs a caregiver when walking")
        : flag("diabetes")
          ? tr("ตรวจเท้าทุกครั้งที่เยี่ยม แผลหายช้า", "Check feet at every visit; slow wound healing")
          : tr("ไม่มี", "None"),
    equipment: resident.needsAttention === true
      ? tr("เตียงปรับระดับ ที่นอนลม", "Adjustable bed, air mattress")
      : tr("ไม่มี", "None"),
    caregiverRelation: CAREGIVERS[n % CAREGIVERS.length],
    caregiverReadiness: n % 4 === 0
      ? tr("ต้องการคำแนะนำเพิ่ม", "Needs more guidance")
      : tr("พร้อมดูแล", "Ready to provide care"),
  };
}

/**
 * The record behind a visit.
 *
 * Every screen that shows a patient goes through here, so none of them has
 * to know how a record is put together — and none of them can quietly fall
 * back to somebody else's. A visit whose person is not in the registry gets
 * the shared stand-in, which is the old behaviour and now the exception
 * rather than the rule.
 */
export function detailOf(task: { residentId: string }): PatientDetail {
  const r = residentById(task.residentId);
  return r == null ? sampleDetail : detailFor(r);
}

const ALLERGIES = [
  tr("ปฏิเสธการแพ้ยา", "No known drug allergies"),
  "Penicillin",
  "Sulfa",
  "NSAIDs",
  tr("ปฏิเสธการแพ้ยา", "No known drug allergies"),
  "Aspirin",
];

const CAREGIVERS = tr(
  ["ลูกสาว", "ลูกชาย", "คู่สมรส", "หลาน", "เพื่อนบ้าน", "ไม่มีผู้ดูแล"],
  ["Daughter", "Son", "Spouse", "Grandchild", "Neighbor", "No caregiver"],
);

export const bmiOf = (d: PatientDetail) =>
  d.weightKg / ((d.heightCm / 100) * (d.heightCm / 100));

/** WHO Asia-Pacific cut-offs, which are what Thai practice uses. */
export function bmiLabel(d: PatientDetail): string {
  const b = bmiOf(d);
  if (b < 18.5) return tr("น้ำหนักน้อยกว่าเกณฑ์", "Underweight");
  if (b < 23) return tr("อยู่ในเกณฑ์ปกติ", "Normal");
  if (b < 25) return tr("น้ำหนักเกิน", "Overweight");
  if (b < 30) return tr("โรคอ้วนระดับ 1", "Obesity class 1");
  return tr("โรคอ้วนระดับ 2", "Obesity class 2");
}

export const bmiHealthy = (d: PatientDetail) => {
  const b = bmiOf(d);
  return b >= 18.5 && b < 23;
};

/** Where the reading sits along the gauge, 0 to 1; the arc spans 15 to 35. */
export const bmiFraction = (d: PatientDetail) =>
  Math.min(1, Math.max(0, (bmiOf(d) - 15) / 20));
