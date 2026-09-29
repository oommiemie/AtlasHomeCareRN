import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Clock, FileText } from "lucide-react-native";

import { assessmentIcon, Glyph, type Icon } from "../components/AssessmentUI";
import { Card } from "../components/Card";
import { tr } from "../i18n";
import { Glass } from "../components/Glass";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  useAssessments,
  type AssessmentRecord,
  type Tone,
} from "../models/assessments";
import { ASSESSMENTS } from "../models/community";
import {
  GROUP_LABEL,
  LEVEL,
  type Group,
  type ScoreLevel,
} from "../models/screening35";
import {
  DANGER,
  GLASS_OFF,
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
import { cardWidth, columnsFor, useLayout, GUTTER } from "../theme/layout";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Where each form opens. Three have screens of their own; one is a form of
 * readings; the other eight are specs the questionnaire screen runs.
 */
type FormRoute = "Screening35" | "Asthma" | "Dyspnea" | "Ncd" | "Questionnaire";
const BUILT: Record<string, FormRoute> = {
  risk35: "Screening35",
  asthma: "Asthma",
  dyspnea: "Dyspnea",
  ncd: "Ncd",
  barthel: "Questionnaire",
  adl: "Questionnaire",
  palliative: "Questionnaire",
  inhomesss: "Questionnaire",
  crisis: "Questionnaire",
  esas: "Questionnaire",
  homecare: "Questionnaire",
  mna: "Questionnaire",
};

// Read as it renders: applyTheme runs inside App's render, after every
// screen module body, so a token in a module const keeps the light
// palette it was imported under.
const TONE_INK = (): Record<Tone, string> => ({
  good: SUCCESS,
  warn: WARNING,
  bad: DANGER,
});
// Read as it renders: applyTheme runs inside App's render, after every
// screen module body, so a token in a module const keeps the light
// palette it was imported under.
const LEVEL_INK = (): Record<ScoreLevel, string> => ({
  low: SUCCESS,
  moderate: PRIMARY_500,
  high: WARNING,
  veryHigh: DANGER,
});
// Read as it renders: applyTheme runs inside App's render, after every
// screen module body, so a token in a module const keeps the light
// palette it was imported under.
const GROUP_INK = (): Record<Group, string> => ({
  normal: SUCCESS,
  risk: WARNING,
  suspect: DANGER,
});
const isLevel = (v: string): v is ScoreLevel => v in LEVEL_INK();
const isGroup = (v: string): v is Group => v in GROUP_INK();

/** The picture's slot, bottom-right of the card. */
const ART_SIZE = 64;

/**
 * tr("แบบประเมิน", "Assessments") — Figma 98:13058.
 *
 * A list of forms rather than a form: which one is asked depends on the
 * patient, and a carer picks it off the list knowing the answer before they
 * open it. Every row is the same shape — the form's name, how long it is,
 * the button that opens it, and its picture in the corner — because none of
 * them outranks the others; the one that matters today is the one this
 * patient needs. A row that has been done says what it found, and its
 * button offers to do it again.
 */
export function AssessmentListScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  // On a tablet the forms flow into columns; on a phone, one under another.
  const { width, regular } = useLayout();
  const cols = columnsFor(width);
  const colWidth = cardWidth(width - GUTTER * 2, cols, SPACE.md);
  const { holder } =
    useRoute<RouteProp<RootStackParamList, "AssessmentList">>().params;

  // What this visit has finished, one record per form.
  const recs = useAssessments(holder.authenCode);

  const open = (key: string, label: string) => {
    const route = BUILT[key];
    if (route === "Screening35") nav.navigate("Screening35", { holder });
    else if (route === "Asthma") nav.navigate("Asthma", { holder });
    else if (route === "Dyspnea") nav.navigate("Dyspnea", { holder });
    else if (route === "Ncd") nav.navigate("Ncd", { holder });
    else if (route === "Questionnaire")
      nav.navigate("Questionnaire", { holder, form: key });
    else toast(tr(`${label} ยังไม่เปิดใช้งาน`, `${label} is not available yet`));
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={tr("แบบประเมิน", "Assessments")} />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: GUTTER,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + SPACE.huge,
            gap: SPACE.md,
            ...(regular ? { flexDirection: "row", flexWrap: "wrap" } : null),
          }}
          showsVerticalScrollIndicator={false}
        >
          {ASSESSMENTS.map((a) => {
            const rec = recs[a.key];
            const done = rec != null;
            const built = BUILT[a.key] != null;
            return (
              <View key={a.key} style={regular ? { width: colWidth } : undefined}>
                <Card
                  onPress={() => open(a.key, a.label)}
                  accessibilityLabel={a.label}
                  style={regular ? { flex: 1 } : undefined}
                >
                  {/* No opacity on the row: the button inside is glass, and an
                      ancestor under full alpha strips the material. A form not
                      yet built is greyed piece by piece instead. */}
                  <View style={{ flexDirection: "row", gap: SPACE.md }}>
                    <View style={{ flex: 1, gap: SPACE.sm }}>
                      <Text
                        numberOfLines={2}
                        style={{
                          fontSize: 16,
                          lineHeight: 22,
                          fontWeight: "700",
                          color: built ? TEXT_PRIMARY : TEXT_MUTED,
                        }}
                      >
                        {a.label}
                      </Text>

                      {/* How long it is: the count and the minutes, each
                          behind its glyph, so the row can be sized up before
                          it is opened. */}
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: SPACE.md,
                        }}
                      >
                        <Meta icon={FileText} text={tr(`จำนวน ${a.items} ข้อ`, `${a.items} items`)} />
                        <Meta icon={Clock} text={tr(`${a.minutes} นาที`, `${a.minutes} min`)} />
                      </View>

                      {done &&
                        (rec.form === "risk35" ? (
                          <Risk35Preview rec={rec} />
                        ) : (
                          <ResultPreview rec={rec} />
                        ))}

                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: SPACE.md,
                          marginTop: 2,
                        }}
                      >
                        {/* The result pills above and tr("ทำอีกครั้ง", "Do again") here already
                            say it has been done; a tick as well said it twice. */}
                        <GlassPill
                          label={
                            !built
                              ? tr("ยังไม่เปิดใช้งาน", "Not available yet")
                              : done
                                ? tr("ทำอีกครั้ง", "Do again")
                                : tr("ทำแบบประเมิน", "Start assessment")
                          }
                          disabled={!built}
                          onPress={() => open(a.key, a.label)}
                        />
                      </View>
                    </View>

                    {/* The picture, in the corner the button points away from. */}
                    <View
                      style={{
                        width: ART_SIZE,
                        justifyContent: "flex-end",
                        opacity: built ? 1 : 0.45,
                      }}
                    >
                      <Glyph icon={assessmentIcon(a.key)} size={ART_SIZE} />
                    </View>
                  </View>
                </Card>
              </View>
            );
          })}
        </ScrollView>
      </HeaderFade>
    </View>
  );
}

