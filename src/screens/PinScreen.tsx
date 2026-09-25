import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as LocalAuthentication from "expo-local-authentication";
import { ChevronLeft, Delete, LockKeyhole, ScanFace } from "lucide-react-native";

import { Glass, hasGlass } from "../components/Glass";
import { GlassIconButton } from "../components/GlassIconButton";
import { HeaderWash } from "../components/ScreenHeader";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import { setPin, signOut, useSession, type PinMode } from "../models/session";
import {
  CANVAS,
  DANGER,
  GLASS_NEUTRAL,
  PRIMARY_100,
  PRIMARY_500,
  PRIMARY_900,
  RIM_LIT,
  SEPARATOR,
  shadow,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const LENGTH = 6;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"] as const;

/** A key: a 76pt disc, as it was. */
const KEY_W = 76;
const KEY_H = 76;

/*
  The shadow a key casts, and it is nearly nothing where the material is real.

  Under Liquid Glass the shadow has one job — to give the disc back the edge
  its white tint took away — and at the weight the fallback wants it reads as
  a dark collar around every key rather than a lift. Where there is no
  material the key is a flat white circle on a near-white page, and there the
  shadow is the only thing holding it off the canvas.
*/
const KEY_SHADOW = shadow({
  blur: hasGlass() ? 3 : 14,
  y: hasGlass() ? 1 : 5,
  color: PRIMARY_900,
  opacity: hasGlass() ? 0.06 : 0.22,
});

/**
 * The tick under the thumb.
 *
 * Haptics come from a native module that the binary in hand may not carry
 * yet — so it is reached for lazily and inside a try, and a phone without
 * it simply feels nothing. A key gives the light selection tick; a refused
 * entry the error buzz; an unlock the success one.
 */
type HapticsModule = typeof import("expo-haptics");
let haptics: HapticsModule | null | undefined;
function feel(kind: "tick" | "error" | "success"): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    haptics ??= require("expo-haptics") as HapticsModule;
    if (haptics == null) return;
    if (kind === "tick") void haptics.selectionAsync();
    else if (kind === "error") void haptics.notificationAsync(haptics.NotificationFeedbackType.Error);
    else void haptics.notificationAsync(haptics.NotificationFeedbackType.Success);
  } catch {
    haptics = null;
  }
}

/** Which of the three things the page is asking for. */
type Phase = "verify" | "create" | "confirm";

/**
 * The PIN — six digits, in three jobs.
 *
 * Set up, the first time: entered twice, then the app opens. Changed, from
 * settings: the one in use first, then the new one twice. Unlocked: the one
 * in use, once, and the page goes away. All three are the same lock on a
 * pale disc, the same six dots, and the same keypad of glass keys; only the
 * words over the dots change. An entry that is refused shakes the dots so
 * the eye is told before the words are read.
 */
