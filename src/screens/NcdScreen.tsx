import { useMemo, useState } from "react";
import { KeyboardAvoidingView, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AlertTriangle } from "lucide-react-native";

import { ChoiceChip } from "../components/ChoiceChip";
import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { tr } from "../i18n";
import { Progress } from "../components/AssessmentUI";
import { Card } from "../components/Card";
import { PairField, TextField } from "../components/FormField";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import { saveAssessment, type Tone } from "../models/assessments";
import { recordOf } from "../models/community";
import {
  DANGER,
  SPACE,
  SUCCESS,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  WARNING,
} from "../theme/tokens";
import { FORM_MAX, readable, GUTTER } from "../theme/layout";

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Read as it renders: a module const would capture whichever palette
// was loaded at import and keep it through every theme change.
const TONE_INK = (): Record<Tone, string> => ({ good: SUCCESS, warn: WARNING, bad: DANGER });

// The answers are compared and saved as the Thai words below; only what
// the chips say changes with the language.
const OPT_LABEL: Record<string, string> = {
  กินยาสม่ำเสมอ: "Takes regularly",
  กินยาไม่สม่ำเสมอ: "Takes irregularly",
  ไม่ได้กินยา: "Not taking",
  ไม่มี: "No",
  มี: "Yes",
  ไม่สูบ: "Non-smoker",
  สูบ: "Smoker",
};
const optLabel = (o: string) => tr(o, OPT_LABEL[o] ?? o);

/**
 * "แบบประเมินผู้ป่วยเบาหวานความดัน" — a follow-up, not a screening.
 *
 * The person already has the diagnosis; the question is whether it is
 * controlled, read against the targets the Thai guidelines set: HbA1c under
 * 7% (or fasting sugar 80–130 mg/dL where there is no A1c), blood pressure
 * under 140/90 (130/80 the goal where tolerated), LDL under 100. The rest
 * of the form is what a carer can find out in the room that changes the
 * advice — whether the tablets are being taken, whether there have been
 * lows, whether there is a wound on a foot, whether they smoke.
 *
 * Sources: แนวทางเวชปฏิบัติสำหรับโรคเบาหวาน 2566 (สมาคมโรคเบาหวานฯ);
 * แนวทางการรักษาโรคความดันโลหิตสูง 2562 (สมาคมความดันโลหิตสูงฯ).
 */
