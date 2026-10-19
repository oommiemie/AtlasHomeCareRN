import { createContext } from "react";
import { Pressable, Text, View } from "react-native";
import { Baby, Check, ClipboardList, HeartPulse } from "lucide-react-native";

import { Card } from "./Card";
import { CardHeading } from "./CardAction";
import { CheckBox } from "./CheckBox";
import { ChoiceChip } from "./ChoiceChip";
import { Chevron } from "./Chevron";
import { NoteField, TextField } from "./FormField";
import { recordOf, type CardHolder } from "../models/community";
import { ageInDays, type Resident } from "../models/household";
import { planToday } from "../models/clock";
import { thaiFullDate } from "../utils/thaiDate";
import { feel } from "../utils/haptics";
import { tr } from "../i18n";
import {
  PRIMARY_100,
  PRIMARY_500,
  SEPARATOR,
  SPACE,
  SUCCESS,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";

/*
  The postnatal visit, as the hospital system files it.

  HOSxP keeps two records for one visit to a new mother: the mother's
  postpartum check, and the baby's (ข้อมูลการเยี่ยมหลังคลอด — feeding, the
  baby's examination, and five screening items each normal or not). Choosing
  "เยี่ยมหลังคลอด" puts exactly those in place of the general home-visit
  sections, so what is written here maps onto the record it will be sent
  as, item for item.

  Held as `pp_*` keys on the visit's home-visit record, beside the general
  sections rather than instead of them: a visit changed back to another
  kind keeps what was written under either.
*/

/** The baby's screening, as HOSxP lists it. */
const BABY_CHECKS = [
  { key: "pp_navel", th: "สะดือ", en: "Umbilicus" },
  { key: "pp_skin", th: "ผิวหนัง", en: "Skin" },
  { key: "pp_urine", th: "ปัสสาวะ", en: "Urination" },
  { key: "pp_stool", th: "อุจจาระ", en: "Stool" },
  { key: "pp_health", th: "สุขภาพ", en: "General health" },
] as const;

/** The mother's postpartum check. */
const MOTHER_CHECKS = [
  { key: "pp_breast", th: "เต้านมและหัวนม", en: "Breasts and nipples" },
  { key: "pp_milk", th: "น้ำนม", en: "Milk supply" },
  { key: "pp_uterus", th: "การหดรัดตัวของมดลูก", en: "Uterine involution" },
  { key: "pp_wound", th: "แผลฝีเย็บ / แผลผ่าตัด", en: "Perineal / surgical wound" },
  { key: "pp_lochia", th: "น้ำคาวปลา", en: "Lochia" },
  { key: "pp_bowel", th: "การขับถ่าย", en: "Bladder and bowel" },
  { key: "pp_mood", th: "อารมณ์ / ภาวะซึมเศร้าหลังคลอด", en: "Mood / postpartum depression" },
] as const;

const PLACES = ["บ้าน", "โรงพยาบาล", "อื่น ๆ"];
const FEEDING = ["นมแม่อย่างเดียว", "นมแม่และนมผสม", "นมผสม", "อื่น ๆ"];
const RESULT = ["ปกติ", "ผิดปกติ"];
const FAMILY_PLANNING = [
  "ยังไม่คุมกำเนิด",
  "ยาเม็ด",
  "ยาฉีด",
  "ยาฝัง",
  "ห่วงอนามัย",
  "ทำหมัน",
];

const EN: Record<string, string> = {
  บ้าน: "Home",
  โรงพยาบาล: "Hospital",
  "อื่น ๆ": "Other",
  นมแม่อย่างเดียว: "Breast milk only",
  นมแม่และนมผสม: "Breast milk and formula",
  นมผสม: "Formula",
  ปกติ: "Normal",
  ผิดปกติ: "Abnormal",
  ยังไม่คุมกำเนิด: "None yet",
  ยาเม็ด: "Pill",
  ยาฉีด: "Injection",
  ยาฝัง: "Implant",
  ห่วงอนามัย: "IUD",
  ทำหมัน: "Sterilisation",
};
const say = (v: string) => tr(v, EN[v] ?? v);

/** How many postnatal answers a record holds — for the save button. */
export function postnatalFilled(pp: Record<string, string>): number {
  return Object.entries(pp).filter(([k, v]) => k.startsWith("pp_") && v !== "").length;
}

/**
 * How the page around the mother's form opens a child's record. On a
 * tablet's visit workspace it opens as a window of its own beside the
 * mother's, which stays as it was; with none, the child's record is pushed
 * over the mother's, as on a phone.
 */
export const OpenChildContext = createContext<
  ((holder: CardHolder) => void) | null
>(null);

/** The visit page for a child, opened from their mother's — its own record. */
export function childHolder(mother: CardHolder, child: Resident): CardHolder {
  return {
    name: child.name,
    age: child.age,
    gender: child.gender,
    citizenId: "",
    hn: `${mother.hn}-B${child.id.slice(-1)}`,
    entitlement: mother.entitlement,
    // The same visit, a record of the child's own beside the mother's.
    authenCode: `${mother.authenCode}-${child.id}`,
    allergies: [],
    conditions: [],
    visitType: "เยี่ยมหลังคลอด",
    residentId: child.id,
  };
}

export function PostnatalForm({
  who,
  pp,
  set,
  visitor,
  babies = [],
  mother,
  child,
  childHn,
  onOpenChild,
}: {
  /** On the baby's page: the baby, shown at the head of the record. */
  child?: Resident;
  childHn?: string;
  /** Whose record this is: the mother's postpartum check, or the baby's. */
  who: "mother" | "baby";
  pp: Record<string, string>;
  set: (key: string, value: string) => void;
  /** Who is visiting, to fill the field with. */
  visitor: string;
  /** The mother's newborns, each with a way through to their own record. */
  babies?: { resident: Resident; holder: CardHolder }[];
  /** On the baby's page: whose child this is. */
  mother?: Resident;
  onOpenChild?: (holder: CardHolder) => void;
}) {
  const checks = who === "baby" ? BABY_CHECKS : MOTHER_CHECKS;
  const round = Number(pp.pp_round || "1");

  return (
    <>
      {/* Whose record this is, on the baby's: the baby, how old, and whose. */}
      {who === "baby" && child != null ? (
        <ChildCard child={child} hn={childHn} mother={mother} />
      ) : (
        mother != null && (
          <Text style={{ fontSize: 13, color: TEXT_MUTED, marginBottom: -SPACE.sm }}>
            {tr(`บุตรของ ${mother.name}`, `Child of ${mother.name}`)}
          </Text>
        )
      )}

      <Card style={{ gap: SPACE.lg }}>
        <CardHeading
          icon={<ClipboardList size={13} color={PRIMARY_500} strokeWidth={2.4} />}
          title={tr("ข้อมูลการเยี่ยม", "Visit details")}
          note={thaiFullDate(planToday)}
        />
        <View style={{ gap: SPACE.sm }}>
          <Label text={tr("ครั้งที่", "Visit no.")} />
          <View style={{ flexDirection: "row", gap: SPACE.sm }}>
            {[1, 2, 3].map((n) => (
              <ChoiceChip
                key={n}
                label={String(n)}
                on={round === n}
                onPress={() => set("pp_round", String(n))}
              />
            ))}
          </View>
        </View>
        {/* Not on the baby's record: the visit is the mother's, and where
            and by whom it was made is written there. */}
        {who === "mother" && (
          <Pick label={tr("สถานที่", "Place")} options={PLACES} value={pp.pp_place || "บ้าน"} onChange={(v) => set("pp_place", v)} />
        )}
        {who === "mother" && (
          <TextField
            label={tr("ผู้เยี่ยม", "Visited by")}
            value={pp.pp_visitor ?? visitor}
            onChangeText={(v) => set("pp_visitor", v)}
          />
        )}
      </Card>

      <Card style={{ gap: SPACE.lg }}>
        <CardHeading
          icon={
            who === "baby" ? (
              <Baby size={13} color={PRIMARY_500} strokeWidth={2.4} />
            ) : (
              <HeartPulse size={13} color={PRIMARY_500} strokeWidth={2.4} />
            )
          }
          title={
            who === "baby"
              ? tr("การตรวจทารก", "Baby's examination")
              : tr("การตรวจมารดาหลังคลอด", "Mother's postpartum check")
          }
        />
        {who === "baby" && (
          <Pick
            label={tr("อาหารที่รับประทาน", "Feeding")}
            options={FEEDING}
            value={pp.pp_feeding ?? null}
            onChange={(v) => set("pp_feeding", v)}
          />
        )}
        <Pick
          label={who === "baby" ? tr("ผลการตรวจทารก", "Baby's result") : tr("ผลการตรวจมารดา", "Mother's result")}
          options={RESULT}
          value={pp.pp_result ?? null}
          onChange={(v) => set("pp_result", v)}
        />

        {/* The screening, each item normal or not — the HOSxP grid's
            "ปกติ" column, as a tick. Ticked is normal. */}
        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Label text={tr("การคัดกรอง", "Screening")} />
            <Label text={tr("ปกติ", "Normal")} />
          </View>
          {checks.map((c, i) => {
            const on = pp[c.key] === "ปกติ";
            return (
              <Pressable
                key={c.key}
                onPress={() => {
                  feel("tick");
                  set(c.key, on ? "ผิดปกติ" : "ปกติ");
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={tr(c.th, c.en)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACE.md,
                  paddingVertical: 11,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: SEPARATOR,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text style={{ width: 22, fontSize: 14, color: TEXT_MUTED }}>{i + 1}</Text>
                <Text style={{ flex: 1, fontSize: 15, color: TEXT_PRIMARY }}>{tr(c.th, c.en)}</Text>
                {pp[c.key] === "ผิดปกติ" && (
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#C2410C" }}>
                    {tr("ผิดปกติ", "Abnormal")}
                  </Text>
                )}
                <CheckBox on={on} />
              </Pressable>
            );
          })}
        </View>

        {who === "mother" && (
          <Pick
            label={tr("การวางแผนครอบครัว", "Family planning")}
            options={FAMILY_PLANNING}
            value={pp.pp_fp ?? null}
            onChange={(v) => set("pp_fp", v)}
          />
        )}

        <NoteField
          label={tr("หมายเหตุการเยี่ยม", "Visit notes")}
          value={pp.pp_note ?? ""}
          onChangeText={(v) => set("pp_note", v)}
          placeholder={
            who === "baby"
              ? tr("สีผิว ตัวเหลือง การดูดนม น้ำหนัก และสิ่งที่แนะนำแม่", "Colour, jaundice, feeding, weight and advice to the mother")
              : tr("อาการ ความพร้อมในการดูแลลูก และสิ่งที่แนะนำ", "Symptoms, readiness to care for the baby, and advice")
          }
        />
      </Card>

      {/* Her newborn, visited in the same call: a way through to the baby's
          own record, so one visit writes both. */}
      {babies.length > 0 && (
        <Card padded={false}>
          <View style={{ paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg }}>
            <CardHeading
              icon={<Baby size={13} color={PRIMARY_500} strokeWidth={2.4} />}
              title={tr("บันทึกการเยี่ยมบุตร", "Baby's visit record")}
              note={tr(`${babies.length} คน`, `${babies.length}`)}
            />
          </View>
          {babies.map(({ resident, holder }) => {
            const done = postnatalFilled(recordOf(holder.authenCode, "homevisit")) > 0;
            const days = ageInDays(resident);
            return (
              <Pressable
                key={resident.id}
                onPress={() => onOpenChild?.(holder)}
                accessibilityRole="button"
                accessibilityLabel={tr(`บันทึกการเยี่ยม ${resident.name}`, `Record ${resident.name}'s visit`)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACE.md,
                  padding: SPACE.lg,
                  backgroundColor: pressed ? PRIMARY_100 : "transparent",
                })}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: `${PRIMARY_500}14`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Baby size={22} color={PRIMARY_500} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "600", color: TEXT_PRIMARY }}>
                    {resident.name}
                  </Text>
                  <Text style={{ fontSize: 13, color: TEXT_MUTED }}>
                    {days != null ? tr(`อายุ ${days} วัน`, `${days} days old`) : tr("ทารก", "Newborn")}
                    {" · "}
                    {resident.gender === "หญิง" ? tr("หญิง", "Girl") : tr("ชาย", "Boy")}
                  </Text>
                </View>
                {done ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Check size={14} color={SUCCESS} strokeWidth={2.8} />
                    <Text style={{ fontSize: 12, fontWeight: "600", color: SUCCESS }}>
                      {tr("บันทึกแล้ว", "Recorded")}
                    </Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 12, fontWeight: "600", color: PRIMARY_500 }}>
                    {tr("ยังไม่บันทึก", "Not yet")}
                  </Text>
                )}
                <Chevron />
              </Pressable>
            );
          })}
        </Card>
      )}
    </>
  );
}

