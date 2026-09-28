import { useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Accessibility,
  AlertTriangle,
  Baby,
  Bandage,
  BatteryLow,
  CalendarClock,
  Check,
  Droplets,
  FlaskConical,
  Footprints,
  Gauge,
  Glasses,
  GlassWater,
  Hand,
  Heart,
  Moon,
  Ribbon,
  Scan,
  TrendingUp,
  Users,
  UsersRound,
  Utensils,
  Zap,
} from "lucide-react-native";
import Svg, { Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";

import { feel } from "../utils/haptics";
import { CheckBox } from "../components/CheckBox";
import { ChoiceChip } from "../components/ChoiceChip";
import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { Card } from "../components/Card";
import { PairField, TextField } from "../components/FormField";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { PatientStrip } from "../components/PatientStrip";
import { ScreenHeader } from "../components/ScreenHeader";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import { saveAssessment } from "../models/assessments";
import { SCREENING_FIELDS, readingError, recordOf } from "../models/community";
import {
  EXTRA_RISKS,
  FAMILY_DISEASES,
  GROUP_LABEL,
  LEVEL,
  PERSONAL_HISTORY,
  SYMPTOMS,
  bmiOf,
  emptyAnswers,
  summarise35,
  toRecord,
  type Group,
  type Risk35Answers,
  type Risk35Result,
  type RiskScore,
  type ScoreLevel,
} from "../models/screening35";
import {
  DANGER,
  PRIMARY_100,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  SUCCESS,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  WARNING,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** A lucide glyph, as a component. */
type Icon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/**
 * A picture for each question, in the order the lists give them.
 *
 * Twenty questions read one to a page is twenty pages that look alike; a
 * glyph at the top of each says what the page is about before the words
 * are read, and a carer who has done the form a hundred times moves through
 * it by the pictures.
 */
const PERSONAL_ICONS: Icon[] = [Droplets, Gauge, Ribbon, Accessibility, Heart];
const FAMILY_ICONS: Record<"parent" | "sibling", Icon> = { parent: Users, sibling: UsersRound };
const EXTRA_ICONS: Icon[] = [Scan, Baby, FlaskConical, TrendingUp];
const SYMPTOM_ICONS: Icon[] = [
  Footprints,
  GlassWater,
  Moon,
  Utensils,
  BatteryLow,
  Bandage,
  Hand,
  Glasses,
  Zap,
];

const TRI = ["มี", "ไม่มี", "ไม่เคยตรวจ"] as const;
const YESNO = ["มี", "ไม่มี"] as const;

// Read as it renders: a module const would capture whichever palette
// was loaded at import and keep it through every theme change.
const LEVEL_INK = (): Record<ScoreLevel, string> => ({
  low: SUCCESS,
  moderate: PRIMARY_500,
  high: WARNING,
  veryHigh: DANGER,
});
// Read as it renders: a module const would capture whichever palette
// was loaded at import and keep it through every theme change.
const GROUP_INK = (): Record<Group, string> => ({
  normal: SUCCESS,
  risk: WARNING,
  suspect: DANGER,
});

/**
 * The score card's own ground and inks.
 *
 * A true navy — the brand's blue taken down to its darkest, not a slate
 * that only reads as black — and the four level colours lifted a step
 * brighter than the page's: the page's amber is a dark one cut for white,
 * and on this ground it sinks; the reds and blues follow so the four sit
 * at one brightness, the blue brightest of all so it clears the navy.
 */
const SCORE_DARK = "#0B2A5B";
const SCORE_LIT = "#1A4C8F";
const SCORE_DEEP = "#061A3A";
const LEVEL_INK_DARK: Record<ScoreLevel, string> = {
  low: "#34D399",
  moderate: "#7CC4FF",
  high: "#F5A524",
  veryHigh: "#FF5A5F",
};
const ON_DARK = "#FFFFFF";
const ON_DARK_SOFT = "rgba(255,255,255,0.7)";
const ON_DARK_MUTED = "rgba(255,255,255,0.55)";

/** The typed-value checks the screening form already has, by key. */
const F = Object.fromEntries(SCREENING_FIELDS.map((f) => [f.key, f]));

/**
 * One page of the form.
 *
 * The measurements are a form and stay one page; every question after them
 * is a page of its own, so the carer reads one thing, taps one answer, and
 * is moved on. The result is the last page.
 */
type Page =
  | { kind: "measure"; section: string }
  | { kind: "tri"; section: string; q: string; icon: Icon }
  | { kind: "yesno"; section: string; group: "extra" | "symptom"; q: string; icon: Icon }
  | { kind: "family"; section: string; which: "parent" | "sibling"; q: string; icon: Icon }
  | { kind: "result"; section: string };

const PAGES: Page[] = [
  { kind: "measure", section: "ข้อมูลพื้นฐานและวัดค่า" },
  ...PERSONAL_HISTORY.map(
    (q, i): Page => ({ kind: "tri", section: "ประวัติส่วนตัว", q, icon: PERSONAL_ICONS[i] }),
  ),
  {
    kind: "family",
    section: "ประวัติครอบครัว",
    which: "parent",
    q: "บิดาหรือมารดา มีประวัติการเจ็บป่วยด้วยโรค",
    icon: FAMILY_ICONS.parent,
  },
  {
    kind: "family",
    section: "ประวัติครอบครัว",
    which: "sibling",
    q: "พี่น้องสายตรง มีประวัติการเจ็บป่วยด้วยโรค",
    icon: FAMILY_ICONS.sibling,
  },
  ...EXTRA_RISKS.map(
    (q, i): Page => ({
      kind: "yesno",
      section: "ปัจจัยเสี่ยงเพิ่มเติม",
      group: "extra",
      q,
      icon: EXTRA_ICONS[i],
    }),
  ),
  ...SYMPTOMS.map(
    (q, i): Page => ({ kind: "yesno", section: "อาการบ่งชี้", group: "symptom", q, icon: SYMPTOM_ICONS[i] }),
  ),
  { kind: "result", section: "สรุปผลการคัดกรอง" },
];

/** How many of the pages are questions, and which question a page is. */
const QUESTIONS = PAGES.filter((p) => p.kind !== "measure" && p.kind !== "result").length;
const questionNo = (i: number) =>
  PAGES.slice(0, i + 1).filter((p) => p.kind !== "measure" && p.kind !== "result").length;

/** How long a chosen answer stays on screen before the page turns. */
const TURN_MS = 240;

/**
 * "แบบคัดกรองภาวะเสี่ยง 35 ปีขึ้นไป".
 *
 * Measurements first, because the score is made of them; then the history
 * the paper form asks, one question to a page; then the result — the Thai
 * Diabetes Risk Score out of seventeen, and the sugar and pressure each
 * sorted into the Ministry's normal / risk / suspect groups — with one line
 * of what to do.
 */
export function Screening35Screen() {
  const { holder } =
    useRoute<RouteProp<RootStackParamList, "Screening35">>().params;
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();

  const [step, setStep] = useState(0);
  const page = PAGES[step];
  const last = PAGES.length - 1;

  // What the health screening on this visit already measured. The score is
  // built from the same numbers, so they are carried in rather than typed
  // twice; blank where nothing was taken. The pressure is stored as one
  // "120/80" string there and as two figures here.
  const prior = recordOf(holder.authenCode, "screening");
  const carried = ["weight", "height", "waist", "bp", "glucose"].some(
    (k) => (prior[k] ?? "").trim() !== "",
  );
  const [ans, setAns] = useState<Risk35Answers>(() => {
    const [sbp = "", dbp = ""] = (prior.bp ?? "").split("/").map((s) => s.trim());
    return emptyAnswers(holder.age, holder.gender, {
      weight: prior.weight ?? "",
      height: prior.height ?? "",
      waist: prior.waist ?? "",
      sbp,
      dbp,
      glucose: prior.glucose ?? "",
    });
  });
  const result = useMemo(() => summarise35(ans), [ans]);

  const setM = (patch: Partial<Risk35Answers["m"]>) =>
    setAns((s) => ({ ...s, m: { ...s.m, ...patch } }));

  // A single-choice answer turns the page by itself, after a beat long
  // enough to see it land. The timer is kept so a second tap in that beat
  // does not turn two pages.
  const turning = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answerAndTurn = (apply: (s: Risk35Answers) => Risk35Answers) => {
    setAns(apply);
    if (turning.current != null) clearTimeout(turning.current);
    turning.current = setTimeout(() => {
      turning.current = null;
      setStep((s) => Math.min(s + 1, last));
    }, TURN_MS);
  };
  const setTri = (q: string, v: string) =>
    answerAndTurn((s) => ({ ...s, personal: { ...s.personal, [q]: v as never } }));
  const setYesNo = (group: "extra" | "symptom", q: string, v: string) =>
    answerAndTurn((s) => ({ ...s, [group]: { ...s[group], [q]: v as never } }));
  const toggleFamily = (which: "parent" | "sibling", d: string) =>
    setAns((s) => {
      const cur = s[which];
      return { ...s, [which]: cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d] };
    });

  // Impossible readings stop the form moving on; blanks do not.
  const errors = {
    weight: readingError(F.weight, ans.m.weight),
    height: readingError(F.height, ans.m.height),
    waist: readingError(F.waist, ans.m.waist),
    bp: ans.m.sbp && ans.m.dbp ? readingError(F.bp, `${ans.m.sbp}/${ans.m.dbp}`) : null,
    glucose: readingError(F.glucose, ans.m.glucose),
  };
  const blocked = page.kind === "measure" && Object.values(errors).some((e) => e != null);

  const back = () => (step === 0 ? nav.goBack() : setStep((s) => s - 1));
  const save = () => {
    const rec = toRecord(ans, result);
    saveAssessment(holder.authenCode, rec);
    // Anything the result page draws off green — the score band, or either
    // reading's group — is named in a warning instead.
    const flagged = [
      rec.tone !== "good" ? rec.badge : null,
      result.sugar != null && result.sugar !== "normal" ? `น้ำตาล${GROUP_LABEL[result.sugar]}` : null,
      result.bp != null && result.bp !== "normal" ? `ความดัน${GROUP_LABEL[result.bp]}` : null,
    ].filter((x) => x != null);
    if (flagged.length === 0) toast("บันทึกผลการคัดกรองแล้ว", "success");
    else toast(`บันทึกแล้ว · ${flagged.join(" · ")}`, "warning");
    // Back to the list, which now carries the result on this row; the
    // patient page behind it reads the same record.
    nav.goBack();
  };

  const bmi = bmiOf(ans.m);
  const caption =
    page.kind === "measure" || page.kind === "result"
      ? ""
      : `ข้อ ${questionNo(step)} / ${QUESTIONS}`;

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title={page.section}
        onBack={back}
        below={<Progress value={step / last} caption={caption} />}
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
            {page.kind === "measure" && (
              <>
                {/* Who this is for — said once, on the first page. */}
                <PatientStrip holder={holder} />

                <Card style={{ gap: SPACE.lg }}>
                  {/* Off the card, not typed: the score's age and sex are
                      whoever the card says they are. */}
                  <View style={{ flexDirection: "row", gap: SPACE.lg }}>
                    <Static label="อายุ" value={`${holder.age} ปี`} />
                    <Static label="เพศ" value={holder.gender} />
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      lineHeight: 18,
                      color: carried ? SUCCESS : TEXT_MUTED,
                      marginTop: -SPACE.sm,
                    }}
                  >
                    {carried
                      ? "ดึงค่าที่วัดไว้ในคัดกรองสุขภาพมาให้แล้ว แก้ได้หากวัดใหม่"
                      : "ยังไม่มีค่าจากคัดกรองสุขภาพในการเยี่ยมนี้ กรอกค่าที่วัดได้"}
                  </Text>
                  <TextField
                    label="น้ำหนัก"
                    value={ans.m.weight}
                    onChangeText={(v) => setM({ weight: v.replace(/[^0-9.]/g, "") })}
                    keyboardType="decimal-pad"
                    placeholder="62.5"
                    maxLength={5}
                    trailing={<Unit>กก.</Unit>}
                    error={errors.weight}
                  />
                  <TextField
                    label="ส่วนสูง"
                    value={ans.m.height}
                    onChangeText={(v) => setM({ height: v.replace(/[^0-9]/g, "") })}
                    keyboardType="number-pad"
                    placeholder="165"
                    maxLength={3}
                    trailing={<Unit>ซม.</Unit>}
                    error={errors.height}
                  />
                  {bmi != null && (
                    <Text style={{ fontSize: 14, color: TEXT_SECONDARY, marginTop: -SPACE.sm }}>
                      {`BMI ${bmi.toFixed(1)} กก./ม.² · ${
                        bmi >= 27.5 ? "อ้วน" : bmi >= 23 ? "น้ำหนักเกิน" : "ปกติ"
                      }`}
                    </Text>
                  )}
                  <TextField
                    label="รอบเอว"
                    value={ans.m.waist}
                    onChangeText={(v) => setM({ waist: v.replace(/[^0-9]/g, "") })}
                    keyboardType="number-pad"
                    placeholder={ans.m.sex === "หญิง" ? "80" : "90"}
                    maxLength={3}
                    trailing={<Unit>ซม.</Unit>}
                    error={errors.waist}
                  />
                </Card>

                <Card style={{ gap: SPACE.lg }}>
                  <PairField
                    label="ความดันโลหิต"
                    first={ans.m.sbp}
                    second={ans.m.dbp}
                    onChange={(a, b) => setM({ sbp: a, dbp: b })}
                    hints={["120", "80"]}
                    trailing={<Unit>mmHg</Unit>}
                    error={errors.bp}
                  />
                  <TextField
                    label="น้ำตาลในเลือด (DTX / FPG)"
                    value={ans.m.glucose}
                    onChangeText={(v) => setM({ glucose: v.replace(/[^0-9]/g, "") })}
                    keyboardType="number-pad"
                    placeholder="95"
                    maxLength={3}
                    trailing={<Unit>mg/dL</Unit>}
                    error={errors.glucose}
                  />
                  <Choose
                    label="ก่อนเจาะ งดอาหารมาแล้วอย่างน้อย 8 ชั่วโมงหรือไม่"
                    options={["งดอาหาร", "ไม่ได้งด"]}
                    value={
                      ans.m.fasting == null ? null : ans.m.fasting ? "งดอาหาร" : "ไม่ได้งด"
                    }
                    onChange={(v) => setM({ fasting: v == null ? null : v === "งดอาหาร" })}
                  />
                </Card>
              </>
            )}

            {page.kind === "tri" && (
              <Question
                icon={page.icon}
                text={page.q}
                lead="ท่านมีประวัติการเจ็บป่วย หรือต้องการพบแพทย์ด้วยโรคนี้หรือไม่"
                options={TRI}
                value={ans.personal[page.q]}
                onChange={(v) => setTri(page.q, v)}
              />
            )}

            {page.kind === "yesno" && (
              <Question
                icon={page.icon}
                text={page.q}
                lead={
                  page.group === "extra"
                    ? "ปัจจัยเสี่ยงเพิ่มเติมที่ใช้พิจารณาส่งตรวจเลือด"
                    : "อาการที่อาจบ่งชี้โรคเบาหวาน"
                }
                options={YESNO}
                value={ans[page.group][page.q]}
                onChange={(v) => setYesNo(page.group, page.q, v)}
              />
            )}

            {page.kind === "family" && (
              <FamilyCard
                icon={page.icon}
                title={page.q}
                chosen={ans[page.which]}
                onToggle={(d) => toggleFamily(page.which, d)}
              />
            )}

            {page.kind === "result" && <ResultView result={result} />}
          </ScrollView>
        </HeaderFade>
      </KeyboardAvoidingView>

      <ActionBar>
        <PrimaryAction
          label={
            page.kind === "result"
              ? "บันทึกผลการคัดกรอง"
              : blocked
                ? "มีค่าที่กรอกไม่ถูกต้อง"
                : page.kind === "measure"
                  ? "เริ่มทำแบบประเมิน"
                  : "ถัดไป"
          }
          disabled={blocked}
          onPress={page.kind === "result" ? save : () => setStep((s) => Math.min(s + 1, last))}
        />
      </ActionBar>
    </View>
  );
}

