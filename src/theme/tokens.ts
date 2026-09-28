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
/**
 * The deep blue, and the one exception to "brand colours do not move".
 *
 * It is never a fill anywhere in the app — it is the ink a figure, a price
 * or a shortcut's glyph is set in, always on a pale card. At #004078 on
 * #1C1C1E that is 1.1:1, which is not dim, it is gone. So on the dark ground
 * it lightens to the same blue at the other end of the ramp. The hue is what
 * carries the brand; the lightness belongs to the ground.
 */
export let PRIMARY_700 = "#004078";
export const PRIMARY_500 = "#077DD7";
export const PRIMARY_300 = "#339FF3";
/** Set by the theme — the pale blue a chip or a tinted block is filled with. */
export let PRIMARY_100 = "#E9F0F9";

// Accents. The mid greens fail contrast on a pale tile, so figures that must
// read at a glance use SECONDARY_900.
export let SECONDARY_900 = "#0D5E4A";
export const SECONDARY_700 = "#1D8B6B";
export const SECONDARY_500 = "#46D8AD";

export const SUCCESS = "#34C759";
export const DANGER = "#FF383C";
export let WARNING = "#B45309";

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
export let TEXT_PRIMARY = "#111111";
/** Between the black and the muted grey — neutral, to match them. */
export let TEXT_SECONDARY = "#444444";
export let TEXT_MUTED = "#666666";

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
export let TEXT_PLACEHOLDER = "#A9A9AE";
export let TEXT_DISABLED = "#8A8F97";

export let CANVAS = "#F5F7FA";
export let SURFACE = "#FFFFFF";
export let GROUPED_BG = "#F2F2F7";
/**
 * The hairline between rows inside a card — Figma's own, #CCCCCC at 40%.
 *
 * Three of these were in use: this one at black 8%, and #CCCCCC at 20% and
 * at 40% typed into six screens. They are within a few per cent of each
 * other on white and none of them was wrong; having three was.
 */
export let SEPARATOR = "rgba(204,204,204,0.4)";

/**
 * The rest of the neutral vocabulary, so a screen never has to write one of
 * these by hand. Each was a literal typed into a handful of screens before
 * there was a dark ground for them to be wrong on.
 */
/** An inset well inside a card — a read-only field, a chart's ground. */
export let SURFACE_SUNK = "#EDEDED";
/** The system's own translucent fill, for search fields and plain chips. */
export let FILL_SUBTLE = "rgba(120,120,128,0.16)";
/**
 * The tile a reading or a chart is drawn on.
 *
 * The design's pale blue on a white page. On a dark one it is not that blue
 * darkened — a tinted tile on a dark card reads as a navy patch, and the
 * card stops being the thing the eye lands on. It is a haze of the page's
 * own light instead, which is what lifts a tile off a dark ground.
 */
export let TINT_BG = "#F4FAFF";
/** A fault's ground, and the ink that reads on it. */
export let DANGER_BG = "#FFEDED";
export let DANGER_INK = "#991B1B";
/** A caution's ground — the same block, one step short of a fault. */
export let WARNING_BG = "#FFF7ED";
/** A floating panel over a map or a wash, where glass is not available. */
export let PANEL = "rgba(255,255,255,0.92)";

/**
 * The washes, which are as much the app's ground as the canvas is.
 *
 * A gradient painted in daylight blue behind a dark page is the one thing
 * that would still shout after every surface had been darkened, so these
 * turn with the rest — deep navy rather than sky, ending in the same black
 * the page is on.
 */
/** The four-stop ramp behind a tab screen's header. */
export let WASH_HEADER: readonly string[] = [
  "#3F82D2",
  "#5C9FDD",
  "#7FBAE6",
  "#AECDE9",
];
/** The full-strength ramp the plan calendar sits on. */
export let WASH_DEEP: readonly string[] = ["#077DD7", "#044271"];
/** The pale band behind a pushed screen's header, which fades to nothing. */
export let WASH_TINT = "#C1E2FF";
/** A soft blue field behind a form. */
export let WASH_SOFT: readonly string[] = [
  "rgba(136,207,255,0.2)",
  "rgba(173,217,255,0.2)",
];
/**
 * Which ramp a section panel is filled with.
 *
 * Three of them, because the panels are not interchangeable: each service
 * has one, and a carer who has tapped through to งานตรวจสุขภาพ should be
 * able to tell at a glance that they are not on งานวัคซีน. Named for the
 * colour rather than the service — this file knows about paint, and the
 * screens know which service wears which.
 */
