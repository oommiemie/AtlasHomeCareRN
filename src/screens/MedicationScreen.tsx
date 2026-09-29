import { useEffect, useMemo, useRef, useState } from "react";
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
  Check,
  ChevronLeft,
  ChevronRight,
  History,
  Pill,
  Plus,
  Stethoscope,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react-native";

import { ChoiceChip } from "../components/ChoiceChip";
import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { Card } from "../components/Card";
import { NoteField } from "../components/FormField";
import { Glass } from "../components/Glass";
import { GlassIconButton } from "../components/GlassIconButton";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { ToolbarPill } from "../components/ToolbarPill";
import { SearchField } from "../components/SearchField";
import { SnackBar, type SnackTone } from "../components/SnackBar";
import { Stepper } from "../components/Stepper";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import { currentSession } from "../models/session";
import { feel } from "../utils/haptics";
import { tr } from "../i18n";
import { FORM_MAX, readable, GUTTER } from "../theme/layout";
import { SegmentedControlNative } from "../../modules/segmented-control";
import { PaintedSegments } from "../components/PaintedSegments";
import {
  FREQUENCIES,
  PAYMENTS,
  TIMINGS,
  allergyHit,
  baht,
  dispensingHistory,
  drugGloss,
  medLabel,
  serviceName,
  unitLabel,
  doseUnits,
  lineTotal,
  pastItem,
  pastSig,
  restoreLine,
  orderOf,
  orderTotal,
  packsFor,
  saveOrder,
  searchDrugs,
  searchServices,
  sigOf,
  type Drug,
  type DrugLine,
  type OrderLine,
  type PastOrder,
  type PastOrderLine,
  type Service,
  type ServiceLine,
} from "../models/medication";
import {
  CANVAS,
  DANGER,
  DANGER_BG,
  GROUPED_BG,
  PRIMARY_100,
  PRIMARY_500,
  PRIMARY_700,
  RADIUS,
  SEPARATOR,
  SPACE,
  SUCCESS,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Who signs the order: the account this phone is signed in as. */
const signedBy = () => {
  const me = currentSession();
  return me.displayName !== ""
    ? me.displayName
    : me.providerId !== ""
      ? me.providerId
      : "—";
};

const TABS: { key: "drug" | "service"; label: string }[] = [
  { key: "drug", label: tr("ยา", "Medications") },
  { key: "service", label: tr("เวชภัณฑ์ / ค่าบริการ", "Supplies / services") },
];

/**
 * "สั่งยาและเวชภัณฑ์" — the visit's order, on one page.
 *
 * What the nurse must not miss is at the top: the allergies off the card,
 * in red. Under them the medicines, each with its instructions in one
 * line and what it costs; then the supplies and services; then the total.
 * Adding either opens one sheet — pick from a searched list, then say how
 * much and how often by tapping — and the count and the price follow.
 */
export function MedicationScreen() {
  const { holder } =
    useRoute<RouteProp<RootStackParamList, "Medication">>().params;
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const allergies = holder.allergies ?? [];

  const [lines, setLines] = useState<OrderLine[]>(() =>
    orderOf(holder.authenCode),
  );
  const [sheet, setSheet] = useState<{
    tab: "drug" | "service";
    edit?: OrderLine;
  } | null>(null);
  const [history, setHistory] = useState(false);

  const total = orderTotal(lines);

  const upsert = (line: OrderLine) =>
    setLines((cur) =>
      cur.some((l) => l.id === line.id)
        ? cur.map((l) => (l.id === line.id ? line : l))
        : [...cur, line],
    );
  const remove = (id: string) =>
    setLines((cur) => cur.filter((l) => l.id !== id));

  const save = () => {
    saveOrder(holder.authenCode, lines);
    if (lines.some((l) => l.kind === "drug" && allergyHit(l.drug, allergies) != null))
      toast(tr("บันทึกใบสั่งยาแล้ว · มีรายการตรงกับประวัติแพ้ยา", "Order saved · an item matches a drug allergy"), "warning");
    else toast(tr("บันทึกใบสั่งยาแล้ว", "Order saved"), "success");
    nav.goBack();
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title={tr("สั่งยาและเวชภัณฑ์", "Medications & supplies")}
        right={
          <ToolbarPill
            slots={[
              {
                icon: <Plus size={20} color={TEXT_PRIMARY} strokeWidth={2.4} />,
                label: tr("เพิ่มรายการ", "Add item"),
                onPress: () => setSheet({ tab: "drug" }),
              },
              {
                icon: (
                  <History size={20} color={TEXT_PRIMARY} strokeWidth={2.2} />
                ),
                label: tr("ประวัติการจ่ายยาและเวชภัณฑ์", "Dispensing history"),
                onPress: () => setHistory(true),
              },
            ]}
          />
        }
      />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: GUTTER,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + 110,
            gap: SPACE.md,
            ...readable(),
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* The allergies, first and in red: the one thing on this page
              that must be read before anything is added. */}
          {allergies.length > 0 && (
            <Card
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.md,
                backgroundColor: DANGER_BG,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: allergies.length
                    ? `${DANGER}1F`
                    : PRIMARY_100,
                }}
              >
                <TriangleAlert
                  size={20}
                  color={allergies.length ? DANGER : PRIMARY_500}
                  strokeWidth={2.2}
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: allergies.length ? DANGER : TEXT_PRIMARY,
                  }}
                >
                  {allergies.length
                    ? tr(`แพ้ยา ${allergies.length} รายการ`, `${allergies.length} drug allerg${allergies.length === 1 ? "y" : "ies"}`)
                    : tr("ไม่มีประวัติแพ้ยา", "No known drug allergies")}
                </Text>
                <Text
                  style={{ fontSize: 14, lineHeight: 20, color: TEXT_PRIMARY }}
                >
                  {allergies.join(" · ")}
                </Text>
              </View>
            </Card>
          )}

          {/* Medicines and supplies in one list, in the order they were
              added: a glyph on each row says which it is. */}
          {lines.length === 0 ? (
            <Card
              style={{
                alignItems: "center",
                gap: SPACE.sm,
                paddingVertical: SPACE.xxl,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: PRIMARY_100,
                }}
              >
                <Pill size={20} color={PRIMARY_500} strokeWidth={2.2} />
              </View>
              <Text
                style={{ fontSize: 14, fontWeight: "600", color: TEXT_PRIMARY }}
              >
                {tr("ยังไม่มีรายการ", "No items yet")}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  lineHeight: 18,
                  color: TEXT_MUTED,
                  textAlign: "center",
                }}
              >
                {tr("เพิ่มยา เวชภัณฑ์ หรือค่าบริการ หรือสั่งซ้ำจากประวัติครั้งก่อน", "Add medications, supplies or services, or repeat an earlier order from the history")}
              </Text>
              <Pressable
                onPress={() => setSheet({ tab: "drug" })}
                accessibilityRole="button"
                accessibilityLabel={tr("เพิ่มรายการ", "Add item")}
                style={{ marginTop: SPACE.sm }}
              >
                <Glass
                  interactive
                  tintColor="rgba(7,125,215,0.78)"
                  style={{
                    height: 40,
                    paddingHorizontal: SPACE.xl,
                    borderRadius: RADIUS.capsule,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Plus size={16} color="#FFFFFF" strokeWidth={2.8} />
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: "#FFFFFF",
                    }}
                  >
                    {tr("เพิ่มรายการ", "Add item")}
                  </Text>
                </Glass>
              </Pressable>
            </Card>
          ) : (
            <Card style={{ paddingVertical: 0 }}>
              {lines.map((l, i) =>
                l.kind === "drug" ? (
                  <Row
                    key={l.id}
                    first={i === 0}
                    kind="drug"
                    title={l.drug.name}
                    sub={sigOf(l)}
                    trail={`${l.qty} ${unitLabel(l.drug.pack, l.qty)} · ${baht(lineTotal(l))}`}
                    warn={allergyHit(l.drug, allergies)}
                    onPress={() => setSheet({ tab: "drug", edit: l })}
                    onRemove={() => {
                      remove(l.id);
                      toast(tr(`ลบ ${l.drug.name} ออกจากใบสั่งแล้ว`, `Removed ${l.drug.name} from the order`), "success");
                    }}
                  />
                ) : (
                  <Row
                    key={l.id}
                    first={i === 0}
                    kind="service"
                    title={serviceName(l.service)}
                    sub={`${medLabel(l.service.category)} · ${medLabel(l.payment)}`}
                    trail={`${l.qty} ${unitLabel(l.service.unit, l.qty)} · ${baht(lineTotal(l))}`}
                    onPress={() => setSheet({ tab: "service", edit: l })}
                    onRemove={() => {
                      remove(l.id);
                      toast(tr(`ลบ ${l.service.name} ออกจากใบสั่งแล้ว`, `Removed ${serviceName(l.service)} from the order`), "success");
                    }}
                  />
                ),
              )}
            </Card>
          )}

          {lines.length > 0 && (
            <Card
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.md,
              }}
            >
              <Text style={{ flex: 1, fontSize: 14, color: TEXT_SECONDARY }}>
                {tr(`รวม ${lines.length} รายการ`, `${lines.length} item${lines.length === 1 ? "" : "s"} in total`)}
              </Text>
              <Text
                style={{ fontSize: 18, fontWeight: "800", color: TEXT_PRIMARY }}
              >
                {baht(total)}
              </Text>
            </Card>
          )}
        </ScrollView>
      </HeaderFade>

      <ActionBar>
        <PrimaryAction
          label={tr("บันทึกใบสั่งยา", "Save order")}
          disabled={lines.length === 0}
          onPress={save}
        />
      </ActionBar>

      <HistorySheet
        visible={history}
        orders={dispensingHistory(holder.hn)}
        allergies={allergies}
        onClose={() => setHistory(false)}
        // The sheet says so itself; a second word from the page would
        // stack under it.
        onReorder={upsert}
      />

      <OrderSheet
        open={sheet}
        allergies={allergies}
        onClose={() => setSheet(null)}
        onDone={(line) => {
          const editing = lines.some((l) => l.id === line.id);
          const name = line.kind === "drug" ? line.drug.name : serviceName(line.service);
          upsert(line);
          setSheet(null);
          const said = editing
            ? tr(`แก้ไข ${name} แล้ว`, `Updated ${name}`)
            : tr(`เพิ่ม ${name} แล้ว`, `Added ${name}`);
          if (line.kind === "drug" && allergyHit(line.drug, allergies) != null)
            toast(`${said} · ${tr("ตรงกับประวัติแพ้ยา", "matches a drug allergy")}`, "warning");
          else toast(said, "success");
        }}
      />
    </View>
  );
}

