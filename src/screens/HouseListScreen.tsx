import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useFocusEffect,
  useNavigation,
  type RouteProp,
  useRoute,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AlertCircle, House as HouseIcon, Plus, Search } from "lucide-react-native";

import { Chevron } from "../components/Chevron";
import { Card } from "../components/Card";
import { Glass } from "../components/Glass";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { SearchField } from "../components/SearchField";
import { ToolbarPill } from "../components/ToolbarPill";
import { UIcon } from "../components/UIcon";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  populationOf,
  searchHouses,
  villageFullName,
  type House,
} from "../models/household";
import {
  CANVAS,
  DANGER_BG,
  DANGER_INK,
  PRIMARY_100,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PLACEHOLDER,
  TEXT_PRIMARY,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** The houses in one village. */
export function HouseListScreen() {
  const { village } = useRoute<RouteProp<RootStackParamList, "HouseList">>().params;
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();

  /**
   * Redraw whenever the screen comes back into view.
   *
   * "เพิ่มบ้าน" pushes the new house straight onto this village's own array —
   * there is no store to publish through — so nothing here would otherwise
   * know a house had arrived, and the carer would come back to the list they
   * left.
   */
  const [, redraw] = useState(0);
  useFocusEffect(useCallback(() => redraw((n) => n + 1), []));

  const results = searchHouses(village.houses, query);

  // Closing search clears the query: a filter the carer can no longer see
  // would look like missing data.
  const toggleSearch = () => {
    setSearching((was) => {
      if (was) setQuery("");
      return !was;
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <ScreenHeader
        title={villageFullName(village)}
        right={
          <ToolbarPill
            slots={[
              {
                icon: <Search size={20} color={searching ? PRIMARY_500 : TEXT_PRIMARY} />,
                label: searching ? "ปิดการค้นหา" : "ค้นหา",
                onPress: toggleSearch,
              },
              {
                icon: <Plus size={20} color={TEXT_PRIMARY} />,
                label: "เพิ่มบ้าน",
                onPress: () => nav.navigate("AddHouse", { village }),
              },
            ]}
          />
        }
        below={
          searching ? (
            <View style={{ marginTop: SPACE.lg }}>
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder="ค้นหาบ้าน"
              autoFocus
            />
          </View>
          ) : null
        }
      />

      <HeaderFade from={0} to={HEADER_FADE}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: SPACE.lg,
          // Clears the ramp, so no card rests inside it half faded.
          paddingTop: HEADER_FADE,
          paddingBottom: insets.bottom + SPACE.huge,
          gap: SPACE.md,
        }}
        keyboardDismissMode="on-drag"
        // A tap while the keyboard is up would otherwise be spent
        // closing it, leaving the card underneath unopened — one
        // action costing two taps.
        keyboardShouldPersistTaps="handled"
      >
        {results.length === 0 ? (
          <Empty query={query} />
        ) : (
          results.map((h) => (
            <HouseCard
              key={h.id}
              house={h}
              onPress={() => nav.navigate("HouseDetail", { house: h })}
            />
          ))
        )}
      </ScrollView>
      </HeaderFade>
    </View>
  );
}

/**
 * One house, on the visit card's frame.
 *
 * The same object as a task and as a village row: glass avatar, name with
 * its pill, arrow, a body, a rule, then meta and a badge. Three lists in the
 * app now read as one card design.
 *
 * Two changes of substance from what was here. The avatar was the first
 * resident's initial, which said nothing about the house and everything
 * about whoever happened to be listed first; it carries the house mark now.
 * And the follow-ups are on it — a village card can say "ต้องติดตาม 4" and
 * then hand over a list of houses that showed no sign of which four.
 */
function HouseCard({ house, onPress }: { house: House; onPress: () => void }) {
  const people = populationOf(house);
  const attention = house.residents.filter((r) => r.needsAttention).length;

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${house.number} ${people} คน`}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Glass
          tintColor="rgba(7,125,215,0.95)"
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <UIcon name="houseChimneyHeart" size={16} color="#FFFFFF" />
        </Glass>

        {/* Number and count travel together — the flex is on the pair, so a
            long number shrinks beside its pill rather than pushing it away. */}
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            marginLeft: SPACE.sm,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              fontSize: 14,
              fontWeight: "600",
              color: TEXT_PRIMARY,
            }}
          >
            {house.number}
          </Text>
          <View
            style={{
              marginLeft: SPACE.xs,
              backgroundColor: PRIMARY_100,
              borderRadius: RADIUS.capsule,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "500", color: PRIMARY_500 }}>
              {people} คน
            </Text>
          </View>
        </View>

        <View style={{ marginLeft: SPACE.sm }}>
          <Chevron />
        </View>
      </View>

      {/* The address, which is what the card is read for on the doorstep —
          it was the last line, under the registration number. */}
      <Text
        numberOfLines={2}
        style={{
          marginTop: SPACE.md,
          fontSize: 12,
          lineHeight: 18,
          color: TEXT_MUTED,
        }}
      >
        {house.address}
      </Text>

      <View style={{ height: 1, backgroundColor: SEPARATOR, marginTop: SPACE.md }} />
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: SPACE.sm }}>
        <Text
          numberOfLines={1}
          style={{ flex: 1, fontSize: 12, fontWeight: "500", color: TEXT_MUTED }}
        >
          {`ทะเบียน ${house.registrationNo}`}
        </Text>
        {attention > 0 && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.xs,
              backgroundColor: DANGER_BG,
              borderRadius: RADIUS.capsule,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <AlertCircle size={11} color={DANGER_INK} />
            <Text style={{ fontSize: 10, fontWeight: "600", color: DANGER_INK }}>
              {`ต้องติดตาม ${attention}`}
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
}

function Empty({ query }: { query: string }) {
  return (
    <View style={{ alignItems: "center", paddingTop: SPACE.huge * 2 }}>
      <HouseIcon size={48} color={TEXT_PLACEHOLDER} />
      <Text
        style={{ marginTop: SPACE.lg, fontSize: 16, fontWeight: "600", color: TEXT_PRIMARY }}
      >
        ไม่พบบ้าน "{query.trim()}"
      </Text>
      <Text style={{ marginTop: SPACE.sm, fontSize: 14, color: TEXT_MUTED }}>
        ค้นด้วยบ้านเลขที่ เลขทะเบียนบ้าน หรือที่อยู่
      </Text>
    </View>
  );
}
