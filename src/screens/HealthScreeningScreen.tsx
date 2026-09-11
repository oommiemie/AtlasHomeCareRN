import { useState } from "react";
import {
  KeyboardAvoidingView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import { Activity, FileText } from "lucide-react-native";

import { Card } from "../components/Card";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import { SCREENING_FIELDS, markDone } from "../models/community";
import {
  PRIMARY_100,
  PRIMARY_500,
  RADIUS,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";

/** Figma 98:12765. */
const D = { pad: 16, field: 48, note: 144, fill: "#F2F2F7" } as const;

/**
 * "คัดกรองข้อมูลสุขภาพ" — Figma 98:12765.
 *
 * Two cards: the vital signs, then the words. The readings come first because
 * they are what the visit is for and what the machine in the carer's bag has
 * just produced; the notes are underneath because they are written once the
 * numbers are in.
 *
 * Nothing here is required. A community round is taken in whatever order the
 * queue allows and a form that refused to save until every box was filled
 * would be a form filled with noughts.
 */
export function HealthScreeningScreen() {
  const { holder } =
    useRoute<RouteProp<RootStackParamList, "HealthScreening">>().params;
  const insets = useSafeAreaInsets();
  const nav = useNavigation();

  const [values, setValues] = useState<Record<string, string>>({});
  const [complaint, setComplaint] = useState("");
  const [hpi, setHpi] = useState("");

  const set = (key: string, v: string) =>
    setValues((was) => ({ ...was, [key]: v }));

  const filled = SCREENING_FIELDS.filter(
    (f) => (values[f.key] ?? "").trim().length > 0,
  ).length;

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="คัดกรองข้อมูลสุขภาพ" />

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <HeaderFade from={0} to={HEADER_FADE}>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: D.pad,
              paddingTop: HEADER_FADE,
              paddingBottom: insets.bottom + 104,
              gap: D.pad,
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
              {`บันทึกสำหรับ คุณ${holder.name} · HN ${holder.hn}`}
            </Text>

            <Card>
              <SectionHead icon="vital" label="Vitalsign" />
              {SCREENING_FIELDS.map((f) => (
                <View key={f.key} style={{ marginTop: D.pad, gap: 8 }}>
                  <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_PRIMARY }}>
                    {f.label}
                  </Text>
                  <View
                    style={{
                      height: D.field,
                      borderRadius: RADIUS.capsule,
                      backgroundColor: D.fill,
                      paddingHorizontal: SPACE.lg,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: SPACE.sm,
                    }}
                  >
                    <TextInput
                      value={values[f.key] ?? ""}
                      onChangeText={(v) => set(f.key, v)}
                      // A pressure is two numbers with a slash, so its box
                      // cannot be a number pad — every other one can.
                      keyboardType={
                        f.pair
                          ? "numbers-and-punctuation"
                          : f.keyboard === "decimal"
                            ? "decimal-pad"
                            : "number-pad"
                      }
                      placeholder={f.pair ? "120/80" : "—"}
                      placeholderTextColor={TEXT_MUTED}
                      style={{
                        flex: 1,
                        fontSize: 16,
                        fontWeight: "600",
                        color: TEXT_PRIMARY,
                      }}
                    />
                    <Text style={{ fontSize: 12, color: TEXT_MUTED }}>{f.unit}</Text>
                  </View>
                </View>
              ))}
            </Card>

            <Card>
              <SectionHead icon="note" label="ข้อมูลเพิ่มเติม" />
              <Note
                label="อาการสำคัญ"
                value={complaint}
                onChange={setComplaint}
                placeholder="อาการที่ผู้ป่วยมาด้วย"
              />
              <Note
                label="Doctor/Nurse HPI"
                value={hpi}
                onChange={setHpi}
                placeholder="ประวัติการเจ็บป่วยปัจจุบัน"
              />
            </Card>
          </ScrollView>
        </HeaderFade>
      </KeyboardAvoidingView>

      {/* The app's floating tray, at the same height as every other. */}
      <ActionBar>
        <PrimaryAction
          label="บันทึก"
          onPress={() => {
            toast(
              filled === 0
                ? "ยังไม่ได้กรอกข้อมูล"
                : `บันทึกแล้ว ${filled} รายการ`,
            );
            if (filled > 0) {
              // Tell the record it has something in it now.
              markDone(holder.authenCode, "screening");
              nav.goBack();
            }
          }}
        />
      </ActionBar>
    </View>
  );
}

/** A card's heading: a round mark and the section's name. */
function SectionHead({ icon, label }: { icon: "vital" | "note"; label: string }) {
  return (
    <View style={{ gap: D.pad }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: PRIMARY_100,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon === "vital" ? (
            <Activity size={13} color={PRIMARY_500} strokeWidth={2.4} />
          ) : (
            <FileText size={13} color={PRIMARY_500} strokeWidth={2.4} />
          )}
        </View>
        <Text style={{ fontSize: 16, lineHeight: 21, fontWeight: "500", color: TEXT_PRIMARY }}>
          {label}
        </Text>
      </View>
      <View style={{ height: 1, backgroundColor: "rgba(204,204,204,0.4)" }} />
    </View>
  );
}

/** A box for words rather than a figure — taller, and square-cornered. */
function Note({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View style={{ marginTop: D.pad, gap: 8 }}>
      <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_PRIMARY }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline
        textAlignVertical="top"
        placeholder={placeholder}
        placeholderTextColor={TEXT_MUTED}
        style={{
          height: D.note,
          borderRadius: RADIUS.lg,
          backgroundColor: D.fill,
          padding: SPACE.lg,
          fontSize: 14,
          lineHeight: 20,
          color: TEXT_PRIMARY,
        }}
      />
    </View>
  );
}
