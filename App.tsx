import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
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
import { hydratePostingLog } from "./src/models/postingLog";
import { hydrateNotices } from "./src/models/notifications";
import { watchNotices } from "./src/utils/push";
import { devInitialState } from "./src/navigation/devEntry";
import { ToastHost } from "./src/components/Toast";
import { applyThaiFont } from "./src/theme/thaiFont";

export default function App() {
  const [fontsLoaded] = useFonts({
    Sarabun_400Regular,
    Sarabun_500Medium,
    Sarabun_600SemiBold,
    Sarabun_700Bold,
    Sarabun_800ExtraBold,
  });

  // Patch only once the faces exist, or the first render resolves to a family
  // that has not loaded and Thai text falls back to the system font.
  useEffect(() => {
    if (fontsLoaded) applyThaiFont();
  }, [fontsLoaded]);

  // Ask for the PIN (or the face) when the app comes back after a while away.
  useEffect(() => installAutoLock(), []);

  // The saved session decides which page the app opens on, so it is read
  // before the navigator is built — the fonts are waited on the same way.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    Promise.all([hydrate(), hydrateShortcuts(), hydratePostingLog(), hydrateNotices()]).finally(() => setHydrated(true));
  }, []);

  // Anything the system delivers is written into the app's own list too, so
  // the bell's count is right however the notice arrived.
  useEffect(() => watchNotices(), []);

  if (!fontsLoaded || !hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* `initialState` is undefined unless a build asked for a screen —
            see devEntry. */}
        <NavigationContainer ref={navigationRef} initialState={devInitialState()}>
          <StatusBar style="dark" />
          <RootStack />
          <ToastHost />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
