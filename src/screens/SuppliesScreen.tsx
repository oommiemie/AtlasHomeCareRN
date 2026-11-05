import { useMemo, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle2, CircleAlert, Package, Truck } from "lucide-react-native";

import { Card } from "../components/Card";
import { FilterChips } from "../components/FilterChips";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { PressableScale } from "../components/PressableScale";
import { ReasonSheet } from "../components/ReasonSheet";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionHeader } from "../components/SectionHeader";
import { StatusTag } from "../components/StatusTag";
import { toast } from "../components/Toast";
import {
  DELIVERY_LABEL,
  markDelivery,
  MISSED_REASONS,
  supplyCounts,
  useSupplies,
  type Delivery,
  type DeliveryState,
} from "../models/supplies";
import { planToday } from "../models/clock";
import { feel } from "../utils/haptics";
import { isSameDay, thaiShortDate } from "../utils/thaiDate";
import { tr } from "../i18n";
import { readable, GUTTER } from "../theme/layout";
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

const NO_REASON = tr("ไม่ระบุเหตุผล", "No reason given");

/** A saved "no reason" in the language on screen, whichever it was saved in. */
const noteLabel = (note: string) =>
  note === "ไม่ระบุเหตุผล" || note === "No reason given" ? NO_REASON : note;

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
  // The delivery being asked why it did not arrive.
  const [missed, setMissed] = useState<Delivery | null>(null);

  const counts = supplyCounts(all);
  const chips = [
    {
      key: "today" as const,
      label: tr("วันนี้", "Today"),
      count: all.filter((d) => isSameDay(d.dueAt, planToday)).length,
    },
    {
      key: "waiting" as const,
      label: tr("ยังไม่ได้ส่ง", "Not yet sent"),
      count: counts.waiting + counts.onRoad,
    },
    {
      key: "done" as const,
      label: tr("ส่งแล้ว", "Delivered"),
      count: counts.delivered,
    },
    { key: "all" as const, label: tr("ทั้งหมด", "All"), count: counts.all },
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
        text: tr("ส่งแล้ว", "Delivered"),
        onPress: () => {
          markDelivery(d.id, "delivered");
          toast(tr("บันทึกว่าส่งแล้ว", "Marked as delivered"), "success");
        },
      },
      {
        text: tr("กำลังนำส่ง", "On the way"),
        onPress: () => {
          markDelivery(d.id, "onRoad");
          toast(
            tr("เปลี่ยนเป็นกำลังนำส่งแล้ว", "Marked as on the way"),
            "success",
          );
        },
      },
      {
        text: tr("ส่งไม่สำเร็จ", "Not delivered"),
        style: "destructive",
        // A sheet of reasons, not iOS's text prompt: Android has none, and
        // a picked reason is the same words every time, so they can be
        // counted.
        onPress: () => setMissed(d),
      },
      { text: tr("ยกเลิก", "Cancel"), style: "cancel" },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <ScreenHeader
        title={tr("ส่งเวชภัณฑ์และยา", "Supplies & medication delivery")}
        below={
          <View style={{ marginTop: SPACE.md, marginHorizontal: -GUTTER }}>
            <FilterChips
              chips={chips}
              value={band}
              onChange={setBand}
              pad={GUTTER}
            />
          </View>
        }
      />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: GUTTER,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + SPACE.xxxl,
            gap: SPACE.md,
            ...readable(),
          }}
          showsVerticalScrollIndicator={false}
        >
          {shown.length === 0 ? (
            <Card>
              <Text
                style={{ fontSize: 15, lineHeight: 24, color: TEXT_SECONDARY }}
              >
                {band === "today"
                  ? tr("วันนี้ไม่มีของต้องนำส่ง", "Nothing to deliver today")
                  : tr("ไม่มีรายการในกลุ่มนี้", "Nothing in this group")}
              </Text>
            </Card>
          ) : (
            <>
              <SectionHeader
                title={tr("รายการนำส่ง", "Deliveries")}
                count={shown.length}
                flush
              />
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
                {tr(
                  "แตะรายการเพื่อบันทึกผลการนำส่ง — บันทึกไว้ในเครื่องนี้",
                  "Tap a delivery to record how it went — saved on this device",
                )}
              </Text>
            </>
          )}
        </ScrollView>
      </HeaderFade>

      <ReasonSheet
        visible={missed != null}
        title={tr("ส่งไม่สำเร็จ", "Not delivered")}
        name={missed?.name ?? ""}
        who={missed != null ? `${missed.village} · ${missed.items.join(" · ")}` : ""}
        reasons={MISSED_REASONS}
        question={tr("ส่งไม่สำเร็จเพราะ", "Not delivered because")}
        confirmLabel={tr("บันทึกส่งไม่สำเร็จ", "Record as not delivered")}
        note={tr(
          "เหตุผลจะเก็บไว้กับรายการนี้ ให้คนที่ตามต่อรู้ว่าต้องทำอะไร",
          "The reason stays with this delivery, so whoever follows up knows what to do",
        )}
        onClose={() => setMissed(null)}
        onConfirm={(why) => {
          if (missed == null) return;
          markDelivery(missed.id, "missed", why);
          setMissed(null);
          toast(tr("บันทึกส่งไม่สำเร็จแล้ว", "Marked as not delivered"), "warning");
        }}
      />
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
          {noteLabel(d.note)}
        </Text>
      )}
    </PressableScale>
  );
}
