import { memo, useCallback, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Ban,
  CircleCheck,
  ShieldCheck,
  Syringe,
  TriangleAlert,
  UserX,
} from "lucide-react-native";

import {
  ActionBar,
  PrimaryAction,
  SecondaryAction,
} from "../components/ActionBar";
import { PressableScale } from "../components/PressableScale";
import { CheckBox } from "../components/CheckBox";
import { Card } from "../components/Card";
import { StatusTag } from "../components/StatusTag";
import { ReasonSheet } from "../components/ReasonSheet";
import {
  FilterChips,
  FILTER_CHIPS_HEIGHT,
  type FilterChip,
} from "../components/FilterChips";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { GrowthSession } from "./GrowthSessionScreen";
import { ScreenHeader } from "../components/ScreenHeader";
import { toast } from "../components/Toast";
import { SectionHeader } from "../components/SectionHeader";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  ABSENT_REASONS,
  ACTIVITY_NOUN,
  CHECK_LABEL,
  checkTarget,
  OVERRIDE_REASONS,
  override,
  REFUSED_REASONS,
  setOutcome,
  tally,
  useSession,
  type CheckLevel,
  type ActivityKind,
  type Lot,
  type Outcome,
  type Row,
} from "../models/vaccination";
import { feel } from "../utils/haptics";
import { thaiShortDate } from "../utils/thaiDate";
import {
  CANVAS,
  DANGER_BG,
  DANGER_INK,
  FILL_SUBTLE,
  INK_OK,
  RADIUS,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_DISABLED,
  TEXT_SECONDARY,
  WARNING,
  WARNING_BG,
  GROUPED_BG,
  PRIMARY_500,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * How far the roster clears the tray pinned at its foot.
 *
 * The tray is a tick-all, three lines of verdict and a 48pt capsule inside
 * 16pt of padding, sitting 8pt off the foot — about 225. Rounded up, because
 * the last child in a class should be readable rather than half under the
 * plate.
 */
const PANEL_CLEAR = 244;

/**
 * The drawing in the vial card's corner.
 *
 * Past the asset's own size: it is 144px at @3x, which is 48 points exactly,
 * so this is a half-again upscale. It holds because the drawing is a shaded
 * render rather than line art — the one part that could show it is the
 * needle, and that is the thinnest thing on it. If it ever reads soft, the
 * fix is a larger export of the asset, not a smaller box.
 */
const ART = 72;

/**
 * One drawing per kind of work.
 *
 * It was the vaccine vial on all three. A school health check opened its
 * roster under a picture of a syringe — the one thing that sitting does not
 * involve, on the card that says what is being given.
 */
const ART_FOR: Record<ActivityKind, ImageSourcePropType> = {
  vaccination: require("../../assets/services/vaccine.png"),
  schoolHealth: require("../../assets/services/checkup.png"),
  screening: require("../../assets/services/screening.png"),
  dental: require("../../assets/services/dental.png"),
};

/** The bands the roster can be narrowed to. */
type Band = "all" | "ready" | "review" | "warn" | "missed" | "done";

/*
  The bands, each with the colour its count is set in.

  The same colours the summary card above the roster uses for the same
  figures — green for done, amber for wants checking, red for blocked — so
  the chip row and the card are saying one thing in one language rather than
  two. "ทั้งหมด" takes none: it is the whole class, not a verdict.
*/
const BANDS: { key: Band; label: string; ink?: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  // Blue, the app's own colour for what is there to be done: ready is the
  // state before the work, and green is kept for the work done.
  { key: "ready", label: "พร้อม", ink: PRIMARY_500 },
  { key: "review", label: "ตรวจสอบ", ink: WARNING },
  { key: "warn", label: "เตือน", ink: DANGER_INK },
  { key: "missed", label: "ไม่มา/ปฏิเสธ", ink: TEXT_SECONDARY },
  { key: "done", label: "บันทึกแล้ว", ink: INK_OK },
];

/**
 * Whether a row belongs in a band.
 *
 * One function rather than a switch in the filter and another in the
 * counts: a band whose tab says four and whose list shows three is worse
 * than no count at all, and that is exactly what two copies of this drift
 * into.
 */
function inBand(row: Row, band: Band, lot: Lot | undefined): boolean {
  switch (band) {
    case "all":
      return true;
    case "missed":
      return row.outcome === "absent" || row.outcome === "refused";
    case "done":
      return row.outcome === "recorded";
    default:
      // The three remaining bands are the check's own verdicts, and they are
      // only asked about somebody nothing has been settled for yet.
      return (
        row.outcome === "waiting" && checkTarget(row.target, lot).level === band
      );
  }
}

/**
 * The roster, and the one set of details about to be written across it.
 *
 * Everything on this screen is arranged around one question: who is safe to
 * record right now. The bands are that question asked six ways, and they sit
 * at the foot of the vial's card — so the page reads in the order the work
 * happens: what is being given, to how many, then which of them to look at.
 * The screen answers in three blocks: what is in the carer's hand
 * (the vial, and how far through the class they are), who is in front of
 * them, and — on glass at the foot — what pressing save would actually
 * write, counted by the check's own verdict rather than by how many rows are
 * ticked, because a selection of ten that contains one duplicate is not a
 * save of ten.
 */
export function VaccineSessionScreen() {
  /*
    A weighing round is not this screen.

    It was for a while, and the artwork and the three empty verdict chips
    were the symptoms: a roster of tick boxes under a tray counting what a
    batch save would write, put in front of a carer whose job that morning
    is to stand eight children on a scale one at a time. There is no batch
    and nothing to tick — a weight is one child's and means nothing until it
    has been read against a table.

    Rather than grow a second layout inside this one, which shares a session
    with it and nothing else, the sitting says which page it is.
  */
  const { session } = useSession();
  const per = session?.activity.records;
  // Both of the rounds that are worked one child at a time — a weighing and
  // a developmental screening — are the same roster with different words.
  // The three per-child rounds share one roster: a list of names, bands to
  // narrow it by, and a form behind each name. Only the nouns differ, and
  // those live in that screen's own table.
  if (per === "growth" || per === "dspm" || per === "dental") {
    return <GrowthSession />;
  }
  return <Roster />;
}

/** The vaccination roster: one vial, a class, and a tray that saves a batch. */
function Roster() {
  const nav = useNavigation<Nav>();
  const { session } = useSession();
  const [band, setBand] = useState<Band>("all");
  const [picked, setPicked] = useState<string[]>([]);
  /*
    The row a reason is being asked about, and which of the three questions
    it is. One piece of state rather than three sheets: only one of them can
    be open, and a second `visible` flag is a second thing to get wrong.
  */
  const [asking, setAsking] = useState<{
    row: Row;
    kind: "override" | "absent" | "refused";
    /** What the check found — only the override question shows one. */
    warning?: string;
  } | null>(null);

  /*
    A band that is not on the row cannot be the one being looked at.

    The three verdict bands are dropped on a sitting with no vial, and a
    carer arriving on one while `band` still held "warn" would have got an
    empty list under a row of chips none of which was marked.
  */
  const onBand: Band =
    session?.setup.lot == null &&
    (band === "ready" || band === "review" || band === "warn")
      ? "all"
      : band;

  const shown = useMemo(() => {
    if (session == null) return [];
    return session.rows.filter((r) => inBand(r, onBand, session.setup.lot));
  }, [session, onBand]);

  /*
    What each band holds, on the tab itself.

    Of the whole roster, not of the search: the tabs are how a carer decides
    where to look next, and a set of counts that emptied as they typed a name
    would answer a question nobody asked.
  */
  const tabs = useMemo<FilterChip<Band>[]>(() => {
    if (session == null) return BANDS;
    /*
      The three verdict bands belong to the vial.

      "พร้อม", "ตรวจสอบ" and "เตือน" are what `checkTarget` found about a
      dose — a duplicate, a short interval, an expired lot. A sitting with
      no vial has none of those and never will, so on a school health check
      they were three filters that could only ever say nought, taking half
      the row from the two that work.
    */
    const shown =
      session.setup.lot == null
        ? BANDS.filter(
            (b) => b.key !== "ready" && b.key !== "review" && b.key !== "warn",
          )
        : BANDS;
    return shown.map((b) => ({
      ...b,
      count: session.rows.filter((r) => inBand(r, b.key, session.setup.lot))
        .length,
    }));
  }, [session]);

  /*
    Overruling a warning opens the sheet, not an alert.

    An alert could say yes or no and nothing else, so the reason was written
    into the handler — every override in every history read "ตรวจสอบประวัติ
    วัคซีนแล้ว" whatever had actually happened. The sheet asks which of the
    three things a carer actually has to say is true, and writes that.
  */
  const ask = (row: Row, warning: string) =>
    setAsking({ row, kind: "override", warning });

  /*
    Three handlers for the whole roster, not three per row.

    A new arrow function per child meant every row was a new element
    whenever anything on the page changed — a chip pressed, a child ticked
    — so a class of fifty-three rebuilt fifty-three rows to show one tick.
    Taking the row up instead lets the rows be compared and left alone.
  */
  const rowOf = useCallback(
    (id: string) => session?.rows.find((r) => r.target.id === id),
    [session],
  );
  const askWhy = useCallback(
    (id: string, reason: string) => {
      const r = rowOf(id);
      if (r != null) ask(r, reason);
    },
    [rowOf],
  );
  const mark = useCallback(
    (id: string, next: Outcome) => {
      // Undoing needs no reason; the other two are decisions about a
      // person and the record has to say why.
      if (next === "waiting") {
        setOutcome(id, "waiting");
        feel("tick");
        toast("ย้อนกลับเป็นรอให้บริการแล้ว");
        return;
      }
      const r = rowOf(id);
      if (r != null) {
        setAsking({ row: r, kind: next === "absent" ? "absent" : "refused" });
      }
    },
    [rowOf],
  );

  /*
    Every hook above this line, and none below it.

    The three handlers used to be declared after the early return here, so
    the render that found the session gone — the one straight after
    closing it — ran three fewer hooks than the one before, and React
    stopped the app with "Rendered fewer hooks than expected".
  */
  if (session == null) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Session" />
        <Text
          style={{ padding: SPACE.lg, fontSize: 15, color: TEXT_SECONDARY }}
        >
          ยังไม่ได้เปิด Session
        </Text>
      </View>
    );
  }

  const { setup, activity } = session;
  const t = tally(session);
  const waiting = t.targets - t.recorded - t.absent - t.refused;
  /*
    Every name on the roster has been answered — recorded, away, or declined.

    Of the whole class, not of the band on screen: a carer standing on the
    "เตือน" filter with nothing in it has not finished the class. While
    anything is still waiting the tray is for picking and saving; once
    nothing is, there is nothing left to pick and the only thing left to do
    is look at what was done.
  */
  const finished = waiting === 0;

  // The verdict on what is ticked, which is what the button is allowed to
  // save. Counted here rather than in the model so the panel and the button
  // can never disagree about the same selection.
  /*
    Of the ticked, the ones still waiting on something.

    The selection outlives a save — this screen stays mounted while the
    confirm and result pages are pushed over it — so without this the tray
    would go on offering to write fifty names that have already been
    written the moment a carer came back to it.
  */
  const live = picked.filter((id) =>
    session.rows.some((r) => r.target.id === id && r.outcome === "waiting"),
  );

  const verdicts = live
    .map((id) => session.rows.find((r) => r.target.id === id))
    .filter((r): r is Row => r != null)
    .map((r) => ({ row: r, level: checkTarget(r.target, setup.lot).level }));
  const green = verdicts.filter((v) => v.level === "ready").length;
  const yellow = verdicts.filter((v) => v.level === "review").length;
  // Counted, not blocked. All three save; the red line is there so a carer
  // knows, before pressing, that one of the names under their thumb is one
  // the records object to.
  const red = verdicts.filter((v) => v.level === "warn").length;

  const toggle = (id: string) =>
    setPicked((was) =>
      was.includes(id) ? was.filter((x) => x !== id) : [...was, id],
    );

  /*
    What "all" means: everyone in the band on screen who has not been settled
    yet. Not the whole class — somebody already recorded, absent or refused
    is not waiting on anything, and sweeping them back into a save would be
    the one thing this screen exists to prevent.
  */
  const open = shown.filter((r) => r.outcome === "waiting");
  const openIds = open.map((r) => r.target.id);

  const pickedHere = openIds.filter((id) => picked.includes(id)).length;
  const allPicked = open.length > 0 && pickedHere === open.length;
  /** Some but not all — the tick-all's third state. */
  const someHere = pickedHere > 0 && !allPicked;

  const toggleAll = () =>
    setPicked((was) =>
      allPicked
        ? // Only this band's: a carer who ticked names under another filter
          // should not lose them by clearing this one.
          was.filter((id) => !openIds.includes(id))
        : [...new Set([...was, ...openIds])],
    );


  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      {/*
        No search on this roster.

        Everything a field could have found is already a band: a carer does
        not come to this page looking for one child by name, they work down
        the class. The one search that mattered — "who still needs doing" —
        is what the chips below answer, and they answer it with a count,
        which is something typing never could.
      */}
      <ScreenHeader title={activity.title} />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: SPACE.lg,
            paddingTop: HEADER_FADE,
            // Clears the tray pinned at the foot, which used to sit over
            // the last two rows of the roster. Not the safe-area inset —
            // the tray is placed against the foot of the screen, not
            // against the inset, so adding it would leave a home
            // indicator's worth of empty scroll under the last child.
            // The tray is a bar when the class is done and a panel while
            // it is not, and they are nowhere near the same height.
            paddingBottom: finished ? 104 : PANEL_CLEAR,
            gap: SPACE.md,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/*
            What is in the carer's hand, and how far through the class they
            are. Rearranged around two facts, because those are the two the
            page is glanced at for between children.

            No ring. It drew the share already written as a circle of twenty
            ticks beside the figure that said the same thing in numerals, and
            a chart nobody reads a value off is decoration — it was the
            tallest thing on the card and the one carrying the least.

            No strip of four counts either. Every figure in it is on a filter
            chip a few points above, in colour, on something that can be
            tapped — so the card said them a second time in a form that
            cannot be acted on. What is left is the one number the chips do
            not carry: how many of the class are still waiting.
          */}
          <Card style={{ gap: SPACE.md }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: SPACE.md,
              }}
            >
              <View style={{ flex: 1, gap: SPACE.sm }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    gap: SPACE.sm,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 26,
                      lineHeight: 32,
                      fontWeight: "800",
                      color: TEXT_PRIMARY,
                    }}
                  >
                    {setup.lot?.kind ?? ACTIVITY_NOUN[activity.kind]}
                  </Text>
                  {setup.lot != null && (
                    <Text style={{ fontSize: 13, color: TEXT_SECONDARY }}>
                      {`เข็ม ${setup.lot.dose} · ${setup.lot.site}`}
                    </Text>
                  )}
                </View>

                {/* The lot as one object rather than a fourth grey line.
                    It is the vial's name, and it is what a record is
                    queried by months later — it belongs with the vaccine,
                    not in the block about the school. Nothing to show for a
                    sitting that gives nothing out of a bottle. */}
                {setup.lot != null && (
                  <View
                    style={{
                      alignSelf: "flex-start",
                      paddingHorizontal: SPACE.md,
                      paddingVertical: 5,
                      borderRadius: RADIUS.capsule,
                      backgroundColor: FILL_SUBTLE,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: TEXT_SECONDARY,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {`Lot ${setup.lot.lot}`}
                    </Text>
                  </View>
                )}
              </View>

              {/*
                Where the ring was: the same progress, read rather than
                looked at. Two figures — how many are written, and how many
                of the class are still waiting on the carer — set against
                the right edge so they line up as a column of their own.
              */}
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                  <Text
                    style={{
                      fontSize: 26,
                      lineHeight: 32,
                      fontWeight: "800",
                      color: t.recorded > 0 ? INK_OK : TEXT_PRIMARY,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {t.recorded}
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
                  {waiting === 0 ? "ครบทั้งกลุ่ม" : `เหลือ ${waiting} คน`}
                </Text>
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: SEPARATOR }} />

            {/*
              The vial itself, seated in the corner the counts used to stand
              in. The card is about what is in the carer's hand and — since
              the ring came off it — had nothing but text on it; this is the
              same drawing the service carries on the Services page, so the
              two read as one piece of work.

              Drawn at the size it was made at. The asset is 144px at @3x,
              which is exactly 48 points, and anything larger would be an
              upscale showing on the needle.
            */}
            <Image
              source={ART_FOR[activity.kind]}
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

            {/* Where the work is happening. Three lines at three weights,
                not four at one: the school is what a carer checks they are
                at, the class and the date are what the record is filed
                under, and the provider is a signature.

                Kept clear of the drawing: these are the card's longest
                lines, and a school name running under a syringe truncates
                at a place that looks like a bug. The drawing is tall enough
                to stand beside all three, so all three are held off it. */}
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

          {/*
            The bands, under the vial rather than pinned in the header.

            They belong to the roster, not to the page: read in that order
            the card says what is being given and to how many, and the chips
            then narrow the list that follows them. Pinned above the card
            they were the first thing on the screen and answered a question
            nobody had asked yet.

            Run out past the page's own side margin and given it back as the
            row's padding, so the chips scroll off the edge of the screen
            rather than stopping short of it at a line nothing else draws.
          */}
          <View
            style={{
              marginHorizontal: -SPACE.lg,
              height: FILTER_CHIPS_HEIGHT,
            }}
          >
            <FilterChips
              chips={tabs}
              value={onBand}
              onChange={setBand}
              pad={SPACE.lg}
            />
          </View>

          <SectionHeader title="รายชื่อ" count={shown.length} flush />

          <Card padded={false}>
            {shown.length === 0 ? (
              <View style={{ padding: SPACE.xl, alignItems: "center" }}>
                <Text style={{ fontSize: 14, color: TEXT_MUTED }}>
                  ไม่มีรายชื่อในกลุ่มนี้
                </Text>
              </View>
            ) : null}
            {shown.map((row, i) => (
              <RosterRow
                key={row.target.id}
                row={row}
                first={i === 0}
                picked={picked.includes(row.target.id)}
                level={checkTarget(row.target, setup.lot).level}
                reason={checkTarget(row.target, setup.lot).reason}
                onToggle={toggle}
                onOverride={askWhy}
                onMark={mark}
              />
            ))}
          </Card>
        </ScrollView>
      </HeaderFade>

      {/*
        The tray, pinned: what pressing save would actually write, and the
        one button that writes it.

        The app's own ActionBar, not a panel assembled here — which is where
        both things wrong with the old one came from. It sat at the safe-area
        inset plus a margin, over forty points clear of the foot on a phone
        with a home indicator, while every other floating bar in the app sits
        at twenty-three, level with the tab bar's pill. And it cast no
        shadow: the ring that casts one was gated on the material being
        absent, on the reasoning that Liquid Glass carries its own depth.
        True of a small control over a busy page. Not true of a wide tray
        standing on a column of white cards, which it dissolved into.

        The ActionBar throws its shadow from the outer view, outside the
        plate that clips to its own corners — a shadow on the plate would be
        cut away by the same overflow that rounds it.
      */}
      {/*
        Wider and lower than the app's standard tray, and roomier inside.

        The standard frame is built for a bar that IS a button: 25 in from
        each side, 23 up from the foot, 8 of padding around a capsule. This
        one carries a readout above its button — what pressing save would
        actually write — so it takes the map sheet's frame instead, 8pt clear
        of each edge, with the app's own 16 inside it. Content in an 8pt tray
        sits on the glass rim.

        Its corners too: 36 across the top and 58 along the bottom. Rounder
        below than above is what makes the sheet read as seated into the foot
        of the screen rather than floating square above it, and this tray
        sits in the same place.
      */}
      {finished ? (
        /*
          Nothing left to tick, so the tray goes back to being a bar.

          It used to go on offering a tick-all over an empty set and a save
          button that could never light — a page saying "do something" about
          work that is finished. One button now, and it goes where the answer
          is.

          And in the app's standard frame, not the wide one above. That frame
          exists for a tray carrying a readout: nearly the full width, 16
          inside, and 58 of radius along the bottom so it seats into the foot
          of the screen. Around one capsule the whole thing is eighty points
          tall, which is less than twice that radius — the corners eat the
          sides and it comes out as a lozenge rather than a bar. The standard
          frame is the one built for a tray that IS a button.
        */
        <ActionBar>
          {/* Through to the summary, which is where a sitting is read and
              where it is closed. Nothing here closes anything: this page is
              the class, not the report on it. */}
          <PrimaryAction
            label="ดูสรุปงาน"
            onPress={() => nav.navigate("VaccineResult")}
          />
        </ActionBar>
      ) : (
        <ActionBar
          side={SPACE.sm}
          bottom={SPACE.sm}
          pad={SPACE.lg}
          radius={36}
          bottomRadius={58}
        >
          <>
            <View style={{ gap: SPACE.md }}>
              {/*
              The tick-all, in the tray rather than beside the list heading.

              It belongs with what it feeds: this is the only place on the
              screen that says what a save would write, and the control that
              fills a selection in one press should be read in the same glance
              as the figures that selection produces. Up by the heading it was
              a button that scrolled away from its own consequences.

              It is a checkbox and not a button because it has a state — press
              it twice and the selection clears, which a button labelled
              "เลือกทั้งหมด" gives no way to say.
            */}
              <Pressable
                onPress={open.length === 0 ? undefined : toggleAll}
                accessibilityRole="checkbox"
                accessibilityState={{
                  checked: allPicked,
                  disabled: open.length === 0,
                }}
                accessibilityLabel="เลือกทั้งหมดในกลุ่มที่กรอง"
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACE.md,
                  opacity: pressed && open.length > 0 ? 0.6 : 1,
                })}
              >
                {/*
                Three states, because it has three.

                Checked when the whole band is ticked, a dash when some of it
                is, empty when none is — the standard tri-state. It drew an
                empty box for "some", which told a carer with twelve names
                ticked that nothing was selected.

                Unlike the rows, this one stays drawn when it cannot be used:
                it is a fixed control in the tray, and the label beside it dims
                with it, so there is nothing to mistake it for.
              */}
                <CheckBox
                  on={allPicked}
                  mixed={!allPicked && someHere}
                  size={24}
                  radius={8}
                  edge={open.length === 0 ? TEXT_DISABLED : TEXT_MUTED}
                />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 15,
                    fontWeight: "600",
                    color: open.length === 0 ? TEXT_DISABLED : TEXT_PRIMARY,
                  }}
                >
                  เลือกทั้งหมด
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: TEXT_MUTED,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {`${pickedHere}/${open.length}`}
                </Text>
              </Pressable>

              <View style={{ height: 1, backgroundColor: SEPARATOR }} />

              {/*
              What the button would actually write, counted by the check's own
              verdict rather than by how many rows are ticked — a selection of
              ten holding one duplicate is not a save of ten.

              All three lines, every time, including the zeros. They were
              pills that appeared and vanished, which moved the button under
              the thumb between one glance and the next; and a red nought is
              worth reading — it is the line that says nothing under the
              thumb is one the records object to.
            */}
              {picked.length === 0 ? (
                <Text
                  style={{ fontSize: 13, lineHeight: 19, color: TEXT_MUTED }}
                >
                  เลือกรายชื่อเพื่อบันทึกบริการทั้งชุด
                </Text>
              ) : (
                <View style={{ gap: SPACE.xs }}>
                  <Verdict label="ผ่านการตรวจสอบ" value={green} ink={PRIMARY_500} />
                  <Verdict label="ต้องตรวจสอบ" value={yellow} ink={WARNING} />
                  <Verdict
                    label="เตือน ยังไม่ Override"
                    value={red}
                    ink={DANGER_INK}
                  />
                </View>
              )}
            </View>

            {/*
              It hands the batch over; it does not write it.

              Fifty names ticked on a list being worked down quickly is not
              the same act as fifty entries in fifty vaccination records,
              and this button used to be both. The detail page reads the
              batch back — with the names the records object to in it — and
              the save happens there.
            */}
            <PrimaryAction
              label={live.length === 0 ? "ถัดไป" : `ถัดไป · ${live.length} คน`}
              disabled={live.length === 0}
              // The ticks stay ticked. Coming back to change the selection
              // and finding it cleared means doing the work twice, and the
              // selection is not stale anyway: `live` drops each name as it
              // is recorded, so what is left after a save is exactly what
              // was not saved.
              onPress={() => {
                if (live.length === 0) return;
                nav.navigate("VaccineResult", { ids: live });
              }}
            />
          </>
        </ActionBar>
      )}

      {/*
        One sheet, three questions.

        Absent and refused ask for a reason for the same reason an override
        does: what the register has to answer later is not "how many missed
        it" but "how many can be caught next round", and that is a different
        answer for a child off sick and a child who has left the school.
      */}
      <ReasonSheet
        visible={asking != null}
        title={
          asking?.kind === "override"
            ? "Override คำเตือน"
            : asking?.kind === "absent"
              ? "ไม่มารับบริการ"
              : "ปฏิเสธรับบริการ"
        }
        name={asking?.row.target.name ?? ""}
        who={
          asking == null
            ? ""
            : `HN ${asking.row.target.hn} · ${asking.row.target.room} · ${asking.row.target.ageYears} ปี ${asking.row.target.ageMonths} ด.`
        }
        warning={asking?.warning}
        reasons={
          asking?.kind === "override"
            ? OVERRIDE_REASONS
            : asking?.kind === "absent"
              ? ABSENT_REASONS
              : REFUSED_REASONS
        }
        question={
          asking?.kind === "override"
            ? "เหตุผลที่ Override"
            : asking?.kind === "absent"
              ? "สาเหตุที่ไม่มารับบริการ"
              : "สาเหตุที่ปฏิเสธ"
        }
        confirmLabel={
          asking?.kind === "override"
            ? "ยืนยัน Override"
            : asking?.kind === "absent"
              ? "บันทึกไม่มารับบริการ"
              : "บันทึกปฏิเสธ"
        }
        danger={asking?.kind === "override"}
        note={
          asking?.kind === "override"
            ? "ระบบบันทึกเหตุผล ผู้ให้บริการ และวันเวลาไว้ใน Audit Trail และจะปรากฏในประวัติ Session นี้"
            : "สาเหตุจะถูกเก็บไว้กับรายชื่อนี้ และใช้จัดคิวติดตามรอบหน้า"
        }
        onClose={() => setAsking(null)}
        onConfirm={(reason) => {
          if (asking == null) return;
          if (asking.kind === "override") {
            override(asking.row.target.id, reason);
            feel("success");
            // Warning, not success: the check's objection still stands on record.
            toast("Override แล้ว · บันทึกเหตุผลไว้แล้ว", "warning");
          } else {
            setOutcome(asking.row.target.id, asking.kind, reason);
            feel("tick");
            toast(
              asking.kind === "absent"
                ? "บันทึกไม่มารับบริการแล้ว"
                : "บันทึกปฏิเสธแล้ว",
              "success",
            );
          }
          setAsking(null);
        }}
      />
    </View>
  );
}

