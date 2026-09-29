import { useState } from "react";
import {
  Ban,
  CircleCheck,
  Clock,
  TriangleAlert,
  UserX,
} from "lucide-react-native";
import { Image, Text, View, type ImageSourcePropType } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";

import { Card } from "../components/Card";
import { ScreenHeader } from "../components/ScreenHeader";
import { SearchListScreen } from "../components/SearchListScreen";
import { StatusTag } from "../components/StatusTag";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  ACTIVITY_NOUN,
  OUTCOME_LABEL,
  recordText,
  type ActivityKind,
  type Outcome,
} from "../models/vaccination";
import {
  countsOf,
  doneById,
  growthCountsOf,
  vialOf,
  type Person,
} from "../models/vaccineHistory";
import { thaiShortDate, thaiTime } from "../utils/thaiDate";
import { growthText } from "../models/growth";
import { tr } from "../i18n";
import {
  DANGER_INK,
  INK_OK,
  RADIUS,
  SEPARATOR,
  SPACE,
  TEXT_DISABLED,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  WARNING,
} from "../theme/tokens";
import { GUTTER } from "../theme/layout";

type Params = RouteProp<RootStackParamList, "VaccineHistoryDetail">;

/** The drawing each service carries, the same one its roster wears. */
const ART = 72;
const ART_FOR: Record<ActivityKind, ImageSourcePropType> = {
  vaccination: require("../../assets/services/vaccine.png"),
  schoolHealth: require("../../assets/services/checkup.png"),
  screening: require("../../assets/services/screening.png"),
  dental: require("../../assets/services/dental.png"),
};

/** One of the three figures on the summary card. */
const Figure = ({
  label,
  value,
  ink,
}: {
  label: string;
  value: number;
  ink: string;
}) => (
  <View style={{ gap: 1 }}>
    <Text
      style={{
        fontSize: 20,
        lineHeight: 28,
        fontWeight: "700",
        color: value === 0 ? TEXT_MUTED : ink,
        fontVariant: ["tabular-nums"],
      }}
    >
      {value}
    </Text>
    <Text style={{ fontSize: 12, color: TEXT_MUTED }}>{label}</Text>
  </View>
);

/**
 * One past session, name by name.
 *
 * The counts are on the card that led here; this page exists for the
 * question the counts cannot answer — WHO. A head teacher asking which six
 * children were absent, a parent asking whether theirs was done, a
 * supervisor asking who was overruled and on what grounds. Every one of
 * those is a person's name, so the page is a list of them.
 */
