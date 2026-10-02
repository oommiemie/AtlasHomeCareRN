import { Children, Profiler, useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Calendar, ChevronLeft, MapPin } from "lucide-react-native";

import { Chevron } from "../components/Chevron";
import { BmiChart } from "../components/BmiGauge";
import { Card } from "../components/Card";
import { SectionHeader } from "../components/SectionHeader";
import { VisitDetailSheet } from "../components/VisitDetailSheet";
import type { PastVisit } from "../models/community";
import { assessmentIcon, Glyph } from "../components/AssessmentUI";
import { Glass } from "../components/Glass";
import { Floating } from "../components/BlurStage";
import { GlassIconButton } from "../components/GlassIconButton";
import { ToolbarPill } from "../components/ToolbarPill";
import { Segments } from "../components/Segments";
import { VisitBadge, VisitCard } from "../components/VisitCard";
import { openTask } from "../navigation/openTask";
import {
  assessmentsFor,
  visitTimeline,
  type TimelineVisit,
  visitsFor,
} from "../models/residentRecord";
import {
  AvatarWithGender,
  HeroTag,
  NameWithAge,
} from "../components/HeroTag";
import { DotHalo } from "../components/DotHalo";
import { EcgTrace } from "../components/EcgTrace";
import { HealthBriefSheet } from "../components/HealthBriefSheet";
import { PressableScale } from "../components/PressableScale";
import { Sparkline, shade } from "../components/Sparkline";
import { toast } from "../components/Toast";
import { UIcon, type UIconName } from "../components/UIcon";
import { readSums, resetSums, since, timed } from "../utils/perf";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  bmiFraction,
  bmiHealthy,
  bmiLabel,
  bmiOf,
  houseOfResident,
  initialOf,
  SCREENING_LABEL,
  type Resident,
  type Screening,
  type ScreeningKind,
} from "../models/household";
import { summariseResident, type HealthBrief } from "../models/patientAi";
import { planToday, visitStateOf, visitTypeLabel } from "../models/task";
import {
  formatReading,
  latestVitals,
  metricOf,
  severityOf,
  sparkFor,
  statusOf,
  type Metric,
  type MetricKind,
  type Reading,
} from "../models/vitals";
import {
  screeningStamp,
  thaiMonthYear,
  thaiShortDate,
  thaiTime,
  THAI_WEEKDAYS,
} from "../utils/thaiDate";
import {
  CANVAS,
  DANGER,
  PRIMARY_500,
  SUCCESS,
  TEXT_DISABLED,
  RADIUS,
  SPACE,
  TEXT_PRIMARY,
  SURFACE,
  TEXT_MUTED,
  TINT_BG,
  TYPE,
} from "../theme/tokens";
import {
  CONTENT_MAX,
  cardWidth as gridCard,
  readable,
  useLayout,
  GUTTER,
} from "../theme/layout";
import { tr } from "../i18n";
import { HeaderWash } from "../components/ScreenHeader";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** The design's spacing — Figma 363:44088. */
const PAGE = {
  /** Between the stacked cards. */
  gap: 10,
  heroGap: 10,
  card: { radius: 24, pad: 16 },
} as const;

/**
 * The page's blocks, in the heights the design stacks them at — Figma
 * 371:45763.
 *
 * A mosaic rather than a grid of identical tiles: the two readings that carry
 * a picture get the room for one, the pair always taken together sit stacked
 * beside it, and blood pressure runs the width because it is the only one
 * with two numbers to show.
 */
/**
 * The device tile at the foot of the CGM card — Figma 371:46179.
 *
 * The picture is taller than the box it sits on and hangs over its top edge
 * by `overhang`; neither the box nor the frame around it clips.
 */
const TILE = {
  height: 76,
  overhang: 8,
  art: { width: 144, height: 79 },
} as const;

/**
 * The picture at the foot of a card that ends in one — the heart, and the
 * sugar cubes.
 *
 * Drawn at 70 by 100, which is exactly the size the artwork was exported at:
 * heart_3d@3x is 210 by 300, so on a 3x screen every pixel of the file landed
 * on one of the screen's. Anything larger is the file being stretched.
 *
 * This is larger, deliberately. At its exported size the heart read as a mark
 * on the card rather than as the card's subject, and a fifth again is still
 * inside what a 3D render carries — the shading is soft to begin with and has
 * no fine detail to lose. Past about this it starts to look like a photograph
 * that has been pulled, which is the one thing on a page like this that reads
 * as a mistake. Bigger than this wants a bigger export, not a bigger number.
 *
 * The height it takes comes off the trace above it: the card is pinned to
 * `ROW.tall`, which is the two cards beside it stacked, and cannot grow
 * without breaking the row.
 */
const ART = { width: 84, height: 120, halo: 196 } as const;

/**
 * How wide the page's column grows. A reading column on a tablet held
 * upright; across a landscape iPad, room for the mosaic's two halves side
 * by side.
 */
const pageMax = (_wide: boolean) => CONTENT_MAX;

const ROW = {
  cgm: 274,
  half: 132,
  bp: 148,
  pair: 144,
  tall: 298,
} as const;

/**
 * One patient's health profile: who they are and what they live with, their
 * readings between visits, and how they last screened.
 *
 * It was two pages about the same person. The record sheet a house opened
 * held the contact, the conditions, the BMI and the screening results; this
 * page, opened from the follow-up list, held the readings — and each had the
 * same avatar, name, call buttons and age/sex/blood row at its head. A carer
 * who met the patient at the house saw half of them, and one who came from
 * the follow-up list saw the other half. It is one page now, whichever way
 * in, and it is a page rather than a sheet: there is too much of it to sit
 * in something the finger closes by accident.
 *
 * The readings — Figma 363:44088.
 *
 * The page is a column of cards, one per metric, each carrying the latest
 * figure, when it was taken, and the shape of the last week under it. There
 * is no chooser and no shared chart: the design's judgement, and the right
 * one — six metrics behind one selector meant five of them were invisible,
 * and the question this page is opened with is "is anything off", which is a
 * question about all six at once.
 *
 * Each card's arrow leads to that metric's own page, where the window can be
 * widened and the thresholds are drawn.
 */
