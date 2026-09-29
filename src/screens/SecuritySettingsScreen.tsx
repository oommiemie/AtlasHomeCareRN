import type { ReactNode } from "react";
import { Switch, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as LocalAuthentication from "expo-local-authentication";
import { KeyRound } from "lucide-react-native";

import { Card } from "../components/Card";
import { Chevron } from "../components/Chevron";
import { PressableScale } from "../components/PressableScale";
import { SettingsScreen } from "../components/SettingsScreen";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import { setBiometric, useSession } from "../models/session";
import { detectBiometric, useBiometric } from "../models/biometric";
import { PRIMARY_500, SEPARATOR, SPACE, TEXT_MUTED, TEXT_PRIMARY } from "../theme/tokens";
import { tr } from "../i18n";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Icon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const BLUE = PRIMARY_500;
const VIOLET = "#7C6BF5";

/**
 * "ความปลอดภัย" — the PIN, and the device's biometric beside it.
 *
 * Two rows, in the shape the other settings pages use: change the PIN (the
 * old one is asked for first), and whether the face or the fingerprint may
 * stand in for it — whichever this device has, named as the device names
 * it. It goes with the PIN rather than replacing it: the PIN is still there
 * for the day the face or the finger is not recognised.
 */
export function SecuritySettingsScreen() {
  const nav = useNavigation<Nav>();
  const s = useSession();
  // Asked afresh as the page opens: a finger or a face may have been set
  // up in the device's settings since.
  const bio = useBiometric(true);
  const name = bio?.name ?? "";
  const usable = bio != null && bio.kind !== "none" && bio.enrolled;

  // Switching it on is proved on the spot: the device must have it, have a
  // face or a finger enrolled, and recognise this one — otherwise the
  // switch stays off and says why. Switching it off is just switching it off.
  const toggleBiometric = async (on: boolean) => {
    if (!on) {
      setBiometric(false);
      toast(tr(`ปิด${name}แล้ว`, `${name} off`), "success");
      return;
    }
    try {
      const b = await detectBiometric(true);
      if (b.kind === "none" || !b.enrolled) {
        toast(
          b.kind === "none"
            ? tr(
                "อุปกรณ์นี้ไม่รองรับการสแกนใบหน้าหรือลายนิ้วมือ",
                "This device doesn't support face or fingerprint unlock",
              )
            : tr(
                `ยังไม่ได้ตั้งค่า ${b.name} ในการตั้งค่าของเครื่อง`,
                `${b.name} isn't set up in this device's Settings`,
              ),
          "error",
        );
        return;
      }
      const r = await LocalAuthentication.authenticateAsync({
        promptMessage: tr(
          `ยืนยันตัวตนเพื่อเปิดใช้ ${b.name}`,
          `Verify it's you to turn on ${b.name}`,
        ),
        cancelLabel: tr("ยกเลิก", "Cancel"),
        disableDeviceFallback: true,
      });
      if (r.success) {
        setBiometric(true);
        toast(tr(`เปิดใช้ ${b.name} แล้ว`, `${b.name} on`), "success");
      } else if (
        // Backing out of the prompt is a choice, not a failure.
        r.error !== "user_cancel" &&
        r.error !== "system_cancel" &&
        r.error !== "app_cancel" &&
        r.error !== "user_fallback"
      ) {
        toast(tr("ยืนยันตัวตนไม่สำเร็จ", "Couldn't verify it's you"), "error");
      }
    } catch {
      toast(tr(`เปิดใช้ ${name} ไม่ได้`, `Couldn't turn on ${name}`), "error");
    }
  };

  return (
    <SettingsScreen
      title={tr("ความปลอดภัย", "Security")}
      footnote={tr(
        "รหัส PIN และการตั้งค่านี้เก็บบนอุปกรณ์เครื่องนี้เท่านั้น การออกจากระบบจะล้างรหัส PIN",
        "Your PIN and these settings are stored on this device only. Signing out clears the PIN.",
      )}
    >
      {/* One card, two rows: the PIN and the face that stands in for it. */}
      <Card padded={false}>
        <Row
          first
          icon={KeyRound}
          tint={BLUE}
          label={s.pin ? tr("เปลี่ยนรหัส PIN", "Change PIN") : tr("ตั้งรหัส PIN", "Set PIN")}
          detail={
            s.pin
              ? tr(
                  "ต้องยืนยันรหัสเดิมก่อน",
                  "You'll confirm your current PIN first",
                )
              : tr(
                  "ยังไม่ได้ตั้งรหัส PIN บนเครื่องนี้",
                  "No PIN set on this device yet",
                )
          }
          onPress={() => nav.navigate("Pin", { mode: "change" })}
        />
        {/* Named and drawn as this device's own — Face ID, Touch ID, a
            fingerprint — and switched off where the device has none, or
            has one with nothing enrolled in it yet. */}
        {bio != null && (
          <Row
            icon={bio.Icon}
            tint={VIOLET}
            label={
              bio.kind === "none"
                ? tr("ปลดล็อกด้วยไบโอเมตริกซ์", "Biometric unlock")
                : tr(`ปลดล็อกด้วย ${name}`, `Unlock with ${name}`)
            }
            detail={
              bio.kind === "none"
                ? tr(
                    "อุปกรณ์นี้ไม่รองรับการสแกนใบหน้าหรือลายนิ้วมือ",
                    "Not available on this device",
                  )
                : !bio.enrolled
                  ? tr(
                      `ตั้งค่า ${name} ในการตั้งค่าของเครื่องก่อน`,
                      `Set up ${name} in the device's Settings first`,
                    )
                  : tr("ใช้ร่วมกับรหัส PIN", "Works alongside your PIN")
            }
            right={
              <Switch
                value={usable && s.biometric}
                disabled={!usable}
                onValueChange={(on) => void toggleBiometric(on)}
                trackColor={{ true: PRIMARY_500 }}
                accessibilityLabel={tr(
                  `ปลดล็อกด้วย ${name}`,
                  `Unlock with ${name}`,
                )}
              />
            }
          />
        )}
      </Card>
    </SettingsScreen>
  );
}

/**
 * One row of a settings card, in the notification page's shape: the glyph
 * on its tinted disc, the label and its line, and at the right a control or
 * the arrow.
 */
function Row({
  first,
  icon: Ic,
  tint,
  label,
  detail,
  right,
  onPress,
}: {
  /** The card's top row draws no rule over itself. */
  first?: boolean;
  icon: Icon;
  tint: string;
  label: string;
  detail: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const body = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 60,
        paddingHorizontal: SPACE.lg,
        paddingVertical: SPACE.md,
        borderTopWidth: first === true ? 0 : 1,
        borderTopColor: SEPARATOR,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: `${tint}1F`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ic size={19} color={tint} />
      </View>
      <View style={{ flex: 1, marginLeft: SPACE.md }}>
        <Text style={{ fontSize: 16, fontWeight: "500", color: TEXT_PRIMARY }}>{label}</Text>
        <Text style={{ marginTop: 2, fontSize: 12, color: TEXT_MUTED }}>{detail}</Text>
      </View>
      {right}
      {onPress != null && <Chevron />}
    </View>
  );
  return onPress != null ? (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      {body}
    </PressableScale>
  ) : (
    body
  );
}