/** One line of the order: name, instructions, count and price, and the way out. */
function Row({
  first,
  kind,
  title,
  sub,
  trail,
  warn,
  onPress,
  onRemove,
}: {
  first: boolean;
  kind: "drug" | "service";
  title: string;
  sub: string;
  trail: string;
  warn?: string | null;
  onPress: () => void;
  onRemove: () => void;
}) {
  return (
    <View>
      {!first && <View style={{ height: 1, backgroundColor: SEPARATOR }} />}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.md,
          paddingVertical: SPACE.md,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: PRIMARY_100,
          }}
        >
          {kind === "drug" ? (
            <Pill size={16} color={PRIMARY_500} strokeWidth={2.2} />
          ) : (
            <Stethoscope size={16} color={PRIMARY_500} strokeWidth={2.2} />
          )}
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text
            numberOfLines={2}
            style={{
              fontSize: 14,
              lineHeight: 20,
              fontWeight: "600",
              color: TEXT_PRIMARY,
            }}
          >
            {title}
          </Text>
          <Text style={{ fontSize: 13, lineHeight: 18, color: TEXT_SECONDARY }}>
            {sub}
          </Text>
          <Text style={{ fontSize: 12, lineHeight: 16, color: TEXT_MUTED }}>
            {trail}
          </Text>
          {warn != null && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                marginTop: 2,
              }}
            >
              <TriangleAlert size={13} color={DANGER} strokeWidth={2.4} />
              <Text
                style={{ fontSize: 12, fontWeight: "700", color: DANGER }}
              >{tr(`ตรงกับประวัติแพ้: ${warn}`, `Matches allergy: ${warn}`)}</Text>
            </View>
          )}
        </View>
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={tr("ลบรายการ", "Remove item")}
          hitSlop={8}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: GROUPED_BG,
          }}
        >
          <X size={16} color={TEXT_SECONDARY} strokeWidth={2.4} />
        </Pressable>
      </Pressable>
    </View>
  );
}

