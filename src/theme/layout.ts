import { createContext, createElement, useContext } from "react";
import { Dimensions, Platform, useWindowDimensions } from "react-native";
import type { ViewStyle } from "react-native";

/**
 * How the app lays itself out on a tablet.
 *
 * Everything was drawn for a phone held upright, and on an iPad that
 * becomes cards a foot wide and lines of text too long to read. The rules
 * here are few, so every page answers them the same way:
 *
 * - Reading content — forms, detail pages, settings, a conversation — sits
 *   in a column no wider than `CONTENT_MAX`, centred, with the page's own
 *   background on either side. `readable` is that column.
 * - Lists of cards flow into columns once there is room: `columnsFor`.
 * - Maps and pictures stay full bleed; a map's sheet becomes a side panel.
 *
 * Measured from the window, not the device, so iPad split view and slide
 * over — a phone-width window on a tablet — lay out as the phone does.
 */

/** A tablet: the window is at least this wide on its short side. */
const TABLET_SHORT_SIDE = 600;

/*
  The widest a page's content grows — which is now as wide as the page.

  Detail pages, forms and settings used to sit in a centred column (720,
  or 640 for a form), so on an iPad they had a wide empty margin down each
  side while the four tabs ran to the page's own 24-point margin. The
  carer wanted the sub-pages spaced like the main ones, so the cap is
  lifted: everything that asked for a column now fills the page, inside
  GUTTER, like the tabs. The names stay so the places that meant "a
  column" are still findable if a cap is ever wanted back.
*/
export const CONTENT_MAX = 100000;
export const FORM_MAX = 100000;
/** A side panel beside a map, on a wide window. */
export const SIDE_PANEL = 420;

/**
 * How wide a map page's side panel is at this window: 420 across a
 * landscape iPad, 380 on an upright one — where a wider panel left the map
 * beside it narrower than the panel itself.
 */
export function useSidePanel(): number {
  return useLayout().landscape ? SIDE_PANEL : 380;
}

/** The device is a tablet, whatever its window is doing. */
export const IS_TABLET =
  Platform.OS === "ios"
    ? Platform.isPad
    : Math.min(
        Dimensions.get("screen").width,
        Dimensions.get("screen").height,
      ) >= TABLET_SHORT_SIDE;

/**
 * The page's own margin — how far everything stands in from the screen's
 * left and right edges.
 *
 * 16 on a phone, which is the app's SPACE.lg and UIKit's compact margin,
 * and 24 on a tablet: the 16 read as crowded against the edge of an iPad,
 * and the carer asked for 24. Only for the page's EDGE — a card's own
 * padding, the gap between two cards, a row inside a card stay on SPACE.
 * Settled by the device, not the window, so an iPad in split view keeps
 * its margin as the app is resized.
 */
export const GUTTER = IS_TABLET ? 24 : 16;

export type Layout = {
  width: number;
  height: number;
  /** Wider than a phone: 600 and up. */
  regular: boolean;
  /** Wide enough for a list beside its detail: 900 and up. */
  wide: boolean;
  landscape: boolean;
};

/**
 * The frame a page is drawn in, where that is not the window: a page sheet
 * on an iPad is a card in the middle of the screen. Provided by the
 * navigator (see `SheetFrame` in RootStack); null everywhere else.
 */
export const LayoutFrame = createContext<{
  width: number;
  height: number;
} | null>(null);

/** The window's size and what it is wide enough for. Re-renders on rotation. */
export function useLayout(): Layout {
  const window = useWindowDimensions();
  const { width, height } = useContext(LayoutFrame) ?? window;
  return {
    width,
    height,
    regular: width >= 600,
    wide: width >= 900,
    landscape: width > height,
  };
}

/**
 * How many columns a list of cards takes at this width: one on a phone,
 * two on a tablet held upright, three across a landscape iPad.
 */
export function columnsFor(width: number, minCard = 340): number {
  if (width < 600) return 1;
  return Math.max(1, Math.min(3, Math.floor(width / minCard)));
}

/**
 * The centred column reading content sits in. Spread into a style (a
 * ScrollView's `contentContainerStyle`, or a View wrapping the page):
 * on a phone it is the full width and changes nothing.
 */
export function readable(max: number = CONTENT_MAX): ViewStyle {
  return { width: "100%", maxWidth: max, alignSelf: "center" };
}

/**
 * The width of one card in a `columnsFor` grid, for a row that wraps:
 * `flexDirection: "row", flexWrap: "wrap", gap` on the parent.
 */
export function cardWidth(
  containerWidth: number,
  columns: number,
  gap: number,
): number {
  // Floored to a whole point. An exact share of an odd width is a
  // fraction, and the cards plus the gaps then summed to a hair over the
  // row — so the last card of each row wrapped, and an upright iPad showed
  // two across with a third of the row left empty.
  return Math.floor((containerWidth - gap * (columns - 1)) / columns);
}

/**
 * Every `Modal` turns with the tablet.
 *
 * iOS holds a Modal upright unless it is told which ways it may turn, so
 * on an iPad in landscape a sheet or a dialog came up sideways. The rule
 * goes on the module rather than at each of the dozen call sites, the way
 * the Android patches next door do: a prop that has to be remembered is a
 * prop the next Modal will be written without. A call site that passes its
 * own still wins. Phones are held upright by the Info.plist regardless.
 */
export function patchModalRotation(): void {
  const RN = require("react-native") as Record<string, unknown>;
  if ((RN.Platform as { OS: string }).OS !== "ios" || !IS_TABLET) return;
  const original = (RN.__atlasModalOriginal ??= RN.Modal) as never;
  // Required here, not imported: the theme module is loaded before any
  // component, and a component import at its top would be a cycle.
  const { NoHeaderSlot } = require("../components/ScreenFrame") as {
    NoHeaderSlot: (p: { children?: unknown }) => never;
  };
  const { DockedTray } = require("../components/ActionBar") as {
    DockedTray: (p: { children?: unknown }) => never;
  };
  const Rotating = ({
    children,
    ...props
  }: {
    presentationStyle?: string;
    children?: unknown;
  }) =>
    createElement(
      original,
      {
        supportedOrientations: [
          "portrait",
          "portrait-upside-down",
          "landscape-left",
          "landscape-right",
        ],
        ...props,
        /*
        And every sheet a centred card. A page sheet on an iPad is as wide
        as the screen held upright — so upright it came up as an edge-to-
        edge bottom sheet, and only sideways as a card. A form sheet is the
        card in the middle either way up.
      */
        ...(props.presentationStyle === "pageSheet" && {
          presentationStyle: "formSheet",
        }),
      },
      // A sheet is its own page: a tray inside it stays inside it rather
      // than moving up into the header of the page behind, and sits in it
      // as a footer rather than floating over it (see ActionBar).
      createElement(
        NoHeaderSlot,
        null,
        createElement(DockedTray, null, children as never),
      ),
    );
  Object.defineProperty(RN, "Modal", {
    configurable: true,
    get: () => Rotating,
  });
}
