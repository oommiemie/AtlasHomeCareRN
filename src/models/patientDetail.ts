import { residentById, type Resident, type ScreeningKind } from "./household";

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
  condition: "โรคเบาหวาน",
  phone: "0800000000",
  nationalId: "1234567890123",
  hn: "000001",
  an: "000001",
  dischargeDate: "ยังไม่จำหน่าย",
  coverage: "UC 30 บาท",
  referredBy: "514 เยี่ยมบ้าน(HHC)",
  visitReason: "ติดตามดูแลผู้ป่วยโรคเรื้อรัง",
  visitPurpose: "ประเมินสุขภาพและให้คำปรึกษา",
  allergies: "ปฏิเสธการแพ้ยา",
  medicalNote: "รายละเอียด",
  weightKg: 72,
  heightCm: 170,
  temperatureC: "36.7 C",
  oxygenPercent: "99 %",
  bloodPressure: "120/90 mmHg",
  pulseBpm: "90 bpm",
  adl: "18 คะแนน  ช่วยเหลือตนเองได้ดี",
  caregiverName: "นายทดลอง ทดสอบ",
  caregiverRelation: "ลูกชาย",
  caregiverReadiness: "พร้อมดูแล",
  caregiverPhone: "0812345678",
  equipment: "ไม่มี",
  feeding: "ทางปาก",
  excretion: "ปกติ",
  precautions: "ไม่มี",
  householdSize: "5 คน",
  householdIncome: "ไม่ระบุ",
  welfare: "บัตรทอง",
  homeEnvironment: "ไม่ระบุ",
  mentalHealth: "ไม่มี",
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
    flag("diabetes") ? "เบาหวานชนิดที่ 2" : "",
    flag("pressure") ? "ความดันโลหิตสูง" : "",
    flag("stroke") ? "หลอดเลือดสมอง" : "",
    flag("obesity") ? "ภาวะน้ำหนักเกิน" : "",
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
      ? `${7 + (n % 5)} คะแนน  ต้องการผู้ดูแลเกือบตลอดเวลา`
      : resident.age >= 65
        ? `${12 + (n % 6)} คะแนน  ช่วยเหลือตนเองได้บางส่วน`
        : `${18 + (n % 3)} คะแนน  ช่วยเหลือตนเองได้ดี`;

  return {
    ...sampleDetail,
    condition: conditions.length > 0 ? conditions.join(" ") : "ไม่มีโรคประจำตัว",
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
        ? "เสี่ยงต่อการหกล้ม ต้องมีผู้ดูแลขณะเดิน"
        : flag("diabetes")
          ? "ตรวจเท้าทุกครั้งที่เยี่ยม แผลหายช้า"
          : "ไม่มี",
    equipment: resident.needsAttention === true ? "เตียงปรับระดับ ที่นอนลม" : "ไม่มี",
    caregiverRelation: CAREGIVERS[n % CAREGIVERS.length],
    caregiverReadiness: n % 4 === 0 ? "ต้องการคำแนะนำเพิ่ม" : "พร้อมดูแล",
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
  "ปฏิเสธการแพ้ยา",
  "Penicillin",
  "Sulfa",
  "NSAIDs",
  "ปฏิเสธการแพ้ยา",
  "Aspirin",
];

const CAREGIVERS = ["ลูกสาว", "ลูกชาย", "คู่สมรส", "หลาน", "เพื่อนบ้าน", "ไม่มีผู้ดูแล"];

export const bmiOf = (d: PatientDetail) =>
  d.weightKg / ((d.heightCm / 100) * (d.heightCm / 100));

/** WHO Asia-Pacific cut-offs, which are what Thai practice uses. */
export function bmiLabel(d: PatientDetail): string {
  const b = bmiOf(d);
  if (b < 18.5) return "น้ำหนักน้อยกว่าเกณฑ์";
  if (b < 23) return "อยู่ในเกณฑ์ปกติ";
  if (b < 25) return "น้ำหนักเกิน";
  if (b < 30) return "โรคอ้วนระดับ 1";
  return "โรคอ้วนระดับ 2";
}

export const bmiHealthy = (d: PatientDetail) => {
  const b = bmiOf(d);
  return b >= 18.5 && b < 23;
};

/** Where the reading sits along the gauge, 0 to 1; the arc spans 15 to 35. */
export const bmiFraction = (d: PatientDetail) =>
  Math.min(1, Math.max(0, (bmiOf(d) - 15) / 20));
