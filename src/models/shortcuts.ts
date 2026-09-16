import type { ComponentType } from "react";
import { useSyncExternalStore } from "react";
import { File, Paths } from "expo-file-system";
import { ChartNoAxesColumn, NotebookPen } from "lucide-react-native";

import type { RootStackParamList } from "../navigation/RootStack";

/**
 * The shortcuts on the home page.
 *
 * A round has a shape, and it is not the same shape for every carer: one
 * spends the morning reading cards at a clinic, another walks a village
 * with a map open. So the row under the day's figures is the carer's own —
 * five to begin with, and whatever they put there after.
 *
 * Kept next to the session rather than in it: signing out ends a session
 * and should not rearrange somebody's home page.
 */
export type ShortcutKey =
  | "map"
  | "follow"
  | "tasks"
  | "houses"
  | "community"
  | "dental"
  | "vaccine"
  | "notes"
  | "report";

export type Shortcut = {
  key: ShortcutKey;
  label: string;
  /** Where it goes. A tab, a pushed screen, or nowhere yet. */
  target?: { tab: "Home" | "Plan" | "Services" | "Profile" } | { route: keyof RootStackParamList };
  /** The picture, where the app has one drawn for it. */
  image?: ReturnType<typeof require>;
  /** A glyph, for the ones that have no picture yet. */
  Icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
};

export const SHORTCUTS: Shortcut[] = [
  {
    key: "map",
    label: "แผนที่",
    target: { route: "HouseMap" },
    image: require("../../assets/images/house_location.png"),
  },
  {
    key: "follow",
    label: "ติดตามสุขภาพ",
    target: { route: "FollowUp" },
    image: require("../../assets/services/health.png"),
  },
  {
    key: "tasks",
    label: "ภารกิจใหม่",
    target: { route: "TaskList" },
    image: require("../../assets/images/svc_assess.png"),
  },
  {
    key: "houses",
    label: "บ้านที่ดูแล",
    target: { route: "Houses" },
    image: require("../../assets/services/houses.png"),
  },
  {
    key: "community",
    label: "งานชุมชน",
    target: { route: "CardReader" },
    image: require("../../assets/images/id_card.png"),
  },
  {
    key: "dental",
    label: "ทันตกรรม",
    image: require("../../assets/services/dental.png"),
  },
  {
    key: "vaccine",
    label: "วัคซีน",
    image: require("../../assets/services/vaccine.png"),
  },
  // No page of their own yet. They are on the list because the row is what
  // a carer arranges their round with, and leaving them off until the
  // screens exist would mean rearranging it twice.
  { key: "notes", label: "สมุดจด", Icon: NotebookPen },
  { key: "report", label: "รายงาน", Icon: ChartNoAxesColumn },
];

/** What a carer starts with: the five a round opens on. */
export const DEFAULT_SHORTCUTS: ShortcutKey[] = ["map", "follow", "tasks", "houses", "community"];

export function shortcutOf(key: ShortcutKey): Shortcut | undefined {
  return SHORTCUTS.find((s) => s.key === key);
}

/* ----------------------------------------------------------- the store */

let chosen: ShortcutKey[] = DEFAULT_SHORTCUTS;
const watchers = new Set<() => void>();
const store = () => new File(Paths.document, "shortcuts.json");

function notify(): void {
  for (const w of watchers) w();
}

async function persist(): Promise<void> {
  try {
    const f = store();
    if (!f.exists) f.create({ intermediates: true });
    f.write(JSON.stringify(chosen));
  } catch {
    // A home page that cannot save its own row is still a home page.
  }
}

/** Read what was saved, before the first render. */
export async function hydrateShortcuts(): Promise<void> {
  try {
    const f = store();
    if (!f.exists) return;
    const saved = JSON.parse(await f.text()) as unknown;
    if (Array.isArray(saved)) {
      // Anything saved under a key this build no longer has is dropped
      // rather than crashing the row it was on.
      const keys = saved.filter((k): k is ShortcutKey => SHORTCUTS.some((s) => s.key === k));
      if (keys.length > 0) chosen = keys;
    }
  } catch {
    chosen = DEFAULT_SHORTCUTS;
  }
  notify();
}

export function useShortcuts(): ShortcutKey[] {
  return useSyncExternalStore(
    (onChange) => {
      watchers.add(onChange);
      return () => {
        watchers.delete(onChange);
      };
    },
    () => chosen,
  );
}

/** Replace the row. Order is the order they were chosen in. */
export function setShortcuts(keys: ShortcutKey[]): void {
  chosen = keys;
  notify();
  void persist();
}

export function toggleShortcut(key: ShortcutKey): void {
  setShortcuts(chosen.includes(key) ? chosen.filter((k) => k !== key) : [...chosen, key]);
}