/** The page's picture: the glyph on a pale brand disc, top-left of the card. */
function Glyph({ icon: Ic }: { icon: Icon }) {
  return (
    <View
      style={{
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: PRIMARY_100,
      }}
    >
      <Ic size={28} color={PRIMARY_500} strokeWidth={2} />
    </View>
  );
}

/** The unit at the end of a field. */
function Unit({ children }: { children: string }) {
  return <Text style={{ fontSize: 14, color: TEXT_MUTED }}>{children}</Text>;
}

/** A fact off the card: label over value, nothing to type. */
function Static({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>{label}</Text>
      <Text style={{ fontSize: 16, lineHeight: 22, fontWeight: "600", color: TEXT_PRIMARY }}>
        {value}
      </Text>
    </View>
  );
}

/** One bar under the header, filled as far as the form has got. */
function Progress({ value, caption }: { value: number; caption: string }) {
  return (
    <View style={{ marginTop: SPACE.md, gap: 6 }}>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(7,125,215,0.15)" }}>
        <View
          style={{
            width: `${Math.round(Math.max(0.02, value) * 100)}%` as `${number}%`,
            height: 4,
            borderRadius: 2,
            backgroundColor: PRIMARY_500,
          }}
        />
      </View>
      {caption !== "" && (
        <Text style={{ fontSize: 12, lineHeight: 16, color: TEXT_MUTED, textAlign: "right" }}>
          {caption}
        </Text>
      )}
    </View>
  );
}

