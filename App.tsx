import { useEffect, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { Appearance, useColorScheme } from "react-native";
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  type NavigationState,
} from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  useFonts,
  Sarabun_400Regular,
  Sarabun_500Medium,
  Sarabun_600SemiBold,
  Sarabun_700Bold,
  Sarabun_800ExtraBold,
} from "@expo-google-fonts/sarabun";

import { RootStack } from "./src/navigation/RootStack";
import { navigationRef } from "./src/navigation/navigationRef";
import { installAutoLock } from "./src/models/autoLock";
import { hydrate } from "./src/models/session";
import { hydrateShortcuts } from "./src/models/shortcuts";
import { hydrateNotes } from "./src/models/notes";
import { hydrateSupplies } from "./src/models/supplies";
import { hydrateChat } from "./src/models/assistantChat";
import { hydrateVaccineHistory } from "./src/models/vaccineHistory";
import { hydrateOpenSession } from "./src/models/openSession";
import { hydrateDisplay, useDisplay } from "./src/models/display";
import { applyTheme } from "./src/theme/tokens";
import { hydratePostingLog } from "./src/models/postingLog";
import { hydrateNotices } from "./src/models/notifications";
import { watchNotices } from "./src/utils/push";
import { devInitialState } from "./src/navigation/devEntry";
import { ToastHost } from "./src/components/Toast";
import { DateCalendarHost } from "./src/components/DatePopover";
import { OptionMenuHost } from "./src/components/OptionMenu";
import { AlertHost, installAlertDialog } from "./src/components/AlertDialog";
import { patchText } from "./src/theme/thaiFont";
import { patchForAndroid } from "./src/theme/androidParity";

/*
  Before the first render, not from an effect.

  An effect runs after the paint it belongs to, so the screen that set it
  off would draw once with the wrong font and the wrong size and never be
  asked to draw again. Nothing renders text before this point in any case —
  the app returns null until the faces and the saved settings are in.
*/
patchText();
/*
  And the handful of controls that are a different native control on each
  platform rather than a differently coloured one. A no-op on iOS, where
  each of them already is what the other side is being given.
*/
patchForAndroid();
installAlertDialog();

export default function App() {
  const [fontsLoaded] = useFonts({
    Sarabun_400Regular,
    Sarabun_500Medium,
    Sarabun_600SemiBold,
    Sarabun_700Bold,
    Sarabun_800ExtraBold,
  });

  // Ask for the PIN (or the face) when the app comes back after a while away.
  useEffect(() => installAutoLock(), []);

  // The saved session decides which page the app opens on, so it is read
  // before the navigator is built — the fonts are waited on the same way.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    Promise.all([
      hydrate(),
      hydrateShortcuts(),
      hydrateNotes(),
      hydrateSupplies(),
      hydratePostingLog(),
      hydrateNotices(),
      hydrateDisplay(),
      hydrateChat(),
      hydrateVaccineHistory(),
      hydrateOpenSession(),
    ]).finally(() => setHydrated(true));
  }, []);

  // Anything the system delivers is written into the app's own list too, so
  // the bell's count is right however the notice arrived.
  useEffect(() => watchNotices(), []);

  // Where the carer is, kept across the remount a display change causes.
  const display = useDisplay();
  const navState = useRef<NavigationState | undefined>(undefined);

  /*
    The ground the app paints on, settled before anything draws.

    "system" follows the phone, which is what most people want and what the
    app ships with. Applied here in the render rather than in an effect for
    the same reason the text patch is: an effect lands after the paint, and
    the paint it lands after would be the wrong colour.

    The tokens are module bindings, so this is a write, not state — the
    remount below is what makes every screen read them again.
  */
  const device = useColorScheme();
  const dark =
    display.theme === "system" ? device === "dark" : display.theme === "dark";
  applyTheme(dark ? "dark" : "light");

  /*
    And the same word to UIKit, which is not ours to paint.

    The tab bar, the alerts, the keyboard and the date wheels are system
    views: they read the process's own interface style, not a React prop, so
    a carer who put the app into dark on a light phone got a milky white tab
    bar under a black page. `setColorScheme` overrides that style for the
    whole app. Passing null hands it back to the phone, which is what
    "system" means — and is why this reads `display.theme` rather than the
    resolved `dark`: overriding on "system" would answer `useColorScheme`
    with our own override for ever after.
  */
  Appearance.setColorScheme(display.theme === "system" ? null : display.theme);

  if (!fontsLoaded || !hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* `initialState` is undefined unless a build asked for a screen —
            see devEntry. */}
        {/*
          Keyed on the text size, and holding its place across the swap.

          Sizes are written into the styles at every call site, and the
          patch that scales them runs as each `Text` renders — so a change
          only shows on screens that render again. Remounting is what makes
          the whole app take a new size at once, and the state kept here is
          what stops that remount throwing the carer back to the first page
          of the app while they are still on the settings screen.
        */}
        <NavigationContainer
          key={`${display.textSize}-${dark ? "dark" : "light"}`}
          ref={navigationRef}
          initialState={navState.current ?? devInitialState()}
          onStateChange={(next) => {
            navState.current = next;
          }}
          // The navigator's own chrome — the card behind a pushed screen
          // while it slides — which is not ours to paint.
          theme={dark ? DarkTheme : DefaultTheme}
        >
          <StatusBar style={dark ? "light" : "dark"} />
          <RootStack />
          {/*
            Over the whole app, and inside its window rather than in a modal
            of its own: the calendar the date titles open is blurred glass,
            and Android's blur can only read the window it is drawn in.
          */}
          <DateCalendarHost />
          {/* The select fields' dropdown on Android, over the whole app for
              the calendar's reasons. */}
          <OptionMenuHost />
          {/* `Alert.alert`, drawn as the app's own dialog on both. */}
          <AlertHost />
          <ToastHost />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
