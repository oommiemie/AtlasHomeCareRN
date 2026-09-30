import { createContext, useContext, useEffect } from "react";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft } from "lucide-react-native";

import { useHeaderSlot, useHeaderSlotContent } from "./ScreenFrame";
import { GlassIconButton } from "./GlassIconButton";
import { tr } from "../i18n";
import {
  CANVAS_CLEAR,
  SPACE,
  TEXT_PRIMARY,
  TOUCH_MIN,
  WASH_TINT,
} from "../theme/tokens";
import { GUTTER } from "../theme/layout";

/**
 * The header's own wash — Figma 102:15917.
 *
 * The design paints the 126pt band with two gradients, both running from the
 * foot upward: `#ADD9FF` from clear to solid, and white from clear to a
 * quarter over it. Both ramp between the same two ends, so one gradient from
 * their mix at the top to nothing at the bottom lands in the same place. That
 * mix is the `WASH_TINT` token, read at render so the band turns with the
 * theme, and it dissolves into the canvas rather than into a fixed clear blue.
 *
 * The design's 126 is a 62pt status bar and a 64pt title row; taken off the
 * real inset it lands the fade in the same place on any device.
 */
const WASH_ROW = 64;

/**
 * No wash: set around a page shown on a card of its own — a form risen over
 * the visit menu on a tablet — where a blue band across the card's top read
 * as a second header over the card rather than as the page's ground.
 */
export const PlainHeaderContext = createContext(false);

/** The pale blue band behind a sub-page's header. */
export function HeaderWash({ height }: { height: number }) {
  if (useContext(PlainHeaderContext)) return null;
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[WASH_TINT, CANVAS_CLEAR]}
      style={{ position: "absolute", left: 0, right: 0, top: 0, height }}
    />
  );
}

type Props = {
  title: string;
  /**
   * Stands in for the title, where the page's name is a field rather than
   * a label — the notebook, whose title is typed here and nowhere else.
   * It has to carry its own `flex: 1` and left margin.
   */
  titleNode?: ReactNode;
  /** Sits at the right end of the title row — a toolbar pill, usually. */
  right?: ReactNode;
  /** Grows in under the title, e.g. a search field. */
  below?: ReactNode;
  onBack?: () => void;
  /**
   * Off for screens that already paint a wash of their own — two gradients
   * over each other is a band, not a fade.
   */
  wash?: boolean;
};

/**
 * The pinned header every pushed screen carries: a glass back button, the
 * title, and whatever the screen puts on the right.
 *
 * One component rather than each screen assembling its own — the Flutter
 * build let them drift and no two headers ended up alike.
 *
 * On a tablet the row stays at the screen's edges, the back button in the
 * corner where iPad puts it, whatever width the page's content column is:
 * pages hold columns of different widths (a form, a reading column, a grid
 * of cards), and a header that followed each would sit in a different place
 * on every page.
 */
export function ScreenHeader({
  title,
  titleNode,
  right,
  below,
  onBack,
  wash = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const back = onBack ?? (() => nav.goBack());
  // The page's action tray, where it has come up here (see ScreenFrame).
  const slot = useHeaderSlot();
  useEffect(() => {
    if (slot == null) return;
    slot.headers += 1;
    slot.listeners.forEach((l) => l());
    return () => {
      slot.headers -= 1;
      slot.listeners.forEach((l) => l());
    };
  }, [slot]);
  const actions = useHeaderSlotContent(slot);

  return (
    <View
      style={{
        paddingTop: insets.top + SPACE.sm,
        paddingHorizontal: GUTTER,
        paddingBottom: SPACE.lg,
      }}
    >
      {wash && <HeaderWash height={insets.top + WASH_ROW} />}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          minHeight: TOUCH_MIN,
        }}
      >
        <GlassIconButton
          onPress={back}
          accessibilityLabel={tr("ย้อนกลับ", "Back")}
        >
          <ChevronLeft size={24} color={TEXT_PRIMARY} strokeWidth={2.4} />
        </GlassIconButton>
        {/* A page whose name IS a field puts the field here rather than
            repeating the word below the header — see the notebook, where
            the title is the first thing typed and the last thing needed. */}
        {titleNode ?? (
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              marginLeft: SPACE.md,
              fontSize: 20,
              lineHeight: 26,
              fontWeight: "800",
              color: TEXT_PRIMARY,
            }}
          >
            {title}
          </Text>
        )}
        {right}
        {/* The page's action tray, come up from the foot on a tablet held
            sideways — at the far right, after the toolbar, where the eye
            ends the row and the hand reaches for "save". */}
        {actions != null && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.sm,
              marginLeft: SPACE.sm,
            }}
          >
            {actions}
          </View>
        )}
      </View>
      {below}
    </View>
  );
}
