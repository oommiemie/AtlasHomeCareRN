import { Profiler, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChevronLeft } from "lucide-react-native";

import { Chevron } from "../components/Chevron";
import { BmiChart } from "../components/BmiGauge";
import { Card } from "../components/Card";
import { Glass } from "../components/Glass";
import { GlassIconButton } from "../components/GlassIconButton";
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
  initialOf,
  type Resident,
} from "../models/household";
import { summariseResident, type HealthBrief } from "../models/patientAi";
import { planToday } from "../models/task";
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
import { screeningStamp } from "../utils/thaiDate";
import {
  CANVAS,
  DANGER,
  PRIMARY_500,
  PRIMARY_700,
  RADIUS,
  SPACE,
  TEXT_PRIMARY,
  SURFACE,
  TEXT_MUTED,
  CANVAS_CLEAR,
  TINT_BG,
} from "../theme/tokens";

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

const ROW = {
  cgm: 274,
  half: 132,
  bp: 148,
  pair: 144,
  tall: 298,
} as const;

/**
 * One patient's readings between visits — Figma 363:44088.
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
  resetSums();
  const latest = timed("latestVitals", () => latestVitals(resident));

  const [brief, setBrief] = useState<HealthBrief | null>(null);
  const [asking, setAsking] = useState(true);
  const [reading, setReading] = useState(false);

  // Asked once per record. The page is fully readable before it answers, and
  // the card holds a line of its own until it does.
  useEffect(() => {
    let live = true;
    setAsking(true);
    summariseResident(resident, latest).then((result) => {
      if (!live) return;
      setBrief(result);
      setAsking(false);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resident.id]);

  return (
    <Profiler
      id="HealthTracking"
      onRender={(_id, phase, actual, base) => {
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
      <Image
        source={require("../../assets/images/accept_backdrop.png")}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top + 335,
          // Painted at 80% and dissolved into the page ground over its whole
          // height, so the banner has no cut edge.
          opacity: 0.8,
        }}
        resizeMode="cover"
        onLoadEnd={() =>
          console.log(`[perf] backdrop onLoadEnd sincePress=${since("press")}ms`)
        }
      />
      <LinearGradient
        colors={[CANVAS_CLEAR, CANVAS]}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top + 335,
        }}
        pointerEvents="none"
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: SPACE.lg,
          paddingTop: insets.top + 60,
          paddingBottom: insets.bottom + SPACE.huge,
          gap: PAGE.gap,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Hero resident={resident} />

        {/* The standing facts, three across — the record sheet's own row. */}
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Fact label="อายุ" value={`${resident.age} ปี`} />
            <Fact label="เพศ" value={resident.gender} />
            <Fact label="หมู่เลือด" value={resident.bloodType} />
          </View>
        </Card>

        {/*
          The mosaic — Figma 371:45763.

          `flex: 1` goes on a wrapper rather than on the card itself:
          `PressableScale` puts the style it is given on its inner animated
          view, not on the Pressable, so a card asking for half a row asks the
          wrong view for it and the Pressable sizes to its own text.
        */}
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

        <VitalCard
          resident={resident}
          kind="bp"
          reading={latest.bp}
          height={ROW.bp}
          chart
          beside
          onPress={() =>
            nav.navigate("VitalDetail", { resident, kind: "bp" })
          }
        />

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
      </ScrollView>

      <HealthBriefSheet
        visible={reading}
        resident={resident}
        brief={brief}
        loading={asking}
        onClose={() => setReading(false)}
      />

      <View
        style={{
          position: "absolute",
          top: insets.top + SPACE.sm,
          left: SPACE.lg,
        }}
      >
        <GlassIconButton
          onPress={() => nav.goBack()}
          accessibilityLabel="ย้อนกลับ"
        >
          <ChevronLeft size={24} color={TEXT_PRIMARY} strokeWidth={2.4} />
        </GlassIconButton>
      </View>
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

      <Text
        style={{
          fontSize: 20,
          lineHeight: 26,
          fontWeight: "600",
          color: TEXT_PRIMARY,
        }}
      >
        {resident.name}
      </Text>

      <View style={{ flexDirection: "row", gap: PAGE.gap }}>
        <GlassIconButton
          size={48}
          onPress={() =>
            Linking.openURL(`tel:${resident.phone}`).catch(() =>
              toast("โทรออกไม่ได้"),
            )
          }
          accessibilityLabel={`โทรหา ${resident.name}`}
        >
          <UIcon name="phoneFlip" size={20} color={PRIMARY_700} />
        </GlassIconButton>
        <GlassIconButton
          size={48}
          onPress={() => toast("วิดีโอคอลยังไม่เปิดใช้งาน")}
          accessibilityLabel={`วิดีโอคอล ${resident.name}`}
        >
          <UIcon name="videoCameraAlt" size={20} color={PRIMARY_700} />
        </GlassIconButton>
        <GlassIconButton
          size={48}
          onPress={() => toast("ข้อความยังไม่เปิดใช้งาน")}
          accessibilityLabel={`ส่งข้อความหา ${resident.name}`}
        >
          <UIcon name="comment" size={20} color={PRIMARY_700} />
        </GlassIconButton>
      </View>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: SPACE.sm }}>
      <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          fontSize: 16,
          lineHeight: 24,
          fontWeight: "600",
          color: TEXT_PRIMARY,
        }}
      >
        {value}
      </Text>
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
        {reading == null ? "ยังไม่มีข้อมูล" : screeningStamp(reading.at)}
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
      accessibilityLabel="สรุปสุขภาพโดยผู้ช่วย AI"
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
        <CardHeader label="สรุปสุขภาพ" icon="magicWand" />

        {loading ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.sm,
            }}
          >
            <ActivityIndicator color={PRIMARY_500} />
            <Text style={{ fontSize: 14, color: TEXT_MUTED }}>กำลังสรุป…</Text>
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
            {brief?.overview ?? "เชื่อมต่อผู้ช่วย AI ไม่ได้"}
          </Text>
        )}
      </View>
    </PressableScale>
  );
}
