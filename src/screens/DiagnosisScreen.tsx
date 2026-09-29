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
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ClipboardList,
  FileText,
  HeartPulse,
  History,
  MapPin,
  Plus,
  ShieldPlus,
  Stethoscope,
  Syringe,
  UserRound,
  X,
} from "lucide-react-native";

import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { BlurStage } from "../components/BlurStage";
import { Card } from "../components/Card";
import { NoteField } from "../components/FormField";
import { CardAction, CardHeading } from "../components/CardAction";
import { DxAiSheet } from "../components/DxAiSheet";
import { ToolbarPill } from "../components/ToolbarPill";
import { UIcon } from "../components/UIcon";
import { ProcedureSheet, newProcedure } from "../components/ProcedureSheet";
import { DxSheet, newDiagnosis } from "../components/DxSheet";
import { ChoiceChip } from "../components/ChoiceChip";
import { GlassIconButton } from "../components/GlassIconButton";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { PickSheet } from "../components/PickSheet";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import { recordOf, saveTask, treatmentHistory } from "../models/community";
import {
  CONDITION_CODES,
  DX_TYPES,
  dxText,
  icdName,
  icdOf,
  type Diagnosis,
  type DxType,
} from "../models/icd10";
import { searchPp, type PpLine } from "../models/ppCodes";
import { PROCEDURES, durationOf, type ProcedureLine } from "../models/procedures";
import type { DxSuggestion } from "../models/diagnosisAi";
import { currentSession } from "../models/session";
import { thaiTime } from "../utils/thaiDate";
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
import { FORM_MAX, readable, GUTTER } from "../theme/layout";
import { locale, tr } from "../i18n";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const typeLabel = (t: DxType) => DX_TYPES.find((d) => d.code === t)?.short ?? t;

/*
  The Thai is the value saved on the record — it goes up with the visit —
  so it stays Thai in both languages and is translated only on the chip.
*/
const PLACES = ["นอกสถานบริการ", "ในสถานบริการ"] as const;
const placeLabel = (p: (typeof PLACES)[number]) =>
  p === "นอกสถานบริการ"
    ? tr("นอกสถานบริการ", "Outside the facility")
    : tr("ในสถานบริการ", "At the facility");

/** Who signs the record: the account this phone is signed in as. */
const signedBy = () => {
  const me = currentSession();
  return me.displayName !== "" ? me.displayName : me.providerId;
};

/**
 * "วินิจฉัยโรค" — the clinical note of the visit, in the order it is taken.
 *
 * What the patient came with and for how long; the history of it; where
 * the visit happened; what was concluded, coded off the ICD-10 list with
 * the principal one marked; what was done to them, coded off ICD-9-CM;
 * and the prevention work the visit gets to claim. Each is its own card,
 * and none but the conclusion is required — a visit that only dressed a
 * wound is still a visit.
 */
