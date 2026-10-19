import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Image,
  ScrollView,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  CommonActions,
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import {
  CalendarDays,
  CalendarRange,
  History,
  Search,
} from "lucide-react-native";
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from "@react-navigation/native-stack";
import { BlurStage } from "../components/BlurStage";
import { Glass } from "../components/Glass";
import { ScreenFrame } from "../components/ScreenFrame";
import { OpenVaccineSessionScreen } from "./OpenVaccineSessionScreen";
import { VaccineSessionScreen } from "./VaccineSessionScreen";
import { VaccineResultScreen } from "./VaccineResultScreen";

import { ActivityCard } from "../components/ActivityCard";
import { CardDeck } from "../components/CardDeck";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import {
  HeaderWash,
  PlainHeaderContext,
  ScreenHeader,
} from "../components/ScreenHeader";
import { SearchField } from "../components/SearchField";
import { toast } from "../components/Toast";
import { ToolbarPill } from "../components/ToolbarPill";
import { SectionHeader } from "../components/SectionHeader";
import { FilterSelect } from "../components/FilterSelect";
import type { RootStackParamList } from "../navigation/RootStack";
import { planToday } from "../models/clock";
import { buddhistYear, thaiMonthShort } from "../utils/thaiDate";
import { useStillOpen } from "../models/vaccineHistory";
import {
  activitiesOf,
  daysLate,
  isOpen,
  isToday,
  tally,
  useSession,
  ACTIVITY_TITLE,
  type Activity,
  type ActivityKind,
} from "../models/vaccination";
import { feel } from "../utils/haptics";
import {
  PRIMARY_500,
  RADIUS,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  WASH_PANEL,
  WASH_PANEL_STOPS,
} from "../theme/tokens";
import { SERVICE_TONE } from "../theme/serviceTone";
import { tr } from "../i18n";
import {
  CONTENT_MAX,
  cardWidth,
  columnsFor,
  readable,
  useLayout,
  GUTTER,
  LayoutFrame,
} from "../theme/layout";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Params = RouteProp<RootStackParamList, "CareActivities">;

/*
  What a page of a two-year calendar shows.

  The schedule runs from the first of January 2568 to the last of December
  2569, which is the right thing for it to be and the wrong thing to put on
  a phone: three hundred sittings under "แผนงานล่วงหน้า" is a list nobody
  scrolls, and the day's own work would be the first inch of it.

  So the plan is read a month at a time, by the row of chips above it —
  which is also how it is talked about ("เดือนหน้ามีตรวจสุขภาพกี่โรงเรียน").
  Behind, three months, because the rounds that go unclosed are the
  quarterly ones and a month would have hidden exactly those; and five
  overdue at most, since a page that can show more than a handful of debts
  is a page that will one day show forty.
*/
const LOOKBACK = 90;
const OVERDUE_MAX = 5;

/** The option that is not a month: everything ahead, however far. */
const ALL = "all";

/** The month a date belongs to, as a key an option can be named by. */
const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/**
 * The group work of one kind — the page a carer starts a session from.
 *
 * One page per kind rather than one page of everything. The three kinds are
 * the same shape underneath, but a carer does not pick up "today's group
 * work": they go out to vaccinate, or to run a school check, or to screen a
 * nursery, and the Services page is where that choice is made. Mixing them
 * into one list put the decision one screen too late.
 *
 * One card per activity, and the card says the four things that decide
 * whether it can be started: where, who, when, and how many. The state chip
 * is the fifth — an activity waiting to sync is not one to walk into a
 * classroom with.
 */
