import { useMemo, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle2, CircleAlert, Package, Truck } from "lucide-react-native";

import { Card } from "../components/Card";
import { FilterChips } from "../components/FilterChips";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { PressableScale } from "../components/PressableScale";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionHeader } from "../components/SectionHeader";
import { StatusTag } from "../components/StatusTag";
import {
  DELIVERY_LABEL,
  markDelivery,
  supplyCounts,
  useSupplies,
  type Delivery,
  type DeliveryState,
} from "../models/supplies";
import { planToday } from "../models/clock";
import { feel } from "../utils/haptics";
import { isSameDay, thaiShortDate } from "../utils/thaiDate";
import {
  CANVAS,
  DANGER_INK,
  INK_OK,
  PRIMARY_500,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme/tokens";

type Band = "today" | "waiting" | "done" | "all";

const LOOK: Record<
  DeliveryState,
  { ink: string; tint: string; Icon: typeof Package }
> = {
  waiting: {
    ink: TEXT_SECONDARY,
    tint: "rgba(120,120,128,0.18)",
    Icon: Package,
  },
  onRoad: { ink: PRIMARY_500, tint: "rgba(7,125,215,0.14)", Icon: Truck },
  delivered: { ink: INK_OK, tint: "rgba(21,128,61,0.16)", Icon: CheckCircle2 },
  missed: { ink: DANGER_INK, tint: "rgba(153,27,27,0.16)", Icon: CircleAlert },
};

/**
 * "ส่งเวชภัณฑ์และยา" — the bag, and where it is going.
 *
 * A separate errand from a visit: a carer carries medicines to people they
 * are not otherwise seeing that week, and what decides the morning is
 * which village the bag is going to rather than whose name is on it.
 *
 * Marked from the list rather than from a page of its own. Standing at a
 * gate with a bag in one hand, the whole interaction is one press — and
 * the only one that asks anything is the one that failed, because a
 * delivery that did not arrive is a thing somebody has to chase and
 * "ส่งไม่สำเร็จ" on its own tells them nothing.
 */
export function SuppliesScreen() {
  const insets = useSafeAreaInsets();
  const all = useSupplies();
  const [band, setBand] = useState<Band>("today");

  const counts = supplyCounts(all);
  const chips = [
    {
      key: "today" as const,
      label: "วันนี้",
      count: all.filter((d) => isSameDay(d.dueAt, planToday)).length,
    },
    {
      key: "waiting" as const,
      label: "ยังไม่ได้ส่ง",
      count: counts.waiting + counts.onRoad,
    },
    { key: "done" as const, label: "ส่งแล้ว", count: counts.delivered },
    { key: "all" as const, label: "ทั้งหมด", count: counts.all },
  ];

  const shown = useMemo(() => {
    if (band === "today")
      return all.filter((d) => isSameDay(d.dueAt, planToday));
    if (band === "waiting")
      return all.filter((d) => d.state === "waiting" || d.state === "onRoad");
    if (band === "done") return all.filter((d) => d.state === "delivered");
    return all;
  }, [all, band]);

  const mark = (d: Delivery) => {
    feel("tick");
    Alert.alert(d.name, d.items.join(" · "), [
      {
        text: "ส่งแล้ว",
        onPress: () => markDelivery(d.id, "delivered"),
      },
      {
        text: "กำลังนำส่ง",
        onPress: () => markDelivery(d.id, "onRoad"),
      },
      {
        text: "ส่งไม่สำเร็จ",
        style: "destructive",
        onPress: () =>
          Alert.prompt?.(
            "ส่งไม่สำเร็จเพราะ",
            "เขียนสั้น ๆ ว่าเกิดอะไรขึ้น เพื่อให้คนที่ตามต่อรู้ว่าต้องทำอะไร",
            (why) =>
              markDelivery(d.id, "missed", why.trim() || "ไม่ระบุเหตุผล"),
          ) ?? markDelivery(d.id, "missed", "ไม่ระบุเหตุผล"),
      },
      { text: "ยกเลิก", style: "cancel" },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <ScreenHeader
        title="ส่งเวชภัณฑ์และยา"
        below={
          <View style={{ marginTop: SPACE.md, marginHorizontal: -SPACE.lg }}>
            <FilterChips
              chips={chips}
              value={band}
              onChange={setBand}
              pad={SPACE.lg}
            />
          </View>
        }
      />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: SPACE.lg,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + SPACE.xxxl,
            gap: SPACE.md,
          }}
          showsVerticalScrollIndicator={false}
        >
          {shown.length === 0 ? (
            <Card>
              <Text
                style={{ fontSize: 15, lineHeight: 24, color: TEXT_SECONDARY }}
              >
                {band === "today"
                  ? "วันนี้ไม่มีของต้องนำส่ง"
                  : "ไม่มีรายการในกลุ่มนี้"}
              </Text>
            </Card>
          ) : (
            <>
              <SectionHeader title="รายการนำส่ง" count={shown.length} flush />
              <Card padded={false}>
                {shown.map((d, i) => (
                  <Row
                    key={d.id}
                    delivery={d}
                    divider={i > 0}
                    onPress={() => mark(d)}
                  />
                ))}
              </Card>
              <Text
                style={{
                  paddingHorizontal: SPACE.xs,
                  fontSize: 12,
                  lineHeight: 19,
                  color: TEXT_MUTED,
                }}
              >
                แตะรายการเพื่อบันทึกผลการนำส่ง — บันทึกไว้ในเครื่องนี้
              </Text>
            </>
          )}
        </ScrollView>
      </HeaderFade>
    </View>
  );
}

/** One delivery: who, where, what is in the bag, and where it has got to. */
function Row({
  delivery: d,
  divider,
  onPress,
}: {
  delivery: Delivery;
  divider: boolean;
  onPress: () => void;
}) {
  const look = LOOK[d.state];
  const settled = d.state === "delivered";

  return (
    <PressableScale
      scaleTo={0.995}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${d.name} ${DELIVERY_LABEL[d.state]}`}
      style={{
        gap: SPACE.xs,
        padding: SPACE.lg,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: SEPARATOR,
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}
      >
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: 16,
            lineHeight: 25,
            fontWeight: "600",
            color: settled ? TEXT_MUTED : TEXT_PRIMARY,
          }}
        >
          {d.name}
        </Text>
        <StatusTag
          label={DELIVERY_LABEL[d.state]}
          ink={look.ink}
          tint={look.tint}
          Icon={look.Icon}
        />
      </View>

      <Text
        numberOfLines={1}
        style={{ fontSize: 13, lineHeight: 21, color: TEXT_SECONDARY }}
      >
        {d.items.join(" · ")}
      </Text>

      <Text style={{ fontSize: 12, lineHeight: 19, color: TEXT_MUTED }}>
        {`${thaiShortDate(d.dueAt)} · ${d.village}`}
      </Text>

      {/* Why it did not arrive, where it did not. A round that only said
          "ส่งไม่สำเร็จ" left whoever picks it up tomorrow with nothing to
          go on. */}
      {d.note != null && (
        <Text style={{ fontSize: 13, lineHeight: 21, color: DANGER_INK }}>
          {d.note}
        </Text>
      )}
    </PressableScale>
  );
}