export type PanelTone = "violet" | "mint" | "peach" | "sky";

/**
 * The three-stop ramp a section panel is filled with.
 *
 * White at the head, deepening to the service's own colour at the foot. It
 * was turned over for a while — colour at the top, fading out under the
 * deck — and this way round reads better: the heading sits on the page's
 * own surface, the shelf gets darker the further down it goes, and the
 * white card on top of it is lifted by the contrast rather than dissolving
 * into a white foot.
 *
 * The stops are far from evenly spaced: the middle one sits at four fifths,
 * so most of the panel is the page's own surface and the colour arrives as
 * a band along the foot. A shelf that is mostly white keeps the heading,
 * the drawing and the cards on ground of their own — the colour is there to
 * say which service this is, and it says it as well in a hand's breadth as
 * it does over the whole panel.
 */
export let WASH_PANEL: Record<PanelTone, readonly string[]> = {
  violet: ["#FFFFFF", "#EBE7FF", "#CEC5FB"],
  mint: ["#FFFFFF", "#DBF3EA", "#A9E3CE"],
  peach: ["#FFFFFF", "#FFEEE2", "#FFD4B8"],
  sky: ["#FFFFFF", "#E2F1FE", "#BBDEFB"],
};
/** Where those three stops fall. */
export const WASH_PANEL_STOPS = [0, 0.8, 1] as const;

/*
  The saturated end of each panel tone — the ink a service's own work is
  drawn in when it has to read as a line rather than as a wash.

  WASH_PANEL is a background: three stops of white falling into a tint,
  which is exactly what a panel behind a deck of cards wants and exactly
  what an arc six points wide cannot be seen in. These are the same three
  hues at full strength, so a violet arc on the day summary and the violet
  panel over the vaccination round are recognisably the one service.

  Brand hues, not theme colours: they carry the same meaning on either
  ground and are read against the card, which the theme moves underneath
  them.
*/
export const TONE_INK: Record<PanelTone, string> = {
  violet: "#AF52DE",
  mint: "#34C759",
  peach: "#FFA08D",
  sky: "#38BDF8",
};
/**
 * The sheet the plan screen's list sits on — the ground, not a surface.
 *
 * It has to stay a step BELOW the cards standing on it. On the white page
 * that is a 5% grey plus each card's shadow; on a dark one there is no
 * shadow to see, so the only thing separating a card from its ground is
 * that the card is lighter. Set to the same #1C1C1E as SURFACE, every card
 * on the plan screen vanished into the sheet.
 */
export let SHEET = "#F5F5F5";
/** The canvas at nothing, for a gradient that dissolves into the page. */
export let CANVAS_CLEAR = "rgba(245,247,250,0)";

/**
 * The page's own ground, from nothing to all of it.
 *
 * What a list dissolves into as it reaches the bottom of the screen — the
 * scroll edge, which iOS 26 draws for itself under a floating tab bar and
 * which has to be drawn here everywhere else. The page's colour rather
 * than white, so the ramp ends in the ground it is standing on and there
 * is no seam where it finishes.
 *
 * Six stops, eased. A straight two-stop ramp fades at a constant rate and
 * the eye reads both ends of it as edges — a band lying over the cards,
 * which is the thing this exists to avoid.
 */
export let CANVAS_FADE: readonly string[] = [
  "rgba(245,247,250,0)",
  "rgba(245,247,250,0.18)",
  "rgba(245,247,250,0.48)",
  "rgba(245,247,250,0.78)",
  "rgba(245,247,250,0.96)",
  "rgba(245,247,250,1)",
];
/** The lit rim along a floating panel's edge, catching the light above it. */
export let RIM_LIT = "rgba(255,255,255,0.9)";
/**
 * What lifts a label off map tiles.
 *
 * A halo rather than a plate: over busy tiles a filled chip reads as another
 * pin. It has to be the opposite of the ink it surrounds, so it turns.
 */
