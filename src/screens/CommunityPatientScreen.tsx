import { useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Image,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { BlurStage } from "../components/BlurStage";
import { ScreenFrame } from "../components/ScreenFrame";
import { Glass } from "../components/Glass";
import { PlainHeaderContext } from "../components/ScreenHeader";
import { HealthScreeningScreen } from "./HealthScreeningScreen";
import { AssessmentListScreen } from "./AssessmentListScreen";
import { DiagnosisScreen } from "./DiagnosisScreen";
import { HomeVisitScreen } from "./HomeVisitScreen";
import { MedicationScreen } from "./MedicationScreen";
import { PhysioScreen } from "./PhysioScreen";
import { QuestionnaireScreen } from "./QuestionnaireScreen";
import { AsthmaScreen } from "./AsthmaScreen";
import { DyspneaScreen } from "./DyspneaScreen";
import { NcdScreen } from "./NcdScreen";
import { Screening35Screen } from "./Screening35Screen";

import { Chevron } from "../components/Chevron";
import { Avatar } from "../components/Avatar";
import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { Card } from "../components/Card";
import { AvatarWithGender, NameWithAge } from "../components/HeroTag";
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
import { hasLocation, visitTypeLabel } from "../models/task";
import { tr } from "../i18n";
import { feel } from "../utils/haptics";
import {
  CONTENT_MAX,
  cardWidth,
  columnsFor,
  readable,
  useLayout,
  GUTTER,
  LayoutFrame,
} from "../theme/layout";
import type { PatientDetail } from "../models/patientDetail";
import { PatientRecordCards } from "../components/PatientRecordCards";
import { PatientBriefSheet } from "../components/PatientBriefSheet";
import { UIcon } from "../components/UIcon";
import { ToolbarPill } from "../components/ToolbarPill";
import { StatusTag } from "../components/StatusTag";
import { thaiDateTime } from "../utils/thaiDate";
import {
  type CardHolder,
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
/** The form each row of the visit menu opens. */
const TASK_ROUTE: Partial<Record<SessionTask, keyof PaneParams>> = {
  screening: "HealthScreening",
  assessment: "AssessmentList",
  diagnosis: "Diagnosis",
  homevisit: "HomeVisit",
  medication: "Medication",
  physio: "Physio",
};

/** Opens a row's form on whichever stack is given — the app's, or the pane's. */
function openTaskForm(
  navigate: (route: string, params: object) => void,
  task: SessionTask,
  holder: CardHolder,
) {
  const route = TASK_ROUTE[task];
  if (route == null) {
    toast(tr("สั่งแลปยังไม่เปิดใช้งาน", "Lab orders aren't available yet"));
    return;
  }
  navigate(route, { holder });
}

/*
  The right half's own page stack, on a tablet: the visit menu first, and
  every form the menu opens — with the ones those forms go on to — so none
  of them leaves the half. A route not in here (anything else a form
  reaches for) still goes to the app's own stack, over the whole screen.
*/
type PaneParams = {
  Menu: undefined;
  HealthScreening: { holder: CardHolder };
  AssessmentList: { holder: CardHolder };
  Diagnosis: { holder: CardHolder };
  HomeVisit: { holder: CardHolder };
  Medication: { holder: CardHolder };
  Physio: { holder: CardHolder };
  Questionnaire: { holder: CardHolder; form: string };
  Asthma: { holder: CardHolder };
  Dyspnea: { holder: CardHolder };
  Ncd: { holder: CardHolder };
  Screening35: { holder: CardHolder };
};
const Pane = createNativeStackNavigator<PaneParams>();

function VisitPane({
  holder,
  menu,
}: {
  holder: CardHolder;
  menu: (go: (task: SessionTask) => void) => ReactNode;
}) {
  const insets = useSafeAreaInsets();
  // The half this stack stands in; a form's card is narrower by its margins.
  const frame = useLayout();
  const cardFrame = {
    width: frame.width - GUTTER / 2 - GUTTER,
    height: frame.height,
  };
  return (
    <Pane.Navigator
      // See-through, so the page's own wash runs on under the menu: the
      // half is the same page, not a panel laid on it.
      screenOptions={({ route }) => ({
        headerShown: false,
        contentStyle: { backgroundColor: "transparent" },
        // The menu stands still; a form comes up from below over it, and
        // cannot be swiped away — it is closed by its own back button.
        animation: route.name === "Menu" ? "default" : "slide_from_bottom",
        gestureEnabled: false,
      })}
      screenLayout={({ children, navigation, route }) =>
        route.name === "Menu" ? (
          <ScreenFrame>
            <BlurStage navigation={navigation}>{children}</BlurStage>
          </ScreenFrame>
        ) : (
          /*
            A form rises over the menu as a card of its own, the way the
            visit plan's day card stands beside its calendar: Liquid Glass,
            rounded along the top, running down to the foot of the screen,
            no shadow, and only what is inside it scrolls. It is told it has no status bar
            to clear — the card already starts below it, and the form's own
            header would otherwise sit a status bar low in it — but it keeps
            the home bar, which it now runs down to.
          */
          <View
            style={{
              flex: 1,
              marginTop: insets.top + SPACE.sm,
              marginLeft: GUTTER / 2,
              marginRight: GUTTER,
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              overflow: "hidden",
            }}
          >
            {/* Apple's glass for the card's ground, laid behind the form
                rather than around it — the material tints whatever it
                holds, and the form's white cards should stay white. */}
            <Glass
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                borderTopLeftRadius: 32,
                borderTopRightRadius: 32,
              }}
            />
            <View style={{ flex: 1 }}>
              <SafeAreaInsetsContext.Provider
                value={{
                  top: SPACE.xs,
                  bottom: insets.bottom,
                  left: 0,
                  right: 0,
                }}
              >
                {/* A plain card: no blue wash along its top. And laid out
                    by the card's own width — measured by the half, a list
                    planned two columns that did not fit and fell to one
                    half-width column. */}
                <LayoutFrame.Provider value={cardFrame}>
                  <PlainHeaderContext.Provider value>
                    <ScreenFrame>
                      <BlurStage navigation={navigation}>{children}</BlurStage>
                    </ScreenFrame>
                  </PlainHeaderContext.Provider>
                </LayoutFrame.Provider>
              </SafeAreaInsetsContext.Provider>
            </View>
          </View>
        )
      }
    >
      <Pane.Screen name="Menu">
        {({ navigation }) => (
          <PaneMenu
            menu={menu}
            go={(task) =>
              openTaskForm(
                navigation.navigate as (route: string, params: object) => void,
                task,
                holder,
              )
            }
          />
        )}
      </Pane.Screen>
      <Pane.Screen name="HealthScreening" component={HealthScreeningScreen} />
      <Pane.Screen name="AssessmentList" component={AssessmentListScreen} />
      <Pane.Screen name="Diagnosis" component={DiagnosisScreen} />
      <Pane.Screen name="HomeVisit" component={HomeVisitScreen} />
      <Pane.Screen name="Medication" component={MedicationScreen} />
      <Pane.Screen name="Physio" component={PhysioScreen} />
      <Pane.Screen name="Questionnaire" component={QuestionnaireScreen} />
      <Pane.Screen name="Asthma" component={AsthmaScreen} />
      <Pane.Screen name="Dyspnea" component={DyspneaScreen} />
      <Pane.Screen name="Ncd" component={NcdScreen} />
      <Pane.Screen name="Screening35" component={Screening35Screen} />
    </Pane.Navigator>
  );
}