/**
 * One line of the tray's verdict: what it is, and how many.
 *
 * A row rather than a pill. Three pills wrapped onto two lines at some
 * selections and one at others, which moved everything under them; and a
 * figure at the end of its own line is read against the two above it, which
 * is the comparison being made.
 */
const Verdict = ({
  label,
  value,
  ink,
}: {
  label: string;
  value: number;
  ink: string;
}) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
    <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, color: ink }}>
      {label}
    </Text>
    <Text
      style={{
        fontSize: 15,
        fontWeight: "800",
        color: ink,
        fontVariant: ["tabular-nums"],
      }}
    >
      {value}
    </Text>
  </View>
);

/*
  Compared rather than rebuilt.

  A class is up to fifty-three of these, each carrying glass, a status mark
  and up to two action capsules. Memoised, a row is redrawn only when its
  own child changes — which is what a roster has to do to stay under the
  finger of somebody working down it one name at a time.
*/
const RosterRow = memo(function RosterRow({
  row,
  first,
  picked,
  level,
  reason,
  onToggle,
  onOverride,
  onMark,
}: {
  row: Row;
  first: boolean;
  picked: boolean;
  level: CheckLevel;
  reason?: string;
  onToggle: (targetId: string) => void;
  onOverride: (targetId: string, reason: string) => void;
  /** Settle the row without a dose — the child is not here, or said no. */
  onMark: (targetId: string, outcome: Outcome) => void;
}) {
  const { target, outcome } = row;
  const settled = outcome !== "waiting";
  /*
    Which rows carry actions.

    The ones the check has stopped or questioned, and only those. Every row
    could in principle be marked absent, but fifty rows each wearing two
    capsules is a wall — and the rows that need a decision are exactly the
    ones that are not simply ticked and saved.
  */
  const flagged =
    !settled &&
    (level === "warn" || level === "review") &&
    row.override == null;
  /*
    A saved row is a draft, so it can be taken back.

    Nothing reaches the system until the sitting is closed; until then every
    line of it is still a note a carer is making. A row that could never be
    changed again the moment it was ticked would make the save a commitment
    the flow does not ask for — and the first wrong tap of a long morning
    unfixable.
  */
  const undoable = settled;

  /*
    Where the row stands: a colour, a word, and a glyph.

    The glyph is the new part and it is what makes fifty of these scannable.
    Six of the seven states are Thai words of similar length in one of three
    colours, and colour alone is the one channel a reader can be missing —
    about one man in twelve cannot separate the red from the amber, which
    here is the difference between "stop" and "look".
  */
  const tag =
    outcome === "recorded"
      ? { ink: INK_OK, Icon: CircleCheck, text: "บันทึกแล้ว" }
      : outcome === "absent"
        ? {
            ink: TEXT_SECONDARY,
            Icon: UserX,
            text: "ไม่มารับบริการ",
          }
        : outcome === "refused"
          ? { ink: TEXT_SECONDARY, Icon: Ban, text: "ปฏิเสธ" }
          : row.override != null
            ? {
                ink: WARNING,
                Icon: ShieldCheck,
                text: "Override แล้ว",
              }
            : level === "warn"
              ? {
                  ink: DANGER_INK,
                  Icon: TriangleAlert,
                  text: CHECK_LABEL.warn,
                }
              : level === "review"
                ? {
                    ink: WARNING,
                    Icon: TriangleAlert,
                    text: CHECK_LABEL.review,
                  }
                : {
                    // The band's blue — ready to be given, and not yet
                    // given, which is green's.
                    ink: PRIMARY_500,
                    Icon: Syringe,
                    text: CHECK_LABEL.ready,
                  };

  return (
    // The tick is said by the box, and only by the box.
    //
    // The row used to wash blue behind it as well, on the reasoning that a
    // 24pt square is small to find among fifty. But a class is ticked in
    // runs, and a run of washed rows turns the list into blocks of colour
    // with the names inside them — the roster stops reading as a register.
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

      {/* The whole row is the tick. A carer holding a phone in one hand and
          a vial in the other is not aiming for a checkbox. */}
      <Pressable
        onPress={settled ? undefined : () => onToggle(target.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: picked, disabled: settled }}
        accessibilityLabel={target.name}
        style={({ pressed }) => ({
          paddingHorizontal: SPACE.md,
          paddingVertical: SPACE.md,
          opacity: pressed && !settled ? 0.6 : 1,
        })}
      >
        {/*
          The tick, the name and the state on one line — who they are on the
          line under it.

          The name and the HN used to be a two-line block set beside the
          box, which left both the box and the chip floating in the gap
          between those two lines, level with neither. A register is read
          across: this name, ticked or not, and where it stands. The
          identifiers are the second look — they confirm a name rather than
          compete with it — so they hang below, in the same gutter the
          reason and the note already hang in.
        */}
        <View style={{ gap: 2 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.md,
            }}
          >
            {/*
              A box means you can tick it. That is the whole rule.

              It used to draw one on every row and say which were live
              through the border colour — and the wrong way round: the rows
              that could be ticked were outlined in SEPARATOR, a divider
              colour at about 1.25:1 on white and effectively invisible,
              while the settled ones that do nothing when pressed got the
              darker TEXT_DISABLED. The control you could use was the
              fainter of the two.

              So a settled row draws no box at all, keeping the gutter so
              the names stay in line. What it has already been marked as is
              on the chip at the other end of the row, which is a statement
              rather than a control — nothing about it invites a press.
            */}
            {settled ? (
              <View style={{ width: 24, height: 24 }} />
            ) : (
              // TEXT_MUTED, not SEPARATOR: a control's outline has to clear
              // 3:1 against what it stands on to be seen at all. This is
              // 5.7:1 on white and 5.6:1 on the dark card.
              <CheckBox on={picked} size={24} radius={8} edge={TEXT_MUTED} />
            )}

            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontSize: 15,
                fontWeight: "600",
                color: TEXT_PRIMARY,
              }}
            >
              {target.name}
            </Text>

            {/* Tinted glass, not a painted pill — the same material every
                other status mark in this app is made of, so the tint
                carries the page behind it instead of sitting on top of it.

                Held at its own width: it is the shortest thing on the line
                and the one a carer scans down the column, so the name gives
                way to it rather than the other way about. */}
            <StatusTag label={tag.text} ink={tag.ink} Icon={tag.Icon} />
          </View>

          {/* Under the name, in the gutter the box keeps clear. */}
          <Text
            numberOfLines={1}
            style={{
              marginLeft: 24 + SPACE.md,
              fontSize: 12,
              color: TEXT_MUTED,
            }}
          >
            {`HN ${target.hn} · ${target.room} · ${target.ageYears} ปี ${target.ageMonths} ด.`}
          </Text>
        </View>

        {/*
          What was decided, shown where it was decided.

          All three answers, not just two. A row settled as ไม่มารับบริการ
          carried its reason; a row overruled carried nothing at all — the
          tag changed to "Override แล้ว", the buttons went, and the sentence
          the carer had just chosen was written to the record and never seen
          again. It is the one of the three most worth reading back, because
          it is the one somebody will be asked about.

          In the warning's own ink, because an override is not an ordinary
          note: it is a decision to go past something the records objected
          to, and the row should go on saying so.
        */}
        {row.override != null ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: SPACE.xs,
              marginTop: SPACE.xs,
              marginLeft: 24 + SPACE.md,
            }}
          >
            <ShieldCheck
              size={13}
              color={WARNING}
              strokeWidth={2.4}
              style={{ marginTop: 2 }}
            />
            <Text
              style={{
                flex: 1,
                fontSize: 12,
                lineHeight: 18,
                color: WARNING,
              }}
            >
              {row.override}
            </Text>
          </View>
        ) : null}

        {/* Recorded over a warning with nobody asked why. The row goes on
            saying what was known, in the warning's own red. */}
        {row.flag != null ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: SPACE.xs,
              marginTop: SPACE.xs,
              marginLeft: 24 + SPACE.md,
            }}
          >
            <TriangleAlert
              size={13}
              color={DANGER_INK}
              strokeWidth={2.4}
              style={{ marginTop: 2 }}
            />
            <Text
              style={{
                flex: 1,
                fontSize: 12,
                lineHeight: 18,
                color: DANGER_INK,
              }}
            >
              {row.flag}
            </Text>
          </View>
        ) : null}

        {settled && row.note != null ? (
          <Text
            style={{
              marginTop: SPACE.xs,
              marginLeft: 24 + SPACE.md,
              fontSize: 12,
              lineHeight: 18,
              color: TEXT_MUTED,
            }}
          >
            {row.note}
          </Text>
        ) : null}

        {/* The finding, in full. A flag with no reason on it is something
            a carer has to go and look up, which in a classroom they will
            not do — they will guess. Gone once it has been answered: an
            override is the answer to it, and leaving the red box under a
            row that has been dealt with says it is still outstanding. */}
        {!settled && row.override == null && reason != null ? (
          <View
            style={{
              marginTop: SPACE.sm,
              marginLeft: 24 + SPACE.md,
              padding: SPACE.sm,
              borderRadius: RADIUS.md,
              backgroundColor: level === "warn" ? DANGER_BG : WARNING_BG,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                lineHeight: 18,
                color: level === "warn" ? DANGER_INK : WARNING,
              }}
            >
              {reason}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {/*
        The row's own actions, outside the row.

        They used to sit inside it, which made each one a button nested in a
        checkbox — two controls where a screen reader announces one, and a
        press that could land on either. Out here they are siblings of the
        tick, which is what they are.

        Glass, and pressed through `interactive` rather than a fading alpha:
        these were outlined in SEPARATOR, a divider colour at about 1.25:1 on
        white, so the two things to do about a blocked child were the
        faintest marks on the row.
      */}
      {flagged || undoable ? (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: SPACE.sm,
            paddingLeft: SPACE.md + 24 + SPACE.md,
            paddingRight: SPACE.md,
            paddingBottom: SPACE.md,
          }}
        >
          {undoable ? (
            <RowAction
              label="แก้ไข"
              onPress={() => onMark(target.id, "waiting")}
            />
          ) : (
            <>
              {level === "warn" ? (
                <RowAction
                  label="Override"
                  ink={DANGER_INK}
                  onPress={() => onOverride(target.id, reason ?? "")}
                />
              ) : null}
              <RowAction
                label="ไม่มารับบริการ"
                onPress={() => onMark(target.id, "absent")}
              />
              <RowAction
                label="ปฏิเสธ"
                onPress={() => onMark(target.id, "refused")}
              />
            </>
          )}
        </View>
      ) : null}
    </View>
  );
});

/**
 * One thing to do about a row.
 *
 * Painted, the page's grey — the same capsule an unchosen choice chip is.
 * It was neutral glass, and neutral glass on this white card has nothing
 * behind it to be glass about: on Android the three actions for a blocked
 * child were words floating under the warning, with no edge to say they
 * were buttons at all. It sinks under the finger as the app's other
 * pressables do.
 */
function RowAction({
  label,
  ink = TEXT_PRIMARY,
  onPress,
}: {
  label: string;
  /** The app's red, where the action is the consequential one. */
  ink?: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={{
        height: 34,
        paddingHorizontal: SPACE.lg,
        borderRadius: RADIUS.capsule,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: GROUPED_BG,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: "700", color: ink }}>
        {label}
      </Text>
    </PressableScale>
  );
}
