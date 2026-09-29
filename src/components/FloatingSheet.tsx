import { useRef, type ReactNode } from "react";
import { Animated, PanResponder, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Glass } from "./Glass";
import { FILL_SUBTLE, GROUPED_BG, PLATE, SPACE, shadow } from "../theme/tokens";
import { GUTTER, useLayout, useSidePanel } from "../theme/layout";
import { tr } from "../i18n";

/**
 * Whether a map page's sheet is a side panel here rather than a sheet.
 *
 * On a tablet, either way up, a sheet across the foot of the map would be
 * a strip a foot long covering the half of the map the carer wants to see.
 * So there the list stands up the left-hand side instead, `SIDE_PANEL` wide
 * and as tall as the screen allows, and the map fills the rest — upright
 * as well as on its side, so the page looks the same whichever way the
 * iPad is held. A phone, or an iPad window narrowed to a phone's width in
 * split view, keeps the sheet.
 *
 * The page asks this too: in a panel there is nothing to drag — no grab
 * band, no detents, no dimming as it rises — and the map's own framing has
 * to leave `usePanelClearance()` free on the left.
 */
export function useSheetAsPanel(): boolean {
  return useLayout().regular;
}

/** The panel's margin from the screen's edges — the back button's own. */
const PANEL_MARGIN = GUTTER;
/**
 * Where the panel's top stops, below the safe area: under the map page's
 * 48pt back button, which sits `SPACE.sm` down at the same left edge.
 */
export const PANEL_TOP = SPACE.sm + 48 + SPACE.md;
/**
 * How much of the map's left the panel covers, margins included — for the
 * page's `edgePadding.left` and for anything floated over the map.
 */
export function usePanelClearance(): number {
  return PANEL_MARGIN + usePanelWidth() + PANEL_MARGIN;
}

/** The panel's width at this window — see `useSidePanel`. */
export function usePanelWidth(): number {
  return useSidePanel();
}

/**
 * How short the panel folds to: the search field, the heading and the
 * first card or two of the list — enough to work from, with most of the
 * map above it. 350, as the carer asked.
 */
const PANEL_FOLDED = 350;

/**
 * The band across the panel's top the handle sits in: the phone sheet's
 * own — eight, the four-point bar, eight — so the bar stands the same
 * distance off the search field under it as it does on a phone. The page
 * leaves this much room at the top of its panel content.
 */
export const PANEL_HANDLE = SPACE.sm + 4 + SPACE.sm;

/**
 * The sheet a map page keeps its list in — the design's `Madal`, in its two
 * states.
 *
 * Resting, it is a floating card: 8pt clear of each edge, 36 round across
 * the top and 58 along the bottom, white at half strength over the glass,
 * with a shadow lifting it off the map. Pulled to full it is the design's
 * `Sheet - Full Screen`: edge to edge, square along the bottom, 38 across
 * the top, and the page's own opaque grey — at that size there is no map
 * left behind it worth refracting.
 *
 * The shadow is drawn by the outer view, not by the glass: the glass clips
 * to its corners, and a view that clips cuts its own shadow away. A
 * shadow takes the shape of the view that casts it, so the outer view has
 * the glass's corners too. The two map pages each drew it and gave only the
 * glass its corners, so the map showed a square shadow standing out past
 * every rounded corner of the card.
 */
export function FloatingSheet({
  expanded,
  height,
  children,
}: {
  /** Pulled to full height. Ignored in a panel, which is always full. */
  expanded: boolean;
  /**
   * The sheet's height, driven by the page's drag. Ignored in a panel —
   * see `useSheetAsPanel`.
   */
  height: Animated.Value | Animated.AnimatedInterpolation<number>;
  children: ReactNode;
}) {
  const panel = useSheetAsPanel();
  const panelWidth = usePanelWidth();
  const { height: windowHeight } = useLayout();
  const insets = useSafeAreaInsets();

  /*
    The panel folds down and opens up, as the phone's sheet does — dragged
    by the handle along its top. It stands on its foot, so pulling the top
    down folds it to the search field and the heading and hands the map
    the rest of the screen; pulling it up opens it to the full height.
    Let go, it settles on whichever is nearer, or the way it was flicked.
  */
  const full =
    windowHeight - insets.top - PANEL_TOP - insets.bottom - PANEL_MARGIN;
  const tall = useRef(new Animated.Value(full)).current;
  const at = useRef(full);
  const live = useRef(full);
  if (live.current !== full) {
    // A turned iPad: open again at its new full height.
    live.current = full;
    at.current = full;
    tall.setValue(full);
  }
  const fold = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 2,
      onPanResponderMove: (_e, g) => {
        tall.setValue(
          Math.max(PANEL_FOLDED, Math.min(live.current, at.current - g.dy)),
        );
      },
      onPanResponderRelease: (_e, g) => {
        const now = Math.max(
          PANEL_FOLDED,
          Math.min(live.current, at.current - g.dy),
        );
        const open =
          Math.abs(g.vy) > 0.4
            ? g.vy < 0
            : now > (PANEL_FOLDED + live.current) / 2;
        const to = open ? live.current : PANEL_FOLDED;
        at.current = to;
        Animated.spring(tall, {
          toValue: to,
          damping: 22,
          stiffness: 220,
          useNativeDriver: false,
        }).start();
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;
  if (panel) {
    // Round on all four corners: it touches no edge of the screen.
    const radius = 36;
    return (
      <Animated.View
        style={{
          position: "absolute",
          left: PANEL_MARGIN,
          bottom: insets.bottom + PANEL_MARGIN,
          height: tall,
          width: panelWidth,
          borderRadius: radius,
          boxShadow: shadow({ blur: 16, y: 4, opacity: 0.12 }),
        }}
      >
        <Glass
          tintColor={PLATE}
          style={{ flex: 1, borderRadius: radius, overflow: "hidden" }}
        >
          {children}
        </Glass>
        {/* The handle, across the panel's top: a strip wide enough for a
            finger, with the phone sheet's own grab bar in it. */}
        <View
          {...fold.panHandlers}
          accessibilityRole="adjustable"
          accessibilityLabel={tr("ย่อหรือขยายแผง", "Fold or open the panel")}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: PANEL_HANDLE,
            alignItems: "center",
            paddingTop: SPACE.sm,
          }}
        >
          <View
            style={{
              width: 48,
              height: 4,
              borderRadius: 2,
              backgroundColor: FILL_SUBTLE,
            }}
          />
        </View>
      </Animated.View>
    );
  }
  const top = expanded ? 38 : 36;
  const bottom = expanded ? 0 : 58;
  const corners = {
    borderTopLeftRadius: top,
    borderTopRightRadius: top,
    borderBottomLeftRadius: bottom,
    borderBottomRightRadius: bottom,
  };

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: expanded ? 0 : SPACE.sm,
        right: expanded ? 0 : SPACE.sm,
        bottom: expanded ? 0 : SPACE.sm,
        height,
        ...corners,
        // The design's blur radii, halved: iOS shadowRadius is about half
        // the figure a design tool reports.
        boxShadow: shadow({
          blur: expanded ? 37 : 16,
          y: expanded ? -6 : 4,
          opacity: 0.12,
        }),
      }}
    >
      <Glass
        // The tint is painted OVER the glass instead of mixed into it, so
        // it stays at the design's half strength while resting — and goes
        // fully opaque at full height. Both are tokens, so the sheet is the
        // page's own grey on a dark ground.
        tintColor={expanded ? GROUPED_BG : PLATE}
        style={{ flex: 1, ...corners, overflow: "hidden" }}
      >
        {children}
      </Glass>
    </Animated.View>
  );
}
