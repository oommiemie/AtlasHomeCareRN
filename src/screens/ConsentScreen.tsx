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
      <ScreenHeader title="นโยบายความเป็นส่วนตัว" />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: SPACE.lg,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + 150,
            gap: SPACE.md,
          }}
          showsVerticalScrollIndicator={false}
        >
          <PolicyClauses />

          <Card style={{ gap: 2 }}>
            <Tick
              on={policy}
              onToggle={() => setPolicy((v) => !v)}
              text="ข้าพเจ้าได้อ่านและยอมรับนโยบายความเป็นส่วนตัวและข้อกำหนดการใช้งาน"
            />
            <View style={{ height: 1, backgroundColor: SEPARATOR }} />
            <Tick
              on={health}
              onToggle={() => setHealth((v) => !v)}
              text="ข้าพเจ้ายินยอมให้เก็บรวบรวม ใช้ และเปิดเผยข้อมูลสุขภาพของผู้รับบริการ เพื่อการดูแลตามหน้าที่ของหน่วยบริการ"
            />
          </Card>
        </ScrollView>
      </HeaderFade>

      <ActionBar>
        <PrimaryAction
          label="ยอมรับและดำเนินการต่อ"
          disabled={!ready}
          onPress={() => {
            giveConsent();
            toast("บันทึกการยินยอมแล้ว", "success");
            nav.navigate("Facility");
          }}
        />
        <SecondaryAction label="ไม่ยอมรับ" onPress={() => nav.goBack()} />
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