/**
 * The row's button: a 36pt capsule of Apple's glass in the tray's blue.
 *
 * The same construction as the tray's PrimaryAction, a size down — a plain
 * Pressable round a `Glass` that answers the touch itself. Unavailable is a
 * greyer tint, never a faded button: alpha on the ancestor would flatten
 * the material.
 */
function GlassPill({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const off = disabled === true;
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off }}
    >
      <Glass
        tintColor={off ? GLASS_OFF : "rgba(7,125,215,0.78)"}
        interactive={!off}
        style={{
          height: 36,
          paddingHorizontal: SPACE.lg,
          borderRadius: RADIUS.capsule,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontSize: 13,
            lineHeight: 18,
            fontWeight: "700",
            color: "#FFFFFF",
          }}
        >
          {label}
        </Text>
      </Glass>
    </Pressable>
  );
}

/** A glyph and a word, in the row's small grey. */
function Meta({ icon: Ic, text }: { icon: Icon; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Ic size={13} color={TEXT_MUTED} strokeWidth={2} />
      <Text style={{ fontSize: 12, lineHeight: 16, color: TEXT_MUTED }}>
        {text}
      </Text>
    </View>
  );
}

/**
 * The 35+ screening's result on its row: the level, the score, and the two
 * readings' groups as a line of tinted pills, with the advice under them.
 */
function Risk35Preview({ rec }: { rec: AssessmentRecord }) {
  const level = rec.level ?? "";
  const sugar = rec.sugar ?? "";
  const bp = rec.bp ?? "";
  return (
    <View style={{ gap: SPACE.sm }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {isLevel(level) && (
          <Pill ink={LEVEL_INK()[level]} dot>
            {tr(`เสี่ยง${LEVEL[level].label}`, `${LEVEL[level].label} risk`)}
          </Pill>
        )}
        {rec.score != null && rec.score !== "" && (
          <Pill ink={TEXT_SECONDARY} plain>
            {tr(`${rec.score}/17 คะแนน`, `${rec.score}/17 points`)}
          </Pill>
        )}
        {isGroup(sugar) && (
          <Pill ink={GROUP_INK()[sugar]}>{`${tr("น้ำตาล", "Glucose")} ${GROUP_LABEL[sugar]}`}</Pill>
        )}
        {isGroup(bp) && (
          <Pill ink={GROUP_INK()[bp]}>{`${tr("ความดัน", "BP")} ${GROUP_LABEL[bp]}`}</Pill>
        )}
      </View>
      {rec.advice !== "" && (
        <Text
          numberOfLines={2}
          style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}
        >
          {rec.advice}
        </Text>
      )}
    </View>
  );
}

/**
 * Any other form's result on its row: the verdict as a tinted pill, the
 * score beside it, the advice under.
 */
function ResultPreview({ rec }: { rec: AssessmentRecord }) {
  return (
    <View style={{ gap: SPACE.sm }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <Pill ink={TONE_INK()[rec.tone] ?? TEXT_SECONDARY} dot>
          {rec.badge}
        </Pill>
        {rec.score != null && rec.score !== "" && rec.form === "asthma" && (
          <Pill ink={TEXT_SECONDARY} plain>
            {`ACT ${rec.score}/25`}
          </Pill>
        )}
        {rec.score != null &&
          rec.score !== "" &&
          rec.max != null &&
          rec.max !== "" && (
            <Pill ink={TEXT_SECONDARY} plain>
              {tr(`${rec.score} / ${rec.max} คะแนน`, `${rec.score} / ${rec.max} points`)}
            </Pill>
          )}
      </View>
      {rec.advice !== "" && (
        <Text
          numberOfLines={2}
          style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}
        >
          {rec.advice}
        </Text>
      )}
    </View>
  );
}

/** A small tinted capsule: the ink at a tenth for the ground, full for the word. */
function Pill({
  ink,
  dot,
  plain,
  children,
}: {
  ink: string;
  /** A leading disc in the ink — for the one pill that names the result. */
  dot?: boolean;
  /** On the page's grey rather than a tint — for a figure, not a verdict. */
  plain?: boolean;
  children: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: plain === true ? GROUPED_BG : `${ink}1A`,
      }}
    >
      {dot === true && (
        <View
          style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ink }}
        />
      )}
      <Text
        style={{ fontSize: 12, lineHeight: 16, fontWeight: "600", color: ink }}
      >
        {children}
      </Text>
    </View>
  );
}
