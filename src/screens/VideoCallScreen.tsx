import { useState, type ComponentType } from "react";
import { Linking, Platform, Share, Text, View } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { Check, MessageSquare, Share2, Video } from "lucide-react-native";

import { Card } from "../components/Card";
import { PressableScale } from "../components/PressableScale";
import { SettingsScreen } from "../components/SettingsScreen";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import { useSession } from "../models/session";
import { carerLink, inviteText, newRoom, openRoom } from "../models/videoRoom";
import { feel } from "../utils/haptics";
import { tr } from "../i18n";
import {
  INK_OK,
  PRIMARY_100,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";

/**
 * "วิดีโอคอล" — a video visit, in two steps.
 *
 * The patient is sent a link first, then the carer goes in and waits:
 * the other way round is a carer in an empty room wondering whether the
 * message arrived. A room is made each time the page opens and lasts for
 * this one call (see `videoRoom`).
 */
export function VideoCallScreen() {
  const { name, phone } =
    useRoute<RouteProp<RootStackParamList, "VideoCall">>().params;
  const session = useSession();
  const carer = session.displayName || tr("พยาบาลเยี่ยมบ้าน", "Home-care nurse");
  const [room] = useState(newRoom);
  const [sent, setSent] = useState(false);
  const message = inviteText(room, carer);

  const bySms = () => {
    feel("tick");
    // iOS reads the body after "&", Android after "?".
    const sep = Platform.OS === "ios" ? "&" : "?";
    Linking.openURL(`sms:${phone}${sep}body=${encodeURIComponent(message)}`)
      .then(() => setSent(true))
      .catch(() =>
        toast(tr("เปิดแอปข้อความไม่ได้", "Couldn't open Messages"), "error"),
      );
  };

  const byApp = async () => {
    feel("tick");
    try {
      const r = await Share.share({ message });
      if (r.action === Share.sharedAction) setSent(true);
    } catch {
      toast(tr("แชร์ลิงก์ไม่ได้", "Couldn't share the link"), "error");
    }
  };

  const join = () => {
    feel("tick");
    openRoom(carerLink(room, carer)).catch(() =>
      toast(tr("เปิดห้องวิดีโอไม่ได้", "Couldn't open the video room"), "error"),
    );
  };

  return (
    <SettingsScreen
      title={tr("วิดีโอคอล", "Video call")}
      footnote={tr(
        "ห้องนี้สร้างขึ้นใหม่สำหรับการโทรครั้งนี้เท่านั้น ชื่อห้องเป็นรหัสสุ่ม ไม่มีชื่อคนไข้อยู่ในลิงก์",
        "This room is made for this call only. Its name is a random code — the patient's name is not in the link.",
      )}
    >
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: PRIMARY_100,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Video size={24} color={PRIMARY_500} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: "600", color: TEXT_PRIMARY }}>
              {name}
            </Text>
            <Text style={{ marginTop: 2, fontSize: 13, color: TEXT_MUTED }}>
              {tr(
                "คนไข้กดลิงก์แล้วเข้าห้องได้ทันที ไม่ต้องติดตั้งแอป",
                "The patient taps the link and joins — no app needed",
              )}
            </Text>
          </View>
        </View>
      </Card>

      <Step n={1} label={tr("ส่งลิงก์ให้คนไข้", "Send the link to the patient")} done={sent} />
      <Card padded={false}>
        {phone != null && phone !== "" && (
          <Row
            Icon={MessageSquare}
            label={tr("ส่ง SMS", "Send by SMS")}
            detail={phone}
            onPress={bySms}
          />
        )}
        <Row
          Icon={Share2}
          label={tr("ส่งทาง LINE หรือแอปอื่น", "Send by LINE or another app")}
          detail={tr("เลือกแอปจากเมนูแชร์ของเครื่อง", "Pick an app from the share menu")}
          onPress={byApp}
          divider={phone != null && phone !== ""}
        />
      </Card>

      <Step n={2} label={tr("เข้าห้องวิดีโอ", "Join the video room")} />
      <PressableScale
        onPress={join}
        accessibilityRole="button"
        accessibilityLabel={tr("เข้าห้องวิดีโอ", "Join the video room")}
        style={{
          height: 52,
          borderRadius: RADIUS.capsule,
          backgroundColor: PRIMARY_500,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: SPACE.sm,
        }}
      >
        <Video size={20} color="#FFFFFF" strokeWidth={2.4} />
        <Text style={{ fontSize: 17, fontWeight: "600", color: "#FFFFFF" }}>
          {tr("เข้าห้องวิดีโอ", "Join the video room")}
        </Text>
      </PressableScale>
    </SettingsScreen>
  );
}

/** A step's heading, ticked once it has been done. */
function Step({ n, label, done }: { n: number; label: string; done?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
      <Text style={{ flex: 1, fontSize: 16, fontWeight: "500", color: TEXT_PRIMARY }}>
        {`${n} · ${label}`}
      </Text>
      {done === true && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Check size={16} color={INK_OK} strokeWidth={2.6} />
          <Text style={{ fontSize: 13, fontWeight: "600", color: INK_OK }}>
            {tr("ส่งลิงก์แล้ว", "Link sent")}
          </Text>
        </View>
      )}
    </View>
  );
}

function Row({
  Icon,
  label,
  detail,
  onPress,
  divider = false,
}: {
  Icon: ComponentType<{ size?: number; color?: string }>;
  label: string;
  detail: string;
  onPress: () => void;
  divider?: boolean;
}) {
  return (
    <PressableScale
      scaleTo={0.995}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 60,
        paddingHorizontal: SPACE.lg,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: SEPARATOR,
      }}
    >
      <Icon size={20} color={PRIMARY_500} />
      <View style={{ flex: 1, marginLeft: SPACE.md, paddingVertical: SPACE.md }}>
        <Text style={{ fontSize: 16, fontWeight: "500", color: TEXT_PRIMARY }}>{label}</Text>
        <Text style={{ marginTop: 2, fontSize: 12, color: TEXT_MUTED }}>{detail}</Text>
      </View>
    </PressableScale>
  );
}
