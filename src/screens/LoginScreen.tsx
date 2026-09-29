import { useState } from "react";
import { Image, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";

import { PrimaryAction } from "../components/ActionBar";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import { signIn } from "../models/session";
import app from "../../app.json";
import {
  CANVAS,
  SPACE,
  TEXT_MUTED,
  TEXT_SECONDARY,
  TINT_BG,
  WASH_TINT,
} from "../theme/tokens";
import { readable, useLayout, GUTTER } from "../theme/layout";
import { tr } from "../i18n";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const VERSION: string = app.expo.version;

/**
 * The way in: one button.
 *
 * Health workers sign in with the Provider ID account the Ministry's
 * Digital Health Office issues them, on the Ministry's own page — so this
 * page asks for nothing. The mark and the name on the pale sky every
 * pushed screen opens with, brought down further so the page has a sky,
 * and under them the one button that hands off to Provider ID, with the
 * build's version in the small print so a screenshot says which one.
 *
 * The hand-off is stood in for: the button waits a moment and comes back
 * signed in. Swap `submit` for the real redirect.
 */
export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const [busy, setBusy] = useState(false);
  const { regular } = useLayout();

  const submit = () => {
    if (busy) return;
    setBusy(true);
    // The round trip a real sign-in takes, so the button is seen to work.
    setTimeout(() => {
      signIn("provider");
      toast(tr("เข้าสู่ระบบแล้ว", "Signed in"), "success");
      setBusy(false);
      nav.navigate("Consent");
    }, 700);
  };

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <LinearGradient
        pointerEvents="none"
        colors={[WASH_TINT, TINT_BG, CANVAS]}
        locations={[0, 0.6, 1]}
        style={{ position: "absolute", left: 0, right: 0, top: 0, height: insets.top + 420 }}
      />

      <View
        style={{
          flex: 1,
          paddingHorizontal: GUTTER,
          paddingTop: insets.top + 96,
          paddingBottom: insets.bottom + SPACE.lg,
          // On a tablet the button keeps a phone's proportions, centred,
          // rather than a bar the width of the screen.
          ...(regular ? readable(440) : null),
        }}
      >
        {/* The logo — it carries the name, so nothing repeats it. */}
        <View style={{ alignItems: "center", gap: SPACE.md }}>
          <Image
            source={require("../../assets/logo.png")}
            style={{ width: 128, height: 134 }}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="Atlas HomeCare"
          />
          <Text style={{ fontSize: 15, lineHeight: 22, color: TEXT_SECONDARY, textAlign: "center" }}>
            {tr(
              "ระบบดูแลสุขภาพที่บ้าน สำหรับบุคลากรสาธารณสุข",
              "Home health care for public health workers",
            )}
          </Text>
        </View>

        <View style={{ flex: 1 }} />

        {/* The one button, and the small print under it. */}
        <View style={{ gap: SPACE.md }}>
          <PrimaryAction
            label={
              busy
                ? tr("กำลังเชื่อมต่อ Provider ID…", "Connecting to Provider ID…")
                : tr("เข้าสู่ระบบด้วย Provider ID", "Sign in with Provider ID")
            }
            disabled={busy}
            onPress={submit}
          />
          <Text
            style={{
              fontSize: 12,
              lineHeight: 18,
              color: TEXT_MUTED,
              textAlign: "center",
              paddingHorizontal: SPACE.md,
            }}
          >
            {tr(
              "บัญชี Provider ID ออกให้บุคลากรสาธารณสุขโดยสำนักสุขภาพดิจิทัล กระทรวงสาธารณสุข (id.moph.go.th)",
              "Provider ID accounts are issued to public health workers by the Digital Health Office, Ministry of Public Health (id.moph.go.th)",
            )}
          </Text>
          <Text style={{ fontSize: 11, lineHeight: 16, color: TEXT_MUTED, textAlign: "center", opacity: 0.8 }}>
            {tr(`เวอร์ชัน ${VERSION}`, `Version ${VERSION}`)}
          </Text>
        </View>
      </View>
    </View>
  );
}
