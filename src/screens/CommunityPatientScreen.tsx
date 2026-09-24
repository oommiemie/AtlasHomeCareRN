import { useState } from "react";
import {
  Image,
  Linking,
  Modal,
  Pressable,
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

import { Chevron } from "../components/Chevron";
import { Avatar } from "../components/Avatar";
import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { Card } from "../components/Card";
import { Glass } from "../components/Glass";
import { GlassIconButton } from "../components/GlassIconButton";
import { HeaderWash } from "../components/ScreenHeader";
import { HeaderFade } from "../components/HeaderFade";
import { toast } from "../components/Toast";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  HeartPulse,
  History,
  MapPin,
  Phone,
  Video,
  TriangleAlert,
  X,
} from "lucide-react-native";
import type { RootStackParamList } from "../navigation/RootStack";
import { hasLocation } from "../models/task";
import type { PatientDetail } from "../models/patientDetail";
import { PatientRecordCards } from "../components/PatientRecordCards";
import { PatientBriefSheet } from "../components/PatientBriefSheet";
import { UIcon } from "../components/UIcon";
import { ToolbarPill } from "../components/ToolbarPill";
import { StatusTag } from "../components/StatusTag";
import { thaiDateTime } from "../utils/thaiDate";
import {
  EXAM_ROOMS,
  SESSION_TASKS,
  treatmentHistory,
  type SessionTask,
  summarise,
  useSessionRecords,
} from "../models/community";
import {
  CANVAS,
  DANGER,
  DANGER_BG,
  DANGER_INK,
  GROUPED_BG,
  PRIMARY_100,
  PRIMARY_500,
  PRIMARY_700,
  RADIUS,
  SEPARATOR,
  SPACE,
  SUCCESS,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TOUCH_MIN,
  WARNING,
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

/** The rows' pictures — Figma 476:45637-45640. */
/** The rows that have their own picture; the rest carry a glyph disc. */
const TASK_ART: Record<SessionTask, ReturnType<typeof require>> = {
  screening: require("../../assets/images/svc_screen.png"),
  assessment: require("../../assets/images/svc_assess.png"),
  diagnosis: require("../../assets/images/svc_diag.png"),
  homevisit: require("../../assets/images/svc_home.png"),
  medication: require("../../assets/images/svc_med.png"),
  physio: require("../../assets/images/svc_physio.png"),
  lab: require("../../assets/images/svc_lab.png"),
};

/**
 * The rows whose screen isn't built yet — they open a toast, not a form.
 * They wear a muted "ยังไม่เปิดใช้งาน" pill where a finished row wears its
 * green tick, so the column reads at a glance as what is done and what is
 * still to come. Take a key out of here the moment its flow ships.
 */
const SOON = new Set<SessionTask>(["physio", "lab"]);

/**
 * What a clinic session can record.
 *
 * A community day is a queue and a card reader: people are screened,
 * assessed and sent for labs, and what is diagnosed, prescribed or written
 * up about a house belongs to a visit rather than to a morning behind a
 * desk. So the card-read session shows those three and a visit shows
 * everything.
 */
const CLINIC_TASKS = new Set<SessionTask>(["screening", "assessment", "lab"]);

/**
 * What a home visit can record.
 *
 * Everything the clinic cannot, and no labs: a specimen taken in somebody's
 * front room has nowhere to go until it is back at the hospital, so the
 * order is written there rather than here.
 */
const VISIT_TASKS = new Set<SessionTask>([
  "screening",
  "assessment",
  "diagnosis",
  "homevisit",
  "medication",
]);

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
  const {
    holder,
    room: roomKey,
    task: visit,
    detail,
  } = useRoute<RouteProp<RootStackParamList, "CommunityPatient">>().params;
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();

  const room = EXAM_ROOMS.find((r) => r.key === roomKey);
  // Opened from a visit, or from a card in the reader at the clinic.
  const allowed = visit != null ? VISIT_TASKS : CLINIC_TASKS;
  const tasks = SESSION_TASKS.filter((t) => allowed.has(t.key));
  // A holder read before these fields existed (an in-flight session) has
  // neither; default them so the card renders rather than throwing.
  const allergies = holder.allergies ?? [];
  const conditions = holder.conditions ?? [];
  const [info, setInfo] = useState(false);
  const [briefing, setBriefing] = useState(false);
  const records = useSessionRecords(holder.authenCode);

  const open = (task: SessionTask) => {
    if (task === "screening") nav.navigate("HealthScreening", { holder });
    else if (task === "assessment") nav.navigate("AssessmentList", { holder });
    else if (task === "diagnosis") nav.navigate("Diagnosis", { holder });
    else if (task === "homevisit") nav.navigate("HomeVisit", { holder });
    else if (task === "medication") nav.navigate("Medication", { holder });
    else if (task === "physio") nav.navigate("Physio", { holder });
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
        <GlassIconButton
          onPress={() => nav.goBack()}
          accessibilityLabel="ปิดการตรวจ"
        >
          <ChevronLeft size={24} color={TEXT_PRIMARY} strokeWidth={2.4} />
        </GlassIconButton>
      </View>

      {/* The treatment history, in the corner opposite the back button —
          past visits, one card each. */}
      <View
        style={{
          position: "absolute",
          top: insets.top + SPACE.sm,
          right: SPACE.lg,
          zIndex: 2,
        }}
      >
        {/* One capsule, the same as the list headers carry: the AI brief
            (for a visit that came from a posting) and the history. */}
        <ToolbarPill
          slots={[
            ...(visit != null && detail != null
              ? [
                  {
                    icon: (
                      <UIcon name="magicWand" size={20} color={TEXT_PRIMARY} />
                    ),
                    label: "สรุปข้อมูลผู้ป่วยด้วย AI",
                    onPress: () => setBriefing(true),
                  },
                ]
              : []),
            {
              icon: (
                <History size={20} color={TEXT_PRIMARY} strokeWidth={2.2} />
              ),
              label: "ประวัติการรักษา",
              onPress: () =>
                nav.navigate("TreatmentHistory", {
                  hn: holder.hn,
                  name: `คุณ ${holder.name}`,
                }),
            },
          ]}
        />
      </View>

      {/* The cards dissolve as they rise behind the floating buttons —
          gone under the status bar, half there behind the glass so it has
          something to refract, whole below. */}
      <HeaderFade from={insets.top - 4} to={insets.top + TOUCH_MIN + SPACE.lg}>
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
            <View
              style={{
                flexDirection: "row",
                gap: SPACE.sm,
                marginTop: SPACE.sm,
              }}
            >
              <Chip label={`${holder.age} ปี`} />
              <Chip label={holder.gender} />
            </View>
            {/* The condition, as the posting prints it: large under the chips,
                because it is the first thing that decides how the visit goes. */}
            {conditions.length > 0 && (
              <Text
                numberOfLines={2}
                style={{
                  marginTop: SPACE.sm,
                  fontSize: 15,
                  lineHeight: 21,
                  fontWeight: "600",
                  color: TEXT_PRIMARY,
                  textAlign: "center",
                }}
              >
                {conditions.join(" · ")}
              </Text>
            )}
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
            {/* Two ways to reach them without leaving the page: a call, and a
                FaceTime call for the visit that is done over video. */}
            {holder.phone != null && holder.phone !== "" && (
              <View
                style={{
                  flexDirection: "row",
                  gap: SPACE.sm,
                  marginTop: SPACE.lg,
                }}
              >
                <ReachButton
                  icon={
                    <Phone size={22} color={PRIMARY_700} strokeWidth={2.2} />
                  }
                  label="โทร"
                  onPress={() =>
                    Linking.openURL(`tel:${holder.phone}`).catch(() =>
                      toast("โทรออกไม่ได้"),
                    )
                  }
                />
                <ReachButton
                  icon={
                    <Video size={22} color={PRIMARY_700} strokeWidth={2.2} />
                  }
                  label="วิดีโอคอล"
                  onPress={() =>
                    Linking.openURL(`facetime://${holder.phone}`).catch(() =>
                      toast("วิดีโอคอลไม่ได้"),
                    )
                  }
                />
                {/* The address: on the app's own map where the visit has a
                    pin, otherwise handed to Maps as a search. */}
                {visit != null &&
                  (visit.address != null || hasLocation(visit)) && (
                    <ReachButton
                      icon={
                        <MapPin
                          size={22}
                          color={PRIMARY_700}
                          strokeWidth={2.2}
                        />
                      }
                      label="ที่อยู่"
                      onPress={() => {
                        if (hasLocation(visit))
                          nav.navigate("ExploreMap", { focus: visit });
                        else
                          Linking.openURL(
                            `maps://?q=${encodeURIComponent(visit.address ?? "")}`,
                          ).catch(() => toast("เปิดแผนที่ไม่ได้"));
                      }}
                    />
                  )}
              </View>
            )}
          </View>

          {/* The four identifiers, two to a row with a rule between — Figma's
              own Frame 22. */}
          <Card>
            <Field label="เลขบัตรประชาชน" value={holder.citizenId} />
            <Rule />
            <View style={{ flexDirection: "row" }}>
              <Field label="HN" value={holder.hn} />
              {holder.an != null ? (
                <Field label="AN" value={holder.an} />
              ) : (
                <Field label="Authen Code" value={holder.authenCode} />
              )}
            </View>
            <Rule />
            <View style={{ flexDirection: "row" }}>
              {holder.dischargeDate != null && (
                <Field label="วันจำหน่าย" value={holder.dischargeDate} />
              )}
              <Field label="สิทธิการรักษา" value={holder.entitlement} />
            </View>
            {holder.referredBy != null && (
              <>
                <Rule />
                <Field label="ส่งเยี่ยมจาก" value={holder.referredBy} />
              </>
            )}

            {(detail != null ||
              allergies.length > 0 ||
              conditions.length > 0) && (
              <>
                <View style={{ height: SPACE.md }} />
                {/* The way to the rest of the record, as a row: the allergy
                    count rides along on its red pill, because that is the one
                    thing in there a carer must not miss. */}
                <Pressable
                  onPress={() => setInfo(true)}
                  accessibilityRole="button"
                  accessibilityLabel="ดูข้อมูลผู้ป่วยเพิ่มเติม"
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.sm,
                    minHeight: 48,
                    paddingLeft: SPACE.lg,
                    paddingRight: SPACE.md,
                    borderRadius: RADIUS.capsule,
                    backgroundColor: GROUPED_BG,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 15,
                      lineHeight: 20,
                      fontWeight: "600",
                      color: TEXT_PRIMARY,
                    }}
                  >
                    ข้อมูลผู้ป่วยเพิ่มเติม
                  </Text>
                  {allergies.length > 0 && (
                    <StatusTag
                      label={`แพ้ ${allergies.length} รายการ`}
                      ink={DANGER}
                      Icon={TriangleAlert}
                    />
                  )}
                  <ChevronRight
                    size={18}
                    color={TEXT_SECONDARY}
                    strokeWidth={2.4}
                  />
                </Pressable>
              </>
            )}
          </Card>

          {/* When the visit is — one line, when the page was opened from a
              visit rather than from a card in a reader. */}
          {visit != null && (
            <Card>
              <Field label="วันที่เยี่ยม" value={thaiDateTime(visit.dueAt)} />
            </Card>
          )}

          {/* The three things a session can record, in the shape the
              assessment list one screen on gives its rows — title and the
              chevron disc on one line, the detail under — with the row's
              picture in the left slot. The pictures are the current set; the
              redrawn ones drop into the same slot. */}
          {tasks.map((t) => {
            const held = records[t.key];
            const soon = SOON.has(t.key);
            const preview = held != null ? summarise(t.key, held) : "";
            return (
              <Card
                key={t.key}
                onPress={() => open(t.key)}
                accessibilityLabel={t.label}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.lg,
                    opacity: soon ? 0.55 : 1,
                  }}
                >
                  <Image
                    source={TASK_ART[t.key]}
                    style={{ width: D.mark, height: D.mark }}
                    resizeMode="contain"
                    accessibilityRole="none"
                  />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: SPACE.md,
                      }}
                    >
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
                      {/* Out at the end of the row, against the arrow: four rows
                      of different title lengths, and a mark that follows the
                      title sits at four different places down the card. Put
                      where the row ends it lines up with the ones above and
                      below, and the eye can run down the column to see what
                      is left to do. */}
                      <View style={{ flex: 1 }} />
                      {soon ? (
                        <View
                          style={{
                            backgroundColor: GROUPED_BG,
                            borderRadius: 999,
                            paddingHorizontal: 9,
                            paddingVertical: 3,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              lineHeight: 14,
                              fontWeight: "600",
                              color: TEXT_MUTED,
                            }}
                          >
                            ยังไม่เปิดใช้งาน
                          </Text>
                        </View>
                      ) : held != null ? (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          <Check size={14} color={SUCCESS} strokeWidth={2.6} />
                          <Text
                            style={{
                              fontSize: 12,
                              lineHeight: 16,
                              fontWeight: "500",
                              color: SUCCESS,
                            }}
                          >
                            บันทึกแล้ว
                          </Text>
                        </View>
                      ) : null}
                      <Chevron ink={held != null ? PRIMARY_500 : undefined} />
                    </View>
                    {/*
                  What is in it, once there is something in it.

                  The detail line says what the task is *for*, which stops
                  being the useful thing the moment it has been done — after
                  that the question is "did I put the pressure in?", and the
                  answer belongs on the row rather than behind a tap. The row
                  still opens the form, which now opens on what is there, so
                  this is a way back in and not a dead end.
                */}
                    {preview !== "" ? (
                      <Text
                        numberOfLines={2}
                        ellipsizeMode="tail"
                        style={{
                          fontSize: 12,
                          lineHeight: 18,
                          color: TEXT_PRIMARY,
                        }}
                      >
                        {preview}
                      </Text>
                    ) : (
                      <Text
                        numberOfLines={2}
                        style={{
                          fontSize: 12,
                          lineHeight: 18,
                          color: TEXT_MUTED,
                        }}
                      >
                        {t.detail}
                      </Text>
                    )}
                  </View>
                </View>
              </Card>
            );
          })}
        </ScrollView>
      </HeaderFade>

      {/* The way out — only once there is something to end.

          The tray is the same one the add-house flow and the card reader
          carry, at the same height off the foot. It ends the session rather
          than going on to a fifth screen; and a visit with nothing recorded
          in it cannot be ended, so until one of the rows above has saved,
          there is no tray at all. */}
      {visit != null && detail != null && (
        <PatientBriefSheet
          visible={briefing}
          task={visit}
          detail={detail}
          lastVisit={treatmentHistory(holder.hn)[0]}
          onClose={() => setBriefing(false)}
        />
      )}

      <PatientInfoSheet
        visible={info}
        allergies={allergies}
        conditions={conditions}
        detail={detail}
        onClose={() => setInfo(false)}
      />

      {Object.keys(records).length > 0 && (
        <ActionBar>
          <PrimaryAction
            label="เสร็จสิ้นการตรวจ"
            onPress={() => {
              toast("บันทึกการตรวจแล้ว", "success");
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
/**
 * The patient's allergies and conditions in full, as a sheet.
 *
 * The record shows only a one-line strip; the whole of it opens here, so
 * the page stays short and the detail is a tap away rather than always
 * on screen.
 */
function PatientInfoSheet({
  visible,
  allergies,
  conditions,
  detail,
  onClose,
}: {
  visible: boolean;
  allergies: string[];
  conditions: string[];
  /** The full record, when the page was opened from a visit; the sheet then shows all of it. */
  detail?: PatientDetail;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: CANVAS }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: SPACE.lg,
            paddingTop: SPACE.lg,
          }}
        >
          <GlassIconButton onPress={onClose} accessibilityLabel="ปิด">
            <X size={22} color={TEXT_PRIMARY} strokeWidth={2.6} />
          </GlassIconButton>
          <Text
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 16,
              fontWeight: "600",
              color: TEXT_PRIMARY,
            }}
          >
            ข้อมูลสุขภาพผู้ป่วย
          </Text>
          <View style={{ width: 44 }} />
        </View>
        <ScrollView
          contentContainerStyle={{
            padding: SPACE.lg,
            gap: SPACE.md,
            paddingBottom: insets.bottom + SPACE.xl,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* The chips only where there is no full record below: it
              carries its own allergy and condition lines. */}
          {detail == null && allergies.length > 0 && (
            <InfoPanel
              icon={
                <TriangleAlert size={16} color={DANGER} strokeWidth={2.4} />
              }
              iconTint={DANGER}
              label="แพ้ยา / แพ้อาหาร"
              items={allergies}
              chipColor={DANGER_INK}
            />
          )}
          {detail == null && conditions.length > 0 && (
            <InfoPanel
              icon={
                <HeartPulse size={16} color={PRIMARY_500} strokeWidth={2.4} />
              }
              iconTint={PRIMARY_500}
              label="โรคประจำตัว"
              items={conditions}
              chipColor={TEXT_PRIMARY}
            />
          )}

          {/* The whole record, as the posting showed it. */}
          {detail != null && <PatientRecordCards detail={detail} />}
        </ScrollView>
      </View>
    </Modal>
  );
}

