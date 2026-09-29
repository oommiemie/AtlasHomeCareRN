import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";

import { ActionBar, ActionCapsule } from "./ActionBar";
import { BlurStage } from "./BlurStage";
import { Card } from "./Card";
import { GlassIconButton } from "./GlassIconButton";
import {
  CANVAS,
  GROUPED_BG,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  SURFACE_SUNK,
  TEXT_MUTED,
  TEXT_PLACEHOLDER,
  TEXT_PRIMARY,
} from "../theme/tokens";
import { GUTTER } from "../theme/layout";
import { tr } from "../i18n";

/*
  The label is what the posting log keeps, in the language of the day it was
  written; the log's own table (`postingTextLabel`) reads the first two back
  in the other language, so their English is written to match it.
*/
const REASONS = [
  {
    id: "unreachable",
    label: tr("ติดต่อผู้ป่วยไม่ได้", "Could not reach the patient"),
    detail: tr(
      "โทรแล้วไม่รับ หรือเบอร์ติดต่อไม่ได้",
      "No answer, or the number doesn't work",
    ),
  },
  {
    id: "inconvenient",
    label: tr("ผู้ป่วยไม่สะดวก", "Patient not available"),
    detail: tr(
      "ขอเลื่อนนัด หรือไม่อยู่บ้านในวันที่นัด",
      "Asked to reschedule, or not home on the day",
    ),
  },
  {
    id: "deceased",
    label: tr("ผู้ป่วยเสียชีวิตแล้ว", "Patient has died"),
    detail: tr(
      "ส่งกลับให้ผู้ประสานงานปิดเคส",
      "Send back to the coordinator to close the case",
    ),
  },
  {
    id: "other",
    label: tr("อื่นๆ", "Other"),
    detail: tr("ระบุเหตุผลเอง", "Enter your own reason"),
    needsDetail: true,
  },
] as const;

/**
 * Why a posting is being turned down.
 *
 * A real page-sheet (`presentationStyle`), so the page behind insets and
 * scales back the way iOS does it — the same recession the system gives a
 * navigated modal, without needing its own route.
 *
 * Deliberately the app's ordinary sheet, not the glass one the patient
 * summary wears. That surface is what marks the assistant as something apart;
 * spread across every sheet it would mark nothing.
 */