/* ------------------------------------------------------------- the history */

/**
 * What the patient was given before, newest first, each order as a card:
 * when and where, then its lines. A tap on the + beside a line puts it on
 * today's order as it was — the way a chronic patient's repeat is written.
 */
function HistorySheet({
  visible,
  orders,
  allergies,
  onClose,
  onReorder,
}: {
  visible: boolean;
  orders: PastOrder[];
  allergies: string[];
  onClose: () => void;
  onReorder: (line: OrderLine) => void;
}) {
  const insets = useSafeAreaInsets();
  // The lines just added, by key, so their button reads as done for a
  // moment; and the bar along the foot that names the last one. The
  // page's own toast sits under this sheet, so the sheet says it itself.
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<SnackTone>("success");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current != null) clearTimeout(timer.current);
    },
    [],
  );
  const reorder = (key: string, l: PastOrderLine, name: string) => {
    const line = restoreLine(
      l,
      `${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
      signedBy(),
    );
    if (line == null) {
      toast(tr("สั่งซ้ำไม่ได้ ไม่พบรายการนี้ในบัญชีแล้ว", "Can't repeat this: the item is no longer on the formulary"), "error");
      return;
    }
    feel("success");
    onReorder(line);
    setAdded((cur) => new Set(cur).add(key));
    const hit = line.kind === "drug" && allergyHit(line.drug, allergies) != null;
    setNoticeTone(hit ? "warning" : "success");
    setNotice(
      hit
        ? tr(`เพิ่ม ${name} ลงใบสั่งแล้ว · ตรงกับประวัติแพ้ยา`, `Added ${name} to the order · matches a drug allergy`)
        : tr(`เพิ่ม ${name} ลงใบสั่งแล้ว`, `Added ${name} to the order`),
    );
    if (timer.current != null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setNotice(null);
      setAdded((cur) => {
        const next = new Set(cur);
        next.delete(key);
        return next;
      });
    }, 1800);
  };
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: CANVAS }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: GUTTER,
            paddingTop: SPACE.lg,
          }}
        >
          <GlassIconButton onPress={onClose} accessibilityLabel={tr("ปิด", "Close")}>
            <X size={22} color={TEXT_PRIMARY} strokeWidth={2.6} />
          </GlassIconButton>
          <Text
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 16,
              fontWeight: "600",
              color: TEXT_PRIMARY,
            }}
          >
            {tr("ประวัติการจ่ายยาและเวชภัณฑ์", "Dispensing history")}
          </Text>
          <View style={{ width: 44 }} />
        </View>
        <ScrollView
          contentContainerStyle={{
            paddingVertical: SPACE.lg,
            paddingHorizontal: GUTTER,
            gap: SPACE.md,
            paddingBottom: insets.bottom + SPACE.xl,
            ...readable(),
          }}
          showsVerticalScrollIndicator={false}
        >
          {orders.length === 0 && (
            <Card>
              <Text style={{ fontSize: 14, color: TEXT_MUTED }}>
                {tr("ยังไม่มีประวัติการจ่ายยา", "No dispensing history yet")}
              </Text>
            </Card>
          )}
          {orders.map((o) => {
            const total = o.lines.reduce((sum, l) => {
              const item = pastItem(l);
              return sum + (item == null ? 0 : item.price * l.qty);
            }, 0);
            return (
              <Card key={o.id} style={{ paddingVertical: 0 }}>
                <View style={{ paddingVertical: SPACE.md, gap: 2 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: SPACE.sm,
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 14,
                        fontWeight: "700",
                        color: TEXT_PRIMARY,
                      }}
                    >{tr(`${o.daysAgo} วันก่อน`, `${o.daysAgo} days ago`)}</Text>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: TEXT_SECONDARY,
                      }}
                    >
                      {baht(total)}
                    </Text>
                  </View>
                  <Text
                    style={{ fontSize: 12, color: TEXT_MUTED }}
                  >{`${medLabel(o.clinic)} · ${medLabel(o.prescriber)}`}</Text>
                </View>
                {o.lines.map((l, i) => {
                  const item = pastItem(l);
                  if (item == null) return null;
                  const name =
                    l.kind === "drug"
                      ? (item as Drug).name
                      : serviceName(item as Service);
                  const sub =
                    l.kind === "drug"
                      ? pastSig(l)
                      : `${medLabel((item as Service).category)} · ${medLabel(l.payment)}`;
                  const unit = unitLabel(
                    l.kind === "drug"
                      ? (item as Drug).pack
                      : (item as Service).unit,
                    l.qty,
                  );
                  return (
                    <View key={`${o.id}-${i}`}>
                      <View style={{ height: 1, backgroundColor: SEPARATOR }} />
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: SPACE.md,
                          paddingVertical: SPACE.md,
                        }}
                      >
                        <View
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: PRIMARY_100,
                          }}
                        >
                          {l.kind === "drug" ? (
                            <Pill
                              size={14}
                              color={PRIMARY_500}
                              strokeWidth={2.2}
                            />
                          ) : (
                            <Stethoscope
                              size={14}
                              color={PRIMARY_500}
                              strokeWidth={2.2}
                            />
                          )}
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text
                            numberOfLines={2}
                            style={{
                              fontSize: 14,
                              lineHeight: 20,
                              fontWeight: "600",
                              color: TEXT_PRIMARY,
                            }}
                          >
                            {name}
                          </Text>
                          <Text
                            style={{
                              fontSize: 13,
                              lineHeight: 18,
                              color: TEXT_SECONDARY,
                            }}
                          >
                            {sub}
                          </Text>
                          <Text
                            style={{ fontSize: 12, color: TEXT_MUTED }}
                          >{`${l.qty} ${unit} · ${baht(item.price * l.qty)}`}</Text>
                        </View>
                        <Pressable
                          onPress={() => reorder(`${o.id}-${i}`, l, name)}
                          accessibilityRole="button"
                          accessibilityLabel={
                            added.has(`${o.id}-${i}`)
                              ? tr("เพิ่มแล้ว", "Added")
                              : tr("สั่งซ้ำรายการนี้", "Repeat this item")
                          }
                          hitSlop={8}
                          style={({ pressed }) => ({
                            height: 32,
                            minWidth: 32,
                            paddingHorizontal: added.has(`${o.id}-${i}`)
                              ? SPACE.md
                              : 0,
                            borderRadius: 16,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                            backgroundColor: added.has(`${o.id}-${i}`)
                              ? SUCCESS
                              : PRIMARY_500,
                            opacity: pressed ? 0.6 : 1,
                            transform: [{ scale: pressed ? 0.92 : 1 }],
                          })}
                        >
                          {added.has(`${o.id}-${i}`) ? (
                            <>
                              <Check
                                size={16}
                                color="#FFFFFF"
                                strokeWidth={3}
                              />
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: "700",
                                  color: "#FFFFFF",
                                }}
                              >
                                {tr("เพิ่มแล้ว", "Added")}
                              </Text>
                            </>
                          ) : (
                            <Plus size={16} color="#FFFFFF" strokeWidth={2.8} />
                          )}
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </Card>
            );
          })}
        </ScrollView>
        <SnackBar message={notice} tone={noticeTone} />
      </View>
    </Modal>
  );
}

/* --------------------------------------------------------------- the sheet */

/**
 * Pick, then prescribe — two steps in one sheet.
 *
 * Step one is the list, searched, under a ยา / เวชภัณฑ์ switch. A tap goes
 * to step two on that item: for a medicine, the dose, how often, when and
 * for how long, all as chips, with the count and the price worked out
 * underneath; for a supply or service, just how many. Opened on an
 * existing line it starts on step two, filled in.
 */
function OrderSheet({
  open,
  allergies,
  onClose,
  onDone,
}: {
  open: { tab: "drug" | "service"; edit?: OrderLine } | null;
  allergies: string[];
  onClose: () => void;
  onDone: (line: OrderLine) => void;
}) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"drug" | "service">("drug");
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<OrderLine | null>(null);
  // The id of a line being swapped for another item, so the pick takes its
  // place on the order rather than joining it.
  const [swapId, setSwapId] = useState<string | null>(null);

  const reset = () => {
    setTab(open?.tab ?? "drug");
    setQ("");
    setDraft(open?.edit ?? null);
    setSwapId(null);
  };
  const swap = () => {
    if (draft == null) return;
    setSwapId(draft.id);
    setTab(draft.kind);
    setQ("");
    setDraft(null);
  };

  const drugHits = useMemo(() => searchDrugs(q), [q]);
  const serviceHits = useMemo(() => searchServices(q), [q]);
  const newId = () =>
    swapId ?? `${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

  const pickDrug = (d: Drug) =>
    setDraft({
      kind: "drug",
      id: newId(),
      drug: d,
      dose: 1,
      doseUnit: doseUnits(d.form)[0],
      frequency: "วันละ 3 ครั้ง",
      timing: "หลังอาหาร",
      days: 7,
      qty: packsFor(d, 1, doseUnits(d.form)[0], "วันละ 3 ครั้ง", 7),
      custom: "",
      note: "",
      prescriber: signedBy(),
    });
  const pickService = (s: Service) =>
    setDraft({
      kind: "service",
      id: newId(),
      service: s,
      qty: 1,
      payment: PAYMENTS[0],
      note: "",
      prescriber: signedBy(),
    });

  return (
    <Modal
      visible={open != null}
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
            paddingHorizontal: GUTTER,
            paddingTop: SPACE.lg,
          }}
        >
          <GlassIconButton
            onPress={() =>
              draft != null && open?.edit == null ? setDraft(null) : onClose()
            }
            accessibilityLabel={
              draft != null && open?.edit == null
                ? tr("กลับไปเลือกรายการ", "Back to items")
                : tr("ปิด", "Close")
            }
          >
            {draft != null && open?.edit == null ? (
              <ChevronLeft size={24} color={TEXT_PRIMARY} strokeWidth={2.4} />
            ) : (
              <X size={22} color={TEXT_PRIMARY} strokeWidth={2.6} />
            )}
          </GlassIconButton>
          <Text
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 16,
              fontWeight: "600",
              color: TEXT_PRIMARY,
            }}
          >
            {draft == null
              ? tr("เลือกรายการ", "Choose item")
              : draft.kind === "drug"
                ? tr("วิธีใช้ยา", "Directions")
                : tr("รายละเอียด", "Details")}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        {draft == null ? (
          <>
            <View
              style={{
                paddingHorizontal: GUTTER,
                paddingTop: SPACE.md,
                gap: SPACE.md,
                ...readable(FORM_MAX),
              }}
            >
              {/* UIKit's own segmented control, as the detail pages carry it:
                  on iOS 26 the selected segment is a sliding glass capsule.
                  The painted pair stands in where the module is absent. */}
              {SegmentedControlNative != null ? (
                <SegmentedControlNative
                  style={{ height: 32 }}
                  segments={TABS.map((t) => t.label)}
                  selectedIndex={TABS.findIndex((t) => t.key === tab)}
                  onSegmentChange={(e) =>
                    setTab(TABS[e.nativeEvent.index]?.key ?? tab)
                  }
                />
              ) : (
                <PaintedSegments
                  labels={TABS.map((t) => t.label)}
                  index={TABS.findIndex((t) => t.key === tab)}
                  onChange={(i) => setTab(TABS[i]?.key ?? tab)}
                />
              )}
              <SearchField
                value={q}
                onChangeText={setQ}
                placeholder={
                  tab === "drug"
                    ? tr("ค้นหาชื่อยา", "Search medications")
                    : tr("ค้นหาเวชภัณฑ์หรือบริการ", "Search supplies or services")
                }
                autoFocus
              />
            </View>
            <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
              <ScrollView
                contentContainerStyle={{
                  paddingVertical: SPACE.lg,
                  paddingHorizontal: GUTTER,
                  paddingBottom: insets.bottom + SPACE.xl,
                  ...readable(FORM_MAX),
                }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
              >
                <Card style={{ paddingVertical: 0 }}>
                  {tab === "drug"
                    ? drugHits.map((d, i) => {
                        const hit = allergyHit(d, allergies);
                        return (
                          <View key={d.code}>
                            {i > 0 && (
                              <View
                                style={{
                                  height: 1,
                                  backgroundColor: SEPARATOR,
                                }}
                              />
                            )}
                            <Pressable
                              onPress={() => pickDrug(d)}
                              accessibilityRole="button"
                              style={{ paddingVertical: SPACE.md, gap: 2 }}
                            >
                              <Text
                                style={{
                                  fontSize: 14,
                                  lineHeight: 20,
                                  fontWeight: "600",
                                  color: TEXT_PRIMARY,
                                }}
                              >
                                {d.name}
                              </Text>
                              <Text
                                style={{ fontSize: 12, color: TEXT_MUTED }}
                              >{`${drugGloss(d)} · ${baht(d.price)}/${unitLabel(d.pack)}`}</Text>
                              {hit != null && (
                                <Text
                                  style={{
                                    fontSize: 12,
                                    fontWeight: "700",
                                    color: DANGER,
                                  }}
                                >{tr(`⚠︎ ตรงกับประวัติแพ้: ${hit}`, `⚠︎ Matches allergy: ${hit}`)}</Text>
                              )}
                            </Pressable>
                          </View>
                        );
                      })
                    : serviceHits.map((s, i) => (
                        <View key={s.code}>
                          {i > 0 && (
                            <View
                              style={{ height: 1, backgroundColor: SEPARATOR }}
                            />
                          )}
                          <Pressable
                            onPress={() => pickService(s)}
                            accessibilityRole="button"
                            style={{ paddingVertical: SPACE.md, gap: 2 }}
                          >
                            <Text
                              style={{
                                fontSize: 14,
                                lineHeight: 20,
                                fontWeight: "600",
                                color: TEXT_PRIMARY,
                              }}
                            >
                              {serviceName(s)}
                            </Text>
                            <Text
                              style={{ fontSize: 12, color: TEXT_MUTED }}
                            >{`${medLabel(s.category)} · ${baht(s.price)}/${unitLabel(s.unit)}`}</Text>
                          </Pressable>
                        </View>
                      ))}
                  {(tab === "drug" ? drugHits : serviceHits).length === 0 && (
                    <Text
                      style={{
                        paddingVertical: SPACE.lg,
                        fontSize: 14,
                        color: TEXT_MUTED,
                      }}
                    >
                      {tr("ไม่พบรายการที่ตรงกับคำค้น", "No items match your search")}
                    </Text>
                  )}
                </Card>
              </ScrollView>
            </KeyboardAvoidingView>
          </>
        ) : draft.kind === "drug" ? (
          <DrugForm
            line={draft}
            allergies={allergies}
            onChange={setDraft}
            onDone={() => onDone(draft)}
            onSwap={swap}
            editing={open?.edit != null}
          />
        ) : (
          <ServiceForm
            line={draft}
            onChange={setDraft}
            onDone={() => onDone(draft)}
            onSwap={swap}
            editing={open?.edit != null}
          />
        )}
      </View>
    </Modal>
  );
}

