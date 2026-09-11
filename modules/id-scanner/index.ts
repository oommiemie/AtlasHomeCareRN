import { requireNativeModule } from "expo-modules-core";

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

export default requireNativeModule<IdScanner>("IdScanner");
