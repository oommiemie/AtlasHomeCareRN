/**
 * The app's navigation.
 *
 * A native stack at the root with a native tab navigator as its first screen.
 * Both are genuinely native: `react-native-bottom-tabs` hosts a real
 * `UITabBarController`, and `presentation: "modal"` on a stack screen becomes
 * a real `UIModalPresentationPageSheet` — which is what makes the page behind
 * a sheet inset, scale back and show its rounded corners. That recession is
 * the system's, not something drawn here.
 */
import { useMemo, useState, type ReactNode } from "react";
import { Platform, Pressable, View, useWindowDimensions } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import type { NavigatorScreenParams } from "@react-navigation/native";
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from "@react-navigation/native-stack";
import { createNativeBottomTabNavigator } from "@bottom-tabs/react-navigation";

import { useDisplay } from "../models/display";
import { DockedTray } from "../components/ActionBar";
import { BlurScene, BlurStage, useSceneTargets } from "../components/BlurStage";
import { IosTabBar } from "../components/IosTabBar";
import {
  SHEET_RADIUS,
  SHEET_TOP_GAP,
  SheetHandle,
} from "../components/SheetHandle";
import { ScreenFrame } from "../components/ScreenFrame";

import { CANVAS, PRIMARY_500, SURFACE } from "../theme/tokens";
import { IS_TABLET, LayoutFrame } from "../theme/layout";
import { tr } from "../i18n";
import { HomeScreen } from "../screens/HomeScreen";
import { VisitPlanScreen } from "../screens/VisitPlanScreen";
import { ServicesScreen } from "../screens/ServicesScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { HousesScreen } from "../screens/HousesScreen";
import { HouseListScreen } from "../screens/HouseListScreen";
import { HouseDetailScreen } from "../screens/HouseDetailScreen";
import { AddHouseScreen } from "../screens/AddHouseScreen";
import { PickLocationScreen } from "../screens/PickLocationScreen";
import { AddressSearchScreen } from "../screens/AddressSearchScreen";
import { SelectOptionScreen } from "../screens/SelectOptionScreen";
import { ScanIdScreen } from "../screens/ScanIdScreen";
import { AddHouseMembersScreen } from "../screens/AddHouseMembersScreen";
import { AddHouseSummaryScreen } from "../screens/AddHouseSummaryScreen";
import { AddMemberScreen } from "../screens/AddMemberScreen";
import { FollowUpScreen } from "../screens/FollowUpScreen";
import { CgmDetailScreen } from "../screens/CgmDetailScreen";
import type { MetricKind } from "../models/vitals";
import { VitalDetailScreen } from "../screens/VitalDetailScreen";
import { BmiDetailScreen } from "../screens/BmiDetailScreen";
import { CardReaderScreen } from "../screens/CardReaderScreen";
import { ExamRoomScreen } from "../screens/ExamRoomScreen";
import { CommunityPatientScreen } from "../screens/CommunityPatientScreen";
import { TreatmentHistoryScreen } from "../screens/TreatmentHistoryScreen";
import { PhysioScreen } from "../screens/PhysioScreen";
import { HealthScreeningScreen } from "../screens/HealthScreeningScreen";
import { AssessmentListScreen } from "../screens/AssessmentListScreen";
import { Screening35Screen } from "../screens/Screening35Screen";
import { DyspneaScreen } from "../screens/DyspneaScreen";
import { AsthmaScreen } from "../screens/AsthmaScreen";
import { QuestionnaireScreen } from "../screens/QuestionnaireScreen";
import { NcdScreen } from "../screens/NcdScreen";
import { DiagnosisScreen } from "../screens/DiagnosisScreen";
import { MedicationScreen } from "../screens/MedicationScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { ConsentScreen } from "../screens/ConsentScreen";
import { FacilityScreen } from "../screens/FacilityScreen";
import { PinScreen } from "../screens/PinScreen";
import { SecuritySettingsScreen } from "../screens/SecuritySettingsScreen";
import { currentSession, type PinMode } from "../models/session";
import { HomeVisitScreen } from "../screens/HomeVisitScreen";
import type { CardHolder, ExamRoomKey } from "../models/community";
import { HealthTrackingScreen } from "../screens/HealthTrackingScreen";
import { TaskListScreen } from "../screens/TaskListScreen";
import { PostingLogScreen } from "../screens/PostingLogScreen";
import { AssistantScreen } from "../screens/AssistantScreen";
import { OpenVaccineSessionScreen } from "../screens/OpenVaccineSessionScreen";
import type { ActivityKind } from "../models/vaccination";
import { CareActivitiesScreen } from "../screens/CareActivitiesScreen";
import { VaccineHistoryScreen } from "../screens/VaccineHistoryScreen";
import { VaccineHistoryDetailScreen } from "../screens/VaccineHistoryDetailScreen";
import { VaccineResultScreen } from "../screens/VaccineResultScreen";
import { VaccineSessionScreen } from "../screens/VaccineSessionScreen";
import { GrowthRecordScreen } from "../screens/GrowthRecordScreen";
import { GrowthHistoryScreen } from "../screens/GrowthHistoryScreen";
import { DspmRecordScreen } from "../screens/DspmRecordScreen";
import { DentalRecordScreen } from "../screens/DentalRecordScreen";
import { DspmHistoryScreen } from "../screens/DspmHistoryScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { NotificationTestScreen } from "../screens/NotificationTestScreen";
import { AcceptTaskScreen } from "../screens/AcceptTaskScreen";
import { ExploreMapScreen } from "../screens/ExploreMapScreen";
import { HouseMapScreen } from "../screens/HouseMapScreen";
import { NotificationSettingsScreen } from "../screens/NotificationSettingsScreen";
import { ProfileSettingsScreen } from "../screens/ProfileSettingsScreen";
import { DisplaySettingsScreen } from "../screens/DisplaySettingsScreen";
import { LanguageSettingsScreen } from "../screens/LanguageSettingsScreen";
import { HelpCenterScreen } from "../screens/HelpCenterScreen";
import { ReportProblemScreen } from "../screens/ReportProblemScreen";
import { AuthenCodeScreen } from "../screens/AuthenCodeScreen";
import { SuppliesScreen } from "../screens/SuppliesScreen";
import { NotesScreen } from "../screens/NotesScreen";
import { NoteScreen } from "../screens/NoteScreen";
import { TermsScreen } from "../screens/TermsScreen";
import { PrivacyScreen } from "../screens/PrivacyScreen";
import { AboutScreen } from "../screens/AboutScreen";
import { SpotlightScreen } from "../screens/SpotlightScreen";
import type { House, Resident, Village } from "../models/household";
import type { Place } from "../models/place";
import type { Task } from "../models/task";
import type { PatientDetail } from "../models/patientDetail";

