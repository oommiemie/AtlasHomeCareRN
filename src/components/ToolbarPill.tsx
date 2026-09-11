import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Glass, hasGlass } from "./Glass";
import { GLASS_BAR_TINT, RADIUS, TOUCH_MIN } from "../theme/tokens";

type Slot = {
  icon: ReactNode;
  label: string;
  onPress?: () => void;
};

/**
 * The toolbar capsule in a screen header — one or two round slots on glass.
 *
 * The drawn slot is 36pt per the design, under the 44pt touch floor, so the
 * hit box is grown past the drawing rather than the capsule being inflated:
 * the pill keeps its 104×44, and the extra target reaches over its padding.
 */
export function ToolbarPill({ slots }: { slots: Slot[] }) {
  return (
    <View>
      {/* Only where the material is absent — real Liquid Glass carries its
          own depth, and a shadow over it reads as a smudge. */}
      {!hasGlass() && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            borderRadius: RADIUS.capsule,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: "rgba(255,255,255,0.5)",
            shadowColor: "#041228",
            shadowOpacity: 0.28,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 5 },
            elevation: 8,
          }}
        />
      )}
      <Glass
        tintColor={GLASS_BAR_TINT}
        style={{
          height: 44,
          borderRadius: RADIUS.capsule,
          overflow: "hidden",
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 8,
        }}
      >
        {slots.map((s, i) => (
          <View key={s.label} style={{ flexDirection: "row", alignItems: "center" }}>
            {i > 0 && (
              <View
                style={{
                  width: 1,
                  height: 24,
                  marginHorizontal: 7,
                  backgroundColor: "rgba(0,0,0,0.12)",
                }}
              />
            )}
            <Pressable
              onPress={s.onPress}
              accessibilityRole="button"
              accessibilityLabel={s.label}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              style={{
                width: 36,
                height: TOUCH_MIN,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {s.icon}
            </Pressable>
          </View>
        ))}
      </Glass>
    </View>
  );
}