export function DiagnosisScreen() {
  const { holder } = useRoute<RouteProp<RootStackParamList, "Diagnosis">>().params;
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();

  // Reopen on what was written, if anything was; else on what the
  // screening already took down as the complaint.
  const was = recordOf(holder.authenCode, "diagnosis");
  const screening = recordOf(holder.authenCode, "screening");
  const parse = <T,>(raw: string | undefined, fallback: T): T => {
    try {
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      // Deferred: this runs inside a state initialiser, mid-render.
      setTimeout(() => toast(
            tr(
              "อ่านบันทึกเดิมไม่ได้ บางรายการอาจหายไป",
              "Couldn't read the saved record; some entries may be missing",
            ),
            "warning",
          ), 0);
      return fallback;
    }
  };

  // The complaint and the history belong to the screening form, which is
  // where the visit takes them; this page only reads them, for the draft.
  const complaint = screening.complaint ?? "";
  const hpi = screening.hpi ?? "";
  const [place, setPlace] = useState<(typeof PLACES)[number]>(was.place === PLACES[1] ? PLACES[1] : PLACES[0]);
  // Written diagnoses, as a list. A record saved before this was a list
  // holds one line; it becomes the first item.
  const [dxTexts, setDxTexts] = useState<string[]>(() => {
    const many = parse<string[] | null>(was.dxTexts, null);
    if (many != null) return many;
    const one = (was.dxText ?? "").trim();
    return one === "" ? [] : [one];
  });
  // Which entry the writing sheet is on: an index, or -1 for a new one.
  const [writing, setWriting] = useState<number | null>(null);
  const [dx, setDx] = useState<Diagnosis[]>(() => parse<Diagnosis[]>(was.dx, []));
  const [procedures, setProcedures] = useState<ProcedureLine[]>(() => parse<ProcedureLine[]>(was.procedures, []));
  const [pp, setPp] = useState<PpLine[]>(() => parse<PpLine[]>(was.pp, []));

  const [picking, setPicking] = useState<"pp" | null>(null);
  /* The assistant's draft of this note, over the page. */
  const [drafting, setDrafting] = useState(false);

  /**
   * Take the assistant's draft into the form.
   *
   * Written text is never overwritten — a draft fills what is still empty
   * — and every list only gains what it does not already hold, so applying
   * twice does not double anything. What lands is an ordinary entry: it
   * can be edited or removed like any other.
   *
   * The complaint and the history it drafts go back to the screening form,
   * which is where the visit keeps them.
   */
  const applyDraft = (d: DxSuggestion) => {
    const fresh =
      (complaint.trim() === "" && d.complaint !== "") ||
      (hpi.trim() === "" && d.hpi !== "") ||
      d.dxTexts.some((t) => !dxTexts.includes(t)) ||
      d.icd10.some((n) => !dx.some((x) => x.code === n.code)) ||
      d.icd9.some((n) => !procedures.some((x) => x.icd9 === n.code)) ||
      d.pp.some((n) => !pp.some((x) => x.code === n.code));
    if ((complaint.trim() === "" && d.complaint !== "") || (hpi.trim() === "" && d.hpi !== "")) {
      const now = recordOf(holder.authenCode, "screening");
      saveTask(holder.authenCode, "screening", {
        ...now,
        complaint: complaint.trim() === "" ? d.complaint : complaint,
        hpi: hpi.trim() === "" ? d.hpi : hpi,
      });
    }
    if (d.dxTexts.length > 0) {
      setDxTexts((cur) => [...cur, ...d.dxTexts.filter((t) => !cur.includes(t))]);
    }
    if (d.icd10.length > 0) {
      setDx((cur) => [...cur, ...d.icd10.filter((n) => !cur.some((x) => x.code === n.code))]);
    }
    if (d.icd9.length > 0) {
      const now = new Date().toISOString();
      setProcedures((cur) => [
        ...cur,
        ...d.icd9
          .filter((n) => !cur.some((x) => x.icd9 === n.code))
          .map((n) => {
            const item = PROCEDURES.find((x) => x.icd9 === n.code);
            return {
              ...newProcedure(signedBy()),
              id: `${Date.now()}-${Math.floor(Math.random() * 1e4)}-${n.code}`,
              code: item?.code ?? "",
              name: n.name,
              price: item?.price ?? 0,
              icd9: n.code,
              start: now,
              end: now,
            };
          }),
      ]);
    }
    if (d.pp.length > 0) {
      setPp((cur) => [...cur, ...d.pp.filter((n) => !cur.some((x) => x.code === n.code))]);
    }
    setDrafting(false);
    if (fresh)
      toast(
        tr(
          "นำร่างมาใส่ในบันทึกแล้ว ตรวจสอบและแก้ไขได้",
          "Draft added to the record. Review and edit as needed.",
        ),
        "success",
      );
    else toast(tr("ร่างนี้ไม่มีข้อมูลใหม่", "This draft has nothing new"), "info");
  };
  // The diagnosis being written, and whether it is already on the list.
  const [dxDraft, setDxDraft] = useState<{ value: Diagnosis; at: number } | null>(null);
  // The procedure being written, and whether it is already on the list.
  const [proc, setProc] = useState<{ line: ProcedureLine; editing: boolean } | null>(null);

  // The conditions on the card not yet on the list, as one-tap adds.
  const suggested = useMemo(
    () =>
      (holder.conditions ?? [])
        .map((c) => ({ name: c, code: CONDITION_CODES[c] }))
        .filter((s) => s.code != null && !dx.some((d) => d.code === s.code)),
    [holder.conditions, dx],
  );

  const add = (d: Diagnosis) => {
    if (d.code !== "" && dx.some((x) => x.code === d.code)) {
      toast(tr("มีการวินิจฉัยนี้อยู่แล้ว", "This diagnosis is already listed"), "warning");
      return;
    }
    setDx((cur) => [...cur, d]);
    toast(
      d.code !== ""
        ? tr(`เพิ่ม ${d.code} แล้ว`, `Added ${d.code}`)
        : tr("เพิ่มการวินิจฉัยแล้ว", "Diagnosis added"),
      "success",
    );
  };
  const remove = (i: number) => {
    setDx((cur) => cur.filter((_, j) => j !== i));
    toast(tr("ลบการวินิจฉัยแล้ว", "Diagnosis removed"), "success");
  };

  const principal = dx.find((d) => d.type === "1");
  const ready = dx.length > 0 || dxTexts.length > 0 || procedures.length > 0 || pp.length > 0;

  const save = () => {
    const first = principal ?? dx[0];
    const name = (d: Diagnosis) => (d.code ? `${d.code} ${d.text}` : d.text);
    saveTask(holder.authenCode, "diagnosis", {
      principal: first != null ? name(first) : (dxTexts[0] ?? ""),
      codes: dx.map((d) => d.code || d.text).join(", "),
      count: String(dx.length),
      dx: JSON.stringify(dx),
      place,
      dxText: dxTexts.join(" · "),
      dxTexts: JSON.stringify(dxTexts),
      procedures: JSON.stringify(procedures),
      procedureCount: String(procedures.length),
      pp: JSON.stringify(pp),
      ppCount: String(pp.length),
    });
    // Same condition as the card's "ยังไม่ได้ระบุโรคหลัก" line.
    if (dx.length > 0 && !principal)
      toast(
        tr("บันทึกแล้ว · ยังไม่ได้ระบุโรคหลัก", "Saved · No principal diagnosis set"),
        "warning",
      );
    else toast(tr("บันทึกการวินิจฉัยแล้ว", "Diagnosis saved"), "success");
    nav.goBack();
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title={tr("วินิจฉัยโรค", "Diagnosis")}
        right={
          <ToolbarPill
            slots={[
              {
                icon: <UIcon name="magicWand" size={20} color={TEXT_PRIMARY} />,
                label: tr("ร่างบันทึกด้วย AI", "Draft with AI"),
                onPress: () => setDrafting(true),
              },
            ]}
          />
        }
      />

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <HeaderFade from={0} to={HEADER_FADE}>
          <ScrollView
            contentContainerStyle={{
              ...readable(FORM_MAX),
              paddingHorizontal: GUTTER,
              paddingTop: HEADER_FADE,
              paddingBottom: insets.bottom + 100,
              gap: SPACE.md,
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {/* Where. */}
            <Card style={{ gap: SPACE.md }}>
              <CardHeading icon={<MapPin size={13} color={PRIMARY_500} strokeWidth={2.4} />} title={tr("สถานที่รับบริการ", "Place of service")} />
              {/* Chips, as every other either-or on the visit's forms is:
                  one always chosen, so tapping the chosen one leaves it. */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
                {PLACES.map((p) => (
                  <ChoiceChip key={p} label={placeLabel(p)} on={place === p} onPress={() => setPlace(p)} />
                ))}
              </View>
            </Card>

            {/* What was concluded, in words — written before it is coded,
                because that is the order it is thought in, and as many
                lines as the visit found. */}
            <Card style={{ gap: SPACE.md }}>
              <CardHeading
                icon={<FileText size={13} color={PRIMARY_500} strokeWidth={2.4} />}
                title={tr("คำวินิจฉัย (Diagnosis Text)", "Diagnosis text")}
                action={
                  <CardAction
                    icon={<Plus size={14} color="#FFFFFF" strokeWidth={2.8} />}
                    label={tr("เพิ่ม", "Add")}
                    onPress={() => setWriting(-1)}
                  />
                }
              />
              {dxTexts.length === 0 ? (
                <Text style={{ fontSize: 14, lineHeight: 21, color: TEXT_MUTED }}>
                  {tr("ยังไม่มีคำวินิจฉัยเป็นข้อความ", "No written diagnosis yet")}
                </Text>
              ) : (
                <View style={{ marginTop: -SPACE.sm, marginBottom: -SPACE.sm }}>
                  {dxTexts.map((t, i) => (
                    <ListRow
                      key={`${t}-${i}`}
                      first={i === 0}
                      title={t}
                      onPress={() => setWriting(i)}
                      onRemove={() => {
                        setDxTexts((cur) => cur.filter((_, j) => j !== i));
                        toast(tr("ลบคำวินิจฉัยแล้ว", "Diagnosis text removed"), "success");
                      }}
                    />
                  ))}
                </View>
              )}
            </Card>

            {/* And the same, coded. */}
            <Card style={{ gap: SPACE.md }}>
              <CardHeading
                icon={<Stethoscope size={13} color={PRIMARY_500} strokeWidth={2.4} />}
                title={tr("การวินิจฉัย (ICD-10)", "Diagnosis (ICD-10)")}
                action={
                  <CardAction
                    icon={<Plus size={14} color="#FFFFFF" strokeWidth={2.8} />}
                    label={tr("เพิ่ม", "Add")}
                    onPress={() => setDxDraft({ value: newDiagnosis(dx.length === 0 ? "1" : "2"), at: -1 })}
                  />
                }
              />
              {dx.length > 0 && !principal && (
                <Text style={{ fontSize: 12, color: DANGER }}>
                  {tr("ยังไม่ได้ระบุโรคหลัก", "No principal diagnosis set")}
                </Text>
              )}

              {dx.length === 0 ? (
                <Text style={{ fontSize: 14, lineHeight: 21, color: TEXT_MUTED }}>
                  {tr(
                    "ยังไม่มีการวินิจฉัย เพิ่มจากรายการรหัส ICD-10 หรือจากโรคประจำตัวด้านล่าง",
                    "No diagnoses yet. Add one from the ICD-10 list or from the chronic conditions below.",
                  )}
                </Text>
              ) : (
                <View style={{ marginTop: -SPACE.sm, marginBottom: -SPACE.sm }}>
                  {dx.map((d, i) => (
                    <ListRow
                      key={`${d.code}-${d.text}-${i}`}
                      first={i === 0}
                      title={dxText(d)}
                      meta={
                        <Meta code={d.code}>
                          <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: d.type === "1" ? PRIMARY_500 : GROUPED_BG }}>
                            <Text style={{ fontSize: 12, fontWeight: "600", color: d.type === "1" ? "#FFFFFF" : TEXT_SECONDARY }}>{typeLabel(d.type)}</Text>
                          </View>
                        </Meta>
                      }
                      onPress={() => setDxDraft({ value: d, at: i })}
                      onRemove={() => remove(i)}
                    />
                  ))}
                </View>
              )}

              {suggested.length > 0 && (
                <View style={{ gap: SPACE.sm }}>
                  <Text style={{ fontSize: 12, color: TEXT_MUTED }}>
                    {tr("จากโรคประจำตัวในเวชระเบียน", "From chronic conditions in the record")}
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
                    {suggested.map((s) => {
                      const icd = icdOf(s.code);
                      return (
                        <Pressable
                          key={s.code}
                          onPress={() =>
                            setDxDraft({
                              value: {
                                code: s.code,
                                text: icd != null ? icdName(icd) : s.name,
                                type: dx.length === 0 ? "1" : "2",
                              },
                              at: -1,
                            })
                          }
                          accessibilityRole="button"
                          style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: SPACE.md, paddingVertical: 7, borderRadius: RADIUS.capsule, backgroundColor: PRIMARY_100 }}
                        >
                          <Plus size={13} color={PRIMARY_500} strokeWidth={2.6} />
                          <Text style={{ fontSize: 13, fontWeight: "600", color: PRIMARY_500 }}>{`${s.code} ${icd != null ? icdName(icd) : s.name}`}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}


            </Card>

            {/* What was done. */}
            <Card style={{ gap: SPACE.md }}>
              <CardHeading
                icon={<Syringe size={13} color={PRIMARY_500} strokeWidth={2.4} />}
                title={tr("หัตถการ (ICD-9-CM)", "Procedures (ICD-9-CM)")}
                action={
                  <CardAction
                    icon={<Plus size={14} color="#FFFFFF" strokeWidth={2.8} />}
                    label={tr("เพิ่ม", "Add")}
                    onPress={() => setProc({ line: newProcedure(signedBy()), editing: false })}
                  />
                }
              />
              {procedures.length === 0 ? (
                <Text style={{ fontSize: 14, lineHeight: 21, color: TEXT_MUTED }}>
                  {tr("ยังไม่มีหัตถการ", "No procedures yet")}
                </Text>
              ) : (
                <View style={{ marginTop: -SPACE.sm, marginBottom: -SPACE.sm }}>
                  {procedures.map((p, i) => (
                    <ListRow
                      key={`${p.code}-${i}`}
                      first={i === 0}
                      title={p.name}
                      meta={
                        <Meta code={p.icd9}>
                          <Text style={{ fontSize: 12, color: TEXT_MUTED }}>
                            {[
                              thaiTime(new Date(p.start)),
                              durationOf(p.start, p.end),
                              p.by,
                              p.price > 0
                                ? tr(
                                    `${p.price.toLocaleString(locale)} บาท`,
                                    `${p.price.toLocaleString(locale)} THB`,
                                  )
                                : "",
                              p.assistants.length > 0
                                ? tr(
                                    `ผู้ช่วย ${p.assistants.length}`,
                                    `${p.assistants.length} assistant${p.assistants.length === 1 ? "" : "s"}`,
                                  )
                                : "",
                            ]
                              .filter((t) => t !== "")
                              .join(" · ")}
                          </Text>
                        </Meta>
                      }
                      onPress={() => setProc({ line: p, editing: true })}
                      onRemove={() => {
                        setProcedures((cur) => cur.filter((_, j) => j !== i));
                        toast(tr("ลบหัตถการแล้ว", "Procedure removed"), "success");
                      }}
                    />
                  ))}
                </View>
              )}
            </Card>

            {/* What the visit gets to claim for prevention. */}
            <Card style={{ gap: SPACE.md }}>
              <CardHeading
                icon={<ShieldPlus size={13} color={PRIMARY_500} strokeWidth={2.4} />}
                title={tr("งานส่งเสริมป้องกันโรค", "Health promotion and prevention")}
                action={
                  <CardAction
                    icon={<Plus size={14} color="#FFFFFF" strokeWidth={2.8} />}
                    label={tr("เพิ่ม", "Add")}
                    onPress={() => setPicking("pp")}
                  />
                }
              />
              {pp.length === 0 ? (
                <Text style={{ fontSize: 14, lineHeight: 21, color: TEXT_MUTED }}>
                  {tr("ยังไม่มีรหัส Special PP", "No Special PP codes yet")}
                </Text>
              ) : (
                <View style={{ marginTop: -SPACE.sm, marginBottom: -SPACE.sm }}>
                  {pp.map((p, i) => (
                    <ListRow
                      key={`${p.code}-${i}`}
                      first={i === 0}
                      title={p.label}
                      meta={<Meta code={p.code} />}
                      onRemove={() => {
                        setPp((cur) => cur.filter((_, j) => j !== i));
                        toast(tr("ลบรหัสแล้ว", "Code removed"), "success");
                      }}
                    />
                  ))}
                </View>
              )}
            </Card>
          </ScrollView>
        </HeaderFade>
      </KeyboardAvoidingView>

      <ActionBar>
        <PrimaryAction
          label={tr("บันทึกการวินิจฉัย", "Save diagnosis")}
          disabled={!ready}
          onPress={save}
        />
      </ActionBar>

      <DxAiSheet
        visible={drafting}
        context={{
          age: holder.age,
          gender: holder.gender,
          conditions: holder.conditions ?? [],
          allergies: holder.allergies ?? [],
          screening,
          assessment: recordOf(holder.authenCode, "assessment"),
          homevisit: recordOf(holder.authenCode, "homevisit"),
          medication: recordOf(holder.authenCode, "medication"),
        }}
        onClose={() => setDrafting(false)}
        onApply={applyDraft}
      />

      <TextSheet
        visible={writing != null}
        initial={writing != null && writing >= 0 ? (dxTexts[writing] ?? "") : ""}
        editing={writing != null && writing >= 0}
        onClose={() => setWriting(null)}
        onDone={(text) => {
          const at = writing;
          setDxTexts((cur) => (at != null && at >= 0 ? cur.map((t, j) => (j === at ? text : t)) : [...cur, text]));
          setWriting(null);
          toast(
            at != null && at >= 0
              ? tr("แก้ไขคำวินิจฉัยแล้ว", "Diagnosis text updated")
              : tr("เพิ่มคำวินิจฉัยแล้ว", "Diagnosis text added"),
            "success",
          );
        }}
      />


      <DxSheet
        visible={dxDraft != null}
        value={dxDraft?.value ?? newDiagnosis("1")}
        editing={(dxDraft?.at ?? -1) >= 0}
        onChange={(value) => setDxDraft((cur) => (cur == null ? cur : { ...cur, value }))}
        onClose={() => setDxDraft(null)}
        onDone={() => {
          if (dxDraft == null) return;
          if (dxDraft.at >= 0) {
            setDx((cur) => cur.map((d, j) => (j === dxDraft.at ? dxDraft.value : d)));
            toast(tr("แก้ไขการวินิจฉัยแล้ว", "Diagnosis updated"), "success");
          } else add(dxDraft.value);
          setDxDraft(null);
        }}
      />

      <ProcedureSheet
        visible={proc != null}
        line={proc?.line ?? null}
        editing={proc?.editing ?? false}
        onChange={(line) => setProc((cur) => (cur == null ? cur : { ...cur, line }))}
        onClose={() => setProc(null)}
        onDone={() => {
          if (proc == null) return;
          setProcedures((cur) =>
            proc.editing ? cur.map((p) => (p.id === proc.line.id ? proc.line : p)) : [...cur, proc.line],
          );
          toast(
            proc.editing
              ? tr("แก้ไขหัตถการแล้ว", "Procedure updated")
              : tr("เพิ่มหัตถการแล้ว", "Procedure added"),
            "success",
          );
          setProc(null);
        }}
      />


      <PickSheet
        visible={picking === "pp"}
        title={tr("เพิ่มรหัส Special PP", "Add Special PP code")}
        placeholder={tr("ค้นหารหัสหรือชื่องาน", "Search code or activity")}
        rows={(q) =>
          searchPp(q).map((c) => ({
            key: c.code,
            lead: c.code,
            title: c.label,
            sub: c.group,
            pick: () => {
              if (pp.some((x) => x.code === c.code)) {
                toast(tr("มีรหัสนี้อยู่แล้ว", "This code is already listed"), "warning");
                return;
              }
              setPp((cur) => [...cur, { code: c.code, label: c.label }]);
              toast(tr(`เพิ่มรหัส ${c.code} แล้ว`, `Added code ${c.code}`), "success");
            },
          }))
        }
        custom={(q) => {
          const typed = q.trim().toUpperCase();
          if (!/^[0-9A-Z][0-9A-Z]{3,}$/.test(typed)) return null;
          if (searchPp(q).some((c) => c.code.toUpperCase() === typed)) return null;
          return {
            key: typed,
            title: tr(`เพิ่มรหัส "${typed}" ตามที่พิมพ์`, `Add code "${typed}" as typed`),
            sub: tr(
              "ตรวจสอบกับรหัสมาตรฐานตอนส่งเบิก",
              "Check it against the standard codes when claiming",
            ),
            pick: () => {
              setPp((cur) => [...cur, { code: typed, label: tr(`รหัส ${typed}`, `Code ${typed}`) }]);
              // Warning: a typed code is not on the standard list.
              toast(
                tr(
                  `เพิ่มรหัส ${typed} แล้ว · ตรวจสอบก่อนส่งเบิก`,
                  `Added code ${typed} · Check before claiming`,
                ),
                "warning",
              );
            },
          };
        }}
        onClose={() => setPicking(null)}
      />
    </View>
  );
}

/* ------------------------------------------------------------ the pieces */

/**
 * One item in any of this page's lists.
 *
 * The same shape every time: what it is on the first line, everything that
 * identifies or qualifies it on a quiet second line, and the way to take it
 * off at the end. Codes belong on the second line — they are how the claim
 * finds the row, not how the carer reads it — which is what keeps the names
 * on one left edge instead of each starting wherever its code ended.
 */
function ListRow({
  first,
  title,
  meta,
  onPress,
  onRemove,
}: {
  first: boolean;
  title: string;
  meta?: React.ReactNode;
  onPress?: () => void;
  onRemove: () => void;
}) {
  const body = (
    <View style={{ flex: 1, gap: 5 }}>
      <Text style={{ fontSize: 15, lineHeight: 21, fontWeight: "600", color: TEXT_PRIMARY }}>{title}</Text>
      {meta}
    </View>
  );
  return (
    <View>
      {!first && <View style={{ height: 1, backgroundColor: SEPARATOR }} />}
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md, paddingVertical: SPACE.md }}>
        {onPress != null ? (
          <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.6 : 1 })}>
            {body}
          </Pressable>
        ) : (
          body
        )}
        <RemoveButton onPress={onRemove} />
      </View>
    </View>
  );
}

