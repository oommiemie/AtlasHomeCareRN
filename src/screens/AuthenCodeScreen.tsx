import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Check } from "lucide-react-native";

import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { Card } from "../components/Card";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionHeader } from "../components/SectionHeader";
import { toast } from "../components/Toast";
import { feel } from "../utils/haptics";
import {
  AUTHEN_RIGHTS,
  authenRightById,
  type AuthenRight,
} from "../models/authenCode";
import { chooseAuthenCode, useSession } from "../models/session";
import {
  CANVAS,
  FILL_SUBTLE,
  INK_OK,
  PRIMARY_500,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme/tokens";

/**
 * "สิทธิใน Authen Code" — which unit the next service is claimed under.
 *
 * A picker with a save, not a settings page that applies on touch. Every
 * other row under ฉัน changes something about the app; this changes who
 * gets paid for the work, and a right switched by a thumb brushing the
 * list while scrolling would not be noticed until a month's claims came
 * back under the wrong unit. So the tap chooses and the button commits,
 * which is the same shape the สถานพยาบาล picker has for the same reason.
 *
 * The one in force is shown above the list rather than as a ticked row in
 * it. A carer opening this is answering two questions — what am I on, and
 * what else could I be on — and a list that answers both at once answers
 * neither quickly.
 */
export function AuthenCodeScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const me = useSession();

  const inForce = authenRightById(me.authenCode);
  const [picked, setPicked] = useState<string>(inForce.id);
  const others = AUTHEN_RIGHTS.filter((r) => r.id !== inForce.id);

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <ScreenHeader title="สิทธิใน Authen Code" />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: SPACE.lg,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + 100,
            gap: SPACE.md,
          }}
          showsVerticalScrollIndicator={false}
        >
          <SectionHeader title="Authen Code ที่ใช้อยู่" flush />
          {/*
            The one in force, in the green the app reserves for a thing
            that is settled. Tinted rather than white: on a page whose
            whole business is which of these is chosen, the chosen one
            cannot look like the rest of the list.
          */}
          <Card style={{ backgroundColor: `${INK_OK}14`, gap: SPACE.xs }}>
            <Text
              style={{
                fontSize: 16,
                lineHeight: 25,
                fontWeight: "700",
                color: INK_OK,
              }}
            >
              {inForce.name}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.sm,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: INK_OK,
                }}
              />
              <Text
                style={{ fontSize: 13, lineHeight: 21, color: TEXT_SECONDARY }}
              >
                {`รหัส ${inForce.code}${inForce.primary === true ? " · สังกัดหลัก" : ""}`}
              </Text>
            </View>
          </Card>

          <SectionHeader title="สิทธิอื่นของคุณ" count={others.length} flush />
          {others.length === 0 ? (
            <Card>
              <Text style={{ fontSize: 14, lineHeight: 22, color: TEXT_MUTED }}>
                Provider ID นี้ผูกกับหน่วยบริการเดียว จึงไม่มีสิทธิอื่นให้เลือก
              </Text>
            </Card>
          ) : (
            <Card padded={false}>
              {others.map((r, i) => (
                <Row
                  key={r.id}
                  right={r}
                  on={picked === r.id}
                  divider={i > 0}
                  onPress={() => {
                    feel("tick");
                    // Touching the one already in force takes the choice
                    // back rather than doing nothing — it is the only way
                    // out of a selection short of leaving the page.
                    setPicked((was) => (was === r.id ? inForce.id : r.id));
                  }}
                />
              ))}
            </Card>
          )}
        </ScrollView>
      </HeaderFade>

      <ActionBar>
        <PrimaryAction
          label="บันทึก"
          disabled={picked === inForce.id}
          onPress={() => {
            chooseAuthenCode(picked);
            toast(`ใช้ Authen Code ของ ${authenRightById(picked).name} แล้ว`);
            nav.goBack();
          }}
        />
      </ActionBar>
    </View>
  );
}

/** One right the carer holds, and whether it is the one being moved to. */
function Row({
  right,
  on,
  divider,
  onPress,
}: {
  right: AuthenRight;
  on: boolean;
  divider: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={right.name}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.md,
        paddingHorizontal: SPACE.lg,
        paddingVertical: SPACE.lg,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: SEPARATOR,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            fontSize: 16,
            lineHeight: 25,
            fontWeight: on ? "700" : "600",
            color: TEXT_PRIMARY,
          }}
        >
          {right.name}
        </Text>
        <Text style={{ fontSize: 13, lineHeight: 21, color: TEXT_MUTED }}>
          {`รหัส ${right.code}${right.primary === true ? " · สังกัดหลัก" : ""}`}
        </Text>
      </View>

      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: on ? PRIMARY_500 : "transparent",
          borderWidth: on ? 0 : 1.5,
          borderColor: FILL_SUBTLE,
        }}
      >
        {on && <Check size={15} color="#FFFFFF" strokeWidth={3} />}
      </View>
    </Pressable>
  );
}
