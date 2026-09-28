import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import {
  Activity,
  Bluetooth,
  ChartLine,
  Droplet,
  FileText,
  History,
  X,
  Ruler,
} from "lucide-react-native";

import { ChoiceChip } from "../components/ChoiceChip";
import { Card } from "../components/Card";
import { GlassIconButton } from "../components/GlassIconButton";
import { MeasureSheet } from "../components/MeasureSheet";
import { NoteField, SelectField, TextField } from "../components/FormField";
import { CardAction, CardHeading } from "../components/CardAction";
import { HpiPicker } from "../components/HpiPicker";
import { ToolbarPill } from "../components/ToolbarPill";
import { VitalDetailView } from "./VitalDetailScreen";
import { BmiDetailView } from "./BmiDetailScreen";
import type { MetricKind } from "../models/vitals";
import { Stepper } from "../components/Stepper";
import { daysFromToday } from "../models/clock";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { toast } from "../components/Toast";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  SCREENING_FIELDS,
  readingError,
  readingStatus,
  bmiFrom,
  recordOf,
  saveTask,
  treatmentHistory,
} from "../models/community";
import {
  CANVAS,
  DANGER,
  DANGER_BG,
  WARNING_BG,
  PRIMARY_100,
  PRIMARY_500,
  PRIMARY_700,
  RADIUS,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  WARNING,
} from "../theme/tokens";

/** Figma 98:12765. */
const D = { pad: 16 } as const;

/**
 * "คัดกรองสุขภาพ" — Figma 98:12765.
 *
 * Two cards: the vital signs, then the words. The readings come first
 * because they are what the visit is for and what the machine in the
 * carer's bag has just produced; the notes are underneath because they are
 * written once the numbers are in.
 *
 * Both are built from the app's own `FormField` controls, at the spacing
 * the add-house form uses — a carer moves between these forms in one
 * visit, and a field that is a different size or a different distance from
 * its neighbour on each page is the thing you notice instead of the work.
 *
 * Nothing in particular is required — a round is taken in whatever order the
 * queue allows, and a form that refused to save until every box was filled
 * would be a form filled with noughts. Two things do stop it saving: an
 * empty form, and one holding a reading nobody could have taken. Abnormal
 * readings are the whole point of the exercise and save like any other;
 * impossible ones are typing, and a temperature of 390 in the record is
 * worse than no temperature at all.
 */
/**
 * The readings, in the three groups a carer takes them in.
 *
 * One long column of eight boxes said nothing about which instrument each
 * came off, and made the form look longer than it is. Grouped, the card a
 * carer is filling is the one they have the cuff on for.
 */
const VITAL_GROUPS: { label: string; icon: "vital" | "note" | "body" | "lab"; rows: string[][] }[] = [
  // Stated row by row rather than worked out from the order: a pressure
  // needs the width for "120/80", a pulse reads better full width under
  // the pair above it, and which reading sits beside which is a judgement
  // about the form, not something a rule can infer.
  { label: "สัญญาณชีพ", icon: "vital", rows: [["bp"], ["temp", "spo2"], ["pulse"]] },
  { label: "ค่าตรวจเลือด", icon: "lab", rows: [["glucose"]] },
  { label: "สัดส่วนร่างกาย", icon: "body", rows: [["weight", "height"], ["waist"]] },
];



/** What can be looked back at, in the order the form takes them. */
const HISTORY_KINDS: { key: MetricKind | "bmi"; label: string }[] = [
  { key: "bp", label: "ความดัน" },
  { key: "temp", label: "อุณหภูมิ" },
  { key: "pulse", label: "ชีพจร" },
  { key: "spo2", label: "ออกซิเจน" },
  { key: "glucose", label: "น้ำตาล" },
  { key: "waist", label: "รอบเอว" },
  // Its own page, not a reading: the BMI is two measurements and what they
  // come to, and the app draws it that way.
  { key: "bmi", label: "BMI" },
];

/** As the hospital's own list has them, shortest first. */
const DURATION_UNITS = ["นาที", "ชั่วโมง", "วัน", "สัปดาห์", "เดือน", "ปี"] as const;

