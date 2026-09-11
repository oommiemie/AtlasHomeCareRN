import { forwardRef, type ReactNode } from "react";
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type View,
  type ViewStyle,
} from "react-native";
import { useRef } from "react";

type Props = Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  children?: ReactNode;
};

/**
 * The iOS 26 press response: a spring scale-down on touch that settles back
 * on release.
 *
 * `style` goes on the inner Animated.View, not the Pressable, so the
 * Pressable stays a transparent wrapper and a forwarded ref measures the
 * content bounds — which is what popover anchoring needs.
 */
export const PressableScale = forwardRef<View, Props>(function PressableScale(
  { style, scaleTo = 0.96, children, ...rest },
  ref,
) {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      friction: 5,
      tension: 220,
    }).start();

  return (
    <Pressable
      ref={ref}
      onPressIn={() => spring(scaleTo)}
      onPressOut={() => spring(1)}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
});
