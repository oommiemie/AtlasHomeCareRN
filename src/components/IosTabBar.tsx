import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { BottomTabBarProps } from "@bottom-tabs/react-navigation";

import { Glass } from "./Glass";
import { currentDisplay, useDisplay } from "../models/display";
import { feel } from "../utils/haptics";
import {
  CANVAS_FADE,
  currentTheme,
  PRIMARY_500,
  shadow,
} from "../theme/tokens";

/**
 * iOS 26's floating tab bar, drawn, for the platform whose own bar is a
 * different object altogether.
 *
 * `react-native-bottom-tabs` hosts the real control on each side: on iOS 26
 * a `UITabBar` that has become a glass capsule hovering clear of the
 * screen's edges with the page sliding under it, and on Android Material
 * 3's `NavigationBarView` — a solid slab welded to the bottom edge, 80dp
 * tall, with a filled pill behind the selected glyph. The pill and its
 * ripple come off through props. The shape does not: a capsule is not a
 * setting Material's bar has.
 *
 * So on Android the bar is drawn here, to the measurements taken off the
 * iOS one: 360 points of a 402-point screen, 62 tall, 21 clear of each side
 * and of the bottom, and floating — laid over the page rather than sitting
 * under it, which is the half of it that is not the outline.
 */

/**
 * Apple's, in points, off the real bar.
 *
 * The inset is the fixed part and the width is not, which is a choice, and
 * the two cannot both be held: the phones are 402 and 448 points across, so
 * a capsule of one width sits at two different distances from the edge, and
 * a capsule at one distance comes out two different widths.
 *
 * The inset wins because that is what iOS itself keeps. The bar measured
 * here is 360 wide on a 402-point iPhone; on a larger one it is wider, by
 * exactly the amount the screen is wider, and still 21 points clear of each
 * side. Held the other way — a fixed 360 centred — the Android bar would
 * have floated in the middle of a gap twice as wide as the iPhone's, which
 * is the thing that would actually have looked different.
 */
const BAR = { height: 62, side: 21, bottom: 21, icon: 28 };

/**
 * The fill behind the tab you are on.
 *
 * The floating bar does not mark the current tab by tint alone — there is a
 * rounded fill under it, a shade of the bar's own material, which is what
 * makes the capsule read as four places rather than four glyphs.
 *
 * One number for all four sides, and it is Apple's own. Read off the real
 * bar: the capsule runs 791 to 853 and the selected tab's view runs 795 to
 * 849, so the fill is inset by four at the top, four at the bottom and four
 * from the capsule's leading edge — 54 points of fill inside 62 of glass.
 */
const PICKED = 4;

/**
 * And how faint it is.
 *
 * Fainter than the app's press fill, which is what this was first given.
 * That one is meant to flash under a finger and be gone; this one stays
 * under the current tab for as long as you are on it, and at the same
 * strength it stopped being a hint of where you are and became a grey
 * lozenge sitting in the middle of the glass.
 */
/**
 * How long the fill takes to get from one tab to the next.
 *
 * The app's own opening time, eased out the same way, so the bar moves like
 * the menus do. Apple slides this rather than cutting it: the fill is what
 * says where you are, and a fill that appears somewhere else has to be
 * looked for, while one that travels has already told you which way it went.
 */
const SLIDE = 220;

const pickedFill = () =>
  currentTheme() === "dark"
    ? "rgba(255,255,255,0.10)"
    : "rgba(120,120,128,0.09)";

/**
 * What a scroll view has to leave clear at its bottom to pass under it.
 *
 * The bar floats, so it occupies no layout — which means nothing else can
 * work this out, and a list would run its last row beneath the capsule.
 * Read by `useTabBarInset`, the one place screens ask.
 */
export const TAB_BAR_FOOTPRINT = BAR.height + BAR.bottom;

/**
 * How far up the screen the page dissolves before it reaches the bar.
 *
 * iOS 26 calls this the scroll edge effect and draws it itself: content
 * passing under the floating bar does not simply run out at the bottom of
 * the screen, it thins away first, so the last row is never a line cut in
 * half by the glass. Everywhere else it has to be drawn.
 *
 * Barely taller than the bar, and it was much taller. A ramp with room to
 * spare above the capsule reads as a haze over the bottom of the page
 * rather than as an edge — the rows go pale a long way before anything is
 * covering them, and the page looks like it is fading out rather than
 * passing underneath something.
 */
const FADE = TAB_BAR_FOOTPRINT + 12;