/** The pane's first page: the visit menu, scrolled on its own. */
function PaneMenu({
  menu,
  go,
}: {
  menu: (go: (task: SessionTask) => void) => ReactNode;
  go: (task: SessionTask) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      contentContainerStyle={{
        paddingLeft: GUTTER / 2,
        paddingRight: GUTTER,
        paddingTop: insets.top + 60,
        paddingBottom: insets.bottom + 96,
        gap: D.gap,
      }}
      showsVerticalScrollIndicator={false}
    >
      {menu(go)}
    </ScrollView>
  );
}

/** How far the divider between the halves can go, as a share of the width. */
const SHARE_MIN = 0.3;
const SHARE_MAX = 0.7;
/** Where the carer last left it, for the rest of the launch. */
let splitShare: number | null = null;

/** A list cut into rows of `n`. */
function chunk<T>(list: T[], n: number): T[][] {
  return Array.from({ length: Math.ceil(list.length / n) }, (_, i) =>
    list.slice(i * n, i * n + n),
  );
}

export function CommunityPatientScreen() {
  const {
    holder,
    room: roomKey,
    task: visit,
    detail,
  } = useRoute<RouteProp<RootStackParamList, "CommunityPatient">>().params;
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  /*
    A centred column on a tablet, and the task rows two to a line inside
    it: each is a title and a line under it, and one a row across the
    column left most of every card empty.
  */
  const { width, height, regular, landscape } = useLayout();
  /*
    A tablet held sideways splits the page: the patient on the left — who
    they are, their identifiers, the visit — and on the right the things
    the visit records, each half scrolling on its own. Down one column the
    menu sat a screen below the patient on a display wide enough for both.
  */
  // Either way up on a tablet — upright too, where the menu down one
  // column sat a screen under the patient just the same.
  const split = regular;
  // The patient takes a little under half, the menu the rest: the record
  // is read, the menu is worked through, and it is the menu's rows that
  // want the room.
  // Half and half upright, where 42% was too narrow for the record.
  //
  // Or wherever the carer has dragged the divider between them to — the
  // way iPad's own split view is resized — kept for the rest of the launch.
  const [dragged, setDragged] = useState<number | null>(splitShare);
  const share = dragged ?? (landscape ? 0.42 : 0.5);
  const patientW = Math.round(width * share);
  const menuW = width - patientW;
  const dividerFrom = useRef(share);
  /*
    The grip is faint until a finger is on it. Taken hold of, it springs up
    — taller, a touch wider, and darker — with a tick under the finger, and
    settles back when let go: a thing being held, rather than a line that
    changes colour.
  */
  const grip = useRef(new Animated.Value(0)).current;
  const hold = (on: boolean) => {
    if (on) feel("tick");
    Animated.spring(grip, {
      toValue: on ? 1 : 0,
      damping: on ? 12 : 18,
      stiffness: 260,
      mass: 0.8,
      useNativeDriver: false,
    }).start();
  };
  const live = useRef({ share, width });
  live.current = { share, width };
  const divider = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 2,
      onPanResponderGrant: () => {
        dividerFrom.current = live.current.share;
        hold(true);
      },
      onPanResponderRelease: () => hold(false),
      onPanResponderTerminate: () => hold(false),
      onPanResponderMove: (_e, g) => {
        const next = Math.min(
          SHARE_MAX,
          Math.max(SHARE_MIN, dividerFrom.current + g.dx / live.current.width),
        );
        splitShare = next;
        setDragged(next);
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;
  const columns = split ? 1 : columnsFor(Math.min(width, CONTENT_MAX));
  const rowWidth = cardWidth(
    Math.min(width, CONTENT_MAX) - GUTTER * 2,
    columns,
    D.gap,
  );

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

  const open = (task: SessionTask) =>
    openTaskForm(
      nav.navigate as (route: string, params: object) => void,
      task,
      holder,
    );

  const hasPhone = holder.phone != null && holder.phone !== "";

  /*
    How many identifiers go across the patient's card: two, as drawn, on a
    phone and a half-width pane; three once there is 620 points for them;
    four from 860.
  */
  const patientColumn =
    (split ? patientW - GUTTER * 1.5 : width - GUTTER * 2) - 32;
  const idCols = patientColumn >= 860 ? 4 : patientColumn >= 620 ? 3 : 2;
  const idFields: { label: string; value: string }[] = [
    { label: tr("เลขบัตรประชาชน", "National ID"), value: holder.citizenId },
    { label: "HN", value: holder.hn },
    holder.an != null
      ? { label: "AN", value: holder.an }
      : { label: "Authen Code", value: holder.authenCode },
    ...(holder.dischargeDate != null
      ? [
          {
            label: tr("วันจำหน่าย", "Discharge date"),
            value: holder.dischargeDate,
          },
        ]
      : []),
    { label: tr("สิทธิการรักษา", "Coverage"), value: holder.entitlement },
    ...(holder.referredBy != null
      ? [{ label: tr("ส่งเยี่ยมจาก", "Referred by"), value: holder.referredBy }]
      : []),
  ];

  const patientPart = (
    <>
      {/* Who is in front of you. */}
      <View style={{ alignItems: "center", marginBottom: SPACE.lg }}>
        {/* The patient's sex hangs off the avatar; their age rides after
            the name. */}
        <AvatarWithGender size={D.avatar} gender={holder.gender}>
          <Avatar size={D.avatar} initial={holder.name[0] ?? "?"} />
        </AvatarWithGender>
        <View style={{ marginTop: SPACE.lg }}>
          <NameWithAge
            name={tr(`คุณ ${holder.name}`, holder.name)}
            age={holder.age}
          />
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
        {/* Everything to do about this person without leaving the page, in
            one row under the condition: reach them, find them, and — where
            the visit came from a posting — the AI summary, then their past
            visits. On a tablet the last two are here rather than in the
            toolbar at the top, apart from the rest; a phone keeps them up
            there. */}
        {(hasPhone || split) && (
          <View
            style={{
              flexDirection: "row",
              gap: SPACE.sm,
              marginTop: SPACE.lg,
            }}
          >
            {hasPhone && (
              <>
                <ReachButton
                  icon={
                    <Phone size={22} color={PRIMARY_700} strokeWidth={2.2} />
                  }
                  label={tr("โทร", "Call")}
                  onPress={() =>
                    Linking.openURL(`tel:${holder.phone}`).catch(() =>
                      toast(
                        tr("โทรออกไม่ได้", "Couldn't place the call"),
                        "error",
                      ),
                    )
                  }
                />
                <ReachButton
                  icon={
                    <Video size={22} color={PRIMARY_700} strokeWidth={2.2} />
                  }
                  label={tr("วิดีโอคอล", "Video call")}
                  onPress={() =>
                    Linking.openURL(`facetime://${holder.phone}`).catch(() =>
                      toast(
                        tr("วิดีโอคอลไม่ได้", "Couldn't start the video call"),
                        "error",
                      ),
                    )
                  }
                />
              </>
            )}
            {/* The address: on the app's own map where the visit has a
              pin, otherwise handed to Maps as a search. */}
            {visit != null && (visit.address != null || hasLocation(visit)) && (
              <ReachButton
                icon={
                  <MapPin size={22} color={PRIMARY_700} strokeWidth={2.2} />
                }
                label={tr("ที่อยู่", "Address")}
                onPress={() => {
                  if (hasLocation(visit))
                    nav.navigate("ExploreMap", { focus: visit });
                  else
                    Linking.openURL(
                      `maps://?q=${encodeURIComponent(visit.address ?? "")}`,
                    ).catch(() =>
                      toast(
                        tr("เปิดแอพแผนที่ไม่ได้", "Couldn't open the maps app"),
                        "error",
                      ),
                    );
                }}
              />
            )}
            {split && visit != null && detail != null && (
              <ReachButton
                icon={<UIcon name="magicWand" size={22} color={PRIMARY_700} />}
                label={tr("สรุปข้อมูลผู้ป่วยด้วย AI", "AI patient summary")}
                onPress={() => setBriefing(true)}
              />
            )}
            {/* The assistant, opened over this page — and so about this
                patient without her name (see assistantFocus). */}
            {split && (
              <ReachButton
                icon={<UIcon name="sparkles" size={22} color={PRIMARY_700} />}
                label={tr("ถามผู้ช่วยเรื่องผู้ป่วยรายนี้", "Ask the assistant")}
                onPress={() => nav.navigate("Assistant")}
              />
            )}
            {split && (
              <ReachButton
                icon={
                  <History size={22} color={PRIMARY_700} strokeWidth={2.2} />
                }
                label={tr("ประวัติการรักษา", "Treatment history")}
                onPress={() =>
                  nav.navigate("TreatmentHistory", {
                    hn: holder.hn,
                    name: tr(`คุณ ${holder.name}`, holder.name),
                  })
                }
              />
            )}
          </View>
        )}
      </View>

      {/* The four identifiers, two to a row with a rule between — Figma's
        own Frame 22. */}
      <Card>
        {idCols <= 2 ? (
          <>
            <Field
              label={tr("เลขบัตรประชาชน", "National ID")}
              value={holder.citizenId}
            />
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
                <Field
                  label={tr("วันจำหน่าย", "Discharge date")}
                  value={holder.dischargeDate}
                />
              )}
              <Field
                label={tr("สิทธิการรักษา", "Coverage")}
                value={holder.entitlement}
              />
            </View>
            {holder.referredBy != null && (
              <>
                <Rule />
                <Field
                  label={tr("ส่งเยี่ยมจาก", "Referred by")}
                  value={holder.referredBy}
                />
              </>
            )}
          </>
        ) : (
          /*
            Where the patient's half is wide enough — the divider dragged
            over, or a big iPad — the identifiers run three or four to a
            row, in the same order, with a rule between rows.
          */
          chunk(idFields, idCols).map((row, i) => (
            <View key={i}>
              {i > 0 && <Rule />}
              <View style={{ flexDirection: "row", gap: SPACE.md }}>
                {row.map((f) => (
                  <Field key={f.label} label={f.label} value={f.value} />
                ))}
                {Array.from({ length: idCols - row.length }, (_, k) => (
                  <View key={`gap-${k}`} style={{ flex: 1 }} />
                ))}
              </View>
            </View>
          ))
        )}

        {!split &&
          (detail != null || allergies.length > 0 || conditions.length > 0) && (
            <>
              <View style={{ height: SPACE.md }} />
              {/* The way to the rest of the record, as a row: the allergy
              count rides along on its red pill, because that is the one
              thing in there a carer must not miss. */}
              <Pressable
                onPress={() => setInfo(true)}
                accessibilityRole="button"
                accessibilityLabel={tr(
                  "ดูข้อมูลผู้ป่วยเพิ่มเติม",
                  "More patient information",
                )}
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
                  {tr("ข้อมูลผู้ป่วยเพิ่มเติม", "More patient information")}
                </Text>
                {allergies.length > 0 && (
                  <StatusTag
                    label={tr(
                      `แพ้ ${allergies.length} รายการ`,
                      `${allergies.length} allerg${allergies.length === 1 ? "y" : "ies"}`,
                    )}
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
          {/* What kind of appointment it is, and what for, over when —
            the two things the carer arrives knowing. */}
          {visit.visitType != null && (
            <>
              <View style={{ flexDirection: "row" }}>
                <Field
                  label={tr("ประเภทการเยี่ยม", "Visit type")}
                  value={visitTypeLabel(visit.visitType)}
                />
              </View>
              <Rule />
            </>
          )}
          <View style={{ flexDirection: "row" }}>
            <Field
              label={tr("ภารกิจ", "Task")}
              value={visit.detail}
              lines={3}
            />
          </View>
          <Rule />
          <Field
            label={tr("วันที่เยี่ยม", "Visit date")}
            value={thaiDateTime(visit.dueAt)}
          />
        </Card>
      )}
      {/* The rest of the record, laid out rather than behind a tap, where
          the half-page has the room for it. */}
      {split && (
        <PatientInfoContent
          allergies={allergies}
          conditions={conditions}
          detail={detail}
        />
      )}
    </>
  );

  const tasksList = (go: (task: SessionTask) => void) => (
    <>
      {/* The three things a session can record, in the shape the
        assessment list one screen on gives its rows — title and the
        chevron disc on one line, the detail under — with the row's
        picture in the left slot. The pictures are the current set; the
        redrawn ones drop into the same slot. */}
      <View
        style={[
          { gap: D.gap },
          columns > 1 && { flexDirection: "row", flexWrap: "wrap" },
        ]}
      >
        {tasks.map((t) => {
          const held = records[t.key];
          const soon = SOON.has(t.key);
          const preview = held != null ? summarise(t.key, held) : "";
          return (
            <Card
              key={t.key}
              onPress={() => go(t.key)}
              accessibilityLabel={t.label}
              style={columns > 1 ? { width: rowWidth } : undefined}
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
                          {tr("ยังไม่เปิดใช้งาน", "Coming soon")}
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
                          {tr("บันทึกแล้ว", "Saved")}
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
      </View>
    </>
  );

  const closeBar = Object.keys(records).length > 0 && (
    <ActionBar>
      <PrimaryAction
        // What the carer is doing when they press it: the visit is over,
        // everything recorded on it is kept, and the case is closed.
        // "เสร็จสิ้นการตรวจ" named an examination, which is one of the
        // five things on this page rather than the whole of it.
        label={tr("บันทึกและปิดเคส", "Save and close case")}
        onPress={() => {
          toast(tr("บันทึกและปิดเคสแล้ว", "Saved and case closed"), "success");
          // Back to whatever opened the visit — the plan, the profile,
          // the posting, the services page — not to the root, which
          // threw the carer out of wherever they were working from.
          // The recording screens are above this one and already
          // closed, so one step back is the page before the visit.
          if (nav.canGoBack()) nav.goBack();
          else nav.popToTop();
        }}
      />
    </ActionBar>
  );

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
          left: GUTTER,
          zIndex: 2,
        }}
      >
        <GlassIconButton
          onPress={() => nav.goBack()}
          accessibilityLabel={tr("ปิดการตรวจ", "Close visit")}
        >
          <ChevronLeft size={24} color={TEXT_PRIMARY} strokeWidth={2.4} />
        </GlassIconButton>
      </View>

      {/* The AI brief and the history, in the corner opposite the back
          button — on a phone. A tablet has them in the row under the
          patient's condition instead (see the patient part). */}
      {!split && (
        <View
          style={{
            position: "absolute",
            top: insets.top + SPACE.sm,
            right: GUTTER,
            zIndex: 2,
          }}
        >
          <ToolbarPill
            slots={[
              ...(visit != null && detail != null
                ? [
                    {
                      icon: (
                        <UIcon
                          name="magicWand"
                          size={20}
                          color={TEXT_PRIMARY}
                        />
                      ),
                      label: tr(
                        "สรุปข้อมูลผู้ป่วยด้วย AI",
                        "AI patient summary",
                      ),
                      onPress: () => setBriefing(true),
                    },
                  ]
                : []),
              {
                icon: (
                  <UIcon name="sparkles" size={20} color={TEXT_PRIMARY} />
                ),
                label: tr("ถามผู้ช่วยเรื่องผู้ป่วยรายนี้", "Ask the assistant"),
                onPress: () => nav.navigate("Assistant"),
              },
              {
                icon: (
                  <History size={20} color={TEXT_PRIMARY} strokeWidth={2.2} />
                ),
                label: tr("ประวัติการรักษา", "Treatment history"),
                onPress: () =>
                  nav.navigate("TreatmentHistory", {
                    hn: holder.hn,
                    name: tr(`คุณ ${holder.name}`, holder.name),
                  }),
              },
            ]}
          />
        </View>
      )}

      {/* The cards dissolve as they rise behind the floating buttons —
          gone under the status bar, half there behind the glass so it has
          something to refract, whole below. */}
      {split ? (
        <View style={{ flex: 1, flexDirection: "row" }}>
          {/* The divider: a grip standing on the line between the halves,
              in a strip wide enough for a finger. Drag it to give either
              side more room. */}
          <View
            {...divider.panHandlers}
            accessibilityRole="adjustable"
            accessibilityLabel={tr("ปรับขนาดสองฝั่ง", "Resize the two sides")}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: patientW - 14,
              width: 28,
              zIndex: 10,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Animated.View
              style={{
                width: grip.interpolate({
                  inputRange: [0, 1],
                  outputRange: [5, 7],
                }),
                height: grip.interpolate({
                  inputRange: [0, 1],
                  outputRange: [48, 76],
                }),
                borderRadius: 4,
                backgroundColor: grip.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["rgba(60,60,67,0.12)", "rgba(60,60,67,0.45)"],
                }),
              }}
            />
          </View>
          {/* The patient, to read. The page's margin at the screen's edge,
              half of it at the middle — the two halves together make one
              GUTTER between them. The case is closed from here too. */}
          <View style={{ width: patientW }}>
            <HeaderFade
              from={insets.top - 4}
              to={insets.top + TOUCH_MIN + SPACE.lg}
            >
              <ScrollView
                contentContainerStyle={{
                  paddingLeft: GUTTER,
                  paddingRight: GUTTER / 2,
                  paddingTop: insets.top + 60,
                  paddingBottom: insets.bottom + 96,
                  gap: D.gap,
                }}
                showsVerticalScrollIndicator={false}
              >
                {patientPart}
              </ScrollView>
            </HeaderFade>
            {closeBar}
          </View>
          {/*
            The work, beside it: a page stack of its own. The menu is its
            first page, and a row opens that form in this half — so the
            record stays open to read while it is written up, and the form's
            back button comes back to the menu rather than leaving the
            patient. Everything in it measures itself by this half, not the
            screen.
          */}
          <View style={{ width: menuW }}>
            <LayoutFrame.Provider value={{ width: menuW, height }}>
              <VisitPane
                holder={holder}
                menu={(go) => (
                  <>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: TEXT_PRIMARY,
                        marginBottom: SPACE.xs,
                      }}
                    >
                      {tr("บันทึกการเยี่ยม", "Visit record")}
                    </Text>
                    {tasksList(go)}
                  </>
                )}
              />
            </LayoutFrame.Provider>
          </View>
        </View>
      ) : (
        <HeaderFade
          from={insets.top - 4}
          to={insets.top + TOUCH_MIN + SPACE.lg}
        >
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: GUTTER,
              paddingTop: insets.top + 60,
              paddingBottom: insets.bottom + 96,
              gap: D.gap,
            }}
            showsVerticalScrollIndicator={false}
          >
            {patientPart}
            {tasksList(open)}
          </ScrollView>
        </HeaderFade>
      )}

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

      {!split && closeBar}
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
            paddingHorizontal: GUTTER,
            paddingTop: SPACE.lg,
          }}
        >
          <GlassIconButton
            onPress={onClose}
            accessibilityLabel={tr("ปิด", "Close")}
          >
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
            {tr("ข้อมูลสุขภาพผู้ป่วย", "Patient health information")}
          </Text>
          <View style={{ width: 44 }} />
        </View>
        <ScrollView
          contentContainerStyle={{
            paddingVertical: SPACE.lg,
            paddingHorizontal: GUTTER,
            gap: SPACE.md,
            paddingBottom: insets.bottom + SPACE.xl,
            ...readable(),
          }}
          showsVerticalScrollIndicator={false}
        >
          <PatientInfoContent
            allergies={allergies}
            conditions={conditions}
            detail={detail}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

