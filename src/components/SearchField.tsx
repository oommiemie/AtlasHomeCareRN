import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Mic, Search } from "lucide-react-native";

import { Glass, hasGlass } from "./Glass";
import { toast } from "./Toast";
import { currentDisplay } from "../models/display";
import { listenOnce } from "../models/dictate";
import { feel } from "../utils/haptics";
import { tr } from "../i18n";
import {
  GLASS_LIFT,
  GLASS_NEUTRAL,
  PANEL,
  PRIMARY_500,
  RADIUS,
  RIM_LIT,
  SPACE,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  glassTint,
  shadow,
} from "../theme/tokens";

/** The height every screen reserves for the field. */
export const SEARCH_FIELD_HEIGHT = 46;

/**
 * The app's search field, on Apple's own Liquid Glass.
 *
 * The tint stays translucent on purpose: an opaque fill hides the material
 * and the field reads as a plain grey box. Under the fallback the tint has to
 * be near-solid instead, or there is nothing behind the text at all.
 */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  autoFocus,
  fill,
  tintColor,
  colorScheme,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  /** A milkier tint than the default, for a field with a busy ground. */
  tintColor?: string;
  /**
   * Pins the material's appearance instead of letting it follow the device
   * theme. "light" is the frosted white.
   */
  colorScheme?: "auto" | "light" | "dark";
  /**
   * A plain fill instead of the glass, for surfaces the material cannot work
   * against. On an opaque sheet a glass field has nothing behind it to
   * refract and its white tint lands on near-white ground — the field
   * vanishes. The map sheet passes the design's `#787880` at 16%.
   */
  fill?: string;
}) {
  const Surface = fill == null ? Glass : View;
  const surfaceProps =
    fill == null
      ? {
          interactive: true,
          colorScheme,
          tintColor: tintColor ?? glassTint(GLASS_NEUTRAL, PANEL),
        }
      : {};

  /*
    Searching by voice, from the microphone at the end of the field.

    It was drawn there and did nothing — a picture of a control, on every
    list in the app, left over from the design. A carer at a house with a
    bag in one hand says a name faster than they type one in Thai, so it
    does what it shows: one tap listens, the words go into the field as
    they are recognised and the list narrows with them, and a pause ends
    it. A second tap stops it early.
  */
  const [listening, setListening] = useState(false);
  const session = useRef<{ stop: () => void; cancel: () => void } | null>(
    null,
  );
  const live = useRef(false);
  const mounted = useRef(true);
  // The newest handler, whatever render the words arrive in.
  const change = useRef(onChangeText);
  change.current = onChangeText;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      session.current?.cancel();
    };
  }, []);

  const voice = async () => {
    if (listening) {
      session.current?.stop();
      return;
    }
    Keyboard.dismiss();
    feel("tick");
    live.current = true;
    setListening(true);
    const s = await listenOnce(
      (text) => change.current(text),
      (how, why) => {
        live.current = false;
        session.current = null;
        if (!mounted.current) return;
        setListening(false);
        if (how === "denied") toast(why ?? tr("ใช้ไมโครโฟนไม่ได้", "Can't use the microphone"), "error");
        else if (how === "silent")
          toast(tr("ไม่ได้ยินเสียง ลองพูดอีกครั้ง", "Didn't hear anything. Try again."), "warning");
        else if (how === "failed")
          toast(tr("ฟังเสียงไม่สำเร็จ ลองใหม่อีกครั้ง", "Couldn't listen. Try again."), "error");
      },
    );
    if (!mounted.current) s.cancel();
    else if (live.current) session.current = s;
  };

  // The ring that breathes out from the button while it listens. Held
  // still under reduce motion; the filled button says it on its own.
  const halo = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!listening || currentDisplay().reduceMotion) {
      halo.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(halo, {
        toValue: 1,
        duration: 1100,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [listening, halo]);

  return (
    <View>
      {/*
        The edge the material would have drawn, where there is none.

        Apple's glass carries its own rim and depth, which is what stands the
        field off the header on an iPhone. The stand-in is a near-white wash
        on a near-white page and nothing else, and the field all but
        vanished. The back button beside it had the same trouble and the
        same answer: a hairline ring casting the app's glass lift — a ring
        rather than a plate, so nothing is laid behind the wash.
      */}
      {fill == null && !hasGlass() && (
        <View
          pointerEvents="none"
          style={{
            ...StyleSheet.absoluteFillObject,
            borderRadius: RADIUS.capsule,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: RIM_LIT,
            boxShadow: shadow(GLASS_LIFT),
          }}
        />
      )}
      <Surface
        {...(surfaceProps as object)}
        style={{
          ...(fill != null ? { backgroundColor: fill } : null),
          height: SEARCH_FIELD_HEIGHT,
          borderRadius: RADIUS.capsule,
          overflow: "hidden",
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: SPACE.md,
          gap: SPACE.sm,
        }}
      >
        <Search size={18} color={TEXT_SECONDARY} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={listening ? tr("กำลังฟัง…", "Listening…") : placeholder}
          placeholderTextColor={TEXT_SECONDARY}
          autoFocus={autoFocus}
          returnKeyType="search"
          clearButtonMode="while-editing"
          style={{
            flex: 1,
            fontSize: 16,
            letterSpacing: -0.08,
            color: TEXT_PRIMARY,
          }}
        />
        <Pressable
          onPress={() => void voice()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={listening ? tr("หยุดฟัง", "Stop listening") : tr("ค้นหาด้วยเสียง", "Search by voice")}
          accessibilityState={{ busy: listening }}
          style={{
            width: 32,
            height: 32,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {listening && (
            <>
              <Animated.View
                pointerEvents="none"
                style={{
                  ...StyleSheet.absoluteFillObject,
                  borderRadius: 16,
                  backgroundColor: PRIMARY_500,
                  opacity: halo.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.35, 0],
                  }),
                  transform: [
                    {
                      scale: halo.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.4],
                      }),
                    },
                  ],
                }}
              />
              <View
                pointerEvents="none"
                style={{
                  ...StyleSheet.absoluteFillObject,
                  borderRadius: 16,
                  backgroundColor: PRIMARY_500,
                }}
              />
            </>
          )}
          <Mic size={17} color={listening ? "#FFFFFF" : TEXT_SECONDARY} />
        </Pressable>
      </Surface>
    </View>
  );
}
