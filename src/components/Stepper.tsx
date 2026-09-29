import { Pressable, Text, View } from "react-native";
import { Minus, Plus } from "lucide-react-native";

import { Glass } from "./Glass";
import { feel } from "../utils/haptics";
import { tr } from "../i18n";
import { GROUPED_BG, PRIMARY_700, RADIUS, SPACE, TEXT_MUTED, TEXT_PRIMARY } from "../theme/tokens";

/** A number with − and + either side, in the field capsule. */
export function Stepper({
  label,
  value,
  step,
  min,
  max,
  unit,
  onChange,
}: {
  label?: string;
  value: number;
  step: number;
  min: number;
  max?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const shown = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
  // Glass, and the system's own press response with it. No transform and
  // no alpha on the way down to it: either stops UIVisualEffectView
  // rendering its material and the discs go blank.
  const Btn = ({ glyph, onPress }: { glyph: "minus" | "plus"; onPress: () => void }) => (
    <Pressable
      onPress={() => {
        feel("tick");
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={glyph === "minus" ? tr("ลด", "Decrease") : tr("เพิ่ม", "Increase")}
      hitSlop={6}
    >
      <Glass
        interactive
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {glyph === "minus" ? (
          <Minus size={18} color={PRIMARY_700} strokeWidth={2.6} />
        ) : (
          <Plus size={18} color={PRIMARY_700} strokeWidth={2.6} />
        )}
      </Glass>
    </Pressable>
  );
  return (
    <View style={{ gap: SPACE.sm }}>
      {label != null && <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>{label}</Text>}
      <View
        style={{
          height: 48,
          borderRadius: RADIUS.capsule,
          backgroundColor: GROUPED_BG,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 6,
          gap: 4,
        }}
      >
        <Btn glyph="minus" onPress={() => onChange(Math.max(min, +(value - step).toFixed(2)))} />
        <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700", color: TEXT_PRIMARY }}>
          {shown}
          {unit != null && <Text style={{ fontSize: 13, fontWeight: "500", color: TEXT_MUTED }}>{` ${unit}`}</Text>}
        </Text>
        <Btn
          glyph="plus"
          onPress={() => onChange(max == null ? +(value + step).toFixed(2) : Math.min(max, +(value + step).toFixed(2)))}
        />
      </View>
    </View>
  );
}
