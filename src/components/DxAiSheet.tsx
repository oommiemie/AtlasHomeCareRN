import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";

import { ActionBar, PrimaryAction } from "./ActionBar";
import { BlurStage } from "./BlurStage";
import { Aurora } from "./Aurora";
import { Glass } from "./Glass";
import { toast } from "./Toast";
import { UIcon } from "./UIcon";
import {
  suggestDiagnosis,
  type DxContext,
  type DxSuggestion,
} from "../models/diagnosisAi";
import { DX_TYPES } from "../models/icd10";
import {
  FILL_SUBTLE,
  PANEL,
  PRIMARY_100,
  PRIMARY_500,
  PRIMARY_700,
  RADIUS,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  RIM_LIT,
  shadow,
} from "../theme/tokens";
import { isEn, tr } from "../i18n";
import { GUTTER, FORM_MAX, readable } from "../theme/layout";

/** The chip's short name for a diagnosis type; the list's own are Thai. */
const SHORT_EN: Record<string, string> = {
  "1": "Principal",
  "2": "Comorbidity",
  "3": "Complication",
  "4": "Other",
  "5": "External cause",
};
const shortType = (t: string) =>
  (isEn ? SHORT_EN[t] : undefined) ??
  DX_TYPES.find((d) => d.code === t)?.short ??
  t;

/**
 * The assistant's draft of this visit's note.
 *
 * It reads what the visit has already written elsewhere — the screening,
 * the assessments, the home-visit write-up, today's order — and proposes
 * the parts of the diagnosis page that follow from them. Nothing is
 * written until the carer says so, and everything it writes stays a
 * normal entry afterwards: editable, removable, and no different from one
 * typed by hand.
 *
 * Asked once per opening rather than once per record: the visit is still
 * being written, so the answer changes as the forms fill up.
 */
export function DxAiSheet({
  visible,
  context,
  onClose,
  onApply,
}: {
  visible: boolean;
  context: DxContext;
  onClose: () => void;
  onApply: (s: DxSuggestion) => void;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<DxSuggestion | null>(null);
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);
  const live = useRef(true);

  useEffect(() => {
    if (!visible) return;
    live.current = true;
    setDraft(null);
    setFailed(false);
    setAsking(true);
    suggestDiagnosis(context).then((result) => {
      if (!live.current) return;
      setAsking(false);
      if (result == null) {
        setFailed(true);
        toast(tr("ร่างด้วย AI ไม่สำเร็จ", "AI draft failed"), "error");
      } else setDraft(result);
    });
    return () => {
      live.current = false;
    };
    // The context object is rebuilt each render; the sheet opening is the
    // event that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <BlurStage>
        {/*
          The glass IS the sheet's background, so nothing opaque may be
          painted behind it. The aurora is the exception and the reason for
          it: it sits behind the glass rather than on top, so the sheet
          refracts it — clear glass over nothing is clear glass over nothing.

          The same surface the patient brief wears, because it marks the same
          thing: this is the assistant speaking, not the app.
        */}
        <View style={{ flex: 1 }}>
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: "55%",
            }}
          >
            {/* Mounted with the sheet: a running render loop behind a sheet
                nobody has opened is a warm phone for nothing. */}
            {visible && (
              <Aurora
                colorStops={["#339FF3", "#46D8AD", "#7C5CFF"]}
                speed={0.45}
                blend={0.62}
                amplitude={0.9}
              />
            )}
          </View>

          <Glass style={StyleSheet.absoluteFill}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: GUTTER,
                paddingTop: SPACE.lg,
                ...readable(FORM_MAX),
              }}
            >
              {/* The one departure: elsewhere this is a glass button on an
                opaque page. Here the page is the glass, and glass on glass
                has only the sheet to refract — both flatten into one patch.
                So it wears the design's field fill at the same size. */}
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={tr("ปิด", "Close")}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: FILL_SUBTLE,
                }}
              >
                <X size={22} color={TEXT_PRIMARY} strokeWidth={2.6} />
              </Pressable>
              <Text
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontSize: 16,
                  fontWeight: "600",
                  color: TEXT_PRIMARY,
                }}
              >
                {tr("ร่างบันทึกด้วย AI", "Draft note with AI")}
              </Text>
              <View style={{ width: 44 }} />
            </View>

            <ScrollView
              contentContainerStyle={{
                paddingVertical: SPACE.lg,
                paddingHorizontal: GUTTER,
                gap: SPACE.md,
                paddingBottom: insets.bottom + 110,
                ...readable(FORM_MAX),
              }}
              showsVerticalScrollIndicator={false}
            >
              {asking && (
                <Panel
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.md,
                  }}
                >
                  <ActivityIndicator color={PRIMARY_500} />
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 14,
                      lineHeight: 20,
                      color: TEXT_MUTED,
                    }}
                  >
                    {tr(
                      "กำลังอ่านข้อมูลผู้ป่วยและสิ่งที่บันทึกไว้ในการเยี่ยมครั้งนี้…",
                      "Reading the patient's record and what has been recorded on this visit…",
                    )}
                  </Text>
                </Panel>
              )}

              {failed && (
                <Panel>
                  <Text
                    style={{ fontSize: 14, lineHeight: 22, color: TEXT_MUTED }}
                  >
                    {tr(
                      "เชื่อมต่อผู้ช่วย AI ไม่ได้ หรือข้อมูลที่บันทึกไว้ยังไม่พอให้สรุป ลองบันทึกการคัดกรองหรือการเยี่ยมบ้านก่อนแล้วเปิดใหม่อีกครั้ง",
                      "Couldn't reach the AI assistant, or there isn't enough recorded yet to draft from. Record the screening or the home visit first, then open this again.",
                    )}
                  </Text>
                </Panel>
              )}

              {draft != null && (
                <>
                  {draft.complaint !== "" && (
                    <Section title={tr("อาการสำคัญ", "Chief complaint")}>
                      <Paragraph text={draft.complaint} />
                    </Section>
                  )}
                  {draft.hpi !== "" && (
                    <Section title={tr("ประวัติปัจจุบัน (HPI)", "History of present illness (HPI)")}>
                      <Paragraph text={draft.hpi} />
                    </Section>
                  )}
                  {draft.dxTexts.length > 0 && (
                    <Section title={tr("คำวินิจฉัย (ข้อความ)", "Diagnosis (text)")}>
                      {draft.dxTexts.map((t, i) => (
                        <Row key={`${t}-${i}`} first={i === 0} title={t} />
                      ))}
                    </Section>
                  )}
                  {draft.icd10.length > 0 && (
                    <Section title={tr("การวินิจฉัย (ICD-10)", "Diagnosis (ICD-10)")}>
                      {draft.icd10.map((d, i) => (
                        <Row
                          key={d.code}
                          first={i === 0}
                          title={d.text}
                          code={d.code}
                          tag={shortType(d.type)}
                        />
                      ))}
                    </Section>
                  )}
                  {draft.icd9.length > 0 && (
                    <Section title={tr("หัตถการ (ICD-9-CM)", "Procedures (ICD-9-CM)")}>
                      {draft.icd9.map((p, i) => (
                        <Row
                          key={p.code}
                          first={i === 0}
                          title={p.name}
                          code={p.code}
                        />
                      ))}
                    </Section>
                  )}
                  {draft.pp.length > 0 && (
                    <Section title={tr("งานส่งเสริมป้องกันโรค", "Health promotion and prevention")}>
                      {draft.pp.map((p, i) => (
                        <Row
                          key={p.code}
                          first={i === 0}
                          title={p.label}
                          code={p.code}
                        />
                      ))}
                    </Section>
                  )}

                  <Text
                    style={{
                      fontSize: 12,
                      lineHeight: 20,
                      color: TEXT_MUTED,
                      textAlign: "center",
                      paddingHorizontal: SPACE.sm,
                    }}
                  >
                    {tr(
                      "เป็นร่างเพื่อช่วยบันทึกเท่านั้น ไม่ใช่คำวินิจฉัย นำไปใช้แล้วยังแก้ไขหรือลบได้ทุกรายการ และควรตรวจสอบรหัสก่อนส่งเบิก",
                      "A draft to help with the note, not a diagnosis. Every entry can still be edited or removed after it is applied — check the codes before claiming.",
                    )}
                  </Text>
                </>
              )}
            </ScrollView>

            {draft != null && (
              <ActionBar>
                <PrimaryAction label={tr("นำไปใช้", "Apply")} onPress={() => onApply(draft)} />
              </ActionBar>
            )}
          </Glass>
        </View>
      </BlurStage>
    </Modal>
  );
}