export function HealthTrackingScreen() {
  const { resident } =
    useRoute<RouteProp<RootStackParamList, "HealthTracking">>().params;
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const house = houseOfResident(resident.id);
  resetSums();
  const latest = timed("latestVitals", () => latestVitals(resident));

  const [brief, setBrief] = useState<HealthBrief | null>(null);
  const [asking, setAsking] = useState(true);
  const [reading, setReading] = useState(false);
  const [tab, setTab] = useState<Tab>("summary");
  const { wide } = useLayout();

  // Asked once per record. The page is fully readable before it answers, and
  // the card holds a line of its own until it does.
  useEffect(() => {
    let live = true;
    setAsking(true);
    summariseResident(resident, latest).then((result) => {
      if (!live) return;
      if (result == null)
        toast(tr("สรุปด้วย AI ไม่สำเร็จ", "AI summary failed"), "warning");
      setBrief(result);
      setAsking(false);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resident.id]);

  // The summary tab's blocks, laid out below in one column or two.
  const mosaicTop = (
    <View style={{ flexDirection: "row", gap: PAGE.gap }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <VitalCard
          resident={resident}
          kind="cgm"
          reading={latest.cgm}
          height={ROW.cgm}
          chart
          tile={require("../../assets/images/cgm_device.png")}
          onPress={() => nav.navigate("CgmDetail", { resident })}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: PAGE.gap }}>
        <SummaryTile
          height={ROW.half}
          brief={brief}
          loading={asking}
          onPress={() => setReading(true)}
        />
        <VitalCard
          resident={resident}
          kind="spo2"
          reading={latest.spo2}
          height={ROW.half}
          onPress={() =>
            nav.navigate("VitalDetail", { resident, kind: "spo2" })
          }
        />
      </View>
    </View>
  );
  const bpCard = (
    <VitalCard
      resident={resident}
      kind="bp"
      reading={latest.bp}
      height={ROW.bp}
      chart
      beside
      onPress={() => nav.navigate("VitalDetail", { resident, kind: "bp" })}
    />
  );
  const bmiCard = (
    <Card onPress={() => nav.navigate("BmiDetail", { resident })}>
      <BmiChart
        value={bmiOf(resident)}
        fraction={bmiFraction(resident)}
        label={bmiLabel(resident)}
        healthy={bmiHealthy(resident)}
        weightKg={resident.weightKg}
        heightCm={resident.heightCm}
      />
    </Card>
  );
  const pairRow = (
    <View style={{ flexDirection: "row", gap: PAGE.gap }}>
      <View style={{ flex: 1, minWidth: 0, gap: PAGE.gap }}>
        <VitalCard
          resident={resident}
          kind="glucose"
          reading={latest.glucose}
          height={ROW.pair}
          onPress={() =>
            nav.navigate("VitalDetail", { resident, kind: "glucose" })
          }
        />
        <VitalCard
          resident={resident}
          kind="temp"
          reading={latest.temp}
          height={ROW.pair}
          onPress={() =>
            nav.navigate("VitalDetail", { resident, kind: "temp" })
          }
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <VitalCard
          resident={resident}
          kind="pulse"
          reading={latest.pulse}
          height={ROW.tall}
          chart
          art={require("../../assets/images/heart_3d.png")}
          onPress={() =>
            nav.navigate("VitalDetail", { resident, kind: "pulse" })
          }
        />
      </View>
    </View>
  );
  const waistCard = (
    <>
      {/* The tape measure, last: it is taken at a visit rather than by an
              instrument that reports on its own, so it changes least often
              and sits below the readings that move. */}
      <VitalCard
        resident={resident}
        kind="waist"
        reading={latest.waist}
        height={ROW.bp}
        chart
        // The pressure card's own arrangement: the reading on the left and
        // the trace beside it, which is what a full-width card wants.
        beside
        onPress={() => nav.navigate("VitalDetail", { resident, kind: "waist" })}
      />
    </>
  );
  const screenings = (
    <>
      {/* Last, under the readings: a screening is taken once at a visit
                and read for what it found, where the readings above move by
                the day. */}
      {resident.screenings.length > 0 && (
        <>
          <Heading
            title={tr("ผลคัดกรองความเสี่ยง", "Risk screening results")}
          />
          {chunk(resident.screenings, 2).map((row, i) => (
            <View key={i} style={{ flexDirection: "row", gap: PAGE.gap }}>
              {row.map((sc) => (
                <ScreeningCard key={sc.name} screening={sc} />
              ))}
              {row.length === 1 && <View style={{ flex: 1 }} />}
            </View>
          ))}
        </>
      )}
    </>
  );

  return (
    <Profiler
      id="HealthTracking"
      onRender={(_id, phase, actual, base) => {
        // The measurement stays; the reporting is for whoever is measuring.
        if (!__DEV__) return;
        console.log(
          `[perf] ${phase} render=${actual.toFixed(1)}ms base=${base.toFixed(1)}ms ` +
            `sums=${JSON.stringify(readSums())} sincePress=${since("press")}ms`,
        );
      }}
    >
      <View style={{ flex: 1, backgroundColor: CANVAS }}>
        {/*
        The accept-task screen's chrome: art behind the head of the page, no
        title, and the back button floating over it.

        A titled bar would be naming the page over a portrait of the person it
        is about — the avatar and the name under it are the title, and they
        are already the first thing on the page.
      */}
        {/* The same pale wash every pushed screen opens with, rather than
            the streaked-glass picture this page alone still carried. */}
        <HeaderWash height={insets.top + 335} />

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: GUTTER,
            // Beside the back button rather than under it — the avatar is
            // centred and the button at the edge, so the two share the row —
            // with the avatar's top a little below the button's, so the
            // page does not start hard against the status bar.
            paddingTop: insets.top + 32,
            paddingBottom: insets.bottom + SPACE.huge,
            gap: PAGE.gap,
            width: "100%",
            maxWidth: pageMax(wide),
            alignSelf: "center",
          }}
          showsVerticalScrollIndicator={false}
        >
          <Hero resident={resident} />

          {/* The profile's parts, under the name: the readings, the visits,
              and the assessments — three things a carer opens a person
              for, which were one long page with only the first of them. */}
          <View
            style={{
              marginTop: SPACE.sm,
              marginBottom: SPACE.xs,
              ...readable(),
            }}
          >
            <Segments
              labels={TABS.map((t) => TAB_LABEL[t])}
              index={TABS.indexOf(tab)}
              onChange={(i) => setTab(TABS[i] ?? tab)}
            />
          </View>

          {tab === "visits" && <VisitsTab resident={resident} />}
          {tab === "assessments" && <AssessmentsTab resident={resident} />}
          {tab === "summary" && (
            <>
              <Heading title={tr("สัญญาณชีพ", "Vital signs")} />

              {/*
                On a phone, the mosaic in one column as the design stacks it.
                Across a wide window its two halves stand side by side — the
                readings that move by the hour on the left, the slower ones
                and the screenings on the right — each half the same mosaic
                at the width it was drawn for, rather than one stretched to a
                foot wide.
              */}
              {wide ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: PAGE.gap,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: PAGE.gap }}>
                    {mosaicTop}
                    {bpCard}
                    {bmiCard}
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: PAGE.gap }}>
                    {pairRow}
                    {waistCard}
                    {screenings}
                  </View>
                </View>
              ) : (
                <>
                  {mosaicTop}
                  {bpCard}
                  {bmiCard}
                  {pairRow}
                  {waistCard}
                  {screenings}
                </>
              )}
            </>
          )}
        </ScrollView>

        <HealthBriefSheet
          visible={reading}
          resident={resident}
          brief={brief}
          loading={asking}
          onClose={() => setReading(false)}
        />

        <Floating>
          <View
            style={{
              position: "absolute",
              top: insets.top + SPACE.sm,
              left: GUTTER,
            }}
          >
            <GlassIconButton
              onPress={() => nav.goBack()}
              accessibilityLabel={tr("ย้อนกลับ", "Back")}
            >
              <ChevronLeft size={24} color={TEXT_PRIMARY} strokeWidth={2.4} />
            </GlassIconButton>
          </View>
          {/* The ways to reach them, in the header's own toolbar rather than
              a row of buttons under the name: they are things to do about
              the page, where every other page keeps those. */}
          <View
            style={{
              position: "absolute",
              top: insets.top + SPACE.sm,
              right: GUTTER,
            }}
          >
            <ToolbarPill
              slots={[
                {
                  icon: (
                    <UIcon name="phoneFlip" size={20} color={TEXT_PRIMARY} />
                  ),
                  label: tr(`โทรหา ${resident.name}`, `Call ${resident.name}`),
                  // A member added at the house has no number yet: said,
                  // rather than handed to the dialler to fail on.
                  onPress: () =>
                    hasPhone(resident)
                      ? Linking.openURL(`tel:${resident.phone}`).catch(() =>
                          toast(
                            tr("โทรออกไม่ได้", "Couldn't place the call"),
                            "error",
                          ),
                        )
                      : toast(
                          tr(
                            "ยังไม่มีเบอร์โทรศัพท์ของผู้ป่วยรายนี้",
                            "No phone number for this patient yet",
                          ),
                          "warning",
                        ),
                },
                {
                  icon: (
                    <UIcon
                      name="videoCameraAlt"
                      size={20}
                      color={TEXT_PRIMARY}
                    />
                  ),
                  label: tr(
                    `วิดีโอคอล ${resident.name}`,
                    `Video call ${resident.name}`,
                  ),
                  onPress: () =>
                    toast(
                      tr(
                        "วิดีโอคอลยังไม่เปิดใช้งาน",
                        "Video calls aren't available yet",
                      ),
                    ),
                },
                // Where they live: the house alone on the map.
                ...(house == null
                  ? []
                  : [
                      {
                        icon: (
                          <MapPin
                            size={20}
                            color={TEXT_PRIMARY}
                            strokeWidth={2.2}
                          />
                        ),
                        label: tr(
                          `ที่อยู่ของ ${resident.name}`,
                          `${resident.name}'s address`,
                        ),
                        onPress: () =>
                          nav.navigate("HouseMap", { focus: house }),
                      },
                    ]),
                // The assistant, about this person (see assistantFocus).
                {
                  icon: (
                    <UIcon name="sparkles" size={20} color={TEXT_PRIMARY} />
                  ),
                  label: tr(
                    `ถามผู้ช่วยเรื่อง ${resident.name}`,
                    `Ask the assistant about ${resident.name}`,
                  ),
                  onPress: () => nav.navigate("Assistant"),
                },
              ]}
            />
          </View>
        </Floating>
      </View>
    </Profiler>
  );
}

