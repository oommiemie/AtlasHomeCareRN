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
