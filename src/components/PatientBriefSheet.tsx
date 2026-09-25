import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";

import { Aurora } from "./Aurora";
import { Glass } from "./Glass";
import { UIcon } from "./UIcon";
import { briefFlags, type BriefFlag } from "../models/patientBrief";
import { summariseForDecision, type PatientBrief } from "../models/patientAi";
import type { PatientDetail } from "../models/patientDetail";
import type { Task } from "../models/task";
import type { PastVisit } from "../models/community";
import { genderOf } from "../models/task";
import {
  DANGER,
  FILL_SUBTLE,
  PANEL,
  PRIMARY_500,
  PRIMARY_700,
  RADIUS,
  SPACE,
  SUCCESS,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  WARNING,
  RIM_LIT,
  shadow,
} from "../theme/tokens";

// Read as it renders: a module const would capture whichever palette
// was loaded at import and keep it through every theme change.
const LEVEL_COLOR = (): Record<BriefFlag["level"], string> => ({
  alert: DANGER,
  watch: WARNING,
});

/**
 * The quick read on a patient, for deciding whether to take the posting.
 *
 * Two things, in this order: what the record says outright, worked out on the
 * phone and on screen the moment the sheet opens; and beneath it what the
 * assistant makes of the same record. The order is the point — the carer sees
 * the findings first and the prose second, so a slow or absent model costs the
 * summary rather than the decision.
 *
 * An ordinary page sheet, the same one the rejection reasons come up in: the
 * system owns the corner radius, the grabber, the drag and the way the page
 * behind shrinks back. The only thing done differently is the surface — the
 * sheet paints no background of its own, so the Liquid Glass filling it has
 * the record behind to refract rather than a flat panel of its own colour.
 */
