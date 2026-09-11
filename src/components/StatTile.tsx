import { Text, View } from "react-native";

import {
  RADIUS,
  SPACE,
  SURFACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";

/**
 * One figure off a detail page's chart — Figma 390:46831's own strip.
 *
 * Three of these across a row under the trace: the average, and whichever two
 * ends of it the reading is actually judged by. Which two is the page's call —
 * the highest glucose matters and the highest oxygen does not.
 */
export function StatTile({
  label,
  value,
  unit,
  ink,
  sub,
}: {
  label: string;
  value: string;
  unit: string;
  /**
   * The colour this value is drawn in on the chart, where it is on it.
   *
   * Left out for a figure that is inside its band. It used to carry the
   * metric's colour whatever the reading was, and a green dot beside "lowest"
   * reads as a verdict on the low rather than as a colour to match against the
   * chart. With it, the dot means one thing: this figure is one of the
   * coloured stretches up there.
   */
  ink?: string;
  /**
   * A second line under the figure, for what the figure was worked out from.
   *
   * The BMI page's tiles carry the weighing behind each figure: a BMI on its
   * own is a number nobody can check, and the kilos are what a carer would
   * repeat to the patient. Left off everywhere else, where the figure and its
   * unit are the whole of what there is to say.
   */
  sub?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: SURFACE,
        borderRadius: RADIUS.card,
        padding: SPACE.lg,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {ink != null && (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: ink,
            }}
          />
        )}
        <Text
          numberOfLines={1}
          style={{ fontSize: 12, lineHeight: 16, color: TEXT_MUTED }}
        >
          {label}
        </Text>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          gap: SPACE.xs,
          marginTop: SPACE.sm,
        }}
      >
        <Text
          style={{
            fontSize: 20,
            lineHeight: 26,
            fontWeight: "700",
            // The figure takes the colour too, so the dot is a second sign of
            // one thing rather than the only one.
            color: ink ?? TEXT_PRIMARY,
          }}
        >
          {value}
        </Text>
        <Text style={{ fontSize: 12, color: TEXT_MUTED }}>{unit}</Text>
      </View>
      {sub != null && (
        <Text
          numberOfLines={1}
          style={{
            marginTop: 2,
            fontSize: 12,
            lineHeight: 16,
            color: TEXT_MUTED,
          }}
        >
          {sub}
        </Text>
      )}
    </View>
  );
}
