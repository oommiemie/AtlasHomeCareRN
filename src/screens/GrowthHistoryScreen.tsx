import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, type RouteProp } from "@react-navigation/native";

import { Card } from "../components/Card";
import { GrowthChart, type Plot } from "../components/GrowthChart";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionHeader } from "../components/SectionHeader";
import { StatusTag } from "../components/StatusTag";
import type { RootStackParamList } from "../navigation/RootStack";
import { useSession } from "../models/vaccination";
import {
  ageLabel,
  assess,
  INDEX_LABEL,
  weightForAge,
  type GrowthLevel,
} from "../models/growth";
import { thaiShortDate } from "../utils/thaiDate";
import {
  CANVAS,
  DANGER_INK,
  INK_OK,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  WARNING,
} from "../theme/tokens";

type R = RouteProp<RootStackParamList, "GrowthHistory">;

const LEVEL_INK: Record<GrowthLevel, string> = {
  normal: INK_OK,
  watch: WARNING,
  abnormal: DANGER_INK,
};

const one = (n: number) => n.toFixed(1);

const sdText = (sd: number) =>
  `${sd < 0 ? "−" : "+"}${Math.abs(sd).toFixed(1)} SD`;

/**
 * "ประวัติการชั่ง" — every weighing this child has had, on its own page.
 *
 * It was the last block of the recording form, under the chart and the
 * advice, where it was both in the way and out of reach: a carer with a
 * child on the scale had to scroll past four sections of it to get to the
 * boxes, and a carer wanting to know what happened last quarter had to open
 * the form for a weighing they were not taking.
 *
 * So it is a page, reached from the header of the form, and it holds the
 * whole record rather than a summary of it: what each quarter weighed and
 * measured, where, and what all three tables made of it. The form keeps the
 * chart, because there the line moves as the weight is typed; here it is
 * the same chart standing still, which is what a chart of the past is.
 */
export function GrowthHistoryScreen() {
  const { targetId } = useRoute<R>().params;
  const insets = useSafeAreaInsets();
  const { session } = useSession();

  const row = session?.rows.find((r) => r.target.id === targetId);
  const target = row?.target;

  if (target == null) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="ประวัติการชั่ง" />
        <Text style={{ padding: SPACE.lg, fontSize: 15, color: TEXT_SECONDARY }}>
          ไม่พบรายชื่อนี้ใน Session ที่เปิดอยู่
        </Text>
      </View>
    );
  }

  const past = [...(target.measures ?? [])];
  const sex = target.sex;
  const plots: Plot[] = past.map((m) => ({ months: m.months, kg: m.kg }));

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <ScreenHeader title="ประวัติการชั่ง" />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: SPACE.lg,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + SPACE.xxxl,
            gap: SPACE.md,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Card style={{ gap: SPACE.xs }}>
            <Text
              style={{
                fontSize: 20,
                lineHeight: 30,
                fontWeight: "700",
                color: TEXT_PRIMARY,
              }}
            >
              {target.name}
            </Text>
            <Text style={{ fontSize: 13, lineHeight: 20, color: TEXT_SECONDARY }}>
              {`${target.sex} · ${ageLabel(target.months)} · HN ${target.hn}`}
            </Text>
            <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
              {target.room}
            </Text>
          </Card>

          {past.length === 0 ? (
            <Card>
              <Text style={{ fontSize: 14, lineHeight: 22, color: TEXT_MUTED }}>
                ยังไม่มีประวัติการชั่งของเด็กรายนี้ในระบบ
              </Text>
            </Card>
          ) : (
            <>
              <SectionHeader title="กราฟน้ำหนักตามเกณฑ์อายุ" flush />
              <Card style={{ gap: SPACE.sm }}>
                <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
                  เส้นกลาง = ค่ากลาง · เส้นบน/ล่าง = +2SD / −2SD
                </Text>
                <GrowthChart sex={sex} points={plots} />
              </Card>

              {/*
                Every quarter in full, newest first.

                All three readings rather than the one the roster is filed
                by: a child can be ตามเกณฑ์ on weight for two years and
                quietly become เตี้ย on height, and a history that only kept
                the headline verdict would never show it.
              */}
              <SectionHeader
                title="การชั่งที่ผ่านมา"
                count={past.length}
                flush
              />
              <Card padded={false}>
                {past.reverse().map((m, i) => {
                  const a = assess({
                    sex,
                    months: m.months,
                    kg: m.kg,
                    cm: m.cm,
                    head: m.head,
                  });
                  const lead = weightForAge({
                    sex,
                    months: m.months,
                    kg: m.kg,
                    cm: m.cm,
                  });
                  return (
                    <View key={m.at.toISOString()}>
                      {i === 0 ? null : (
                        <View
                          style={{
                            height: 1,
                            backgroundColor: SEPARATOR,
                            marginLeft: SPACE.lg,
                          }}
                        />
                      )}
                      <View style={{ padding: SPACE.lg, gap: SPACE.sm }}>
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
                              lineHeight: 23,
                              fontWeight: "700",
                              color: TEXT_PRIMARY,
                            }}
                          >
                            {`${thaiShortDate(m.at)} · ไตรมาส ${m.quarter}`}
                          </Text>
                          <StatusTag
                            label={a.label}
                            ink={LEVEL_INK[a.level]}
                          />
                        </View>

                        <Text
                          style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}
                        >
                          {`${ageLabel(m.months)} · ${one(m.kg)} กก. · ${one(m.cm)} ซม.${
                            m.head == null
                              ? ""
                              : ` · รอบศีรษะ ${one(m.head)} ซม.`
                          } · ${m.place}`}
                        </Text>

                        {/* The three tables, each on its own line, so a
                            quarter can be read across as well as down. */}
                        <View style={{ gap: 2 }}>
                          {a.verdicts.map((v) => (
                            <View
                              key={v.index}
                              style={{
                                flexDirection: "row",
                                alignItems: "baseline",
                                gap: SPACE.sm,
                              }}
                            >
                              <Text
                                style={{
                                  width: 92,
                                  fontSize: 12,
                                  lineHeight: 19,
                                  color: TEXT_MUTED,
                                }}
                              >
                                {INDEX_LABEL[v.index]}
                              </Text>
                              <Text
                                style={{
                                  flex: 1,
                                  fontSize: 12,
                                  lineHeight: 19,
                                  fontWeight: v.level === "normal" ? "400" : "700",
                                  color:
                                    v.level === "normal"
                                      ? TEXT_SECONDARY
                                      : LEVEL_INK[v.level],
                                }}
                              >
                                {v.label}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 12,
                                  lineHeight: 19,
                                  color:
                                    v.level === "normal"
                                      ? TEXT_MUTED
                                      : LEVEL_INK[v.level],
                                  fontVariant: ["tabular-nums"],
                                }}
                              >
                                {sdText(v.sd)}
                              </Text>
                            </View>
                          ))}
                        </View>

                        {lead.level !== "normal" && i === 0 && (
                          <Text
                            style={{
                              fontSize: 12,
                              lineHeight: 19,
                              color: TEXT_MUTED,
                            }}
                          >
                            การชั่งครั้งล่าสุดก่อนรอบนี้
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </Card>

              <Text
                style={{
                  paddingHorizontal: SPACE.xs,
                  fontSize: 12,
                  lineHeight: 19,
                  color: TEXT_MUTED,
                }}
              >
                รวมข้อมูลที่ Sync จาก HOSxP · เรียงจากครั้งล่าสุด
              </Text>
            </>
          )}
        </ScrollView>
      </HeaderFade>
    </View>
  );
}
