import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Clock, MapPin, Navigation, SkipForward } from "lucide-react-native";

import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { VisitCard } from "../components/VisitCard";
import { useClosedVisits } from "../models/closedVisits";
import {
  hasLocation,
  isDone,
  planToday,
  todayTasks,
  visitTypeLabel,
  type Task,
} from "../models/task";
import type { RootStackParamList } from "../navigation/RootStack";
import { openTask } from "../navigation/openTask";
import { tr } from "../i18n";
import { GUTTER, readable } from "../theme/layout";
import {
  GROUPED_BG,
  PRIMARY_100,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  SUCCESS,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme/tokens";
import { feel } from "../utils/haptics";
import { distanceLabel, durationLabel, openDirections } from "../utils/routing";
import { thaiTime } from "../utils/thaiDate";
import { useHere } from "../utils/useHere";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Straight-line metres between two points. */
function metresBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * "ออกเยี่ยมวันนี้" — the day's round, one house at a time.
 *
 * The home page lists today's visits; this walks them. It shows only the
 * next house, large — where, when, and the two things to do about it: get
 * directions, or start the visit. Closing that visit's case comes back here
 * with the next house already up, so a whole morning is a loop of the same
 * three presses. Ends on the day done.
 */
export function RoundScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { here } = useHere();
  // Re-read whenever a visit is closed.
  useClosedVisits();
  const all = todayTasks();
  const done = all.filter(isDone).length;
  // Houses put off for later today: still to do, just not now.
  const [later, setLater] = useState<string[]>([]);
  const open = all.filter((t) => !isDone(t));
  const queue = [
    ...open.filter((t) => !later.includes(t.id)),
    ...later.map((id) => open.find((t) => t.id === id)).filter((t): t is Task => t != null),
  ];
  const next = queue[0];
  const after = queue.slice(1);

  // An estimate, said as one: the straight line, a third longer for the
  // roads, at the 20 km/h a carer actually averages across town — 30 made
  // a kilometre two minutes, which nobody believed.
  const metres =
    next != null && hasLocation(next)
      ? metresBetween({ lat: here.latitude, lng: here.longitude }, { lat: next.lat as number, lng: next.lng as number }) * 1.3
      : null;
  const seconds = metres == null ? null : metres / (20 / 3.6);

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={tr("ออกเยี่ยมวันนี้", "Today's round")} />
      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            ...readable(),
            paddingHorizontal: GUTTER,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + SPACE.xxxl,
            gap: SPACE.md,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* How far through the day. */}
          <View style={{ gap: SPACE.sm }}>
            <View style={{ flexDirection: "row", alignItems: "baseline" }}>
              <Text style={{ flex: 1, fontSize: 15, color: TEXT_SECONDARY }}>
                {tr(`เยี่ยมแล้ว ${done} จาก ${all.length} บ้าน`, `${done} of ${all.length} visited`)}
              </Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: SEPARATOR, overflow: "hidden" }}>
              <View
                style={{
                  width: `${all.length === 0 ? 0 : (done / all.length) * 100}%`,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: next == null ? SUCCESS : PRIMARY_500,
                }}
              />
            </View>
          </View>

          {next == null ? (
            <EmptyState
              art={require("../../assets/images/house_family.png")}
              artSize={160}
              title={tr("เยี่ยมครบทุกบ้านแล้ว", "Every house visited")}
              detail={tr("เก่งมาก วันนี้ไม่มีบ้านที่ต้องไปแล้ว", "Well done. Nothing left on today's round")}
            />
          ) : (
            <Card style={{ gap: SPACE.lg }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
                <View
                  style={{
                    paddingHorizontal: SPACE.sm,
                    paddingVertical: 2,
                    borderRadius: RADIUS.capsule,
                    backgroundColor: PRIMARY_100,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: PRIMARY_500 }}>
                    {tr(`บ้านถัดไป · ${done + 1}/${all.length}`, `Next · ${done + 1}/${all.length}`)}
                  </Text>
                </View>
                <View style={{ flex: 1 }} />
                <Clock size={15} color={TEXT_MUTED} strokeWidth={2.2} />
                <Text style={{ fontSize: 14, color: TEXT_SECONDARY }}>{thaiTime(next.dueAt)}</Text>
              </View>

              <View style={{ gap: 2 }}>
                <Text style={{ fontSize: 24, lineHeight: 34, fontWeight: "800", color: TEXT_PRIMARY }}>
                  {next.name}
                </Text>
                <Text style={{ fontSize: 14, lineHeight: 21, color: PRIMARY_500, fontWeight: "600" }}>
                  {next.visitType != null ? visitTypeLabel(next.visitType) : ""}
                </Text>
                <Text style={{ fontSize: 14, lineHeight: 21, color: TEXT_SECONDARY }}>{next.detail}</Text>
              </View>

              {next.address != null && (
                <View style={{ flexDirection: "row", gap: SPACE.sm }}>
                  <MapPin size={16} color={TEXT_MUTED} strokeWidth={2.2} style={{ marginTop: 3 }} />
                  <Text style={{ flex: 1, fontSize: 14, lineHeight: 21, color: TEXT_SECONDARY }}>
                    {next.address}
                    {metres != null && seconds != null
                      ? tr(
                          `\nประมาณ ${distanceLabel(metres)} · ${durationLabel(seconds)}`,
                          `\nAbout ${distanceLabel(metres)} · ${durationLabel(seconds)}`,
                        )
                      : ""}
                  </Text>
                </View>
              )}

              <View style={{ flexDirection: "row", gap: SPACE.sm }}>
                {hasLocation(next) && (
                  <RoundButton
                    label={tr("นำทาง", "Directions")}
                    icon={<Navigation size={17} color={PRIMARY_500} strokeWidth={2.4} />}
                    onPress={() =>
                      openDirections({ lat: next.lat as number, lng: next.lng as number }, next.name)
                    }
                  />
                )}
                <RoundButton
                  primary
                  label={tr("เริ่มเยี่ยม", "Start visit")}
                  onPress={() => {
                    feel("tick");
                    openTask(nav, next);
                  }}
                />
              </View>

              {after.length > 0 && (
                <Pressable
                  onPress={() => {
                    feel("tick");
                    setLater((l) => [...l.filter((id) => id !== next.id), next.id]);
                  }}
                  accessibilityRole="button"
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.xs }}
                >
                  <SkipForward size={15} color={TEXT_MUTED} strokeWidth={2.2} />
                  <Text style={{ fontSize: 14, fontWeight: "600", color: TEXT_MUTED }}>
                    {tr("ไปบ้านถัดไปก่อน แล้วค่อยกลับมาบ้านนี้", "Do the next house first, come back to this one")}
                  </Text>
                </Pressable>
              )}
            </Card>
          )}

          {after.length > 0 && (
            <>
              <Text style={{ marginTop: SPACE.md, fontSize: 16, fontWeight: "600", color: TEXT_PRIMARY }}>
                {tr(`ต่อจากนี้ ${after.length} บ้าน`, `${after.length} more after this`)}
              </Text>
              {after.map((t) => (
                <VisitCard key={t.id} task={t} now={planToday} onPress={() => openTask(nav, t)} />
              ))}
            </>
          )}
        </ScrollView>
      </HeaderFade>
    </View>
  );
}

function RoundButton({
  label,
  icon,
  primary = false,
  onPress,
}: {
  label: string;
  icon?: ReactNode;
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
        height: 48,
        borderRadius: RADIUS.capsule,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: SPACE.sm,
        backgroundColor: primary ? PRIMARY_500 : GROUPED_BG,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {icon}
      <Text style={{ fontSize: 16, fontWeight: "700", color: primary ? "#FFFFFF" : PRIMARY_500 }}>{label}</Text>
    </Pressable>
  );
}
