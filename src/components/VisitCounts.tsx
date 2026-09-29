import { Text, View } from "react-native";

import { Card } from "./Card";
import { isDone, visitStateOf, type Task } from "../models/task";
import { tr } from "../i18n";
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
  const overdue = tasks.filter(
    (t) => visitStateOf(t, now) === "overdue",
  ).length;

  const row = (
    <View style={{ flexDirection: "row" }}>
      <Counter label={tr("ทั้งหมด", "All")} value={tasks.length} ink={TEXT_PRIMARY} />
      <Counter
        label={tr("กำลังจะทำ", "Upcoming")}
        value={tasks.length - done}
        ink={PRIMARY_500}
      />
      <Counter label={tr("เสร็จสิ้นแล้ว", "Completed")} value={done} ink={SUCCESS} />
      <Counter
        label={tr("เกินกำหนด", "Overdue")}
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
      {/*
        One size for all four, and no automatic fitting.

        This carried `adjustsFontSizeToFit`, on the reasoning that the
        longest of the four labels would not fit its quarter of a narrow
        phone. It does not only shrink: given a column with room to spare it
        scales the text UP, and "เสร็จสิ้นแล้ว" came out two and a half
        times the size of the three beside it — four labels at four sizes,
        which is worse than the truncation it was guarding against.

        The label was the real problem and it is shorter now. A row of
        figures is read by comparing them, and nothing about a set of
        counts is comparable if the words under them are different sizes.
      */}
      <Text
        numberOfLines={1}
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