function InfoPanel({
  icon,
  iconTint,
  label,
  items,
  chipColor,
}: {
  icon: React.ReactNode;
  iconTint: string;
  label: string;
  items: string[];
  chipColor: string;
}) {
  return (
    <Card style={{ gap: SPACE.md }}>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: `${iconTint}1A`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </View>
        <Text
          style={{
            flex: 1,
            fontSize: 14,
            lineHeight: 20,
            fontWeight: "700",
            color: TEXT_PRIMARY,
          }}
        >
          {label}
        </Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {items.map((it) => (
          <View
            key={it}
            style={{
              paddingHorizontal: SPACE.md,
              paddingVertical: 6,
              borderRadius: RADIUS.capsule,
              backgroundColor: GROUPED_BG,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                lineHeight: 17,
                fontWeight: "600",
                color: chipColor,
              }}
            >
              {it}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

/** A round glass button; the glyph says what it does, the label is for VoiceOver. */
function ReachButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <GlassIconButton onPress={onPress} accessibilityLabel={label} size={48}>
      {icon}
    </GlassIconButton>
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

/** One identifier: what it is called, and what it says. */
/** The hairline between the card's rows. */
function Rule() {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: SEPARATOR,
        marginVertical: SPACE.md,
      }}
    />
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
      <Text
        numberOfLines={1}
        style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          fontSize: 16,
          lineHeight: 21,
          fontWeight: "600",
          color: TEXT_PRIMARY,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
