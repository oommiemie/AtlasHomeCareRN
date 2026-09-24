import {
  Children,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Animated,
  Easing,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useIsFocused,
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import { ChevronDown, ChevronUp, History, Search } from "lucide-react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ActivityCard } from "../components/ActivityCard";
import { Card } from "../components/Card";
import { Chevron } from "../components/Chevron";
import { Glass } from "../components/Glass";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { SearchField } from "../components/SearchField";
import { ToolbarPill } from "../components/ToolbarPill";
import { SectionHeader } from "../components/SectionHeader";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  activitiesOf,
  isOpen,
  isToday,
  tally,
  useSession,
  ACTIVITY_TITLE,
  type Activity,
  type ActivityKind,
} from "../models/vaccination";
import { currentDisplay } from "../models/display";
import { feel } from "../utils/haptics";
import {
  PRIMARY_500,
  RADIUS,
  GLASS_NEUTRAL,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  WASH_PANEL,
  WASH_PANEL_STOPS,
  type PanelTone,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Params = RouteProp<RootStackParamList, "CareActivities">;

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
  const { today, later } = useMemo(() => {
    const all = [...activitiesOf(kind)].sort(
      (a, b) => a.at.getTime() - b.at.getTime(),
    );
    const live = (a: Activity) =>
      session != null && session.activity.id === a.id;
    return {
      today: all.filter((a) => isToday(a) || live(a)),
      later: all.filter((a) => !isToday(a) && !live(a)),
    };
  }, [kind, session]);

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

  const card = (a: Activity) => {
    const live =
      session != null && session.activity.id === a.id ? tally(session) : null;
    return (
      <ActivityCard
        key={a.id}
        activity={a}
        progress={
          live == null
            ? undefined
            : { done: live.recorded, total: live.targets }
        }
        onPress={() => start(a)}
      />
    );
  };

  return (
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
                label: finding ? "ปิดการค้นหา" : "ค้นหางาน",
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
                label: "ประวัติการให้บริการ",
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
                placeholder="ค้นหาชื่องาน โรงเรียน หรือกลุ่ม"
                autoFocus
              />
            </View>
          ) : null
        }
      />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: SPACE.lg,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + SPACE.huge,
            gap: SPACE.md,
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
                {`ไม่พบงานที่ตรงกับ "${query.trim()}"`}
              </Text>
            ) : (
              <>
                <SectionHeader
                  title={query.trim() === "" ? "งานทั้งหมด" : "ผลการค้นหา"}
                  count={found.length}
                  flush
                />
                {found.map(card)}
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
                  {today.map(card)}
                </TodayPanel>
              )}

              {later.length > 0 && (
                <>
                  <SectionHeader
                    title="ยังไม่ถึงวันทำ"
                    count={later.length}
                    flush
                  />
                  {later.map(card)}
                </>
              )}

              {today.length + later.length === 0 ? (
                <Text style={{ fontSize: 14, color: TEXT_MUTED }}>
                  ยังไม่มีกิจกรรมในกลุ่มนี้
                </Text>
              ) : null}
            </>
          )}
        </ScrollView>
      </HeaderFade>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Today's shelf
 * ------------------------------------------------------------------ */

/** How far each sitting behind the front one shows above it. */
const PEEK = 11;
/** And how much narrower it is on each side, so the deck reads as depth. */
const DECK_INSET = 16;
/**
 * How many sittings show behind the one in front.
 *
 * Two, whatever the day holds. The edges are there to say "there is more
 * behind this", which two of them say as well as four do — and the deck
 * still deals every sitting of the day through the front, so nothing is
 * hidden by keeping the stack short. How many there are in total is on the
 * count beside the heading, in a numeral, which is the honest place for it.
 *
 * It is also what the panel can carry: at eleven points an edge, four of
 * them is forty-four points of stacked white before the front card even
 * starts, and the shelf stops being a shelf with a card on it.
 */
const DECK_MAX = 2;

/**
 * How far the deck stands in from the panel's edge, on three sides.
 *
 * Its own number rather than the 8pt step off the spacing scale: this is
 * the margin of the shelf the cards are standing on, and it is read against
 * the card's own 24pt radius nesting inside the panel's — too tight and the
 * two curves fight, too loose and the panel stops being a shelf and starts
 * being a frame.
 */
