import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { Glass } from "./Glass";
import { useSheetAsPanel } from "./FloatingSheet";
import {
  GLASS_NEUTRAL,
  GROUPED_BG,
  RADIUS,
  SPACE,
  SURFACE,
  TEXT_SECONDARY,
} from "../theme/tokens";

/** The primary action's tint: the app's blue, over the glass. */
export const SHEET_PRIMARY = "rgba(7,125,215,0.85)";

/**
 * One capsule on a map page's sheet or panel, on Apple's glass — the
 * "Cancel" / "Directions" pair under a picked pin, and every other action
 * those pages offer, so they all look like one set.
 *
 * `primary` is the app's blue with white words; otherwise the neutral
 * glass with grey ones.
 *
 * A plain Pressable, never PressableScale: that one animates a transform on
 * an ancestor, and a transformed ancestor stops UIVisualEffectView drawing
 * its material — the capsule would come out empty. The glass supplies its
 * own press response through `interactive`, which is the system's anyway.
 *
 * The tint is painted over the material rather than mixed in, so it stays
 * translucent: an opaque one would hide the very thing it is colouring.
 */
export function SheetButton({
  label,
  primary = false,
  ink,
  tint,
  icon,
  disabled = false,
  onPress,
}: {
  label: string;
  primary?: boolean;
  /** Overrides for the words' and the glass's colour. */
  ink?: string;
  tint?: string;
  icon?: ReactNode;
  disabled?: boolean;
  onPress: () => void;
}) {
  const words = ink ?? (primary ? "#FFFFFF" : TEXT_SECONDARY);
  /*
    On an iPad's glass side panel the neutral glass is glass on glass, and
    disappears; there the plain button is the panel's own white, like the
    cards standing on it.
  */
  const onPanel = useSheetAsPanel();
  const neutral = GLASS_NEUTRAL;
  /*
    And a tint is not enough there: iPadOS 26's material mixes it in so
    lightly that a white-tinted capsule on the glass panel still read as
    nothing. So on the panel the plain button is not glass at all but the
    panel's own white, like the cards standing on it.
  */
  if (onPanel && !primary && tint == null) {
    return (
      <View style={{ flex: 1, opacity: disabled ? 0.45 : 1 }}>
        <Pressable
          onPress={disabled ? undefined : onPress}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled }}
          style={({ pressed }) => ({
            height: 48,
            borderRadius: RADIUS.capsule,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: SPACE.sm,
            paddingHorizontal: SPACE.md,
            backgroundColor: pressed ? GROUPED_BG : SURFACE,
          })}
        >
          {icon}
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              fontSize: 16,
              fontWeight: "500",
              color: words,
            }}
          >
            {label}
          </Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, opacity: disabled ? 0.45 : 1 }}>
      <Pressable
        onPress={disabled ? undefined : onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
      >
        <Glass
          tintColor={tint ?? (primary ? SHEET_PRIMARY : neutral)}
          interactive
          style={{
            height: 48,
            borderRadius: RADIUS.capsule,
            overflow: "hidden",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: SPACE.sm,
            paddingHorizontal: SPACE.md,
          }}
        >
          {icon}
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              fontSize: 16,
              fontWeight: "500",
              color: words,
            }}
          >
            {label}
          </Text>
        </Glass>
      </Pressable>
    </View>
  );
}