/**
 * One section's plate.
 *
 * Three things make it a box rather than a faint wash, and it needs all
 * three: a fill well above the sheet's own value, a lit rim, and a shadow.
 * The glass is not lost — it reads through the fill, and the gaps between
 * plates are nothing but glass.
 */
function Panel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: PANEL,
          borderRadius: RADIUS.card,
          borderWidth: 1,
          borderColor: RIM_LIT,
          paddingHorizontal: SPACE.lg,
          boxShadow: shadow({
            blur: 10,
            y: 3,
            color: "#1E293B",
            opacity: 0.08,
          }),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: SPACE.sm }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.sm,
          paddingHorizontal: SPACE.xs,
        }}
      >
        <UIcon name="magicWand" size={14} color={PRIMARY_500} />
        <Text
          style={{ fontSize: 13, fontWeight: "700", color: TEXT_SECONDARY }}
        >
          {title}
        </Text>
      </View>
      <Panel>{children}</Panel>
    </View>
  );
}

function Paragraph({ text }: { text: string }) {
  return (
    <Text
      style={{
        paddingVertical: SPACE.md,
        fontSize: 15,
        lineHeight: 23,
        color: TEXT_PRIMARY,
      }}
    >
      {text}
    </Text>
  );
}

function Row({
  first,
  title,
  code,
  tag,
}: {
  first: boolean;
  title: string;
  code?: string;
  tag?: string;
}) {
  return (
    <View>
      {!first && <View style={{ height: 1, backgroundColor: SEPARATOR }} />}
      <View style={{ paddingVertical: SPACE.md, gap: 5 }}>
        <Text
          style={{
            fontSize: 15,
            lineHeight: 21,
            fontWeight: "600",
            color: TEXT_PRIMARY,
          }}
        >
          {title}
        </Text>
        {(code != null || tag != null) && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.sm,
            }}
          >
            {code != null && (
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "800",
                  color: PRIMARY_700,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {code}
              </Text>
            )}
            {tag != null && (
              <View
                style={{
                  paddingHorizontal: 9,
                  paddingVertical: 3,
                  borderRadius: RADIUS.capsule,
                  backgroundColor: PRIMARY_100,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: PRIMARY_700,
                  }}
                >
                  {tag}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}