/**
 * The medicine's instructions, built by tapping.
 *
 * Three cards, in the order a label is read: how much and how often; for
 * how long and therefore how many; then the label itself, worked out from
 * the answers, with the price beside it. The choices are laid in equal
 * columns so the eye runs down them rather than across a ragged wrap.
 */
function DrugForm({
  line,
  allergies,
  onChange,
  onDone,
  onSwap,
  editing,
}: {
  line: DrugLine;
  allergies: string[];
  onChange: (l: DrugLine) => void;
  onDone: () => void;
  onSwap: () => void;
  editing: boolean;
}) {
  const insets = useSafeAreaInsets();
  const units = doseUnits(line.drug.form);
  const hit = allergyHit(line.drug, allergies);
  const custom = line.custom !== "" || line.frequency === "";

  // Every change to the instructions re-counts the packs; the count stays
  // editable after, for the day the box holds ten and the course needs nine.
  const set = (patch: Partial<DrugLine>, recount = true) => {
    const next = { ...line, ...patch };
    onChange(
      recount
        ? {
            ...next,
            qty: packsFor(
              next.drug,
              next.dose,
              next.doseUnit,
              next.frequency,
              next.days,
            ),
          }
        : next,
    );
  };
  const step = line.drug.form === "TAB" ? 0.5 : 1;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          paddingVertical: SPACE.lg,
          paddingHorizontal: GUTTER,
          gap: SPACE.md,
          paddingBottom: insets.bottom + 110,
          ...readable(FORM_MAX),
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <ItemCard
          icon={<Pill size={20} color={PRIMARY_500} strokeWidth={2.2} />}
          name={line.drug.name}
          gloss={drugGloss(line.drug)}
          meta={[
            `${baht(line.drug.price)} / ${unitLabel(line.drug.pack)}`,
            line.drug.form,
          ]}
          warn={
            hit != null
              ? tr(`มีประวัติแพ้ "${hit}" ตรวจสอบก่อนสั่ง`, `Allergy to "${hit}" on record. Check before ordering.`)
              : null
          }
          onSwap={onSwap}
        />

        {/* How much, how often, when. */}
        <Card style={{ gap: SPACE.lg }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text
              style={{
                flex: 1,
                fontSize: 14,
                fontWeight: "700",
                color: TEXT_PRIMARY,
              }}
            >
              {tr("วิธีใช้", "Directions")}
            </Text>
            <Pressable
              onPress={() =>
                custom
                  ? set({ custom: "", frequency: "วันละ 3 ครั้ง" })
                  : set({ custom: " " }, false)
              }
              accessibilityRole="switch"
              accessibilityState={{ checked: custom }}
              style={{
                paddingHorizontal: SPACE.md,
                paddingVertical: 6,
                borderRadius: RADIUS.capsule,
                backgroundColor: custom ? PRIMARY_500 : GROUPED_BG,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: custom ? "#FFFFFF" : TEXT_SECONDARY,
                }}
              >
                {tr("พิมพ์วิธีใช้เอง", "Type directions")}
              </Text>
            </Pressable>
          </View>

          {custom ? (
            <NoteField
              label={tr("วิธีใช้ (พิมพ์เอง)", "Directions (typed)")}
              value={line.custom.trimStart()}
              onChangeText={(v) => set({ custom: v === "" ? " " : v }, false)}
              placeholder={tr("เช่น ทา บริเวณที่เป็น วันละ 2 ครั้ง เช้า-เย็น", "e.g. Apply to affected area twice daily, morning and evening")}
              lines={3}
            />
          ) : (
            <>
              <Stepper
                label={tr("ขนาดต่อครั้ง", "Dose")}
                value={line.dose}
                step={step}
                min={step}
                unit={unitLabel(line.doseUnit, line.dose)}
                onChange={(v) => set({ dose: v })}
              />
              {units.length > 1 && (
                <ChipGrid
                  label={tr("หน่วย", "Unit")}
                  options={units}
                  value={line.doseUnit}
                  columns={3}
                  onChange={(v) => set({ doseUnit: v })}
                />
              )}
              <ChipGrid
                label={tr("ความถี่", "Frequency")}
                options={FREQUENCIES.map((f) => f.label)}
                value={line.frequency}
                columns={3}
                onChange={(v) => set({ frequency: v })}
              />
              <ChipGrid
                label={tr("เวลา", "Timing")}
                options={[...TIMINGS]}
                value={line.timing}
                columns={3}
                onChange={(v) => set({ timing: v }, false)}
              />
            </>
          )}
        </Card>

        {/* For how long, and so how many — and what that comes to. */}
        <Card style={{ gap: SPACE.lg }}>
          <View style={{ flexDirection: "row", gap: SPACE.md }}>
            {!custom && (
              <View style={{ flex: 1 }}>
                <Stepper
                  label={tr("จำนวนวัน", "Days")}
                  value={line.days}
                  step={1}
                  min={1}
                  unit={tr("วัน", line.days === 1 ? "day" : "days")}
                  onChange={(v) => set({ days: v })}
                />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Stepper
                label={tr("จำนวนจ่าย", "Quantity")}
                value={line.qty}
                step={1}
                min={1}
                unit={unitLabel(line.drug.pack, line.qty)}
                onChange={(v) => set({ qty: v }, false)}
              />
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: SEPARATOR }} />
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ flex: 1, fontSize: 14, color: TEXT_SECONDARY }}>
              {tr("ราคารวม", "Total")}
            </Text>
            <Text
              style={{ fontSize: 20, fontWeight: "800", color: TEXT_PRIMARY }}
            >
              {baht(lineTotal(line))}
            </Text>
          </View>
          {/* The label as it will print, on its own pale plate. */}
          <View
            style={{
              borderRadius: RADIUS.card,
              backgroundColor: PRIMARY_100,
              padding: SPACE.md,
              gap: 2,
            }}
          >
            <Text
              style={{ fontSize: 12, fontWeight: "600", color: PRIMARY_700 }}
            >
              {tr("ฉลากยา", "Label")}
            </Text>
            <Text
              style={{
                fontSize: 15,
                lineHeight: 22,
                fontWeight: "600",
                color: PRIMARY_700,
              }}
            >
              {sigOf(line) || "—"}
            </Text>
          </View>
        </Card>

        <Card style={{ gap: SPACE.lg }}>
          <NoteField
            label={tr("คำแนะนำเพิ่มเติม (ถ้ามี)", "Additional advice (optional)")}
            value={line.note}
            onChangeText={(v) => set({ note: v }, false)}
            placeholder={tr("เช่น ดื่มน้ำตามมากๆ งดขับรถ", "e.g. Drink plenty of water, don't drive")}
            lines={2}
          />
          <Prescriber />
        </Card>
      </ScrollView>

      <ActionBar>
        <PrimaryAction
          label={editing ? tr("บันทึกการแก้ไข", "Save changes") : tr("เพิ่มลงใบสั่งยา", "Add to order")}
          onPress={onDone}
        />
      </ActionBar>
    </KeyboardAvoidingView>
  );
}

