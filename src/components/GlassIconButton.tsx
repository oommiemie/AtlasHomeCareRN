import type { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { useGlassTarget } from "./BlurStage";
import { Glass, hasGlass } from "./Glass";
import {
  GLASS_LIFT,
  currentTheme,
  RIM_LIT,
  TOUCH_MIN,
  shadow,
} from "../theme/tokens";

const ANDROID = Platform.OS === "android";

/**
 * The white every Android header control is glazed with — the round button
 * and the toolbar pill alike, so no two sit side by side in different glass.
 *
 * About three fifths white either way. Over a blur the blur's own veil is
 * already about a third, so the coat laid on top is the thinner one; with
 * nothing to blur, the flat wash is the whole of it. A third of white alone
 * was tried and read as a blue patch on the plan's deep-blue header, with the
 * glyphs sitting on blue.
 */
export const androidWash = (blurs = false) => {
  const a = blurs ? 0.42 : 0.62;
  return currentTheme() === "dark"
    ? `rgba(28,28,30,${a})`
    : `rgba(255,255,255,${a})`;
};

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
  const blurs = useGlassTarget() != null;

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
            borderColor: RIM_LIT,
            boxShadow: shadow(GLASS_LIFT),
          }}
        />
      )}
      <Glass
        // Bare under real glass: UIGlassEffect treats a tint as a colour laid
        // over the material, so anything here paints the glass out. The
        // fallback supplies its own opaque fill when the material is absent.
        /*
          On Android, a clear pane — blurred where it has a page to blur.

          A button lifted off a page that scrolls under it (see `Floating`)
          is given that page, and blurs it at the sheer frost: the clear
          glass the design draws. Anywhere else — a header, the top of a
          sheet — nothing passes behind it, and a blur view there only ever
          painted its fallback tint, which inside a sheet came out blue on
          a white sheet. There it is a flat wash (see `androidWash`), the
          same surface without the view that was going wrong.
        */
        tintColor={
          tintColor ?? (ANDROID ? androidWash(blurs) : undefined)
        }
        // Only where the button is not already a colour: one that has been
        // given a fill is a painted button, and there is nothing to see
        // through it. On Android, only where there is a page to blur.
        blurred={tintColor == null && (!ANDROID || blurs)}
        frost={ANDROID ? "sheer" : "milky"}
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
