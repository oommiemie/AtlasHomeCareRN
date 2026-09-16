import { useState } from "react";
import { Modal, ScrollView, Text, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { CalendarClock, Check, Stethoscope, X } from "lucide-react-native";

import { Card } from "../components/Card";
import { Chevron } from "../components/Chevron";
import { GlassIconButton } from "../components/GlassIconButton";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import type { RootStackParamList } from "../navigation/RootStack";
import { treatmentHistory, type PastVisit } from "../models/community";
import { thaiFullDate } from "../utils/thaiDate";
import {
  CANVAS,
  DANGER,
  GROUPED_BG,
  PRIMARY_100,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  SUCCESS,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  WARNING,
} from "../theme/tokens";

/** When it was, said two ways. */
function whenOf(daysAgo: number) {
  const date = new Date(Date.now() - daysAgo * 86400000);
  const ago =
    daysAgo < 30 ? `${daysAgo} วันก่อน` : `${Math.round(daysAgo / 30)} เดือนก่อน`;
  return { date, ago };
}

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
      <ScreenHeader title="ประวัติการรักษา" />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: SPACE.lg,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + SPACE.huge,
            gap: SPACE.md,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
            {`${name} · HN ${hn} · ${visits.length} ครั้งการรักษา`}
          </Text>

          {visits.map((v) => {
            const { date, ago } = whenOf(v.daysAgo);
            return (
              <Card key={v.id} onPress={() => setOpen(v)} accessibilityLabel={thaiFullDate(date)}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
                      <CalendarClock size={15} color={PRIMARY_500} strokeWidth={2.2} />
                      <Text
                        style={{ flex: 1, fontSize: 14, lineHeight: 20, fontWeight: "600", color: TEXT_PRIMARY }}
                      >
                        {thaiFullDate(date)}
                      </Text>
                      <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>{ago}</Text>
                    </View>
                    <Text numberOfLines={1} style={{ fontSize: 14, lineHeight: 18, color: TEXT_SECONDARY }}>
                      {v.clinic}
                    </Text>
                    <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
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

/** One past visit, in full, as a sheet over the list. */
function VisitDetailSheet({
  visit,
  onClose,
}: {
  visit: PastVisit | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visit != null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: CANVAS }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: SPACE.lg,
            paddingTop: SPACE.lg,
          }}
        >
          <GlassIconButton onPress={onClose} accessibilityLabel="ปิด">
            <X size={22} color={TEXT_PRIMARY} strokeWidth={2.6} />
          </GlassIconButton>
          <Text
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 16,
              fontWeight: "600",
              color: TEXT_PRIMARY,
            }}
          >
            รายละเอียดการรักษา
          </Text>
          <View style={{ width: 44 }} />
        </View>

        {visit != null && (
          <ScrollView
            contentContainerStyle={{
              padding: SPACE.lg,
              gap: SPACE.md,
              paddingBottom: insets.bottom + SPACE.xl,
            }}
            showsVerticalScrollIndicator={false}
          >
            {/* When and where. */}
            <Card style={{ gap: SPACE.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: PRIMARY_100,
                  }}
                >
                  <CalendarClock size={20} color={PRIMARY_500} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={{ fontSize: 16, lineHeight: 21, fontWeight: "700", color: TEXT_PRIMARY }}>
                    {thaiFullDate(whenOf(visit.daysAgo).date)}
                  </Text>
                  <Text style={{ fontSize: 12, lineHeight: 16, color: TEXT_MUTED }}>
                    {whenOf(visit.daysAgo).ago}
                  </Text>
                </View>
              </View>
              <View style={{ height: 1, backgroundColor: SEPARATOR }} />
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
                  <Stethoscope size={15} color={TEXT_MUTED} strokeWidth={2} />
                  <Text style={{ flex: 1, fontSize: 14, lineHeight: 19, color: TEXT_PRIMARY }}>
                    {visit.clinic}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED, marginLeft: 23 }}>
                  {visit.staff}
                </Text>
              </View>
            </Card>

            {/* What came of it. */}
            <Card style={{ gap: SPACE.sm }}>
              <SectionTitle>สรุปผลการรักษา</SectionTitle>
              <Text style={{ fontSize: 14, lineHeight: 22, color: TEXT_PRIMARY }}>
                {visit.summary}
              </Text>
            </Card>

            {/* อาการสำคัญ / ประวัติ. */}
            {(visit.complaint != null || visit.hpi != null) && (
              <Card style={{ gap: SPACE.md }}>
                <SectionTitle>การซักประวัติ</SectionTitle>
                {visit.complaint != null && (
                  <Field label="อาการสำคัญ" value={visit.complaint} />
                )}
                {visit.hpi != null && <Field label="ประวัติปัจจุบัน" value={visit.hpi} />}
              </Card>
            )}

            {/* Vital signs, as a plain list — label left, value right. */}
            {visit.vitals.length > 0 && (
              <Card style={{ gap: 0 }}>
                <SectionTitle>สัญญาณชีพ</SectionTitle>
                {visit.vitals.map((v, i) => {
                  const off = v.note != null;
                  return (
                    <View
                      key={v.label}
                      style={{
                        flexDirection: "row",
                        alignItems: "baseline",
                        gap: SPACE.sm,
                        paddingVertical: 11,
                        borderTopWidth: 1,
                        borderTopColor: SEPARATOR,
                        marginTop: i === 0 ? SPACE.sm : 0,
                      }}
                    >
                      <Text style={{ flex: 1, fontSize: 14, color: TEXT_SECONDARY }}>
                        {v.label}
                      </Text>
                      {off && (
                        <Text style={{ fontSize: 12, fontWeight: "600", color: WARNING }}>
                          {v.note}
                        </Text>
                      )}
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "700",
                          color: off ? WARNING : TEXT_PRIMARY,
                        }}
                      >
                        {v.value}
                      </Text>
                      <Text style={{ fontSize: 12, color: TEXT_MUTED, minWidth: 52 }}>
                        {v.unit}
                      </Text>
                    </View>
                  );
                })}
              </Card>
            )}

            {/* Assessments. */}
            {visit.assessments.length > 0 && (
              <Card style={{ gap: SPACE.md }}>
                <SectionTitle>แบบประเมิน</SectionTitle>
                {visit.assessments.map((a, i) => (
                  <View
                    key={a.name}
                    style={{
                      gap: 4,
                      paddingTop: i === 0 ? 0 : SPACE.md,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: SEPARATOR,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
                      <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: TEXT_PRIMARY }}>
                        {a.name}
                      </Text>
                      <View
                        style={{
                          paddingHorizontal: SPACE.md,
                          paddingVertical: 3,
                          borderRadius: RADIUS.capsule,
                          backgroundColor: PRIMARY_100,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "700", color: PRIMARY_500 }}>
                          {a.score}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 14, lineHeight: 19, color: TEXT_SECONDARY }}>
                      {a.result}
                    </Text>
                  </View>
                ))}
              </Card>
            )}

            {/* The home visit, section by section. */}
            {visit.homeVisit != null && (
              <Card style={{ gap: SPACE.md }}>
                <SectionTitle>บันทึกเยี่ยมบ้าน</SectionTitle>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
                  <Chip>{visit.homeVisit.kind}</Chip>
                  <Chip>{visit.homeVisit.dependency}</Chip>
                  <Chip>{visit.homeVisit.adherence}</Chip>
                </View>
                <Field label="ผู้ดูแลหลัก" value={visit.homeVisit.caregiver} />
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 12, color: TEXT_MUTED }}>สภาพบ้าน</Text>
                  {visit.homeVisit.checks.map((c) => (
                    <View
                      key={c.label}
                      style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm, paddingVertical: 2 }}
                    >
                      {c.ok ? (
                        <Check size={15} color={SUCCESS} strokeWidth={2.6} />
                      ) : (
                        <X size={15} color={DANGER} strokeWidth={2.6} />
                      )}
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 14,
                          lineHeight: 19,
                          color: c.ok ? TEXT_PRIMARY : TEXT_SECONDARY,
                        }}
                      >
                        {c.label}
                      </Text>
                    </View>
                  ))}
                </View>
                <Field label="การซักประวัติ" value={visit.homeVisit.history} />
                <Field label="การตรวจร่างกาย" value={visit.homeVisit.exam} />
                <Field label="จิตใจและสังคม" value={visit.homeVisit.psychosocial} />
                <Field label="ปัญหาที่พบ" value={visit.homeVisit.problems} />
                <Field label="แผนการดูแล" value={visit.homeVisit.plan} />
                <Field label="ความรู้และข้อแนะนำ" value={visit.homeVisit.advice} />
              </Card>
            )}

            {/* Labs. */}
            {visit.labs.length > 0 && (
              <Card style={{ gap: SPACE.md }}>
                <SectionTitle>ผลตรวจทางห้องปฏิบัติการ</SectionTitle>
                {visit.labs.map((l, i) => (
                  <View
                    key={l.name}
                    style={{
                      flexDirection: "row",
                      alignItems: "baseline",
                      gap: SPACE.sm,
                      paddingTop: i === 0 ? 0 : SPACE.sm,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: SEPARATOR,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 14, color: TEXT_PRIMARY }}>{l.name}</Text>
                      <Text style={{ fontSize: 12, color: TEXT_MUTED }}>{`ค่าปกติ ${l.ref}`}</Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "700",
                        color: l.flag === "high" ? DANGER : l.flag === "low" ? WARNING : TEXT_PRIMARY,
                      }}
                    >
                      {l.value}
                    </Text>
                    {l.flag != null && (
                      <Text style={{ fontSize: 12, fontWeight: "700", color: l.flag === "high" ? DANGER : WARNING }}>
                        {l.flag === "high" ? "สูง" : "ต่ำ"}
                      </Text>
                    )}
                  </View>
                ))}
              </Card>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

/** A section's small blue title. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: 12, lineHeight: 18, fontWeight: "600", color: PRIMARY_500 }}>
      {children}
    </Text>
  );
}

/** A labelled block of text. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 3 }}>
      <Text style={{ fontSize: 12, color: TEXT_MUTED }}>{label}</Text>
      <Text style={{ fontSize: 14, lineHeight: 21, color: TEXT_PRIMARY }}>{value}</Text>
    </View>
  );
}

/** A pale blue chip. */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        paddingHorizontal: SPACE.md,
        paddingVertical: 4,
        borderRadius: RADIUS.capsule,
        backgroundColor: PRIMARY_100,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "500", color: PRIMARY_500 }}>{children}</Text>
    </View>
  );
}