export function PinScreen({ mode: forced }: { mode?: PinMode }) {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  // The "Unlock" route hands the mode in as a prop; everything else says
  // it in the params, or says nothing and gets the first-run setup.
  const params = useRoute<RouteProp<RootStackParamList, "Pin">>().params;
  const mode: PinMode = forced ?? params?.mode ?? "setup";
  const session = useSession();

  // Unlocked: back to whatever was under the lock, or — at launch, when
  // nothing is — onto the tabs.
  const unlocked = () => {
    feel("success");
    if (nav.canGoBack()) nav.goBack();
    else nav.reset({ index: 0, routes: [{ name: "Main" }] });
  };

  // Nothing to verify against on first setup, or where no PIN was ever set.
  const [phase, setPhase] = useState<Phase>(
    mode === "setup" || session.pin == null ? "create" : "verify",
  );
  const [first, setFirst] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const shake = useRef(new Animated.Value(0)).current;
  const busy = useRef(false);

  // A lock cannot be swiped away.
  useLayoutEffect(() => {
    nav.setOptions({ gestureEnabled: mode !== "unlock" });
  }, [nav, mode]);

  // Face ID stands in for the PIN wherever the PIN in use is being asked
  // for — the unlock, and the check before a change — once it is switched
  // on in settings. It never stands in for choosing a new one.
  const canScan = session.biometric && phase === "verify";
  const scanFace = async () => {
    if (busy.current) return;
    try {
      const r = await LocalAuthentication.authenticateAsync({
        promptMessage: "ปลดล็อก Atlas HomeCare",
        cancelLabel: "ใช้รหัส PIN",
        disableDeviceFallback: true,
      });
      if (!r.success) return;
      if (mode === "unlock") unlocked();
      else advance("create");
    } catch {
      // The prompt failing to appear is the same as it being cancelled: the
      // keypad is still there.
    }
  };
  // A lock opens on Face ID by itself; the keypad is the fallback.
  useEffect(() => {
    if (mode === "unlock" && session.biometric) void scanFace();
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wobble = () =>
    Animated.sequence(
      [10, -10, 8, -8, 5, -5, 0].map((x) =>
        Animated.timing(shake, { toValue: x, duration: 45, useNativeDriver: true }),
      ),
    ).start();

  /** Refuse the entry: say why, shake, clear, and go to `next`. */
  const reject = (why: string, next: Phase) => {
    setError(why);
    feel("error");
    wobble();
    setTimeout(() => {
      setCode("");
      if (next === "create") setFirst(null);
      setPhase(next);
      busy.current = false;
    }, 320);
  };

  /** Accept the entry and move on, a beat later so the sixth dot is seen full. */
  const advance = (next: Phase) => {
    setTimeout(() => {
      setPhase(next);
      setCode("");
      setError(null);
      busy.current = false;
    }, 220);
  };

  const finish = (entered: string) => {
    busy.current = true;
    if (phase === "verify") {
      if (entered !== session.pin) {
        reject("รหัส PIN ไม่ถูกต้อง ลองอีกครั้ง", "verify");
        return;
      }
      if (mode === "unlock") {
        unlocked();
        return;
      }
      advance("create");
      return;
    }
    if (phase === "create") {
      // Any six digits are accepted — the choice is the user's.
      setFirst(entered);
      advance("confirm");
      return;
    }
    if (entered !== first) {
      reject("รหัส PIN ไม่ตรงกัน กรุณาตั้งใหม่อีกครั้ง", "create");
      return;
    }
    setPin(entered);
    feel("success");
    if (mode === "setup") {
      toast("ตั้งรหัส PIN เรียบร้อย");
      nav.reset({ index: 0, routes: [{ name: "Main" }] });
    } else {
      toast("เปลี่ยนรหัส PIN แล้ว");
      nav.goBack();
    }
  };

  const press = (k: string) => {
    if (busy.current) return;
    if (k === "⌫") {
      setCode((c) => c.slice(0, -1));
      return;
    }
    if (k === "" || code.length >= LENGTH) return;
    const next = code + k;
    setCode(next);
    setError(null);
    if (next.length === LENGTH) finish(next);
  };

  const back = () => {
    if (phase === "confirm") {
      setFirst(null);
      setCode("");
      setError(null);
      setPhase("create");
      return;
    }
    nav.goBack();
  };

  const title =
    phase === "verify"
      ? mode === "unlock"
        ? "ปลดล็อกแอป"
        : "ยืนยันรหัส PIN ปัจจุบัน"
      : phase === "create"
        ? mode === "change"
          ? "ตั้งรหัส PIN ใหม่"
          : "สร้างรหัส PIN"
        : "ยืนยันรหัส PIN";
  const subtitle =
    phase === "verify"
      ? mode === "unlock"
        ? "กรอกรหัส PIN 6 หลักเพื่อเข้าใช้งาน"
        : "กรอกรหัสที่ใช้อยู่ ก่อนตั้งรหัสใหม่"
      : phase === "create"
        ? "ตั้งรหัส 6 หลัก สำหรับปลดล็อกแอปครั้งถัดไป"
        : "กรอกรหัส 6 หลักเดิมอีกครั้ง";

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <HeaderWash height={insets.top + 300} />

      {mode !== "unlock" && (
        <View style={{ position: "absolute", top: insets.top + SPACE.sm, left: SPACE.lg, zIndex: 2 }}>
          <GlassIconButton
            onPress={back}
            accessibilityLabel={phase === "confirm" ? "ตั้งรหัสใหม่" : "ย้อนกลับ"}
          >
            <ChevronLeft size={24} color={TEXT_PRIMARY} strokeWidth={2.4} />
          </GlassIconButton>
        </View>
      )}

      <View style={{ flex: 1, paddingTop: insets.top + 84, paddingHorizontal: SPACE.lg, alignItems: "center" }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: PRIMARY_100,
          }}
        >
          <LockKeyhole size={32} color={PRIMARY_500} strokeWidth={2} />
        </View>

        <Text style={{ marginTop: SPACE.lg, fontSize: 24, lineHeight: 30, fontWeight: "800", color: TEXT_PRIMARY }}>
          {title}
        </Text>
        <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 20, color: TEXT_SECONDARY, textAlign: "center" }}>
          {subtitle}
        </Text>

        {/* The six dots, shaken together when the entry is refused. */}
        <Animated.View
          style={{
            flexDirection: "row",
            gap: 14,
            marginTop: SPACE.xxl,
            transform: [{ translateX: shake }],
          }}
        >
          {Array.from({ length: LENGTH }, (_, i) => {
            const filled = i < code.length;
            return (
              <View
                key={i}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: filled ? (error ? DANGER : PRIMARY_500) : "transparent",
                  borderWidth: filled ? 0 : 1.5,
                  borderColor: error ? DANGER : SEPARATOR,
                }}
              />
            );
          })}
        </Animated.View>

        <Text
          style={{
            marginTop: SPACE.md,
            minHeight: 20,
            fontSize: 13,
            lineHeight: 20,
            color: error ? DANGER : TEXT_MUTED,
            textAlign: "center",
          }}
        >
          {error ?? " "}
        </Text>

        {/* The way out of a forgotten PIN is the way out of the account. */}
        {mode === "unlock" && (
          <Pressable
            onPress={() => {
              signOut();
              nav.reset({ index: 0, routes: [{ name: "Login" }] });
            }}
            accessibilityRole="button"
            hitSlop={8}
            style={{ marginTop: SPACE.sm }}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: PRIMARY_500 }}>
              ลืมรหัส PIN? ออกจากระบบแล้วเข้าใหม่
            </Text>
          </Pressable>
        )}

        <View style={{ flex: 1 }} />

        {/* The keypad: three across, four down, glass keys on the page. */}
        <View style={{ width: "100%", maxWidth: 320, gap: SPACE.md, paddingBottom: insets.bottom + SPACE.xl }}>
          {[0, 1, 2, 3].map((row) => (
            <View key={row} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              {KEYS.slice(row * 3, row * 3 + 3).map((k, i) =>
                k === "" && canScan ? (
                  <Key key={`${row}-${i}`} label="face" onPress={() => void scanFace()} />
                ) : (
                  <Key key={`${row}-${i}`} label={k} onPress={() => press(k)} />
                ),
              )}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}


/**
 * One key: a 76pt disc of glass — a digit, the eraser, or Face ID — or an
 * empty slot where the grid has none.
 *
 * The disc casts its own shadow, and unusually for this app that holds on
 * iOS 26 too. Everywhere else the material carries its own depth and a
 * shadow over it only smudges it — but a key is glass standing on a plain
 * near-white page with nothing behind it to refract, and a digit key has a
 * white tint painted over the material on top of that. There was no edge
 * left for the eye to find: the keypad read as bare numerals lying on the
 * canvas. The shadow is what puts the disc back.
 *
 * Cast from a ring rather than a plate, which is the same trick the round
 * glass buttons use: a shadow needs a view to fall from, but anything
 * filled behind glass becomes all the material can sample and greys the
 * key out. A hairline border throws the same shadow and leaves the middle
 * clear.
 *
 * Pressed, the key dips — down to 0.94 with the shadow pulled in under it,
 * as though pushed toward the page — and springs back when the thumb
 * lifts. The finger already has the haptic tick; this is the eye's copy of
 * it, and it is wanted most on the digits, where nothing else on the page
 * changes except one more dot.
 */
function Key({ label, onPress }: { label: string; onPress: () => void }) {
  // 0 at rest, 1 held down. Native-driven, so the dip keeps up with a
  // thumb running along the keypad.
  const held = useRef(new Animated.Value(0)).current;
  const dip = held.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] });
  const lift = held.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] });

  if (label === "") return <View style={{ width: KEY_W, height: KEY_H }} />;
  const erase = label === "⌫";
  const face = label === "face";
  return (
    // Fires on the finger landing, not lifting, with a tick under it — a
    // keypad that waits for the release feels a beat behind the thumb.
    <Pressable
      onPressIn={() => {
        feel("tick");
        onPress();
        Animated.timing(held, {
          toValue: 1,
          duration: 70,
          useNativeDriver: true,
        }).start();
      }}
      onPressOut={() =>
        Animated.spring(held, {
          toValue: 0,
          friction: 5,
          tension: 220,
          useNativeDriver: true,
        }).start()
      }
      accessibilityRole="button"
      accessibilityLabel={erase ? "ลบ" : face ? "ปลดล็อกด้วย Face ID" : label}
    >
      <Animated.View style={{ transform: [{ scale: dip }] }}>
        <Animated.View
          style={{
            position: "absolute",
            width: KEY_W,
            height: KEY_H,
            borderRadius: KEY_H / 2,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: RIM_LIT,
            opacity: lift,
            boxShadow: KEY_SHADOW,
          }}
          pointerEvents="none"
        />
        <Glass
          interactive
          tintColor={erase || face ? undefined : GLASS_NEUTRAL}
          style={{
            width: KEY_W,
            height: KEY_H,
            borderRadius: KEY_H / 2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {erase ? (
            <Delete size={26} color={TEXT_PRIMARY} strokeWidth={2} />
          ) : face ? (
            <ScanFace size={30} color={PRIMARY_500} strokeWidth={2} />
          ) : (
            <Text style={{ fontSize: 30, lineHeight: 36, fontWeight: "600", color: TEXT_PRIMARY }}>{label}</Text>
          )}
        </Glass>
      </Animated.View>
    </Pressable>
  );
}