export function CareActivitiesScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const { kind } = useRoute<Params>().params;
  const { width, height, regular, landscape } = useLayout();
  /*
    A tablet splits the page: the work down the left, and the one picked
    open on the right — its session opened, its roster, its results — so
    the list stays in view while a round is recorded, and the next sitting
    is a tap away rather than three pages back.
  */
  const split = regular;
  const listW = split ? Math.round(width * (landscape ? 0.4 : 0.46)) : width;
  const [picked, setPicked] = useState<{ id: string; at: number } | null>(
    null,
  );
  /*
    The page's own column: the whole screen on a phone, and a centred
    column on a tablet, with the plan's cards two to a row inside it.
  */
  // Measured by the list's own column, which on a tablet is the left part.
  const column = regular ? Math.min(listW, CONTENT_MAX) : width;
  const columns = columnsFor(column);
  const gridW = cardWidth(column - GUTTER * 2, columns, SPACE.md);
  /**
   * How wide a card is in a row that is swiped.
   *
   * Short of the column's own width by a card's worth of gutter, so the next
   * one peeks in at the right — a row where one card fills the screen
   * reads as a single card and gives no sign there is anything beside it.
   * On a tablet, the width of a card in the grid below it.
   */
  const cardW = columns > 1 ? gridW : column - GUTTER * 2 - SPACE.xxl;
  /** A run of cards, two to a row where the column has room. */
  const grid = (cards: ReactNode[]) =>
    columns > 1 ? (
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.md }}>
        {cards.map((c, i) => (
          <View key={i} style={{ width: gridW }}>
            {c}
          </View>
        ))}
      </View>
    ) : (
      cards
    );
  // So a card turns into "ทำต่อ" the moment a session is opened on it, and
  // back again when it is finished.
  const { session } = useSession();

  /*
    Searching, and what for.

    Behind a button rather than always on the page. Most mornings there are
    five sittings on this screen and a field to narrow five things is a
    control in the way of the answer — which is why this page has never had
    one. What it is for is the other case: a fortnight out, or a carer
    looking for the round at a school whose name they half remember, where
    scrolling a list sorted by date is the wrong tool.

    Open, it takes the whole page over. The deck is an arrangement of
    today's work in the order the day happens, and neither of those is true
    of a set of matches.
  */
  const [finding, setFinding] = useState(false);
  const [query, setQuery] = useState("");

  /*
    Today, and after today.

    A fortnight of sittings in one list is a list nobody reads to the end:
    the only question a carer opens this page with in the morning is what
    they are doing now, and everything dated Thursday is in the way of the
    answer. So the day's work stands on its own, and the rest is below it as
    a plan rather than as a queue.

    A sitting already under way counts as today's whatever it is dated. It
    is being done — that is what "today's work" means — and a half-recorded
    class buried under next Tuesday is the one card that must not be hard to
    find.
  */
  /*
    And what was left open behind them.

    A round whose day has passed without being closed does not belong under
    "แผนงานล่วงหน้า" — that heading is a plan, and this is a debt. It has a
    section of its own, under today's shelf and above the fortnight: what a
    carer opens this page for in the morning is what they are doing NOW,
    and a list of last week's unfinished business standing in front of that
    answers a question nobody has yet asked. Read second, it is the next
    thing after the day itself, which is where it belongs.

    Closed is the same test the history is keyed by, so a round finished
    late drops off this list the moment it is filed, and the oldest debt
    sorts to the top.
  */
  const stillOpen = useStillOpen();
  const { overdue, today, ahead } = useMemo(() => {
    const all = [...activitiesOf(kind)].sort(
      (a, b) => a.at.getTime() - b.at.getTime(),
    );
    const live = (a: Activity) =>
      session != null && session.activity.id === a.id;
    const owed = (a: Activity) =>
      daysLate(a) > 0 && daysLate(a) <= LOOKBACK && stillOpen(a) && !live(a);
    return {
      overdue: all.filter(owed).reverse().slice(0, OVERDUE_MAX),
      // Today's shelf is today's work still to do. A sitting closed this
      // morning has gone to the history, and the badge on the services page
      // counts what is on this shelf, so the two drop it together.
      today: all.filter(
        (a) => !owed(a) && stillOpen(a) && (isToday(a) || live(a)),
      ),
      ahead: all.filter(
        (a) =>
          !owed(a) &&
          !isToday(a) &&
          !live(a) &&
          a.at.getTime() > planToday.getTime(),
      ),
    };
  }, [kind, session, stillOpen]);

  /*
    The months the plan has work in, and the whole of it.

    Only months that hold something: a calendar running to December 2569
    would otherwise offer fifteen, eleven of them leading to an empty page —
    and a filter whose options are mostly nothing is one that has to be
    tried rather than read.

    "ทั้งหมด" first, because a plan is read a month at a time and checked
    end to end: somebody asking "how much school health is there left this
    year" wants the lot, and dividing it into months is exactly what gets
    in their way.
  */
  const months = useMemo(() => {
    const first = new Map<string, Date>();
    for (const a of ahead) {
      const k = monthKey(a.at);
      if (!first.has(k)) first.set(k, a.at);
    }
    return [
      { key: ALL, label: tr("ทั้งหมด", "All"), Icon: CalendarRange },
      ...[...first.entries()].map(([key, at]) => ({
        key,
        label: `${thaiMonthShort(at)} ${String(buddhistYear(at)).slice(2)}`,
        Icon: CalendarDays,
      })),
    ];
  }, [ahead]);

  /*
    Which month is showing — the nearest one, until it is not there.

    Held rather than derived, because it is a choice; reset when the month
    it names drops out of the plan, which happens on its own as the first
    of the month comes round and the last sitting in it goes by.
  */
  const [month, setMonth] = useState<string>("");
  const showing = months.some((m) => m.key === month)
    ? month
    : (months[1]?.key ?? ALL);
  const later =
    showing === ALL ? ahead : ahead.filter((a) => monthKey(a.at) === showing);

  /*
    What matches, across the whole fortnight rather than within a section.

    A search that respected the today/later split would answer "โรงเรียนวัด
    ตัวอย่าง" with two headings and one card under each, which is a filing
    system rather than an answer. Matched on everything printed on the card,
    because a carer looking for a round remembers whichever of those stuck.
  */
  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = [...activitiesOf(kind)].sort(
      (a, b) => a.at.getTime() - b.at.getTime(),
    );
    /*
      Nothing typed is not nothing found.

      An empty field used to hold the page back with "พิมพ์เพื่อค้นหา",
      which is a screen asking to be told what it already knows: the whole
      fortnight is eight cards and they were all there a moment ago. A
      search opens on everything and narrows as it is typed into, which is
      what the houses page does and what a carer opening this expects.
    */
    if (q === "") return all;
    return all.filter((a) =>
      `${a.title} ${a.place} ${a.group}`.toLowerCase().includes(q),
    );
  }, [kind, query]);

  const start = (a: Activity) => {
    if (split) {
      feel("tick");
      // `at` so the same card picked again opens it afresh.
      setPicked({ id: a.id, at: Date.now() });
      return;
    }
    /*
      Back into the sitting, not into a new one.

      A class of fifty is not finished in one sweep, and the way back in was
      through the form that opens a session — which would have replaced the
      half-worked roster with a fresh one. The work already recorded would
      have survived in the history, but everything decided and not yet saved
      would not, and the forty already given would have looked like forty
      still to give.
    */
    if (isOpen(a.id)) {
      nav.navigate("VaccineSession");
      toast(
        tr(
          "กลับไปยัง Session ที่เปิดค้างไว้",
          "Back to the session you left open",
        ),
      );
      return;
    }
    /*
      All three kinds, and both states.

      Four of the six cards on this page used to end in a toast saying the
      feature was not open yet — the two that are not immunisations, and the
      two still marked draft. Neither was true of the app: the roster, the
      bands, the batch save and the exception pass are the same four steps
      whatever is being recorded, and "draft" describes the group, not the
      screen. So every card opens, and the one thing that differs — the vial
      — is asked for only where there is one.
    */
    nav.navigate("OpenVaccineSession", { activityId: a.id });
  };

  /*
    A card, and how late it is if it is late.

    Never passed straight to `map`. `Array.map` hands its callback the
    INDEX as a second argument, so `later.map(card)` quietly told every
    card after the first how many days overdue it was — which was its
    position in the list. The first row of "แผนงานล่วงหน้า" came out
    right and every row under it had a red date.
  */
  const card = (a: Activity, late?: number) => {
    const live =
      session != null && session.activity.id === a.id ? tally(session) : null;
    const on = split && picked?.id === a.id;
    return (
      <View
        key={a.id}
        style={{
          borderRadius: RADIUS.card + 3,
          borderWidth: 2.5,
          // Every card carries the ring, clear when not picked, so picking
          // one shifts nothing.
          borderColor: on ? PRIMARY_500 : "transparent",
          margin: -2.5,
        }}
      >
      <ActivityCard
        activity={a}
        late={late}
        progress={
          live == null
            ? undefined
            : { done: live.recorded, total: live.targets }
        }
        onPress={() => start(a)}
      />
      </View>
    );
  };

  const page = (
    <View style={{ flex: 1 }}>
      {/*
        No search on this page.

        There are a handful of activities in a day and they are already
        sorted by when they happen, so a field to narrow them costs more
        attention than it saves — and it put a control above the list that a
        carer had to look past to reach the thing they came for.
      */}
      {/*
        Two things to do from the header, on one pill.

        Finding a round, and reading back the ones already done. They share
        a capsule rather than standing as two separate buttons because they
        are the same kind of act — neither changes anything, both are ways
        of looking — and because two loose glass circles in a corner read as
        two decisions rather than one toolbar.
      */}
      <ScreenHeader
        title={ACTIVITY_TITLE[kind]}
        right={
          <ToolbarPill
            slots={[
              {
                icon: (
                  <Search
                    size={20}
                    color={finding ? PRIMARY_500 : TEXT_PRIMARY}
                    strokeWidth={2.2}
                  />
                ),
                label: finding
                  ? tr("ปิดการค้นหา", "Close search")
                  : tr("ค้นหางาน", "Search work"),
                onPress: () => {
                  feel("tick");
                  setFinding((was) => {
                    // Closing it clears what was typed. A query left behind
                    // a shut field is a page filtered by something nobody
                    // can see.
                    if (was) setQuery("");
                    return !was;
                  });
                },
              },
              {
                /*
                  This service's own history, not everybody's.

                  The three kinds were one list on the reasoning that they
                  record the same way — which is true of the machinery and
                  false of the question. Somebody who has come in through
                  งานวัคซีน wants the rounds they have given; handing them
                  every school check and every nursery weighing as well is a
                  list they have to search to get back to where they were.
                */
                icon: (
                  <History size={20} color={TEXT_PRIMARY} strokeWidth={2.2} />
                ),
                label: tr("ประวัติการให้บริการ", "Service history"),
                onPress: () => nav.navigate("VaccineHistory", { kind }),
              },
            ]}
          />
        }
        /*
          Pinned in the header, not laid on top of the list.

          Inside the scroll it went up with the page on the first swipe and
          a carer typing a second word was typing into something they could
          no longer see. The header is where every other search in this app
          lives, and it stays put while the results move underneath it.
        */
        below={
          finding ? (
            <View style={{ marginTop: SPACE.lg }}>
              <SearchField
                value={query}
                onChangeText={setQuery}
                placeholder={tr(
                  "ค้นหาชื่องาน โรงเรียน หรือกลุ่ม",
                  "Search by activity, school or group",
                )}
                autoFocus
              />
            </View>
          ) : null
        }
      />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: GUTTER,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + SPACE.huge,
            gap: SPACE.md,
            ...(regular && readable()),
          }}
          showsVerticalScrollIndicator={false}
        >
          {/*
            Searching, the page is one list of every sitting in the service,
            soonest first — the deck and the two sections are gone.

            Both of those say something about WHEN: a shelf of today's work
            and a plan for the fortnight. Neither is true of a set of
            matches, and a result hidden inside a collapsed deck is a result
            that did not answer the search.
          */}
          {finding ? (
            found.length === 0 ? (
              <Text
                style={{
                  paddingHorizontal: SPACE.xs,
                  fontSize: 13,
                  lineHeight: 20,
                  color: TEXT_MUTED,
                }}
              >
                {tr(
                  `ไม่พบงานที่ตรงกับ "${query.trim()}"`,
                  `Nothing matches "${query.trim()}"`,
                )}
              </Text>
            ) : (
              <>
                <SectionHeader
                  title={
                    query.trim() === ""
                      ? tr("งานทั้งหมด", "All work")
                      : tr("ผลการค้นหา", "Search results")
                  }
                  count={found.length}
                  flush
                />
                {/* A search hit that is overdue says so too — the mark
                    belongs to the round, not to the section it was found
                    under. */}
                {grid(
                  found.map((a) =>
                    card(
                      a,
                      overdue.some((o) => o.id === a.id)
                        ? daysLate(a)
                        : undefined,
                    ),
                  ),
                )}
              </>
            )
          ) : (
            <>
              {/*
            Today on a shelf of its own, with the rest of the fortnight
            listed plainly under it.

            Two sections that used to be one list with two headings in it,
            which made the day's work look like the first two rows of a
            fortnight. The panel is the difference said in the layout rather
            than in a word: a tinted ground, the service's own drawing in
            the corner, and the sittings standing on it as a deck — the next
            one face up and the rest of the day showing behind it.
          */}
              {today.length > 0 && (
                <TodayPanel kind={kind} count={today.length}>
                  {today.map((a) => card(a))}
                </TodayPanel>
              )}

              {overdue.length > 0 && (
                <>
                  <SectionHeader
                    title={tr("งานค้าง", "Overdue")}
                    count={overdue.length}
                    flush
                  />
                  {/*
                    One debt stands still; several are swiped through.

                    Stacked down the page, a fortnight of unfinished rounds
                    pushes the plan below it off the screen — and the plan
                    is what the page is for. Sideways they take one card's
                    height however many there are, and the next one shows
                    at the edge so nobody has to be told there is more.

                    The row bleeds to both edges of the screen rather than
                    stopping at the page's gutter: a card cut off at a
                    margin reads as broken, where one cut off at the edge
                    of the phone reads as carrying on.
                  */}
                  {overdue.length === 1 ? (
                    card(overdue[0], daysLate(overdue[0]))
                  ) : (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      decelerationRate="fast"
                      snapToInterval={cardW + SPACE.md}
                      snapToAlignment="start"
                      style={{ marginHorizontal: -GUTTER }}
                      contentContainerStyle={{
                        paddingHorizontal: GUTTER,
                        gap: SPACE.md,
                      }}
                    >
                      {overdue.map((a) => (
                        <View key={a.id} style={{ width: cardW }}>
                          {card(a, daysLate(a))}
                        </View>
                      ))}
                    </ScrollView>
                  )}
                </>
              )}

              {ahead.length > 0 && (
                <>
                  {/*
                    The month sits where the heading's own control goes,
                    the way the home page hangs its filter off "ภารกิจ
                    วันนี้รอดำเนินการ". It was a row of chips under the
                    heading, which is the shape a list uses for bands it is
                    narrowed to — and a plan is not narrowed by a month, it
                    is read a month at a time. The menu floats over the
                    list rather than pushing it down, so picking a month
                    does not shove the cards being looked at.
                  */}
                  <View style={{ zIndex: 10 }}>
                    <SectionHeader
                      title={tr("แผนงานล่วงหน้า", "Upcoming plan")}
                      count={later.length}
                      flush
                      trailing={
                        months.length > 1 ? (
                          <FilterSelect
                            value={showing}
                            options={months}
                            onChange={setMonth}
                          />
                        ) : undefined
                      }
                    />
                  </View>
                  {grid(later.map((a) => card(a)))}
                </>
              )}

              {overdue.length + today.length + ahead.length === 0 ? (
                <Text style={{ fontSize: 14, color: TEXT_MUTED }}>
                  {tr(
                    "ยังไม่มีกิจกรรมในกลุ่มนี้",
                    "No activities in this group yet",
                  )}
                </Text>
              ) : null}
            </>
          )}
        </ScrollView>
      </HeaderFade>
    </View>
  );

  if (!split) return page;
  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      {/* One wash across the whole screen, behind both halves — the list's
          header drew its own, the width of the list, and the page stopped
          at the list's edge with the right half on a different ground. */}
      <HeaderWash height={insets.top + 335} />
      {/* The work, measured by its own column: one card across. */}
      <View style={{ width: listW }}>
        <LayoutFrame.Provider value={{ width: listW, height }}>
          <PlainHeaderContext.Provider value>{page}</PlainHeaderContext.Provider>
        </LayoutFrame.Provider>
      </View>
      <View style={{ flex: 1 }}>
        <ActivityPane
          picked={picked}
          width={width - listW}
          height={height}
          onIdle={() => setPicked(null)}
        />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Today's shelf
 * ------------------------------------------------------------------ */

