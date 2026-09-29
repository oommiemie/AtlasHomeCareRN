import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Baby,
  ChartLine,
  CircleCheck,
  ClipboardList,
  History,
  Info,
  Ruler,
  TrendingUp,
  TriangleAlert,
  UtensilsCrossed,
} from "lucide-react-native";

import { ChoiceChip } from "../components/ChoiceChip";
import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { Card } from "../components/Card";
import { CardHeading } from "../components/CardAction";
import { GrowthChart, type Plot } from "../components/GrowthChart";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ReasonSheet } from "../components/ReasonSheet";
import { ScreenHeader } from "../components/ScreenHeader";
import { ToolbarPill } from "../components/ToolbarPill";
import { StatusTag } from "../components/StatusTag";
import { TextField } from "../components/FormField";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  ABSENT_REASONS,
  REFUSED_REASONS,
  nextWaiting,
  placeOf,
  setGrowth,
  setOutcome,
  useSession,
} from "../models/vaccination";
import {
  adviceFor,
  ageLabel,
  assess,
  BOTTLE,
  DEVELOPMENT,
  FEEDING,
  followUpFor,
  GROWTH_LEVEL_LABEL,
  growthText,
  headMedian,
  headOutlier,
  INDEX_LABEL,
  placesFor,
  REFERENCE_NOTE,
  sexLabel,
  weightForAge,
  type Bottle,
  type Development,
  type Feeding,
  type GrowthLevel,
  type Verdict,
} from "../models/growth";
import { feel } from "../utils/haptics";
import { tr } from "../i18n";
import { FORM_MAX, readable, useLayout, GUTTER } from "../theme/layout";
import {
  CANVAS,
  DANGER_INK,
  FILL_SUBTLE,
  INK_OK,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  WARNING,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type R = RouteProp<RootStackParamList, "GrowthRecord">;

/** The ink each verdict is read in — the app's three, as everywhere else. */
const LEVEL_INK: Record<GrowthLevel, string> = {
  normal: INK_OK,
  watch: WARNING,
  abnormal: DANGER_INK,
};

/** A number a carer has typed, or nothing. Blank and "12." are both nothing. */
const num = (s: string): number | null => {
  const n = Number(s.replace(",", "."));
  return s.trim() === "" || Number.isNaN(n) || n <= 0 ? null : n;
};

const one = (n: number) => n.toFixed(1);

/** "−2.1 SD" — with a real minus sign, which is what the charts print. */
const sdText = (sd: number) =>
  `${sd < 0 ? "−" : "+"}${Math.abs(sd).toFixed(1)} SD`;

/**
 * "บันทึกภาวะโภชนาการ" — one child, on the scale.
 *
 * The page a weighing round is actually worked through. Every other roster
 * in this app settles a person with a tick, because what is being recorded
 * is a yes or a no; this one cannot, because what is being recorded is four
 * numbers and what the reference tables make of them.
 *
 * It reads top to bottom in the order the work happens: measure, see what
 * the tables say, ask what the child is being fed, note whether they are
 * developing, then read the chart and the advice out to the parent. The
 * verdicts are live — they change as the weight is typed — because the
 * number is checked against the child standing there, and a carer who
 * mistypes 4.4 for 14.4 should see "ผอม" appear under their thumb rather
 * than after they have saved and moved on.
 *
 * Nothing here is written until the button at the foot is pressed, and what
 * it writes is still a draft: the sitting itself is what commits, from the
 * summary page.
 */
export function GrowthRecordScreen() {
  const nav = useNavigation<Nav>();
  const { targetId } = useRoute<R>().params;
  const insets = useSafeAreaInsets();
  const { width } = useLayout();
  const { session } = useSession();

  const row = session?.rows.find((r) => r.target.id === targetId);
  const was = row?.growth;

  // Seeded from whatever was written before, so coming back in to fix a
  // weight opens on the weight rather than on an empty form.
  const [kg, setKg] = useState(was == null ? "" : one(was.kg));
  const [cm, setCm] = useState(was == null ? "" : one(was.cm));
  const [head, setHead] = useState(was?.head == null ? "" : one(was.head));
  /*
    Where this round is being held, and therefore what the first option is.

    A school round offers "โรงเรียน" and a nursery one "ศพด." — the same
    field, filled in from the sitting rather than from a fixed list, because
    a form that offered a ศพด. to a carer standing in a school hall would be
    asked to be ignored fifty times in a morning.
  */
  const atSchool = session?.activity.rooms != null;
  const places = placesFor(atSchool);
  /*
    What this page is called, which is not one name.

    The same form serves two registers. At a ศพด. it is บัญชี 3 — ภาวะ
    โภชนาการเด็ก — and "บันทึกภาวะโภชนาการ" is the register's own word for
    it. In a classroom it is the school health round, and heading a ป.4
    register with the nursery's title claims the numbers are going
    somewhere they are not. The roster card already splits the two this
    way; the form should say the same thing.
  */
  const title = atSchool
    ? tr("บันทึกตรวจสุขภาพ", "Health check record")
    : tr("บันทึกการเจริญเติบโต", "Growth record");
  const [place, setPlace] = useState<string>(was?.place ?? places[0]);
  const [feeding, setFeeding] = useState<Feeding[]>(was?.feeding ?? []);
  const [bottle, setBottle] = useState<Bottle>(was?.bottle ?? BOTTLE[0]);
  const [development, setDevelopment] = useState<Development>(
    was?.development ?? DEVELOPMENT[0],
  );
  /*
    Which of the two "there was no weighing" questions is open.

    Asked here rather than on the roster. A carer finds out a child is not
    coming by calling their name — at which point they are already looking
    at this page, because opening it is how the name got called. On the
    roster it was two capsules under every waiting row: sixteen controls on
    a list of eight children whose one action is to open a child.
  */
  const [asking, setAsking] = useState<"absent" | "refused" | null>(null);

  const target = row?.target;
  const months = target?.months ?? 0;
  const sex = target?.sex ?? "ชาย";

  const weight = num(kg);
  const height = num(cm);
  const headCm = num(head);

  /*
    Read again on every keystroke, which is the point of it.

    Cheap — three lookups in a table of fifteen rows — and the alternative
    is a carer typing a weight, saving, and finding out on the next screen
    that the child they have just sent home is wasted.
  */
  const assessment = useMemo(
    () =>
      weight == null || height == null
        ? null
        : assess({
            sex,
            months,
            kg: weight,
            cm: height,
            head: headCm ?? undefined,
          }),
    [sex, months, weight, height, headCm],
  );

  /*
    What the centre already knew before today.

    Derived from the past weighings rather than stored as a sentence: a note
    typed last quarter goes stale and nobody edits it, while "ค่อนข้างน้อย
    ต่อเนื่อง 2 ไตรมาส" is either true of the readings or it is not.
  */
  const concern = useMemo(() => {
    const past = target?.measures ?? [];
    const light = past.filter(
      (m) =>
        weightForAge({ sex, months: m.months, kg: m.kg, cm: m.cm }).level !==
        "normal",
    ).length;
    if (light < 2) return null;
    return tr(
      `น้ำหนักต่ำกว่าเกณฑ์ต่อเนื่อง ${light} ไตรมาส`,
      `Weight below normal for ${light} consecutive quarters`,
    );
  }, [target?.measures, sex]);

  const plots = useMemo<Plot[]>(() => {
    const past = (target?.measures ?? []).map((m) => ({
      months: m.months,
      kg: m.kg,
    }));
    return weight == null ? past : [...past, { months, kg: weight }];
  }, [target?.measures, months, weight]);

  const followUp = useMemo(
    () => (assessment == null ? null : followUpFor(assessment, new Date())),
    [assessment],
  );

  const advice = useMemo(
    () =>
      assessment == null
        ? []
        : adviceFor(assessment, feeding, bottle, development),
    [assessment, feeding, bottle, development],
  );

  const headSays = useMemo(
    () => (headCm == null ? null : headOutlier(sex, months, headCm)),
    [sex, months, headCm],
  );

  if (session == null || row == null || target == null) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title={title} />
        <Text
          style={{ paddingVertical: SPACE.lg, paddingHorizontal: GUTTER, fontSize: 15, color: TEXT_SECONDARY }}
        >
          {tr(
            "ไม่พบรายชื่อนี้ใน Session ที่เปิดอยู่",
            "This name isn't in the open session",
          )}
        </Text>
      </View>
    );
  }

  const toggleFeeding = (f: Feeding) => {
    feel("tick");
    setFeeding((all) =>
      all.includes(f) ? all.filter((x) => x !== f) : [...all, f],
    );
  };

  /*
    Where this child sits in the room, and who is next after them.

    Both read before the save, because the save is what changes them: once
    this row is recorded it is no longer waiting, and `nextWaiting` would
    then hand back somebody further on.
  */
  const standing = placeOf(target.id);
  const next = nextWaiting(target.id);

  const save = () => {
    if (assessment == null || weight == null || height == null) return;
    setGrowth(target.id, {
      kg: weight,
      cm: height,
      head: headCm ?? undefined,
      months,
      place,
      feeding,
      bottle,
      development,
      level: assessment.level,
      label: assessment.label,
      at: new Date().toISOString(),
    });
    feel("success");
    toast(
      tr(
        `บันทึก ${target.name} · ${assessment.label}`,
        `Saved ${target.name} · ${growthText(assessment.label)}`,
      ),
      assessment.level === "normal" ? "success" : "warning",
    );
    /*
      Straight on to the next child, not back to the list.

      A room is eight children, or fifty, and every one of them used to
      cost four actions: save, land on the roster, find the next name, open
      it. Three of those are the app's own work. Replacing rather than
      pushing keeps the back arrow pointing at the roster instead of
      building a stack of children behind it.
    */
    if (next == null) {
      nav.goBack();
      return;
    }
    nav.replace("GrowthRecord", { targetId: next.id });
  };

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      {/*
        The past, behind a button rather than under the form.

        Four sections of history at the foot of a page whose job is to take
        four numbers is four sections between a carer and the boxes. It is
        also the wrong place to READ it from: knowing what this child weighed
        last quarter is a question somebody asks without a child on the
        scale, and answering it meant opening a recording form.
      */}
      <ScreenHeader
        title={title}
        right={
          <ToolbarPill
            slots={[
              {
                icon: (
                  <History size={20} color={TEXT_PRIMARY} strokeWidth={2.2} />
                ),
                label: tr("ประวัติการชั่ง", "Weighing history"),
                onPress: () =>
                  nav.navigate("GrowthHistory", { targetId: target.id }),
              },
            ]}
          />
        }
      />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            ...readable(FORM_MAX),
            paddingHorizontal: GUTTER,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + 120,
            gap: SPACE.md,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Who is on the scale. The verdict rides on this card rather than
              at the foot of the page: it is the answer to everything below
              it, and a carer scrolling back up to see it would be reading
              the form backwards. */}
          {/* Who is on the scale. */}
          <Card style={{ gap: SPACE.sm }}>
            {/* The verdict is not here. It belongs beside the rows it is
                read from, on section 2's own heading, which is where the
                design puts it and where a second copy of it stops being a
                second copy. */}
            <Text
              style={{
                fontSize: 20,
                lineHeight: 30,
                fontWeight: "800",
                color: TEXT_PRIMARY,
              }}
            >
              {target.name}
            </Text>

            {/*
              Who they are, on two lines instead of three.

              The sex, the age and the HN are one thought — they are how a
              carer confirms they have the right child in front of them —
              and splitting the HN onto a line of its own made the card four
              lines deep before the form began. Where they are from is the
              second line, because that is the one that changes between a
              class and a centre.
            */}
            <Text
              style={{ fontSize: 13, lineHeight: 20, color: TEXT_SECONDARY }}
            >
              {`${sexLabel(target.sex)} · ${ageLabel(months)} · HN ${target.hn}`}
            </Text>
            {/* Where in the room, so a carer working down a class of fifty
                knows how far through they are without leaving the form. */}
            <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
              {standing == null
                ? target.room
                : tr(
                    `${target.room} · คนที่ ${standing.at} จาก ${standing.of}`,
                    `${target.room} · ${standing.at} of ${standing.of}`,
                  )}
            </Text>
            {concern != null && (
              <Text style={{ fontSize: 13, lineHeight: 20, color: DANGER_INK }}>
                {`${tr("ประวัติ", "History")}: ${concern}`}
              </Text>
            )}

            {/*
              The child who is not standing on the scale.

              Below a rule rather than floating under the name: they are the
              only two controls on this card and without a line above them
              they read as two more facts about the child. They stay on the
              card — it is the answer to "why is this form empty" and it
              belongs with the child, not in the tray, which is for the
              thing the page is actually for.
            */}
            <View
              style={{
                height: 1,
                backgroundColor: SEPARATOR,
                marginTop: SPACE.xs,
              }}
            />
            <View style={{ flexDirection: "row", gap: SPACE.sm }}>
              <Chip
                label={tr("ไม่มารับบริการ", "Not present")}
                onPress={() => {
                  feel("tick");
                  setAsking("absent");
                }}
              />
              <Chip
                label={tr("ปฏิเสธ", "Refused")}
                onPress={() => {
                  feel("tick");
                  setAsking("refused");
                }}
              />
            </View>
          </Card>

          {/*
            1 · the numbers.

            Every section is a card with its own heading inside it, the way
            the home visit and the screenings are built — not a grey label
            floating above a card. A heading that lives outside the thing it
            names leaves the page reading as a stack of unrelated boxes with
            captions between them.
          */}
          <Card style={{ gap: SPACE.lg }}>
            <CardHeading
              icon={<Ruler size={13} color={PRIMARY_500} strokeWidth={2.4} />}
              title={tr("1 · การวัด", "1 · Measurements")}
            />
            <View style={{ flexDirection: "row", gap: SPACE.md }}>
              <View style={{ flex: 1 }}>
                <TextField
                  label={tr("น้ำหนัก (กก.)", "Weight (kg)")}
                  value={kg}
                  onChangeText={setKg}
                  keyboardType="decimal-pad"
                  required
                  placeholder="0.0"
                  // The first thing done on this page is type a weight, so
                  // the pad is already up when it opens. One tap saved on
                  // every child in the room.
                  autoFocus
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label={tr("ส่วนสูง / ความยาว (ซม.)", "Height / length (cm)")}
                  value={cm}
                  onChangeText={setCm}
                  keyboardType="decimal-pad"
                  required
                  placeholder="0.0"
                />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: SPACE.md }}>
              {/*
                The tape comes out at a ศพด. and not at a school.

                Judged by the round rather than by the child's own age. It
                was hidden past sixty months, which took it off the form for
                the oldest child in a nursery — a five-and-a-half-year-old
                on a บัญชี 3 round, whose head the register asks for like
                everybody else's. What actually decides it is which register
                is being filled in: the nought-to-five form asks, the school
                health form does not.
              */}
              {!atSchool && (
                <View style={{ flex: 1 }}>
                  <TextField
                    label={tr("เส้นรอบศีรษะ (ซม.)", "Head circumference (cm)")}
                    value={head}
                    onChangeText={setHead}
                    keyboardType="decimal-pad"
                    placeholder="0.0"
                    ink={headSays == null ? undefined : DANGER_INK}
                  />
                </View>
              )}
              {/* Not a field. The age is the child's, worked out from the
                  register, and a box a carer can type into is a box a carer
                  can type the wrong thing into — every verdict on this page
                  is read against it. */}
              <View style={{ flex: 1, gap: SPACE.sm }}>
                <Text
                  style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}
                >
                  {tr("อายุขณะวัด", "Age at measurement")}
                </Text>
                <View
                  style={{
                    height: 48,
                    borderRadius: RADIUS.capsule,
                    backgroundColor: FILL_SUBTLE,
                    paddingHorizontal: SPACE.lg,
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: TEXT_SECONDARY,
                    }}
                  >
                    {ageLabel(months)}
                  </Text>
                </View>
              </View>
            </View>

            {!atSchool && (
              <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
                {tr(
                  `ค่ากลางเส้นรอบศีรษะตามอายุประมาณ ${one(headMedian(sex, months))} ซม.`,
                  `Median head circumference for age is about ${one(headMedian(sex, months))} cm`,
                )}
                {headSays == null
                  ? ""
                  : tr(
                      ` · วัดได้${headSays}`,
                      ` · measured ${growthText(headSays).toLowerCase()}`,
                    )}
              </Text>
            )}

            <View style={{ height: 1, backgroundColor: SEPARATOR }} />

            <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>
              {tr("สถานที่ให้บริการ", "Service location")}
            </Text>
            <Row>
              {places.map((p) => (
                <Chip
                  key={p}
                  label={growthText(p)}
                  on={place === p}
                  onPress={() => {
                    feel("tick");
                    setPlace(p);
                  }}
                />
              ))}
            </Row>
          </Card>

          {/* 2 · what the tables say ----------------------------------- */}
          <Card style={{ gap: SPACE.lg }}>
            <CardHeading
              icon={
                <TrendingUp size={13} color={PRIMARY_500} strokeWidth={2.4} />
              }
              title={tr("2 · ผลประเมินการเจริญเติบโต", "2 · Growth assessment")}
              action={
                assessment == null ? undefined : (
                  <StatusTag
                    label={GROWTH_LEVEL_LABEL[assessment.level]}
                    ink={LEVEL_INK[assessment.level]}
                    Icon={
                      assessment.level === "normal"
                        ? CircleCheck
                        : TriangleAlert
                    }
                  />
                )
              }
            />
            {assessment == null ? (
              <Text style={{ fontSize: 14, lineHeight: 22, color: TEXT_MUTED }}>
                {tr(
                  "กรอกน้ำหนักและส่วนสูงเพื่อประเมิน",
                  "Enter weight and height to assess",
                )}
              </Text>
            ) : (
              <>
                {assessment.verdicts.map((v, i) => (
                  <VerdictRow key={v.index} verdict={v} first={i === 0} />
                ))}

                {/*
                  Where the figures come from, under the figures.

                  Shown only once there are some. An empty section carrying
                  three lines of small print about reference tables is the
                  page explaining its workings before it has done any, and
                  it sat between the boxes and everything below them.
                */}
                <View
                  style={{
                    flexDirection: "row",
                    gap: SPACE.sm,
                    padding: SPACE.md,
                    borderRadius: RADIUS.md,
                    backgroundColor: FILL_SUBTLE,
                  }}
                >
                  <Info
                    size={14}
                    color={TEXT_MUTED}
                    strokeWidth={2.2}
                    style={{ marginTop: 2 }}
                  />
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 12,
                      lineHeight: 18,
                      color: TEXT_MUTED,
                    }}
                  >
                    {REFERENCE_NOTE}
                  </Text>
                </View>

                {/*
                  The same verdict as a picture, in the same card.

                  It was a card of its own under two others, which made the
                  three rows above and the line below them two separate
                  things to read — and they are one: the rows say −2.1 SD
                  and the chart says which way the child is going. It is
                  also the half a parent can actually be shown.
                */}
                <View style={{ height: 1, backgroundColor: SEPARATOR }} />
                <Text
                  style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}
                >
                  {tr(
                    "เส้นกลาง = ค่ากลาง · เส้นบน/ล่าง = +2SD / −2SD",
                    "Middle line = median · upper/lower lines = +2SD / −2SD",
                  )}
                </Text>
                <GrowthChart sex={sex} points={plots} />
              </>
            )}
          </Card>

          {/* 3 · what the child is being given ------------------------- */}
          <Card style={{ gap: SPACE.lg }}>
            <CardHeading
              icon={
                <UtensilsCrossed
                  size={13}
                  color={PRIMARY_500}
                  strokeWidth={2.4}
                />
              }
              title={tr(
                "3 · อาหาร ขวดนม และพัฒนาการ",
                "3 · Feeding, bottle and development",
              )}
            />
            <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>
              {tr(
                "อาหารที่ได้รับ (เลือกได้หลายข้อ)",
                "Food given (select all that apply)",
              )}
            </Text>
            <Row>
              {FEEDING.map((f) => (
                <Chip
                  key={f}
                  label={growthText(f)}
                  on={feeding.includes(f)}
                  onPress={() => toggleFeeding(f)}
                />
              ))}
            </Row>

            <View style={{ height: 1, backgroundColor: SEPARATOR }} />

            <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>
              {tr("การใช้ขวดนม", "Bottle use")}
            </Text>
            <Row>
              {BOTTLE.map((b) => (
                <Chip
                  key={b}
                  label={growthText(b)}
                  on={bottle === b}
                  onPress={() => {
                    feel("tick");
                    setBottle(b);
                  }}
                />
              ))}
            </Row>
            <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
              {tr(
                "บันทึกพฤติกรรมการกินเพื่อใช้ให้คำแนะนำรายบุคคล",
                "Eating habits are recorded to give individual advice",
              )}
            </Text>

            {/*
              4 · พัฒนาการ, in the same card as the feeding.

              Two cards for two multiple-choice questions asked of the same
              parent in the same breath, neither of which the verdict above
              depends on. One card, one rule between them — and a form that
              is two screens shorter for a carer doing this fifty times.
            */}
            <View style={{ height: 1, backgroundColor: SEPARATOR }} />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.sm,
              }}
            >
              <Baby size={13} color={PRIMARY_500} strokeWidth={2.4} />
              <Text
                style={{
                  flex: 1,
                  fontSize: 14,
                  lineHeight: 21,
                  fontWeight: "600",
                  color: TEXT_PRIMARY,
                }}
              >
                {tr("ระดับพัฒนาการ", "Development")}
              </Text>
              <StatusTag
                label={growthText(development)}
                ink={
                  development === "สมวัย"
                    ? INK_OK
                    : development === "ล่าช้า"
                      ? DANGER_INK
                      : WARNING
                }
              />
            </View>
            <Row>
              {DEVELOPMENT.map((d) => (
                <Chip
                  key={d}
                  label={growthText(d)}
                  on={development === d}
                  onPress={() => {
                    feel("tick");
                    setDevelopment(d);
                  }}
                />
              ))}
            </Row>
            <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
              {development === "สมวัย"
                ? tr(
                    "สมวัย = ไม่ต้องเปิดรายละเอียดเพิ่ม",
                    "Age-appropriate = no further detail needed",
                  )
                : tr(
                    "จะเข้าคิวประเมินตามแบบ DSPM และนัดติดตามให้อัตโนมัติ",
                    "Will be queued for DSPM assessment with a follow-up booked automatically",
                  )}
            </Text>
          </Card>

          {/* And what happens next -------------------------------------- */}
          {followUp != null && (
            <>
              <Card style={{ gap: SPACE.lg }}>
                <CardHeading
                  icon={
                    <ClipboardList
                      size={13}
                      color={PRIMARY_500}
                      strokeWidth={2.4}
                    />
                  }
                  title={tr("คำแนะนำและงานติดตาม", "Advice and follow-up")}
                />
                <View
                  style={{
                    flexDirection: "row",
                    gap: SPACE.sm,
                    alignItems: "flex-start",
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      marginTop: 6,
                      backgroundColor: LEVEL_INK[followUp.level],
                    }}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        lineHeight: 23,
                        fontWeight: "700",
                        color: LEVEL_INK[followUp.level],
                      }}
                    >
                      {followUp.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        lineHeight: 21,
                        color: TEXT_SECONDARY,
                      }}
                    >
                      {followUp.detail}
                    </Text>
                  </View>
                </View>

                <View style={{ height: 1, backgroundColor: SEPARATOR }} />

                {advice.map((line) => (
                  <View
                    key={line}
                    style={{ flexDirection: "row", gap: SPACE.sm }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        lineHeight: 21,
                        color: TEXT_MUTED,
                      }}
                    >
                      ·
                    </Text>
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 13,
                        lineHeight: 21,
                        color: TEXT_SECONDARY,
                      }}
                    >
                      {line}
                    </Text>
                  </View>
                ))}
              </Card>
            </>
          )}
        </ScrollView>
      </HeaderFade>

      {/*
        One button, and it says what it is about to write.

        Not "บันทึก": the thing being saved is a verdict about a child, and
        the carer is going to read that verdict out to a parent in a moment.
        A button that names it is a last chance to notice that the scale said
        4.4 rather than 14.4.
      */}
      <ActionBar
        side={width < 600 ? 25 : Math.max(25, (width - FORM_MAX) / 2 + 25)}
      >
        <PrimaryAction
          label={
            assessment == null
              ? tr("กรอกน้ำหนักและส่วนสูง", "Enter weight and height")
              : next == null
                ? tr(
                    `บันทึก · ${assessment.label}`,
                    `Save · ${growthText(assessment.label)}`,
                  )
                : tr(
                    `บันทึก · ${assessment.label} → คนถัดไป`,
                    `Save · ${growthText(assessment.label)} → next`,
                  )
          }
          disabled={assessment == null}
          onPress={save}
        />
      </ActionBar>

      <ReasonSheet
        visible={asking != null}
        title={
          asking === "absent"
            ? tr("ไม่มารับบริการ", "Not present")
            : tr("ปฏิเสธรับบริการ", "Refused service")
        }
        name={target.name}
        who={`HN ${target.hn} · ${sexLabel(target.sex)} · ${ageLabel(months)}`}
        reasons={asking === "absent" ? ABSENT_REASONS : REFUSED_REASONS}
        question={
          asking === "absent"
            ? tr("สาเหตุที่ไม่มารับบริการ", "Reason not present")
            : tr("สาเหตุที่ปฏิเสธ", "Reason for refusal")
        }
        confirmLabel={
          asking === "absent"
            ? tr("บันทึกไม่มารับบริการ", "Record as not present")
            : tr("บันทึกปฏิเสธ", "Record as refused")
        }
        note={tr(
          "สาเหตุจะถูกเก็บไว้กับรายชื่อนี้ และใช้จัดคิวติดตามรอบหน้า",
          "The reason is kept with this name and used to queue follow-up for the next round",
        )}
        onClose={() => setAsking(null)}
        onConfirm={(reason) => {
          if (asking == null) return;
          setOutcome(target.id, asking, reason);
          feel("tick");
          toast(
            tr(
              `บันทึก${asking === "absent" ? "ไม่มารับบริการ" : "ปฏิเสธ"} ${target.name} แล้ว`,
              `${target.name} recorded as ${asking === "absent" ? "not present" : "refused"}`,
            ),
            "success",
          );
          setAsking(null);
          // Back to the room: this page is about a weighing, and there is
          // not going to be one.
          nav.goBack();
        }}
      />
    </View>
  );
}

