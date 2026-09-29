import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import {
  Car,
  Clock,
  MapPin as MapPinIcon,
  Navigation,
  Plus,
  Route as RouteIcon,
  Sparkles,
  X,
} from "lucide-react-native";

import { CardAction } from "./CardAction";
import { DragRow, DropLine } from "./DragRow";
import { GlassIconButton } from "./GlassIconButton";
import { SheetButton } from "./SheetButton";
import { useSheetAsPanel } from "./FloatingSheet";
import { UIcon } from "./UIcon";
import {
  givenName,
  initialOf,
  isDone,
  visitTypeLabel,
  type Task,
} from "../models/task";
import { thaiTime } from "../utils/thaiDate";
import { feel } from "../utils/haptics";
import {
  distanceLabel,
  durationLabel,
  stopLegs,
  type VisitRoute,
} from "../utils/routing";
import { tr } from "../i18n";
import {
  FILL_SUBTLE,
  GLASS_NEUTRAL,
  PRIMARY_100,
  PRIMARY_500,
  PRIMARY_700,
  RADIUS,
  SEPARATOR,
  SPACE,
  SUCCESS,
  SURFACE,
  TEXT_DISABLED,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TYPE,
} from "../theme/tokens";

/** One stop's row: tall enough for a name and a line under it. */
const ROW = 78;
/** The numbered disc at the head of a stop, and the rail it hangs on. */
const DISC = 28;
const RAIL_X = SPACE.md + DISC / 2;

/**
 * Putting the day's visits in the order they will be driven.
 *
 * The round reads as the road it is: where the carer starts, then each
 * stop numbered down a dashed rail, then the houses not in it yet waiting
 * underneath. Stops are added by a tap — on a pin on the map or on a name
 * here — put in order by dragging the grip at the end of the row, and
 * taken out with the cross. "Nearest first" does the whole order at once
 * from where the carer stands. The distance and the drive time are over
 * the top of it, and follow every change.
 */
