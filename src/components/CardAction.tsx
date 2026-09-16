import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { Glass } from "./Glass";
import { PRIMARY_100, RADIUS, SEPARATOR, SPACE, TEXT_MUTED, TEXT_PRIMARY } from "../theme/tokens";

/**
 * The one action a card's contents take, at the head of the card.
 *
 * Every list on a record page grows the same way — a button in the top
 * right, above what it adds to — so the eye learns one place rather than
 * hunting the foot of each card for a different-looking button.
 *
 * A capsule of Liquid Glass with the system's own press response. It is
 * never wrapped in anything that carries a transform or an alpha: either
 * stops UIVisualEffectView rendering its material and the capsule goes
 * blank.
 */
export function CardAction({
  icon,
  label,
  onPress,
  tintColor = "rgba(7,125,215,0.82)",
}: {
  icon?: ReactNode;
  label: string;
  onPress: () => void;
  tintColor?: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8}>
      <Glass
        interactive
        tintColor={tintColor}
        style={{
          height: 32,
          paddingHorizontal: SPACE.md,
          borderRadius: RADIUS.capsule,
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          overflow: "hidden",
        }}
      >
        {icon}
        <Text style={{ fontSize: 13, fontWeight: "700", color: "#FFFFFF" }}>{label}</Text>
      </Glass>
    </Pressable>
  );
}

/**
 * A card's head: its glyph on a pale disc, its name, the action that fills
 * it, and a rule under the lot.
 *
 * One component for every card on every form — the forms had grown two
 * headings between them, one with the disc and the rule and one without,
 * and which a card got depended on when it was written rather than on
 * anything a reader could see.
 */
export function CardHeading({
  icon,
  title,
  action,
  note,
}: {
  icon: ReactNode;
  title: string;
  action?: ReactNode;
  /** A count at the far end, where one is worth saying. */
  note?: string;
}) {
  return (
    <View style={{ gap: SPACE.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: 32 }}>
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: PRIMARY_100,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </View>
        <Text style={{ flex: 1, fontSize: 16, lineHeight: 21, fontWeight: "500", color: TEXT_PRIMARY }}>
          {title}
        </Text>
        {note != null && <Text style={{ fontSize: 13, color: TEXT_MUTED }}>{note}</Text>}
        {action}
      </View>
      <View style={{ height: 1, backgroundColor: SEPARATOR }} />
    </View>
  );
}
