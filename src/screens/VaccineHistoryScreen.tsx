import { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { Card } from "../components/Card";
import { ActivityAvatar } from "../components/ActivityAvatar";
import { Chevron } from "../components/Chevron";
import { Glass } from "../components/Glass";
import { SearchListScreen } from "../components/SearchListScreen";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  countsOf,
  growthCountsOf,
  vialOf,
  forget,
  useVaccineHistory,
  type Done,
} from "../models/vaccineHistory";
import { ACTIVITY_NOUN } from "../models/vaccination";
import { feel } from "../utils/haptics";
import { thaiMonthYear, thaiShortDate, thaiTime } from "../utils/thaiDate";
import { tr } from "../i18n";
import {
  DANGER_INK,
  FILL_SUBTLE,
  INK_OK,
  RADIUS,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  WARNING,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Params = RouteProp<RootStackParamList, "VaccineHistory">;

/**
 * The sessions already run.
 *
 * A list rather than a report: the question this answers is nearly always
 * "which sitting was that" — a school, a date, a vaccine — and the figures
 * come after. So each row leads with the three things that identify a
 * session and carries its counts underneath.
 */
export function VaccineHistoryScreen() {
  const nav = useNavigation<Nav>();
  const { kind } = useRoute<Params>().params ?? {};
  const all = useVaccineHistory();
  const [query, setQuery] = useState("");

  /*
    One service's sittings, where one was asked for.

    The history is stored as a single list because it is a single kind of
    record; it is read as three, because a carer reads it from inside one
    service and is asking what that service has done. Left unfiltered, a
    vaccination round's history also carried every school check and every
    nursery weighing, and finding last week's MMR meant searching past them.
  */
  const history = useMemo(
    () => (kind == null ? all : all.filter((d) => d.kind === kind)),
    [all, kind],
  );

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => {
    const found =
      q === ""
        ? history
        : history.filter(
            (d) =>
              d.title.toLowerCase().includes(q) ||
              d.place.toLowerCase().includes(q) ||
              (d.lot ?? "").toLowerCase().includes(q) ||
              (d.vaccine ?? "").toLowerCase().includes(q),
          );
    /*
      By the day the service was given, not the day it was written.

      The store keeps the history newest-saved first, which is the right
      order for "what did I just do" — but the months below are months of
      work, and a session finished off on the phone a week later would
      otherwise file itself under the wrong one, or split a month in two.
      Where two fall on the same moment the later save still comes first.
    */
    return [...found].sort(
      (a, b) => b.servedAt - a.servedAt || b.savedAt - a.savedAt,
    );
  }, [history, q]);

  /*
    Each row, and the month heading that belongs above it.

    The heading rides on the first session of its month rather than being a
    row of its own: the list is virtualised, and a separate row would have
    to be kept in step with the cards it stands over as they come and go.
    The tallies beside it are the month as a whole — how many sittings, and
    how many people were recorded across them, which is the figure a monthly
    return is written from.
  */
  const rows = useMemo(
    () =>
      shown.map((done, i) => {
        const month = thaiMonthYear(new Date(done.servedAt));
        const before =
          i === 0 ? null : thaiMonthYear(new Date(shown[i - 1].servedAt));
        if (month === before) return { done, month: null, first: false };
        const run = shown.filter(
          (d) => thaiMonthYear(new Date(d.servedAt)) === month,
        );
        return {
          done,
          month,
          first: i === 0,
          sessions: run.length,
          people: run.reduce((n, d) => n + countsOf(d).recorded, 0),
        };
      }),
    [shown],
  );

  const remove = (d: Done) =>
    Alert.alert(
      tr("ลบประวัติ Session นี้", "Delete this session's history"),
      `${d.title}\n${d.place}`,
      [
        {
          text: tr("ลบ", "Delete"),
          style: "destructive",
          onPress: () => {
            forget(d.id);
            feel("success");
            toast(tr("ลบประวัติ Session แล้ว", "Session history deleted"), "success");
          },
        },
        { text: tr("ยกเลิก", "Cancel"), style: "cancel" },
      ],
    );

  return (
    /*
      The app's own searchable list, not a scroll view with a field on top.

      It is what every other list screen here uses, and the reason is the
      behaviour rather than the look: the field collapses into a button in
      the title row as soon as the list moves, so a long roster is not read
      through a control that has finished being useful. Built by hand, these
      three screens were the only ones in the app where it did not.
    */
    <SearchListScreen
      /*
        Named for the service it is showing.

        "ประวัติการให้บริการ" over a list that holds only immunisations is a
        title making a promise the page does not keep — and the carer has
        just come from a page called งานวัคซีน, so the history of it should
        say so.

        Built from the noun rather than from the page title: "ประวัติงาน
        คัดกรองเด็กเล็ก" is long enough to truncate in a title row that also
        carries a back arrow and a search button.
      */
      title={
        kind == null
          ? tr("ประวัติการให้บริการ", "Service history")
          : tr(`ประวัติ${ACTIVITY_NOUN[kind]}`, `${ACTIVITY_NOUN[kind]} history`)
      }
      query={query}
      onQuery={setQuery}
      placeholder={
        kind === "vaccination"
          ? tr("ค้นหาโรงเรียน วัคซีน หรือ Lot", "Search school, vaccine or lot")
          : tr("ค้นหาชื่องาน หรือสถานที่", "Search activity or place")
      }
      data={rows}
      keyExtractor={(r) => r.done.id}
      renderItem={(r) => (
        <View
          style={{
            gap: SPACE.sm,
            marginTop: r.month != null && !r.first ? SPACE.sm : 0,
          }}
        >
          {r.month != null && (
            <MonthHeading
              month={r.month}
              sessions={r.sessions ?? 0}
              people={r.people ?? 0}
            />
          )}
          <DoneCard
            done={r.done}
            onPress={() =>
              nav.navigate("VaccineHistoryDetail", { id: r.done.id })
            }
            onLongPress={() => remove(r.done)}
          />
        </View>
      )}
    >
      {history.length === 0 ? (
        <Card style={{ padding: SPACE.xl, alignItems: "center" }}>
          <Text style={{ fontSize: 15, color: TEXT_SECONDARY }}>
            {tr("ยังไม่มีประวัติ", "No history yet")}
          </Text>
          <Text
            style={{
              marginTop: SPACE.xs,
              fontSize: 13,
              color: TEXT_MUTED,
              textAlign: "center",
            }}
          >
            {tr(
              "Session ที่บันทึกบริการแล้วจะถูกเก็บไว้ที่นี่",
              "Sessions with recorded services will be kept here",
            )}
          </Text>
        </Card>
      ) : null}

      {history.length > 0 && shown.length === 0 ? (
        <Text style={{ fontSize: 14, color: TEXT_MUTED }}>
          {tr(
            `ไม่พบ "${query.trim()}" ในประวัติ`,
            `No results for "${query.trim()}" in history`,
          )}
        </Text>
      ) : null}
    </SearchListScreen>
  );
}

