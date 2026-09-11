/** TEMPORARY — instrumentation for the HealthTracking delay. Delete when done. */
let marks: Record<string, number> = {};
let sums: Record<string, number> = {};

export function mark(name: string) {
  marks[name] = Date.now();
}

/** Milliseconds since `mark(name)`, or -1 if it was never marked. */
export function since(name: string): number {
  const t = marks[name];
  return t == null ? -1 : Date.now() - t;
}

/** Times `fn`, adding the cost into a running total under `name`. */
export function timed<T>(name: string, fn: () => T): T {
  const t0 = Date.now();
  const out = fn();
  sums[name] = (sums[name] ?? 0) + (Date.now() - t0);
  return out;
}

export function readSums(): Record<string, number> {
  return { ...sums };
}

export function resetSums() {
  sums = {};
}
