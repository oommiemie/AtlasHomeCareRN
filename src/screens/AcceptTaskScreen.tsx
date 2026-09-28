import { useState } from "react";
import {
  Image,
  Linking,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { MapView, Marker, PROVIDER_DEFAULT } from "../components/Map";
import { ChevronLeft } from "lucide-react-native";

import { ActionBar, ActionCapsule } from "../components/ActionBar";
import { Card } from "../components/Card";
import { PatientRecordCards } from "../components/PatientRecordCards";
import { Glass } from "../components/Glass";
import { MapPin, pinAnchor } from "../components/MapPin";
import { UIcon } from "../components/UIcon";
import { Floating } from "../components/BlurStage";
import { GlassIconButton } from "../components/GlassIconButton";
import { PatientBriefSheet } from "../components/PatientBriefSheet";
import { RejectSheet } from "../components/RejectSheet";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  genderOf,
  hasLocation,
  initialOf,
  visitHolder,
  type Task,
} from "../models/task";
import { detailOf } from "../models/patientDetail";
import { treatmentHistory } from "../models/community";
import { recordDecision } from "../models/postingLog";
import { thaiDateTime } from "../utils/thaiDate";
import {
  CANVAS,
  CANVAS_CLEAR,
  DANGER,
  GLASS_NEUTRAL,
  PANEL,
  PLATE,
  PRIMARY_500,
  PRIMARY_700,
  RADIUS,
  SEPARATOR,
  SPACE,
  SPACE as S,
  SURFACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  currentTheme,
} from "../theme/tokens";

/**
 * The gap iOS 26 leaves below the floating tab bar's pill, measured off the
 * running app rather than taken from the design: the Figma frame's 25 and the
 * device's own safe-area inset both put the bar at a different height than
 * the tab bar actually sits at.
 */

/**
 * The address card's map — the home screen's "สำรวจพื้นที่" card, to the
 * number.
 *
 * `PIN_ACROSS` is where the map's centre, and so the pin on it, should land
 * across the card: far enough right to clear the white the text is read on.
 * `SPAN` is how much ground the frame covers, tighter than the home card's
 * because that one shows a district and this one shows a house.
 */
