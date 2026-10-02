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
import { CheckBox } from "../components/CheckBox";
import { ChoiceChip } from "../components/ChoiceChip";
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
import { childHolder, PostnatalForm, postnatalFilled } from "../components/PostnatalForm";
import { childrenOf, residentById } from "../models/household";
import { givenNameOf, useSession } from "../models/session";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { tr } from "../i18n";
import { FORM_MAX, readable, GUTTER } from "../theme/layout";
import type { RootStackParamList } from "../navigation/RootStack";
import { feel } from "../utils/haptics";
import {
  ADHERENCE,
  DEPENDENCY,
  HOME_CHECKS,
  POSTNATAL,
  VISIT_KINDS,
  homeVisitLabel,
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
  SURFACE,
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
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const me = useSession();

  /* Opened on whatever this visit already holds — see the screening form. */
  const was = useState(() => recordOf(holder.authenCode, "homevisit"))[0];

  /*
    The postnatal visit is offered only where it can apply: to a woman, or
    to a newborn the registry knows the mother of. A mother's page links
    through to each of her newborns' own records, so the one visit to the
    house records both.
  */
  const person = holder.residentId != null ? residentById(holder.residentId) : undefined;
  const newborn = person?.motherId != null;
  const female = /หญิง|female|^ญ/i.test(holder.gender);
  const kinds = VISIT_KINDS.filter((k) => k !== POSTNATAL || female || newborn);
  const mother = newborn ? residentById(person?.motherId ?? "") : undefined;
  const babies =
    person != null && !newborn
      ? childrenOf(person.id).map((c) => ({ resident: c, holder: childHolder(holder, c) }))
      : [];
  const [pp, setPp] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(was).filter(([k]) => k.startsWith("pp_"))),
  );
  const setP = (key: string, value: string) => setPp((had) => ({ ...had, [key]: value }));
  const [kind, setKind] = useState<string | null>(
    // The appointment's own type, where the record has none yet: the plan
    // already says what kind of visit this is.
    was.kind || holder.visitType || null,
  );
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
    toast(tr(`ใช้เทมเพลต "${t.name}" แล้ว`, `Applied template "${t.name}"`), "success");
  };

  const toggle = (key: string) =>
    setChecks((wasChecks) => ({ ...wasChecks, [key]: !(wasChecks[key] ?? false) }));

  const addPhoto = () => {
    const shoot = async (fromCamera: boolean) => {
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toast(
          fromCamera
            ? tr("ต้องอนุญาตให้ใช้กล้องก่อน", "Allow camera access first")
            : tr("ต้องอนุญาตให้เข้าคลังภาพก่อน", "Allow photo library access first"),
          "error",
        );
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
      toast(
        tr(
          `เพิ่มรูป ${shot.assets.length} รูปแล้ว`,
          `Added ${shot.assets.length} photo${shot.assets.length === 1 ? "" : "s"}`,
        ),
        "success",
      );
    };

    Alert.alert(tr("เพิ่มรูปภาพ", "Add photos"), undefined, [
      { text: tr("ถ่ายภาพ", "Take photo"), onPress: () => void shoot(true) },
      { text: tr("เลือกจากคลังภาพ", "Choose from library"), onPress: () => void shoot(false) },
      { text: tr("ยกเลิก", "Cancel"), style: "cancel" as const },
    ]);
  };

  /** How much of the visit has actually been written down. */
  const filled =
    postnatalFilled(pp) +
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
        title={tr("บันทึกเยี่ยมบ้านผู้ป่วย", "Home visit record")}
        right={
          <ToolbarPill
            slots={[
              {
                icon: <UIcon name="sparkles" size={20} color={TEXT_PRIMARY} />,
                label: tr("ผู้ช่วยบันทึกการเยี่ยม", "Visit scribe"),
                onPress: () => setScribe("open"),
              },
              {
                icon: <FileText size={20} color={TEXT_PRIMARY} strokeWidth={2.2} />,
                label: tr("เทมเพลตบันทึกการเยี่ยม", "Visit note templates"),
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
              paddingHorizontal: GUTTER,  // The page's margin, as the header's, not the design's fixed 16.
              // Room under the assistant's floating card, while there is one.
              paddingTop: HEADER_FADE + inset,
              paddingBottom: insets.bottom + 120,
              gap: D.pad,
              // A form: a centred column on a tablet.
              ...readable(FORM_MAX),
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <Card style={{ gap: SPACE.lg }}>
              <Head Icon={Stethoscope} label={tr("การเยี่ยมครั้งนี้", "This visit")} />
              <Choose
                label={tr("ประเภทการเยี่ยม", "Visit type")}
                options={kinds}
                labelOf={homeVisitLabel}
                value={kind}
                onChange={(k) => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setKind(k);
                }}
              />
              {kind !== POSTNATAL && (
                <Choose
                  label={tr("ภาวะพึ่งพิง", "Dependency")}
                  options={DEPENDENCY}
                  labelOf={homeVisitLabel}
                  value={dependency}
                  onChange={setDependency}
                />
              )}
            </Card>

            {/* A postnatal visit records what HOSxP's postnatal forms do,
                and only that — in place of the general sections below. */}
            {kind === POSTNATAL ? (
              <PostnatalForm
                who={newborn ? "baby" : "mother"}
                pp={pp}
                set={setP}
                visitor={givenNameOf(me.displayName) || me.displayName}
                babies={babies}
                mother={mother}
                onOpenChild={(h) => nav.push("HomeVisit", { holder: h })}
              />
            ) : (
            <>

            <Card style={{ gap: SPACE.lg }}>
              <Head Icon={House} label={tr("สภาพบ้านและผู้ดูแล", "Home and caregiver")} />
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
                label={tr("ผู้ดูแลหลัก", "Main caregiver")}
                value={caregiver}
                onChangeText={setCaregiver}
                placeholder={tr("สมหญิง ใจดี (บุตรสาว)", "สมหญิง ใจดี (daughter)")}
              />
            </Card>

            <Card style={{ gap: SPACE.lg }}>
              <Head Icon={FileText} label={tr("การซักประวัติ", "History")} />
              <NoteField
                label={tr("ประวัติและอาการ", "History and symptoms")}
                value={history}
                onChangeText={setHistory}
                placeholder={tr(
                  "อาการที่เป็น ระยะเวลา โรคประจำตัว และยาที่ใช้อยู่",
                  "Symptoms, duration, chronic conditions and current medications",
                )}
              />
              <Choose
                label={tr("ความสม่ำเสมอในการกินยา", "Medication adherence")}
                options={ADHERENCE}
                labelOf={homeVisitLabel}
                value={adherence}
                onChange={setAdherence}
              />
            </Card>

            <Card style={{ gap: SPACE.lg }}>
              <Head Icon={Stethoscope} label={tr("การตรวจร่างกายเบื้องต้น", "Physical examination")} />
              <NoteField
                label={tr("สิ่งที่ตรวจพบ", "Findings")}
                value={exam}
                onChangeText={setExam}
                placeholder={tr(
                  "สัญญาณชีพ ผิวหนัง แผล การเคลื่อนไหว และการช่วยเหลือตนเอง",
                  "Vital signs, skin, wounds, mobility and self-care",
                )}
              />
            </Card>

            <Card style={{ gap: SPACE.lg }}>
              <Head
                Icon={HeartHandshake}
                label={tr("การประเมินด้านจิตใจและสังคม", "Psychosocial assessment")}
              />
              <NoteField
                label={tr("สภาพจิตใจและสังคม", "Mental and social wellbeing")}
                value={psychosocial}
                onChangeText={setPsychosocial}
                placeholder={tr(
                  "อารมณ์ การนอน ความสัมพันธ์ในครอบครัว และการเข้าถึงบริการ",
                  "Mood, sleep, family relationships and access to services",
                )}
              />
            </Card>

            <Card style={{ gap: SPACE.lg }}>
              <Head Icon={TriangleAlert} label={tr("ปัญหาที่พบ", "Problems found")} />
              <NoteField
                label={tr("ปัญหาที่พบระหว่างเยี่ยม", "Problems found during the visit")}
                value={problems}
                onChangeText={setProblems}
                placeholder={tr(
                  "พื้นห้องน้ำลื่น ไม่มีราวจับ และไม่มีคนดูแลช่วงกลางวัน",
                  "Slippery bathroom floor, no grab bar, no one to help during the day",
                )}
              />
            </Card>

            <Card style={{ gap: SPACE.lg }}>
              <Head Icon={Check} label={tr("แผนการดูแล", "Care plan")} />
              <NoteField
                label={tr("สิ่งที่จะทำต่อ", "Next steps")}
                value={plan}
                onChangeText={setPlan}
                placeholder={tr(
                  "สิ่งที่ต้องจัดการ ผู้รับผิดชอบ และกำหนดติดตามครั้งถัดไป",
                  "What needs doing, who is responsible, and when to follow up",
                )}
              />
            </Card>

            <Card style={{ gap: SPACE.lg }}>
              <Head Icon={FileText} label={tr("การให้ความรู้และข้อแนะนำ", "Education and advice")} />
              <NoteField
                label={tr("สิ่งที่แนะนำผู้ป่วยและผู้ดูแล", "Advice to patient and caregiver")}
                value={advice}
                onChangeText={setAdvice}
                placeholder={tr(
                  "วิธีดูแลตนเอง สิ่งที่ต้องระวัง และเมื่อไรควรมาพบแพทย์",
                  "Self-care, what to watch for, and when to see a doctor",
                )}
              />
            </Card>

            <Card style={{ gap: SPACE.lg }}>
              <Head Icon={FileText} label={tr("สรุปผลการเยี่ยม", "Visit summary")} />
              <NoteField
                label={tr("สรุป", "Summary")}
                value={summary}
                onChangeText={setSummary}
                placeholder={tr(
                  "ภาพรวมของการเยี่ยมครั้งนี้และสิ่งที่ต้องติดตาม",
                  "Overview of this visit and what to follow up",
                )}
              />
            </Card>
            </>
            )}

            {/* The photographs. A home visit's evidence is the room, the
                wound, the pill box — things a sentence describes badly. */}
            <Card style={{ gap: SPACE.lg }}>
              <Head
                Icon={Camera}
                label={tr("รูปภาพ", "Photos")}
                note={`${photos.length}/${PHOTO_LIMIT}`}
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
                {photos.map((uri, i) => (
                  <View key={uri}>
                    <Pressable
                      onPress={() => setViewing(i)}
                      accessibilityRole="imagebutton"
                      accessibilityLabel={tr("ดูรูปเต็ม", "View full photo")}
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
                      onPress={() => {
                        setPhotos((had) => had.filter((u) => u !== uri));
                        toast(tr("ลบรูปแล้ว", "Photo removed"), "success");
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={tr("ลบรูปนี้", "Remove this photo")}
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
                      {/* The disc is drawn in the ink colour, so the
                          cross is drawn in the page's — the two swap
                          places when the ground does. */}
                      <X size={14} color={SURFACE} strokeWidth={3} />
                    </Pressable>
                  </View>
                ))}
                {photos.length < PHOTO_LIMIT && (
                  <Pressable
                    onPress={addPhoto}
                    accessibilityRole="button"
                    accessibilityLabel={tr("เพิ่มรูปภาพ", "Add photos")}
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
              <Head Icon={Check} label={tr("ลายเซ็นผู้ป่วย", "Patient signature")} />
              <SignatureField value={signature} onChange={setSignature} />
            </Card>
          </ScrollView>
        </HeaderFade>
      </KeyboardAvoidingView>

      <PhotoViewer photos={photos} index={viewing} onClose={() => setViewing(null)} />

      <PickSheet
        visible={templating}
        title={tr("เทมเพลตบันทึกการเยี่ยม", "Visit note templates")}
        placeholder={tr("ค้นหาเทมเพลต", "Search templates")}
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
        patient={tr(`คุณ ${holder.name}`, holder.name)}
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
          toast(
            tr(
              "เติมข้อมูลจากการสนทนาแล้ว — ตรวจสอบและแก้ไขได้",
              "Filled in from the conversation — review and edit as needed",
            ),
            "success",
          );
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
          label={tr("บันทึก", "Save")}
          disabled={filled === 0}
          onPress={() => {
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
              ...pp,
            });
            toast(tr("บันทึกข้อมูลแล้ว", "Saved"), "success");
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
  labelOf = (o) => o,
}: {
  label: string;
  options: readonly string[];
  value: string | null;
  onChange: (v: string | null) => void;
  /**
   * How an option is shown. The value stays the Thai word the record,
   * the scribe's draft and the templates all save — see `homeVisitLabel`.
   */
  labelOf?: (o: string) => string;
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
            <ChoiceChip
              key={o}
              label={labelOf(o)}
              on={on}
              onPress={() => onChange(on ? null : o)}
            />
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
      onPress={() => {
        feel("tick");
        onPress();
      }}
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
      <CheckBox on={on} />
      <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: TEXT_PRIMARY }}>
        {label}
      </Text>
    </Pressable>
  );
}
