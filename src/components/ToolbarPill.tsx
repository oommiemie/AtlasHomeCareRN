import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Glass, hasGlass } from "./Glass";
import { RADIUS, RIM_LIT, SEPARATOR, TOUCH_MIN, shadow } from "../theme/tokens";

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
 *
 * A single slot is drawn as a circle instead: a capsule with one thing in
 * it reads as a pill somebody forgot to fill, and the app's own round glass
 * button is what a lone header action looks like everywhere else.
 */
export function ToolbarPill({ slots }: { slots: Slot[] }) {
  const alone = slots.length === 1;
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
            borderColor: RIM_LIT,
            boxShadow: shadow({
              blur: 14,
              y: 5,
              color: "#041228",
              opacity: 0.28,
            }),
          }}
        />
      )}
      <Glass
        /*
          Blurred rather than washed, where the material is missing.

          It used to be given `GLASS_BAR_TINT` — a near-solid white — which
          is what a bar had to be before there was a blur to stand on. Over
          one it is a second coat: the page goes behind two translucent
          whites and the pill reads as a panel floating on the header
          rather than as something you are looking through.
        */
        blurred
        // Read off rather than through: this is a row of small glyphs.
        frost="milky"
        style={{
          height: 44,
          width: alone ? 44 : undefined,
          borderRadius: RADIUS.capsule,
          overflow: "hidden",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: alone ? 0 : 8,
        }}
      >
        {slots.map((s, i) => (
          <View
            key={s.label}
            style={{ flexDirection: "row", alignItems: "center" }}
          >
            {i > 0 && (
              <View
                style={{
                  width: 1,
                  height: 24,
                  marginHorizontal: 7,
                  backgroundColor: SEPARATOR,
                }}
              />
            )}
            <Pressable
              onPress={s.onPress}
              accessibilityRole="button"
              accessibilityLabel={s.label}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              style={{
                width: alone ? TOUCH_MIN : 36,
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
