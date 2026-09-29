import { treatmentHistory, type PastVisit } from "./community";
import type { Resident } from "./household";
import { isDone, planToday, yearTasks, type Task } from "./task";
import { startOfDay } from "../utils/thaiDate";

/**
 * What the health profile's tabs show about one person, beyond the readings:
 * the visits planned for them, the visits they have had, and the
 * assessments done at those visits.
 *
 * Read from the same sources the rest of the app reads — the plan calendar
 * and the treatment history — so a visit on this page is a visit on the
 * plan, and not a second list kept beside it.
 */

/** The visits on the plan for this person: still to come, and gone by. */
export function visitsFor(
  resident: Resident,
  now: Date = planToday,
): { upcoming: Task[]; past: Task[] } {
  const today = startOfDay(now).getTime();
  const mine = yearTasks.filter((t) => t.residentId === resident.id);
  return {
    upcoming: mine
      .filter((t) => !isDone(t) && t.dueAt.getTime() >= today)
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime()),
    past: mine
      .filter((t) => isDone(t) || t.dueAt.getTime() < today)
      .sort((a, b) => b.dueAt.getTime() - a.dueAt.getTime()),
  };
}

/** The visits they have had, most recent first. */
export const historyFor = (resident: Resident): PastVisit[] =>
  treatmentHistory(resident.id);

export type PastAssessmentRow = {
  name: string;
  score: string;
  result: string;
  /** Days ago it was done. */
  daysAgo: number;
  /** The day it was done. */
  at: Date;
  /** Who did it.  */
  by: string;
};

/** Every assessment done at those visits, most recent first. */
export function assessmentsFor(
  resident: Resident,
  now: Date = planToday,
): PastAssessmentRow[] {
  return historyFor(resident).flatMap((v) =>
    v.assessments.map((a) => ({
      ...a,
      daysAgo: v.daysAgo,
      at: (() => {
        const d = startOfDay(now);
        d.setDate(d.getDate() - v.daysAgo);
        return d;
      })(),
      by: v.staff,
    })),
  );
}

/** One visit in a person's history, whichever record it came from. */
export type TimelineVisit = {
  id: string;
  at: Date;
  title: string;
  /** The kind of appointment, for a visit from the plan. */
  type?: string;
  summary?: string;
  by?: string;
  /** Set for a visit from the plan, which can be opened again. */
  task?: Task;
  /** Set for a visit from the treatment record, whose detail can be read. */
  record?: PastVisit;
};

/**
 * Every visit this person has had, newest first: the plan's visits that have
 * gone by and the treatment record's, on one line of dates.
 *
 * They were one list of the treatment record alone, dated "so many days
 * ago" — which the plan's own past visits for the same person never
 * appeared in, and which could not be read as a sequence.
 */
export function visitTimeline(
  resident: Resident,
  now: Date = planToday,
): TimelineVisit[] {
  const fromPlan: TimelineVisit[] = visitsFor(resident, now).past.map((t) => ({
    id: t.id,
    at: t.dueAt,
    title: t.detail,
    type: t.visitType,
    task: t,
  }));
  const fromRecord: TimelineVisit[] = historyFor(resident).map((v) => {
    const at = startOfDay(now);
    at.setDate(at.getDate() - v.daysAgo);
    at.setHours(9, 30);
    return {
      id: v.id,
      at,
      title: v.clinic,
      summary: v.summary,
      by: v.staff,
      record: v,
    };
  });
  return [...fromPlan, ...fromRecord].sort(
    (a, b) => b.at.getTime() - a.at.getTime(),
  );
}
