import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Accessibility,
  Apple,
  ClipboardList,
  HandHeart,
  HeartHandshake,
  Home,
  LifeBuoy,
  ListChecks,
} from "lucide-react-native";

import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { Glyph, Progress, Question, type Icon } from "../components/AssessmentUI";
import { Card } from "../components/Card";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import { saveAssessment, type Tone } from "../models/assessments";
import { recordOf } from "../models/community";
import { QUESTIONNAIRES, type Item } from "../models/questionnaires";
import {
  DANGER,
  GROUPED_BG,
  SEPARATOR,
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
const ICONS: Record<string, Icon> = {
  barthel: Accessibility,
  adl: ListChecks,
  palliative: HandHeart,
  inhomesss: Home,
  crisis: LifeBuoy,
  esas: ClipboardList,
  homecare: HeartHandshake,
  mna: Apple,
};
const TURN_MS = 240;

/**
 * One screen for every data-driven form.
 *
 * Handed a form's key, it walks the spec's items one to a page — a choice
 * turns the page by itself, a 0–10 line waits for "ถัดไป" — then reads the
 * points into the spec's verdict, shows the total against its ceiling with
 * each answer unrolled under it, and saves the record the list and the
 * patient page read.
 */
export function QuestionnaireScreen() {
  const { holder, form } =
    useRoute<RouteProp<RootStackParamList, "Questionnaire">>().params;
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const spec = QUESTIONNAIRES[form];
  const icon = ICONS[form] ?? ClipboardList;
  const last = spec.items.length; // the result page

  const [step, setStep] = useState(0);
  // Option index per choice item, or the value per scale item.
  const [picked, setPicked] = useState<(number | null)[]>(() => {
    const seed = spec.prefill?.(recordOf(holder.authenCode, "screening")) ?? {};
    return spec.items.map((_, i) => seed[i] ?? null);
  });

  const points = useMemo(
    () =>
      picked.map((v, i) => {
        const it = spec.items[i];
        if (v == null) return null;
        return it.kind === "choice" ? it.options[v].points : v;
      }),
    [picked, spec],
  );
  const total = spec.total
    ? spec.total(points)
    : points.reduce<number>((s, v) => s + (v ?? 0), 0);
  const verdict = useMemo(() => spec.read(points), [points, spec]);
  const ink = TONE_INK()[verdict.tone];

  const turning = useRef<ReturnType<typeof setTimeout> | null>(null);
  const set = (i: number, v: number, turn: boolean) => {
    setPicked((cur) => cur.map((x, j) => (j === i ? v : x)));
    if (!turn) return;
    if (turning.current != null) clearTimeout(turning.current);
    turning.current = setTimeout(() => {
      turning.current = null;
      setStep((s) => Math.min(s + 1, last));
    }, TURN_MS);
  };

  const back = () => (step === 0 ? nav.goBack() : setStep((s) => s - 1));
  const save = () => {
    const answers = Object.fromEntries(
      spec.items.map((it, i) => {
        const v = picked[i];
        const text =
          v == null ? "" : it.kind === "choice" ? it.options[v].label : String(v);
        return [`ข้อ ${i + 1} ${it.short}`, text];
      }),
    );
    saveAssessment(holder.authenCode, {
      form: spec.key,
      badge: verdict.badge,
      tone: verdict.tone,
      result: verdict.result,
      advice: verdict.advice,
      score: String(total),
      max: String(spec.max),
      ...answers,
    });
    toast("บันทึกผลการประเมินแล้ว", "success");
    nav.goBack();
  };

  const item: Item | undefined = spec.items[step];

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title={step === last ? "สรุปผลการประเมิน" : spec.title}
        onBack={back}
        below={
          <Progress
            value={step / last}
            caption={step === last ? "" : `ข้อ ${step + 1} / ${spec.items.length}`}
          />
        }
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
          {item?.kind === "choice" && (
            <Question
              icon={icon}
              lead={spec.lead}
              text={item.text}
              options={item.options.map((o) => o.label)}
              value={picked[step] == null ? undefined : item.options[picked[step]!].label}
              onChange={(label) =>
                set(step, item.options.findIndex((o) => o.label === label), true)
              }
            />
          )}

          {item?.kind === "scale" && (
            <ScaleQuestion
              icon={icon}
              lead={spec.lead}
              text={item.text}
              max={item.max}
              low={item.low}
              high={item.high}
              value={picked[step]}
              onChange={(v) => set(step, v, false)}
            />
          )}

          {step === last && (
            <>
              <Card style={{ gap: SPACE.sm }}>
                <Text style={{ fontSize: 12, lineHeight: 16, color: TEXT_MUTED }}>{spec.title}</Text>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: SPACE.sm }}>
                  <Text style={{ fontSize: 44, lineHeight: 50, fontWeight: "800", color: ink }}>
                    {total}
                  </Text>
                  <Text style={{ fontSize: 14, color: TEXT_MUTED }}>{`/ ${spec.max}`}</Text>
                  <View style={{ flex: 1 }} />
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: `${ink}1A`,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: ink }}>{verdict.badge}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 14, lineHeight: 21, color: TEXT_SECONDARY }}>{verdict.result}</Text>
              </Card>

              {/* Each answer and what it scored — the total, unrolled. */}
              <Card style={{ gap: SPACE.sm }}>
                {spec.items.map((it, i) => {
                  const v = picked[i];
                  const text = v == null ? "ยังไม่ตอบ" : it.kind === "choice" ? it.options[v].label : `${v} / ${it.max}`;
                  return (
                    <View key={it.short}>
                      {i > 0 && <View style={{ height: 1, backgroundColor: SEPARATOR, marginBottom: SPACE.sm }} />}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
                        <View style={{ flex: 1, gap: 1 }}>
                          <Text style={{ fontSize: 12, color: TEXT_MUTED }}>{it.short}</Text>
                          <Text numberOfLines={2} style={{ fontSize: 14, lineHeight: 20, color: v != null ? TEXT_PRIMARY : TEXT_MUTED }}>
                            {text}
                          </Text>
                        </View>
                        <Text style={{ width: 32, textAlign: "right", fontSize: 14, fontWeight: "700", color: points[i] == null ? TEXT_MUTED : TEXT_PRIMARY }}>
                          {points[i] ?? "–"}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </Card>

              <Card style={{ gap: SPACE.xs }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: TEXT_MUTED, letterSpacing: 0.4 }}>ข้อแนะนำ</Text>
                <Text style={{ fontSize: 15, lineHeight: 23, color: TEXT_PRIMARY }}>{verdict.advice}</Text>
              </Card>

              <Text style={{ fontSize: 11, lineHeight: 16, color: TEXT_MUTED, textAlign: "center" }}>
                {spec.source}
              </Text>
            </>
          )}
        </ScrollView>
      </HeaderFade>

      <ActionBar>
        <PrimaryAction
          label={step === last ? "บันทึกผลการประเมิน" : "ถัดไป"}
          onPress={step === last ? save : () => setStep((s) => Math.min(s + 1, last))}
        />
      </ActionBar>
    </View>
  );
}

