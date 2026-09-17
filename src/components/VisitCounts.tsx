import { Text, View } from "react-native";

import { Card } from "./Card";
import { isDone, visitStateOf, type Task } from "../models/task";
import {
  DANGER,
  PRIMARY_500,
  SPACE,
  SUCCESS,
  TEXT_DISABLED,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";

/**
 * How a set of visits stands, in four figures.
 *
 * The strip at the head of the plan screen's sheet, made shared: the
 * assistant answers "how is today going" with the same four numbers, and two
 * copies of this would have drifted the first time one of them was changed.
 *
 * It takes the visits rather than the counts so that a caller cannot hand it
 * a total that disagrees with its own parts — which is the only way this can
 * be wrong.
 */
export function VisitCounts({
  tasks,
  now,
  padded = true,
}: {
  tasks: Task[];
  now: Date;
  /** Off where the caller is already inside a card of its own. */
  padded?: boolean;
}) {
  const done = tasks.filter(isDone).length;
  const overdue = tasks.filter((t) => visitStateOf(t, now) === "overdue").length;

  const row = (
    <View style={{ flexDirection: "row" }}>
      <Counter label="ทั้งหมด" value={tasks.length} ink={TEXT_PRIMARY} />
      <Counter label="กำลังจะทำ" value={tasks.length - done} ink={PRIMARY_500} />
      <Counter label="เสร็จสิ้นแล้ว!" value={done} ink={SUCCESS} />
      <Counter
        label="เกินกำหนด"
        value={overdue}
        ink={overdue > 0 ? DANGER : TEXT_DISABLED}
      />
    </View>
  );

  return padded ? <Card style={{ padding: SPACE.lg }}>{row}</Card> : row;
}

function Counter({
  label,
  value,
  ink,
}: {
  label: string;
  value: number;
  ink: string;
}) {
  return (
    // Centred in its column, both lines. Left-aligned, the figure and its
    // label sat against the column's leading edge and the four read as a
    // ragged row rather than as four equal cells.
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ fontSize: 14, fontWeight: "800", color: ink }}>
        {value}
      </Text>
      <Text
        numberOfLines={1}
        // Shrinks rather than truncating. The design's frame is 440 wide and
        // "เสร็จสิ้นแล้ว!" fits its quarter of that; on a 390pt phone the
        // same label in the same column does not, and clipping a word
        // mid-stroke reads as a bug rather than as a tight fit.
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={{
          marginTop: SPACE.sm,
          fontSize: 12,
          fontWeight: "400",
          color: TEXT_MUTED,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </View>
  );
}
