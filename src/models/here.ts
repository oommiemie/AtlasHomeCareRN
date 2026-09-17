/**
 * Where the carer is, for code that is not a screen.
 *
 * A plain box holding the last fix, and nothing else. `useHere` fills it as
 * a side effect of any screen asking for the position; the assistant reads
 * it to answer "who is nearest" without importing expo-location, which
 * drags the whole of React Native in behind it and puts the model layer out
 * of reach of anything but the phone.
 *
 * The fallback is the same one the maps use: with no fix and no permission,
 * distances are measured from the middle of the area rather than not at all.
 */
export const FALLBACK_HERE = { latitude: 13.6495, longitude: 100.499 };

export type Here = { here: typeof FALLBACK_HERE; live: boolean };

let last: Here = { here: FALLBACK_HERE, live: false };

/** The last fix anything managed to get. */
export const currentHere = (): Here => last;

/** Called by whoever actually asked the phone. */
export function rememberHere(at: typeof FALLBACK_HERE): void {
  last = { here: at, live: true };
}
