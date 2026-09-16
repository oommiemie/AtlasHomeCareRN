import { useEffect, useState } from "react";

import { SnackBar, type SnackTone } from "./SnackBar";

/**
 * A brief message at the bottom of the screen.
 *
 * A module-level emitter rather than context: the callers are one-line "not
 * wired up yet" notices scattered through screens that have no other reason
 * to take a provider, and threading one through every screen for that would
 * cost more than it explains.
 *
 * Drawn by the same glass capsule the sheets use, so a word from anywhere in
 * the app arrives the same way.
 */
type Listener = (message: string, tone: SnackTone) => void;
let listener: Listener | null = null;

export function toast(message: string, tone: SnackTone = "info"): void {
  listener?.(message, tone);
}

export function ToastHost() {
  const [shown, setShown] = useState<{ message: string; tone: SnackTone; at: number } | null>(null);

  useEffect(() => {
    listener = (message, tone) => setShown({ message, tone, at: Date.now() });
    return () => {
      listener = null;
    };
  }, []);

  useEffect(() => {
    if (shown == null) return;
    const t = setTimeout(() => setShown(null), 2200);
    return () => clearTimeout(t);
  }, [shown]);

  // Above the tab bar, which is where most of these are read.
  return <SnackBar message={shown?.message ?? null} tone={shown?.tone ?? "info"} offset={90} />;
}
