import { Text, View } from "react-native";
import Svg, { Line } from "react-native-svg";

import { PressableScale } from "./PressableScale";
import { UIcon } from "./UIcon";
import { givenName, type Task } from "../models/task";
import { thaiTime } from "../utils/thaiDate";
import { tr } from "../i18n";
import {
  distanceLabel,
  durationLabel,
  stopLegs,
  type VisitRoute,
} from "../utils/routing";
import {
  PRIMARY_500,
  RADIUS,
  SPACE,
  SUCCESS,
  TEXT_DISABLED,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TYPE,
} from "../theme/tokens";

/**
 * The round in words: how far and how long, where it starts, then each
 * stop numbered with its time. One list for the assistant's card and the
 * map's sheet, so the round reads the same in both.
 */
export function TourList({
  stops,
  route,
  onOpenStop,
}: {
  stops: Task[];
  route: VisitRoute | null;
  onOpenStop: (t: Task) => void;
}) {
  const legs = stopLegs(route, stops.length);
  return (
    <View
      style={{
        padding: SPACE.md,
        gap: SPACE.sm,
        borderRadius: RADIUS.lg,
        backgroundColor: "#FFFFFF",
      }}
    >
      <Text style={{ ...TYPE.rowTitle, color: TEXT_PRIMARY }}>
        {tr(
          `เส้นทางเยี่ยม ${stops.length} จุด`,
          `Visit route · ${stops.length} stop${stops.length === 1 ? "" : "s"}`,
        )}
      </Text>
      {route != null && (
        <Text style={{ ...TYPE.detail, color: TEXT_MUTED }}>
          {tr(
            `รวม ${distanceLabel(route.metres)} · ขับรถประมาณ ${durationLabel(route.seconds)}`,
            `${distanceLabel(route.metres)} total · about ${durationLabel(route.seconds)} by car`,
          )}
        </Text>
      )}
      {/* The start, above the first stop: the round runs from here. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.sm,
          paddingVertical: 4,
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: SUCCESS,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <UIcon name="locationArrow" size={12} color="#FFFFFF" />
        </View>
        <Text
          numberOfLines={1}
          style={{ flex: 1, ...TYPE.rowTitle, color: TEXT_PRIMARY }}
        >
          {tr("จุดเริ่มต้น · ตำแหน่งของคุณ", "Start · Your location")}
        </Text>
      </View>
      {stops.map((s, i) => (
        <View key={s.id}>
          {/* The leg to this stop, as the dashed line the route draws,
              with its distance and drive time once the road is known. */}
          <Leg
            label={
              legs?.[i] != null
                ? `${distanceLabel(legs[i].metres)} · ${durationLabel(legs[i].seconds)}`
                : undefined
            }
          />
          <PressableScale
            onPress={() => onOpenStop(s)}
            scaleTo={0.99}
            accessibilityRole="button"
            accessibilityLabel={tr(
              `จุดที่ ${i + 1} ${s.name} ${thaiTime(s.dueAt)}`,
              `Stop ${i + 1} ${s.name} ${thaiTime(s.dueAt)}`,
            )}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.sm,
              paddingVertical: 4,
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: PRIMARY_500,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  ...TYPE.caption,
                  fontWeight: "700",
                  color: "#FFFFFF",
                }}
              >
                {i + 1}
              </Text>
            </View>
            <Text
              numberOfLines={1}
              style={{ flex: 1, ...TYPE.rowTitle, color: TEXT_PRIMARY }}
            >
              {tr(`คุณ${givenName(s.name)}`, givenName(s.name))}
            </Text>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ ...TYPE.caption, color: TEXT_MUTED }}>
                {thaiTime(s.dueAt)}
              </Text>
              {/* From the start to here, all told. */}
              {legs?.[i] != null && (
                <Text style={{ fontSize: 11, color: TEXT_DISABLED }}>
                  {tr(
                    `รวม ${distanceLabel(legs[i].totalMetres)} · ${durationLabel(legs[i].totalSeconds)}`,
                    `${distanceLabel(legs[i].totalMetres)} · ${durationLabel(legs[i].totalSeconds)} total`,
                  )}
                </Text>
              )}
            </View>
          </PressableScale>
        </View>
      ))}
    </View>
  );
}

/**
 * The way from one stop to the next, down the list's left edge: a dashed
 * line from the circle above to the circle below, so the list reads as the
 * road it is rather than a column of names.
 */
function Leg({ label }: { label?: string }) {
  const H = label != null ? 24 : 18;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        height: H,
        // Up into the gap above, so the dashes leave the circle above and
        // reach the one below.
        marginTop: -12,
        marginBottom: -4,
      }}
    >
      <View style={{ width: 24, alignItems: "center" }}>
        <Svg width={2} height={H}>
          <Line
            x1={1}
            y1={0}
            x2={1}
            y2={H}
            stroke={TEXT_DISABLED}
            strokeWidth={1}
            strokeDasharray="2 3"
            strokeLinecap="round"
          />
        </Svg>
      </View>
      {/* How far this stretch is and how long it takes to drive, set
          beside the dashes that stand for it — the way Maps labels each
          leg of a route with several stops. */}
      {label != null && (
        <Text
          numberOfLines={1}
          style={{
            marginLeft: SPACE.sm,
            fontSize: 11,
            fontWeight: "600",
            color: PRIMARY_500,
          }}
        >
          {label}
        </Text>
      )}
    </View>
  );
}
