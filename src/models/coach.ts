import { useSyncExternalStore } from "react";

/**
 * Whether the home page owes the carer its guided tour.
 *
 * Asked for at the end of the first-run steps and from the help page, and
 * cleared when the tour is finished or skipped. Held in memory only, which
 * is what lets a demo show it again: signing out runs the first-run steps
 * again, and they end by asking for it.
 */
let due = false;
const watchers = new Set<() => void>();

function set(next: boolean): void {
  if (due === next) return;
  due = next;
  for (const w of watchers) w();
}

export const startCoach = (): void => set(true);
export const finishCoach = (): void => set(false);

export function useCoachDue(): boolean {
  return useSyncExternalStore(
    (w) => {
      watchers.add(w);
      return () => {
        watchers.delete(w);
      };
    },
    () => due,
  );
}
