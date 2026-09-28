import { useState } from "react";
import { KeyboardAvoidingView, Modal, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stethoscope, X } from "lucide-react-native";

import { ActionBar, PrimaryAction } from "./ActionBar";
import { BlurStage } from "./BlurStage";
import { Card } from "./Card";
import { CardHeading } from "./CardAction";
import { NoteField } from "./FormField";
import { GlassIconButton } from "./GlassIconButton";
import { PickRow, PickSheet } from "./PickSheet";
import { DX_TYPES, icdOf, searchIcd, type Diagnosis, type DxType } from "../models/icd10";
import { CANVAS, PRIMARY_500, SPACE, TEXT_MUTED, TEXT_PRIMARY } from "../theme/tokens";

const typeOf = (t: DxType) => DX_TYPES.find((d) => d.code === t);

/** A blank diagnosis of the part that is likeliest next. */
export function newDiagnosis(type: DxType): Diagnosis {
  return { code: "", text: "", type };
}

/**
 * One diagnosis: the code, what it is called on this record, and what part
 * it plays.
 *
 * The result is a field rather than a label because the code's own wording
 * is the book's, and a note often needs the patient's — "เบาหวานชนิดที่ 2
 * ไม่มีภาวะแทรกซ้อน" becomes "เบาหวาน คุมน้ำตาลไม่ได้". Picking a code
 * fills it in, and it stays editable after.
 *
 * A code the list does not hold can be typed straight in, for the day a
 * new one is in use before the table is updated.
 */
export function DxSheet({
  visible,
  value,
  editing,
  onChange,
  onClose,
  onDone,
}: {
  visible: boolean;
  value: Diagnosis;
  editing: boolean;
  onChange: (d: Diagnosis) => void;
  onClose: () => void;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [pick, setPick] = useState<"code" | "type" | null>(null);
  const icd = icdOf(value.code);
  const type = typeOf(value.type);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: CANVAS }}>
        <BlurStage>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg }}>
            <GlassIconButton onPress={onClose} accessibilityLabel="ปิด">
              <X size={22} color={TEXT_PRIMARY} strokeWidth={2.6} />
            </GlassIconButton>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: "600", color: TEXT_PRIMARY }}>
              {editing ? "แก้ไขการวินิจฉัย" : "เพิ่มการวินิจฉัย"}
            </Text>
            <View style={{ width: 44 }} />
          </View>

          <ScrollView
            contentContainerStyle={{ padding: SPACE.lg, gap: SPACE.md, paddingBottom: insets.bottom + 110 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <Card style={{ gap: SPACE.lg }}>
              <CardHeading icon={<Stethoscope size={13} color={PRIMARY_500} strokeWidth={2.4} />} title="การวินิจฉัย" />
              <PickRow
                label="รหัส ICD-10"
                value={icd != null ? `${icd.code} ${icd.th}` : value.code}
                placeholder="เลือกรหัส ICD-10"
                onPress={() => setPick("code")}
              />
              <NoteField
                label="ผลวินิจฉัย"
                value={value.text}
                onChangeText={(v) => onChange({ ...value, text: v })}
                placeholder="ชื่อโรคหรือคำวินิจฉัยตามที่บันทึก"
                lines={2}
              />
              <PickRow
                label="ประเภทการวินิจฉัย"
                value={type?.label ?? ""}
                placeholder="เลือกประเภท"
                onPress={() => setPick("type")}
              />
              {icd?.en != null && <Text style={{ fontSize: 12, color: TEXT_MUTED }}>{icd.en}</Text>}
            </Card>
          </ScrollView>

          <ActionBar>
            <PrimaryAction
              label={editing ? "บันทึกการแก้ไข" : "เพิ่มลงรายการ"}
              disabled={value.text.trim() === ""}
              onPress={onDone}
            />
          </ActionBar>

          <PickSheet
            visible={pick === "code"}
            title="เลือกรหัส ICD-10"
            placeholder="ค้นหารหัสหรือชื่อโรค"
            rows={(q) =>
              searchIcd(q)
                .slice(0, 60)
                .map((i) => ({
                  key: i.code,
                  lead: i.code,
                  title: i.th,
                  sub: i.en,
                  // The book's wording fills an empty result; one already
                  // written by hand is left alone.
                  pick: () => onChange({ ...value, code: i.code, text: value.text.trim() === "" ? i.th : value.text }),
                }))
            }
            custom={(q) => {
              const typed = q.trim().toUpperCase();
              if (!/^[A-Z][0-9]{2}(\.[0-9]{1,2})?$/.test(typed)) return null;
              if (searchIcd(q).some((i) => i.code.toUpperCase() === typed)) return null;
              return {
                key: typed,
                title: `ใช้รหัส "${typed}" ตามที่พิมพ์`,
                sub: "ตรวจสอบกับรหัสมาตรฐานตอนส่งเบิก",
                pick: () => onChange({ ...value, code: typed }),
              };
            }}
            onClose={() => setPick(null)}
          />

          <PickSheet
            visible={pick === "type"}
            title="ประเภทการวินิจฉัย"
            placeholder="ค้นหาประเภท"
            rows={(q) =>
              DX_TYPES.filter((t) => t.label.toLowerCase().includes(q.trim().toLowerCase()) || t.code === q.trim()).map(
                (t) => ({
                  key: t.code,
                  lead: t.code,
                  title: t.label,
                  pick: () => onChange({ ...value, type: t.code }),
                }),
              )
            }
            onClose={() => setPick(null)}
          />
        </BlurStage>
      </KeyboardAvoidingView>
    </Modal>
  );
}