/**
 * One question, one page: the section's guidance in grey, the question in
 * the page's biggest type, and the answers as a column of rows — a radio
 * disc leading each, since only one can be true.
 */
function Question({
  icon,
  lead,
  text,
  options,
  value,
  onChange,
}: {
  icon: Icon;
  lead: string;
  text: string;
  options: readonly string[];
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <Card style={{ gap: SPACE.lg }}>
      <Glyph icon={icon} />
      <Text style={{ fontSize: 13, lineHeight: 19, color: TEXT_MUTED, marginTop: -SPACE.sm }}>{lead}</Text>
      <Text style={{ fontSize: 20, lineHeight: 28, fontWeight: "700", color: TEXT_PRIMARY }}>
        {text}
      </Text>
      <View>
        {options.map((o, i) => {
          const on = value === o;
          return (
            <View key={o}>
              {i > 0 && <View style={{ height: 1, backgroundColor: SEPARATOR }} />}
              <Pressable
                onPress={() => onChange(o)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACE.md,
                  minHeight: 56,
                  paddingVertical: SPACE.sm,
                }}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: on ? PRIMARY_500 : "transparent",
                    borderWidth: on ? 0 : 1.5,
                    borderColor: SEPARATOR,
                  }}
                >
                  {on && <Check size={15} color="#FFFFFF" strokeWidth={3} />}
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 16,
                    lineHeight: 22,
                    fontWeight: on ? "600" : "400",
                    color: TEXT_PRIMARY,
                  }}
                >
                  {o}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
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
              label={o}
              on={on}
              onPress={() => onChange(on ? null : o)}
              style={{ flex: 1 }}
              contentStyle={{ minHeight: 48, paddingHorizontal: SPACE.md, paddingVertical: 0 }}
            />
          );
        })}
      </View>
    </View>
  );
}

