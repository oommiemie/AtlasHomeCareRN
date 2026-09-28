import { useSyncExternalStore } from "react";
import { File, Paths } from "expo-file-system";

import { toast } from "../components/Toast";
import type { Facility } from "./facility";
import { STAND_IN_ACCOUNT, type ProviderAccount } from "./providerAccount";

/**
 * Who is signed in, and how far through the first-run steps they are.
 *
 * Four steps before the app opens: the Provider ID sign-in, the privacy
 * consent, the facility they are working under today, and a PIN for the
 * next unlock. Each writes one field here; the last resets the navigator
 * onto the tabs.
 *
 * In memory only, on purpose: this is the prototype's shape of the thing,
 * and nothing here — least of all a PIN — should be written to disk until
 * the real sign-in exists to back it. A cold start begins at sign-in.
 */
/** What the PIN page is doing: first setup, a change from settings, or an unlock. */
export type PinMode = "setup" | "change" | "unlock";

/** How long the app may sit untouched before it asks for the PIN again. */
export const AUTO_LOCK = ["ทันที", "1 นาที", "5 นาที", "15 นาที"] as const;
export type AutoLock = (typeof AUTO_LOCK)[number];

export type Session = {
  /** The MOPH Provider ID the user signed in with. */
  providerId: string;
  /** What they are called on the home screen. */
  displayName: string;
  /**
   * A portrait they chose, as a local file URI.
   *
   * The one thing on the account a carer may change: name, post and rights
   * all come down from Provider ID and are read-only here. Null means the
   * stand-in portrait the app ships with.
   */
  photo: string | null;
  /**
   * What the provider register holds about them — read-only, all of it.
   * Null until a sign-in has answered.
   */
  account: ProviderAccount | null;
  /** When the privacy consent was given — an ISO time, or not yet. */
  consentedAt: string | null;
  facility: Facility | null;
  /**
   * Which Authen Code right is in force — an id from the register, or null
   * for a carer who has never chosen and is working under their posting.
   *
   * Beside the facility rather than inside it: they answer different
   * questions. The facility is where this session's records are FILED, and
   * is fixed from sign-in because moving it would move work already
   * written. The Authen Code is which unit a service is CLAIMED under, is
   * held per service rather than per session, and so can be changed
   * whenever the next one is about to be given.
   */
  authenCode: string | null;
  /** The six digits, held to check the next unlock against. */
  pin: string | null;
  /** Face ID / Touch ID offered before the PIN. */
  biometric: boolean;
  autoLock: AutoLock;
};

const EMPTY: Session = {
  providerId: "",
  displayName: "",
  photo: null,
  account: null,
  consentedAt: null,
  facility: null,
  authenCode: null,
  pin: null,
  biometric: false,
  autoLock: "5 นาที",
};

let session: Session = EMPTY;
const watchers = new Set<() => void>();
const notify = () => {
  for (const w of watchers) w();
};

/**
 * Where the session sleeps between launches: one file in the app's own
 * documents. The sandbox keeps it from other apps; it is not the Keychain,
 * and the PIN should move there (expo-secure-store) in the next native
 * build. Until then this is what lets a carer open the app on the PIN and
 * not on the sign-in page every morning.
 */
const store = () => new File(Paths.document, "session.json");

/** Write the session down. Best effort: a failed write lasts the launch. */
function persist(): void {
  try {
    store().write(JSON.stringify(session));
  } catch {
    // The next change tries again.
    toast("บันทึกลงเครื่องไม่สำเร็จ", "error");
  }
}

/** Change and remember, then tell the screens. */
const commit = () => {
  persist();
  notify();
};

/**
 * Read the session back in at launch. Resolves either way: a missing or
 * unreadable file is a fresh start, which is what the sign-in page is for.
 */
export async function hydrate(): Promise<void> {
  try {
    const f = store();
    if (!f.exists) return;
    const saved = JSON.parse(await f.text()) as Partial<Session>;
    session = { ...EMPTY, ...saved };
    // A session saved under the earlier placeholder name takes the current one.
    if (session.displayName === "" || session.displayName === "พยาบาลชุมชน") {
      session = { ...session, displayName: STAND_IN_NAME };
    }
    // A session saved before the register's answer was kept takes it now,
    // rather than showing a profile page full of dashes.
    if (session.providerId !== "" && session.account == null) {
      session = { ...session, account: STAND_IN_ACCOUNT };
    }
  } catch {
    session = EMPTY;
  }
  notify();
}

/** The session as it is right now, for code that is not a component. */
export function currentSession(): Session {
  return session;
}

export function useSession(): Session {
  return useSyncExternalStore(
    (onChange) => {
      watchers.add(onChange);
      return () => {
        watchers.delete(onChange);
      };
    },
    () => session,
  );
}

/** The name the account carries until the provider directory supplies one. */
export const STAND_IN_NAME = "สุขภาพดี จิตแจ่มใส";

/** The given name alone, for a greeting. */
export const givenNameOf = (full: string) => full.trim().split(/\s+/)[0] ?? "";

/** Sign in. The name is stood in for until the directory answers. */
export function signIn(providerId: string): void {
  // The register answers with the account; here it is stood in for.
  session = {
    ...EMPTY,
    providerId,
    displayName: STAND_IN_NAME,
    account: STAND_IN_ACCOUNT,
  };
  commit();
}

export function giveConsent(): void {
  session = { ...session, consentedAt: new Date().toISOString() };
  commit();
}

export function chooseFacility(facility: Facility): void {
  session = { ...session, facility };
  commit();
}

/** Set which unit the next service is authenticated under. */
export function chooseAuthenCode(id: string): void {
  session = { ...session, authenCode: id };
  commit();
}

/** Choose a portrait, or drop back to the stand-in with null. */
export function setPhoto(uri: string | null): void {
  session = { ...session, photo: uri };
  commit();
}

export function setPin(pin: string): void {
  session = { ...session, pin };
  commit();
}

export function setBiometric(on: boolean): void {
  session = { ...session, biometric: on };
  commit();
}

export function setAutoLock(after: AutoLock): void {
  session = { ...session, autoLock: after };
  commit();
}

export function signOut(): void {
  session = EMPTY;
  try {
    const f = store();
    if (f.exists) f.delete();
  } catch {
    // Nothing to forget, or nothing we can do about it.
  }
  notify();
}

/**
 * Whether a PIN is too easy to guess: one digit repeated, or a run up or
 * down the keypad. The four most-used PINs in every leaked set.
 */
export function isWeakPin(pin: string): boolean {
  if (/^(\d)\1+$/.test(pin)) return true;
  const up = "0123456789";
  const down = "9876543210";
  return up.includes(pin) || down.includes(pin);
}