export type RootStackParamList = {
  // Takes the tab host's own params, so a search hit can name a tab.
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Houses: undefined;
  HouseList: { village: Village };
  HouseDetail: { house: House };
  AddHouse: { village: Village };
  // The sheet writes its answer into the house draft rather than handing it
  // back, so all it needs is somewhere to open the map.
  // `chosen` is how the address sheet answers — it navigates back to the
  // picker with the row that was tapped and where it turned out to be.
  PickLocation: {
    initial: { latitude: number; longitude: number };
    chosen?: { lat: number; lng: number; place: Place };
  };
  AddressSearch: undefined;
  SelectOption: undefined;
  ScanId: undefined;
  AddHouseMembers: undefined;
  AddHouseSummary: undefined;
  // Two ways in. `at` is the index of a member being edited in the add-house
  // draft; `house` opens the same form against a house that already exists,
  // which is how the record page adds to its own household.
  AddMember: { at?: number; house?: House } | undefined;
  FollowUp: undefined;
  HealthTracking: { resident: Resident };
  CgmDetail: { resident: Resident };
  /** One reading's own page: which reading it is arrives with it. */
  VitalDetail: { resident: Resident; kind: MetricKind };
  /** BMI's own page. Not a `MetricKind`, so not a `VitalDetail` — see `vitals`. */
  BmiDetail: { resident: Resident };

  /*
    The community-service flow: reader → panel → session → forms.

    The card holder travels with every step rather than being held in a store,
    because the session is the card: close the flow and it is over, and a
    record left behind in a store would be the next patient's page opening
    with the last one's Authen Code on it.
  */
  CardReader: undefined;
  ExamRoom: { holder: CardHolder };
  /**
   * The patient's record for a visit. `room` is where the community day is
   * sending them; a home visit reached from a task has none.
   */
  /** `task` when opened from a visit rather than a card read: it carries the address the map opens on. */
  CommunityPatient: {
    holder: CardHolder;
    room?: ExamRoomKey;
    task?: Task;
    detail?: PatientDetail;
  };
  TreatmentHistory: { hn: string; name: string };
  Physio: { holder: CardHolder };
  HealthScreening: { holder: CardHolder };
  AssessmentList: { holder: CardHolder };
  Screening35: { holder: CardHolder };
  Dyspnea: { holder: CardHolder };
  Asthma: { holder: CardHolder };
  /** Any of the data-driven forms, by its key in ASSESSMENTS. */
  Questionnaire: { holder: CardHolder; form: string };
  Ncd: { holder: CardHolder };
  Diagnosis: { holder: CardHolder };
  Medication: { holder: CardHolder };
  /** The first-run steps, in order: sign in, consent, facility, PIN. */
  Login: undefined;
  Consent: undefined;
  /** `from: "settings"` returns to the settings page after the choice. */
  Facility: undefined;
  /** No mode is the first-run setup. */
  Pin: { mode?: PinMode } | undefined;
  /** The PIN page as the app's first page, when a PIN is already set. */
  Unlock: undefined;
  SecuritySettings: undefined;
  HomeVisit: { holder: CardHolder };
  TaskList: undefined;
  /** What was taken and what was turned down. */
  PostingLog: undefined;
  /** What the app has told this carer. */
  Assistant: undefined;
  CareActivities: { kind: ActivityKind };
  OpenVaccineSession: { activityId: string };
  VaccineSession: undefined;
  /** One child on the scale, reached from a weighing round's roster. */
  GrowthRecord: { targetId: string };
  /** Every weighing that child has had, reached from the form's header. */
  GrowthHistory: { targetId: string };
  /** One child screened on DSPM, reached from a screening round's roster. */
  DspmRecord: { targetId: string };
  /** Every screening that child has had, reached from the form's header. */
  DspmHistory: { targetId: string };
  DentalRecord: { targetId: string };
  /** The names about to be written, where a batch is being read back. */
  VaccineResult: { ids?: string[] } | undefined;
  /**
   * The sittings already run, for one service.
   *
   * Filtered by kind rather than pooled: a carer opening the history from
   * งานวัคซีน is asking what THIS service has done, and a list that also
   * held every nursery weighing answers a question they did not ask.
   * Undefined keeps the old whole-app list, for anything that wants it.
   */
  VaccineHistory: { kind: ActivityKind } | undefined;
  VaccineHistoryDetail: { id: string };
  Notifications: undefined;
  /** Fires each kind of notice, for a build with no server behind it. */
  NotificationTest: undefined;
  AcceptTask: { task: Task };
  // `tour`: the stops of a planned round, in order, drawn as one route.
  ExploreMap: { focus?: Task; tour?: Task[] } | undefined;
  /** The houses under care, as pins. */
  // `focus` opens on one house, chosen, as the visit map opens on a visit.
  HouseMap: { focus?: House } | undefined;
  NotificationSettings: undefined;
  ProfileSettings: undefined;
  DisplaySettings: undefined;
  LanguageSettings: undefined;
  HelpCenter: undefined;
  ReportProblem: undefined;
  AuthenCode: undefined;
  Supplies: undefined;
  Notes: undefined;
  Note: { noteId: string };
  Terms: undefined;
  Privacy: undefined;
  About: undefined;
  Spotlight: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Plan: undefined;
  Services: undefined;
  Profile: undefined;
  /** The search button beside the bar; never shown as a page. */
  Search: undefined;
};

