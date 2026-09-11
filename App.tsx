import { useEffect } from "react";
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

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* `initialState` is undefined unless a build asked for a screen —
            see devEntry. */}
        <NavigationContainer initialState={devInitialState()}>
          <StatusBar style="dark" />
          <RootStack />
          <ToastHost />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
