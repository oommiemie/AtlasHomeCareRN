import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft } from "lucide-react-native";

import { GlassIconButton } from "./GlassIconButton";
import { SPACE, TEXT_PRIMARY, TOUCH_MIN } from "../theme/tokens";

/**
 * The header's own wash — Figma 102:15917.
 *
 * The design paints the 126pt band with two gradients, both running from the
 * foot upward: `#ADD9FF` from clear to solid, and white from clear to a
 * quarter over it. Both ramp between the same two ends, so one gradient from
 * their mix at the top to nothing at the bottom lands in the same place.
 *
 * The design's 126 is a 62pt status bar and a 64pt title row; taken off the
 * real inset it lands the fade in the same place on any device.
 */
const WASH_TOP = "#C1E2FF";
const WASH_ROW = 64;

/** The pale blue band behind a sub-page's header. */
export function HeaderWash({ height }: { height: number }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[WASH_TOP, "rgba(193,226,255,0)"]}
      style={{ position: "absolute", left: 0, right: 0, top: 0, height }}
    />
  );
}

type Props = {
  title: string;
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
 */
export function ScreenHeader({ title, right, below, onBack, wash = true }: Props) {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const back = onBack ?? (() => nav.goBack());

  return (
    <View
      style={{
        paddingTop: insets.top + SPACE.sm,
        paddingHorizontal: SPACE.lg,
        paddingBottom: SPACE.lg,
      }}
    >
      {wash && <HeaderWash height={insets.top + WASH_ROW} />}
      <View style={{ flexDirection: "row", alignItems: "center", minHeight: TOUCH_MIN }}>
        <GlassIconButton onPress={back} accessibilityLabel="ย้อนกลับ">
          <ChevronLeft size={24} color="#1A1A1A" strokeWidth={2.4} />
        </GlassIconButton>
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
        {right}
      </View>
      {below}
    </View>
  );
}