/**
 * The drawing each service carries, and exactly where it rests.
 *
 * Out past the top-right corner rather than tucked inside it: sitting flush
 * to the edge, a drawing reads as a picture printed on the panel; hanging
 * over it, the panel reads as a shelf with something resting on the back of
 * it. Nothing between it and the screen clips, so the overhang is real.
 *
 * Placed per service, though, and not by one rule — because the three
 * artworks are not one shape. Each is a square PNG and how much clear space
 * it leaves inside that square is its own business: the vial is tall and
 * narrow with a fifth of the canvas empty down each side and almost nothing
 * above the needle, while the scale is wide and squat, nearly touching the
 * sides and a seventh of the way down from the top.
 *
 * One set of offsets therefore lands them in three different places, which
 * is exactly what happened — the vial's needle broke the panel's top edge
 * and its body sat well inside the right one, and the scale came out jammed
 * against the side with its top flush. So what is written below is not
 * where the SQUARE goes but where the DRAWING inside it does, worked back
 * from each file's own measured bounds so all three land the same way:
 *
 *   · the drawing's right edge about 10 points inside the panel's
 *   · its top about 8 points proud of the panel's
 *   · and all three covering about the same area, which is what makes them
 *     read as one set rather than three pictures at three sizes
 *
 * Re-export an artwork with different margins and these have to be worked
 * out again from the new bounds: the numbers describe the files as they
 * are, not a layout rule they follow.
 */
