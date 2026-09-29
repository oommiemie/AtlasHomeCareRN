import { useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AlertTriangle, Briefcase, Gauge, Moon, Pill, Wind } from "lucide-react-native";

import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { tr } from "../i18n";
import { Progress, Question, type Icon } from "../components/AssessmentUI";
import { Card } from "../components/Card";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import { saveAssessment, type Tone } from "../models/assessments";
import { ACT, ACT_MAX, actResult } from "../models/asthma";
import {
  DANGER,
  SEPARATOR,
  SPACE,
  SUCCESS,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  WARNING,
} from "../theme/tokens";
import { FORM_MAX, readable, GUTTER } from "../theme/layout";

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Read as it renders: applyTheme runs inside App's render, after every
// screen module body, so a token in a module const keeps the light
// palette it was imported under.
const TONE_INK = (): Record<Tone, string> => ({ good: SUCCESS, warn: WARNING, bad: DANGER });
const ICONS: Icon[] = [Briefcase, Wind, Moon, Pill, Gauge];
const TURN_MS = 240;
const LAST = ACT.length; // the result page

/**
 * tr("แบบประเมินผู้ป่วยหอบหืด", "Asthma assessment") — the ACT, one question to a page.
 *
 * Five pages of one question each, the page turning itself when an answer
 * is tapped; then the total out of twenty-five read against the bands, with
 * the answers that are alarms on their own called out beside it.
 */
export function AsthmaScreen() {
  const { holder } = useRoute<RouteProp<RootStackParamList, "Asthma">>().params;
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<(string | undefined)[]>(() => ACT.map(() => undefined));
  const points = useMemo(
    () => answers.map((a, i) => (a == null ? null : ACT[i].options.indexOf(a) + 1)),
    [answers],
  );
  const result = useMemo(() => actResult(points), [points]);

  const turning = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answer = (i: number, v: string) => {
    setAnswers((cur) => cur.map((a, j) => (j === i ? v : a)));
    if (turning.current != null) clearTimeout(turning.current);
    turning.current = setTimeout(() => {
      turning.current = null;
      setStep((s) => Math.min(s + 1, LAST));
    }, TURN_MS);
  };

  const back = () => (step === 0 ? nav.goBack() : setStep((s) => s - 1));
  const save = () => {
    saveAssessment(holder.authenCode, {
      form: "asthma",
      badge: result.label,
      tone: result.tone,
      result: `ACT ${result.total}/${ACT_MAX} · ${result.label}`,
      advice: result.advice,
      score: String(result.total),
      level: result.level,
      ...Object.fromEntries(ACT.map((q, i) => [`ข้อ ${i + 1} ${q.short}`, answers[i] ?? ""])),
    });
    if (result.tone === "good") toast(tr("บันทึกผลการประเมินแล้ว", "Assessment saved"), "success");
    else toast(tr(`บันทึกแล้ว · ${result.label}`, `Saved · ${result.label}`), "warning");
    nav.goBack();
  };

  const ink = TONE_INK()[result.tone];

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title={step === LAST ? tr("สรุปผลการประเมิน", "Assessment summary") : tr("แบบประเมินผู้ป่วยหอบหืด", "Asthma assessment")}
        onBack={back}
        below={
          <Progress
            value={step / LAST}
            caption={
              step === LAST ? "" : tr(`ข้อ ${step + 1} / ${ACT.length}`, `Question ${step + 1} / ${ACT.length}`)
            }
          />
        }
      />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            ...readable(FORM_MAX),
            paddingHorizontal: GUTTER,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + 100,
            gap: SPACE.md,
          }}
          showsVerticalScrollIndicator={false}
        >
          {step < LAST && (
            <Question
              icon={ICONS[step]}
              lead={tr("Asthma Control Test (ACT) · ตอบตามอาการในช่วง 4 สัปดาห์ที่ผ่านมา", "Asthma Control Test (ACT) · Answer for the past 4 weeks")}
              text={ACT[step].text}
              options={ACT[step].options}
              value={answers[step]}
              onChange={(v) => answer(step, v)}
            />
          )}

          {step === LAST && (
            <>
              <Card style={{ gap: SPACE.sm }}>
                <Text style={{ fontSize: 12, lineHeight: 16, color: TEXT_MUTED }}>
                  {tr("คะแนน Asthma Control Test", "Asthma Control Test score")}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: SPACE.sm }}>
                  <Text style={{ fontSize: 44, lineHeight: 50, fontWeight: "800", color: ink }}>
                    {result.total}
                  </Text>
                  <Text style={{ fontSize: 14, color: TEXT_MUTED }}>{`/ ${ACT_MAX}`}</Text>
                  <View style={{ flex: 1 }} />
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: `${ink}1A`,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: ink }}>{result.label}</Text>
                  </View>
                </View>
                {!result.complete && (
                  <Text style={{ fontSize: 12, lineHeight: 18, color: WARNING }}>
                    {tr("ยังตอบไม่ครบทุกข้อ คะแนนรวมคิดจากข้อที่ตอบแล้ว", "Not every question is answered; the total counts only the answered ones.")}
                  </Text>
                )}
              </Card>

              {/* Each answer and what it scored — the total, unrolled. */}
              <Card style={{ gap: SPACE.sm }}>
                {ACT.map((q, i) => (
                  <View key={q.short}>
                    {i > 0 && <View style={{ height: 1, backgroundColor: SEPARATOR, marginBottom: SPACE.sm }} />}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
                      <View style={{ flex: 1, gap: 1 }}>
                        <Text style={{ fontSize: 12, color: TEXT_MUTED }}>{q.short}</Text>
                        <Text style={{ fontSize: 14, color: answers[i] != null ? TEXT_PRIMARY : TEXT_MUTED }}>
                          {answers[i] ?? tr("ยังไม่ตอบ", "Not answered")}
                        </Text>
                      </View>
                      <Text
                        style={{
                          width: 28,
                          textAlign: "right",
                          fontSize: 14,
                          fontWeight: "700",
                          color: points[i] == null ? TEXT_MUTED : points[i]! <= 2 ? DANGER : TEXT_PRIMARY,
                        }}
                      >
                        {points[i] ?? "–"}
                      </Text>
                    </View>
                  </View>
                ))}
              </Card>

              <Card style={{ gap: SPACE.xs }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: TEXT_MUTED, letterSpacing: 0.4 }}>
                  {tr("ข้อแนะนำ", "Recommendations")}
                </Text>
                <Text style={{ fontSize: 15, lineHeight: 23, color: TEXT_PRIMARY }}>{result.advice}</Text>
              </Card>

              {result.flags.length > 0 && (
                <Card style={{ flexDirection: "row", gap: SPACE.md, alignItems: "flex-start" }}>
                  <AlertTriangle size={18} color={DANGER} strokeWidth={2.2} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: TEXT_PRIMARY }}>
                      {tr("สัญญาณเสี่ยงกำเริบ", "Exacerbation warning signs")}
                    </Text>
                    {result.flags.map((f) => (
                      <Text key={f} style={{ fontSize: 14, lineHeight: 21, color: TEXT_SECONDARY }}>
                        {f}
                      </Text>
                    ))}
                  </View>
                </Card>
              )}
            </>
          )}
        </ScrollView>
      </HeaderFade>

      <ActionBar>
        <PrimaryAction
          label={step === LAST ? tr("บันทึกผลการประเมิน", "Save assessment") : tr("ถัดไป", "Next")}
          onPress={step === LAST ? save : () => setStep((s) => Math.min(s + 1, LAST))}
        />
      </ActionBar>
    </View>
  );
}
