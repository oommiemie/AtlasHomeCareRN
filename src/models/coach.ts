import { useSyncExternalStore } from "react";

/**
 * Which guided tours are owed.
 *
 * Each page with a tour has a key. The end of the first-run steps and the help
 * page's "ดูวิธีใช้งานอีกครั้ง" arm all of them; each page's tour clears its
 * own key once it is finished or skipped, so the home tour plays on arrival
 * and the patient page's the first time one is opened after that. Held in
 * memory only, which is what lets a demo show them again: signing out runs
 * the first-run steps again, and they end by arming the tours.
 */
export type CoachKey = "home" | "patient";
const ALL: CoachKey[] = ["home", "patient"];

let due = new Set<CoachKey>();
const watchers = new Set<() => void>();

function notify(): void {
  for (const w of watchers) w();
}

/** Owe every tour again. */
export function startCoach(): void {
  due = new Set(ALL);
  notify();
}

/** This page's tour is done with, finished or skipped. */
export function finishCoach(key: CoachKey): void {
  if (!due.has(key)) return;
  due = new Set([...due].filter((k) => k !== key));
  notify();
}

export function useCoachDue(key: CoachKey): boolean {
  return useSyncExternalStore(
    (w) => {
      watchers.add(w);
      return () => {
        watchers.delete(w);
      };
    },
    () => due.has(key),
  );
}
