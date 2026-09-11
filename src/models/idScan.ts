import type { ScannedId } from "./idCard";

/**
 * Where a card scan's answers go.
 *
 * A store rather than route params, for the same reason the option sheet has
 * one: the handler is a function, and a function cannot be serialised through
 * a navigator. Only one scanner can be open at a time.
 */
let handler: ((found: ScannedId) => void) | null = null;

export const setIdScanHandler = (fn: (found: ScannedId) => void) => {
  handler = fn;
};

export const idScanHandler = () => handler;