/** The baby at the head of their own record. */
function ChildCard({ child, hn, mother }: { child: Resident; hn?: string; mother?: Resident }) {
  const days = ageInDays(child);
  const girl = child.gender === "หญิง";
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: girl ? "#FCE7F3" : `${PRIMARY_500}1A`,
          }}
        >
          <Baby size={26} color={girl ? "#DB2777" : PRIMARY_500} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text numberOfLines={1} style={{ fontSize: 17, lineHeight: 22, fontWeight: "700", color: TEXT_PRIMARY }}>
            {child.name}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, color: TEXT_MUTED }}>
            {[
              days != null ? tr(`อายุ ${days} วัน`, `${days} days old`) : tr("ทารก", "Newborn"),
              girl ? tr("หญิง", "Girl") : tr("ชาย", "Boy"),
              hn != null && hn !== "" ? `HN ${hn}` : null,
            ]
              .filter((x) => x != null)
              .join(" · ")}
          </Text>
          {mother != null && (
            <Text numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, color: TEXT_MUTED }}>
              {tr(`บุตรของ ${mother.name}`, `Child of ${mother.name}`)}
            </Text>
          )}
        </View>
      </View>
    </Card>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>{text}</Text>;
}

/** One of a few, as capsules — tapping the chosen one clears it. */
function Pick({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ gap: SPACE.sm }}>
      <Label text={label} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
        {options.map((o) => (
          <ChoiceChip
            key={o}
            label={say(o)}
            on={value === o}
            onPress={() => onChange(value === o ? "" : o)}
          />
        ))}
      </View>
    </View>
  );
}
