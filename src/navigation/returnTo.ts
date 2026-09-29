import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "./RootStack";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Go back to a page, rather than on to a second copy of it.
 *
 * React Navigation 7's `navigate` no longer goes back to a page already in
 * the stack: it pushes another one on top. Every "and now return to the
 * list" in the app written as `navigate` therefore left the finished flow
 * underneath, and Back from the list walked the carer into a job they had
 * just closed. This pops to the page where it is in the stack; where it is
 * not — the flow was started from somewhere else — it starts the stack
 * again from the tabs with the page on top, so Back goes home, not into
 * the flow.
 */
export function returnTo<K extends keyof RootStackParamList>(
  nav: Nav,
  name: K,
  ...params: undefined extends RootStackParamList[K]
    ? [RootStackParamList[K]?]
    : [RootStackParamList[K]]
): void {
  const state = nav.getState();
  if (state.routes.some((r) => r.name === name)) {
    // Loosely typed at the call: the params are checked by the signature.
    (nav.popTo as (n: K, p?: object) => void)(name, params[0] as object);
    return;
  }
  // The tabs as they are, with their own state, and the page over them.
  (nav.reset as (s: object) => void)({
    index: 1,
    routes: [state.routes[0], { name, params: params[0] }],
  });
}
