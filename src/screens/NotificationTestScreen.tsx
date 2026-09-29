import { useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ArrowDownCircle,
  Bell,
  Clock,
  Heart,
  Inbox,
  MessagesSquare,
  RefreshCw,
  Volume2,
} from "lucide-react-native";

import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { Card } from "../components/Card";
import { CardHeading } from "../components/CardAction";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { toast } from "../components/Toast";
import { returnTo } from "../navigation/returnTo";
import type { RootStackParamList } from "../navigation/RootStack";
import { useUnreadCount, type Notice, type NoticeKind } from "../models/notifications";
import { ensureNoticePermission, sendNotice } from "../utils/push";
import { feel } from "../utils/haptics";
import {
  PRIMARY_100,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme/tokens";
import { FORM_MAX, readable, GUTTER } from "../theme/layout";
import { tr } from "../i18n";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** One thing the test page can send, as it would arrive for real. */
type Sample = {
  kind: NoticeKind;
  Icon: typeof Bell;
  tint: string;
  title: string;
  body: string;
  target?: Notice["target"];
};

const BLUE = PRIMARY_500;
const AMBER = "#F59E0B";
const VIOLET = "#7C6BF5";

const SAMPLES: Sample[] = [
  {
    kind: "new_task",
    Icon: Inbox,
    tint: BLUE,
    title: tr("มีภารกิจใหม่ในพื้นที่ของคุณ", "A new task in your area"),
    body: tr(
      "นาย สมพงษ์ แสงทอง · ล้างไตทางช่องท้องที่บ้านและตรวจสอบภาวะติดเชื้อ",
      "นาย สมพงษ์ แสงทอง · Home peritoneal dialysis and infection check",
    ),
    target: { route: "TaskList" },
  },
  {
    kind: "reminder",
    Icon: Clock,
    tint: BLUE,
    title: tr("อีก 30 นาทีถึงเวลานัด", "Appointment in 30 minutes"),
    body: tr(
      "นาง จันทร์เพ็ญ บุญมี · ทบทวนรายการยา เวลา 08:30 น.",
      "นาง จันทร์เพ็ญ บุญมี · Medication review at 08:30",
    ),
  },
  {
    kind: "changed",
    Icon: RefreshCw,
    tint: BLUE,
    title: tr("นัดหมายถูกเลื่อน", "Appointment rescheduled"),
    body: tr(
      "นาง อรทัย เกียรติยศ · เลื่อนจากวันพุธเป็นวันศุกร์ เวลาเดิม",
      "นาง อรทัย เกียรติยศ · Moved from Wednesday to Friday, same time",
    ),
  },
  {
    kind: "vitals",
    Icon: Heart,
    tint: AMBER,
    title: tr("ค่าที่บันทึกอยู่นอกเกณฑ์", "A recorded value is out of range"),
    body: tr(
      "นาย มานพ แสงเดือน · น้ำตาลปลายนิ้ว 212 mg/dl สูงกว่าเกณฑ์มาก",
      "นาย มานพ แสงเดือน · Capillary blood glucose 212 mg/dL, well above target",
    ),
    target: { route: "FollowUp" },
  },
  {
    kind: "message",
    Icon: MessagesSquare,
    tint: AMBER,
    title: tr("ข้อความจากผู้ดูแล", "Message from a caregiver"),
    body: tr(
      "ญาติของ นาย ภูมิพัฒน์ พรหมมา แจ้งว่าแผลกดทับมีกลิ่นผิดปกติ",
      "A relative of นาย ภูมิพัฒน์ พรหมมา reports an unusual odor from a pressure ulcer",
    ),
  },
  {
    kind: "announcement",
    Icon: Volume2,
    tint: VIOLET,
    title: tr("ประกาศจากหน่วยงาน", "Announcement from your unit"),
    body: tr(
      "ขอความร่วมมือส่งรายงานผลการเยี่ยมบ้านประจำเดือนภายในวันที่ 5",
      "Please submit your monthly home visit report by the 5th",
    ),
  },
  {
    kind: "app_update",
    Icon: ArrowDownCircle,
    tint: VIOLET,
    title: tr("มีเวอร์ชันใหม่ให้ติดตั้ง", "A new version is ready to install"),
    body: tr(
      "เพิ่มหน้าสั่งยาและแผนที่บ้านที่ดูแล",
      "Adds medication ordering and a map of your households",
    ),
  },
];

/**
 * "ทดสอบการแจ้งเตือน" — fire one of each, and see where it lands.
 *
 * A build with no server behind it still has to be shown working: this
 * page posts the same notices the real thing would, through the same
 * store, so the bell, the list, the unread count and the tap-through are
 * all exercised by the app itself.
 *
 * The delay is what makes it a test of a PUSH rather than of a list: with
 * it on, the notice arrives after the page has been left, which is the
 * case the carer will actually meet.
 */
export function NotificationTestScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const unread = useUnreadCount();
  const [delayed, setDelayed] = useState(true);

  const send = (s: Sample) => {
    feel("tick");
    // Delayed goes through iOS, so the banner appears over whatever the
    // carer is doing — the whole point of a push. Immediate is written
    // straight into the list: a notification with no delay is delivered
    // before the banner can be drawn.
    void sendNotice({ kind: s.kind, title: s.title, body: s.body, target: s.target }, delayed ? 5 : 0)
      .then((how) => {
        if (how === "scheduled")
          toast(
            tr(
              "ส่งแล้ว จะเด้งใน 5 วินาที ลองออกจากแอปดู",
              "Sent. It will pop up in 5 seconds; try leaving the app",
            ),
            "success",
          );
        else if (how === "denied")
          toast(
            tr(
              "ยังไม่ได้อนุญาตแจ้งเตือน บันทึกไว้ในแอปแทน",
              "Notifications aren't allowed; saved in the app instead",
            ),
            "warning",
          );
        else toast(tr(`ส่ง "${s.title}" แล้ว`, `Sent "${s.title}"`), "success");
      })
      .catch(() =>
        toast(
          tr("ส่งการแจ้งเตือนไม่สำเร็จ", "Couldn't send the notification"),
          "error",
        ),
      );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={tr("ทดสอบการแจ้งเตือน", "Test notifications")} />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: GUTTER,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + 110,
            gap: SPACE.md,
            ...readable(FORM_MAX),
          }}
          showsVerticalScrollIndicator={false}
        >
          <Card style={{ gap: SPACE.md }}>
            <CardHeading
              icon={<Bell size={13} color={PRIMARY_500} strokeWidth={2.4} />}
              title={tr("สถานะตอนนี้", "Current status")}
            />
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
              <Text style={{ flex: 1, fontSize: 14, color: TEXT_SECONDARY }}>
                {tr("ยังไม่อ่าน", "Unread")}
              </Text>
              <Text style={{ fontSize: 20, fontWeight: "800", color: PRIMARY_500 }}>{unread}</Text>
            </View>
            <View style={{ height: 1, backgroundColor: SEPARATOR }} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: TEXT_PRIMARY }}>
                  {tr("หน่วงเวลา 5 วินาที", "5-second delay")}
                </Text>
                <Text style={{ fontSize: 12, lineHeight: 17, color: TEXT_MUTED }}>
                  {tr(
                    "ส่งหลังออกจากหน้านี้ เพื่อดูว่าเด้งขึ้นระหว่างใช้งานหน้าอื่น",
                    "Sends after you leave this page, to see it pop up over other screens",
                  )}
                </Text>
              </View>
              <Switch value={delayed} onValueChange={setDelayed} trackColor={{ true: PRIMARY_500 }} />
            </View>
          </Card>

          <Card
            onPress={() =>
              void ensureNoticePermission().then((granted) => {
                if (granted)
                  toast(tr("อนุญาตการแจ้งเตือนแล้ว", "Notifications allowed"), "success");
                else
                  toast(
                    tr(
                      "ยังไม่ได้อนุญาต เปิดได้ในการตั้งค่าเครื่อง",
                      "Not allowed yet. Turn it on in your device settings",
                    ),
                    "error",
                  );
              })
            }
            accessibilityLabel={tr(
              "ขออนุญาตแจ้งเตือน",
              "Request notification permission",
            )}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: TEXT_PRIMARY }}>
                  {tr("ขออนุญาตแจ้งเตือน", "Request notification permission")}
                </Text>
                <Text style={{ fontSize: 12, lineHeight: 17, color: TEXT_MUTED }}>
                  {tr(
                    "ต้องอนุญาตก่อน ระบบจึงจะเด้งแจ้งเตือนขึ้นบนหน้าจอได้",
                    "Notifications can only appear on screen once they're allowed",
                  )}
                </Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: "700", color: PRIMARY_500 }}>
                {tr("ขออนุญาต", "Allow")}
              </Text>
            </View>
          </Card>

          <Text style={{ fontSize: 13, color: TEXT_MUTED, paddingHorizontal: SPACE.xs }}>
            {tr(
              "แตะเพื่อส่งการแจ้งเตือนหนึ่งรายการ",
              "Tap to send one notification",
            )}
          </Text>

          {SAMPLES.map((s) => (
            <Card key={s.kind} onPress={() => send(s)} accessibilityLabel={s.title}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: SPACE.md }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: `${s.tint}1A`,
                  }}
                >
                  <s.Icon size={18} color={s.tint} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontSize: 15, lineHeight: 21, fontWeight: "600", color: TEXT_PRIMARY }}>
                    {s.title}
                  </Text>
                  <Text numberOfLines={2} style={{ fontSize: 13, lineHeight: 19, color: TEXT_SECONDARY }}>
                    {s.body}
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: SPACE.md,
                    paddingVertical: 5,
                    borderRadius: RADIUS.capsule,
                    backgroundColor: PRIMARY_100,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: PRIMARY_500 }}>
                    {tr("ส่ง", "Send")}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </ScrollView>
      </HeaderFade>

      <ActionBar>
        <PrimaryAction
          label={tr("เปิดหน้าการแจ้งเตือน", "Open notifications")}
          onPress={() => returnTo(nav, "Notifications")}
        />
      </ActionBar>
    </View>
  );
}
