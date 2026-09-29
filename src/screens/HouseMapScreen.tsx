import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MapView, Marker, Polyline, PROVIDER_DEFAULT } from "../components/Map";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  House as HouseGlyph,
  List as ListIcon,
  Navigation,
  UserRound,
  Users,
  X,
} from "lucide-react-native";

import { Avatar } from "../components/Avatar";
import { Card } from "../components/Card";
import { FilterSelect, type FilterOption } from "../components/FilterSelect";
import {
  FloatingSheet,
  usePanelClearance,
  PANEL_HANDLE,
  useSheetAsPanel,
} from "../components/FloatingSheet";
import { Glass } from "../components/Glass";
import { SheetButton } from "../components/SheetButton";
import { SearchField } from "../components/SearchField";
import { GlassIconButton } from "../components/GlassIconButton";
import { PressableScale } from "../components/PressableScale";
import { UIcon } from "../components/UIcon";
import { toast } from "../components/Toast";
import { MapPin, pinAnchor } from "../components/MapPin";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  genderLabel,
  initialOf,
  populationOf,
  houseNeedsAttention,
  sampleVillages,
  villageFullName,
  type House,
  type Resident,
  type Village,
} from "../models/household";
import { useHere } from "../utils/useHere";
import {
  distanceLabel,
  durationLabel,
  fetchRoute,
  type VisitRoute,
  openDirections,
} from "../utils/routing";
import {
  CANVAS,
  DANGER,
  DANGER_BG,
  FILL_SUBTLE,
  PRIMARY_100,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  SURFACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TINT_BG,
  currentTheme,
  shadow,
} from "../theme/tokens";
import { tr } from "../i18n";
import { GUTTER } from "../theme/layout";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Which houses the list is showing. */
type HouseFilter = "all" | "attention" | "elder" | "near";

const HOUSE_FILTERS: FilterOption<HouseFilter>[] = [
  { key: "all", label: tr("ทั้งหมด", "All"), Icon: ListIcon },
  { key: "attention", label: tr("ต้องติดตาม", "Follow-up"), Icon: AlertCircle },
  { key: "elder", label: tr("มีผู้สูงอายุ", "Has elderly"), Icon: UserRound },
  { key: "near", label: tr("ใกล้ฉัน", "Near me"), Icon: Navigation },
];

/** Every house on the round, with the village it belongs to. */
type Placed = { house: House; village: Village };

/**
 * "แผนที่" — the houses this carer looks after, and who lives in them.
 *
 * The visit map answers "where am I going today"; this one answers "who is
 * out there". Every house under care is a pin, and a pin opens the house:
 * its number, its address, and the people in it — because a house is only
 * ever visited for somebody in it, and which somebody decides what the
 * visit is for.
 *
 * A separate screen from the visit map on purpose. That one is a day's
 * route with a line drawn along it; this one is a register with a map
 * under it, and the two disagree about what a pin means.
 */
