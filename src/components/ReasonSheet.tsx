import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TriangleAlert, X } from "lucide-react-native";

import { ActionBar, ActionCapsule } from "./ActionBar";
import { Card } from "./Card";
import { GlassIconButton } from "./GlassIconButton";
import type { ReasonOption } from "../models/vaccination";
import {
  CANVAS,
  DANGER_BG,
  DANGER_INK,
  GROUPED_BG,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PLACEHOLDER,
  TEXT_PRIMARY,
} from "../theme/tokens";

/**
 * Why, about one person, in their own words — picked from a list.
 *
 * Three things on the roster need a reason attached and they are the same
 * question three times: a warning overruled, somebody not there to be
 * served, somebody there who did not take it. Each was going to be a sheet
 * of its own; they are one sheet with three lists, because the only
 * difference between them is the answers.
 *
 * Why a list at all, rather than a text field. What the records have to
 * support is a question like "of the six who missed it, how many can we
 * catch next round" — and that is answerable only if off-sick and moved-away
 * are different rows in the data. A carer holding a vial types "ไม่มา", and
 * "ไม่มา" counts as nothing. Tapping one gives the same string every time,
 * which is what makes a month of them countable.
 *
 * The app's ordinary page sheet, the same one a refused posting uses: the
 * page behind insets and scales back the way iOS does it, without needing a
 * route of its own.
 */
