import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { Activity, Plus, Stethoscope, X } from "lucide-react-native";

import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { Card } from "../components/Card";
import { NoteField } from "../components/FormField";
import { GlassIconButton } from "../components/GlassIconButton";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  PHYSIO_ACTIVITIES,
  PHYSIO_STATUS,
  PHYSIO_SYSTEMS,
  THERAPISTS,
  addPhysio,
  usePhysio,
  type PhysioSession,
} from "../models/physio";
import { thaiFullDate } from "../utils/thaiDate";
import {
  CANVAS,
  DANGER,
  GROUPED_BG,
  PRIMARY_100,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  SUCCESS,
  SURFACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  WARNING,
} from "../theme/tokens";

/** Pain colour: green low, amber middling, red high. */
function painInk(p: number): string {
  return p >= 7 ? DANGER : p >= 4 ? WARNING : SUCCESS;
}

/**
 * "งานกายภาพบำบัด" — the physiotherapy done this visit.
 *
 * The reference is four tabbed screens of registration, SOAP notes and code
 * boxes; this is one list and one form. A session is a card — what system,
 * who treated, what was done, the pain score and the status; adding one
 * opens a sheet with only the fields a therapist fills in the room.
 */
export function PhysioScreen() {
  const { holder } = useRoute<RouteProp<RootStackParamList, "Physio">>().params;
  const insets = useSafeAreaInsets();
  const sessions = usePhysio(holder.authenCode);
  const [adding, setAdding] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="งานกายภาพบำบัด" />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: SPACE.lg,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + 100,
            gap: SPACE.md,
          }}
          showsVerticalScrollIndicator={false}
        >
          {sessions.length === 0 ? (
            <View style={{ alignItems: "center", gap: SPACE.md, paddingVertical: SPACE.huge }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: PRIMARY_100,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Activity size={28} color={PRIMARY_500} strokeWidth={2.2} />
              </View>
              <Text style={{ fontSize: 14, color: TEXT_MUTED, textAlign: "center" }}>
                ยังไม่มีการรักษากายภาพในการเยี่ยมนี้
              </Text>
            </View>
          ) : (
            sessions
              .slice()
              .reverse()
              .map((s) => <SessionCard key={s.id} session={s} />)
          )}
        </ScrollView>
      </HeaderFade>

      <ActionBar>
        <PrimaryAction label="เพิ่มการรักษากายภาพ" onPress={() => setAdding(true)} />
      </ActionBar>

      <PhysioForm
        visible={adding}
        onClose={() => setAdding(false)}
        onSave={(s) => {
          addPhysio(holder.authenCode, s);
          setAdding(false);
          toast("บันทึกการรักษากายภาพแล้ว", "success");
        }}
      />
    </View>
  );
}

