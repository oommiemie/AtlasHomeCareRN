import { requireOptionalNativeModule } from "expo-modules-core";

/** One line Vision found, with where it sat on the card. */
export type ScannedLine = {
  text: string;
  confidence: number;
  /** Normalised, with the origin at the bottom left — Vision's own frame. */
  x: number;
  y: number;
};

type IdScanner = {
  /** Recognises Thai and English text in the image at `uri`. */
  readText(uri: string): Promise<ScannedLine[]>;
};

/**
 * Vision's text recogniser — Apple's, so Apple's platforms only.
 *
 * Optional rather than required. `requireNativeModule` throws at import
 * time when the module is not in the build, and this file is reached from
 * the household flow: on Android the app would not start rather than
 * simply not scan. Absent, the reader hands back nothing and the screen
 * falls through to typing the card in, which is the path that has to work
 * anyway for a card the camera cannot read.
 */
const native = requireOptionalNativeModule<IdScanner>("IdScanner");

export const canScanId = native != null;

export default {
  readText: (uri: string) =>
    native == null ? Promise.resolve([]) : native.readText(uri),
} satisfies IdScanner;
