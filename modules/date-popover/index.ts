import { requireOptionalNativeModule } from "expo-modules-core";

const native = requireOptionalNativeModule<{ dismiss(): void }>("DatePopover");

/**
 * Closes the calendar the compact date picker opened.
 *
 * Picking a day leaves it standing there — UIKit treats the popover as a place
 * to keep choosing from, and the picker has no API for saying the choice is
 * made. Called from the change handler it becomes what it reads as: one tap on
 * a day, and the calendar goes away with the date changed.
 *
 * A no-op in a build the native module is missing from; the popover is then
 * dismissed the way it always was, by tapping outside it.
 */
export function dismissDatePopover() {
  native?.dismiss();
}
