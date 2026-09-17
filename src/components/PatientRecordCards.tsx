import { Text, View } from "react-native";

import { BmiGauge } from "./BmiGauge";
import { Card } from "./Card";
import {
  bmiFraction,
  bmiHealthy,
  bmiLabel,
  bmiOf,
  type PatientDetail,
} from "../models/patientDetail";
import { DANGER_INK, SEPARATOR, SPACE, TEXT_MUTED, TEXT_PRIMARY } from "../theme/tokens";

/**
 * The clinical record behind a visit, card by card — why the visit is,
 * what the patient has and reacts to, their measurements and vitals, how
 * much they can do for themselves, who looks after them, what they live
 * with and on. The posting shows it to decide on the job; the record
 * page shows it again, in full, to do the job.
 */
export function PatientRecordCards({ detail: d }: { detail: PatientDetail }) {
  return (
    <>
      <InfoCard
        rows={[
          ["เหตุผลการเยี่ยม", d.visitReason],
          ["วัตถุประสงค์การเยี่ยม", d.visitPurpose],
        ]}
      />
      {/* The condition in red, as the record page's own strip prints it. */}
      <Card>
        <Field label="โรคประจำตัว" value={d.condition} color={DANGER_INK} />
        <Rule />
        <Field label="ประวัติการแพ้ยา" value={d.allergies} />
      </Card>

      {/* Weight and height on the left, the reading they produce on the
          right. The gauge is drawn at 168 rather than scaled, so its type
          stays at the app's own sizes. */}
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Field label="น้ำหนัก" value={`${d.weightKg} kg`} />
            <Rule />
            <Field label="ส่วนสูง" value={`${d.heightCm} cm`} />
          </View>
          <View style={{ width: SPACE.md }} />
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>BMI</Text>
            <View style={{ marginTop: SPACE.sm }}>
              <BmiGauge
                value={bmiOf(d)}
                fraction={bmiFraction(d)}
                label={bmiLabel(d)}
                healthy={bmiHealthy(d)}
                width={168}
              />
            </View>
          </View>
        </View>
      </Card>

      {/* Vitals, two to a row. */}
      <View style={{ flexDirection: "row", gap: SPACE.md }}>
        <VitalCell label="อุณหภูมิ" value={d.temperatureC} />
        <VitalCell label="ออกซิเจน" value={d.oxygenPercent} />
      </View>
      <View style={{ flexDirection: "row", gap: SPACE.md }}>
        <VitalCell label="ความดัน" value={d.bloodPressure} />
        <VitalCell label="ชีพจร" value={d.pulseBpm} />
      </View>

      <InfoCard rows={[["การช่วยเหลือตัวเอง ADL", d.adl]]} />
      <InfoCard
        rows={[
          ["ผู้ดูแลหลัก", d.caregiverName],
          ["ความสัมพันธ์ผู้ดูแล", d.caregiverRelation],
          ["ความพร้อมผู้ดูแล", d.caregiverReadiness],
          ["เบอร์โทรศัพท์", d.caregiverPhone],
        ]}
      />
      <InfoCard
        rows={[
          ["อุปกรณ์ทางการแพทย์", d.equipment],
          ["การรับประทานอาหาร", d.feeding],
          ["การขับถ่าย", d.excretion],
          ["ข้อควรระวังพิเศษ", d.precautions],
        ]}
      />
      <InfoCard
        rows={[
          ["จำนวนสมาชิกในบ้าน", d.householdSize],
          ["รายได้ครัวเรือน", d.householdIncome],
          ["สวัสดิการ", d.welfare],
          ["ลักษณะสิ่งแวดล้อมบ้าน", d.homeEnvironment],
        ]}
      />
      <InfoCard rows={[["ปัญหาสุขภาพจิต/พฤติกรรมเสี่ยง", d.mentalHealth]]} />
    </>
  );
}

function Field({ label, value, color = TEXT_PRIMARY }: { label: string; value: string; color?: string }) {
  return (
    <View>
      <Text style={{ fontSize: 14, color: TEXT_MUTED }}>{label}</Text>
      <Text style={{ marginTop: SPACE.xs, fontSize: 16, fontWeight: "600", color }}>
        {value}
      </Text>
    </View>
  );
}

const Rule = () => (
  <View style={{ height: 1, backgroundColor: SEPARATOR, marginVertical: SPACE.md }} />
);

function InfoCard({ rows }: { rows: [string, string][] }) {
  return (
    <Card>
      {rows.map(([label, value], i) => (
        <View key={label}>
          {i > 0 && <Rule />}
          <Field label={label} value={value} />
        </View>
      ))}
    </Card>
  );
}

function VitalCell({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flex: 1 }}>
      <Field label={label} value={value} />
    </Card>
  );
}
