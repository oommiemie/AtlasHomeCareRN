import { useSyncExternalStore } from "react";

import { tr } from "../i18n";

/**
 * Physiotherapy — the referral-and-treatment flow, stripped to the parts a
 * carer actually fills in at the bedside.
 *
 * The hospital's own version of this is four screens: a referral with a PT
 * number and billing fields, a treatment tab with SOAP notes, and an
 * activity form with three ICD code boxes and an equipment section. Almost
 * none of that is decided in the room — the number is minted by the system,
 * the codes are looked up later by coders, the billing is settled at the
 * desk. What is decided in the room is: which system, who is treating, what
 * was done, how much pain, and what happens next. That is what this keeps.
 */

/**
 * The body system the therapy addresses. The lists below are only ever
 * shown and kept for this run of the app, so they are written in the
 * language on screen; the status is compared by position, not by word.
 */
export const PHYSIO_SYSTEMS = [
  tr("ระบบประสาท", "Neurological"),
  tr("ระบบทางเดินหายใจ", "Respiratory"),
  tr("กระดูกและกล้ามเนื้อ", "Musculoskeletal"),
  tr("ระบบไหลเวียนเลือด", "Cardiovascular"),
  tr("ผู้สูงอายุ", "Geriatric"),
  tr("อื่น ๆ", "Other"),
];

/** The three lines of physiotherapy, as the reference groups them. */
export const PHYSIO_ACTIVITIES: { code: string; label: string }[] = [
  { code: "PT", label: tr("ฟื้นฟูการเคลื่อนไหว", "Mobility rehabilitation") },
  { code: "OT", label: tr("ฝึกกิจวัตรประจำวัน", "Daily living training") },
  { code: "PO", label: tr("กายอุปกรณ์เสริม", "Orthotics and prosthetics") },
];

/** Who does the treating. */
export const THERAPISTS = [
  "นายกิตติพงษ์ แสงทอง",
  "นางสาวปิยะดา วัฒนกุล",
  "นายอนุชา บุญมี",
  "นางสาวมนัสนันท์ ศรีสุข",
] as const;

/** Where the visit stands. */
export const PHYSIO_STATUS = [tr("กำลังรักษา", "In treatment"), tr("ติดตามอาการ", "Monitoring"), tr("จำหน่าย", "Discharged")];

/** One physiotherapy visit, written down. */
export type PhysioSession = {
  id: string;
  /** When it was done — a Thai date string. */
  date: string;
  system: string;
  therapist: string;
  /** The activity codes done, e.g. ["PT", "OT"]. */
  activities: string[];
  /** Pain, 0–10. */
  pain: number;
  status: string;
  /** The one note the room actually writes — the plan for next time. */
  note: string;
};

const store = new Map<string, PhysioSession[]>();
const watchers = new Set<() => void>();
const NONE: PhysioSession[] = [];

/** Add a session to a visit, newest kept last. */
export function addPhysio(authenCode: string, s: Omit<PhysioSession, "id">): void {
  const had = store.get(authenCode) ?? [];
  store.set(authenCode, [...had, { ...s, id: `${authenCode}-pt-${had.length + 1}-${Date.now()}` }]);
  for (const w of watchers) w();
}

/** This visit's physiotherapy sessions — live. */
export function usePhysio(authenCode: string): PhysioSession[] {
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

/** Spell out the activity codes, e.g. "PT, OT". */
export function activityLabel(codes: string[]): string {
  return codes.join(", ");
}
