import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MapView, Marker, PROVIDER_DEFAULT } from "../components/Map";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { Check, X } from "lucide-react-native";

import { Glass } from "../components/Glass";
import { GlassIconButton } from "../components/GlassIconButton";
import { MapPin, pinAnchor } from "../components/MapPin";
import { PressableScale } from "../components/PressableScale";
import { SearchField, SEARCH_FIELD_HEIGHT } from "../components/SearchField";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import type { Place } from "../models/place";
import { patchHouseDraft } from "../models/houseDraft";
import { EMPTY_PLACE, placeOf, placeSummary } from "../models/place";
import {
  CANVAS,
  FILL_SUBTLE,
  GLASS_NEUTRAL,
  PANEL as PANEL_FILL,
  PRIMARY_500,
  RADIUS,
  SCRIM,
  SPACE,
  SURFACE,
  TEXT_DISABLED,
  TEXT_MUTED,
  TEXT_PRIMARY,
  currentTheme,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** How close two readings have to be before the second is not worth asking for. */
const SAME_SPOT = 0.0002;

/** How long after the last keystroke the search runs. */
const SETTLE = 700;

/**
 * The white wash behind the toolbar and the search field.
 *
 * It has to clear the field, not stop at it: half a control on the wash and
 * half on the map is worse than either. Twelve points past is enough for the
 * ramp to finish clear of the field without whiting out a band of map.
 */
const WASH = SPACE.lg + 48 + SPACE.md + SEARCH_FIELD_HEIGHT + 12;

/**
 * The floating panel's own measurements — Figma 289:12253. The PANEL token
 * is a fill rather than a geometry, so it comes in as `PANEL_FILL` and the
 * two names do not collide.
 */
const PANEL = {
  inset: 8,
  radius: 36,
  /** The lower corners run rounder than the upper ones. */
  bottomRadius: 58,
  pad: SPACE.lg,
  card: 84,
  button: 48,
} as const;

/** The most candidates worth naming. Each one costs a reverse geocode. */
const MAX_HITS = 5;

/**
 * "เลือกตำแหน่ง" — find a place, then put the pin on the house.
 *
 * The search takes whatever the carer has: a postcode, a province, a district,
 * a sub-district, or a road. Apple's geocoder answers with coordinates and
 * nothing else, so each candidate is read back through the reverse geocoder to
 * get a name — which is what makes a list of choices possible at all, rather
 * than silently jumping to the first guess.
 *
 * The pin does not move; the map does. A marker that has to be dragged is
 * fiddly at a house's precision, and it would mean handing `AIRMap` a child
 * that comes and goes — a crash this app has already paid for. The pin is
 * drawn over the middle and the reading is taken from wherever the map lands.
 */
export function PickLocationScreen() {
  const { initial, chosen } =
    useRoute<RouteProp<RootStackParamList, "PickLocation">>().params;
  const nav = useNavigation<Nav>();

  const [pin, setPin] = useState(initial);
  const [place, setPlace] = useState<Place>(EMPTY_PLACE);
  const [reading, setReading] = useState(false);

  const map = useRef<MapView>(null);
  // The last coordinate a reading was taken at. The map fires its settled
  // callback for every nudge, and CLGeocoder throttles a caller that asks too
  // often — after which it answers nothing at all for a while.
  const asked = useRef<{ latitude: number; longitude: number } | null>(null);

  // `quiet` for the read the screen makes on its own as it opens: a word
  // about a pin nobody has moved yet is a word about nothing they did.
  const readPlace = async (
    at: { latitude: number; longitude: number },
    quiet = false,
  ) => {
    const last = asked.current;
    if (
      last != null &&
      Math.abs(last.latitude - at.latitude) < SAME_SPOT &&
      Math.abs(last.longitude - at.longitude) < SAME_SPOT
    ) {
      return;
    }
    asked.current = at;
    setReading(true);
    try {
      const [found] = await Location.reverseGeocodeAsync(at);
      if (found) setPlace(placeOf(found));
      else if (!quiet) toast("ไม่พบที่อยู่ของตำแหน่งนี้ ลองเลื่อนหมุด", "warning");
    } catch {
      if (!quiet) toast("อ่านที่อยู่จากตำแหน่งนี้ไม่ได้", "error");
    } finally {
      setReading(false);
    }
  };

  // Read the opening position once, so the sheet never opens with four blanks.
  useEffect(() => {
    void readPlace(initial, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The sheet hands back a row and where it is; the map follows it.
  useEffect(() => {
    if (chosen == null) return;
    const at = { latitude: chosen.lat, longitude: chosen.lng };
    setPin(at);
    setPlace(chosen.place);
    // Marked as already read, so the map settling at the new spot does not
    // immediately overwrite the chosen names with the geocoder's guess.
    asked.current = at;
    map.current?.animateToRegion(
      { ...at, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      450,
    );
  }, [chosen]);

  /** Wherever the pin is put, by a tap or by dragging it. */
  const placeAt = (at: { latitude: number; longitude: number }) => {
    setPin(at);
    void readPlace(at);
  };

  const use = () => {
    patchHouseDraft({ lat: pin.latitude, lng: pin.longitude, place });
    toast("ใช้ตำแหน่งนี้แล้ว", "success");
    nav.goBack();
  };

  const ready = place.province.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      {/*
        The map is the screen; everything else floats on it.

        The design gives the whole sheet to the map and hangs the toolbar, the
        search and the answer panel over it — which is the right way round for
        a picker: the thing being chosen should never be the smallest part of
        the view, and it was, wedged between a toolbar and a bar of readouts.
      */}
      <MapView
        // The map turns with the app, not with the phone: a daylight map
        // under a dark toolbar is the brightest thing left on the page.
        userInterfaceStyle={currentTheme()}
        ref={map}
        provider={PROVIDER_DEFAULT}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        initialRegion={{
          ...initial,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onPress={(e) => placeAt(e.nativeEvent.coordinate)}
      >
        {/*
          MapKit's own annotation, and it stays where it is put.

          It does not track the middle of the screen. To do that its
          coordinate would have to be rewritten on every frame of a drag, and
          each rewrite is a round trip that MapKit then animates — which is
          the pin that stuttered and trailed the finger. Left alone it is a
          real annotation on a real coordinate: the map moves under it, and
          it does not move at all.

          Two ways to place it, both Apple's: tap anywhere, or press and drag
          the pin itself, which MapKit handles natively.
        */}
        <Marker
          coordinate={pin}
          anchor={pinAnchor()}
          draggable
          onDragEnd={(e) => placeAt(e.nativeEvent.coordinate)}
        >
          {/* The pin carries its own view — a childless marker draws nothing
              under the New Architecture. See MapPin. */}
          <MapPin />
        </Marker>
      </MapView>

      <LinearGradient
        pointerEvents="none"
        colors={SCRIM as readonly [string, string, ...string[]]}
        locations={[0, 0.45, 0.72, 0.9, 1]}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: WASH,
        }}
      />

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          paddingTop: SPACE.lg,
          paddingHorizontal: SPACE.lg,
          gap: SPACE.md,
        }}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}
        >
          <GlassIconButton
            size={48}
            onPress={() => nav.goBack()}
            accessibilityLabel="ปิด"
          >
            <X size={22} color={TEXT_PRIMARY} strokeWidth={2.6} />
          </GlassIconButton>
          <Text
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 20,
              lineHeight: 23,
              fontWeight: "800",
              color: TEXT_PRIMARY,
            }}
          >
            เลือกตำแหน่ง
          </Text>
          <PressableScale
            onPress={ready ? use : undefined}
            accessibilityRole="button"
            accessibilityLabel="ใช้ตำแหน่งนี้"
            accessibilityState={{ disabled: !ready }}
            style={{
              width: 48,
              height: 48,
              borderRadius: RADIUS.capsule,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: ready ? PRIMARY_500 : FILL_SUBTLE,
            }}
          >
            <Check size={24} color="#FFFFFF" strokeWidth={2.6} />
          </PressableScale>
        </View>

        {/* A way into the address sheet, not a field of its own. The list
            of matches is long and the map is what it lands on, so the search
            belongs on its own screen rather than in a menu over this one. */}
        <Pressable
          onPress={() => nav.navigate("AddressSearch")}
          accessibilityRole="button"
          accessibilityLabel="ค้นหาที่อยู่"
        >
          <View pointerEvents="none">
            <SearchField
              value=""
              onChangeText={() => {}}
              placeholder="ค้นหารหัสไปรษณีย์ จังหวัด อำเภอ ตำบล"
              // Apple's material, held frosted: this field sits over a map,
              // and at a thinner tint the streets read straight through it.
              // It follows the app's theme rather than the device's, as the
              // map itself now does.
              tintColor={GLASS_NEUTRAL}
            />
          </View>
        </Pressable>

        {reading ? (
          <View
            pointerEvents="none"
            style={{
              alignSelf: "center",
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.xs,
              backgroundColor: PANEL_FILL,
              borderRadius: RADIUS.capsule,
              paddingHorizontal: SPACE.md,
              paddingVertical: 6,
            }}
          >
            <ActivityIndicator size="small" color={PRIMARY_500} />
            <Text style={{ fontSize: 12, color: TEXT_MUTED }}>
              กำลังอ่านที่อยู่
            </Text>
          </View>
        ) : (
          <View
            pointerEvents="none"
            style={{
              alignSelf: "center",
              backgroundColor: PANEL_FILL,
              borderRadius: RADIUS.capsule,
              paddingHorizontal: SPACE.md,
              paddingVertical: 6,
            }}
          >
            <Text style={{ fontSize: 12, color: TEXT_MUTED }}>
              แตะแผนที่ หรือลากหมุด เพื่อย้ายตำแหน่ง
            </Text>
          </View>
        )}
      </View>

      {/* The answer, on its own pane over the map rather than a bar welded to
          the bottom of the screen — so the map runs behind it and the panel
          reads as sitting on the map it describes. */}
      <View
        style={{
          position: "absolute",
          left: PANEL.inset,
          right: PANEL.inset,
          // Eight from the edge, the same plane the explore map's sheet
          // sits on. The home indicator is cleared from inside the panel
          // instead — the same way that one does it — so the two float at
          // one height rather than one of them riding the safe area.
          bottom: PANEL.inset,
        }}
      >
        <Glass
          blurred
          frost="milky"
          style={{
            borderTopLeftRadius: PANEL.radius,
            borderTopRightRadius: PANEL.radius,
            borderBottomLeftRadius: PANEL.bottomRadius,
            borderBottomRightRadius: PANEL.bottomRadius,
            overflow: "hidden",
            padding: PANEL.pad,
            // The panel's own padding and nothing more. Half the safe area
            // was added on top of it to clear the home indicator, which left
            // the button floating a finger's width above the panel's foot —
            // the indicator only needs the 24 the panel already gives it.
            paddingBottom: PANEL.pad,
            gap: SPACE.md,
            alignItems: "stretch",
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 48,
              height: 4,
              borderRadius: 2,
              backgroundColor: FILL_SUBTLE,
            }}
          />

          <Readout label="ที่อยู่" value={placeSummary(place)} />
          <Readout
            label="พิกัด"
            value={`${pin.latitude.toFixed(6)}, ${pin.longitude.toFixed(6)}`}
          />

          <PressableScale
            onPress={ready ? use : undefined}
            accessibilityRole="button"
            accessibilityLabel="ใช้ตำแหน่งนี้"
            accessibilityState={{ disabled: !ready }}
            style={{
              height: PANEL.button,
              borderRadius: RADIUS.capsule,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: ready ? PRIMARY_500 : FILL_SUBTLE,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "500", color: "#FFFFFF" }}>
              ใช้ตำแหน่งนี้
            </Text>
          </PressableScale>
        </Glass>
      </View>
    </View>
  );
}

/**
 * One field the map filled in, on its own white card — Figma 289:12253.
 *
 * Not editable: it follows the pin, and a field that looked typeable would
 * invite someone to correct it into disagreeing with the map.
 */
function Readout({ label, value }: { label: string; value: string }) {
  const set = value.trim().length > 0;
  return (
    <View
      style={{
        minHeight: PANEL.card,
        justifyContent: "center",
        gap: SPACE.sm,
        backgroundColor: SURFACE,
        borderRadius: RADIUS.card,
        padding: SPACE.lg,
      }}
    >
      <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>
        {label}
      </Text>
      <Text
        numberOfLines={2}
        style={{
          fontSize: 16,
          lineHeight: 24,
          fontWeight: "600",
          color: set ? TEXT_PRIMARY : TEXT_DISABLED,
        }}
      >
        {set ? value : "เลื่อนแผนที่เพื่ออ่าน"}
      </Text>
    </View>
  );
}
