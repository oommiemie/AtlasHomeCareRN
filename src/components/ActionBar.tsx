import type { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView, type BlurViewProps } from "expo-blur";

import { Glass } from "./Glass";
import {
  GLASS_OFF,
  PLATE,
  PRIMARY_500,
  RADIUS,
  SPACE,
  currentTheme,
  shadow,
} from "../theme/tokens";

/**
 * The bar's own measurements — the accept-task bar's, which this now matches.
 *
 * 25 in from each side and 23 up from the foot: level with the tab bar's pill
 * on the tabbed screens. Not the safe-area inset — iOS 26 draws that pill
 * inset within a UITabBar frame running to the screen edge, and the margin it
 * leaves is smaller than the safe area.
 */
const BAR = {
  side: 25,
  bottom: 23,
  pad: SPACE.sm,
  radius: 36,
  button: 48,
} as const;

/**
 * What the tray's blur asks for, which is not one setting on both platforms.
 *
 * On iOS `intensity` is only the material: UIBlurEffect paints its own veil
 * and its own radius together, and 80 of it under the plate is the tray.
 *
 * On Android there is no material to ask. Left alone, expo-blur draws a flat
 * semi-transparent view and nothing else — which is why the bar arrived with
 * the page reading straight through it: nothing was ever blurred, only
 * dimmed. The blur is reached through `experimentalBlurMethod`, and once it
 * is on, `intensity` drives BOTH the radius (`intensity / blurReductionFactor`)
 * and the veil over it (`intensity / 100 × k`, k fixed per tint) — so buying
 * a hard blur by raising the intensity buys a white slab with it. The two are
 * moved apart the only way they can be: the intensity kept low for a thin
 * veil, the divisor dropped to one to win the radius back. `Glass` reaches
 * its own frost by the same route, and these are that surface's numbers.
 *
 * The tint is the one surface in the app a token cannot reach — expo-blur
 * takes a word, not a colour — so it is told which ground it is on. Left at
 * the light one it stays a milky slab on a black page.
 */
export function trayBlur(dark: boolean): BlurViewProps {
  if (Platform.OS !== "android") {
    return { intensity: 80, tint: dark ? "dark" : "light" };
  }
  return {
    intensity: 40,
    blurReductionFactor: 1,
    tint: dark ? "systemUltraThinMaterialDark" : "default",
    experimentalBlurMethod: "dimezisBlurView",
  };
}

/**
 * The floating tray at the foot of the add-house flow.
 *
 * The same frame the accept-task screen carries: a blurred white plate, not
 * Apple's glass.
 *
 * Both cannot be a material at once. UIGlassEffect refracts what is behind
 * it, so anything glass standing on a glass frame has only that frame to
 * sample and comes out as a smeared blob with no edge. A plate at 50% over a
 * blur is what the design specifies for the bar itself, and it gives what
 * sits on it real content to refract.
 *
 * The plate stays at that 50%, and the blur under it carries the weight.
 * Over a page of running text the design's own blur is too slight — it
 * softens the letters instead of dissolving them, and a paragraph goes on
 * reading through the buttons — but thickening the plate to stop it would
 * trade the glass for a white slab. A harder blur ends the words and keeps
 * the tray see-through, which is what the material is for. `trayBlur` is
 * how much, per platform.
 */
export function ActionBar({
  children,
  side = BAR.side,
  bottom = BAR.bottom,
  pad = BAR.pad,
  radius = BAR.radius,
  bottomRadius = radius,
}: {
  children: ReactNode;
  /**
   * How far in from each edge, overriding the standard frame.
   *
   * For a tray that is not just a row of capsules. The bar's own measurements
   * are the accept-task bar's, which sits where the tab bar's pill sits —
   * right for a tray that IS a button, and too narrow for one carrying a
   * readout above it, which wants the map sheet's 8pt instead.
   */
  side?: number;
  bottom?: number;
  /** The room inside. 8 holds a capsule; content needs the app's 16. */
  pad?: number;
  /** The top corners. */
  radius?: number;
  /**
   * The bottom corners, where they differ from the top.
   *
   * The map sheet's resting shape: 36 across the top and 58 along the
   * bottom, so the tray sits into the foot of the screen rather than being a
   * rectangle with equal corners parked near it. Left off, the corners match.
   */
  bottomRadius?: number;
}) {
  // The shadow is cast from this view, so it needs the same shape as the
  // plate inside it — a rounded plate in a square shadow reads as a card
  // lying on a rectangle of grey.
  const corners = {
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    borderBottomLeftRadius: bottomRadius,
    borderBottomRightRadius: bottomRadius,
  } as const;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: side,
        right: side,
        bottom,
        ...corners,
        // Out here, not on the plate: that one clips to its rounded corners
        // with overflow "hidden", which would cut its own shadow away.
        boxShadow: shadow({ blur: 16, y: 4, opacity: 0.16 }),
      }}
    >
      <View
        style={{
          ...corners,
          overflow: "hidden",
          padding: pad,
          gap: pad,
        }}
      >
        <BlurView
          {...trayBlur(currentTheme() === "dark")}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: PLATE }]} />
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
      disabledTint={GLASS_OFF}
      color="#FFFFFF"
    />
  );
}

/**
 * The way past a step, under the action that completes it.
 *
 * Tinted with the tray's own plate, so it reads as cut from the thing it is
 * standing on rather than laid on top of it.
 */
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
      tint={PLATE}
      color={PRIMARY_500}
    />
  );
}
