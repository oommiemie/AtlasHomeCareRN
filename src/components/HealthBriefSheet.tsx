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
import type { HealthBrief } from "../models/patientAi";
import type { Resident } from "../models/household";
import {
  FILL_SUBTLE,
  PANEL,
  PRIMARY_500,
  PRIMARY_700,
  RADIUS,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  RIM_LIT,
  shadow,
} from "../theme/tokens";

/**
 * The assistant's read on a whole record, in full.
 *
 * The card on the page carries the first lines of it; this is the rest. It
 * wears the same Liquid Glass the patient summary on the accept-task screen
 * wears — that surface is what marks the assistant as something apart from
 * the rest of the app, and the two are the same thing.
 */
export function HealthBriefSheet({
  visible,
  resident,
  brief,
  loading,
  onClose,
}: {
  visible: boolean;
  resident: Resident;
  brief: HealthBrief | null;
  loading: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

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
        showing it. It is also what says, before a word is read, that this
        sheet is the assistant and not another page of the record — the same
        light the patient summary on the accept-task screen carries.
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

        <Glass style={StyleSheet.absoluteFill}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: SPACE.lg,
              paddingTop: SPACE.lg,
              paddingBottom: SPACE.md,
            }}
          >
            {/* Not a glass button: glass on glass has only the sheet to refract
              and both flatten. The design's field fill instead. */}
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
              สรุปสุขภาพ
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
                style={{ fontSize: 20, fontWeight: "600", color: TEXT_PRIMARY }}
              >
                {resident.name}
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontSize: 14,
                  lineHeight: 22,
                  color: TEXT_SECONDARY,
                }}
              >
                {`${resident.age} ปี · ${resident.gender} · หมู่เลือด ${resident.bloodType}`}
              </Text>
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
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    letterSpacing: 0.6,
                    color: TEXT_SECONDARY,
                    textTransform: "uppercase",
                  }}
                >
                  สรุปโดยผู้ช่วย AI
                </Text>
              </View>

              {loading && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.sm,
                  }}
                >
                  <ActivityIndicator color={PRIMARY_500} />
                  <Text style={{ fontSize: 14, color: TEXT_MUTED }}>
                    กำลังอ่านข้อมูลสุขภาพ…
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

                  {brief.watch.length > 0 && (
                    <View style={{ marginTop: SPACE.lg, gap: SPACE.sm }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color: PRIMARY_700,
                        }}
                      >
                        ควรเฝ้าระวัง
                      </Text>
                      {brief.watch.map((line, i) => (
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

              {!loading && brief == null && (
                <Text
                  style={{ fontSize: 14, lineHeight: 22, color: TEXT_MUTED }}
                >
                  เชื่อมต่อผู้ช่วย AI ไม่ได้
                  ใช้ค่าที่วัดได้ในหน้าก่อนหน้าประกอบการพิจารณาได้เลย
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
                fontSize: 12,
                lineHeight: 20,
                color: TEXT_MUTED,
                textAlign: "center",
              }}
            >
              ผู้ช่วย AI อ่านเฉพาะค่าที่วัดได้และผลคัดกรอง ไม่ส่งชื่อ ภาพ
              เบอร์โทร หรือที่อยู่ และเป็นข้อมูลประกอบการพิจารณาเท่านั้น
              ไม่ใช่คำวินิจฉัย
            </Text>
          </ScrollView>
        </Glass>
      </View>
    </Modal>
  );
}

/**
 * One section's plate.
 *
 * The panel fill rather than a solid one: over glass a solid plate cuts the
 * material out of the middle of the sheet and leaves it showing only around
 * the edges.
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
        boxShadow: shadow({ blur: 10, y: 3, color: "#1E293B", opacity: 0.08 }),
      }}
    >
      {children}
    </View>
  );
}
