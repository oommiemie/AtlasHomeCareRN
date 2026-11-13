import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertCircle, CheckCircle2, Clock, Send } from "lucide-react-native";

import { Avatar } from "../components/Avatar";
import { Card } from "../components/Card";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { useClosedVisits } from "../models/closedVisits";
import { useSession } from "../models/session";
import { STAFF } from "../models/staff";
import { isDone, planToday, todayTasks, visitStateOf } from "../models/task";
import { tr } from "../i18n";
import { columnsFor, cardWidth, GUTTER, readable, useLayout } from "../theme/layout";
import {
  DANGER,
  PRIMARY_500,
  SEPARATOR,
  SPACE,
  SUCCESS,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  WARNING,
} from "../theme/tokens";
import { thaiShortDate } from "../utils/thaiDate";

type Member = {
  name: string;
  role: string;
  total: number;
  done: number;
  overdue: number;
  /** Where they are now, in a word. */
  now: string;
  you?: boolean;
};

/**
 * The rest of the team's day, made up the same way every time: a prototype
 * has one carer's real plan, so the others get fixed, believable figures.
 */
const OTHERS: Omit<Member, "name" | "role">[] = [
  { total: 6, done: 4, overdue: 0, now: tr("กำลังเยี่ยมบ้านที่ 5", "At house 5") },
  { total: 5, done: 2, overdue: 1, now: tr("กำลังเดินทาง", "On the road") },
  { total: 4, done: 4, overdue: 0, now: tr("เยี่ยมครบแล้ว", "Round finished") },
  { total: 3, done: 1, overdue: 0, now: tr("ฉีดวัคซีนที่โรงเรียน", "Vaccinating at a school") },
  { total: 5, done: 3, overdue: 2, now: tr("กำลังเยี่ยมบ้านที่ 4", "At house 4") },
];

/**
 * "ภาพรวมทีม" — the team lead's view of the day.
 *
 * The same day the carer sees on the home page, across everyone: how many
 * visits the team has, how many are done, which are late, and who is where.
 * The carer's own row is their real plan; the others are stand-ins.
 */
