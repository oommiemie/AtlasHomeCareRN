import { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  LayoutAnimation,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import {
  Camera,
  Check,
  FileText,
  HeartHandshake,
  House,
  Plus,
  Stethoscope,
  TriangleAlert,
  X,
} from "lucide-react-native";

import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { Card } from "../components/Card";
import { NoteField, TextField } from "../components/FormField";
import { GlassIconButton } from "../components/GlassIconButton";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { CardHeading } from "../components/CardAction";
import { PhotoViewer } from "../components/PhotoViewer";
import { SignatureField } from "../components/SignatureField";
import { toast } from "../components/Toast";
import { VisitScribeSheet } from "../components/VisitScribeSheet";
import { PickSheet } from "../components/PickSheet";
import { ToolbarPill } from "../components/ToolbarPill";
import { UIcon } from "../components/UIcon";
import { searchTemplates, type VisitTemplate } from "../models/visitTemplates";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  ADHERENCE,
  DEPENDENCY,
  HOME_CHECKS,
  VISIT_KINDS,
  recordOf,
  saveTask,
} from "../models/community";
import {
  GROUPED_BG,
  PRIMARY_100,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";

/** The screening form's measurements, so the two read as one pair. */
const D = { pad: 16, photo: 96 } as const;

/** How many photographs a visit may carry. */
const PHOTO_LIMIT = 10;

/**
 * "บันทึกเยี่ยมบ้านผู้ป่วย" — the round itself, written down.
 *
 * Built on the screening form's frame, because a carer moves between the
 * two in the same visit and a second layout to learn is a second thing to
 * get wrong. The sections are the ones a home-visit record has to carry, in
 * the order the visit happens in: who and why, what the house is like, the
 * history, the examination, the mind and the household around it, what was
 * wrong, what will be done, what was said, and the summary — then the
 * photographs and the patient's signature that close it.
 *
 * Almost all of the front half is chosen rather than typed. Standing in
 * someone's front room with a phone in one hand is the worst possible place
 * to compose sentences; the long boxes are for afterwards, and the
 * assistant in the header is for not having to write them at all.
 *
 * Nothing is required: a round is taken in whatever order the day allows,
 * and a form that refuses to save until it is complete is a form that gets
 * completed with noughts.
 */
export function HomeVisitScreen() {
  const { holder } =
    useRoute<RouteProp<RootStackParamList, "HomeVisit">>().params;
  const insets = useSafeAreaInsets();
  const nav = useNavigation();

  /* Opened on whatever this visit already holds — see the screening form. */
  const was = useState(() => recordOf(holder.authenCode, "homevisit"))[0];
  const [kind, setKind] = useState<string | null>(was.kind || null);
  const [dependency, setDependency] = useState<string | null>(was.dependency || null);
  const [adherence, setAdherence] = useState<string | null>(was.adherence || null);
  const [checks, setChecks] = useState<Record<string, boolean>>(() => {
    const ticked = (was.checks ?? "").split(",").filter(Boolean);
    return Object.fromEntries(ticked.map((k) => [k, true]));
  });
  const [caregiver, setCaregiver] = useState(was.caregiver ?? "");
  const [history, setHistory] = useState(was.history ?? "");
  const [exam, setExam] = useState(was.exam ?? "");
  const [psychosocial, setPsychosocial] = useState(was.psychosocial ?? "");
  const [problems, setProblems] = useState(was.problems ?? "");
  const [plan, setPlan] = useState(was.plan ?? "");
  const [advice, setAdvice] = useState(was.advice ?? "");
  const [summary, setSummary] = useState(was.summary ?? "");
  const [photos, setPhotos] = useState<string[]>(() =>
    (was.photos ?? "").split("|").filter(Boolean),
  );
  const [signature, setSignature] = useState<string[]>(() =>
    (was.signature ?? "").split("|").filter(Boolean),
  );
  /** Which photo is open full-screen; null when the viewer is closed. */
  const [viewing, setViewing] = useState<number | null>(null);
  /* The assistant: off, on screen, or folded away and still listening. */
  const [scribe, setScribe] = useState<"off" | "open" | "folded">("off");
  /* How far its floating question card pushes the form down. */
  const [inset, setInset] = useState(0);
  /* The template list, over the form. */
  const [templating, setTemplating] = useState(false);

  /**
   * Fill the note from a template.
   *
   * Everything typical, and nothing of this visit: the summary, the
   * photographs and the signature are left exactly as they are, because
   * they are what makes this note this visit's rather than any visit's.
   * Anything the carer has already written is kept too — a template is a
   * head start, not an overwrite.
   */
  const applyTemplate = (t: VisitTemplate) => {
    const f = t.fields;
    if (f.kind != null) setKind(f.kind);
    if (f.dependency != null) setDependency(f.dependency);
    if (f.adherence != null) setAdherence(f.adherence);
    if (f.checks != null) {
      setChecks(Object.fromEntries(f.checks.map((k) => [k, true])));
    }
    const fill = (value: string | undefined, current: string, put: (v: string) => void) => {
      if (value != null && current.trim() === "") put(value);
    };
    fill(f.caregiver, caregiver, setCaregiver);
    fill(f.history, history, setHistory);
    fill(f.exam, exam, setExam);
    fill(f.psychosocial, psychosocial, setPsychosocial);
    fill(f.problems, problems, setProblems);
    fill(f.plan, plan, setPlan);
    fill(f.advice, advice, setAdvice);
    setTemplating(false);
    toast(`ใช้เทมเพลต "${t.name}" แล้ว`, "success");
  };

  const toggle = (key: string) =>
    setChecks((wasChecks) => ({ ...wasChecks, [key]: !(wasChecks[key] ?? false) }));

  const addPhoto = () => {
    const shoot = async (fromCamera: boolean) => {
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toast(fromCamera ? "ต้องอนุญาตให้ใช้กล้องก่อน" : "ต้องอนุญาตให้เข้าคลังภาพก่อน");
        return;
      }
      const options: ImagePicker.ImagePickerOptions = { quality: 0.7 };
      const shot = fromCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync({
            ...options,
            // Enough to fill the remaining slots in one go, and no more.
            allowsMultipleSelection: true,
            selectionLimit: PHOTO_LIMIT - photos.length,
          });
      if (shot.canceled) return;
      setPhotos((had) =>
        [...had, ...shot.assets.map((a) => a.uri)].slice(0, PHOTO_LIMIT),
      );
    };

    Alert.alert("เพิ่มรูปภาพ", undefined, [
      { text: "ถ่ายภาพ", onPress: () => void shoot(true) },
      { text: "เลือกจากคลังภาพ", onPress: () => void shoot(false) },
      { text: "ยกเลิก", style: "cancel" as const },
    ]);
  };

  /** How much of the visit has actually been written down. */
  const filled =
    (kind != null ? 1 : 0) +
    (dependency != null ? 1 : 0) +
    (adherence != null ? 1 : 0) +
    Object.values(checks).filter(Boolean).length +
    [caregiver, history, exam, psychosocial, problems, plan, advice, summary].filter(
      (v) => v.trim().length > 0,
    ).length +
    photos.length +
    (signature.length > 0 ? 1 : 0);

  return (
    <View style={{ flex: 1 }}>
      {/* The assistant, in the header beside the title.

          It belongs to the whole form rather than to any one box — it
          listens to the visit and drafts seven of the sections at once —
          and it is the first thing a carer reaches for, before they have
          decided which box to start in. */}
      <ScreenHeader
        title="บันทึกเยี่ยมบ้านผู้ป่วย"
        right={
          <ToolbarPill
            slots={[
              {
                icon: <UIcon name="sparkles" size={20} color={TEXT_PRIMARY} />,
                label: "ผู้ช่วยบันทึกการเยี่ยม",
                onPress: () => setScribe("open"),
              },
              {
                icon: <FileText size={20} color={TEXT_PRIMARY} strokeWidth={2.2} />,
                label: "เทมเพลตบันทึกการเยี่ยม",
                onPress: () => setTemplating(true),
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
              // Room under the assistant's floating card, while there is one.
              paddingTop: HEADER_FADE + inset,
              paddingBottom: insets.bottom + 120,
              gap: D.pad,
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <Card style={{ gap: SPACE.lg }}>
              <Head Icon={Stethoscope} label="การเยี่ยมครั้งนี้" />
              <Choose
                label="ประเภทการเยี่ยม"
                options={VISIT_KINDS}
                value={kind}
                onChange={setKind}
              />
              <Choose
                label="ภาวะพึ่งพิง"
                options={DEPENDENCY}
                value={dependency}
                onChange={setDependency}
              />
            </Card>

            <Card style={{ gap: SPACE.lg }}>
              <Head Icon={House} label="สภาพบ้านและผู้ดูแล" />
              <View style={{ gap: 2 }}>
                {HOME_CHECKS.map((c) => (
                  <Tick
                    key={c.key}
                    label={c.label}
                    on={checks[c.key] ?? false}
                    onPress={() => toggle(c.key)}
                  />
                ))}
              </View>
              <TextField
                label="ผู้ดูแลหลัก"
                value={caregiver}
                onChangeText={setCaregiver}
                placeholder="สมหญิง ใจดี (บุตรสาว)"
              />
            </Card>

            <Card style={{ gap: SPACE.lg }}>
              <Head Icon={FileText} label="การซักประวัติ" />
              <NoteField
                label="ประวัติและอาการ"
                value={history}
                onChangeText={setHistory}
                placeholder="อาการที่เป็น ระยะเวลา โรคประจำตัว และยาที่ใช้อยู่"
              />
              <Choose
                label="ความสม่ำเสมอในการกินยา"
                options={ADHERENCE}
                value={adherence}
                onChange={setAdherence}
              />
            </Card>

            <Card style={{ gap: SPACE.lg }}>
              <Head Icon={Stethoscope} label="การตรวจร่างกายเบื้องต้น" />
              <NoteField
                label="สิ่งที่ตรวจพบ"
                value={exam}
                onChangeText={setExam}
                placeholder="สัญญาณชีพ ผิวหนัง แผล การเคลื่อนไหว และการช่วยเหลือตนเอง"
              />
            </Card>

            <Card style={{ gap: SPACE.lg }}>
              <Head Icon={HeartHandshake} label="การประเมินด้านจิตใจและสังคม" />
              <NoteField
                label="สภาพจิตใจและสังคม"
                value={psychosocial}
                onChangeText={setPsychosocial}
                placeholder="อารมณ์ การนอน ความสัมพันธ์ในครอบครัว และการเข้าถึงบริการ"
              />
            </Card>

            <Card style={{ gap: SPACE.lg }}>
              <Head Icon={TriangleAlert} label="ปัญหาที่พบ" />
              <NoteField
                label="ปัญหาที่พบระหว่างเยี่ยม"
                value={problems}
                onChangeText={setProblems}
                placeholder="พื้นห้องน้ำลื่น ไม่มีราวจับ และไม่มีคนดูแลช่วงกลางวัน"
              />
            </Card>

            <Card style={{ gap: SPACE.lg }}>
              <Head Icon={Check} label="แผนการดูแล" />
              <NoteField
                label="สิ่งที่จะทำต่อ"
                value={plan}
                onChangeText={setPlan}
                placeholder="สิ่งที่ต้องจัดการ ผู้รับผิดชอบ และกำหนดติดตามครั้งถัดไป"
              />
            </Card>

            <Card style={{ gap: SPACE.lg }}>
              <Head Icon={FileText} label="การให้ความรู้และข้อแนะนำ" />
              <NoteField
                label="สิ่งที่แนะนำผู้ป่วยและผู้ดูแล"
                value={advice}
                onChangeText={setAdvice}
                placeholder="วิธีดูแลตนเอง สิ่งที่ต้องระวัง และเมื่อไรควรมาพบแพทย์"
              />
            </Card>

            <Card style={{ gap: SPACE.lg }}>
              <Head Icon={FileText} label="สรุปผลการเยี่ยม" />
              <NoteField
                label="สรุป"
                value={summary}
                onChangeText={setSummary}
                placeholder="ภาพรวมของการเยี่ยมครั้งนี้และสิ่งที่ต้องติดตาม"
              />
            </Card>

            {/* The photographs. A home visit's evidence is the room, the
                wound, the pill box — things a sentence describes badly. */}
            <Card style={{ gap: SPACE.lg }}>
              <Head
                Icon={Camera}
                label="รูปภาพ"
                note={`${photos.length}/${PHOTO_LIMIT}`}
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
                {photos.map((uri, i) => (
                  <View key={uri}>
                    <Pressable
                      onPress={() => setViewing(i)}
                      accessibilityRole="imagebutton"
                      accessibilityLabel="ดูรูปเต็ม"
                    >
                      <Image
                        source={{ uri }}
                        style={{
                          width: D.photo,
                          height: D.photo,
                          borderRadius: RADIUS.md,
                          backgroundColor: GROUPED_BG,
                        }}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => setPhotos((had) => had.filter((u) => u !== uri))}
                      accessibilityRole="button"
                      accessibilityLabel="ลบรูปนี้"
                      hitSlop={8}
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: TEXT_PRIMARY,
                      }}
                    >
                      <X size={14} color="#FFFFFF" strokeWidth={3} />
                    </Pressable>
                  </View>
                ))}
                {photos.length < PHOTO_LIMIT && (
                  <Pressable
                    onPress={addPhoto}
                    accessibilityRole="button"
                    accessibilityLabel="เพิ่มรูปภาพ"
                    style={({ pressed }) => ({
                      width: D.photo,
                      height: D.photo,
                      borderRadius: RADIUS.md,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: pressed ? PRIMARY_100 : GROUPED_BG,
                      borderWidth: 1,
                      borderColor: SEPARATOR,
                    })}
                  >
                    <Plus size={22} color={PRIMARY_500} strokeWidth={2.4} />
                  </Pressable>
                )}
              </View>
            </Card>

            <Card style={{ gap: SPACE.lg }}>
              <Head Icon={Check} label="ลายเซ็นผู้ป่วย" />
              <SignatureField value={signature} onChange={setSignature} />
            </Card>
          </ScrollView>
        </HeaderFade>
      </KeyboardAvoidingView>

      <PhotoViewer photos={photos} index={viewing} onClose={() => setViewing(null)} />

      <PickSheet
        visible={templating}
        title="เทมเพลตบันทึกการเยี่ยม"
        placeholder="ค้นหาเทมเพลต"
        rows={(q) =>
          searchTemplates(q).map((t) => ({
            key: t.id,
            title: t.name,
            sub: t.detail,
            pick: () => applyTemplate(t),
          }))
        }
        onClose={() => setTemplating(false)}
      />

      <VisitScribeSheet
        authenCode={holder.authenCode}
        patient={`คุณ ${holder.name}`}
        active={scribe !== "off"}
        shown={scribe === "open"}
        onHide={() => setScribe("folded")}
        onInset={(px) => {
          // Eased rather than jumped: the form slides down to make the room
          // and back up when the card goes, instead of snapping.
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setInset(px);
        }}
        onShow={() => setScribe("open")}
        onEnd={() => setScribe("off")}
        // Merged over what is there, and only where the draft has something
        // to say: a draft that blanked a box the carer had already written
        // in would be the assistant deleting their work.
        onFill={(draft) => {
          if (draft.kind) setKind(draft.kind);
          if (draft.dependency) setDependency(draft.dependency);
          if (draft.adherence) setAdherence(draft.adherence);
          if (draft.caregiver) setCaregiver(draft.caregiver);
          if (draft.history) setHistory(draft.history);
          if (draft.exam) setExam(draft.exam);
          if (draft.psychosocial) setPsychosocial(draft.psychosocial);
          if (draft.problems) setProblems(draft.problems);
          if (draft.plan) setPlan(draft.plan);
          if (draft.advice) setAdvice(draft.advice);
          if (draft.summary) setSummary(draft.summary);
          toast("เติมข้อมูลจากการสนทนาแล้ว — ตรวจสอบและแก้ไขได้");
        }}
      />

      {/* Off until there is something to put in it — the screening form's
          rule, for the same reason: a button that looks live, isn't, and
          says so only after the tap is a button that lied.

          And gone altogether while the assistant is folded: its voice bar
          takes this slot, and the form is saved once the draft is in. */}
      {scribe !== "folded" && (
      <ActionBar>
        <PrimaryAction
          label={filled > 0 ? "บันทึก" : "ยังไม่มีข้อมูลให้บันทึก"}
          disabled={filled === 0}
          onPress={() => {
            toast("บันทึกข้อมูลแล้ว", "success");
            saveTask(holder.authenCode, "homevisit", {
              kind: kind ?? "",
              dependency: dependency ?? "",
              adherence: adherence ?? "",
              checks: Object.entries(checks)
                .filter(([, on]) => on)
                .map(([k]) => k)
                .join(","),
              caregiver,
              history,
              exam,
              psychosocial,
              problems,
              plan,
              advice,
              summary,
              photos: photos.join("|"),
              signature: signature.join("|"),
            });
            nav.goBack();
          }}
        />
      </ActionBar>
      )}
    </View>
  );
}

/** A card's title, over its rule — the screening form's own. */
function Head({
  Icon,
  label,
  note,
}: {
  Icon: typeof Stethoscope;
  label: string;
  /** A count at the far end, where one is worth saying. */
  note?: string;
}) {
  return (
    <CardHeading
      icon={<Icon size={13} color={PRIMARY_500} strokeWidth={2.4} />}
      title={label}
      note={note}
    />
  );
}

/**
 * One of a few — as capsules on a line, not a picker.
 *
 * Three options are three things to read; a picker hides two of them behind
 * a tap and tells the carer nothing until they open it. Tapping the chosen
 * one again clears it, because a question answered by accident on a form
 * with no required fields should be as easy to unsay.
 */
function Choose({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <View style={{ gap: SPACE.sm }}>
      <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>
        {label}
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
              accessibilityLabel={o}
              style={{
                paddingHorizontal: SPACE.lg,
                paddingVertical: 9,
                borderRadius: RADIUS.capsule,
                backgroundColor: on ? PRIMARY_500 : GROUPED_BG,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  lineHeight: 20,
                  fontWeight: on ? "600" : "400",
                  color: on ? "#FFFFFF" : TEXT_PRIMARY,
                }}
              >
                {o}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** One thing about the house that is either so or not. */
function Tick({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.md,
        paddingVertical: 11,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 7,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: on ? PRIMARY_500 : "transparent",
          borderWidth: on ? 0 : 1.5,
          borderColor: "#C7C7CC",
        }}
      >
        {on && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
      </View>
      <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: TEXT_PRIMARY }}>
        {label}
      </Text>
    </Pressable>
  );
}
