import { useState } from "react";
import { Switch, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  FlaskConical,
  ArrowDownCircle,
  Bell,
  Clock,
  Heart,
  Inbox,
  MessagesSquare,
  RefreshCw,
  Volume2,
} from "lucide-react-native";

import type { RootStackParamList } from "../navigation/RootStack";
import { Chevron } from "../components/Chevron";
import { Card } from "../components/Card";
import { SettingsGroup, SettingsScreen } from "../components/SettingsScreen";
import { toast } from "../components/Toast";
import {
  PRIMARY_500,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";
import { tr } from "../i18n";

type Toggle = {
  id: string;
  icon: React.ReactNode;
  label: string;
  detail: string;
};

const BLUE = PRIMARY_500;
const AMBER = "#F59E0B";
const VIOLET = "#7C6BF5";

const GROUPS: { title: string; tint: string; items: Toggle[] }[] = [
  {
    title: tr("ภารกิจ", "Tasks"),
    tint: BLUE,
    items: [
      {
        id: "new_task",
        icon: <Inbox size={18} color={BLUE} />,
        label: tr("ภารกิจใหม่", "New tasks"),
        detail: tr(
          "เมื่อมีงานใหม่ให้รับในพื้นที่ของคุณ",
          "When there's new work to accept in your area",
        ),
      },
      {
        id: "reminder",
        icon: <Clock size={18} color={BLUE} />,
        label: tr("เตือนก่อนถึงเวลานัด", "Appointment reminders"),
        detail: tr(
          "แจ้งล่วงหน้าก่อนเวลาเยี่ยมบ้าน",
          "A heads-up before a home visit is due",
        ),
      },
      {
        id: "changed",
        icon: <RefreshCw size={18} color={BLUE} />,
        label: tr("การเปลี่ยนแปลงนัดหมาย", "Appointment changes"),
        detail: tr(
          "เมื่อมีการเลื่อนหรือยกเลิกนัด",
          "When an appointment is moved or canceled",
        ),
      },
    ],
  },
  {
    title: tr("ผู้ป่วย", "Patients"),
    tint: AMBER,
    items: [
      {
        id: "vitals",
        icon: <Heart size={18} color={AMBER} />,
        label: tr("สัญญาณชีพผิดปกติ", "Abnormal vital signs"),
        detail: tr(
          "เมื่อค่าที่บันทึกอยู่นอกเกณฑ์",
          "When a recorded value is out of range",
        ),
      },
      {
        id: "message",
        icon: <MessagesSquare size={18} color={AMBER} />,
        label: tr("ข้อความจากผู้ป่วย", "Patient messages"),
        detail: tr(
          "เมื่อผู้ป่วยหรือผู้ดูแลติดต่อมา",
          "When a patient or caregiver gets in touch",
        ),
      },
    ],
  },
  {
    title: tr("ระบบ", "System"),
    tint: VIOLET,
    items: [
      {
        id: "announcement",
        icon: <Volume2 size={18} color={VIOLET} />,
        label: tr("ประกาศจากหน่วยงาน", "Announcements from your unit"),
        detail: tr(
          "ข่าวสารและประกาศจากต้นสังกัด",
          "News and announcements from your organization",
        ),
      },
      {
        id: "app_update",
        icon: <ArrowDownCircle size={18} color={VIOLET} />,
        label: tr("อัปเดตแอพพลิเคชั่น", "App updates"),
        detail: tr(
          "เมื่อมีเวอร์ชันใหม่ให้ติดตั้ง",
          "When a new version is ready to install",
        ),
      },
    ],
  },
];

/** "การแจ้งเตือน" — which alerts the carer wants. */
export function NotificationSettingsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // Everything on to begin with: a carer who has not chosen yet is better
  // served by hearing about work than by silently missing it.
  const [all, setAll] = useState(true);
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(GROUPS.flatMap((g) => g.items.map((t) => [t.id, true]))),
  );

  return (
    <SettingsScreen title={tr("การแจ้งเตือน", "Notifications")}>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(0,136,255,0.12)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Bell size={20} color={BLUE} />
          </View>
          <View style={{ flex: 1, marginLeft: SPACE.md }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: TEXT_PRIMARY }}>
              {tr("เปิดการแจ้งเตือน", "Allow notifications")}
            </Text>
            <Text style={{ marginTop: 2, fontSize: 12, color: TEXT_MUTED }}>
              {all
                ? tr("รับการแจ้งเตือนทั้งหมด", "Receiving all notifications")
                : tr("ปิดการแจ้งเตือนทั้งหมด", "All notifications are off")}
            </Text>
          </View>
          <Switch
            value={all}
            onValueChange={(v) => {
              setAll(v);
              toast(
                v
                  ? tr("เปิดการแจ้งเตือนทั้งหมดแล้ว", "All notifications on")
                  : tr("ปิดการแจ้งเตือนทั้งหมดแล้ว", "All notifications off"),
                "success",
              );
            }}
            trackColor={{ true: PRIMARY_500 }}
          />
        </View>
      </Card>

      {GROUPS.map((g) => (
        <SettingsGroup key={g.title} title={g.title}>
          {/* Dimmed rather than hidden when the master is off: the carer can
              still see what they chose, and turning it back on restores it. */}
          <View style={{ opacity: all ? 1 : 0.4 }} pointerEvents={all ? "auto" : "none"}>
            <Card padded={false}>
              {g.items.map((t, i) => (
                <View
                  key={t.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    minHeight: 60,
                    // The row carries the padding, not the text block inside
                    // it: given to the text alone, the row's centre line sat
                    // above the text's and the switch rode up with it.
                    paddingVertical: SPACE.md,
                    paddingHorizontal: SPACE.lg,
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: SEPARATOR,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: `${g.tint}1F`,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {t.icon}
                  </View>
                  <View style={{ flex: 1, marginLeft: SPACE.md }}>
                    <Text style={{ fontSize: 16, fontWeight: "500", color: TEXT_PRIMARY }}>
                      {t.label}
                    </Text>
                    <Text style={{ marginTop: 2, fontSize: 12, color: TEXT_MUTED }}>
                      {t.detail}
                    </Text>
                  </View>
                  <Switch
                    value={enabled[t.id] ?? false}
                    onValueChange={(v) => {
                      setEnabled((s) => ({ ...s, [t.id]: v }));
                      toast(
                        tr(
                          `${v ? "เปิด" : "ปิด"}การแจ้งเตือน · ${t.label}`,
                          `${t.label} · ${v ? "On" : "Off"}`,
                        ),
                        "success",
                      );
                    }}
                    trackColor={{ true: PRIMARY_500 }}
                    style={{ alignSelf: "center" }}
                  />
                </View>
              ))}
            </Card>
          </View>
        </SettingsGroup>
      ))}
      {/* A build with no server behind it still has to be shown working. */}
      <Card onPress={() => nav.navigate("NotificationTest")}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(0,136,255,0.12)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FlaskConical size={20} color={BLUE} />
          </View>
          <View style={{ flex: 1, marginLeft: SPACE.md }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: TEXT_PRIMARY }}>
              {tr("ทดสอบการแจ้งเตือน", "Test notifications")}
            </Text>
            <Text style={{ marginTop: 2, fontSize: 12, color: TEXT_MUTED }}>
              {tr(
                "ส่งการแจ้งเตือนตัวอย่างแต่ละประเภท",
                "Send a sample of each type",
              )}
            </Text>
          </View>
          <Chevron />
        </View>
      </Card>

    </SettingsScreen>
  );
}