const ART_FOR: Record<
  ActivityKind,
  { source: ImageSourcePropType; size: number; right: number; top: number }
> = {
  vaccination: {
    source: require("../../assets/services/vaccine.png"),
    size: 145,
    right: -16,
    top: -17,
  },
  schoolHealth: {
    source: require("../../assets/services/checkup.png"),
    size: 130,
    right: 0,
    top: -26,
  },
  screening: {
    source: require("../../assets/services/screening.png"),
    size: 116,
    right: 2,
    top: -12,
  },
  dental: {
    source: require("../../assets/services/dental.png"),
    size: 124,
    right: 0,
    top: -18,
  },
};

/**
 * "ภารกิจวันนี้" — the day's sittings, on a shelf: the service's own wash
 * and drawing behind a `CardDeck` of them.
 */
function TodayPanel({
  kind,
  count,
  children,
}: {
  kind: ActivityKind;
  count: number;
  children: ReactNode;
}) {
  const art = ART_FOR[kind];
  return (
    <CardDeck
      count={count}
      header={
<SectionHeader
        title={tr("ภารกิจวันนี้", "Today's tasks")}
        count={count}
        flush
      />
      }
      backdrop={
        <>
  {/*
    The tint is a layer behind the panel, not the box the panel is in.

    It was the container, and a rounded container clips: the syringe ran
    up to the panel's right edge and stopped dead against it, which is
    the one thing the drawing must not do. Laid in behind instead, the
    rounding is still the panel's and nothing on the shelf is inside
    anything that trims it.
  */}
  <LinearGradient
    colors={[...WASH_PANEL[SERVICE_TONE[kind]]] as [string, string, string]}
    locations={[...WASH_PANEL_STOPS] as [number, number, number]}
    start={{ x: 0, y: 0 }}
    end={{ x: 0, y: 1 }}
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      borderRadius: RADIUS.card,
    }}
  />

  {/*
    The drawing, over the tint and under everything else.

    Behind the heading and behind the deck, so the cards cut across the
    foot of it. Painted last it sat on top of the front card and covered
    its arrow; painted first, under the gradient, it would not be seen
    at all.

    Wrapped rather than given `pointerEvents` directly, which belongs to
    a view and not to an image style.
  */}
  <View
    pointerEvents="none"
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    style={{
      position: "absolute",
      right: art.right,
      top: art.top,
      width: art.size,
      height: art.size,
    }}
  >
    <Image
      source={art.source}
      style={{ width: art.size, height: art.size }}
      resizeMode="contain"
      accessibilityRole="none"
    />
  </View>
        </>
      }
      expandLabel={tr(
        `ดูภารกิจวันนี้ทั้ง ${count} รายการ`,
        `Show all ${count} of today's tasks`,
      )}
      collapseLabel={tr("ย่อภารกิจวันนี้", "Collapse today's tasks")}
    >
      {children}
    </CardDeck>
  );
}