function Hero({ resident }: { resident: Resident }) {
  return (
    <View
      style={{
        alignItems: "center",
        gap: PAGE.heroGap,
        marginBottom: SPACE.xs,
      }}
    >
      {/*
        The avatar on Apple's glass, tinted rather than filled — the record
        sheet's own treatment. 0.95 is as saturated as the blue goes while the
        material still shows: the tint is painted OVER the glass, not mixed
        into it, so a full 1.0 leaves a flat disc.
      */}
      {/* The patient's sex hangs off the avatar; their age rides after
          the name. */}
      <AvatarWithGender size={80} gender={resident.gender}>
        <Glass
          tintColor="rgba(0,145,255,0.95)"
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 24, fontWeight: "600", color: "#FFFFFF" }}>
            {initialOf(resident.name)}
          </Text>
        </Glass>
      </AvatarWithGender>

      <View style={{ marginTop: SPACE.sm }}>
        <NameWithAge name={resident.name} age={resident.age} />
      </View>

      {/* The standing facts as tags under the name, as every page that opens
          on a patient carries them. They were a white card of three columns
          here, the one page that drew them that way. */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: SPACE.sm,
        }}
      >
        {resident.bloodType.trim() !== "" && (
          <HeroTag label={resident.bloodType} />
        )}
      </View>

      {/* What they live with, straight under the name — as the patient page
          of a visit prints it, because it is the first thing that decides
          how the rest of this page is read. Nothing at all when there is
          none. */}
      {conditionsOf(resident).length > 0 && (
        <Text
          numberOfLines={2}
          style={{
            fontSize: 15,
            lineHeight: 21,
            fontWeight: "600",
            color: TEXT_PRIMARY,
            textAlign: "center",
          }}
        >
          {conditionsOf(resident).join(" · ")}
        </Text>
      )}
    </View>
  );
}

