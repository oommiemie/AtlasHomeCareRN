import { useEffect, useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ArrowDownCircle,
  CheckCheck,
  FlaskConical,
  Clock,
  Heart,
  Inbox,
  MessagesSquare,
  RefreshCw,
  Volume2,
} from "lucide-react-native";

import { Card } from "../components/Card";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { ToolbarPill } from "../components/ToolbarPill";
import { toast } from "../components/Toast";
import { StatusTag } from "../components/StatusTag";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  KIND_LABEL,
  dayOf,
  markAllRead,
  markRead,
  useNotices,
  type Notice,
  type NoticeKind,
} from "../models/notifications";
import { feel } from "../utils/haptics";
import { clearBadge } from "../utils/push";
import { thaiDateTime, thaiTime } from "../utils/thaiDate";
import {
  PRIMARY_500,
  RADIUS,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const BLUE = PRIMARY_500;
const AMBER = "#F59E0B";
const VIOLET = "#7C6BF5";

/** The mark and colour each kind wears, the settings screen's own. */
const LOOK: Record<NoticeKind, { tint: string; Icon: typeof Inbox }> = {
  new_task: { tint: BLUE, Icon: Inbox },
  reminder: { tint: BLUE, Icon: Clock },
  changed: { tint: BLUE, Icon: RefreshCw },
  vitals: { tint: AMBER, Icon: Heart },
  message: { tint: AMBER, Icon: MessagesSquare },
  announcement: { tint: VIOLET, Icon: Volume2 },
  app_update: { tint: VIOLET, Icon: ArrowDownCircle },
};

const SECTION: Record<"today" | "yesterday" | "earlier", string> = {
  today: "วันนี้",
  yesterday: "เมื่อวาน",
  earlier: "ก่อนหน้านี้",
};

/**
 * "การแจ้งเตือน" — what the app has told this carer, newest first.
 *
 * Grouped by day rather than listed flat: a notice is read against when it
 * arrived, and "วันนี้" is the only group most mornings need. Unread ones
 * carry a dot and a heavier line; opening one marks it read, and the bell
 * on the home page counts what is left.
 */
export function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const notices = useNotices();
  // The red number on the app icon is about unread notices; opening the
  // page is what makes it untrue.
  useEffect(() => {
    void clearBadge();
  }, []);
  const unread = notices.filter((n) => !n.read).length;

  const groups = useMemo(() => {
    const out: { key: "today" | "yesterday" | "earlier"; rows: Notice[] }[] =
      [];
    for (const n of notices) {
      const key = dayOf(n.at);
      let group = out.find((g) => g.key === key);
      if (group == null) {
        group = { key, rows: [] };
        out.push(group);
      }
      group.rows.push(n);
    }
    return out;
  }, [notices]);

  const open = (n: Notice) => {
    feel("tick");
    markRead(n.id);
    if (n.target != null) nav.navigate(n.target.route as never);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title="การแจ้งเตือน"
        right={
          <ToolbarPill
            slots={[
              {
                icon: (
                  <CheckCheck
                    size={20}
                    color={unread > 0 ? PRIMARY_500 : TEXT_MUTED}
                    strokeWidth={2.2}
                  />
                ),
                label: "อ่านทั้งหมด",
                onPress: () => {
                  if (unread === 0) return;
                  feel("tick");
                  markAllRead();
                  toast("ทำเครื่องหมายว่าอ่านแล้ว", "success");
                },
              },
              {
                icon: (
                  <FlaskConical
                    size={20}
                    color={TEXT_PRIMARY}
                    strokeWidth={2.2}
                  />
                ),
                label: "ทดสอบการแจ้งเตือน",
                onPress: () => nav.navigate("NotificationTest"),
              },
            ]}
          />
        }
      />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: SPACE.lg,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + SPACE.xxl,
            gap: SPACE.md,
          }}
          showsVerticalScrollIndicator={false}
        >
          {notices.length === 0 ? (
            <Card>
              <Text style={{ fontSize: 14, lineHeight: 22, color: TEXT_MUTED }}>
                ยังไม่มีการแจ้งเตือน
              </Text>
            </Card>
          ) : (
            groups.map((g) => (
              <View key={g.key} style={{ gap: SPACE.sm }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    gap: SPACE.sm,
                    paddingHorizontal: SPACE.xs,
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 15,
                      fontWeight: "700",
                      color: TEXT_PRIMARY,
                    }}
                  >
                    {SECTION[g.key]}
                  </Text>
                  {g.rows.some((n) => !n.read) && (
                    <Text style={{ fontSize: 12, color: PRIMARY_500 }}>
                      {`ยังไม่อ่าน ${g.rows.filter((n) => !n.read).length}`}
                    </Text>
                  )}
                </View>
                {g.rows.map((n) => (
                  <NoticeCard key={n.id} notice={n} onPress={() => open(n)} />
                ))}
              </View>
            ))
          )}
        </ScrollView>
      </HeaderFade>
    </View>
  );
}

/** One notice: its mark, what it says, and when it arrived. */
function NoticeCard({
  notice: n,
  onPress,
}: {
  notice: Notice;
  onPress: () => void;
}) {
  const look = LOOK[n.kind];
  const today = dayOf(n.at) === "today";
  return (
    <Card onPress={onPress} accessibilityLabel={n.title}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: SPACE.md,
        }}
      >
        {/* A plain disc, not glass: the card under it is opaque white and
            the material had nothing to refract — it read as a grey patch
            with a mark in it. */}
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: `${look.tint}1A`,
          }}
        >
          <look.Icon size={18} color={look.tint} />
        </View>

        <View style={{ flex: 1, gap: 3 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.sm,
            }}
          >
            <Text
              numberOfLines={2}
              style={{
                flex: 1,
                fontSize: 15,
                lineHeight: 21,
                // Unread reads heavier, so a glance down the list finds them.
                fontWeight: n.read ? "500" : "700",
                color: TEXT_PRIMARY,
              }}
            >
              {n.title}
            </Text>
            {!n.read && (
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: PRIMARY_500,
                }}
              />
            )}
          </View>
          <Text
            numberOfLines={3}
            style={{ fontSize: 13, lineHeight: 19, color: TEXT_SECONDARY }}
          >
            {n.body}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.sm,
              marginTop: 2,
            }}
          >
            <StatusTag
              label={KIND_LABEL[n.kind]}
              ink={look.tint}
              Icon={look.Icon}
            />
            <Text style={{ fontSize: 12, color: TEXT_MUTED }}>
              {today ? thaiTime(new Date(n.at)) : thaiDateTime(new Date(n.at))}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );
}
