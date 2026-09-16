import { Text, View } from "react-native";
import { Check, Clock, AlertCircle } from "lucide-react-native";

import { Chevron } from "./Chevron";
import { Card } from "./Card";
import { Glass } from "./Glass";
import {
  initialOf,
  visitStateOf,
  type Task,
  type VisitState,
} from "../models/task";
import { thaiDateTime } from "../utils/thaiDate";
import {
  PRIMARY_100,
  PRIMARY_500,
  RADIUS,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";

const BADGE: Record<VisitState, { tint: string; ink: string; label: string }> = {
  done: { tint: "rgba(21,128,61,0.16)", ink: "#15803D", label: "เสร็จแล้ว" },
  pending: { tint: "rgba(0,64,120,0.14)", ink: "#004078", label: "รอทำ" },
  overdue: { tint: "rgba(153,27,27,0.16)", ink: "#991B1B", label: "เกินกำหนด" },
};

/** The badge that says where a visit stands. */
export function VisitBadge({ state }: { state: VisitState }) {
  const b = BADGE[state];
  const Icon = state === "done" ? Check : state === "pending" ? Clock : AlertCircle;

  return (
    // Apple's glass, tinted rather than filled — the same material the
    // avatar on the same card carries, so the two marks on a card are made
    // of one thing rather than two.
    <Glass
      tintColor={b.tint}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.xs,
        borderRadius: RADIUS.capsule,
        overflow: "hidden",
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Icon size={11} color={b.ink} />
      <Text style={{ fontSize: 10, fontWeight: "600", color: b.ink }}>{b.label}</Text>
    </Glass>
  );
}

type Props = {
  task: Task;
  now: Date;
  onPress?: () => void;
  /** Draws the card's own shadow — off where it sits on a frosted sheet. */
  elevated?: boolean;
  /** Ringed while this visit's route is the one drawn on the map. */
  selected?: boolean;
};

/**
 * One scheduled visit.
 *
 * The same card appears on the home list, the plan screen and the map sheet;
 * only the shadow, the ring and whether it is tappable differ, so it is one
 * component rather than four that drift apart.
 */
export function VisitCard({ task, now, onPress, elevated, selected }: Props) {
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={task.name}
      // The lift goes through Card's own flag: passed in `style` it landed
      // on the box that clips to its corners, and the shadow was cut away
      // with everything else outside them.
      elevated={elevated}
      style={[selected && { borderWidth: 2, borderColor: PRIMARY_500 }]}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {/* Apple's glass, tinted the app's blue — the same treatment the
            accept-task profile and the map pins carry, so one person reads
            the same wherever they appear. */}
        <Glass
          tintColor="rgba(7,125,215,0.95)"
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#FFFFFF" }}>
            {initialOf(task)}
          </Text>
        </Glass>
        {/*
          Name and age travel together, and the flex sits on the PAIR rather
          than on the name.

          With flex on the name alone the text claimed every spare point in
          the row and shoved the age out to the far edge, so the badge read
          as belonging to the arrow rather than to the person. Here the group
          takes the space, the name shrinks inside it, and the age stays
          against the name it qualifies.
        */}
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            marginLeft: SPACE.sm,
          }}
        >
          <Text
            numberOfLines={1}
            // Shrinks rather than pushing the badge away: a long name
            // truncates, the age never leaves its side.
            style={{
              flexShrink: 1,
              fontSize: 14,
              fontWeight: "600",
              color: TEXT_PRIMARY,
            }}
          >
            {task.name}
          </Text>
          <Glass
              tintColor="rgba(7,125,215,0.14)"
              style={{
                marginLeft: SPACE.xs,
                borderRadius: RADIUS.capsule,
                overflow: "hidden",
                paddingHorizontal: 9,
                paddingVertical: 3,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: "500", color: PRIMARY_500 }}>
                {task.age} ปี
              </Text>
            </Glass>
        </View>
        {onPress != null && (
          <View style={{ marginLeft: SPACE.sm }}>
            <Chevron />
          </View>
        )}
      </View>

      {/* A fixed two-line box, so cards line up whatever the detail's length. */}
      <Text
        numberOfLines={2}
        style={{
          marginTop: SPACE.md,
          // A minimum, not a fixed height: Thai ascenders and tone marks
          // overrun a box sized to exactly two line heights, and the second
          // line gets clipped away.
          minHeight: 38,
          fontSize: 12,
          lineHeight: 18,
          color: TEXT_MUTED,
        }}
      >
        {task.detail}
      </Text>

      <View style={{ height: 1, backgroundColor: "#EDEDED", marginTop: SPACE.md }} />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: SPACE.sm,
        }}
      >
        <Text
          numberOfLines={1}
          style={{ flex: 1, fontSize: 12, fontWeight: "500", color: TEXT_MUTED }}
        >
          {thaiDateTime(task.dueAt)}
        </Text>
        <VisitBadge state={visitStateOf(task, now)} />
      </View>
    </Card>
  );
}