/** A heading between the page's parts, with the room above it a part wants. */
function Heading({ title, count }: { title: string; count?: number }) {
  return (
    <View style={{ marginTop: SPACE.sm }}>
      <SectionHeader title={title} count={count} flush />
    </View>
  );
}

const hasPhone = (r: Resident) => r.phone.trim() !== "";

/**
 * The chronic conditions, read off the screenings rather than stored.
 *
 * A resident record has no condition field of its own; what it has is the
 * panel, and the ones that came back at risk are the answer to the question.
 * Derived, the two can never disagree.
 */
function conditionsOf(r: Resident): string[] {
  return r.screenings.filter((s) => s.status === "atRisk").map((s) => s.name);
}

const chunk = <T,>(list: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

/**
 * The mark each screening carries — Figma 102:15785 and 102:15793.
 *
 * Looked up by the screening's kind rather than its Thai name: the name is
 * display text, and the first time it is translated a lookup keyed on it
 * would silently leave every card blank.
 */
const SCREENING_ART: Record<ScreeningKind, number> = {
  diabetes: require("../../assets/images/screening_diabetes.png"),
  pressure: require("../../assets/images/screening_pressure.png"),
  stroke: require("../../assets/images/screening_stroke.png"),
  obesity: require("../../assets/images/screening_obesity.png"),
};

/**
 * One screening. Green reads as settled, red as needing action; an
 * unassessed result is neither, so it stays grey rather than borrowing
 * either meaning.
 */
function ScreeningCard({ screening }: { screening: Screening }) {
  const ink =
    screening.status === "normal"
      ? SUCCESS
      : screening.status === "atRisk"
        ? DANGER
        : TEXT_DISABLED;

  return (
    <View
      accessible
      accessibilityLabel={`${screening.name} ${SCREENING_LABEL[screening.status]}`}
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: SURFACE,
        borderRadius: PAGE.card.radius,
        paddingHorizontal: PAGE.card.pad,
        paddingVertical: 13,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: SPACE.sm }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}
        >
          {screening.name}
        </Text>
        <Text
          style={{
            fontSize: 16,
            lineHeight: 24,
            fontWeight: "600",
            color: ink,
          }}
        >
          {SCREENING_LABEL[screening.status]}
        </Text>
        {/* The stamp at the size every reading's stamp on this page is. */}
        <Text style={{ fontSize: 12, lineHeight: 16, color: TEXT_MUTED }}>
          {screeningStamp(screening.takenAt)}
        </Text>
      </View>

      <Image
        source={SCREENING_ART[screening.kind]}
        style={{ width: 48, height: 48, marginLeft: SPACE.sm }}
        resizeMode="contain"
        accessibilityRole="none"
      />
    </View>
  );
}

/**
 * The mark each reading wears — one each, from the app's own icon set.
 *
 * The design draws the same heart on every card, which tells the six apart by
 * their names alone. A gauge for pressure, a trace for the pulse, lungs for
 * oxygen, a thermometer, a meter with a drop for a finger-prick glucose and a
 * circled trace for the continuous monitor: each is read before its label is.
 */
const ICON: Record<MetricKind, UIconName> = {
  waist: "measuringTape",
  bp: "gauge",
  pulse: "heartRate",
  spo2: "lungs",
  temp: "thermometerHalf",
  glucose: "meterDroplet",
  cgm: "waveformCircle",
};

/** The row every card opens with: the mark, the name, and the way in. */
function CardHeader({
  label,
  icon = "heart",
  arrow = true,
}: {
  label: string;
  icon?: UIconName;
  arrow?: boolean;
}) {
  // The size a card is titled at everywhere else in the app — the coverage and
  // follow-up overviews, and the list headings — rather than the 14 muted grey
  // the design draws. At 14 in grey these read as field labels, which is what
  // the app uses that size and colour for.
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
      <UIcon name={icon} size={16} color={TEXT_PRIMARY} />
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          fontSize: 16,
          lineHeight: 22,
          fontWeight: "600",
          color: TEXT_PRIMARY,
        }}
      >
        {label}
      </Text>
      {arrow && <Chevron />}
    </View>
  );
}