/** A row of chips that wraps, which is all any of these sections needs. */
const Row = ({ children }: { children: React.ReactNode }) => (
  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
    {children}
  </View>
);

/**
 * One choice, drawn the way every other form in this app draws one.

 * A flat capsule — the page's own grey when it is off and the app's blue
 * when it is on — which is what the home visit, the screening and the
 * assessments all use. It was Liquid Glass here, and glass on an opaque
 * white card has nothing behind it to refract: the two exception chips came
 * out as bare words with no edge at all, which is a control that does not
 * look like one.
 */
function Chip({
  label,
  on = false,
  onPress,
}: {
  label: string;
  on?: boolean;
  onPress: () => void;
}) {
  // The shared chip; the callers here tick for themselves, some of them
  // only when the choice goes through.
  return (
    <ChoiceChip
      label={label}
      on={on}
      onPress={onPress}
      accessibilityRole="button"
      haptic={false}
    />
  );
}

/**
 * One of the three readings: what it is, what band it fell in, and the
 * arithmetic underneath.
 *
 * The band's own word is the heading and the SD is set beside it, because
 * "ค่อนข้างผอม" is what gets said to a parent and "−1.8 SD" is what gets
 * argued about in a meeting. The line under both says what was measured
 * against what, which is the only way a carer can tell a wrong reading from
 * a thin child.
 */
