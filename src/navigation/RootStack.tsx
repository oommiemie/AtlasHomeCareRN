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
import type { NavigatorScreenParams } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createNativeBottomTabNavigator } from "@bottom-tabs/react-navigation";

import { CANVAS, PRIMARY_500 } from "../theme/tokens";
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
import { ResidentSheet } from "../screens/ResidentSheet";
import { FollowUpScreen } from "../screens/FollowUpScreen";
import { CgmDetailScreen } from "../screens/CgmDetailScreen";
import type { MetricKind } from "../models/vitals";
import { VitalDetailScreen } from "../screens/VitalDetailScreen";
import { BmiDetailScreen } from "../screens/BmiDetailScreen";
import { CardReaderScreen } from "../screens/CardReaderScreen";
import { ExamRoomScreen } from "../screens/ExamRoomScreen";
import { CommunityPatientScreen } from "../screens/CommunityPatientScreen";
import { HealthScreeningScreen } from "../screens/HealthScreeningScreen";
import { AssessmentListScreen } from "../screens/AssessmentListScreen";
import type { CardHolder, ExamRoomKey } from "../models/community";
import { HealthTrackingScreen } from "../screens/HealthTrackingScreen";
import { TaskListScreen } from "../screens/TaskListScreen";
import { AcceptTaskScreen } from "../screens/AcceptTaskScreen";
import { ExploreMapScreen } from "../screens/ExploreMapScreen";
import { NotificationSettingsScreen } from "../screens/NotificationSettingsScreen";
import { LanguageSettingsScreen } from "../screens/LanguageSettingsScreen";
import { HelpCenterScreen } from "../screens/HelpCenterScreen";
import { ReportProblemScreen } from "../screens/ReportProblemScreen";
import { SpotlightScreen } from "../screens/SpotlightScreen";
import type { House, Resident, Village } from "../models/household";
import type { Place } from "../models/place";
import type { Task } from "../models/task";

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
  Resident: { resident: Resident };
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
  CommunityPatient: { holder: CardHolder; room: ExamRoomKey };
  HealthScreening: { holder: CardHolder };
  AssessmentList: { holder: CardHolder };
  TaskList: undefined;
  AcceptTask: { task: Task };
  ExploreMap: { focus?: Task } | undefined;
  NotificationSettings: undefined;
  LanguageSettings: undefined;
  HelpCenter: undefined;
  ReportProblem: undefined;
  Spotlight: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Plan: undefined;
  Services: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createNativeBottomTabNavigator<MainTabParamList>();

function MainTabs() {
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
      // Opaque: translucent lets list content bleed behind the labels.
      translucent={false}
      scrollEdgeAppearance="opaque"
      tabBarStyle={{ backgroundColor: "#FFFFFF" }}
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
          title: "หน้าแรก",
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
          title: "แผนเยี่ยม",
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
          title: "บริการ",
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
          title: "ฉัน",
          tabBarIcon: ({ focused }) =>
            focused
              ? require("../../assets/tabs/profile_solid.png")
              : require("../../assets/tabs/profile.png"),
        }}
      />
    </Tab.Navigator>
  );
}

export function RootStack() {
  return (
    <Stack.Navigator
      initialRouteName="Main"
      screenOptions={{
        // Screens draw their own headers: the design puts a glass back button
        // and the title over the content, not in a bar above it.
        headerShown: false,
        contentStyle: { backgroundColor: CANVAS },
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
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="AddMember"
        component={AddMemberScreen}
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="AddressSearch"
        component={AddressSearchScreen}
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="SelectOption"
        component={SelectOptionScreen}
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
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
      <Stack.Screen name="HealthScreening" component={HealthScreeningScreen} />
      <Stack.Screen name="AssessmentList" component={AssessmentListScreen} />
      <Stack.Screen name="TaskList" component={TaskListScreen} />
      <Stack.Screen name="AcceptTask" component={AcceptTaskScreen} />
      <Stack.Screen name="ExploreMap" component={ExploreMapScreen} />

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
      <Stack.Screen
        name="Resident"
        component={ResidentSheet}
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
    </Stack.Navigator>
  );
}
