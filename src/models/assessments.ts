import { useSyncExternalStore } from "react";

import { saveTask, type TaskRecord } from "./community";

/**
 * What the visit's assessments came to — one record per form.
 *
 * The session store keeps one "assessment" slot, which was enough while
 * there was one form. There are three now and a round can run all of them,
 * so each keeps its own record here, keyed by the form, and the session slot
 * is written a one-line digest of all of them — which is what the patient
 * page reads for its "done" tick and its preview, without knowing which
 * forms exist.
 */

export type Tone = "good" | "warn" | "bad";

/** What every finished form leaves behind, over its own fields. */
export type AssessmentRecord = TaskRecord & {
  /** Which form — the key in ASSESSMENTS. */
  form: string;
  /** The verdict in two or three words: "เสี่ยงน้อย", "คุมได้ดี", "mMRC 2". */
  badge: string;
  /** How the badge should be coloured. */
  tone: Tone;
  /** One line of the result, for a row. */
  result: string;
  /** What to do about it. */
  advice: string;
};

/** The forms' short names, for the digest line. */
const SHORT: Record<string, string> = {
  risk35: "คัดกรอง 35 ปี",
  asthma: "หอบหืด",
  dyspnea: "หายใจลำบาก",
  barthel: "Barthel ADL",
  adl: "ADL",
  ncd: "เบาหวาน/ความดัน",
  palliative: "PPS",
  inhomesss: "INHOMESSS",
  crisis: "วิกฤต",
  esas: "ESAS",
  homecare: "ภาระผู้ดูแล",
  mna: "โภชนาการ",
};

const store = new Map<string, Record<string, AssessmentRecord>>();
const watchers = new Set<() => void>();
const NONE: Record<string, AssessmentRecord> = {};

/** Write one form's record, replacing whatever that form had. */
export function saveAssessment(authenCode: string, rec: AssessmentRecord): void {
  const next = { ...(store.get(authenCode) ?? {}), [rec.form]: rec };
  store.set(authenCode, next);
  const lines = Object.values(next).map((r) => `${SHORT[r.form] ?? r.form}: ${r.badge}`);
  saveTask(authenCode, "assessment", {
    result: lines.join(" · "),
    count: String(lines.length),
  });
  for (const w of watchers) w();
}

/** Every form this visit has finished — live. */
export function useAssessments(authenCode: string): Record<string, AssessmentRecord> {
  return useSyncExternalStore(
    (onChange) => {
      watchers.add(onChange);
      return () => {
        watchers.delete(onChange);
      };
    },
    () => store.get(authenCode) ?? NONE,
  );
}

/** One form's record, for a form reopening on it. */
export function assessmentOf(authenCode: string, form: string): AssessmentRecord | undefined {
  return store.get(authenCode)?.[form];
}
