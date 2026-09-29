import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { Chevron } from "./Chevron";
import { PressableScale } from "./PressableScale";
import {
  FILL_SUBTLE,
  RADIUS,
  SPACE,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme/tokens";
import { GUTTER } from "../theme/layout";

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
        paddingHorizontal: flush ? 0 : GUTTER,
      }}
    >
      <Text
        numberOfLines={1}
        // Gives way to the tally and the link, so a long English heading
        // truncates rather than pushing them off the row.
        style={{ flexShrink: 1, fontSize: 16, fontWeight: "500", color: TEXT_PRIMARY }}
      >
        {title}
      </Text>
      {/*
        The tally, quietly: a grey capsule and a grey figure.

        It was the app's blue, filled, with white bold type — the loudest
        thing in the row, louder than the title it counts for, and blue is
        what every button in the app is, so it read as something to press.
        The heading is what the eye should land on; the number is there to
        be read second.
      */}
      {count != null && (
        <View
          style={{
            marginLeft: SPACE.sm,
            minWidth: 24,
            backgroundColor: FILL_SUBTLE,
            borderRadius: RADIUS.capsule,
            paddingHorizontal: 7,
            paddingVertical: 2,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: TEXT_SECONDARY,
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
