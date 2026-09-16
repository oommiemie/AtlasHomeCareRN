import { AppState, type AppStateStatus } from "react-native";

import { navigationRef } from "../navigation/navigationRef";
import { currentSession } from "./session";

/**
 * The lock, applied on the way back in.
 *
 * A carer's phone goes in a pocket between houses and comes out with the
 * last patient's record still open. So: when the app has been in the
 * background longer than this, the next thing on screen is the PIN page —
 * which opens on Face ID by itself where that is switched on, and takes the
 * six digits otherwise. Shorter absences (a call, a message) are let
 * through; a lock on every glance away would be put up with for a day and
 * switched off on the second.
 *
 * Nothing to lock until a PIN exists, and never over the sign-in steps
 * themselves.
 */
const AFTER_MS = 60_000;
const OPEN = new Set(["Login", "Consent", "Facility", "Pin", "Unlock"]);

let hiddenAt: number | null = null;

function onChange(state: AppStateStatus) {
  if (state === "background") {
    hiddenAt = Date.now();
    return;
  }
  if (state !== "active" || hiddenAt == null) return;
  const away = Date.now() - hiddenAt;
  hiddenAt = null;
  if (away < AFTER_MS) return;
  if (currentSession().pin == null) return;
  if (!navigationRef.isReady()) return;
  const here = navigationRef.getCurrentRoute()?.name;
  if (here != null && OPEN.has(here)) return;
  navigationRef.navigate("Pin", { mode: "unlock" });
}

/** Start watching. Returns the function that stops. */
export function installAutoLock(): () => void {
  const sub = AppState.addEventListener("change", onChange);
  return () => sub.remove();
}
