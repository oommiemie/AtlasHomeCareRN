import { Text, View } from "react-native";

import { GlassWidget } from "./GlassWidget";
import { Avatar } from "./Avatar";
import { Chevron } from "./Chevron";
import { PressableScale } from "./PressableScale";
import { initialOf, residentById, type Resident } from "../models/household";
import {
  abnormalNow,
  formatReading,
  type MetricKind,
  type Tone,
} from "../models/vitals";
import {
  DANGER_BG,
  DANGER_INK,
  RADIUS,
  SPACE,
  SURFACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TYPE,
  WARNING,
  WARNING_BG,
} from "../theme/tokens";
import { tr } from "../i18n";

const INK: Record<Exclude<Tone, "normal">, { ink: string; bg: string }> = {
  warn: { ink: WARNING, bg: WARNING_BG },
  alert: { ink: DANGER_INK, bg: DANGER_BG },
};

/**
 * Who is unwell, as the assistant sends it: the people whose readings are
 * out of band, worst first, each with the readings that are — the figure,
 * the word for it, coloured by how far out it is. A row opens that
 * person's health profile.
 *
 * Narrowed to one reading where the question named one ("who has a
 * fever"), so the row says only what was asked.
 */
export function HealthListCard({
  residents,
  metric,
  onOpen,
}: {
  residents: string[];
  metric?: MetricKind;
  onOpen: (resident: Resident) => void;
}) {
  const rows = residents
    .map((id) => residentById(id))
    .filter((r): r is Resident => r != null)
    .map((r) => ({
      r,
      off: abnormalNow(r).filter(
        (a) => metric == null || a.metric.kind === metric,
      ),
    }))
    .filter((x) => x.off.length > 0);

  if (rows.length === 0) {
    return (
      <GlassWidget padding={SPACE.lg}>
        <Text style={{ ...TYPE.detail, color: TEXT_MUTED }}>
          {tr("ไม่พบผู้ป่วยที่มีค่าผิดปกติ", "No patients with abnormal readings")}
        </Text>
      </GlassWidget>
    );
  }

  return (
    // Each person on white, on the glass pane.
    <GlassWidget>
      {rows.map(({ r, off }) => (
        <PressableScale
          key={r.id}
          onPress={() => onOpen(r)}
          scaleTo={0.99}
          accessibilityRole="button"
          accessibilityLabel={`${r.name} ${off.map((a) => `${a.metric.short} ${a.label}`).join(" ")}`}
          style={{
            padding: SPACE.md,
            gap: SPACE.sm,
            borderRadius: RADIUS.lg,
            backgroundColor: SURFACE,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.sm,
            }}
          >
            <Avatar size={32} initial={initialOf(r.name)} photo={r.photo} />
            <Text
              numberOfLines={1}
              style={{ flex: 1, ...TYPE.rowTitle, color: TEXT_PRIMARY }}
            >
              {r.name}
            </Text>
            <Text
              style={{ ...TYPE.caption, color: TEXT_MUTED }}
            >{tr(`${r.age} ปี`, `${r.age} yrs`)}</Text>
            <Chevron />
          </View>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.xs }}
          >
            {off.map((a) => {
              const c = INK[a.tone as Exclude<Tone, "normal">];
              return (
                <View
                  key={a.metric.kind}
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    gap: 4,
                    paddingHorizontal: SPACE.sm,
                    paddingVertical: 3,
                    borderRadius: RADIUS.capsule,
                    backgroundColor: c.bg,
                  }}
                >
                  <Text style={{ ...TYPE.caption, color: c.ink }}>
                    {a.metric.short}
                  </Text>
                  <Text
                    style={{ ...TYPE.caption, fontWeight: "700", color: c.ink }}
                  >
                    {`${formatReading(a.metric, a.reading)} ${a.metric.unit}`}
                  </Text>
                  <Text style={{ ...TYPE.caption, color: c.ink }}>
                    {a.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </PressableScale>
      ))}
    </GlassWidget>
  );
}
