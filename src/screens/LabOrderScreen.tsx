import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { TriangleAlert } from "lucide-react-native";

import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { Card } from "../components/Card";
import { CheckBox } from "../components/CheckBox";
import { ChoiceChip } from "../components/ChoiceChip";
import { NoteField } from "../components/FormField";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  LAB_GROUPS,
  LAB_SETS,
  SPECIMEN_LABEL,
  needsFasting,
  saveLabOrder,
  specimensOf,
  useLabOrder,
  type Collection,
  type LabTest,
  type Urgency,
} from "../models/lab";
import { feel } from "../utils/haptics";
import { tr } from "../i18n";
import {
  GROUPED_BG,
  PRIMARY_100,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  WARNING,
} from "../theme/tokens";
import { FORM_MAX, readable, GUTTER } from "../theme/layout";

/**
 * "สั่งแล็บ" — the tests this visit sends for, and how the specimen gets there.
 *
 * One page, top to bottom in the order it is decided: a set, the tests it
 * brings (any one taken off or added), then whether the blood is drawn now
 * or the patient is booked to come in. The fasting tests are where that
 * second question matters — a sugar drawn after breakfast is a wasted tube
 * — so the page asks about fasting only when one of them is on the order,
 * and says so when it is not met.
 *
 * Saved with the visit, the way the other forms are.
 */
