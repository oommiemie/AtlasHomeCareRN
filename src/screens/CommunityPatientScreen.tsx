import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
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
  NavigationContext,
  NavigationRouteContext,
  CommonActions,
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { BlurStage } from "../components/BlurStage";
import { ScreenFrame } from "../components/ScreenFrame";
import { Glass } from "../components/Glass";
import { NoBackContext, PlainHeaderContext } from "../components/ScreenHeader";
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
import { AssistantScreen } from "./AssistantScreen";
import { OpenChildContext } from "../components/PostnatalForm";
import { useFormOpener } from "../models/formBridge";
import {
  MinimizedDock,
  SectionWindow,
  WindowMenu,
  type Frame,
  type WindowAction,
  type WindowMode,
} from "../components/SectionWindow";

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
  Baby,
  ChevronLeft,
  ClipboardList,
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
  SURFACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TOUCH_MIN,
  TYPE,
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
  selected,
  onIdle,
  width,
  height,
  bottomInset,
}: {
  holder: CardHolder;
  /** The card it runs in — a docked column, the whole screen, or a window. */
  width: number;
  height: number;
  /** The home bar, where the card runs down to the foot of the screen. */
  bottomInset: number;
  /** The record picked in the menu on the left; its form is what shows here. */
  selected: SessionTask | null;
  /** The form was closed — saved. */
  onIdle: () => void;
}) {
  /*
    Every form keeps the page's margin (GUTTER, 24 on a tablet) inside its
    own edges, and inside a card that is a second margin on top of the
    card's: the form's boxes sat 24 in from a glass edge that was already a
    margin in from the screen. The form is laid a little wider than the
    card and the card clips it, so what it keeps is CARD_INSET.
  */
  const bleed = GUTTER - CARD_INSET;
  const cardFrame = { width: width + bleed * 2, height };
  return (
    <Pane.Navigator
      // See-through, so the page's own wash runs on under the menu: the
      // half is the same page, not a panel laid on it.
      screenOptions={({ route }) => ({
        headerShown: false,
        contentStyle: { backgroundColor: "transparent" },
        // A record's form fades in where the last one was.
        animation: route.name === "Menu" ? "default" : "fade",
        animationDuration: 220,
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
          <View style={{ flex: 1, overflow: "hidden" }}>
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
              }}
            />
            <View style={{ flex: 1, marginHorizontal: -bleed }}>
              <SafeAreaInsetsContext.Provider
                value={{
                  top: SPACE.xs,
                  bottom: bottomInset,
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
                    {/* A record's own form has no way back — another is
                        picked on the left instead; the pages it opens keep
                        theirs. */}
                    <NoBackContext.Provider value={TAB_ROOTS.has(route.name)}>
                      <ScreenFrame>
                        <BlurStage navigation={navigation}>
                          {children}
                        </BlurStage>
                      </ScreenFrame>
                    </NoBackContext.Provider>
                  </PlainHeaderContext.Provider>
                </LayoutFrame.Provider>
              </SafeAreaInsetsContext.Provider>
            </View>
          </View>
        )
      }
    >
      <Pane.Screen name="Menu">
        {({ navigation, route }) => (
          <PaneIdle
            selected={selected}
            onIdle={onIdle}
            navigation={navigation}
            menuKey={route.key}
            holder={holder}
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

/** The pages a record opens on: the forms named in TASK_ROUTE. */
const TAB_ROOTS = new Set<string>(
  Object.values(TASK_ROUTE).filter((r) => r != null),
);

/**
 * The pane's first page, under every form: what shows when no record is
 * open, and what opens them. A record picked on the left replaces whatever
 * form is up with its own; a form saved comes back down to here, and the
 * record on the left lets go.
 */
function PaneIdle({
  selected,
  onIdle,
  navigation,
  menuKey,
  holder,
}: {
  selected: SessionTask | null;
  onIdle: () => void;
  navigation: {
    dispatch: (action: object) => void;
    addListener: (e: "focus" | "blur", cb: () => void) => () => void;
  };
  menuKey: string;
  holder: CardHolder;
}) {
  const idle = useRef(onIdle);
  idle.current = onIdle;
  useEffect(() => {
    if (selected == null) return;
    const route = TASK_ROUTE[selected];
    if (route == null) return;
    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [
          { key: menuKey, name: "Menu" },
          { name: route, params: { holder } },
        ],
      }),
    );
    // Only a newly picked record opens a form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  // Back on this page after a form was up: the form was closed.
  useEffect(() => {
    let away = false;
    const offBlur = navigation.addListener("blur", () => {
      away = true;
    });
    const offFocus = navigation.addListener("focus", () => {
      if (away) idle.current();
      away = false;
    });
    return () => {
      offBlur();
      offFocus();
    };
  }, [navigation]);
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: SPACE.lg,
      }}
    >
      <Text style={{ ...TYPE.subheadline, color: TEXT_MUTED }}>
        {tr(
          "เลือกรายการบันทึกทางซ้ายเพื่อเริ่ม",
          "Pick a record on the left to start",
        )}
      </Text>
    </View>
  );
}

/**
 * The gap between two columns of the tablet page — half on each side. The
 * screen's own edge keeps its GUTTER; between columns, 24 read as three
 * separate pages rather than one.
 */
const COL_GAP = 12;
/** How far a form in a card keeps its boxes from the card's edge. */
const CARD_INSET = 12;
const HALF_GAP = COL_GAP / 2;

/** The sections beside the patient: the record, the AI, and a child's record. */
type SectionKey = "form" | "ai" | "child";

/** Where a section put away or shown full goes back to. */
function restoreTo(m: WindowMode): WindowMode {
  return m === "min" || m === "full" ? "docked" : m;
}

/** How far the divider between the halves can go, as a share of the width. */
const SHARE_MIN = 0.3;
const SHARE_MAX = 0.7;
/** Where the carer last left it, for the rest of the launch. */
let splitShare: number | null = null;
/** The same with the AI open, and the AI column's width. */
let splitShareAi: number | null = null;
let aiWidthKept: number | null = null;
/** The patient's column, at its narrowest with the AI beside the work. */
const SHARE_MIN_AI = 0.22;
/** The AI column at its narrowest, and the record in the middle at its. */
const AI_MIN = 280;
const FORM_MIN = 320;

/**
 * The grip on a divider: faint until a finger is on it, then taller, a
 * touch wider and darker, settling back when let go.
 */
function Grip({ t }: { t: Animated.Value }) {
  return (
    <Animated.View
      style={{
        width: t.interpolate({ inputRange: [0, 1], outputRange: [5, 7] }),
        height: t.interpolate({ inputRange: [0, 1], outputRange: [48, 76] }),
        borderRadius: 4,
        backgroundColor: t.interpolate({
          inputRange: [0, 1],
          outputRange: ["rgba(60,60,67,0.12)", "rgba(60,60,67,0.45)"],
        }),
      }}
    />
  );
}

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
  /*
    The AI assistant, as a third column at the right when it is open: the
    patient's column gives up the room for it, so the record being written
    in the middle keeps a usable width.
  */
  const [ai, setAi] = useState(false);
  /*
    A newborn's record, opened from the mother's postnatal form: a window
    of its own over the page — the mother's form stays as it was beside it
    — that can go full screen or be put away like the others. It never
    docks: the page's columns are the mother's.
  */
  const [child, setChild] = useState<CardHolder | null>(null);
  /*
    The sections beside the patient — the record being written, and the AI
    — behave as windows (see SectionWindow): docked in the page, alone
    across the screen, floating, or put away. `order` is which side of the
    other each docks on; `before` is where one goes back to.
  */
  const [order, setOrder] = useState<SectionKey[]>(["form", "ai", "child"]);
  const [modes, setModes] = useState<Record<SectionKey, WindowMode>>({
    form: "docked",
    ai: "docked",
    child: "docked",
  });
  const before = useRef<Record<SectionKey, WindowMode>>({
    form: "docked",
    ai: "docked",
    child: "docked",
  });
  const [wins, setWins] = useState<Partial<Record<SectionKey, Frame>>>({});
  const [menuFor, setMenuFor] = useState<SectionKey | null>(null);
  const [frontWin, setFrontWin] = useState<SectionKey>("form");
  // Closing, the AI is kept while it slides off the edge, the others
  // already taking its room.
  const [aiLeaving, setAiLeaving] = useState(false);
  const aiDocked = ai && !aiLeaving && modes.ai === "docked";
  // Both are the carer's to drag while it is open, as the halves are
  // without it: where the patient's column ends, and how wide the AI is.
  // Each is kept for the rest of the launch, apart from the two-column one.
  const [draggedAi, setDraggedAi] = useState<number | null>(splitShareAi);
  const [aiWidth, setAiWidth] = useState<number | null>(aiWidthKept);
  const aiW = aiDocked ? (aiWidth ?? (landscape ? 380 : 300)) : 0;
  // The child's record as a column at the right, at a width of its own.
  const [childWidth, setChildWidth] = useState<number | null>(null);
  const childDocked = child != null && modes.child === "docked";
  const childW = childDocked ? (childWidth ?? (landscape ? 420 : 340)) : 0;
  const share =
    aiDocked || childDocked
      ? (draggedAi ?? (landscape ? 0.3 : 0.34))
      : (dragged ?? (landscape ? 0.42 : 0.5));
  const patientW = Math.round(width * share);
  const dividerFrom = useRef(share);
  // A divider under a finger: what follows it does so without easing.
  const dividerHeld = useRef(false);
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
  // Which side of the record the AI docks on, for the second divider.
  const aiRight = order.indexOf("ai") > order.indexOf("form");
  // Which side of its divider each fixed column is on, set as the dividers
  // are drawn: one on the right of its divider grows as it is dragged left.
  const colSide = useRef<Record<"ai" | "child", "left" | "right">>({
    ai: "right",
    child: "right",
  });
  const live = useRef({
    share,
    width,
    ai: aiDocked || childDocked,
    aiW,
    childW,
    patientW,
    aiRight,
  });
  live.current = {
    share,
    width,
    ai: aiDocked || childDocked,
    aiW,
    childW,
    patientW,
    aiRight,
  };
  const divider = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 2,
      onPanResponderGrant: () => {
        dividerFrom.current = live.current.share;
        dividerHeld.current = true;
        hold(true);
      },
      onPanResponderRelease: () => {
        dividerHeld.current = false;
        hold(false);
      },
      onPanResponderTerminate: () => {
        dividerHeld.current = false;
        hold(false);
      },
      onPanResponderMove: (_e, g) => {
        const l = live.current;
        // With the AI open, the record in the middle keeps its floor.
        const max = l.ai
          ? Math.min(
              SHARE_MAX,
              (l.width - l.aiW - l.childW - FORM_MIN) / l.width,
            )
          : SHARE_MAX;
        const min = l.ai ? SHARE_MIN_AI : SHARE_MIN;
        const next = Math.min(
          max,
          Math.max(min, dividerFrom.current + g.dx / l.width),
        );
        if (l.ai) {
          splitShareAi = next;
          setDraggedAi(next);
        } else {
          splitShare = next;
          setDragged(next);
        }
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;
  // The second divider, between the record and the AI: drawn the same,
  // and dragged left to give the AI more room.
  const grip2 = useRef(new Animated.Value(0)).current;
  const hold2 = (on: boolean) => {
    if (on) feel("tick");
    Animated.spring(grip2, {
      toValue: on ? 1 : 0,
      damping: on ? 12 : 18,
      stiffness: 260,
      mass: 0.8,
      useNativeDriver: false,
    }).start();
  };
  const aiFrom = useRef(aiW);
  const divider2 = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 2,
      onPanResponderGrant: () => {
        aiFrom.current = live.current.aiW;
        hold2(true);
      },
      onPanResponderRelease: () => hold2(false),
      onPanResponderTerminate: () => hold2(false),
      onPanResponderMove: (_e, g) => {
        const l = live.current;
        // Dragged towards the record, the AI grows — leftward when it
        // docks on the right, rightward when on the left.
        const next = Math.min(
          l.width - l.patientW - l.childW - FORM_MIN,
          Math.max(
            AI_MIN,
            aiFrom.current + (colSide.current.ai === "right" ? -g.dx : g.dx),
          ),
        );
        aiWidthKept = next;
        setAiWidth(next);
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  // And the child's column, the same.
  const grip3 = useRef(new Animated.Value(0)).current;
  const hold3 = (on: boolean) => {
    if (on) feel("tick");
    Animated.spring(grip3, {
      toValue: on ? 1 : 0,
      damping: on ? 12 : 18,
      stiffness: 260,
      mass: 0.8,
      useNativeDriver: false,
    }).start();
  };
  const childFrom = useRef(childW);
  const divider3 = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 2,
      onPanResponderGrant: () => {
        childFrom.current = live.current.childW;
        hold3(true);
      },
      onPanResponderRelease: () => hold3(false),
      onPanResponderTerminate: () => hold3(false),
      onPanResponderMove: (_e, g) => {
        const l = live.current;
        setChildWidth(
          Math.min(
            l.width - l.patientW - l.aiW - FORM_MIN,
            Math.max(
              AI_MIN,
              childFrom.current +
                (colSide.current.child === "right" ? -g.dx : g.dx),
            ),
          ),
        );
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
  /*
    The AI, in one place: the assistant, opened on this patient's summary
    when the page came from a visit with a record behind it, so the carer
    reads it and goes on to ask whatever is next about her in the same
    conversation.
  */
  const [assistantBrief] = useState(() =>
    visit != null && detail != null
      ? { task: visit, detail, lastVisit: treatmentHistory(holder.hn)[0] }
      : undefined,
  );
  // On a tablet it opens beside the work, in the page; a phone has no room
  // beside anything, and goes to the assistant's own page.
  const openAssistant = () => {
    feel("tick");
    if (split) {
      if (!ai) {
        setModes((m) => ({ ...m, ai: "docked" }));
        setAi(true);
      } else if (modes.ai === "min") {
        setModes((m) => ({ ...m, ai: restoreTo(before.current.ai) }));
      } else closeAi();
    } else
      nav.navigate(
        "Assistant",
        assistantBrief != null ? { brief: assistantBrief } : undefined,
      );
  };
  const records = useSessionRecords(holder.authenCode);

  const open = (task: SessionTask) =>
    openTaskForm(
      nav.navigate as (route: string, params: object) => void,
      task,
      holder,
    );

  /*
    On a tablet the menu of records sits under the patient, and the one
    picked is open on the right. The first that can be recorded is open
    from the start, so the page arrives ready to write in.
  */
  const [selected, setSelected] = useState<SessionTask | null>(() =>
    split
      ? (tasks.find((t) => TASK_ROUTE[t.key] != null && !SOON.has(t.key))
          ?.key ?? null)
      : null,
  );
  const pick = (task: SessionTask) => {
    // One not open yet says so, and leaves the pick where it was.
    if (TASK_ROUTE[task] == null || SOON.has(task)) {
      toast(tr("ยังไม่เปิดใช้งาน", "Not available yet"));
      return;
    }
    feel("tick");
    setSelected(task);
  };

  // Readings said to the assistant with no form open open the one they are
  // for — unless another record is open, which is not switched away from
  // with whatever is typed in it.
  useFormOpener((kind, asked) => {
    const k = kind as SessionTask;
    if (!tasks.some((t) => t.key === k) || TASK_ROUTE[k] == null || SOON.has(k))
      return "unavailable";
    // A phone has no column for it: the record opens as its own page, over
    // the assistant's.
    if (!split) {
      open(k);
      return "opened";
    }
    if (!asked && selected != null && selected !== k) return "busy";
    // Put away or under another shown full, it is brought back to be seen.
    if (modes.form === "min" || (ai && modes.ai === "full"))
      setModes((m) => ({
        ...m,
        form: m.form === "min" ? restoreTo(before.current.form) : m.form,
        ai: m.ai === "full" ? "docked" : m.ai,
      }));
    feel("tick");
    setSelected(k);
    return "opened";
  });

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

  // The way to the rest of the record, as a row: the allergy count rides
  // along on its red pill, because that is the one thing in there a
  // carer must not miss.
  const moreRow = (
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
        minHeight: 44,
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
          ...TYPE.subheadline,
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
      <ChevronRight size={16} color={TEXT_SECONDARY} strokeWidth={2.4} />
    </Pressable>
  );

  const idCard = (
    <>
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
              {moreRow}
            </>
          )}
      </Card>
    </>
  );

  const visitCard = (
    <>
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
    </>
  );

  const summaryCard = (
    <>
      {/*
        On a tablet, the summary: who they are on paper, what the visit is,
        and the way to everything else. The whole record — every identifier,
        the visit in full, the clinical cards — opens from the row at its
        foot, so the menu of records fits under it in the same column.
      */}
      <View style={{ flexDirection: "row", gap: SPACE.md }}>
        <Field label="HN" value={holder.hn} />
        {holder.an != null ? (
          <Field label="AN" value={holder.an} />
        ) : (
          <Field label="Authen Code" value={holder.authenCode} />
        )}
        <Field
          label={tr("สิทธิการรักษา", "Coverage")}
          value={holder.entitlement}
        />
      </View>
      {visit != null && (
        <>
          <Rule />
          <View style={{ flexDirection: "row", gap: SPACE.md }}>
            {visit.visitType != null && (
              <Field
                label={tr("ประเภทการเยี่ยม", "Visit type")}
                value={visitTypeLabel(visit.visitType)}
              />
            )}
            <Field
              label={tr("วันที่เยี่ยม", "Visit date")}
              value={thaiDateTime(visit.dueAt)}
            />
          </View>
          <Rule />
          <Field label={tr("ภารกิจ", "Task")} value={visit.detail} lines={2} />
        </>
      )}
      <View style={{ height: SPACE.lg }} />
      {moreRow}
    </>
  );

  // Everything to do about this person without leaving the page: reach
  // them, find them, and — where the visit came from a posting — the AI
  // summary, then their past visits.
  const reachButtons = (
    <>
      {hasPhone && (
        <>
          <ReachButton
            icon={<Phone size={22} color={PRIMARY_700} strokeWidth={2.2} />}
            label={tr("โทร", "Call")}
            onPress={() =>
              Linking.openURL(`tel:${holder.phone}`).catch(() =>
                toast(tr("โทรออกไม่ได้", "Couldn't place the call"), "error"),
              )
            }
          />
          <ReachButton
            icon={<Video size={22} color={PRIMARY_700} strokeWidth={2.2} />}
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
          icon={<MapPin size={22} color={PRIMARY_700} strokeWidth={2.2} />}
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
      {/* The assistant, opened over this page — and so about this
                patient without her name (see assistantFocus). */}
      {split && (
        <ReachButton
          icon={
            <UIcon
              name="sparkles"
              size={22}
              color={ai ? "#FFFFFF" : PRIMARY_700}
            />
          }
          label={tr(
            "สรุปและถามผู้ช่วย AI เรื่องผู้ป่วยรายนี้",
            "AI summary and assistant for this patient",
          )}
          onPress={openAssistant}
          active={ai}
        />
      )}
      {split && (
        <ReachButton
          icon={<History size={22} color={PRIMARY_700} strokeWidth={2.2} />}
          label={tr("ประวัติการรักษา", "Treatment history")}
          onPress={() =>
            nav.navigate("TreatmentHistory", {
              hn: holder.hn,
              name: tr(`คุณ ${holder.name}`, holder.name),
            })
          }
        />
      )}
    </>
  );

  const patientPart = (
    <>
      {/* Who is in front of you. */}
      <View
        style={{
          alignItems: "center",
          // Tighter on a tablet, where the menu of records follows in the
          // same column.
          marginBottom: split ? SPACE.xs : SPACE.lg,
        }}
      >
        {/* The patient's sex hangs off the avatar; their age rides after
            the name. */}
        <AvatarWithGender size={D.avatar} gender={holder.gender}>
          <Avatar size={D.avatar} initial={holder.name[0] ?? "?"} />
        </AvatarWithGender>
        <View style={{ marginTop: split ? SPACE.sm : SPACE.lg }}>
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
              ...TYPE.subheadline,
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
              ...TYPE.subheadline,
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
              gap: split ? SPACE.md : SPACE.sm,
              marginTop: split ? SPACE.md : SPACE.lg,
            }}
          >
            {reachButtons}
          </View>
        )}
      </View>

      {split ? (
        <Card>{summaryCard}</Card>
      ) : (
        <>
          {idCard}
          {visitCard}
        </>
      )}
    </>
  );

  const tasksList = (
    go: (task: SessionTask) => void,
    current: SessionTask | null = null,
  ) => (
    <>
      {/* The three things a session can record, in the shape the
        assessment list one screen on gives its rows — title and the
        chevron disc on one line, the detail under — with the row's
        picture in the left slot. The pictures are the current set; the
        redrawn ones drop into the same slot. */}
      <View
        style={[
          { gap: split ? SPACE.sm : D.gap },
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
              style={[
                columns > 1 && { width: rowWidth },
                // On a tablet, the one open on the right: the brand's tint
                // and its edge. Every row carries the edge, clear when not
                // picked, so picking one shifts nothing.
                split && {
                  borderWidth: 1.5,
                  borderColor: current === t.key ? PRIMARY_500 : "transparent",
                },
                current === t.key && { backgroundColor: PRIMARY_100 },
              ]}
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
                        ...TYPE.headline,
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
                            ...TYPE.caption2,
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
                            ...TYPE.caption1,
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
                        ...TYPE.subheadline,
                        color: TEXT_PRIMARY,
                      }}
                    >
                      {preview}
                    </Text>
                  ) : (
                    <Text
                      numberOfLines={2}
                      style={{
                        ...TYPE.subheadline,
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

  /*
    The records on a tablet, a box each — the picture and the name, without
    the line of detail under it that took the column a screen deep. What is
    saved carries its tick; the one open on the right is lit.
  */
  const recordMenu = (
    <View style={{ gap: SPACE.sm }}>
      {tasks.map((t) => {
        const on = selected === t.key;
        const soon = SOON.has(t.key);
        const held = records[t.key] != null;
        return (
          <Pressable
            key={t.key}
            onPress={() => pick(t.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.label}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.md,
              minHeight: 56,
              paddingHorizontal: SPACE.lg,
              borderRadius: RADIUS.lg + 2,
              // Every box carries the edge, clear when not picked, so
              // picking one shifts nothing.
              borderWidth: 1.5,
              borderColor: on ? PRIMARY_500 : "transparent",
              backgroundColor: on ? PRIMARY_100 : SURFACE,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Image
              source={TASK_ART[t.key]}
              style={{ width: 28, height: 28, opacity: soon ? 0.45 : 1 }}
              resizeMode="contain"
              accessibilityRole="none"
            />
            <Text
              numberOfLines={1}
              style={{
                ...TYPE.bodyText,
                flex: 1,
                fontWeight: on ? "600" : "500",
                color: soon ? TEXT_MUTED : on ? PRIMARY_500 : TEXT_PRIMARY,
              }}
            >
              {t.label}
            </Text>
            {soon ? (
              <Text style={{ ...TYPE.footnote, color: TEXT_MUTED }}>
                {tr("ยังไม่เปิดใช้งาน", "Coming soon")}
              </Text>
            ) : held ? (
              <Check size={18} color={SUCCESS} strokeWidth={2.6} />
            ) : null}
            <ChevronRight
              size={16}
              color={on ? PRIMARY_500 : TEXT_MUTED}
              strokeWidth={2.4}
            />
          </Pressable>
        );
      })}
    </View>
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

  // ---- The sections as windows: where each stands, and what it can do.
  const present: SectionKey[] = [
    "form",
    ...(ai ? (["ai"] as const) : []),
    ...(child != null ? (["child"] as const) : []),
  ];
  // What takes part in the layout: not the AI on its way out.
  const placed = present.filter((k) => !(k === "ai" && aiLeaving));
  const full = placed.find((k) => modes[k] === "full") ?? null;
  const docked = order.filter(
    (k) => placed.includes(k) && modes[k] === "docked",
  );
  // With nothing docked beside it, the patient has the screen.
  const patientWidth = docked.length > 0 ? patientW : width;
  const cardTop = insets.top + SPACE.sm;
  const defaultWin = (k: SectionKey): Frame => {
    const w = Math.min(560, Math.round(width * 0.5));
    const h = Math.min(720, Math.round(height * 0.75));
    return {
      x:
        Math.round((width - w) / 2) +
        (k === "ai" ? 40 : k === "child" ? -30 : 0),
      y: insets.top + 30 + (k === "ai" ? 30 : k === "child" ? 50 : 0),
      w,
      h,
    };
  };
  type Placed = {
    frame: Frame;
    inset: { top: number; left: number; right: number };
    hidden: boolean;
    contentW: number;
    contentH: number;
    bottomInset: number;
  };
  const place = (k: SectionKey): Placed => {
    const m = modes[k];
    if (m === "full") {
      const inset = { top: cardTop, left: GUTTER, right: GUTTER };
      return {
        frame: { x: 0, y: 0, w: width, h: height },
        inset,
        hidden: false,
        contentW: width - GUTTER * 2,
        contentH: height - cardTop,
        bottomInset: insets.bottom,
      };
    }
    if (m === "floating" || m === "min") {
      const f = wins[k] ?? defaultWin(k);
      return {
        frame: f,
        inset: { top: 0, left: 0, right: 0 },
        hidden: m === "min" || full != null,
        contentW: f.w,
        contentH: f.h - 34,
        bottomInset: SPACE.sm,
      };
    }
    // Docked: side by side from the patient's edge, in `order`. The AI and
    // a child's record keep widths of their own; the record takes the rest
    // (or, with it not docked, the last of the others does).
    const i = docked.indexOf(k);
    const rest = width - patientWidth;
    const fixed = (d: SectionKey) =>
      d === "ai" ? aiW : d === "child" ? childW : 0;
    const taker = docked.includes("form") ? "form" : docked[docked.length - 1];
    const widthOf = (d: SectionKey) =>
      d === taker
        ? rest -
          docked.filter((o) => o !== taker).reduce((n, o) => n + fixed(o), 0)
        : fixed(d);
    const w = widthOf(k);
    const x =
      patientWidth + docked.slice(0, i).reduce((n, o) => n + widthOf(o), 0);
    const inset = {
      top: cardTop,
      left: HALF_GAP,
      right: i === docked.length - 1 ? GUTTER : HALF_GAP,
    };
    return {
      frame: { x, y: 0, w, h: height },
      inset,
      hidden: full != null,
      contentW: w - inset.left - inset.right,
      contentH: height - cardTop,
      bottomInset: insets.bottom,
    };
  };
  const layout = {
    form: place("form"),
    ai: place("ai"),
    child: place("child"),
  };

  // The patient's column, eased to its width as the sections around it
  // change — and following the finger while its divider is dragged.
  const patientAnim = useRef(new Animated.Value(patientWidth)).current;
  useEffect(() => {
    if (dividerHeld.current) {
      patientAnim.setValue(patientWidth);
      return;
    }
    const a = Animated.timing(patientAnim, {
      toValue: patientWidth,
      duration: 340,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [patientWidth, patientAnim]);

  const setMode = (k: SectionKey, m: WindowMode) =>
    setModes((cur) => ({ ...cur, [k]: m }));
  const closeAi = () => {
    setMenuFor(null);
    setAiLeaving(true);
    setTimeout(() => {
      setAi(false);
      setAiLeaving(false);
      setModes((m) => ({ ...m, ai: "docked" }));
    }, 360);
  };
  const openChild = (h: CardHolder) => {
    // As a column at the right of the mother's record. A docked AI steps
    // aside to the dock, so the record in the middle keeps its width; it
    // comes back from its pill.
    setModes((m) => {
      if (ai && m.ai === "docked") before.current.ai = "docked";
      return {
        ...m,
        child: "docked",
        ai: ai && m.ai === "docked" ? "min" : m.ai,
      };
    });
    before.current.child = "docked";
    setChild(h);
  };
  const closeChild = () => {
    setMenuFor(null);
    setChild(null);
  };
  // The child's window acts as a page of its own: its back button, and the
  // save that ends with going back, close the window.
  const childNav = useMemo(
    () =>
      ({
        ...nav,
        goBack: () => setChild(null),
        pop: () => setChild(null),
        canGoBack: () => true,
      }) as typeof nav,
    [nav],
  );
  // Where a section goes as it is put away — the dock's pill — or, for the
  // AI being closed, off the right edge; and where the AI comes in from.
  const dockFrame: Frame = {
    x: Math.round(width / 2 - 90),
    y: height - insets.bottom - SPACE.md - 44,
    w: 180,
    h: 44,
  };
  const offRight = (k: SectionKey): Frame => ({
    ...layout[k].frame,
    x: width + 20,
  });
  const act = (k: SectionKey, a: WindowAction) => {
    setMenuFor(null);
    const m = modes[k];
    if (a === "left" || a === "right") {
      setOrder((o) => [...o].reverse());
    } else if (a === "full") {
      before.current[k] = m;
      setMode(k, "full");
    } else if (a === "unfull") {
      setMode(k, restoreTo(before.current[k]));
    } else if (a === "float") {
      if (wins[k] == null) setWins((w) => ({ ...w, [k]: defaultWin(k) }));
      setMode(k, "floating");
      setFrontWin(k);
    } else if (a === "dock") {
      setMode(k, "docked");
    } else if (a === "min") {
      before.current[k] = m;
      setMode(k, "min");
    } else if (a === "close") {
      if (k === "child") closeChild();
      else closeAi();
    }
  };
  const menuAt = (k: SectionKey) => {
    const p = layout[k];
    const floating = modes[k] === "floating";
    const x = p.frame.x + p.inset.left + p.contentW / 2;
    return {
      x: Math.min(width - 125, Math.max(125, x)),
      y: p.frame.y + (floating ? 34 : p.inset.top) + 6,
    };
  };
  // A docked section dropped by its handle past the middle of the other:
  // the two change places.
  const dropAt = (k: SectionKey, centreX: number) => {
    if (docked.length < 2 || modes[k] !== "docked") return;
    const i = docked.indexOf(k);
    const mid = (d: SectionKey) => layout[d].frame.x + layout[d].frame.w / 2;
    const other =
      i + 1 < docked.length && centreX > mid(docked[i + 1])
        ? docked[i + 1]
        : i > 0 && centreX < mid(docked[i - 1])
          ? docked[i - 1]
          : null;
    if (other == null) return;
    feel("tick");
    setOrder((o) => {
      const n = [...o];
      const a = n.indexOf(k);
      const b = n.indexOf(other);
      n[a] = other;
      n[b] = k;
      return n;
    });
  };
  const windowProps = (k: SectionKey) => ({
    onDrop: (x: number) => dropAt(k, x),
    awayTo:
      k === "ai" && aiLeaving
        ? offRight(k)
        : modes[k] === "min"
          ? dockFrame
          : undefined,
    enterFrom:
      k === "ai" ? offRight(k) : k === "child" ? offRight(k) : undefined,
    mode: modes[k],
    frame: layout[k].frame,
    inset: layout[k].inset,
    hidden: layout[k].hidden || (k === "ai" && aiLeaving),
    highlighted: menuFor === k,
    front: frontWin === k,
    onDots: () => {
      feel("tick");
      setMenuFor((cur) => (cur === k ? null : k));
    },
    onFrame: (f: Frame) =>
      setWins((w) => ({
        ...w,
        [k]: {
          ...f,
          x: Math.min(width - 80, Math.max(80 - f.w, f.x)),
          y: Math.min(height - 60, Math.max(insets.top, f.y)),
        },
      })),
    onDock: () =>
      k === "ai"
        ? closeAi()
        : k === "child"
          ? closeChild()
          : setMode(k, "docked"),
    onMinimize: () => {
      before.current[k] = modes[k];
      setMode(k, "min");
    },
    onFull: () => {
      before.current[k] = modes[k];
      setMode(k, "full");
    },
    onTouch: () => {
      if (modes[k] === "floating" && frontWin !== k) setFrontWin(k);
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      {/* The same pale wash every pushed screen opens with — not the
          design's streaked glass picture, which read as a thing behind the
          page rather than as the page's own ground. */}
      <HeaderWash height={insets.top + D.wash} />

      <View
        style={[
          {
            position: "absolute",
            top: insets.top + SPACE.sm,
            left: GUTTER,
            zIndex: 2,
          },
          // Under a section shown across the whole screen, out of the way —
          // moved off the page, not `display: none`, which a glass button
          // does not always come back from.
          split && (modes.form === "full" || (ai && modes.ai === "full"))
            ? { left: -100000 }
            : null,
        ]}
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
              {
                icon: <UIcon name="sparkles" size={20} color={TEXT_PRIMARY} />,
                label: tr(
                  "สรุปและถามผู้ช่วย AI เรื่องผู้ป่วยรายนี้",
                  "AI summary and assistant for this patient",
                ),
                onPress: openAssistant,
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
        <View style={{ flex: 1 }}>
          <Animated.View
            style={[
              {
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: patientAnim,
              },
              // Under a section shown full, moved off the page rather
              // than `display: none` — see SectionWindow on glass.
              full != null && { left: -100000 },
            ]}
          >
            {/* Dissolving only under the status bar: the column starts
                just below it, and a fade down past the back button lay
                over the avatar. */}
            <HeaderFade from={insets.top - 4} to={insets.top + SPACE.sm}>
              <ScrollView
                contentContainerStyle={{
                  paddingLeft: GUTTER,
                  paddingRight: HALF_GAP,
                  // The avatar is centred, clear of the back button in the
                  // corner, so the column starts just under the status bar.
                  paddingTop: insets.top + SPACE.sm,
                  paddingBottom: insets.bottom + 96,
                  // One rhythm down the column: 12 between its cards, 8
                  // between the rows of a list, 24 before a new section.
                  gap: SPACE.md,
                }}
                showsVerticalScrollIndicator={false}
              >
                {patientPart}
                {/* The records, under the patient: the one picked is open
                    on the right. */}
                <Text
                  style={{
                    marginTop: SPACE.md,
                    marginBottom: -SPACE.xs,
                    marginLeft: SPACE.xs,
                    ...TYPE.headline,
                    fontWeight: "600",
                    color: TEXT_PRIMARY,
                  }}
                >
                  {tr("บันทึกการเยี่ยม", "Visit record")}
                </Text>
                {recordMenu}
              </ScrollView>
            </HeaderFade>
            {closeBar}
          </Animated.View>

          {/* The divider between the patient and the first section. */}
          {full == null && docked.length > 0 && (
            <View
              {...divider.panHandlers}
              accessibilityRole="adjustable"
              accessibilityLabel={tr("ปรับขนาดสองฝั่ง", "Resize the two sides")}
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: patientWidth - 14,
                width: 28,
                zIndex: 10,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Grip t={grip} />
            </View>
          )}
          {/* And between docked sections: each sizes the AI's or the
              child's column, whichever of the two it stands beside. */}
          {full == null &&
            docked.slice(1).map((d, j) => {
              const left = docked[j];
              const col = (d !== "form" ? d : left) as "ai" | "child";
              colSide.current[col] = d !== "form" ? "right" : "left";
              return (
                <View
                  key={`div-${left}-${d}`}
                  {...(col === "ai" ? divider2 : divider3).panHandlers}
                  accessibilityRole="adjustable"
                  accessibilityLabel={
                    col === "ai"
                      ? tr("ปรับขนาดผู้ช่วย AI", "Resize the AI assistant")
                      : tr("ปรับขนาดบันทึกบุตร", "Resize the baby's record")
                  }
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: layout[d].frame.x - 14,
                    width: 28,
                    zIndex: 10,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Grip t={col === "ai" ? grip2 : grip3} />
                </View>
              );
            })}

          {/* The record being written. */}
          <SectionWindow
            {...windowProps("form")}
            title={tr("บันทึกการเยี่ยม", "Visit record")}
          >
            <OpenChildContext.Provider value={openChild}>
              <VisitPane
                holder={holder}
                selected={selected}
                onIdle={() => setSelected(null)}
                width={layout.form.contentW}
                height={layout.form.contentH}
                bottomInset={layout.form.bottomInset}
              />
            </OpenChildContext.Provider>
          </SectionWindow>

          {/*
            A child's record, in a window of its own. The visit form is
            mounted as it is on a page, told the child is its route and
            given a navigation whose "back" closes the window — not a
            navigator of its own, which beside the record's would be one
            navigator too many under this screen.
          */}
          {child != null && (
            <SectionWindow
              key={child.authenCode}
              {...windowProps("child")}
              title={tr(`บันทึกบุตร · ${child.name}`, `Baby · ${child.name}`)}
            >
              {/* The card's ground, the same glass the record's column
                  lays behind each form. */}
              <Glass
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                }}
              />
              <View
                style={{ flex: 1, marginHorizontal: -(GUTTER - CARD_INSET) }}
              >
                <SafeAreaInsetsContext.Provider
                  value={{
                    top: SPACE.xs,
                    bottom: layout.child.bottomInset,
                    left: 0,
                    right: 0,
                  }}
                >
                  <LayoutFrame.Provider
                    value={{
                      width: layout.child.contentW + (GUTTER - CARD_INSET) * 2,
                      height: layout.child.contentH,
                    }}
                  >
                    <PlainHeaderContext.Provider value>
                      <NavigationRouteContext.Provider
                        value={{
                          key: `child-${child.authenCode}`,
                          name: "HomeVisit",
                          params: { holder: child },
                        }}
                      >
                        <NavigationContext.Provider value={childNav}>
                          {/* A stage of its own, as each form in the
                              record's column has: without one, its save
                              tray and floating cards were lifted to the
                              whole page's stage and drawn over the screen. */}
                          <ScreenFrame>
                            <BlurStage navigation={childNav}>
                              <HomeVisitScreen />
                            </BlurStage>
                          </ScreenFrame>
                        </NavigationContext.Provider>
                      </NavigationRouteContext.Provider>
                    </PlainHeaderContext.Provider>
                  </LayoutFrame.Provider>
                </SafeAreaInsetsContext.Provider>
              </View>
            </SectionWindow>
          )}

          {/* The AI assistant, about this patient. */}
          {ai && (
            <SectionWindow
              {...windowProps("ai")}
              title={tr("ผู้ช่วย AI", "AI assistant")}
            >
              {/* As the record's card does: the assistant keeps the page's
                  margin inside its own edges, so it is laid a little wider
                  than its card and clipped to CARD_INSET. */}
              <View
                style={{ flex: 1, marginHorizontal: -(GUTTER - CARD_INSET) }}
              >
                <SafeAreaInsetsContext.Provider
                  value={{
                    top: SPACE.xs,
                    bottom: layout.ai.bottomInset,
                    left: 0,
                    right: 0,
                  }}
                >
                  <LayoutFrame.Provider
                    value={{
                      width: layout.ai.contentW + (GUTTER - CARD_INSET) * 2,
                      height: layout.ai.contentH,
                    }}
                  >
                    <AssistantScreen
                      embedded={{ brief: assistantBrief, onClose: closeAi }}
                    />
                  </LayoutFrame.Provider>
                </SafeAreaInsetsContext.Provider>
              </View>
            </SectionWindow>
          )}

          {menuFor != null && (
            <WindowMenu
              at={menuAt(menuFor)}
              mode={modes[menuFor]}
              canClose={menuFor === "ai" || menuFor === "child"}
              onPick={(a) => act(menuFor, a)}
              onDismiss={() => setMenuFor(null)}
            />
          )}

          <MinimizedDock
            bottom={insets.bottom + SPACE.md}
            items={present
              .filter((k) => modes[k] === "min")
              .map((k) => ({
                key: k,
                label:
                  k === "ai"
                    ? tr("ผู้ช่วย AI", "AI assistant")
                    : k === "child"
                      ? tr(
                          `บุตร · ${child?.name ?? ""}`,
                          `Baby · ${child?.name ?? ""}`,
                        )
                      : tr("บันทึกการเยี่ยม", "Visit record"),
                icon:
                  k === "ai" ? (
                    <UIcon name="sparkles" size={18} color={PRIMARY_500} />
                  ) : k === "child" ? (
                    <Baby size={18} color={PRIMARY_500} strokeWidth={2.2} />
                  ) : (
                    <ClipboardList
                      size={18}
                      color={PRIMARY_500}
                      strokeWidth={2.2}
                    />
                  ),
                onRestore: () =>
                  setModes((m) => ({
                    ...m,
                    [k]:
                      // The AI back beside a child's record: as a window,
                      // so the record in the middle is not squeezed.
                      k === "ai" && childDocked
                        ? "floating"
                        : restoreTo(before.current[k]),
                  })),
              }))}
          />
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

      <PatientInfoSheet
        visible={info}
        allergies={allergies}
        conditions={conditions}
        detail={detail}
        lead={
          split ? (
            <>
              {idCard}
              {visitCard}
            </>
          ) : null
        }
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
  lead,
  onClose,
}: {
  visible: boolean;
  allergies: string[];
  conditions: string[];
  /** What comes first, where the page showed only a summary of it. */
  lead?: ReactNode;
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
              ...TYPE.headline,
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
          {lead}
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
            ...TYPE.headline,
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
                ...TYPE.footnote,
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
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  /** What it opens is open: the button is filled with the brand blue. */
  active?: boolean;
}) {
  return (
    <GlassIconButton
      onPress={onPress}
      accessibilityLabel={label}
      size={48}
      tintColor={active ? PRIMARY_500 : undefined}
    >
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

/**
 * One identifier: its name in Footnote over its value in Subheadline — the
 * patient's facts are read at a glance, and at Body size they took the
 * column over from the menu of records under them.
 */
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
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <Text numberOfLines={1} style={{ ...TYPE.footnote, color: TEXT_MUTED }}>
        {label}
      </Text>
      <Text
        numberOfLines={lines}
        style={{
          ...TYPE.subheadline,
          fontWeight: "600",
          color: TEXT_PRIMARY,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
