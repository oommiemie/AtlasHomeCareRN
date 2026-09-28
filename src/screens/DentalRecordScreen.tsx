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
  CircleCheck,
  ClipboardCheck,
  Hash,
  Minus,
  Plus,
  Sparkle,
  TriangleAlert,
} from "lucide-react-native";

import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { Card } from "../components/Card";
import { CardHeading } from "../components/CardAction";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { StatusTag } from "../components/StatusTag";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  adviceFor,
  assess,
  EMPTY_FINDING,
  type DentalFinding,
  type DentalLevel,
} from "../models/dental";
import { ageLabel } from "../models/growth";
import {
  nextWaiting,
  placeOf,
  setDental,
  useSession,
} from "../models/vaccination";
import { feel } from "../utils/haptics";
import {
  CANVAS,
  DANGER_INK,
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

type R = RouteProp<RootStackParamList, "DentalRecord">;
type Nav = NativeStackNavigationProp<RootStackParamList>;

const LEVEL_INK: Record<DentalLevel, string> = {
  normal: INK_OK,
  watch: WARNING,
  refer: DANGER_INK,
};

/**
 * "บันทึกตรวจสุขภาพช่องปาก" — one child at a school dental round.
 *
 * Counts and two decisions, which is all a school survey is. Everything is
 * a tap: a carer doing this has a mirror in one hand and a phone balanced
 * somewhere, and a keyboard is the thing they cannot reach. The verdict
 * works itself out as the counts go up, so nobody has to remember where
 * the referral line is while a child is sitting in front of them.
 */
export function DentalRecordScreen() {
  const { targetId } = useRoute<R>().params;
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { session } = useSession();

  const row = session?.rows.find((r) => r.target.id === targetId);
  const target = row?.target;
  const [f, setF] = useState<DentalFinding>(() => row?.dental ?? EMPTY_FINDING);

  const verdict = useMemo(() => assess(f), [f]);
  const advice = useMemo(() => adviceFor(f), [f]);
  const place = placeOf(targetId);

  if (target == null || session == null) {
    return (
      <View style={{ flex: 1, backgroundColor: CANVAS }}>
        <ScreenHeader title="บันทึกตรวจสุขภาพช่องปาก" />
        <Text
          style={{ padding: SPACE.lg, fontSize: 15, color: TEXT_SECONDARY }}
        >
          ไม่พบรายชื่อนี้ใน Session ที่เปิดอยู่
        </Text>
      </View>
    );
  }

  const save = () => {
    feel("success");
    setDental(targetId, {
      ...f,
      level: verdict.level,
      label: verdict.label,
      place: session.activity.place,
      at: new Date().toISOString(),
    });
    const next = nextWaiting(targetId);
    const tone = verdict.level === "refer" ? "warning" : "success";
    if (next == null) {
      // The last child's own word folds into this one, so only one shows.
      toast(
        tone === "warning"
          ? `บันทึกครบทุกคนแล้ว · ${target.name} · ${verdict.label}`
          : "บันทึกครบทุกคนแล้ว",
        tone,
      );
      nav.goBack();
      return;
    }
    toast(`บันทึก ${target.name} · ${verdict.label}`, tone);
    // Straight on to the next child: a carer works down a class without
    // going back to the list between names.
    nav.replace("DentalRecord", { targetId: next.id });
  };

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <ScreenHeader title="บันทึกตรวจสุขภาพช่องปาก" />

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
          <Card style={{ gap: SPACE.xs }}>
            <Text
              style={{
                fontSize: 20,
                lineHeight: 31,
                fontWeight: "700",
                color: TEXT_PRIMARY,
              }}
            >
              {target.name}
            </Text>
            <Text
              style={{ fontSize: 13, lineHeight: 21, color: TEXT_SECONDARY }}
            >
              {`${target.sex} · ${ageLabel(target.months)} · HN ${target.hn}`}
            </Text>
            <Text style={{ fontSize: 12, lineHeight: 19, color: TEXT_MUTED }}>
              {place == null
                ? target.room
                : `${target.room} · คนที่ ${place.at} จาก ${place.of}`}
            </Text>
          </Card>

          <Card style={{ gap: SPACE.md }}>
            <CardHeading
              icon={<Hash size={16} color={PRIMARY_500} />}
              title="1 · นับซี่ฟัน"
            />
            <Count
              label="ฟันน้ำนมผุ"
              value={f.decayedMilk}
              onChange={(n) => setF({ ...f, decayedMilk: n })}
            />
            <Count
              label="ฟันแท้ผุ"
              value={f.decayedAdult}
              onChange={(n) => setF({ ...f, decayedAdult: n })}
            />
            <Count
              label="อุด/ถอนแล้ว"
              value={f.treated}
              onChange={(n) => setF({ ...f, treated: n })}
            />
          </Card>

          <Card style={{ gap: SPACE.sm }}>
            <CardHeading
              icon={<Sparkle size={16} color={PRIMARY_500} />}
              title="2 · สภาพเหงือกและบริการที่ให้"
            />
            <Toggle
              label="เหงือกอักเสบ"
              on={f.gingivitis}
              onPress={() => setF({ ...f, gingivitis: !f.gingivitis })}
            />
            <Toggle
              label="มีหินปูน"
              on={f.calculus}
              onPress={() => setF({ ...f, calculus: !f.calculus })}
            />
            <Toggle
              label="เคลือบฟลูออไรด์วันนี้"
              on={f.varnish}
              onPress={() => setF({ ...f, varnish: !f.varnish })}
            />
            <Toggle
              label="เคลือบหลุมร่องฟัน"
              on={f.sealant}
              onPress={() => setF({ ...f, sealant: !f.sealant })}
            />
          </Card>

          <Card style={{ gap: SPACE.sm }}>
            <CardHeading
              icon={<ClipboardCheck size={16} color={PRIMARY_500} />}
              title="3 · ผลตรวจและคำแนะนำ"
            />
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
                  fontSize: 15,
                  lineHeight: 24,
                  color: TEXT_SECONDARY,
                }}
              >
                {verdict.why.length === 0
                  ? "ไม่พบความผิดปกติ"
                  : verdict.why.join(" · ")}
              </Text>
              <StatusTag
                label={verdict.label}
                ink={LEVEL_INK[verdict.level]}
                Icon={verdict.level === "normal" ? CircleCheck : TriangleAlert}
              />
            </View>
            <View style={{ height: 1, backgroundColor: SEPARATOR }} />
            {advice.map((a) => (
              <Text
                key={a}
                style={{ fontSize: 14, lineHeight: 22, color: TEXT_SECONDARY }}
              >
                {`• ${a}`}
              </Text>
            ))}
          </Card>
        </ScrollView>
      </HeaderFade>

      <ActionBar>
        <PrimaryAction label="บันทึกและไปคนถัดไป" onPress={save} />
      </ActionBar>
    </View>
  );
}