export function RoutePlanner({
  candidates,
  order,
  route,
  onChange,
  onAuto,
  onDone,
  onCancel,
}: {
  /** Every visit that can go in the round. */
  candidates: Task[];
  /** The round so far, in order. */
  order: Task[];
  /** The road through the round, once known. */
  route: VisitRoute | null;
  onChange: (next: Task[]) => void;
  /** Arrange nearest-first from the carer's position. */
  onAuto: () => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const onGlass = useSheetAsPanel();
  const chosen = new Set(order.map((t) => t.id));
  const legs = stopLegs(route, order.length);
  const rest = candidates.filter((t) => !chosen.has(t.id));
  /** A row being dragged, and the slot it would land in. */
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);

  return (
    // Room over the heading for the close button's shadow: the list this
    // sits in starts flush at its top and clips, and cut the shadow off.
    <View style={{ gap: SPACE.lg, paddingTop: SPACE.sm }}>
      {/* The heading, and the round in three figures. */}
      <View style={{ gap: SPACE.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text
            style={{
              flex: 1,
              fontSize: 20,
              fontWeight: "700",
              color: TEXT_PRIMARY,
            }}
          >
            {tr("วางแผนเส้นทาง", "Plan your route")}
          </Text>
          {/* The app's own close button, as every sheet has it. */}
          <GlassIconButton
            // On the iPad's glass panel a clear glass button is glass on
            // glass and disappears; the neutral tint gives it a body there,
            // as the deck's handle has on its shelf.
            tintColor={onGlass ? GLASS_NEUTRAL : undefined}
            onPress={onCancel}
            accessibilityLabel={tr("ปิดการวางแผน", "Close planning")}
          >
            <X size={22} color={TEXT_PRIMARY} strokeWidth={2.6} />
          </GlassIconButton>
        </View>
        <View style={{ flexDirection: "row", gap: SPACE.sm, flexWrap: "wrap" }}>
          <RouteStat
            icon={
              <MapPinIcon size={13} color={PRIMARY_700} strokeWidth={2.4} />
            }
            label={tr(`${order.length} จุด`, `${order.length} stops`)}
          />
          <RouteStat
            icon={<RouteIcon size={13} color={PRIMARY_700} strokeWidth={2.4} />}
            label={route != null ? distanceLabel(route.metres) : "—"}
          />
          <RouteStat
            icon={<Clock size={13} color={PRIMARY_700} strokeWidth={2.4} />}
            label={
              route != null
                ? tr(
                    `ขับรถ ~${durationLabel(route.seconds)}`,
                    `~${durationLabel(route.seconds)} drive`,
                  )
                : "—"
            }
          />
        </View>
      </View>

      {/* The round: start, then the stops on their rail. */}
      <View
        style={{
          backgroundColor: SURFACE,
          borderRadius: RADIUS.card,
          overflow: "hidden",
        }}
      >
        {/* The rail, behind the discs, from the start to the last stop. */}
        {order.length > 0 && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: RAIL_X - 1,
              top: ROW / 2,
              height: order.length * ROW,
              width: 0,
              borderLeftWidth: 2,
              borderColor: PRIMARY_100,
              borderStyle: "dashed",
            }}
          />
        )}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: SPACE.md,
            height: ROW,
            paddingHorizontal: SPACE.md,
          }}
        >
          <View
            style={{
              width: DISC,
              height: DISC,
              borderRadius: DISC / 2,
              backgroundColor: SUCCESS,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <UIcon name="locationArrow" size={13} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...TYPE.rowTitle, color: TEXT_PRIMARY }}>
              {tr("จุดเริ่มต้น", "Start")}
            </Text>
            <Text style={{ ...TYPE.caption, color: TEXT_MUTED }}>
              {tr("ตำแหน่งของคุณ", "Your location")}
            </Text>
          </View>
        </View>

        {order.length === 0 ? (
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: SEPARATOR,
              paddingVertical: SPACE.xl,
              paddingHorizontal: SPACE.lg,
              alignItems: "center",
              gap: SPACE.sm,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: PRIMARY_100,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <RouteIcon size={22} color={PRIMARY_500} strokeWidth={2.2} />
            </View>
            <Text
              style={{
                ...TYPE.body,
                color: TEXT_MUTED,
                textAlign: "center",
              }}
            >
              {tr(
                "แตะหมุดบนแผนที่ หรือเลือกบ้านด้านล่าง\nตามลำดับที่จะไปเยี่ยม",
                "Tap pins on the map, or houses below,\nin the order you'll visit them",
              )}
            </Text>
          </View>
        ) : (
          order.map((t, i) => {
            const before = drag != null && drag.from > i && drag.to === i;
            const after = drag != null && drag.from < i && drag.to === i;
            return (
              <View key={t.id}>
                {before && <DropLine />}
                <DragRow
                  index={i}
                  count={order.length}
                  height={ROW}
                  rule
                  onDragStart={() => setDrag({ from: i, to: i })}
                  onDragTo={(to) => {
                    setDrag({ from: i, to });
                    feel("tick");
                  }}
                  onDrop={(to) => {
                    setDrag(null);
                    if (to === i) return;
                    const next = [...order];
                    const [moved] = next.splice(i, 1);
                    if (moved == null) return;
                    next.splice(to, 0, moved);
                    onChange(next);
                  }}
                >
                  {/* Nothing, so the row's own gap sets the disc in by SPACE.md —
                      level with the start's disc and the rail. */}
                  <View style={{ width: 0 }} />
                  <View
                    style={{
                      width: DISC,
                      height: DISC,
                      borderRadius: DISC / 2,
                      backgroundColor: PRIMARY_500,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: "#FFFFFF",
                      }}
                    >
                      {i + 1}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={{ ...TYPE.rowTitle, color: TEXT_PRIMARY }}
                    >
                      {givenName(t.name)}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ ...TYPE.caption, color: TEXT_MUTED }}
                    >
                      {`${tr("นัด", "Due")} ${thaiTime(t.dueAt)}${t.visitType != null ? ` · ${visitTypeLabel(t.visitType)}` : ""}`}
                    </Text>
                    {/* How far this stop is from the one before (the
                        first, from the start) and the running total —
                        what the drive to it costs. */}
                    {legs?.[i] != null && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          marginTop: 2,
                        }}
                      >
                        <Car size={12} color={PRIMARY_500} strokeWidth={2.4} />
                        <Text
                          numberOfLines={1}
                          style={{ flexShrink: 1, fontSize: 12 }}
                        >
                          <Text
                            style={{ fontWeight: "700", color: PRIMARY_500 }}
                          >
                            {`${distanceLabel(legs[i].metres)} · ${durationLabel(legs[i].seconds)}`}
                          </Text>
                          <Text style={{ color: TEXT_MUTED }}>
                            {tr(
                              `  รวม ${distanceLabel(legs[i].totalMetres)} · ${durationLabel(legs[i].totalSeconds)}`,
                              `  total ${distanceLabel(legs[i].totalMetres)} · ${durationLabel(legs[i].totalSeconds)}`,
                            )}
                          </Text>
                        </Text>
                      </View>
                    )}
                  </View>
                  <Pressable
                    onPress={() => onChange(order.filter((x) => x.id !== t.id))}
                    accessibilityRole="button"
                    accessibilityLabel={tr(
                      `เอา ${t.name} ออกจากเส้นทาง`,
                      `Remove ${t.name} from the route`,
                    )}
                    hitSlop={6}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: FILL_SUBTLE,
                    }}
                  >
                    <X size={13} color={TEXT_MUTED} strokeWidth={2.8} />
                  </Pressable>
                </DragRow>
                {after && <DropLine />}
              </View>
            );
          })
        )}
      </View>

      {/* Quick ways to put the whole round in order. */}
      <View style={{ flexDirection: "row", gap: SPACE.sm }}>
        <Chip
          icon={<Sparkles size={14} color={PRIMARY_700} strokeWidth={2.4} />}
          label={tr("เรียงใกล้สุดก่อน", "Nearest first")}
          onPress={() => {
            feel("tick");
            onAuto();
          }}
        />
        {order.length > 0 && (
          <Chip
            icon={<X size={14} color={PRIMARY_700} strokeWidth={2.6} />}
            label={tr("ล้างทั้งหมด", "Clear all")}
            onPress={() => onChange([])}
          />
        )}
      </View>

      {/* The houses not in it yet. */}
      {rest.length > 0 && (
        <View style={{ gap: SPACE.sm }}>
          <Text
            style={{ fontSize: 15, fontWeight: "600", color: TEXT_PRIMARY }}
          >
            {tr("เพิ่มจุดแวะ", "Add a stop")}
          </Text>
          <View
            style={{
              backgroundColor: SURFACE,
              borderRadius: RADIUS.card,
              overflow: "hidden",
            }}
          >
            {rest.map((t, i) => {
              const done = isDone(t);
              return (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    feel("tick");
                    onChange([...order, t]);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={tr(
                    `เพิ่ม ${t.name} เป็นจุดที่ ${order.length + 1}`,
                    `Add ${t.name} as stop ${order.length + 1}`,
                  )}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.md,
                    height: ROW,
                    paddingHorizontal: SPACE.md,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: SEPARATOR,
                    backgroundColor: pressed ? PRIMARY_100 : undefined,
                  })}
                >
                  <View
                    style={{
                      width: DISC,
                      height: DISC,
                      borderRadius: DISC / 2,
                      backgroundColor: FILL_SUBTLE,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: TEXT_MUTED,
                      }}
                    >
                      {initialOf(t)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        ...TYPE.rowTitle,
                        color: done ? TEXT_DISABLED : TEXT_PRIMARY,
                      }}
                    >
                      {givenName(t.name)}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ ...TYPE.caption, color: TEXT_MUTED }}
                    >
                      {done
                        ? tr("เยี่ยมแล้ววันนี้", "Visited today")
                        : `${thaiTime(t.dueAt)}${t.visitType != null ? ` · ${visitTypeLabel(t.visitType)}` : ""}`}
                    </Text>
                  </View>
                  {/* The app's own card action — blue glass, as the
                      diagnosis page's "Add" is. */}
                  <CardAction
                    icon={<Plus size={14} color="#FFFFFF" strokeWidth={2.8} />}
                    label={tr("เพิ่ม", "Add")}
                    onPress={() => {
                      feel("tick");
                      onChange([...order, t]);
                    }}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <View style={{ flexDirection: "row" }}>
        <SheetButton
          primary
          disabled={order.length === 0}
          icon={<Navigation size={18} color="#FFFFFF" strokeWidth={2.4} />}
          label={
            order.length === 0
              ? tr("เลือกอย่างน้อย 1 จุด", "Pick at least one stop")
              : tr(
                  `แสดงเส้นทาง ${order.length} จุด`,
                  `Show route · ${order.length} stops`,
                )
          }
          onPress={onDone}
        />
      </View>
    </View>
  );
}

/** One figure about the round, in a tinted capsule. */
export function RouteStat({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: SPACE.sm + 2,
        height: 28,
        borderRadius: RADIUS.capsule,
        backgroundColor: PRIMARY_100,
      }}
    >
      {icon}
      <Text style={{ fontSize: 13, fontWeight: "600", color: PRIMARY_700 }}>
        {label}
      </Text>
    </View>
  );
}

function Chip({
  icon,
  label,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: SPACE.md,
        height: 34,
        borderRadius: RADIUS.capsule,
        borderWidth: 1,
        borderColor: PRIMARY_100,
        backgroundColor: pressed ? PRIMARY_100 : SURFACE,
      })}
    >
      {icon}
      <Text style={{ fontSize: 13, fontWeight: "600", color: PRIMARY_700 }}>
        {label}
      </Text>
    </Pressable>
  );
}