export function NcdScreen() {
  const { holder } = useRoute<RouteProp<RootStackParamList, "Ncd">>().params;
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();

  // The screening's pressure and sugar, carried in.
  const prior = recordOf(holder.authenCode, "screening");
  const [sbp0 = "", dbp0 = ""] = (prior.bp ?? "").split("/").map((s) => s.trim());

  const [step, setStep] = useState(0);
  const [fbs, setFbs] = useState(prior.glucose ?? "");
  const [a1c, setA1c] = useState("");
  const [sbp, setSbp] = useState(sbp0);
  const [dbp, setDbp] = useState(dbp0);
  const [ldl, setLdl] = useState("");
  const [adherence, setAdherence] = useState<string | null>(null);
  const [hypo, setHypo] = useState<string | null>(null);
  const [foot, setFoot] = useState<string | null>(null);
  const [smoke, setSmoke] = useState<string | null>(null);

  const r = useMemo(() => {
    const n = (s: string) => (s.trim() === "" || !Number.isFinite(Number(s)) ? null : Number(s));
    const vA1c = n(a1c);
    const vFbs = n(fbs);
    const vS = n(sbp);
    const vD = n(dbp);
    const vLdl = n(ldl);

    // Sugar: A1c decides where there is one; the fasting figure otherwise.
    const sugar: Tone | null =
      vA1c != null
        ? vA1c < 7
          ? "good"
          : vA1c < 9
            ? "warn"
            : "bad"
        : vFbs != null
          ? vFbs >= 80 && vFbs <= 130
            ? "good"
            : vFbs < 70 || vFbs >= 250
              ? "bad"
              : "warn"
          : null;
    const bp: Tone | null =
      vS != null && vD != null
        ? vS < 140 && vD < 90
          ? "good"
          : vS >= 160 || vD >= 100
            ? "bad"
            : "warn"
        : null;
    const lipid: Tone | null = vLdl == null ? null : vLdl < 100 ? "good" : vLdl < 130 ? "warn" : "bad";

    const flags: string[] = [];
    if (hypo === "มี") flags.push(tr("มีอาการน้ำตาลต่ำในเดือนที่ผ่านมา", "Hypoglycemia in the past month"));
    if (foot === "มี") flags.push(tr("มีแผลที่เท้า", "Foot ulcer present"));
    if (adherence === "ไม่ได้กินยา") flags.push(optLabel("ไม่ได้กินยา"));
    else if (adherence === "กินยาไม่สม่ำเสมอ") flags.push(optLabel("กินยาไม่สม่ำเสมอ"));
    if (smoke === "สูบ") flags.push(tr("สูบบุหรี่", "Smokes"));

    const worst = (...t: (Tone | null)[]): Tone => {
      const known = t.filter((x): x is Tone => x != null);
      if (known.includes("bad")) return "bad";
      if (known.includes("warn")) return "warn";
      return "good";
    };
    let tone = worst(sugar, bp, lipid);
    if (hypo === "มี" || foot === "มี" || adherence === "ไม่ได้กินยา") tone = "bad";

    const label = (t: Tone | null) => (t == null ? tr("ไม่ได้วัด", "Not measured") : t === "good" ? tr("ควบคุมได้", "Controlled") : t === "warn" ? tr("ยังไม่ถึงเป้า", "Not at target") : tr("ควบคุมไม่ได้", "Uncontrolled"));
    const badge =
      sugar === "good" && bp === "good" ? tr("ควบคุมได้", "Controlled") : tone === "bad" ? tr("ควบคุมไม่ได้", "Uncontrolled") : tr("ควบคุมได้บางส่วน", "Partly controlled");

    const parts = [`${tr("น้ำตาล", "Glucose")} ${label(sugar)}`, `${tr("ความดัน", "BP")} ${label(bp)}`];
    if (lipid != null) parts.push(`${tr("ไขมัน", "Lipids")} ${label(lipid)}`);

    const lines: string[] = [];
    if (sugar === "bad") lines.push(tr("น้ำตาลควบคุมไม่ได้ ส่งพบแพทย์ปรับยา", "Glucose uncontrolled: refer to a physician to adjust medication"));
    else if (sugar === "warn") lines.push(tr("น้ำตาลยังไม่ถึงเป้า (HbA1c < 7% / FBS 80–130) ทบทวนอาหารและยา นัดติดตาม 1–3 เดือน", "Glucose not at target (HbA1c < 7% / FBS 80–130): review diet and medication, follow up in 1–3 months"));
    if (bp === "bad") lines.push(tr("ความดันสูงมาก (≥160/100) วัดซ้ำและส่งพบแพทย์วันนี้", "BP very high (≥160/100): recheck and refer to a physician today"));
    else if (bp === "warn") lines.push(tr("ความดันยังไม่ถึงเป้า (< 140/90) ลดเค็ม ปรับยาตามแพทย์ วัดที่บ้านต่อเนื่อง", "BP not at target (< 140/90): cut salt, adjust medication per physician, keep monitoring at home"));
    if (lipid === "bad" || lipid === "warn") lines.push(tr("LDL ยังไม่ถึงเป้า (< 100) ทบทวนยาลดไขมันและอาหาร", "LDL not at target (< 100): review lipid-lowering medication and diet"));
    if (hypo === "มี") lines.push(tr("มีน้ำตาลต่ำ ทบทวนยาและมื้ออาหาร สอนการแก้ไขน้ำตาลต่ำ แจ้งแพทย์", "Hypoglycemia: review medication and meals, teach how to treat lows, inform the physician"));
    if (foot === "มี") lines.push(tr("มีแผลที่เท้า ส่งต่อคลินิกเท้าเบาหวาน/แพทย์ภายใน 1 สัปดาห์", "Foot ulcer: refer to the diabetic foot clinic / physician within 1 week"));
    if (adherence === "ไม่ได้กินยา" || adherence === "กินยาไม่สม่ำเสมอ") lines.push(tr("หาสาเหตุที่ไม่ได้กินยา จัดกล่องยา/ผู้ช่วยเตือน และให้ความรู้", "Find out why medication is missed, set up a pill box / reminder helper, and educate"));
    if (smoke === "สูบ") lines.push(tr("แนะนำเลิกบุหรี่และส่งต่อคลินิกเลิกบุหรี่", "Advise quitting smoking and refer to a smoking cessation clinic"));
    if (lines.length === 0) lines.push(tr("ควบคุมได้ตามเป้าหมาย คงยาและพฤติกรรมเดิม ติดตามตามนัด ตรวจ HbA1c ทุก 3–6 เดือน", "At target. Continue current medication and habits, follow up as scheduled, HbA1c every 3–6 months"));

    return { sugar, bp, lipid, tone, badge, result: parts.join(" · "), flags, advice: lines.join(" · "), label };
  }, [fbs, a1c, sbp, dbp, ldl, adherence, hypo, foot, smoke]);

  const save = () => {
    saveAssessment(holder.authenCode, {
      form: "ncd",
      badge: r.badge,
      tone: r.tone,
      result: r.result,
      advice: r.advice,
      score: "",
      FBS: fbs,
      HbA1c: a1c,
      ความดัน: sbp && dbp ? `${sbp}/${dbp}` : "",
      LDL: ldl,
      การกินยา: adherence ?? "",
      น้ำตาลต่ำ: hypo ?? "",
      แผลที่เท้า: foot ?? "",
      บุหรี่: smoke ?? "",
    });
    if (r.tone === "good") toast(tr("บันทึกผลการประเมินแล้ว", "Assessment saved"), "success");
    else toast(tr(`บันทึกแล้ว · ${r.badge}`, `Saved · ${r.badge}`), "warning");
    nav.goBack();
  };

  const back = () => (step === 0 ? nav.goBack() : setStep(0));
  const ink = TONE_INK()[r.tone];

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title={step === 0 ? tr("ติดตามเบาหวาน / ความดัน", "Diabetes / hypertension follow-up") : tr("สรุปผลการประเมิน", "Assessment summary")}
        onBack={back}
        below={<Progress value={step === 0 ? 0.5 : 1} caption="" />}
      />

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <HeaderFade from={0} to={HEADER_FADE}>
          <ScrollView
            contentContainerStyle={{
              ...readable(FORM_MAX),
              paddingHorizontal: GUTTER,
              paddingTop: HEADER_FADE,
              paddingBottom: insets.bottom + 100,
              gap: SPACE.md,
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {step === 0 && (
              <>
                <Card style={{ gap: SPACE.lg }}>
                  {/* A string, not bare JSX text: the targets carry "<",
                      which JSX would read as a tag. */}
                  <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
                    {tr("ค่าจากคัดกรองสุขภาพถูกดึงมาให้แล้ว แก้ได้หากมีผลใหม่ · เป้าหมาย: HbA1c < 7% · FBS 80–130 · ความดัน < 140/90 · LDL < 100", "Values from the health screening are filled in; edit if there are newer results · Targets: HbA1c < 7% · FBS 80–130 · BP < 140/90 · LDL < 100")}
                  </Text>
                  <TextField
                    label={tr("น้ำตาลหลังงดอาหาร (FBS)", "Fasting blood glucose (FBS)")}
                    value={fbs}
                    onChangeText={(v) => setFbs(v.replace(/[^0-9]/g, ""))}
                    keyboardType="number-pad"
                    placeholder="110"
                    maxLength={3}
                    trailing={<Unit>mg/dL</Unit>}
                  />
                  <TextField
                    label={tr("น้ำตาลสะสม (HbA1c)", "HbA1c")}
                    value={a1c}
                    onChangeText={(v) => setA1c(v.replace(/[^0-9.]/g, ""))}
                    keyboardType="decimal-pad"
                    placeholder="6.8"
                    maxLength={4}
                    trailing={<Unit>%</Unit>}
                  />
                  <PairField
                    label={tr("ความดันโลหิต", "Blood pressure")}
                    first={sbp}
                    second={dbp}
                    onChange={(a, b) => {
                      setSbp(a);
                      setDbp(b);
                    }}
                    hints={["120", "80"]}
                    trailing={<Unit>mmHg</Unit>}
                  />
                  <TextField
                    label={tr("ไขมัน LDL (ถ้ามีผล)", "LDL cholesterol (if available)")}
                    value={ldl}
                    onChangeText={(v) => setLdl(v.replace(/[^0-9]/g, ""))}
                    keyboardType="number-pad"
                    placeholder="95"
                    maxLength={3}
                    trailing={<Unit>mg/dL</Unit>}
                  />
                </Card>

                <Card style={{ gap: SPACE.lg }}>
                  <Choose label={tr("การกินยา", "Medication adherence")} options={["กินยาสม่ำเสมอ", "กินยาไม่สม่ำเสมอ", "ไม่ได้กินยา"]} value={adherence} onChange={setAdherence} />
                  <Choose label={tr("อาการน้ำตาลต่ำ (ใจสั่น เหงื่อออก หน้ามืด) ในเดือนที่ผ่านมา", "Hypoglycemia symptoms (palpitations, sweating, faintness) in the past month")} options={["ไม่มี", "มี"]} value={hypo} onChange={setHypo} />
                  <Choose label={tr("แผลที่เท้า", "Foot ulcer")} options={["ไม่มี", "มี"]} value={foot} onChange={setFoot} />
                  <Choose label={tr("สูบบุหรี่", "Smoking")} options={["ไม่สูบ", "สูบ"]} value={smoke} onChange={setSmoke} />
                </Card>
              </>
            )}

            {step === 1 && (
              <>
                <Card style={{ gap: SPACE.sm }}>
                  <Text style={{ fontSize: 12, lineHeight: 16, color: TEXT_MUTED }}>{tr("การควบคุมโรค", "Disease control")}</Text>
                  <Text style={{ fontSize: 28, lineHeight: 34, fontWeight: "800", color: ink }}>{r.badge}</Text>
                  <Text style={{ fontSize: 14, lineHeight: 21, color: TEXT_SECONDARY }}>{r.result}</Text>
                </Card>

                <View style={{ flexDirection: "row", gap: SPACE.md }}>
                  <Tile label={tr("น้ำตาล", "Glucose")} value={a1c ? `HbA1c ${a1c}%` : fbs ? `FBS ${fbs}` : tr("ไม่ได้วัด", "Not measured")} sub={r.label(r.sugar)} tone={r.sugar} />
                  <Tile label={tr("ความดัน", "BP")} value={sbp && dbp ? `${sbp}/${dbp}` : tr("ไม่ได้วัด", "Not measured")} sub={r.label(r.bp)} tone={r.bp} />
                </View>

                <Card style={{ gap: SPACE.xs }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: TEXT_MUTED, letterSpacing: 0.4 }}>{tr("ข้อแนะนำ", "Recommendations")}</Text>
                  <Text style={{ fontSize: 15, lineHeight: 23, color: TEXT_PRIMARY }}>{r.advice}</Text>
                </Card>

                {r.flags.length > 0 && (
                  <Card style={{ flexDirection: "row", gap: SPACE.md, alignItems: "flex-start" }}>
                    <AlertTriangle size={18} color={DANGER} strokeWidth={2.2} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: TEXT_PRIMARY }}>{tr("สิ่งที่ต้องจัดการ", "Needs attention")}</Text>
                      {r.flags.map((f) => (
                        <Text key={f} style={{ fontSize: 14, lineHeight: 21, color: TEXT_SECONDARY }}>{f}</Text>
                      ))}
                    </View>
                  </Card>
                )}
              </>
            )}
          </ScrollView>
        </HeaderFade>
      </KeyboardAvoidingView>

      <ActionBar>
        <PrimaryAction
          label={step === 0 ? tr("ดูผลการประเมิน", "View result") : tr("บันทึกผลการประเมิน", "Save assessment")}
          onPress={step === 0 ? () => setStep(1) : save}
        />
      </ActionBar>
    </View>
  );
}