/**
 * The patient's allergies, conditions and — where the page came from a
 * visit — the whole record: the more-information sheet's contents, and
 * the left half of a landscape iPad's page, which has the room to show
 * them without a tap.
 */
function PatientInfoContent({
  allergies,
  conditions,
  detail,
}: {
  allergies: string[];
  conditions: string[];
  detail?: PatientDetail;
}) {
  return (
    <>
      {/* The chips only where there is no full record below: it
          carries its own allergy and condition lines. */}
      {detail == null && allergies.length > 0 && (
        <InfoPanel
          icon={<TriangleAlert size={16} color={DANGER} strokeWidth={2.4} />}
          iconTint={DANGER}
          label={tr("แพ้ยา / แพ้อาหาร", "Drug / food allergies")}
          items={allergies}
          chipColor={DANGER_INK}
        />
      )}
      {detail == null && conditions.length > 0 && (
        <InfoPanel
          icon={<HeartPulse size={16} color={PRIMARY_500} strokeWidth={2.4} />}
          iconTint={PRIMARY_500}
          label={tr("โรคประจำตัว", "Chronic conditions")}
          items={conditions}
          chipColor={TEXT_PRIMARY}
        />
      )}

      {/* The whole record, as the posting showed it. */}
      {detail != null && <PatientRecordCards detail={detail} />}
    </>
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

function Field({
  label,
  value,
  lines = 1,
}: {
  label: string;
  value: string;
  /** How many lines the value may take — one for an identifier. */
  lines?: number;
}) {
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
      <Text
        numberOfLines={1}
        style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}
      >
        {label}
      </Text>
      <Text
        numberOfLines={lines}
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
