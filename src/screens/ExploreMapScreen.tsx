import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  Linking,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import { MapView, Marker, Polyline, PROVIDER_DEFAULT } from "../components/Map";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  Clock,
  List as ListIcon,
  Route as RouteIcon,
} from "lucide-react-native";

import {
  FloatingSheet,
  usePanelClearance,
  PANEL_HANDLE,
  useSheetAsPanel,
} from "../components/FloatingSheet";
import { Glass } from "../components/Glass";
import { SheetButton } from "../components/SheetButton";
import { FilterSelect, type FilterOption } from "../components/FilterSelect";
import { MapPin, pinAnchor } from "../components/MapPin";
import { GlassIconButton } from "../components/GlassIconButton";
import { PressableScale } from "../components/PressableScale";
import { SearchField } from "../components/SearchField";
import { UIcon } from "../components/UIcon";
import { RouteOverview } from "../components/RouteOverview";
import { RoutePlanner } from "../components/RoutePlanner";
import { ToolbarPill } from "../components/ToolbarPill";
import { VisitCard } from "../components/VisitCard";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  hasLocation,
  initialOf,
  isDone,
  planToday,
  searchVisits,
  todayTasks,
  visitStateOf,
  visitTypeLabel,
  type Task,
} from "../models/task";
import { tr } from "../i18n";
import {
  distanceLabel,
  durationLabel,
  fetchRoute,
  fetchTour,
  type VisitRoute,
} from "../utils/routing";
import { thaiDateTime } from "../utils/thaiDate";
import { useHere, FALLBACK_HERE } from "../utils/useHere";
import {
  DANGER,
  FILL_SUBTLE,
  PRIMARY_500,
  PRIMARY_700,
  RADIUS,
  SEPARATOR,
  SPACE,
  SUCCESS,
  SURFACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TINT_BG,
  currentTheme,
  shadow,
} from "../theme/tokens";
import { GUTTER } from "../theme/layout";

/**
 * The pin size, and its radius derived from it rather than set apart.
 *
 * 32 at rest, per the design's `Button - Liquid Glass - Symbol`. The chosen
 * one jumps to 52 — a bigger step than the design shows, so that picking a
 * pin reads clearly against Apple's own POI markers crowding the map.
 * `label` is the name's line box and `dotBlock` the chosen pin's ground
 * dot with its gap — the anchor has to account for both.
 */

/**
 * The day's visits on a map, with a route to whichever is chosen.
 *
 * The sheet is part of this screen rather than a presented route. It was
 * briefly a real UISheetPresentationController, which is Apple's own and
 * gives system detents for free — but a formSheet must live on its own route,
 * so the map and the sheet stopped being able to see each other's state, and
 * react-native-screens' habit of resizing a formSheet's descendant scroll
 * view to the whole sheet drew the list straight over the search field. One
 * screen holding its own sheet is worth more here than the system's physics.
 */
/** What the sheet is showing, and so what the map is pinning. */
type MapFilter = "all" | "pending" | "done" | "overdue";

const MAP_FILTERS: FilterOption<MapFilter>[] = [
  { key: "all", label: tr("ทั้งหมด", "All"), Icon: ListIcon },
  { key: "pending", label: tr("กำลังจะทำ", "Upcoming"), Icon: Clock },
  { key: "done", label: tr("เสร็จสิ้นแล้ว", "Completed"), Icon: Check },
  { key: "overdue", label: tr("เกินกำหนด", "Overdue"), Icon: AlertCircle },
];

