import { Text, View } from "react-native";
import {
  CircleCheck,
  CloudUpload,
  PencilLine,
  PlayCircle,
} from "lucide-react-native";

import { ActivityAvatar } from "./ActivityAvatar";
import { Card } from "./Card";
import { Chevron } from "./Chevron";
import { Glass } from "./Glass";
import { StatusTag } from "./StatusTag";
import {
  ACTIVITY_STATE_LABEL,
  type Activity,
  type ActivityState,
} from "../models/vaccination";
import { thaiShortDate, thaiTime } from "../utils/thaiDate";
import {
  DANGER_INK,
  INK_OK,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme/tokens";

/**
 * One activity, as a card.
 *
 * The four things that decide whether a carer can walk into this — where,
 * who, when, and how many — and one action. The count is set large because
 * it is the figure the day is planned around: fifty children is a morning,
 * twenty-four is an hour.
 *
 * The state chip and the action are the app's own glass, not painted
 * lookalikes. Every other status mark and card action here is Apple's
 * material, and two of them made of flat fill was the reason this screen
 * did not look like the rest of it.
 */
export function ActivityCard({
  activity,
  progress,
  late: lateBy,
  onPress,
}: {
  activity: Activity;
  /** Set while a sitting on this activity is under way. */
  progress?: { done: number; total: number };
  /**
   * Whole days past its date, for work that was never closed.
   *
   * A figure rather than a flag, though nothing prints it: the card is
   * ordered by it in the list it appears in, and the date going red is
   * how it shows.
   */
  late?: number;
  onPress: () => void;
}) {
  const going = progress != null;
  /*
    Late only counts from a whole day out.

    Guarded on the figure rather than on the prop being set, so a caller
    that works out "how late is this" and gets nought cannot redden a card
    that is not late at all — which is the same thing the list already
    believes, said once more where the colour is actually chosen.
  */
  const late = lateBy != null && lateBy > 0 ? lateBy : null;
  /*
    One label, because there is one thing the card does.

    It used to read "เตรียมกลุ่ม" on the three activities whose roster was
    still a draft, from a step — confirming the list, checking the consent
    forms — that was never built: pressing it raised a toast saying the
    feature was not open yet. Now that every card opens a session, a button
    saying one thing and doing another is worse than the toast was. That the
    group is a draft is already on the state tag beside the title, which is
    where a fact about the group belongs.
  */
  const label = going ? "ทำต่อ" : "เปิด Session";

  return (
    // The whole card, not just the capsule at the foot of it. The card IS
    // the activity, and every part of it is answering the same question —
    // so a carer aiming at the title or the count gets what they meant
    // rather than nothing.
    // The whole card, not a capsule at the foot of it. The card IS the
    // activity, and every part of it answers the same question — so a carer
    // aiming at the title or the count gets what they meant rather than
    // nothing.
    <Card
      onPress={onPress}
      accessibilityLabel={`${activity.title} ${activity.place} ${label}`}
    >
      {/*
        The app's own card, laid out the way every other list in it is.

        This had grown its own shape — a date line above a title above two
        grey lines above a rule above a figure fighting a capsule — which is
        four ideas none of the rest of the app uses. A visit card is: who,
        with a mark beside the name; what it is about, in a two-line box so
        the cards line up; a rule; then when, with where it stands. A round
        of vaccinations is the same four things about a class instead of a
        person, so it is the same card.
      */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <ActivityAvatar kind={activity.kind} records={activity.records} />

        {/*
          Title and count travel together, and the flex sits on the PAIR.

          With flex on the title alone it claims every spare point and
          shoves the count to the far edge, where it reads as belonging to
          the arrow rather than to the work.
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
            style={{
              flexShrink: 1,
              fontSize: 15,
              lineHeight: 22,
              fontWeight: "700",
              color: TEXT_PRIMARY,
            }}
          >
            {activity.title}
          </Text>
          <Glass
            tintColor={going ? "rgba(21,128,61,0.16)" : "rgba(7,125,215,0.14)"}
            style={{
              marginLeft: SPACE.xs,
              borderRadius: RADIUS.capsule,
              overflow: "hidden",
              paddingHorizontal: 9,
              paddingVertical: 3,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: "700",
                color: going ? INK_OK : PRIMARY_500,
                fontVariant: ["tabular-nums"],
              }}
            >
              {going
                ? `${progress.done}/${progress.total}`
                : `${activity.targets} คน`}
            </Text>
          </Glass>
        </View>

        <View style={{ marginLeft: SPACE.sm }}>
          <Chevron />
        </View>
      </View>

      {/* A fixed two-line box, so cards line up whatever the school's name
          happens to be. A minimum rather than a fixed height: Thai
          ascenders overrun a box sized to exactly two line heights and the
          second line gets clipped away. */}
      <Text
        numberOfLines={2}
        style={{
          marginTop: SPACE.md,
          minHeight: 38,
          fontSize: 12,
          lineHeight: 18,
          color: TEXT_MUTED,
        }}
      >
        {`${activity.place}\n${activity.group}`}
      </Text>

      <View
        style={{ height: 1, backgroundColor: SEPARATOR, marginTop: SPACE.md }}
      />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: SPACE.sm,
          gap: SPACE.sm,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: late == null ? "500" : "700",
            color: late == null ? TEXT_MUTED : DANGER_INK,
            fontVariant: ["tabular-nums"],
          }}
        >
          {`${thaiShortDate(activity.at)} · ${thaiTime(activity.at)}`}
        </Text>
        {/*
          An overdue card carries no badge at all.

          It had one saying how many days late it was, which the date
          beside it already says — a chip repeating the line it sits on is
          a chip in the way. And the activity's own state cannot stand
          there either: "พร้อมใช้งาน" on a round that should have happened
          last Tuesday is the card agreeing with itself and not with the
          day. So the date goes red and the space stays empty, which is
          quieter than either and says the same thing.

          A sitting under way still outranks both — it is what a carer
          coming back to this page is looking for.
        */}
        {going ? (
          <StatusTag label="กำลังทำ" ink={PRIMARY_500} Icon={PlayCircle} />
        ) : late != null ? null : (
          <StateBadge state={activity.state} />
        )}
      </View>
    </Card>
  );
}

/**
 * Where the activity stands, on the same material every other status mark
 * in this app is made of.
 *
 * Tinted rather than filled: the tint is mixed into the glass, so the chip
 * carries the page behind it the way the visit badges on the plan screen
 * do.
 */
function StateBadge({ state }: { state: ActivityState }) {
  const look =
    state === "ready"
      ? { tint: "rgba(21,128,61,0.16)", ink: INK_OK, Icon: CircleCheck }
      : state === "draft"
        ? {
            tint: "rgba(120,120,128,0.18)",
            ink: TEXT_SECONDARY,
            Icon: PencilLine,
          }
        : { tint: "rgba(153,27,27,0.16)", ink: DANGER_INK, Icon: CloudUpload };

  return (
    <StatusTag
      label={ACTIVITY_STATE_LABEL[state]}
      ink={look.ink}
      tint={look.tint}
      Icon={look.Icon}
    />
  );
}