/* ------------------------------------------------------------------ *
 * The right half, on a tablet
 * ------------------------------------------------------------------ */

type PaneParams = {
  Idle: undefined;
  OpenVaccineSession: { activityId: string };
  VaccineSession: undefined;
  VaccineResult: { ids?: string[] } | undefined;
};
const Pane = createNativeStackNavigator<PaneParams>();

/**
 * The work picked on the left, in a page stack of its own: the session
 * opened (or, where one is already open, its roster), and every step after
 * it, on a glass card — so none of it leaves the half.
 */
function ActivityPane({
  picked,
  width,
  height,
  onIdle,
}: {
  picked: { id: string; at: number } | null;
  width: number;
  height: number;
  onIdle: () => void;
}) {
  const insets = useSafeAreaInsets();
  const cardW = width - SPACE.md / 2 - GUTTER;
  return (
    <Pane.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        contentStyle: { backgroundColor: "transparent" },
        animation: route.name === "Idle" ? "default" : "fade",
        animationDuration: 220,
        gestureEnabled: false,
      })}
      screenLayout={({ children, navigation, route }) =>
        route.name === "Idle" ? (
          <View style={{ flex: 1 }}>{children}</View>
        ) : (
          <View
            style={{
              flex: 1,
              marginTop: insets.top + SPACE.sm,
              marginLeft: SPACE.md / 2,
              marginRight: GUTTER,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              overflow: "hidden",
            }}
          >
            {/* Apple's glass for the card's ground, as the visit page lays
                behind each form — the material tints whatever it holds,
                and the form's white cards should stay white. */}
            <Glass
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
              }}
            />
            <SafeAreaInsetsContext.Provider
              value={{ top: SPACE.xs, bottom: insets.bottom, left: 0, right: 0 }}
            >
              <LayoutFrame.Provider value={{ width: cardW, height }}>
                <PlainHeaderContext.Provider value>
                  <ScreenFrame>
                    <BlurStage navigation={navigation}>{children}</BlurStage>
                  </ScreenFrame>
                </PlainHeaderContext.Provider>
              </LayoutFrame.Provider>
            </SafeAreaInsetsContext.Provider>
          </View>
        )
      }
    >
      <Pane.Screen name="Idle">
        {({ navigation, route }) => (
          <PaneIdle
            picked={picked}
            onIdle={onIdle}
            navigation={navigation}
            baseKey={route.key}
          />
        )}
      </Pane.Screen>
      <Pane.Screen
        name="OpenVaccineSession"
        component={OpenVaccineSessionScreen}
      />
      <Pane.Screen name="VaccineSession" component={VaccineSessionScreen} />
      <Pane.Screen name="VaccineResult" component={VaccineResultScreen} />
    </Pane.Navigator>
  );
}

