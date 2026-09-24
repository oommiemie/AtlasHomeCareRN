import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Glass } from "../components/Glass";
import { Check, X } from "lucide-react-native";

import { Card } from "../components/Card";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { StatusTag } from "../components/StatusTag";
import { usePostingLog, type PostingDecision } from "../models/postingLog";
import { thaiDateTime, thaiMonthYear } from "../utils/thaiDate";
import {
  DANGER,
  DANGER_INK,
  INK_OK,
  RADIUS,
  SEPARATOR,
  SPACE,
  SUCCESS,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme/tokens";

/**
 * "ประวัติการรับงาน" — what was taken, what was turned down, and why.
 *
 * The postings list shows what is still open; this shows what was decided.
 * A refusal keeps its reason, because that is the thing a carer is asked
 * about weeks later and the one thing the posting itself no longer says.
 */
export function PostingLogScreen() {
  const insets = useSafeAreaInsets();
  const log = usePostingLog();

  const shown = log;

  /**
   * The decisions gathered by the month they were made in.
   *
   * A month is the unit this is read in: a supervisor asks about last
   * month, and a carer counting their own work counts it the same way. So
   * each month is its own card with its own heading, rather than one long
   * list with dates down the side to be added up by eye.
   */
  const months = useMemo(() => {
    const out: {
      key: string;
      label: string;
      taken: number;
      rows: PostingDecision[];
    }[] = [];
    for (const d of shown) {
      const at = new Date(d.at);
      const key = `${at.getFullYear()}-${at.getMonth()}`;
      let group = out.find((g) => g.key === key);
      if (group == null) {
        group = { key, label: thaiMonthYear(at), taken: 0, rows: [] };
        out.push(group);
      }
      group.rows.push(d);
      if (d.kind === "accepted") group.taken += 1;
    }
    return out;
  }, [shown]);

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="ประวัติการรับงาน" />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: SPACE.lg,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + SPACE.xxl,
            gap: SPACE.md,
          }}
          showsVerticalScrollIndicator={false}
        >
          {shown.length === 0 ? (
            <Card>
              <Text style={{ fontSize: 14, lineHeight: 22, color: TEXT_MUTED }}>
                ยังไม่มีประวัติการรับงาน
              </Text>
            </Card>
          ) : (
            months.map((m) => (
              <View key={m.key} style={{ gap: SPACE.sm }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    gap: SPACE.sm,
                    paddingHorizontal: SPACE.xs,
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 15,
                      fontWeight: "700",
                      color: TEXT_PRIMARY,
                    }}
                  >
                    {m.label}
                  </Text>
                  <Text style={{ fontSize: 12, color: TEXT_MUTED }}>
                    {`รับ ${m.taken} · ปฏิเสธ ${m.rows.length - m.taken}`}
                  </Text>
                </View>
                {/* A card each, the way a posting is a card: these are
                    separate decisions about separate people, and a list of
                    rows behind one edge reads as one thing with parts. */}
                {m.rows.map((d) => (
                  <Card key={`${d.taskId}-${d.at}`}>
                    <Row decision={d} />
                  </Card>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      </HeaderFade>
    </View>
  );
}

/**
 * One decision, as the visit card draws a visit: the person across the
 * top, what the job was under them, and the stamp on a footer line with
 * the verdict badge at its end.
 */
function Row({ decision: d }: { decision: PostingDecision }) {
  const took = d.kind === "accepted";
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Glass
          tintColor="rgba(7,125,215,0.95)"
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#FFFFFF" }}>
            {d.name.trim().split(/\s+/)[1]?.[0] ?? d.name[0] ?? "?"}
          </Text>
        </Glass>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            marginLeft: SPACE.sm,
            fontSize: 14,
            fontWeight: "600",
            color: TEXT_PRIMARY,
          }}
        >
          {d.name}
        </Text>
      </View>

      {/* A fixed two-line box, so cards line up whatever the detail's length. */}
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
        {d.detail}
      </Text>

      {/* Why it was turned down — the one thing this page exists for, and
          the one thing the posting itself no longer says. */}
      {!took && d.reason != null && d.reason !== "" && (
        <Text
          style={{
            marginTop: SPACE.xs,
            fontSize: 12,
            lineHeight: 18,
            color: DANGER,
          }}
        >
          {`เหตุผล: ${d.reason}`}
        </Text>
      )}
      {!took && d.note != null && d.note.trim() !== "" && (
        <Text
          numberOfLines={2}
          style={{
            marginTop: 2,
            fontSize: 12,
            lineHeight: 18,
            color: TEXT_MUTED,
          }}
        >
          {d.note}
        </Text>
      )}

      <View
        style={{ height: 1, backgroundColor: SEPARATOR, marginTop: SPACE.md }}
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: SPACE.sm,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: "500",
            color: TEXT_MUTED,
          }}
        >
          {thaiDateTime(new Date(d.at))}
        </Text>
        <StatusTag
          label={took ? "รับงาน" : "ปฏิเสธ"}
          ink={took ? INK_OK : DANGER_INK}
          Icon={took ? Check : X}
        />
      </View>
    </>
  );
}
