import { Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { SPACE, TEXT_PRIMARY } from "../theme/tokens";

/**
 * A moment, as UIKit's own compact picker: the label on the left, the two
 * small grey pills on the right.
 *
 * The control is shown as itself rather than hidden under a painted field.
 * Elsewhere in the app a date is dressed as one of our capsules, which
 * takes laying the picker under it at an alpha of 0.02 and scaling it past
 * the edges — a trick that works for a single button and fails for
 * `datetime`, which draws two with a gap between them where the finger
 * lands. Left alone, the system's own control is both correct and the more
 * compact of the two.
 */
export function DateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  /** ISO. */
  value: string;
  onChange: (iso: string) => void;
}) {
  const parsed = new Date(value);
  const at = Number.isFinite(parsed.getTime()) ? parsed : new Date();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.sm,
        minHeight: 40,
      }}
    >
      <Text style={{ flex: 1, fontSize: 15, lineHeight: 21, color: TEXT_PRIMARY }}>{label}</Text>
      <DateTimePicker
        value={at}
        mode="datetime"
        display="compact"
        locale="th-TH"
        accessibilityLabel={label}
        onChange={(_, next) => {
          if (next != null) onChange(next.toISOString());
        }}
      />
    </View>
  );
}
