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
export const TEXT_PRIMARY = "#1E293B";
export const TEXT_SECONDARY = "#475569";
export const TEXT_MUTED = "#666666";
export const TEXT_DISABLED = "#8A8F97";

export const CANVAS = "#F5F7FA";
export const SURFACE = "#FFFFFF";
export const GROUPED_BG = "#F2F2F7";
export const SEPARATOR = "rgba(0,0,0,0.08)";

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
