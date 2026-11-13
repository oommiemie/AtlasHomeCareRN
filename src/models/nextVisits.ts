import { File, Paths } from "expo-file-system";

import { yearTasks, type Task, type VisitType } from "./task";
import { tr } from "../i18n";
import { onDemoReset } from "./demoReset";

/**
 * Visits booked at the end of another one.
 *
 * Closing a case offers the next appointment, and the one chosen joins the
 * plan like any other visit: on the calendar, on the home page that day, and
 * openable to record. The plan is sample data built at start-up, so each
 * booking is written down here and laid back onto it every launch — the
 * same way closed visits are.
 */

type Saved = Omit<Task, "dueAt" | "postedAt"> & { dueAt: number; postedAt: number };

let booked: Saved[] = [];
const store = () => new File(Paths.document, "next-visits.json");

onDemoReset(() => {
  const ids = new Set(booked.map((b) => b.id));
  for (let i = yearTasks.length - 1; i >= 0; i--) {
    if (ids.has(yearTasks[i].id)) yearTasks.splice(i, 1);
  }
  booked = [];
  const f = store();
  if (f.exists) f.delete();
});

/** A suggested gap, in days, by the kind of visit just made. */
export function suggestedGap(type: VisitType | undefined): number {
  switch (type) {
    case "เยี่ยมหลังคลอด":
    case "เยี่ยมหลัง D/C":
    case "เยี่ยมก่อน Admit":
      return 7;
    case "เยี่ยมต่อเนื่อง":
      return 14;
    default:
      return 30;
  }
}

/** The choices offered, in days; 0 is "no follow-up". */
export const GAP_CHOICES: { days: number; label: string }[] = [
  { days: 0, label: tr("ไม่นัด", "None") },
  { days: 7, label: tr("1 สัปดาห์", "1 week") },
  { days: 14, label: tr("2 สัปดาห์", "2 weeks") },
  { days: 30, label: tr("1 เดือน", "1 month") },
];

/** The date a gap lands on: the same time of day as the visit it follows. */
export function nextDate(from: Task, days: number, today: Date): Date {
  const base = new Date(Math.max(from.dueAt.getTime(), today.getTime()));
  const at = new Date(base);
  at.setDate(at.getDate() + days);
  at.setHours(from.dueAt.getHours(), from.dueAt.getMinutes(), 0, 0);
  return at;
}

function revive(s: Saved): Task {
  return { ...s, dueAt: new Date(s.dueAt), postedAt: new Date(s.postedAt) };
}

function persist(): void {
  try {
    store().write(JSON.stringify(booked));
  } catch {
    // Kept for this launch; the next booking tries again.
  }
}

/** Book the visit after `from`, and put it on the plan. */
export function bookNextVisit(from: Task, dueAt: Date): Task {
  const t: Task = {
    id: `next-${from.id}-${dueAt.getTime()}`,
    residentId: from.residentId,
    name: from.name,
    age: from.age,
    detail: from.detail,
    dueAt,
    postedAt: new Date(),
    status: "pending",
    lat: from.lat,
    lng: from.lng,
    address: from.address,
    visitType: "เยี่ยมต่อเนื่อง",
  };
  if (!yearTasks.some((x) => x.id === t.id)) yearTasks.push(t);
  booked = [
    ...booked.filter((b) => b.id !== t.id),
    { ...t, dueAt: dueAt.getTime(), postedAt: t.postedAt.getTime() },
  ];
  persist();
  return t;
}

/** Lays the visits booked before back onto the plan, at launch. */
export async function hydrateNextVisits(): Promise<void> {
  try {
    const f = store();
    if (!f.exists) return;
    const saved = JSON.parse(await f.text()) as Saved[];
    if (!Array.isArray(saved)) return;
    booked = saved;
    for (const s of saved) {
      if (!yearTasks.some((x) => x.id === s.id)) yearTasks.push(revive(s));
    }
  } catch {
    booked = [];
  }
}
