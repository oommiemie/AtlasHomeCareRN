import type { ReactNode } from "react";
import { StatusBar, View } from "react-native";

import { RADIUS, SHEET } from "../theme/tokens";

/**
 * What a `presentationStyle="pageSheet"` modal looks like, for the platform
 * that has no such thing.
 *
 * On iOS that one prop is a whole behaviour: the sheet rises from the
 * bottom to just below the status bar with its top corners rounded, and the
 * page it came from stays visible behind it — inset, scaled back a little
 * and dimmed, so the sheet reads as something laid ON the app rather than
 * somewhere else in it. Twenty screens and components in this app ask for
 * it, and it is how every record, picker and brief in the app arrives.
 *
 * Android's Modal has no `presentationStyle`. It ignores the prop and opens
 * full screen, which loses both the shape and the page behind: a sheet that
 * covers everything is indistinguishable from a push, and the twenty places
 * that chose a sheet were saying something by not pushing.
 *
 * The page behind cannot be scaled from in here — it belongs to another
 * window — so it is dimmed and left where it is. The rest is drawn: the
 * gap, the corners, the ground.
 */

/** How far below the status bar the sheet's top edge sits, as iOS puts it. */
const BELOW_STATUS = 10;

/**
 * The dimming over the page behind.
 *
 * Not one of the app's scrims — those are ramps drawn to lift a toolbar off
 * a map. This is what UIKit lays over the presenting view while a sheet is
 * up, which is a flat black at about four tenths, and which is the only
 * part of that recession this side can reproduce.
 */
const BEHIND = "rgba(0,0,0,0.4)";

export function PageSheet({ children }: { children?: ReactNode }) {
  const top = (StatusBar.currentHeight ?? 24) + BELOW_STATUS;

  return (
    <View style={{ flex: 1, backgroundColor: BEHIND }}>
      <View
        style={{
          flex: 1,
          marginTop: top,
          backgroundColor: SHEET,
          borderTopLeftRadius: RADIUS.lg,
          borderTopRightRadius: RADIUS.lg,
          // The corners are only corners if what is inside them is cut to
          // fit: these sheets open with a header and a scrolling list, both
          // of which run to the edge.
          overflow: "hidden",
        }}
      >
        {children}
      </View>
    </View>
  );
}
