import { memo, useCallback, useMemo, useState } from "react";
import { Image, Pressable, Text, View, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Ban,
  CircleCheck,
  Scale,
  TriangleAlert,
  UserX,
} from "lucide-react-native";

import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { Card } from "../components/Card";
import { Chevron } from "../components/Chevron";
import {
  FilterChips,
  FILTER_CHIPS_HEIGHT,
  type FilterChip,
} from "../components/FilterChips";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { StatusTag } from "../components/StatusTag";
import type { RootStackParamList } from "../navigation/RootStack";
import { growthTally, useSession, type Row } from "../models/vaccination";
import {
  AGE_BANDS,
  ageBandOf,
  ageLabel,
  growthText,
  sexLabel,
  type GrowthLevel,
} from "../models/growth";
import { LEVEL_LABEL } from "../models/dspm";
import { tr } from "../i18n";
import { CONTENT_MAX, readable, useLayout, GUTTER } from "../theme/layout";
import { feel } from "../utils/haptics";
import { thaiShortDate } from "../utils/thaiDate";
import {
  CANVAS,
  DANGER_INK,
  INK_OK,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  WARNING,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** The ink each verdict is read in — the app's three, as everywhere else. */
const LEVEL_INK: Record<GrowthLevel, string> = {
  normal: INK_OK,
  watch: WARNING,
  abnormal: DANGER_INK,
};

const ART = 72;

/*
  Two rounds, one roster.

  A weighing and a developmental screening are the same page: a room of
  under-fives, one at a time, each opening a form of their own. What differs
  is every word on it — what the round is called, what a child who has not
  been seen yet is waiting FOR, and which three figures the centre reports.
  So the words live here and the page reads them, rather than the app
  carrying two copies of one screen.
*/
type Mode = {
  art: number;
  title: string;
  register: string;
  /** The tag on a child nothing has happened to yet. */
  waiting: string;
  /** What the three figures on the card are called. */
  bad: string;
  watch: string;
  good: string;
  route: "GrowthRecord" | "DspmRecord" | "DentalRecord";
};

const MODE: Record<"growth" | "dspm" | "dental", Mode> = {
  growth: {
    art: require("../../assets/services/checkup.png"),
    title: tr("ชั่งน้ำหนัก–วัดส่วนสูง", "Weight and height"),
    register: tr(
      "บัญชี 3 · ภาวะโภชนาการเด็ก 0–5 ปี",
      "Register 3 · Child nutrition, 0–5 yrs",
    ),
    waiting: tr("รอชั่ง", "To weigh"),
    bad: tr("ผิดปกติ", "Abnormal"),
    watch: tr("เฝ้าระวัง", "Watch"),
    good: tr("ปกติ", "Normal"),
    route: "GrowthRecord",
  },
  dspm: {
    art: require("../../assets/services/screening.png"),
    title: tr("คัดกรองพัฒนาการเด็ก", "Child development screening"),
    register: tr(
      "บัญชี 3 · พัฒนาการเด็ก DSPM",
      "Register 3 · Child development (DSPM)",
    ),
    waiting: tr("รอประเมิน", "To assess"),
    bad: tr("ล่าช้า / ส่งต่อ", "Delayed / refer"),
    watch: tr("สงสัยล่าช้า", "Suspected delay"),
    good: tr("สมวัย", "On track"),
    route: "DspmRecord",
  },
  dental: {
    art: require("../../assets/services/dental.png"),
    title: tr("ตรวจสุขภาพช่องปาก", "Oral health check"),
    register: tr(
      "บัญชี 3 · ทันตสุขภาพในโรงเรียน",
      "Register 3 · School dental health",
    ),
    waiting: tr("รอตรวจ", "To check"),
    bad: tr("ส่งต่อทันตแพทย์", "Refer to dentist"),
    watch: tr("เฝ้าระวัง", "Watch"),
    good: tr("ปกติ", "Normal"),
    route: "DentalRecord",
  },
};

/** Clears the single-capsule tray at the foot. */
const BAR_CLEAR = 104;

/** The bands this roster can be narrowed to. */
/** "all", or one of the age bands' own labels. */
type Band = string;

/*
  The age bands ARE the filter, and there is nothing else on the row.

  They were headings down the middle of the list and the chips above it were
  the verdicts — รอชั่ง, ผิดปกติ, ชั่งแล้ว. Two ways of cutting the same
  eight names, one of them a set of grey bars that pushed the list down the
  page and left a card stranded under each. A room is worked through by age
  and nothing else: the scale is set up differently for a baby than for a
  five-year-old, so a carer takes the under-ones, then the one-to-twos, and
  never wants a mixture.

  The verdicts are not lost by going — they were never something to work
  through, they are something to read, and they are read off the card above
  the chips, which says ผิดปกติ and เฝ้าระวัง as figures and ชั่งแล้ว as a
  fraction of the room.
*/
const BANDS: { key: Band; label: string }[] = [
  { key: "all", label: tr("ทั้งหมด", "All") },
  ...AGE_BANDS.map((b) => ({ key: b.label, label: b.label })),
];

/**
 * How this particular room is divided.
 *
 * By age at a ศพด. and by classroom at a school, because that is how each
 * of them is actually called: a nursery holds the whole nought-to-five span
 * and is worked through youngest to oldest, while every child in ป.1 is
 * seven and what separates them is which room they are sitting in. Age
 * bands over a class would be one chip holding fifty names and five holding
 * none.
 */
const chipsFor = (
  rooms: string[] | undefined,
): { key: Band; label: string }[] =>
  rooms == null || rooms.length < 2
    ? BANDS
    : [
        { key: "all", label: tr("ทั้งหมด", "All") },
        ...rooms.map((r) => ({ key: r, label: r })),
      ];

/** Whether a row belongs in a band — one function, so no count can drift. */
function inBand(row: Row, band: Band, byRoom: boolean): boolean {
  if (band === "all") return true;
  return byRoom
    ? row.target.room === band
    : ageBandOf(row.target.months) === band;
}

/**
 * The roster of a weighing round — "ชั่งน้ำหนัก–วัดส่วนสูง".
 *
 * The same sitting model as the vaccination roster and a completely
 * different page, because the work is different in the one way that decides
 * a screen's shape: there is nothing to tick.
 *
 * A vial is the same vial for fifty children, so that roster is a list of
 * checkboxes and a tray that says what pressing save would write. A weight
 * is one child's, taken one at a time, and read against a table before it
 * means anything — so this is a list of names that open a page each, and the
 * tray has one button on it, which goes to the summary.
 *
 * Grouped by age rather than listed flat. A room is worked through by age
 * because the scale is set up differently for a baby than for a
 * five-year-old, and a register in register order has a carer carrying an
 * infant scale back and forth across the hall.
 */
export function GrowthSession() {
  const nav = useNavigation<Nav>();
  const { width } = useLayout();
  const { session } = useSession();
  const [band, setBand] = useState<Band>("all");

  /*
    The room, oldest first, and one list however it is filtered.

    Age order whether the chip says "ทั้งหมด" or names a band: it is the
    order the scale is set up in, and it means the chips narrow the list
    without reordering it — the same child stays in the same place relative
    to the ones around them.
  */
  const per = session?.activity.records;
  const mode =
    MODE[per === "dspm" ? "dspm" : per === "dental" ? "dental" : "growth"];
  const rooms = session?.activity.rooms;
  const byRoom = rooms != null && rooms.length > 1;

  /*
    One handler for the whole roster, not one per row.

    A new arrow function per child means every row is a new element on
    every render, so ticking one child rebuilds all fifty-three — and a
    class of fifty-three is exactly where that is felt. Passing the id up
    instead lets the rows be compared and left alone.

    Whichever form this round is — the weighing or the developmental
    screening. It was hardcoded to the weighing one, so a screening round
    opened a child into "บันทึกภาวะโภชนาการ" and asked for a weight.
  */
  const open = useCallback(
    (targetId: string) => {
      feel("tick");
      nav.navigate(mode.route, { targetId });
    },
    [nav, mode.route],
  );

  const shown = useMemo(() => {
    if (session == null) return [];
    return session.rows
      .filter((r) => inBand(r, band, byRoom))
      .sort((a, z) => z.target.months - a.target.months);
  }, [session, band, byRoom]);

  const chips = useMemo<FilterChip<Band>[]>(() => {
    const set = chipsFor(rooms);
    if (session == null) return set;
    return set.map((b) => ({
      ...b,
      count: session.rows.filter((r) => inBand(r, b.key, byRoom)).length,
    }));
  }, [session, rooms, byRoom]);

  if (session == null) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Session" />
        <Text
          style={{ paddingVertical: SPACE.lg, paddingHorizontal: GUTTER, fontSize: 15, color: TEXT_SECONDARY }}
        >
          {tr("ยังไม่ได้เปิด Session", "No session open")}
        </Text>
      </View>
    );
  }

  const { activity, setup } = session;
  const t = growthTally(session);

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <ScreenHeader title={activity.title} />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            ...readable(),
            paddingHorizontal: GUTTER,
            paddingTop: HEADER_FADE,
            paddingBottom: BAR_CLEAR,
            gap: SPACE.md,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Where the round stands. The same card the vaccination roster
              leads with, carrying the two figures a weighing round is
              actually reported by in place of the vial. */}
          <Card style={{ gap: SPACE.md }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: SPACE.md,
              }}
            >
              <View style={{ flex: 1, gap: SPACE.sm }}>
                {/*
                  Twenty, not twenty-six, and 700 rather than 800.

                  It was copied from the vaccination roster's card, where
                  the same line holds "MMR" — three characters. "ชั่งน้ำหนัก–
                  วัดส่วนสูง" at that size is the loudest thing on the page
                  and it is saying what the header two inches above it has
                  already said.

                  Twenty is what a card's lead line is elsewhere in this app
                  — it is the commonest heading size in it by some way — and
                  the 800 goes to the figure on the right, which is the
                  thing this card is actually read for.
                */}
                <Text
                  style={{
                    fontSize: 20,
                    lineHeight: 30,
                    fontWeight: "700",
                    color: TEXT_PRIMARY,
                  }}
                >
                  {mode.title}
                </Text>
                {/* Which register this round is filed under. บัญชี 3 is the
                    nought-to-five population; a school round is filed under
                    the school health one, and saying บัญชี 3 over a class
                    of seven-year-olds would be a claim about where the
                    numbers go that is not true. */}
                <Text style={{ fontSize: 13, color: TEXT_SECONDARY }}>
                  {byRoom
                    ? tr(
                        "ภาวะโภชนาการนักเรียน · อนามัยโรงเรียน",
                        "Student nutrition · School health",
                      )
                    : mode.register}
                </Text>
              </View>

              <View style={{ alignItems: "flex-end", gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                  <Text
                    style={{
                      fontSize: 26,
                      lineHeight: 32,
                      fontWeight: "800",
                      color: t.measured > 0 ? INK_OK : TEXT_PRIMARY,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {t.measured}
                  </Text>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "700",
                      color: TEXT_MUTED,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {`/${t.targets}`}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: TEXT_MUTED }}>
                  {t.waiting === 0
                    ? tr("ครบทั้งกลุ่ม", "All done")
                    : tr(`เหลือ ${t.waiting} คน`, `${t.waiting} left`)}
                </Text>
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: SEPARATOR }} />

            {/* The two figures the centre reports, split — the chip below
                joins them because they share an action, and this is where
                the difference between them is read. */}
            <View style={{ flexDirection: "row", gap: SPACE.lg }}>
              <Figure label={mode.bad} value={t.abnormal} ink={DANGER_INK} />
              <Figure label={mode.watch} value={t.watch} ink={WARNING} />
              <Figure
                label={mode.good}
                value={t.measured - t.abnormal - t.watch}
                ink={INK_OK}
              />
            </View>

            <Image
              source={mode.art}
              style={{
                position: "absolute",
                right: SPACE.md,
                bottom: SPACE.md,
                width: ART,
                height: ART,
              }}
              resizeMode="contain"
              accessibilityRole="none"
            />

            <View style={{ gap: 2, paddingRight: ART + SPACE.lg }}>
              <Text
                numberOfLines={1}
                style={{ fontSize: 15, fontWeight: "700", color: TEXT_PRIMARY }}
              >
                {activity.place}
              </Text>
              <Text
                numberOfLines={1}
                style={{ fontSize: 13, color: TEXT_SECONDARY }}
              >
                {`${activity.group} · ${thaiShortDate(setup.at)}`}
              </Text>
              <Text
                numberOfLines={1}
                style={{ fontSize: 12, color: TEXT_MUTED }}
              >
                {`${setup.provider} (${setup.providerCode})`}
              </Text>
            </View>
          </Card>

          <View
            style={{ marginHorizontal: -GUTTER, height: FILTER_CHIPS_HEIGHT }}
          >
            <FilterChips
              chips={chips}
              value={band}
              onChange={setBand}
              pad={GUTTER}
            />
          </View>

          {/* No heading over the list. The chip row a few points above it
              already names the band on screen and counts it, and a second
              label saying the same thing was one more line between the
              carer and the first child. */}
          <Card padded={false}>
            {shown.length === 0 ? (
              <View style={{ padding: SPACE.xl, alignItems: "center" }}>
                <Text style={{ fontSize: 14, color: TEXT_MUTED }}>
                  {byRoom
                    ? tr("ไม่มีรายชื่อในห้องนี้", "No one in this room")
                    : tr(
                        "ไม่มีรายชื่อในช่วงอายุนี้",
                        "No one in this age group",
                      )}
                </Text>
              </View>
            ) : null}

            {/* One list, no headings. The chips above say which band is on
                screen; a grey bar repeating it inside the card said it
                twice and pushed the names down the page. */}
            {shown.map((row, i) => (
              <ChildRow
                key={row.target.id}
                row={row}
                first={i === 0}
                room={byRoom ? row.target.room : undefined}
                waiting={mode.waiting}
                onOpen={open}
              />
            ))}
          </Card>
        </ScrollView>
      </HeaderFade>

      {/*
        One button, because there is only one thing left to do.

        Nothing is batched here — each child's weighing is written from its
        own page as it is taken — so there is no selection to save and no
        tray to say what a save would write. What the foot of this screen is
        for is the way out: the summary, where the round is read and closed.
      */}
      <ActionBar
        side={width < 600 ? 25 : Math.max(25, (width - CONTENT_MAX) / 2 + 25)}
      >
        {/* Open as soon as anything has been settled, not only once
            something has been weighed. A morning where four children were
            brought and four were not is a morning with a report to file,
            and a button that stayed dead until a scale had been used would
            trap the carer on this page with no way to close it. */}
        <PrimaryAction
          label={
            t.waiting === t.targets
              ? tr("ยังไม่มีรายการที่บันทึก", "Nothing recorded yet")
              : t.waiting > 0
                ? tr(
                    `ดูสรุปงาน · ${t.measured}/${t.targets}`,
                    `View summary · ${t.measured}/${t.targets}`,
                  )
                : tr("ดูสรุปงาน", "View summary")
          }
          disabled={t.waiting === t.targets}
          onPress={() => nav.navigate("VaccineResult")}
        />
      </ActionBar>
    </View>
  );
}