export function VaccineHistoryDetailScreen() {
  const { id } = useRoute<Params>().params;
  const done = doneById(id);
  const [query, setQuery] = useState("");

  if (done == null) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title={tr("ประวัติ Session", "Session history")} />
        <Text
          style={{ paddingVertical: SPACE.lg, paddingHorizontal: GUTTER, fontSize: 15, color: TEXT_SECONDARY }}
        >
          {tr("ไม่พบประวัติรายการนี้", "This record could not be found")}
        </Text>
      </View>
    );
  }

  const c = countsOf(done);
  const g = growthCountsOf(done);
  const weighing = done.records === "growth";
  const served = new Date(done.servedAt);
  const q = query.trim().toLowerCase();
  const shown =
    q === ""
      ? done.people
      : done.people.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.hn.includes(q) ||
            p.room.toLowerCase().includes(q),
        );

  return (
    // The same searchable list the rest of the app uses, so the field
    // collapses out of the way once the roster starts moving.
    <SearchListScreen
      title={done.title}
      query={query}
      onQuery={setQuery}
      placeholder={tr("ค้นหาชื่อ HN หรือห้อง", "Search name, HN or room")}
      data={shown}
      keyExtractor={(p) => `${p.hn}-${p.name}`}
      renderItem={(p) => <PersonRow person={p} />}
    >
      {/*
        The same card the roster is worked from, for the record of it.

        It was two: a block of grey lines about the school, and a strip of
        five figures under it. Which meant the page a supervisor reads and
        the page the carer worked from were two different shapes for one
        piece of work — and the thing that identifies a sitting at a glance,
        the service's own drawing, was on neither.
      */}
      <Card style={{ gap: SPACE.md }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: SPACE.md,
          }}
        >
          <View style={{ flex: 1, gap: SPACE.sm }}>
            <Text
              style={{
                fontSize: 20,
                lineHeight: 30,
                fontWeight: "700",
                color: TEXT_PRIMARY,
              }}
            >
              {weighing
                ? tr("ชั่งน้ำหนัก–วัดส่วนสูง", "Weight and height")
                : ACTIVITY_NOUN[done.kind]}
            </Text>
            <Text
              style={{ fontSize: 13, lineHeight: 20, color: TEXT_SECONDARY }}
            >
              {vialOf(done) ??
                (weighing
                  ? tr(
                      "ภาวะโภชนาการ · บันทึกแล้วในระบบ",
                      "Nutritional status · recorded in the system",
                    )
                  : tr("บันทึกแล้วในระบบ", "Recorded in the system"))}
            </Text>
          </View>

          <View style={{ alignItems: "flex-end", gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "baseline" }}>
              <Text
                style={{
                  fontSize: 26,
                  lineHeight: 32,
                  fontWeight: "800",
                  color: c.recorded > 0 ? INK_OK : TEXT_PRIMARY,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {c.recorded}
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "700",
                  color: TEXT_MUTED,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {`/${c.targets}`}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: TEXT_MUTED }}>
              {c.waiting > 0
                ? tr(`ค้าง ${c.waiting} คน`, `${c.waiting} pending`)
                : c.absent + c.refused > 0
                  ? tr(
                      `ไม่มา ${c.absent + c.refused} คน`,
                      `${c.absent + c.refused} not served`,
                    )
                  : tr("ครบทั้งกลุ่ม", "All done")}
            </Text>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: SEPARATOR }} />

        {/*
          What was found, on a round that found anything — and who was
          missed, on one that only recorded attendance. Three figures either
          way, the same three the roster showed while it was being worked.
        */}
        <View style={{ flexDirection: "row", gap: SPACE.lg }}>
          {weighing ? (
            <>
              <Figure
                label={tr("ผิดปกติ", "Abnormal")}
                value={g.abnormal}
                ink={g.abnormal > 0 ? DANGER_INK : TEXT_MUTED}
              />
              <Figure
                label={tr("เฝ้าระวัง", "Watch")}
                value={g.watch}
                ink={g.watch > 0 ? WARNING : TEXT_MUTED}
              />
              <Figure
                label={tr("ปกติ", "Normal")}
                value={g.measured - g.abnormal - g.watch}
                ink={INK_OK}
              />
            </>
          ) : (
            <>
              <Figure
                label={tr("ไม่มา", "Absent")}
                value={c.absent}
                ink={TEXT_SECONDARY}
              />
              <Figure
                label={tr("ปฏิเสธ", "Refused")}
                value={c.refused}
                ink={TEXT_SECONDARY}
              />
              <Figure
                label={tr("ค้าง", "Pending")}
                value={c.waiting}
                ink={c.waiting > 0 ? WARNING : INK_OK}
              />
            </>
          )}
        </View>

        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            right: SPACE.md,
            bottom: SPACE.md,
            width: ART,
            height: ART,
          }}
        >
          <Image
            source={ART_FOR[done.kind]}
            style={{ width: ART, height: ART }}
            resizeMode="contain"
            accessibilityRole="none"
          />
        </View>

        {/* Where it happened, held clear of the drawing — these are the
            card's longest lines and a school name running under a scale
            truncates at a place that looks like a bug. */}
        <View style={{ gap: 2, paddingRight: ART + SPACE.lg }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: 15, fontWeight: "700", color: TEXT_PRIMARY }}
          >
            {done.place}
          </Text>
          <Text
            numberOfLines={1}
            style={{ fontSize: 13, color: TEXT_SECONDARY }}
          >
            {`${done.group} · ${thaiShortDate(served)} · ${thaiTime(served)}`}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 12, color: TEXT_MUTED }}>
            {`${done.provider} (${done.providerCode})`}
          </Text>
        </View>
      </Card>

      {shown.length === 0 ? (
        <Text style={{ fontSize: 14, color: TEXT_MUTED }}>
          {tr(
            `ไม่พบ "${query.trim()}" ในรายชื่อ`,
            `No results for "${query.trim()}" in the roster`,
          )}
        </Text>
      ) : null}
    </SearchListScreen>
  );
}

