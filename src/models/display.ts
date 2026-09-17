import { useSyncExternalStore } from "react";
import { File, Paths } from "expo-file-system";

/**
 * How the app presents itself — the carer's own choices about the shell.
 *
 * Kept beside the shortcuts rather than inside the session: signing out
 * ends a session and has no business rearranging somebody's phone. Each of
 * these actually does something; a page of switches that only remember
 * themselves would be worse than no page.
 */

/** The five steps the app's text can be set at. */
export type TextSize = "xs" | "s" | "m" | "l" | "xl";

/**
 * What each step does to a size written in the app.
 *
 * Multipliers rather than a set of sizes, because every size in the app is
 * written where it is used — a scale is the only thing that can move all of
 * them at once. The ends are deliberately short of the system's own
 * accessibility sizes: this is a comfort control, not a replacement for
 * Dynamic Type, and the app's cards have to still hold their layout at
 * either end of it.
 */
export const TEXT_SIZES: { key: TextSize; label: string; scale: number }[] = [
  { key: "xs", label: "เล็กมาก", scale: 0.85 },
  { key: "s", label: "เล็ก", scale: 0.92 },
  { key: "m", label: "ปกติ", scale: 1 },
  { key: "l", label: "ใหญ่", scale: 1.12 },
  { key: "xl", label: "ใหญ่มาก", scale: 1.24 },
];

export const scaleOf = (size: TextSize): number =>
  TEXT_SIZES.find((t) => t.key === size)?.scale ?? 1;

/** Light, dark, or whatever the phone is set to. */
export type ThemeChoice = "light" | "dark" | "system";

export type Display = {
  /** Which ground the app paints on. */
  theme: ThemeChoice;
  /** How big the app writes. */
  textSize: TextSize;
  /** Names under the tab bar's glyphs. */
  tabLabels: boolean;
  /**
   * Cuts the app's own animations to nothing.
   *
   * Not the system's Reduce Motion — that is a device-wide accessibility
   * setting and the app must not write to it. This is the app's own, for
   * a carer who finds things sliding about while they are trying to read.
   */
  reduceMotion: boolean;
};

const DEFAULTS: Display = {
  theme: "system",
  textSize: "m",
  tabLabels: true,
  reduceMotion: false,
};

let display: Display = DEFAULTS;
const watchers = new Set<() => void>();

const store = () => new File(Paths.document, "display.json");

function commit(next: Display): void {
  display = next;
  try {
    store().write(JSON.stringify(display));
  } catch {
    // The next change tries again; a failed write lasts the launch.
  }
  for (const w of watchers) w();
}

/** Read the choices back at launch. A missing file is the defaults. */
export async function hydrateDisplay(): Promise<void> {
  try {
    const f = store();
    if (!f.exists) return;
    const saved = JSON.parse(await f.text()) as Partial<Display>;
    // Merged over the defaults, so a build that adds a setting does not
    // have to migrate anybody's file.
    display = { ...DEFAULTS, ...saved };
  } catch {
    display = DEFAULTS;
  }
  for (const w of watchers) w();
}

/** The choices as they are right now, for code that is not a component. */
export function currentDisplay(): Display {
  return display;
}

export function useDisplay(): Display {
  return useSyncExternalStore(
    (onChange) => {
      watchers.add(onChange);
      return () => {
        watchers.delete(onChange);
      };
    },
    () => display,
  );
}

export function setTheme(theme: ThemeChoice): void {
  commit({ ...display, theme });
}

export function setTextSize(size: TextSize): void {
  commit({ ...display, textSize: size });
}

export function setTabLabels(on: boolean): void {
  commit({ ...display, tabLabels: on });
}

export function setReduceMotion(on: boolean): void {
  commit({ ...display, reduceMotion: on });
}
