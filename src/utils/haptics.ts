/**
 * A tap the finger can feel. Guarded: a binary built before expo-haptics
 * was added has no module to require, and must not crash for want of one.
 */
type HapticsModule = typeof import("expo-haptics");
let haptics: HapticsModule | null | undefined;

export function feel(kind: "tick" | "error" | "success"): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    haptics ??= require("expo-haptics") as HapticsModule;
    if (haptics == null) return;
    if (kind === "tick") void haptics.selectionAsync();
    else if (kind === "error") void haptics.notificationAsync(haptics.NotificationFeedbackType.Error);
    else void haptics.notificationAsync(haptics.NotificationFeedbackType.Success);
  } catch {
    haptics = null;
  }
}