export function ExploreMapScreen() {
  const params = useRoute<RouteProp<RootStackParamList, "ExploreMap">>().params;
  const focusFromPosting = params?.focus;
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { here } = useHere();
  const map = useRef<MapView>(null);
  const { height: screenHeight } = useWindowDimensions();
  /*
    On a wide or sideways tablet the list stands in a panel up the left of
    the map instead of a sheet across its foot: nothing to drag, and the
    map's framing keeps clear of the left rather than of the bottom.
  */
  const panel = useSheetAsPanel();
  const clearance = usePanelClearance();

  /*
    A planned round: its stops, in order.

    Either the one the assistant sent, or one the carer puts together here
    with the route planner (the toolbar at the top right). While planning,
    the map shows every visit of the day so any of them can be picked, and
    the round drawn is however far the picking has got; once it is shown,
    the round is the page, as a sent one is.
  */
  const sentTour = params?.tour?.filter(hasLocation) ?? null;
  const [planning, setPlanning] = useState(false);
  const [order, setOrder] = useState<Task[] | null>(null);
  // The assistant's round, put away by "Clear route".
  const [sentCleared, setSentCleared] = useState(false);
  const tour = planning
    ? (order ?? [])
    : order != null && order.length > 0
      ? order
      : sentCleared
        ? null
        : sentTour;
  const visits = (
    focusFromPosting
      ? [focusFromPosting]
      : planning
        ? todayTasks()
        : (tour ?? todayTasks())
  ).filter(hasLocation);

  // Only ever focus something that has coordinates.
  //
  // This used to take the posting straight from the route params, unfiltered
  // — and a posting without lat/lng then fed `{latitude: undefined}` into a
  // Polyline, which react-native-maps turned into a nil and UIKit died on
  // with "-[__NSArrayM insertObject:atIndex:]: object cannot be nil".
  const [focused, setFocused] = useState<Task | null>(
    focusFromPosting != null && hasLocation(focusFromPosting)
      ? focusFromPosting
      : null,
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MapFilter>("all");
  const [route, setRoute] = useState<VisitRoute | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Two resting heights: the design's floating card, and full.
   *
   * No peek detent. A sheet that can shrink to a sliver puts the list out of
   * reach for no gain — the map is already most of the screen at the resting
   * height, and the control pill rides above the sheet either way.
   */
  const detents = useMemo(
    () => [
      Math.round(screenHeight * 0.42),
      // Right up under the status bar, not 88% of the screen: the design's
      // `Sheet - Full Screen` is 894 of 956 and starts at y=62 — exactly the
      // status bar's height — so the sheet stops where the clock begins
      // rather than short of it.
      Math.round(screenHeight - insets.top),
    ],
    [screenHeight, insets.top],
  );

  // Animated rather than laid out: the drag follows the finger every frame,
  // and re-rendering the sheet at each height would not keep up.
  const sheetHeight = useRef(new Animated.Value(detents[0])).current;
  // Where the sheet rests, which the drag measures from. A ref, not state:
  // reading it mid-gesture must not wait on a re-render.
  const restingAt = useRef(detents[0]);
  // Mirrored to state only so the control pill can sit above it; this settles
  // once per gesture, not once per frame.
  const [settled, setSettled] = useState(detents[0]);
  // The detents as they are now, for the drag, which is built once and
  // would otherwise measure against the height the screen first opened at.
  const detentsNow = useRef(detents);

  /*
    A turned tablet has a different height, and so different detents: the
    sheet comes back to rest at the new first one rather than keeping a
    height worked out for the other way up.
  */
  useEffect(() => {
    if (detentsNow.current === detents) return;
    detentsNow.current = detents;
    restingAt.current = detents[0];
    sheetHeight.setValue(detents[0]);
    setSettled(detents[0]);
  }, [detents, sheetHeight]);

  const drag = useRef(
    PanResponder.create({
      // Claim the gesture only once it is clearly a drag, so a tap still
      // reaches what is underneath.
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
        // Carry the throw, so a flick reaches the next detent even when the
        // finger stopped short of it.
        const projected = landed - g.vy * 140;
        const target = detents.reduce((best, d) =>
          Math.abs(d - projected) < Math.abs(best - projected) ? d : best,
        );
        restingAt.current = target;
        setSettled(target);
        Animated.spring(sheetHeight, {
          toValue: target,
          // Height is a layout property; the native driver cannot carry it.
          useNativeDriver: false,
          friction: 12,
          tension: 90,
        }).start();
      },
    }),
  ).current;

  /** Rest the sheet on a detent, as a drag let go there would. */
  const snapSheet = (target: number) => {
    restingAt.current = target;
    setSettled(target);
    Animated.spring(sheetHeight, {
      toValue: target,
      useNativeDriver: false,
      friction: 12,
      tension: 90,
    }).start();
  };

  /*
    Planning a round wants the whole sheet on a phone: the start, the
    stops, the houses still to add and the button under them do not fit in
    the resting card. So the sheet rises to full as planning starts, and
    comes back down when the round is shown. (A tablet's panel is already
    full height.)
  */
  useEffect(() => {
    if (panel) return;
    const d = detentsNow.current;
    snapSheet(planning ? d[d.length - 1] : d[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planning]);

  // Routes already fetched, kept for the life of the screen.
  //
  // The road route comes from a public OSRM server, which is a network
  // round trip away — picking the same patient twice should not pay for it
  // twice.
  const routeCache = useRef(new Map<string, VisitRoute>());

  useEffect(() => {
    if (focused == null) {
      setRoute(null);
      return;
    }
    if (!hasLocation(focused)) {
      setRoute(null);
      setLoading(false);
      return;
    }
    const cached = routeCache.current.get(focused.id);
    if (cached != null) {
      setRoute(cached);
      setLoading(false);
      return;
    }
    let live = true;
    setRoute(null);
    setLoading(true);
    fetchRoute(
      { lat: here.latitude, lng: here.longitude },
      { lat: focused.lat!, lng: focused.lng! },
    ).then((r) => {
      if (!live) return;
      if (r != null) routeCache.current.set(focused.id, r);
      else
        toast(
          tr(
            "หาเส้นทางถนนไม่ได้ แสดงเป็นเส้นตรงแทน",
            "Couldn't find a road route — showing a straight line",
          ),
          "warning",
        );
      setRoute(r);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [focused, here]);

  /**
   * The list, filtered before it is searched.
   *
   * The same four the plan screen offers, and the map draws the same set:
   * a filter that thinned the list and left every pin standing would be
   * answering "what is still to do" with a map that says "everything".
   */
  const shown = useMemo(
    () =>
      filter === "all"
        ? visits
        : visits.filter((t) => visitStateOf(t, planToday) === filter),
    [visits, filter],
  );
  const results = searchVisits(query, shown);

  /** Into the round next, or back out of it. */
  const togglePlanned = (t: Task) =>
    setOrder((o) => {
      const now = o ?? [];
      return now.some((x) => x.id === t.id)
        ? now.filter((x) => x.id !== t.id)
        : [...now, t];
    });

  /**
   * Frame what is pinned, plus where the carer is.
   *
   * The padding under it is the sheet's own resting height and then some:
   * fitting into the whole map puts the southern pins behind the card, and
   * a pin the carer cannot see is a pin that is not there.
   */
  const fitToDay = () => {
    if (map.current == null || results.length === 0) return;
    map.current.fitToCoordinates(
      [
        { latitude: here.latitude, longitude: here.longitude },
        ...results.map((t) => ({ latitude: t.lat!, longitude: t.lng! })),
      ],
      {
        // Clear of the panel on the left, where there is one, and of the
        // sheet along the bottom where there is not.
        edgePadding: panel
          ? { top: 140, right: 80, bottom: 80, left: clearance + 40 }
          : {
              top: 140,
              right: 80,
              bottom: Math.round(detents[0]) + 40,
              left: 80,
            },
        animated: true,
      },
    );
  };

  /** Back to the carer. */
  const goToMe = () => {
    map.current?.animateToRegion(
      { ...here, latitudeDelta: 0.012, longitudeDelta: 0.012 },
      420,
    );
  };

  // Frame the day once the fix lands or the list changes — not on every
  // selection, which would move a pin out from under the finger.
  useEffect(() => {
    const id = setTimeout(fitToDay, 300);
    return () => clearTimeout(id);
    // Refit when the filter or the search changes what is pinned, so the
    // map always holds everything the list is offering.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here, results.length, filter, panel]);

  // Frame both ends the moment a pin is picked — the carer and the patient —
  // so the provisional line is on screen immediately rather than after the
  // routing server answers.
  //
  // Zooming to the patient alone was the old behaviour, and it put the whole
  // line outside a 1.3km box whenever the two were further apart than that.
  useEffect(() => {
    if (focused == null || !hasLocation(focused) || map.current == null) {
      return;
    }
    map.current.fitToCoordinates(
      [
        { latitude: here.latitude, longitude: here.longitude },
        { latitude: focused.lat!, longitude: focused.lng! },
      ],
      { edgePadding: framePadding(), animated: true },
    );
  }, [focused]);

  // Then frame the whole route once it arrives.
  //
  // Without this the map stayed on the 0.012-degree box around the patient —
  // about 1.3km — while the route runs all the way back to the carer, so
  // unless they were nearly next door the line was drawn entirely off
  // screen and looked as though it had never loaded at all.
  useEffect(() => {
    // Two points at least: MapKit cannot fit a region to one coordinate.
    if (route == null || route.points.length < 2 || map.current == null) {
      return;
    }
    // Short settle so this lands after the pick's own framing rather than
    // fighting it mid-animation.
    const id = setTimeout(() => {
      map.current?.fitToCoordinates(route.points, {
        edgePadding: framePadding(),
        animated: true,
      });
    }, 120);
    return () => clearTimeout(id);
  }, [route]);

  /**
   * Room to leave around a fitted region, clamped to the map.
   *
   * `fitToCoordinates` is handed the sheet's height as bottom padding so the
   * route clears it — but at the full detent that is nearly the whole
   * screen, and top plus bottom then exceeded the map's own height. MapKit
   * cannot resolve a region into no remaining space and the app went down
   * with it. Never let the two edges claim more than 60% between them.
   */
  const framePadding = () => {
    if (panel) {
      return { top: 160, right: 70, bottom: 70, left: clearance + 40 };
    }
    const top = 160;
    const maxVertical = screenHeight * 0.6;
    const bottom = Math.max(40, Math.min(settled + 40, maxVertical - top));
    return { top, right: 70, bottom, left: 70 };
  };

  // The round's own road, from here through every stop in order.
  const [tourRoute, setTourRoute] = useState<VisitRoute | null>(null);
  const tourLine = tourRoute?.points ?? null;
  const tourKey = tour?.map((t) => t.id).join(",") ?? "";
  useEffect(() => {
    if (tour == null || tour.length === 0) {
      setTourRoute(null);
      return;
    }
    let live = true;
    fetchTour([
      { lat: here.latitude, lng: here.longitude },
      ...tour.map((t) => ({ lat: t.lat!, lng: t.lng! })),
    ]).then((r) => {
      if (live && r != null) setTourRoute(r);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here.latitude, here.longitude, tourKey]);

  /**
   * What the route line draws.
   *
   * The real geometry once it lands, and until then a straight hop from the
   * carer to the patient so something is on screen the instant a pin is
   * picked. Empty when nothing is chosen.
   */
  const onRoad =
    tour != null && focused == null ? tourLine != null : route != null;
  const line =
    tour != null && tour.length === 0 && focused == null
      ? []
      : tour != null && focused == null
        ? (tourLine ?? [
            { latitude: here.latitude, longitude: here.longitude },
            ...tour.map((t) => ({ latitude: t.lat!, longitude: t.lng! })),
          ])
        : route != null
          ? route.points
          : focused != null && hasLocation(focused)
            ? [
                { latitude: here.latitude, longitude: here.longitude },
                { latitude: focused.lat!, longitude: focused.lng! },
              ]
            : [];

  /** Where the route's distance badge sits. */
  const routeBadge = route != null ? midpointOf(route.points) : null;

  /** At the tallest detent the sheet stops being a floating card. */
  const expanded = !panel && settled === detents[detents.length - 1];

  const openNavigation = () => {
    if (focused == null) return;
    const google = `comgooglemaps://?daddr=${focused.lat},${focused.lng}&directionsmode=driving`;
    const apple = `http://maps.apple.com/?daddr=${focused.lat},${focused.lng}&dirflg=d`;
    Linking.canOpenURL(google)
      .then((ok) => Linking.openURL(ok ? google : apple))
      .catch(() =>
        toast(tr("เปิดแอพแผนที่ไม่ได้", "Couldn't open the maps app"), "error"),
      );
  };

  return (
    <View style={{ flex: 1 }}>
      <MapView
        // The map turns with the app, not with the phone: a daylight map
        // under a dark sheet is the brightest thing left on the page.
        userInterfaceStyle={currentTheme()}
        ref={map}
        provider={PROVIDER_DEFAULT}
        style={{ flex: 1 }}
        initialRegion={{
          ...FALLBACK_HERE,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        }}
        // Apple's own location dot, rather than a circle drawn to look like
        // one: it carries the accuracy halo and the heading cone, and tracks
        // movement without the screen re-rendering.
        showsUserLocation
        showsMyLocationButton={false}
        // Two fingers turn the map, and the compass appears while it is off
        // north so there is a way back — which is why rotation was off
        // before: turned with no compass, the map had no way home.
        rotateEnabled
        showsCompass
        // The map is the screen's empty space: tapping it puts the keyboard
        // away, which is what a tap outside a field is expected to do.
        onPress={() => Keyboard.dismiss()}
      >
        {/*
          One line, not two.

          This was a provisional dashed Polyline and a real one that swapped
          in the same commit — the first unmounting as the second mounted.
          react-native-maps' AIRMap handles its children through the legacy
          interop, and that swap handed it a nil subview:
          `-[AIRMap insertReactSubview:atIndex:]` then died on
          "object cannot be nil" and took the app with it.

          So the Polyline stays mounted and only its props change: straight
          and faint to the patient while the road route is fetched, then the
          real geometry in full strength.
        */}
        {line.length >= 2 && (
          <Polyline
            coordinates={line}
            // Solid wherever the road itself is drawn — one house's route or
            // the whole round's; faint only for the straight guess before it.
            strokeWidth={onRoad ? 5 : 3}
            strokeColor={onRoad ? PRIMARY_500 : "rgba(7,125,215,0.45)"}
          />
        )}

        {/*
          The route's own badge, on the line rather than beside it — Maps
          labels a route where it runs, and the sheet's copy of the figures
          is out of sight the moment you look at the map.

          Anchored by its bottom tip so the tail meets the line.
        */}
        {/*
          Always mounted, never conditional.

          A Marker that appears and disappears with the route is a MapView
          child going in and out, and AIRMap handles its children through the
          legacy interop: that swap hands it a nil subview and
          `-[AIRMap insertReactSubview:atIndex:]` takes the app down with
          "object cannot be nil" — the same crash the two Polylines caused.
          So it stays mounted and simply draws nothing when there is no
          route to label.
        */}
        <Marker
          coordinate={routeBadge ?? here}
          // Centred on the coordinate, so the box sits ON the route rather
          // than hovering above it — which is where Maps puts a route's
          // own time badge.
          anchor={{ x: 0.5, y: 0.5 }}
          // Re-snapshot only while the figures are changing.
          tracksViewChanges={route != null}
          // Hidden by opacity, not by rendering nothing: a marker whose
          // view has no content falls back to MapKit's own red pin, which
          // is where the stray red dot on the line came from.
          opacity={route != null ? 1 : 0}
          // Not a target: tapping it should feel like tapping the map.
          onPress={() => Keyboard.dismiss()}
        >
          {/*
              The box is always drawn, never swapped for an empty view.

              MapKit treats an annotation with no real content as "use the
              default", and puts its own red pin there — which is where the
              stray red marker on the route came from. So the box is always
              built at full size and simply turns transparent when there is
              no distance to report.
            */}
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

        {/*
          Every marker carries its own view.

          `<Marker>` with no children is meant to get MapKit's own annotation
          view; under the New Architecture, where this library runs through
          the interop layer, it comes back with nothing drawn — the pins
          simply were not there. `MapPin` is that view, made to look like the
          one the system would have given.
        */}
        {results.map((t) => (
          <Marker
            key={t.id}
            coordinate={{ latitude: t.lat!, longitude: t.lng! }}
            // The tip is the coordinate: the block is the balloon plus the
            // name under it, so the anchor sits where the point does.
            anchor={pinAnchor(true)}
            // Tapping the chosen pin again clears it. While planning, a tap
            // puts the house next in the round, or takes it back out.
            onPress={() =>
              planning
                ? togglePlanned(t)
                : setFocused(focused?.id === t.id ? null : t)
            }
          >
            <MapPin
              selected={focused?.id === t.id}
              color={
                focused?.id === t.id
                  ? PRIMARY_700
                  : planning && !(order ?? []).some((x) => x.id === t.id)
                    ? PIN_UNPLANNED
                    : PRIMARY_500
              }
              // On a planned round the pin carries its place in the order.
              initial={
                tour != null && tour.some((x) => x.id === t.id)
                  ? String(tour.findIndex((x) => x.id === t.id) + 1)
                  : initialOf(t)
              }
              label={shortName(t.name)}
            />
          </Marker>
        ))}
      </MapView>

      {/*
        The map dims as the sheet rises, the way iOS darkens what sits behind
        a sheet at its largest detent.

        Driven off the drag rather than off `settled`, so it deepens with the
        finger instead of snapping when the gesture ends. It is a sibling of
        the sheet, never an ancestor — an opacity animation above a Glass
        would stop the material rendering.
      */}
      {!panel && (
        <Animated.View
          pointerEvents="none"
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: "#000000",
            opacity: sheetHeight.interpolate({
              inputRange: [detents[0], detents[detents.length - 1]],
              outputRange: [0, 0.28],
              extrapolate: "clamp",
            }),
          }}
        />
      )}

      <View
        style={{
          position: "absolute",
          top: insets.top + SPACE.sm,
          left: GUTTER,
        }}
      >
        <GlassIconButton
          size={48}
          onPress={() => nav.goBack()}
          accessibilityLabel={tr("ย้อนกลับ", "Back")}
        >
          <ChevronLeft size={24} color={TEXT_PRIMARY} strokeWidth={2.4} />
        </GlassIconButton>
      </View>

      {/*
        The route planner, on the toolbar opposite the back button: put the
        day's houses in the order they will be visited and see the road
        through them. Not offered on a page opened for one posting.
      */}
      {focusFromPosting == null && (
        <View
          style={{
            position: "absolute",
            top: insets.top + SPACE.sm + 2,
            right: GUTTER,
          }}
        >
          <ToolbarPill
            slots={[
              {
                icon: (
                  <RouteIcon
                    size={20}
                    color={planning ? PRIMARY_500 : TEXT_PRIMARY}
                    strokeWidth={2.2}
                  />
                ),
                label: tr("วางแผนเส้นทางเยี่ยม", "Plan visit route"),
                onPress: () => {
                  setFocused(null);
                  setQuery("");
                  if (!planning) {
                    // Start from the round already on the map, if any.
                    setOrder((o) => o ?? (sentCleared ? null : sentTour) ?? []);
                  }
                  setPlanning((p) => !p);
                },
              },
            ]}
          />
        </View>
      )}

      {/*
        The map controls, as one vertical capsule — Maps stacks its own
        controls in a single pill rather than scattering round buttons, and
        two buttons sharing one piece of glass read as one control.

        Gone once the sheet is pulled full: there is no map left to aim them
        at, and riding above a full-height sheet would put them off the top
        of the screen anyway.

        Unmounted rather than faded — UIVisualEffectView will not render its
        material under an ancestor whose alpha is below 1, so an opacity
        animation here would bring the pill back as an empty outline.
      */}
      {!expanded && (
        <Animated.View
          style={{
            position: "absolute",
            right: GUTTER,
            // In the bottom corner beside a panel; riding on the sheet's
            // top edge otherwise.
            bottom: panel
              ? insets.bottom + SPACE.lg
              : Animated.add(
                  sheetHeight,
                  new Animated.Value(SPACE.md + SPACE.sm),
                ),
          }}
        >
          {/* 48 x 95, radius 24, 14 of padding with 16 between the two icons
            — the design's `VerticalContainerLiquidGlass`. No divider: the
            design separates them by spacing alone. */}
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
              onPress={fitToDay}
              accessibilityRole="button"
              accessibilityLabel={tr("ดูภารกิจทั้งวัน", "Show the whole day")}
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
              accessibilityLabel={tr(
                "กลับไปยังตำแหน่งของฉัน",
                "Back to my location",
              )}
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

      {/*
        The sheet — the design's `Madal`, in its two states.

        Resting, it is a floating 424-wide card: 8pt clear of each edge,
        36 round on every corner, white at half strength over Apple's glass,
        with a 32 shadow lifting it off the map.

        Pulled to full it becomes the design's `Sheet - Full Screen`: edge to
        edge, square along the bottom, 38 across the top, and opaque #F2F2F7
        rather than glass — at that size there is no map left behind it worth
        refracting.
      */}
      <FloatingSheet expanded={expanded} height={sheetHeight}>
        {/* The grab band. The gesture lives here rather than on the whole
              sheet, so dragging the list still scrolls it. Padded well past
              the 4pt bar to give the finger something to catch. */}
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

        {/* Only over the list. With one patient pinned the field has
              nothing to filter, and typing in it would have to throw the
              selection away to mean anything — so it is not offered. */}
        {focused == null && tour == null && (
          <View
            style={{ paddingHorizontal: SPACE.lg, paddingBottom: SPACE.md }}
          >
            <SearchField
              value={query}
              // The design's own field fill (#787880 at 16%), not the glass
              // the field wears elsewhere: at full height this sheet turns
              // opaque, and a glass field on an opaque sheet has nothing to
              // refract — its white tint landed on near-white ground and the
              // field disappeared.
              fill={FILL_SUBTLE}
              placeholder={tr(
                "ค้นหาชื่อผู้ป่วยหรืองาน",
                "Search patients or tasks",
              )}
              onChangeText={(q) => {
                setQuery(q);
                // Typing while a pin is chosen would look broken: the sheet
                // is pinned to that one patient and cannot answer the query.
                if (q.trim() !== "" && focused != null) setFocused(null);
              }}
            />
          </View>
        )}

        {focused == null ? (
          <ScrollView
            style={{ flex: 1 }}
            keyboardDismissMode="on-drag"
            // Without this a tap while the keyboard is up is spent closing
            // it, and the card underneath never opens.
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: SPACE.lg,
              paddingTop: 0,
              paddingBottom: insets.bottom + SPACE.lg,
              gap: SPACE.md,
            }}
          >
            {/* A planned round: the round itself, stop by stop, rather
                  than the day's cards — the map above is that round. */}
            {planning ? (
              <RoutePlanner
                candidates={visits}
                order={order ?? []}
                route={tourRoute}
                onChange={setOrder}
                onAuto={() => setOrder(nearestFirst(order, visits, here))}
                onDone={() => {
                  setPlanning(false);
                  setTimeout(fitToDay, 300);
                }}
                onCancel={() => {
                  setPlanning(false);
                  setOrder(null);
                }}
              />
            ) : tour != null ? (
              <RouteOverview
                stops={tour}
                route={tourRoute}
                onOpenStop={(t) => setFocused(t)}
                onEdit={() => {
                  setOrder(tour);
                  setPlanning(true);
                }}
                onCancel={() => {
                  // The round put away and the day's list back.
                  setOrder(null);
                  setSentCleared(true);
                }}
              />
            ) : (
              <>
                {/* 16 Medium on #111111, per the design — not the large,
                  heavy heading Apple Maps uses for "Siri Suggestions". */}
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
                      `ภารกิจวันนี้ ${results.length} งาน`,
                      `Today's tasks: ${results.length}`,
                    )}
                  </Text>
                  <View style={{ flex: 1 }} />
                  <FilterSelect
                    value={filter}
                    options={MAP_FILTERS}
                    onChange={setFilter}
                  />
                </View>
                {results.length === 0 ? (
                  <Text
                    style={{
                      paddingVertical: SPACE.lg,
                      textAlign: "center",
                      fontSize: 14,
                      color: TEXT_MUTED,
                    }}
                  >
                    {tr(
                      `ไม่พบภารกิจที่ตรงกับ "${query.trim()}"`,
                      `No tasks match "${query.trim()}"`,
                    )}
                  </Text>
                ) : (
                  results.map((t) => (
                    <VisitCard
                      key={t.id}
                      task={t}
                      now={planToday}
                      onPress={() => setFocused(t)}
                    />
                  ))
                )}
              </>
            )}
          </ScrollView>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: SPACE.lg,
              paddingTop: 0,
              paddingBottom: insets.bottom + SPACE.lg,
            }}
          >
            <View
              style={{
                width: 70,
                height: 70,
                borderRadius: 35,
                backgroundColor: PRIMARY_500,
                alignSelf: "center",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{ fontSize: 20, fontWeight: "600", color: "#FFFFFF" }}
              >
                {initialOf(focused)}
              </Text>
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
              {focused.name}
            </Text>
            {/* Age beside the name, as it reads on every card in the app. */}
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
                {tr(`${focused.age} ปี`, `${focused.age} yrs`)}
              </Text>
            </View>

            {/*
                Side by side, 48 tall and 10 apart — the accept-task
                screen's pair exactly: the secondary on the left, the
                primary on the right.
              */}
            <View
              style={{ flexDirection: "row", gap: 10, marginTop: SPACE.lg }}
            >
              <SheetButton
                label={tr("ยกเลิก", "Cancel")}
                // The system's control grey, not a red: this only clears
                // the selection — nothing is being refused or undone, and
                // a danger colour overstated it.
                onPress={() =>
                  focusFromPosting ? nav.goBack() : setFocused(null)
                }
              />
              <SheetButton
                label={tr("นำทาง", "Directions")}
                primary
                icon={<UIcon name="locationArrow" size={16} color="#FFFFFF" />}
                onPress={openNavigation}
              />
            </View>

            {/*
                What the visit is, when it is, how far it is, and where.
                The panel used to open with the distance — useful once you
                have decided to go, and no help at all in deciding, because
                it never said what the visit was for.
              */}
            <View
              style={{
                marginTop: SPACE.lg,
                backgroundColor: SURFACE,
                borderRadius: RADIUS.card,
                padding: SPACE.lg,
                gap: SPACE.md,
              }}
            >
              {focused.visitType != null && (
                <>
                  <PinFact
                    label={tr("ประเภทการเยี่ยม", "Visit type")}
                    value={visitTypeLabel(focused.visitType)}
                  />
                  <PinDivider />
                </>
              )}
              <PinFact
                label={tr("ภารกิจ", "Task")}
                value={focused.detail}
                lines={3}
              />
              <PinDivider />
              <PinFact
                label={tr("นัดเวลา", "Appointment")}
                value={thaiDateTime(focused.dueAt)}
              />
              <PinDivider />
              <View>
                <Text style={{ fontSize: 12, color: TEXT_MUTED }}>
                  {tr("ระยะทางไปยังผู้ป่วย", "Distance to patient")}
                </Text>
                <Text
                  style={{
                    marginTop: 2,
                    fontSize: 16,
                    fontWeight: "600",
                    color: PRIMARY_500,
                  }}
                >
                  {loading
                    ? tr("กำลังหาเส้นทาง…", "Finding a route…")
                    : route == null
                      ? tr("หาเส้นทางไม่ได้", "No route found")
                      : `${distanceLabel(route.metres)} ${durationLabel(route.seconds)}`}
                </Text>
              </View>
              <PinDivider />
              {/* Three lines, not one: the address now carries the moo
                    and the village as well, and truncating it drops the
                    district and the postcode — most of what makes it
                    findable. */}
              <PinFact
                label={tr("ที่อยู่", "Address")}
                value={
                  focused.address ?? tr("ไม่ระบุที่อยู่", "No address given")
                }
                lines={3}
              />
            </View>

            {/*
                The pair, 48 tall and 10 apart — the accept-task screen's
                capsules, so the two screens' decisions look alike.

                Painted rather than glass: they stand on the sheet, and the
                sheet is already the material. Glass on glass has nothing
                real behind it to refract and both go flat.
              */}
          </ScrollView>
        )}
      </FloatingSheet>
    </View>
  );
}

/**
 * One patient's pin.
 *
 * Its own component so it can hold the animation state: a marker cannot be
 * animated from the parent's render, because MapKit draws an annotation from
 * a snapshot of its view and only redraws while `tracksViewChanges` is on.
 * So the pin turns tracking on for the length of the spring and off again —
 * leaving it on permanently re-snapshots every marker every frame, which is
 * what makes a map with custom markers stutter.
 *
 * Static — no animation, deliberately.
 *
 * Growing the pin on selection was tried twice and neither way held up.
 * MapKit draws an annotation from a snapshot, so a React-driven size change
 * needs `tracksViewChanges` on, which rebuilds that snapshot every frame and
 * stuttered; toggling the flag on and off around the animation traded the
 * stutter for a visible flicker at each flip. A pin that simply changes size
 * reads fine and never does either.
 *
 * With nothing animating, the glass costs one snapshot rather than sixty a
 * second, so the material is back — over a disc of the same colour, since
 * the rasteriser may flatten it and the pin should still be blue if it does.
 */
/**
 * The point half-way along a route, by distance travelled rather than by
 * index.
 *
 * OSRM returns a dense run of points through bends and a sparse one down a
 * straight, so the middle of the array can sit well off the visual middle of
 * the line. Walking the cumulative length puts the badge where the route
 * actually halves.
 */
/** A house not yet in the round being planned: the pin, greyed. */
const PIN_UNPLANNED = "#9AA8BA";

/**
 * The round nearest-first from where the carer stands: each next stop the
 * closest of those left. The houses already picked, if any; otherwise
 * every visit of the day still to do.
 */
function nearestFirst(
  order: Task[] | null,
  visits: Task[],
  here: { latitude: number; longitude: number },
): Task[] {
  const pool = [
    ...(order != null && order.length > 0
      ? order
      : visits.filter((t) => !isDone(t))),
  ];
  const metres = (
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number },
  ) => {
    const R = 6371000;
    const rad = (d: number) => (d * Math.PI) / 180;
    const dLat = rad(b.latitude - a.latitude);
    const dLng = rad(b.longitude - a.longitude);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(a.latitude)) *
        Math.cos(rad(b.latitude)) *
        Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  const out: Task[] = [];
  let at = here;
  while (pool.length > 0) {
    let best = 0;
    let bestM = Infinity;
    pool.forEach((t, i) => {
      const m = metres(at, { latitude: t.lat!, longitude: t.lng! });
      if (m < bestM) {
        bestM = m;
        best = i;
      }
    });
    const next = pool.splice(best, 1)[0];
    out.push(next);
    at = { latitude: next.lat!, longitude: next.lng! };
  }
  return out;
}

function midpointOf(points: { latitude: number; longitude: number }[]) {
  if (points.length < 2) return points[0] ?? null;
  const step = (a: (typeof points)[0], b: (typeof points)[0]) =>
    Math.hypot(b.latitude - a.latitude, b.longitude - a.longitude);

  let total = 0;
  for (let i = 1; i < points.length; i++)
    total += step(points[i - 1], points[i]);

  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    walked += step(points[i - 1], points[i]);
    if (walked >= total / 2) return points[i];
  }
  return points[Math.floor(points.length / 2)];
}

/** One labelled fact in the pin panel. */
function PinFact({
  label,
  value,
  lines = 1,
}: {
  label: string;
  value: string;
  lines?: number;
}) {
  return (
    <View>
      <Text style={{ fontSize: 12, color: TEXT_MUTED }}>{label}</Text>
      <Text
        numberOfLines={lines}
        style={{
          marginTop: 2,
          fontSize: 16,
          fontWeight: "500",
          color: TEXT_PRIMARY,
          // Thai ascenders and tone marks overrun a tight line box.
          lineHeight: 22,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function PinDivider() {
  return <View style={{ height: 1, backgroundColor: SEPARATOR }} />;
}

/**
 * Just enough of the name to identify someone under a pin.
 *
 * The honorific is dropped and only the given name kept: "นาง จันทร์เพ็ญ
 * บุญมี" over a street is unreadable at 11pt, and the first name is what
 * distinguishes one pin from the next.
 */
function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? parts[1] : parts[0];
}