export let HALO = "rgba(255,255,255,0.95)";
/** The blurred plate a floating tray is cut from, under whatever stands on it. */
export let PLATE = "rgba(255,255,255,0.5)";
/**
 * The same plate, where the blur under it is the weaker of the two.
 *
 * On iOS the tray stands on UIBlurEffect at 80, which dissolves a page of
 * running text by itself; the plate over it is body, and the design's own
 * half-white is what it asks for. Android's blur is bought differently —
 * one number drives the radius AND the veil it paints, so a hard blur
 * cannot be had without a white slab arriving with it, and the radius is
 * won back by keeping the intensity low. Half a plate on top of that veil
 * was two coats of white: the tray came out as a painted slab with the
 * page nowhere in it, which is the one thing a floating bar must not be.
 *
 * Thinner, so what is behind the bar is blurred rather than covered up.
 */
export let PLATE_SHEER = "rgba(255,255,255,0.18)";
/** A veil over glass that carries no colour of its own, for a touch more body. */
export let GLASS_NEUTRAL = "rgba(255,255,255,0.45)";
/**
 * The ramp that lifts a toolbar off a map.
 *
 * Eased across five stops rather than two: a straight ramp fades at a
 * constant rate and the eye reads the end of it as an edge — a band lying on
 * the map. It is the page's own ground at five strengths, so it turns with
 * the map beneath it.
 */
export let SCRIM: readonly string[] = [
  "rgba(255,255,255,0.88)",
  "rgba(255,255,255,0.78)",
  "rgba(255,255,255,0.48)",
  "rgba(255,255,255,0.18)",
  "rgba(255,255,255,0)",
];
/** The tint a glass control wears while its action is unavailable. */
export let GLASS_OFF = "rgba(199,205,212,0.7)";
/** The two-stop groove a gauge's unfilled track is sculpted into. */
export let GROOVE: readonly string[] = ["#D2DAE4", "#EDF1F6"];

/**
 * Status inks.
 *
 * These break the rule below that colour carrying meaning does not move,
 * and they have to: a status is its hue, not its lightness. A bottle green
 * that reads on white is unreadable on #1C1C1E, so the hue is held and the
 * lightness is flipped — which is what the system's own colours do.
 * Overdue's ink is DANGER_BG's partner, DANGER_INK; "pending" is
 * PRIMARY_700, which turns for the same reason.
 */
export let INK_OK = "#15803D";

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
export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  card: 24,
  capsule: 999,
} as const;

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

/**
 * What a glass surface is painted where there is no glass.
 *
 * Translucent, not opaque. Where the material is missing the app blurs
 * what is behind instead — frosted glass rather than clear — and this is
 * the wash laid over that blur: enough to lift the control off the page
 * and keep text on it readable, thin enough that the blur still shows
 * through. Painted opaque it would cover the blur and the control would
 * be a flat slab again, which is what it was before.
 */
export let GLASS_STANDIN = "rgba(255,255,255,0.78)";

/**
 * The thinner frost, for glass that has to be seen through.
 *
 * Apple's "clear" material, where the page under the glass still has to be
 * read — a highlight lying over a calendar rather than a control standing
 * on one. Paved at the regular weight it would simply hide the dates.
 */
export let GLASS_STANDIN_CLEAR = "rgba(255,255,255,0.42)";

/**
 * The sheen down a frosted surface, top to bottom.
 *
 * What is left of glass when there is nothing to refract: the light it
 * catches along its own top edge. Paired with the translucent wash above
 * it, it is the difference between a pane and a painted rectangle.
 */
export let GLASS_SHEEN: readonly string[] = [
  "rgba(255,255,255,0.72)",
  "rgba(255,255,255,0.10)",
];

/** A translucent tint under real glass, an opaque stand-in everywhere else. */
export const glassTint = (real: string, fallback: string) =>
  LIQUID_GLASS ? real : fallback;

