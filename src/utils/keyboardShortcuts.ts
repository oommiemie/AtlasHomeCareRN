import { useEffect } from "react";
import { Platform } from "react-native";

import { navigationRef } from "../navigation/navigationRef";

/**
 * Keyboard shortcuts, where there is a keyboard to press them on.
 *
 * ⌘K or ⌘F opens search, ⌘1–⌘4 the four tabs, ⌘N starts the day's round,
 * and Esc goes back. Ctrl stands in for ⌘ off a Mac. Typing into a field
 * is left alone, except for Esc.
 *
 * The web build only, for now: an iPad app hears a hardware keyboard
 * through UIKit's key commands, which need native code on the iOS side.
 */
const TABS = ["Home", "Plan", "Services", "Profile"] as const;

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (!navigationRef.isReady()) return;
      const typing =
        e.target instanceof HTMLElement &&
        (e.target.isContentEditable || /^(INPUT|TEXTAREA)$/.test(e.target.tagName));
      if (e.key === "Escape") {
        if (navigationRef.canGoBack()) {
          e.preventDefault();
          navigationRef.goBack();
        }
        return;
      }
      if (typing || !(e.metaKey || e.ctrlKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      const go = (fn: () => void) => {
        e.preventDefault();
        fn();
      };
      if (key === "k" || key === "f") go(() => navigationRef.navigate("Spotlight" as never));
      else if (key === "n") go(() => navigationRef.navigate("Round" as never));
      else if (/^[1-4]$/.test(key)) {
        const tab = TABS[Number(key) - 1];
        go(() => navigationRef.navigate("Main", { screen: tab }));
      }
    };
    // Capture, so a focused field (search swallows Esc) does not hide the key.
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);
}