/** What the search tab would show, if it ever became current. It does not. */
function NoPage() {
  return null;
}

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * How every sheet in the stack is presented — one set of options, so no two
 * sheets come up differently.
 *
 * iOS: the system page sheet, the page behind receding under it.
 *
 * Android: Material's own bottom sheet (`formSheet`, which react-native-screens
 * draws with `BottomSheetBehavior`). As `modal` it was not a sheet at all but a
 * whole screen sliding up from the bottom, running on past the status bar with
 * the close button under the clock. The sheet stops below the status bar, keeps
 * the page behind dimmed in view, and drags down to close, as the platform's
 * own sheets do. One detent, near full height: these are forms and lists that
 * want the room, and a half-height rest would only be a step to drag through.
 *
 * Near, not all the way: the top stops at `SHEET_TOP_GAP`, below the
 * phone's safe area, which the modal sheets (`PageSheetModal`) stop at too. The
 * detent is a fraction of the window, so the gap is worked out against the
 * window's height — read as it is now, not once when this module loaded: a
 * tablet turns, and a detent worked out for the upright height would leave a
 * landscape sheet running off the top of the screen.
 *
 * On an iPad, `modal` is still the system page sheet, which there is a
 * centred card rather than an edge-to-edge sheet, in either orientation —
 * the size a form or a list wants. `formSheet` would be smaller still and too
 * cramped for the member form or the map picker, so it is not used.
 */
