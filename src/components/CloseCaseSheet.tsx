import { useEffect, useState } from "react";
import {
  Image,
  Modal,
  ScrollView,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarPlus, Check, X } from "lucide-react-native";

import { ActionBar, PrimaryAction } from "./ActionBar";
import { BlurStage } from "./BlurStage";
import { Card } from "./Card";
import { ChoiceChip } from "./ChoiceChip";
import { GlassIconButton } from "./GlassIconButton";
import { GAP_CHOICES, nextDate, suggestedGap } from "../models/nextVisits";
import { planToday, type Task } from "../models/task";
import { tr } from "../i18n";
import { GUTTER } from "../theme/layout";
import {
  CANVAS,
  PRIMARY_100,
  PRIMARY_500,
  SEPARATOR,
  SPACE,
  SUCCESS,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme/tokens";
import { thaiFullDate, thaiTime } from "../utils/thaiDate";

export type CloseRow = {
  key: string;
  label: string;
  art: ImageSourcePropType;
  /** What was written, in a line; null when nothing was. */
  preview: string | null;
};

/**
 * "สรุปก่อนปิดเคส" — the visit read back before it is closed.
 *
 * Closing used to happen on the press: whatever had been recorded was kept,
 * whatever had been forgotten stayed forgotten, and the next appointment was
 * a separate trip to the plan. Here the carer sees every record on one page,
 * the ones still empty marked as such, and books the next visit in the same
 * breath — the gap suggested by the kind of visit this was.
 */
export function CloseCaseSheet({
  visible,
  name,
  rows,
  visit,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  name: string;
  rows: CloseRow[];
  /** The planned visit this was; a card-reader visit has none to follow up. */
  visit: Task | undefined;
  onClose: () => void;
  /** Days to the next visit, 0 for none. */
  onConfirm: (days: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const suggested = suggestedGap(visit?.visitType);
  const [days, setDays] = useState(suggested);
  // Opened again, it starts from the suggestion again.
  useEffect(() => {
    if (visible) setDays(suggested);
  }, [visible, suggested]);

  const done = rows.filter((r) => r.preview != null).length;
  const when = visit != null && days > 0 ? nextDate(visit, days, planToday) : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      supportedOrientations={["portrait", "landscape"]}
      onRequestClose={onClose}
    >
      <BlurStage>
        <View style={{ flex: 1, backgroundColor: CANVAS }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: GUTTER,
              paddingTop: SPACE.lg,
            }}
          >
            <GlassIconButton onPress={onClose} accessibilityLabel={tr("ปิด", "Close")}>
              <X size={22} color={TEXT_PRIMARY} strokeWidth={2.6} />
            </GlassIconButton>
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 16,
                fontWeight: "600",
                color: TEXT_PRIMARY,
              }}
            >
              {tr("สรุปก่อนปิดเคส", "Review before closing")}
            </Text>
            <View style={{ width: 44 }} />
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingVertical: SPACE.lg,
              paddingHorizontal: GUTTER,
              gap: SPACE.md,
              paddingBottom: insets.bottom + 120,
            }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ gap: 2, paddingHorizontal: SPACE.xs }}>
              <Text style={{ fontSize: 22, lineHeight: 32, fontWeight: "800", color: TEXT_PRIMARY }}>
                {name}
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 21, color: TEXT_MUTED }}>
                {tr(
                  `บันทึกแล้ว ${done} จาก ${rows.length} รายการ`,
                  `${done} of ${rows.length} recorded`,
                )}
              </Text>
            </View>

            {/* How far through, as a bar: read at a glance before the rows. */}
            <View
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: SEPARATOR,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${rows.length === 0 ? 0 : (done / rows.length) * 100}%`,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: done === rows.length ? SUCCESS : PRIMARY_500,
                }}
              />
            </View>

            <Card padded={false}>
              {rows.map((r, i) => (
                <View
                  key={r.key}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.md,
                    paddingHorizontal: SPACE.lg,
                    paddingVertical: SPACE.md,
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: SEPARATOR,
                    opacity: r.preview == null ? 0.6 : 1,
                  }}
                >
                  <Image source={r.art} style={{ width: 36, height: 36 }} resizeMode="contain" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 15, lineHeight: 22, fontWeight: "600", color: TEXT_PRIMARY }}>
                      {r.label}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={{ fontSize: 13, lineHeight: 19, color: r.preview == null ? TEXT_MUTED : TEXT_SECONDARY }}
                    >
                      {r.preview == null || r.preview === ""
                        ? r.preview == null
                          ? tr("ยังไม่ได้บันทึก", "Not recorded")
                          : tr("บันทึกแล้ว", "Recorded")
                        : r.preview}
                    </Text>
                  </View>
                  {r.preview != null && (
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: SUCCESS,
                      }}
                    >
                      <Check size={14} color="#FFFFFF" strokeWidth={3} />
                    </View>
                  )}
                </View>
              ))}
            </Card>

            {visit != null && (
              <Card style={{ gap: SPACE.md }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: PRIMARY_100,
                    }}
                  >
                    <CalendarPlus size={17} color={PRIMARY_500} strokeWidth={2.2} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 16, lineHeight: 24, fontWeight: "600", color: TEXT_PRIMARY }}>
                    {tr("นัดเยี่ยมครั้งถัดไป", "Next visit")}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
                  {GAP_CHOICES.map((c) => (
                    <ChoiceChip
                      key={c.days}
                      label={
                        c.days === suggested
                          ? tr(`${c.label} (แนะนำ)`, `${c.label} (suggested)`)
                          : c.label
                      }
                      on={days === c.days}
                      onPress={() => setDays(c.days)}
                    />
                  ))}
                </View>
                <Text style={{ fontSize: 14, lineHeight: 21, color: TEXT_SECONDARY }}>
                  {when == null
                    ? tr("ไม่นัดเยี่ยมต่อ เคสนี้จะปิดไปเลย", "No follow-up: the case ends here")
                    : tr(
                        `${thaiFullDate(when)} · ${thaiTime(when)} จะลงในแผนเยี่ยมให้อัตโนมัติ`,
                        `${thaiFullDate(when)} · ${thaiTime(when)}, added to your visit plan`,
                      )}
                </Text>
              </Card>
            )}
          </ScrollView>

          <ActionBar>
            <PrimaryAction
              label={
                when == null
                  ? tr("ยืนยันปิดเคส", "Close case")
                  : tr("ยืนยันปิดเคสและนัดครั้งถัดไป", "Close case and book next visit")
              }
              onPress={() => onConfirm(when == null ? 0 : days)}
            />
          </ActionBar>
        </View>
      </BlurStage>
    </Modal>
  );
}