const SHELF = 10;

/**
 * How long a sitting stays face up, and how long the next takes to arrive.
 *
 * Long enough to read the card and then some: the point of the deck is that
 * a carer glancing at the page sees what is next, and a carousel that turns
 * before a name has been read is one that has to be waited out instead of
 * looked at.
 */
const DWELL = 4200;
const GLIDE = 560;

/**
 * How far a finger has to travel to turn the deck over.
 *
 * Read as a fraction: the drag scrubs the deal, so at half this distance
 * the next sitting is half way forward. Released past a third of it — or
 * flicked — the deal finishes; short of that it falls back to where it was.
 */
const SWIPE = 90;
const SWIPE_TAKE = 0.34;

/** How long the shelf takes to open out into a list, and to gather back. */
const SPREAD = 420;

/**
 * The handle on the foot of the shelf, and where it sits.
 *
 * Half on the panel and half off it, centred on the panel's own bottom
 * edge — the blue above it and the page's grey below. That is what makes it
 * read as a tab ON the shelf: a control tucked inside the panel is part of
 * the panel's contents, and one sitting under it belongs to the page.
 */
const HANDLE = 32;

/**
 * How far the card in front leans out under a finger.
 *
 * Sideways, not tilted: a rotation is a transform, and a transform above a
 * piece of Liquid Glass stops it drawing — the avatar, the count and the
 * state tag would all empty out the moment the card moved. So the card
 * slides, by its own left and right, which the material does not mind.
 *
 * Held to a little less than the panel's own margin so the card leans over
 * the edge of the shelf without ever leaving the page's gutter.
 */
const LEAN = 24;

/**
 * And how much of that lean each card behind takes.
 *
 * Less, the deeper it sits — which is the whole of the effect. Everything
 * moving by the same amount is a picture being slid about; a front card
 * that outruns the ones behind it is a card being pushed off a pile.
 */
const LEAN_BY_SLOT = [1, 0.4, 0.18];

/** The part of a gesture the deck actually reads. */
type PanState = { dx: number; dy: number; vx: number };

/**
 * What a sitting's card stands at before it has been measured.
 *
 * The height the design draws it, so the very first paint is already the
 * right size and the measurement that follows only confirms it. Wrong only
 * where a school's name wraps to a second line, and only until layout.
 */
const CARD_H = 151;

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
/**
 * Which ramp each service's shelf is painted with.
 *
 * Three different ones, because the panel is the biggest thing on the page
 * and it was the same blue on all three services — so the only way to tell
 * งานตรวจสุขภาพ from งานวัคซีน at a glance was to read the title. The
 * colour is not carrying any meaning of its own here; it is carrying
 * WHERE you are, which is the one thing a shelf that size can say without
 * words.
 *
 * Violet for the immunisation rounds — deliberately not the app's own blue,
 * which is on every button, every avatar and every count chip in the place,
 * so a blue shelf read as chrome rather than as a shelf. Mint for the
 * weighing and the health checks, after the greens in their own drawing;
 * peach for the nursery screening, the warmest of the three and the only
 * one that is entirely about the under-fives.
 */
const TONE_FOR: Record<ActivityKind, PanelTone> = {
  vaccination: "violet",
  schoolHealth: "mint",
  screening: "peach",
};

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
};

/**
 * The shadow the deck is separated by.
 *
 * A little more than the app's `elevated` and a good deal less than the
 * design's, which is drawn for one card on white. Here there are three,
 * overlapping, on a pale blue ground — so every shadow lands on the card
 * behind it and the strength adds up. At the design's 12% over 40 points
 * the stack came out grey, as if the panel were smudged; the job is only to
 * say which edge is in front of which, and a third of that says it.
 *
 * It is also the one place on this page that has a shadow at all. The list
 * below is flat, which is the app's own rule; a deck cannot be.
 */
const DECK_SHADOW = {
  // The radius is part of the shadow, not decoration: iOS derives the
  // shadow's path from the view's bounds, and a square path under a rounded
  // card shows as four dark corners.
  borderRadius: RADIUS.card,
  shadowColor: "#000000",
  shadowOpacity: 0.07,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
} as const;

