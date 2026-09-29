/**
 * The menu a form's select field drops on Android — Material's exposed
 * dropdown, drawn in the app's own glass.
 *
 * iOS answers a select field with a sheet of the options, and that is right
 * there: a page sheet is how UIKit asks for a choice. On Android the same
 * field is expected to open where it is: the list falls from the field, as
 * wide as it, and a tap outside puts it away. A second bottom sheet stacked
 * on a form sheet also has nothing of iOS's recession to say it is on top,
 * and read as a page that had swapped the form out.
 *
 * Hosted at the root beside the date calendar, for the calendar's reasons
 * (see `DatePopover`): a field inside a scrolling form would clip a menu
 * drawn in place, and the blur can only read a page the menu is not inside.
 *
 * Not for a list the user has to type at — the searchable fields keep the
 * sheet, where the keyboard has room and does not cover the list.
 */
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  Animated,
  BackHandler,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullWindowOverlay } from "react-native-screens";
import { Check } from "lucide-react-native";

import { MENU as FILTER_MENU } from "./FilterSelect";
import { Glass } from "./Glass";
import { currentDisplay } from "../models/display";
import {
  optionDetail,
  optionLabel,
  optionValue,
  type Option,
} from "../models/optionPicker";
import { feel } from "../utils/haptics";
import { tr } from "../i18n";
import {
  FILL_SUBTLE,
  GLASS_STANDIN_CLEAR,
  RADIUS,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  shadow,
  LIQUID_GLASS,
} from "../theme/tokens";
import type { Anchor } from "./DatePopover";

type Request = {
  anchor: Anchor;
  /** The page the field is on, for the menu to blur; see `BlurStage`. */
  blurTarget?: RefObject<View | null>;
  options: readonly Option[];
  /** What is chosen now, ticked in the list. */
  value: string;
  label: string;
  onPick: (value: string) => void;
  /** However it closes — a pick, a tap outside, the back button. */
  onClose?: () => void;
};

type Listener = (req: Request | null) => void;
let listener: Listener | null = null;

/** Open the menu under a field that has just been measured. */
export function openOptionMenu(req: Request): void {
  listener?.(req);
}

/**
 * The filter menu's measurements (see `FilterSelect`), so the two menus in
 * the app are one: rows of 44 in capsules inset from a 24pt panel. The
 * width is the field's own, not the filter's 220; see `Menu`. A row with a second line takes 56. The panel stops at six and a
 * half rows, so a long list shows that it goes on.
 */
const MENU = {
  ...FILTER_MENU,
  rowDetail: 56,
  maxRows: 6.5,
  radius: 24,
};

/** Mounted once, at the root. Renders nothing until a field asks. */
export function OptionMenuHost() {
  const [req, setReq] = useState<Request | null>(null);
  // This layer's own top-left, in the space the anchor was measured in —
  // the same question the calendar's host asks of itself, for the same
  // status bar's worth of difference.
  const root = useRef<View>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });

  useEffect(() => {
    listener = setReq;
    return () => {
      listener = null;
    };
  }, []);

  const close = () => {
    req?.onClose?.();
    setReq(null);
  };

  useEffect(() => {
    if (req == null) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      req.onClose?.();
      setReq(null);
      return true;
    });
    return () => sub.remove();
  }, [req]);

  const layer = (
    <View
      ref={root}
      pointerEvents={req == null ? "none" : "auto"}
      onLayout={() =>
        root.current?.measureInWindow((x, y) => setOrigin({ x, y }))
      }
      style={[StyleSheet.absoluteFillObject, { zIndex: 400 }]}
    >
      {req != null && <Menu req={req} origin={origin} onClose={close} />}
    </View>
  );
  // Over every window on iOS: the forms that ask are mostly in sheets, which
  // are windows of their own above the root this is mounted in.
  return Platform.OS === "ios" ? (
    <FullWindowOverlay>{layer}</FullWindowOverlay>
  ) : (
    layer
  );
}

