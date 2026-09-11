import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import MapView, { PROVIDER_DEFAULT } from "react-native-maps";
import {
  Bell,
  Calendar,
  Check,
  Clock,
  List as ListIcon,
  Search,
  SlidersHorizontal,
  User,
} from "lucide-react-native";

import { useHere } from "../utils/useHere";
import { useTabBarInset } from "../utils/useTabBarInset";
import { Glass } from "../components/Glass";
import { Card } from "../components/Card";
import { FilterSelect, type FilterOption } from "../components/FilterSelect";
import { LivingGradient } from "../components/LivingGradient";
import { ProgressRing } from "../components/ProgressRing";
import { PressableScale } from "../components/PressableScale";
import { SectionHeader } from "../components/SectionHeader";
import { TaskPostingCard, POSTING_CARD_HEIGHT } from "../components/TaskPostingCard";
import { GlassIconButton } from "../components/GlassIconButton";
import { ToolbarPill } from "../components/ToolbarPill";
import { UIcon } from "../components/UIcon";
import { VisitCard } from "../components/VisitCard";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  CAROUSEL_LIMIT,
  matchesFilter,
  outstandingFirst,
  planToday,
  sampleTasks,
  todayTasks,
  TASK_FILTER_LABEL,
  type TaskFilter,
} from "../models/task";
import { thaiShortDate } from "../utils/thaiDate";
import {
  RADIUS,
  SPACE,
  SURFACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * The greeting uses the given name alone.
 *
 * A surname in a hello reads as an announcement rather than a greeting, and
 * the line already competes for width with the toolbar pill beside it. The
 * profile page still carries the full name, which is where it belongs.
 */
const CARER_GIVEN_NAME = "สุขภาพดี";

/** "วันนี้" — the carer's day at a glance. */
export function HomeScreen() {
  const [filter, setFilter] = useState<TaskFilter>("all");
  const { here } = useHere();

  const insets = useSafeAreaInsets();
  const tabBar = useTabBarInset();
  const nav = useNavigation<Nav>();
  const { width } = useWindowDimensions();

  const all = outstandingFirst(todayTasks());
  const shown = all.filter((t) => matchesFilter(t, filter, planToday));
  const done = all.filter((t) => t.status === "done").length;

  const postings = sampleTasks.slice(0, CAROUSEL_LIMIT);
  const pageWidth = width * 0.88;

  return (
    <View style={{ flex: 1 }}>
      <LivingGradient height={288} />

      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + SPACE.sm, paddingBottom: 0 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting. The right inset clears the toolbar pill. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingLeft: SPACE.lg,
            // Clears the pill and the assistant button beside it.
            paddingRight: 188,
          }}
        >
          {/*
            The carer's own photograph, in a glass ring.

            The picture fills the circle and the material sits around it as a
            rim — a tinted glass disc over a photograph would just veil the
            face it is there to show.
          */}
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              borderWidth: 2,
              borderColor: "rgba(255,255,255,0.85)",
              // No clipping here. A border and `overflow: hidden` on the
              // same box put the photograph over its own ring — the image
              // fills to the outer edge and the stroke is drawn under it,
              // so the ring came out cut. The clip lives one layer in.
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                overflow: "hidden",
              }}
            >
              <Image
                source={require("../../assets/images/user_avatar.png")}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            </View>
          </View>
          <View style={{ flex: 1, marginLeft: SPACE.md }}>
            <Text numberOfLines={1} style={{ fontSize: 14, color: "#FFFFFF" }}>
              รพ.บางกอก เมดิคอล เทคโนโลยี
            </Text>
            <Text
              numberOfLines={1}
              style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}
            >
              {`สวัสดี, คุณ${CARER_GIVEN_NAME}`}
            </Text>
          </View>
        </View>

        <View style={{ height: SPACE.lg }} />

        {/* The day's progress, and the counts behind it. */}
        <Card
          style={{
            marginHorizontal: SPACE.lg,
            padding: SPACE.xl,
            shadowColor: "#004078",
            shadowOpacity: 0.14,
            shadowRadius: 28,
            shadowOffset: { width: 0, height: 12 },
            elevation: 6,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.lg }}>
            <View style={{ flex: 1, alignItems: "center" }}>
              <ProgressRing done={done} total={all.length} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: TEXT_PRIMARY }}>
                สรุปงานของคุณวันนี้
              </Text>
              <Text style={{ fontSize: 13, color: "#8A8F97" }}>
                {thaiShortDate(planToday)}
              </Text>
              <View
                style={{
                  height: 1,
                  backgroundColor: "#EDEDED",
                  marginVertical: SPACE.md,
                }}
              />
              <StatRow label="งานทั้งหมด" value={all.length} />
              <StatRow label="กำลังจะทำ" value={all.length - done} />
              <StatRow label="เสร็จสิ้นแล้ว!" value={done} />
            </View>
          </View>
        </Card>

        <View style={{ height: SPACE.xxl }} />

        {/* Open postings. */}
        <SectionHeader
          title="ภารกิจใหม่รอรับงาน"
          count={sampleTasks.length}
          trailingLabel="เพิ่มเติม"
          onTrailing={() => nav.navigate("TaskList")}
        />
        <View style={{ height: SPACE.md }} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={pageWidth}
          decelerationRate="fast"
          contentContainerStyle={{ paddingLeft: SPACE.lg }}
        >
          {postings.map((t, i) => {
            const open = () => nav.navigate("AcceptTask", { task: t });
            return (
              <View
                key={t.id}
                style={{
                  width: pageWidth - SPACE.lg,
                  height: POSTING_CARD_HEIGHT,
                  marginRight: i === postings.length - 1 ? SPACE.lg : SPACE.md,
                }}
              >
                <TaskPostingCard task={t} onPress={open} onAccept={open} />
              </View>
            );
          })}
        </ScrollView>

        <View style={{ height: SPACE.xxl }} />

        {/* Today's accepted work, on a frosted sheet. */}
        <View
          style={{
            backgroundColor: "rgba(245,247,250,0.96)",
            borderTopLeftRadius: 36,
            borderTopRightRadius: 36,
            borderTopWidth: 1,
            borderTopColor: "rgba(255,255,255,0.55)",
            padding: SPACE.lg,
            paddingBottom: tabBar + SPACE.xxxl,
          }}
        >
          {/*
            The filter sits where the section's arrow used to: it is what
            this heading actually offers, and an arrow that went nowhere in
            particular was taking the spot.

            The menu hangs from it, floated over the list rather than pushing
            it down, so picking a filter does not shove the cards you are
            looking at.
          */}
          <View style={{ zIndex: 10 }}>
            <SectionHeader
              title="ภารกิจวันนี้รอดำเนินการ"
              count={all.length}
              flush
              trailing={
                <FilterSelect
                  value={filter}
                  options={HOME_FILTERS}
                  onChange={setFilter}
                />
              }
            />
          </View>

          <View style={{ height: SPACE.md }} />
          <MapCard onPress={() => nav.navigate("ExploreMap")} here={here} />
          <View style={{ height: SPACE.md }} />

          {shown.length === 0 ? (
            <View
              style={{
                paddingVertical: SPACE.xxxl,
                alignItems: "center",
                backgroundColor: "#F1F3F6",
                borderRadius: RADIUS.card,
              }}
            >
              <Calendar size={28} color="#8A8F97" />
              <Text
                style={{
                  marginTop: SPACE.md,
                  fontSize: 14,
                  color: TEXT_SECONDARY,
                  textAlign: "center",
                }}
              >
                {filter === "all"
                  ? "วันนี้คุณไม่มีภารกิจที่ต้องทำ"
                  : `วันนี้ไม่มีภารกิจ"${TASK_FILTER_LABEL[filter]}"`}
              </Text>
            </View>
          ) : (
            <View style={{ gap: SPACE.md }}>
              {shown.map((t) => (
                <VisitCard
                  key={t.id}
                  task={t}
                  now={planToday}
                  onPress={() => nav.navigate("AcceptTask", { task: t })}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* The assistant on its own, beside the pill rather than inside it.
          Search and notifications are two ways of looking through what is
          already here; the assistant is a different kind of thing, and a
          third slot in the same capsule read as one more of them. */}
      <View
        style={{
          position: "absolute",
          top: insets.top + SPACE.sm,
          right: SPACE.lg,
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.sm,
        }}
      >
        <GlassIconButton
          onPress={() => toast("ผู้ช่วย AI ยังไม่เปิดใช้งาน")}
          accessibilityLabel="ผู้ช่วย AI"
        >
          <UIcon name="sparkles" size={20} color="#1A1A1A" />
        </GlassIconButton>

        <ToolbarPill
          slots={[
            {
              icon: <Search size={20} color="#1A1A1A" />,
              label: "ค้นหา",
              onPress: () => nav.navigate("Spotlight"),
            },
            {
              icon: <Bell size={20} color="#1A1A1A" />,
              label: "การแจ้งเตือน",
              onPress: () => toast("การแจ้งเตือนยังไม่เปิดใช้งาน"),
            },
          ]}
        />
      </View>
    </View>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACE.sm }}
    >
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: "#333333" }}>
        {label}
      </Text>
      <Text style={{ fontSize: 16, fontWeight: "800", color: "#111111" }}>{value}</Text>
    </View>
  );
}

