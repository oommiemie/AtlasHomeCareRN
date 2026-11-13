import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";

import { ActionBar, PrimaryAction } from "./ActionBar";
import { BlurStage } from "./BlurStage";
import { Card } from "./Card";
import { ChoiceChip } from "./ChoiceChip";
import { NoteField } from "./FormField";
import { GlassIconButton } from "./GlassIconButton";
import { HANDOVER_REASONS, type Handover } from "../models/handover";
import { useSession } from "../models/session";
import { STAFF } from "../models/staff";
import { tr } from "../i18n";
import { GUTTER } from "../theme/layout";
import {
  CANVAS,
  PRIMARY_100,
  PRIMARY_500,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";

/**
 * "ส่งต่อเคส" — hand this patient on to someone else in the team.
 *
 * Who, why, and a line for them; the reason chips are the four a home-care
 * round actually hands on for. The carer's own name is left off the list.
 */
export function HandoverSheet({
  visible,
  name,
  onClose,
  onSend,
}: {
  visible: boolean;
  name: string;
  onClose: () => void;
  onSend: (h: Handover) => void;
}) {
  const insets = useSafeAreaInsets();
  const me = useSession();
  const people = STAFF.filter((s) => s.name !== me.displayName && s.id !== "v1");
  const [to, setTo] = useState<string | null>(null);
  const [reason, setReason] = useState(HANDOVER_REASONS[0]);
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!visible) return;
    setTo(null);
    setReason(HANDOVER_REASONS[0]);
    setNote("");
  }, [visible]);

  const picked = people.find((p) => p.id === to);

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
              style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: "600", color: TEXT_PRIMARY }}
            >
              {tr("ส่งต่อเคส", "Hand over case")}
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
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <Text style={{ fontSize: 22, lineHeight: 32, fontWeight: "800", color: TEXT_PRIMARY, paddingHorizontal: SPACE.xs }}>
              {name}
            </Text>

            <Text style={{ fontSize: 14, color: TEXT_MUTED, paddingHorizontal: SPACE.xs }}>
              {tr("ส่งต่อให้", "Hand over to")}
            </Text>
            <Card padded={false}>
              {people.map((p, i) => {
                const on = to === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setTo(p.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: SPACE.md,
                      paddingHorizontal: SPACE.lg,
                      paddingVertical: SPACE.md,
                      borderTopWidth: i > 0 ? 1 : 0,
                      borderTopColor: SEPARATOR,
                      backgroundColor: on ? PRIMARY_100 : undefined,
                    }}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: on ? 7 : 2,
                        borderColor: on ? PRIMARY_500 : SEPARATOR,
                      }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, lineHeight: 22, fontWeight: "600", color: TEXT_PRIMARY }}>{p.name}</Text>
                      <Text style={{ fontSize: 13, lineHeight: 19, color: TEXT_MUTED }}>{p.role}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </Card>

            <Text style={{ fontSize: 14, color: TEXT_MUTED, paddingHorizontal: SPACE.xs, marginTop: SPACE.sm }}>
              {tr("เหตุผล", "Reason")}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
              {HANDOVER_REASONS.map((r) => (
                <ChoiceChip key={r} label={r} on={reason === r} onPress={() => setReason(r)} />
              ))}
            </View>

            <Card>
              <NoteField
                label={tr("ข้อความถึงผู้รับ", "Note to them")}
                value={note}
                onChangeText={setNote}
                lines={3}
                placeholder={tr(
                  "เช่น ความดันสูงต่อเนื่อง 2 ครั้ง ฝากประเมินปรับยา",
                  "e.g. BP high on two visits, please review medication",
                )}
              />
            </Card>
          </ScrollView>

          <ActionBar>
            <PrimaryAction
              label={picked == null ? tr("เลือกผู้รับ", "Choose who") : tr(`ส่งต่อให้ ${picked.name}`, `Hand over to ${picked.name}`)}
              disabled={picked == null}
              onPress={() =>
                picked != null &&
                onSend({ to: picked.name, role: picked.role, reason, note: note.trim(), at: Date.now() })
              }
            />
          </ActionBar>
        </View>
      </BlurStage>
    </Modal>
  );
}
