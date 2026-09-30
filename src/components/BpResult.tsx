import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Check, Heart } from "lucide-react-native";

import { Card } from "./Card";
import { bpGroupOf, GROUP_LABEL, type Group } from "../models/screening35";
import { currentDisplay } from "../models/display";
import { tr } from "../i18n";
import {
  DANGER,
  RADIUS,
  SEPARATOR,
  SPACE,
  SUCCESS,
  TEXT_MUTED,
  TEXT_PRIMARY,
  WARNING,
} from "../theme/tokens";

const TONE: Record<Group, string> = {
  normal: SUCCESS,
  risk: WARNING,
  suspect: DANGER,
};

/** The gauge's span of systolic pressure, and where its bands change. */
const LOW = 90;
const HIGH = 180;
const BANDS: { to: number; group: Group }[] = [
  { to: 120, group: "normal" },
  { to: 140, group: "risk" },
  { to: HIGH, group: "suspect" },
];

/**
 * A figure that counts up to `to` as it arrives, easing into place, rather
 * than appearing all at once — the reading coming in, not a label.
 */
function useCountUp(to: number, delay: number) {
  const still = currentDisplay().reduceMotion;
  const [shown, setShown] = useState(still ? to : 0);
  useEffect(() => {
    if (still) {
      setShown(to);
      return;
    }
    let frame = 0;
    const start = Date.now() + delay;
    const tick = () => {
      const k = Math.min(1, Math.max(0, (Date.now() - start) / 900));
      setShown(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, delay, still]);
  return shown;
}

/** A heart beating at the pulse it shows. */
function Beat({ pulse }: { pulse: number }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (currentDisplay().reduceMotion || pulse <= 0) return;
    const beat = 60000 / pulse;
    scale.value = withRepeat(
      withSequence(
        withTiming(1.22, {
          duration: beat * 0.14,
          easing: Easing.out(Easing.quad),
        }),
        withTiming(1, { duration: beat * 0.2, easing: Easing.in(Easing.quad) }),
        withTiming(1, { duration: beat * 0.66 }),
      ),
      -1,
    );
  }, [pulse, scale]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View style={style}>
      <Heart size={22} color={DANGER} fill={DANGER} strokeWidth={0} />
    </Animated.View>
  );
}

/**
 * A cuff's result, as it is read: the two pressures large, systolic over
 * diastolic, with the Ministry's grouping above them in its colour and the
 * pulse beside them, a heart beating at its rate; a gauge placing the
 * systolic among the bands; and where it came from. The figures count up
 * as the card comes in.
 *
 * Kept short enough to sit with the monitor over it and the tray under it
 * on one screen, so the reading is seen whole without scrolling.
 */
