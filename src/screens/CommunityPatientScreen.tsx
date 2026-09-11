import { Image, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { Chevron } from "../components/Chevron";
import { Avatar } from "../components/Avatar";
import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { Card } from "../components/Card";
import { Glass } from "../components/Glass";
import { GlassIconButton } from "../components/GlassIconButton";
import { HeaderWash } from "../components/ScreenHeader";
import { toast } from "../components/Toast";
import { Check, ChevronLeft } from "lucide-react-native";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  EXAM_ROOMS,
  formatCitizenId,
  SESSION_TASKS,
  type SessionTask,
  useSessionDone,
} from "../models/community";
import {
  CANVAS,
  PRIMARY_500,
  RADIUS,
  SPACE,
  SUCCESS,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Figma 94:11702, at the size it is drawn — a 440 artboard is this phone. */
const D = {
  pad: 16,
  gap: 10,
  /** How far down the page the wash behind the head of it reaches. */
  wash: 335,
  avatar: 80,
  /** The picture on a task row. */
  mark: 32,
} as const;

/** The rows' pictures — placeholders until the redrawn set lands. */
const TASK_ART: Record<SessionTask, ReturnType<typeof require>> = {
  screening: require("../../assets/images/svc_screen.png"),
  assessment: require("../../assets/images/svc_assess.png"),
  lab: require("../../assets/images/svc_lab.png"),
};


/**
 * The session — Figma 94:11702.
 *
 * What the card unlocked, and what can be recorded against it. The four
 * identifiers are printed rather than tucked away: a community visit produces
 * claims, and the HN, the scheme and the Authen Code are what a claim is made
 * of — a carer reads them back off this page onto paper more than once in a
 * morning.
 *
 * No back button in the header's usual place and no gesture back to the
 * reader: the card has been read and the code minted, and returning to the
 * reader would offer to do it again against a card already in the slot. The
 * way out is the arrow, which ends the session.
 */
export function CommunityPatientScreen() {
  const { holder, room: roomKey } =
    useRoute<RouteProp<RootStackParamList, "CommunityPatient">>().params;
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();

  const room = EXAM_ROOMS.find((r) => r.key === roomKey);
  const done = useSessionDone(holder.authenCode);

  const open = (task: SessionTask) => {
    if (task === "screening") nav.navigate("HealthScreening", { holder });
    else if (task === "assessment") nav.navigate("AssessmentList", { holder });
    else toast("สั่งแลปยังไม่เปิดใช้งาน");
  };

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      {/* The same pale wash every pushed screen opens with — not the
          design's streaked glass picture, which read as a thing behind the
          page rather than as the page's own ground. */}
      <HeaderWash height={insets.top + D.wash} />

      <View
        style={{
          position: "absolute",
          top: insets.top + SPACE.sm,
          left: SPACE.lg,
          zIndex: 2,
        }}
      >
        <GlassIconButton onPress={() => nav.goBack()} accessibilityLabel="ปิดการตรวจ">
          <ChevronLeft size={24} color="#1A1A1A" strokeWidth={2.4} />
        </GlassIconButton>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: D.pad,
          paddingTop: insets.top + 60,
          paddingBottom: insets.bottom + 96,
          gap: D.gap,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Who is in front of you. */}
        <View style={{ alignItems: "center", marginBottom: SPACE.lg }}>
          <Avatar size={D.avatar} initial={holder.name[0] ?? "?"} />
          <Text
            numberOfLines={1}
            style={{
              marginTop: SPACE.md,
              fontSize: 20,
              lineHeight: 26,
              fontWeight: "600",
              color: TEXT_PRIMARY,
            }}
          >
            {`คุณ ${holder.name}`}
          </Text>
          <View style={{ flexDirection: "row", gap: SPACE.sm, marginTop: SPACE.sm }}>
            <Chip label={`${holder.age} ปี`} />
            <Chip label={holder.gender} />
          </View>
          {/* Where they are being sent, as a line under the name rather than
              a third chip: it is the one thing here that is a *place*, and
              it can run long. */}
          {room != null && (
            <Text
              numberOfLines={1}
              style={{
                marginTop: SPACE.sm,
                fontSize: 14,
                lineHeight: 20,
                fontWeight: "700",
                color: TEXT_PRIMARY,
              }}
            >
              {room.name}
            </Text>
          )}
        </View>

        {/* The four identifiers, two to a row with a rule between — Figma's
            own Frame 22. */}
        <Card>
          <View style={{ flexDirection: "row" }}>
            <Field label="เลขบัตรประชาชน" value={formatCitizenId(holder.citizenId)} />
            <Field label="HN" value={holder.hn} />
          </View>
          <View
            style={{
              height: 1,
              backgroundColor: "rgba(204,204,204,0.4)",
              marginVertical: SPACE.md,
            }}
          />
          <View style={{ flexDirection: "row" }}>
            <Field label="สิทธิการรักษา" value={holder.entitlement} />
            <Field label="Authen Code" value={holder.authenCode} />
          </View>
        </Card>

        {/* The three things a session can record, in the shape the
            assessment list one screen on gives its rows — title and the
            chevron disc on one line, the detail under — with the row's
            picture in the left slot. The pictures are the current set; the
            redrawn ones drop into the same slot. */}
        {SESSION_TASKS.map((t) => (
          <Card key={t.key} onPress={() => open(t.key)} accessibilityLabel={t.label}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.lg }}>
              <Image
                source={TASK_ART[t.key]}
                style={{ width: D.mark, height: D.mark }}
                resizeMode="contain"
                accessibilityRole="none"
              />
              <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
                <Text
                  numberOfLines={1}
                  style={{
                    flexShrink: 1,
                    fontSize: 16,
                    lineHeight: 21,
                    fontWeight: "600",
                    color: TEXT_PRIMARY,
                  }}
                >
                  {t.label}
                </Text>
                {done.has(t.key) && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <Check size={14} color={SUCCESS} strokeWidth={2.6} />
                    <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: "500", color: SUCCESS }}>
                      บันทึกแล้ว
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }} />
                <Chevron />
              </View>
              <Text numberOfLines={2} style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
                {t.detail}
              </Text>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>

      {/* The way out — only once there is something to end.

          The tray is the same one the add-house flow and the card reader
          carry, at the same height off the foot. It ends the session rather
          than going on to a fifth screen; and a visit with nothing recorded
          in it cannot be ended, so until one of the rows above has saved,
          there is no tray at all. */}
      {done.size > 0 && (
        <ActionBar>
          <PrimaryAction
            label="เสร็จสิ้นการตรวจ"
            onPress={() => {
              toast("บันทึกการตรวจแล้ว");
              nav.popToTop();
            }}
          />
        </ActionBar>
      )}
    </View>
  );
}

/**
 * Age, gender, room — on Apple's glass, as the accept-task hero's are.
 *
 * These sit over the wash at the top of the page, so the material has
 * something behind it to refract; the flat blue capsule they were before
 * read as a different control from the same chips one screen over.
 */
function Chip({ label }: { label: string }) {
  return (
    <Glass
      style={{
        borderRadius: RADIUS.capsule,
        overflow: "hidden",
        paddingHorizontal: SPACE.md,
        paddingVertical: 6,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "500", color: PRIMARY_500 }}>{label}</Text>
    </Glass>
  );
}

/** One identifier: what it is called, and what it says. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
      <Text numberOfLines={1} style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{ fontSize: 16, lineHeight: 21, fontWeight: "600", color: TEXT_PRIMARY }}
      >
        {value}
      </Text>
    </View>
  );
}
