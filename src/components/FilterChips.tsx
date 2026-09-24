import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Glass } from "./Glass";
import { currentDisplay } from "../models/display";
import { feel } from "../utils/haptics";
import {
  FILL_SUBTLE,
  GLASS_NEUTRAL,
  RADIUS,
  SPACE,
  TEXT_DISABLED,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";

export type FilterChip<K extends string> = {
  key: K;
  label: string;
  /** How many rows the band holds. Left off where there is nothing to count. */
  count?: number;
  /**
   * What the count is set in while the chip is unchosen.
   *
   * So the row can be read without being worked through: a red two beside
   * "เตือน" says there are two to deal with from wherever the carer happens
   * to be standing in the list. Left off, the count is the ordinary ink.
   */
  ink?: string;
};

/** The height a screen reserves for the row. */
export const FILTER_CHIPS_HEIGHT = 40;

/** What the chosen chip is tinted — the app's blue, as every chip here is. */
const CHOSEN = "rgba(7,125,215,0.82)";

/**
 * The bands a list can be narrowed to, as a row of chips.
 *
 * Each band is its own capsule of Liquid Glass. It was one capsule sliding
 * along a row of bare labels — which is the right shape for two or three
 * fixed choices sharing a track ([GlassChips] still is), and the wrong one
 * here: there are six bands of very different widths, more than fit across a
 * phone, and the row scrolls. A marker that has to be measured to whichever
 * label it is over, in a row that is also moving under it, is a lot of
 * machinery to end up looking like six chips.
 *
 * Nothing is drawn behind the row. The chips are the only surface, which
 * leaves the header's wash for the material to refract — a track under them
 * would be all the glass could sample, and they would come out as flat
 * lozenges.
 *
 * Nothing here animates an opacity or a transform over the glass, press
 * feedback included: an alpha below 1 or a transform on any ancestor stops
 * UIVisualEffectView rendering its material, and the chip would go blank
 * under the finger. `interactive` lets the material answer the touch itself.
 */
export function FilterChips<K extends string>({
  chips,
  value,
  onChange,
  pad = 0,
}: {
  chips: FilterChip<K>[];
  value: K;
  onChange: (k: K) => void;
  /**
   * The screen's own side margin, taken by the row instead of by whatever
   * holds it — so the chips run off the edge of the screen as they scroll
   * rather than stopping short of it at a line nothing else draws.
   */
  pad?: number;
}) {
  const scroller = useRef<ScrollView>(null);
  const [boxes, setBoxes] = useState<Record<string, { x: number; w: number }>>(
    {},
  );

  // What the row can show at once and where it is scrolled to — the two
  // numbers that decide whether the chosen band needs bringing into view.
  const port = useRef({ width: 0, offset: 0 });
  const at = boxes[value];

  useEffect(() => {
    if (at == null) return;
    // Brought into view only when it is not already in it. Scrolling on
    // every press would drag the row about under a finger that could
    // perfectly well reach what it was aiming at.
    const { width, offset } = port.current;
    const clear =
      width === 0 ||
      (at.x >= offset + SPACE.sm && at.x + at.w <= offset + width - SPACE.sm);
    if (clear) return;
    scroller.current?.scrollTo({
      x: Math.max(0, at.x - SPACE.xxl),
      animated: !currentDisplay().reduceMotion,
    });
  }, [at?.x, at?.w]);

  return (
    <View
      onLayout={(e) => {
        port.current.width = e.nativeEvent.layout.width;
      }}
      style={{ height: FILTER_CHIPS_HEIGHT }}
    >
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => {
          port.current.offset = e.nativeEvent.contentOffset.x;
        }}
        scrollEventThrottle={32}
        contentContainerStyle={{ gap: SPACE.sm, paddingHorizontal: pad }}
      >
        {chips.map((c) => {
          const on = c.key === value;
          // A band with nobody in it is still worth showing — "เตือน 0" is an
          // answer — but it is not worth aiming at, so it recedes. By ink
          // rather than by alpha: see the note above.
          const empty = c.count === 0;
          return (
            <Pressable
              key={c.key}
              onLayout={(e) => {
                const { x, width: w } = e.nativeEvent.layout;
                setBoxes((was) =>
                  was[c.key]?.x === x && was[c.key]?.w === w
                    ? was
                    : { ...was, [c.key]: { x, w } },
                );
              }}
              onPress={() => {
                if (on) return;
                feel("tick");
                onChange(c.key);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={
                c.count == null ? c.label : `${c.label} ${c.count}`
              }
            >
              <Glass
                interactive
                tintColor={on ? CHOSEN : GLASS_NEUTRAL}
                style={{
                  height: FILTER_CHIPS_HEIGHT,
                  paddingLeft: SPACE.lg,
                  // Tighter on the side the count sits, so the badge is not
                  // marooned in the middle of its own margin.
                  paddingRight: c.count == null ? SPACE.lg : SPACE.sm,
                  borderRadius: RADIUS.capsule,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACE.sm,
                  overflow: "hidden",
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 14,
                    fontWeight: on ? "700" : "600",
                    color: on ? "#FFFFFF" : empty ? TEXT_MUTED : TEXT_PRIMARY,
                  }}
                >
                  {c.label}
                </Text>

                {/* The count, as a thing rather than as a number trailing
                    the word: on a row of six it is what the eye is actually
                    reading, and loose digits at two different weights were
                    hard to pick out of the Thai. */}
                {c.count != null && (
                  <View
                    style={{
                      minWidth: 22,
                      height: 22,
                      paddingHorizontal: 6,
                      borderRadius: RADIUS.capsule,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: on
                        ? "rgba(255,255,255,0.24)"
                        : FILL_SUBTLE,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        fontVariant: ["tabular-nums"],
                        color: on
                          ? "#FFFFFF"
                          : empty
                            ? TEXT_DISABLED
                            : (c.ink ?? TEXT_PRIMARY),
                      }}
                    >
                      {c.count}
                    </Text>
                  </View>
                )}
              </Glass>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