/**
 * A count, changed by tapping rather than typing.
 *
 * Nobody with a mirror in one hand opens a number pad. The figures here
 * are small — a mouth holds twenty teeth and a survey rarely counts past
 * six — so two targets and a numeral are quicker than a keyboard and
 * cannot produce a typo the register would have to carry.
 */
function Count({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const step = (by: number) => {
    feel("tick");
    onChange(Math.max(0, Math.min(20, value + by)));
  };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
      <Text
        style={{ flex: 1, fontSize: 16, lineHeight: 25, color: TEXT_PRIMARY }}
      >
        {label}
      </Text>
      <Pressable
        onPress={() => step(-1)}
        accessibilityRole="button"
        accessibilityLabel={`ลด ${label}`}
        hitSlop={8}
        style={({ pressed }) => ({
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? SEPARATOR : GROUPED_BG,
        })}
      >
        <Minus
          size={18}
          color={value === 0 ? TEXT_MUTED : TEXT_PRIMARY}
          strokeWidth={2.6}
        />
      </Pressable>
      <Text
        style={{
          minWidth: 28,
          textAlign: "center",
          fontSize: 20,
          lineHeight: 31,
          fontWeight: "800",
          color: value === 0 ? TEXT_MUTED : TEXT_PRIMARY,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
      <Pressable
        onPress={() => step(1)}
        accessibilityRole="button"
        accessibilityLabel={`เพิ่ม ${label}`}
        hitSlop={8}
        style={({ pressed }) => ({
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? SEPARATOR : GROUPED_BG,
        })}
      >
        <Plus size={18} color={TEXT_PRIMARY} strokeWidth={2.6} />
      </Pressable>
    </View>
  );
}

/** One thing that is either so or not, as a row that lights when it is. */
function Toggle({
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
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.sm,
        paddingVertical: SPACE.sm,
        paddingHorizontal: SPACE.md,
        borderRadius: RADIUS.md,
        backgroundColor: on ? `${PRIMARY_500}1F` : GROUPED_BG,
      }}
    >
      <Text
        style={{
          flex: 1,
          fontSize: 15,
          lineHeight: 24,
          fontWeight: on ? "700" : "500",
          color: on ? PRIMARY_500 : TEXT_PRIMARY,
        }}
      >
        {label}
      </Text>
      {on && <CircleCheck size={18} color={PRIMARY_500} strokeWidth={2.4} />}
    </Pressable>
  );
}
