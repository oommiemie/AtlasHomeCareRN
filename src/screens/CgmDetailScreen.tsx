import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, type RouteProp } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { CalendarDays } from "lucide-react-native";

import { dismissDatePopover } from "../../modules/date-popover";
import { SegmentedControlNative } from "../../modules/segmented-control";
import { Avatar } from "../components/Avatar";
import { Card } from "../components/Card";
import { TrendChart } from "../components/TrendChart";
import { OPEN_MS, rangeInk, shade, tone } from "../components/Sparkline";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { StatTile } from "../components/StatTile";
import { UIcon } from "../components/UIcon";
import type { RootStackParamList } from "../navigation/RootStack";
import { givenName, initialOf } from "../models/household";
import { planToday } from "../models/task";
import {
  CGM_HOURS,
  CGM_RANGE,
  cgmSummary,
  cgmWindow,
  HISTORY_DAYS,
  metricOf,
  severityOf,
  statusOf,
  type CgmHours,
  type Tone,
} from "../models/vitals";
import { isSameDay, screeningStamp, startOfDay } from "../utils/thaiDate";
import {
  DANGER,
  GROUPED_BG,
  PRIMARY_100,
  PRIMARY_500,
  RADIUS,
  SPACE,
  SUCCESS,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TINT_BG,
  WARNING,
} from "../theme/tokens";

/** The card's own measurements — Figma 390:46831. */
const PAGE = { pad: 16, gap: 10 } as const;

/**
 * The pale tile the reading sits on — Figma 390:47160.
 *
 * Its fill is TINT_BG, read where the tile is drawn rather than held here:
 * a colour in a module const keeps the ground it was imported on.
 */
const TILE = { height: 109, overhang: 2 } as const;

/** The sensor drawn on it, and how long it takes to rise into place. */
const SENSOR = { width: 114, height: 112, ms: 560 } as const;

/**
 * The share of the window inside the band that counts as holding.
 *
 * The figure and the bar under it are the only two things that read this, but
 * they must read the same number: a percentage printed green over an amber bar
 * is the card disagreeing with itself.
 */
const HOLDS = 0.7;

/** The verdict's own colour — the same three the whole app reads it in. */
// Read as it renders: applyTheme runs inside App's render, after every
// screen module body, so a token in a module const keeps the light
// palette it was imported under.
const TONE_INK = (): Record<Tone, string> => ({
  normal: SUCCESS,
  warn: WARNING,
  alert: DANGER,
});

/**
 * The continuous monitor's own page.
 *
 * Everything here is about a window rather than a moment, which is what
 * separates this reading from the other five: a single glucose figure says
 * almost nothing, and the same figure with three hours of trace around it
 * says whether it is on the way up.
 */