function VerdictRow({
  verdict: v,
  first,
}: {
  verdict: Verdict;
  first: boolean;
}) {
  const ink = LEVEL_INK[v.level];
  const unit = v.index === "heightForAge" ? tr("ซม.", "cm") : tr("กก.", "kg");
  const against =
    v.index === "weightForHeight"
      ? tr("ตามส่วนสูง", "for height")
      : tr("ตามอายุ", "for age");
  return (
    <View style={{ gap: SPACE.sm }}>
      {first ? null : (
        <View style={{ height: 1, backgroundColor: SEPARATOR }} />
      )}
      <View style={{ flexDirection: "row", gap: SPACE.md }}>
        <Text
          style={{
            width: 96,
            fontSize: 13,
            lineHeight: 21,
            color: TEXT_MUTED,
          }}
        >
          {INDEX_LABEL[v.index]}
        </Text>
        <View style={{ flex: 1, gap: 2 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              gap: SPACE.sm,
            }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 15,
                lineHeight: 23,
                fontWeight: "700",
                color: ink,
              }}
            >
              {growthText(v.label)}
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: ink,
                fontVariant: ["tabular-nums"],
              }}
            >
              {sdText(v.sd)}
            </Text>
          </View>
          <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
            {tr(
              `วัดได้ ${one(v.value)} ${unit} · ค่ากลาง${against} ${one(v.median)} ${unit}`,
              `Measured ${one(v.value)} ${unit} · median ${against} ${one(v.median)} ${unit}`,
            )}
          </Text>
        </View>
      </View>
    </View>
  );
}
