import { Modal, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UserRound, X } from "lucide-react-native";

import { Card } from "./Card";
import { GlassIconButton } from "./GlassIconButton";
import { thaiShortDate } from "../utils/thaiDate";
import { CANVAS, SPACE, TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY } from "../theme/tokens";

/** One past note: who wrote it, when, and what it said. */
export type HpiEntry = { id: string; by: string; at: Date; text: string };

/**
 * What was written before, one card each: who wrote it, when, and the whole
 * of it. A tap takes it into the field — most of a chronic patient's history
 * is the same history, and retyping it is where the errors come from.
 */
export function HpiPicker({
  visible,
  entries,
  onClose,
  onPick,
}: {
  visible: boolean;
  entries: HpiEntry[];
  onClose: () => void;
  onPick: (text: string) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: CANVAS }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg }}>
          <GlassIconButton onPress={onClose} accessibilityLabel="ปิด">
            <X size={22} color={TEXT_PRIMARY} strokeWidth={2.6} />
          </GlassIconButton>
          <Text style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: "600", color: TEXT_PRIMARY }}>ประวัติ HPI</Text>
          <View style={{ width: 44 }} />
        </View>
        <ScrollView
          contentContainerStyle={{ padding: SPACE.lg, gap: SPACE.md, paddingBottom: insets.bottom + SPACE.xl }}
          showsVerticalScrollIndicator={false}
        >
          {entries.map((h) => (
            <Card key={h.id} onPress={() => onPick(h.text)} style={{ gap: SPACE.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
                <UserRound size={14} color={TEXT_MUTED} strokeWidth={2.2} />
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: "600", color: TEXT_PRIMARY }}>{h.by}</Text>
                <Text style={{ fontSize: 12, color: TEXT_MUTED }}>{thaiShortDate(h.at)}</Text>
              </View>
              <Text style={{ fontSize: 15, lineHeight: 22, color: TEXT_SECONDARY }}>{h.text}</Text>
            </Card>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}
