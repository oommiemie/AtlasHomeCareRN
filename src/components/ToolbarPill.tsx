import type { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { useGlassTarget } from "./BlurStage";
import { Glass } from "./Glass";
import { androidWash } from "./GlassIconButton";
import {
  GLASS_LIFT,
  RADIUS,
  RIM_LIT,
  SEPARATOR,
  TOUCH_MIN,
  shadow,
} from "../theme/tokens";

const ANDROID = Platform.OS === "android";

type Slot = {
  icon: ReactNode;
  label: string;
  onPress?: () => void;
};

/**
 * The toolbar capsule in a screen header — one or two round slots on glass.
 *
 * The drawn slot is 36pt per the design, under the 44pt touch floor, so the
 * hit box is grown past the drawing rather than the capsule being inflated:
 * the pill keeps its 104×44, and the extra target reaches over its padding.
 *
 * A single slot is drawn as a circle instead: a capsule with one thing in
 * it reads as a pill somebody forgot to fill, and the app's own round glass
 * button is what a lone header action looks like everywhere else.
 */
export function ToolbarPill({ slots }: { slots: Slot[] }) {
  const alone = slots.length === 1;
  const blurs = useGlassTarget() != null;
  return (
    <View>
      {/* A shadow under the pill, on real Liquid Glass too — the carer
          wanted the toolbars lifted off the page. Cast from a hairline
          ring BEHIND the glass, never laid over it: a shadow over the
          material reads as a smudge, and a filled plate behind it greys it
          out. The ring throws the shadow and leaves the middle clear, as
          the PIN keys do. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          borderRadius: RADIUS.capsule,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: RIM_LIT,
          boxShadow: shadow(GLASS_LIFT),
        }}
      />
      <Glass
        /*
          Blurred rather than washed, where the material is missing.

          It used to be given `GLASS_BAR_TINT` — a near-solid white — which
          is what a bar had to be before there was a blur to stand on. Over
          one it is a second coat: the page goes behind two translucent
          whites and the pill reads as a panel floating on the header
          rather than as something you are looking through.
        */
        /*
          On Android, exactly the round button's recipe (see
          `GlassIconButton`), so the pill and the back button beside it are
          one glass: blurred at the sheer frost where there is a page to
          blur, and the same flat wash where there is not. It used to add a
          coat of white of its own on top, and came out near twice as white
          as the button beside it.
        */
        blurred={!ANDROID || blurs}
        /*
          Milky only on an iPhone below the material, where there is
          nothing to blur.

          The milk is there so a row of small glyphs can be read off the
          pill, and without a blur under it that still holds: the wash is
          all there is. Where it has something to blur (see `Floating`),
          the blur does that job, and at
          seven tenths of white on top the pill came out a flat pale slab
          against the frame beside it. There it takes the sheer frost the
          frame has, so the two read as the same glass.
        */
        frost={blurs || ANDROID ? "sheer" : "milky"}
        // The button's white, blurring or not. Never on iOS: a tint
        // there is painted over Apple's material and flattens it.
        tintColor={ANDROID ? androidWash(blurs) : undefined}
        style={{
          height: 44,
          width: alone ? 44 : undefined,
          borderRadius: RADIUS.capsule,
          overflow: "hidden",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: alone ? 0 : 8,
        }}
      >
        {slots.map((s, i) => (
          <View
            key={s.label}
            style={{ flexDirection: "row", alignItems: "center" }}
          >
            {i > 0 && (
              <View
                style={{
                  width: 1,
                  height: 24,
                  marginHorizontal: 7,
                  backgroundColor: SEPARATOR,
                }}
              />
            )}
            <Pressable
              onPress={s.onPress}
              accessibilityRole="button"
              accessibilityLabel={s.label}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              style={{
                width: alone ? TOUCH_MIN : 36,
                height: TOUCH_MIN,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {s.icon}
            </Pressable>
          </View>
        ))}
      </Glass>
    </View>
  );
}
