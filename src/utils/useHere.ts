import { useEffect, useState } from "react";
import * as Location from "expo-location";

import {
  currentHere,
  rememberHere,
  FALLBACK_HERE,
  type Here,
} from "../models/here";

/** Re-exported: the screens import it from here, the models own it. */
export { FALLBACK_HERE };

/**
 * Ask the phone for the position, and put it where the models can see it.
 *
 * Prefers the last known fix over a fresh one — a cold GPS lock can take
 * several seconds, and nothing here is worth making somebody wait for.
 * Falls back silently: a refused permission is a choice.
 */
export async function readHere(): Promise<Here> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return currentHere();
    const pos =
      (await Location.getLastKnownPositionAsync()) ??
      (await Location.getCurrentPositionAsync({}));
    if (pos != null) {
      rememberHere({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    }
  } catch {
    // Keep whatever was there.
  }
  return currentHere();
}

/**
 * Where the carer is.
 *
 * Asks once, prefers the last known fix over a fresh one — a cold GPS lock
 * can take several seconds, and a map that arrives late reads as broken.
 * Falls back silently: a refused permission is a choice, not an error worth
 * interrupting the screen for.
 */
export function useHere(): { here: typeof FALLBACK_HERE; live: boolean } {
  const [here, setHere] = useState(FALLBACK_HERE);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let alive = true;
    void readHere().then((got) => {
      if (!alive || !got.live) return;
      setHere(got.here);
      setLive(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  return { here, live };
}