export function TeamScreen() {
  const insets = useSafeAreaInsets();
  const me = useSession();
  const { width } = useLayout();
  useClosedVisits();

  const mine = todayTasks();
  const myRow: Member = {
    name: me.displayName || tr("คุณ", "You"),
    role: tr("พยาบาลวิชาชีพ (คุณ)", "Registered nurse (you)"),
    total: mine.length,
    done: mine.filter(isDone).length,
    overdue: mine.filter((t) => visitStateOf(t, planToday) === "overdue").length,
    now: mine.every(isDone) ? tr("เยี่ยมครบแล้ว", "Round finished") : tr("ออกเยี่ยมอยู่", "Out on the round"),
    you: true,
  };
  const team: Member[] = [
    myRow,
    ...STAFF.filter((s) => s.id.startsWith("n") || s.id === "p1")
      .filter((s) => s.name !== me.displayName)
      .slice(0, OTHERS.length)
      .map((s, i) => ({ name: s.name, role: s.role, ...OTHERS[i] })),
  ];
  const total = team.reduce((n, m) => n + m.total, 0);
  const done = team.reduce((n, m) => n + m.done, 0);
  const overdue = team.reduce((n, m) => n + m.overdue, 0);

  const column = width - GUTTER * 2;
  const columns = columnsFor(width);
  const cardW = cardWidth(column, columns, SPACE.md);

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={tr("ภาพรวมทีม", "Team overview")} />
      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            ...readable(),
            paddingHorizontal: GUTTER,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + SPACE.xxxl,
            gap: SPACE.md,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ fontSize: 14, color: TEXT_MUTED, paddingHorizontal: SPACE.xs }}>
            {tr(`วันนี้ ${thaiShortDate(planToday)} · ทีม ${team.length} คน`, `Today ${thaiShortDate(planToday)} · ${team.length} in the team`)}
          </Text>

          <View style={{ flexDirection: "row", gap: SPACE.sm }}>
            <Stat icon={<Clock size={18} color={PRIMARY_500} strokeWidth={2.2} />} value={total} label={tr("เยี่ยมทั้งหมด", "Visits")} />
            <Stat icon={<CheckCircle2 size={18} color={SUCCESS} strokeWidth={2.2} />} value={done} label={tr("เสร็จแล้ว", "Done")} />
            <Stat icon={<AlertCircle size={18} color={overdue > 0 ? DANGER : TEXT_MUTED} strokeWidth={2.2} />} value={overdue} label={tr("เกินกำหนด", "Overdue")} ink={overdue > 0 ? DANGER : undefined} />
          </View>

          {overdue > 0 && (
            <Card style={{ flexDirection: "row", gap: SPACE.md, alignItems: "center" }}>
              <Send size={18} color={WARNING} strokeWidth={2.2} />
              <Text style={{ flex: 1, fontSize: 14, lineHeight: 21, color: TEXT_SECONDARY }}>
                {tr(
                  `มีงานเกินกำหนด ${overdue} งาน ลองส่งต่อเคสให้คนที่เยี่ยมครบแล้ว`,
                  `${overdue} overdue. Consider handing cases to someone who has finished`,
                )}
              </Text>
            </Card>
          )}

          <Text style={{ marginTop: SPACE.sm, fontSize: 16, fontWeight: "600", color: TEXT_PRIMARY, paddingHorizontal: SPACE.xs }}>
            {tr("รายบุคคล", "By person")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.md }}>
            {team.map((m) => (
              <View key={m.name} style={columns > 1 ? { width: cardW } : { width: "100%" }}>
                <MemberCard m={m} />
              </View>
            ))}
          </View>
        </ScrollView>
      </HeaderFade>
    </View>
  );
}

function Stat({ icon, value, label, ink }: { icon: ReactNode; value: number; label: string; ink?: string }) {
  return (
    <Card style={{ flex: 1, gap: SPACE.xs }}>
      {icon}
      <Text style={{ fontSize: 26, lineHeight: 34, fontWeight: "800", color: ink ?? TEXT_PRIMARY }}>{value}</Text>
      <Text style={{ fontSize: 13, color: TEXT_MUTED }}>{label}</Text>
    </Card>
  );
}

function MemberCard({ m }: { m: Member }) {
  const share = m.total === 0 ? 0 : m.done / m.total;
  const finished = m.total > 0 && m.done === m.total;
  return (
    <Card style={{ gap: SPACE.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
        <Avatar size={44} initial={m.name.replace(/^(นพ\.|พญ\.|น\.ส\.|นาง|นาย)/, "").trim()[0] ?? "?"} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 15, lineHeight: 22, fontWeight: "700", color: TEXT_PRIMARY }}>
            {m.name}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 13, lineHeight: 19, color: TEXT_MUTED }}>
            {`${m.role} · ${m.now}`}
          </Text>
        </View>
        {m.overdue > 0 && (
          <Text style={{ fontSize: 13, fontWeight: "700", color: DANGER }}>
            {tr(`เกิน ${m.overdue}`, `${m.overdue} late`)}
          </Text>
        )}
      </View>
      <View style={{ gap: SPACE.xs }}>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: SEPARATOR, overflow: "hidden" }}>
          <View
            style={{
              width: `${share * 100}%`,
              height: 8,
              borderRadius: 4,
              backgroundColor: finished ? SUCCESS : PRIMARY_500,
            }}
          />
        </View>
        <Text style={{ fontSize: 13, color: TEXT_SECONDARY }}>
          {tr(`เยี่ยมแล้ว ${m.done} จาก ${m.total} บ้าน`, `${m.done} of ${m.total} visited`)}
        </Text>
      </View>
    </Card>
  );
}
