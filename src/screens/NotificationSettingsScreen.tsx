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
import {
  PRIMARY_500,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";

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
    title: "ภารกิจ",
    tint: BLUE,
    items: [
      {
        id: "new_task",
        icon: <Inbox size={18} color={BLUE} />,
        label: "ภารกิจใหม่",
        detail: "เมื่อมีงานใหม่ให้รับในพื้นที่ของคุณ",
      },
      {
        id: "reminder",
        icon: <Clock size={18} color={BLUE} />,
        label: "เตือนก่อนถึงเวลานัด",
        detail: "แจ้งล่วงหน้าก่อนเวลาเยี่ยมบ้าน",
      },
      {
        id: "changed",
        icon: <RefreshCw size={18} color={BLUE} />,
        label: "การเปลี่ยนแปลงนัดหมาย",
        detail: "เมื่อมีการเลื่อนหรือยกเลิกนัด",
      },
    ],
  },
  {
    title: "ผู้ป่วย",
    tint: AMBER,
    items: [
      {
        id: "vitals",
        icon: <Heart size={18} color={AMBER} />,
        label: "สัญญาณชีพผิดปกติ",
        detail: "เมื่อค่าที่บันทึกอยู่นอกเกณฑ์",
      },
      {
        id: "message",
        icon: <MessagesSquare size={18} color={AMBER} />,
        label: "ข้อความจากผู้ป่วย",
        detail: "เมื่อผู้ป่วยหรือผู้ดูแลติดต่อมา",
      },
    ],
  },
  {
    title: "ระบบ",
    tint: VIOLET,
    items: [
      {
        id: "announcement",
        icon: <Volume2 size={18} color={VIOLET} />,
        label: "ประกาศจากหน่วยงาน",
        detail: "ข่าวสารและประกาศจากต้นสังกัด",
      },
      {
        id: "app_update",
        icon: <ArrowDownCircle size={18} color={VIOLET} />,
        label: "อัปเดตแอพพลิเคชั่น",
        detail: "เมื่อมีเวอร์ชันใหม่ให้ติดตั้ง",
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
    <SettingsScreen title="การแจ้งเตือน">
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
              เปิดการแจ้งเตือน
            </Text>
            <Text style={{ marginTop: 2, fontSize: 12, color: TEXT_MUTED }}>
              {all ? "รับการแจ้งเตือนทั้งหมด" : "ปิดการแจ้งเตือนทั้งหมด"}
            </Text>
          </View>
          <Switch value={all} onValueChange={setAll} trackColor={{ true: PRIMARY_500 }} />
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
                    onValueChange={(v) => setEnabled((s) => ({ ...s, [t.id]: v }))}
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
              ทดสอบการแจ้งเตือน
            </Text>
            <Text style={{ marginTop: 2, fontSize: 12, color: TEXT_MUTED }}>
              ส่งการแจ้งเตือนตัวอย่างแต่ละประเภท
            </Text>
          </View>
          <Chevron />
        </View>
      </Card>

    </SettingsScreen>
  );
}
