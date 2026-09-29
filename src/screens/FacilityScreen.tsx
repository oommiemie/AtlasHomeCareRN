import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Building, Check, Hospital } from "lucide-react-native";

import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { Card } from "../components/Card";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { SearchField } from "../components/SearchField";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import { searchFacilities, type Facility } from "../models/facility";
import { chooseFacility } from "../models/session";
import { feel } from "../utils/haptics";
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
import { FORM_MAX, readable, useLayout, GUTTER } from "../theme/layout";
import { tr } from "../i18n";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Which facility today's work is filed under.
 *
 * Only the facilities the carer is on the staff of — see
 * `searchFacilities`. One tap picks, the button confirms.
 */
export function FacilityScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const [q, setQ] = useState("");
  const { regular } = useLayout();
  const [picked, setPicked] = useState<Facility | null>(null);

  const hits = useMemo(() => searchFacilities(q), [q]);

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title={tr("เลือกสถานพยาบาล", "Choose facility")}
        below={
          <View style={{ marginTop: SPACE.md }}>
            <SearchField
              value={q}
              onChangeText={setQ}
              placeholder={tr("ค้นหาชื่อ รหัส หรือเขต", "Search name, code or district")}
            />
          </View>
        }
      />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: GUTTER,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + 100,
            gap: SPACE.md,
            ...(regular ? readable(FORM_MAX) : null),
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {hits.length > 0 && (
            <Group
              title={tr("สังกัดของคุณ", "Your facilities")}
              list={hits}
              picked={picked}
              onPick={setPicked}
            />
          )}
          {hits.length === 0 && (
            <Text
              style={{
                fontSize: 14,
                color: TEXT_MUTED,
                textAlign: "center",
                paddingVertical: SPACE.xl,
              }}
            >
              {tr("ไม่พบสถานพยาบาลที่ตรงกับคำค้น", "No facilities match your search")}
            </Text>
          )}
        </ScrollView>
      </HeaderFade>

      <ActionBar>
        <PrimaryAction
          label={picked ? tr("ยืนยัน", "Confirm") : tr("เลือกสถานพยาบาล", "Choose facility")}
          disabled={picked == null}
          onPress={() => {
            if (picked == null) return;
            chooseFacility(picked);
            toast(tr(`เลือก ${picked.name} แล้ว`, `Selected ${picked.name}`), "success");
            nav.navigate("Pin");
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
      <Text
        style={{
          fontSize: 12,
          fontWeight: "700",
          letterSpacing: 0.4,
          color: TEXT_MUTED,
          paddingHorizontal: SPACE.xs,
        }}
      >
        {title}
      </Text>
      <Card style={{ paddingVertical: 0 }}>
        {list.map((f, i) => (
          <View key={f.code}>
            {i > 0 && (
              <View style={{ height: 1, backgroundColor: SEPARATOR }} />
            )}
            <FacilityRow
              facility={f}
              on={picked?.code === f.code}
              onPick={onPick}
            />
          </View>
        ))}
      </Card>
    </View>
  );
}

/**
 * One facility to pick, answering the finger and the choice.
 *
 * The row was a plain Pressable: nothing moved under the touch and the tick
 * simply appeared, so a tap on a slow frame read as a tap that missed. Now
 * the row gives under the finger — a small spring down — and the choice
 * lands: the ring fills from its centre with a slight overshoot, the mark
 * turns blue, and the phone ticks once. A row already chosen does not tick
 * again; nothing changed.
 *
 * Opacity and scale only, on the native driver, so the animation does not
 * wait on the JS thread that is busy re-rendering the list.
 */
function FacilityRow({
  facility: f,
  on,
  onPick,
}: {
  facility: Facility;
  on: boolean;
  onPick: (f: Facility) => void;
}) {
  const press = useRef(new Animated.Value(0)).current;
  const pick = useRef(new Animated.Value(on ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(pick, {
      toValue: on ? 1 : 0,
      useNativeDriver: true,
      friction: 6,
      tension: 180,
    }).start();
  }, [on, pick]);

  const pressTo = (to: number) =>
    Animated.timing(press, {
      toValue: to,
      duration: to === 1 ? 90 : 240,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

  const Ic = f.name.startsWith("โรงพยาบาล") ? Hospital : Building;
  // The spring may swing past 0 on the way out; a negative scale would draw
  // the mark mirrored for a frame.
  const fill = pick.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolateLeft: "clamp",
  });

  return (
    <Pressable
      onPressIn={() => pressTo(1)}
      onPressOut={() => pressTo(0)}
      onPress={() => {
        if (!on) feel("tick");
        onPick(f);
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
    >
      <Animated.View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.md,
          paddingVertical: SPACE.md,
          transform: [
            {
              scale: press.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.98],
              }),
            },
          ],
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: PRIMARY_100,
          }}
        >
          <Ic size={22} color={PRIMARY_500} strokeWidth={2} />
          <Animated.View
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: PRIMARY_500,
              opacity: fill,
            }}
          >
            <Ic size={22} color="#FFFFFF" strokeWidth={2} />
          </Animated.View>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            numberOfLines={2}
            style={{
              fontSize: 15,
              lineHeight: 21,
              fontWeight: on ? "700" : "600",
              color: TEXT_PRIMARY,
            }}
          >
            {f.name}
          </Text>
          <Text
            style={{
              fontSize: 12,
              lineHeight: 16,
              color: TEXT_SECONDARY,
            }}
          >
            {tr(`รหัส ${f.code} · ${f.district}`, `Code ${f.code} · ${f.district}`)}
          </Text>
        </View>
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: FILL_SUBTLE,
          }}
        >
          <Animated.View
            style={{
              position: "absolute",
              top: -1.5,
              left: -1.5,
              width: 24,
              height: 24,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: PRIMARY_500,
              transform: [{ scale: fill }],
            }}
          >
            <Check size={15} color="#FFFFFF" strokeWidth={3} />
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  );
}
