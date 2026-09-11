import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";

import { Glass } from "./Glass";
import { PRIMARY_500, RADIUS, SPACE } from "../theme/tokens";

/**
 * The bar's own measurements — the accept-task bar's, which this now matches.
 *
 * 25 in from each side and 23 up from the foot: level with the tab bar's pill
 * on the tabbed screens. Not the safe-area inset — iOS 26 draws that pill
 * inset within a UITabBar frame running to the screen edge, and the margin it
 * leaves is smaller than the safe area.
 */
const BAR = { side: 25, bottom: 23, pad: SPACE.sm, radius: 36, button: 48 } as const;

/**
 * The floating tray at the foot of the add-house flow.
 *
 * The same frame the accept-task screen carries: a blurred white plate, not
 * Apple's glass.
 *
 * Both cannot be a material at once. UIGlassEffect refracts what is behind
 * it, so anything glass standing on a glass frame has only that frame to
 * sample and comes out as a smeared blob with no edge. White at 50% over a
 * blur is what the design specifies for the bar itself, and it gives what
 * sits on it real content to refract.
 */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: BAR.side,
        right: BAR.side,
        bottom: BAR.bottom,
        // Out here, not on the plate: that one clips to its rounded corners
        // with overflow "hidden", which would cut its own shadow away.
        shadowColor: "#000000",
        shadowOpacity: 0.16,
        shadowOffset: { width: 0, height: 4 },
        // iOS halves the design's blur radius for shadowRadius.
        shadowRadius: 16,
      }}
    >
      <View
        style={{
          borderRadius: BAR.radius,
          overflow: "hidden",
          padding: BAR.pad,
          gap: BAR.pad,
        }}
      >
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(255,255,255,0.5)" },
          ]}
        />
        {children}
      </View>
    </View>
  );
}

/**
 * One 48pt capsule of Apple's glass, in the tray or on its own.
 *
 * The accept-task screen's button, made shared: a plain Pressable around a
 * `Glass` — not PressableScale, which animates a transform on an ancestor,
 * and a transformed ancestor stops UIVisualEffectView drawing its material
 * at all. The glass answers the touch itself, through `interactive`.
 *
 * Disabled is a change of tint, never of opacity, for the same reason: an
 * alpha below 1 on any ancestor strips the material, so a faded button
 * would be a flat one.
 */
export function ActionCapsule({
  label,
  onPress,
  disabled,
  tint,
  disabledTint,
  color,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** The colour mixed into the material. Keep it translucent. */
  tint: string;
  /** What it is mixed with while the action is unavailable. */
  disabledTint?: string;
  /** The label. */
  color: string;
}) {
  const off = disabled === true;
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off }}
    >
      <Glass
        tintColor={off ? (disabledTint ?? tint) : tint}
        interactive={!off}
        style={{
          height: BAR.button,
          borderRadius: RADIUS.capsule,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: "500",
            color,
            opacity: off ? 0.7 : 1,
          }}
        >
          {label}
        </Text>
      </Glass>
    </Pressable>
  );
}

/** The tray's primary action — the design's blue, as glass. */
export function PrimaryAction({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <ActionCapsule
      label={label}
      onPress={onPress}
      disabled={disabled}
      // The blue at the opacity the material can still refract through.
      tint="rgba(7,125,215,0.78)"
      disabledTint="rgba(199,205,212,0.7)"
      color="#FFFFFF"
    />
  );
}

/** The way past a step, under the action that completes it. */
export function SecondaryAction({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <ActionCapsule
      label={label}
      onPress={onPress}
      tint="rgba(255,255,255,0.5)"
      color={PRIMARY_500}
    />
  );
}
