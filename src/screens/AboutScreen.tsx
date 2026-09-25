import { Image, Platform, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChevronRight, FileText, ShieldQuestion } from "lucide-react-native";

import { Card } from "../components/Card";
import { PressableScale } from "../components/PressableScale";
import { SettingsGroup, SettingsScreen } from "../components/SettingsScreen";
import { APP } from "../models/appInfo";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme/tokens";

const VIOLET = "#7C6BF5";

/**
 * "เกี่ยวกับแอพพลิเคชั่น" — what this is, and exactly which build of it.
 *
 * The version was a string typed into a settings row, which is the version
 * of nothing: it says 1.0.0 because somebody wrote 1.0.0, and it would go
 * on saying it through every release after. Every figure on this page is
 * read from the files that set it, so the page cannot be out of date
 * without the app being out of date with itself.
 *
 * The build details sit under a rule rather than in the paragraph, because
 * they are not for the carer. They are for whoever reads the fault report
 * the carer sends from the page next door: the first question about any
 * bug is what it was running on, and this is the screen a carer can be
 * asked to read down the phone.
 */
export function AboutScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const build: [string, string][] = [
    ["เวอร์ชันแอป", APP.version],
    ["รหัสแอป", APP.bundleId],
    [
      "ระบบปฏิบัติการ",
      `${Platform.OS === "ios" ? "iOS" : "Android"} ${String(Platform.Version)}`,
    ],
    ["Expo SDK", APP.expo],
    ["React Native", APP.reactNative],
  ];

  return (
    <SettingsScreen
      title="เกี่ยวกับแอพพลิเคชั่น"
      footnote="พัฒนาโดย HealthFlow Technology · ติดต่อ app.healthflow@gmail.com"
    >
      <Card>
        <View style={{ alignItems: "center", gap: SPACE.sm }}>
          <Image
            source={require("../../assets/icon.png")}
            style={{ width: 76, height: 76, borderRadius: RADIUS.lg }}
          />
          <Text
            style={{
              fontSize: 20,
              lineHeight: 31,
              fontWeight: "700",
              color: TEXT_PRIMARY,
            }}
          >
            {APP.name}
          </Text>
          {/*
            The version, where somebody asked for it will look — beside the
            name, not buried in the table underneath. It is the one figure
            on this page anybody comes here for.
          */}
          <Text
            style={{
              fontSize: 15,
              lineHeight: 24,
              fontWeight: "600",
              color: PRIMARY_500,
              fontVariant: ["tabular-nums"],
            }}
          >
            {`เวอร์ชัน ${APP.version}`}
          </Text>
          <Text
            style={{
              marginTop: SPACE.xs,
              fontSize: 15,
              lineHeight: 24,
              color: TEXT_SECONDARY,
              textAlign: "center",
            }}
          >
            เครื่องมือสำหรับเจ้าหน้าที่สาธารณสุขและ อสม. ใช้บันทึกการเยี่ยมบ้าน
            งานวัคซีน ตรวจสุขภาพนักเรียน และคัดกรองพัฒนาการเด็กในชุมชน
          </Text>
        </View>
      </Card>

      <SettingsGroup title="ข้อมูลเวอร์ชัน">
        <Card padded={false}>
          {build.map(([label, value], i) => (
            <View
              key={label}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.md,
                paddingHorizontal: SPACE.lg,
                paddingVertical: SPACE.md,
                borderTopWidth: i > 0 ? 1 : 0,
                borderTopColor: SEPARATOR,
              }}
            >
              <Text
                style={{
                  flex: 1,
                  fontSize: 15,
                  lineHeight: 24,
                  color: TEXT_MUTED,
                }}
              >
                {label}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  flexShrink: 1,
                  fontSize: 15,
                  lineHeight: 24,
                  fontWeight: "600",
                  color: TEXT_PRIMARY,
                }}
              >
                {value}
              </Text>
            </View>
          ))}
        </Card>
      </SettingsGroup>

      <SettingsGroup title="เอกสาร">
        <Card padded={false}>
          {(
            [
              { label: "ข้อกำหนดการใช้งาน", Icon: FileText, route: "Terms" },
              {
                label: "นโยบายความเป็นส่วนตัว",
                Icon: ShieldQuestion,
                route: "Privacy",
              },
            ] as const
          ).map((r, i) => (
            <PressableScale
              key={r.route}
              scaleTo={0.995}
              onPress={() => nav.navigate(r.route)}
              accessibilityRole="button"
              accessibilityLabel={r.label}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.md,
                paddingHorizontal: SPACE.lg,
                paddingVertical: SPACE.lg,
                borderTopWidth: i > 0 ? 1 : 0,
                borderTopColor: SEPARATOR,
              }}
            >
              <r.Icon size={18} color={VIOLET} />
              <Text
                style={{
                  flex: 1,
                  fontSize: 16,
                  lineHeight: 25,
                  fontWeight: "500",
                  color: TEXT_PRIMARY,
                }}
              >
                {r.label}
              </Text>
              <ChevronRight size={18} color={TEXT_MUTED} />
            </PressableScale>
          ))}
        </Card>
      </SettingsGroup>
    </SettingsScreen>
  );
}