export function HealthScreeningScreen() {
  const { holder } =
    useRoute<RouteProp<RootStackParamList, "HealthScreening">>().params;
  const insets = useSafeAreaInsets();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  /*
    Opened on whatever this visit already holds.

    Read once, into the initial state, rather than watched: a form bound to
    a live store would fight the keyboard on every letter, and nothing else
    can be writing to this record while the carer is standing in it.
  */
  const was = useState(() => recordOf(holder.authenCode, "screening"))[0];
  const [values, setValues] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const f of SCREENING_FIELDS) if (was[f.key] != null) seed[f.key] = was[f.key];
    return seed;
  });
  const [measuring, setMeasuring] = useState(false);
  /* The past readings, drawn, over the form — and which one is on show. */
  const [history, setHistory] = useState(false);
  const [historyKind, setHistoryKind] = useState<MetricKind | "bmi">("bp");
  const [complaint, setComplaint] = useState(was.complaint ?? "");
  const [duration, setDuration] = useState(Number(was.duration ?? 0) || 0);
  const [durationUnit, setDurationUnit] = useState<(typeof DURATION_UNITS)[number]>(
    (DURATION_UNITS as readonly string[]).includes(was.durationUnit ?? "")
      ? (was.durationUnit as (typeof DURATION_UNITS)[number])
      : "วัน",
  );
  const [hpi, setHpi] = useState(was.hpi ?? "");
  /* The past notes, behind the button in the card's corner. */
  const [picking, setPicking] = useState(false);
  const pastHpi = useMemo(
    () =>
      treatmentHistory(holder.hn)
        .filter((v) => (v.hpi ?? "").trim() !== "")
        .map((v) => ({ id: v.id, by: v.staff, at: daysFromToday(-v.daysAgo), text: v.hpi as string })),
    [holder.hn],
  );

  const bmi = bmiFrom(values.weight ?? "", values.height ?? "");

  /**
   * This patient as the health pages read a person.
   *
   * Those pages take a resident and generate the record from their id, so
   * a community patient reaches them by being given the shape they expect
   * — the hospital number is the id, which keeps the same patient's charts
   * the same between visits. The weight and height are today's if they
   * have been typed, so the BMI page opens on what is in the form.
   */
  /** The chips over the record, the same row on either page. */
  const historyChips = (
    <View style={{ paddingTop: SPACE.lg, gap: SPACE.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.lg }}>
        <GlassIconButton onPress={() => setHistory(false)} accessibilityLabel="ปิด">
          <X size={22} color={TEXT_PRIMARY} strokeWidth={2.6} />
        </GlassIconButton>
        <Text style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: "600", color: TEXT_PRIMARY }}>
          ประวัติการวัด
        </Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{ alignItems: "center", paddingHorizontal: SPACE.lg, gap: SPACE.sm }}
      >
        {HISTORY_KINDS.map((k) => {
          const on = k.key === historyKind;
          return (
            // The shared chip, as every other choice of one in the app.
            <ChoiceChip
              key={k.key}
              label={k.label}
              on={on}
              onPress={() => {
                if (!on) setHistoryKind(k.key);
              }}
              haptic={!on}
              contentStyle={{ height: 38, paddingVertical: 0 }}
            />
          );
        })}
      </ScrollView>
    </View>
  );

  const patient = useMemo(
    () => ({
      id: `hn-${holder.hn}`,
      name: holder.name,
      age: holder.age,
      gender: holder.gender,
      bloodType: "-",
      phone: holder.phone ?? "",
      weightKg: Number(values.weight) || 62,
      heightCm: Number(values.height) || 165,
      screenings: [],
    }),
    [holder, values.weight, values.height],
  );

  const set = (key: string, v: string) =>
    setValues((was) => ({ ...was, [key]: v }));

  const filled = SCREENING_FIELDS.filter(
    (f) => (values[f.key] ?? "").trim().length > 0,
  ).length;
  const written = [complaint, hpi].filter((v) => v.trim().length > 0).length;
  const anything = filled + written > 0;
  /* A reading nobody could have taken — a slipped decimal, not a fever. */
  const impossible = SCREENING_FIELDS.some(
    (f) => readingError(f, values[f.key] ?? "") != null,
  );

  return (
    <View style={{ flex: 1 }}>
      {/* The instruments, in the header rather than beside a field.

          A cuff fills two boxes and an oximeter fills two others, so a
          button per field would be three buttons saying the same thing;
          and the carer reaches for the instrument before they reach for
          any particular box. */}
      <ScreenHeader
        title="คัดกรองสุขภาพ"
        right={
          <ToolbarPill
            slots={[
              {
                icon: <ChartLine size={20} color={TEXT_PRIMARY} strokeWidth={2.2} />,
                label: "ประวัติการวัด",
                onPress: () => setHistory(true),
              },
              {
                icon: <Bluetooth size={20} color={TEXT_PRIMARY} strokeWidth={2.2} />,
                label: "วัดค่าผ่านอุปกรณ์ Bluetooth",
                onPress: () => setMeasuring(true),
              },
            ]}
          />
        }
      />

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <HeaderFade from={0} to={HEADER_FADE}>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: D.pad,
              paddingTop: HEADER_FADE,
              // Clears the floating tray — 23 up from the foot, 64 tall —
              // with a card's gap under it, so the last field can be
              // scrolled clear of the button rather than ending beneath it.
              paddingBottom: insets.bottom + 120,
              gap: D.pad,
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >

            {/* The readings, grouped as they are taken: what the cuff and
                the probe give, what the strip gives, and what the tape and
                the scales give. Two to a row, except a pressure — "120/80"
                needs the width of the card to itself. */}
            {VITAL_GROUPS.map((group) => (
              <Card key={group.label} style={{ gap: SPACE.lg }}>
                <SectionHead icon={group.icon} label={group.label} />
                <ReadingGrid rows={group.rows} values={values} onChange={set} />
                {/* Worked out from the two boxes above it, as soon as both
                    are there. Read, never typed. */}
                {group.icon === "body" && bmi != null && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: SPACE.sm,
                      borderRadius: RADIUS.card,
                      backgroundColor: bmi.tone === "normal" ? PRIMARY_100 : bmi.tone === "alert" ? DANGER_BG : WARNING_BG,
                      paddingHorizontal: SPACE.lg,
                      paddingVertical: SPACE.md,
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 14,
                        fontWeight: "600",
                        color: bmi.tone === "normal" ? PRIMARY_700 : bmi.tone === "alert" ? DANGER : WARNING,
                      }}
                    >
                      {`BMI · ${bmi.label}`}
                    </Text>
                    <Text
                      style={{
                        fontSize: 22,
                        fontWeight: "800",
                        fontVariant: ["tabular-nums"],
                        color: bmi.tone === "normal" ? PRIMARY_700 : bmi.tone === "alert" ? DANGER : WARNING,
                      }}
                    >
                      {bmi.value.toFixed(1)}
                    </Text>
                  </View>
                )}
              </Card>
            ))}

            {/* What they came with, and for how long. */}
            <Card style={{ gap: SPACE.lg }}>
              <SectionHead icon="note" label="อาการสำคัญ" />
              <NoteField
                label="อาการที่มาพบ"
                value={complaint}
                onChangeText={setComplaint}
                placeholder="ปวดศีรษะ เวียนหัวมา 3 วัน กินยาแก้ปวดแล้วไม่ดีขึ้น"
              />
              <View style={{ flexDirection: "row", gap: SPACE.md, alignItems: "flex-end" }}>
                <View style={{ flex: 1 }}>
                  <Stepper label="เป็นมานาน" value={duration} step={1} min={0} onChange={setDuration} />
                </View>
                <View style={{ flex: 1 }}>
                  <SelectField
                    label="หน่วย"
                    value={durationUnit}
                    options={[...DURATION_UNITS]}
                    onChange={(v) => setDurationUnit(v as (typeof DURATION_UNITS)[number])}
                  />
                </View>
              </View>
            </Card>

            {/* The history of it, with what was written before one tap away. */}
            <Card style={{ gap: SPACE.md }}>
              <CardHeading
                icon={<FileText size={13} color={PRIMARY_500} strokeWidth={2.4} />}
                title="ประวัติปัจจุบัน (HPI)"
                action={
                  pastHpi.length > 0 ? (
                    <CardAction
                      icon={<History size={14} color="#FFFFFF" strokeWidth={2.6} />}
                      label={`ประวัติ ${pastHpi.length}`}
                      onPress={() => setPicking(true)}
                    />
                  ) : undefined
                }
              />
              <NoteField
                label="Doctor/Nurse HPI"
                value={hpi}
                onChangeText={setHpi}
                placeholder="เป็นเบาหวานมา 5 ปี รับยาต่อเนื่องที่ รพ.สต. ไม่มีประวัติแพ้ยา"
              />
            </Card>
          </ScrollView>
        </HeaderFade>
      </KeyboardAvoidingView>

      {/*
        The tray, and the button off until there is something to put in it.

        It used to be pressable on an empty form and answer with a toast
        saying nothing had been filled in — which is a button that looks
        like it works, doesn't, and explains itself only after the tap. Off,
        it says the same thing before the tap and without a word.

        The label is "บันทึก" and nothing else once it is live. It counted
        what had been filled in, which is a number the carer did not ask for
        on a button they already know the job of.
      */}
      <MeasureSheet
        visible={measuring}
        onClose={() => setMeasuring(false)}
        // Merged over what is there, not swapped for it: an instrument that
        // filled two boxes must not clear the six the carer typed.
        onUse={(taken) => {
          setValues((was) => ({ ...was, ...taken }));
          toast("ใช้ค่าจากอุปกรณ์แล้ว", "success");
        }}
      />

      <ActionBar>
        <PrimaryAction
          label={
            impossible
              ? "มีค่าที่กรอกไม่ถูกต้อง"
              : anything
                ? "บันทึก"
                : "ยังไม่มีข้อมูลให้บันทึก"
          }
          disabled={!anything || impossible}
          onPress={() => {
            toast("บันทึกข้อมูลแล้ว", "success");
            saveTask(holder.authenCode, "screening", {
              ...values,
              complaint,
              duration: duration > 0 ? String(duration) : "",
              durationUnit,
              hpi,
            });
            nav.goBack();
          }}
        />
      </ActionBar>

      {/* The history, in a sheet: the chips choose the reading and the
          record under them is the app's own detail page, mounted rather
          than copied — so the filters, the picture, the chart and the
          summary are the ones the health pages have. */}
      <Modal
        visible={history}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setHistory(false)}
      >
        <View style={{ flex: 1, backgroundColor: CANVAS }}>
          {historyKind === "bmi" ? (
            <BmiDetailView resident={patient} above={historyChips} />
          ) : (
            <VitalDetailView resident={patient} kind={historyKind} above={historyChips} />
          )}
        </View>
      </Modal>

      <HpiPicker
        visible={picking}
        entries={pastHpi}
        onClose={() => setPicking(false)}
        onPick={(text) => {
          setHpi(text);
          setPicking(false);
          toast("ใช้ข้อความจากประวัติแล้ว", "success");
        }}
      />
    </View>
  );
}

