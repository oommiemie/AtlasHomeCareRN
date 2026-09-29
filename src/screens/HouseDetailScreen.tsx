import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MapView, Marker, PROVIDER_DEFAULT } from "../components/Map";
import { AlertCircle, Plus, Search, Users } from "lucide-react-native";

import { Chevron } from "../components/Chevron";
import { Card } from "../components/Card";
import { Avatar } from "../components/Avatar";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { MapPin, pinAnchor } from "../components/MapPin";
import { PressableScale } from "../components/PressableScale";
import { ScreenHeader } from "../components/ScreenHeader";
import { SearchField } from "../components/SearchField";
import { SectionHeader } from "../components/SectionHeader";
import { ToolbarPill } from "../components/ToolbarPill";
import { UIcon } from "../components/UIcon";
import { openDirections } from "../utils/routing";
import { StatusTag } from "../components/StatusTag";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  genderLabel,
  initialOf,
  populationOf,
  searchResidents,
  type House,
  type Resident,
} from "../models/household";
import {
  CANVAS,
  DANGER_INK,
  FILL_SUBTLE,
  PRIMARY_500,
  PRIMARY_700,
  RADIUS,
  SECONDARY_900,
  SEPARATOR,
  SPACE,
  SURFACE,
  TEXT_DISABLED,
  TEXT_MUTED,
  TEXT_PRIMARY,
  WARNING,
  currentTheme,
} from "../theme/tokens";
import { FORM_MAX, readable, useLayout, GUTTER } from "../theme/layout";
import { tr } from "../i18n";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** The still map's height. A picture of where the house is, not a map to explore. */
const MAP_HEIGHT = 180;

/**
 * One house: who lives there, and where it is.
 *
 * Rebuilt around the household — the two count tiles at the top are the
 * ones that were already there. The members were a sideways strip of blue
 * discs carrying nothing but an initial — you could not see an age, a sex or
 * a risk without opening each one, and anyone past the fourth was off the
 * edge of the screen. They are a plain list now, everybody visible, each row
 * saying who they are and whether they are waiting on a visit.
 *
 * The map was 380pt, half a screen given to a picture that cannot be panned;
 * it is 180 with the address and a full-width way to open directions, which
 * was previously a lone glass icon beside the text.
 */
export function HouseDetailScreen() {
  const { house } =
    useRoute<RouteProp<RootStackParamList, "HouseDetail">>().params;
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const { regular } = useLayout();

  /**
   * Redraw whenever the screen comes back into view.
   *
   * "เพิ่มสมาชิก" pushes the new person straight onto this house's own array
   * — there is no store to publish through — so nothing here would otherwise
   * know somebody had arrived.
   */
  const [, redraw] = useState(0);
  useFocusEffect(useCallback(() => redraw((n) => n + 1), []));

  const shown = searchResidents(house.residents, query);

  // Closing search clears the query: a filter the carer can no longer see
  // would look like missing members.
  const toggleSearch = () => {
    setSearching((was) => {
      if (was) setQuery("");
      return !was;
    });
  };

  const people = populationOf(house);
  const flagged = house.residents.filter((r) => r.needsAttention).length;

  const openMaps = () => openDirections(house, house.number);

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <ScreenHeader
        title={house.number}
        right={
          <ToolbarPill
            slots={[
              {
                // This screen's own search: the household, not the app. The
                // field grows in under the title, as on the house list.
                icon: (
                  <Search
                    size={20}
                    color={searching ? PRIMARY_500 : TEXT_PRIMARY}
                  />
                ),
                label: searching
                  ? tr("ปิดการค้นหา", "Close search")
                  : tr("ค้นหาสมาชิก", "Search members"),
                onPress: toggleSearch,
              },
              {
                icon: <Plus size={20} color={TEXT_PRIMARY} />,
                label: tr("เพิ่มสมาชิก", "Add member"),
                onPress: () => nav.navigate("AddMember", { house }),
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
                placeholder={tr("ค้นหาสมาชิกในบ้าน", "Search household members")}
                autoFocus
              />
            </View>
          ) : null
        }
      />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: GUTTER,
            // Clears the ramp, so no card rests inside it half faded.
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + SPACE.huge,
            gap: SPACE.lg,
            ...(regular ? readable(FORM_MAX) : null),
          }}
          keyboardDismissMode="on-drag"
          // A tap while the keyboard is up would otherwise be spent closing it,
          // leaving the row underneath unopened.
          keyboardShouldPersistTaps="handled"
        >
          {/* What the carer came to find out. Reading it off the member list
            would mean counting badges by eye. */}
          <View style={{ flexDirection: "row", gap: SPACE.sm }}>
            <Summary
              icon={<Users size={16} color={PRIMARY_700} />}
              value={String(people)}
              label={tr("สมาชิก (คน)", "Members")}
              ink={PRIMARY_700}
            />
            <Summary
              icon={
                <AlertCircle
                  size={16}
                  color={flagged > 0 ? WARNING : SECONDARY_900}
                />
              }
              value={String(flagged)}
              label={tr("ต้องติดตาม (คน)", "Need follow-up")}
              // Amber only when there is something to chase: a coloured zero
              // reads as an alarm about nothing.
              ink={flagged > 0 ? WARNING : SECONDARY_900}
            />
          </View>

          <View style={{ gap: SPACE.sm }}>
            <SectionHeader title={tr("สมาชิกในบ้าน", "Household members")} flush />
            <Card padded={false}>
              {shown.map((r, i) => (
                <MemberRow
                  key={r.id}
                  resident={r}
                  first={i === 0}
                  onPress={() => nav.navigate("HealthTracking", { resident: r })}
                />
              ))}
              {shown.length === 0 ? (
                <Text
                  style={{
                    padding: SPACE.lg,
                    fontSize: 14,
                    color: TEXT_MUTED,
                    textAlign: "center",
                  }}
                >
                  {tr(`ไม่พบสมาชิก "${query.trim()}"`, `No members match "${query.trim()}"`)}
                </Text>
              ) : (
                <AddMemberRow
                  onPress={() => nav.navigate("AddMember", { house })}
                />
              )}
            </Card>
          </View>

          <View style={{ gap: SPACE.sm }}>
            <SectionHeader title={tr("ที่ตั้ง", "Location")} flush />
            <Location house={house} onNavigate={openMaps} />
          </View>
        </ScrollView>
      </HeaderFade>
    </View>
  );
}

