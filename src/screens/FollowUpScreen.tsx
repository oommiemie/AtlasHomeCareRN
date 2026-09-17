import { Profiler, useMemo, useState } from "react";
import { Image, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AlertCircle, CheckCircle, Eye, List } from "lucide-react-native";

import { Chevron } from "../components/Chevron";
import { Avatar } from "../components/Avatar";
import { Card } from "../components/Card";
import { Figure, Figures } from "../components/Figures";
import { FilterSelect, type FilterOption } from "../components/FilterSelect";
import { SearchListScreen } from "../components/SearchListScreen";
import { SectionHeader } from "../components/SectionHeader";
import { UIcon, type UIconName } from "../components/UIcon";
import { mark as perfMark, readSums, resetSums, timed } from "../utils/perf";
import type { RootStackParamList } from "../navigation/RootStack";
import { initialOf } from "../models/household";
import {
  formatReading,
  latestVitals,
  metricOf,
  statusOf,
  type Metric,
  type MetricKind,
  type Reading,
  type Tone,
} from "../models/vitals";
import {
  followUpPatients,
  followUpStateOf,
  followUpTotals,
  searchFollowUp,
  FOLLOW_UP_LABEL,
  type FollowUpPatient,
  type FollowUpState,
} from "../models/followUp";
import { planToday } from "../models/task";
import { thaiDateTime } from "../utils/thaiDate";
import {
  DANGER,
  PRIMARY_100,
  PRIMARY_500,
  RADIUS,
  SPACE,
  SUCCESS,
  SURFACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TINT_BG,
  WARNING,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** The ink each state is read in — the mark, the pill and the figure share it. */
/**
 * A reading's ink: the design's black while it is in range, red once it is
 * not.
 *
 * Two colours, not three. An amber middle would have the row asking to be
 * read before it can be judged — on a list, out of range is out of range, and
 * how far out is a question for the record.
 */
// Read as it renders: applyTheme runs inside App's render, after every
// screen module body, so a token in a module const keeps the light
// palette it was imported under.
const STATE_TONE = (): Record<Tone, string> => ({
  normal: TEXT_PRIMARY,
  warn: DANGER,
  alert: DANGER,
});

// Read as it renders: applyTheme runs inside App's render, after every
// screen module body, so a token in a module const keeps the light
// palette it was imported under.
const STATE_INK = (): Record<FollowUpState, string> => ({
  attention: DANGER,
  watch: WARNING,
  stable: SUCCESS,
});

type Band = "all" | FollowUpState;

const BANDS: FilterOption<Band>[] = [
  { key: "all", label: "ทั้งหมด", Icon: List },
  { key: "attention", label: FOLLOW_UP_LABEL.attention, Icon: AlertCircle },
  { key: "watch", label: FOLLOW_UP_LABEL.watch, Icon: Eye },
  { key: "stable", label: FOLLOW_UP_LABEL.stable, Icon: CheckCircle },
];

/**
 * "ติดตามสุขภาพ" — the carer's own patients under health surveillance.
 *
 * The register is not everyone in "บ้านที่ดูแล": it is the people with
 * something to follow — a flag on the record, a screening that came back at
 * risk, or an age that puts them under routine watch. A list of everybody
 * would be the household registry under a different title, and would leave
 * the carer to work out for themselves who on it needed anything.
 *
 * Ordered by urgency rather than by name or by village, and within a band by
 * how long it has been: the row at the top is the one to open.
 */
export function FollowUpScreen() {
  const [query, setQuery] = useState("");
  const [band, setBand] = useState<Band>("all");
  const nav = useNavigation<Nav>();

  // The whole caseload's counts, not the filtered list's: a total that moved
  // as the list narrowed would read as a result count refusing to update.
  const totals = useMemo(() => followUpTotals(followUpPatients, planToday), []);

  const found = searchFollowUp(followUpPatients, query);
  const shown =
    band === "all"
      ? found
      : found.filter((p) => followUpStateOf(p.resident, planToday) === band);

  const searching = query.trim().length > 0;
  resetSums();

  return (
    <Profiler
      id="FollowUp"
      onRender={(_id, phase, actual) =>
        console.log(
          `[perf] FollowUp ${phase} render=${actual.toFixed(1)}ms ` +
            `rows=${shown.length} sums=${JSON.stringify(readSums())}`,
        )
      }
    >
    <SearchListScreen
      // The register runs to a hundred and sixty-seven rows and each one asks
      // for six generated readings, so they are handed over to be virtualised
      // rather than mounted whole — see `SearchListScreen`.
      data={shown}
      keyExtractor={(p) => p.resident.id}
      renderItem={(p) => (
        <PatientRow
          patient={p}
          onPress={() => {
            perfMark("press");
            nav.navigate("HealthTracking", { resident: p.resident });
          }}
        />
      )}
      title="ติดตามสุขภาพ"
      query={query}
      onQuery={setQuery}
      placeholder="ค้นหาชื่อผู้ป่วย บ้านเลขที่ หรือหมู่บ้าน"
    >
      {!searching && <Overview totals={totals} />}

      {/* The list's own heading with the band at the far end — the same row
          the villages list carries, from the same component. */}
      <View style={{ zIndex: 10 }}>
        <SectionHeader
          title="รายชื่อผู้ป่วย"
          flush
          trailing={
            <FilterSelect value={band} options={BANDS} onChange={setBand} />
          }
        />
      </View>

      {shown.length === 0 && <Empty query={query} band={band} />}
    </SearchListScreen>
    </Profiler>
  );
}

/** The overview card's own geometry — Figma 357:34328. */
const OVERVIEW = {
  radius: 24,
  pad: 16,
  /**
   * Flush to the card's right edge and sitting on its foot.
   *
   * Bigger than the 145 the design draws, and held by the bottom rather than
   * the top: the type here is the app's rather than the design's, so the card
   * is taller than the 126 drawn and a picture pinned by its head would float
   * clear of the foot it is meant to sit on.
   */
  art: { width: 160, height: 130 },
  /**
   * How much of the picture's column the figures may run under.
   *
   * The artwork's left edge is a strip of transparent margin, so reserving
   * its full width bought nothing and cost the three labels the room to say
   * their own names.
   */
  artBleed: 14,
} as const;

/**
 * The whole register in one band — Figma 357:34328, in the shape the villages
 * overview already has.
 *
 * The two cards are one screen apart and answer the same kind of question, so
 * they are built the same way: three figures for the shape of the caseload,
 * a hairline, and one red line under it for the part that needs doing. The
 * figures are counts and are inked as counts; the alarm lives in the line
 * below, which is why "ต้องติดตามด่วน" is not a fourth column.
 *
 * Not built on `Card`: this needs the design's own shadow, far wider and
 * deeper than the card shadow, and the artwork has to reach the card's edge
 * past the padding.
 */
function Overview({
  totals,
}: {
  totals: {
    total: number;
    attention: number;
    watch: number;
    stable: number;
    overdue: number;
  };
}) {
  return (
    <View
      style={{
        borderRadius: OVERVIEW.radius,
        shadowColor: "#000000",
        shadowOpacity: 0.12,
        // Figma's blur is a diameter; RN's radius is half of it.
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
      }}
    >
      <View
        style={{
          backgroundColor: SURFACE,
          borderRadius: OVERVIEW.radius,
          // Trims the artwork's foot, which is what seats it in the card.
          overflow: "hidden",
        }}
      >
        <Image
          source={require("../../assets/images/follow_up_art.png")}
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: OVERVIEW.art.width,
            height: OVERVIEW.art.height,
          }}
          resizeMode="contain"
          accessibilityRole="none"
        />

        <View
          style={{
            padding: OVERVIEW.pad,
            paddingRight: OVERVIEW.art.width - OVERVIEW.artBleed,
          }}
        >
          {/* The app's own sizes, not the design's.
              
              Figma draws this at 14/14/12; the app's scale puts a card
              heading at 16 and a KPI figure at 20 — the same decision the
              villages overview took. Colours, weights, spacing and layout
              are the design's. */}
          <Text
            style={{ fontSize: 16, lineHeight: 21, fontWeight: "600", color: TEXT_PRIMARY }}
          >
            ผู้ป่วยที่ติดตามอยู่
          </Text>

          <View style={{ marginTop: SPACE.sm }}>
            {/*
              Each figure in the colour of what it counts, rather than the
              villages card's neutral-blue-green.

              That card counts villages, houses and people — three quantities,
              where the colours are only there to tell the columns apart. These
              three are states, and a green "เฝ้าระวัง" would be saying the
              opposite of what the word means. So: the total stays black
              because a total has no state, the work to be done takes the
              design's own brick red, and the watch list takes the app's blue.
            */}
            <Figures ruled={totals.overdue > 0}>
              <Figure value={totals.total} label="ทั้งหมด" ink={TEXT_PRIMARY} />
              <Figure
                value={totals.attention}
                label="ต้องติดตาม"
                // Figma 357:34328's own red, which is not the app's DANGER:
                // this is a workload, and the alarm is the line below.
                ink="#C94A39"
              />
              <Figure value={totals.watch} label="เฝ้าระวัง" ink={PRIMARY_500} />
            </Figures>
          </View>

          {/* The overdue count, not the urgent one: that is the second
              figure already, and a card should not say the same number
              twice. This is the part of it nobody has looked at yet. */}
          {totals.overdue > 0 && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginTop: SPACE.sm,
              }}
            >
              {/* The mark carries the alert, so the line reads as a state
                  before it is read as a sentence. */}
              <View
                style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: DANGER }}
              />
              <Text
                style={{ fontSize: 12, lineHeight: 16, fontWeight: "500", color: DANGER }}
              >
                {`มีผู้ป่วย ${totals.overdue} รายที่ยังไม่ได้ประเมินเกิน 6 เดือน`}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