/** Symptom intensity on a 0–max line of pills: green low, amber middling, red high. */
function ScaleQuestion({
  icon,
  lead,
  text,
  max,
  low,
  high,
  value,
  onChange,
}: {
  icon: Icon;
  lead: string;
  text: string;
  max: number;
  low: string;
  high: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  const inkOf = (n: number) => (n >= 7 ? DANGER : n >= 4 ? WARNING : SUCCESS);
  return (
    <Card style={{ gap: SPACE.lg }}>
      <Glyph icon={icon} />
      <Text style={{ fontSize: 13, lineHeight: 19, color: TEXT_MUTED, marginTop: -SPACE.sm }}>{lead}</Text>
      <Text style={{ fontSize: 20, lineHeight: 28, fontWeight: "700", color: TEXT_PRIMARY }}>{text}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {Array.from({ length: max + 1 }, (_, n) => {
          const on = value === n;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(n)}
              accessibilityRole="button"
              accessibilityLabel={`${n}`}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: on ? inkOf(n) : GROUPED_BG,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: on ? "#FFFFFF" : TEXT_PRIMARY }}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 12, color: TEXT_MUTED }}>{`0 = ${low}`}</Text>
        <Text style={{ fontSize: 12, color: TEXT_MUTED }}>{`${max} = ${high}`}</Text>
      </View>
    </Card>
  );
}
