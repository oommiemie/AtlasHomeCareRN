import type { ReactNode } from "react";
import { Switch, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as LocalAuthentication from "expo-local-authentication";
import { KeyRound, ScanFace } from "lucide-react-native";

import { Card } from "../components/Card";
import { Chevron } from "../components/Chevron";
import { PressableScale } from "../components/PressableScale";
import { SettingsScreen } from "../components/SettingsScreen";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import { setBiometric, useSession } from "../models/session";
import { PRIMARY_500, SEPARATOR, SPACE, TEXT_MUTED, TEXT_PRIMARY } from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Icon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const BLUE = PRIMARY_500;
const VIOLET = "#7C6BF5";

/**
 * "ความปลอดภัย" — the PIN, and Face ID beside it.
 *
 * Two rows, in the shape the other settings pages use: change the PIN (the
 * old one is asked for first), and whether Face ID may stand in for it.
 * Face ID goes with the PIN rather than replacing it — the PIN is still
 * there for the day the face is not recognised.
 */
export function SecuritySettingsScreen() {
  const nav = useNavigation<Nav>();
  const s = useSession();

  // Switching Face ID on is proved on the spot: the phone must have it,
  // have a face enrolled, and recognise this one — otherwise the switch
  // stays off and says why. Switching it off is just switching it off.
  const toggleBiometric = async (on: boolean) => {
    if (!on) {
      setBiometric(false);
      return;
    }
    const [hardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    if (!hardware || !enrolled) {
      toast("อุปกรณ์นี้ยังไม่ได้ตั้งค่า Face ID / Touch ID");
      return;
    }
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: "ยืนยันตัวตนเพื่อเปิดใช้ Face ID",
      cancelLabel: "ยกเลิก",
      disableDeviceFallback: true,
    });
    if (r.success) {
      setBiometric(true);
      toast("เปิดใช้ Face ID แล้ว");
    }
  };

  return (
    <SettingsScreen
      title="ความปลอดภัย"
      footnote="รหัส PIN และการตั้งค่านี้เก็บบนอุปกรณ์เครื่องนี้เท่านั้น การออกจากระบบจะล้างรหัส PIN"
    >
      {/* One card, two rows: the PIN and the face that stands in for it. */}
      <Card padded={false}>
        <Row
          first
          icon={KeyRound}
          tint={BLUE}
          label={s.pin ? "เปลี่ยนรหัส PIN" : "ตั้งรหัส PIN"}
          detail={s.pin ? "ต้องยืนยันรหัสเดิมก่อน" : "ยังไม่ได้ตั้งรหัส PIN บนเครื่องนี้"}
          onPress={() => nav.navigate("Pin", { mode: "change" })}
        />
        <Row
          icon={ScanFace}
          tint={VIOLET}
          label="ปลดล็อกด้วย Face ID"
          detail="ใช้ร่วมกับรหัส PIN"
          right={
            <Switch
              value={s.biometric}
              onValueChange={(on) => void toggleBiometric(on)}
              trackColor={{ true: PRIMARY_500 }}
              accessibilityLabel="ปลดล็อกด้วย Face ID"
            />
          }
        />
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
