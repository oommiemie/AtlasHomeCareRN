import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type AlertButton,
  type AlertOptions,
} from "react-native";
import { CircleHelp, Info, TriangleAlert } from "lucide-react-native";

import { Glass } from "./Glass";
import { tr } from "../i18n";
import { currentDisplay } from "../models/display";
import {
  DANGER,
  DANGER_BG,
  FILL_SUBTLE,
  LIQUID_GLASS,
  PRIMARY_100,
  PRIMARY_500,
  SURFACE,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  shadow,
} from "../theme/tokens";

/**
 * `Alert.alert`, as a dialog drawn in the app, on both platforms.
 *
 * Android gave the framework's old AlertDialog: square-cornered, in the
 * system's font, its buttons in whatever order the call listed them. iOS
 * gave UIKit's alert, which looks right but cannot be told anything: no
 * mark, no filled button for the action being asked about, the message a
 * single paragraph. So both draw this now, and the two builds ask the same
 * question the same way:
 *
 * - a mark saying what kind of dialog it is, over a centred title and
 *   message, the message's blank lines set as paragraph space;
 * - the actions as capsules — two side by side with the way out on the
 *   left, a list of three or more stacked with the way out at the foot —
 *   the one being asked about filled in the app's blue, or red where it
 *   destroys something.
 *
 * What each platform's dialog is standing on is left as that platform's.
 * On an iPhone with Liquid Glass the box is Apple's glass, over the light
 * dimming UIKit's own alert lays down; elsewhere it is a white card with
 * 28pt corners over Material's scrim, fading in and growing a touch as it
 * comes. The back button is the cancel button, where there is one.
 *
 * Reached through `Alert.alert` itself (`installAlertDialog`), so none of
 * the places that ask for a confirmation had to change. In a `Modal` of its
 * own, because it has to come up over whatever asked for it — a sheet is a
 * window of its own, and anything drawn in the app's root would open behind
 * it.
 */

/**
 * The box is Apple's glass where the phone has it, and paint elsewhere.
 *
 * Glass is also why the box itself does not fade or grow on an iPhone: a
 * transform or an alpha under one on anything above a UIVisualEffectView
 * stops it drawing its material. There the dimming fades and the glass is
 * simply there, as UIKit's own alert very nearly is.
 */
const GLASS_BOX = LIQUID_GLASS;

/** The mark over a heading: any of the app's line icons. */
type Mark = ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

/**
 * `Alert.alert`'s options, and one of the dialog's own: the mark to draw
 * over the heading, for a dialog that is none of the three it guesses —
 * an address with a way to get there is neither a question nor a warning.
 */
export type DialogOptions = AlertOptions & { icon?: Mark };

type Request = {
  title: string;
  message?: string;
  buttons: AlertButton[];
  options?: DialogOptions;
};

let listener: ((r: Request) => void) | null = null;

/** A capsule under the finger: the fill's grey, a step darker. */
const FILL_PRESSED = "rgba(120,120,128,0.24)";

export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: DialogOptions,
): void {
  listener?.({
    title,
    message,
    buttons:
      buttons != null && buttons.length > 0 ? buttons : [{ text: tr("ตกลง", "OK") }],
    options,
  });
}

/**
 * Sends `Alert.alert` here, on both platforms.
 *
 * Swapped on `Alert` itself, the way `androidParity` swaps its components,
 * so every call in the app — and every one not written yet — comes through
 * without having to know. The original is kept on the object and wrapped
 * afresh on each run, so Fast Refresh never wraps a wrapper; with no host
 * mounted, the platform's own alert still answers.
 */
export function installAlertDialog(): void {
  const A = Alert as unknown as {
    alert: (...args: unknown[]) => void;
    __atlasNativeAlert?: (...args: unknown[]) => void;
  };
  const native = (A.__atlasNativeAlert ??= A.alert);
  A.alert = (...args: unknown[]) => {
    if (listener == null) {
      native.apply(Alert, args);
      return;
    }
    const [title, message, buttons, options] = args as Parameters<
      typeof showAlert
    >;
    showAlert(title, message, buttons, options);
  };
}

