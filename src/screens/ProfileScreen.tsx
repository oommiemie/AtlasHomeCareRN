import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Bell, FileText, Globe, HelpCircle, Info, LogOut, MessageSquareWarning, Monitor, ShieldCheck, ShieldQuestion, User } from "lucide-react-native";

import { Chevron } from "../components/Chevron";
import { useTabBarInset } from "../utils/useTabBarInset";
import { Card } from "../components/Card";
import { LivingGradient } from "../components/LivingGradient";
import { PressableScale } from "../components/PressableScale";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  DANGER,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const BLUE = "#0088FF";
const AMBER = "#F59E0B";
const VIOLET = "#7C6BF5";

type Item = {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  detail: string;
  tint: string;
  value?: string;
  danger?: boolean;
  route?: keyof RootStackParamList;
};

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "ตั้งค่าทั่วไป",
    items: [
      {
        icon: Bell,
        label: "การแจ้งเตือน",
        detail: "จัดการการแจ้งเตือนที่ต้องการรับ",
        tint: BLUE,
        route: "NotificationSettings",
      },
      {
        icon: Globe,
        label: "ภาษา",
        detail: "ภาษาที่ใช้แสดงผลในแอพ",
        tint: BLUE,
        value: "ไทย",
        route: "LanguageSettings",
      },
      {
        icon: ShieldCheck,
        label: "ความปลอดภัย",
        detail: "ตั้งรหัส PIN และการยืนยันตัวตน",
        tint: BLUE,
      },
    ],
  },
  {
    title: "ศูนย์ช่วยเหลือและสนับสนุน",
    items: [
      {
        icon: HelpCircle,
        label: "ศูนย์ช่วยเหลือ",
        detail: "คำถามที่พบบ่อยเกี่ยวกับการใช้งาน",
        tint: AMBER,
        route: "HelpCenter",
      },
      {
        icon: MessageSquareWarning,
        label: "รายงานปัญหา",
        detail: "แจ้งปัญหาการใช้งานให้ทีมงาน",
        tint: AMBER,
        route: "ReportProblem",
      },
    ],
  },
  {
    title: "ข้อมูลแอพ",
    items: [
      {
        icon: ShieldQuestion,
        label: "นโยบายความเป็นส่วนตัว",
        detail: "การเก็บและใช้ข้อมูลส่วนบุคคล",
        tint: VIOLET,
      },
      {
        icon: Info,
        label: "เกี่ยวกับแอพพลิเคชั่น",
        detail: "ข้อมูลผู้พัฒนาและที่มาของแอพ",
        tint: VIOLET,
      },
      {
        icon: FileText,
        label: "Term of Usage",
        detail: "ข้อตกลงในการใช้แอพและบริการ",
        tint: VIOLET,
      },
      {
        icon: Monitor,
        label: "ระบบที่ใช้งาน",
        detail: "เวอร์ชันแอพและอุปกรณ์ที่รองรับ",
        tint: VIOLET,
        value: "1.0.0",
      },
    ],
  },
  {
    title: "",
    items: [
      {
        icon: LogOut,
        label: "ออกจากระบบ",
        detail: "ออกจากบัญชีนี้บนอุปกรณ์",
        tint: DANGER,
        danger: true,
      },
    ],
  },
];

/** "ฉัน" — the carer's own account and the app's settings. */
export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarInset();
  const nav = useNavigation<Nav>();

  return (
    <View style={{ flex: 1 }}>
      <LivingGradient height={insets.top + 240} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: SPACE.lg,
          paddingTop: insets.top + SPACE.sm,
          paddingBottom: tabBar + SPACE.xxxl,
          gap: SPACE.lg,
        }}
      >
        <Text
          style={{
            fontSize: 24,
            fontWeight: "700",
            color: TEXT_PRIMARY,
            marginBottom: SPACE.xs,
          }}
        >
          ฉัน
        </Text>

        <Card onPress={() => toast("บัญชีโปรไฟล์ยังไม่เปิดใช้งาน")}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: BLUE,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <User size={26} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, marginLeft: SPACE.md }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: TEXT_PRIMARY }}>
                คุณ สุขภาพดี จิตแจ่มใส
              </Text>
              <Text style={{ marginTop: 2, fontSize: 13, color: TEXT_MUTED }}>
                บัญชีโปรไฟล์
              </Text>
            </View>
            <Chevron />
          </View>
        </Card>

        {GROUPS.map((g, gi) => (
          <View key={g.title || `g${gi}`} style={{ gap: SPACE.md }}>
            {g.title !== "" && (
              <Text style={{ fontSize: 16, fontWeight: "500", color: TEXT_PRIMARY }}>
                {g.title}
              </Text>
            )}
            <Card padded={false}>
              {g.items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <PressableScale
                    key={item.label}
                    scaleTo={0.995}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    onPress={() =>
                      item.route
                        ? nav.navigate(item.route as never)
                        : toast("ยังไม่เปิดใช้งาน")
                    }
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      minHeight: 60,
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
                        backgroundColor: `${item.tint}1F`,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon size={19} color={item.tint} />
                    </View>
                    <View
                      style={{ flex: 1, marginLeft: SPACE.md, paddingVertical: SPACE.md }}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "500",
                          color: item.danger ? DANGER : TEXT_PRIMARY,
                        }}
                      >
                        {item.label}
                      </Text>
                      <Text style={{ marginTop: 2, fontSize: 12, color: TEXT_MUTED }}>
                        {item.detail}
                      </Text>
                    </View>
                    {item.value != null && (
                      <Text style={{ marginRight: SPACE.sm, fontSize: 14, color: TEXT_MUTED }}>
                        {item.value}
                      </Text>
                    )}
                    {!item.danger && <Chevron />}
                  </PressableScale>
                );
              })}
            </Card>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
