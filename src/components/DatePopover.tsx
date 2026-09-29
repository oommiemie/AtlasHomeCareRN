/**
 * The calendar a painted date opens, drawn by the app rather than by Android.
 *
 * On iOS this does not exist: `DateHitLayer` hides UIKit's compact picker
 * under the words, and tapping them brings up Apple's own popover — a
 * frosted card hanging off the date, the month in Thai with the era year,
 * a chevron either side of it, and the chosen day in a filled blue disc.
 *
 * Android has no such control. `DateTimePickerAndroid.open` is a Material
 * dialog: it takes the whole screen behind a scrim, writes its header in
 * English off the device locale ("Sun, Sep 20") and in the common era, and
 * looks nothing like the rest of this app — which is drawn, not assembled.
 * Two platforms were showing two different calendars for the same tap.
 *
 * So this is that popover, written once in the app's own tokens. It is
 * ANDROID-ONLY on purpose: where Apple's exists it is better than a redraw
 * of it, and it moves with the system. What is copied here is its shape and
 * its manners, not its implementation.
 *
 * A host at the root of the app and an emitter to reach it, which is the
 * pattern the toast already uses — and here it is not a convenience, it is
 * the only way the card can be what it is:
 *
 * - The page must show THROUGH it. Android reaches a blur through
 *   `dimezisBlurView`, which redraws the view behind into a canvas of its
 *   own — and "behind" means behind within the same window. Put in a
 *   `Modal`, which has its own window with nothing in it, the card came out
 *   as an empty pane with a calendar floating in it. Drawn into the app's
 *   own window, over the page, the blur has a page to read.
 * - It must not be clipped. The plan screen paints its date inside
 *   `overflow: "hidden"` so a long month does not push the toolbar off the
 *   row, so a card hung beside the words is cut off at the title's own
 *   height. At the root there is nothing above it to clip it.
 */
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  Animated,
  BackHandler,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react-native";

import { Glass } from "./Glass";
import { tr } from "../i18n";
import { currentDisplay } from "../models/display";
import { feel } from "../utils/haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  PRIMARY_100,
  PRIMARY_500,
  RADIUS,
  SPACE,
  TEXT_DISABLED,
  TEXT_MUTED,
  TEXT_PRIMARY,
  shadow,
} from "../theme/tokens";
import { GUTTER } from "../theme/layout";
import {
  buddhistYear,
  isSameDay,
  monthCells,
  startOfDay,
  thaiFullDate,
  thaiMonthYear,
  THAI_WEEKDAYS,
} from "../utils/thaiDate";

/** Where on screen the words that were tapped sit, in window coordinates. */
export type Anchor = { x: number; y: number; width: number; height: number };

type Request = {
  anchor: Anchor;
  /**
   * The page the date sits on, for the card to blur (see `BlurStage`).
   *
   * Android blurs nothing it is not pointed at: with no target the card
   * painted only its milk, a flat white pane over a form it should have been
   * frosting. The host is at the root, outside every page, so the date
   * that was tapped has to say which page it is on.
   */
  blurTarget?: RefObject<View | null>;
  value: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  onPick: (next: Date) => void;
};

type Listener = (req: Request | null) => void;
let listener: Listener | null = null;

/** Open the calendar under a set of words that have just been measured. */
export function openDateCalendar(req: Request): void {
  listener?.(req);
}

/** Close it from outside — a screen leaving, a sheet opening over it. */
export function closeDateCalendar(): void {
  listener?.(null);
}

/**
 * The card's geometry — measured off Apple's popover rather than invented.
 *
 * 340 across is where the iPhone's own compact picker lands on a 402pt
 * screen, and the seven columns are what is left after the padding. The
 * disc is 36 because that is the smallest circle a two-figure date sits in
 * without the ring touching the numerals, and the rows are 40 so that two
 * neighbouring discs never meet.
 */