/** A supply or a service: how many, who pays, who ordered. */
function ServiceForm({
  line,
  onChange,
  onDone,
  onSwap,
  editing,
}: {
  line: ServiceLine;
  onChange: (l: ServiceLine) => void;
  onDone: () => void;
  onSwap: () => void;
  editing: boolean;
}) {
  const insets = useSafeAreaInsets();
  const set = (patch: Partial<ServiceLine>) => onChange({ ...line, ...patch });
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          paddingVertical: SPACE.lg,
          paddingHorizontal: GUTTER,
          gap: SPACE.md,
          paddingBottom: insets.bottom + 100,
          ...readable(FORM_MAX),
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <ItemCard
          icon={<Stethoscope size={20} color={PRIMARY_500} strokeWidth={2.2} />}
          name={serviceName(line.service)}
          gloss={medLabel(line.service.category)}
          meta={[`${baht(line.service.price)}/${unitLabel(line.service.unit)}`]}
          onSwap={onSwap}
        />
        <Card style={{ gap: SPACE.lg }}>
          <View
            style={{
              flexDirection: "row",
              gap: SPACE.md,
              alignItems: "flex-end",
            }}
          >
            <View style={{ flex: 1 }}>
              <Stepper
                label={tr(`จำนวน (${line.service.unit})`, `Quantity (${unitLabel(line.service.unit, 2)})`)}
                value={line.qty}
                step={1}
                min={1}
                onChange={(v) => set({ qty: v })}
              />
            </View>
            <View style={{ flex: 1, gap: 4, paddingBottom: 6 }}>
              <Text style={{ fontSize: 12, color: TEXT_MUTED }}>{tr("ราคารวม", "Total")}</Text>
              <Text
                style={{ fontSize: 20, fontWeight: "800", color: TEXT_PRIMARY }}
              >
                {baht(lineTotal(line))}
              </Text>
            </View>
          </View>
          <Chips
            label={tr("การชำระเงิน", "Payment")}
            options={[...PAYMENTS]}
            value={line.payment}
            onChange={(v) => set({ payment: v })}
          />
          <NoteField
            label={tr("หมายเหตุ (ถ้ามี)", "Note (optional)")}
            value={line.note}
            onChangeText={(v) => set({ note: v })}
            placeholder={tr("รายละเอียดเพิ่มเติม", "More details")}
            lines={2}
          />
          <Prescriber />
        </Card>
      </ScrollView>
      <ActionBar>
        <PrimaryAction
          label={editing ? tr("บันทึกการแก้ไข", "Save changes") : tr("เพิ่มลงใบสั่ง", "Add to order")}
          onPress={onDone}
        />
      </ActionBar>
    </KeyboardAvoidingView>
  );
}