/**
 * A family disease checklist — the same list, ticked for one relative.
 *
 * Rows with a leading checkbox, square so it reads as "tick any" and not
 * as one-of. This page does not turn itself: several can be true.
 */
function FamilyCard({
  icon,
  title,
  chosen,
  onToggle,
}: {
  icon: Icon;
  title: string;
  chosen: string[];
  onToggle: (d: string) => void;
}) {
  return (
    <Card style={{ gap: 2 }}>
      <View style={{ marginBottom: SPACE.md }}>
        <Glyph icon={icon} />
      </View>
      <Text style={{ fontSize: 20, lineHeight: 28, fontWeight: "700", color: TEXT_PRIMARY }}>{title}</Text>
      <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED, marginBottom: SPACE.sm }}>
        เลือกได้มากกว่า 1 คำตอบ
      </Text>
      {FAMILY_DISEASES.map((d, i) => {
        const on = chosen.includes(d);
        return (
          <View key={d}>
            {i > 0 && <View style={{ height: 1, backgroundColor: SEPARATOR }} />}
            <Pressable
              onPress={() => {
                feel("tick");
                onToggle(d);
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.md,
                minHeight: 48,
                paddingVertical: SPACE.sm,
              }}
            >
              <CheckBox on={on} size={24} radius={6} edge={SEPARATOR} />
              <Text
                style={{
                  flex: 1,
                  fontSize: 15,
                  lineHeight: 22,
                  fontWeight: on ? "600" : "400",
                  color: TEXT_PRIMARY,
                }}
              >
                {d}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </Card>
  );
}

/** The result: the score with its band, the two readings in their groups, the advice. */
function ResultView({ result }: { result: Risk35Result }) {
  const { score } = result;

  return (
    <View style={{ gap: SPACE.md }}>
      <ScoreCard score={score} />

      {/* How the score was made, line by line. */}
      <Card style={{ gap: SPACE.sm }}>
        {score.items.map((it, i) => (
          <View key={it.label}>
            {i > 0 && <View style={{ height: 1, backgroundColor: SEPARATOR, marginBottom: SPACE.sm }} />}
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
              <Text style={{ flex: 1, fontSize: 14, color: TEXT_SECONDARY }}>{it.label}</Text>
              <Text style={{ fontSize: 14, color: it.known ? TEXT_PRIMARY : TEXT_MUTED }}>
                {it.known ? it.value : "ไม่ได้กรอก"}
              </Text>
              <Text
                style={{
                  width: 40,
                  textAlign: "right",
                  fontSize: 14,
                  fontWeight: "700",
                  color: it.points > 0 ? WARNING : TEXT_MUTED,
                }}
              >
                {it.known ? `+${it.points}` : "–"}
              </Text>
            </View>
          </View>
        ))}
      </Card>

      {/* The two measured groupings. */}
      <View style={{ flexDirection: "row", gap: SPACE.md }}>
        <GroupTile label="น้ำตาลในเลือด" group={result.sugar} />
        <GroupTile label="ความดันโลหิต" group={result.bp} />
      </View>

      {/* What to do. */}
      <Card style={{ gap: SPACE.xs }}>
        <Text style={{ fontSize: 12, fontWeight: "700", color: TEXT_MUTED, letterSpacing: 0.4 }}>ข้อแนะนำ</Text>
        <Text style={{ fontSize: 15, lineHeight: 23, color: TEXT_PRIMARY }}>{result.advice}</Text>
      </Card>

      {result.known.length > 0 && (
        <Card style={{ flexDirection: "row", gap: SPACE.md, alignItems: "flex-start" }}>
          <AlertTriangle size={18} color={WARNING} strokeWidth={2.2} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: TEXT_PRIMARY }}>มีโรคประจำตัวอยู่แล้ว</Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: TEXT_SECONDARY }}>{result.known.join(" · ")}</Text>
          </View>
        </Card>
      )}
      {result.extraRisks.length > 0 && (
        <FindingList title="ปัจจัยเสี่ยงเพิ่มเติมที่พบ" items={result.extraRisks} ink={WARNING} />
      )}
      {result.symptoms.length > 0 && (
        <FindingList title="อาการที่พบ" items={result.symptoms} ink={DANGER} />
      )}
    </View>
  );
}

