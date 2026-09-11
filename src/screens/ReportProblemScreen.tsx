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
  TEXT_PRIMARY,
} from "../theme/tokens";

const KINDS = [
  { id: "crash", icon: AlertTriangle, label: "แอพขัดข้อง", detail: "ค้าง ปิดเอง หรือใช้งานไม่ได้" },
  { id: "data", icon: FileWarning, label: "ข้อมูลไม่ถูกต้อง", detail: "ข้อมูลผู้ป่วยหรือภารกิจผิดพลาด" },
  { id: "map", icon: MapPin, label: "แผนที่และเส้นทาง", detail: "ตำแหน่งผิดหรือหาเส้นทางไม่ได้" },
  { id: "other", icon: MoreHorizontal, label: "อื่นๆ", detail: "ปัญหาอื่นที่ไม่อยู่ในรายการ" },
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
    <SettingsScreen title="รายงานปัญหา">
      <Text style={{ fontSize: 16, fontWeight: "500", color: TEXT_PRIMARY }}>
        ประเภทปัญหา
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
                <Text style={{ fontSize: 15, fontWeight: "500", color: TEXT_PRIMARY }}>
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
        รายละเอียด
      </Text>
      <Card>
        <TextInput
          value={detail}
          onChangeText={setDetail}
          multiline
          numberOfLines={5}
          placeholder="เกิดอะไรขึ้น และเกิดตอนไหน ยิ่งบอกละเอียด ทีมงานยิ่งแก้ได้เร็ว"
          placeholderTextColor={TEXT_MUTED}
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
            <Text style={{ fontSize: 15, fontWeight: "500", color: TEXT_PRIMARY }}>
              แนบข้อมูลเครื่อง
            </Text>
            <Text style={{ marginTop: 2, fontSize: 12, color: TEXT_MUTED }}>
              รุ่นเครื่องและเวอร์ชันแอพ ช่วยให้หาสาเหตุได้เร็วขึ้น
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
                toast("ส่งรายงานเรียบร้อย ขอบคุณครับ");
                nav.goBack();
              }
            : undefined
        }
        accessibilityRole="button"
        accessibilityLabel="ส่งรายงาน"
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
          ส่งรายงาน
        </Text>
      </PressableScale>
    </SettingsScreen>
  );
}