/* --------------------------------------------------------------- controls */

/** The item at the head of the form: glyph, name and gloss, and "เปลี่ยน" at the end. */
function ItemCard({
  icon,
  name,
  gloss,
  meta,
  warn,
  onSwap,
}: {
  icon: React.ReactNode;
  name: string;
  gloss: string;
  meta: string[];
  warn?: string | null;
  onSwap: () => void;
}) {
  return (
    <Card
      onPress={onSwap}
      style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: PRIMARY_100,
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text
          style={{
            fontSize: 15,
            lineHeight: 21,
            fontWeight: "700",
            color: TEXT_PRIMARY,
          }}
        >
          {name}
        </Text>
        <Text
          style={{ fontSize: 13, color: TEXT_MUTED }}
        >{`${gloss} · ${meta[0] ?? ""}`}</Text>
        {warn != null && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 2,
            }}
          >
            <TriangleAlert size={14} color={DANGER} strokeWidth={2.4} />
            <Text
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: "700",
                color: DANGER,
              }}
            >
              {warn}
            </Text>
          </View>
        )}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: PRIMARY_500 }}>
          {tr("เปลี่ยน", "Change")}
        </Text>
        <ChevronRight size={16} color={PRIMARY_500} strokeWidth={2.4} />
      </View>
    </Card>
  );
}