/** The four bands of the score, in order, and how many of the 18 marks each spans. */
const BANDS: { level: ScoreLevel; span: number }[] = [
  { level: "low", span: 3 },
  { level: "moderate", span: 3 },
  { level: "high", span: 3 },
  { level: "veryHigh", span: 9 },
];

/**
 * The score's own card: the ring, the band it lands in, the scale it sits on.
 *
 * A white card like its neighbours rather than a tinted plate — the colour
 * is in the ring and the word, where it means something, not washed over
 * the whole box. The scale under them shows the four bands at their true
 * widths with a dot where this score falls, so "น้อย" is read against what
 * it is not.
 */
function ScoreCard({ score }: { score: RiskScore }) {
  const lv = LEVEL[score.level];
  const ink = LEVEL_INK_DARK[score.level];
  // Scores run 0–17: eighteen marks, the dot in the middle of its mark.
  const at = ((Math.min(score.total, score.max) + 0.5) / (score.max + 1)) * 100;

  // Lifted off the page, as the one card on it that is the answer.
  return (
    <Card elevated style={{ gap: SPACE.lg, backgroundColor: SCORE_DARK }}>
      {/* The ground: navy, lit from the top-left corner and falling to
          near-black at the far one, so the card has a face and not a flat
          fill. Over it, a wash of the level's own colour from the same
          corner, thinning to nothing — the light on the card is the light
          of the result. Both clip to the card's corners. */}
      <LinearGradient
        pointerEvents="none"
        colors={[SCORE_LIT, SCORE_DARK, SCORE_DEEP]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, borderRadius: RADIUS.card }}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[`${ink}40`, `${ink}00`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 0.7 }}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, borderRadius: RADIUS.card }}
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.lg }}>
        <Ring value={score.total} max={score.max} ink={ink} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 12, lineHeight: 16, color: ON_DARK_MUTED }}>
            คะแนนความเสี่ยงโรคเบาหวาน
          </Text>
          {/* White, whatever the level: the level's colour is on the ring
              and the scale, where a colour can be read against the navy —
              blue words on a blue ground could not be. */}
          <Text style={{ fontSize: 28, lineHeight: 34, fontWeight: "800", color: ON_DARK }}>
            {`เสี่ยง${lv.label}`}
          </Text>
          <Text style={{ fontSize: 13, lineHeight: 19, color: ON_DARK_SOFT }}>
            {`โอกาสเกิดเบาหวานใน 12 ปี ${lv.pct} (${lv.chance})`}
          </Text>
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", gap: 3, height: 8 }}>
          {BANDS.map((b) => (
            <View
              key={b.level}
              style={{
                flex: b.span,
                borderRadius: 4,
                backgroundColor: LEVEL_INK_DARK[b.level],
                opacity: b.level === score.level ? 1 : 0.28,
              }}
            />
          ))}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: `${at}%` as `${number}%`,
              top: -3,
              marginLeft: -7,
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: ink,
              borderWidth: 2.5,
              borderColor: SCORE_DARK,
            }}
          />
        </View>
        <View style={{ flexDirection: "row", gap: 3 }}>
          {BANDS.map((b) => (
            <Text
              key={b.level}
              numberOfLines={1}
              style={{
                flex: b.span,
                fontSize: 11,
                lineHeight: 14,
                textAlign: "center",
                fontWeight: b.level === score.level ? "700" : "400",
                color: b.level === score.level ? ON_DARK : ON_DARK_MUTED,
              }}
            >
              {LEVEL[b.level].label}
            </Text>
          ))}
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm, flexWrap: "wrap" }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: SPACE.md,
            paddingVertical: 6,
            borderRadius: RADIUS.capsule,
            backgroundColor: "rgba(255,255,255,0.12)",
          }}
        >
          <CalendarClock size={14} color={ON_DARK} strokeWidth={2.2} />
          <Text style={{ fontSize: 12, fontWeight: "600", color: ON_DARK }}>{lv.repeat}</Text>
        </View>
      </View>
    </Card>
  );
}