function Menu({
  req,
  origin,
  onClose,
}: {
  req: Request;
  origin: { x: number; y: number };
  onClose: () => void;
}) {
  const { anchor, options, value, onPick, blurTarget } = req;
  const { height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const heights = useMemo(
    () =>
      options.map((o) =>
        optionDetail(o).length > 0 ? MENU.rowDetail : MENU.row,
      ),
    [options],
  );
  const full =
    MENU.pad * 2 +
    heights.reduce((a, h) => a + h, 0) +
    Math.max(0, heights.length - 1) * MENU.gap;
  const cap = MENU.pad * 2 + MENU.maxRows * (MENU.row + MENU.gap);

  /*
    Under the field where there is room, over it where there is not, and as
    tall as the list or the room, whichever gives out first.

    Under is where Material puts it and where the eye already is. A field
    near the foot of a form would hang the list off the screen, so there it
    opens upward instead — whichever side has more room, if neither has all
    it wants.
  */
  // On iOS the layer is a window of its own over the whole screen, so its
  // corner is the screen's: a measured origin there only ever put the list
  // back up over the field it hangs from.
  const at = Platform.OS === "ios" ? { x: 0, y: 0 } : origin;
  const fieldTop = anchor.y - at.y;
  const fieldBottom = fieldTop + anchor.height;
  const below = screenH - insets.bottom - SPACE.lg - (fieldBottom + SPACE.xs);
  const above = fieldTop - SPACE.xs - (insets.top + SPACE.sm);
  const want = Math.min(full, cap);
  // Under the field wherever three rows fit there — the list belongs below
  // what it answers — and over it only when the foot of the form leaves no
  // room at all.
  const enough = Math.min(want, MENU.pad * 2 + 3 * (MENU.row + MENU.gap));
  const down = below >= enough || below >= above;
  const height = Math.min(want, down ? below : above);
  const top = down ? fieldBottom + SPACE.xs : fieldTop - SPACE.xs - height;

  /*
    Exactly as wide as the field and square under it — the one place this
    parts from the filter menu, which is a fixed 220 hung from a button.
    A field is a box of its own width, and a list narrower than it, hung off
    one end, read as belonging to something else.
  */
  const width = anchor.width;
  const left = anchor.x - at.x;

  // Scrolled to the chosen row where the list runs past the panel, so what
  // is picked is what is seen first.
  const chosenAt = options.findIndex((o) => optionValue(o) === value);
  const offset =
    chosenAt <= 0
      ? 0
      : heights.slice(0, chosenAt).reduce((a, h) => a + h + MENU.gap, 0) -
        (height - MENU.pad * 2 - heights[chosenAt]) / 2;

  const rise = useMemo(() => new Animated.Value(0), []);
  // On Apple's glass the panel grows by its own size rather than a scale,
  // so it runs on the JS driver: width and height are layout, and layout is
  // the one thing the glass keeps drawing through.
  useEffect(() => {
    if (currentDisplay().reduceMotion) {
      rise.setValue(1);
      return;
    }
    const anim = LIQUID_GLASS
      ? Animated.spring(rise, {
          toValue: 1,
          // The compact calendar's open: quick, and settling with the
          // slightest give rather than a bounce.
          stiffness: 320,
          damping: 28,
          mass: 1,
          useNativeDriver: false,
        })
      : Animated.timing(rise, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        });
    anim.start();
    return () => anim.stop();
  }, [rise]);

  /*
    The compact calendar's way out of its field, drawn in the frame rather
    than a transform: the panel starts as a sliver the width of most of the
    field, hung from the field's edge, and opens to its full size — down
    from the field when it drops, up from it when it rises.
  */
  const grownHeight = rise.interpolate({
    inputRange: [0, 1],
    outputRange: [Math.min(height, MENU.row), height],
  });
  const grownWidth = rise.interpolate({
    inputRange: [0, 1],
    outputRange: [width * 0.7, width],
  });
  const grownLeft = rise.interpolate({
    inputRange: [0, 1],
    outputRange: [left + width * 0.15, left],
  });
  const grownTop = down
    ? top
    : rise.interpolate({
        inputRange: [0, 1],
        outputRange: [top + height - Math.min(height, MENU.row), top],
      });

  return (
    <>
      {/* A tap anywhere else closes it; nothing is dimmed, as Material's
          menus dim nothing. */}
      <Pressable
        accessibilityLabel={tr("ปิดตัวเลือก", "Close options")}
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      />

      {/* The shadow on a layer of its own, since the clip that rounds the
          glass would cut it off. */}
      <Animated.View
        style={{
          position: "absolute",
          left: LIQUID_GLASS ? grownLeft : left,
          top: LIQUID_GLASS ? grownTop : top,
          width: LIQUID_GLASS ? grownWidth : width,
          height: LIQUID_GLASS ? grownHeight : height,
          borderRadius: MENU.radius,
          boxShadow: shadow({ blur: 20, y: 8, opacity: 0.18 }),
          // Apple's glass is not drawn under a view that is scaled or faded,
          // so on iOS 26 the panel grows by its frame (above) and only the
          // words inside fade. Elsewhere it grows out of the field's edge by
          // a scale: its foot when it opens below, its top when it opens
          // above.
          ...(LIQUID_GLASS
            ? null
            : {
                opacity: rise,
                transformOrigin: down ? "center top" : "center bottom",
                transform: [
                  {
                    scale: rise.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.85, 1],
                    }),
                  },
                ],
              }),
        }}
      >
        <Glass
          blurred
          blurTarget={blurTarget}
          // The filter menu's recipe: a pane the form shows through softly,
          // with enough white on it that the words read off it.
          frost={blurTarget != null ? "sheer" : "milky"}
          tintColor={blurTarget != null ? GLASS_STANDIN_CLEAR : undefined}
          style={{
            flex: 1,
            borderRadius: MENU.radius,
            overflow: "hidden",
          }}
        >
          <Animated.ScrollView
            style={LIQUID_GLASS ? { opacity: rise } : undefined}
            contentOffset={{ x: 0, y: Math.max(0, offset) }}
            contentContainerStyle={{ padding: MENU.pad, gap: MENU.gap }}
            showsVerticalScrollIndicator={full > height}
            nestedScrollEnabled
          >
            {options.map((o, i) => {
              const v = optionValue(o);
              const detail = optionDetail(o);
              const shown = optionLabel(o);
              const on = v === value;
              return (
                <Pressable
                  key={v}
                  onPress={() => {
                    feel("tick");
                    onPick(v);
                    onClose();
                  }}
                  accessibilityRole="menuitem"
                  accessibilityLabel={detail.length > 0 ? `${shown} ${detail}` : shown}
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.sm,
                    height: heights[i],
                    paddingHorizontal: SPACE.sm,
                    borderRadius: RADIUS.capsule,
                    backgroundColor:
                      pressed || on ? FILL_SUBTLE : "transparent",
                  })}
                >
                  {/* The filter menu's rows: a tick at the leading edge, its
                      column held open on every row so the names run
                      straight down, and grey behind the one that is on. */}
                  <View style={{ width: 16, alignItems: "center" }}>
                    {on && (
                      <Check size={16} color={TEXT_PRIMARY} strokeWidth={3} />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 16, color: TEXT_PRIMARY }}
                    >
                      {shown}
                    </Text>
                    {detail.length > 0 && (
                      <Text
                        numberOfLines={1}
                        style={{
                          marginTop: 2,
                          fontSize: 12,
                          color: TEXT_MUTED,
                        }}
                      >
                        {detail}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </Animated.ScrollView>
        </Glass>
      </Animated.View>
    </>
  );
}