/** The quiet line under a row's name: its code, and whatever qualifies it. */
function Meta({ code, children }: { code?: string; children?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm, flexWrap: "wrap" }}>
      {code != null && code !== "" && (
        <Text style={{ fontSize: 12, fontWeight: "800", color: PRIMARY_700, fontVariant: ["tabular-nums"] }}>{code}</Text>
      )}
      {children}
    </View>
  );
}

function RemoveButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tr("ลบ", "Remove")}
      hitSlop={8}
      style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: GROUPED_BG }}
    >
      <X size={16} color={TEXT_SECONDARY} strokeWidth={2.4} />
    </Pressable>
  );
}

/** One written diagnosis, typed on its own page rather than in the card. */
function TextSheet({
  visible,
  initial,
  editing,
  onClose,
  onDone,
}: {
  visible: boolean;
  initial: string;
  editing: boolean;
  onClose: () => void;
  onDone: (text: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(initial);
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={() => setText(initial)}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: CANVAS }}>
        <BlurStage>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg }}>
            <GlassIconButton onPress={onClose} accessibilityLabel={tr("ปิด", "Close")}>
              <X size={22} color={TEXT_PRIMARY} strokeWidth={2.6} />
            </GlassIconButton>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: "600", color: TEXT_PRIMARY }}>
              {editing
                ? tr("แก้ไขคำวินิจฉัย", "Edit diagnosis text")
                : tr("เพิ่มคำวินิจฉัย", "Add diagnosis text")}
            </Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView
            contentContainerStyle={{
              ...readable(FORM_MAX),
              paddingVertical: SPACE.lg,
              paddingHorizontal: GUTTER,
              paddingBottom: insets.bottom + 100,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Card>
              <NoteField
                label={tr("คำวินิจฉัยเป็นข้อความ", "Diagnosis in words")}
                value={text}
                onChangeText={setText}
                placeholder={tr(
                  "เช่น แผลกดทับก้นกบระดับ 2 ติดเชื้อ",
                  "e.g. Infected stage 2 sacral pressure ulcer",
                )}
                lines={4}
              />
            </Card>
          </ScrollView>
          <ActionBar>
            <PrimaryAction
              label={editing ? tr("บันทึกการแก้ไข", "Save changes") : tr("เพิ่มลงรายการ", "Add to list")}
              disabled={text.trim() === ""}
              onPress={() => onDone(text.trim())}
            />
          </ActionBar>
        </BlurStage>
      </KeyboardAvoidingView>
    </Modal>
  );
}

