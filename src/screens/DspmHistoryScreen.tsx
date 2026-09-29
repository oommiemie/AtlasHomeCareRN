import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { CircleCheck, TriangleAlert } from "lucide-react-native";

import { Card } from "../components/Card";
import { tr } from "../i18n";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionHeader } from "../components/SectionHeader";
import { StatusTag } from "../components/StatusTag";
import type { RootStackParamList } from "../navigation/RootStack";
import { useSession } from "../models/vaccination";
import { ageLabel, sexLabel } from "../models/growth";
import {
  DOMAIN_LABEL,
  LEVEL_LABEL,
  nextWindowAfter,
  type DspmLevel,
} from "../models/dspm";
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
import { readable, GUTTER } from "../theme/layout";

type R = RouteProp<RootStackParamList, "DspmHistory">;

const LEVEL_INK: Record<DspmLevel, string> = {
  onTrack: INK_OK,
  suspect: WARNING,
  delayed: DANGER_INK,
};

/**
 * tr("ประวัติการคัดกรอง", "Screening history") — every DSPM round this child has had.
 *
 * On its own page rather than at the foot of the form, for the same reason
 * the weighing history is: a carer with a child in front of them should not
 * have to scroll past the last two years to reach the items, and a carer
 * asking what happened at forty-eight months should not have to open a
 * screening they are not carrying out.
 *
 * Each round in full — which window, which time round, how many items, and
 * WHICH DOMAINS were missed. That last one is the column the file is
 * actually read for: a child who missed language at two and language again
 * at three is a different child from one who missed a different domain each
 * time, and a history that kept only "สงสัยล่าช้า" could not tell them
 * apart.
 */
export function DspmHistoryScreen() {
  const { targetId } = useRoute<R>().params;
  const insets = useSafeAreaInsets();
  const { session } = useSession();

  const row = session?.rows.find((r) => r.target.id === targetId);
  const target = row?.target;

  if (target == null) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title={tr("ประวัติการคัดกรอง", "Screening history")} />
        <Text
          style={{ paddingVertical: SPACE.lg, paddingHorizontal: GUTTER, fontSize: 15, color: TEXT_SECONDARY }}
        >
          {tr("ไม่พบรายชื่อนี้ใน Session ที่เปิดอยู่", "This name isn't in the open session")}
        </Text>
      </View>
    );
  }

  const past = [...(target.screenings ?? [])].reverse();

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <ScreenHeader title={tr("ประวัติการคัดกรอง", "Screening history")} />

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
            <Text
              style={{ fontSize: 13, lineHeight: 20, color: TEXT_SECONDARY }}
            >
              {`${sexLabel(target.sex)} · ${ageLabel(target.months)} · HN ${target.hn}`}
            </Text>
            <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
              {target.room}
            </Text>
          </Card>

          {past.length === 0 ? (
            <Card>
              <Text style={{ fontSize: 14, lineHeight: 22, color: TEXT_MUTED }}>
                {tr("ยังไม่มีประวัติการคัดกรองของเด็กรายนี้ในระบบ", "No screening history for this child yet")}
              </Text>
            </Card>
          ) : (
            <>
              <SectionHeader
                title={tr("การคัดกรองที่ผ่านมา", "Past screenings")}
                count={past.length}
                flush
              />
              <Card padded={false}>
                {past.map((r, i) => (
                  <View key={r.at.toISOString()}>
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
                          {`${thaiShortDate(r.at)} · ${tr(`ช่วง ${r.window} เดือน`, `${r.window}-month window`)}`}
                        </Text>
                        <StatusTag
                          // Worded from the level, so a round saved in
                          // either language reads in the one on screen.
                          label={LEVEL_LABEL[r.level]}
                          ink={LEVEL_INK[r.level]}
                          Icon={
                            r.level === "onTrack" ? CircleCheck : TriangleAlert
                          }
                        />
                      </View>

                      <Text
                        style={{
                          fontSize: 12,
                          lineHeight: 18,
                          color: TEXT_MUTED,
                        }}
                      >
                        {tr(
                          `ครั้งที่ ${r.round} · ผ่าน ${r.passed}/${r.total} ข้อ · ผู้ประเมิน ${r.by}`,
                          `Round ${r.round} · Passed ${r.passed}/${r.total} items · Assessor ${r.by}`,
                        )}
                      </Text>

                      {/* The column the file is read for: not "failed" but
                          WHICH. Two misses in the same domain a year apart
                          is the pattern a referral is built on. */}
                      <Text
                        style={{
                          fontSize: 13,
                          lineHeight: 21,
                          color:
                            r.failed.length === 0 ? TEXT_SECONDARY : DANGER_INK,
                        }}
                      >
                        {r.failed.length === 0
                          ? tr(
                              `ผ่านทุกด้าน — นัดคัดกรองช่วง ${nextWindowAfter(r.window) ?? "ถัดไป"} เดือน`,
                              nextWindowAfter(r.window) == null
                                ? "Passed every domain — book the next screening"
                                : `Passed every domain — book the ${nextWindowAfter(r.window)}-month screening`,
                            )
                          : `${tr("ไม่ผ่าน", "Not passed")}: ${r.failed.map((d) => DOMAIN_LABEL[d]).join(" · ")}`}
                      </Text>
                    </View>
                  </View>
                ))}
              </Card>

              <Text
                style={{
                  paddingHorizontal: SPACE.xs,
                  fontSize: 12,
                  lineHeight: 19,
                  color: TEXT_MUTED,
                }}
              >
                {tr("รวมข้อมูลที่ Sync จาก HOSxP · เรียงจากครั้งล่าสุด", "Includes data synced from HOSxP · Newest first")}
              </Text>
            </>
          )}
        </ScrollView>
      </HeaderFade>
    </View>
  );
}
