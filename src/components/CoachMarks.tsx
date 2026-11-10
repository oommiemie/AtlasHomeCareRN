import { useEffect, useState, type RefObject } from "react";
import {
  Modal,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { tabSlot } from "./IosTabBar";
import { finishCoach, useCoachDue } from "../models/coach";
import { currentDisplay } from "../models/display";
import { tr } from "../i18n";
import { GUTTER } from "../theme/layout";
import {
  GROUPED_BG,
  PRIMARY_500,
  RADIUS,
  SPACE,
  SURFACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TOUCH_MIN,
} from "../theme/tokens";
import { feel } from "../utils/haptics";

/** Long enough for the page to arrive before it is measured and dimmed. */
const SETTLE_MS = 900;
const GLIDE_MS = 320;
const DIM = "rgba(6,16,26,0.66)";
/** How far the lit area stands off the summary card. */
const HALO = 6;
const NOTE_MAX = 380;
/** Between the lit area and the note, leaving room for the note's point. */
const NOTE_GAP = 16;
const POINT = 16;
const TAB_COUNT = 4;

type Box = { x: number; y: number; width: number; height: number };
type Hole = Box & { radius: number };
type Stop = { tab: number | null; title: string; body: string };

/** In the order the page reads: its own card, then the tabs left to right. */
const stops = (): Stop[] => [
  {
    tab: null,
    title: tr("สรุปงานของคุณวันนี้", "Your day at a glance"),
    body: tr(
      "ดูความคืบหน้างานเยี่ยมบ้านและงานอนามัยโรงเรียนของวันนี้ได้ที่นี่ เลื่อนลงไปจะเจอภารกิจใหม่และภารกิจวันนี้",
      "Today's home visits and school health work, and how far along they are. Scroll down for new tasks to accept and today's tasks.",
    ),
  },
  {
    tab: 1,
    title: tr("แผนเยี่ยม", "Visit plan"),
    body: tr(
      "ดูตารางเยี่ยมบ้านเป็นรายเดือน รายสัปดาห์ หรือตามเวลา และดูงานที่เกินกำหนดได้ที่นี่",
      "See your visits by month, by week or by the hour, and pick out anything overdue.",
    ),
  },
  {
    tab: 2,
    title: tr("บริการ", "Services"),
    body: tr(
      "งานอื่นนอกจากเยี่ยมบ้านอยู่ที่นี่ เช่น ส่งเวชภัณฑ์และยา ติดตามสุขภาพ บ้านที่ดูแล และงานอนามัยโรงเรียน",
      "Everything beyond home visits: supplies and medication, health follow-up, households and school health.",
    ),
  },
  {
    tab: 3,
    title: tr("ฉัน", "Me"),
    body: tr(
      "ตั้งค่าการแสดงผล ภาษา และความปลอดภัยได้ที่นี่ ถ้าติดตรงไหนให้เปิดศูนย์ช่วยเหลือ ซึ่งเรียกคำแนะนำนี้ดูอีกครั้งได้ด้วย",
      "Display, language and security settings live here. If you get stuck, open the help center, where you can also replay this tour.",
    ),
  },
];

/**
 * The tour a carer gets on arriving at the home page: the page dims, one
 * thing at a time stays lit, and a note beside it says what it is for.
 *
 * In a Modal because the iOS tab bar is UIKit's and stands above every page,
 * so nothing drawn inside the page could dim it or point at it. Pressing
 * anywhere moves on, so a press on the lit tab does something rather than
 * nothing; the tab itself stays on Home.
 */
export function CoachMarks({ summary }: { summary: RefObject<View | null> }) {
  const due = useCoachDue();
  const focused = useIsFocused();
  const { width, height } = useWindowDimensions();
  const [at, setAt] = useState(0);
  const [card, setCard] = useState<Box | null>(null);

  // Measured again when the tablet turns, which moves the card.
  useEffect(() => {
    if (!due || !focused) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const again = () => {
      tries += 1;
      if (tries < 5) timer = setTimeout(look, 300);
    };
    const look = () => {
      const view = summary.current;
      if (view == null) {
        again();
        return;
      }
      view.measureInWindow((x, y, w, h) => {
        if (w > 0) setCard({ x, y, width: w, height: h });
        else again();
      });
    };
    timer = setTimeout(look, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [due, focused, width, height, summary]);

  if (!due || !focused || card == null) return null;

  const list = stops();
  const stop = list[at];
  const last = at === list.length - 1;

  const end = () => {
    finishCoach();
    setAt(0);
    setCard(null);
  };
  const next = () => {
    if (last) {
      feel("success");
      end();
    } else {
      feel("tick");
      setAt(at + 1);
    }
  };
  const skip = () => {
    feel("tick");
    end();
  };

  let hole: Hole;
  if (stop.tab == null) {
    hole = {
      x: card.x - HALO,
      y: card.y - HALO,
      width: card.width + HALO * 2,
      height: card.height + HALO * 2,
      radius: RADIUS.card + HALO,
    };
  } else {
    const slot = tabSlot(stop.tab, TAB_COUNT, { width, height });
    hole = { ...slot, radius: slot.height / 2 };
  }

  return (
    <Modal
      visible
      transparent
      animationType={currentDisplay().reduceMotion ? "none" : "fade"}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={skip}
    >
      <Pressable style={{ flex: 1 }} onPress={next} accessible={false}>
        <Spotlight hole={hole} reach={Math.ceil(Math.hypot(width, height))} />
        {/* A fresh note each stop, so it fades in with its own words. */}
        <Note
          key={at}
          stop={stop}
          step={at + 1}
          total={list.length}
          hole={hole}
          screen={{ width, height }}
          onNext={next}
          onSkip={last ? null : skip}
        />
      </Pressable>
    </Modal>
  );
}

/**
 * The dim, with the lit area as the hole in it: a view whose border runs past
 * every corner of the screen, so what is inside the border is what stays lit.
 * Its corners are the rounded edge of the hole, and it glides from one stop to
 * the next, neither of which four dimmed rectangles around the target can do.
 */
function Spotlight({ hole, reach }: { hole: Hole; reach: number }) {
  const x = useSharedValue(hole.x);
  const y = useSharedValue(hole.y);
  const w = useSharedValue(hole.width);
  const h = useSharedValue(hole.height);
  const r = useSharedValue(hole.radius);

  useEffect(() => {
    const still = currentDisplay().reduceMotion;
    const glide = (to: number) =>
      still
        ? to
        : withTiming(to, {
            duration: GLIDE_MS,
            easing: Easing.bezier(0.2, 0.8, 0.2, 1),
          });
    x.value = glide(hole.x);
    y.value = glide(hole.y);
    w.value = glide(hole.width);
    h.value = glide(hole.height);
    r.value = glide(hole.radius);
  }, [hole.x, hole.y, hole.width, hole.height, hole.radius, x, y, w, h, r]);

  const dim = useAnimatedStyle(() => ({
    left: x.value - reach,
    top: y.value - reach,
    width: w.value + reach * 2,
    height: h.value + reach * 2,
    borderRadius: r.value + reach,
  }));
  const ring = useAnimatedStyle(() => ({
    left: x.value,
    top: y.value,
    width: w.value,
    height: h.value,
    borderRadius: r.value,
  }));

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          { position: "absolute", borderWidth: reach, borderColor: DIM },
          dim,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            borderWidth: 2,
            borderColor: "rgba(255,255,255,0.9)",
          },
          ring,
        ]}
      />
    </>
  );
}