/** The reading and when it was taken — Figma 371:45763's "Frame 121". */
function ValueBlock({
  metric,
  reading,
}: {
  metric: Metric;
  reading?: Reading;
}) {
  const status =
    reading == null
      ? null
      : statusOf(metric.kind, reading.value, reading.value2);
  const off = status != null && status.tone !== "normal";
  // The accept-task screen's vital cell, which is the app's own way of writing
  // a reading: 16/600 in the text colour, with the label at 14 muted above it.
  // The design's 16/700 black and 10pt stamp were the only places on this page
  // not on the app's scale, and they read as a different app.
  return (
    <View style={{ gap: SPACE.xs }}>
      <View
        style={{ flexDirection: "row", alignItems: "baseline", gap: SPACE.xs }}
      >
        <Text
          numberOfLines={1}
          style={{
            // The app's KPI figure, not the design's 16: the reading is the
            // whole point of the card, and at 16 it sat level with the label
            // above it and the stamp below and had to be picked out of them.
            fontSize: 20,
            lineHeight: 26,
            fontWeight: "700",
            // The text colour while it is in range, red once it is not — the
            // two colours the follow-up list uses, for the same reason.
            color: off ? DANGER : TEXT_PRIMARY,
          }}
        >
          {reading == null ? "-" : formatReading(metric, reading)}
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>
          {metric.unit}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={{ fontSize: 12, lineHeight: 16, color: TEXT_MUTED }}
      >
        {reading == null
          ? tr("ยังไม่มีข้อมูล", "No data yet")
          : screeningStamp(reading.at)}
      </Text>
    </View>
  );
}

/**
 * One vital sign — Figma 371:45763.
 *
 * The same card in four arrangements, which is how the design draws them:
 * header and reading with the reading pushed to the foot; header, reading
 * and a chart; the reading beside its chart for the card that runs the
 * width; and the two tall ones that end in a picture.
 */
function VitalCard({
  resident,
  kind,
  reading,
  height,
  chart,
  beside,
  art,
  tile,
  onPress,
}: {
  resident: Resident;
  kind: MetricKind;
  reading?: Reading;
  height: number;
  /** Draws the week under the reading. */
  chart?: boolean;
  /** Reading on the left, chart on the right — the full-width card. */
  beside?: boolean;
  /** A picture filling the rest of the card. */
  art?: ImageSourcePropType;
  /** A picture on a pale tile at the card's foot — the CGM device. */
  tile?: ImageSourcePropType;
  /** Where the arrow leads. The cards with nowhere to go do not press. */
  onPress?: () => void;
}) {
  const metric = metricOf(kind);
  const spark = chart
    ? timed("sparkFor", () => sparkFor(resident, kind, planToday))
    : null;
  // Each line carries its own readings and its own severity, so a mark or a
  // shade lands on the number that actually left its band.
  const series =
    spark == null
      ? []
      : spark.values2 == null || metric.ink2 == null
        ? [{ values: spark.values, ink: metric.ink, severity: spark.severity }]
        : [
            { values: spark.values, ink: metric.ink, severity: spark.severity },
            {
              values: spark.values2,
              ink: metric.ink2,
              severity: spark.severity2,
            },
          ];

  // Only the cards with a page behind them press. The arrow is the design's
  // and stays on all of them; a card that shrinks under the finger and then
  // does nothing is worse than one that holds still.
  const Frame = onPress == null ? View : PressableScale;
  return (
    <Frame
      {...(onPress == null
        ? {}
        : { onPress, scaleTo: 0.99, accessibilityRole: "button" as const })}
      accessibilityLabel={`${metric.name} ${reading == null ? "" : formatReading(metric, reading)}`}
      style={{
        height,
        backgroundColor: SURFACE,
        borderRadius: PAGE.card.radius,
        overflow: "hidden",
      }}
    >
      {beside ? (
        <View style={{ flex: 1, padding: PAGE.card.pad, gap: SPACE.lg }}>
          <CardHeader label={metric.short} icon={ICON[kind]} />
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "stretch",
              gap: SPACE.md,
            }}
          >
            {/* Half each. The reading was held to a fixed 122 and the chart
                took whatever was left, so the two never lined up on any screen
                but the one the design was drawn at. */}
            <View style={{ flex: 1, minWidth: 0, justifyContent: "flex-end" }}>
              {/* At the foot, like the cards with no chart on them: the
                  reading is what the card is read for, and centred beside a
                  chart it floated at a height nothing else on the page sits
                  at. */}
              <ValueBlock metric={metric} reading={reading} />
            </View>
            <View style={{ flex: 1, minWidth: 0, justifyContent: "flex-end" }}>
              {/* Two lines, so the readings that left their band are dotted
                  rather than shaded — see `plain`. */}
              <Sparkline
                series={series}
                height={56}
                labels={spark?.labels}
                plain
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View
            style={{
              padding: PAGE.card.pad,
              gap: SPACE.lg,
              flex: chart ? 0 : 1,
            }}
          >
            <CardHeader label={metric.short} icon={ICON[kind]} />
            {/* Without a chart the reading sits at the foot of the card, as
                the design draws the oxygen, temperature and glucose tiles. */}
            {!chart && <View style={{ flex: 1 }} />}
            <ValueBlock metric={metric} reading={reading} />
            {chart && metric.chart !== "ecg" && (
              <Sparkline series={series} height={61} />
            )}
          </View>

          {/* The trace takes whatever the card has left after the picture,
              rather than a fixed strip under the reading: it is the only
              chart here that is read by counting, and the peaks have to be
              far enough apart to count. */}
          {chart && metric.chart === "ecg" && (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                // Inset like every other chart on the page. It sits outside
                // the card's padded block so that it can take the height the
                // picture leaves, which also left it running to the card's
                // edges — the one chart here that did.
                paddingHorizontal: PAGE.card.pad,
              }}
            >
              <EcgTrace
                bpm={reading?.value ?? 0}
                ink={shade(
                  metric.ink,
                  reading == null ? 0 : severityOf(kind, reading.value),
                )}
                height={84}
              />
            </View>
          )}

          {/* Its own height rather than a share of what is left: the trace
              above it flexes, and two things both asking for the remainder
              would split it and shrink the one that is read by counting. */}
          {art != null && (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                // The picture was centred in whatever space was left, and
                // what was left ran to the card's foot — so it sat on the
                // edge. Half the card's padding rather than all of it: the
                // room the bigger picture needs has to come from somewhere,
                // and the gap under it is worth less than the trace above.
                paddingBottom: PAGE.card.pad / 2,
              }}
            >
              {/* Rings of dots behind it, spreading off the card's edges.
                  Grown with the picture so it still reads as a halo around it
                  rather than a collar on it. */}
              <View style={{ position: "absolute" }}>
                <DotHalo ink={metric.ink} size={ART.halo} />
              </View>
              <Image
                source={art}
                style={{ width: ART.width, height: ART.height }}
                resizeMode="contain"
                accessibilityRole="none"
              />
            </View>
          )}

          {tile != null && (
            <View
              style={{ flex: 1, justifyContent: "flex-end", padding: SPACE.sm }}
            >
              {/*
                The pale box does not clip — Figma 371:46179 sets
                `clipsContent: false` on it, and draws the picture 8 above its
                top edge.

                That overhang is the point of the tile: the device is sitting
                on the pale ground rather than printed on it, and a box that
                clipped it would flatten the two into one label.
              */}
              <View
                style={{
                  height: TILE.height,
                  borderRadius: RADIUS.lg,
                  backgroundColor: TINT_BG,
                }}
              >
                <View
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: -TILE.overhang,
                    alignItems: "center",
                  }}
                >
                  <Image
                    source={tile}
                    style={{ width: TILE.art.width, height: TILE.art.height }}
                    resizeMode="contain"
                    accessibilityRole="none"
                  />
                </View>
              </View>
            </View>
          )}
        </View>
      )}
    </Frame>
  );
}