export function ReasonSheet({
  visible,
  title,
  name,
  who,
  warning,
  reasons,
  question,
  confirmLabel,
  danger,
  note,
  placeholder = "ระบุเหตุผล",
  onClose,
  onConfirm,
}: {
  visible: boolean;
  /** What the sheet is for, in the title row. */
  title: string;
  /** Who it is about. */
  name: string;
  /**
   * HN, room and age — the line that says it is the right child.
   *
   * Two children in one school can share a name, and this is the screen
   * where being sure matters most: everything after it is a record being
   * written about that person.
   */
  who: string;
  /**
   * What the check found, where something is being overruled.
   *
   * Left off for the ordinary outcomes: nothing is wrong when a child is
   * off sick, and a red box would say there was.
   */
  warning?: string;
  reasons: ReasonOption[];
  /** The heading over the list. */
  question: string;
  confirmLabel: string;
  /** Red rather than blue, for the answer that overrules a warning. */
  danger?: boolean;
  /** What confirming does, under the list. */
  note?: string;
  placeholder?: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState("");
  const insets = useSafeAreaInsets();

  // Cleared on the way in, never on the way out: a sheet that empties as it
  // slides away does it in full view. Two children in a row must not inherit
  // the answer given for the first — a reason is per person.
  useEffect(() => {
    if (!visible) return;
    setSelected(null);
    setDetail("");
  }, [visible]);

  /*
    The finding, and the name the system files it under.

    `checkTarget` writes them as one sentence joined by an em dash — "ได้รับ
    MMR เข็ม 2 แล้ว 24/06/2569 — Duplicate Vaccine" — because most of the app
    has one line to show a reason on. Here there is room to separate them,
    and they are two different things: the first is what happened to this
    child, the second is the class of problem it belongs to.
  */
  const [finding, code] = (warning ?? "").split(" — ");

  const chosen = reasons.find((r) => r.id === selected);
  // "อื่นๆ" is only a real answer once it says something.
  const canSubmit =
    chosen != null && (chosen.needsDetail !== true || detail.trim().length > 0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: CANVAS }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: SPACE.lg,
            paddingTop: SPACE.lg,
          }}
        >
          <GlassIconButton onPress={onClose} accessibilityLabel="ปิด">
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
            {title}
          </Text>
          {/* Balances the close button so the title stays centred. */}
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          contentContainerStyle={{
            padding: SPACE.lg,
            gap: SPACE.md,
            // Clears the floating bar, so the last reason is never trapped
            // behind it.
            paddingBottom: insets.bottom + 96,
          }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          {/* The child and the finding on one card, because they are one
              statement: this person, and what the records say. */}
          <Card style={{ gap: SPACE.md }}>
            <View style={{ gap: SPACE.xs }}>
              <Text
                style={{
                  fontSize: 22,
                  lineHeight: 30,
                  fontWeight: "800",
                  color: TEXT_PRIMARY,
                }}
              >
                {name}
              </Text>
              <Text style={{ fontSize: 13, lineHeight: 20, color: TEXT_MUTED }}>
                {who}
              </Text>
            </View>

            {warning != null && warning !== "" && (
              <View
                style={{
                  flexDirection: "row",
                  gap: SPACE.sm,
                  padding: SPACE.md,
                  // One step in from the card's own corner, which is what a
                  // box nested in a card takes throughout the app.
                  borderRadius: RADIUS.lg,
                  backgroundColor: DANGER_BG,
                }}
              >
                <TriangleAlert
                  size={17}
                  color={DANGER_INK}
                  strokeWidth={2.4}
                  style={{ marginTop: 2 }}
                />
                {/* The finding on its own line and the classification under
                    it, rather than one sentence broken by a dash wherever
                    the width happens to fall. */}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      lineHeight: 22,
                      fontWeight: "600",
                      color: DANGER_INK,
                    }}
                  >
                    {finding}
                  </Text>
                  {code != null && (
                    <Text
                      style={{
                        fontSize: 12,
                        lineHeight: 18,
                        color: DANGER_INK,
                      }}
                    >
                      {code}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </Card>

          {/* The question, asked. The card below was four answers to a
              question nowhere on the page. */}
          <Text
            style={{
              marginTop: SPACE.xs,
              fontSize: 14,
              lineHeight: 20,
              fontWeight: "600",
              color: TEXT_PRIMARY,
            }}
          >
            {question}
            <Text style={{ color: DANGER_INK }}> *</Text>
          </Text>

          {/*
            One list on one card, not a card per reason: this is a single
            question with a handful of answers. The same option row the
            refusal sheet and the pickers use.
          */}
          <Card padded={false}>
            {reasons.map((r, i) => {
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
                    {/* A ring that fills, not a ring that thickens: growing
                        the border inward shrinks the hole instead of putting
                        a dot in it. */}
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor: isOn ? PRIMARY_500 : TEXT_MUTED,
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
                          fontSize: 15,
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
                      the field belongs to this answer, and it is the last
                      row anyway. */}
                  {isOn && r.needsDetail === true && (
                    <View
                      style={{
                        // Indented to the label, not to the card: lining it
                        // up with the radio would leave it under the mark.
                        paddingLeft: SPACE.lg + 22 + SPACE.md,
                        paddingRight: SPACE.lg,
                        paddingBottom: SPACE.lg,
                      }}
                    >
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
                          placeholder={placeholder}
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

          {note != null && (
            /* What confirming actually does. Under the answers and above the
               button, which is the order it happens in. */
            <Text
              style={{
                fontSize: 12,
                lineHeight: 19,
                color: TEXT_MUTED,
                paddingHorizontal: SPACE.xs,
              }}
            >
              {note}
            </Text>
          )}
        </ScrollView>

        <ActionBar>
          {/* Disabled rather than hidden: the button stays where the eye
              expects it, and its paler tint says something is missing. */}
          <ActionCapsule
            label={confirmLabel}
            onPress={() =>
              onConfirm(
                chosen == null
                  ? ""
                  : chosen.needsDetail === true
                    ? detail.trim()
                    : chosen.label,
              )
            }
            disabled={!canSubmit}
            tint={
              danger === true ? "rgba(242,59,59,0.78)" : "rgba(7,125,215,0.78)"
            }
            disabledTint={
              danger === true ? "rgba(242,59,59,0.3)" : "rgba(7,125,215,0.3)"
            }
            color="#FFFFFF"
          />
        </ActionBar>
      </View>
    </Modal>
  );
}
