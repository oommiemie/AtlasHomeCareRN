import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronRight, Plus, X } from "lucide-react-native";

import { Card } from "./Card";
import { GlassIconButton } from "./GlassIconButton";
import { SearchField } from "./SearchField";
import { tr } from "../i18n";
import {
  CANVAS,
  GROUPED_BG,
  PRIMARY_500,
  PRIMARY_700,
  RADIUS,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PLACEHOLDER,
  TEXT_PRIMARY,
} from "../theme/tokens";
import { GUTTER } from "../theme/layout";

/** A choice that opens a list: its label, what is chosen, and a chevron. */
export function PickRow({
  label,
  value,
  placeholder,
  onPress,
}: {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
}) {
  const chosen = value.trim() !== "";
  return (
    <View style={{ gap: SPACE.sm }}>
      <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>{label}</Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${chosen ? value : placeholder}`}
        style={({ pressed }) => ({
          minHeight: 48,
          borderRadius: RADIUS.capsule,
          backgroundColor: GROUPED_BG,
          paddingHorizontal: SPACE.lg,
          paddingVertical: SPACE.sm,
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.sm,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={{ flex: 1, fontSize: 16, lineHeight: 22, color: chosen ? TEXT_PRIMARY : TEXT_PLACEHOLDER }}>
          {chosen ? value : placeholder}
        </Text>
        <ChevronRight size={18} color={TEXT_MUTED} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

export type Row = { key: string; lead?: string; title: string; sub?: string; pick: () => void };

/** A searched list over the form, one tap to choose and close. */
export function PickSheet({
  visible,
  title,
  placeholder,
  rows,
  custom,
  onClose,
}: {
  visible: boolean;
  title: string;
  placeholder: string;
  rows: (q: string) => Row[];
  /** What to offer when the search matches nothing the list holds. */
  custom?: (q: string) => Row | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const hits = useMemo(() => rows(q).slice(0, 60), [q, rows]);
  const extra = custom?.(q) ?? null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" supportedOrientations={["portrait", "landscape"]} onShow={() => setQ("")} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: CANVAS }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: GUTTER, paddingTop: SPACE.lg }}>
          <GlassIconButton onPress={onClose} accessibilityLabel={tr("ปิด", "Close")}>
            <X size={22} color={TEXT_PRIMARY} strokeWidth={2.6} />
          </GlassIconButton>
          <Text style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: "600", color: TEXT_PRIMARY }}>{title}</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={{ paddingHorizontal: GUTTER, paddingTop: SPACE.md }}>
          <SearchField value={q} onChangeText={setQ} placeholder={placeholder} autoFocus />
        </View>
        <ScrollView
          contentContainerStyle={{ paddingVertical: SPACE.lg, paddingHorizontal: GUTTER, paddingBottom: insets.bottom + SPACE.xl }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <Card style={{ paddingVertical: 0 }}>
            {hits.map((r, i) => (
              <View key={r.key}>
                {i > 0 && <View style={{ height: 1, backgroundColor: SEPARATOR }} />}
                <Pressable
                  onPress={() => {
                    r.pick();
                    onClose();
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.md,
                    paddingVertical: SPACE.md,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  {r.lead != null && (
                    <Text style={{ width: 58, fontSize: 14, fontWeight: "800", color: PRIMARY_700, fontVariant: ["tabular-nums"] }}>
                      {r.lead}
                    </Text>
                  )}
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={{ fontSize: 15, lineHeight: 21, color: TEXT_PRIMARY }}>{r.title}</Text>
                    {r.sub != null && (
                      <Text numberOfLines={1} style={{ fontSize: 12, color: TEXT_MUTED }}>
                        {r.sub}
                      </Text>
                    )}
                  </View>
                </Pressable>
              </View>
            ))}
            {extra != null && (
              <View>
                {hits.length > 0 && <View style={{ height: 1, backgroundColor: SEPARATOR }} />}
                <Pressable
                  onPress={() => {
                    extra.pick();
                    onClose();
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.md,
                    paddingVertical: SPACE.md,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <View style={{ width: 58, alignItems: "center" }}>
                    <Plus size={16} color={PRIMARY_500} strokeWidth={2.6} />
                  </View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={{ fontSize: 15, lineHeight: 21, fontWeight: "600", color: PRIMARY_500 }}>{extra.title}</Text>
                    {extra.sub != null && <Text style={{ fontSize: 12, color: TEXT_MUTED }}>{extra.sub}</Text>}
                  </View>
                </Pressable>
              </View>
            )}
            {hits.length === 0 && extra == null && (
              <Text style={{ paddingVertical: SPACE.lg, fontSize: 14, color: TEXT_MUTED }}>{tr("ไม่พบรายการที่ตรงกับคำค้น", "No matches")}</Text>
            )}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
