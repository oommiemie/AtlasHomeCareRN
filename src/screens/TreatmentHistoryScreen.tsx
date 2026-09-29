import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { CalendarClock } from "lucide-react-native";

import { Card } from "../components/Card";
import { Chevron } from "../components/Chevron";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import type { RootStackParamList } from "../navigation/RootStack";
import { treatmentHistory, type PastVisit } from "../models/community";
import { thaiFullDate } from "../utils/thaiDate";
import { tr } from "../i18n";
import { readable, GUTTER } from "../theme/layout";
import {
  PRIMARY_500,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme/tokens";

import { VisitDetailSheet, whenOf } from "../components/VisitDetailSheet";

/**
 * The patient's treatment history — a page of past visits.
 *
 * A page rather than a sheet, because it is a place a carer goes and reads:
 * the whole list, newest first, one row a visit. A row carries only enough
 * to find the one you mean — the date, where it was, the first of what came
 * of it — and opens the rest as a sheet, so the detail arrives over the
 * list without leaving it.
 */
export function TreatmentHistoryScreen() {
  const { hn, name } =
    useRoute<RouteProp<RootStackParamList, "TreatmentHistory">>().params;
  const insets = useSafeAreaInsets();
  const visits = treatmentHistory(hn);
  const [open, setOpen] = useState<PastVisit | null>(null);

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={tr("ประวัติการรักษา", "Treatment history")} />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: GUTTER,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + SPACE.huge,
            gap: SPACE.md,
            ...readable(),
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
            {tr(
              `${name} · HN ${hn} · ${visits.length} ครั้งการรักษา`,
              `${name} · HN ${hn} · ${visits.length} visit${visits.length === 1 ? "" : "s"}`,
            )}
          </Text>

          {visits.map((v) => {
            const { date, ago } = whenOf(v.daysAgo);
            return (
              <Card
                key={v.id}
                onPress={() => setOpen(v)}
                accessibilityLabel={thaiFullDate(date)}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.md,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: SPACE.sm,
                      }}
                    >
                      <CalendarClock
                        size={15}
                        color={PRIMARY_500}
                        strokeWidth={2.2}
                      />
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 14,
                          lineHeight: 20,
                          fontWeight: "600",
                          color: TEXT_PRIMARY,
                        }}
                      >
                        {thaiFullDate(date)}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          lineHeight: 18,
                          color: TEXT_MUTED,
                        }}
                      >
                        {ago}
                      </Text>
                    </View>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 14,
                        lineHeight: 18,
                        color: TEXT_SECONDARY,
                      }}
                    >
                      {v.clinic}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 12,
                        lineHeight: 18,
                        color: TEXT_MUTED,
                      }}
                    >
                      {v.summary}
                    </Text>
                  </View>
                  <Chevron />
                </View>
              </Card>
            );
          })}
        </ScrollView>
      </HeaderFade>

      <VisitDetailSheet visit={open} onClose={() => setOpen(null)} />
    </View>
  );
}
