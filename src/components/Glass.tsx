/**
 * The app's glass surface.
 *
 * On iOS 26 this is Apple's real Liquid Glass (a UIKit material, via
 * expo-glass-effect): refraction, press morphing and scroll-edge adaptation
 * are all system behaviour. Below iOS 26 — and on Android — that package
 * renders a view with no background at all, so controls would lose their
 * surface entirely; there we blur what is behind instead.
 *
 * Frosted rather than liquid, which is the honest translation. Liquid Glass
 * refracts: it bends the page through a lens and moves when the finger
 * presses it. Nothing off iOS 26 can do either. What carries across is the
 * rest of the idea — the surface is translucent, the page shows through it,
 * and it catches the light along its top edge — and the part that cannot be
 * had is left out rather than faked.
 *
 * Everything glass in the app goes through here rather than importing
 * expo-glass-effect directly, so the fallback can never be forgotten.
 */
import type { ReactNode, RefObject } from "react";
import type { LayoutChangeEvent } from "react-native";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView, type BlurTint } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useGlassTarget } from "./BlurStage";
// Imported by subpath, not by module name. The bare specifier can resolve to
// the package's platform-agnostic build, whose GlassView is a plain <View> —
// the material silently never renders and every glass control comes out
// blank. Reaching the built entry directly keeps Metro's .ios resolution.
import { GlassContainer, GlassView } from "expo-glass-effect/build/index";

import {
  currentTheme,
  GLASS_NEUTRAL,
  glassGround,
  LIQUID_GLASS,
} from "../theme/tokens";

/**
 * The two strengths, as the pair of numbers the library actually takes.
 *
 * `intensity` sets BOTH the blur and the veil — the veil at
 * `intensity / 100 × 0.44` for this tint — and `divisor` then takes the
 * blur back down. So the veil is chosen with the first and the blur is
 * recovered with the second, which is the only way to move them apart.
 */
const FROST: Record<
  "sheer" | "milky",
  { intensity: number; divisor: number; light: BlurTint; dark: BlurTint }
> = {
  /*
    0.35 of white over a blur of 40: the page soft, and the surface there.

    It was 0.18, from an intensity of 40, while there was no real blur
    under it on Android. Once there was, a fifth of white let the page come
    through almost as it was, and the glass read as a hole in the header
    rather than a pane over it. The intensity is doubled for the veil and
    the divisor with it, so the radius stays where it was.
  */
  sheer: {
    intensity: 80,
    divisor: 2,
    light: "default",
    dark: "systemUltraThinMaterialDark",
  },
  /*
    0.70 of white over a blur of 10: frosted glass, and only just softened.

    The tint is the heaviest white the library has — 0.97 of its intensity,
    on a pure white rather than the off-white of the lighter ones, which is
    what lets the wash get this far. The two thinner tints top out at 0.44
    and 0.78 however hard they are driven, and a surface asked to be milky
    cannot be made so by pushing a tint that has no milk left in it.

    The blur is held down by the divisor for the reason it always is: the
    thicker the wash, the less of the page there is to blur, and the work
    goes into something nobody can see through anyway.
  */
  milky: {
    intensity: 72,
    divisor: 7,
    light: "systemChromeMaterialLight",
    dark: "systemThickMaterialDark",
  },
};

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
   * Pins the surface's appearance instead of following the app's theme.
   * "light" is the milky, frosted white; left off it flips with the theme.
   *
   * It holds where there is no material too — the stand-in is painted from
   * the ground named here, not from whichever the app happens to be in.
   * Set it on anything standing on its own dark ground and carrying white:
   * over a camera feed, over a deep blue card.
   */
  colorScheme?: "auto" | "light" | "dark";
  /** Fires with the laid-out box, for callers that must position against it. */
  onLayout?: (e: LayoutChangeEvent) => void;
  /**
   * How much of the material there is.
   *
   * "regular" is the frosted default. "clear" is the thinner one Apple uses
   * where what is behind the glass has to stay readable through it — a
   * highlight over a calendar, rather than a control standing on a page.
   */
  effect?: "regular" | "clear";
  /**
   * Blur what is behind, where the material is missing.
   *
   * Off by default and asked for one surface at a time, because the blur
   * costs more than it looks: expo-blur reaches it on Android through
   * `dimezisBlurView`, which redraws the view behind into a canvas of its
   * own on every frame. Worth it for a bar that floats over a scrolling
   * page, which is the whole of what a floating bar is for; not worth it
   * for a chip in a row of chips.
   */
  blurred?: boolean;
  /**
   * How much of a blurred surface is milk and how much is the page.
   *
   * "sheer" is the thinnest that still reads as a surface: the page goes
   * soft behind it and almost none of its colour is taken away. It is what
   * a bar floating over a list wants, where the list is the thing being
   * looked at.
   *
   * "milky" is whiter and less blurred, for a surface that has to be read
   * off rather than through — a toolbar of small glyphs, a menu of words.
   * The two move opposite ways on purpose: the whiter it is, the less the
   * blur has to do, and a heavy blur under a heavy wash is work nobody
   * sees.
   */
  frost?: "sheer" | "milky";
  /**
   * What to blur on Android, where the page offers no `BlurBackdrop` — the
   * tab bar, handed the page of the tab that is showing.
   */
  blurTarget?: RefObject<View | null>;
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
  return LIQUID_GLASS;
}

