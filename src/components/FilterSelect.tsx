import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { Check, SlidersHorizontal } from "lucide-react-native";

import { Glass } from "./Glass";
import { currentDisplay } from "../models/display";
import { SearchField, SEARCH_FIELD_HEIGHT } from "./SearchField";
import {
  FILL_SUBTLE,
  RADIUS,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  shadow,
} from "../theme/tokens";

export type FilterOption<K extends string> = {
  key: K;
  label: string;
  Icon: ComponentType<{ size?: number; color?: string }>;
};

/**
 * The menu's geometry, shared by the panel and the height animation.
 *
 * Rows sit inside the panel rather than running to its edge: the chosen one
 * wears a capsule, and a capsule has to have something to be inset from.
 */
const MENU = { top: 52, pad: 8, row: 44, gap: 4, width: 220 };

/**
 * A dropdown built from the design's `Liquid Glass - Regular - Medium`
 * (Figma 143:2592), with an optional search field.
 *
 * One component rather than one per screen: the home list and the plan
 * screen were filtering the same task states through two different controls,
 * and they drifted apart in both look and behaviour.
 */
export function FilterSelect<K extends string>({
  value,
  options,
  onChange,
  searchable,
  searchPlaceholder = "ค้นหาตัวเลือก",
  renderTrigger,
  z = 10,
}: {
  value: K;
  options: FilterOption<K>[];
  onChange: (k: K) => void;
  /** Adds a field above the list. Worth it past a handful of options. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /**
   * Supplies the tappable instead of the default label-and-glyph — for
   * headers that already have a control the menu should hang from, like the
   * toolbar pill. The menu, its animation and its dismissal stay here.
   */
  renderTrigger?: (a: {
    open: boolean;
    toggle: () => void;
    label: string;
  }) => ReactNode;
  /**
   * Which of two menus on one page opens over the other.
   *
   * React Native settles paint order by comparing `zIndex` among siblings,
   * and a screen carrying two of these — the plan has one in its header and
   * one in the sheet below — gives them the same number, so the later in the
   * tree wins and the header's panel opened UNDER the sheet's control. The
   * one that should come out on top is given a higher floor here; the
   * backdrop and the panel are stacked off it.
   */
  z?: number;
}) {
  const [open, setOpen] = useState(false);
  // Kept in the tree through the closing animation, so the panel is not
  // yanked away the instant it starts folding.
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const current = options.find((o) => o.key === value);

  const toggle = () => {
    if (!open) setMounted(true);
    setOpen((v) => !v);
  };

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <View style={{ zIndex: z }}>
      {renderTrigger ? (
        renderTrigger({ open, toggle, label: current?.label ?? "" })
      ) : (
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={`ตัวกรอง: ${current?.label ?? ""}`}
          accessibilityState={{ expanded: open }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingVertical: 8,
          }}
        >
          <SlidersHorizontal size={19} color={TEXT_PRIMARY} />
          <Text style={{ fontSize: 14, fontWeight: "500", color: TEXT_MUTED }}>
            {current?.label ?? ""}
          </Text>
        </Pressable>
      )}

      {/* A tap anywhere else closes it. Stretched well past this container so
          it covers the page; whatever clips it is the area a tap can land
          in anyway. It sits below the panel, so the rows take theirs first. */}
      {open && (
        <Pressable
          accessibilityLabel="ปิดตัวเลือก"
          onPress={close}
          style={{
            position: "absolute",
            top: -2000,
            bottom: -2000,
            left: -2000,
            right: -2000,
            zIndex: z + 5,
          }}
        />
      )}

      {mounted && (
        <Menu
          open={open}
          value={value}
          options={shown}
          searchable={searchable}
          searchPlaceholder={searchPlaceholder}
          query={query}
          onQuery={setQuery}
          onPick={(k) => {
            onChange(k);
            close();
          }}
          onClosed={() => setMounted(false)}
          z={z}
        />
      )}
    </View>
  );
}