export function CgmDetailScreen() {
  const { resident } =
    useRoute<RouteProp<RootStackParamList, "CgmDetail">>().params;
  const insets = useSafeAreaInsets();
  // Three hours to open on: the window a carer is asking about when they open
  // this page is the one just gone, and the wider ones are there to be reached
  // for.
  const [hours, setHours] = useState<CgmHours>(3);
  /**
   * Which reading the tile is reading out, or null for the newest.
   *
   * Kept here rather than in the chart because the tile is what shows it: the
   * chart picks, the tile reads. A window change clears it — a mark left over
   * from the last window would point at an hour no longer on screen.
   */
  const [picked, setPicked] = useState<number | null>(null);
  /**
   * Which day is on show. The record holds four months; the page opens on the
   * one the app calls today.
   */
  const [day, setDay] = useState<Date>(planToday);

  /**
   * The sensor rising out of the tile's bottom edge as the page arrives.
   *
   * It is a thing worn on the arm, and this page is about what it is reading
   * right now — so it comes up out of the tile the way it sits on one, rather
   * than being there from the first frame like a printed illustration. Behind
   * a box clipped to where it ends up, so what is seen is the device coming
   * up over the edge and not a picture sliding across the card.
   *
   * Once, on the way in. Changing the day changes the readings, not the
   * device that took them.
   */
  const rise = useSharedValue(0);
  useEffect(() => {
    rise.value = withDelay(
      // The same wait the trace takes: both belong to the page arriving, and
      // starting either before it has finished is movement over movement.
      OPEN_MS,
      withTiming(1, { duration: SENSOR.ms, easing: Easing.out(Easing.cubic) }),
    );
  }, [rise]);
  const rising = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - rise.value) * SENSOR.height }],
  }));

  const metric = metricOf("cgm");
  /** How far back the record goes, and no further forward than today. */
  const earliest = useMemo(() => {
    const d = new Date(startOfDay(planToday));
    d.setDate(d.getDate() - HISTORY_DAYS);
    return d;
  }, []);

  const readings = cgmWindow(resident, hours, day);
  /**
   * One scale for all four windows: the whole day's range.
   *
   * Worked out once per patient rather than per window, so a reading sits at
   * the same height whichever window is on show, and switching between them
   * moves the line rather than the ruler.
   */
  const scale = useMemo<[number, number] | undefined>(() => {
    const whole = cgmWindow(resident, 24, day).map((r) => r.value);
    return whole.length === 0
      ? undefined
      : [Math.min(...whole), Math.max(...whole)];
  }, [resident, day]);
  const summary = cgmSummary(readings);
  const shown =
    picked == null ? readings[readings.length - 1] : readings[picked];
  const status =
    shown == null ? null : statusOf("cgm", shown.value, shown.value2);
  const [low, high] = CGM_RANGE;

  /** The colour a figure is drawn in on the chart, or nothing if it is fine. */
  const outOfBand = (value: number) => {
    const severity = severityOf("cgm", value);
    return severity === 0 ? undefined : shade(metric.ink, severity);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={metric.name} />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: SPACE.lg,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + SPACE.huge,
            gap: PAGE.gap,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/*
            One card holds the window, who it belongs to, the reading and the
            trace — Figma 390:46831. The picker sits inside it because it
            picks what the card shows; outside, it read as a filter on the
            whole page.
          */}
          <Card padded={false}>
            <View style={{ padding: PAGE.pad, gap: PAGE.pad }}>
              {/*
                UIKit's own segmented control, through the `segmented-control`
                module — on iOS 26 the selected segment is a Liquid Glass
                capsule that slides, presses under the finger and takes the
                device's accent. Drawn by hand it was four capsules and a
                background, and none of that behaviour.

                The painted one is kept for a build the native module is
                missing from; same four choices in the same order, so nothing
                moves if it is ever needed.
              */}
              {SegmentedControlNative != null ? (
                <SegmentedControlNative
                  style={{ height: 32 }}
                  segments={CGM_HOURS.map((h) => `${h} ชม.`)}
                  selectedIndex={CGM_HOURS.indexOf(hours)}
                  onSegmentChange={(e) => {
                    setHours(CGM_HOURS[e.nativeEvent.index] ?? hours);
                    setPicked(null);
                  }}
                />
              ) : (
                <View
                  style={{
                    flexDirection: "row",
                    backgroundColor: GROUPED_BG,
                    borderRadius: RADIUS.capsule,
                    padding: 3,
                  }}
                >
                  {CGM_HOURS.map((h) => (
                    <Segment
                      key={h}
                      label={`${h} ชม.`}
                      on={h === hours}
                      onPress={() => {
                        setHours(h);
                        setPicked(null);
                      }}
                    />
                  ))}
                </View>
              )}

              {/*
                A card of its own inside the card — Figma 390:47160.

                Pale blue rather than white so the reading and the sensor read
                as one object sitting on the page, with the chart below it as
                a second. It does not clip: the sensor is drawn past its top
                and right edges, which is what makes the device sit on the
                tile rather than be printed on it.
              */}
              <View
                style={{
                  backgroundColor: TINT_BG,
                  borderRadius: RADIUS.card,
                  padding: PAGE.pad,
                  minHeight: TILE.height,
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.sm,
                  }}
                >
                  <Avatar
                    size={24}
                    initial={initialOf(resident.name)}
                    photo={resident.photo}
                  />
                  {/* The size and colour the app names a person at in a row
                      — the visit card and the resident row both. The design's
                      12 in pure black is the one text on this page not on the
                      app's scale. */}
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      fontSize: 14,
                      lineHeight: 20,
                      fontWeight: "600",
                      color: TEXT_PRIMARY,
                    }}
                  >
                    {givenName(resident.name)}
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    gap: SPACE.xs,
                    marginTop: PAGE.pad,
                  }}
                >
                  {/* The top of the app's scale, not the 20 a card in a grid
                      uses: this is the one number the page exists to show, and
                      on a card of its own it can be the size it deserves. */}
                  <Text
                    style={{
                      fontSize: 24,
                      lineHeight: 30,
                      fontWeight: "700",
                      color:
                        status == null || status.tone === "normal"
                          ? TEXT_PRIMARY
                          : DANGER,
                    }}
                  >
                    {shown == null ? "-" : shown.value.toFixed(0)}
                  </Text>
                  <Text
                    style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}
                  >
                    {metric.unit}
                  </Text>

                </View>
                {/*
                  The time, and whether it is the newest reading.

                  Without the words the two states are told apart only by a
                  timestamp the reader would have to know the current time to
                  judge — and the way back to the newest is a second tap on the
                  chosen point, which nobody looks for unless they know they
                  have left it.
                */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.sm,
                    marginTop: SPACE.xs,
                  }}
                >
                  {/*
                    The date is the control: tapping it opens the system's own
                    calendar popover and the page moves to that day. The
                    reading and the date it was taken on belong together, so
                    the way to change it sits on the date rather than in a row
                    of its own.

                    Three layers, and the order is the whole trick. The picker
                    is underneath, magnified so the touch lands on it anywhere
                    across the date. Over it goes an opaque patch of the tile's
                    own colour, because a control at two per cent is still
                    visible once enlarged — it came through as a huge grey
                    "2569" behind the text. Over that, the date as it is meant
                    to be read. The patch passes touches through, and the box
                    clips the enlarged control back to the words.
                  */}
                  <View style={{ overflow: "hidden" }}>
                    <View
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: 0,
                        bottom: 0,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <DateTimePicker
                        value={day}
                        mode="date"
                        display="compact"
                        locale="th-TH"
                        minimumDate={earliest}
                        maximumDate={planToday}
                        accessibilityLabel="เลือกวันที่"
                        style={{
                          // 0.02, not 0: UIKit skips hit testing on anything
                          // under one per cent, and the control would never
                          // see the touch.
                          opacity: 0.02,
                          // Wide enough that the touch lands on it anywhere
                          // across the date, and no taller than it already
                          // is. The popover comes up off this control's own
                          // frame, so stretching it downwards pushed the
                          // calendar away from the date it belongs to — and
                          // the control is a good two rows tall to begin
                          // with, which is already more than the words.
                          transform: [{ scaleX: 2 }],
                        }}
                        onChange={(_e: unknown, next?: Date) => {
                          if (next == null) return;
                          setDay(startOfDay(next));
                          setPicked(null);
                          // A day is the whole of what there is to choose
                          // here, so choosing one is also the way out. UIKit
                          // keeps its calendar up until it is tapped away,
                          // which leaves the page changed behind a sheet
                          // still waiting to be dismissed.
                          dismissDatePopover();
                        }}
                      />
                    </View>

                    <View
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: 0,
                        bottom: 0,
                        backgroundColor: TINT_BG,
                      }}
                    />

                    <View
                      pointerEvents="none"
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <CalendarDays size={12} color={TEXT_MUTED} />
                      <Text style={{ fontSize: 12, color: TEXT_MUTED }}>
                        {shown == null
                          ? "ยังไม่มีข้อมูล"
                          : screeningStamp(shown.at)}
                      </Text>
                    </View>
                  </View>
                  {picked == null &&
                    shown != null &&
                    isSameDay(day, planToday) && (
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "600",
                          color: SUCCESS,
                        }}
                      >
                        ค่าล่าสุด
                      </Text>
                    )}

                  {/*
                    The way back, and only while there is somewhere to come
                    back from.

                    A filled capsule rather than a word in blue: bare text
                    beside a timestamp reads as a label saying what the date
                    is, not as something to press.
                  */}
                  {!isSameDay(day, planToday) && (
                    <Pressable
                      onPress={() => {
                        setDay(planToday);
                        setPicked(null);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="กลับไปวันนี้"
                      hitSlop={6}
                      style={{
                        paddingHorizontal: SPACE.sm,
                        paddingVertical: 3,
                        borderRadius: RADIUS.capsule,
                        backgroundColor: PRIMARY_100,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          lineHeight: 16,
                          fontWeight: "600",
                          color: PRIMARY_500,
                        }}
                      >
                        วันนี้
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* Off the tile's bottom and right corners — the outer card
                    is what finally clips it. Sat on the bottom edge rather
                    than the top, so the device reads as standing on the tile
                    instead of hanging off it.

                    The box is exactly where the sensor ends up, and it clips:
                    the sensor starts a whole height below it, out of sight,
                    and is revealed from the bottom edge upwards as it comes
                    into place. */}
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    right: -TILE.overhang,
                    bottom: -TILE.overhang,
                    width: SENSOR.width,
                    height: SENSOR.height,
                    overflow: "hidden",
                  }}
                >
                  <Reanimated.View style={rising}>
                    <Image
                      source={require("../../assets/images/cgm_sensor.png")}
                      style={{ width: SENSOR.width, height: SENSOR.height }}
                      resizeMode="contain"
                      accessibilityRole="none"
                    />
                  </Reanimated.View>
                </View>
              </View>
            </View>

            {/* Inset from the card's edges and clear of its foot.
                
                The design runs it to the edges, which works on a card drawn
                at a fixed 408 wide; on a phone the line reaches the corner
                radius and the chart looks cropped rather than full-bleed. */}
            <View
              style={{ paddingHorizontal: PAGE.pad, paddingBottom: PAGE.pad }}
            >
              <TrendChart
                readings={readings}
                kind="cgm"
                ink={metric.ink}
                // Taller than the design's 157: that height was drawn before
                // the axis took 34 of it for its labels, which left the line
                // about a hundred points to move in.
                height={224}
                picked={picked}
                onPick={setPicked}
                scale={scale}
              />
            </View>
          </Card>

          {summary != null && (
            <>
              {/* Three to a row, 80 tall — Figma 390:46831's own strip. */}
              <View style={{ flexDirection: "row", gap: PAGE.gap }}>
                <StatTile
                  label="เฉลี่ย"
                  value={summary.average.toFixed(0)}
                  unit={metric.unit}
                />
                {/*
                  A mark only where the value left its band.

                  It used to carry the colour whatever the reading was, which
                  for a reading in range is the metric's own green — and a
                  green dot beside "ต่ำสุด" reads as a verdict on the low
                  rather than as a colour to match against the chart. Now the
                  dot means one thing: this figure is one of the coloured
                  stretches up there.

                  The average never has one: it is not a point on the chart,
                  and a swatch beside it would send the reader looking for
                  something to match.
                */}
                <StatTile
                  label="สูงสุด"
                  value={summary.high.toFixed(0)}
                  unit={metric.unit}
                  ink={outOfBand(summary.high)}
                />
                <StatTile
                  label="ต่ำสุด"
                  value={summary.low.toFixed(0)}
                  unit={metric.unit}
                  ink={outOfBand(summary.low)}
                />
              </View>

              <Card>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.sm,
                  }}
                >
                  <UIcon name="waveformCircle" size={16} color={TEXT_PRIMARY} />
                  <Text
                    style={{
                      fontSize: 16,
                      lineHeight: 22,
                      fontWeight: "600",
                      color: TEXT_PRIMARY,
                    }}
                  >
                    สรุปภาพรวม
                  </Text>
                </View>

                {/*
                  Time in range first, because it is the figure a continuous
                  monitor exists to produce: a mean of 130 can be a steady 130
                  or a day swinging between 60 and 200, and only the share of
                  readings inside the band tells those apart.
                */}
                <View style={{ marginTop: SPACE.lg, gap: SPACE.sm }}>
                  <View
                    style={{ flexDirection: "row", alignItems: "baseline" }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 14,
                        lineHeight: 20,
                        color: TEXT_MUTED,
                      }}
                    >
                      {`อยู่ในเกณฑ์ (${low}–${high})`}
                    </Text>
                    {/* Green while the window held, and the app's own black
                        when it did not. A figure that turns brown to say so
                        is the page raising its voice at a number the reader
                        can already see is short — and the line under this one
                        says how short, in readings. */}
                    <Text
                      style={{
                        fontSize: 20,
                        lineHeight: 26,
                        fontWeight: "700",
                        color: summary.inRange >= HOLDS ? SUCCESS : TEXT_PRIMARY,
                      }}
                    >
                      {`${Math.round(summary.inRange * 100)}%`}
                    </Text>
                  </View>

                  {/*
                    The same number as a bar, so it is read before it is
                    counted.

                    Thin, and in the verdict's colour rather than the
                    reading's — green holding, amber slipped, red well past.
                    The monitor's own teal made a poor window look as calm as
                    a good one, and every other reading's page had its own
                    hue for the same bar. One scale across all six: see
                    `rangeInk`.
                  */}
                  <View
                    style={{
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: PRIMARY_100,
                      overflow: "hidden",
                    }}
                  >
                    <LinearGradient
                      colors={rangeInk(summary.inRange, HOLDS)}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        width: `${Math.round(summary.inRange * 100)}%`,
                        height: 6,
                        borderRadius: 3,
                      }}
                    />
                  </View>
                </View>

                {/* The verdict, in the summary rather than as a capsule
                    beside the reading — see the same move on `VitalDetail`. */}
                {status != null && shown != null && (
                  <Bullet
                    ink={TONE_INK()[status.tone]}
                    text={`ค่าที่อ่าน ${shown.value.toFixed(metric.decimals)} ${metric.unit} · ${status.label}`}
                  />
                )}
                <Bullet
                  ink={summary.above > 0 ? WARNING : SUCCESS}
                  text={`สูงกว่าเกณฑ์ ${summary.above} ครั้ง · ต่ำกว่าเกณฑ์ ${summary.below} ครั้ง จาก ${summary.count} ค่า`}
                />
                <Bullet
                  ink={summary.trend === "flat" ? SUCCESS : WARNING}
                  text={
                    summary.trend === "flat"
                      ? `ระดับน้ำตาลใน ${hours} ชั่วโมงที่ผ่านมาค่อนข้างคงที่`
                      : summary.trend === "up"
                        ? `ระดับน้ำตาลใน ${hours} ชั่วโมงที่ผ่านมามีแนวโน้มสูงขึ้น`
                        : `ระดับน้ำตาลใน ${hours} ชั่วโมงที่ผ่านมามีแนวโน้มลดลง`
                  }
                />
              </Card>
            </>
          )}
        </ScrollView>
      </HeaderFade>
    </View>
  );
}

function Bullet({ ink, text }: { ink: string; text: string }) {
  return (
    <View style={{ flexDirection: "row", gap: SPACE.sm, marginTop: SPACE.md }}>
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          marginTop: 8,
          backgroundColor: ink,
        }}
      />
      <Text
        style={{ flex: 1, fontSize: 14, lineHeight: 22, color: TEXT_PRIMARY }}
      >
        {text}
      </Text>
    </View>
  );
}

function Segment({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={{
        flex: 1,
        height: 34,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: RADIUS.capsule,
        backgroundColor: on ? PRIMARY_500 : "transparent",
      }}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: on ? "700" : "500",
          color: on ? "#FFFFFF" : TEXT_PRIMARY,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
