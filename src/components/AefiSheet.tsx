import { useEffect, useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";

import { ActionBar, ActionCapsule } from "./ActionBar";
import { BlurStage } from "./BlurStage";
import { Card } from "./Card";
import { ChoiceChip } from "./ChoiceChip";
import { NoteField } from "./FormField";
import { GlassIconButton } from "./GlassIconButton";
import { AEFI_SIGNS, recordText, type Aefi } from "../models/vaccination";
import { tr } from "../i18n";
import { GUTTER, FORM_MAX, readable } from "../theme/layout";
import {
  CANVAS,
  DANGER,
  PRIMARY_500,
  SPACE,
  SURFACE_SUNK,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TYPE,
} from "../theme/tokens";

/**
 * What was seen after one child's dose — an AEFI, written down at the
 * sitting.
 *
 * The signs a carer watches for as chips, any number of them, and a field
 * for what the chips do not name. Saving with nothing picked and nothing
 * written clears the record: the button says so, rather than saving an
 * empty report.
 */
export function AefiSheet({
  visible,
  name,
  who,
  initial,
  onClose,
  onSave,
}: {
  visible: boolean;
  name: string;
  /** HN, room and age — the line that says it is the right child. */
  who: string;
  initial?: Aefi;
  onClose: () => void;
  onSave: (aefi: Aefi | undefined) => void;
}) {
  const insets = useSafeAreaInsets();
  const [signs, setSigns] = useState<string[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!visible) return;
    // Read in this language, whichever one they were saved in, so a chip
    // lights for a sign written down in Thai and opened in English.
    setSigns((initial?.signs ?? []).map(recordText));
    setNote(initial?.note ?? "");
  }, [visible, initial]);

  const toggle = (s: string) =>
    setSigns((was) =>
      was.includes(s) ? was.filter((x) => x !== s) : [...was, s],
    );
  const empty = signs.length === 0 && note.trim() === "";
  const had = initial != null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
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
              ...readable(FORM_MAX),
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
                ...TYPE.title,
                color: TEXT_PRIMARY,
              }}
            >
              {tr(
                "อาการผิดปกติหลังได้รับวัคซีน",
                "Adverse event following immunization",
              )}
            </Text>
            <View style={{ width: 44 }} />
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingVertical: SPACE.lg,
              paddingHorizontal: GUTTER,
              gap: SPACE.md,
              paddingBottom: insets.bottom + 96,
              ...readable(FORM_MAX),
            }}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          >
            <Card style={{ gap: SPACE.xs }}>
              <Text style={{ ...TYPE.title, color: TEXT_PRIMARY }}>{name}</Text>
              <Text style={{ ...TYPE.caption, color: TEXT_MUTED }}>{who}</Text>
            </Card>

            <Card style={{ gap: SPACE.md }}>
              <Text style={{ ...TYPE.rowTitle, color: TEXT_PRIMARY }}>
                {tr("อาการที่พบ", "Signs observed")}
              </Text>
              <Text style={{ ...TYPE.detail, color: TEXT_MUTED }}>
                {tr("เลือกได้มากกว่า 1 อาการ", "Select all that apply")}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: SPACE.sm,
                }}
              >
                {AEFI_SIGNS.map((s) => (
                  <ChoiceChip
                    key={s}
                    label={s}
                    on={signs.includes(s)}
                    onPress={() => toggle(s)}
                    accessibilityRole="checkbox"
                  />
                ))}
              </View>
            </Card>

            <Card>
              <NoteField
                label={tr("อาการอื่น หรือรายละเอียดเพิ่มเติม", "Other signs or details")}
                value={note}
                onChangeText={setNote}
                placeholder={tr(
                  "เช่น เริ่มมีไข้หลังฉีด 20 นาที ให้ยาลดไข้แล้ว",
                  "e.g. fever 20 minutes after the dose, antipyretic given",
                )}
                lines={3}
              />
            </Card>
          </ScrollView>

          <ActionBar>
            <ActionCapsule
              label={
                empty
                  ? had
                    ? tr("ล้างรายการอาการ", "Clear signs")
                    : tr("บันทึกอาการ", "Save signs")
                  : tr("บันทึกอาการ", "Save signs")
              }
              onPress={() =>
                onSave(
                  empty
                    ? undefined
                    : {
                        signs,
                        note: note.trim() === "" ? undefined : note.trim(),
                      },
                )
              }
              disabled={empty && !had}
              tint={
                empty && had ? "rgba(242,59,59,0.78)" : "rgba(7,125,215,0.78)"
              }
              disabledTint="rgba(7,125,215,0.3)"
              paint={empty && had ? DANGER : PRIMARY_500}
              disabledPaint={SURFACE_SUNK}
              color="#FFFFFF"
            />
          </ActionBar>
        </View>
      </BlurStage>
    </Modal>
  );
}
