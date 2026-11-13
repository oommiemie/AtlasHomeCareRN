/**
 * "ล้างข้อมูลสาธิต" — put the demo back to its sample data.
 *
 * A demonstration closes cases, books visits, takes postings and fills in
 * forms, and all of it is kept on the device, so the next run of the demo
 * started where the last left off. Each store that a demo changes registers
 * how to empty itself here, and the Me page calls them all at once.
 *
 * What stays: the sign-in, the PIN, and the display and language settings —
 * the presenter's own set-up, not the demo's story.
 *
 * Done in memory as well as on disk, because a release build cannot restart
 * its own JavaScript: every store is put back the way a fresh install has it.
 */
const resetters: (() => void)[] = [];

/** Register how a store empties itself. */
export function onDemoReset(reset: () => void): void {
  resetters.push(reset);
}

export function resetDemo(): void {
  for (const reset of resetters) {
    try {
      reset();
    } catch {
      // One store failing to empty leaves the rest to go on.
    }
  }
}
