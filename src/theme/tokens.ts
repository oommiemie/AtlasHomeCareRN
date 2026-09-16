/**
 * Design tokens — the colours, radii and spacing the whole app shares.
 *
 * Ported from the Flutter build's design system, which took its values from
 * the Figma file. Anything measured off a rendered Figma export rather than
 * read out of a layer panel is marked, because the two disagree often enough
 * to matter.
 */
import { Platform, type ViewStyle } from "react-native";

// Brand blues.
export const PRIMARY_900 = "#041228";
export const PRIMARY_700 = "#004078";
export const PRIMARY_500 = "#077DD7";
export const PRIMARY_300 = "#339FF3";
export const PRIMARY_100 = "#E9F0F9";

// Accents. The mid greens fail contrast on a pale tile, so figures that must
// read at a glance use SECONDARY_900.
export const SECONDARY_900 = "#0D5E4A";
export const SECONDARY_700 = "#1D8B6B";
export const SECONDARY_500 = "#46D8AD";

export const SUCCESS = "#34C759";
export const DANGER = "#FF383C";
export const WARNING = "#B45309";

// Text and surfaces.
/*
  One black for text, and it is the one the designs are drawn in.

  There were three doing this job: this token at #1E293B — a slate, faintly
  blue — and #111111 and #1A1A1A written by hand in fifty places between
  them. Set side by side the slate is visibly cooler than the other two, so
  a screen built from tokens and a screen built from the Figma fill did not
  match. Figma says #111111 every time, so that is what this is now, and
  the hand-written ones have been folded into it.
*/
export const TEXT_PRIMARY = "#111111";
/** Between the black and the muted grey — neutral, to match them. */
export const TEXT_SECONDARY = "#444444";
export const TEXT_MUTED = "#666666";

/**
 * What an empty field says, and how faint it has to be.
 *
 * The muted grey a label is set in was doing this job too, and at #666 a
 * placeholder is as black as a typed value — you cannot tell across a form
 * which boxes have been filled in without reading every one of them. This
 * is light enough that the difference is the first thing you see and dark
 * enough to still read as text: 3.1:1 on the field's own grey, above the
 * 3:1 that non-essential text needs.
 */
export const TEXT_PLACEHOLDER = "#A9A9AE";
export const TEXT_DISABLED = "#8A8F97";

export const CANVAS = "#F5F7FA";
export const SURFACE = "#FFFFFF";
export const GROUPED_BG = "#F2F2F7";
/**
 * The hairline between rows inside a card — Figma's own, #CCCCCC at 40%.
 *
 * Three of these were in use: this one at black 8%, and #CCCCCC at 20% and
 * at 40% typed into six screens. They are within a few per cent of each
 * other on white and none of them was wrong; having three was.
 */
export const SEPARATOR = "rgba(204,204,204,0.4)";

// Spacing — the 4pt scale the Flutter build used.
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

// Radii. Cards are 24 throughout; the capsule is for pills and round buttons.
export const RADIUS = { sm: 8, md: 12, lg: 16, card: 24, capsule: 999 } as const;

/** The 44pt floor every tap target has to clear. */
export const TOUCH_MIN = 44;

/**
 * Real Liquid Glass is a UIKit material that exists only on iOS 26+. Below
 * that — and on Android — expo-glass-effect renders a background-less view,
 * so controls would lose their surface entirely. Everything glass checks this
 * and falls back to an opaque stand-in.
 */
export const LIQUID_GLASS =
  Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;

/** Floating bars and pills: real glass where it exists, white where it doesn't. */
export const GLASS_BAR_TINT = LIQUID_GLASS ? undefined : "#FFFFFF";

/** A translucent tint under real glass, an opaque stand-in everywhere else. */
export const glassTint = (real: string, fallback: string) =>
  LIQUID_GLASS ? real : fallback;

/** The soft two-layer shadow the cards carry. */
export const cardShadow = (elevation = 3): ViewStyle =>
  Platform.OS === "ios"
    ? ({
        shadowColor: "#1E293B",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      } as ViewStyle)
    : { elevation, backgroundColor: SURFACE };
