import { useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, Info } from "lucide-react-native";

import { Glass } from "./Glass";
import { PRIMARY_500, RADIUS, SPACE, SUCCESS, TEXT_PRIMARY } from "../theme/tokens";

/**
 * A word of confirmation, on glass, springing up from the foot of a page.
 *
 * It travels by layout rather than by transform: Liquid Glass stops
 * rendering its material under an ancestor with a transform or an alpha,
 * so the capsule is moved by its `bottom` and never faded. The spring is
 * what gives it the bounce in and the dip out.
 *
 * Shown while `message` is a string; the caller decides for how long.
 */
export type SnackTone = "success" | "info";

export function SnackBar({
  message,
  tone = "success",
  offset = SPACE.lg,
}: {
  message: string | null;
  /** A green tick for something done; a blue i for something said. */
  tone?: SnackTone;
  /** How far above the safe area it rests — more where a tab bar is. */
  offset?: number;
}) {
  const insets = useSafeAreaInsets();
  const rest = insets.bottom + offset;
  const hidden = -96;
  const bottom = useRef(new Animated.Value(hidden)).current;
  // Kept while the bar drops out — the text and its colour both — so
  // nothing changes mid-flight: a green tick that turned blue on the way
  // down read as a second bar appearing under the first.
  const [shown, setShown] = useState<{ message: string; tone: SnackTone } | null>(null);

  useEffect(() => {
    if (message != null) {
      setShown({ message, tone });
      Animated.spring(bottom, {
        toValue: rest,
        useNativeDriver: false,
        damping: 14,
        stiffness: 180,
        mass: 0.8,
      }).start();
      return;
    }
    Animated.spring(bottom, {
      toValue: hidden,
      useNativeDriver: false,
      damping: 18,
      stiffness: 220,
      mass: 0.8,
      overshootClamping: false,
    }).start(({ finished }) => {
      if (finished) setShown(null);
    });
  }, [message, tone, bottom, rest]);

  if (shown == null) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: "absolute", left: SPACE.lg, right: SPACE.lg, bottom, alignItems: "center" }}
    >
      <Glass
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.sm,
          height: 48,
          paddingLeft: SPACE.md,
          paddingRight: SPACE.xl,
          borderRadius: RADIUS.capsule,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: shown.tone === "success" ? SUCCESS : PRIMARY_500,
          }}
        >
          {shown.tone === "success" ? (
            <Check size={15} color="#FFFFFF" strokeWidth={3} />
          ) : (
            <Info size={15} color="#FFFFFF" strokeWidth={3} />
          )}
        </View>
        <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "600", color: TEXT_PRIMARY }}>
          {shown.message}
        </Text>
      </Glass>
    </Animated.View>
  );
}

