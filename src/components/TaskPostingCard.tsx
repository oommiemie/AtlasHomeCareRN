import { Pressable, Text, View } from "react-native";

import { Chevron } from "./Chevron";
import { Glass } from "./Glass";
// Kept for the accept tab: it is a sibling of the glass avatar, not an
// ancestor, so its transform cannot blank the material.
import { PressableScale } from "./PressableScale";
import { initialOf, visitTypeLabel, type Task } from "../models/task";
import { tr } from "../i18n";
import { Avatar } from "./Avatar";
import { thaiDateTime } from "../utils/thaiDate";
import {
  PRIMARY_100,
  PRIMARY_500,
  RADIUS,
  SPACE,
  SURFACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  shadow,
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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: SPACE.lg,
          }}
        >
          <View style={{ marginLeft: SPACE.lg }}>
            {/* The same disc the visit rows and the record pages carry —
                this card is where its shape came from. */}
            <Avatar size={32} initial={initialOf(task)} />
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
              <Text
                style={{ fontSize: 10, fontWeight: "500", color: PRIMARY_500 }}
              >
                {tr(`${task.age} ปี`, `${task.age} yrs`)}
              </Text>
            </Glass>
          </View>

          {/* Flush to the card's right edge, rounded on the left only — it
              reads as a tab pulled out of the sheet. */}
          <PressableScale
            onPress={onAccept}
            accessibilityRole="button"
            accessibilityLabel={tr("รับงาน", "Accept task")}
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
              boxShadow: shadow({ blur: 6, y: 2, x: -1, opacity: 0.08 }),
            }}
          >
            <Text style={{ fontSize: 12, color: TEXT_PRIMARY }}>{tr("รับงาน", "Accept")}</Text>
            <View style={{ marginLeft: SPACE.sm }}>
              <Chevron ink={ORANGE} />
            </View>
          </PressableScale>
        </View>

        {task.visitType != null && (
          <Text
            numberOfLines={1}
            style={{
              marginTop: SPACE.md,
              marginHorizontal: SPACE.lg,
              fontSize: 12,
              lineHeight: 16,
              fontWeight: "600",
              color: PRIMARY_500,
            }}
          >
            {visitTypeLabel(task.visitType)}
          </Text>
        )}
        <Text
          numberOfLines={1}
          style={{
            marginTop: task.visitType != null ? 2 : SPACE.md,
            marginHorizontal: SPACE.lg,
            minHeight: 20,
            fontSize: 12,
            lineHeight: 18,
            color: TEXT_MUTED,
          }}
        >
          {task.detail}
        </Text>
      </View>

      <View
        style={{
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: SPACE.lg,
        }}
      >
        <Text
          numberOfLines={1}
          style={{ fontSize: 12, fontWeight: "600", color: "#FFFFFF" }}
        >
          {tr("กำหนดเยี่ยม", "Visit due")} {thaiDateTime(task.dueAt)}
        </Text>
      </View>
    </Pressable>
  );
}
