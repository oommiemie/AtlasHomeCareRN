import { Modal, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarClock, Check, Stethoscope, X } from "lucide-react-native";

import { Card } from "./Card";
import { GlassIconButton } from "./GlassIconButton";
import { homeVisitLabel, type PastVisit } from "../models/community";
import { tr } from "../i18n";
import { thaiFullDate } from "../utils/thaiDate";
import {
  CANVAS,
  DANGER,
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
import { GUTTER } from "../theme/layout";

/** When it was, said two ways. */
export function whenOf(daysAgo: number) {
  const date = new Date(Date.now() - daysAgo * 86400000);
  const ago =
    daysAgo < 30
      ? tr(`${daysAgo} วันก่อน`, `${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`)
      : tr(
          `${Math.round(daysAgo / 30)} เดือนก่อน`,
          `${Math.round(daysAgo / 30)} month${Math.round(daysAgo / 30) === 1 ? "" : "s"} ago`,
        );
  return { date, ago };
}

/**
 * One past visit, in full, as a sheet — shared by the treatment history and
 * the health profile's visit history, which open the same record.
 */
export function VisitDetailSheet({
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
      supportedOrientations={["portrait", "landscape"]}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: CANVAS }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: GUTTER,
            paddingTop: SPACE.lg,
          }}
        >
          <GlassIconButton onPress={onClose} accessibilityLabel={tr("ปิด", "Close")}>
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
            {tr("รายละเอียดการรักษา", "Treatment details")}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        {visit != null && (
          <ScrollView
            contentContainerStyle={{
              paddingVertical: SPACE.lg,
              paddingHorizontal: GUTTER,
              gap: SPACE.md,
              paddingBottom: insets.bottom + SPACE.xl,
            }}
            showsVerticalScrollIndicator={false}
          >
            {/* When and where. */}
            <Card style={{ gap: SPACE.md }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACE.md,
                }}
              >
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
                  <CalendarClock
                    size={20}
                    color={PRIMARY_500}
                    strokeWidth={2.2}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      lineHeight: 21,
                      fontWeight: "700",
                      color: TEXT_PRIMARY,
                    }}
                  >
                    {thaiFullDate(whenOf(visit.daysAgo).date)}
                  </Text>
                  <Text
                    style={{ fontSize: 12, lineHeight: 16, color: TEXT_MUTED }}
                  >
                    {whenOf(visit.daysAgo).ago}
                  </Text>
                </View>
              </View>
              <View style={{ height: 1, backgroundColor: SEPARATOR }} />
              <View style={{ gap: 6 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.sm,
                  }}
                >
                  <Stethoscope size={15} color={TEXT_MUTED} strokeWidth={2} />
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 14,
                      lineHeight: 19,
                      color: TEXT_PRIMARY,
                    }}
                  >
                    {visit.clinic}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    lineHeight: 18,
                    color: TEXT_MUTED,
                    marginLeft: 23,
                  }}
                >
                  {visit.staff}
                </Text>
              </View>
            </Card>

            {/* What came of it. */}
            <Card style={{ gap: SPACE.sm }}>
              <SectionTitle>{tr("สรุปผลการรักษา", "Treatment summary")}</SectionTitle>
              <Text
                style={{ fontSize: 14, lineHeight: 22, color: TEXT_PRIMARY }}
              >
                {visit.summary}
              </Text>
            </Card>

            {/* อาการสำคัญ / ประวัติ. */}
            {(visit.complaint != null || visit.hpi != null) && (
              <Card style={{ gap: SPACE.md }}>
                <SectionTitle>{tr("การซักประวัติ", "History")}</SectionTitle>
                {visit.complaint != null && (
                  <Field label={tr("อาการสำคัญ", "Chief complaint")} value={visit.complaint} />
                )}
                {visit.hpi != null && (
                  <Field label={tr("ประวัติปัจจุบัน", "History of present illness")} value={visit.hpi} />
                )}
              </Card>
            )}

            {/* Vital signs, as a plain list — label left, value right. */}
            {visit.vitals.length > 0 && (
              <Card style={{ gap: 0 }}>
                <SectionTitle>{tr("สัญญาณชีพ", "Vital signs")}</SectionTitle>
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
                      <Text
                        style={{ flex: 1, fontSize: 14, color: TEXT_SECONDARY }}
                      >
                        {v.label}
                      </Text>
                      {off && (
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "600",
                            color: WARNING,
                          }}
                        >
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
                      <Text
                        style={{
                          fontSize: 12,
                          color: TEXT_MUTED,
                          minWidth: 52,
                        }}
                      >
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
                <SectionTitle>{tr("แบบประเมิน", "Assessments")}</SectionTitle>
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
                          fontSize: 14,
                          fontWeight: "600",
                          color: TEXT_PRIMARY,
                        }}
                      >
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
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color: PRIMARY_500,
                          }}
                        >
                          {a.score}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={{
                        fontSize: 14,
                        lineHeight: 19,
                        color: TEXT_SECONDARY,
                      }}
                    >
                      {a.result}
                    </Text>
                  </View>
                ))}
              </Card>
            )}

            {/* The home visit, section by section. */}
            {visit.homeVisit != null && (
              <Card style={{ gap: SPACE.md }}>
                <SectionTitle>{tr("บันทึกเยี่ยมบ้าน", "Home visit record")}</SectionTitle>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: SPACE.sm,
                  }}
                >
                  {/* Saved in whichever language the visit was recorded in; the
                      label reads the Thai values back in English. */}
                  <Chip>{homeVisitLabel(visit.homeVisit.kind)}</Chip>
                  <Chip>{homeVisitLabel(visit.homeVisit.dependency)}</Chip>
                  <Chip>{homeVisitLabel(visit.homeVisit.adherence)}</Chip>
                </View>
                <Field label={tr("ผู้ดูแลหลัก", "Primary caregiver")} value={visit.homeVisit.caregiver} />
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 12, color: TEXT_MUTED }}>
                    {tr("สภาพบ้าน", "Home conditions")}
                  </Text>
                  {visit.homeVisit.checks.map((c) => (
                    <View
                      key={c.label}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: SPACE.sm,
                        paddingVertical: 2,
                      }}
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
                <Field label={tr("การซักประวัติ", "History")} value={visit.homeVisit.history} />
                <Field label={tr("การตรวจร่างกาย", "Physical examination")} value={visit.homeVisit.exam} />
                <Field
                  label={tr("จิตใจและสังคม", "Psychosocial")}
                  value={visit.homeVisit.psychosocial}
                />
                <Field label={tr("ปัญหาที่พบ", "Problems found")} value={visit.homeVisit.problems} />
                <Field label={tr("แผนการดูแล", "Care plan")} value={visit.homeVisit.plan} />
                <Field
                  label={tr("ความรู้และข้อแนะนำ", "Education and advice")}
                  value={visit.homeVisit.advice}
                />
              </Card>
            )}

            {/* Labs. */}
            {visit.labs.length > 0 && (
              <Card style={{ gap: SPACE.md }}>
                <SectionTitle>{tr("ผลตรวจทางห้องปฏิบัติการ", "Laboratory results")}</SectionTitle>
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
                      <Text style={{ fontSize: 14, color: TEXT_PRIMARY }}>
                        {l.name}
                      </Text>
                      <Text
                        style={{ fontSize: 12, color: TEXT_MUTED }}
                      >{tr(`ค่าปกติ ${l.ref}`, `Normal ${l.ref}`)}</Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "700",
                        color:
                          l.flag === "high"
                            ? DANGER
                            : l.flag === "low"
                              ? WARNING
                              : TEXT_PRIMARY,
                      }}
                    >
                      {l.value}
                    </Text>
                    {l.flag != null && (
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: l.flag === "high" ? DANGER : WARNING,
                        }}
                      >
                        {l.flag === "high" ? tr("สูง", "High") : tr("ต่ำ", "Low")}
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
    <Text
      style={{
        fontSize: 12,
        lineHeight: 18,
        fontWeight: "600",
        color: PRIMARY_500,
      }}
    >
      {children}
    </Text>
  );
}

/** A labelled block of text. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 3 }}>
      <Text style={{ fontSize: 12, color: TEXT_MUTED }}>{label}</Text>
      <Text style={{ fontSize: 14, lineHeight: 21, color: TEXT_PRIMARY }}>
        {value}
      </Text>
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
      <Text style={{ fontSize: 12, fontWeight: "500", color: PRIMARY_500 }}>
        {children}
      </Text>
    </View>
  );
}