/** The card's own geometry — Figma 364:45109. */
const ROW = {
  gap: 10,
  avatar: 32,
  tile: { radius: 16, pad: 12 },
} as const;

/**
 * The three the design puts on the row.
 *
 * Labelled from the metric's own short name rather than a second list here:
 * the health page names them the same way, and two lists of the same six
 * words drift apart the first time one of them is touched.
 */
const TILES: { kind: MetricKind; icon: UIconName }[] = [
  { kind: "pulse", icon: "heartRate" },
  { kind: "spo2", icon: "lungs" },
  { kind: "cgm", icon: "meterDroplet" },
];

/**
 * One patient on the register — Figma 364:45109.
 *
 * Three bands: who, three readings, and when they were taken. The readings
 * are the point of the card — this is a health-tracking list, and the reason
 * a name is on it is a number — so they are given the middle of the card
 * rather than a line of small text at the bottom of it.
 *
 * The values are inked by their own status rather than the design's flat
 * black: at a glance the difference between a normal row and one to open is
 * then the colour of the figure, which is the only thing on the card the eye
 * lands on first.
 */
function PatientRow({
  patient,
  onPress,
}: {
  patient: FollowUpPatient;
  onPress: () => void;
}) {
  const { resident } = patient;
  const state = followUpStateOf(resident, planToday);
  const latest = timed("latestVitals", () => latestVitals(resident));
  const taken = TILES.map((t) => latest[t.kind]?.at).filter(
    (d): d is Date => d != null,
  );
  const updated =
    taken.length === 0
      ? undefined
      : new Date(Math.max(...taken.map((d) => d.getTime())));

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${resident.name} ${FOLLOW_UP_LABEL[state]}`}
    >
      <View style={{ gap: ROW.gap }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Avatar
            size={ROW.avatar}
            initial={initialOf(resident.name)}
            photo={resident.photo}
          />
          <Text
            numberOfLines={1}
            style={{
              marginLeft: SPACE.sm,
              flexShrink: 1,
              // The size every other list card in the app names its subject
              // at — the visit card and the resident row both — and the size
              // the design draws too.
              fontSize: 14,
              lineHeight: 20,
              fontWeight: "600",
              color: TEXT_PRIMARY,
            }}
          >
            {resident.name}
          </Text>
          {/* Against the name, not out at the end of the row: it is part of
              naming the patient, and pushed right it read as a second fact. */}
          <View
            style={{
              marginLeft: SPACE.xs,
              paddingHorizontal: SPACE.sm,
              paddingVertical: 2,
              borderRadius: RADIUS.capsule,
              backgroundColor: PRIMARY_100,
            }}
          >
            <Text style={{ fontSize: 10, lineHeight: 14, fontWeight: "500", color: PRIMARY_500 }}>
              {`${resident.age} ปี`}
            </Text>
          </View>
          <View style={{ flex: 1 }} />
          <Chevron />
        </View>

        <View style={{ flexDirection: "row", gap: ROW.gap }}>
          {TILES.map((t) => (
            <Tile
              key={t.kind}
              label={metricOf(t.kind).short}
              icon={t.icon}
              metric={metricOf(t.kind)}
              reading={latest[t.kind]}
            />
          ))}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
          <Text
            numberOfLines={1}
            style={{ flex: 1, fontSize: 12, fontWeight: "500", color: TEXT_MUTED }}
          >
            {updated == null
              ? "ยังไม่มีข้อมูลล่าสุด"
              : `อัพเดทล่าสุด: ${thaiDateTime(updated)}`}
          </Text>
          <Pill label={FOLLOW_UP_LABEL[state]} ink={STATE_INK()[state]} />
        </View>
      </View>
    </Card>
  );
}

/** One reading, in its own tile — Figma 364:45129. */
function Tile({
  label,
  icon,
  metric,
  reading,
}: {
  label: string;
  icon: UIconName;
  metric: Metric;
  reading?: Reading;
}) {
  const status =
    reading == null ? null : statusOf(metric.kind, reading.value, reading.value2);

  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        borderRadius: ROW.tile.radius,
        // The design's #F4FAFF: the tiles sit on a card of the page's own
        // surface, and the point of the fill is only to bound them. Read
        // here rather than held in ROW, so it turns with the theme.
        backgroundColor: TINT_BG,
        padding: ROW.tile.pad,
        // Holds the watermark inside the tile's corners; it is drawn larger
        // than the tile has room for and hangs off the bottom right.
        overflow: "hidden",
      }}
    >
      {/*
        The mark, as a watermark rather than a bullet beside the label.

        It is what tells the three tiles apart down a long list — the words
        are all the same length and the same grey — but at label size it sat
        in front of the figure and made a three-word row out of a two-word
        one. Behind and faint, it is read without being looked at.
      */}
      <View
        pointerEvents="none"
        style={{ position: "absolute", right: 6, bottom: 6, opacity: 0.08 }}
      >
        <UIcon name={icon} size={30} color={PRIMARY_500} />
      </View>

      <Text
        numberOfLines={1}
        style={{ fontSize: 12, lineHeight: 16, color: TEXT_MUTED }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, marginTop: 2 }}>
        {/* The name's size, not a KPI figure's.
            
            A figure at 20 belongs on a card of its own; three of them inside
            a list row made the tiles read as the card and the patient's name
            as a caption on them. Level with the name, and carrying weight and
            colour the name does not, it reads as the row's finding without
            taking the row over. */}
        <Text
          numberOfLines={1}
          style={{
            fontSize: 14,
            lineHeight: 20,
            fontWeight: "700",
            color: status == null ? TEXT_PRIMARY : STATE_TONE()[status.tone],
          }}
        >
          {reading == null ? "-" : formatReading(metric, reading)}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: 10, lineHeight: 16, color: TEXT_MUTED }}>
          {metric.unit}
        </Text>
      </View>
    </View>
  );
}

/**
 * A tinted capsule — Figma 364:45169.
 *
 * The wash is the design's 5%, which is barely a colour at all; the word
 * itself is at full strength and is what carries it. A heavier fill turns the
 * pill into a button, and nothing on this row is one.
 */
function Pill({ label, ink }: { label: string; ink: string }) {
  return (
    <View
      style={{
        paddingHorizontal: SPACE.sm,
        paddingVertical: 4,
        borderRadius: RADIUS.capsule,
        backgroundColor: `${ink}0D`,
      }}
    >
      <Text style={{ fontSize: 10, lineHeight: 14, fontWeight: "500", color: ink }}>
        {label}
      </Text>
    </View>
  );
}

function Empty({ query, band }: { query: string; band: Band }) {
  const q = query.trim();
  return (
    <View style={{ paddingVertical: SPACE.huge, alignItems: "center" }}>
      <Text style={{ fontSize: 14, lineHeight: 22, color: TEXT_MUTED, textAlign: "center" }}>
        {q.length > 0
          ? `ไม่พบผู้ป่วยที่ตรงกับ "${q}"`
          : band === "all"
            ? "ยังไม่มีผู้ป่วยในรายการติดตาม"
            : `ไม่มีผู้ป่วยในกลุ่ม${FOLLOW_UP_LABEL[band]}`}
      </Text>
    </View>
  );
}