/** One of the figures on the summary card. */
const Figure = ({
  label,
  value,
  ink,
}: {
  label: string;
  value: number;
  ink: string;
}) => (
  <View style={{ gap: 1 }}>
    <Text
      style={{
        fontSize: 20,
        lineHeight: 28,
        fontWeight: "700",
        color: value === 0 ? TEXT_MUTED : ink,
        fontVariant: ["tabular-nums"],
      }}
    >
      {value}
    </Text>
    <Text style={{ fontSize: 12, color: TEXT_MUTED }}>{label}</Text>
  </View>
);

/**
 * One child on the roster: who they are, where they stand, and a way in.
 *
 * No checkbox. There is nothing to select — the row IS the way to the page
 * that records this child — so it wears a chevron like every other row in
 * this app that opens something, and a carer who has been ticking a
 * vaccination roster all week is not invited to tick this one and wonder
 * why nothing was saved.
 */
/*
  Compared rather than rebuilt.

  A roster is fifty-three of these, and every one of them was a new
  element whenever anything on the page changed — a chip pressed, a child
  ticked, a count going up. Memoised, a row is only redrawn when its own
  child changes, which is what a list of fifty-three has to do to stay
  under the finger.
*/
const ChildRow = memo(function ChildRow({
  row,
  first,
  room,
  waiting,
  onOpen,
}: {
  row: Row;
  first: boolean;
  /** The classroom, where the group is called in rooms. */
  room?: string;
  /** What a child nothing has happened to yet is waiting FOR. */
  waiting: string;
  onOpen: (targetId: string) => void;
}) {
  const { target, outcome, growth, dspm } = row;

  /*
    Where the row stands, from whichever of the two forms was filled in.

    The verdict's own word, not "done" — "ผอม" and "สงสัยล่าช้า" are what
    the register is read by, and a roster that said only "บันทึกแล้ว" would
    make a carer open every child to find the ones that matter.
  */
  const tag =
    growth != null
      ? {
          ink: LEVEL_INK[growth.level],
          Icon: growth.level === "normal" ? CircleCheck : TriangleAlert,
          text: growthText(growth.label),
        }
      : dspm != null
        ? {
            ink:
              dspm.level === "onTrack"
                ? INK_OK
                : dspm.level === "suspect"
                  ? WARNING
                  : DANGER_INK,
            Icon: dspm.level === "onTrack" ? CircleCheck : TriangleAlert,
            // Named from the level rather than the stored word, so a
            // screening saved in one language reads in the other.
            text: LEVEL_LABEL[dspm.level] ?? dspm.label,
          }
        : outcome === "absent"
          ? {
              ink: TEXT_SECONDARY,
              Icon: UserX,
              text: tr("ไม่มารับบริการ", "Not present"),
            }
          : outcome === "refused"
            ? { ink: TEXT_SECONDARY, Icon: Ban, text: tr("ปฏิเสธ", "Refused") }
            : { ink: TEXT_SECONDARY, Icon: Scale, text: waiting };

  return (
    <View>
      {first ? null : (
        <View
          style={{
            height: 1,
            backgroundColor: SEPARATOR,
            marginLeft: SPACE.lg,
          }}
        />
      )}

      <Pressable
        onPress={() => onOpen(row.target.id)}
        accessibilityRole="button"
        accessibilityLabel={`${target.name} ${tag.text}`}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.md,
          paddingHorizontal: SPACE.md,
          paddingVertical: SPACE.md,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: 15, fontWeight: "600", color: TEXT_PRIMARY }}
          >
            {target.name}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 12, color: TEXT_MUTED }}>
            {[
              room == null ? null : room,
              sexLabel(target.sex),
              ageLabel(target.months),
              growth != null
                ? tr(
                    `${growth.kg.toFixed(1)} กก. · ${growth.cm.toFixed(1)} ซม.`,
                    `${growth.kg.toFixed(1)} kg · ${growth.cm.toFixed(1)} cm`,
                  )
                : dspm != null
                  ? tr(
                      `ช่วง ${dspm.window} ด. · ผ่าน ${dspm.passed}/${dspm.total} ข้อ`,
                      `${dspm.window}-mo window · passed ${dspm.passed}/${dspm.total}`,
                    )
                  : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>

        <StatusTag label={tag.text} ink={tag.ink} Icon={tag.Icon} />
        <Chevron />
      </Pressable>
    </View>
  );
});
