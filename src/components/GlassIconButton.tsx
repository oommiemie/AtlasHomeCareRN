import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Glass, hasGlass } from "./Glass";
import { TOUCH_MIN } from "../theme/tokens";

type Props = {
  onPress?: () => void;
  children: ReactNode;
  /** The drawn size. The hit box is grown to the 44pt floor regardless. */
  size?: number;
  accessibilityLabel?: string;
  tintColor?: string;
  disabled?: boolean;
  /** Pins the material light or dark — dark over a camera feed. */
  colorScheme?: "auto" | "light" | "dark";
};

/**
 * A round glass button — the back button, the toolbar actions, the sheet's
 * close button.
 *
 * The material alone washes out over a pale header, so under the fallback the
 * button carries its own white ground.
 */
export function GlassIconButton({
  onPress,
  children,
  size = 44,
  accessibilityLabel,
  tintColor,
  disabled,
  colorScheme,
}: Props) {
  const pad = Math.max(0, (TOUCH_MIN - size) / 2);

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={8}
      style={{ padding: pad, opacity: disabled ? 0.4 : 1 }}
    >
      {/* Only where the material is absent. Real Liquid Glass carries its
          own depth, and a shadow layered over it reads as a smudge — it
          flattens the material into a uniform patch with no visible edge,
          which is what made these buttons look empty. */}
      {!hasGlass() && (
        <View
          style={{
            position: "absolute",
            left: pad,
            top: pad,
            width: size,
            height: size,
            borderRadius: size / 2,
            // A ring, not a plate: the shadow needs a view to cast from, but any
            // fill behind the glass becomes what the material refracts, and a
            // pale plate there greys the button out. A hairline border throws
            // the same shadow and leaves the middle clear.
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
        // Bare under real glass: UIGlassEffect treats a tint as a colour laid
        // over the material, so anything here paints the glass out. The
        // fallback supplies its own opaque fill when the material is absent.
        tintColor={tintColor}
        colorScheme={colorScheme}
        interactive
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View pointerEvents="none">{children}</View>
      </Glass>
    </Pressable>
  );
}