function sheetOptions(windowHeight: number): {
  sheet: NativeStackNavigationOptions;
  picker: NativeStackNavigationOptions;
} {
  if (Platform.OS !== "android") {
    const sheet: NativeStackNavigationOptions = IS_TABLET
      ? /*
          A centred card either way up on an iPad, drawn by the app (see
          TabletSheet): `modal` there is a page sheet as wide as the screen
          held upright, which came up edge to edge in portrait, and the
          native form sheet laid a page's scroll over its own header.
        */
        {
          presentation: "transparentModal",
          animation: "fade",
          contentStyle: { backgroundColor: "transparent" },
        }
      : { presentation: "modal", animation: "slide_from_bottom" };
    return { sheet, picker: sheet };
  }
  const full = 1 - SHEET_TOP_GAP / windowHeight;
  const sheet: NativeStackNavigationOptions = {
    presentation: "formSheet",
    sheetAllowedDetents: [full],
    sheetCornerRadius: SHEET_RADIUS,
  };
  /*
    A picker opened from inside a sheet — the option list, the address search.

    iOS stacks its page sheets: the form recedes under the picker and its top
    edge stays in view, so the picker reads as something over the form and not
    a new page. Android has no such stack; a second bottom sheet at the same
    height simply covers the first. So here the picker rests lower, at three
    fifths, with the dimmed form showing above it — the platform's own way of
    saying the same thing. A long list can still be dragged, or scrolled, up to
    the full detent. Same as any other sheet on iOS.
  */
  return { sheet, picker: { ...sheet, sheetAllowedDetents: [0.6, full] } };
}

/**
 * The frame a sheet's page is drawn in, for `useLayout` to measure against.
 *
 * On a phone a sheet is as wide as the window, but on a tablet the page sheet
 * is a card in the middle of it, and a page inside that asked the window how
 * wide it was would lay out three columns in a card with room for two. So
 * on a tablet a sheet's page is measured, and `useLayout` answers with the
 * sheet's size inside it. Until the first measure it answers with the
 * window's, as it always did.
 */
function SheetFrame({ children }: { children: ReactNode }) {
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(
    null,
  );
  return (
    <LayoutFrame.Provider value={frame}>
      <View
        style={{ flex: 1 }}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setFrame((was) =>
            was != null && was.width === width && was.height === height
              ? was
              : { width, height },
          );
        }}
      >
        {children}
      </View>
    </LayoutFrame.Provider>
  );
}

