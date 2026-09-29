import type { ComponentType } from "react";
import { useSyncExternalStore } from "react";
import { File, Paths } from "expo-file-system";

import { toast } from "../components/Toast";
import { tr } from "../i18n";
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
  | "checkup"
  | "screening"
  | "notes"
  | "report";

export type Shortcut = {
  key: ShortcutKey;
  /** Shown under the tile; the row is saved by `key`, never by this. */
  label: string;
  /**
   * Where it goes. A tab, a pushed screen, or nowhere yet.
   *
   * A pushed screen may need telling which one it is: the three community
   * rounds are one page reached three ways, and it is the parameter that
   * says whether it opens on วัคซีน, ตรวจสุขภาพ or คัดกรอง. Without this
   * the row navigated to that page with nothing, and the page reads its
   * kind out of the params on its first line.
   */
  target?:
    | { tab: "Home" | "Plan" | "Services" | "Profile" }
    | { route: keyof RootStackParamList; params?: object };
  /** The picture, where the app has one drawn for it. */
  image?: ReturnType<typeof require>;
  /** A glyph, for the ones that have no picture yet. */
  Icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
};

export const SHORTCUTS: Shortcut[] = [
  {
    key: "map",
    label: tr("แผนที่", "Map"),
    target: { route: "HouseMap" },
    image: require("../../assets/images/house_location.png"),
  },
  {
    key: "follow",
    label: tr("ติดตามสุขภาพ", "Health follow-up"),
    target: { route: "FollowUp" },
    image: require("../../assets/services/health.png"),
  },
  {
    key: "tasks",
    label: tr("ภารกิจใหม่", "New tasks"),
    target: { route: "TaskList" },
    image: require("../../assets/images/svc_assess.png"),
  },
  {
    key: "houses",
    label: tr("บ้านที่ดูแล", "My households"),
    target: { route: "Houses" },
    image: require("../../assets/services/houses.png"),
  },
  {
    key: "community",
    label: tr("งานชุมชน", "Community"),
    target: { route: "CardReader" },
    image: require("../../assets/images/id_card.png"),
  },
  {
    key: "dental",
    label: tr("ทันตกรรม", "Dental"),
    image: require("../../assets/services/dental.png"),
  },
  /*
    The three community rounds, each its own tile.

    One tr("งานชุมชน", "Community") tile could not stand for them: a vaccination morning at
    a school, a weighing round at a nursery and a developmental screening
    are three different errands with three registers, and a carer who is
    going to one of them wants the one, not a page that asks which. They
    reach the same screen by the kind it is opened with.
  */
  {
    key: "vaccine",
    label: tr("วัคซีน", "Vaccines"),
    target: { route: "CareActivities", params: { kind: "vaccination" } },
    image: require("../../assets/services/vaccine.png"),
  },
  {
    key: "checkup",
    label: tr("ตรวจสุขภาพ", "Health check"),
    target: { route: "CareActivities", params: { kind: "schoolHealth" } },
    image: require("../../assets/services/checkup.png"),
  },
  {
    key: "screening",
    label: tr("คัดกรองเด็ก", "Child screening"),
    target: { route: "CareActivities", params: { kind: "screening" } },
    image: require("../../assets/services/screening.png"),
  },
  /*
    The notebook, and the reports that are still to come.

    They carried lucide glyphs while they waited, which put two line
    drawings in a row of modelled objects — the one tile that is a stroke
    among nine that are things reads as the broken one, whatever it is a
    shortcut to. รายงาน still has no page; it stays on the list because
    the row is what a carer arranges their round with, and leaving it off
    until the screen exists would mean rearranging it twice.
  */
  {
    key: "notes",
    label: tr("สมุดจด", "Notebook"),
    target: { route: "Notes" },
    image: require("../../assets/services/notes.png"),
  },
  {
    key: "report",
    label: tr("รายงาน", "Reports"),
    image: require("../../assets/services/report.png"),
  },
];

/**
 * What a carer starts with, before they have arranged the row themselves.
 *
 * Four rather than five, and not the four that were here. The old set was
 * the app's own oldest pages — the map, the follow-ups, the new postings,
 * the houses — which is a list of what was built first rather than of what
 * a morning starts with. A round opens by looking at where it is going,
 * picking up the community work, and having somewhere to write; the report
 * is the last thing before going home.
 *
 * Only a phone that has never saved a row sees this. Anybody who has
 * already arranged their own keeps it, which is the point of the row —
 * they reach it again through "คืนค่าเริ่มต้น" on the edit sheet.
 */
export const DEFAULT_SHORTCUTS: ShortcutKey[] = [
  "map",
  "community",
  "notes",
  "report",
];

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
    toast(
      tr("บันทึกลงเครื่องไม่สำเร็จ", "Couldn't save to this device"),
      "error",
    );
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
      const keys = saved.filter((k): k is ShortcutKey =>
        SHORTCUTS.some((s) => s.key === k),
      );
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
  setShortcuts(
    chosen.includes(key) ? chosen.filter((k) => k !== key) : [...chosen, key],
  );
}
