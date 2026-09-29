import { Text } from "react-native";

import { Glass } from "./Glass";
import { PRIMARY_500, RADIUS, SPACE } from "../theme/tokens";

/**
 * A fact about the patient at the head of their page — age, sex, blood
 * group — on Apple's glass under the name.
 *
 * The pages that open on a person all carry these, and each drew its own
 * copy; one of them had them as a white card of three columns instead. One
 * tag, so a patient looks the same whichever page they are opened on.
 */
export function HeroTag({ label }: { label: string }) {
  return (
    <Glass
      style={{
        borderRadius: RADIUS.capsule,
        overflow: "hidden",
        paddingHorizontal: SPACE.md,
        paddingVertical: 6,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "500", color: PRIMARY_500 }}>
        {label}
      </Text>
    </Glass>
  );
}
