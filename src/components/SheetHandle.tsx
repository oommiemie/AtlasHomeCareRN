import { View } from "react-native";
import { initialWindowMetrics } from "react-native-safe-area-context";

import { TEXT_DISABLED } from "../theme/tokens";

/**
 * The one shape every bottom sheet on Android takes.
 *
 * There are two kinds of sheet in the app — the navigator's (`SHEET` in
 * RootStack, drawn by Material's `BottomSheetBehavior`) and the modal ones a
 * screen opens itself (`PageSheetModal`) — and they had drifted into
 * two designs: different corners, a handle on one and not the other, one
 * that dragged and one that did not. Both read these numbers now, so a
 * change to the sheet is made once.
 */

/**
 * Material 3's corner for a bottom sheet.
 */
export const SHEET_RADIUS = 28;

/**
 * Where a sheet's top edge stops, from the top of the screen: under the
 * phone's own safe area — the status bar and whatever camera cutout hangs
 * into it, which differ from phone to phone — and 8dp further, just enough
 * that the edge does not touch the camera. 24dp was tried and read as a
 * sheet that had stopped short.
 */
export const SHEET_TOP_GAP = (initialWindowMetrics?.insets.top ?? 48) + 8;

/**
 * Material 3's drag handle, across the top of an Android bottom sheet.
 *
 * What the sheets hold was drawn for iOS, where the page sheet needs no mark
 * to say it can be dragged. On Android the handle is how a sheet says so:
 * 32×4, centred, a muted grey at four tenths.
 *
 * Laid over the sheet rather than above its content, so no screen's header
 * moves: every sheet header starts 16pt down, and the handle sits in that
 * margin, clear of the close button and the title below it.
 */
export function SheetHandle() {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 6,
        left: 0,
        right: 0,
        alignItems: "center",
        zIndex: 100,
      }}
    >
      <View
        style={{
          width: 32,
          height: 4,
          borderRadius: 2,
          backgroundColor: TEXT_DISABLED,
          opacity: 0.4,
        }}
      />
    </View>
  );
}