/** The three states today's list can be narrowed to. */
const HOME_FILTERS: FilterOption<TaskFilter>[] = [
  { key: "all", label: "ทั้งหมด", Icon: ListIcon },
  { key: "pending", label: "รอดำเนินการ", Icon: Clock },
  { key: "done", label: "เสร็จแล้ว", Icon: Check },
];

/** How much ground the card shows, in degrees. */
const SPAN = 0.012;

/**
 * Where the user dot sits across the card, as a fraction of its width.
 *
 * 0.78 keeps it clearly in the right-hand third — past the white wash and
 * the label — with room left before the marker would touch the edge.
 */
const DOT_ACROSS = 0.78;

/** A glance at the day's map, washed out so the text stays legible. */
function MapCard({
  onPress,
  here,
}: {
  onPress: () => void;
  here: { latitude: number; longitude: number };
}) {
  // Handed down from the screen, so the fix is requested once rather than
  // once per component that wants it.
  // The card's own width, not the screen's: it sits inside the page padding.
  const [width, setWidth] = useState(0);

  return (
    // The shadow rides on a wrapper, not on the card: the card clips to its
    // rounded corners with overflow "hidden" so the map cannot spill out,
    // and that would cut its own shadow away with it.
    //
    // Same values as an elevated VisitCard, so the two sit on one plane.
    <View
      style={{
        borderRadius: RADIUS.card,
        shadowColor: "#000000",
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      }}
    >
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="สำรวจพื้นที่เยี่ยมบ้าน"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{
        height: 100,
        borderRadius: RADIUS.card,
        overflow: "hidden",
        backgroundColor: SURFACE,
      }}
    >
      {/*
        A live map rather than a screenshot, centred on where you actually
        are: the card invites you to go and look at the area, so showing
        somebody else's streets undercut it.

        Non-interactive — the whole card is one button, and a map that
        panned under the finger would swallow the tap.
      */}
      <MapView
        provider={PROVIDER_DEFAULT}
        // Drawn wider than the card and overhanging the RIGHT edge, so the
        // map's centre — where the user dot sits — lands on the right of the
        // card, clear of the white wash and the label on the left.
        //
        // Overhanging the left does the opposite: the map then spans
        // [-N, W] and its centre falls at (W - N) / 2, which pushed the dot
        // to about a tenth across, straight under the text.
        //
        // Offsetting the region's longitude instead does almost nothing
        // here: MapKit fits the region to the shorter side, and this card is
        // 100pt tall against ~330 wide, so the visible longitude span comes
        // out roughly three times the one asked for and a fraction-of-span
        // nudge lands nowhere near where the arithmetic says.
        style={{
          position: "absolute",
          left: 0,
          // Solved from the measured width rather than guessed: the map
          // spans [0, W + overhang] so its centre is at (W + overhang) / 2,
          // and setting that equal to DOT_ACROSS * W gives the overhang.
          right: -width * (2 * DOT_ACROSS - 1),
          top: 0,
          bottom: 0,
        }}
        region={{
          ...here,
          latitudeDelta: SPAN,
          longitudeDelta: SPAN,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        pointerEvents="none"
      />
      <LinearGradient
        // Solid white across the front, then out to nothing.
        //
        // At 0.88 the leading edge was only near-white, so the map's streets
        // showed faintly through the label and the card read as smudged
        // rather than as text on paper. The ramp now holds full white to
        // just past the text and spends the rest of the width fading.
        colors={[
          "#FFFFFF",
          "#FFFFFF",
          "rgba(255,255,255,0.45)",
          "rgba(255,255,255,0)",
        ]}
        locations={[0, 0.46, 0.74, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: SPACE.lg }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#111111" }}>
          สำรวจพื้นที่เยี่ยมบ้าน
        </Text>
        <View
          style={{ flexDirection: "row", alignItems: "center", marginTop: SPACE.sm, gap: SPACE.sm }}
        >
          <Text style={{ fontSize: 14 }}>☀️</Text>
          <Text numberOfLines={2} style={{ flex: 1, fontSize: 12, color: TEXT_MUTED }}>
            วันนี้อากาศแจ่มใสเหมาะสำหรับทำภารกิจของคุณ
          </Text>
        </View>
      </View>
    </PressableScale>
    </View>
  );
}
