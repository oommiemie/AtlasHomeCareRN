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
    title: "มีภารกิจใหม่ในพื้นที่ของคุณ",
    body: "นาย สมพงษ์ แสงทอง · ล้างไตทางช่องท้องที่บ้านและตรวจสอบภาวะติดเชื้อ",
    target: { route: "TaskList" },
  },
  {
    kind: "reminder",
    Icon: Clock,
    tint: BLUE,
    title: "อีก 30 นาทีถึงเวลานัด",
    body: "นาง จันทร์เพ็ญ บุญมี · ทบทวนรายการยา เวลา 08:30 น.",
  },
  {
    kind: "changed",
    Icon: RefreshCw,
    tint: BLUE,
    title: "นัดหมายถูกเลื่อน",
    body: "นาง อรทัย เกียรติยศ · เลื่อนจากวันพุธเป็นวันศุกร์ เวลาเดิม",
  },
  {
    kind: "vitals",
    Icon: Heart,
    tint: AMBER,
    title: "ค่าที่บันทึกอยู่นอกเกณฑ์",
    body: "นาย มานพ แสงเดือน · น้ำตาลปลายนิ้ว 212 mg/dl สูงกว่าเกณฑ์มาก",
    target: { route: "FollowUp" },
  },
  {
    kind: "message",
    Icon: MessagesSquare,
    tint: AMBER,
    title: "ข้อความจากผู้ดูแล",
    body: "ญาติของ นาย ภูมิพัฒน์ พรหมมา แจ้งว่าแผลกดทับมีกลิ่นผิดปกติ",
  },
  {
    kind: "announcement",
    Icon: Volume2,
    tint: VIOLET,
    title: "ประกาศจากหน่วยงาน",
    body: "ขอความร่วมมือส่งรายงานผลการเยี่ยมบ้านประจำเดือนภายในวันที่ 5",
  },
  {
    kind: "app_update",
    Icon: ArrowDownCircle,
    tint: VIOLET,
    title: "มีเวอร์ชันใหม่ให้ติดตั้ง",
    body: "เพิ่มหน้าสั่งยาและแผนที่บ้านที่ดูแล",
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
    void sendNotice({ kind: s.kind, title: s.title, body: s.body, target: s.target }, delayed ? 5 : 0).then(
      (how) => {
        if (how === "scheduled") toast("ส่งแล้ว จะเด้งใน 5 วินาที ลองออกจากแอปดู");
        else if (how === "denied") toast("ยังไม่ได้อนุญาตแจ้งเตือน บันทึกไว้ในแอปแทน");
        else toast(`ส่ง "${s.title}" แล้ว`, "success");
      },
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="ทดสอบการแจ้งเตือน" />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: SPACE.lg,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + 110,
            gap: SPACE.md,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Card style={{ gap: SPACE.md }}>
            <CardHeading
              icon={<Bell size={13} color={PRIMARY_500} strokeWidth={2.4} />}
              title="สถานะตอนนี้"
            />
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
              <Text style={{ flex: 1, fontSize: 14, color: TEXT_SECONDARY }}>ยังไม่อ่าน</Text>
              <Text style={{ fontSize: 20, fontWeight: "800", color: PRIMARY_500 }}>{unread}</Text>
            </View>
            <View style={{ height: 1, backgroundColor: SEPARATOR }} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: TEXT_PRIMARY }}>
                  หน่วงเวลา 5 วินาที
                </Text>
                <Text style={{ fontSize: 12, lineHeight: 17, color: TEXT_MUTED }}>
                  ส่งหลังออกจากหน้านี้ เพื่อดูว่าเด้งขึ้นระหว่างใช้งานหน้าอื่น
                </Text>
              </View>
              <Switch value={delayed} onValueChange={setDelayed} trackColor={{ true: PRIMARY_500 }} />
            </View>
          </Card>

          <Card onPress={() => void ensureNoticePermission()} accessibilityLabel="ขออนุญาตแจ้งเตือน">
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: TEXT_PRIMARY }}>
                  ขออนุญาตแจ้งเตือน
                </Text>
                <Text style={{ fontSize: 12, lineHeight: 17, color: TEXT_MUTED }}>
                  ต้องอนุญาตก่อน ระบบจึงจะเด้งแจ้งเตือนขึ้นบนหน้าจอได้
                </Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: "700", color: PRIMARY_500 }}>ขออนุญาต</Text>
            </View>
          </Card>

          <Text style={{ fontSize: 13, color: TEXT_MUTED, paddingHorizontal: SPACE.xs }}>
            แตะเพื่อส่งการแจ้งเตือนหนึ่งรายการ
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
                  <Text style={{ fontSize: 12, fontWeight: "700", color: PRIMARY_500 }}>ส่ง</Text>
                </View>
              </View>
            </Card>
          ))}
        </ScrollView>
      </HeaderFade>

      <ActionBar>
        <PrimaryAction label="เปิดหน้าการแจ้งเตือน" onPress={() => nav.navigate("Notifications")} />
      </ActionBar>
    </View>
  );
}