/**
 * The bottom of the pane's stack: what shows with nothing picked, and what
 * opens the work picked — back into a sitting already open, or the form
 * that opens one — and notices it being closed again.
 */
function PaneIdle({
  picked,
  onIdle,
  navigation,
  baseKey,
}: {
  picked: { id: string; at: number } | null;
  onIdle: () => void;
  navigation: {
    dispatch: (action: object) => void;
    addListener: (e: "focus" | "blur", cb: () => void) => () => void;
  };
  baseKey: string;
}) {
  const idle = useRef(onIdle);
  idle.current = onIdle;
  useEffect(() => {
    if (picked == null) return;
    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [
          { key: baseKey, name: "Idle" },
          isOpen(picked.id)
            ? { name: "VaccineSession" }
            : { name: "OpenVaccineSession", params: { activityId: picked.id } },
        ],
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked?.id, picked?.at]);
  useEffect(() => {
    let away = false;
    const offBlur = navigation.addListener("blur", () => {
      away = true;
    });
    const offFocus = navigation.addListener("focus", () => {
      if (away) idle.current();
      away = false;
    });
    return () => {
      offBlur();
      offFocus();
    };
  }, [navigation]);
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: GUTTER,
      }}
    >
      <Text style={{ fontSize: 15, lineHeight: 20, color: TEXT_MUTED }}>
        {tr("เลือกงานทางซ้ายเพื่อเริ่ม", "Pick a task on the left to start")}
      </Text>
    </View>
  );
}
