import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { Fingerprint, ScanEye, ScanFace } from "lucide-react-native";

import { tr } from "../i18n";

/**
 * Which biometric this device unlocks with — asked of the device, not
 * assumed.
 *
 * The app said "Face ID" everywhere, and an iPad Air has a fingerprint
 * reader in its top button and no face camera for it. So the PIN key, the
 * settings switch and every prompt ask here what the device has and say
 * that: Face ID or Touch ID on Apple devices, face or fingerprint on
 * Android, and nothing at all where there is none.
 */

export type BiometricKind = "face" | "fingerprint" | "iris" | "none";

export type Biometric = {
  kind: BiometricKind;
  /** Something is enrolled — a face or a finger set up in the device's settings. */
  enrolled: boolean;
  /** What the device calls it: "Face ID", "Touch ID", "สแกนลายนิ้วมือ"… */
  name: string;
  Icon: typeof ScanFace;
};

const NONE: Biometric = {
  kind: "none",
  enrolled: false,
  name: tr("ไบโอเมตริกซ์", "Biometrics"),
  Icon: ScanFace,
};

const nameOf = (kind: BiometricKind): string => {
  const apple = Platform.OS === "ios";
  switch (kind) {
    case "face":
      return apple ? "Face ID" : tr("สแกนใบหน้า", "Face unlock");
    case "fingerprint":
      return apple ? "Touch ID" : tr("สแกนลายนิ้วมือ", "Fingerprint");
    case "iris":
      return tr("สแกนม่านตา", "Iris scan");
    default:
      return NONE.name;
  }
};

const iconOf = (kind: BiometricKind) =>
  kind === "fingerprint" ? Fingerprint : kind === "iris" ? ScanEye : ScanFace;

let cached: Biometric | null = null;

/**
 * Asks the device once and remembers: the hardware does not change while
 * the app runs. Enrolment can (a finger added in Settings), so `fresh`
 * asks again — the settings page does, as it opens.
 */
export async function detectBiometric(fresh = false): Promise<Biometric> {
  if (cached != null && !fresh) return cached;
  try {
    const [hardware, types, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    const T = LocalAuthentication.AuthenticationType;
    // A device with more than one (some Android phones) is named by the
    // fingerprint: it is the one the system prompt reliably offers.
    const kind: BiometricKind = !hardware
      ? "none"
      : types.includes(T.FINGERPRINT)
        ? "fingerprint"
        : types.includes(T.FACIAL_RECOGNITION)
          ? "face"
          : types.includes(T.IRIS)
            ? "iris"
            : "none";
    cached =
      kind === "none"
        ? NONE
        : { kind, enrolled, name: nameOf(kind), Icon: iconOf(kind) };
  } catch {
    cached = NONE;
  }
  return cached;
}

/** The device's biometric, or null for the moment it takes to ask. */
export function useBiometric(fresh = false): Biometric | null {
  const [b, setB] = useState<Biometric | null>(fresh ? null : cached);
  useEffect(() => {
    let live = true;
    void detectBiometric(fresh).then((r) => {
      if (live) setB(r);
    });
    return () => {
      live = false;
    };
  }, [fresh]);
  return b;
}