const PIN_ACROSS = 0.8;
const ADDRESS_SPAN = 0.004;

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** "รับภารกิจ" — the full record behind a posting, and the decision on it. */
export function AcceptTaskScreen() {
  const { task } =
    useRoute<RouteProp<RootStackParamList, "AcceptTask">>().params;
  const [rejecting, setRejecting] = useState(false);
  const [briefing, setBriefing] = useState(false);
  // The floating bar takes over once the in-flow pair has scrolled away —
  // Figma 70:5674 is this same screen in that state.
  const [floating, setFloating] = useState(false);
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const d = detailOf(task);

  // A posting is decided on; a visit already taken is done. Only accepted
  // visits carry a status, so that is the tell.
  const accepted = task.status != null;
  // The record page the community service opens after a card read — opened
  // here on the task's patient instead, with no card and no room to pick.
  const doTask = () =>
    nav.navigate("CommunityPatient", { holder: visitHolder(task, d) });

  /** Taking the job, and saying so in the log that keeps both answers. */
  const accept = () => {
    recordDecision({
      taskId: task.id,
      name: task.name,
      detail: task.detail,
      kind: "accepted",
    });
    toast("รับงานแล้ว", "success");
    nav.goBack();
  };

  const openMap = () => {
    if (!hasLocation(task)) return;
    nav.navigate("ExploreMap", { focus: task });
  };

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <Image
        source={require("../../assets/images/accept_backdrop.png")}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top + 335,
          // Figma 63:3815 paints the art at 80% and fades it into the page
          // ground over its whole height, so the banner has no cut edge.
          opacity: 0.8,
        }}
        resizeMode="cover"
      />
      <LinearGradient
        colors={[CANVAS_CLEAR, CANVAS]}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top + 335,
        }}
        pointerEvents="none"
      />

      <ScrollView
        onScroll={(e) => {
          // Roughly where the in-flow buttons sit; past this the carer can no
          // longer see them.
          setFloating(e.nativeEvent.contentOffset.y > 300);
        }}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingHorizontal: SPACE.lg,
          paddingTop: insets.top + 60,
          // Clears the floating bar, so the last card is never trapped behind it.
          paddingBottom: insets.bottom + 96,
          gap: SPACE.md,
        }}
      >
        <View style={{ alignItems: "center", marginBottom: SPACE.xs }}>
          {/*
            The avatar on Apple's glass, tinted rather than filled.

            0.95 of PRIMARY_500 — as saturated as the blue can go while the
            material still shows. The tint is painted OVER the glass rather
            than mixed into it, so at a full 1.0 the highlight and rim are
            gone and this is just a flat blue disc.
          */}
          <Glass
            tintColor="rgba(7,125,215,0.95)"
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: "600", color: "#FFFFFF" }}>
              {initialOf(task)}
            </Text>
          </Glass>
          <Text
            style={{
              marginTop: SPACE.md,
              fontSize: 20,
              fontWeight: "600",
              color: TEXT_PRIMARY,
            }}
          >
            {task.name}
          </Text>
          <View
            style={{ flexDirection: "row", gap: SPACE.sm, marginTop: SPACE.sm }}
          >
            <Chip label={`${task.age} ปี`} />
            {genderOf(task.name) != null && (
              <Chip label={genderOf(task.name)!} />
            )}
          </View>
          {/*
            The condition is the reason for the visit — the one fact that
            decides whether you take the job — so it carries weight rather
            than trailing the chips as another line of small grey text.
          */}
          <Text
            style={{
              marginTop: SPACE.md,
              fontSize: 20,
              fontWeight: "700",
              color: TEXT_PRIMARY,
              textAlign: "center",
              // Thai ascenders and tone marks overrun a tight line box.
              lineHeight: 28,
            }}
          >
            {d.condition}
          </Text>
        </View>

        {accepted ? (
          <DoTask onPress={doTask} />
        ) : (
          <Actions onReject={() => setRejecting(true)} onAccept={accept} />
        )}

        <Card>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Field label="ติดต่อผู้ป่วยยืนยันนัด" value={d.phone} />
            </View>
            <GlassIconButton
              onPress={() =>
                Linking.openURL(`tel:${d.phone}`).catch(() =>
                  toast("โทรออกไม่ได้", "error"),
                )
              }
              accessibilityLabel="โทรหาผู้ป่วย"
            >
              <UIcon name="phoneFlip" size={20} color={PRIMARY_700} />
            </GlassIconButton>
            <View style={{ width: SPACE.sm }} />
            <GlassIconButton
              onPress={() => toast("วิดีโอคอลยังไม่เปิดใช้งาน")}
              accessibilityLabel="วิดีโอคอล"
            >
              <UIcon name="videoCameraAlt" size={20} color={PRIMARY_700} />
            </GlassIconButton>
          </View>
        </Card>

        <Card>
          <Field label="เลขบัตรประชาชน" value={d.nationalId} />
          <Rule />
          <View style={{ flexDirection: "row" }}>
            <View style={{ flex: 1 }}>
              <Field label="HN" value={d.hn} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="AN" value={d.an} />
            </View>
          </View>
          <Rule />
          <View style={{ flexDirection: "row" }}>
            <View style={{ flex: 1 }}>
              <Field label="วันจำหน่าย" value={d.dischargeDate} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="สิทธิการรักษา" value={d.coverage} />
            </View>
          </View>
          <Rule />
          <Field label="ส่งเยี่ยมจาก" value={d.referredBy} />
        </Card>

        <Card>
          <Field label="วันที่เยี่ยม" value={thaiDateTime(task.dueAt)} />
        </Card>

        <AddressCard
          task={task}
          onPress={hasLocation(task) ? openMap : undefined}
        />

        <PatientRecordCards detail={d} />
      </ScrollView>

      <Floating>
        <View
          style={{
            position: "absolute",
            top: insets.top + SPACE.sm,
            left: SPACE.lg,
          }}
        >
          <GlassIconButton
            onPress={() => nav.goBack()}
            accessibilityLabel="ย้อนกลับ"
          >
            <ChevronLeft size={24} color={TEXT_PRIMARY} strokeWidth={2.4} />
          </GlassIconButton>
        </View>
      </Floating>

      {/*
        The whole record is a long scroll, and the decision is made at the top
        of it. So the way to a summary is pinned rather than placed in the
        flow: it balances the back button, and it is still there when the
        carer is four cards down and wants the short version.
      */}
      <Floating>
        <View
          style={{
            position: "absolute",
            top: insets.top + SPACE.sm,
            right: SPACE.lg,
          }}
        >
          <GlassIconButton
            onPress={() => setBriefing(true)}
            accessibilityLabel="สรุปข้อมูลผู้ป่วยด้วย AI"
          >
            <UIcon name="magicWand" size={20} color={TEXT_PRIMARY} />
          </GlassIconButton>
        </View>
      </Floating>

      {/*
        The shared tray, as every other floating bar in the app is. This one
        was assembled here by hand, and had drifted: its shadow was cast from
        a square view, so the capsule sat on a grey rectangle, and its blur
        was never lifted onto the page's stage, so on Android it blurred
        nothing. `ActionBar` has the same 25 in, 23 up and 36pt corners, and
        gets both of those right.
      */}
      {floating && (
        <ActionBar>
          {accepted ? (
            <DoTask onPress={doTask} />
          ) : (
            <Actions
              gap={SPACE.sm}
              onReject={() => setRejecting(true)}
              onAccept={accept}
            />
          )}
        </ActionBar>
      )}

      <PatientBriefSheet
        visible={briefing}
        task={task}
        detail={d}
        lastVisit={treatmentHistory(d.hn)[0]}
        onClose={() => setBriefing(false)}
      />

      <RejectSheet
        visible={rejecting}
        onClose={() => setRejecting(false)}
        onSubmit={(reason, detail) => {
          setRejecting(false);
          recordDecision({
            taskId: task.id,
            name: task.name,
            detail: task.detail,
            kind: "rejected",
            reason,
            note: detail,
          });
          toast("ส่งเหตุผลการปฏิเสธแล้ว", "success");
          nav.goBack();
        }}
      />
    </View>
  );
}

