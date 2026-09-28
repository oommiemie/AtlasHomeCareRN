import { useRef } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { useStage } from "./BlurStage";
import { openDateCalendar } from "./DatePopover";

/**
 * The invisible layer that turns a painted date into a date you can change.
 *
 * Five screens draw a date as their own type — a tile's caption, a plan's
 * title — and put the real control underneath it to be pressed. On iOS the
 * control is a view: `display="compact"` is a small inline button, so it
 * can be scaled out to the width of the words, dropped to an alpha of 0.02
 * (UIKit skips hit testing below 0.01) and covered over. The calendar then
 * comes up off its own frame, anchored to the date it belongs to.
 *
 * On Android `DateTimePicker` is not a view at all. It is the dialog, and
 * it opens the moment it mounts — so each of those five layers put a
 * calendar on the screen unasked, and mounted meant it could not be
 * dismissed either: cancel, back and a tap outside all closed a dialog the
 * still-mounted component immediately opened again. The bottom tab bar
 * mounts every tab at once, so the plan tab's picker did this over the home
 * page, on launch, before anything had been touched.
 *
 * So there are two layers, not one: the hidden control on iOS, and on
 * Android a plain pressable that opens the app's own calendar under the
 * words it was pressed on.
 *
 * The dialog that pressable used to open was the system's — full screen
 * behind a scrim, its header in English off the device locale and in the
 * common era, and drawn in Material rather than in any of this. It worked;
 * it just was not the same app. [DatePopover] is the popover iOS puts
 * there, written in the app's own tokens, and it is measured off THIS view
 * so it hangs from the date the way Apple's does.
 */
export function DateHitLayer({
  value,
  minimumDate,
  maximumDate,
  label,
  /** How far the hidden iOS control is stretched to cover the words. */
  scale,
  onPick,
}: {
  value: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  label: string;
  scale: { x: number; y?: number };
  onPick: (next: Date) => void;
}) {
  /*
    Where the words are, in the window's own coordinates.

    Measured at the moment of the press rather than on layout: these layers
    sit in headers that move — the plan's title slides with its calendar, a
    form's field rides a scroll view — and a position stored at mount is
    wrong by the time it is used.
  */
  const hit = useRef<View>(null);
  // The page this date is on, for the calendar to blur behind itself.
  const stage = useStage();

  return (
    <View
      ref={hit}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {Platform.OS === "android" ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => {
            hit.current?.measureInWindow((x, y, width, height) => {
              openDateCalendar({
                anchor: { x, y, width, height },
                blurTarget: stage?.target,
                value,
                minimumDate,
                maximumDate,
                onPick,
              });
            });
          }}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <DateTimePicker
          value={value}
          mode="date"
          display="compact"
          locale="th-TH"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          accessibilityLabel={label}
          style={{
            opacity: 0.02,
            transform:
              scale.y == null
                ? [{ scaleX: scale.x }]
                : [{ scaleX: scale.x }, { scaleY: scale.y }],
          }}
          onChange={(_e: unknown, next?: Date) => {
            if (next == null) return;
            onPick(next);
          }}
        />
      )}
    </View>
  );
}