const CARD = {
  max: 340,
  pad: SPACE.md,
  radius: RADIUS.card,
  header: 44,
  weekday: 26,
  row: 40,
  disc: 36,
  /*
    Six, whatever the month needs.

    A month is five rows or six, and a card that took the month's own count
    changed height as it was paged — which moved it on the screen, because
    where it sits is worked out from how tall it is. Apple's does not move.
    So the grid is always six rows and a short month ends in a blank one.
  */
  weeks: 6,
};

/** The card's height, which is now a constant and can be one. */
const CARD_H =
  CARD.pad * 2 + CARD.header + CARD.weekday + CARD.weeks * CARD.row;

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth() + n, 1);

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);

/** Whether a day may be chosen at all, given the span the caller allows. */
function inSpan(d: Date, min?: Date, max?: Date): boolean {
  const t = startOfDay(d).getTime();
  if (min != null && t < startOfDay(min).getTime()) return false;
  if (max != null && t > startOfDay(max).getTime()) return false;
  return true;
}

/**
 * Mounted once, at the root, beside the toast's own host.
 *
 * Renders nothing at all until a date is tapped, and is harmless on iOS,
 * where nothing ever asks it to.
 */
export function DateCalendarHost() {
  const [req, setReq] = useState<Request | null>(null);

  /*
    Where this layer's own top-left is, measured the same way the words
    were.

    The two are not in the same place, and the difference is a status bar:
    `measureInWindow` reports against the window's CONTENT, which starts
    under the bar, while this layer is laid out from the top of the root
    view, which does not — so a card placed at the reported number came out
    a bar's height high, sitting over the date instead of under it.

    Rather than subtract an inset and hope every phone agrees, the layer
    asks the same question of itself: whatever space the anchor was
    reported in, its own origin is reported in that space too, and the
    difference between them is right by construction.
  */
  const root = useRef<View>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });

  useEffect(() => {
    listener = setReq;
    return () => {
      listener = null;
    };
  }, []);

  // The back button closes the calendar before it leaves the screen — the
  // system's own picker was dismissed that way and carers will try it.
  useEffect(() => {
    if (req == null) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setReq(null);
      return true;
    });
    return () => sub.remove();
  }, [req]);

  return (
    <View
      ref={root}
      // Mounted whether or not there is a calendar, so its origin is known
      // before the first one opens; deaf to the finger until there is.
      pointerEvents={req == null ? "none" : "auto"}
      onLayout={() =>
        root.current?.measureInWindow((x, y) => setOrigin({ x, y }))
      }
      style={[StyleSheet.absoluteFillObject, { zIndex: 400 }]}
    >
      {req != null && (
        <Popover req={req} origin={origin} onClose={() => setReq(null)} />
      )}
    </View>
  );
}

