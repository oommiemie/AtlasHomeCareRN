import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { Chevron } from "./Chevron";
import { PressableScale } from "./PressableScale";
import {
  PRIMARY_500,
  RADIUS,
  SPACE,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme/tokens";

/**
 * A list's heading: its name, how many rows are under it, and one control at
 * the far end.
 *
 * Shared rather than copied. The home list and the villages list carry the
 * same heading with the same filter hanging off it, and two copies of a row
 * this fiddly — the count pill's minimum width, where the spacer goes, the
 * flush variant — drift apart the first time one of them is touched.
 */
export function SectionHeader({
  title,
  count,
  trailingLabel,
  onTrailing,
  trailing,
  flush,
}: {
  title: string;
  /** Left off where the heading names the list but need not tally it. */
  count?: number;
  /** The "เพิ่มเติม" link. Left off where the section leads nowhere. */
  trailingLabel?: string;
  onTrailing?: () => void;
  /** Replaces the label-and-arrow, for headers that carry a control. */
  trailing?: ReactNode;
  flush?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: flush ? 0 : SPACE.lg,
      }}
    >
      <Text
        numberOfLines={1}
        style={{ fontSize: 16, fontWeight: "500", color: TEXT_PRIMARY }}
      >
        {title}
      </Text>
      {count != null && (
        <View
          style={{
            marginLeft: SPACE.sm,
            minWidth: 26,
            backgroundColor: PRIMARY_500,
            borderRadius: RADIUS.capsule,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: "#FFFFFF",
              textAlign: "center",
            }}
          >
            {count}
          </Text>
        </View>
      )}
      <View style={{ flex: 1 }} />
      {/* The link is drawn only where it goes somewhere. Rendered
          unconditionally, a section with nothing to open still carried an
          arrow, which reads as a promise the row cannot keep. */}
      {trailing ??
        (onTrailing == null ? null : (
        <PressableScale
          onPress={onTrailing}
          accessibilityRole="button"
          accessibilityLabel={trailingLabel}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: SPACE.xs,
            padding: 8,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "600", color: TEXT_SECONDARY }}>
            {trailingLabel}
          </Text>
          <Chevron ink={TEXT_SECONDARY} />
        </PressableScale>
        ))}
    </View>
  );
}
