import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { CheckBox } from "../components/CheckBox";
import { feel } from "../utils/haptics";
import { ActionBar, PrimaryAction, SecondaryAction } from "../components/ActionBar";
import { Card } from "../components/Card";
import { PolicyClauses } from "../components/PolicyClauses";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import { giveConsent } from "../models/session";
import {
  SEPARATOR,
  SPACE,
  TEXT_PRIMARY,
} from "../theme/tokens";
import { FORM_MAX, readable, GUTTER } from "../theme/layout";
import { tr } from "../i18n";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * The privacy notice, and the two consents the Act requires before the
 * first record is written: to the policy, and — separately, because health
 * data is sensitive data — to handling patients' health data in the course
 * of the work. Both boxes, then the button lights.
 */
export function ConsentScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const [policy, setPolicy] = useState(false);
  const [health, setHealth] = useState(false);
  const ready = policy && health;

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={tr("นโยบายความเป็นส่วนตัว", "Privacy policy")} />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: GUTTER,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + 150,
            gap: SPACE.md,
            // A notice to read, so on a tablet it keeps to a column.
            ...readable(FORM_MAX),
          }}
          showsVerticalScrollIndicator={false}
        >
          <PolicyClauses />

          <Card style={{ gap: 2 }}>
            <Tick
              on={policy}
              onToggle={() => setPolicy((v) => !v)}
              text={tr(
                "ข้าพเจ้าได้อ่านและยอมรับนโยบายความเป็นส่วนตัวและข้อกำหนดการใช้งาน",
                "I have read and accept the privacy policy and terms of use.",
              )}
            />
            <View style={{ height: 1, backgroundColor: SEPARATOR }} />
            <Tick
              on={health}
              onToggle={() => setHealth((v) => !v)}
              text={tr(
                "ข้าพเจ้ายินยอมให้เก็บรวบรวม ใช้ และเปิดเผยข้อมูลสุขภาพของผู้รับบริการ เพื่อการดูแลตามหน้าที่ของหน่วยบริการ",
                "I consent to the collection, use and disclosure of patients' health data for care within the duties of the service unit.",
              )}
            />
          </Card>
        </ScrollView>
      </HeaderFade>

      <ActionBar>
        <PrimaryAction
          label={tr("ยอมรับและดำเนินการต่อ", "Accept and continue")}
          disabled={!ready}
          onPress={() => {
            giveConsent();
            toast(tr("บันทึกการยินยอมแล้ว", "Consent recorded"), "success");
            nav.navigate("Facility");
          }}
        />
        <SecondaryAction
          label={tr("ไม่ยอมรับ", "Decline")}
          onPress={() => nav.goBack()}
        />
      </ActionBar>
    </View>
  );
}

/** A consent line with its box — square, since it is a box to tick. */
function Tick({ on, onToggle, text }: { on: boolean; onToggle: () => void; text: string }) {
  return (
    <Pressable
      onPress={() => {
        feel("tick");
        onToggle();
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      style={{ flexDirection: "row", alignItems: "flex-start", gap: SPACE.md, paddingVertical: SPACE.md }}
    >
      <View style={{ marginTop: 1 }}>
        <CheckBox on={on} size={24} radius={6} />
      </View>
      <Text style={{ flex: 1, fontSize: 14, lineHeight: 22, color: TEXT_PRIMARY }}>{text}</Text>
    </Pressable>
  );
}
