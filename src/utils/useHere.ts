import { useEffect, useState } from "react";
import * as Location from "expo-location";

/**
 * The sample position the app falls back to — Rat Burana, Bangkok, where
 * the seeded households are.
 *
 * A map centred on nothing is worse than a map centred on the wrong place:
 * with no fix, and with permission refused, the screens still have somewhere
 * to show.
 */
export const FALLBACK_HERE = { latitude: 13.6495, longitude: 100.499 };

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
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const pos =
          (await Location.getLastKnownPositionAsync()) ??
          (await Location.getCurrentPositionAsync({}));
        if (!alive || pos == null) return;
        setHere({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setLive(true);
      } catch {
        // Keep the fallback.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { here, live };
}
