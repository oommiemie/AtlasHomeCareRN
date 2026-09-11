import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { CANVAS } from "../theme/tokens";

/**
 * The header wash behind the glass chrome.
 *
 * Sampled from the Figma home screen: a deep blue at the status bar easing up
 * through a lighter sky tone and dissolving into the canvas. Extra stops sit
 * in the top third because that is where the eye lingers — a plain two-stop
 * ramp banded there and read as a printed strip rather than light.
 *
 * Still, not animated. The Flutter build drifted this on a repeating timer
 * and, with every tab kept alive, four of them ran at once — the render loop
 * never went idle and the phone ran hot for nothing anyone could see.
 */
export function LivingGradient({ height }: { height: number }) {
  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: 0, height }}>
      <LinearGradient
        colors={["#3F82D2", "#5C9FDD", "#7FBAE6", "#AECDE9"]}
        locations={[0, 0.18, 0.42, 0.72]}
        style={{ flex: 1 }}
      />
      {/* A straight vertical fade to the canvas. The blue above still carries
          colour along its lower edge at every point of the ramp, so the
          dissolve has to run top-to-bottom to be seamless across the width. */}
      <LinearGradient
        colors={["rgba(245,247,250,0)", CANVAS]}
        locations={[0.5, 1]}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />
    </View>
  );
}
