import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { SlidersHorizontal } from "lucide-react-native";

import { Glass } from "./Glass";
import { SearchField, SEARCH_FIELD_HEIGHT } from "./SearchField";
import { RADIUS, SPACE, TEXT_MUTED } from "../theme/tokens";

export type FilterOption<K extends string> = {
  key: K;
  label: string;
  Icon: ComponentType<{ size?: number; color?: string }>;
};

/** The menu's geometry, shared by the panel and the height animation. */
const MENU = { top: 52, pad: 8, row: 44, gap: 8, width: 220 };

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
  renderTrigger?: (a: { open: boolean; toggle: () => void; label: string }) => ReactNode;
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
    <View style={{ zIndex: 10 }}>
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
          <SlidersHorizontal size={19} color="rgba(0,0,0,0.85)" />
          <Text style={{ fontSize: 14, fontWeight: "500", color: "#666666" }}>
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
            zIndex: 15,
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
}) {
  // Empty results still need a line's worth of room for the "none" message.
  const rows = Math.max(options.length, 1);
  const full =
    MENU.pad * 2 +
    (searchable ? SEARCH_FIELD_HEIGHT + MENU.gap : 0) +
    rows * MENU.row +
    (rows - 1) * MENU.gap;

  /**
   * The reveal is a height, not a fade or a scale.
   *
   * Either of those would put an alpha below 1 or a transform above the
   * glass, and UIVisualEffectView refuses to draw its material under both —
   * the panel would be an empty outline for as long as the animation ran.
   */
  const height = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(height, {
      toValue: open ? full : 0,
      duration: open ? 200 : 150,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished && !open) onClosed();
    });
    return () => anim.stop();
  }, [open, full]);

  return (
    // Two layers: the clip that makes the panel unfold would cut away the
    // shadow that lifts it off the page. The outer casts, the inner clips.
    <View
      style={{
        position: "absolute",
        top: MENU.top,
        right: 0,
        zIndex: 20,
        borderRadius: 24,
        shadowColor: "#000000",
        shadowOpacity: 0.18,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
      }}
    >
      <Animated.View style={{ height, overflow: "hidden", borderRadius: 24 }}>
        <Glass
          style={{
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
              fill="rgba(120,120,128,0.16)"
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
              <Text style={{ fontSize: 14, color: TEXT_MUTED }}>ไม่พบตัวเลือก</Text>
            </View>
          ) : (
            options.map(({ key, label, Icon }) => {
              const on = key === value;
              return (
                <Pressable
                  key={key}
                  onPress={() => onPick(key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    height: MENU.row,
                    paddingHorizontal: 10,
                    borderRadius: RADIUS.capsule,
                    backgroundColor: on ? "rgba(173,217,255,0.3)" : "transparent",
                  }}
                >
                  <Icon size={20} color={on ? "#0088FF" : "#1A1A1A"} />
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      fontSize: 16,
                      fontWeight: on ? "600" : "400",
                      color: on ? "#007AFF" : "#000000",
                    }}
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