/**
 * What the assistant makes of the whole record.
 *
 * The one card on the page that is not a reading, and the only one worth
 * tapping: the readings are all on screen already, and this is the only thing
 * that has looked at them together. It carries the opening lines and the
 * sheet behind it carries the rest.
 */
function SummaryTile({
  height,
  brief,
  loading,
  onPress,
}: {
  height: number;
  brief: HealthBrief | null;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      scaleTo={0.99}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tr(
        "สรุปสุขภาพโดยผู้ช่วย AI",
        "Health summary by the AI assistant",
      )}
      style={{
        height,
        backgroundColor: SURFACE,
        borderRadius: PAGE.card.radius,
      }}
    >
      {/*
        No aurora here.

        The light belongs on the sheet this card opens, where it has a page to
        itself. On a card whose words run its whole depth it had to be washed
        out so far to keep them readable that what was left read as a smudge
        rather than as the assistant. The wand in the heading says the same
        thing and cost the card nothing.
      */}
      <View style={{ flex: 1, padding: PAGE.card.pad, gap: SPACE.md }}>
        <CardHeader
          label={tr("สรุปสุขภาพ", "Health summary")}
          icon="magicWand"
        />

        {loading ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.sm,
            }}
          >
            <ActivityIndicator color={PRIMARY_500} />
            <Text style={{ fontSize: 14, color: TEXT_MUTED }}>
              {tr("กำลังสรุป…", "Summarizing…")}
            </Text>
          </View>
        ) : (
          // Three lines and then it stops: the rest is a tap away, and a card
          // that grows to fit its text would break the row it sits in.
          //
          // In the app's text colour, not the muted grey the labels wear: this
          // is the card's content, and every other card on the page puts its
          // content in `TEXT_PRIMARY` and keeps the grey for what names it.
          <Text
            numberOfLines={3}
            style={{ fontSize: 14, lineHeight: 20, color: TEXT_PRIMARY }}
          >
            {brief?.overview ??
              tr(
                "เชื่อมต่อผู้ช่วย AI ไม่ได้",
                "Couldn't reach the AI assistant",
              )}
          </Text>
        )}
      </View>
    </PressableScale>
  );
}

type Tab = "summary" | "visits" | "assessments";
const TABS: Tab[] = ["summary", "visits", "assessments"];
const TAB_LABEL: Record<Tab, string> = tr(
  { summary: "สรุปสุขภาพ", visits: "เยี่ยมบ้าน", assessments: "ประเมินสุขภาพ" },
  {
    summary: "Health summary",
    visits: "Home visits",
    assessments: "Assessments",
  },
);

/** A tab with nothing in it, said rather than left blank. */
function Empty({ text }: { text: string }) {
  return (
    <View
      style={{
        paddingVertical: SPACE.xl,
        alignItems: "center",
        backgroundColor: SURFACE,
        borderRadius: PAGE.card.radius,
      }}
    >
      <Text style={{ ...TYPE.body, color: TEXT_MUTED, textAlign: "center" }}>
        {text}
      </Text>
    </View>
  );
}

