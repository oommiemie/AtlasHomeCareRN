import { useSyncExternalStore } from "react";
import { File, Paths } from "expo-file-system";
import { requireOptionalNativeModule } from "expo-modules-core";

import { toast } from "../components/Toast";
import { tr } from "../i18n";
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
 * Written to one file between launches, so a carer opens the app on the
 * PIN rather than on sign-in every morning — everything but the PIN, which
 * goes to the device's keychain instead (see `vault` below).
 */
/** What the PIN page is doing: first setup, a change from settings, or an unlock. */
export type PinMode = "setup" | "change" | "unlock";

/** How long the app may sit untouched before it asks for the PIN again. */
export const AUTO_LOCK = ["ทันที", "1 นาที", "5 นาที", "15 นาที"] as const;
export type AutoLock = (typeof AUTO_LOCK)[number];

/**
 * The choices above are saved in the session file as written, so they stay
 * the Thai they were first saved in; this is what a screen shows for one.
 */
export const autoLockLabel = (a: AutoLock): string =>
  tr(a, {
    ทันที: "Immediately",
    "1 นาที": "1 minute",
    "5 นาที": "5 minutes",
    "15 นาที": "15 minutes",
  }[a]);

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
  /**
   * Whether a PIN has been set. The six digits themselves are never in
   * here, so never in the session file: they are in the keychain.
   */
  hasPin: boolean;
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
  hasPin: false,
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
 * documents. Everything here is safe to write down; the PIN is not here.
 */
const store = () => new File(Paths.document, "session.json");

/*
  Where the PIN sleeps: the Keychain on iOS, the Keystore on Android,
  through expo-secure-store. Readable by this app only, only while the
  device is unlocked, and never carried to another device in a backup.

  Asked for softly. A binary built before the module was added has no
  native half, and the import would throw — so would the web build. There
  the PIN stays in the session file as it always did, until the next native
  build; the first launch on one with the vault moves it across.
*/
type Vault = typeof import("expo-secure-store");
const vault: Vault | null = (() => {
  if (requireOptionalNativeModule("ExpoSecureStore") == null) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-secure-store") as Vault;
  } catch {
    return null;
  }
})();
const PIN_KEY = "atlas.pin";
const vaultOptions = (v: Vault) => ({
  keychainAccessible: v.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
});
/** Whether the vault answered at launch. */
let vaultReady = false;

/** The six digits, held to check the next unlock against. Never exported. */
let pin: string | null = null;
/**
 * Whether the vault holds the PIN in use. Until it does, the file does —
 * a PIN that is in neither is a carer who cannot get back in.
 */
let pinVaulted = false;

/** Put the PIN in the vault, or take it out with null. */
async function keepPin(value: string | null): Promise<void> {
  pinVaulted = false;
  if (vault == null || !vaultReady) return;
  try {
    if (value == null) await vault.deleteItemAsync(PIN_KEY, vaultOptions(vault));
    else await vault.setItemAsync(PIN_KEY, value, vaultOptions(vault));
    pinVaulted = value != null;
  } catch {
    // Kept in the file instead, as a build without the vault does.
  }
}

/** Write the session down. Best effort: a failed write lasts the launch. */
function persist(): void {
  try {
    // A PIN the vault does not hold has nowhere else to go; see above.
    const written = pinVaulted || pin == null ? session : { ...session, pin };
    store().write(JSON.stringify(written));
  } catch {
    // The next change tries again.
    toast(
      tr("บันทึกลงเครื่องไม่สำเร็จ", "Couldn't save to this device"),
      "error",
    );
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
  vaultReady =
    vault != null && (await vault.isAvailableAsync().catch(() => false));
  try {
    const f = store();
    if (!f.exists) return;
    const { pin: written, ...saved } = JSON.parse(await f.text()) as Partial<
      Session & { pin: string | null }
    >;
    session = { ...EMPTY, ...saved };
    if (vault != null && vaultReady) {
      pin = await vault.getItemAsync(PIN_KEY, vaultOptions(vault));
      pinVaulted = pin != null;
    }
    // A PIN written into the file — before the vault, or by a build
    // without one — is moved into the vault and the file written again
    // without it.
    const moving = typeof written === "string";
    if (moving && pin == null) pin = written;
    // Set or not is what the vault says, not what the file remembers: a
    // file restored onto a new phone comes without the keychain behind it.
    session = { ...session, hasPin: pin != null };
    if (moving && vaultReady) {
      await keepPin(pin);
      persist();
    }
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
    pin = null;
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
  // A keychain outlives the app being deleted; a PIN left in it from
  // before is not this sign-in's.
  pin = null;
  void keepPin(null);
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

export function setPin(next: string): void {
  pin = next;
  session = { ...session, hasPin: true };
  notify();
  // Written down once the vault has answered, so the file knows whether
  // it has to hold the PIN itself.
  void keepPin(next).then(persist);
}

/** Whether an entered PIN is the one set. */
export function checkPin(entered: string): boolean {
  return pin != null && entered === pin;
}

export function setBiometric(on: boolean): void {
  session = { ...session, biometric: on };
  commit();
}

export function setAutoLock(after: AutoLock): void {
  session = { ...session, autoLock: after };
  commit();
}

/**
 * End the session: the PIN and the session file. What was recorded stays —
 * this is a prototype on stand-in data, and signing out is how a forgotten
 * PIN is got past, not a reason to lose a morning's demonstration.
 */
export function signOut(): void {
  pin = null;
  void keepPin(null);
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