/**
 * The prescriber, as a field that cannot be typed in: it is whoever is
 * signed in, whatever the line said before — a repeat from the history is
 * this carer's order now.
 */
function Prescriber() {
  const name = signedBy();
  return (
    <View style={{ gap: SPACE.sm }}>
      <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>{tr("ผู้สั่ง", "Prescriber")}</Text>
      <View
        style={{
          minHeight: 48,
          borderRadius: RADIUS.capsule,
          backgroundColor: GROUPED_BG,
          paddingHorizontal: SPACE.lg,
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.sm,
        }}
      >
        <UserRound size={18} color={TEXT_SECONDARY} strokeWidth={2.2} />
        <Text style={{ flex: 1, fontSize: 16, color: TEXT_PRIMARY }}>{name}</Text>
      </View>
    </View>
  );
}

/** One of a few, in equal columns so the rows line up. */
function ChipGrid({
  label,
  options,
  value,
  columns,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  columns: number;
  onChange: (v: string) => void;
}) {
  const rows: string[][] = [];
  for (let i = 0; i < options.length; i += columns)
    rows.push(options.slice(i, i + columns));
  return (
    <View style={{ gap: SPACE.sm }}>
      <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>
        {label}
      </Text>
      <View style={{ gap: SPACE.sm }}>
        {rows.map((row, r) => (
          <View key={r} style={{ flexDirection: "row", gap: SPACE.sm }}>
            {row.map((o) => {
              const on = value === o;
              return (
                <ChoiceChip
                  key={o}
                  label={medLabel(o)}
                  on={on}
                  onPress={() => onChange(o)}
                  numberOfLines={1}
                  style={{ flex: 1 }}
                  contentStyle={{
                    height: 40,
                    paddingHorizontal: 0,
                    paddingVertical: 0,
                  }}
                />
              );
            })}
            {/* Keep a short last row on the grid. */}
            {row.length < columns &&
              Array.from({ length: columns - row.length }).map((_, i) => (
                <View key={`pad-${i}`} style={{ flex: 1 }} />
              ))}
          </View>
        ))}
      </View>
    </View>
  );
}

/** One of a few, as capsules. */
function Chips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
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
              label={medLabel(o)}
              on={on}
              onPress={() => onChange(o)}
              contentStyle={{ paddingHorizontal: SPACE.md, paddingVertical: 8 }}
            />
          );
        })}
      </View>
    </View>
  );
}