/** The score as an arc round its figure — a track, and the part of it earned. */
function Ring({ value, max, ink }: { value: number; max: number; ink: string }) {
  const size = 96;
  const w = 9;
  const r = (size - w) / 2;
  const c = 2 * Math.PI * r;
  const f = max === 0 ? 0 : Math.min(1, value / max);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={ink} strokeOpacity={0.15} strokeWidth={w} fill="none" />
        {f > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={ink}
            strokeWidth={w}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c * f} ${c}`}
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        )}
      </Svg>
      <Text style={{ fontSize: 30, lineHeight: 34, fontWeight: "800", color: ON_DARK }}>{value}</Text>
      <Text style={{ fontSize: 11, lineHeight: 13, color: ON_DARK_MUTED, marginTop: -2 }}>{`/ ${max}`}</Text>
    </View>
  );
}

/** One reading's group — normal, risk, suspect — or "not measured". */
function GroupTile({ label, group }: { label: string; group: Group | null }) {
  const ink = group == null ? TEXT_MUTED : GROUP_INK()[group];
  return (
    <Card style={{ flex: 1, gap: 4 }}>
      <Text style={{ fontSize: 12, color: TEXT_MUTED }}>{label}</Text>
      <Text style={{ fontSize: 18, lineHeight: 24, fontWeight: "800", color: ink }}>
        {group == null ? "ไม่ได้วัด" : GROUP_LABEL[group]}
      </Text>
    </Card>
  );
}

/** A found-items list, each on its own line with a coloured dot. */
function FindingList({ title, items, ink }: { title: string; items: string[]; ink: string }) {
  return (
    <Card style={{ gap: SPACE.md }}>
      <Text style={{ fontSize: 14, fontWeight: "700", color: TEXT_PRIMARY }}>{title}</Text>
      <View style={{ gap: SPACE.sm }}>
        {items.map((it) => (
          <View key={it} style={{ flexDirection: "row", gap: SPACE.sm }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 8, backgroundColor: ink }} />
            <Text style={{ flex: 1, fontSize: 14, lineHeight: 22, color: TEXT_SECONDARY }}>{it}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
