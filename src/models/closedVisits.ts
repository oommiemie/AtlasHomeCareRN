import { useSyncExternalStore } from "react";
import { File, Paths } from "expo-file-system";

import { toast } from "../components/Toast";
import { tr } from "../i18n";
import { yearTasks, type Task } from "./task";
import { onDemoReset } from "./demoReset";

/**
 * The visits a carer has closed with "บันทึกและปิดเคส".
 *
 * The plan is sample data built at start-up, so a closed visit is written
 * here by its task id and laid back over the plan each time the app opens:
 * the task itself is marked done, so the plan, the home page, the report
 * and the assistant — everything that asks `isDone` — agree that it is.
 */
let closed: string[] = [];
let version = 0;
const watchers = new Set<() => void>();
const store = () => new File(Paths.document, "closed-visits.json");

/** The task a visit holder was opened on, where it was opened on one. */
export function taskIdOf(authenCode: string): string | null {
  return authenCode.startsWith("VISIT-") ? authenCode.slice(6) : null;
}

/** What each closed visit was before it was closed, to put back on a reset. */
const before = new Map<string, Task["status"]>();

function apply(): void {
  const ids = new Set(closed);
  for (const t of yearTasks) {
    if (!ids.has(t.id)) continue;
    if (!before.has(t.id)) before.set(t.id, t.status);
    t.status = "done";
  }
}

onDemoReset(() => {
  for (const t of yearTasks) if (before.has(t.id)) t.status = before.get(t.id);
  before.clear();
  closed = [];
  const f = store();
  if (f.exists) f.delete();
  notify();
});

function notify(): void {
  version += 1;
  for (const w of watchers) w();
}

async function persist(): Promise<void> {
  try {
    const f = store();
    if (!f.exists) f.create({ intermediates: true });
    f.write(JSON.stringify(closed));
  } catch {
    toast(
      tr("บันทึกลงเครื่องไม่สำเร็จ", "Couldn't save to this device"),
      "error",
    );
  }
}

export async function hydrateClosedVisits(): Promise<void> {
  try {
    const f = store();
    if (!f.exists) return;
    const saved = JSON.parse(await f.text()) as unknown;
    if (Array.isArray(saved)) closed = saved.filter((x) => typeof x === "string");
  } catch {
    closed = [];
  }
  apply();
  notify();
}

/** Close a visit: it counts as done from now on, here and after a restart. */
export function closeVisit(taskId: string): void {
  if (!closed.includes(taskId)) closed = [...closed, taskId];
  apply();
  notify();
  void persist();
}

/**
 * Re-renders when a visit is closed. The number it returns changes each
 * time, for a `useMemo` that reads the plan to list among its inputs.
 */
export function useClosedVisits(): number {
  return useSyncExternalStore(
    (onChange) => {
      watchers.add(onChange);
      return () => {
        watchers.delete(onChange);
      };
    },
    () => version,
  );
}
