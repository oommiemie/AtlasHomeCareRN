import { useSyncExternalStore } from "react";

import { validCitizenId } from "./idCard";

import type { Village } from "./household";
import { EMPTY_PLACE, type Place } from "./place";

/**
 * One person being added to the house — the form's fields, not the record's.
 *
 * A resident record keeps far less than this; the extra answers are collected
 * because the form asks for them and are dropped on save. They are held here
 * rather than thrown away at each step so going back does not lose them.
 */
export type DraftMember = {
  idCard: string;
  title: string;
  name: string;
  /** "dd/mm/yyyy" in the Buddhist era, as it is written on a Thai ID. */
  birthDate: string;
  gender: string;
  bloodType: string;
  religion: string;
  ethnicity: string;
  nationality: string;
  maritalStatus: string;
  education: string;
  occupation: string;
  /** A local file URI. Empty until one is taken or chosen. */
  photo: string;
};

export const blankMember = (): DraftMember => ({
  idCard: "",
  title: "",
  name: "",
  birthDate: "",
  gender: "",
  bloodType: "",
  religion: "",
  ethnicity: "",
  nationality: "",
  maritalStatus: "",
  education: "",
  occupation: "",
  photo: "",
});

export type HouseDraft = {
  village: Village | null;
  registrationNo: string;
  project: string;
  number: string;
  detail: string;
  lat: number | null;
  lng: number | null;
  place: Place;
  members: DraftMember[];
};

const blank = (): HouseDraft => ({
  village: null,
  registrationNo: "",
  project: "",
  number: "",
  detail: "",
  lat: null,
  lng: null,
  place: EMPTY_PLACE,
  members: [],
});

/**
 * The house being built, across the three steps of the flow.
 *
 * A store rather than route params. The draft is one thing filled in from
 * four screens — the form, the map sheet, the member sheet, the list — and
 * threading it through params means each screen carrying the answers of the
 * ones before it and handing them on unchanged. It also has to survive going
 * back, which params do not.
 *
 * Deliberately plain: no persistence. Leaving the flow abandons the draft,
 * which is what closing a half-filled form should do.
 */
let draft: HouseDraft = blank();

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());

/** Subscribe for React. The snapshot is the object itself, replaced on write. */
export function useHouseDraft(): HouseDraft {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => draft,
  );
}

/** Starts a fresh draft. Called when the flow opens, never mid-flow. */
export function beginHouseDraft(village: Village) {
  draft = { ...blank(), village, project: village.name };
  emit();
}

export function patchHouseDraft(part: Partial<HouseDraft>) {
  draft = { ...draft, ...part };
  emit();
}

export function addDraftMember(member: DraftMember) {
  draft = { ...draft, members: [...draft.members, member] };
  emit();
}

/** Replaces one member in place, for the form opened on an existing row. */
export function updateDraftMember(at: number, member: DraftMember) {
  draft = {
    ...draft,
    members: draft.members.map((m, i) => (i === at ? member : m)),
  };
  emit();
}

export function removeDraftMember(at: number) {
  draft = { ...draft, members: draft.members.filter((_, i) => i !== at) };
  emit();
}

/** How many digits a Thai house registration number carries. */
export const REGISTRATION_DIGITS = 11;

export const registrationValid = (v: string) =>
  new RegExp(`^\\d{${REGISTRATION_DIGITS}}$`).test(v.trim());

/**
 * What is wrong with what has been typed so far, or null.
 *
 * Silent while the field is empty: a form that turns red before it has been
 * filled in is telling somebody off for not having finished yet. The message
 * counts what is there, so a mistyped number can be found without recounting
 * eleven digits by eye.
 */
export function registrationError(v: string): string | null {
  const t = v.trim();
  if (t.length === 0) return null;
  if (!/^\d+$/.test(t)) return "เลขทะเบียนบ้านมีได้เฉพาะตัวเลข";
  if (t.length !== REGISTRATION_DIGITS) {
    return `ต้องมี ${REGISTRATION_DIGITS} หลัก (ตอนนี้ ${t.length})`;
  }
  return null;
}

/** Whether step one has what the house cannot be saved without. */
export const houseStepDone = (d: HouseDraft) =>
  registrationValid(d.registrationNo) &&
  d.number.trim().length > 0 &&
  d.lat != null &&
  d.place.province.length > 0;

/** How many digits a Thai citizen number carries. */
export const CITIZEN_ID_DIGITS = 13;

/**
 * What is wrong with the citizen number typed so far, or null.
 *
 * Silent while the field is empty — a form that turns red before it has been
 * filled in is telling somebody off for not having finished. The checksum is
 * what separates a real number from thirteen digits: each of the first twelve
 * is weighted 13 down to 2, and the last is what makes the total a multiple
 * of eleven.
 */
export function citizenIdError(v: string): string | null {
  const t = v.trim();
  if (t.length === 0) return null;
  if (!/^\d+$/.test(t)) return "เลขบัตรประชาชนมีได้เฉพาะตัวเลข";
  if (t.length !== CITIZEN_ID_DIGITS) {
    return `ต้องมี ${CITIZEN_ID_DIGITS} หลัก (ตอนนี้ ${t.length})`;
  }
  if (!validCitizenId(t)) return "เลขบัตรประชาชนไม่ถูกต้อง";
  return null;
}

/**
 * A member is worth keeping once it can be told apart from anybody else.
 *
 * The citizen number is the household registry's own key — two people in one
 * house can share a surname and a birthday, and the record that cannot name
 * which is which is the record nobody trusts.
 */
export const memberReady = (m: DraftMember) =>
  m.name.trim().length > 0 &&
  ageFrom(m.birthDate) != null &&
  validCitizenId(m.idCard.trim());

/**
 * Age in years from a Buddhist-era "dd/mm/yyyy", or null if it is not one.
 *
 * Thai IDs and forms are written in the Buddhist era, 543 years ahead of the
 * common one. A year below 2200 is taken as already common-era rather than a
 * date in the far past — nobody types 1480 for 2023.
 */
export function ageFrom(birthDate: string): number | null {
  const parts = birthDate.split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map((p) => Number(p.trim()));
  if (!d || !m || !y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const year = y > 2200 ? y - 543 : y;
  const born = new Date(year, m - 1, d);
  if (Number.isNaN(born.getTime())) return null;
  // Stamped rather than read off the clock at render time, so a list of ages
  // cannot disagree with itself halfway down.
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const beforeBirthday =
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}