/**
 * A drop shadow both platforms draw the same way.
 *
 * React Native's `shadowColor`/`shadowOffset`/`shadowOpacity`/`shadowRadius`
 * are iOS only, and `elevation` is Android only — a different mechanism
 * entirely, which lifts the view on the platform's own z axis and lets the
 * system decide what that looks like. The result was two apps: soft,
 * wide-blurred, blue-black shadows on one, and Material's tight neutral-grey
 * lift on the other, under every card, pill and floating bar in the app.
 *
 * `boxShadow` is CSS's, is understood by both renderers under the New
 * Architecture, and takes the same four numbers — so one declaration
 * produces one shadow.
 *
 * The blur is doubled on the way out. iOS's `shadowRadius` is the Gaussian's
 * standard deviation; CSS's blur-radius is twice that, and both renderers
 * follow CSS here. Call sites keep the number the design was drawn to and
 * this does the conversion, so nothing had to be re-eyeballed.
 */
/**
 * The lift a glass control needs where there is no material to carry it.
 *
 * Apple's Liquid Glass draws its own rim, highlight and inner shadow, so a
 * control made of it needs nothing underneath: the callers that draw this
 * gate it on `hasGlass()` and draw none where the material is real. Off it
 * — all of Android, and every iPhone below 26 — the stand-in is a flat
 * wash, and a wash on a pale header is a shape with no edge. This is what
 * puts the edge back.
 *
 * Deliberately lighter than it first was. At fourteen of blur and 0.28 of
 * the deep blue it was not a lift, it was Material's elevation: a dark
 * halo under the back button and the toolbar that no iPhone has ever
 * drawn, and the one thing on those headers that announced which platform
 * the app was running on. Enough to sit the control above the page, and no
 * more.
 *
 * One object rather than the same four numbers written at each control,
 * because they are one decision and were drifting apart already.
 */
export const GLASS_LIFT = {
  blur: 10,
  y: 3,
  color: PRIMARY_900,
  opacity: 0.12,
} as const;

