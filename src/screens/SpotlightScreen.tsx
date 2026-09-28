/**
 * Spotlight — one field over everything the app holds.
 *
 * Presented over whatever screen called it, not pushed beside it: the blurred
 * page stays visible underneath, so search reads as a layer you drop into and
 * out of rather than somewhere you navigated to. That is why the route is a
 * transparent modal and the backdrop is a real blur of the page behind, not a
 * flat scrim.
 *
 * The index itself lives in `models/spotlight` — this file only draws it and
 * turns a hit's `target` into a route.
 */
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BlurView } from "expo-blur";
import { CalendarCheck, ClipboardList, History, Home, LayoutGrid, MapPin, Search, Settings, User } from "lucide-react-native";

import { Chevron } from "../components/Chevron";
import { SearchField } from "../components/SearchField";
import { PressableScale } from "../components/PressableScale";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  forgetSpots,
  recentSpots,
  rememberSpot,
  searchEverything,
  spotCount,
  SPOT_SHORTCUTS,
  type SpotHit,
  type SpotKind,
} from "../models/spotlight";
import {
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  SURFACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Glyph = React.ComponentType<{ size?: number; color?: string }>;

/** The mark and the colour each kind of hit carries in the list. */
const KIND_FACE: Record<SpotKind, { icon: Glyph; tint: string }> = {
  visit: { icon: CalendarCheck, tint: PRIMARY_500 },
  posting: { icon: ClipboardList, tint: "#F59E0B" },
  resident: { icon: User, tint: "#7C6BF5" },
  house: { icon: Home, tint: "#1D8B6B" },
  village: { icon: MapPin, tint: "#EC4899" },
  service: { icon: LayoutGrid, tint: "#0EA5E9" },
  setting: { icon: Settings, tint: "#64748B" },
};

export function SpotlightScreen() {
  const [query, setQuery] = useState("");
  const [, setTick] = useState(0);
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();

  const groups = searchEverything(query);
  const found = spotCount(groups);
  const searching = query.trim().length > 0;
  const recents = recentSpots();

  /**
   * Close first, then go.
   *
   * Dismissing and navigating in the same tick lets the two animations run as
   * one movement; waiting for the modal to finish first shows the caller's
   * screen for a beat before the destination arrives on top of it.
   */
  const open = (hit: SpotHit) => {
    rememberSpot(hit);
    const t = hit.target;
    nav.goBack();
    if (t.go === "none") toast(t.message);
    else if (t.go === "tab") nav.navigate("Main", { screen: t.tab });
    // A hit's route and params are only known at runtime, so the union of
    // every screen's params cannot be narrowed here. Cast the call, not the
    // arguments: `as never` on each argument makes the pair itself unassignable.
    else (nav.navigate as (route: string, params?: object) => void)(t.route, t.params);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* The page behind, blurred. Tapping it is the way out — the same
          gesture that dismisses Spotlight itself. */}
      <Pressable
        onPress={() => nav.goBack()}
        accessibilityRole="button"
        accessibilityLabel="ปิดการค้นหา"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <BlurView
          intensity={40}
          tint="systemThickMaterialLight"
          style={{ flex: 1 }}
        />
      </Pressable>

      <View
        style={{
          flex: 1,
          paddingTop: insets.top + SPACE.sm,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: SPACE.md,
            paddingHorizontal: SPACE.lg,
          }}
        >
          <View style={{ flex: 1 }}>
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder="ค้นหาทุกอย่างในแอพ"
              autoFocus
            />
          </View>
          <Pressable
            onPress={() => nav.goBack()}
            accessibilityRole="button"
            accessibilityLabel="ยกเลิกการค้นหา"
            hitSlop={8}
          >
            <Text style={{ fontSize: 16, color: PRIMARY_500 }}>ยกเลิก</Text>
          </Pressable>
        </View>

        <ScrollView
          keyboardDismissMode="on-drag"
          // A tap while the keyboard is up would otherwise be spent closing
          // it, leaving the row underneath unopened.
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: SPACE.lg,
            paddingTop: SPACE.xl,
            paddingBottom: insets.bottom + SPACE.huge,
            gap: SPACE.xl,
          }}
        >
          {!searching && recents.length > 0 && (
            <Group
              label="ค้นหาล่าสุด"
              trailing={
                <Pressable
                  onPress={() => {
                    forgetSpots();
                    // Recents live outside React, so nothing would re-render
                    // on its own once the list is cleared.
                    setTick((n) => n + 1);
                    toast("ล้างการค้นหาล่าสุดแล้ว", "success");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="ล้างการค้นหาล่าสุด"
                  hitSlop={8}
                >
                  <Text style={{ fontSize: 12, color: PRIMARY_500 }}>ล้าง</Text>
                </Pressable>
              }
            >
              {recents.map((h, i) => (
                <Row
                  key={h.id}
                  hit={h}
                  first={i === 0}
                  onPress={() => open(h)}
                  recent
                />
              ))}
            </Group>
          )}

          {!searching && (
            <Group label="ทางลัด">
              {SPOT_SHORTCUTS.map((h, i) => (
                <Row key={h.id} hit={h} first={i === 0} onPress={() => open(h)} />
              ))}
            </Group>
          )}

          {searching && found === 0 && (
            <View style={{ alignItems: "center", paddingTop: SPACE.huge, gap: SPACE.md }}>
              <Search size={32} color={TEXT_MUTED} />
              <Text style={{ fontSize: 16, fontWeight: "600", color: TEXT_PRIMARY }}>
                ไม่พบผลลัพธ์
              </Text>
              <Text style={{ fontSize: 12, color: TEXT_MUTED, textAlign: "center" }}>
                {`ไม่พบ "${query.trim()}" ในภารกิจ ผู้ป่วย บ้าน หรือบริการ`}
              </Text>
            </View>
          )}

          {groups.map((g) => (
            <Group
              key={g.kind}
              label={g.label}
              trailing={
                g.total > g.hits.length ? (
                  <Text style={{ fontSize: 12, color: TEXT_MUTED }}>
                    {`+${g.total - g.hits.length}`}
                  </Text>
                ) : undefined
              }
            >
              {g.hits.map((h, i) => (
                <Row key={h.id} hit={h} first={i === 0} onPress={() => open(h)} />
              ))}
            </Group>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

/** A titled block of rows on one white card. */
function Group({
  label,
  trailing,
  children,
}: {
  label: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: SPACE.sm }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: SPACE.xs,
        }}
      >
        <Text
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: "600",
            color: TEXT_MUTED,
          }}
        >
          {label}
        </Text>
        {trailing}
      </View>
      <View
        style={{
          backgroundColor: SURFACE,
          borderRadius: RADIUS.card,
          overflow: "hidden",
        }}
      >
        {children}
      </View>
    </View>
  );
}

function Row({
  hit,
  first,
  recent,
  onPress,
}: {
  hit: SpotHit;
  /** The first row in a card carries no rule above it. */
  first: boolean;
  /** Recents show the clock rather than what kind of thing they are. */
  recent?: boolean;
  onPress: () => void;
}) {
  const face = KIND_FACE[hit.kind];
  const Icon = recent ? History : face.icon;
  const tint = recent ? TEXT_MUTED : face.tint;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hit.title}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.md,
        paddingHorizontal: SPACE.lg,
        paddingVertical: SPACE.md,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: SEPARATOR,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: RADIUS.md,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: `${tint}1F`,
        }}
      >
        <Icon size={18} color={tint} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 16, fontWeight: "600", color: TEXT_PRIMARY }}
        >
          {hit.title}
        </Text>
        {hit.subtitle != null && (
          <Text
            numberOfLines={1}
            style={{ marginTop: 2, fontSize: 12, color: TEXT_MUTED }}
          >
            {hit.subtitle}
          </Text>
        )}
      </View>

      <Chevron />
    </PressableScale>
  );
}
