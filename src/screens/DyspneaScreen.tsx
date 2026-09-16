import { useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AlertTriangle, Waves } from "lucide-react-native";

import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { Progress, Question } from "../components/AssessmentUI";
import { Card } from "../components/Card";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import { saveAssessment, type Tone } from "../models/assessments";
import { recordOf } from "../models/community";
import { MMRC, dyspneaResult } from "../models/dyspnea";
import {
  DANGER,
  SPACE,
  SUCCESS,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  WARNING,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TONE_INK: Record<Tone, string> = { good: SUCCESS, warn: WARNING, bad: DANGER };
const OPTIONS = MMRC.map((m) => `ระดับ ${m.grade} · ${m.text}`);
const TURN_MS = 240;

/**
 * "แบบประเมินผู้ป่วยหายใจลำบาก" — the mMRC scale, on two pages.
 *
 * One question — which of the five sentences is you — and then the grade
 * read against the guideline's line at 2, with the oxygen the screening
 * took shown beside it, since a low saturation matters whatever the grade.
 */
export function DyspneaScreen() {
  const { holder } = useRoute<RouteProp<RootStackParamList, "Dyspnea">>().params;
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();

  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<string | undefined>();
  const grade = choice == null ? null : OPTIONS.indexOf(choice);

  // What the screening measured, carried in rather than asked again.
  const prior = recordOf(holder.authenCode, "screening");
  const spo2 = prior.spo2 != null && prior.spo2.trim() !== "" ? Number(prior.spo2) : null;
  const pulse = prior.pulse != null && prior.pulse.trim() !== "" ? Number(prior.pulse) : null;

  const result = useMemo(
    () => (grade == null || grade < 0 ? null : dyspneaResult(grade, spo2)),
    [grade, spo2],
  );

  const turning = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pick = (v: string) => {
    setChoice(v);
    if (turning.current != null) clearTimeout(turning.current);
    turning.current = setTimeout(() => {
      turning.current = null;
      setStep(1);
    }, TURN_MS);
  };

  const back = () => (step === 0 ? nav.goBack() : setStep(0));
  const save = () => {
    if (result == null) return;
    saveAssessment(holder.authenCode, {
      form: "dyspnea",
      badge: `mMRC ${result.grade}`,
      tone: result.tone,
      result: `mMRC ${result.grade} · ${result.group}${spo2 != null ? ` · SpO₂ ${spo2}%` : ""}`,
      advice: result.advice,
      score: String(result.grade),
      grade: String(result.grade),
      group: result.group,
    });
    toast("บันทึกผลการประเมินแล้ว", "success");
    nav.goBack();
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title={step === 0 ? "ประเมินหายใจลำบาก" : "สรุปผลการประเมิน"}
        onBack={back}
        below={<Progress value={step === 0 ? 0.5 : 1} caption={step === 0 ? "ข้อ 1 / 1" : ""} />}
      />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: SPACE.lg,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + 100,
            gap: SPACE.md,
          }}
          showsVerticalScrollIndicator={false}
        >
          {step === 0 && (
            <>
              <Question
                icon={Waves}
                lead="แบบประเมินภาวะหายใจลำบาก mMRC · เลือกข้อที่ตรงกับท่านมากที่สุดเพียง 1 ข้อ"
                text="ท่านรู้สึกหายใจหอบ หรือหายใจลำบาก ในระดับใด"
                options={OPTIONS}
                value={choice}
                onChange={pick}
              />
            </>
          )}

          {step === 1 && result != null && (
            <>
              <Card style={{ gap: SPACE.sm }}>
                <Text style={{ fontSize: 12, lineHeight: 16, color: TEXT_MUTED }}>
                  ระดับความรุนแรง mMRC
                </Text>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: SPACE.sm }}>
                  <Text style={{ fontSize: 44, lineHeight: 50, fontWeight: "800", color: TONE_INK[result.tone] }}>
                    {result.grade}
                  </Text>
                  <Text style={{ fontSize: 14, color: TEXT_MUTED }}>/ 4</Text>
                  <View style={{ flex: 1 }} />
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: `${TONE_INK[result.tone]}1A`,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: TONE_INK[result.tone] }}>
                      {result.group}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 14, lineHeight: 21, color: TEXT_SECONDARY }}>
                  {MMRC[result.grade].text}
                </Text>
              </Card>

              {(spo2 != null || pulse != null) && (
                <View style={{ flexDirection: "row", gap: SPACE.md }}>
                  <Tile
                    label="ออกซิเจนปลายนิ้ว"
                    value={spo2 != null ? `${spo2}%` : "ไม่ได้วัด"}
                    ink={spo2 != null && spo2 < 90 ? DANGER : spo2 != null && spo2 < 94 ? WARNING : TEXT_PRIMARY}
                  />
                  <Tile
                    label="ชีพจร"
                    value={pulse != null ? `${pulse} ครั้ง/นาที` : "ไม่ได้วัด"}
                    ink={TEXT_PRIMARY}
                  />
                </View>
              )}

              <Card style={{ gap: SPACE.xs }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: TEXT_MUTED, letterSpacing: 0.4 }}>
                  ข้อแนะนำ
                </Text>
                <Text style={{ fontSize: 15, lineHeight: 23, color: TEXT_PRIMARY }}>{result.advice}</Text>
              </Card>

              {result.lowOxygen && (
                <Card style={{ flexDirection: "row", gap: SPACE.md, alignItems: "flex-start" }}>
                  <AlertTriangle size={18} color={DANGER} strokeWidth={2.2} />
                  <Text style={{ flex: 1, fontSize: 14, lineHeight: 21, color: TEXT_PRIMARY }}>
                    ออกซิเจนต่ำกว่า 90% ต้องส่งต่อวันนี้ ไม่ว่าระดับ mMRC จะเป็นเท่าใด
                  </Text>
                </Card>
              )}
            </>
          )}
        </ScrollView>
      </HeaderFade>

      <ActionBar>
        <PrimaryAction
          label={step === 0 ? (choice == null ? "เลือกคำตอบ" : "ถัดไป") : "บันทึกผลการประเมิน"}
          disabled={choice == null}
          onPress={step === 0 ? () => setStep(1) : save}
        />
      </ActionBar>
    </View>
  );
}

/** One carried reading, big figure over a label. */
function Tile({ label, value, ink }: { label: string; value: string; ink: string }) {
  return (
    <Card style={{ flex: 1, gap: 4 }}>
      <Text style={{ fontSize: 12, color: TEXT_MUTED }}>{label}</Text>
      <Text style={{ fontSize: 18, lineHeight: 24, fontWeight: "800", color: ink }}>{value}</Text>
    </Card>
  );
}
