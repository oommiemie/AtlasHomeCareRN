import { Pressable, Text, View } from "react-native";
import { Check, Clock, AlertCircle } from "lucide-react-native";

import { Chevron } from "./Chevron";
import { Card } from "./Card";
import { Glass } from "./Glass";
import { StatusTag } from "./StatusTag";
import {
  initialOf,
  visitStateOf,
  type Task,
  visitTypeLabel,
  type VisitState,
} from "../models/task";
import { tr } from "../i18n";
import { thaiDateTime, thaiDayMonth, thaiTime } from "../utils/thaiDate";
import {
  DANGER_INK,
  GROUPED_BG,
  INK_OK,
  PRIMARY_100,
  PRIMARY_700,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SURFACE,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TYPE,
} from "../theme/tokens";

/**
 * Read as the badge renders, never held in a module const.
 *
 * The inks turn with the theme — a bottle green that reads on white is
 * unreadable on a dark card — and a const initialised at import would
 * capture whichever palette happened to be loaded first and keep it.
 * The tints are washes over glass, at strengths that work on either ground.
 */
const badgeFor = (
  state: VisitState,
): { tint: string; ink: string; label: string } =>
  state === "done"
    ? { tint: "rgba(21,128,61,0.16)", ink: INK_OK, label: tr("เสร็จแล้ว", "Done") }
    : state === "pending"
      ? { tint: "rgba(0,64,120,0.14)", ink: PRIMARY_700, label: tr("รอทำ", "To do") }
      : { tint: "rgba(153,27,27,0.16)", ink: DANGER_INK, label: tr("เกินกำหนด", "Overdue") };

/** The badge that says where a visit stands. */
export function VisitBadge({ state }: { state: VisitState }) {
  const b = badgeFor(state);
  const Icon =
    state === "done" ? Check : state === "pending" ? Clock : AlertCircle;

  return (
    // Apple's glass, tinted rather than filled — the same material the
    // avatar on the same card carries, so the two marks on a card are made
    // of one thing rather than two.
    <StatusTag label={b.label} ink={b.ink} tint={b.tint} Icon={Icon} />
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
              ...TYPE.rowTitle,
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
            <Text
              style={{ ...TYPE.caption, fontWeight: "500", color: PRIMARY_500 }}
            >
              {tr(`${task.age} ปี`, `${task.age} yrs`)}
            </Text>
          </Glass>
        </View>
        {onPress != null && (
          <View style={{ marginLeft: SPACE.sm }}>
            <Chevron />
          </View>
        )}
      </View>

      {/* What kind of visit it is, over what it is for: the type decides
          what the carer takes with them before the reason is read. */}
      {task.visitType != null && (
        <Text
          numberOfLines={1}
          style={{
            marginTop: SPACE.md,
            ...TYPE.caption,
            fontWeight: "600",
            color: PRIMARY_500,
          }}
        >
          {visitTypeLabel(task.visitType)}
        </Text>
      )}

      {/* One line: the card names the visit, and the page behind it says the
          rest. A minimum height keeps Thai marks from being clipped. */}
      <Text
        numberOfLines={1}
        style={{
          marginTop: task.visitType != null ? 2 : SPACE.md,
          // A minimum, not a fixed height: Thai ascenders and tone marks
          // overrun a box sized to exactly two line heights, and the second
          // line gets clipped away.
          minHeight: 20,
          ...TYPE.detail,
          color: TEXT_MUTED,
        }}
      >
        {task.detail}
      </Text>

      <View
        style={{ height: 1, backgroundColor: SEPARATOR, marginTop: SPACE.md }}
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: SPACE.sm,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            ...TYPE.caption,
            fontWeight: "500",
            color: TEXT_MUTED,
          }}
        >
          {thaiDateTime(task.dueAt)}
        </Text>
        <VisitBadge state={visitStateOf(task, now)} />
      </View>
    </Card>
  );
}

/**
 * The same visit, small enough to sit inside an answer.
 *
 * The full card is drawn to be scanned down a page: a two-line box for what
 * the visit is for, a rule, and the date on its own row. Inside a
 * conversation that is most of the screen for one answer, and an answer that
 * fills the screen stops being an answer. This keeps what a carer picks a
 * visit out by — who, when, what for, and where it stands — and drops the
 * spacing that made the other one a card to scroll past.
 *
 * It carries its own surface rather than sharing one with its neighbours:
 * rows divided by hairlines read as a table, and a table is a thing to read
 * down, while these are separate visits to choose between.
 *
 * It lives here rather than in the screen that uses it so the two stay in
 * step: a change to what a visit shows should not be made twice.
 */
export function VisitRow({
  task,
  now,
  onPress,
}: {
  task: Task;
  now: Date;
  onPress?: () => void;
}) {
  const AVATAR = 34;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress == null ? undefined : "button"}
      accessibilityLabel={`${task.name} ${thaiDateTime(task.dueAt)}`}
      style={({ pressed }) => ({
        padding: SPACE.md,
        // The card radius, not the smaller one: this is a card, and a row of
        // these beside a `Card` at 24 with its own corners at 16 reads as two
        // different kinds of thing stacked together.
        borderRadius: RADIUS.card,
        gap: 3,
        backgroundColor: pressed && onPress != null ? GROUPED_BG : SURFACE,
      })}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}
      >
        <Glass
          tintColor="rgba(7,125,215,0.95)"
          style={{
            width: AVATAR,
            height: AVATAR,
            borderRadius: AVATAR / 2,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#FFFFFF" }}>
            {initialOf(task)}
          </Text>
        </Glass>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: 14,
            fontWeight: "600",
            color: TEXT_PRIMARY,
          }}
        >
          {task.name}
        </Text>
        <VisitBadge state={visitStateOf(task, now)} />
        {onPress == null ? null : <Chevron />}
      </View>

      {/*
        When and what for, on the line under the name and indented to it.

        Given the row's whole width rather than what is left beside the
        badge, and the date written short — "17 ก.ย." rather than "17
        กันยายน 2569" — because the year is never the thing being read here
        and spending eight characters on it truncated the reason for the
        visit, which is.
      */}
      <Text
        numberOfLines={1}
        style={{
          marginLeft: AVATAR + SPACE.sm,
          fontSize: 12,
          color: TEXT_MUTED,
        }}
      >
        {thaiDayMonth(task.dueAt)} {thaiTime(task.dueAt)} ·{" "}
        {task.visitType != null ? `${visitTypeLabel(task.visitType)} · ` : ""}
        {task.detail}
      </Text>
    </Pressable>
  );
}