/**
 * A sheet on an iPad: the page on a card in the middle of the screen, over
 * the page it came from, dimmed — the same card whichever way up the iPad
 * is held. Tapping the dimmed page closes it, as it does a system sheet.
 * The page inside is told it has no status bar or home bar to clear — the
 * card stands off both — and measures itself by the card.
 */
function TabletSheet({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const cardW = Math.min(760, width - 96);
  const cardH = Math.min(1000, height - 112);
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr("ปิด", "Close")}
        onPress={onClose}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: "rgba(0,0,0,0.28)",
        }}
      />
      <View
        style={{
          width: cardW,
          height: cardH,
          borderRadius: 32,
          boxShadow: "0px 12px 40px rgba(0,0,0,0.18)",
        }}
      >
        <View
          style={{
            flex: 1,
            borderRadius: 32,
            overflow: "hidden",
            backgroundColor: CANVAS,
          }}
        >
          <SafeAreaInsetsContext.Provider
            value={{ top: 0, bottom: 0, left: 0, right: 0 }}
          >
            {/* Its tray a footer in the card, not a float over it. */}
            <DockedTray>
              <SheetFrame>{children}</SheetFrame>
            </DockedTray>
          </SafeAreaInsetsContext.Provider>
        </View>
      </View>
    </View>
  );
}

const isSheet = (presentation: NativeStackNavigationOptions["presentation"]) =>
  presentation === "modal" ||
  presentation === "formSheet" ||
  presentation === "pageSheet";