export function Glass({
  children,
  style,
  tintColor,
  interactive,
  colorScheme,
  onLayout,
  effect = "regular",
  blurred = false,
  frost = "sheer",
  blurTarget,
}: Props) {
  // Apple's own material, with nothing of ours layered over or under it.
  //
  // Every earlier attempt here added something meant to help — a tint, an
  // opaque backing disc, a shadow plate — and each one defeated the effect:
  // UIGlassEffect refracts what is BEHIND the view, so anything placed there
  // becomes all it can sample, and a tint is painted OVER the material rather
  // than mixed into it. The material needs to be left alone.
  /*
    The app's own ground, not the device's. A carer who put the app into
    dark while the phone is light would otherwise get milky white panels on
    a near-black page.

    Resolved to one of the two, never left as "auto": everything below asks
    whether the ground is dark, and a surface that had said in so many words
    that it follows the system answered neither yes nor no, and was taken
    for light.
  */
  const ground =
    colorScheme == null || colorScheme === "auto" ? currentTheme() : colorScheme;

  /*
    Where the material does not exist, glass that is frosted instead.

    This file has said since it was written that below iOS 26 — and on
    Android — expo-glass-effect renders a view with no background at all,
    and that a stand-in is painted instead. The stand-in was never
    written: `hasGlass` returned a hardcoded true and every control went
    through `GlassView` regardless, so on any phone without Liquid Glass
    the floating bars, the chips, the toolbar pills and the back button
    were text on nothing.

    A translucent wash, the sheen down its top edge, and the rim the
    material would have drawn for itself. The wash has to stay translucent
    or this is the flat slab it is replacing; a tint handed in for the real
    material — meant to be mixed INTO glass — is taken as given rather than
    strengthened, and is translucent for the same reason.

    Not a real blur, and deliberately. expo-blur does blur on Android, but
    only through `experimentalBlurMethod="dimezisBlurView"`, which draws
    the view behind into a software canvas — and a software canvas cannot
    draw a hardware bitmap:

      java.lang.IllegalArgumentException: Software rendering doesn't
      support hardware bitmaps
        at eightbitlab.com.blurview.PreDrawBlurController.updateBlur

    Which is to say: the moment a glass surface has a photograph anywhere
    behind it the app is gone, and this app puts avatars, artwork and a map
    behind glass on nearly every screen. That is a crash bought for a blur,
    on a control whose whole job is to be the thing you always see.

    `overflow: "hidden"` because the sheen is a layer of its own, and a
    corner radius on this view does not clip its children on Android.
  */
  /*
    Whether the surface needs a highlight painted down it.

    The sheen is a stand-in for depth, for a surface that has none: no
    material, no blur, nothing behind it but its own colour. So it belongs
    to the app's own frost and to nothing else.

    A caller that names a tint is painting rather than glazing — the send
    button's blue, a chosen chip, a person's monogram — and over any of
    those the sheen is not a highlight, it is a white smear down the top
    half. This was first written as a threshold, on the grounds that a
    translucent tint is still glass; it is not, and at 0.78 the assistant's
    send button came out two-toned exactly as the avatars had at 0.95. The
    question is not how solid the colour is, it is whether a colour was
    asked for at all.

    And a blur, because the page showing through IS the depth. Laid over
    one, a sheen that starts at seven tenths white puts back most of the
    opacity the blur was asked for instead.

    And the clear material, for the same reason by a different route. That
    one is asked for where what is UNDER the glass has to keep reading
    through it — the calendar's selected day sits over the dates and the
    wash — and a highlight that starts at seven tenths white across the top
    of it is exactly what stops them. On the calendar it also landed on the
    white disc the date sits in and the two ran together, so the disc
    stopped looking round.
  */
  /*
    The neutral veil, dropped where there is no material to mix it into.

    `GLASS_NEUTRAL` is a touch of white asked for so that Apple's glass has
    a little more body. Off the material it is not mixed into anything — it
    is the whole surface, and forty-five hundredths of white laid on a white
    card is nothing at all: the vaccine register's row actions and the
    session's vaccine chips were bare words on Android, with no edge to say
    they could be pressed. The care-activities handle had already learnt to
    pass no tint here for that reason; now every caller gets that answer
    without having to know it. Where the veil is dropped, the surface is the
    app's own frost below — the one painted for a control that has to be
    seen on a page it cannot refract.
  */
  const tint =
    !LIQUID_GLASS && tintColor === GLASS_NEUTRAL ? undefined : tintColor;
  const lit = !blurred && tint == null && effect !== "clear";

  /*
    The stand-in, of the ground this surface pinned rather than the app's.

    Read even where there is real glass, which costs nothing and keeps the
    two paths from drifting: the material path uses none of it.
  */
  const standIn = glassGround(ground);
  const backdrop = useGlassTarget();

  if (!LIQUID_GLASS) {
    // The wash and the sheen are the same either way; what changes is
    // whether there is a blur of the page underneath them.
    const Ground = blurred ? BlurView : View;
    return (
      <Ground
        {...(blurred
          ? {
              /*
                Three numbers that are not independent, and the one that
                matters is not the one it looks like.

                expo-blur derives the veil it paints over the blur from the
                intensity: `alpha = intensity / 100 × k`, where k is fixed
                per tint — 0.78 for the light one. So asking for a strong
                blur by raising the intensity also asks for a strong veil,
                and at 100 the surface came out four fifths white with the
                page behind it gone. The blur radius, meanwhile, is
                `intensity / blurReductionFactor`.

                So the intensity is kept low, for a veil of about a sixth,
                and the divisor is dropped to one to get the radius back.
                The tint is the thinnest of the ones on offer — the
                0.44 multiplier rather than the 0.78 — for the same reason.
              */
              tint: ground === "dark" ? FROST[frost].dark : FROST[frost].light,
              intensity:
                FROST[frost].intensity * (effect === "clear" ? 0.6 : 1),
              blurReductionFactor: FROST[frost].divisor,
              /*
                Android 12 and up only. Below that the library draws the
                page into a software canvas, which throws on the hardware
                bitmaps a page of photographs is made of — the crash this
                surface once went without a blur to avoid. There it keeps
                the tint alone, which is the flat wash it had before.
              */
              blurMethod: "dimezisBlurViewSdk31Plus" as const,
              // What to blur: the one handed in (a page's ground, see
              // `BlurBackdrop`), or the page it floats over (`Floating`).
              blurTarget: blurTarget ?? backdrop ?? undefined,
            }
          : null)}
        onLayout={onLayout}
        style={[
          {
            overflow: "hidden",
            /*
              Thinner where there is a blur under it.

              The wash and the blur are two ways of saying the same thing —
              that the surface is not a colour — and laid on together at
              full strength they cancel: the blur goes to work on a page
              that the wash has already covered up. Where the blur is doing
              that job the wash can step back to a hint, which is what
              leaves the surface reading as glass over a page rather than
              as a panel with a haze behind it.
            */
            /*
              Nothing of our own over a blur.

              The blur paints its own veil, above — so a wash here is a
              second one, and two translucent whites stacked is how a piece
              of glass becomes a panel. One surface, one opacity, and it is
              set by the intensity.
            */
            backgroundColor: blurred
              ? (tint ?? "transparent")
              : (tint ??
                (effect === "clear" ? standIn.frostClear : standIn.frost)),
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: standIn.rim,
          },
          style,
        ]}
      >
        {/*
          A tint over a blur, as a layer of its own.

          Set as the blur view's background it never shows: once the blur
          is on, expo-blur's Android view resets its own background to
          transparent, and the tint went with it. A child laid over the
          blur is drawn after it and stays.
        */}
        {blurred && tint != null && (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: tint }]}
          />
        )}
        {lit && (
          <LinearGradient
            colors={standIn.sheen as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        )}
        {children}
      </Ground>
    );
  }

  return (
    <GlassView
      glassEffectStyle={effect}
      isInteractive={interactive}
      colorScheme={ground}
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