export function BpResult({
  sys,
  dia,
  pulse,
  source,
}: {
  sys: number;
  dia: number;
  pulse: number | null;
  /** The instrument's name. */
  source: string;
}) {
  const group = bpGroupOf(sys, dia);
  const tone = TONE[group];
  const s = useCountUp(sys, 250);
  const d = useCountUp(dia, 350);
  const p = useCountUp(pulse ?? 0, 450);

  const [track, setTrack] = useState(0);
  const at = Math.min(1, Math.max(0, (sys - LOW) / (HIGH - LOW)));
  const slide = useSharedValue(0);
  useEffect(() => {
    slide.value = currentDisplay().reduceMotion
      ? at
      : withDelay(
          250,
          withTiming(at, { duration: 900, easing: Easing.out(Easing.cubic) }),
        );
  }, [at, slide]);
  const marker = useAnimatedStyle(() => ({
    transform: [{ translateX: slide.value * track - 8 }],
  }));

  const big = {
    fontSize: 46,
    lineHeight: 52,
    fontWeight: "800" as const,
    color: TEXT_PRIMARY,
    fontVariant: ["tabular-nums" as const],
    letterSpacing: -1,
  };

  return (
    <Animated.View entering={FadeInDown.duration(450).delay(150)}>
      <Card>
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}
        >
          <Text
            style={{
              flex: 1,
              fontSize: 14,
              lineHeight: 20,
              fontWeight: "600",
              color: TEXT_MUTED,
            }}
          >
            {tr("ความดันโลหิต", "Blood pressure")}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: SPACE.md,
              paddingVertical: 5,
              borderRadius: RADIUS.capsule,
              backgroundColor: `${tone}1A`,
            }}
          >
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: tone,
              }}
            />
            <Text style={{ fontSize: 12, fontWeight: "700", color: tone }}>
              {GROUP_LABEL[group]}
            </Text>
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "flex-end",
            justifyContent: "space-between",
            columnGap: SPACE.lg,
            rowGap: SPACE.sm,
            marginTop: SPACE.xs,
          }}
        >
          <View>
            <View style={{ flexDirection: "row", alignItems: "baseline" }}>
              <Text style={big}>{s}</Text>
              <Text
                style={{
                  ...big,
                  fontWeight: "300",
                  color: TEXT_MUTED,
                  marginHorizontal: 3,
                }}
              >
                /
              </Text>
              <Text style={big}>{d}</Text>
              <Text
                style={{
                  marginLeft: SPACE.sm,
                  fontSize: 15,
                  fontWeight: "600",
                  color: TEXT_MUTED,
                }}
              >
                mmHg
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: SPACE.xl }}>
              <Text style={{ fontSize: 12, color: TEXT_MUTED }}>
                {tr("ตัวบน · SYS", "Systolic")}
              </Text>
              <Text style={{ fontSize: 12, color: TEXT_MUTED }}>
                {tr("ตัวล่าง · DIA", "Diastolic")}
              </Text>
            </View>
          </View>
          {/* The pulse, beside the pressures rather than under them. */}
          {pulse != null && (
            <View style={{ alignItems: "flex-end" }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACE.sm,
                }}
              >
                <Beat pulse={pulse} />
                <Text
                  style={{
                    fontSize: 32,
                    lineHeight: 38,
                    fontWeight: "800",
                    color: TEXT_PRIMARY,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {p}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: TEXT_MUTED }}>
                {tr("ชีพจร · ครั้ง/นาที", "Pulse · bpm")}
              </Text>
            </View>
          )}
        </View>

        {/* Where the systolic falls: normal, at risk, suspected. */}
        <View style={{ marginTop: SPACE.md }}>
          <View
            onLayout={(e) => setTrack(e.nativeEvent.layout.width)}
            style={{ flexDirection: "row", height: 8, gap: 3 }}
          >
            {BANDS.map((b, i) => {
              const from = i === 0 ? LOW : BANDS[i - 1].to;
              return (
                <View
                  key={b.group}
                  style={{
                    flex: b.to - from,
                    borderRadius: 4,
                    backgroundColor: TONE[b.group],
                    opacity: b.group === group ? 1 : 0.28,
                  }}
                />
              );
            })}
          </View>
          {track > 0 && (
            <Animated.View
              style={[
                {
                  position: "absolute",
                  top: -4,
                  left: 0,
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: "#FFFFFF",
                  borderWidth: 3,
                  borderColor: tone,
                  shadowColor: "#000",
                  shadowOpacity: 0.18,
                  shadowRadius: 3,
                  shadowOffset: { width: 0, height: 1 },
                },
                marker,
              ]}
            />
          )}
          <View style={{ flexDirection: "row", marginTop: 6 }}>
            {[LOW, 120, 140, HIGH].map((v, i) => (
              <Text
                key={v}
                style={{
                  position: i === 0 ? "relative" : "absolute",
                  left:
                    i === 0
                      ? 0
                      : ((v - LOW) / (HIGH - LOW)) * track -
                        (i === 3 ? 22 : 11),
                  fontSize: 11,
                  color: TEXT_MUTED,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {v}
              </Text>
            ))}
          </View>
        </View>

        {/* Read, and from which instrument. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginTop: SPACE.md,
            paddingTop: SPACE.md,
            borderTopWidth: 1,
            borderTopColor: SEPARATOR,
          }}
        >
          <Check size={14} color={SUCCESS} strokeWidth={2.8} />
          <Text style={{ fontSize: 12, fontWeight: "600", color: SUCCESS }}>
            {tr("อ่านค่าสำเร็จ", "Reading complete")}
          </Text>
          <Text
            numberOfLines={1}
            style={{ flexShrink: 1, fontSize: 12, color: TEXT_MUTED }}
          >
            {tr(`· จาก ${source}`, `· from ${source}`)}
          </Text>
        </View>
      </Card>
    </Animated.View>
  );
}
