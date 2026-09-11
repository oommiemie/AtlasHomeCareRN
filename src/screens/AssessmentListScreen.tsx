import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, type RouteProp } from "@react-navigation/native";

import { Chevron } from "../components/Chevron";
import { Card } from "../components/Card";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import { ASSESSMENTS } from "../models/community";
import {
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";

/**
 * "แบบประเมิน" — Figma 98:13058.
 *
 * A list of forms rather than a form: which one is asked depends on the
 * patient, and a carer picks it off the list knowing the answer before they
 * open it. Every row is the same shape — the form's name, a line on what it
 * covers, and the arrow — because none of them outranks the others; the one
 * that matters today is the one this patient needs.
 */
export function AssessmentListScreen() {
  const { holder } =
    useRoute<RouteProp<RootStackParamList, "AssessmentList">>().params;
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="แบบประเมิน" />

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
            {`สำหรับ คุณ${holder.name} · HN ${holder.hn}`}
          </Text>

          {ASSESSMENTS.map((a) => (
            <Card
              key={a.key}
              onPress={() => toast(`${a.label} ยังไม่เปิดใช้งาน`)}
              accessibilityLabel={a.label}
            >
              <View style={{ gap: 8 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 16,
                      lineHeight: 21,
                      fontWeight: "600",
                      color: TEXT_PRIMARY,
                    }}
                  >
                    {a.label}
                  </Text>
                  <Chevron />
                </View>
                <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
                  {a.detail}
                </Text>
              </View>
            </Card>
          ))}
        </ScrollView>
      </HeaderFade>
    </View>
  );
}