export const shadow = ({
  /** The iOS `shadowRadius` the design was drawn with. */
  blur,
  y,
  x = 0,
  color = "#000000",
  opacity,
}: {
  blur: number;
  y: number;
  x?: number;
  color?: string;
  opacity: number;
}): string => {
  /*
    Callable from an animated style, which is compiled to run on the UI
    thread — where a plain JS function cannot be reached at all:
    "Tried to synchronously call a non-worklet function `shadow`". A shadow
    that fades in under a dragging finger is exactly where this is wanted.

    Which is also why the colour is unpacked here rather than in a helper
    next door: a worklet reaches nothing outside itself, and calling one
    left `rgba is not a function` at the first import.
  */
  "worklet";
  const h = color.replace("#", "");
  const full =
    h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h.slice(0, 6);
  const n = parseInt(full, 16);
  const rgb = `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  return `${x}px ${y}px ${blur * 2}px rgba(${rgb}, ${opacity})`;
};

/**
 * The two palettes, and the switch between them.
 *
 * Only the neutrals move. The brand blues, the greens and the reds mean the
 * same thing on either ground and are left alone — a status that changed
 * colour with the theme would stop being a status.
 *
 * The values above are declared with `let` and reassigned here rather than
 * read out of a context. Every style in this app is written inline and
 * evaluated as its component renders — there is not one `StyleSheet.create`
 * in the whole of `src` — so a module binding that changes, plus a remount,
 * reaches every colour in the app without a single call site being touched.
 */
export type ThemeMode = "light" | "dark";

type Neutrals = {
  TEXT_PRIMARY: string;
  WASH_HEADER: readonly string[];
  WASH_DEEP: readonly string[];
  WASH_TINT: string;
  WASH_SOFT: readonly string[];
  WASH_PANEL: Record<PanelTone, readonly string[]>;
  SHEET: string;
  CANVAS_CLEAR: string;
  CANVAS_FADE: readonly string[];
  RIM_LIT: string;
  GLASS_FROST: string;
  GLASS_FROST_CLEAR: string;
  GLASS_SHEEN: readonly string[];
  HALO: string;
  PLATE: string;
  PLATE_SHEER: string;
  GLASS_NEUTRAL: string;
  GLASS_OFF: string;
  SCRIM: readonly string[];
  GROOVE: readonly string[];
  INK_OK: string;
  PRIMARY_700: string;
  SECONDARY_900: string;
  WARNING: string;
  SURFACE_SUNK: string;
  FILL_SUBTLE: string;
  TINT_BG: string;
  DANGER_BG: string;
  DANGER_INK: string;
  WARNING_BG: string;
  PANEL: string;
  TEXT_SECONDARY: string;
  TEXT_MUTED: string;
  TEXT_PLACEHOLDER: string;
  TEXT_DISABLED: string;
  CANVAS: string;
  SURFACE: string;
  GROUPED_BG: string;
  SEPARATOR: string;
  PRIMARY_100: string;
};

const LIGHT: Neutrals = {
  TEXT_PRIMARY: "#111111",
  WASH_HEADER: ["#3F82D2", "#5C9FDD", "#7FBAE6", "#AECDE9"],
  WASH_DEEP: ["#077DD7", "#044271"],
  WASH_TINT: "#C1E2FF",
  WASH_SOFT: ["rgba(136,207,255,0.2)", "rgba(173,217,255,0.2)"],
  WASH_PANEL: {
    violet: ["#FFFFFF", "#EBE7FF", "#CEC5FB"],
    mint: ["#FFFFFF", "#DBF3EA", "#A9E3CE"],
    peach: ["#FFFFFF", "#FFEEE2", "#FFD4B8"],
    sky: ["#FFFFFF", "#E2F1FE", "#BBDEFB"],
  },
  SHEET: "#F5F5F5",
  CANVAS_CLEAR: "rgba(245,247,250,0)",
  CANVAS_FADE: [
    "rgba(245,247,250,0)",
    "rgba(245,247,250,0.18)",
    "rgba(245,247,250,0.48)",
    "rgba(245,247,250,0.78)",
    "rgba(245,247,250,0.96)",
    "rgba(245,247,250,1)",
  ],
  RIM_LIT: "rgba(255,255,255,0.9)",
  GLASS_FROST: "rgba(255,255,255,0.78)",
  GLASS_FROST_CLEAR: "rgba(255,255,255,0.42)",
  GLASS_SHEEN: ["rgba(255,255,255,0.72)", "rgba(255,255,255,0.10)"],
  HALO: "rgba(255,255,255,0.95)",
  PLATE: "rgba(255,255,255,0.5)",
  PLATE_SHEER: "rgba(255,255,255,0.18)",
  GLASS_NEUTRAL: "rgba(255,255,255,0.45)",
  GLASS_OFF: "rgba(199,205,212,0.7)",
  SCRIM: [
    "rgba(255,255,255,0.88)",
    "rgba(255,255,255,0.78)",
    "rgba(255,255,255,0.48)",
    "rgba(255,255,255,0.18)",
    "rgba(255,255,255,0)",
  ],
  GROOVE: ["#D2DAE4", "#EDF1F6"],
  INK_OK: "#15803D",
  PRIMARY_700: "#004078",
  SECONDARY_900: "#0D5E4A",
  WARNING: "#B45309",
  SURFACE_SUNK: "#EDEDED",
  FILL_SUBTLE: "rgba(120,120,128,0.16)",
  TINT_BG: "#F4FAFF",
  DANGER_BG: "#FFEDED",
  DANGER_INK: "#991B1B",
  WARNING_BG: "#FFF7ED",
  PANEL: "rgba(255,255,255,0.92)",
  TEXT_SECONDARY: "#444444",
  TEXT_MUTED: "#666666",
  TEXT_PLACEHOLDER: "#A9A9AE",
  TEXT_DISABLED: "#8A8F97",
  CANVAS: "#F5F7FA",
  SURFACE: "#FFFFFF",
  GROUPED_BG: "#F2F2F7",
  SEPARATOR: "rgba(204,204,204,0.4)",
  PRIMARY_100: "#E9F0F9",
};

/**
 * Apple's own dark greys rather than a black page.
 *
 * The washes are the exception to "just darken it". Taken all the way down
 * they measured the same lightness as the sheet that sits on them — the
 * calendar's tail was 0.9x #1C1C1E — so the edge where the page begins
 * stopped existing and the whole screen read as one dark mass. They are
 * held three to five times the sheet instead: dark enough for a dark
 * theme, blue enough to still be the header rather than the page.
 *
 * #1C1C1E for a raised surface on a near-black ground is what every system
 * app does, and it is what lets a card read as a card at all — on pure
 * black a white-bordered rectangle is the only thing that would.
 */
const DARK: Neutrals = {
  TEXT_PRIMARY: "#F2F2F7",
  WASH_HEADER: ["#0E4878", "#0C3F6A", "#092C4A", "#04121E"],
  WASH_DEEP: ["#0A5C9E", "#07395E"],
  WASH_TINT: "#123F6B",
  WASH_SOFT: ["rgba(7,125,215,0.24)", "rgba(7,125,215,0.12)"],
  /*
    Not the daylight ramp darkened — a haze of the page's own blue.

    A white-to-sky panel on a near-black page is a lit rectangle with dark
    cards sitting on it, which inverts the whole point of the thing. Kept
    translucent so the canvas shows through and the panel stays a shade of
    the ground rather than a surface of its own.
  */
  /*
    The same ramp on a dark page, where "from white" is "from nothing".

    A panel starting at white on a near-black ground would be a lit slab at
    the head of it; what the daylight ramp actually does is start at the
    page's own surface, so here it starts at the page.
  */
  WASH_PANEL: {
    violet: [
      "rgba(255,255,255,0.04)",
      "rgba(124,107,245,0.20)",
      "rgba(124,107,245,0.32)",
    ],
    mint: [
      "rgba(255,255,255,0.04)",
      "rgba(70,216,173,0.16)",
      "rgba(70,216,173,0.28)",
    ],
    peach: [
      "rgba(255,255,255,0.04)",
      "rgba(245,158,11,0.16)",
      "rgba(245,158,11,0.30)",
    ],
    sky: [
      "rgba(255,255,255,0.04)",
      "rgba(56,189,248,0.16)",
      "rgba(56,189,248,0.30)",
    ],
  },
  SHEET: "#000000",
  CANVAS_CLEAR: "rgba(0,0,0,0)",
  CANVAS_FADE: [
    "rgba(0,0,0,0)",
    "rgba(0,0,0,0.18)",
    "rgba(0,0,0,0.48)",
    "rgba(0,0,0,0.78)",
    "rgba(0,0,0,0.96)",
    "rgba(0,0,0,1)",
  ],
  RIM_LIT: "rgba(255,255,255,0.14)",
  GLASS_FROST: "rgba(28,28,30,0.72)",
  GLASS_FROST_CLEAR: "rgba(28,28,30,0.40)",
  GLASS_SHEEN: ["rgba(255,255,255,0.14)", "rgba(255,255,255,0.02)"],
  HALO: "rgba(0,0,0,0.92)",
  PLATE: "rgba(28,28,30,0.55)",
  PLATE_SHEER: "rgba(28,28,30,0.24)",
  GLASS_NEUTRAL: "rgba(120,120,128,0.30)",
  GLASS_OFF: "rgba(72,72,76,0.7)",
  SCRIM: [
    "rgba(0,0,0,0.88)",
    "rgba(0,0,0,0.78)",
    "rgba(0,0,0,0.48)",
    "rgba(0,0,0,0.18)",
    "rgba(0,0,0,0)",
  ],
  GROOVE: ["#242426", "#3A3A3C"],
  INK_OK: "#5BD98A",
  PRIMARY_700: "#79C0FF",
  SECONDARY_900: "#5AD6B0",
  WARNING: "#FFB340",
  SURFACE_SUNK: "#2C2C2E",
  FILL_SUBTLE: "rgba(120,120,128,0.32)",
  TINT_BG: "rgba(255,255,255,0.10)",
  DANGER_BG: "rgba(255,56,60,0.20)",
  DANGER_INK: "#FF9EA1",
  WARNING_BG: "rgba(255,159,10,0.20)",
  PANEL: "rgba(28,28,30,0.92)",
  TEXT_SECONDARY: "#C7C7CC",
  TEXT_MUTED: "#98989F",
  TEXT_PLACEHOLDER: "#6C6C70",
  TEXT_DISABLED: "#6E6E73",
  CANVAS: "#000000",
  SURFACE: "#1C1C1E",
  GROUPED_BG: "#2C2C2E",
  SEPARATOR: "rgba(84,84,88,0.65)",
  PRIMARY_100: "rgba(7,125,215,0.22)",
};

let theme: ThemeMode = "light";

/** Which ground the app is painting on right now. */
export const currentTheme = (): ThemeMode => theme;

/**
 * The stand-in glass of a NAMED ground, rather than of the app's own.
 *
 * `colorScheme` on a glass surface is a pin, not a preference. It is set
 * where the surface has to be dark whatever the app is set to, because of
 * what it stands on and what is written on it: the shutter ring over a
 * camera feed, the สถานพยาบาล card on the deep blue of the account page.
 * Both carry white.
 *
 * The mutable tokens above cannot answer that. They are repainted by
 * `applyTheme` and hold one ground at a time — the app's — so a surface
 * asking to differ from it reads the light frost, the light rim and the
 * seven-tenths-white sheen, and the white on it disappears. That is what
 * happened on Android and on any iPhone below iOS 26, where there is no
 * material and the stand-in is all there is.
 *
 * So the palettes are read directly here, by name.
 */
export function glassGround(mode: ThemeMode): {
  frost: string;
  frostClear: string;
  sheen: readonly string[];
  rim: string;
} {
  const p = mode === "dark" ? DARK : LIGHT;
  return {
    frost: p.GLASS_FROST,
    frostClear: p.GLASS_FROST_CLEAR,
    sheen: p.GLASS_SHEEN,
    rim: p.RIM_LIT,
  };
}

/** Repaint the neutrals. The caller remounts so every screen reads them again. */
export function applyTheme(mode: ThemeMode): void {
  theme = mode;
  const p = mode === "dark" ? DARK : LIGHT;
  TEXT_PRIMARY = p.TEXT_PRIMARY;
  TEXT_SECONDARY = p.TEXT_SECONDARY;
  TEXT_MUTED = p.TEXT_MUTED;
  TEXT_PLACEHOLDER = p.TEXT_PLACEHOLDER;
  TEXT_DISABLED = p.TEXT_DISABLED;
  CANVAS = p.CANVAS;
  SURFACE = p.SURFACE;
  GROUPED_BG = p.GROUPED_BG;
  SEPARATOR = p.SEPARATOR;
  PRIMARY_100 = p.PRIMARY_100;
  SURFACE_SUNK = p.SURFACE_SUNK;
  FILL_SUBTLE = p.FILL_SUBTLE;
  TINT_BG = p.TINT_BG;
  DANGER_BG = p.DANGER_BG;
  DANGER_INK = p.DANGER_INK;
  WARNING_BG = p.WARNING_BG;
  PANEL = p.PANEL;
  WASH_HEADER = p.WASH_HEADER;
  WASH_DEEP = p.WASH_DEEP;
  WASH_TINT = p.WASH_TINT;
  WASH_SOFT = p.WASH_SOFT;
  WASH_PANEL = p.WASH_PANEL;
  SHEET = p.SHEET;
  CANVAS_CLEAR = p.CANVAS_CLEAR;
  CANVAS_FADE = p.CANVAS_FADE;
  RIM_LIT = p.RIM_LIT;
  GLASS_STANDIN = p.GLASS_FROST;
  GLASS_STANDIN_CLEAR = p.GLASS_FROST_CLEAR;
  GLASS_SHEEN = p.GLASS_SHEEN;
  HALO = p.HALO;
  PLATE = p.PLATE;
  PLATE_SHEER = p.PLATE_SHEER;
  GLASS_NEUTRAL = p.GLASS_NEUTRAL;
  GLASS_OFF = p.GLASS_OFF;
  SCRIM = p.SCRIM;
  GROOVE = p.GROOVE;
  INK_OK = p.INK_OK;
  PRIMARY_700 = p.PRIMARY_700;
  SECONDARY_900 = p.SECONDARY_900;
  WARNING = p.WARNING;
}