/** One session, as a card. */
function SessionCard({ session }: { session: PhysioSession }) {
  return (
    <Card style={{ gap: SPACE.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
        <Text style={{ flex: 1, fontSize: 16, lineHeight: 21, fontWeight: "700", color: TEXT_PRIMARY }}>
          {session.system}
        </Text>
        <StatusPill status={session.status} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
        <Stethoscope size={14} color={TEXT_MUTED} strokeWidth={2} />
        <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, color: TEXT_SECONDARY }}>
          {`${session.therapist} · ${session.date}`}
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {session.activities.map((code) => {
          const a = PHYSIO_ACTIVITIES.find((x) => x.code === code);
          return (
            <View
              key={code}
              style={{
                paddingHorizontal: SPACE.md,
                paddingVertical: 4,
                borderRadius: RADIUS.capsule,
                backgroundColor: PRIMARY_100,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: PRIMARY_500 }}>
                {a != null ? `${a.code} · ${a.label}` : code}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={{ height: 1, backgroundColor: SEPARATOR }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
        <Text style={{ flex: 1, fontSize: 13, color: TEXT_MUTED }}>ระดับความเจ็บปวด (VAS)</Text>
        <Text style={{ fontSize: 16, fontWeight: "700", color: painInk(session.pain) }}>
          {`${session.pain}/10`}
        </Text>
      </View>
      {session.note.trim() !== "" && (
        <Text style={{ fontSize: 14, lineHeight: 21, color: TEXT_PRIMARY }}>{session.note}</Text>
      )}
    </Card>
  );
}

/** The status, as a coloured pill. */
function StatusPill({ status }: { status: string }) {
  const ink = status === "จำหน่าย" ? SUCCESS : status === "ติดตามอาการ" ? WARNING : PRIMARY_500;
  return (
    <View
      style={{
        paddingHorizontal: SPACE.md,
        paddingVertical: 3,
        borderRadius: RADIUS.capsule,
        backgroundColor: `${ink}1A`,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "600", color: ink }}>{status}</Text>
    </View>
  );
}

/**
 * The add form — one scroll, the fields a therapist fills in the room.
 *
 * The pain score is a row of taps rather than a slider: a slider is a
 * precision instrument for a number a patient gives to the nearest whole,
 * and it is fiddly with a thumb. Eleven pills, coloured as they climb.
 */
function PhysioForm({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (s: Omit<PhysioSession, "id">) => void;
}) {
  const insets = useSafeAreaInsets();
  const today = thaiFullDate(new Date());

  const [system, setSystem] = useState<string | null>(null);
  const [therapist, setTherapist] = useState("");
  const [activities, setActivities] = useState<string[]>([]);
  const [pain, setPain] = useState<number | null>(null);
  const [status, setStatus] = useState("กำลังรักษา");
  const [note, setNote] = useState("");

  const ready = system != null && therapist !== "" && activities.length > 0;

  const reset = () => {
    setSystem(null);
    setTherapist("");
    setActivities([]);
    setPain(null);
    setStatus("กำลังรักษา");
    setNote("");
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={reset}
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
          <GlassIconButton onPress={onClose} accessibilityLabel="ยกเลิก">
            <X size={22} color={TEXT_PRIMARY} strokeWidth={2.6} />
          </GlassIconButton>
          <Text style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: "600", color: TEXT_PRIMARY }}>
            เพิ่มการรักษากายภาพ
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{
              padding: SPACE.lg,
              gap: SPACE.md,
              paddingBottom: insets.bottom + 100,
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <Text style={{ fontSize: 12, color: TEXT_MUTED }}>
              {`วันที่ทำ · ${today}`}
            </Text>

            <Card style={{ gap: SPACE.lg }}>
              <Choose label="ระบบ / กลุ่มโรค" required options={PHYSIO_SYSTEMS} value={system} onChange={setSystem} />
              <Choose
                label="นักกายภาพบำบัด"
                required
                options={THERAPISTS}
                value={therapist === "" ? null : therapist}
                onChange={(v) => setTherapist(v ?? "")}
              />
              <MultiChoose
                label="กิจกรรมบำบัด"
                required
                options={PHYSIO_ACTIVITIES}
                values={activities}
                onToggle={(code) =>
                  setActivities((cur) =>
                    cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code],
                  )
                }
              />
            </Card>

            <Card style={{ gap: SPACE.md }}>
              <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>
                ระดับความเจ็บปวด (VAS 0–10)
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {Array.from({ length: 11 }, (_, n) => {
                  const on = pain === n;
                  const ink = painInk(n);
                  return (
                    <Pressable
                      key={n}
                      onPress={() => setPain(n)}
                      accessibilityRole="button"
                      accessibilityLabel={`ความเจ็บปวด ${n}`}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: on ? ink : GROUPED_BG,
                      }}
                    >
                      <Text style={{ fontSize: 16, fontWeight: "700", color: on ? "#FFFFFF" : TEXT_PRIMARY }}>
                        {n}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            <Card style={{ gap: SPACE.lg }}>
              <Choose label="สถานะการรักษา" options={PHYSIO_STATUS} value={status} onChange={(v) => setStatus(v ?? "กำลังรักษา")} />
              <NoteField
                label="บันทึก / แผนต่อไป"
                value={note}
                onChangeText={setNote}
                placeholder="สิ่งที่ทำและแผนสำหรับครั้งถัดไป"
              />
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>

        <ActionBar>
          <PrimaryAction
            label={ready ? "บันทึกการรักษา" : "กรอกข้อมูลที่จำเป็น"}
            disabled={!ready}
            onPress={() =>
              onSave({
                date: today,
                system: system ?? "",
                therapist,
                activities,
                pain: pain ?? 0,
                status,
                note,
              })
            }
          />
        </ActionBar>
      </View>
    </Modal>
  );
}

/** One of a few, as capsules. */
function Choose({
  label,
  required,
  options,
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  options: readonly string[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <View style={{ gap: SPACE.sm }}>
      <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>
        {label}
        {required === true && <Text style={{ color: DANGER }}> *</Text>}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
        {options.map((o) => {
          const on = value === o;
          return (
            <Pressable
              key={o}
              onPress={() => onChange(on ? null : o)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={{
                paddingHorizontal: SPACE.lg,
                paddingVertical: 9,
                borderRadius: RADIUS.capsule,
                backgroundColor: on ? PRIMARY_500 : GROUPED_BG,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: on ? "600" : "400", color: on ? "#FFFFFF" : TEXT_PRIMARY }}>
                {o}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Several of a few, with their codes. */
function MultiChoose({
  label,
  required,
  options,
  values,
  onToggle,
}: {
  label: string;
  required?: boolean;
  options: { code: string; label: string }[];
  values: string[];
  onToggle: (code: string) => void;
}) {
  return (
    <View style={{ gap: SPACE.sm }}>
      <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>
        {label}
        {required === true && <Text style={{ color: DANGER }}> *</Text>}
      </Text>
      <View style={{ gap: SPACE.sm }}>
        {options.map((o) => {
          const on = values.includes(o.code);
          return (
            <Pressable
              key={o.code}
              onPress={() => onToggle(o.code)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.md,
                paddingHorizontal: SPACE.lg,
                paddingVertical: 12,
                borderRadius: RADIUS.md,
                backgroundColor: on ? PRIMARY_100 : GROUPED_BG,
                borderWidth: 1,
                borderColor: on ? PRIMARY_500 : "transparent",
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 26,
                  borderRadius: 13,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: on ? PRIMARY_500 : SURFACE,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: on ? "#FFFFFF" : TEXT_MUTED }}>
                  {o.code}
                </Text>
              </View>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: on ? "600" : "400", color: TEXT_PRIMARY }}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
