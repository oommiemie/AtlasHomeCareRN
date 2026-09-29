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
import { tr } from "../i18n";
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
          [tr("เหตุผลการเยี่ยม", "Reason for visit"), d.visitReason],
          [tr("วัตถุประสงค์การเยี่ยม", "Visit goals"), d.visitPurpose],
        ]}
      />
      {/* The condition in red, as the record page's own strip prints it. */}
      <Card>
        <Field label={tr("โรคประจำตัว", "Chronic conditions")} value={d.condition} color={DANGER_INK} />
        <Rule />
        <Field label={tr("ประวัติการแพ้ยา", "Drug allergies")} value={d.allergies} />
      </Card>

      {/* Weight and height on the left, the reading they produce on the
          right. The gauge is drawn at 168 rather than scaled, so its type
          stays at the app's own sizes. */}
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Field label={tr("น้ำหนัก", "Weight")} value={`${d.weightKg} kg`} />
            <Rule />
            <Field label={tr("ส่วนสูง", "Height")} value={`${d.heightCm} cm`} />
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
        <VitalCell label={tr("อุณหภูมิ", "Temperature")} value={d.temperatureC} />
        <VitalCell label={tr("ออกซิเจน", "Oxygen")} value={d.oxygenPercent} />
      </View>
      <View style={{ flexDirection: "row", gap: SPACE.md }}>
        <VitalCell label={tr("ความดัน", "Blood pressure")} value={d.bloodPressure} />
        <VitalCell label={tr("ชีพจร", "Pulse")} value={d.pulseBpm} />
      </View>

      <InfoCard rows={[[tr("การช่วยเหลือตัวเอง ADL", "Self-care (ADL)"), d.adl]]} />
      <InfoCard
        rows={[
          [tr("ผู้ดูแลหลัก", "Primary caregiver"), d.caregiverName],
          [tr("ความสัมพันธ์ผู้ดูแล", "Caregiver relationship"), d.caregiverRelation],
          [tr("ความพร้อมผู้ดูแล", "Caregiver readiness"), d.caregiverReadiness],
          [tr("เบอร์โทรศัพท์", "Phone number"), d.caregiverPhone],
        ]}
      />
      <InfoCard
        rows={[
          [tr("อุปกรณ์ทางการแพทย์", "Medical equipment"), d.equipment],
          [tr("การรับประทานอาหาร", "Feeding"), d.feeding],
          [tr("การขับถ่าย", "Elimination"), d.excretion],
          [tr("ข้อควรระวังพิเศษ", "Special precautions"), d.precautions],
        ]}
      />
      <InfoCard
        rows={[
          [tr("จำนวนสมาชิกในบ้าน", "Household members"), d.householdSize],
          [tr("รายได้ครัวเรือน", "Household income"), d.householdIncome],
          [tr("สวัสดิการ", "Benefits"), d.welfare],
          [tr("ลักษณะสิ่งแวดล้อมบ้าน", "Home environment"), d.homeEnvironment],
        ]}
      />
      <InfoCard rows={[[tr("ปัญหาสุขภาพจิต/พฤติกรรมเสี่ยง", "Mental health / risk behaviors"), d.mentalHealth]]} />
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
