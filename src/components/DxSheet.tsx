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
import { isEn, tr } from "../i18n";
import { GUTTER, FORM_MAX, readable } from "../theme/layout";

const typeOf = (t: DxType) => DX_TYPES.find((d) => d.code === t);

/**
 * A type's name as the picker shows it. The list writes each one in English
 * with the Thai in brackets after it; in English the brackets are dropped.
 */
const typeLabel = (label: string) =>
  isEn ? label.replace(/\s*\(.*\)\s*$/, "") : label;

/** A code's own name, in the language on screen. */
const icdName = (i: { th: string; en: string }) => (isEn ? i.en : i.th);

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
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: GUTTER, paddingTop: SPACE.lg, ...readable(FORM_MAX) }}>
            <GlassIconButton onPress={onClose} accessibilityLabel={tr("ปิด", "Close")}>
              <X size={22} color={TEXT_PRIMARY} strokeWidth={2.6} />
            </GlassIconButton>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: "600", color: TEXT_PRIMARY }}>
              {editing ? tr("แก้ไขการวินิจฉัย", "Edit diagnosis") : tr("เพิ่มการวินิจฉัย", "Add diagnosis")}
            </Text>
            <View style={{ width: 44 }} />
          </View>

          <ScrollView
            contentContainerStyle={{ paddingVertical: SPACE.lg, paddingHorizontal: GUTTER, gap: SPACE.md, paddingBottom: insets.bottom + 110, ...readable(FORM_MAX) }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <Card style={{ gap: SPACE.lg }}>
              <CardHeading icon={<Stethoscope size={13} color={PRIMARY_500} strokeWidth={2.4} />} title={tr("การวินิจฉัย", "Diagnosis")} />
              <PickRow
                label={tr("รหัส ICD-10", "ICD-10 code")}
                value={icd != null ? `${icd.code} ${icdName(icd)}` : value.code}
                placeholder={tr("เลือกรหัส ICD-10", "Select ICD-10 code")}
                onPress={() => setPick("code")}
              />
              <NoteField
                label={tr("ผลวินิจฉัย", "Diagnosis")}
                value={value.text}
                onChangeText={(v) => onChange({ ...value, text: v })}
                placeholder={tr("ชื่อโรคหรือคำวินิจฉัยตามที่บันทึก", "Condition or diagnosis as recorded")}
                lines={2}
              />
              <PickRow
                label={tr("ประเภทการวินิจฉัย", "Diagnosis type")}
                value={type != null ? typeLabel(type.label) : ""}
                placeholder={tr("เลือกประเภท", "Select type")}
                onPress={() => setPick("type")}
              />
              {!isEn && icd?.en != null && <Text style={{ fontSize: 12, color: TEXT_MUTED }}>{icd.en}</Text>}
            </Card>
          </ScrollView>

          <ActionBar>
            <PrimaryAction
              label={editing ? tr("บันทึกการแก้ไข", "Save changes") : tr("เพิ่มลงรายการ", "Add to list")}
              disabled={value.text.trim() === ""}
              onPress={onDone}
            />
          </ActionBar>

          <PickSheet
            visible={pick === "code"}
            title={tr("เลือกรหัส ICD-10", "Select ICD-10 code")}
            placeholder={tr("ค้นหารหัสหรือชื่อโรค", "Search code or condition")}
            rows={(q) =>
              searchIcd(q)
                .slice(0, 60)
                .map((i) => ({
                  key: i.code,
                  lead: i.code,
                  title: icdName(i),
                  sub: isEn ? undefined : i.en,
                  // The book's wording fills an empty result; one already
                  // written by hand is left alone.
                  pick: () => onChange({ ...value, code: i.code, text: value.text.trim() === "" ? icdName(i) : value.text }),
                }))
            }
            custom={(q) => {
              const typed = q.trim().toUpperCase();
              if (!/^[A-Z][0-9]{2}(\.[0-9]{1,2})?$/.test(typed)) return null;
              if (searchIcd(q).some((i) => i.code.toUpperCase() === typed)) return null;
              return {
                key: typed,
                title: tr(`ใช้รหัส "${typed}" ตามที่พิมพ์`, `Use "${typed}" as typed`),
                sub: tr("ตรวจสอบกับรหัสมาตรฐานตอนส่งเบิก", "Check against the standard code set before claiming"),
                pick: () => onChange({ ...value, code: typed }),
              };
            }}
            onClose={() => setPick(null)}
          />

          <PickSheet
            visible={pick === "type"}
            title={tr("ประเภทการวินิจฉัย", "Diagnosis type")}
            placeholder={tr("ค้นหาประเภท", "Search type")}
            rows={(q) =>
              DX_TYPES.filter((t) => t.label.toLowerCase().includes(q.trim().toLowerCase()) || t.code === q.trim()).map(
                (t) => ({
                  key: t.code,
                  lead: t.code,
                  title: typeLabel(t.label),
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