/** One count in a tile of its own, beside its twin. */
function Summary({
  icon,
  value,
  label,
  ink,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  ink: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: SURFACE,
        borderRadius: RADIUS.card,
        padding: SPACE.lg,
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}
      >
        {icon}
        <Text
          style={{
            fontSize: 20,
            lineHeight: 26,
            fontWeight: "800",
            color: ink,
          }}
        >
          {value}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={{
          marginTop: SPACE.xs,
          fontSize: 14,
          lineHeight: 18,
          color: TEXT_MUTED,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function MemberRow({
  resident,
  first,
  onPress,
}: {
  resident: Resident;
  /** The first row in the card carries no rule above it. */
  first: boolean;
  onPress: () => void;
}) {
  return (
    <PressableRow first={first} onPress={onPress} label={resident.name}>
      <Avatar
        size={40}
        initial={initialOf(resident.name)}
        photo={resident.photo}
      />

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 14, fontWeight: "600", color: TEXT_PRIMARY }}
        >
          {resident.name}
        </Text>
        <Text
          numberOfLines={1}
          style={{ marginTop: 3, fontSize: 12, color: TEXT_MUTED }}
        >
          {tr(
            `${resident.age} ปี · ${resident.gender} · กรุ๊ป ${resident.bloodType}`,
            `${resident.age} yrs · ${genderLabel(resident.gender)} · Blood type ${resident.bloodType}`,
          )}
        </Text>
      </View>

      {resident.needsAttention && (
        <StatusTag label={tr("ต้องติดตาม", "Follow-up")} ink={DANGER_INK} Icon={AlertCircle} />
      )}

      <Chevron />
    </PressableRow>
  );
}

/** The trailing slot: where the hand already is after reading the list. */
function AddMemberRow({ onPress }: { onPress: () => void }) {
  return (
    <PressableRow first={false} onPress={onPress} label={tr("เพิ่มสมาชิก", "Add member")}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: FILL_SUBTLE,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Plus size={18} color={TEXT_DISABLED} />
      </View>
      <Text
        style={{ flex: 1, fontSize: 14, fontWeight: "500", color: TEXT_MUTED }}
      >
        {tr("เพิ่มสมาชิก", "Add member")}
      </Text>
    </PressableRow>
  );
}

/**
 * The row frame both member rows share, so they cannot drift apart.
 *
 * A plain Pressable, never PressableScale: that one animates a transform on
 * an inner view, and a transformed ancestor stops UIVisualEffectView drawing
 * its material — the glass avatars would come out as empty circles.
 */
function PressableRow({
  first,
  onPress,
  label,
  children,
}: {
  first: boolean;
  onPress: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        borderTopWidth: first ? 0 : 1,
        borderTopColor: SEPARATOR,
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.md,
          paddingHorizontal: SPACE.lg,
          paddingVertical: SPACE.md,
        }}
      >
        {children}
      </Pressable>
    </View>
  );
}

function Location({
  house,
  onNavigate,
}: {
  house: House;
  onNavigate: () => void;
}) {
  return (
    <Card padded={false}>
      <MapView
        userInterfaceStyle={currentTheme()}
        provider={PROVIDER_DEFAULT}
        style={{ height: MAP_HEIGHT }}
        initialRegion={{
          latitude: house.lat,
          longitude: house.lng,
          latitudeDelta: 0.004,
          longitudeDelta: 0.004,
        }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {/* Apple's marker, bare. The pin carries its own view — a childless
            marker draws nothing under the New Architecture — but nothing is
            put inside it: the balloon says "here", and this whole page is
            already about which house that is. */}
        <Marker
          coordinate={{ latitude: house.lat, longitude: house.lng }}
          anchor={pinAnchor()}
        >
          <MapPin />
        </Marker>
      </MapView>

      <View style={{ padding: SPACE.lg, gap: SPACE.md }}>
        <Field label={tr("ที่อยู่", "Address")} value={house.address} />
        <Field
          label={tr("เลขทะเบียนบ้าน", "House registration no.")}
          value={house.registrationNo}
        />

        <PressableScale
          onPress={onNavigate}
          accessibilityRole="button"
          accessibilityLabel={tr("เปิดแผนที่นำทาง", "Open directions")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: SPACE.sm,
            height: 48,
            borderRadius: RADIUS.capsule,
            // Solid, not glass: the material has an opaque card behind it
            // here and nothing to refract, so a glass button on this surface
            // comes out as a bare label.
            backgroundColor: PRIMARY_500,
          }}
        >
          <UIcon name="map" size={18} color="#FFFFFF" />
          <Text style={{ fontSize: 16, fontWeight: "500", color: "#FFFFFF" }}>
            {tr("เปิดแผนที่นำทาง", "Open directions")}
          </Text>
        </PressableScale>
      </View>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={{ fontSize: 12, color: TEXT_MUTED }}>{label}</Text>
      <Text
        style={{
          marginTop: 2,
          fontSize: 14,
          lineHeight: 20,
          fontWeight: "600",
          color: TEXT_PRIMARY,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