/**
 * The visits: the ones planned for this person, and the ones they have had.
 *
 * The plan is the plan calendar's own visits for them, as the same cards;
 * a tap opens the visit as it does from the plan. The history is the
 * treatment record, newest first.
 */
function VisitsTab({ resident }: { resident: Resident }) {
  const nav = useNavigation<Nav>();
  const { width, regular, wide } = useLayout();
  // The column the page is laid in, inside its margins.
  const column = Math.min(width, pageMax(wide)) - GUTTER * 2;
  // The home carousel's card: narrow enough that the next one shows. On a
  // tablet a card at four-fifths of the column would be a foot wide, so it
  // is held to a phone's card and more of them show.
  const cardWidth = regular ? Math.min(360, column * 0.46) : width * 0.78;
  const { upcoming } = visitsFor(resident);
  const history = visitTimeline(resident);
  // A past visit from the record, open in the detail sheet.
  const [reading, setReading] = useState<PastVisit | null>(null);
  return (
    <>
      <Heading
        title={tr("แผนเยี่ยมบ้าน", "Home visit plan")}
        count={upcoming.length}
      />
      {upcoming.length === 0 ? (
        <Empty text={tr("ยังไม่มีนัดเยี่ยมบ้าน", "No home visits scheduled")} />
      ) : (
        // Side by side, and swiped — the home page's carousel: the next
        // visit first, the ones after it peeking in at the edge. One card
        // stands alone at the page's width.
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={
            upcoming.length > 1 ? cardWidth + PAGE.gap : undefined
          }
          decelerationRate="fast"
          // Out to the screen's edges, so a card slides off the side rather
          // than being cut at the page's margin.
          style={{ marginHorizontal: -GUTTER }}
          contentContainerStyle={{
            paddingHorizontal: GUTTER,
            gap: PAGE.gap,
          }}
        >
          {upcoming.map((t) => (
            <View
              key={t.id}
              style={{
                width: upcoming.length > 1 ? cardWidth : column,
              }}
            >
              <VisitCard
                task={t}
                now={planToday}
                onPress={() => openTask(nav, t)}
              />
            </View>
          ))}
        </ScrollView>
      )}

      <Heading
        title={tr("ประวัติการเยี่ยม", "Visit history")}
        count={history.length}
      />
      {history.length === 0 ? (
        <Empty text={tr("ยังไม่มีประวัติการเยี่ยม", "No visit history yet")} />
      ) : (
        <VisitTimeline
          visits={history}
          onOpen={(t) => openTask(nav, t)}
          onRead={setReading}
        />
      )}
      <VisitDetailSheet visit={reading} onClose={() => setReading(null)} />
    </>
  );
}

/**
 * Every assessment done at those visits, newest first, a card to each month
 * as the visit history is.
 *
 * Each leads with the form's own mark — the one it wears on the list it is
 * chosen from — so a history of a dozen forms is read by picture before it
 * is read by name. Under the name, the verdict in the app's blue, then what
 * it means, then when and by whom.
 */
function AssessmentsTab({ resident }: { resident: Resident }) {
  const rows = assessmentsFor(resident);
  const months: { label: string; rows: typeof rows }[] = [];
  for (const r of rows) {
    const label = thaiMonthYear(r.at);
    const last = months[months.length - 1];
    if (last?.label === label) last.rows.push(r);
    else months.push({ label, rows: [r] });
  }
  return (
    <>
      <Heading
        title={tr("ประวัติการประเมิน", "Assessment history")}
        count={rows.length}
      />
      {rows.length === 0 ? (
        <Empty text={tr("ยังไม่เคยทำแบบประเมิน", "No assessments yet")} />
      ) : (
        <MonthGrid>
          {months.map((m) => (
            <Card
              key={m.label}
              style={{ padding: PAGE.card.pad, gap: SPACE.md }}
            >
              <MonthHead
                label={m.label}
                count={tr(
                  `${m.rows.length} แบบ`,
                  `${m.rows.length} form${m.rows.length === 1 ? "" : "s"}`,
                )}
              />
              {m.rows.map((a, i) => (
                <View key={`${a.name}-${i}`} style={{ gap: SPACE.md }}>
                  {i > 0 && <RowRule inset={GLYPH + SPACE.md} />}
                  <View style={{ flexDirection: "row", gap: SPACE.md }}>
                    <Glyph icon={assessmentIcon(a.name)} size={GLYPH} />
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text style={{ ...TYPE.rowTitle, color: TEXT_PRIMARY }}>
                        {a.name}
                      </Text>
                      <Text
                        style={{
                          ...TYPE.rowTitle,
                          color: PRIMARY_500,
                        }}
                      >
                        {a.score}
                      </Text>
                      <Text style={{ ...TYPE.detail, color: TEXT_MUTED }}>
                        {a.result}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{
                          ...TYPE.caption,
                          color: TEXT_MUTED,
                          marginTop: 2,
                        }}
                      >
                        {`${thaiShortDate(a.at)} · ${a.by}`}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </Card>
          ))}
        </MonthGrid>
      )}
    </>
  );
}

/**
 * The month cards of a history: one under another on a phone, two across
 * a wide window, each at a phone card's width rather than stretched over
 * the whole page.
 */
function MonthGrid({ children }: { children: ReactNode }) {
  const { width, wide } = useLayout();
  if (!wide) return <>{children}</>;
  const column = Math.min(width, pageMax(wide)) - GUTTER * 2;
  const w = gridCard(column, 2, PAGE.gap);
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "flex-start",
        gap: PAGE.gap,
      }}
    >
      {Children.map(children, (c) => (
        <View style={{ width: w }}>{c}</View>
      ))}
    </View>
  );
}

/** The size of a form's mark in the history. */
const GLYPH = 40;

