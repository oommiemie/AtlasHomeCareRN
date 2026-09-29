import { Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Bell,
  FileText,
  Globe,
  HelpCircle,
  Hospital,
  Info,
  LogOut,
  MessageSquareWarning,
  MonitorCog,
  KeyRound,
  ShieldCheck,
  ShieldQuestion,
} from "lucide-react-native";

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
import { authenRightById } from "../models/authenCode";
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
import { isEn, tr } from "../i18n";
import { GUTTER } from "../theme/layout";

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

/**
 * The settings list, built rather than declared.
 *
 * It was a module-level constant until one of its rows had to carry a
 * figure that comes from the session — which Authen Code is in force. A
 * constant is evaluated once, before anybody has signed in, so the row
 * would have shown whatever was true at the moment the file loaded and
 * never changed again.
 */
const groupsFor = (authen: string): { title: string; items: Item[] }[] => [
  {
    title: tr("ตั้งค่าทั่วไป", "General settings"),
    items: [
      {
        icon: Bell,
        label: tr("การแจ้งเตือน", "Notifications"),
        detail: tr(
          "จัดการการแจ้งเตือนที่ต้องการรับ",
          "Choose which notifications you get",
        ),
        tint: BLUE,
        route: "NotificationSettings",
      },
      {
        icon: MonitorCog,
        label: tr("การแสดงผล", "Display"),
        detail: tr(
          "ขนาดตัวอักษร แถบเมนู และการเคลื่อนไหว",
          "Text size, tab bar and motion",
        ),
        tint: BLUE,
        route: "DisplaySettings",
      },
      {
        icon: Globe,
        // Named in both languages whichever is in force, so somebody who
        // cannot read the one on screen can still find the way out of it.
        label: "ภาษา / Language",
        detail: tr("ภาษาที่ใช้แสดงผลในแอพ", "The language the app is shown in"),
        tint: BLUE,
        value: isEn ? "English" : "ไทย",
        route: "LanguageSettings",
      },
      {
        icon: ShieldCheck,
        label: tr("ความปลอดภัย", "Security"),
        detail: tr("ตั้งรหัส PIN และการสแกนใบหน้าหรือลายนิ้วมือ", "PIN and biometric unlock"),
        tint: BLUE,
        route: "SecuritySettings",
      },
      {
        icon: KeyRound,
        label: tr("สิทธิใน Authen Code", "Authen Code right"),
        detail: tr(
          "หน่วยบริการที่ใช้ยืนยันสิทธิการรับบริการ",
          "The service unit services are authenticated under",
        ),
        tint: BLUE,
        value: authen,
        route: "AuthenCode",
      },
    ],
  },
  {
    title: tr("ศูนย์ช่วยเหลือและสนับสนุน", "Help and support"),
    items: [
      {
        icon: HelpCircle,
        label: tr("ศูนย์ช่วยเหลือ", "Help center"),
        detail: tr(
          "คำถามที่พบบ่อยเกี่ยวกับการใช้งาน",
          "Frequently asked questions",
        ),
        tint: AMBER,
        route: "HelpCenter",
      },
      {
        icon: MessageSquareWarning,
        label: tr("รายงานปัญหา", "Report a problem"),
        detail: tr("แจ้งปัญหาการใช้งานให้ทีมงาน", "Tell the team about a problem"),
        tint: AMBER,
        route: "ReportProblem",
      },
    ],
  },
  {
    title: tr("ข้อมูลแอพ", "App info"),
    items: [
      {
        icon: ShieldQuestion,
        label: tr("นโยบายความเป็นส่วนตัว", "Privacy policy"),
        detail: tr(
          "การเก็บและใช้ข้อมูลส่วนบุคคล",
          "How personal data is kept and used",
        ),
        tint: VIOLET,
        route: "Privacy",
      },
      {
        icon: Info,
        label: tr("เกี่ยวกับแอพพลิเคชั่น", "About the app"),
        detail: tr(
          "เวอร์ชัน ผู้พัฒนา และที่มาของแอพ",
          "Version, developer and background",
        ),
        tint: VIOLET,
        route: "About",
      },
      {
        icon: FileText,
        label: tr("ข้อกำหนดการใช้งาน", "Terms of use"),
        detail: tr(
          "ข้อตกลงในการใช้แอพและบริการ",
          "The terms for using the app and service",
        ),
        tint: VIOLET,
        route: "Terms",
      },
    ],
  },
  {
    title: "",
    items: [
      {
        icon: LogOut,
        label: tr("ออกจากระบบ", "Sign out"),
        detail: tr("ออกจากบัญชีนี้บนอุปกรณ์", "Sign out of this account on this device"),
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
  const role = staffNamed(me.displayName)?.role ?? tr("เจ้าหน้าที่", "Staff");
  const groups = groupsFor(authenRightById(me.authenCode).code);
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarInset();
  const nav = useNavigation<Nav>();

  return (
    <View style={{ flex: 1 }}>
      <LivingGradient height={insets.top + 240} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: GUTTER,
          paddingTop: insets.top + SPACE.sm,
          paddingBottom: tabBar + SPACE.xxxl,
          gap: SPACE.lg,
          // Edge to edge at the page's own margin, as the Services tab is:
          // the four tabs sit side by side, and one of them drawn narrower
          // than the rest read as a different kind of page.
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
          {tr("ฉัน", "Me")}
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
              accessibilityLabel={tr("บัญชีโปรไฟล์", "Profile")}
              onPress={() => nav.navigate("ProfileSettings")}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <UserPhoto size={68} />

                <View style={{ flex: 1, marginLeft: SPACE.md, gap: SPACE.xs }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 20,
                      fontWeight: "800",
                      color: "#FFFFFF",
                    }}
                  >
                    {tr(`คุณ ${me.displayName}`, me.displayName)}
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
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: "#FFFFFF",
                      }}
                    >
                      {role}
                    </Text>
                  </View>
                </View>

                <Chevron ink="rgba(255,255,255,0.85)" />
              </View>
            </Pressable>

            {/*
              Shown, not offered.

              The chevron used to lead to the picker, which made this look
              like a setting. It is not one: which สถานพยาบาล a carer is
              signed in under is fixed for the whole of a session, because
              every visit, order and note written during it is filed under
              that one — a card that could swap it mid-shift would be a
              card that moves work already done to a place it never
              happened. Changing it means signing out and in again, which
              starts a session where the new choice is true from the first
              record. The line at the foot of โปรไฟล์ says so.
            */}
            {/*
              Real glass over the ramp, not a wash of white on top of it.

              The thin material and the faintest white, so the blue of the
              card goes on showing through: a pane laid on the gradient
              rather than a second card stacked on it. The tint is named
              rather than left to the material because both grounds get it
              wrong on their own — the light one is milky and takes the
              contrast out from under white words, the dark one is a slab
              of charcoal that reads as a hole cut in the blue.

              An eighth of white and no more, because the wash is paid for
              in contrast: every line on this pane is white, and each point
              of white laid under them is a point taken off the difference.
              At a sixth the two small lines fell to 3.4:1 against the blue.
              At an eighth, with the lines at full white rather than four
              fifths of it, they measure about 4.5 — which is the floor,
              and the reason the greyed-down secondary ink is gone from
              here. On this pane the hierarchy is carried by size and
              weight instead.

              No border and no shadow of our own either — the material
              draws its own rim, and anything laid over it reads as a
              smudge rather than as an edge.
            */}
            <Glass
              effect="clear"
              colorScheme="light"
              tintColor="rgba(255,255,255,0.12)"
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
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: "#FFFFFF",
                  }}
                >
                  {tr("สถานพยาบาลที่เข้าใช้งาน", "Signed in under")}
                </Text>
                <Text
                  numberOfLines={2}
                  style={{
                    fontSize: 14,
                    lineHeight: 19,
                    fontWeight: "700",
                    color: "#FFFFFF",
                  }}
                >
                  {me.facility?.name ??
                    tr("ยังไม่ได้เลือกสถานพยาบาล", "No facility chosen")}
                </Text>
                {me.facility != null && (
                  <Text style={{ fontSize: 12, color: "#FFFFFF" }}>
                    {tr(
                      `${me.facility.district} · รหัส ${me.facility.code}`,
                      `${me.facility.district} · Code ${me.facility.code}`,
                    )}
                  </Text>
                )}
              </View>
            </Glass>
          </LinearGradient>
        </Card>

        {groups.map((g, gi) => (
          <View key={g.title || `g${gi}`} style={{ gap: SPACE.md }}>
            {g.title !== "" && (
              <Text
                style={{ fontSize: 16, fontWeight: "500", color: TEXT_PRIMARY }}
              >
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
                        toast(tr("ออกจากระบบแล้ว", "Signed out"));
                        nav.reset({ index: 0, routes: [{ name: "Login" }] });
                        return;
                      }
                      if (item.route) nav.navigate(item.route as never);
                      else toast(tr("ยังไม่เปิดใช้งาน", "Not available yet"));
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
                      style={{
                        flex: 1,
                        marginLeft: SPACE.md,
                        paddingVertical: SPACE.md,
                      }}
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
                      <Text
                        style={{
                          marginTop: 2,
                          fontSize: 12,
                          color: TEXT_MUTED,
                        }}
                      >
                        {item.detail}
                      </Text>
                    </View>
                    {item.value != null && (
                      <Text
                        style={{
                          marginRight: SPACE.sm,
                          fontSize: 14,
                          color: TEXT_MUTED,
                        }}
                      >
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
