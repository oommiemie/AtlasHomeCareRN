// The web build's stand-in for @react-native-masked-view/masked-view.
//
// react-native-web cannot mask one view by another, and drew the mask itself
// — a black gradient — over the content it was meant to shape. So the mask is
// not drawn here. Where it is a plain LinearGradient (the fade under every
// header, the strip behind the clock), the same ramp is handed to the browser
// as a CSS mask-image, which is what a gradient mask means; content scrolling
// under a header then dissolves on the web as it does on a phone, instead of
// being cut at a hard line. Any other mask is left off and the content shown
// as it is.
import { useLayoutEffect, useRef } from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/** The mask as a CSS gradient, or null for one that is not a plain gradient. */
function cssMask(mask) {
  if (mask == null || mask.type !== LinearGradient) return null;
  const { colors, locations, start, end } = mask.props;
  if (!Array.isArray(colors) || colors.length < 2) return null;
  const from = start ?? { x: 0.5, y: 0 };
  const to = end ?? { x: 0.5, y: 1 };
  const angle = (Math.atan2(to.x - from.x, -(to.y - from.y)) * 180) / Math.PI;
  const stops = colors.map((c, i) => {
    const at = locations?.[i] ?? i / (colors.length - 1);
    return `${c} ${(at * 100).toFixed(2)}%`;
  });
  return `linear-gradient(${angle.toFixed(1)}deg, ${stops.join(", ")})`;
}

export default function MaskedView({ maskElement, children, ...rest }) {
  const node = useRef(null);
  const mask = cssMask(maskElement);
  useLayoutEffect(() => {
    const el = node.current;
    if (el == null || el.style == null) return;
    el.style.maskImage = mask ?? "";
    el.style.webkitMaskImage = mask ?? "";
  }, [mask]);
  return (
    <View ref={node} {...rest}>
      {children}
    </View>
  );
}
