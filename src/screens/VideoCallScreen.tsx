import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Mic, MicOff, PhoneOff, SwitchCamera, Video, VideoOff } from "lucide-react-native";

import { Avatar } from "../components/Avatar";
import { GlassIconButton } from "../components/GlassIconButton";
import { toast } from "../components/Toast";
import { UserPhoto } from "../components/UserPhoto";
import { currentDisplay } from "../models/display";
import type { RootStackParamList } from "../navigation/RootStack";
import { tr } from "../i18n";
import { GUTTER } from "../theme/layout";
import { SPACE } from "../theme/tokens";
import { feel } from "../utils/haptics";

/** How long it rings before the patient answers. */
const RING_MS = 2400;
const BUTTON = 64;
/** The call stays dark in either theme, as a phone's own call screen does. */
const INK = "#FFFFFF";
const INK_SOFT = "rgba(255,255,255,0.72)";
const CHIP_ON = "rgba(255,255,255,0.92)";
const CHIP_INK = "#10202C";
const HANG_UP = "rgba(255,56,60,0.92)";

const clockOf = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/**
 * "วิดีโอคอล" — the call, in the app, from ringing to hanging up.
 *
 * A prototype's call: nobody is on the other end, so the patient answers
 * after a moment and the clock starts. What is real is the carer's own
 * camera in the corner, because a call with a live face in it is what makes
 * the page read as a call; where there is no camera, or no permission, their
 * portrait stands in.
 */
export function VideoCallScreen() {
  const { name } = useRoute<RouteProp<RootStackParamList, "VideoCall">>().params;
  const nav = useNavigation();
  const insets = useSafeAreaInsets();

  const [connected, setConnected] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [facing, setFacing] = useState<"front" | "back">("front");
  const [cameraReady, setCameraReady] = useState(false);
  const [permission] = useCameraPermissions({ request: Platform.OS !== "web" });

  useEffect(() => {
    const answer = setTimeout(() => {
      setConnected(true);
      feel("success");
    }, RING_MS);
    return () => clearTimeout(answer);
  }, []);

  useEffect(() => {
    if (!connected) return;
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, [connected]);

  const end = () => {
    feel("tick");
    toast(
      connected
        ? tr(`วางสายแล้ว · ${clockOf(seconds)}`, `Call ended · ${clockOf(seconds)}`)
        : tr("ยกเลิกการโทรแล้ว", "Call cancelled"),
    );
    nav.goBack();
  };

  const showCamera = cameraOn && permission?.granted === true;

  return (
    <View style={{ flex: 1, backgroundColor: "#07131D" }}>
      <StatusBar style="light" />
      <LinearGradient
        colors={["#123A5C", "#0B2439", "#07131D"]}
        style={StyleSheet.absoluteFill}
      />

      {/* The patient, in the middle of the page. */}
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: GUTTER,
        }}
      >
        <View style={{ alignItems: "center", justifyContent: "center" }}>
          {!connected && <Ringing />}
          <Avatar size={148} initial={name.trim()[0] ?? "?"} />
        </View>
        <Text
          numberOfLines={2}
          style={{
            marginTop: SPACE.xl,
            fontSize: 26,
            fontWeight: "700",
            color: INK,
            textAlign: "center",
          }}
        >
          {name}
        </Text>
        <Text
          style={{
            marginTop: SPACE.xs,
            fontSize: 17,
            color: INK_SOFT,
            fontVariant: ["tabular-nums"],
          }}
        >
          {connected ? clockOf(seconds) : tr("กำลังโทร…", "Calling…")}
        </Text>
      </View>

      {/* The carer, in the corner. */}
      <View
        style={{
          position: "absolute",
          top: insets.top + SPACE.md,
          right: GUTTER,
          width: 116,
          height: 160,
          borderRadius: 22,
          overflow: "hidden",
          backgroundColor: "#16303F",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: "rgba(255,255,255,0.28)",
        }}
      >
        {showCamera && (
          <CameraView
            facing={facing}
            mirror={facing === "front"}
            onCameraReady={() => setCameraReady(true)}
            style={StyleSheet.absoluteFill}
          />
        )}
        {/* Over the camera until it has a picture: a simulator's never does,
            and a black box would read as something broken. */}
        {(!showCamera || !cameraReady) && (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: "#16303F",
                alignItems: "center",
                justifyContent: "center",
              },
            ]}
          >
            <UserPhoto size={72} />
          </View>
        )}
        {muted && (
          <View
            style={{
              position: "absolute",
              left: SPACE.sm,
              bottom: SPACE.sm,
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: "rgba(0,0,0,0.55)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MicOff size={14} color={INK} strokeWidth={2.4} />
          </View>
        )}
      </View>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          gap: SPACE.lg,
          paddingHorizontal: GUTTER,
          paddingTop: SPACE.lg,
          paddingBottom: insets.bottom + SPACE.xl,
        }}
      >
        <CallButton
          on={muted}
          label={muted ? tr("เปิดไมค์", "Unmute") : tr("ปิดไมค์", "Mute")}
          onPress={() => setMuted((m) => !m)}
        >
          {muted ? (
            <MicOff size={26} color={CHIP_INK} strokeWidth={2.2} />
          ) : (
            <Mic size={26} color={INK} strokeWidth={2.2} />
          )}
        </CallButton>
        <CallButton
          on={!cameraOn}
          label={cameraOn ? tr("ปิดกล้อง", "Turn camera off") : tr("เปิดกล้อง", "Turn camera on")}
          onPress={() => {
            setCameraReady(false);
            setCameraOn((c) => !c);
          }}
        >
          {cameraOn ? (
            <Video size={26} color={INK} strokeWidth={2.2} />
          ) : (
            <VideoOff size={26} color={CHIP_INK} strokeWidth={2.2} />
          )}
        </CallButton>
        <CallButton
          label={tr("สลับกล้อง", "Switch camera")}
          onPress={() => setFacing((f) => (f === "front" ? "back" : "front"))}
        >
          <SwitchCamera size={26} color={INK} strokeWidth={2.2} />
        </CallButton>
        <CallButton
          tint={HANG_UP}
          label={connected ? tr("วางสาย", "Hang up") : tr("ยกเลิกการโทร", "Cancel call")}
          onPress={end}
        >
          <PhoneOff size={26} color={INK} strokeWidth={2.2} />
        </CallButton>
      </View>
    </View>
  );
}

/** One round control. Filled white while the thing it switches is off. */
function CallButton({
  on = false,
  tint,
  label,
  onPress,
  children,
}: {
  on?: boolean;
  tint?: string;
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <GlassIconButton
      size={BUTTON}
      colorScheme="dark"
      tintColor={tint ?? (on ? CHIP_ON : undefined)}
      accessibilityLabel={label}
      onPress={() => {
        feel("tick");
        onPress();
      }}
    >
      {children}
    </GlassIconButton>
  );
}

/** Rings spreading from the patient while the call is unanswered. */
function Ringing() {
  const wave = useRef(new Animated.Value(0)).current;
  const still = currentDisplay().reduceMotion;

  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.timing(wave, {
        toValue: 1,
        duration: 1500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [still, wave]);

  if (still) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: 148,
        height: 148,
        borderRadius: 74,
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.6)",
        opacity: wave.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
        transform: [
          { scale: wave.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) },
        ],
      }}
    />
  );
}