export function PatientBriefSheet({
  visible,
  task,
  detail,
  lastVisit,
  onClose,
}: {
  visible: boolean;
  task: Task;
  detail: PatientDetail;
  /** The most recent treatment on record, for the summary to take in. */
  lastVisit?: PastVisit;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const flags = briefFlags(task, detail);

  const [brief, setBrief] = useState<PatientBrief | null>(null);
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);
  // Asked once per record, not once per opening: the record does not change
  // between two looks at it.
  const askedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!visible || askedFor.current === task.id) return;
    askedFor.current = task.id;
    setAsking(true);
    setFailed(false);
    let live = true;
    summariseForDecision(task, detail, lastVisit).then((result) => {
      if (!live) return;
      setAsking(false);
      if (result == null) {
        setFailed(true);
        // So a retry is possible next time the sheet is opened.
        askedFor.current = null;
      } else {
        setBrief(result);
      }
    });
    return () => {
      live = false;
    };
  }, [visible, task, detail, lastVisit]);

  const gender = genderOf(task.name);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {/*
        The glass IS the sheet's background, so nothing OPAQUE may be painted
        behind it — one solid colour under here and the material has only that
        colour to sample.

        The aurora is the exception, and the reason for it: it sits behind the
        glass rather than on top, so the sheet refracts it instead of merely
        showing it. Clear glass over nothing is clear glass over nothing; this
        is what gives the material something to be made of.
      */}
      <View style={{ flex: 1 }}>
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            // The lower half only. The shader's band forms along the bottom
            // edge of whatever it is given and thins upward, so the height is
            // how far up the light reaches.
            height: "55%",
          }}
        >
          {/* Mounted with the sheet, not with the screen: it is a running
              render loop, and one behind a sheet nobody has opened is a warm
              phone for nothing. */}
          {visible && (
            <Aurora
              // The app's own light rather than the library's purple: brand
              // blue, the secondary mint, and a violet to turn the far edge.
              colorStops={["#339FF3", "#46D8AD", "#7C5CFF"]}
              // Slow and soft. This is the room's light, not an animation
              // anyone should catch themselves watching.
              speed={0.45}
              blend={0.62}
              amplitude={0.9}
            />
          )}
        </View>

        <Glass
          // No tint at all — the bare material, which is as clear as Liquid
          // Glass gets. A tint is painted OVER the glass rather than mixed into
          // it, so every point of white here is a point of the record behind
          // that stops coming through. The plates carry the legibility instead,
          // which is what leaves the sheet free to be transparent.
          style={StyleSheet.absoluteFill}
        >
          {/*
          The app's sheet header: the way out on the left, the title centred,
          and a spacer on the right so it stays centred.
        */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: SPACE.lg,
              paddingTop: SPACE.lg,
              paddingBottom: SPACE.md,
            }}
          >
            {/*
            The one departure, and it is forced: elsewhere this is a glass
            button standing on an opaque page. Here the page is the glass, and
            glass on glass has only the sheet to refract — both flatten into
            one dull patch. So it wears the design's field fill instead, at the
            size the glass button would have been.
          */}
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="ปิด"
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: FILL_SUBTLE,
              }}
            >
              <X size={22} color={TEXT_PRIMARY} strokeWidth={2.6} />
            </Pressable>
            <Text
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 16,
                fontWeight: "600",
                color: TEXT_PRIMARY,
              }}
            >
              สรุปข้อมูลผู้ป่วย
            </Text>
            {/* Balances the close button so the title stays centred. */}
            <View style={{ width: 44 }} />
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: SPACE.lg,
              paddingBottom: insets.bottom + SPACE.xxl,
              gap: SPACE.md,
            }}
            showsVerticalScrollIndicator={false}
          >
            <Panel>
              <Text
                style={{ fontSize: 24, fontWeight: "700", color: TEXT_PRIMARY }}
              >
                {task.name}
              </Text>
              <Text
                style={{
                  marginTop: SPACE.xs,
                  fontSize: 14,
                  lineHeight: 22,
                  color: TEXT_SECONDARY,
                }}
              >
                {[`${task.age} ปี`, gender, detail.condition]
                  .filter((part) => part != null && part !== "")
                  .join(" · ")}
              </Text>
            </Panel>

            {/* Why the visit is: straight off the record, before anything
                the model says about it. */}
            <Panel>
              <Heading>การเยี่ยมครั้งนี้</Heading>
              <View style={{ gap: SPACE.md }}>
                <Labelled label="เหตุผลการเยี่ยม" value={detail.visitReason} />
                <Labelled
                  label="วัตถุประสงค์การเยี่ยม"
                  value={detail.visitPurpose}
                />
              </View>
            </Panel>

            <Panel>
              <Heading>ข้อควรพิจารณา</Heading>
              <View style={{ gap: SPACE.md }}>
                {flags.length === 0 ? (
                  <Row
                    color={SUCCESS}
                    label="ไม่พบข้อควรระวังจากข้อมูลที่มี"
                    detail="สัญญาณชีพ ADL และประวัติแพ้ยาอยู่ในเกณฑ์"
                  />
                ) : (
                  flags.map((flag, i) => (
                    <Row
                      key={`${flag.label}-${i}`}
                      color={LEVEL_COLOR()[flag.level]}
                      label={flag.label}
                      detail={flag.detail}
                    />
                  ))
                )}
              </View>
            </Panel>

            <Panel>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACE.sm,
                  marginBottom: SPACE.md,
                }}
              >
                <UIcon name="magicWand" size={16} color={PRIMARY_500} />
                <Heading noGap>สรุปโดยผู้ช่วย AI</Heading>
              </View>

              {asking && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.sm,
                  }}
                >
                  <ActivityIndicator color={PRIMARY_500} />
                  <Text style={{ fontSize: 14, color: TEXT_MUTED }}>
                    กำลังอ่านข้อมูลผู้ป่วย…
                  </Text>
                </View>
              )}

              {brief != null && (
                <>
                  <Text
                    style={{
                      fontSize: 16,
                      lineHeight: 28,
                      color: TEXT_PRIMARY,
                    }}
                  >
                    {brief.overview}
                  </Text>

                  {brief.visit !== "" && (
                    <Paragraph
                      title="เหตุผลและวัตถุประสงค์การเยี่ยม"
                      text={brief.visit}
                    />
                  )}
                  {brief.lastVisit !== "" && (
                    <Paragraph
                      title={
                        lastVisit != null
                          ? `การรักษาล่าสุด · ${lastVisit.daysAgo} วันก่อน`
                          : "การรักษาล่าสุด"
                      }
                      text={brief.lastVisit}
                    />
                  )}

                  {brief.prepare.length > 0 && (
                    <View style={{ marginTop: SPACE.lg, gap: SPACE.sm }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color: PRIMARY_700,
                        }}
                      >
                        ควรเตรียมก่อนไป
                      </Text>
                      {brief.prepare.map((line, i) => (
                        <View
                          key={`${line}-${i}`}
                          style={{ flexDirection: "row", gap: SPACE.sm }}
                        >
                          <View
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 3,
                              marginTop: 9,
                              backgroundColor: PRIMARY_500,
                            }}
                          />
                          <Text
                            style={{
                              flex: 1,
                              fontSize: 14,
                              lineHeight: 24,
                              color: TEXT_PRIMARY,
                            }}
                          >
                            {line}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}

              {failed && (
                <Text
                  style={{ fontSize: 14, lineHeight: 22, color: TEXT_MUTED }}
                >
                  เชื่อมต่อผู้ช่วย AI ไม่ได้
                  ใช้ข้อควรพิจารณาด้านบนซึ่งสรุปจากข้อมูลในเครื่องได้เลย
                </Text>
              )}
            </Panel>

            {/*
            Said on the screen, not only in the code: the carer is the one
            handing over the record, so they are the one who should know how
            far it goes.
          */}
            <Text
              style={{
                marginTop: SPACE.sm,
                fontSize: 12,
                lineHeight: 20,
                color: TEXT_MUTED,
                textAlign: "center",
              }}
            >
              ผู้ช่วย AI อ่านเฉพาะข้อมูลทางคลินิก ไม่ส่งชื่อ เลขบัตรประชาชน HN
              เบอร์โทร หรือที่อยู่ และเป็นข้อมูลประกอบการตัดสินใจเท่านั้น
              ไม่ใช่คำวินิจฉัย
            </Text>
          </ScrollView>
        </Glass>
      </View>
    </Modal>
  );
}

/** A small grey label over its value. */
function Labelled({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={{ fontSize: 13, color: TEXT_MUTED }}>{label}</Text>
      <Text
        style={{
          marginTop: 2,
          fontSize: 16,
          lineHeight: 24,
          fontWeight: "600",
          color: TEXT_PRIMARY,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

/** One of the assistant's paragraphs, under its blue title. */
function Paragraph({ title, text }: { title: string; text: string }) {
  return (
    <View style={{ marginTop: SPACE.lg, gap: SPACE.xs }}>
      <Text style={{ fontSize: 14, fontWeight: "600", color: PRIMARY_700 }}>
        {title}
      </Text>
      <Text style={{ fontSize: 15, lineHeight: 26, color: TEXT_PRIMARY }}>
        {text}
      </Text>
    </View>
  );
}

function Heading({ children, noGap }: { children: string; noGap?: boolean }) {
  return (
    <Text
      style={{
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 0.6,
        color: TEXT_SECONDARY,
        textTransform: "uppercase",
        marginBottom: noGap ? 0 : SPACE.md,
      }}
    >
      {children}
    </Text>
  );
}

/**
 * One section's plate.
 *
 * Three things make it a box rather than a faint wash, and it needed all
 * three: a fill well above the sheet's own value, a lit rim along the edge,
 * and a shadow. The glass is not lost — it reads through the fill, and the
 * gaps between plates are nothing but glass.
 */
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: PANEL,
        borderRadius: RADIUS.card,
        borderWidth: 1,
        borderColor: RIM_LIT,
        padding: SPACE.lg,
        // Soft and close: the plate is resting on the glass, not floating
        // above it.
        boxShadow: shadow({ blur: 10, y: 3, color: "#1E293B", opacity: 0.08 }),
      }}
    >
      {children}
    </View>
  );
}

/** One finding: a dot carrying the weight, the finding, and what it was read from. */
function Row({
  color,
  label,
  detail,
}: {
  color: string;
  label: string;
  detail: string;
}) {
  return (
    <View
      style={{ flexDirection: "row", alignItems: "flex-start", gap: SPACE.md }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
          marginTop: 7,
        }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: "600", color: TEXT_PRIMARY }}>
          {label}
        </Text>
        <Text
          style={{
            marginTop: 2,
            fontSize: 14,
            lineHeight: 22,
            color: TEXT_MUTED,
          }}
        >
          {detail}
        </Text>
      </View>
    </View>
  );
}