function Unit({ children }: { children: string }) {
  return <Text style={{ fontSize: 14, color: TEXT_MUTED }}>{children}</Text>;
}

/** One reading, its figure and whether it is at target. */
function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: Tone | null }) {
  const ink = tone == null ? TEXT_MUTED : TONE_INK()[tone];
  return (
    <Card style={{ flex: 1, gap: 2 }}>
      <Text style={{ fontSize: 12, color: TEXT_MUTED }}>{label}</Text>
      <Text style={{ fontSize: 18, lineHeight: 24, fontWeight: "800", color: TEXT_PRIMARY }}>{value}</Text>
      <Text style={{ fontSize: 13, fontWeight: "700", color: ink }}>{sub}</Text>
    </Card>
  );
}

/** One of a few, as capsules — with a label like every other field. */
function Choose({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <View style={{ gap: SPACE.sm }}>
      <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
        {options.map((o) => {
          const on = value === o;
          return (
            <ChoiceChip
              key={o}
              label={optLabel(o)}
              on={on}
              onPress={() => onChange(on ? null : o)}
              style={{ flexGrow: 1 }}
              contentStyle={{ minHeight: 44, paddingHorizontal: SPACE.md, paddingVertical: 0 }}
            />
          );
        })}
      </View>
    </View>
  );
}