/**
 * Where along that run each stop of the ramp falls.
 *
 * Weighted to the bottom rather than spread evenly. Evenly spaced, the
 * ramp is already half strength at its middle, which puts visible fading a
 * long way clear of the bar; held back and then brought on quickly, almost
 * all of it happens in the last third — where the glass actually is.
 */
const FADE_STOPS = [0, 0.34, 0.56, 0.74, 0.89, 1] as const;

export function IosTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const display = useDisplay();

  /*
    The fill is one view that moves, not one per tab that appears.

    Drawn inside each item it could only ever be switched on and off, which
    is the jump this is here to avoid — and two of them would be alight at
    once for the length of any crossfade. So there is a single fill laid
    over the row, and what animates is where it is.
  */
  const [width, setWidth] = useState(0);
  const slot = state.routes.length > 0 ? width / state.routes.length : 0;
  const at = useRef(new Animated.Value(state.index)).current;

  useEffect(() => {
    const still = currentDisplay().reduceMotion;
    const anim = Animated.timing(at, {
      toValue: state.index,
      duration: still ? 0 : SLIDE,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [state.index, at]);

  return (
    <View
      // Laid over the page, anchored to the bottom of the tab host. The
      // wrapper the navigator puts this in has no height of its own once
      // this is taken out of the flow, which is what leaves the scenes the
      // whole screen and lets the page show through under the capsule.
      //
      // `box-none` so only the capsule takes touches: the rest of this
      // strip is page, and a list has to be scrollable through it.
      pointerEvents="box-none"
      accessibilityRole="tablist"
      // The same name UIKit gives its own bar, so a carer using VoiceOver
      // or TalkBack hears the same thing on either phone.
      accessibilityLabel="รายการแถบ"
      style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
    >
      {/* Edge to edge, under the capsule and out past it on both sides:
          the page runs the full width, so the ramp has to as well. */}
      <LinearGradient
        pointerEvents="none"
        colors={CANVAS_FADE as [string, string]}
        locations={FADE_STOPS as unknown as [number, number]}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: FADE,
        }}
      />
      <View
        pointerEvents="box-none"
        style={{
          paddingHorizontal: BAR.side,
          paddingBottom: BAR.bottom,
        }}
      >
        <Glass
          blurred
          style={{
            flexDirection: "row",
            width: "100%",
            height: BAR.height,
            borderRadius: BAR.height / 2,
            // Apple's bar casts one; the material would draw its own where it
            // exists, and where it does not this is what lifts it off the page.
            boxShadow: shadow({ blur: 12, y: 4, opacity: 0.14 }),
          }}
          onLayout={(e: LayoutChangeEvent) =>
            setWidth(e.nativeEvent.layout.width)
          }
        >
          {slot > 0 && (
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: PICKED,
                top: PICKED,
                width: slot - PICKED * 2,
                height: BAR.height - PICKED * 2,
                borderRadius: (BAR.height - PICKED * 2) / 2,
                backgroundColor: pickedFill(),
                transform: [
                  {
                    // A stop per tab rather than two and an extrapolation,
                    // so what the fill does between any pair of them is
                    // written down rather than inferred.
                    translateX: at.interpolate({
                      inputRange: state.routes.map((_, i) => i),
                      outputRange: state.routes.map((_, i) => i * slot),
                    }),
                  },
                ],
              }}
            />
          )}
          {state.routes.map((route, i) => {
            const { options } = descriptors[route.key];
            const on = state.index === i;
            const tint = on ? PRIMARY_500 : "#8E8E93";
            const icon = options.tabBarIcon?.({ focused: on });

            const press = () => {
              // The navigator's own event first, so a screen that wants to
              // intercept its tab — to scroll to the top, say — still can.
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (on || event.defaultPrevented) return;
              feel("tick");
              navigation.navigate(route.name, route.params);
            };

            return (
              <Pressable
                key={route.key}
                onPress={press}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={options.title ?? route.name}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                }}
              >
                {icon != null && (
                  <Image
                    source={icon as never}
                    style={{
                      width: BAR.icon,
                      height: BAR.icon,
                      tintColor: tint,
                    }}
                    resizeMode="contain"
                  />
                )}
                {display.tabLabels && (
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 10,
                      lineHeight: 16,
                      fontWeight: "500",
                      color: tint,
                    }}
                  >
                    {options.title ?? route.name}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </Glass>
      </View>
    </View>
  );
}