/**
 * The month a run of sessions was done in, standing over the first of them.
 *
 * A carer looking for a sitting remembers roughly when it was long before
 * they remember which school it was at, so the list is walked by month —
 * and the same heading answers the other question the history gets asked,
 * which is how much work a month held.
 */
function MonthHeading({
  month,
  sessions,
  people,
}: {
  month: string;
  sessions: number;
  people: number;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "baseline",
        gap: SPACE.sm,
        paddingHorizontal: SPACE.xs,
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: "700", color: TEXT_PRIMARY }}>
        {month}
      </Text>
      <View style={{ flex: 1 }} />
      <Text
        style={{
          fontSize: 12,
          color: TEXT_MUTED,
          fontVariant: ["tabular-nums"],
        }}
      >
        {tr(
          `${sessions} ครั้ง · บันทึก ${people} คน`,
          `${sessions} session${sessions === 1 ? "" : "s"} · ${people} recorded`,
        )}
      </Text>
    </View>
  );
}

/**
 * One sitting already run.
 *
 * Arranged around the two questions the history is opened with, in the
 * order they are asked: which sitting was that, and how did it go.
 *
 * The date leads. It was the third line down, under the title and the
 * school, which is not how anybody finds a morning three weeks later —
 * "the Tuesday at the nursery" comes before "the OPV round" every time.
 *
 * The figures underneath were four columns of equal weight, three of which
 * are nearly always nought, so the one that matters — how much of the class
 * was done — had a quarter of the width and no more emphasis than "ค้าง 0".
 * It is now the figure, said once and said large, with the exceptions beside
 * it as marks that appear only when there are any.
 */