/** A month's name and its tally, quietly, at the head of its card. */
function MonthHead({ label, count }: { label: string; count: string }) {
  return (
    <>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}
      >
        <Calendar size={14} color={TEXT_MUTED} strokeWidth={2} />
        <Text
          style={{
            flex: 1,
            ...TYPE.caption,
            fontWeight: "500",
            color: TEXT_MUTED,
          }}
        >
          {label}
        </Text>
        <Text style={{ ...TYPE.caption, color: TEXT_MUTED }}>{count}</Text>
      </View>
      <RowRule />
    </>
  );
}

/** The hairline between rows, starting under the text rather than the mark. */
function RowRule({ inset = 0 }: { inset?: number }) {
  return (
    <View
      style={{
        height: 1,
        marginLeft: inset,
        backgroundColor: "rgba(120,120,128,0.16)",
      }}
    />
  );
}

/**
 * The visits gone by, on one line of dates — newest at the top, under the
 * month they fell in.
 *
 * Each row leads with its date, large, as a diary does: the question asked
 * of a history is "when was the last one, and what happened", and the date
 * is the first half of it. A visit from the plan carries its state and
 * opens again; one from the treatment record carries who saw them.
 */
function VisitTimeline({
  visits,
  onOpen,
  onRead,
}: {
  visits: TimelineVisit[];
  onOpen: (t: NonNullable<TimelineVisit["task"]>) => void;
  /** Opens a past visit from the record in full. */
  onRead: (v: PastVisit) => void;
}) {
  const months: { label: string; rows: TimelineVisit[] }[] = [];
  for (const v of visits) {
    const label = thaiMonthYear(v.at);
    const last = months[months.length - 1];
    if (last?.label === label) last.rows.push(v);
    else months.push({ label, rows: [v] });
  }

  // A card to each month, headed inside by the month's name and how many
  // visits it held — as every other card on this page carries its title.
  return (
    <MonthGrid>
      {months.map((m) => (
        <View key={m.label}>
          <Card style={{ padding: PAGE.card.pad, gap: SPACE.md }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.sm,
              }}
            >
              <Calendar size={14} color={TEXT_MUTED} strokeWidth={2} />
              <Text
                style={{
                  flex: 1,
                  ...TYPE.caption,
                  color: TEXT_MUTED,
                }}
              >
                {m.label}
              </Text>
              <Text style={{ ...TYPE.caption, color: TEXT_MUTED }}>
                {tr(
                  `${m.rows.length} ครั้ง`,
                  `${m.rows.length} visit${m.rows.length === 1 ? "" : "s"}`,
                )}
              </Text>
            </View>
            <View
              style={{ height: 1, backgroundColor: "rgba(120,120,128,0.16)" }}
            />
            {m.rows.map((v, i) => {
              // Every past visit opens: one from the plan as the visit itself,
              // one from the record as its full write-up.
              const press =
                v.task != null
                  ? () => onOpen(v.task!)
                  : v.record != null
                    ? () => onRead(v.record!)
                    : undefined;
              const Row = press != null ? PressableScale : View;
              return (
                <View key={v.id} style={{ gap: SPACE.md }}>
                  {i > 0 && (
                    <View
                      style={{
                        height: 1,
                        marginLeft: DATE_COL + SPACE.md,
                        backgroundColor: "rgba(120,120,128,0.16)",
                      }}
                    />
                  )}
                  <Row
                    {...(press != null
                      ? {
                          onPress: press,
                          scaleTo: 0.99,
                          accessibilityRole: "button" as const,
                        }
                      : {})}
                    style={{ flexDirection: "row", gap: SPACE.md }}
                  >
                    {/* The date, as a diary's margin. */}
                    <View style={{ width: DATE_COL, alignItems: "center" }}>
                      <Text
                        style={{
                          ...TYPE.figure,
                          color: TEXT_PRIMARY,
                        }}
                      >
                        {v.at.getDate()}
                      </Text>
                      <Text
                        style={{
                          ...TYPE.caption,
                          color: TEXT_MUTED,
                        }}
                      >
                        {THAI_WEEKDAYS[v.at.getDay()]}
                      </Text>
                    </View>

                    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                      {v.type != null && (
                        <Text
                          style={{
                            ...TYPE.caption,
                            fontWeight: "600",
                            color: PRIMARY_500,
                          }}
                        >
                          {visitTypeLabel(v.type)}
                        </Text>
                      )}
                      <Text
                        numberOfLines={2}
                        style={{
                          ...TYPE.rowTitle,
                          color: TEXT_PRIMARY,
                        }}
                      >
                        {v.title}
                      </Text>
                      {v.summary != null && (
                        <Text
                          numberOfLines={3}
                          style={{
                            ...TYPE.detail,
                            color: TEXT_MUTED,
                          }}
                        >
                          {v.summary}
                        </Text>
                      )}
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: SPACE.sm,
                          marginTop: 2,
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          style={{
                            flex: 1,
                            ...TYPE.caption,
                            color: TEXT_MUTED,
                          }}
                        >
                          {v.by != null
                            ? `${thaiTime(v.at)} · ${v.by}`
                            : thaiTime(v.at)}
                        </Text>
                        {v.task != null && (
                          <VisitBadge state={visitStateOf(v.task, planToday)} />
                        )}
                      </View>
                    </View>
                    {press != null && (
                      <View style={{ justifyContent: "center" }}>
                        <Chevron />
                      </View>
                    )}
                  </Row>
                </View>
              );
            })}
          </Card>
        </View>
      ))}
    </MonthGrid>
  );
}

/** The width of the date down a history's left edge. */
const DATE_COL = 40;
