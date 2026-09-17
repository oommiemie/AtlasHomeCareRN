import { Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Bell, FileText, Globe, HelpCircle, Hospital, Info, LogOut, MessageSquareWarning, Monitor, MonitorCog, ShieldCheck, ShieldQuestion } from "lucide-react-native";

import { Chevron } from "../components/Chevron";
import { Glass } from "../components/Glass";
import { UserPhoto } from "../components/UserPhoto";
import { useTabBarInset } from "../utils/useTabBarInset";
import { Card } from "../components/Card";
import { LivingGradient } from "../components/LivingGradient";
import { PressableScale } from "../components/PressableScale";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import { signOut, useSession } from "../models/session";
import { staffNamed } from "../models/staff";
import {
  DANGER,
  PRIMARY_100,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  SURFACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const BLUE = PRIMARY_500;
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
        icon: MonitorCog,
        label: "การแสดงผล",
        detail: "ขนาดตัวอักษร แถบเมนู และการเคลื่อนไหว",
        tint: BLUE,
        route: "DisplaySettings",
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
        route: "SecuritySettings",
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
  const me = useSession();
  // What this account does, from the same directory a visit's staff are
  // picked out of — an account page that named nobody's job was the one
  // place in the app a carer could not check their own.
  const role = staffNamed(me.displayName)?.role ?? "เจ้าหน้าที่";
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

        {/*
          Who is signed in, what they are, and what they are signed in UNDER.

          A Provider ID can be attached to more than one สถานพยาบาล, and
          every visit, order and note this carer writes is filed under
          whichever was chosen at sign-in. The account page said only who
          they were; the half that decides where the work goes was on a
          screen they had passed through once and could not get back to.

          The card carries the page rather than sitting at the head of a
          run of settings rows: the blue is the app's own, and against the
          white cards below it this is the one thing on the screen that is
          about the person holding the phone. Their photograph is the same
          one the home screen greets them with.
        */}
        <Card padded={false} elevated>
          <LinearGradient
            colors={["#0A8AE4", "#044271"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: SPACE.lg, gap: SPACE.md }}
          >
            {/* A plain Pressable, not a PressableScale: this one wraps the
                portrait's ring, and a transform above it would leave the
                ring and the photograph out of register for the animation. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="บัญชีโปรไฟล์"
              onPress={() => nav.navigate("ProfileSettings")}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <UserPhoto size={68} />

                <View style={{ flex: 1, marginLeft: SPACE.md, gap: SPACE.xs }}>
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 20, fontWeight: "800", color: "#FFFFFF" }}
                  >
                    {`คุณ ${me.displayName}`}
                  </Text>
                  {/* The job as a chip, not another grey line: it is what
                      this account is allowed to do, which on a card about
                      the person is worth more than a subtitle. */}
                  <View
                    style={{
                      alignSelf: "flex-start",
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                      borderRadius: RADIUS.capsule,
                      backgroundColor: "rgba(255,255,255,0.22)",
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#FFFFFF" }}>
                      {role}
                    </Text>
                  </View>
                </View>

                <Chevron ink="rgba(255,255,255,0.85)" />
              </View>
            </Pressable>

            {/* Plain again, and for the usual reason: PressableScale
                animates a transform, and a transformed ancestor stops the
                glass below from drawing its material at all. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="สถานพยาบาลที่เข้าใช้งาน"
              onPress={() => nav.navigate("Facility", { from: "settings" })}
            >
              {/*
                Real glass over the ramp, not a wash of white on top of it.

                Dark, because everything written on it is white — the milky
                light material would have taken the contrast out from under
                the words. No border and no shadow either: the material
                draws its own rim, and anything laid over it reads as a
                smudge rather than as an edge.
              */}
              <Glass
                colorScheme="dark"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACE.md,
                  padding: SPACE.md,
                  borderRadius: RADIUS.lg,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(255,255,255,0.22)",
                  }}
                >
                  <Hospital size={18} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.8)" }}>
                    สถานพยาบาลที่เข้าใช้งาน
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={{ fontSize: 14, lineHeight: 19, fontWeight: "700", color: "#FFFFFF" }}
                  >
                    {me.facility?.name ?? "ยังไม่ได้เลือกสถานพยาบาล"}
                  </Text>
                  {me.facility != null && (
                    <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
                      {`${me.facility.district} · รหัส ${me.facility.code}`}
                    </Text>
                  )}
                </View>
                <Chevron ink="rgba(255,255,255,0.85)" />
              </Glass>
            </Pressable>
          </LinearGradient>
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
                    onPress={() => {
                      // The one red row: end the session and start the app
                      // over at sign-in, with nothing to go back to.
                      if (item.danger) {
                        signOut();
                        nav.reset({ index: 0, routes: [{ name: "Login" }] });
                        return;
                      }
                      if (item.route) nav.navigate(item.route as never);
                      else toast("ยังไม่เปิดใช้งาน");
                    }}
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
                          fontSize: 16,
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