const Tab = createNativeBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const display = useDisplay();
  // Each tab's page as a blur target, and the bar pointed at the one showing.
  const sceneTarget = useSceneTargets();
  // Icons are the Flaticon UIcons the design specifies, rendered from the
  // font to template images: the native tab bar takes an image source, not a
  // font glyph, and SF Symbols are a different family — swapping in Apple's
  // nearest match changed the app's iconography.
  //
  // Outline when idle, filled when selected, which is the pairing the design
  // provides (fi-rr-* and fi-sr-*).
  return (
    <Tab.Navigator
      tabBarActiveTintColor={PRIMARY_500}
      tabBarInactiveTintColor="#8E8E93"
      /*
        The iPhone's label size on an iPad too. The bar is held at the foot
        of the screen in the iPhone's stacked layout (see the bottom-tabs
        patch), but the library still sized the words for the iPad's
        side-by-side one — 13pt under a glyph drawn for 10, and the words
        crowded up against the icons.
      */
      tabLabelStyle={
        IS_TABLET && Platform.OS === "ios" ? { fontSize: 10 } : undefined
      }
      /*
        Android's own two marks of a Material tab bar, taken off.

        The native bar is UITabBar on iOS and a NavigationBarView on
        Android, and the Android one says "selected" a second way: a filled
        pill slides in behind the chosen glyph, in the theme's accent —
        which, untouched, is Material's purple, in an app that is blue. The
        glyph is already tinted and already filled. The pill was a third
        statement of the same fact, in the wrong colour, and the ripple that
        spreads from the press has no counterpart on the other platform at
        all.
      */
      activeIndicatorColor="transparent"
      rippleColor="transparent"
      /*
        And on Android the bar itself, because the two differences left
        after those are its height and its type, and Material's control
        owns both. See IosTabBar. iOS is left on the real UITabBar.
      */
      tabBar={
        Platform.OS === "android"
          ? (props) => (
              <IosTabBar
                {...props}
                blurTarget={sceneTarget(
                  props.state.routes[props.state.index].key,
                )}
              />
            )
          : undefined
      }
      // The pages the bar blurs, each its own target; see `BlurScene`.
      screenLayout={({ children, route, navigation }) => (
        <BlurScene target={sceneTarget(route.key)} navigation={navigation}>
          {children}
        </BlurScene>
      )}
      // Opaque: translucent lets list content bleed behind the labels.
      translucent={false}
      scrollEdgeAppearance="opaque"
      // Names under the glyphs, or not — the display page's own switch.
      labeled={display.tabLabels}
      tabBarStyle={{ backgroundColor: SURFACE }}
      // The iOS 26 bar half-collapses on scroll otherwise.
      minimizeBehavior="never"
      screenOptions={{
        // Lazy tabs render blank on iOS 26 under the New Architecture.
        lazy: false,
        // An opaque ground under every tab.
        //
        // The four scenes are stacked in one container and each of these
        // screens is a bare `flex: 1` view with its wash painted over the
        // top — transparent everywhere else. So the tab you left stayed
        // visible through the one you moved to, and the switch read as two
        // pages laid over each other.
        //
        // This is also what lets the swap be animated again. `disablePageAnimations`
        // used to be set here to stop that overlap, and it does far more than
        // its name says: the library implements it by calling
        // `UIView.setAnimationsEnabled(false)` on every tab change and
        // switching animation back on 100ms later — globally, for the whole
        // app. The tab bar's own selection animation was being cut off
        // half-drawn and resumed, which is what made the bar look like it was
        // stuttering. With an opaque ground under each scene the cross-fade
        // has nothing to reveal, so there is nothing left to suppress.
        sceneStyle: { backgroundColor: CANVAS },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: tr("หน้าแรก", "Home"),
          tabBarIcon: ({ focused }) =>
            focused
              ? require("../../assets/tabs/home_solid.png")
              : require("../../assets/tabs/home.png"),
        }}
      />
      <Tab.Screen
        name="Plan"
        component={VisitPlanScreen}
        options={{
          title: tr("แผนเยี่ยม", "Visit plan"),
          tabBarIcon: ({ focused }) =>
            focused
              ? require("../../assets/tabs/plan_solid.png")
              : require("../../assets/tabs/plan.png"),
        }}
      />
      <Tab.Screen
        name="Services"
        component={ServicesScreen}
        options={{
          title: tr("บริการ", "Services"),
          tabBarIcon: ({ focused }) =>
            focused
              ? require("../../assets/tabs/services_solid.png")
              : require("../../assets/tabs/services.png"),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: tr("ฉัน", "Me"),
          tabBarIcon: ({ focused }) =>
            focused
              ? require("../../assets/tabs/profile_solid.png")
              : require("../../assets/tabs/profile.png"),
        }}
      />
      {/*
        Search, on an iPad, as a round glass button standing just right of
        the bar.

        The tab itself is never drawn. iOS 26 puts a search-role tab at the
        far edge of the screen, which on an iPad is a long way from a bar
        held in the middle, so the bottom-tabs patch draws its own button
        beside the bar and presses this tab when it is tapped (see
        AtlasSearchButton). Pressing it opens the same Spotlight overlay the
        rest of the app opens, over whatever tab is showing, and the tab
        never becomes current (`preventsDefault`).

        On a phone there is no button: search is on the home page's own
        toolbar. Android's bar skips hidden tabs as well.
      */}
      <Tab.Screen
        name="Search"
        component={NoPage}
        options={{
          title: tr("ค้นหา", "Search"),
          role: "search",
          preventsDefault: true,
          tabBarItemHidden: true,
          tabBarIcon: () => ({ sfSymbol: "magnifyingglass" }),
        }}
        listeners={({ navigation }) => ({
          tabPress: () => navigation.navigate("Spotlight" as never),
        })}
      />
    </Tab.Navigator>
  );
}

/** The PIN page, on its own, as the first page of a launch. */
function UnlockScreen() {
  return <PinScreen mode="unlock" />;
}

/**
 * Where a launch begins. A session that got all the way to a PIN opens on
 * the lock; anything less opens on sign-in, and the steps run again.
 */
function startRoute(): "Login" | "Unlock" {
  const s = currentSession();
  return s.pin != null && s.consentedAt != null && s.facility != null
    ? "Unlock"
    : "Login";
}

