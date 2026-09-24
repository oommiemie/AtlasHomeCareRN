import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Check,
  CircleCheck,
  History,
  Info,
  ListChecks,
  TriangleAlert,
  X,
} from "lucide-react-native";

import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { Card } from "../components/Card";
import { CardHeading } from "../components/CardAction";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ReasonSheet } from "../components/ReasonSheet";
import { ScreenHeader } from "../components/ScreenHeader";
import { ToolbarPill } from "../components/ToolbarPill";
import { StatusTag } from "../components/StatusTag";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  ABSENT_REASONS,
  REFUSED_REASONS,
  setDspm,
  setOutcome,
  useSession,
} from "../models/vaccination";
import { ageLabel } from "../models/growth";
import {
  assess,
  DOMAIN_LABEL,
  LEVEL_LABEL,
  nextWindowAfter,
  planFor,
  SOURCE_NOTE,
  windowFor,
  windowsUpTo,
  type Answers,
  type Domain,
  type DspmLevel,
  type Window,
} from "../models/dspm";
import { feel } from "../utils/haptics";
import {
  CANVAS,
  DANGER_INK,
  FILL_SUBTLE,
  GROUPED_BG,
  INK_OK,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  WARNING,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type R = RouteProp<RootStackParamList, "DspmRecord">;

/** The ink each verdict is read in — the app's three, as everywhere else. */
const LEVEL_INK: Record<DspmLevel, string> = {
  onTrack: INK_OK,
  suspect: WARNING,
  delayed: DANGER_INK,
};

/**
 * "บันทึกผลพัฒนาการ" — one child, screened against their own age window.
 *
 * The weighing form takes four numbers off a scale. This one takes a set of
 * yes-or-no answers about things a child can or cannot yet do, and the
 * whole design problem is which set: DSPM has seventeen windows and over a
 * hundred items, and asking all of them would take an afternoon a child. So
 * the page opens on the window the child's birthday puts them in, shows
 * only the items due in it, and says so — the earlier windows are chips
 * beside it for a carer who needs to go back and clear something that was
 * left outstanding.
 *
 * Every item is one row and two buttons. Not a checkbox: "ทำได้" and
 * "ทำไม่ได้" are two different statements and an unticked box is neither of
 * them — a screening where "not answered" and "cannot do" look the same is
 * a screening that refers children who were never asked.
 */
export function DspmRecordScreen() {
  const nav = useNavigation<Nav>();
  const { targetId } = useRoute<R>().params;
  const insets = useSafeAreaInsets();
  const { session } = useSession();

  const row = session?.rows.find((r) => r.target.id === targetId);
  const target = row?.target;
  const was = row?.dspm;
  const months = target?.months ?? 0;

  /*
    The window the child is due, and the one being worked on.

    They are not always the same: a carer clearing an item left outstanding
    at forty-eight months is working on forty-eight while the child is
    sixty. The due one is what the page opens on, because that is what the
    round is for.
  */
  const due = useMemo(() => windowFor(months), [months]);
  const earlier = useMemo(() => windowsUpTo(months), [months]);
  const [at, setAt] = useState<number>(was?.window ?? due?.months ?? 0);
  const window: Window | null =
    earlier.find((w) => w.months === at) ?? due ?? null;

  const [answers, setAnswers] = useState<Answers>(was?.answers ?? {});
  const [asking, setAsking] = useState<"absent" | "refused" | null>(null);

  /*
    Which time round this is.

    A missed item on the first screening is "สงสัยล่าช้า" and the child
    comes back in a month; the same miss on the second is "ล่าช้า" and goes
    for referral. So the round is part of the verdict, not a note beside it.
  */
  const round = was == null ? 1 : was.round;

  const result = useMemo(
    () => (window == null ? null : assess(window, answers, round)),
    [window, answers, round],
  );

  const plan = useMemo(
    () =>
      result == null
        ? null
        : planFor(result, new Date(), nextWindowAfter(result.window)),
    [result],
  );

  if (session == null || row == null || target == null) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="บันทึกผลพัฒนาการ" />
        <Text
          style={{ padding: SPACE.lg, fontSize: 15, color: TEXT_SECONDARY }}
        >
          ไม่พบรายชื่อนี้ใน Session ที่เปิดอยู่
        </Text>
      </View>
    );
  }

  if (window == null) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="บันทึกผลพัฒนาการ" />
        <Text
          style={{
            padding: SPACE.lg,
            fontSize: 15,
            lineHeight: 24,
            color: TEXT_SECONDARY,
          }}
        >
          {`${target.name} อายุ ${ageLabel(months)} ยังไม่ถึงช่วงอายุประเมินแรกของ DSPM`}
        </Text>
      </View>
    );
  }

  const answer = (no: number, pass: boolean) => {
    feel("tick");
    setAnswers((all) => ({ ...all, [no]: pass }));
  };

  const passAll = () => {
    feel("success");
    setAnswers(
      Object.fromEntries(window.items.map((i) => [i.no, true])) as Answers,
    );
  };

  const done = result != null && result.answered === result.total;

  const save = () => {
    if (result == null || !done) return;
    setDspm(target.id, {
      window: result.window,
      round,
      answers,
      passed: result.passed,
      total: result.total,
      failed: result.failed,
      level: result.level,
      label: result.label,
      at: new Date().toISOString(),
    });
    feel("success");
    toast(`บันทึก ${target.name} · ${result.label}`, "success");
    nav.goBack();
  };

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      {/* The past, behind a button rather than under the form — the same
          place the weighing form keeps it, and for the same two reasons:
          it is four sections between a carer and the items, and it is the
          wrong place to read it from. */}
      <ScreenHeader
        title="บันทึกผลพัฒนาการ"
        right={
          <ToolbarPill
            slots={[
              {
                icon: (
                  <History size={20} color={TEXT_PRIMARY} strokeWidth={2.2} />
                ),
                label: "ประวัติการคัดกรอง",
                onPress: () =>
                  nav.navigate("DspmHistory", { targetId: target.id }),
              },
            ]}
          />
        }
      />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: SPACE.lg,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + 120,
            gap: SPACE.md,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Who is being screened. */}
          <Card style={{ gap: SPACE.sm }}>
            <Text
              style={{
                fontSize: 20,
                lineHeight: 30,
                fontWeight: "800",
                color: TEXT_PRIMARY,
              }}
            >
              {target.name}
            </Text>
            <Text
              style={{ fontSize: 13, lineHeight: 20, color: TEXT_SECONDARY }}
            >
              {`${target.sex} · ${ageLabel(months)} · HN ${target.hn}`}
            </Text>
            <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
              {target.room}
            </Text>

            <View
              style={{
                height: 1,
                backgroundColor: SEPARATOR,
                marginTop: SPACE.xs,
              }}
            />
            <View style={{ flexDirection: "row", gap: SPACE.sm }}>
              <Chip
                label="ไม่มารับบริการ"
                onPress={() => {
                  feel("tick");
                  setAsking("absent");
                }}
              />
              <Chip
                label="ปฏิเสธ"
                onPress={() => {
                  feel("tick");
                  setAsking("refused");
                }}
              />
            </View>
          </Card>

          {/* The window ---------------------------------------------- */}
          <Card style={{ gap: SPACE.lg }}>
            <CardHeading
              icon={
                <ListChecks size={13} color={PRIMARY_500} strokeWidth={2.4} />
              }
              title="ช่วงอายุประเมิน"
              action={
                round > 1 ? (
                  <StatusTag
                    label={`ประเมินซ้ำครั้งที่ ${round}`}
                    ink={WARNING}
                  />
                ) : undefined
              }
            />
            <View
              style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}
            >
              {earlier.map((w) => (
                <Chip
                  key={w.months}
                  label={`${w.months} เดือน`}
                  on={w.months === at}
                  onPress={() => {
                    feel("tick");
                    setAt(w.months);
                    // The answers belong to the window they were given in.
                    setAnswers(
                      w.months === was?.window ? (was?.answers ?? {}) : {},
                    );
                  }}
                />
              ))}
            </View>
            <Text style={{ fontSize: 12, lineHeight: 19, color: TEXT_MUTED }}>
              {`ระบบเลือกช่วงอายุ ${due?.months ?? window.months} เดือนให้ตามวันเกิด — แสดงเฉพาะข้อที่ต้องประเมินในช่วงนี้ (${window.items.length} ข้อ) ไม่ใช่รายการทั้งชุด · ประเมินแล้ว ${result?.answered ?? 0}/${window.items.length} ข้อ`}
            </Text>
          </Card>

          {/* The items, by domain ------------------------------------- */}
          <Card style={{ gap: SPACE.lg }} padded>
            <CardHeading
              icon={
                <CircleCheck size={13} color={PRIMARY_500} strokeWidth={2.4} />
              }
              title="ข้อประเมินตามช่วงอายุ"
              action={
                <Pressable onPress={passAll} hitSlop={8}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: PRIMARY_500,
                    }}
                  >
                    ผ่านทั้งหมด
                  </Text>
                </Pressable>
              }
            />

            {result?.byDomain.map((d) => (
              <View key={d.domain} style={{ gap: SPACE.sm }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.sm,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "800",
                      color: PRIMARY_500,
                    }}
                  >
                    {d.domain}
                  </Text>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 13,
                      lineHeight: 21,
                      color: TEXT_SECONDARY,
                    }}
                  >
                    {DOMAIN_LABEL[d.domain]}
                  </Text>
                  {d.answered && (
                    <StatusTag
                      label={d.pass ? "ผ่าน" : "ไม่ผ่าน"}
                      ink={d.pass ? INK_OK : DANGER_INK}
                    />
                  )}
                </View>

                {window.items
                  .filter((i) => i.domain === d.domain)
                  .map((i, k) => (
                    /*
                      No box around an item.

                      Each one was a grey rounded panel holding two grey
                      buttons, which is a box inside a box inside a card —
                      three nested surfaces to say one sentence and offer
                      two answers. A hairline is enough to separate one item
                      from the next, and it leaves the buttons as the only
                      filled things on the card, which is what they should
                      be: they are the only part of it that does anything.
                    */
                    <View
                      key={i.no}
                      style={{
                        gap: SPACE.sm,
                        paddingTop: k === 0 ? 0 : SPACE.md,
                        borderTopWidth: k === 0 ? 0 : 1,
                        borderTopColor: SEPARATOR,
                      }}
                    >
                      <View style={{ flexDirection: "row", gap: SPACE.sm }}>
                        <Text
                          style={{
                            fontSize: 12,
                            lineHeight: 20,
                            fontWeight: "700",
                            color: TEXT_MUTED,
                            fontVariant: ["tabular-nums"],
                          }}
                        >
                          {i.no}
                        </Text>
                        <Text
                          style={{
                            flex: 1,
                            fontSize: 14,
                            lineHeight: 22,
                            color: TEXT_PRIMARY,
                          }}
                        >
                          {i.text}
                        </Text>
                      </View>

                      {/*
                        Two answers, not a tick.

                        "ทำได้" and "ทำไม่ได้" are two different statements
                        about a child, and an untouched checkbox is neither
                        of them. A form where "not asked" looks like "cannot
                        do" is a form that refers children nobody screened.
                      */}
                      <View style={{ flexDirection: "row", gap: SPACE.sm }}>
                        <Answer
                          label="ทำได้"
                          Icon={Check}
                          on={answers[i.no] === true}
                          ink={INK_OK}
                          onPress={() => answer(i.no, true)}
                        />
                        <Answer
                          label="ทำไม่ได้"
                          Icon={X}
                          on={answers[i.no] === false}
                          ink={DANGER_INK}
                          onPress={() => answer(i.no, false)}
                        />
                      </View>
                    </View>
                  ))}
              </View>
            ))}

            <View
              style={{
                flexDirection: "row",
                gap: SPACE.sm,
                padding: SPACE.md,
                borderRadius: RADIUS.md,
                backgroundColor: FILL_SUBTLE,
              }}
            >
              <Info
                size={14}
                color={TEXT_MUTED}
                strokeWidth={2.2}
                style={{ marginTop: 2 }}
              />
              <Text
                style={{
                  flex: 1,
                  fontSize: 12,
                  lineHeight: 18,
                  color: TEXT_MUTED,
                }}
              >
                {SOURCE_NOTE}
              </Text>
            </View>
          </Card>

          {/* The verdict ---------------------------------------------- */}
          {result != null && (
            <Card style={{ gap: SPACE.lg }}>
              <CardHeading
                icon={
                  <TriangleAlert
                    size={13}
                    color={PRIMARY_500}
                    strokeWidth={2.4}
                  />
                }
                title="ผลคัดกรองพัฒนาการ"
                action={
                  done ? (
                    <StatusTag
                      label={LEVEL_LABEL[result.level]}
                      ink={LEVEL_INK[result.level]}
                      Icon={
                        result.level === "onTrack" ? CircleCheck : TriangleAlert
                      }
                    />
                  ) : undefined
                }
              />

              <Text style={{ fontSize: 13, lineHeight: 21, color: TEXT_MUTED }}>
                {done
                  ? result.failed.length === 0
                    ? `ผ่านทุกข้อในช่วง ${result.window} เดือน`
                    : `ไม่ผ่าน ${result.failed.length} ด้าน ในช่วง ${result.window} เดือน`
                  : `ประเมินแล้ว ${result.answered}/${result.total} ข้อ — ตอบให้ครบเพื่อสรุปผล`}
              </Text>

              {/* The five domains as a strip, which is how the manual's own
                  summary line reads. */}
              <View style={{ flexDirection: "row" }}>
                {result.byDomain.map((d) => (
                  <View key={d.domain} style={{ flex: 1, gap: 2 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "800",
                        color: TEXT_PRIMARY,
                      }}
                    >
                      {d.domain}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: d.answered && !d.pass ? "700" : "400",
                        color: !d.answered
                          ? TEXT_MUTED
                          : d.pass
                            ? INK_OK
                            : DANGER_INK,
                      }}
                    >
                      {!d.answered ? "—" : d.pass ? "ผ่าน" : "ไม่ผ่าน"}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {/* And what happens next ------------------------------------ */}
          {plan != null && done && (
            <Card style={{ gap: SPACE.lg }}>
              <CardHeading
                icon={
                  <ListChecks size={13} color={PRIMARY_500} strokeWidth={2.4} />
                }
                title="แผนดำเนินการที่ระบบเตรียมไว้"
              />
              <View
                style={{
                  flexDirection: "row",
                  gap: SPACE.sm,
                  alignItems: "flex-start",
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    marginTop: 7,
                    backgroundColor: LEVEL_INK[plan.level],
                  }}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      lineHeight: 23,
                      fontWeight: "700",
                      color: LEVEL_INK[plan.level],
                    }}
                  >
                    {plan.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      lineHeight: 21,
                      color: TEXT_SECONDARY,
                    }}
                  >
                    {plan.detail}
                  </Text>
                </View>
              </View>
            </Card>
          )}
        </ScrollView>
      </HeaderFade>

      <ActionBar>
        <PrimaryAction
          label={
            !done
              ? `ประเมินให้ครบ ${result?.total ?? 0} ข้อ`
              : `บันทึกผลพัฒนาการ · ${result?.label ?? ""}`
          }
          disabled={!done}
          onPress={save}
        />
      </ActionBar>

      <ReasonSheet
        visible={asking != null}
        title={asking === "absent" ? "ไม่มารับบริการ" : "ปฏิเสธรับบริการ"}
        name={target.name}
        who={`HN ${target.hn} · ${target.sex} · ${ageLabel(months)}`}
        reasons={asking === "absent" ? ABSENT_REASONS : REFUSED_REASONS}
        question={
          asking === "absent" ? "สาเหตุที่ไม่มารับบริการ" : "สาเหตุที่ปฏิเสธ"
        }
        confirmLabel={
          asking === "absent" ? "บันทึกไม่มารับบริการ" : "บันทึกปฏิเสธ"
        }
        note="สาเหตุจะถูกเก็บไว้กับรายชื่อนี้ และใช้จัดคิวติดตามรอบหน้า"
        onClose={() => setAsking(null)}
        onConfirm={(reason) => {
          if (asking == null) return;
          setOutcome(target.id, asking, reason);
          feel("tick");
          setAsking(null);
          nav.goBack();
        }}
      />
    </View>
  );
}

/** One of the two answers to an item. */
function Answer({
  label,
  Icon,
  on,
  ink,
  onPress,
}: {
  label: string;
  Icon: typeof Check;
  on: boolean;
  ink: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: SPACE.xs,
        paddingVertical: 9,
        borderRadius: RADIUS.capsule,
        backgroundColor: on ? ink : GROUPED_BG,
      }}
    >
      <Icon
        size={14}
        color={on ? "#FFFFFF" : TEXT_MUTED}
        strokeWidth={on ? 3 : 2.4}
      />
      <Text
        style={{
          fontSize: 14,
          lineHeight: 22,
          fontWeight: on ? "700" : "400",
          color: on ? "#FFFFFF" : TEXT_PRIMARY,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** The app's standard choice chip, as the weighing form draws one. */
function Chip({
  label,
  on = false,
  onPress,
}: {
  label: string;
  on?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
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
          lineHeight: 22,
          fontWeight: on ? "600" : "400",
          color: on ? "#FFFFFF" : TEXT_PRIMARY,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