function Popover({
  req,
  origin,
  onClose,
}: {
  req: Request;
  /** This layer's top-left, in the space the anchor was measured in. */
  origin: { x: number; y: number };
  onClose: () => void;
}) {
  const { anchor, value, minimumDate, maximumDate, onPick } = req;
  const { width: screenW, height: screenH } = useWindowDimensions();
  // The window's height takes no notice of the bars drawn over it, so the
  // card is kept off them by hand.
  const insets = useSafeAreaInsets();

  /*
    The month on show, which is the chosen day's month when the card opens
    and then moves with the chevrons alone.

    Held here rather than by the host, so it starts again at the chosen day
    every time: a carer who pages back three months, closes without
    choosing and opens it again is asking where the chosen day is, not
    where they were last time.
  */
  const [month, setMonth] = useState(() => startOfMonth(value));

  const grid = useMemo(() => monthCells(month, CARD.weeks), [month]);

  /*
    The days, or the years.

    A birth date is decades back, and paging a month at a time to 2528 is
    four hundred taps. Material's own picker answers that by making the
    month-and-year heading a control: pressed, the grid gives way to the
    years, and choosing one comes back to the days in it. Apple's does the
    same from the same place. So does this.
  */
  const [picking, setPicking] = useState<"days" | "years">("days");

  /*
    The card grows out of the words, the way a popover does.

    Scale and opacity together, from nine tenths: Apple's opens from the
    control it belongs to, and a card that simply appears reads as a
    dialog, which is the thing this replaces. A transform over a glass
    surface is refused on iOS by UIVisualEffectView; this one never runs
    there.
  */
  const rise = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    if (currentDisplay().reduceMotion) {
      rise.setValue(1);
      return;
    }
    const anim = Animated.timing(rise, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [rise]);

  const cardW = Math.min(CARD.max, screenW - GUTTER * 2);
  const cell = (cardW - CARD.pad * 2) / 7;

  /*
    Under the words where there is room for it, over them where there is
    not.

    The five places this opens from are not all at the top of a screen — a
    form field near the foot of a long page would put the card off the
    bottom edge, and a calendar the carer has to scroll to is a calendar
    that has already failed. Across, it starts at the left of the words and
    is pushed back inside the margins if the month would hang off the side.

    Centred on the words rather than started at their left edge: two of the
    five layers sit inside a field whose own padding moves their box without
    moving the date written in it, and a centre is the one point that
    survives that. At the plan's title, where the card is wider than the
    screen has room for, it clamps to the margin either way.

    Worked out from a height that does not change — the card is always six
    rows — so the choice to hang it above holds for every month, rather than
    being taken on the row count of whichever one is on show.
  */
  const left = clamp(
    anchor.x - origin.x + anchor.width / 2 - cardW / 2,
    GUTTER,
    Math.max(GUTTER, screenW - cardW - GUTTER),
  );
  const under = anchor.y - origin.y + anchor.height + SPACE.sm;
  const floor = screenH - insets.bottom - SPACE.lg;
  const top =
    under + CARD_H > floor
      ? // And kept on the screen where there is room neither under nor
        // over the words — a date low on a landscape tablet.
        Math.max(
          insets.top + SPACE.sm,
          Math.min(anchor.y - origin.y - CARD_H - SPACE.sm, floor - CARD_H),
        )
      : under;

  const today = startOfDay(new Date());
  const canGo = (n: number) => {
    const next = addMonths(month, n);
    // The month is reachable while any day in it is.
    const last = new Date(next.getFullYear(), next.getMonth() + 1, 0);
    return (
      inSpan(next, minimumDate, maximumDate) ||
      inSpan(last, minimumDate, maximumDate)
    );
  };

  const step = (n: number) => {
    if (!canGo(n)) return;
    feel("tick");
    setMonth(addMonths(month, n));
  };

  return (
    <>
      {/*
        A tap anywhere else closes it, and nothing is dimmed.

        A popover is not a dialog: the page behind it stays lit, because the
        carer is choosing a day FOR something that is still on screen and
        has to keep reading it. Android's own picker dims the page, which is
        most of why it arrives as an interruption.
      */}
      <Pressable
        accessibilityLabel={tr("ปิดปฏิทิน", "Close calendar")}
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      />

      {/* The shadow is cast by a layer of its own: the card clips its
          corners, and the clip that rounds them would cut the shadow off
          with them. */}
      <Animated.View
        style={{
          position: "absolute",
          left,
          top,
          width: cardW,
          borderRadius: CARD.radius,
          boxShadow: shadow({ blur: 24, y: 10, opacity: 0.22 }),
          opacity: rise,
          transform: [
            {
              scale: rise.interpolate({
                inputRange: [0, 1],
                outputRange: [0.92, 1],
              }),
            },
          ],
        }}
      >
        <Glass
          /*
            The page, blurred, which is what makes this a popover rather
            than a panel: Apple's shows the blue wash and the dates moving
            softly under it, and a flat card in its place reads as a dialog
            that forgot its scrim.
          */
          blurred
          blurTarget={req.blurTarget}
          // A month of figures to be read OFF the surface, not through it —
          // the same choice the filter menu makes for its rows.
          frost="milky"
          style={{
            borderRadius: CARD.radius,
            overflow: "hidden",
            padding: CARD.pad,
          }}
        >
          {/* The month, and the two ways through the year. */}
          <View
            style={{
              height: CARD.header,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Pressable
              onPress={() => {
                feel("tick");
                setPicking(picking === "days" ? "years" : "days");
              }}
              accessibilityRole="button"
              accessibilityLabel={tr(`${thaiMonthYear(month)} เลือกปี`, `${thaiMonthYear(month)}, choose year`)}
              accessibilityState={{ expanded: picking === "years" }}
              hitSlop={8}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.xs,
                marginRight: "auto",
              }}
            >
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "700",
                  color: TEXT_PRIMARY,
                }}
              >
                {thaiMonthYear(month)}
              </Text>
              {/* The mark that says the heading opens something, turned
                  over while it is open. */}
              <View
                style={{
                  transform: [
                    { rotate: picking === "years" ? "180deg" : "0deg" },
                  ],
                }}
              >
                <ChevronDown size={20} color={PRIMARY_500} strokeWidth={2.4} />
              </View>
            </Pressable>
            {/* No months to page through while the years are up. */}
            {picking === "days" && (
              <>
                <Arrow
                  dir="prev"
                  enabled={canGo(-1)}
                  onPress={() => step(-1)}
                />
                <Arrow dir="next" enabled={canGo(1)} onPress={() => step(1)} />
              </>
            )}
          </View>

          {picking === "years" ? (
            <YearGrid
              width={cardW - CARD.pad * 2}
              height={CARD.weekday + CARD.weeks * CARD.row}
              shown={month.getFullYear()}
              chosen={value.getFullYear()}
              from={minimumDate?.getFullYear() ?? today.getFullYear() - 120}
              to={maximumDate?.getFullYear() ?? today.getFullYear() + 10}
              current={today.getFullYear()}
              onPick={(year) => {
                feel("tick");
                // The same month in the year chosen, pulled back inside the
                // span where that month falls outside it — January of the
                // year the span starts in April is April.
                let next = new Date(year, month.getMonth(), 1);
                if (minimumDate != null && next < startOfMonth(minimumDate))
                  next = startOfMonth(minimumDate);
                if (maximumDate != null && next > startOfMonth(maximumDate))
                  next = startOfMonth(maximumDate);
                setMonth(next);
                setPicking("days");
              }}
            />
          ) : (
            <>
              <View style={{ flexDirection: "row", height: CARD.weekday }}>
                {THAI_WEEKDAYS.map((w) => (
                  <Text
                    key={w}
                    style={{
                      width: cell,
                      textAlign: "center",
                      fontSize: 13,
                      fontWeight: "500",
                      color: TEXT_MUTED,
                    }}
                  >
                    {w}
                  </Text>
                ))}
              </View>

              {grid.map((row, ri) => (
                <View key={ri} style={{ flexDirection: "row" }}>
                  {row.map((d, ci) => {
                    if (d == null)
                      return (
                        <View
                          key={ci}
                          style={{ width: cell, height: CARD.row }}
                        />
                      );
                    const date = new Date(
                      month.getFullYear(),
                      month.getMonth(),
                      d,
                    );
                    const allowed = inSpan(date, minimumDate, maximumDate);
                    const chosen = isSameDay(date, value);
                    return (
                      <Pressable
                        key={ci}
                        disabled={!allowed}
                        accessibilityRole="button"
                        accessibilityState={{
                          selected: chosen,
                          disabled: !allowed,
                        }}
                        accessibilityLabel={thaiFullDate(date)}
                        onPress={() => {
                          feel("tick");
                          // A day is the whole of what there is to choose here,
                          // so choosing one is also the way out — which is what
                          // the iOS side asks its native module for.
                          onClose();
                          onPick(date);
                        }}
                        style={{
                          width: cell,
                          height: CARD.row,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <View
                          style={{
                            width: CARD.disc,
                            height: CARD.disc,
                            borderRadius: CARD.disc / 2,
                            // The clip as well as the radius: Android drew the
                            // plan screen's own disc as a hard square on a
                            // screen's first paint until the corners were put on
                            // the view rather than only on the shape its
                            // background is painted in.
                            overflow: "hidden",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: chosen
                              ? PRIMARY_500
                              : isSameDay(date, today)
                                ? PRIMARY_100
                                : "transparent",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 17,
                              fontWeight:
                                chosen || isSameDay(date, today)
                                  ? "600"
                                  : "400",
                              color: chosen
                                ? "#FFFFFF"
                                : !allowed
                                  ? TEXT_DISABLED
                                  : isSameDay(date, today)
                                    ? PRIMARY_500
                                    : TEXT_PRIMARY,
                            }}
                          >
                            {d}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </>
          )}
        </Glass>
      </Animated.View>
    </>
  );
}

/**
 * The years, in the space the days take, four across and scrolled to the
 * one on show.
 *
 * Written in the Buddhist era, as the heading is. The chosen year is the
 * filled disc the chosen day is; this year is written in blue, as today is.
 * The newest year is at the foot, the way a calendar's own years run.
 */
const YEAR_ROW = 48;

function YearGrid({
  width,
  height,
  shown,
  chosen,
  from,
  to,
  current,
  onPick,
}: {
  width: number;
  height: number;
  /** The year on show when the grid opened, which it is scrolled to. */
  shown: number;
  chosen: number;
  from: number;
  to: number;
  current: number;
  onPick: (year: number) => void;
}) {
  const years = useMemo(() => {
    const all: number[] = [];
    for (let y = from; y <= to; y++) all.push(y);
    return all;
  }, [from, to]);
  const rows = useMemo(() => {
    const out: number[][] = [];
    for (let i = 0; i < years.length; i += 4) out.push(years.slice(i, i + 4));
    return out;
  }, [years]);
  const cell = width / 4;
  // The shown year's row in the middle of the space, not at its top edge.
  const at = Math.floor((shown - from) / 4);
  const offset = Math.max(0, at * YEAR_ROW - (height - YEAR_ROW) / 2);

  return (
    <ScrollView
      style={{ height }}
      contentOffset={{ x: 0, y: offset }}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      {rows.map((row) => (
        <View key={row[0]} style={{ flexDirection: "row" }}>
          {row.map((y) => {
            const on = y === chosen;
            const now = y === current;
            return (
              <Pressable
                key={y}
                onPress={() => onPick(y)}
                accessibilityRole="button"
                accessibilityLabel={tr(`ปี ${y + 543}`, `${y}`)}
                accessibilityState={{ selected: on }}
                style={{
                  width: cell,
                  height: YEAR_ROW,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: Math.min(cell - SPACE.xs * 2, 68),
                    height: 36,
                    borderRadius: 18,
                    overflow: "hidden",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: on
                      ? PRIMARY_500
                      : now
                        ? PRIMARY_100
                        : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: on || now ? "600" : "400",
                      color: on ? "#FFFFFF" : now ? PRIMARY_500 : TEXT_PRIMARY,
                    }}
                  >
                    {buddhistYear(new Date(y, 0, 1))}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

/** One of the two month arrows, at the 44pt floor whatever the glyph is. */
function Arrow({
  dir,
  enabled,
  onPress,
}: {
  dir: "prev" | "next";
  enabled: boolean;
  onPress: () => void;
}) {
  const Glyph = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <Pressable
      disabled={!enabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={dir === "prev" ? tr("เดือนก่อนหน้า", "Previous month") : tr("เดือนถัดไป", "Next month")}
      accessibilityState={{ disabled: !enabled }}
      hitSlop={8}
      style={{
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Glyph size={22} color={enabled ? PRIMARY_500 : TEXT_DISABLED} />
    </Pressable>
  );
}