function Menu<K extends string>({
  open,
  value,
  options,
  searchable,
  searchPlaceholder,
  query,
  onQuery,
  onPick,
  onClosed,
  z,
}: {
  open: boolean;
  value: K;
  options: FilterOption<K>[];
  searchable?: boolean;
  searchPlaceholder: string;
  query: string;
  onQuery: (q: string) => void;
  onPick: (k: K) => void;
  onClosed: () => void;
  z: number;
}) {
  // Empty results still need a line's worth of room for the "none" message.
  const rows = Math.max(options.length, 1);
  const full =
    MENU.pad * 2 +
    (searchable ? SEARCH_FIELD_HEIGHT + MENU.gap : 0) +
    rows * MENU.row +
    (rows - 1) * MENU.gap;

  /**
   * The panel grows out of the control it hangs from, the way the system's
   * own popovers do — the calendar the date field opens is the one to
   * watch.
   *
   * It is the panel's SIZE that moves, not a scale and not a fade. Either
   * of those would put a transform or an alpha above the glass, and
   * UIVisualEffectView refuses to draw its material under both: the panel
   * would be an empty outline for as long as the animation ran. So both
   * axes are opened at once from nothing, and because the box is pinned to
   * its top right — the corner the toolbar button sits at — everything it
   * uncovers spreads down and to the left, away from the finger.
   *
   * It was a height alone, which unrolled the panel like a blind: correct
   * enough, but nothing on iOS opens that way.
   */
  const grow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const still = currentDisplay().reduceMotion;
    const anim = Animated.timing(grow, {
      toValue: open ? 1 : 0,
      duration: still ? 0 : open ? 220 : 150,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished && !open) onClosed();
    });
    return () => anim.stop();
  }, [open, full]);

  const height = grow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, full],
  });
  // Width opens a touch ahead of height, so the panel reads as a shape
  // spreading rather than as a box being dragged out by its corner.
  const width = grow.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0, MENU.width, MENU.width],
  });

  return (
    // Two layers: the clip that makes the panel unfold would cut away the
    // shadow that lifts it off the page. The outer casts, the inner clips.
    <View
      style={{
        position: "absolute",
        top: MENU.top,
        right: 0,
        zIndex: z + 10,
        borderRadius: 24,
        boxShadow: shadow({ blur: 20, y: 8, opacity: 0.18 }),
      }}
    >
      <Animated.View
        style={{
          width,
          height,
          overflow: "hidden",
          borderRadius: 24,
          alignItems: "flex-end",
        }}
      >
        {/* Pinned to the corner it grows from, so the rows hold still while
            the box opens around them instead of sliding in with it. */}
        <Glass
          // The page it opens over shows through it, the same way the
          // toolbar it drops from does.
          blurred
          // A menu of words, so it takes the whiter of the two.
          frost="milky"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: MENU.width,
            borderRadius: 24,
            overflow: "hidden",
            padding: MENU.pad,
            gap: MENU.gap,
          }}
        >
          {searchable && (
            <SearchField
              value={query}
              onChangeText={onQuery}
              placeholder={searchPlaceholder}
              // The design's field fill: a glass field on glass has nothing
              // to refract and disappears into the panel.
              fill={FILL_SUBTLE}
            />
          )}

          {options.length === 0 ? (
            <View
              style={{
                height: MENU.row,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 14, color: TEXT_MUTED }}>
                ไม่พบตัวเลือก
              </Text>
            </View>
          ) : (
            /*
              Rows the shape iOS 26 gives a menu whose items toggle — the
              view menu in Calendar is the one this was read off.

              A tick at the leading edge, then the item's glyph, then its
              name, and a capsule of plain grey behind whichever is on. All
              three parts matter: the tick says a choice is being made here,
              the capsule says which, and the grey says it without claiming
              to be a button — the blue fill and blue label this had before
              are how a segmented control marks a selection, which is a
              different control saying a different thing.

              iOS 26 is also where the glyphs moved to the leading side,
              after the tick rather than trailing the label.

              The tick's column is held open on every row, so the glyphs and
              names run straight down the menu rather than stepping sideways
              as the choice moves.
            */
            options.map(({ key, label, Icon }) => {
              const on = key === value;
              return (
                <Pressable
                  key={key}
                  onPress={() => onPick(key)}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.sm,
                    height: MENU.row,
                    paddingHorizontal: SPACE.sm,
                    borderRadius: RADIUS.capsule,
                    // A fill, never an opacity: an alpha below 1 anywhere
                    // above the glass stops the panel drawing its material.
                    // The system's own fill marks the row that is on and the
                    // one under the finger alike.
                    backgroundColor:
                      pressed || on ? FILL_SUBTLE : "transparent",
                  })}
                >
                  <View style={{ width: 16, alignItems: "center" }}>
                    {on && (
                      <Check size={16} color={TEXT_PRIMARY} strokeWidth={3} />
                    )}
                  </View>
                  <Icon size={20} color={TEXT_PRIMARY} />
                  <Text
                    numberOfLines={1}
                    style={{ flex: 1, fontSize: 16, color: TEXT_PRIMARY }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })
          )}
        </Glass>
      </Animated.View>
    </View>
  );
}
