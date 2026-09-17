import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AlertTriangle } from "lucide-react-native";

import { ActionBar, PrimaryAction } from "../components/ActionBar";
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
  GROUPED_BG,
  PRIMARY_500,
  RADIUS,
  SPACE,
  SUCCESS,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  WARNING,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Read as it renders: a module const would capture whichever palette
// was loaded at import and keep it through every theme change.
const TONE_INK = (): Record<Tone, string> => ({ good: SUCCESS, warn: WARNING, bad: DANGER });

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
    if (hypo === "มี") flags.push("มีอาการน้ำตาลต่ำในเดือนที่ผ่านมา");
    if (foot === "มี") flags.push("มีแผลที่เท้า");
    if (adherence === "ไม่ได้กินยา") flags.push("ไม่ได้กินยา");
    else if (adherence === "กินยาไม่สม่ำเสมอ") flags.push("กินยาไม่สม่ำเสมอ");
    if (smoke === "สูบ") flags.push("สูบบุหรี่");

    const worst = (...t: (Tone | null)[]): Tone => {
      const known = t.filter((x): x is Tone => x != null);
      if (known.includes("bad")) return "bad";
      if (known.includes("warn")) return "warn";
      return "good";
    };
    let tone = worst(sugar, bp, lipid);
    if (hypo === "มี" || foot === "มี" || adherence === "ไม่ได้กินยา") tone = "bad";

    const label = (t: Tone | null) => (t == null ? "ไม่ได้วัด" : t === "good" ? "ควบคุมได้" : t === "warn" ? "ยังไม่ถึงเป้า" : "ควบคุมไม่ได้");
    const badge =
      sugar === "good" && bp === "good" ? "ควบคุมได้" : tone === "bad" ? "ควบคุมไม่ได้" : "ควบคุมได้บางส่วน";

    const parts = [`น้ำตาล ${label(sugar)}`, `ความดัน ${label(bp)}`];
    if (lipid != null) parts.push(`ไขมัน ${label(lipid)}`);

    const lines: string[] = [];
    if (sugar === "bad") lines.push("น้ำตาลควบคุมไม่ได้ ส่งพบแพทย์ปรับยา");
    else if (sugar === "warn") lines.push("น้ำตาลยังไม่ถึงเป้า (HbA1c < 7% / FBS 80–130) ทบทวนอาหารและยา นัดติดตาม 1–3 เดือน");
    if (bp === "bad") lines.push("ความดันสูงมาก (≥160/100) วัดซ้ำและส่งพบแพทย์วันนี้");
    else if (bp === "warn") lines.push("ความดันยังไม่ถึงเป้า (< 140/90) ลดเค็ม ปรับยาตามแพทย์ วัดที่บ้านต่อเนื่อง");
    if (lipid === "bad" || lipid === "warn") lines.push("LDL ยังไม่ถึงเป้า (< 100) ทบทวนยาลดไขมันและอาหาร");
    if (hypo === "มี") lines.push("มีน้ำตาลต่ำ ทบทวนยาและมื้ออาหาร สอนการแก้ไขน้ำตาลต่ำ แจ้งแพทย์");
    if (foot === "มี") lines.push("มีแผลที่เท้า ส่งต่อคลินิกเท้าเบาหวาน/แพทย์ภายใน 1 สัปดาห์");
    if (adherence === "ไม่ได้กินยา" || adherence === "กินยาไม่สม่ำเสมอ") lines.push("หาสาเหตุที่ไม่ได้กินยา จัดกล่องยา/ผู้ช่วยเตือน และให้ความรู้");
    if (smoke === "สูบ") lines.push("แนะนำเลิกบุหรี่และส่งต่อคลินิกเลิกบุหรี่");
    if (lines.length === 0) lines.push("ควบคุมได้ตามเป้าหมาย คงยาและพฤติกรรมเดิม ติดตามตามนัด ตรวจ HbA1c ทุก 3–6 เดือน");

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
    toast("บันทึกผลการประเมินแล้ว", "success");
    nav.goBack();
  };

  const back = () => (step === 0 ? nav.goBack() : setStep(0));
  const ink = TONE_INK()[r.tone];

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title={step === 0 ? "ติดตามเบาหวาน / ความดัน" : "สรุปผลการประเมิน"}
        onBack={back}
        below={<Progress value={step === 0 ? 0.5 : 1} caption="" />}
      />

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <HeaderFade from={0} to={HEADER_FADE}>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: SPACE.lg,
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
                    {"ค่าจากคัดกรองสุขภาพถูกดึงมาให้แล้ว แก้ได้หากมีผลใหม่ · เป้าหมาย: HbA1c < 7% · FBS 80–130 · ความดัน < 140/90 · LDL < 100"}
                  </Text>
                  <TextField
                    label="น้ำตาลหลังงดอาหาร (FBS)"
                    value={fbs}
                    onChangeText={(v) => setFbs(v.replace(/[^0-9]/g, ""))}
                    keyboardType="number-pad"
                    placeholder="110"
                    maxLength={3}
                    trailing={<Unit>mg/dL</Unit>}
                  />
                  <TextField
                    label="น้ำตาลสะสม (HbA1c)"
                    value={a1c}
                    onChangeText={(v) => setA1c(v.replace(/[^0-9.]/g, ""))}
                    keyboardType="decimal-pad"
                    placeholder="6.8"
                    maxLength={4}
                    trailing={<Unit>%</Unit>}
                  />
                  <PairField
                    label="ความดันโลหิต"
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
                    label="ไขมัน LDL (ถ้ามีผล)"
                    value={ldl}
                    onChangeText={(v) => setLdl(v.replace(/[^0-9]/g, ""))}
                    keyboardType="number-pad"
                    placeholder="95"
                    maxLength={3}
                    trailing={<Unit>mg/dL</Unit>}
                  />
                </Card>

                <Card style={{ gap: SPACE.lg }}>
                  <Choose label="การกินยา" options={["กินยาสม่ำเสมอ", "กินยาไม่สม่ำเสมอ", "ไม่ได้กินยา"]} value={adherence} onChange={setAdherence} />
                  <Choose label="อาการน้ำตาลต่ำ (ใจสั่น เหงื่อออก หน้ามืด) ในเดือนที่ผ่านมา" options={["ไม่มี", "มี"]} value={hypo} onChange={setHypo} />
                  <Choose label="แผลที่เท้า" options={["ไม่มี", "มี"]} value={foot} onChange={setFoot} />
                  <Choose label="สูบบุหรี่" options={["ไม่สูบ", "สูบ"]} value={smoke} onChange={setSmoke} />
                </Card>
              </>
            )}

            {step === 1 && (
              <>
                <Card style={{ gap: SPACE.sm }}>
                  <Text style={{ fontSize: 12, lineHeight: 16, color: TEXT_MUTED }}>การควบคุมโรค</Text>
                  <Text style={{ fontSize: 28, lineHeight: 34, fontWeight: "800", color: ink }}>{r.badge}</Text>
                  <Text style={{ fontSize: 14, lineHeight: 21, color: TEXT_SECONDARY }}>{r.result}</Text>
                </Card>

                <View style={{ flexDirection: "row", gap: SPACE.md }}>
                  <Tile label="น้ำตาล" value={a1c ? `HbA1c ${a1c}%` : fbs ? `FBS ${fbs}` : "ไม่ได้วัด"} sub={r.label(r.sugar)} tone={r.sugar} />
                  <Tile label="ความดัน" value={sbp && dbp ? `${sbp}/${dbp}` : "ไม่ได้วัด"} sub={r.label(r.bp)} tone={r.bp} />
                </View>

                <Card style={{ gap: SPACE.xs }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: TEXT_MUTED, letterSpacing: 0.4 }}>ข้อแนะนำ</Text>
                  <Text style={{ fontSize: 15, lineHeight: 23, color: TEXT_PRIMARY }}>{r.advice}</Text>
                </Card>

                {r.flags.length > 0 && (
                  <Card style={{ flexDirection: "row", gap: SPACE.md, alignItems: "flex-start" }}>
                    <AlertTriangle size={18} color={DANGER} strokeWidth={2.2} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: TEXT_PRIMARY }}>สิ่งที่ต้องจัดการ</Text>
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
          label={step === 0 ? "ดูผลการประเมิน" : "บันทึกผลการประเมิน"}
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
            <Pressable
              key={o}
              onPress={() => onChange(on ? null : o)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={{
                flexGrow: 1,
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: SPACE.md,
                borderRadius: RADIUS.capsule,
                backgroundColor: on ? PRIMARY_500 : GROUPED_BG,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: on ? "600" : "400", color: on ? "#FFFFFF" : TEXT_PRIMARY }}>{o}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
