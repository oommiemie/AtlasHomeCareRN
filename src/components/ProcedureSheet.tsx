import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus, Syringe, Timer, UserRound, X } from "lucide-react-native";

import { ActionBar, PrimaryAction } from "./ActionBar";
import { Card } from "./Card";
import { CardAction, CardHeading } from "./CardAction";
import { DateTimeField } from "./DateTimeField";
import { NoteField } from "./FormField";
import { GlassIconButton } from "./GlassIconButton";
import { PickRow, PickSheet } from "./PickSheet";
import {
  durationOf,
  icd9Of,
  searchIcd9,
  searchProcedures,
  type Assistant,
  type ProcedureLine,
} from "../models/procedures";
import { ASSIST_ROLES, searchStaff, staffNamed } from "../models/staff";
import {
  CANVAS,
  DANGER,
  GROUPED_BG,
  PRIMARY_100,
  PRIMARY_500,
  PRIMARY_700,
  RADIUS,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme/tokens";

const baht = (n: number) => `${n.toLocaleString("th-TH")} บาท`;

/** A fresh procedure, timed from now and signed by whoever is signed in. */
export function newProcedure(by: string): ProcedureLine {
  const now = new Date().toISOString();
  return {
    id: `${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
    code: "",
    name: "",
    price: 0,
    icd9: "",
    start: now,
    end: now,
    by,
    orderedBy: by,
    assistants: [],
    note: "",
  };
}

/**
 * One procedure, in full — what was done, when, by whom and with whom.
 *
 * The order is the order it happened in: the procedure and what it is
 * coded to, then the clock, then the people. The times are kept as a
 * start and an end rather than as a length, because those are what a
 * carer knows; the length is worked out and shown back so the note can
 * be read without arithmetic.
 *
 * Every choice on this page opens a list of its own rather than a
 * dropdown, because the sheet is already a sheet and a pushed screen
 * would come up behind it.
 */
export function ProcedureSheet({
  visible,
  line,
  editing,
  onChange,
  onClose,
  onDone,
}: {
  visible: boolean;
  line: ProcedureLine | null;
  editing: boolean;
  onChange: (l: ProcedureLine) => void;
  onClose: () => void;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  // Which list is open over this sheet: the procedure, the code, a person,
  // or an assistant's part. An index goes with the last two.
  const [pick, setPick] = useState<
    | { kind: "item" }
    | { kind: "icd9" }
    | { kind: "by" }
    | { kind: "orderedBy" }
    | null
  >(null);
  // The assistant being written, and where they go: an index, or -1 for
  // somebody new.
  const [assist, setAssist] = useState<{ at: number; draft: Assistant } | null>(null);

  if (line == null) return null;
  const set = (patch: Partial<ProcedureLine>) => onChange({ ...line, ...patch });

  const length = durationOf(line.start, line.end);
  const backwards = new Date(line.end).getTime() < new Date(line.start).getTime();
  const icd9 = icd9Of(line.icd9);
  const ready = line.name !== "" && !backwards;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: CANVAS }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg }}>
          <GlassIconButton onPress={onClose} accessibilityLabel="ปิด">
            <X size={22} color={TEXT_PRIMARY} strokeWidth={2.6} />
          </GlassIconButton>
          <Text style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: "600", color: TEXT_PRIMARY }}>
            {editing ? "แก้ไขหัตถการ" : "เพิ่มหัตถการ"}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: SPACE.lg, gap: SPACE.md, paddingBottom: insets.bottom + 110 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* What was done, and what it is coded to. */}
          <Card style={{ gap: SPACE.lg }}>
            <CardHeading icon={<Syringe size={13} color={PRIMARY_500} strokeWidth={2.4} />} title="หัตถการ" />
            <PickRow
              label="รายการหัตถการ"
              value={line.name}
              placeholder="เลือกหัตถการ"
              onPress={() => setPick({ kind: "item" })}
            />
            {line.name !== "" && (
              /* The fee, on its own plate: it is the one number on this page
                 and it is read, not typed. */
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACE.sm,
                  borderRadius: RADIUS.card,
                  backgroundColor: PRIMARY_100,
                  paddingHorizontal: SPACE.lg,
                  paddingVertical: SPACE.md,
                }}
              >
                <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: PRIMARY_700 }}>ค่าบริการ</Text>
                <Text style={{ fontSize: 22, fontWeight: "800", color: PRIMARY_700, fontVariant: ["tabular-nums"] }}>
                  {line.price.toLocaleString("th-TH")}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: PRIMARY_700 }}>บาท</Text>
              </View>
            )}
            <PickRow
              label="รหัส ICD-9-CM"
              value={icd9 != null ? `${icd9.code} ${icd9.th}` : line.icd9}
              placeholder="เลือกรหัส ICD-9"
              onPress={() => setPick({ kind: "icd9" })}
            />
          </Card>

          {/* The clock. */}
          <Card style={{ gap: SPACE.lg }}>
            <CardHeading icon={<Timer size={13} color={PRIMARY_500} strokeWidth={2.4} />} title="ช่วงเวลาที่ทำ" />
            <DateTimeField label="วันที่-เวลาที่เริ่ม" value={line.start} onChange={(v) => set({ start: v })} />
            <DateTimeField label="วันที่-เวลาที่เสร็จ" value={line.end} onChange={(v) => set({ end: v })} />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.sm,
                borderRadius: RADIUS.card,
                backgroundColor: backwards ? "#FFF1F1" : PRIMARY_100,
                paddingHorizontal: SPACE.md,
                paddingVertical: SPACE.md,
              }}
            >
              <Text style={{ flex: 1, fontSize: 14, color: backwards ? DANGER : PRIMARY_700 }}>รวมเวลาที่ใช้</Text>
              <Text style={{ fontSize: 16, fontWeight: "800", color: backwards ? DANGER : PRIMARY_700 }}>{length}</Text>
            </View>
          </Card>

          {/* The people. */}
          <Card style={{ gap: SPACE.lg }}>
            <CardHeading icon={<UserRound size={13} color={PRIMARY_500} strokeWidth={2.4} />} title="ผู้ทำและผู้สั่ง" />
            <PickRow label="ผู้ทำหัตถการ" value={line.by} placeholder="เลือกผู้ทำ" onPress={() => setPick({ kind: "by" })} />
            <PickRow label="ผู้สั่ง" value={line.orderedBy} placeholder="เลือกผู้สั่ง" onPress={() => setPick({ kind: "orderedBy" })} />
          </Card>

          {/* Whoever helped. */}
          <Card style={{ gap: SPACE.md }}>
            <CardHeading
              icon={<UserRound size={13} color={PRIMARY_500} strokeWidth={2.4} />}
              title="ผู้ช่วย"
              action={
                <CardAction
                  icon={<Plus size={14} color="#FFFFFF" strokeWidth={2.8} />}
                  label="เพิ่ม"
                  onPress={() => setAssist({ at: -1, draft: { name: "", role: "" } })}
                />
              }
            />
            {line.assistants.length === 0 ? (
              <Text style={{ fontSize: 14, lineHeight: 21, color: TEXT_MUTED }}>ไม่มีผู้ช่วย</Text>
            ) : (
              <View style={{ marginTop: -SPACE.sm, marginBottom: -SPACE.sm }}>
                {line.assistants.map((a, i) => (
                  <View key={`${a.name}-${i}`}>
                    {i > 0 && <View style={{ height: 1, backgroundColor: SEPARATOR }} />}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md, paddingVertical: SPACE.md }}>
                      <Pressable
                        onPress={() => setAssist({ at: i, draft: a })}
                        accessibilityRole="button"
                        accessibilityLabel={`แก้ไขผู้ช่วย ${a.name}`}
                        style={({ pressed }) => ({ flex: 1, gap: 3, opacity: pressed ? 0.6 : 1 })}
                      >
                        <Text style={{ fontSize: 15, lineHeight: 21, fontWeight: "600", color: TEXT_PRIMARY }}>
                          {a.name !== "" ? a.name : "ยังไม่ระบุชื่อ"}
                        </Text>
                        <Text style={{ fontSize: 12, color: TEXT_MUTED }}>{a.role !== "" ? a.role : "ยังไม่ระบุหน้าที่"}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => set({ assistants: line.assistants.filter((_, j) => j !== i) })}
                        accessibilityRole="button"
                        accessibilityLabel="ลบผู้ช่วย"
                        hitSlop={8}
                        style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: GROUPED_BG }}
                      >
                        <X size={16} color={TEXT_SECONDARY} strokeWidth={2.4} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>

          <Card>
            <NoteField
              label="หมายเหตุ (ถ้ามี)"
              value={line.note}
              onChangeText={(v) => set({ note: v })}
              placeholder="สิ่งที่พบระหว่างทำ อุปกรณ์ที่ใช้ หรือสิ่งที่ต้องติดตาม"
              lines={3}
            />
          </Card>
        </ScrollView>

        <ActionBar>
          <PrimaryAction
            label={editing ? "บันทึกการแก้ไข" : "เพิ่มลงรายการ"}
            disabled={!ready}
            onPress={onDone}
          />
        </ActionBar>

        {/* The lists, over this sheet. */}
        <PickSheet
          visible={pick?.kind === "item"}
          title="เลือกหัตถการ"
          placeholder="ค้นหาชื่อหัตถการ"
          rows={(q) =>
            searchProcedures(q).map((p) => ({
              key: p.code,
              lead: p.icd9,
              title: p.name,
              sub: p.price > 0 ? baht(p.price) : "ไม่คิดค่าบริการ",
              pick: () => set({ code: p.code, name: p.name, price: p.price, icd9: line.icd9 === "" ? p.icd9 : line.icd9 }),
            }))
          }
          onClose={() => setPick(null)}
        />
        <PickSheet
          visible={pick?.kind === "icd9"}
          title="เลือกรหัส ICD-9-CM"
          placeholder="ค้นหารหัสหรือชื่อ"
          rows={(q) =>
            searchIcd9(q).map((i) => ({
              key: i.code,
              lead: i.code,
              title: i.th,
              sub: i.en,
              pick: () => set({ icd9: i.code }),
            }))
          }
          onClose={() => setPick(null)}
        />
        <PickSheet
          visible={pick?.kind === "by" || pick?.kind === "orderedBy"}
          title={pick?.kind === "orderedBy" ? "เลือกผู้สั่ง" : "เลือกผู้ทำหัตถการ"}
          placeholder="ค้นหาชื่อหรือตำแหน่ง"
          rows={(q) =>
            searchStaff(q).map((s) => ({
              key: s.id,
              title: s.name,
              sub: s.role,
              pick: () => {
                if (pick?.kind === "orderedBy") set({ orderedBy: s.name });
                else set({ by: s.name });
              },
            }))
          }
          onClose={() => setPick(null)}
        />
        <AssistantSheet
          visible={assist != null}
          draft={assist?.draft ?? { name: "", role: "" }}
          editing={(assist?.at ?? -1) >= 0}
          onChange={(draft) => setAssist((cur) => (cur == null ? cur : { ...cur, draft }))}
          onClose={() => setAssist(null)}
          onDone={() => {
            if (assist == null) return;
            set({
              assistants:
                assist.at >= 0
                  ? line.assistants.map((a, i) => (i === assist.at ? assist.draft : a))
                  : [...line.assistants, assist.draft],
            });
            setAssist(null);
          }}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * One person helping, on a page of their own: who, and what they are
 * doing. Written here rather than in the card so the procedure's own form
 * stays a list of what was done, not a form inside a form.
 */
function AssistantSheet({
  visible,
  draft,
  editing,
  onChange,
  onClose,
  onDone,
}: {
  visible: boolean;
  draft: Assistant;
  editing: boolean;
  onChange: (a: Assistant) => void;
  onClose: () => void;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [pick, setPick] = useState<"name" | "role" | null>(null);
  const staff = staffNamed(draft.name);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: CANVAS }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg }}>
          <GlassIconButton onPress={onClose} accessibilityLabel="ปิด">
            <X size={22} color={TEXT_PRIMARY} strokeWidth={2.6} />
          </GlassIconButton>
          <Text style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: "600", color: TEXT_PRIMARY }}>
            {editing ? "แก้ไขผู้ช่วย" : "เพิ่มผู้ช่วย"}
          </Text>
          <View style={{ width: 44 }} />
        </View>
        <ScrollView
          contentContainerStyle={{ padding: SPACE.lg, gap: SPACE.md, paddingBottom: insets.bottom + 110 }}
          showsVerticalScrollIndicator={false}
        >
          <Card style={{ gap: SPACE.lg }}>
            <PickRow
              label="ชื่อผู้ช่วย"
              value={draft.name}
              placeholder="เลือกผู้ช่วย"
              onPress={() => setPick("name")}
            />
            {staff != null && (
              <Text style={{ fontSize: 13, color: TEXT_MUTED, marginTop: -SPACE.md }}>{staff.role}</Text>
            )}
            <PickRow
              label="ตำแหน่ง / หน้าที่ในหัตถการนี้"
              value={draft.role}
              placeholder="เลือกหน้าที่"
              onPress={() => setPick("role")}
            />
          </Card>
        </ScrollView>
        <ActionBar>
          <PrimaryAction
            label={editing ? "บันทึกการแก้ไข" : "เพิ่มลงรายการ"}
            disabled={draft.name.trim() === ""}
            onPress={onDone}
          />
        </ActionBar>

        <PickSheet
          visible={pick === "name"}
          title="เลือกผู้ช่วย"
          placeholder="ค้นหาชื่อหรือตำแหน่ง"
          rows={(q) =>
            searchStaff(q).map((s) => ({
              key: s.id,
              title: s.name,
              sub: s.role,
              // The directory's own title is the likeliest part they will
              // play, so it is offered rather than left blank.
              pick: () => onChange({ name: s.name, role: draft.role !== "" ? draft.role : s.role }),
            }))
          }
          onClose={() => setPick(null)}
        />
        <PickSheet
          visible={pick === "role"}
          title="เลือกตำแหน่ง / หน้าที่"
          placeholder="ค้นหาหน้าที่"
          rows={(q) =>
            ASSIST_ROLES.filter((r) => r.toLowerCase().includes(q.trim().toLowerCase())).map((r) => ({
              key: r,
              title: r,
              pick: () => onChange({ ...draft, role: r }),
            }))
          }
          onClose={() => setPick(null)}
        />
      </View>
    </Modal>
  );
}
