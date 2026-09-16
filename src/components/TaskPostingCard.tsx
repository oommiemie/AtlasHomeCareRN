import { Pressable, Text, View } from "react-native";

import { Chevron } from "./Chevron";
import { Glass } from "./Glass";
// Kept for the accept tab: it is a sibling of the glass avatar, not an
// ancestor, so its transform cannot blank the material.
import { PressableScale } from "./PressableScale";
import { initialOf, type Task } from "../models/task";
import { thaiDateTime } from "../utils/thaiDate";
import {
  PRIMARY_100,
  PRIMARY_500,
  RADIUS,
  SPACE,
  SURFACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";

/** The posting card's fixed height — the carousel sizes its page to this. */
export const POSTING_CARD_HEIGHT = 157;

const ORANGE = "#F97316";

/**
 * An open posting, shown in the home carousel and the "ภารกิจใหม่" list.
 *
 * The orange ground shows only as the deadline strip along the bottom: the
 * white sheet above covers the rest, so the deadline reads as part of the
 * card rather than a separate banner.
 */
export function TaskPostingCard({
  task,
  onPress,
  onAccept,
}: {
  task: Task;
  onPress?: () => void;
  onAccept?: () => void;
}) {
  return (
    // Plain Pressable: PressableScale's transform would blank the glass
    // avatar inside.
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={task.name}
      style={{
        height: POSTING_CARD_HEIGHT,
        borderRadius: RADIUS.card,
        backgroundColor: ORANGE,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          height: 120,
          backgroundColor: SURFACE,
          borderRadius: RADIUS.lg,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: SPACE.lg }}>
          <View style={{ marginLeft: SPACE.lg }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: "#0091FF",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#FFFFFF" }}>
                {initialOf(task)}
              </Text>
            </View>
          </View>
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              marginLeft: SPACE.sm,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                fontSize: 14,
                fontWeight: "600",
                color: TEXT_PRIMARY,
              }}
            >
              {task.name}
            </Text>
            <Glass
              tintColor="rgba(7,125,215,0.14)"
              style={{
                marginLeft: SPACE.xs,
                borderRadius: RADIUS.capsule,
                overflow: "hidden",
                paddingHorizontal: 9,
                paddingVertical: 3,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: "500", color: PRIMARY_500 }}>
                {task.age} ปี
              </Text>
            </Glass>
          </View>

          {/* Flush to the card's right edge, rounded on the left only — it
              reads as a tab pulled out of the sheet. */}
          <PressableScale
            onPress={onAccept}
            accessibilityRole="button"
            accessibilityLabel="รับงาน"
            style={{
              marginLeft: SPACE.sm,
              height: 32,
              flexDirection: "row",
              alignItems: "center",
              paddingLeft: SPACE.lg,
              paddingRight: SPACE.md,
              backgroundColor: SURFACE,
              borderTopLeftRadius: RADIUS.capsule,
              borderBottomLeftRadius: RADIUS.capsule,
              shadowColor: "#000000",
              shadowOpacity: 0.08,
              shadowRadius: 6,
              shadowOffset: { width: -1, height: 2 },
              elevation: 2,
            }}
          >
            <Text style={{ fontSize: 12, color: TEXT_PRIMARY }}>รับงาน</Text>
            <View style={{ marginLeft: SPACE.sm }}>
              <Chevron ink={ORANGE} />
            </View>
          </PressableScale>
        </View>

        <Text
          numberOfLines={2}
          style={{
            marginTop: SPACE.md,
            marginHorizontal: SPACE.lg,
            minHeight: 38,
            fontSize: 12,
            lineHeight: 18,
            color: TEXT_MUTED,
          }}
        >
          {task.detail}
        </Text>
      </View>

      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: SPACE.lg }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 12, fontWeight: "600", color: "#FFFFFF" }}
        >
          กำหนดเยี่ยม {thaiDateTime(task.dueAt)}
        </Text>
      </View>
    </Pressable>
  );
}
