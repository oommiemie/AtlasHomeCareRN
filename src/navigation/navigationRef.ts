import { createNavigationContainerRef } from "@react-navigation/native";

import type { RootStackParamList } from "./RootStack";

/**
 * A handle on the navigator from outside any screen.
 *
 * The lock needs to push its page when the app comes back to the
 * foreground, and nothing is rendering at that moment that could call
 * `useNavigation` — so the container is given this ref and the lock uses
 * it. Everything on a screen should keep using the hook.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
