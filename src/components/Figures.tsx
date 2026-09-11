import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { SPACE, TEXT_MUTED } from "../theme/tokens";

/** The rule under a row of figures — #CCCCCC at a fifth, per Figma 269:9698. */
const RULE = "rgba(204,204,204,0.2)";

/**
 * A row of counts, as the design draws them (Figma 269:9698).
 *
 * Shared because two screens carry the same row — the villages list and one
 * house — and the parts that make it read as a row rather than three stacks
 * are easy to get subtly different: the columns are equal-width and the value
 * sits directly over its label, with a hairline closing the row off.
 */
export function Figures({ children, ruled }: { children: ReactNode; ruled?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        // Only where something follows it. A rule with nothing underneath is
        // a line the eye keeps looking past.
        borderBottomWidth: ruled ? 1 : 0,
        borderBottomColor: RULE,
      }}
    >
      {children}
    </View>
  );
}

/** One count and what it counts. */
export function Figure({
  value,
  label,
  ink,
}: {
  value: number;
  label: string;
  ink: string;
}) {
  return (
    <View style={{ flex: 1, paddingVertical: SPACE.md }}>
      <Text style={{ fontSize: 20, lineHeight: 26, fontWeight: "800", color: ink }}>
        {value}
      </Text>
      <Text
        numberOfLines={1}
        style={{ marginTop: SPACE.sm, fontSize: 12, lineHeight: 16, color: TEXT_MUTED }}
      >
        {label}
      </Text>
    </View>
  );
}
