import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Building, Check, Hospital } from "lucide-react-native";

import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { Card } from "../components/Card";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { SearchField } from "../components/SearchField";
import type { RootStackParamList } from "../navigation/RootStack";
import { searchFacilities, type Facility } from "../models/facility";
import { chooseFacility } from "../models/session";
import {
  FILL_SUBTLE,
  PRIMARY_100,
  PRIMARY_500,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Which facility today's work is filed under.
 *
 * The account's own come first, since nine times in ten it is one of
 * those; the rest are there for the day a carer is lent to the next
 * district. One tap picks, the button confirms.
 */
export function FacilityScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  // From settings the choice is the whole errand; first time through it is
  // one step of several.
  const from = useRoute<RouteProp<RootStackParamList, "Facility">>().params?.from;
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Facility | null>(null);

  const hits = useMemo(() => searchFacilities(q), [q]);
  const mine = hits.filter((f) => f.mine);
  const others = hits.filter((f) => !f.mine);

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title="เลือกสถานพยาบาล"
        below={
          <View style={{ marginTop: SPACE.md }}>
            <SearchField value={q} onChangeText={setQ} placeholder="ค้นหาชื่อ รหัส หรือเขต" />
          </View>
        }
      />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: SPACE.lg,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + 100,
            gap: SPACE.md,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {mine.length > 0 && <Group title="สังกัดของคุณ" list={mine} picked={picked} onPick={setPicked} />}
          {others.length > 0 && (
            <Group title="สถานพยาบาลใกล้เคียง" list={others} picked={picked} onPick={setPicked} />
          )}
          {hits.length === 0 && (
            <Text style={{ fontSize: 14, color: TEXT_MUTED, textAlign: "center", paddingVertical: SPACE.xl }}>
              ไม่พบสถานพยาบาลที่ตรงกับคำค้น
            </Text>
          )}
        </ScrollView>
      </HeaderFade>

      <ActionBar>
        <PrimaryAction
          label={picked ? "ยืนยัน" : "เลือกสถานพยาบาล"}
          disabled={picked == null}
          onPress={() => {
            if (picked == null) return;
            chooseFacility(picked);
            if (from === "settings") nav.goBack();
            else nav.navigate("Pin");
          }}
        />
      </ActionBar>
    </View>
  );
}

/** One heading and its facilities, in a card. */
function Group({
  title,
  list,
  picked,
  onPick,
}: {
  title: string;
  list: Facility[];
  picked: Facility | null;
  onPick: (f: Facility) => void;
}) {
  return (
    <View style={{ gap: SPACE.sm }}>
      <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 0.4, color: TEXT_MUTED, paddingHorizontal: SPACE.xs }}>
        {title}
      </Text>
      <Card style={{ paddingVertical: 0 }}>
        {list.map((f, i) => {
          const on = picked?.code === f.code;
          const hospital = f.name.startsWith("โรงพยาบาล");
          const Ic = hospital ? Hospital : Building;
          return (
            <View key={f.code}>
              {i > 0 && <View style={{ height: 1, backgroundColor: SEPARATOR }} />}
              <Pressable
                onPress={() => onPick(f)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md, paddingVertical: SPACE.md }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: on ? PRIMARY_500 : PRIMARY_100,
                  }}
                >
                  <Ic size={22} color={on ? "#FFFFFF" : PRIMARY_500} strokeWidth={2} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={2} style={{ fontSize: 15, lineHeight: 21, fontWeight: on ? "700" : "600", color: TEXT_PRIMARY }}>
                    {f.name}
                  </Text>
                  <Text style={{ fontSize: 12, lineHeight: 16, color: TEXT_SECONDARY }}>
                    {`รหัส ${f.code} · ${f.district}`}
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
            </View>
          );
        })}
      </Card>
    </View>
  );
}