export function RejectSheet({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string, detail?: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState("");
  const insets = useSafeAreaInsets();

  const chosen = REASONS.find((r) => r.id === selected);
  // "อื่นๆ" is only a real answer once it says something.
  const canSubmit =
    chosen != null && (!("needsDetail" in chosen) || detail.trim().length > 0);

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
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 16,
                fontWeight: "600",
                color: TEXT_PRIMARY,
              }}
            >
              {tr("เลือกสาเหตุการปฏิเสธ", "Why are you declining?")}
            </Text>
            {/* Balances the close button so the title stays centred. */}
            <View style={{ width: 44 }} />
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingVertical: SPACE.lg,
              paddingHorizontal: GUTTER,
              gap: SPACE.md,
              // Clears the floating bar, so the last reason is never trapped
              // behind it.
              paddingBottom: insets.bottom + 96,
            }}
            keyboardDismissMode="on-drag"
          >
            {/*
              One list on one card, not a card per reason.

              Four bordered boxes read as four separate questions; this is a
              single question with four answers, so it is the app's own option
              row — the one the address and village pickers use. The answer is
              marked by weight and a tick rather than by a ring, which leaves
              room under each line to say what it means.
            */}
            <Card padded={false}>
              {REASONS.map((r, i) => {
                const isOn = selected === r.id;
                return (
                  <View key={r.id}>
                    <Pressable
                      onPress={() => setSelected(r.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isOn }}
                      accessibilityLabel={`${r.label} ${r.detail}`}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: SPACE.md,
                        minHeight: 56,
                        paddingHorizontal: SPACE.lg,
                        paddingVertical: SPACE.md,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: SEPARATOR,
                      }}
                    >
                      {/*
                        A radio, and a real one: a ring that fills rather than a
                        ring that thickens. Growing the border inward — the
                        shortcut the old cards used — shrinks the hole instead
                        of putting a dot in it, and at this size the difference
                        reads as a smudge.
                      */}
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          borderWidth: 2,
                          borderColor: isOn ? PRIMARY_500 : SEPARATOR,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {isOn && (
                          <View
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 6,
                              backgroundColor: PRIMARY_500,
                            }}
                          />
                        )}
                      </View>

                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={{
                            fontSize: 16,
                            lineHeight: 22,
                            fontWeight: isOn ? "600" : "400",
                            color: TEXT_PRIMARY,
                          }}
                        >
                          {r.label}
                        </Text>
                        <Text
                          style={{
                            marginTop: 2,
                            fontSize: 12,
                            lineHeight: 18,
                            color: TEXT_MUTED,
                          }}
                        >
                          {r.detail}
                        </Text>
                      </View>
                    </Pressable>

                    {/* Under its own row rather than at the foot of the card:
                        the field belongs to this answer, and it is the last row
                        anyway. */}
                    {isOn && "needsDetail" in r && (
                      <View
                        style={{
                          // Indented to the label, not to the card: the field
                          // belongs to the answer, and lining it up with the
                          // radio would leave it hanging under the mark.
                          paddingLeft: SPACE.lg + 22 + SPACE.md,
                          paddingRight: SPACE.lg,
                          paddingBottom: SPACE.lg,
                        }}
                      >
                        {/*
                          The app's own field: the grouped-background fill and
                          the 16pt text every other input on this screen and in
                          the add-house flow wears.

                          Not the capsule those wear, though. A pill's radius is
                          half its height, which only works while the field is
                          one line tall; on a box this deep the same shape comes
                          out as a lozenge. It takes the radius a box nested in
                          a card takes instead — one step in from the card's
                          own.
                        */}
                        <View
                          style={{
                            backgroundColor: GROUPED_BG,
                            borderRadius: RADIUS.lg,
                            paddingHorizontal: SPACE.lg,
                            paddingVertical: SPACE.md,
                          }}
                        >
                          <TextInput
                            value={detail}
                            onChangeText={setDetail}
                            multiline
                            autoFocus
                            placeholder={tr("ระบุเหตุผลที่ปฏิเสธภารกิจนี้", "Why are you declining this task?")}
                            placeholderTextColor={TEXT_PLACEHOLDER}
                            style={{
                              minHeight: 88,
                              fontSize: 16,
                              lineHeight: 26,
                              color: TEXT_PRIMARY,
                              textAlignVertical: "top",
                            }}
                          />
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </Card>

            <Text
              style={{
                fontSize: 12,
                lineHeight: 20,
                color: TEXT_MUTED,
                textAlign: "center",
                paddingHorizontal: SPACE.md,
              }}
            >
              {tr(
                "เหตุผลจะถูกส่งให้ผู้ประสานงาน และภารกิจนี้จะกลับเข้าคิวให้ทีมอื่นรับต่อ",
                "Your reason goes to the coordinator, and the task returns to the queue for another team.",
              )}
            </Text>
          </ScrollView>

          {/*
            The app's floating tray, the same one the accept-task screen and the
            add-house flow carry: a blurred white plate standing off the foot of
            the page, not a bar ruled off along the bottom edge.
          */}
          <ActionBar>
            {/* Disabled rather than hidden: the button stays where the eye
                expects it, and its paler tint says something is missing. */}
            <ActionCapsule
              label={tr("ยืนยันปฏิเสธ", "Decline task")}
              onPress={() => onSubmit(chosen!.label, detail.trim() || undefined)}
              disabled={!canSubmit}
              tint="rgba(242,59,59,0.78)"
              disabledTint="rgba(242,59,59,0.3)"
              // Painted, where there is no material to mix a tint into.
              paint="#F23B3B"
              disabledPaint={SURFACE_SUNK}
              color="#FFFFFF"
            />
          </ActionBar>
        </View>
      </BlurStage>
    </Modal>
  );
}