/**
 * What the lit thing is for, on whichever side of it has the room.
 *
 * Plain filled buttons rather than the app's glass ones: the note fades, and
 * glass refuses to draw its material under an alpha below 1.
 */
function Note({
  stop,
  step,
  total,
  hole,
  screen,
  onNext,
  onSkip,
}: {
  stop: Stop;
  step: number;
  total: number;
  hole: Hole;
  screen: { width: number; height: number };
  onNext: () => void;
  onSkip: (() => void) | null;
}) {
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.value = currentDisplay().reduceMotion
      ? 1
      : withDelay(GLIDE_MS / 2, withTiming(1, { duration: 200 }));
  }, [shown]);
  const fade = useAnimatedStyle(() => ({ opacity: shown.value }));

  const noteWidth = Math.min(screen.width - GUTTER * 2, NOTE_MAX);
  const centre = hole.x + hole.width / 2;
  const left = Math.min(
    Math.max(centre - noteWidth / 2, GUTTER),
    screen.width - GUTTER - noteWidth,
  );
  const under = hole.y + hole.height / 2 < screen.height / 2;
  const pointLeft = Math.min(
    Math.max(centre - left - POINT / 2, RADIUS.card),
    noteWidth - RADIUS.card - POINT,
  );

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left,
          width: noteWidth,
          ...(under
            ? { top: hole.y + hole.height + NOTE_GAP }
            : { bottom: screen.height - hole.y + NOTE_GAP }),
        },
        fade,
      ]}
    >
      <View
        style={{
          position: "absolute",
          left: pointLeft,
          width: POINT,
          height: POINT,
          borderRadius: 3,
          backgroundColor: SURFACE,
          transform: [{ rotate: "45deg" }],
          ...(under ? { top: -POINT / 2 + 1 } : { bottom: -POINT / 2 + 1 }),
        }}
      />
      <View
        style={{
          backgroundColor: SURFACE,
          borderRadius: RADIUS.card,
          padding: SPACE.lg,
          gap: SPACE.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
          <Text
            accessibilityRole="header"
            style={{ flex: 1, fontSize: 18, fontWeight: "700", color: TEXT_PRIMARY }}
          >
            {stop.title}
          </Text>
          <Text
            accessibilityLabel={tr(`ขั้นที่ ${step} จาก ${total}`, `Step ${step} of ${total}`)}
            style={{ fontSize: 13, color: TEXT_MUTED, fontVariant: ["tabular-nums"] }}
          >
            {`${step}/${total}`}
          </Text>
        </View>
        <Text style={{ fontSize: 15, lineHeight: 23, color: TEXT_SECONDARY }}>
          {stop.body}
        </Text>
        <View style={{ flexDirection: "row", gap: SPACE.sm, marginTop: SPACE.sm }}>
          {onSkip != null && (
            <NoteButton label={tr("ข้าม", "Skip")} onPress={onSkip} />
          )}
          <NoteButton
            primary
            label={onSkip == null ? tr("เริ่มใช้งาน", "Get started") : tr("ถัดไป", "Next")}
            onPress={onNext}
          />
        </View>
      </View>
    </Animated.View>
  );
}

function NoteButton({
  label,
  primary = false,
  onPress,
}: {
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        height: TOUCH_MIN,
        borderRadius: RADIUS.capsule,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: primary ? PRIMARY_500 : GROUPED_BG,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text
        numberOfLines={1}
        style={{
          fontSize: 16,
          fontWeight: "600",
          color: primary ? "#FFFFFF" : TEXT_SECONDARY,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
