import { useEffect, useState, type RefObject } from "react";
import { Platform, type View } from "react-native";
import { FullWindowOverlay } from "react-native-screens";

import { focusedPage } from "./BlurStage";
import { SnackBar, type SnackTone } from "./SnackBar";

/**
 * A brief message at the top of the screen.
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

/*
  The hosts, newest last, and a word goes to the newest.

  There was one, at the root of the app — and a sheet is a window of its own
  on top of the root, so every word said while one was open ("บันทึกแล้ว"
  from inside the medication sheet, a failure inside the diagnosis sheet)
  was drawn behind it, where nobody could see it. On Android each drawn
  sheet mounts a host of its own (see `PageSheetModal`), and the newest one
  mounted is the one on top. On iOS the root host is lifted over every
  window instead (`FullWindowOverlay`), so it is the only one there is.
*/
const hosts: Listener[] = [];

export function toast(message: string, tone: SnackTone = "info"): void {
  hosts[hosts.length - 1]?.(message, tone);
}

export function ToastHost({
  blurTarget,
}: {
  /**
   * What this host's snackbar blurs on Android. A sheet names its own
   * contents; the root host, left without one, blurs whichever page is in
   * focus when the word arrives (`focusedPage`).
   */
  blurTarget?: RefObject<View | null>;
} = {}) {
  const [shown, setShown] = useState<{
    message: string;
    tone: SnackTone;
    at: number;
    under: RefObject<View | null> | null;
  } | null>(null);

  useEffect(() => {
    const me: Listener = (message, tone) =>
      setShown({
        message,
        tone,
        at: Date.now(),
        under: blurTarget ?? focusedPage(),
      });
    hosts.push(me);
    return () => {
      const i = hosts.indexOf(me);
      if (i >= 0) hosts.splice(i, 1);
    };
    // A ref, so this runs once per host in practice.
  }, [blurTarget]);

  useEffect(() => {
    if (shown == null) return;
    // Longer for what went wrong or needs a look: those are read, the
    // others are only glanced at.
    const hold =
      shown.tone === "error" || shown.tone === "warning" ? 3600 : 2200;
    const t = setTimeout(() => setShown(null), hold);
    return () => clearTimeout(t);
  }, [shown]);

  // At the top of the screen, under the status bar — see `SnackBar`.
  const bar = (
    <SnackBar
      message={shown?.message ?? null}
      tone={shown?.tone ?? "info"}
      blurTarget={shown?.under}
    />
  );
  // Over every window on iOS, sheets and alerts included; it takes no
  // touches, so nothing under it stops answering.
  return Platform.OS === "ios" ? (
    <FullWindowOverlay>{bar}</FullWindowOverlay>
  ) : (
    bar
  );
}
