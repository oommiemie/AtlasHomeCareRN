import { useEffect, useState } from "react";
import { Animated, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRef } from "react";

import { RADIUS, SPACE } from "../theme/tokens";

/**
 * A brief message at the bottom of the screen.
 *
 * A module-level emitter rather than context: the callers are one-line "not
 * wired up yet" notices scattered through screens that have no other reason
 * to take a provider, and threading one through every screen for that would
 * cost more than it explains.
 */
type Listener = (message: string) => void;
let listener: Listener | null = null;

export function toast(message: string): void {
  listener?.(message);
}

export function ToastHost() {
  const [message, setMessage] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    listener = (m) => setMessage(m);
    return () => {
      listener = null;
    };
  }, []);

  useEffect(() => {
    if (message == null) return;
    Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();

    const t = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => setMessage(null));
    }, 2200);
    return () => clearTimeout(t);
  }, [message, opacity]);

  if (message == null) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: SPACE.lg,
        right: SPACE.lg,
        bottom: insets.bottom + 90,
        opacity,
      }}
    >
      <View
        style={{
          backgroundColor: "rgba(30,41,59,0.94)",
          borderRadius: RADIUS.lg,
          paddingHorizontal: SPACE.lg,
          paddingVertical: SPACE.md,
        }}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 14, textAlign: "center" }}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}