export function RootStack() {
  // Rebuilt when the window's height changes — a tablet turned — so the
  // Android sheets' detent is always worked out against the height it has.
  const { height } = useWindowDimensions();
  const { sheet: SHEET, picker: PICKER_SHEET } = useMemo(
    () => sheetOptions(height),
    [height],
  );
  return (
    <Stack.Navigator
      initialRouteName={startRoute()}
      // Every screen a page its floating bar can blur without reading
      // itself. Nothing on iOS; see `BlurStage`.
      //
      // Except the tab host. Its tab bar is a native Android view that lays
      // itself out, and inside the blur's target view that layout never
      // arrived: the bar was simply gone. The tab pages carry no floating
      // bar of their own to need the stage.
      //
      // And every sheet on Android gets Material's drag handle; see
      // `SheetHandle`. Keyed off the presentation, so a screen made a sheet
      // in `SHEET` gets one without being listed here.
      screenLayout={({ children, route, options, navigation }) =>
        route.name === "Main" ? (
          children
        ) : (
          <ScreenFrame>
            <BlurStage navigation={navigation}>
              {IS_TABLET &&
              Platform.OS === "ios" &&
              options.presentation === "transparentModal" &&
              route.name !== "Spotlight" ? (
                <TabletSheet onClose={() => navigation.goBack()}>
                  {children}
                </TabletSheet>
              ) : IS_TABLET && isSheet(options.presentation) ? (
                <SheetFrame>{children}</SheetFrame>
              ) : (
                children
              )}
              {Platform.OS === "android" &&
                options.presentation === "formSheet" && <SheetHandle />}
            </BlurStage>
          </ScreenFrame>
        )
      }
      screenOptions={{
        // Screens draw their own headers: the design puts a glass back button
        // and the title over the content, not in a bar above it.
        headerShown: false,
        contentStyle: { backgroundColor: CANVAS },
        /*
          The push, as iOS does it.

          A native stack takes each platform's own transition, and Android's
          is Material's: the new screen rises and fades in place. Every
          screen in this app is reached by pushing and left by a back button
          in the top left, which is a stack you read from left to right — so
          it slides in from the right on both, and the two builds stop being
          two different apps. iOS is left on its own default, which is this
          plus the edge swipe back that goes with it.
        */
        animation: Platform.OS === "android" ? "slide_from_right" : "default",
      }}
    >
      <Stack.Screen name="Main" component={MainTabs} />

      <Stack.Screen name="Houses" component={HousesScreen} />
      <Stack.Screen name="HouseList" component={HouseListScreen} />
      <Stack.Screen name="HouseDetail" component={HouseDetailScreen} />
      <Stack.Screen name="AddHouse" component={AddHouseScreen} />
      <Stack.Screen name="AddHouseMembers" component={AddHouseMembersScreen} />
      <Stack.Screen name="AddHouseSummary" component={AddHouseSummaryScreen} />

      {/* The map picker comes up from the bottom over the form, the way the
          resident record does — a sheet you drop into and back out of. */}
      <Stack.Screen
        name="PickLocation"
        component={PickLocationScreen}
        options={SHEET}
      />
      <Stack.Screen
        name="AddMember"
        component={AddMemberScreen}
        options={SHEET}
      />
      <Stack.Screen
        name="AddressSearch"
        component={AddressSearchScreen}
        options={PICKER_SHEET}
      />
      <Stack.Screen
        name="SelectOption"
        component={SelectOptionScreen}
        options={PICKER_SHEET}
      />
      {/* Full screen, not a sheet: the guide has to be the size of the card
          in the frame, and a sheet leaves the camera too small for that. */}
      <Stack.Screen
        name="ScanId"
        component={ScanIdScreen}
        options={{
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen name="FollowUp" component={FollowUpScreen} />
      <Stack.Screen name="HealthTracking" component={HealthTrackingScreen} />
      <Stack.Screen name="CgmDetail" component={CgmDetailScreen} />
      <Stack.Screen name="VitalDetail" component={VitalDetailScreen} />
      <Stack.Screen name="BmiDetail" component={BmiDetailScreen} />

      <Stack.Screen name="CardReader" component={CardReaderScreen} />
      <Stack.Screen name="ExamRoom" component={ExamRoomScreen} />
      <Stack.Screen
        name="CommunityPatient"
        component={CommunityPatientScreen}
        // The card has been read and the code minted; swiping back to the
        // reader would offer to read it again against a card still in the
        // slot. The session ends by its own control or not at all.
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen
        name="TreatmentHistory"
        component={TreatmentHistoryScreen}
      />
      <Stack.Screen name="Physio" component={PhysioScreen} />
      <Stack.Screen name="HealthScreening" component={HealthScreeningScreen} />
      <Stack.Screen name="AssessmentList" component={AssessmentListScreen} />
      <Stack.Screen name="Screening35" component={Screening35Screen} />
      <Stack.Screen name="Dyspnea" component={DyspneaScreen} />
      <Stack.Screen name="Asthma" component={AsthmaScreen} />
      <Stack.Screen name="Questionnaire" component={QuestionnaireScreen} />
      <Stack.Screen name="Ncd" component={NcdScreen} />
      <Stack.Screen name="Diagnosis" component={DiagnosisScreen} />
      <Stack.Screen name="Medication" component={MedicationScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Consent" component={ConsentScreen} />
      <Stack.Screen name="Facility" component={FacilityScreen} />
      <Stack.Screen name="Pin" component={PinScreen} />
      <Stack.Screen name="Unlock" component={UnlockScreen} />
      <Stack.Screen
        name="SecuritySettings"
        component={SecuritySettingsScreen}
      />
      <Stack.Screen name="HomeVisit" component={HomeVisitScreen} />
      <Stack.Screen name="TaskList" component={TaskListScreen} />
      <Stack.Screen name="PostingLog" component={PostingLogScreen} />
      <Stack.Screen name="Assistant" component={AssistantScreen} />
      <Stack.Screen name="CareActivities" component={CareActivitiesScreen} />
      <Stack.Screen
        name="OpenVaccineSession"
        component={OpenVaccineSessionScreen}
      />
      <Stack.Screen name="VaccineSession" component={VaccineSessionScreen} />
      <Stack.Screen name="GrowthRecord" component={GrowthRecordScreen} />
      <Stack.Screen name="GrowthHistory" component={GrowthHistoryScreen} />
      <Stack.Screen name="DspmRecord" component={DspmRecordScreen} />
      <Stack.Screen name="DentalRecord" component={DentalRecordScreen} />
      <Stack.Screen name="DspmHistory" component={DspmHistoryScreen} />
      <Stack.Screen name="VaccineResult" component={VaccineResultScreen} />
      <Stack.Screen name="VaccineHistory" component={VaccineHistoryScreen} />
      <Stack.Screen
        name="VaccineHistoryDetail"
        component={VaccineHistoryDetailScreen}
      />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen
        name="NotificationTest"
        component={NotificationTestScreen}
      />
      <Stack.Screen name="AcceptTask" component={AcceptTaskScreen} />
      <Stack.Screen name="ExploreMap" component={ExploreMapScreen} />
      <Stack.Screen name="HouseMap" component={HouseMapScreen} />

      <Stack.Screen name="ProfileSettings" component={ProfileSettingsScreen} />
      <Stack.Screen name="DisplaySettings" component={DisplaySettingsScreen} />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
      />
      <Stack.Screen
        name="LanguageSettings"
        component={LanguageSettingsScreen}
      />
      <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
      <Stack.Screen name="ReportProblem" component={ReportProblemScreen} />
      <Stack.Screen name="AuthenCode" component={AuthenCodeScreen} />
      <Stack.Screen name="Supplies" component={SuppliesScreen} />
      <Stack.Screen name="Notes" component={NotesScreen} />
      <Stack.Screen name="Note" component={NoteScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      <Stack.Screen name="About" component={AboutScreen} />

      {/* Search sits over the page that called it, not beside it: a
          transparent modal, so the screen underneath stays on show and the
          blur has something real to work on. Fading rather than sliding —
          Spotlight drops in place, it does not arrive from an edge. */}
      <Stack.Screen
        name="Spotlight"
        component={SpotlightScreen}
        options={{
          presentation: "transparentModal",
          animation: "fade",
          animationDuration: 220,
        }}
      />

      {/* A record about one person, over the house it belongs to — the system
          sheet, so the page behind recedes the way iOS does it. */}
    </Stack.Navigator>
  );
}
