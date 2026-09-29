import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  Animated,
  Easing,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { DateHitLayer } from "../components/DateHitLayer";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  Clock,
  List,
  List as ListIcon,
  Search,
} from "lucide-react-native";

import { dismissDatePopover } from "../../modules/date-popover";
import { Chevron } from "../components/Chevron";
import { useTabBarInset } from "../utils/useTabBarInset";
import { feel } from "../utils/haptics";
import { Card } from "../components/Card";
import { Glass } from "../components/Glass";
import { FilterSelect, type FilterOption } from "../components/FilterSelect";
import { ToolbarPill } from "../components/ToolbarPill";
import { UIcon } from "../components/UIcon";
import { PressableScale } from "../components/PressableScale";
import { VisitCard, VisitBadge } from "../components/VisitCard";
import { VisitCounts } from "../components/VisitCounts";
import type { RootStackParamList } from "../navigation/RootStack";
import { openTask } from "../navigation/openTask";
import {
  initialOf,
  isDone,
  matchesFilter,
  planToday,
  visitsOn,
  visitStateOf,
  yearTasks,
  type Task,
  type TaskFilter,
} from "../models/task";
import { currentDisplay } from "../models/display";
import {
  THAI_WEEKDAYS,
  isSameDay,
  startOfDay,
  thaiFullDate,
  thaiMonthYear,
  thaiTime,
} from "../utils/thaiDate";
import { tr } from "../i18n";
import { cardWidth, columnsFor, useLayout, GUTTER } from "../theme/layout";
import {
  DANGER,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SHEET,
  SUCCESS,
  SPACE,
  SURFACE,
  SURFACE_SUNK,
  TEXT_DISABLED,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  WASH_DEEP,
  shadow,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const WEEKDAYS = THAI_WEEKDAYS;
/** A month's name alone, for the list's dividers. */
const MONTHS_FULL = tr(
  [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ],
  [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
);

/** The sheet's own top corners, which the blue is cut away by. */
const SHEET_RADIUS = 32;

/**
 * The calendar's geometry, straight off the design.
 *
 * A month is always six rows whether or not the last one carries dates, so
 * the grid is a known 332 (6×52 plus five 4pt gutters) rather than something
 * measured. Five- and six-row months then keep one height, which is what
 * stops the sheet below shifting up and down as the months are paged.
 */
const CELL = 52;
const CELL_GAP = 4;
/**
 * How tall this particular month is.
 *
 * Six rows was a simplification that cost a band of empty blue under every
 * five-row month — most of them — and the sheet sat that much lower than it
 * had to. The grid is drawn at the rows the month actually needs, and the
 * sheet moves up to meet it.
 */
function monthHeight(month: Date): number {
  const lead = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const rows = Math.ceil((lead + days) / 7);
  return rows * CELL + (rows - 1) * CELL_GAP;
}

/** How a day reads on the calendar, which decides its dot colour. */
type DayStatus = "none" | "past" | "complete" | "overdue" | "today";

function statusFor(day: Date, visits: Task[]): DayStatus {
  const onDay = visitsOn(day, visits);
  if (onDay.length === 0) return "none";
  if (isSameDay(day, planToday)) return "today";
  const allDone = onDay.every(isDone);
  if (day.getTime() < planToday.getTime())
    return allDone ? "complete" : "overdue";
  return allDone ? "complete" : "past";
}

/**
 * The dot under a date — Figma's three 8pt ellipses.
 *
 * White for work still to do, green for a day that is finished and red for
 * one that was missed. On the blue these read as the calendar's own marks;
 * the greys the old white card used would have disappeared into it.
 */
const DOT: Record<DayStatus, string> = {
  none: "transparent",
  past: "#FFFFFF",
  complete: SUCCESS,
  overdue: DANGER,
  today: "#FFFFFF",
};

/**
 * The states the plan can be narrowed to.
 *
 * Four rather than the home screen's three: a year's schedule has overdue
 * work in it, which today's list by definition does not.
 */
export type PlanMode = "month" | "week" | "day" | "list";

/**
 * Visits grouped into the months they fall in, in the order they appear.
 *
 * A Map keeps insertion order, so the groups come out in whatever order the
 * list was already sorted into rather than being re-sorted behind the
 * caller's back. The key carries the year so two Augusts cannot merge; only
 * the month name is shown, which is what the design's dividers say.
 */
function byMonth(list: Task[]): [string, string, Task[]][] {
  const groups = new Map<string, [string, Task[]]>();
  for (const t of list) {
    const name = MONTHS_FULL[t.dueAt.getMonth()];
    const key = `${name} ${t.dueAt.getFullYear()}`;
    groups.set(key, [name, [...(groups.get(key)?.[1] ?? []), t]]);
  }
  return [...groups.entries()].map(([key, [name, tasks]]) => [
    key,
    name,
    tasks,
  ]);
}

const PLAN_MODES: FilterOption<PlanMode>[] = [
  { key: "month", label: tr("เดือน", "Month"), Icon: CalendarDays },
  { key: "week", label: tr("สัปดาห์", "Week"), Icon: CalendarRange },
  { key: "day", label: tr("ตารางเวลา", "Schedule"), Icon: Clock },
  { key: "list", label: tr("รายการ", "List"), Icon: List },
];

const PLAN_FILTERS: FilterOption<TaskFilter>[] = [
  { key: "all", label: tr("ทั้งหมด", "All"), Icon: ListIcon },
  { key: "pending", label: tr("กำลังจะทำ", "Upcoming"), Icon: Clock },
  { key: "done", label: tr("เสร็จสิ้นแล้ว", "Completed"), Icon: Check },
  { key: "overdue", label: tr("เกินกำหนด", "Overdue"), Icon: AlertCircle },
];

/** "แผนเยี่ยม" — the year's schedule, read four ways. */
export function VisitPlanScreen() {
  // The week, not the month: a round is planned a week at a time, and the
  // month view opens on thirty days of which twenty-three are not this
  // carer's problem today.
  const [mode, setMode] = useState<PlanMode>("week");
  const asList = mode === "list";
  const hasCalendar = mode === "month" || mode === "week";
  const [filter, setFilter] = useState<TaskFilter>("all");
  /**
   * The chosen day, and the period on show, kept apart.
   *
   * They used to be one date, and stepping to another month set it to the
   * 1st — so paging through the calendar silently reselected a day and the
   * list below jumped to it. Browsing now moves only the view; the selection
   * stays where it was put until a day is actually tapped.
   */
  const [focused, setFocused] = useState(planToday);
  const [period, setPeriod] = useState(planToday);
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarInset();
  const nav = useNavigation<Nav>();

  /*
    On a tablet held sideways the page splits in half, as the home page
    does: the calendar and the day's counts on the blue at the left, and
    the day's visits on a card of their own at the right — picking a day
    and reading it side by side rather than one above the other. The
    page's margin at both edges and between the halves, and the two
    halves starting on one line.

    The timeline splits the same way, with a month on the left to pick its
    day from and the day's hours in the card on the right.

    Upright, and on anything narrower, the page keeps the phone's order at
    full width, with the visit cards in columns. The list has no calendar
    to put beside anything, so it stays whole as well.
  */
  const { width, regular, landscape } = useLayout();
  const timelineSplit = regular && landscape && mode === "day";
  const sideBySide = regular && landscape && (hasCalendar || timelineSplit);
  /** A calendar on show, and whether it is a month's grid. */
  const showCalendar = hasCalendar || timelineSplit;
  const monthly = mode === "month" || timelineSplit;
  const pane = width / 2;
  // The card on the right: its half, less the page's margin at the edge.
  const listWidth = sideBySide ? pane - GUTTER : width;
  const columns = columnsFor(listWidth);
  const cardW = cardWidth(listWidth - GUTTER * 2, columns, SPACE.md);

  // The timeline follows the day being browsed; the month and week grids
  // keep their own selection. Stepping days in timeline mode moved `period`
  // while the list still read `focused`, so the arrows appeared to do
  // nothing at all.
  const dayVisits = visitsOn(mode === "day" ? period : focused, yearTasks);

  /**
   * What the header says.
   *
   * The design writes the chosen day out in full — "10 สิงหาคม 2569" — and
   * on the list drops it for the screen's own name. While the calendar is
   * being paged, though, the chosen day may be nowhere on screen, and a
   * title naming a day in August above a grid of September dates is worse
   * than no title: it says the wrong thing rather than nothing. So the full
   * date holds while the selection is in view, and the month takes over
   * once it is not.
   */
  const inView =
    mode === "month"
      ? focused.getMonth() === period.getMonth() &&
        focused.getFullYear() === period.getFullYear()
      : mode === "week"
        ? isSameDay(startOfWeek(focused), startOfWeek(period))
        : true;
  const titled = mode === "day" ? period : focused;
  const title = asList
    ? tr("แผนเยี่ยม", "Visit plan")
    : inView
      ? thaiFullDate(titled)
      : thaiMonthYear(period);

  const ModeIcon = PLAN_MODES.find((m) => m.key === mode)?.Icon ?? CalendarDays;

  /**
   * What the list below is showing: the chosen DAY, in every calendar mode.
   *
   * The week strip used to list its whole week instead. Tapping a day then
   * did nothing at all — the highlight moved, and the seven visits under it
   * stayed exactly as they were, because every day in the strip belongs to
   * the same week. The strip's dots say which days have visits; tapping one
   * has to answer with that day, which is what the month grid already did.
   *
   * Browsing still only moves the view: paging the strip moves `period`,
   * and nothing below changes until a day is actually tapped.
   */
  const pool = mode === "list" ? yearTasks : dayVisits;
  const shown = pool.filter((t) => matchesFilter(t, filter, planToday));

  const done = pool.filter(isDone).length;
  const overdue = pool.filter(
    (t) => visitStateOf(t, planToday) === "overdue",
  ).length;

  /**
   * The calendar slides the way it is going.
   *
   * Out a little in the direction of travel and fading, the period swapped
   * at the far end, then in from the other side — so a month change reads
   * as movement rather than as the grid blinking into a different set of
   * numbers.
   *
   * Native-driven: the grid holds no glass, so a transform here is free of
   * the material problem that rules it out elsewhere in this app.
   */
  const slide = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const sliding = useRef(false);

  /**
   * The calendar's height, eased between the two it can have.
   *
   * Both are known — a month is always six rows and a week always one — so
   * this animates to a constant rather than to something measured. The
   * old screen measured its content because the grid's height moved with
   * the month; a fixed six-row grid takes that problem away, and with it the
   * absolutely-positioned measuring layer it needed.
   *
   * Height is layout, so it cannot be native-driven — but it runs only on a
   * change of mode, not per frame of a gesture.
   */
  const target = monthly ? monthHeight(period) : mode === "week" ? CELL : 0;
  const boxHeight = useRef(new Animated.Value(target)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      // Nothing to ease from on the first pass; opening from zero would play
      // an animation the user did not ask for.
      first.current = false;
      boxHeight.setValue(target);
      return;
    }
    Animated.timing(boxHeight, {
      toValue: target,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [target, boxHeight]);

  const stepRef = useRef<(by: number) => void>(() => {});

  const step = (by: number) => {
    const d = new Date(period);
    if (mode === "week") d.setDate(d.getDate() + by * 7);
    // The timeline beside a month pages by the month, like the grid it is.
    else if ((mode === "day" && !timelineSplit) || asList)
      d.setDate(d.getDate() + by);
    else d.setMonth(d.getMonth() + by, 1);
    setPeriod(d);
  };

  /** Step with the slide. */
  const shift = (by: number) => {
    if (sliding.current) return;
    sliding.current = true;
    const away = by > 0 ? -36 : 36;
    Animated.parallel([
      Animated.timing(slide, {
        toValue: away,
        duration: 120,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => {
      step(by);
      slide.setValue(-away);
      Animated.parallel([
        Animated.timing(slide, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        sliding.current = false;
      });
    });
  };

  // The responder is created once; it reads the live step through this ref
  // rather than closing over the first render's copy.
  stepRef.current = shift;

  /**
   * A sideways drag across the calendar moves a period, the way a paper
   * diary turns.
   *
   * This is now the only way to page it: the design has no arrows and no
   * "today" button, so the gesture carries what those used to. It claims
   * the drag only once the finger has travelled further across than down,
   * so the sheet below can still be scrolled through the same area.
   */
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) < 40) return;
        stepRef.current(g.dx < 0 ? 1 : -1);
      },
    }),
  ).current;

  /** Whether the calendar is already showing today, so the button can rest. */
  const onToday = isSameDay(focused, planToday) && isSameDay(period, planToday);

  /**
   * How far the header's picker may wander.
   *
   * The plan holds one year of work, and a calendar that opens on any date
   * in either direction lets a carer land somewhere there is nothing to
   * find and no way to tell why. The bounds are taken from the schedule
   * itself, rounded out to whole months so the picker's month arrows stop
   * at the edge rather than mid-grid.
   */
  const span = useMemo(() => {
    const times = yearTasks.map((t: Task) => t.dueAt.getTime());
    const lo = new Date(Math.min(...times, planToday.getTime()));
    const hi = new Date(Math.max(...times, planToday.getTime()));
    return {
      from: new Date(lo.getFullYear(), lo.getMonth(), 1),
      to: new Date(hi.getFullYear(), hi.getMonth() + 1, 0),
    };
  }, []);

  /** Tapping a day both selects it and brings the view to it. */
  const pickDay = (d: Date) => {
    setFocused(d);
    setPeriod(d);
  };

  return (
    // The sheet's grey — Figma `#f5f5f5`, not the app canvas — and the ramp
    // behind it are read here rather than held in module constants. A
    // constant evaluated as this file loads keeps whichever theme was on at
    // the time, and neither of them would turn with the next one.
    <View style={{ flex: 1, backgroundColor: SHEET }}>
      {/*
        The wash behind the calendar — Figma 569:1341, a single ramp rather
        than the home screen's `LivingGradient`.

        That one dissolves into the canvas, because the cards on those
        screens sit straight on the page. Here the sheet's own edge is what
        ends the blue, so the ramp has to still be at full colour where the
        sheet meets it.
      */}
      <LinearGradient
        colors={[WASH_DEEP[0], WASH_DEEP[1]]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/*
        One scroll for the whole page, calendar included.

        The sheet's rounded top travels with the content rather than being
        pinned: scrolling down draws it up over the calendar until the blue
        is gone and the list has the screen to itself. The wash behind stays
        put, so there is always colour under the sheet's edge wherever it
        has got to.
      */}
      {/*
        The page holds still; only the visits move.

        The calendar is what a carer navigates with, and a calendar that
        scrolls away as the list is read has to be scrolled back to before
        the next day can be picked. So the whole page is laid out to the
        screen, and the scroller lives inside the sheet around the cards
        alone.
      */}
      <View style={{ flex: 1, paddingTop: insets.top + SPACE.sm }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: GUTTER,
            paddingBottom: SPACE.lg,
            // Above the sheet, which comes later in the tree and would
            // otherwise paint over it — the view menu hanging off this row
            // opened behind the sheet's own filter.
            zIndex: 30,
          }}
        >
          {/*
            White, where the design writes #111.

            The Figma frame draws this title over the palest part of the ramp
            and it reads there; on the device the wash is at full strength
            behind it and near-black on that blue is barely legible. The
            weekday row and the dates below are already white, so this joins
            them rather than being the one dark thing on the calendar.

            24/700 and sitting 8pt under the inset, which is what the other
            three tabs write their own titles at: this one was two steps
            smaller and a hair higher, and switching tabs moved the heading.
          */}
          {asList ? (
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontSize: 24,
                fontWeight: "700",
                color: "#FFFFFF",
              }}
            >
              {title}
            </Text>
          ) : (
            /*
              The date is the control: tapping it opens the system's own
              calendar under the words, and the day chosen there is selected
              the same as one tapped on the grid.

              The picker itself is underneath, magnified so the touch lands
              on it anywhere across the title, and left at two per cent —
              UIKit skips hit testing on anything under one. There is no
              opaque patch over it the way the health tiles have, because
              the ramp behind this one is a gradient and a patch of flat
              colour would show as a block; at two per cent on this blue the
              control has nothing left to see.
            */
            <View style={{ flexShrink: 1, overflow: "hidden" }}>
              <DateHitLayer
                value={titled}
                minimumDate={span.from}
                maximumDate={span.to}
                label={tr("เลือกวันที่", "Choose a date")}
                scale={{ x: 2.4, y: 1.6 }}
                onPick={(next) => {
                  feel("tick");
                  pickDay(startOfDay(next));
                  // A day is the whole of what there is to choose here, so
                  // choosing one is also the way out.
                  dismissDatePopover();
                }}
              />

              <View
                pointerEvents="none"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACE.xs,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    flexShrink: 1,
                    fontSize: 24,
                    fontWeight: "700",
                    color: "#FFFFFF",
                  }}
                >
                  {title}
                </Text>
                {/* The mark iOS puts on a title that opens something — with
                    nothing there the date reads as a heading, and nobody
                    presses a heading. */}
                <ChevronDown
                  size={20}
                  color="rgba(255,255,255,0.75)"
                  strokeWidth={2.6}
                />
              </View>
            </View>
          )}
          <View style={{ flex: 1 }} />
          {/*
            The header capsule — search, and the view switcher hanging off
            its second slot so the menu has something to belong to.
          */}
          <FilterSelect
            value={mode}
            options={PLAN_MODES}
            onChange={setMode}
            z={60}
            renderTrigger={({ toggle }) => (
              <ToolbarPill
                slots={[
                  {
                    icon: <Search size={20} color={TEXT_PRIMARY} />,
                    label: tr("ค้นหา", "Search"),
                    onPress: () => nav.navigate("Spotlight"),
                  },
                  {
                    // Back to today. A calendar paged three months out has
                    // no way home but paging back, and the day a carer
                    // wants nine times in ten is this one.
                    // A target, not another calendar: the slot beside it
                    // already wears a calendar for the view switcher, and
                    // two calendars in one capsule say nothing apart.
                    icon: (
                      <UIcon
                        name="calendarDay"
                        size={20}
                        color={onToday ? TEXT_DISABLED : TEXT_PRIMARY}
                      />
                    ),
                    label: tr("ไปวันนี้", "Go to today"),
                    onPress: () => {
                      if (onToday) return;
                      feel("tick");
                      pickDay(planToday);
                    },
                  },
                  {
                    // The glyph of whichever view is on, so the slot says
                    // what you are looking at rather than always showing a
                    // calendar whatever mode the screen is in.
                    icon: <ModeIcon size={20} color={TEXT_PRIMARY} />,
                    label: `${tr("มุมมอง", "View")}: ${PLAN_MODES.find((m) => m.key === mode)?.label ?? ""}`,
                    onPress: toggle,
                  },
                ]}
              />
            )}
          />
        </View>

        <View style={{ flex: 1, flexDirection: sideBySide ? "row" : "column" }}>
          {showCalendar && (
            <View style={sideBySide ? { width: pane } : null}>
              <View
                {...swipe.panHandlers}
                style={{ paddingHorizontal: GUTTER }}
              >
                <View style={{ flexDirection: "row", marginBottom: SPACE.sm }}>
                  {WEEKDAYS.map((w) => (
                    <Text
                      key={w}
                      style={{
                        flex: 1,
                        textAlign: "center",
                        fontSize: 14,
                        fontWeight: "500",
                        color: "rgba(255,255,255,0.8)",
                      }}
                    >
                      {w}
                    </Text>
                  ))}
                </View>
                <Animated.View
                  style={{ height: boxHeight, overflow: "hidden" }}
                >
                  <Animated.View
                    style={{
                      opacity: fade,
                      transform: [{ translateX: slide }],
                    }}
                  >
                    {monthly ? (
                      <MonthGrid
                        month={period}
                        // On the timeline the day shown is the day chosen.
                        selected={mode === "day" ? period : focused}
                        onPick={pickDay}
                      />
                    ) : (
                      <WeekStrip
                        week={period}
                        selected={focused}
                        onPick={pickDay}
                      />
                    )}
                  </Animated.View>
                </Animated.View>
              </View>

              {/*
          The calendar's own bottom padding, and only its own.

          On the timeline and the list the header row's 16 is the whole gap
          before the sheet — adding this there as well doubled it, and the
          two modes sat visibly lower than the two with a calendar.
        */}
              <View style={{ height: SPACE.lg }} />
            </View>
          )}

          {/* The sheet: everything the calendar is a way of selecting. */}
          <View
            style={{
              // `flexGrow`, and deliberately not `flex: 1`.
              //
              // `flex: 1` carries `flexBasis: 0`, which sizes this box to the
              // space left in the viewport and nothing else: its cards then
              // overflowed past the bottom with no height to scroll to, so the
              // page sat still and the last visit was simply cut off. Growing
              // from an `auto` basis fills a short day to the foot of the
              // screen and still measures a long one.
              // The sheet takes what the calendar leaves, and its own
              // scroller fills it.
              flex: 1,
              backgroundColor: SHEET,
              borderTopLeftRadius: SHEET_RADIUS,
              borderTopRightRadius: SHEET_RADIUS,
              paddingTop: SPACE.lg,
              // A card of its own beside the calendar, when split: the
              // page's margin at the screen's edge, running down to the
              // foot of the screen under the tab bar, and holding still
              // while what is inside it scrolls.
              ...(sideBySide && { marginRight: GUTTER }),
            }}
          >
            <View style={{ flex: 1 }}>
              {/*
            The counts, on a white card at the head of the sheet.

            Reading order holds: pick a day on the blue above, see what it
            holds here.
          */}
              <View style={{ marginHorizontal: GUTTER }}>
                <VisitCounts tasks={pool} now={planToday} />
              </View>

              <View style={{ height: SPACE.lg }} />

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: GUTTER,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "500",
                    color: TEXT_PRIMARY,
                  }}
                >
                  {tr("ภารกิจ", "Tasks")}
                </Text>
                <View style={{ flex: 1 }} />
                <FilterSelect
                  value={filter}
                  options={PLAN_FILTERS}
                  onChange={setFilter}
                />
              </View>

              <View style={{ height: SPACE.md }} />

              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{
                  paddingBottom: tabBar + SPACE.xxxl,
                }}
                showsVerticalScrollIndicator={false}
              >
                {mode === "day" ? (
                  <DayTimeline
                    visits={shown}
                    day={period}
                    now={planToday}
                    onOpen={(t) => openTask(nav, t)}
                  />
                ) : shown.length === 0 ? (
                  <View
                    style={{
                      marginHorizontal: GUTTER,
                      paddingVertical: SPACE.xxxl,
                      alignItems: "center",
                      backgroundColor: SURFACE_SUNK,
                      borderRadius: RADIUS.card,
                    }}
                  >
                    <Calendar size={28} color={TEXT_DISABLED} />
                    <Text
                      style={{
                        marginTop: SPACE.md,
                        fontSize: 14,
                        color: TEXT_SECONDARY,
                      }}
                    >
                      {asList || isSameDay(titled, planToday)
                        ? tr(
                            "วันนี้คุณไม่มีภารกิจที่ต้องทำ",
                            "You have no tasks today",
                          )
                        : tr(
                            `${titled.getDate()} ${MONTHS_FULL[titled.getMonth()]} ไม่มีภารกิจ`,
                            `No tasks on ${MONTHS_FULL[titled.getMonth()]} ${titled.getDate()}`,
                          )}
                    </Text>
                  </View>
                ) : (
                  <View style={{ paddingHorizontal: GUTTER, gap: SPACE.md }}>
                    {byMonth(shown).map(([key, name, group]) => (
                      <View
                        key={key}
                        style={[
                          { gap: SPACE.md },
                          columns > 1 && {
                            flexDirection: "row",
                            flexWrap: "wrap",
                          },
                        ]}
                      >
                        {/*
                    A month heading before each run of cards — the design's
                    own "สิงหา" / "กันยายน" dividers.

                    Only on the list. The month, week and timeline views are
                    already scoped to one period, and a heading there would
                    repeat what the calendar above it just said.
                  */}
                        {asList && (
                          <Text
                            style={{
                              marginTop: SPACE.xs,
                              width: "100%",
                              fontSize: 16,
                              fontWeight: "500",
                              color: TEXT_PRIMARY,
                            }}
                          >
                            {name}
                          </Text>
                        )}
                        {group.map((t) => (
                          <View
                            key={t.id}
                            style={columns > 1 ? { width: cardW } : null}
                          >
                            <VisitCard
                              task={t}
                              now={planToday}
                              onPress={() => openTask(nav, t)}
                            />
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

/** The Sunday a date's week opens on — Thai calendars start there. */
function startOfWeek(d: Date): Date {
  const s = new Date(d);
  s.setDate(s.getDate() - s.getDay());
  return startOfDay(s);
}

/**
 * One date on the calendar.
 *
 * Unselected it is the number in white with its dot under it, in both views.
 * Selection differs between them, and the designs are explicit about it:
 *
 * - In the month (573:2715) the whole cell becomes a translucent capsule the
 *   height of its row, the number inverted into a 24pt white disc at the top
 *   and the dot held at the bottom — which is why the selected cell is a
 *   `space-between` column and the others are not.
 * - In the week (569:1693) there is no capsule. A single row has no height
 *   for one to fill, so the disc simply takes the 32pt the number already
 *   occupies and the cell is laid out like any other.
 */
function DayCell({
  date,
  selected,
  tall,
  onPick,
}: {
  date: Date;
  selected: boolean;
  /** The month grid, where a selected cell fills its row. */
  tall: boolean;
  onPick: (d: Date) => void;
}) {
  const status = statusFor(date, yearTasks);
  const dot = (
    <View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: DOT[status],
      }}
    />
  );

  /**
   * The cell's contents — Figma 573:2715.
   *
   * Top to bottom with the ends pushed apart: a 24pt disc carrying the
   * date, and the 8pt dot under it. Chosen, the disc turns white with the
   * figure in black, and the capsule of glass goes around the pair.
   */
  const body = (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "space-between",
        padding: SPACE.xs,
        gap: SPACE.xs,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          /*
            The radius, and on Android the clip that makes it stick.

            Android drew this disc as a hard 24pt SQUARE on the first paint
            of the screen and as the circle it asks for on every one after —
            pick another day and the same view, with the same radius, came
            back round. So the radius was arriving; it was the background
            drawn on the view's first frame that had not been told to
            follow it. `overflow: "hidden"` puts the corners on the view
            itself rather than only on the shape its background is painted
            in, and that holds from the first frame.

            It costs nothing on iOS, where the disc was always round: there
            is nothing inside this box that could overflow it — one line of
            two figures, centred, at 14 on a 24pt square.
          */
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: selected ? "#FFFFFF" : "transparent",
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: "500",
            color: selected ? "#000000" : "#FFFFFF",
          }}
        >
          {date.getDate()}
        </Text>
      </View>
      {dot}
    </View>
  );

  /**
   * The capsule grows around the day as it is chosen.
   *
   * Its SIZE is what moves, not a transform — a transform anywhere above
   * the material stops it rendering, which is the same reason this cell is
   * not a `PressableScale`. So the glass starts as a ring the width of the
   * number's disc and stretches down the cell to take the dot in with it.
   *
   * Anchored at the top rather than the middle: the figure does not move
   * when the day is picked, and the glass reads as closing around a number
   * that was already there rather than as a shape arriving under it.
   *
   * Size is layout, so this cannot be native-driven. It runs for a quarter
   * of a second on one cell of a grid of thirty, which is nothing like the
   * per-frame cost that rules the driver out elsewhere.
   */
  const bloom = useRef(new Animated.Value(0)).current;
  const at = date.getTime();
  useEffect(() => {
    if (!selected) return;
    // Nothing to play when the carer has asked for stillness: the capsule
    // is simply there, at full size.
    if (currentDisplay().reduceMotion) {
      bloom.setValue(1);
      return;
    }
    bloom.setValue(0);
    Animated.spring(bloom, {
      toValue: 1,
      damping: 13,
      stiffness: 260,
      mass: 0.75,
      // No bounce past the target. The capsule ends at exactly the cell's
      // height, and a spring that overshoots grew it past the grid's own
      // box — which clips, so the bounce came out as a flat cut across the
      // bottom of the glass rather than as give.
      overshootClamping: true,
      useNativeDriver: false,
    }).start();
  }, [selected, at, bloom]);

  return (
    // The flex sits on a plain wrapper: a Pressable sizes itself to its
    // content, and the dated cells would shrink while the blank ones
    // stretched, so the columns stopped lining up with the weekday row.
    <View style={{ flex: 1 }}>
      <Pressable
        onPress={() => {
          feel("tick");
          onPick(date);
        }}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={thaiFullDate(date)}
        style={{ height: CELL }}
      >
        {/*
          The chosen day sits under a capsule of Liquid Glass — the number
          and its dot both, so the mark is the day rather than the figure.

          Behind the contents rather than around them: the capsule has to
          change size to animate, and with the number and dot inside it they
          would have been squeezed along with it. As a layer of its own it
          grows behind a body that never moves.
        */}
        {selected && (
          <View
            pointerEvents="none"
            style={{
              ...StyleSheet.absoluteFillObject,
              alignItems: "center",
            }}
          >
            {/* 32 wide and the cell's own height, centred in the column: the
                design's capsule, not a bar filling the week.
                The bare material, no tint: a tint is painted OVER the glass
                rather than mixed into it, so every point of white was a
                point of the calendar underneath that stopped coming
                through. Clear, the capsule refracts the wash and the dates
                behind it. */}
            <Animated.View
              style={{
                width: bloom.interpolate({
                  inputRange: [0, 1],
                  outputRange: [24, 32],
                  extrapolate: "clamp",
                }),
                height: bloom.interpolate({
                  inputRange: [0, 1],
                  outputRange: [32, CELL],
                  extrapolate: "clamp",
                }),
              }}
            >
              <Glass
                // The thin material, not the frosted one: this sits over
                // dates and a wash that both have to keep reading through it.
                effect="clear"
                /*
                  And a blur of them rather than a wash over them, where
                  the material is missing.

                  Painted flat, "clear" comes out as four tenths of white —
                  and this capsule is 32 across with the date's own white
                  disc 24 of them, so the disc had four points of
                  near-white either side of it and no edge to be seen
                  against. The day read as a capsule with a number in it
                  rather than as a circled number inside a capsule.
                */
                blurred
                style={{
                  ...StyleSheet.absoluteFillObject,
                  borderRadius: RADIUS.capsule,
                  overflow: "hidden",
                }}
              />
            </Animated.View>
          </View>
        )}
        {body}
      </Pressable>
    </View>
  );
}

/**
 * The week the focused day falls in.
 *
 * Seven columns like the month grid, so switching between the two moves the
 * same cells rather than redrawing a different calendar.
 */
function WeekStrip({
  week,
  selected: chosen,
  onPick,
}: {
  /** Any day inside the week to draw. */
  week: Date;
  /** The day to highlight, which may sit outside that week. */
  selected: Date;
  onPick: (d: Date) => void;
}) {
  const start = startOfWeek(week);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  return (
    <View style={{ flexDirection: "row", gap: CELL_GAP }}>
      {days.map((date) => (
        <DayCell
          key={date.toISOString()}
          date={date}
          selected={isSameDay(date, chosen)}
          tall={false}
          onPick={onPick}
        />
      ))}
    </View>
  );
}

function MonthGrid({
  month,
  selected: chosen,
  onPick,
}: {
  /** Any day inside the month to draw. */
  month: Date;
  /** The day to highlight, which may sit in another month entirely. */
  selected: Date;
  onPick: (d: Date) => void;
}) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = first.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  // Padded to whole weeks at both ends, and no further: a month that needs
  // five rows draws five, and the sheet below comes up to meet it.
  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View style={{ gap: CELL_GAP }}>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: "row", gap: CELL_GAP }}>
          {row.map((d, ci) =>
            d == null ? (
              <View key={ci} style={{ flex: 1, height: CELL }} />
            ) : (
              <DayCell
                key={ci}
                date={new Date(month.getFullYear(), month.getMonth(), d)}
                selected={isSameDay(
                  new Date(month.getFullYear(), month.getMonth(), d),
                  chosen,
                )}
                tall
                onPick={onPick}
              />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

/**
 * The day as an hour grid.
 *
 * Bands of 56 with the hour on a capsule at the head of each — filled
 * PRIMARY_500 when it is the hour you are in — and a rule running out to the
 * edge. Visits sit on the rule of the hour they fall in.
 *
 * The band keeps its height whether or not anything is in it. An empty hour
 * that collapsed would break the even pitch, and a timeline whose rows are
 * different sizes cannot be read by eye — you would have to check every
 * label to know how much of the day a gap covers.
 *
 * Visits are placed into their hour rather than positioned by the minute:
 * two in the same hour stack instead of overlapping, and a schedule that
 * reads at a glance is worth more here than one drawn to the minute.
 */
function DayTimeline({
  visits,
  day,
  now,
  onOpen,
}: {
  visits: Task[];
  /** The day on screen. */
  day: Date;
  /** The app's "today", which decides what counts as late. */
  now: Date;
  onOpen: (t: Task) => void;
}) {
  const byHour = useMemo(() => {
    const m = new Map<number, Task[]>();
    for (const t of visits) {
      const h = t.dueAt.getHours();
      m.set(h, [...(m.get(h) ?? []), t]);
    }
    return m;
  }, [visits]);

  /**
   * The wall clock, kept apart from the day being shown.
   *
   * `now` is the app's sample "today" — a fixed date at midnight — so
   * reading the hour off it pinned the marker to 00:00 whatever the time
   * actually was. The day still decides which visits are late; only the
   * marker follows the real clock.
   *
   * Ticked once a minute, and only while the timeline is on screen: the
   * interval is cleared on unmount, so nothing keeps the render loop awake
   * in the other three modes.
   */
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // The marker belongs on the day the app treats as today — the sample data
  // is dated, so that is `now` and not the wall calendar. Its position
  // within that day comes from the real clock.
  const showsNow = isSameDay(day, now);
  const currentHour = clock.getHours();

  return (
    <View style={{ paddingHorizontal: GUTTER }}>
      {Array.from({ length: 24 }, (_, h) => {
        const here = byHour.get(h) ?? [];
        const isNow = showsNow && h === currentHour;
        return (
          <View key={h} style={{ minHeight: 56 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View
                style={{
                  paddingHorizontal: SPACE.sm,
                  paddingVertical: 2,
                  borderRadius: RADIUS.capsule,
                  backgroundColor: isNow ? PRIMARY_500 : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    lineHeight: 10,
                    fontWeight: "400",
                    color: isNow ? "#FFFFFF" : TEXT_MUTED,
                  }}
                >
                  {`${String(h).padStart(2, "0")}:00`}
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  height: 1,
                  // The current hour's rule carries the same colour as its
                  // chip, so the eye finds "now" without hunting.
                  backgroundColor: isNow ? PRIMARY_500 : SEPARATOR,
                }}
              />
            </View>

            {here.length > 0 && (
              <View style={{ marginLeft: 51, marginTop: 6, gap: 6 }}>
                {here.map((t) => (
                  <PressableScale
                    key={t.id}
                    onPress={() => onOpen(t)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.name} ${thaiTime(t.dueAt)}`}
                    style={{
                      height: 48,
                      borderRadius: RADIUS.card,
                      backgroundColor: SURFACE,
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: SPACE.md,
                      gap: SPACE.sm,
                      boxShadow: shadow({ blur: 6, y: 2, opacity: 0.06 }),
                    }}
                  >
                    {/* The same glass avatar the task cards carry, so a
                        patient reads the same here as anywhere else. */}
                    <Glass
                      tintColor="rgba(7,125,215,0.95)"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        overflow: "hidden",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color: "#FFFFFF",
                        }}
                      >
                        {initialOf(t)}
                      </Text>
                    </Glass>
                    <View style={{ flex: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color: TEXT_PRIMARY,
                        }}
                      >
                        {t.name}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: 12, color: TEXT_SECONDARY }}
                      >
                        {thaiTime(t.dueAt)}
                      </Text>
                    </View>
                    {/* The status badge replaces the colour bar that used to
                        stand in for it: the bar carried the same three
                        states but made the reader learn what its colours
                        meant. */}
                    <VisitBadge state={visitStateOf(t, now)} />
                    <Chevron />
                  </PressableScale>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