function DoneCard({
  done,
  onPress,
  onLongPress,
}: {
  done: Done;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const c = countsOf(done);
  const g = growthCountsOf(done);
  const served = new Date(done.servedAt);
  const vial = vialOf(done);

  return (
    <Card
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityLabel={`${done.title} ${done.place}`}
      accessibilityHint={tr("แตะค้างเพื่อลบประวัติ", "Long-press to delete")}
    >
      {/* The app's own card, laid out the way every other list in it is —
          and the way the activities page it mirrors now is, so one sitting
          keeps its shape between the page it was started from and the page
          it is read back on. */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <ActivityAvatar kind={done.kind} records={done.records} />

        {/* Title and count travel together, and the flex sits on the PAIR:
            a long title shrinks rather than shoving the count out to the
            arrow, where it would read as belonging to the arrow. */}
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            marginLeft: SPACE.sm,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              fontSize: 15,
              lineHeight: 22,
              fontWeight: "700",
              color: TEXT_PRIMARY,
            }}
          >
            {done.title}
          </Text>
          <Glass
            tintColor="rgba(21,128,61,0.16)"
            style={{
              marginLeft: SPACE.xs,
              borderRadius: RADIUS.capsule,
              overflow: "hidden",
              paddingHorizontal: 9,
              paddingVertical: 3,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: "700",
                color: INK_OK,
                fontVariant: ["tabular-nums"],
              }}
            >
              {`${c.recorded}/${c.targets}`}
            </Text>
          </Glass>
        </View>

        <View style={{ marginLeft: SPACE.sm }}>
          <Chevron />
        </View>
      </View>

      {/* A fixed two-line box, so cards line up whatever the school's name
          happens to be. The vial rides on the second line: "which MMR
          sitting" is answered by the lot as often as by the date. */}
      <Text
        numberOfLines={2}
        style={{
          marginTop: SPACE.md,
          minHeight: 38,
          fontSize: 12,
          lineHeight: 18,
          color: TEXT_MUTED,
        }}
      >
        {`${done.place}\n${[vial, done.provider].filter(Boolean).join(" · ")}`}
      </Text>

      <View
        style={{ height: 1, backgroundColor: SEPARATOR, marginTop: SPACE.md }}
      />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: SPACE.sm,
          gap: SPACE.xs,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: "500",
            color: TEXT_MUTED,
            fontVariant: ["tabular-nums"],
          }}
        >
          {`${thaiShortDate(served)} · ${thaiTime(served)}`}
        </Text>

        {/* Only the exceptions that happened. Three columns of nought were
            the card saying nothing at length. */}
        {/* What a weighing round is read by. A nutrition sitting where
            everybody turned up is not a quiet one — the finding is in the
            verdicts, and a card that only counted attendance would report
            three wasted children as a clean morning. */}
        {g.abnormal > 0 && (
          <Mark
            label={tr(`ผิดปกติ ${g.abnormal}`, `Abnormal ${g.abnormal}`)}
            ink={DANGER_INK}
          />
        )}
        {g.watch > 0 && (
          <Mark label={tr(`เฝ้าระวัง ${g.watch}`, `Watch ${g.watch}`)} ink={WARNING} />
        )}
        {c.absent > 0 && (
          <Mark label={tr(`ไม่มา ${c.absent}`, `Absent ${c.absent}`)} />
        )}
        {c.refused > 0 && (
          <Mark label={tr(`ปฏิเสธ ${c.refused}`, `Refused ${c.refused}`)} />
        )}
        {c.waiting > 0 && (
          <Mark
            label={tr(`ค้าง ${c.waiting}`, `Pending ${c.waiting}`)}
            ink={WARNING}
          />
        )}
      </View>
    </Card>
  );
}

/** One exception, as a quiet mark rather than a column of its own. */
function Mark({
  label,
  ink = TEXT_SECONDARY,
}: {
  label: string;
  ink?: string;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: RADIUS.capsule,
        backgroundColor: FILL_SUBTLE,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: "700", color: ink }}>
        {label}
      </Text>
    </View>
  );
}