/** The same marks the live roster wears, so a session reads the same
    afterwards as it did while it was being worked through. */
const CHIP: Record<Outcome, { ink: string; Icon: typeof CircleCheck }> = {
  recorded: { ink: INK_OK, Icon: CircleCheck },
  absent: { ink: TEXT_SECONDARY, Icon: UserX },
  refused: { ink: TEXT_SECONDARY, Icon: Ban },
  waiting: { ink: TEXT_SECONDARY, Icon: Clock },
};

function PersonRow({ person }: { person: Person }) {
  const chip = CHIP[person.outcome];
  return (
    <Card style={{ padding: SPACE.md, gap: SPACE.xs }}>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}
      >
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: 15, fontWeight: "600", color: TEXT_PRIMARY }}
          >
            {person.name}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 12, color: TEXT_MUTED }}>
            {`HN ${person.hn} · ${person.room}`}
          </Text>
        </View>
        {/* On a weighing round the outcome word says only that the child
            turned up, which is not what anybody is reading the record for.
            The verdict takes the tag; what was weighed is on the line
            under it. */}
        {person.growth == null ? (
          <StatusTag
            label={OUTCOME_LABEL[person.outcome]}
            ink={chip.ink}
            Icon={chip.Icon}
          />
        ) : (
          <StatusTag
            label={growthText(person.growth.label)}
            ink={
              person.growth.level === "abnormal"
                ? DANGER_INK
                : person.growth.level === "watch"
                  ? WARNING
                  : INK_OK
            }
            Icon={
              person.growth.level === "normal" ? CircleCheck : TriangleAlert
            }
          />
        )}
      </View>

      {person.growth != null ? (
        <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_SECONDARY }}>
          {tr(
            `${person.growth.kg.toFixed(1)} กก. · ${person.growth.cm.toFixed(1)} ซม.`,
            `${person.growth.kg.toFixed(1)} kg · ${person.growth.cm.toFixed(1)} cm`,
          )}
        </Text>
      ) : null}

      {/* Why they were not served. This is the line a head teacher's
          question is actually answered from. */}
      {person.note != null ? (
        <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
          {recordText(person.note)}
        </Text>
      ) : null}

      {/* Given over a warning with no reason recorded. The one line a
          supervisor will come back and ask about. */}
      {person.flag != null ? (
        <Text style={{ fontSize: 12, lineHeight: 18, color: DANGER_INK }}>
          {recordText(person.flag)}
        </Text>
      ) : null}

      {/* The audit trail. A dose given over a warning is the one record
            somebody will come back and ask about, so the reason is kept
            with it rather than in a log nobody can reach from here. */}
      {person.override != null ? (
        <Text style={{ fontSize: 12, lineHeight: 18, color: WARNING }}>
          {`Override: ${recordText(person.override)}`}
        </Text>
      ) : null}
    </Card>
  );
}

function Tally({
  label,
  value,
  ink = TEXT_PRIMARY,
}: {
  label: string;
  value: number;
  ink?: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ fontSize: 18, fontWeight: "800", color: ink }}>
        {value}
      </Text>
      {/* No `adjustsFontSizeToFit` — see the note on VisitCounts. It grows
          text as well as shrinking it, and five labels at five sizes is
          worse than one that is a little tight. */}
      <Text
        numberOfLines={1}
        style={{ fontSize: 11, color: TEXT_MUTED, textAlign: "center" }}
      >
        {label}
      </Text>
    </View>
  );
}
