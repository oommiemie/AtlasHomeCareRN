import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AlertCircle, Calendar, CalendarDays, CalendarRange, Check, ChevronLeft, ChevronRight, Clock, List, List as ListIcon, Search } from "lucide-react-native";

import { Chevron } from "../components/Chevron";
import { useTabBarInset } from "../utils/useTabBarInset";
import { Card } from "../components/Card";
import { Glass } from "../components/Glass";
import { FilterSelect, type FilterOption } from "../components/FilterSelect";
import { ToolbarPill } from "../components/ToolbarPill";
import { LivingGradient } from "../components/LivingGradient";
import { PressableScale } from "../components/PressableScale";
import { VisitCard, VisitBadge } from "../components/VisitCard";
import type { RootStackParamList } from "../navigation/RootStack";
import { openTask } from "../navigation/openTask";
import {
  initialOf,
  isDone,
  matchesFilter,
  planToday,
  TASK_FILTER_LABEL,
  visitsOn,
  visitStateOf,
  yearTasks,
  type Task,
  type TaskFilter,
} from "../models/task";
import { isSameDay, startOfDay, thaiTime } from "../utils/thaiDate";
import {
  DANGER,
  PRIMARY_500,
  RADIUS,
  SECONDARY_700,
  SPACE,
  SURFACE,
  TEXT_DISABLED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const WEEKDAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const FILTERS: TaskFilter[] = ["all", "pending", "done", "overdue"];

/** How a day reads on the calendar, which decides its dot colour. */
type DayStatus = "none" | "past" | "complete" | "overdue" | "today";

function statusFor(day: Date, visits: Task[]): DayStatus {
  const onDay = visitsOn(day, visits);
  if (onDay.length === 0) return "none";
  if (isSameDay(day, planToday)) return "today";
  const allDone = onDay.every(isDone);
  if (day.getTime() < planToday.getTime()) return allDone ? "complete" : "overdue";
  return allDone ? "complete" : "past";
}

const DOT: Record<DayStatus, string> = {
  none: "transparent",
  past: "#BDBDBD",
  complete: SECONDARY_700,
  overdue: DANGER,
  today: PRIMARY_500,
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
 * caller's back.
 */
function byMonth(list: Task[]): [string, Task[]][] {
  const groups = new Map<string, Task[]>();
  for (const t of list) {
    const key = `${MONTHS_FULL[t.dueAt.getMonth()]} ${t.dueAt.getFullYear() + 543}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return [...groups.entries()];
}


/**
 * The four ways the year can be read — Figma 50:453, 74:7280, 76:8555 and
 * 84:9161, which are one screen in four states rather than four screens.
 */
/** Clears the floating header — the same 64 the home and services tabs use. */
const CONTENT_TOP = 64;

const PLAN_MODES: FilterOption<PlanMode>[] = [
  { key: "month", label: "เดือน", Icon: CalendarDays },
  { key: "week", label: "สัปดาห์", Icon: CalendarRange },
  { key: "day", label: "ตารางเวลา", Icon: Clock },
  { key: "list", label: "รายการ", Icon: List },
];

const PLAN_FILTERS: FilterOption<TaskFilter>[] = [
  { key: "all", label: "ทั้งหมด", Icon: ListIcon },
  { key: "pending", label: "กำลังจะทำ", Icon: Clock },
  { key: "done", label: "เสร็จสิ้นแล้ว", Icon: Check },
  { key: "overdue", label: "เกินกำหนด", Icon: AlertCircle },
];

/** "แผนเยี่ยม" — the year's schedule, by month or as a list. */
export function VisitPlanScreen() {
  const [mode, setMode] = useState<PlanMode>("month");
  const asList = mode === "list";
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

  // The timeline follows the day being browsed; the month and week grids
  // keep their own selection. Stepping days in timeline mode moved `period`
  // while the list still read `focused`, so the arrows appeared to do
  // nothing at all.
  const dayVisits = visitsOn(mode === "day" ? period : focused, yearTasks);
  /**
   * What the header names: the month, except on the timeline where a single
   * day is on show and "สิงหาคม" alone would not say which of its
   * thirty-one days that is.
   *
   * The week keeps the month too. Its own dates are already spelled out in
   * the strip below, and a range up here only repeated them.
   */
  const periodLabel =
    mode === "day"
      ? `${period.getDate()} ${MONTHS_FULL[period.getMonth()]} ${period.getFullYear() + 543}`
      : `${MONTHS_FULL[period.getMonth()]} ${period.getFullYear() + 543}`;

  const ModeIcon =
    PLAN_MODES.find((m) => m.key === mode)?.Icon ?? CalendarDays;

  /**
   * The week the CHOSEN day falls in, not the week on show.
   *
   * Paging the strip moves `period`, and reading the list off that meant the
   * visits below changed the moment another week scrolled into view — before
   * anything had been picked, and with no day highlighted to say what was
   * being listed. Browsing moves the view; only tapping a day moves the list.
   * That is already how the month grid behaves, and the two were disagreeing.
   */
  const weekVisits = useMemo(() => {
    const start = new Date(focused);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return yearTasks.filter(
      (t: Task) => t.dueAt >= startOfDay(start) && t.dueAt < startOfDay(end),
    );
  }, [focused]);

  const pool =
    mode === "list" ? yearTasks : mode === "week" ? weekVisits : dayVisits;
  const shown = pool.filter((t) => matchesFilter(t, filter, planToday));

  const done = pool.filter(isDone).length;
  const overdue = pool.filter((t) => visitStateOf(t, planToday) === "overdue").length;

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
   * The card's height follows its content, but eases into it.
   *
   * A month with six rows, a month with five, and the single row of a week
   * are all different heights, and switching between them snapped the card
   * and everything below it. The content reports what it needs and the box
   * travels there.
   *
   * Height is a layout property, so this one cannot be native-driven — but
   * it only runs on a change of period or mode, not per frame of a gesture.
   */
  const boxHeight = useRef(new Animated.Value(0)).current;
  const measured = useRef(0);

  // A different view is a different shape: forget the last one so the new
  // mode sizes to itself at once instead of easing down from a height that
  // belonged to the month grid.
  useEffect(() => {
    measured.current = 0;
  }, [mode]);

  const onContent = (h: number) => {
    if (h <= 0 || Math.abs(h - measured.current) < 1) return;
    const first = measured.current === 0;
    measured.current = h;
    if (first) {
      // Nothing to ease from on the first pass; jumping in from zero would
      // play an opening animation the user did not ask for.
      boxHeight.setValue(h);
      return;
    }
    Animated.timing(boxHeight, {
      toValue: h,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  const stepRef = useRef<(by: number) => void>(() => {});

  const step = (by: number) => {
    const d = new Date(period);
    if (mode === "week") d.setDate(d.getDate() + by * 7);
    else if (mode === "day" || asList) d.setDate(d.getDate() + by);
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
   * It only claims the gesture once the finger has travelled further across
   * than down — the calendar sits inside a vertical ScrollView, and a
   * responder that grabbed on any movement would eat the page's own
   * scrolling.
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

  /** Tapping a day both selects it and brings the view to it. */
  const pickDay = (d: Date) => {
    setFocused(d);
    setPeriod(d);
  };

  return (
    <View style={{ flex: 1 }}>
      <LivingGradient height={insets.top + 320} />

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + CONTENT_TOP,
          paddingBottom: tabBar + SPACE.xxxl,
        }}
      >
        {/*
          Hidden in list mode.

          Its two halves are the month header and the calendar, and the list
          shows neither — so the card came out as an empty white box with
          nothing but its own padding in it.
        */}
        {!asList && (
        <Card elevated style={{ marginHorizontal: SPACE.lg, padding: SPACE.xl }}>
          {!asList && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                // Only where a calendar follows it. On the timeline and the
                // list there is nothing under this row, and the gap it left
                // read as an empty strip at the foot of the card.
                marginBottom:
                  mode === "month" || mode === "week" ? SPACE.lg : 0,
              }}
            >
              <StepButton label="ก่อนหน้า" onPress={() => shift(-1)}>
                <ChevronLeft size={14} color={TEXT_PRIMARY} />
              </StepButton>
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  marginHorizontal: SPACE.sm,
                  fontSize: 20,
                  fontWeight: "600",
                  color: TEXT_PRIMARY,
                }}
              >
                {periodLabel}
              </Text>
              <StepButton label="ถัดไป" onPress={() => shift(1)}>
                <ChevronRight size={14} color={TEXT_PRIMARY} />
              </StepButton>
              <View style={{ width: SPACE.sm }} />
              <PressableScale
                onPress={() => pickDay(planToday)}
                accessibilityRole="button"
                accessibilityLabel="วันนี้"
                style={{
                  height: 32,
                  paddingHorizontal: SPACE.md,
                  borderRadius: RADIUS.capsule,
                  backgroundColor: "rgba(0,0,0,0.04)",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: isSameDay(period, planToday) ? TEXT_DISABLED : TEXT_PRIMARY,
                  }}
                >
                  วันนี้
                </Text>
              </PressableScale>
            </View>
          )}



          {(mode === "month" || mode === "week") && (
            <View {...swipe.panHandlers}>
              <View
                style={{
                  height: 1,
                  backgroundColor: "#EDEDED",
                  marginVertical: SPACE.lg,
                }}
              />
              {/*
                Two nodes, not one.

                `height` has to be JS-driven — layout cannot go native — while
                the slide's opacity and transform are native. React Native
                will not let one animated node carry both: once a node has
                been driven natively, a JS-driven prop on it throws
                "animated node that has been moved to native earlier". So the
                box animates its height, and the sliding layer sits inside.
              */}
              <Animated.View style={{ height: boxHeight, overflow: "hidden" }}>
              <Animated.View
                style={{
                  opacity: fade,
                  transform: [{ translateX: slide }],
                }}
              >
                <View
                  onLayout={(e) => onContent(e.nativeEvent.layout.height)}
                  // Absolute, and it has to be.
                  //
                  // The box it sits in starts at height 0 and clips. A child
                  // in the flow is laid out inside that zero height, reports
                  // 0 back, and the guard against a zero measurement then
                  // leaves the box at 0 for good — the calendar never
                  // appears at all. Out of the flow it measures itself.
                  style={{ position: "absolute", left: 0, right: 0 }}
                >
                  {mode === "month" && (
                    <MonthGrid month={period} selected={focused} onPick={pickDay} />
                  )}
                  {mode === "week" && (
                    <WeekStrip week={period} selected={focused} onPick={pickDay} />
                  )}
                </View>
              </Animated.View>
              </Animated.View>
            </View>
          )}


        </Card>
        )}

        <View style={{ height: SPACE.md }} />

        {/*
          The counts, on a card of their own below the calendar.

          They are a summary of what the calendar selects, not part of it —
          sharing the calendar's card made one tall block where the grid and
          its totals ran together. Reading order still holds: pick a day
          above, see what it holds below.

          All four across one row, with the labels shortened to fit: at
          roughly 92pt a column, "เสร็จสิ้นแล้ว!" was being cut mid-word by
          its own numberOfLines.
        */}
        <Card style={{ marginHorizontal: SPACE.lg, padding: SPACE.xl }}>
          <View style={{ flexDirection: "row" }}>
            <Counter label="ทั้งหมด" value={pool.length} ink={TEXT_PRIMARY} />
            <Counter label="กำลังทำ" value={pool.length - done} ink={PRIMARY_500} />
            <Counter label="เสร็จแล้ว" value={done} ink={SECONDARY_700} />
            <Counter
              label="เกินกำหนด"
              value={overdue}
              ink={overdue > 0 ? DANGER : TEXT_DISABLED}
            />
          </View>
        </Card>

        <View style={{ height: SPACE.xl }} />

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: SPACE.lg,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: TEXT_PRIMARY }}>
            ภารกิจ
          </Text>
          <View style={{ flex: 1 }} />
          <FilterSelect
            value={filter}
            options={PLAN_FILTERS}
            onChange={setFilter}
          />
        </View>

        <View style={{ height: SPACE.md }} />

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
              marginHorizontal: SPACE.lg,
              paddingVertical: SPACE.xxxl,
              alignItems: "center",
              backgroundColor: "#F1F3F6",
              borderRadius: RADIUS.card,
            }}
          >
            <Calendar size={28} color={TEXT_DISABLED} />
            <Text style={{ marginTop: SPACE.md, fontSize: 14, color: TEXT_SECONDARY }}>
              วันนี้คุณไม่มีภารกิจที่ต้องทำ
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: SPACE.lg, gap: SPACE.md }}>
            {byMonth(shown).map(([label, group]) => (
              <View key={label} style={{ gap: SPACE.md }}>
                {/*
                  A month heading before each run of cards — the design's own
                  "สิงหา" / "กันยายน" dividers (84:9161).

                  Only where the list spans months. The month and week views
                  are already scoped to one period, and a heading there would
                  repeat what the calendar above it just said.
                */}
                {asList && (
                  <Text
                    style={{
                      marginTop: SPACE.xs,
                      fontSize: 16,
                      fontWeight: "600",
                      color: TEXT_PRIMARY,
                    }}
                  >
                    {label}
                  </Text>
                )}
                {group.map((t) => (
                  <VisitCard
                    key={t.id}
                    task={t}
                    now={planToday}
                    onPress={() => openTask(nav, t)}
                  />
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Title and the list/calendar toggle, over the wash. */}
      <View
        style={{
          position: "absolute",
          top: insets.top + SPACE.sm,
          left: SPACE.lg,
          right: SPACE.lg,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Text style={{ flex: 1, fontSize: 24, fontWeight: "700", color: TEXT_PRIMARY }}>
          แผนเยี่ยม
        </Text>
        {/*
          The header capsule — Figma `Frame 2` (73:6381): 104x44 on glass,
          two 36pt slots with a 24pt rule between them.

          The view switcher hangs from its second slot rather than replacing
          the pill: a bare glyph up here was the one piece of chrome that did
          not match the rest of the app's headers.
        */}
        <FilterSelect
          value={mode}
          options={PLAN_MODES}
          onChange={setMode}
          renderTrigger={({ toggle }) => (
            <ToolbarPill
              slots={[
                {
                  icon: <Search size={20} color={TEXT_PRIMARY} />,
                  label: "ค้นหา",
                  onPress: () => nav.navigate("Spotlight"),
                },
                {
                  // The glyph of whichever view is on, so the slot says
                  // what you are looking at rather than always showing a
                  // calendar whatever mode the screen is in.
                  icon: <ModeIcon size={20} color={TEXT_PRIMARY} />,
                  label: `มุมมอง: ${PLAN_MODES.find((m) => m.key === mode)?.label ?? ""}`,
                  onPress: toggle,
                },
              ]}
            />
          )}
        />
      </View>
    </View>
  );
}

function StepButton({
  children,
  label,
  onPress,
}: {
  children: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "rgba(0,0,0,0.04)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </PressableScale>
  );
}

function Counter({ label, value, ink }: { label: string; value: number; ink: string }) {
  return (
    // Centred in its column, both lines. Left-aligned, the figure and its
    // label sat against the column's leading edge and the four read as a
    // ragged row rather than as four equal cells.
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text
        style={{
          fontSize: 20,
          fontWeight: "800",
          color: ink,
          textAlign: "center",
        }}
      >
        {value}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          marginTop: SPACE.xs,
          fontSize: 12,
          color: TEXT_SECONDARY,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** The month grid. Weeks start on Sunday, matching Thai calendars. */
/**
 * The day as an hour grid — Figma 76:8555.
 *
 * Twenty-four bands of 56 with 8 between them. Each opens with the hour on a
 * 41-wide chip — filled PRIMARY_500 when it is the hour you are in — and a
 * rule running from just past it out to the edge. Visits sit on the rule of
 * the hour they fall in, as 48pt cards rounded 24.
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
    <View style={{ paddingHorizontal: SPACE.lg }}>
      {Array.from({ length: 24 }, (_, h) => {
        const here = byHour.get(h) ?? [];
        const isNow = showsNow && h === currentHour;
        return (
          <View
            key={h}
            style={{
              // The band's own height, held whether it is empty or not.
              minHeight: 56,
              marginBottom: SPACE.sm,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  // 41 wide with the time centred inside it, not padded:
                  // "00:00" at 10pt plus 8 of padding each side does not fit
                  // 41, and the label was being squeezed.
                  width: 41,
                  paddingVertical: 2,
                  borderRadius: RADIUS.capsule,
                  alignItems: "center",
                  backgroundColor: isNow ? PRIMARY_500 : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: isNow ? "700" : "600",
                    color: isNow ? "#FFFFFF" : TEXT_SECONDARY,
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
                  backgroundColor: isNow ? "rgba(7,125,215,0.35)" : "#EDEDED",
                }}
              />
            </View>

            {/*
              The now line, at the minute rather than at the hour.
              
              The chip says which hour you are in; this says where inside it.
              Placed proportionally down the band's 56pt — 09:30 sits halfway
              between the 09:00 rule and the 10:00 one — which is the whole
              point of a timeline over a list.
            */}
            {isNow && (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: 51,
                  right: 0,
                  top: (clock.getMinutes() / 60) * 56,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: PRIMARY_500,
                  }}
                />
                <View
                  style={{ flex: 1, height: 2, backgroundColor: PRIMARY_500 }}
                />
              </View>
            )}

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
                      borderRadius: 24,
                      backgroundColor: SURFACE,
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: SPACE.md,
                      gap: SPACE.sm,
                      shadowColor: "#000000",
                      shadowOpacity: 0.06,
                      shadowRadius: 6,
                      shadowOffset: { width: 0, height: 2 },
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
                        style={{ fontSize: 14, fontWeight: "600", color: "#FFFFFF" }}
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

/**
 * The week the focused day falls in — Figma 74:7280.
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
  const start = new Date(week);
  start.setDate(start.getDate() - start.getDay());

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  return (
    <View>
      <View style={{ flexDirection: "row", marginBottom: SPACE.md }}>
        {WEEKDAYS.map((w) => (
          <Text
            key={w}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 14,
              fontWeight: "500",
              color: TEXT_PRIMARY,
            }}
          >
            {w}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: "row" }}>
        {days.map((date) => {
          const selected = isSameDay(date, chosen);
          const status = statusFor(date, yearTasks);
          return (
            <View key={date.toISOString()} style={{ flex: 1 }}>
            <PressableScale
              onPress={() => onPick(date)}
              accessibilityRole="button"
              accessibilityLabel={`วันที่ ${date.getDate()}`}
              style={{ height: 52, alignItems: "center" }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: selected ? PRIMARY_500 : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: selected ? "700" : "400",
                    color: selected ? "#FFFFFF" : TEXT_PRIMARY,
                  }}
                >
                  {date.getDate()}
                </Text>
              </View>
              <View
                style={{
                  marginTop: 4,
                  width: 5,
                  height: 5,
                  borderRadius: 2.5,
                  backgroundColor: selected ? "transparent" : DOT[status],
                }}
              />
            </PressableScale>
            </View>
          );
        })}
      </View>
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

  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View>
      <View style={{ flexDirection: "row", marginBottom: SPACE.md }}>
        {WEEKDAYS.map((w) => (
          <Text
            key={w}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 14,
              fontWeight: "500",
              color: TEXT_PRIMARY,
            }}
          >
            {w}
          </Text>
        ))}
      </View>

      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: "row", marginBottom: SPACE.sm }}>
          {row.map((d, ci) => {
            if (d == null) return <View key={ci} style={{ flex: 1, height: 44 }} />;
            const date = new Date(month.getFullYear(), month.getMonth(), d);
            const selected = isSameDay(date, chosen);
            const status = statusFor(date, yearTasks);
            return (
              // The flex sits on a plain wrapper, not on PressableScale:
              // that component puts its `style` on an inner Animated.View,
              // so a flex given to it stretches the inside of a Pressable
              // that has already sized itself to its content. The dated
              // cells then shrank to their 34pt circle while the blank ones
              // stretched, and the columns stopped lining up with the
              // weekday header above them.
              <View key={ci} style={{ flex: 1 }}>
              <PressableScale
                onPress={() => onPick(date)}
                accessibilityRole="button"
                accessibilityLabel={`วันที่ ${d}`}
                style={{ height: 44, alignItems: "center" }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: selected ? PRIMARY_500 : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: selected ? "700" : "400",
                      color: selected ? "#FFFFFF" : TEXT_PRIMARY,
                    }}
                  >
                    {d}
                  </Text>
                </View>
                <View
                  style={{
                    marginTop: 2,
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: DOT[status],
                  }}
                />
              </PressableScale>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