/**
 * One reading: what it is, in what unit, and the box it goes in.
 *
 * The app's own `TextField`, laid out the way the add-house form lays out
 * its own — one to a row, full width, `SPACE.lg` apart. It had been two to
 * a row with the unit spliced into the label ("อุณหภูมิ  °C"), to save
 * scrolling; both were this screen inventing something, and against the
 * rest of the app it read as a different kind of form.
 *
 * The unit sits in `trailing`, which is the slot the control already has
 * for exactly this — it is where the date field hangs its calendar.
 */
function Reading({
  field,
  value,
  onChange,
  bare,
}: {
  field: (typeof SCREENING_FIELDS)[number];
  value: string;
  onChange: (v: string) => void;
  /** On a tile the name is already the tile's, so the field drops its label. */
  bare?: boolean;
}) {
  /*
    What has been typed, judged against the app's own bands.

    Amber for a reading that is outside normal, red once it is far enough
    out to be a problem — the same two steps, off the same table, that the
    charts on the detail pages shade against. So a 39 typed here and a 39
    plotted there cannot disagree about how serious it is.

    Not `error`: that draws a red ring and means "this cannot be saved". A
    fever is not a typing mistake. The number goes red and says what it is;
    the field stays a field.
  */
  const error = readingError(field, value);
  const status = error == null ? readingStatus(field, value) : null;
  const ink =
    status == null || status.tone === "normal"
      ? undefined
      : status.tone === "alert"
        ? DANGER
        : WARNING;

  const unit = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
      {ink != null && (
        <Text style={{ fontSize: 12, fontWeight: "600", color: ink }}>
          {status?.label}
        </Text>
      )}
      <Text style={{ fontSize: 14, color: TEXT_MUTED }}>{field.unit}</Text>
    </View>
  );

  /*
    A pressure is one box, typed straight through as "120/80".

    It was two boxes for a while, to keep a real number pad — a slash needs
    the punctuation keyboard — but one field the carer types the whole
    reading into, slash and all, is what a carer expects and what they were
    asking for. So the box takes both numbers and the slash, on the
    numbers-and-punctuation keyboard; every other reading keeps its number
    pad. The `/` is the one non-digit it will take, and the field stores and
    validates exactly what is shown.
  */
  return (
    <TextField
      label={bare === true ? "" : field.label}
      value={value}
      onChangeText={
        // A pressure keeps only digits and the one slash; the rest of the
        // punctuation keyboard is not wanted, just its digits and "/".
        field.pair === true
          ? (v) => onChange(v.replace(/[^0-9/]/g, ""))
          : onChange
      }
      keyboardType={
        field.pair === true
          ? "numbers-and-punctuation"
          : field.keyboard === "decimal"
            ? "decimal-pad"
            : "number-pad"
      }
      placeholder={field.hint}
      ink={ink}
      // The ring alone says it: on a tile this narrow the sentence under
      // the box wraps to three lines and pushes the next reading down the
      // page. The save button stays off while any reading is impossible,
      // and says so there instead.
      error={error != null ? "" : null}
      // "120/80" is seven; a single reading is at most five.
      maxLength={field.pair === true ? 7 : 5}
      trailing={unit}
    />
  );
}