export function HouseMapScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const { height: screenHeight } = useWindowDimensions();
  const { here } = useHere();
  const map = useRef<MapView>(null);
  // A wide tablet stands the list up the left side instead: no drag, no
  // detents, and the map framed clear of it.
  const panel = useSheetAsPanel();
  const clearance = usePanelClearance();

  // Opened on one house — from a patient's address — rather than on all.
  const focus = useRoute<RouteProp<RootStackParamList, "HouseMap">>().params
    ?.focus;
  // And then that house alone: the page was opened to find one person, and
  // a register's worth of other pins around them is noise to look past.
  const houses: Placed[] = useMemo(
    () =>
      sampleVillages.flatMap((village) =>
        village.houses
          .filter((house) => focus == null || house.id === focus.id)
          .map((house) => ({ house, village })),
      ),
    [focus],
  );
  const [chosen, setChosen] = useState<Placed | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<HouseFilter>("all");

  /**
   * Two resting heights, the visit map's own: the floating card, and full.
   *
   * The sheet is part of this screen rather than a presented route, for the
   * same reason it is there — a form sheet lives on its own route and then
   * the map and the list cannot see each other's state.
   */
  const detents = useMemo(
    () => [
      Math.round(screenHeight * 0.42),
      Math.round(screenHeight - insets.top),
    ],
    [screenHeight, insets.top],
  );
  // Animated rather than laid out: the drag follows the finger every frame.
  const sheetHeight = useRef(new Animated.Value(detents[0])).current;
  const restingAt = useRef(detents[0]);
  const [settled, setSettled] = useState(detents[0]);
  const expanded = !panel && settled === detents[detents.length - 1];

  /*
    The detents as they are now, for the drag — which is made once and
    would otherwise keep the heights of the window it was made in. An iPad
    turned, or a split view resized, brings new ones, and the sheet goes
    back to resting on the lower of them.
  */
  const detentsNow = useRef(detents);
  useEffect(() => {
    detentsNow.current = detents;
    restingAt.current = detents[0];
    setSettled(detents[0]);
    sheetHeight.setValue(detents[0]);
  }, [detents, sheetHeight]);

  const drag = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_, g) => {
        const detents = detentsNow.current;
        const min = detents[0];
        const max = detents[detents.length - 1];
        sheetHeight.setValue(
          Math.min(max, Math.max(min, restingAt.current - g.dy)),
        );
      },
      onPanResponderRelease: (_, g) => {
        const detents = detentsNow.current;
        const min = detents[0];
        const max = detents[detents.length - 1];
        const landed = Math.min(max, Math.max(min, restingAt.current - g.dy));
        // Carry the throw, so a flick reaches the next detent.
        const projected = landed - g.vy * 140;
        const target = detents.reduce((best, d) =>
          Math.abs(d - projected) < Math.abs(best - projected) ? d : best,
        );
        restingAt.current = target;
        setSettled(target);
        Animated.spring(sheetHeight, {
          toValue: target,
          useNativeDriver: false,
          friction: 12,
          tension: 90,
        }).start();
      },
    }),
  ).current;

  const hits = useMemo(() => {
    // Roughly how far a house is from here, in degrees squared — enough to
    // sort by, and nothing here needs the distance in metres.
    const near = (p: Placed) =>
      (p.house.lat - here.latitude) ** 2 + (p.house.lng - here.longitude) ** 2;
    let list = houses;
    if (filter === "attention")
      list = list.filter((p) => houseNeedsAttention(p.house));
    else if (filter === "elder")
      list = list.filter((p) => p.house.residents.some((r) => r.age >= 60));
    else if (filter === "near")
      list = [...list].sort((a, b) => near(a) - near(b)).slice(0, 10);

    const k = query.trim().toLowerCase();
    if (k === "") return list;
    return list.filter(
      (p) =>
        p.house.number.toLowerCase().includes(k) ||
        p.house.address.toLowerCase().includes(k) ||
        villageFullName(p.village).toLowerCase().includes(k) ||
        p.house.residents.some((r) => r.name.toLowerCase().includes(k)),
    );
  }, [houses, query, filter, here]);

  const pinned = useMemo(() => {
    if (chosen == null) return hits;
    return hits.some((p) => p.house.id === chosen.house.id)
      ? hits
      : [...hits, chosen];
  }, [hits, chosen]);

  /**
   * What is actually on the map, which for a moment is more than what the
   * filter wants: a pin that has just been filtered out is kept mounted
   * long enough to shrink away, then dropped. Without it a filter is a
   * hard cut, and on a map a hard cut reads as pins that were never there.
   */
  const [rendered, setRendered] = useState<Placed[]>(pinned);
  useEffect(() => {
    setRendered((cur) => {
      const merged = [...pinned];
      for (const p of cur)
        if (!merged.some((m) => m.house.id === p.house.id)) merged.push(p);
      return merged;
    });
    const t = setTimeout(() => setRendered(pinned), 260);
    return () => clearTimeout(t);
  }, [pinned]);

  // The region the round covers, with room around it.
  const region = useMemo(() => {
    const lats = houses.map((p) => p.house.lat);
    const lngs = houses.map((p) => p.house.lng);
    if (lats.length === 0)
      return { ...here, latitudeDelta: 0.05, longitudeDelta: 0.05 };
    const low = { lat: Math.min(...lats), lng: Math.min(...lngs) };
    const high = { lat: Math.max(...lats), lng: Math.max(...lngs) };
    return {
      latitude: (low.lat + high.lat) / 2,
      longitude: (low.lng + high.lng) / 2,
      latitudeDelta: Math.max(0.02, (high.lat - low.lat) * 1.5),
      longitudeDelta: Math.max(0.02, (high.lng - low.lng) * 1.5),
    };
  }, [houses, here]);

  /**
   * The way there, once a house is chosen.
   *
   * Straight and faint the instant the pin is picked, then the real road
   * geometry when it arrives — one Polyline whose props change rather than
   * two swapped over, which is what crashed the visit map's own line.
   * Routes already fetched are kept for the life of the screen.
   */
  const [route, setRoute] = useState<VisitRoute | null>(null);
  const routeCache = useRef(new Map<string, VisitRoute>());
  useEffect(() => {
    if (chosen == null) {
      setRoute(null);
      return;
    }
    const cached = routeCache.current.get(chosen.house.id);
    if (cached != null) {
      setRoute(cached);
      return;
    }
    let live = true;
    setRoute(null);
    fetchRoute(
      { lat: here.latitude, lng: here.longitude },
      { lat: chosen.house.lat, lng: chosen.house.lng },
    ).then((r) => {
      if (!live) return;
      if (r != null) routeCache.current.set(chosen.house.id, r);
      else
        toast(
          tr(
            "หาเส้นทางถนนไม่ได้ แสดงเป็นเส้นตรงแทน",
            "Couldn't find a road route. Showing a straight line instead",
          ),
          "warning",
        );
      setRoute(r);
    });
    return () => {
      live = false;
    };
  }, [chosen, here]);

  /** Where the badge sits: the middle of the road route. */
  const routeBadge =
    route != null && route.points.length > 0
      ? route.points[Math.floor(route.points.length / 2)]
      : null;

  const line =
    route != null
      ? route.points
      : chosen != null
        ? [
            { latitude: here.latitude, longitude: here.longitude },
            { latitude: chosen.house.lat, longitude: chosen.house.lng },
          ]
        : [];

  /** What the sheet or the panel covers, for framing the map around it. */
  const edgePadding = panel
    ? { top: 140, right: 80, bottom: 80, left: clearance + 40 }
    : { top: 140, right: 80, bottom: Math.round(detents[0]) + 40, left: 80 };

  /** Frame every pin, plus where the carer is. */
  const fitToAll = () => {
    if (map.current == null || pinned.length === 0) return;
    map.current.fitToCoordinates(
      [
        { latitude: here.latitude, longitude: here.longitude },
        ...pinned.map((p) => ({
          latitude: p.house.lat,
          longitude: p.house.lng,
        })),
      ],
      { edgePadding, animated: true },
    );
  };

  const openNavigation = () => {
    if (chosen == null) return;
    openDirections(chosen.house, chosen.house.number);
  };

  /** Back to the carer. */
  const goToMe = () => {
    map.current?.animateToRegion(
      { ...here, latitudeDelta: 0.012, longitudeDelta: 0.012 },
      420,
    );
  };

  const open = (p: Placed) => {
    setChosen(p);
    // Both ends, so the line is on screen the moment it is drawn — and
    // clear of the sheet, which covers the bottom of the map.
    map.current?.fitToCoordinates(
      [
        { latitude: here.latitude, longitude: here.longitude },
        { latitude: p.house.lat, longitude: p.house.lng },
      ],
      { edgePadding, animated: true },
    );
  };

  // Opened on one house: chosen as a tap on its pin would choose it, once
  // the map has had a moment to lay itself out to fit to.
  useEffect(() => {
    if (focus == null) return;
    const p = houses.find((x) => x.house.id === focus.id);
    if (p == null) return;
    const t = setTimeout(() => open(p), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.id]);

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <MapView
        // The map turns with the app, not with the phone: a daylight map
        // under a dark sheet is the brightest thing left on the page.
        userInterfaceStyle={currentTheme()}
        ref={map}
        provider={PROVIDER_DEFAULT}
        style={{ flex: 1 }}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton={false}
        // Two fingers turn the map; the compass shows while it is off north.
        rotateEnabled
        showsCompass
      >
        {/* The map shows what the list shows. A filter that thinned the
            list and left every pin standing would be answering "which
            houses need following up" with a map that says "all of them" —
            and the house chosen stays pinned even when a filter would
            otherwise drop it, so choosing one never makes it vanish. */}
        {rendered.map((p, i) => {
          const on = chosen?.house.id === p.house.id;
          const showing = pinned.some((x) => x.house.id === p.house.id);
          return (
            <Marker
              key={p.house.id}
              coordinate={{ latitude: p.house.lat, longitude: p.house.lng }}
              anchor={pinAnchor(true)}
              // Left snapshotting on: with it off the marker is captured
              // before its custom view has laid out, and what MapKit ends up
              // holding is an empty annotation — nothing drawn and nothing
              // to tap. Tapping the chosen pin again closes it.
              onPress={() =>
                chosen?.house.id === p.house.id ? setChosen(null) : open(p)
              }
              // The marker has to re-snapshot while its view moves, or
              // MapKit keeps showing the frame it captured first.
              tracksViewChanges
            >
              <DropIn show={showing} delay={Math.min(i, 12) * 26}>
                <MapPin
                  // The system's own glyph, cut for this balloon — where the
                  // bundled mark is a drawing scaled into it.
                  symbol={
                    houseNeedsAttention(p.house)
                      ? "house.badge.exclamationmark.fill"
                      : "house.fill"
                  }
                  color={houseNeedsAttention(p.house) ? DANGER : PRIMARY_500}
                  label={p.house.number}
                  selected={on}
                />
              </DropIn>
            </Marker>
          );
        })}
        {line.length >= 2 && (
          <Polyline
            coordinates={line}
            strokeWidth={route != null ? 5 : 3}
            strokeColor={route != null ? PRIMARY_500 : "rgba(7,125,215,0.45)"}
          />
        )}

        {/* How far it is, on the line rather than beside it — the visit
            map's own badge: the box is always built and simply turns
            transparent when there is no distance, because MapKit puts its
            own red pin in place of an annotation with no content. */}
        <Marker
          coordinate={routeBadge ?? here}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={route != null}
          opacity={route != null ? 1 : 0}
        >
          <View
            style={{ alignItems: "center", opacity: route != null ? 1 : 0 }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: RADIUS.capsule,
                backgroundColor: SURFACE,
                // A rim in the route's own colour: straddling the stroke,
                // the box would otherwise look like a gap cut out of it.
                borderWidth: 2,
                borderColor: PRIMARY_500,
                boxShadow: shadow({ blur: 6, y: 2, opacity: 0.18 }),
              }}
            >
              <UIcon name="locationArrow" size={12} color={PRIMARY_500} />
              <Text
                style={{ fontSize: 12, fontWeight: "600", color: TEXT_PRIMARY }}
              >
                {route != null
                  ? `${distanceLabel(route.metres)} · ${durationLabel(route.seconds)}`
                  : "—"}
              </Text>
            </View>
          </View>
        </Marker>
      </MapView>

      <View
        style={{
          position: "absolute",
          top: insets.top + SPACE.sm,
          left: GUTTER,
        }}
      >
        <GlassIconButton
          onPress={() => nav.goBack()}
          accessibilityLabel={tr("ย้อนกลับ", "Back")}
        >
          <ChevronLeft size={24} color={TEXT_PRIMARY} strokeWidth={2.4} />
        </GlassIconButton>
      </View>

      {/*
        The map controls, as one vertical capsule — the visit map's own:
        Maps stacks its controls in a single pill rather than scattering
        round buttons.

        Unmounted at full height rather than faded: UIVisualEffectView will
        not render its material under an ancestor whose alpha is below 1.
      */}
      {!expanded && (
        <Animated.View
          style={{
            position: "absolute",
            right: GUTTER,
            // Beside a panel there is no sheet to ride on: the controls sit
            // in the map's own corner.
            bottom: panel
              ? insets.bottom + SPACE.lg
              : Animated.add(sheetHeight, new Animated.Value(SPACE.md + SPACE.sm)),
          }}
        >
          <Glass
            style={{
              width: 48,
              height: 95,
              borderRadius: 24,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <PressableScale
              onPress={fitToAll}
              accessibilityRole="button"
              accessibilityLabel={tr("ดูบ้านทั้งหมด", "Show all houses")}
              style={{
                width: 28,
                height: 20,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <UIcon name="map" size={20} color={TEXT_PRIMARY} />
            </PressableScale>
            <PressableScale
              onPress={goToMe}
              accessibilityRole="button"
              accessibilityLabel={tr("กลับไปยังตำแหน่งของฉัน", "Back to my location")}
              style={{
                width: 28,
                height: 20,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <UIcon name="locationArrow" size={20} color={PRIMARY_500} />
            </PressableScale>
          </Glass>
        </Animated.View>
      )}

      {/* The list, floating over the map — the visit map's own sheet: a
          glass card while it rests, an opaque panel at full height, and
          dragged by the band at its top so the list under it still
          scrolls. It opens on the houses, and a pin opens one of them. */}
      <FloatingSheet expanded={expanded} height={sheetHeight}>
          {panel ? (
            // The panel draws its own handle here (see FloatingSheet); the
            // content starts under it, as far down as on a phone.
            <View style={{ height: PANEL_HANDLE }} />
          ) : (
            <View
              {...drag.panHandlers}
              style={{
                alignItems: "center",
                paddingTop: SPACE.sm,
                paddingBottom: SPACE.sm,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: FILL_SUBTLE,
                }}
              />
            </View>
          )}

          {chosen == null ? (
            <>
              <View
                style={{ paddingHorizontal: SPACE.lg, paddingBottom: SPACE.md }}
              >
                <SearchField
                  value={query}
                  // The design's own field fill, not the glass the field
                  // wears elsewhere: at full height this sheet turns opaque
                  // and a glass field on it has nothing to refract.
                  fill={FILL_SUBTLE}
                  placeholder={tr(
                    "ค้นหาบ้าน ที่อยู่ หรือชื่อสมาชิก",
                    "Search houses, addresses or members",
                  )}
                  onChangeText={setQuery}
                />
              </View>
              <ScrollView
                contentContainerStyle={{
                  padding: SPACE.lg,
                  paddingTop: 0,
                  paddingBottom: insets.bottom + SPACE.lg,
                  gap: SPACE.md,
                }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
              >
                {/* 16 Medium, the same line the visit sheet heads its list
                    with — not a count in a heavy heading. */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.sm,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "500",
                      color: TEXT_PRIMARY,
                    }}
                  >
                    {tr(
                      `บ้านที่อยู่ในความดูแล ${hits.length} หลัง`,
                      `${hits.length} ${hits.length === 1 ? "house" : "houses"} in your care`,
                    )}
                  </Text>
                  <View style={{ flex: 1 }} />
                  <FilterSelect
                    value={filter}
                    options={HOUSE_FILTERS}
                    onChange={setFilter}
                  />
                </View>
                {hits.map((p) => (
                  <Card
                    key={p.house.id}
                    onPress={() => open(p)}
                    padded={false}
                    style={{ overflow: "hidden" }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: SPACE.md,
                        padding: SPACE.lg,
                        backgroundColor: SURFACE,
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: houseNeedsAttention(p.house)
                            ? DANGER_BG
                            : PRIMARY_100,
                        }}
                      >
                        <HouseGlyph
                          size={18}
                          color={
                            houseNeedsAttention(p.house) ? DANGER : PRIMARY_500
                          }
                          strokeWidth={2.2}
                        />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 15,
                            fontWeight: "700",
                            color: TEXT_PRIMARY,
                          }}
                        >
                          {p.house.number}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{ fontSize: 12, color: TEXT_MUTED }}
                        >
                          {membersLine(p)}
                        </Text>
                      </View>
                      <ChevronRight
                        size={18}
                        color={TEXT_MUTED}
                        strokeWidth={2.2}
                      />
                    </View>
                  </Card>
                ))}
                {hits.length === 0 && (
                  <Text
                    style={{
                      paddingVertical: SPACE.lg,
                      fontSize: 14,
                      color: TEXT_MUTED,
                    }}
                  >
                    {tr("ไม่พบบ้านที่ตรงกับคำค้น", "No houses match your search")}
                  </Text>
                )}
              </ScrollView>
            </>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: SPACE.lg,
                paddingBottom: insets.bottom + SPACE.lg,
              }}
            >
              {/* The house, the way the visit sheet gives a patient: the
                  mark, the name, a chip under it, then the pair of buttons
                  and the facts. */}
              <View
                style={{
                  width: 70,
                  height: 70,
                  borderRadius: 35,
                  backgroundColor: houseNeedsAttention(chosen.house)
                    ? DANGER
                    : PRIMARY_500,
                  alignSelf: "center",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <HouseGlyph size={30} color="#FFFFFF" strokeWidth={2.2} />
              </View>
              <Text
                style={{
                  marginTop: SPACE.md,
                  fontSize: 20,
                  fontWeight: "600",
                  textAlign: "center",
                  color: TEXT_PRIMARY,
                }}
              >
                {chosen.house.number}
              </Text>
              <View
                style={{
                  alignSelf: "center",
                  marginTop: SPACE.xs,
                  backgroundColor: TINT_BG,
                  borderRadius: RADIUS.capsule,
                  paddingHorizontal: SPACE.md,
                  paddingVertical: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "500",
                    color: PRIMARY_500,
                  }}
                >
                  {membersLine(chosen)}
                </Text>
              </View>

              <View
                style={{ flexDirection: "row", gap: 10, marginTop: SPACE.lg }}
              >
                <SheetButton
                  label={tr("ปิด", "Close")}
                  // Opened on the one house, there is no list to close back
                  // to — the house is the page — so closing it goes back to
                  // the patient it was opened from.
                  onPress={() => (focus != null ? nav.goBack() : setChosen(null))}
                />
                <SheetButton
                  label={tr("นำทาง", "Directions")}
                  primary
                  icon={
                    <UIcon name="locationArrow" size={16} color="#FFFFFF" />
                  }
                  onPress={openNavigation}
                />
              </View>

              <View
                style={{
                  marginTop: SPACE.lg,
                  backgroundColor: SURFACE,
                  borderRadius: RADIUS.card,
                  padding: SPACE.lg,
                  gap: SPACE.md,
                }}
              >
                <View>
                  <Text style={{ fontSize: 12, color: TEXT_MUTED }}>
                    {tr("ระยะทางไปยังบ้าน", "Distance to house")}
                  </Text>
                  <Text
                    style={{
                      marginTop: 2,
                      fontSize: 16,
                      fontWeight: "600",
                      color: PRIMARY_500,
                    }}
                  >
                    {route == null
                      ? tr("กำลังหาเส้นทาง…", "Finding a route…")
                      : `${distanceLabel(route.metres)} ${durationLabel(route.seconds)}`}
                  </Text>
                </View>
                <View style={{ height: 1, backgroundColor: SEPARATOR }} />
                <View>
                  <Text style={{ fontSize: 12, color: TEXT_MUTED }}>
                    {tr("ที่อยู่", "Address")}
                  </Text>
                  <Text
                    numberOfLines={3}
                    style={{
                      marginTop: 2,
                      fontSize: 16,
                      fontWeight: "500",
                      lineHeight: 22,
                      color: TEXT_PRIMARY,
                    }}
                  >
                    {chosen.house.address}
                  </Text>
                </View>
              </View>

              {/* Who is in it — the reason a house is visited at all. */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACE.sm,
                  marginTop: SPACE.lg,
                  marginBottom: SPACE.sm,
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    fontSize: 16,
                    fontWeight: "500",
                    color: TEXT_PRIMARY,
                  }}
                >
                  {tr("สมาชิกในบ้าน", "Household members")}
                </Text>
                <Pressable
                  onPress={() =>
                    nav.navigate("HouseDetail", { house: chosen.house })
                  }
                  accessibilityRole="button"
                  hitSlop={8}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 2,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: PRIMARY_500,
                    }}
                  >
                    {tr("ข้อมูลบ้าน", "House details")}
                  </Text>
                  <ChevronRight
                    size={15}
                    color={PRIMARY_500}
                    strokeWidth={2.4}
                  />
                </Pressable>
              </View>
              <Card style={{ paddingVertical: 0 }}>
                {chosen.house.residents.map((r, i) => (
                  <MemberRow
                    key={r.id}
                    resident={r}
                    first={i === 0}
                    onPress={() => nav.navigate("HealthTracking", { resident: r })}
                  />
                ))}
              </Card>
            </ScrollView>
          )}
      </FloatingSheet>
    </View>
  );
}

