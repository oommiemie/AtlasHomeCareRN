import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";

import { thaiShortDate, thaiTime } from "../utils/thaiDate";
import { locale, tr } from "../i18n";
import {
  GROUPED_BG,
  RADIUS,
  SPACE,
  TEXT_PRIMARY,
  TOUCH_MIN,
} from "../theme/tokens";

/**
 * A moment, as UIKit's own compact picker: the label on the left, the two
 * small grey pills on the right.
 *
 * The control is shown as itself rather than hidden under a painted field.
 * Elsewhere in the app a date is dressed as one of our capsules, which
 * takes laying the picker under it at an alpha of 0.02 and scaling it past
 * the edges — a trick that works for a single button and fails for
 * `datetime`, which draws two with a gap between them where the finger
 * lands. Left alone, the system's own control is both correct and the more
 * compact of the two.
 */
export function DateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  /** ISO. */
  value: string;
  onChange: (iso: string) => void;
}) {
  const parsed = new Date(value);
  const at = Number.isFinite(parsed.getTime()) ? parsed : new Date();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.sm,
        minHeight: 40,
      }}
    >
      <Text
        style={{ flex: 1, fontSize: 15, lineHeight: 21, color: TEXT_PRIMARY }}
      >
        {label}
      </Text>
      {Platform.OS === "android" ? (
        <AndroidPills at={at} label={label} onChange={onChange} />
      ) : (
        <DateTimePicker
          value={at}
          mode="datetime"
          display="compact"
          locale={locale}
          accessibilityLabel={label}
          onChange={(_, next) => {
            if (next != null) onChange(next.toISOString());
          }}
        />
      )}
    </View>
  );
}

/**
 * The same two pills, drawn by us, on the platform that has no such control.
 *
 * There is no inline picker on Android. `<DateTimePicker>` there is not a
 * view that sits in a row — it IS the dialog, opened the moment it mounts,
 * and mounted here unconditionally it opened over the page on arrival and
 * could not be closed: dismissing it left the component mounted, so it came
 * straight back. Cancel, the back gesture and a tap outside all bounced off
 * a calendar nobody had asked for, on a screen that was otherwise finished.
 *
 * So on Android the picker is opened when it is asked for, through the
 * imperative API that exists for exactly this, and closed by being gone.
 * Date first, then time, which is the order Android's own pickers come in;
 * backing out of the time leaves the day that was already chosen rather
 * than throwing the whole answer away.
 */
function AndroidPills({
  at,
  label,
  onChange,
}: {
  at: Date;
  label: string;
  onChange: (iso: string) => void;
}) {
  const open = () => {
    DateTimePickerAndroid.open({
      value: at,
      mode: "date",
      positiveButton: { label: tr("ต่อไป", "Next") },
      negativeButton: { label: tr("ยกเลิก", "Cancel") },
      onChange: (dayEvent, day) => {
        if (dayEvent.type !== "set" || day == null) return;
        DateTimePickerAndroid.open({
          value: at,
          mode: "time",
          is24Hour: true,
          positiveButton: { label: tr("ตกลง", "OK") },
          negativeButton: { label: tr("ยกเลิก", "Cancel") },
          onChange: (timeEvent, time) => {
            const picked = new Date(day);
            if (timeEvent.type === "set" && time != null) {
              picked.setHours(time.getHours(), time.getMinutes(), 0, 0);
            } else {
              picked.setHours(at.getHours(), at.getMinutes(), 0, 0);
            }
            onChange(picked.toISOString());
          },
        });
      },
    });
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityValue={{ text: `${thaiShortDate(at)} ${thaiTime(at)}` }}
      onPress={open}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.xs,
        minHeight: TOUCH_MIN,
      }}
    >
      <Pill>{thaiShortDate(at)}</Pill>
      <Pill>{thaiTime(at)}</Pill>
    </Pressable>
  );
}

function Pill({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontSize: 15,
        lineHeight: 24,
        color: TEXT_PRIMARY,
        backgroundColor: GROUPED_BG,
        borderRadius: RADIUS.sm,
        paddingHorizontal: SPACE.sm,
        paddingVertical: 6,
        overflow: "hidden",
      }}
    >
      {children}
    </Text>
  );
}