export function AlertHost() {
  const [req, setReq] = useState<Request | null>(null);
  const [shown, setShown] = useState(false);
  // On the way out. The glass box goes at once — it cannot fade — and the
  // dimming follows it down.
  const [leaving, setLeaving] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const still = currentDisplay().reduceMotion;
  const { width } = useWindowDimensions();

  useEffect(() => {
    listener = (r) => {
      setReq(r);
      setShown(true);
    };
    return () => {
      listener = null;
    };
  }, []);

  useEffect(() => {
    if (!shown) return;
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: still ? 0 : 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [shown, still, fade]);

  // Out, then the button's own work — so what it opens next is not drawn
  // under a dialog still on its way off.
  const close = (then?: () => void) => {
    setLeaving(true);
    Animated.timing(fade, {
      toValue: 0,
      duration: still ? 0 : 120,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setShown(false);
      setLeaving(false);
      setReq(null);
      then?.();
    });
  };

  if (req == null) return null;

  const cancel = req.buttons.find((b) => b.style === "cancel");
  const others = req.buttons.filter((b) => b.style !== "cancel");
  const cancels = req.buttons.filter((b) => b.style === "cancel");

  /*
    A list of things to do, rather than a question.

    "ถ่ายภาพ · เลือกจากคลังภาพ · ยกเลิก" is not a yes or no: it is a
    menu, and every entry in it weighs the same. So nothing in it is filled
    and there is no mark over it, and the way out goes at the foot, where
    iOS puts it in the same list — stacked last rather than first.
  */
  const chooser = req.buttons.length >= 3;

  // Two buttons: the way out on the left, the way forward on the right.
  // A list: the way out at the foot.
  const ordered = chooser ? [...others, ...cancels] : [...cancels, ...others];

  /*
    The one action the dialog is asking about, filled: the one the caller
    marked preferred, or else the last that is not a way out. Blue, or red
    where it destroys something. One at most — two coloured buttons would
    leave the eye nothing to settle on. None in a list, unless asked for.
  */
  const primary =
    ordered.find((b) => b.isPreferred === true) ??
    (chooser ? undefined : [...others].reverse()[0]);

  /*
    The mark over the heading, read off the dialog itself so that none of
    the calls had to say: a warning in red where the action asked about
    destroys something, a question where there is a choice to make, and
    plain information where there is only the one button to close it.
  */
  const mark = chooser
    ? null
    : req.options?.icon != null
      ? { Icon: req.options.icon, ink: PRIMARY_500, ground: PRIMARY_100 }
      : primary?.style === "destructive"
      ? { Icon: TriangleAlert, ink: DANGER, ground: DANGER_BG }
      : ordered.length > 1
        ? { Icon: CircleHelp, ink: PRIMARY_500, ground: PRIMARY_100 }
        : { Icon: Info, ink: PRIMARY_500, ground: PRIMARY_100 };

  // A message's blank lines are paragraph breaks, set as space rather than
  // as an empty line of text.
  const paragraphs =
    req.message == null
      ? []
      : req.message
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter((p) => p.length > 0);

  const dismiss = () => {
    if (cancel != null) close(cancel.onPress as () => void);
    else if (req.options?.cancelable === true) close(req.options.onDismiss);
  };

  return (
    <Modal
      visible={shown}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={dismiss}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          // UIKit's own alert dims lightly; Material's scrim is heavier.
          {
            backgroundColor: GLASS_BOX ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.4)",
            opacity: fade,
          },
        ]}
      >
        <Pressable
          accessibilityLabel={tr("ปิด", "Close")}
          onPress={req.options?.cancelable === true ? dismiss : undefined}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View
        pointerEvents="box-none"
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        {!(GLASS_BOX && leaving) && (
          <Animated.View
            accessibilityRole="alert"
            style={[
              {
                // The width of UIKit's own alert on an iPhone 26 — 360 was a
                // card across most of the screen rather than a question in
                // the middle of it.
                width: Math.min(width - 48, 300),
                /*
                  The buttons 16 in from the sides and the foot alike, as
                  UIKit's own alert sets them; the words a further 8 in, so
                  a line of text does not run as close to the edge as a
                  button may.
                */
                paddingTop: 24,
                paddingHorizontal: 16,
                paddingBottom: 16,
              },
              GLASS_BOX
                ? // Apple's glass, as the box of its own alert is. It carries
                  // its own depth, so no shadow of ours.
                  { borderRadius: 34 }
                : {
                    borderRadius: 28,
                    backgroundColor: SURFACE,
                    boxShadow: shadow({ blur: 24, y: 12, opacity: 0.2 }),
                    opacity: fade,
                    transform: [
                      {
                        scale: fade.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.92, 1],
                        }),
                      },
                    ],
                  },
            ]}
          >
            {GLASS_BOX && (
              <Glass style={[StyleSheet.absoluteFill, { borderRadius: 34 }]} />
            )}
            <View style={{ paddingHorizontal: 8 }}>
              {/* What kind of question this is, before a word of it is read —
              Material's icon slot, with the heading centred under it. */}
              {mark != null && (
                <View
                  style={{
                    alignSelf: "center",
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    marginBottom: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: mark.ground,
                  }}
                >
                  <mark.Icon size={26} color={mark.ink} strokeWidth={2.2} />
                </View>
              )}
              <Text
                style={{
                  fontSize: 20,
                  lineHeight: 28,
                  fontWeight: "700",
                  color: TEXT_PRIMARY,
                  textAlign: "center",
                }}
              >
                {req.title}
              </Text>

              {paragraphs.length > 0 && (
                <View style={{ marginTop: 10, gap: 8 }}>
                  {paragraphs.map((p, i) => (
                    <Text
                      key={i}
                      style={{
                        fontSize: 15,
                        lineHeight: 22,
                        color: TEXT_SECONDARY,
                        textAlign: "center",
                      }}
                    >
                      {p}
                    </Text>
                  ))}
                </View>
              )}
            </View>

            {/*
            The buttons as iOS lays them out, which is what the same dialog
            looks like on an iPhone: capsules of the system fill, two side
            by side in equal halves with the way out on the left, and three
            or more stacked the full width. Red for a destructive one.
          */}
            <View
              style={{
                marginTop: 20,
                flexDirection:
                  !chooser && ordered.length === 2 ? "row" : "column",
                gap: 10,
              }}
            >
              {ordered.map((b, i) => {
                const main = b === primary;
                const red = b.style === "destructive";
                const fill = main ? (red ? DANGER : PRIMARY_500) : FILL_SUBTLE;
                return (
                  <Pressable
                    key={`${b.text ?? ""}-${i}`}
                    onPress={() => close(b.onPress as () => void)}
                    accessibilityRole="button"
                    accessibilityLabel={b.text}
                    style={({ pressed }) => ({
                      flex: !chooser && ordered.length === 2 ? 1 : undefined,
                      // The way out of a list sits a little apart from it.
                      marginTop: chooser && b.style === "cancel" ? 6 : 0,
                      height: 48,
                      paddingHorizontal: 16,
                      borderRadius: 24,
                      alignItems: "center",
                      justifyContent: "center",
                      // Pressed, the grey steps darker; a filled one dims a
                      // little, which reads as the same press on a colour.
                      backgroundColor: !main && pressed ? FILL_PRESSED : fill,
                      opacity: main && pressed ? 0.85 : 1,
                    })}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: main ? "#FFFFFF" : red ? DANGER : TEXT_PRIMARY,
                      }}
                    >
                      {b.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}
