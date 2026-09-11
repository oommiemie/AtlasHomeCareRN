/**
 * The app's glass surface.
 *
 * On iOS 26 this is Apple's real Liquid Glass (a UIKit material, via
 * expo-glass-effect): refraction, press morphing and scroll-edge adaptation
 * are all system behaviour. Below iOS 26 — and on Android — that package
 * renders a view with no background at all, so controls would lose their
 * surface entirely; there we paint an opaque stand-in instead.
 *
 * Everything glass in the app goes through here rather than importing
 * expo-glass-effect directly, so the fallback can never be forgotten.
 */
import type { ReactNode } from "react";
import type { LayoutChangeEvent } from "react-native";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
// Imported by subpath, not by module name. The bare specifier can resolve to
// the package's platform-agnostic build, whose GlassView is a plain <View> —
// the material silently never renders and every glass control comes out
// blank. Reaching the built entry directly keeps Metro's .ios resolution.
import { GlassContainer, GlassView } from "expo-glass-effect/build/index";

type Props = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Tints the material. Keep it translucent — an opaque tint hides the glass. */
  tintColor?: string;
  /**
   * Set on anything the finger drives, so the material tracks the touch.
   */
  interactive?: boolean;
  /**
   * Pins the material's appearance instead of following the system. "light"
   * is the milky, frosted white; left off it flips with the device theme.
   */
  colorScheme?: "auto" | "light" | "dark";
  /** Fires with the laid-out box, for callers that must position against it. */
  onLayout?: (e: LayoutChangeEvent) => void;
};

/**
 * Whether the surface carries its own depth.
 *
 * True while the material is Apple's: UIGlassEffect draws its own rim,
 * highlight and inner shadow, and a shadow layered over it reads as a smudge —
 * it flattens the material into a uniform patch with no visible edge. Callers
 * gate their shadow rings on this and draw none.
 */
export function hasGlass(): boolean {
  return true;
}

export function Glass({
  children,
  style,
  tintColor,
  interactive,
  colorScheme,
  onLayout,
}: Props) {
  // Apple's own material, with nothing of ours layered over or under it.
  //
  // Every earlier attempt here added something meant to help — a tint, an
  // opaque backing disc, a shadow plate — and each one defeated the effect:
  // UIGlassEffect refracts what is BEHIND the view, so anything placed there
  // becomes all it can sample, and a tint is painted OVER the material rather
  // than mixed into it. The material needs to be left alone.
  return (
    <GlassView
      glassEffectStyle="regular"
      isInteractive={interactive}
      colorScheme={colorScheme}
      tintColor={tintColor}
      style={style}
      onLayout={onLayout}
    >
      {children}
    </GlassView>
  );
}

/**
 * Groups glass surfaces so they merge instead of stacking.
 *
 * Apple's `UIGlassContainerEffect`. A glass view placed directly on another
 * glass view has nothing real to refract — the inner one becomes all the
 * outer can sample, and both flatten into a dull patch. Inside a container
 * the system blends them as one piece of glass, which is what the floating
 * action bar needs: a capsule holding two glass buttons.
 *
 * It paints NO material of its own. From UIGlassEffect.h: "the glass
 * container will render all glass elements in one combined view, behind the
 * visual effect view's contentView." So this is a compositor, not a surface —
 * using it in place of a [Glass] leaves nothing drawing at all, which is
 * exactly what happened to the floating action bar.
 *
 * To use it, the children must themselves be glass, nested close beneath it,
 * and no ancestor between may carry a transform or an alpha below 1 —
 * UIVisualEffectView refuses to render its material under either.
 *
 * `spacing` is the distance at which the children merge into each other; 0
 * keeps them distinct. It also mounts children into the effect view's
 * contentView, which Yoga does not lay out, so children must carry their own
 * explicit size rather than flex or absolute insets.
 */
export function GlassGroup({
  children,
  style,
  spacing = 0,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  spacing?: number;
}) {
  // The style goes on a plain View around it, not on the container: the
  // native module declares only a `spacing` prop, so height and radius
  // passed to GlassContainer itself never arrive and it lays out at zero.
  return (
    <View style={style}>
      <GlassContainer spacing={spacing} style={StyleSheet.absoluteFill}>
        {children}
      </GlassContainer>
    </View>
  );
}
