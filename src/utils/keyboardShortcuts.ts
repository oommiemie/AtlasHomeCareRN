import { useEffect } from "react";
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

import { navigationRef } from "../navigation/navigationRef";

/**
 * Keyboard shortcuts, wherever there is a keyboard to press them on.
 *
 * ⌘K or ⌘F opens search, ⌘1–⌘4 the four tabs, ⌘N starts the day's round,
 * and Esc goes back. Ctrl stands in for ⌘ off a Mac.
 *
 * On the web they are the page's own key events. On an iPad with a keyboard
 * attached they come from UIKit's key commands through the AtlasKeys module
 * (modules/atlas-keys); a build without it simply has none.
 */
const TABS = ["Home", "Plan", "Services", "Profile"] as const;

type KeyEvent = { key: string; meta: boolean };
type KeysModule = {
  addListener(name: "onKey", fn: (e: KeyEvent) => void): { remove(): void };
};

/** One press, decided the same way whichever platform heard it. Handled? */
function handle({ key, meta }: KeyEvent): boolean {
  if (!navigationRef.isReady()) return false;
  if (key === "Escape") {
    if (!navigationRef.canGoBack()) return false;
    navigationRef.goBack();
    return true;
  }
  if (!meta) return false;
  const k = key.toLowerCase();
  if (k === "k" || k === "f") navigationRef.navigate("Spotlight" as never);
  else if (k === "n") navigationRef.navigate("Round" as never);
  else if (/^[1-4]$/.test(k)) navigationRef.navigate("Main", { screen: TABS[Number(k) - 1] });
  else return false;
  return true;
}

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    if (Platform.OS === "ios") {
      const keys = requireOptionalNativeModule<KeysModule>("AtlasKeys");
      const sub = keys?.addListener("onKey", handle);
      return () => sub?.remove();
    }
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLElement &&
        (e.target.isContentEditable || /^(INPUT|TEXTAREA)$/.test(e.target.tagName));
      // Typing into a field keeps its keys, except Esc.
      if (e.key !== "Escape" && (typing || e.altKey)) return;
      if (handle({ key: e.key, meta: e.metaKey || e.ctrlKey })) e.preventDefault();
    };
    // Capture, so a focused field (search swallows Esc) does not hide the key.
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);
}