export function LabOrderScreen() {
  const { holder } = useRoute<RouteProp<RootStackParamList, "LabOrder">>().params;
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const saved = useLabOrder(holder.authenCode);

  // Opened again on a visit that already has an order: that order, to change.
  const [codes, setCodes] = useState<string[]>(saved?.codes ?? []);
  const [urgency, setUrgency] = useState<Urgency>(saved?.urgency ?? "routine");
  const [collection, setCollection] = useState<Collection>(saved?.collection ?? "now");
  const [fasted, setFasted] = useState(saved?.fasted ?? false);
  const [note, setNote] = useState(saved?.note ?? "");

  const fasting = needsFasting(codes);
  const specimens = specimensOf(codes);
  const has = useMemo(() => new Set(codes), [codes]);

  const toggle = (code: string) =>
    setCodes((cur) => (cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]));

  // A set is on when every test in it is; pressing it adds what is missing,
  // or — when it is already whole — takes it all off again.
  const toggleSet = (set: string[]) =>
    setCodes((cur) =>
      set.every((c) => cur.includes(c))
        ? cur.filter((c) => !set.includes(c))
        : [...cur, ...set.filter((c) => !cur.includes(c))],
    );

  const save = () => {
    saveLabOrder(holder.authenCode, {
      codes,
      urgency,
      collection,
      fasted: fasting && collection === "now" ? fasted : false,
      note: note.trim(),
      orderedAt: Date.now(),
    });
    feel("success");
    toast(tr("บันทึกคำสั่งตรวจแล้ว", "Lab order saved"), "success");
    if (nav.canGoBack()) nav.goBack();
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={tr("สั่งแล็บ", "Order labs")} />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            ...readable(FORM_MAX),
            paddingHorizontal: GUTTER,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + 120,
            gap: SPACE.md,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <Card style={{ gap: SPACE.sm }}>
            <Label>{tr("ชุดตรวจ", "Test sets")}</Label>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
              {LAB_SETS.map((s) => (
                <ChoiceChip
                  key={s.id}
                  label={s.label}
                  on={s.codes.every((c) => has.has(c))}
                  onPress={() => toggleSet(s.codes)}
                  accessibilityRole="checkbox"
                />
              ))}
            </View>
          </Card>

          {LAB_GROUPS.map((g) => (
            <Card key={g.title} padded={false}>
              <View style={{ paddingHorizontal: SPACE.lg, paddingTop: SPACE.md }}>
                <Label>{g.title}</Label>
              </View>
              {g.tests.map((t, i) => (
                <TestRow
                  key={t.code}
                  test={t}
                  on={has.has(t.code)}
                  divider={i > 0}
                  onPress={() => toggle(t.code)}
                />
              ))}
            </Card>
          ))}

          <Card style={{ gap: SPACE.lg }}>
            <View style={{ gap: SPACE.sm }}>
              <Label>{tr("การเก็บสิ่งส่งตรวจ", "Specimen")}</Label>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
                <ChoiceChip
                  label={tr("เก็บตอนนี้", "Take it now")}
                  on={collection === "now"}
                  onPress={() => setCollection("now")}
                />
                <ChoiceChip
                  label={tr("นัดมาเจาะที่ รพ.สต.", "Book them in")}
                  on={collection === "booked"}
                  onPress={() => setCollection("booked")}
                />
              </View>
            </View>

            {fasting && collection === "now" && (
              <View style={{ gap: SPACE.sm }}>
                <Pressable
                  onPress={() => setFasted((v) => !v)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: fasted }}
                  style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}
                >
                  <CheckBox on={fasted} />
                  <Text style={{ flex: 1, fontSize: 15, color: TEXT_PRIMARY }}>
                    {tr("งดน้ำและอาหารมาแล้ว 8 ชั่วโมง", "Has fasted for 8 hours")}
                  </Text>
                </Pressable>
                {!fasted && (
                  <View style={{ flexDirection: "row", gap: SPACE.sm }}>
                    <TriangleAlert size={16} color={WARNING} strokeWidth={2.2} />
                    <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, color: TEXT_MUTED }}>
                      {tr(
                        "มีรายการที่ต้องงดอาหาร (FBS, Triglyceride) ถ้ายังไม่ได้งด ควรนัดมาเจาะวันหลัง",
                        "Some tests need fasting (FBS, Triglyceride). If they haven't fasted, book them in for another day",
                      )}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={{ gap: SPACE.sm }}>
              <Label>{tr("ความเร่งด่วน", "Priority")}</Label>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
                <ChoiceChip
                  label={tr("ปกติ", "Routine")}
                  on={urgency === "routine"}
                  onPress={() => setUrgency("routine")}
                />
                <ChoiceChip
                  label={tr("ด่วน", "Urgent")}
                  on={urgency === "urgent"}
                  onPress={() => setUrgency("urgent")}
                />
              </View>
            </View>

            <NoteField
              label={tr("หมายเหตุถึงห้องแล็บ", "Note to the lab")}
              value={note}
              onChangeText={setNote}
              lines={3}
              placeholder={tr("เช่น ยาที่กินอยู่ หรือสิ่งที่อยากให้ดูเป็นพิเศษ", "e.g. current medicines, or anything to look out for")}
            />
          </Card>
        </ScrollView>
      </HeaderFade>

      <ActionBar>
        <PrimaryAction
          label={
            codes.length === 0
              ? tr("เลือกรายการตรวจ", "Choose tests")
              : tr(
                  `บันทึกคำสั่งตรวจ · ${codes.length} รายการ · ${specimens.map((s) => SPECIMEN_LABEL[s]).join(" ")}`,
                  `Save order · ${codes.length} test${codes.length === 1 ? "" : "s"} · ${specimens.map((s) => SPECIMEN_LABEL[s]).join(", ")}`,
                )
          }
          disabled={codes.length === 0}
          onPress={save}
        />
      </ActionBar>
    </View>
  );
}

function Label({ children }: { children: string }) {
  return <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>{children}</Text>;
}

/** One test: its name on the slip, what it is for, and what it is taken from. */
function TestRow({
  test,
  on,
  divider,
  onPress,
}: {
  test: LabTest;
  on: boolean;
  divider: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${test.code} ${test.detail}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.md,
        minHeight: 56,
        paddingHorizontal: SPACE.lg,
        paddingVertical: SPACE.sm,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: SEPARATOR,
      }}
    >
      <CheckBox on={on} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: on ? "600" : "500", color: TEXT_PRIMARY }}>
          {test.code}
        </Text>
        <Text style={{ marginTop: 2, fontSize: 12, color: TEXT_MUTED }}>
          {test.fasting === true
            ? `${test.detail} · ${tr("งดอาหาร 8 ชม.", "Fast 8 h")}`
            : test.detail}
        </Text>
      </View>
      <View
        style={{
          paddingHorizontal: SPACE.sm,
          paddingVertical: 2,
          borderRadius: RADIUS.capsule,
          backgroundColor: on ? PRIMARY_100 : GROUPED_BG,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: "600", color: on ? PRIMARY_500 : TEXT_MUTED }}>
          {SPECIMEN_LABEL[test.specimen]}
        </Text>
      </View>
    </Pressable>
  );
}