/**
 * One group's readings, laid out as the group says.
 *
 * A row with one reading in it takes the whole width; a row with two
 * shares it. Nothing here decides which is which — the group does.
 */
function ReadingGrid({
  rows,
  values,
  onChange,
}: {
  rows: string[][];
  values: Record<string, string>;
  onChange: (key: string, v: string) => void;
}) {
  return (
    <View style={{ gap: SPACE.lg }}>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: "row", gap: SPACE.md }}>
          {row.map((key) => {
            const f = SCREENING_FIELDS.find((x) => x.key === key);
            if (f == null) return null;
            return (
              <View key={key} style={{ flex: 1 }}>
                <Reading field={f} value={values[key] ?? ""} onChange={(v) => onChange(key, v)} />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** A card's heading: a round mark and the section's name. */
function SectionHead({ icon, label }: { icon: "vital" | "note" | "body" | "lab"; label: string }) {
  const glyph =
    icon === "vital" ? (
      <Activity size={13} color={PRIMARY_500} strokeWidth={2.4} />
    ) : icon === "lab" ? (
      <Droplet size={13} color={PRIMARY_500} strokeWidth={2.4} />
    ) : icon === "body" ? (
      <Ruler size={13} color={PRIMARY_500} strokeWidth={2.4} />
    ) : (
      <FileText size={13} color={PRIMARY_500} strokeWidth={2.4} />
    );
  return <CardHeading icon={glyph} title={label} />;
}