/** The village and how many live in the house, under its number. */
const membersLine = (p: Placed) => {
  const n = populationOf(p.house);
  return tr(
    `${villageFullName(p.village)} · สมาชิก ${n} คน`,
    `${villageFullName(p.village)} · ${n} ${n === 1 ? "member" : "members"}`,
  );
};

/**
 * A pin arriving and leaving.
 *
 * Dropped in the way MapKit drops its own: down from above with a spring
 * under it, staggered so a screenful arrives as a sweep rather than a
 * flash. Leaving is the other way and quicker — what is going is not worth
 * watching.
 */
function DropIn({
  show,
  delay,
  children,
}: {
  show: boolean;
  delay: number;
  children: React.ReactNode;
}) {
  const at = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (show) {
      Animated.spring(at, {
        toValue: 1,
        delay,
        useNativeDriver: true,
        friction: 7,
        tension: 90,
      }).start();
      return;
    }
    Animated.timing(at, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [show, delay, at]);

  return (
    <Animated.View
      style={{
        opacity: at,
        transform: [
          {
            translateY: at.interpolate({
              inputRange: [0, 1],
              outputRange: [-18, 0],
            }),
          },
          {
            scale: at.interpolate({
              inputRange: [0, 1],
              outputRange: [0.4, 1],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}


/** One person in the house: who they are, and whether they need looking at. */
function MemberRow({
  resident,
  first,
  onPress,
}: {
  resident: Resident;
  first: boolean;
  onPress: () => void;
}) {
  return (
    <View>
      {!first && <View style={{ height: 1, backgroundColor: SEPARATOR }} />}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={resident.name}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.md,
          paddingVertical: SPACE.md,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Avatar
          size={36}
          initial={initialOf(resident.name)}
          photo={resident.photo}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: 15, fontWeight: "600", color: TEXT_PRIMARY }}
          >
            {resident.name}
          </Text>
          <Text style={{ fontSize: 12, color: TEXT_MUTED }}>
            {tr(
              `${resident.age} ปี · ${resident.gender} · กรุ๊ปเลือด ${resident.bloodType}`,
              `${resident.age} yrs · ${genderLabel(resident.gender)} · Blood type ${resident.bloodType}`,
            )}
          </Text>
        </View>
        {resident.needsAttention === true && (
          <View
            style={{
              paddingHorizontal: SPACE.sm,
              paddingVertical: 3,
              borderRadius: RADIUS.capsule,
              backgroundColor: DANGER_BG,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: DANGER }}>
              {tr("ต้องติดตาม", "Follow-up")}
            </Text>
          </View>
        )}
        <ChevronRight size={16} color={TEXT_MUTED} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}
