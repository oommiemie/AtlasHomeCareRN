import { useState } from "react";
import { Switch, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { AlertTriangle, Check, FileWarning, MapPin, MoreHorizontal } from "lucide-react-native";

import { Card } from "../components/Card";
import { PressableScale } from "../components/PressableScale";
import { SettingsScreen } from "../components/SettingsScreen";
import { toast } from "../components/Toast";
import {
  GROUPED_BG,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PLACEHOLDER,
  TEXT_PRIMARY,
} from "../theme/tokens";
import { tr } from "../i18n";

const KINDS = [
  {
    id: "crash",
    icon: AlertTriangle,
    label: tr("แอพขัดข้อง", "App crashed"),
    detail: tr(
      "ค้าง ปิดเอง หรือใช้งานไม่ได้",
      "Froze, closed by itself or stopped working",
    ),
  },
  {
    id: "data",
    icon: FileWarning,
    label: tr("ข้อมูลไม่ถูกต้อง", "Incorrect data"),
    detail: tr(
      "ข้อมูลผู้ป่วยหรือภารกิจผิดพลาด",
      "Wrong patient or task details",
    ),
  },
  {
    id: "map",
    icon: MapPin,
    label: tr("แผนที่และเส้นทาง", "Map and directions"),
    detail: tr(
      "ตำแหน่งผิดหรือหาเส้นทางไม่ได้",
      "Wrong location or no route found",
    ),
  },
  {
    id: "other",
    icon: MoreHorizontal,
    label: tr("อื่นๆ", "Other"),
    detail: tr("ปัญหาอื่นที่ไม่อยู่ในรายการ", "A problem not listed here"),
  },
] as const;

/** "รายงานปัญหา" — what went wrong, and enough detail to act on it. */
export function ReportProblemScreen() {
  const [kind, setKind] = useState<string | null>(null);
  const [detail, setDetail] = useState("");
  const [attachDevice, setAttachDevice] = useState(true);
  const nav = useNavigation();

  // Both matter: the kind routes it, the words are what someone reads.
  const canSend = kind != null && detail.trim().length > 0;

  return (
    <SettingsScreen title={tr("รายงานปัญหา", "Report a problem")}>
      <Text style={{ fontSize: 16, fontWeight: "500", color: TEXT_PRIMARY }}>
        {tr("ประเภทปัญหา", "Problem type")}
      </Text>
      <Card padded={false}>
        {KINDS.map((k, i) => {
          const Icon = k.icon;
          const selected = kind === k.id;
          return (
            <PressableScale
              key={k.id}
              scaleTo={0.995}
              onPress={() => setKind(k.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={k.label}
              style={{
                flexDirection: "row",
                alignItems: "center",
                minHeight: 60,
                paddingHorizontal: SPACE.lg,
                borderTopWidth: i > 0 ? 1 : 0,
                borderTopColor: SEPARATOR,
              }}
            >
              <Icon size={20} color={selected ? PRIMARY_500 : TEXT_MUTED} />
              <View style={{ flex: 1, marginLeft: SPACE.md, paddingVertical: SPACE.md }}>
                <Text style={{ fontSize: 16, fontWeight: "500", color: TEXT_PRIMARY }}>
                  {k.label}
                </Text>
                <Text style={{ marginTop: 2, fontSize: 12, color: TEXT_MUTED }}>
                  {k.detail}
                </Text>
              </View>
              {selected && <Check size={20} color={PRIMARY_500} strokeWidth={2.6} />}
            </PressableScale>
          );
        })}
      </Card>

      <Text style={{ fontSize: 16, fontWeight: "500", color: TEXT_PRIMARY }}>
        {tr("รายละเอียด", "Details")}
      </Text>
      <Card>
        <TextInput
          value={detail}
          onChangeText={setDetail}
          multiline
          numberOfLines={5}
          placeholder={tr(
            "เกิดอะไรขึ้น และเกิดตอนไหน ยิ่งบอกละเอียด ทีมงานยิ่งแก้ได้เร็ว",
            "What happened, and when? The more detail you give, the faster the team can fix it.",
          )}
          placeholderTextColor={TEXT_PLACEHOLDER}
          style={{
            minHeight: 110,
            fontSize: 14,
            lineHeight: 22,
            color: TEXT_PRIMARY,
            textAlignVertical: "top",
          }}
        />
      </Card>

      <Card>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: "500", color: TEXT_PRIMARY }}>
              {tr("แนบข้อมูลเครื่อง", "Attach device info")}
            </Text>
            <Text style={{ marginTop: 2, fontSize: 12, color: TEXT_MUTED }}>
              {tr(
                "รุ่นเครื่องและเวอร์ชันแอพ ช่วยให้หาสาเหตุได้เร็วขึ้น",
                "Device model and app version help find the cause faster",
              )}
            </Text>
          </View>
          <Switch
            value={attachDevice}
            onValueChange={setAttachDevice}
            trackColor={{ true: PRIMARY_500 }}
          />
        </View>
      </Card>

      <PressableScale
        onPress={
          canSend
            ? () => {
                toast(tr("ส่งรายงานแล้ว ขอบคุณที่แจ้ง", "Report sent. Thanks for letting us know"), "success");
                nav.goBack();
              }
            : // Greyed out, but it still gives under the finger — say why.
              () => toast(tr("เลือกประเภทและเขียนรายละเอียดก่อนส่ง", "Choose a type and describe the problem before sending"), "error")
        }
        accessibilityRole="button"
        accessibilityLabel={tr("ส่งรายงาน", "Send report")}
        accessibilityState={{ disabled: !canSend }}
        style={{
          marginTop: SPACE.sm,
          height: 52,
          borderRadius: RADIUS.capsule,
          alignItems: "center",
          justifyContent: "center",
          // Disabled rather than hidden: the button stays where the eye
          // expects it, and its greyed state says something is missing.
          backgroundColor: canSend ? PRIMARY_500 : GROUPED_BG,
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: "600",
            color: canSend ? "#FFFFFF" : TEXT_MUTED,
          }}
        >
          {tr("ส่งรายงาน", "Send report")}
        </Text>
      </PressableScale>
    </SettingsScreen>
  );
}
