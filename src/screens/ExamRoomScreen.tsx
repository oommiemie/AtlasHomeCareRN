import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Activity, Baby, Brain, Gauge, HandHeart, HeartPulse, Scissors, Stethoscope, Wind, type LucideIcon } from "lucide-react-native";

import { Chevron } from "../components/Chevron";
import { Avatar } from "../components/Avatar";
import { Card } from "../components/Card";
import { SearchListScreen } from "../components/SearchListScreen";
import type { RootStackParamList } from "../navigation/RootStack";
import { EXAM_ROOMS, type ExamRoomKey } from "../models/community";
import { tr } from "../i18n";
import {
  PRIMARY_100,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Figma 94:11552's own measurements. */
const D = {
  /** The gap between the page's blocks, and between rows. */
  gap: 10,
  /** The card holder's disc. */
  avatar: 32,
  /** A row's mark: the disc, and the glyph in it. */
  disc: 36,
  glyph: 18,
} as const;

/**
 * A mark for each door.
 *
 * Nine names in the same weight are nine lines to read; a glyph beside each
 * is the thing you find it by the second time. Presentation, so it lives
 * here and not in the model — the list of rooms is the hospital's, the
 * pictures are ours.
 */
const MARK: Record<ExamRoomKey, LucideIcon> = {
  r1: Stethoscope,
  r2: Wind,
  r3: Activity,
  r4: Gauge,
  r5: HeartPulse,
  r6: Scissors,
  r7: Baby,
  r8: HandHeart,
  r9: Brain,
};

/**
 * Which room this patient is being sent to — Figma 94:11552.
 *
 * Two cards under the header. The first is who the card turned out to be:
 * the carer has just read a stranger's card, and before they send anyone
 * anywhere they want to see it read the right person. The second is the
 * doors, as the hospital names them, one to a row.
 *
 * The search is in the header, on the app's searchable-list frame, and not
 * inside the list card where the design draws it. Drawn there it had to be
 * a grey fill — glass on a white card has nothing behind it to refract and
 * disappears — and a grey box beside every other screen's glass field read
 * as a different control. Up on the wash it is the same piece of glass the
 * register and the house list carry, collapsing into the title row as the
 * list moves, exactly as theirs do.
 */
export function ExamRoomScreen() {
  const { holder } = useRoute<RouteProp<RootStackParamList, "ExamRoom">>().params;
  const nav = useNavigation<Nav>();
  const [query, setQuery] = useState("");

  const rooms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return EXAM_ROOMS;
    return EXAM_ROOMS.filter((r) => r.name.toLowerCase().includes(q));
  }, [query]);

  return (
    <SearchListScreen
      title={tr("เลือกห้องตรวจ", "Choose exam room")}
      query={query}
      onQuery={setQuery}
      placeholder={tr("ค้นหาห้องตรวจ", "Search exam rooms")}
    >
      {/* Frame 259: the card holder. */}
      <Card elevated style={{ gap: D.gap }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
          <Avatar size={D.avatar} initial={holder.name[0] ?? "?"} />
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              fontSize: 14,
              lineHeight: 18,
              fontWeight: "600",
              color: TEXT_PRIMARY,
            }}
          >
            {tr(`คุณ ${holder.name}`, holder.name)}
          </Text>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: RADIUS.capsule,
              backgroundColor: PRIMARY_100,
            }}
          >
            <Text style={{ fontSize: 10, lineHeight: 13, fontWeight: "500", color: PRIMARY_500 }}>
              {tr(`${holder.age} ปี`, `${holder.age} yrs`)}
            </Text>
          </View>
        </View>
        {/* The thirteen digits as the design shows them: unbroken. */}
        <Text style={{ fontSize: 12, lineHeight: 20, color: TEXT_MUTED }}>
          {holder.citizenId}
        </Text>
      </Card>

      <Text
        style={{
          marginTop: SPACE.lg,
          marginBottom: D.gap,
          fontSize: 16,
          lineHeight: 21,
          fontWeight: "500",
          color: TEXT_PRIMARY,
        }}
      >
        {tr("ห้องตรวจ", "Exam rooms")}
      </Text>

      {rooms.length === 0 ? (
        <Text
          style={{
            marginTop: SPACE.xl,
            textAlign: "center",
            fontSize: 14,
            color: TEXT_MUTED,
          }}
        >
          {tr(
            `ไม่พบห้องตรวจที่ตรงกับ "${query.trim()}"`,
            `No exam rooms match "${query.trim()}"`,
          )}
        </Text>
      ) : (
        /* One card, the rows ruled inside it. */
        <Card padded={false}>
          {rooms.map((room, i) => {
            const Mark = MARK[room.key];
            return (
              <Pressable
                key={room.key}
                onPress={() => nav.replace("CommunityPatient", { holder, room: room.key })}
                accessibilityRole="button"
                accessibilityLabel={room.name}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACE.md,
                  paddingVertical: SPACE.md,
                  paddingHorizontal: SPACE.lg,
                  backgroundColor: pressed ? "rgba(7,125,215,0.06)" : "transparent",
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: SEPARATOR,
                })}
              >
                <View
                  style={{
                    width: D.disc,
                    height: D.disc,
                    borderRadius: D.disc / 2,
                    backgroundColor: PRIMARY_100,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Mark size={D.glyph} color={PRIMARY_500} strokeWidth={2} />
                </View>
                <Text
                  numberOfLines={2}
                  style={{
                    flex: 1,
                    fontSize: 14,
                    lineHeight: 18,
                    fontWeight: "600",
                    color: TEXT_PRIMARY,
                  }}
                >
                  {room.name}
                </Text>
                <Chevron />
              </Pressable>
            );
          })}
        </Card>
      )}
    </SearchListScreen>
  );
}
