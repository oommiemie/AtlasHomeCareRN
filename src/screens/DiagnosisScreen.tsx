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
import { GlassChips } from "../components/GlassChips";
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
  icdOf,
  searchIcd,
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

type Nav = NativeStackNavigationProp<RootStackParamList>;

const typeLabel = (t: DxType) => DX_TYPES.find((d) => d.code === t)?.short ?? t;

const PLACES = ["นอกสถานบริการ", "ในสถานบริการ"] as const;

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
      setTimeout(() => toast("อ่านบันทึกเดิมไม่ได้ บางรายการอาจหายไป", "warning"), 0);
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
    if (fresh) toast("นำร่างมาใส่ในบันทึกแล้ว ตรวจสอบและแก้ไขได้", "success");
    else toast("ร่างนี้ไม่มีข้อมูลใหม่", "info");
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
      toast("มีการวินิจฉัยนี้อยู่แล้ว", "warning");
      return;
    }
    setDx((cur) => [...cur, d]);
    toast(d.code !== "" ? `เพิ่ม ${d.code} แล้ว` : "เพิ่มการวินิจฉัยแล้ว", "success");
  };
  const remove = (i: number) => {
    setDx((cur) => cur.filter((_, j) => j !== i));
    toast("ลบการวินิจฉัยแล้ว", "success");
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
    if (dx.length > 0 && !principal) toast("บันทึกแล้ว · ยังไม่ได้ระบุโรคหลัก", "warning");
    else toast("บันทึกการวินิจฉัยแล้ว", "success");
    nav.goBack();
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title="วินิจฉัยโรค"
        right={
          <ToolbarPill
            slots={[
              {
                icon: <UIcon name="magicWand" size={20} color={TEXT_PRIMARY} />,
                label: "ร่างบันทึกด้วย AI",
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
              paddingHorizontal: SPACE.lg,
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
              <CardHeading icon={<MapPin size={13} color={PRIMARY_500} strokeWidth={2.4} />} title="สถานที่รับบริการ" />
              <GlassChips options={[...PLACES]} value={place} onChange={(v) => setPlace(v as (typeof PLACES)[number])} />
            </Card>

            {/* What was concluded, in words — written before it is coded,
                because that is the order it is thought in, and as many
                lines as the visit found. */}
            <Card style={{ gap: SPACE.md }}>
              <CardHeading
                icon={<FileText size={13} color={PRIMARY_500} strokeWidth={2.4} />}
                title="คำวินิจฉัย (Diagnosis Text)"
                action={
                  <CardAction
                    icon={<Plus size={14} color="#FFFFFF" strokeWidth={2.8} />}
                    label="เพิ่ม"
                    onPress={() => setWriting(-1)}
                  />
                }
              />
              {dxTexts.length === 0 ? (
                <Text style={{ fontSize: 14, lineHeight: 21, color: TEXT_MUTED }}>
                  ยังไม่มีคำวินิจฉัยเป็นข้อความ
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
                        toast("ลบคำวินิจฉัยแล้ว", "success");
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
                title="การวินิจฉัย (ICD-10)"
                action={
                  <CardAction
                    icon={<Plus size={14} color="#FFFFFF" strokeWidth={2.8} />}
                    label="เพิ่ม"
                    onPress={() => setDxDraft({ value: newDiagnosis(dx.length === 0 ? "1" : "2"), at: -1 })}
                  />
                }
              />
              {dx.length > 0 && !principal && (
                <Text style={{ fontSize: 12, color: DANGER }}>ยังไม่ได้ระบุโรคหลัก</Text>
              )}

              {dx.length === 0 ? (
                <Text style={{ fontSize: 14, lineHeight: 21, color: TEXT_MUTED }}>
                  ยังไม่มีการวินิจฉัย เพิ่มจากรายการรหัส ICD-10 หรือจากโรคประจำตัวด้านล่าง
                </Text>
              ) : (
                <View style={{ marginTop: -SPACE.sm, marginBottom: -SPACE.sm }}>
                  {dx.map((d, i) => (
                    <ListRow
                      key={`${d.code}-${d.text}-${i}`}
                      first={i === 0}
                      title={d.text}
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
                  <Text style={{ fontSize: 12, color: TEXT_MUTED }}>จากโรคประจำตัวในเวชระเบียน</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
                    {suggested.map((s) => {
                      const icd = icdOf(s.code);
                      return (
                        <Pressable
                          key={s.code}
                          onPress={() =>
                            setDxDraft({
                              value: { code: s.code, text: icd?.th ?? s.name, type: dx.length === 0 ? "1" : "2" },
                              at: -1,
                            })
                          }
                          accessibilityRole="button"
                          style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: SPACE.md, paddingVertical: 7, borderRadius: RADIUS.capsule, backgroundColor: PRIMARY_100 }}
                        >
                          <Plus size={13} color={PRIMARY_500} strokeWidth={2.6} />
                          <Text style={{ fontSize: 13, fontWeight: "600", color: PRIMARY_500 }}>{`${s.code} ${icd?.th ?? s.name}`}</Text>
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
                title="หัตถการ (ICD-9-CM)"
                action={
                  <CardAction
                    icon={<Plus size={14} color="#FFFFFF" strokeWidth={2.8} />}
                    label="เพิ่ม"
                    onPress={() => setProc({ line: newProcedure(signedBy()), editing: false })}
                  />
                }
              />
              {procedures.length === 0 ? (
                <Text style={{ fontSize: 14, lineHeight: 21, color: TEXT_MUTED }}>ยังไม่มีหัตถการ</Text>
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
                              p.price > 0 ? `${p.price.toLocaleString("th-TH")} บาท` : "",
                              p.assistants.length > 0 ? `ผู้ช่วย ${p.assistants.length}` : "",
                            ]
                              .filter((t) => t !== "")
                              .join(" · ")}
                          </Text>
                        </Meta>
                      }
                      onPress={() => setProc({ line: p, editing: true })}
                      onRemove={() => {
                        setProcedures((cur) => cur.filter((_, j) => j !== i));
                        toast("ลบหัตถการแล้ว", "success");
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
                title="งานส่งเสริมป้องกันโรค"
                action={
                  <CardAction
                    icon={<Plus size={14} color="#FFFFFF" strokeWidth={2.8} />}
                    label="เพิ่ม"
                    onPress={() => setPicking("pp")}
                  />
                }
              />
              {pp.length === 0 ? (
                <Text style={{ fontSize: 14, lineHeight: 21, color: TEXT_MUTED }}>ยังไม่มีรหัส Special PP</Text>
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
                        toast("ลบรหัสแล้ว", "success");
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
          label="บันทึกการวินิจฉัย"
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
          toast(at != null && at >= 0 ? "แก้ไขคำวินิจฉัยแล้ว" : "เพิ่มคำวินิจฉัยแล้ว", "success");
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
            toast("แก้ไขการวินิจฉัยแล้ว", "success");
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
          toast(proc.editing ? "แก้ไขหัตถการแล้ว" : "เพิ่มหัตถการแล้ว", "success");
          setProc(null);
        }}
      />


      <PickSheet
        visible={picking === "pp"}
        title="เพิ่มรหัส Special PP"
        placeholder="ค้นหารหัสหรือชื่องาน"
        rows={(q) =>
          searchPp(q).map((c) => ({
            key: c.code,
            lead: c.code,
            title: c.label,
            sub: c.group,
            pick: () => {
              if (pp.some((x) => x.code === c.code)) {
                toast("มีรหัสนี้อยู่แล้ว", "warning");
                return;
              }
              setPp((cur) => [...cur, { code: c.code, label: c.label }]);
              toast(`เพิ่มรหัส ${c.code} แล้ว`, "success");
            },
          }))
        }
        custom={(q) => {
          const typed = q.trim().toUpperCase();
          if (!/^[0-9A-Z][0-9A-Z]{3,}$/.test(typed)) return null;
          if (searchPp(q).some((c) => c.code.toUpperCase() === typed)) return null;
          return {
            key: typed,
            title: `เพิ่มรหัส "${typed}" ตามที่พิมพ์`,
            sub: "ตรวจสอบกับรหัสมาตรฐานตอนส่งเบิก",
            pick: () => {
              setPp((cur) => [...cur, { code: typed, label: `รหัส ${typed}` }]);
              // Warning: a typed code is not on the standard list.
              toast(`เพิ่มรหัส ${typed} แล้ว · ตรวจสอบก่อนส่งเบิก`, "warning");
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
      accessibilityLabel="ลบ"
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
            <GlassIconButton onPress={onClose} accessibilityLabel="ปิด">
              <X size={22} color={TEXT_PRIMARY} strokeWidth={2.6} />
            </GlassIconButton>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: "600", color: TEXT_PRIMARY }}>
              {editing ? "แก้ไขคำวินิจฉัย" : "เพิ่มคำวินิจฉัย"}
            </Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView
            contentContainerStyle={{ padding: SPACE.lg, paddingBottom: insets.bottom + 100 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Card>
              <NoteField
                label="คำวินิจฉัยเป็นข้อความ"
                value={text}
                onChangeText={setText}
                placeholder="เช่น แผลกดทับก้นกบระดับ 2 ติดเชื้อ"
                lines={4}
              />
            </Card>
          </ScrollView>
          <ActionBar>
            <PrimaryAction
              label={editing ? "บันทึกการแก้ไข" : "เพิ่มลงรายการ"}
              disabled={text.trim() === ""}
              onPress={() => onDone(text.trim())}
            />
          </ActionBar>
        </BlurStage>
      </KeyboardAvoidingView>
    </Modal>
  );
}