/**
 * Age and gender, on Apple's glass.
 *
 * These sit over the backdrop photograph at the top of the page, so the
 * material has real content behind it to refract — unlike the floating bar's
 * frame, where a second glass layer had only glass to sample.
 */
/**
 * Where the visit is, on the ground it names.
 *
 * The home screen's "สำรวจพื้นที่" card, with the house's pin in place of the
 * user dot: map along the right, white poured across the left, the words on
 * the white. The whole card is the button — a map that panned under a finger
 * that meant to open it would swallow the tap, so the map takes no touches at
 * all and carries no button of its own.
 */
function AddressCard({ task, onPress }: { task: Task; onPress?: () => void }) {
  // The card's own width, not the screen's: it sits inside the page padding.
  const [width, setWidth] = useState(0);
  const at =
    task.lat != null && task.lng != null
      ? { latitude: task.lat, longitude: task.lng }
      : null;

  return (
    <Card padded={false} onPress={onPress}>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {at != null && (
          <MapView
            userInterfaceStyle={currentTheme()}
            provider={PROVIDER_DEFAULT}
            // Drawn wider than the card and overhanging the RIGHT edge, so
            // the map's centre — where the pin sits — lands on the right of
            // the card, clear of the white the address is read on.
            //
            // The overhang is solved from the measured width rather than
            // guessed: the map spans [0, W + overhang], so its centre is at
            // (W + overhang) / 2, and setting that equal to PIN_ACROSS * W
            // gives the overhang. Nudging the region's longitude instead does
            // almost nothing — MapKit fits a region to the shorter side, so
            // on a card this wide the visible span is several times the one
            // asked for.
            style={{
              position: "absolute",
              left: 0,
              right: -width * (2 * PIN_ACROSS - 1),
              top: 0,
              bottom: 0,
            }}
            region={{
              ...at,
              latitudeDelta: ADDRESS_SPAN,
              longitudeDelta: ADDRESS_SPAN,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            toolbarEnabled={false}
            pointerEvents="none"
          >
            {/* The pin carries its own view — a childless marker draws
                nothing under the New Architecture. */}
            {/* Apple's marker, bare. Nothing is put inside it: the balloon
                already says "here", and the house is spoken for by the mark
                beside the address. */}
            <Marker coordinate={at} anchor={pinAnchor()}>
              <MapPin />
            </Marker>
          </MapView>
        )}

        {/*
          The card's own face across the front, then out to nothing.

          Solid to just past the text and the rest of the width spent fading:
          at anything less than solid the streets show through the address
          and the card reads as smudged rather than as text on paper.

          The stops are the surface tokens rather than white, so the ramp is
          the card's own colour on either ground — a white one would take the
          address with it on a dark page.
        */}
        <LinearGradient
          colors={[SURFACE, SURFACE, PLATE, CANVAS_CLEAR]}
          locations={[0, 0.46, 0.74, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        />

        <View
          style={{
            padding: SPACE.lg,
            minHeight: 100,
            justifyContent: "center",
            // Two thirds of the card: the rest is the map, and a line that
            // ran under it would be read against streets.
            width: "66%",
          }}
        >
          <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>
            ที่อยู่
          </Text>
          <Text
            style={{
              marginTop: 2,
              fontSize: 14,
              lineHeight: 22,
              fontWeight: "600",
              color: TEXT_PRIMARY,
            }}
          >
            {task.address ?? "ไม่ระบุที่อยู่"}
          </Text>
        </View>
      </View>
    </Card>
  );
}

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
      <Text style={{ fontSize: 12, fontWeight: "500", color: PRIMARY_500 }}>
        {label}
      </Text>
    </Glass>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={{ fontSize: 14, color: TEXT_MUTED }}>{label}</Text>
      <Text
        style={{
          marginTop: S.xs,
          fontSize: 16,
          fontWeight: "600",
          color: TEXT_PRIMARY,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const Rule = () => (
  <View
    style={{ height: 1, backgroundColor: SEPARATOR, marginVertical: SPACE.md }}
  />
);

/**
 * Reject and accept, side by side — Figma `Button - Liquid Glass - Text`
 * (63:4332 and 63:4337).
 *
 * Both are Apple's Liquid Glass, not flat fills: each Figma node carries a
 * `GLASS` effect over its fill, and the fill itself is what tints the
 * material rather than replacing it. Reject paints white at 50% so the
 * material stays clear behind its red label; accept paints the green.
 *
 * The capsules therefore go through [Glass] with a translucent tint. An
 * opaque backgroundColor here — which is what these were before — hides the
 * material completely and leaves two plain rounded rectangles.
 */
function Actions({
  onReject,
  onAccept,
  gap = 10,
}: {
  onReject: () => void;
  onAccept: () => void;
  /**
   * 10 in the page flow, narrower than the 16 of `Frame 52` (63:4343): the
   * capsules run the full width here rather than the design's 167, and at
   * that length 16 opened a visible channel between them. 8 inside the
   * floating bar (70:5970), which is already a surface of its own.
   */
  gap?: number;
}) {
  return (
    <View style={{ flexDirection: "row", gap }}>
      <ActionButton
        onPress={onReject}
        label="ปฏิเสธ"
        // #E24747, the Figma label colour — softer than the DANGER red the
        // app uses for alerts, because this is a choice and not a warning.
        color="#E24747"
        tint={GLASS_NEUTRAL}
        paint={SURFACE}
      />
      <ActionButton
        onPress={onAccept}
        label="รับงาน"
        color="#FFFFFF"
        // The green at the opacity the material can still refract through.
        tint="rgba(29,139,107,0.75)"
        // Painted, the green that tint lands at over the white tray, so the
        // button is the colour it has always been seen at.
        paint="#55A890"
      />
    </View>
  );
}

/**
 * The one action a visit already taken has: go and do it. The same capsule
 * as the pair, in the tray's blue, running the full width on its own.
 */
function DoTask({ onPress }: { onPress: () => void }) {
  return (
    <View style={{ flexDirection: "row" }}>
      <ActionButton
        onPress={onPress}
        label="ทำภารกิจ"
        color="#FFFFFF"
        tint="rgba(7,125,215,0.78)"
        paint={PRIMARY_500}
      />
    </View>
  );
}

/**
 * One 48pt capsule — the shared tray's (`ActionCapsule`), stretched to share
 * the row. Glass with a translucent tint where there is Apple's material,
 * painted where there is not; see `ActionCapsule` for why.
 */
function ActionButton({
  onPress,
  label,
  color,
  tint,
  paint,
}: {
  onPress: () => void;
  label: string;
  color: string;
  tint: string;
  /** The same button, painted, for the platform with no material. */
  paint: string;
}) {
  return (
    // The flex sits on this wrapper, since the capsule sizes to its content
    // and would otherwise collapse to the width of its label.
    <View style={{ flex: 1 }}>
      <ActionCapsule
        onPress={onPress}
        label={label}
        color={color}
        tint={tint}
        paint={paint}
      />
    </View>
  );
}