/**
 * "ภารกิจวันนี้" — the day's sittings, on a shelf.
 *
 * The day is not the first two rows of the fortnight, and listing it that
 * way made it look like it was. So it gets a ground of its own: a pale ramp
 * deepening toward the foot, the service's own drawing rising out of the
 * top corner, and the sittings standing on it.
 *
 * As a deck rather than a list, because of what a carer does with this page
 * in the morning. There is one thing they are about to walk into, and the
 * others are for later in the day — so the next one is face up and the rest
 * show as an edge behind it, which is a count they can read without reading
 * anything. The chevron straddling the foot of the panel opens the whole
 * day out; it is not there at all when there is only one sitting, because
 * then there is nothing behind to see.
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
  const [open, setOpen] = useState(false);
  const cards = Children.toArray(children);
  const n = cards.length;
  const behind = Math.min(n - 1, DECK_MAX);

  /*
    Which sitting is face up, and which one was a moment ago.

    Both in one piece of state so a render can never see a half-changed
    pair. Every card's whole journey — how far down the shelf it sits, how
    wide it is, whether it is in front of or behind its neighbours — is
    derived from these two and the animation's own progress, so there is one
    thing to get right rather than one per card.
  */
  const [deck, setDeck] = useState({ from: 0, to: 0 });
  const glide = useRef(new Animated.Value(1)).current;
  /*
    How tall a sitting's card is.

    Needed because every card in the deck is absolutely positioned — none of
    them is in the flow to give the box a height — and the box has to be the
    card plus the edges showing above it. Seeded at the height the design
    draws, so the first paint is already right and the measurement only ever
    confirms it.
  */
  const [cardH, setCardH] = useState(CARD_H);

  /*
    What a finger is doing to the deck, outside React.

    The pan handlers are made once and then live for the life of the panel,
    so anything they read has to be a box they can look inside rather than a
    value closed over at the moment they were written. `drag` is null between
    gestures and holds the direction once one has committed to a side.
  */
  const deckRef = useRef(deck);
  deckRef.current = deck;
  const drag = useRef<1 | -1 | null>(null);
  const [dragging, setDragging] = useState(false);
  /** How far sideways the finger has taken the deck, in points. */
  const nudge = useRef(new Animated.Value(0)).current;

  const still = currentDisplay().reduceMotion;
  const focused = useIsFocused();

  /*
    The deck deals itself.

    Slowly — four and a bit seconds a card, which is about how long it takes
    to read one — and only while there is something to turn to, the shelf is
    closed, and the page is actually on screen. A carousel running behind a
    pushed screen is work nobody can see.

    Not at all when the carer has asked for less motion. A thing that moves
    on its own, forever, at the top of a page is the exact case that setting
    exists for; the deck simply sits there showing the next sitting, which
    is the one that matters anyway.
  */
  useEffect(() => {
    if (open || n < 2 || still || !focused || dragging) return;
    const id = setInterval(() => {
      setDeck((d) => ({ from: d.to, to: (d.to + 1) % n }));
    }, DWELL);
    return () => clearInterval(id);
    // `dragging` is in here so the clock restarts from nought after a
    // swipe: a carer who has just turned the deck themselves should get the
    // full dwell to read what they turned to.
  }, [open, n, still, focused, dragging]);

  /*
    A drag scrubs the deal rather than dragging the card.

    A card that follows the finger would have to be moved by a transform,
    and a transform anywhere above a piece of Liquid Glass stops it drawing
    — the avatar, the count and the state tag would all empty out the moment
    the finger touched them. So the gesture drives the same deal the clock
    drives: push left and the next sitting comes forward as far as you have
    pushed, let go and it either finishes or falls back.

    Claimed on movement rather than on touch, so a tap still opens the
    sitting: the deck only takes the gesture once a finger has travelled
    sideways, and sideways more than it has travelled down, which is what
    separates turning the deck from scrolling the page.
  */
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e: unknown, g: PanState) =>
          n > 1 && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
        onPanResponderGrant: () => {
          drag.current = null;
          setDragging(true);
        },
        onPanResponderMove: (_e: unknown, g: PanState) => {
          // Before anything else, so the deck answers the very first
          // millimetre rather than waiting to be sure which way it is
          // going. A control that does nothing for the first eight points
          // of a drag reads as a control that is not listening.
          nudge.setValue(g.dx);
          if (drag.current == null) {
            if (Math.abs(g.dx) < 6) return;
            // Left brings the next sitting forward, right puts the last one
            // back. Locked at the first committed direction — a gesture
            // that changed its mind halfway would have to unwind a deal
            // that is already half done.
            const dir: 1 | -1 = g.dx < 0 ? 1 : -1;
            drag.current = dir;
            glide.setValue(0);
            setDeck((d) => ({ from: d.to, to: (d.to + dir + n) % n }));
            return;
          }
          const gone = Math.min(1, Math.max(0, Math.abs(g.dx) / SWIPE));
          glide.setValue(gone);
        },
        onPanResponderRelease: (_e: unknown, g: PanState) => {
          const dir = drag.current;
          drag.current = null;
          // Whatever else happens, the lean comes back. A spring rather
          // than a timing: this is the one part of the gesture that is
          // purely the card's own weight coming to rest.
          Animated.spring(nudge, {
            toValue: 0,
            damping: 18,
            stiffness: 220,
            mass: 0.7,
            useNativeDriver: false,
          }).start();
          if (dir == null) {
            setDragging(false);
            return;
          }
          const gone = Math.min(1, Math.max(0, Math.abs(g.dx) / SWIPE));
          const flick = Math.abs(g.vx) > 0.35 && Math.sign(g.vx) === -dir;
          const take = gone > SWIPE_TAKE || flick;

          Animated.timing(glide, {
            toValue: take ? 1 : 0,
            // What is left of the journey, so a card let go almost there
            // does not take as long as one let go at the start.
            duration: Math.max(140, GLIDE * (take ? 1 - gone : gone)),
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start(() => {
            if (!take) {
              // Back where it started, and the state put back with it.
              const back = deckRef.current.from;
              setDeck({ from: back, to: back });
              glide.setValue(1);
            }
            setDragging(false);
          });
          if (take) feel("tick");
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [n, glide, nudge],
  );

  // And the glide itself, which runs once per deal.
  useEffect(() => {
    // Not while a finger is on it: the drag is scrubbing this same value,
    // and a timing started underneath would race it to the end.
    if (drag.current != null) return;
    if (deck.from === deck.to) return;
    glide.setValue(0);
    Animated.timing(glide, {
      toValue: 1,
      duration: GLIDE,
      easing: Easing.out(Easing.cubic),
      /*
        Layout properties, not a transform — and this is not a preference.

        Each of these cards carries three pieces of Liquid Glass: the
        service's avatar, the count beside the title, and the state tag at
        the foot. A transform or an opacity below 1 on ANY ancestor stops
        UIVisualEffectView drawing its material, so the cheap way to animate
        this — sliding a transformed wrapper on the UI thread — would empty
        every one of them the moment the deck moved. So the cards are moved
        by their own top and their own width, off the native driver, which
        is what `useNativeDriver: false` costs and buys.
      */
      useNativeDriver: false,
    }).start();
  }, [deck.from, deck.to, glide]);

  // Nothing is mid-glide while the shelf is open, and nothing should be
  // frozen mid-glide when it closes again.
  useEffect(() => {
    if (open) glide.setValue(1);
  }, [open, glide]);

  /*
    Nought is a deck, one is a list, and the shelf opens through the middle.

    The two states used to be two different layouts — absolute cards under a
    fixed height, or cards in the flow under none — so opening the shelf was
    a jump: the panel changed height in one frame and four sittings appeared
    out from under the one that had been hiding them.

    They are one layout now. Every card is placed absolutely in both states
    and this says which arrangement it is in, so a card fans out of the deck
    to its place in the list along a path rather than being re-parented into
    one. The panel's own height rides the same value, which is what makes
    the page below move with it instead of after it.
  */
  const spread = useRef(new Animated.Value(0)).current;
  const inv = Animated.subtract(1, spread);
  /** The same point in the two arrangements, mixed by how far open it is. */
  const mix = (deckAt: Animated.Animated, listAt: number) =>
    Animated.add(
      Animated.multiply(deckAt, inv),
      Animated.multiply(spread, listAt),
    );

  const toggle = () => {
    const next = !open;
    feel("tick");
    setOpen(next);
    Animated.timing(spread, {
      toValue: next ? 1 : 0,
      // Straight there for a carer who has asked for less motion. The shelf
      // still opens and still closes; it just does not travel.
      duration: still ? 0 : SPREAD,
      // Eased at both ends: it starts from rest and it arrives at rest,
      // unlike a deal, which is thrown.
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  /** Where card `i` sits once the shelf is open, and how tall that makes it. */
  const listTop = (i: number) => SHELF + i * (cardH + SPACE.md);
  const deckH = cardH + behind * PEEK + SHELF * 2;
  const listH = n * cardH + (n - 1) * SPACE.md + SHELF * 2;

  /*
    Where a card sits, counted from the one in front.

    Anything past the deepest slot is parked there rather than given a place
    of its own — a day with more sittings than the deck has edges still
    deals every one of them through the front, it just does not show them
    all waiting at once.
  */
  const slotOf = (i: number, front: number) =>
    Math.min((i - front + n) % n, behind);

  return (
    // The margin is the handle's: half of it hangs below the panel, and the
    // section under it has to start clear of that rather than behind it.
    <View style={{ marginBottom: count > 1 ? HANDLE / 2 : 0 }}>
      {/*
        The tint is a layer behind the panel, not the box the panel is in.

        It was the container, and a rounded container clips: the syringe ran
        up to the panel's right edge and stopped dead against it, which is
        the one thing the drawing must not do. Laid in behind instead, the
        rounding is still the panel's and nothing on the shelf is inside
        anything that trims it.
      */}
      <LinearGradient
        colors={[...WASH_PANEL[TONE_FOR[kind]]] as [string, string, string]}
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

      {/* No padding of its own at the foot. The deck below already stands
          SHELF in from every edge, and a second helping here made the blue
          under the last card twice what it is at the sides. */}
      <View>
        <View
          style={{
            paddingTop: SPACE.lg,
            paddingHorizontal: SPACE.lg,
            paddingBottom: SPACE.sm,
          }}
        >
          <SectionHeader title="ภารกิจวันนี้" count={count} flush />
        </View>

        {/*
          The deck's own box, and the list's — they are the same box.

          It carries no insets of its own; each card holds its own, in both
          arrangements. All this has to do is be as tall as whichever
          arrangement it is currently between, so the page below it moves
          with the shelf rather than after it.
        */}
        <Animated.View
          /*
            The deck answers a drag; the opened-out list does not.

            Spread only while it is a deck, so a swipe across the day's work
            once it has been laid out flat is a swipe on the page, which is
            what a list is for.
          */
          {...(open ? {} : pan.panHandlers)}
          style={{
            /*
              No padding, in either arrangement.

              A card placed absolutely is laid out against this box's BORDER
              edge, not its padding edge, so a padding here would do nothing
              for the deck and something for the list — two different insets
              for the same cards. Both carry SHELF in their own offsets
              instead, which is true however the layout engine reads it.
            */
            height: mix(deckH, listH),
          }}
        >
          {/*
            Real sittings all the way down, in one arrangement that opens
            into the other.

            They were three blank rounded rectangles once, when the deck
            could not move: nothing behind the front card could ever be
            read, so there was nothing to render. A deck that deals itself
            and opens out has to carry the real thing in every slot.
          */}
          {cards.map((c, i) => {
            const was = slotOf(i, deck.from);
            const now = slotOf(i, deck.to);
            // SHELF is in here rather than in the box's padding: see
            // the note above. Every card stands that far in from the
            // panel, and each one behind a further step in again.
            const step = (s: number) => ({
              top: SHELF + (behind - s) * PEEK,
              inset: SHELF + s * DECK_INSET,
            });
            const a = step(was);
            const b = step(now);
            const between = (x: number, y: number) =>
              glide.interpolate({
                inputRange: [0, 1],
                outputRange: [x, y],
              });

            /*
                  The card at the back of the deck casts nothing.

                  Its shadow falls on the panel and on nothing else — there
                  is no card behind it to be lifted off — so all it adds is
                  a grey smudge along the top of the stack, which is the one
                  place the eye reads the deck's shape. The ones in front of
                  it keep theirs, because that is what says which edge is
                  over which.

                  Judged by where the card is going rather than where it
                  was: a card receding to the back is on its way behind
                  everything, and one coming out of the back is on its way
                  to standing over something.

                  A lone sitting is not at the back of anything, so it keeps
                  its shadow.
                */
            const deepest = !open && behind > 0 && now === behind;

            /*
                  The lean, which is the finger's own doing.

                  Scaled by where the card was standing when the gesture
                  started, not where it is going: what is being pushed is
                  the card that was in front, and it should be the one that
                  moves furthest whichever way it is on its way to.

                  Clamped, so a finger dragged across the whole screen
                  leans the card exactly as far as a finger dragged the
                  distance that turns the deck over, and no further.
                */
            const by = LEAN_BY_SLOT[Math.min(was, LEAN_BY_SLOT.length - 1)];
            const lean = nudge.interpolate({
              inputRange: [-SWIPE, 0, SWIPE],
              outputRange: [-LEAN * by, 0, LEAN * by],
              extrapolate: "clamp",
            });

            return (
              <Animated.View
                key={`card-${i}`}
                onLayout={
                  // Measured off whichever card is face up; they are
                  // all the same shape, and that is the one at its
                  // full width.
                  now === 0
                    ? (e) => setCardH(e.nativeEvent.layout.height)
                    : undefined
                }
                style={[
                  { borderRadius: RADIUS.card },
                  deepest ? null : DECK_SHADOW,
                  {
                    position: "absolute",
                    // Its place in the deck and its place in the
                    // list, mixed by how far the shelf is open.
                    top: mix(between(a.top, b.top), listTop(i)),
                    /*
                          The slot's own inset, plus however far the finger
                          has leaned it. Added on one side and taken off
                          the other, so the card slides rather than
                          stretches — a width that changed under the thumb
                          would reflow the Thai inside it mid-gesture.

                          Opened out, every card stands at the same SHELF
                          as every other: a list has no depth to show.
                        */
                    left: Animated.add(
                      mix(between(a.inset, b.inset), SHELF),
                      lean,
                    ),
                    right: Animated.subtract(
                      mix(between(a.inset, b.inset), SHELF),
                      lean,
                    ),
                    /*
                          Depth, and it changes the instant the deal starts.

                          The card that was in front drops straight to the
                          bottom of the pile and then spends the glide
                          shrinking up into it, while the one coming
                          forward grows down over it. Held until the end
                          instead, the outgoing card would sit on top of
                          the deck all the way back, which reads as the
                          wrong card being dealt.
                        */
                    zIndex: n - ((i - deck.to + n) % n),
                  },
                ]}
              >
                {c}
              </Animated.View>
            );
          })}

          {/*
            The handle, straddling the foot of the panel.

            Centred on the panel's own bottom edge, so the blue is behind
            its top half and the page's grey behind its bottom half. Inside
            the panel it was a control among the panel's contents, sitting
            on the white of the front card; below the panel it was a button
            belonging to the page. On the edge it belongs to the shelf,
            which is the thing it opens.

            It lives in the deck's own box, beside the cards rather than
            outside them: a z-index only orders a view against its own
            brothers, so out here the front card simply painted over it.
          */}
          {count > 1 && (
            <View
              pointerEvents="box-none"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                // Half of it below the panel. The deck's box ends where the
                // panel does, so this is the panel's own edge.
                bottom: -HANDLE / 2,
                alignItems: "center",
                // Past the deepest card in the deck, whose own depths run
                // from one to the number of sittings in the day.
                zIndex: n + 1,
              }}
            >
              <Pressable
                onPress={toggle}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={
                  open
                    ? "ย่อภารกิจวันนี้"
                    : `ดูภารกิจวันนี้ทั้ง ${count} รายการ`
                }
                hitSlop={10}
              >
                {/* Glass, and pressed through the material's own `interactive`:
                    an alpha under 1 anywhere above a UIVisualEffectView stops
                    it drawing, so a handle that faded under the finger would be
                    a handle that vanished. */}
                <Glass
                  interactive
                  tintColor={GLASS_NEUTRAL}
                  style={{
                    width: HANDLE,
                    height: HANDLE,
                    borderRadius: RADIUS.capsule,
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {open ? (
                    <ChevronUp
                      size={16}
                      color={TEXT_SECONDARY}
                      strokeWidth={2.6}
                    />
                  ) : (
                    <ChevronDown
                      size={16}
                      color={TEXT_SECONDARY}
                      strokeWidth={2.6}
                    />
                  )}
                </Glass>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </View>
    </View>
  );
}
