import { useState } from "react";
import { LayoutAnimation, Platform, Text, UIManager, View } from "react-native";
import { ChevronDown, Map, ShieldCheck, Inbox } from "lucide-react-native";

import { Card } from "../components/Card";
import { PressableScale } from "../components/PressableScale";
import { SettingsScreen } from "../components/SettingsScreen";
import { SEPARATOR, SPACE, TEXT_MUTED, TEXT_PRIMARY } from "../theme/tokens";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const BLUE = "#0088FF";
const AMBER = "#F59E0B";
const VIOLET = "#7C6BF5";

const TOPICS = [
  {
    title: "การรับงาน",
    tint: BLUE,
    icon: Inbox,
    faqs: [
      {
        q: "รับภารกิจใหม่ได้อย่างไร",
        a: 'ไปที่หน้าแรก แตะการ์ดภารกิจใหม่รอรับงาน อ่านรายละเอียดผู้ป่วยแล้วกดปุ่ม "รับงาน" ภารกิจจะย้ายไปอยู่ในแผนเยี่ยมของคุณทันที',
      },
      {
        q: "ปฏิเสธงานแล้วจะเกิดอะไรขึ้น",
        a: "ระบบจะถามเหตุผลการปฏิเสธ แล้วส่งงานกลับไปให้ผู้ประสานงาน จัดสรรให้พยาบาลท่านอื่น งานจะไม่หายไปจากระบบ",
      },
    ],
  },
  {
    title: "การเยี่ยมบ้าน",
    tint: AMBER,
    icon: Map,
    faqs: [
      {
        q: "ดูเส้นทางไปบ้านผู้ป่วยอย่างไร",
        a: 'แตะที่อยู่ในหน้ารายละเอียดภารกิจ ระบบจะเปิดแผนที่ พร้อมวาดเส้นทางจากตำแหน่งของคุณ หรือกด "เปิดแผนที่นำทาง" เพื่อใช้ Google Maps หรือ Apple Maps',
      },
      {
        q: "ถ้าไม่มีสัญญาณอินเทอร์เน็ตระหว่างเยี่ยมบ้าน",
        a: "ข้อมูลภารกิจที่โหลดไว้แล้วยังดูได้ แต่แผนที่และการบันทึกผลจะต้องใช้สัญญาณ แนะนำให้เปิดดูรายละเอียดผู้ป่วยก่อนออกเดินทาง",
      },
    ],
  },
  {
    title: "บัญชีและความปลอดภัย",
    tint: VIOLET,
    icon: ShieldCheck,
    faqs: [
      {
        q: "ลืมรหัส PIN ต้องทำอย่างไร",
        a: "ออกจากระบบแล้วเข้าใหม่ด้วยบัญชีของหน่วยงาน จากนั้นตั้งรหัส PIN ใหม่ได้ที่ ฉัน > ความปลอดภัย",
      },
      {
        q: "ข้อมูลผู้ป่วยปลอดภัยแค่ไหน",
        a: "ข้อมูลถูกเข้ารหัสระหว่างรับส่ง และเข้าถึงได้เฉพาะพยาบาล ที่ได้รับมอบหมายงานนั้น อ่านเพิ่มเติมได้ที่นโยบายความเป็นส่วนตัว",
      },
    ],
  },
];

/** "ศูนย์ช่วยเหลือ" — the questions carers actually ask, grouped. */
export function HelpCenterScreen() {
  const [open, setOpen] = useState<string | null>(null);

  const toggle = (q: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((was) => (was === q ? null : q));
  };

  return (
    <SettingsScreen title="ศูนย์ช่วยเหลือ">
      {TOPICS.map((t) => {
        const Icon = t.icon;
        return (
          <View key={t.title} style={{ gap: SPACE.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: `${t.tint}1F`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={15} color={t.tint} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: "500", color: TEXT_PRIMARY }}>
                {t.title}
              </Text>
            </View>

            <Card padded={false}>
              {t.faqs.map((f, i) => {
                const isOpen = open === f.q;
                return (
                  <PressableScale
                    key={f.q}
                    scaleTo={0.995}
                    onPress={() => toggle(f.q)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isOpen }}
                    accessibilityLabel={f.q}
                    style={{
                      paddingHorizontal: SPACE.lg,
                      paddingVertical: SPACE.lg,
                      borderTopWidth: i > 0 ? 1 : 0,
                      borderTopColor: SEPARATOR,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 15,
                          fontWeight: "500",
                          color: TEXT_PRIMARY,
                        }}
                      >
                        {f.q}
                      </Text>
                      <View
                        style={{
                          transform: [{ rotate: isOpen ? "180deg" : "0deg" }],
                        }}
                      >
                        <ChevronDown size={18} color={TEXT_MUTED} />
                      </View>
                    </View>
                    {isOpen && (
                      <Text
                        style={{
                          marginTop: SPACE.md,
                          fontSize: 14,
                          lineHeight: 22,
                          color: TEXT_MUTED,
                        }}
                      >
                        {f.a}
                      </Text>
                    )}
                  </PressableScale>
                );
              })}
            </Card>
          </View>
        );
      })}
    </SettingsScreen>
  );
}
