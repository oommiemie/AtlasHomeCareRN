import { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";

import { MapView, Marker, Polyline, PROVIDER_DEFAULT, hasMap } from "./Map";
import { MapPin, pinAnchor } from "./MapPin";
import { GlassWidget } from "./GlassWidget";
import { PressableScale } from "./PressableScale";
import { initialOf, type Task } from "../models/task";
import { useHere } from "../utils/useHere";
import { tr } from "../i18n";
import {
  distanceLabel,
  durationLabel,
  fetchRoute,
  type VisitRoute,
} from "../utils/routing";
import {
  PRIMARY_500,
  RADIUS,
  SPACE,
  SURFACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TYPE,
} from "../theme/tokens";

/**
 * The way to a patient's house, as the assistant sends it: a small map with
 * the road from here to there, how far and how long, and the two things to
 * do with it — hand it to the phone's maps to drive, or open it full size.
 *
 * The same route the visit map draws (OSRM, from where the phone is), so
 * what the assistant sends and what the map page shows agree. Where the
 * road cannot be fetched the map still shows both ends, joined straight.
 */
export function RouteCard({
  task,
  onOpenMap,
}: {
  task: Task;
  /** Opens the visit on the app's own map page. */
  onOpenMap: () => void;
}) {
  const { here } = useHere();
  const [route, setRoute] = useState<VisitRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const map = useRef<MapView>(null);
  const to = { latitude: task.lat!, longitude: task.lng! };

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchRoute(
      { lat: here.latitude, lng: here.longitude },
      { lat: task.lat!, lng: task.lng! },
    ).then((r) => {
      if (!live) return;
      setRoute(r);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [task.id, task.lat, task.lng, here.latitude, here.longitude]);

  const line = useMemo(
    () => route?.points ?? [here, to],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [route, here.latitude, here.longitude, task.lat, task.lng],
  );

  // Both ends in view, clear of the card's corners.
  useEffect(() => {
    const t = setTimeout(() => {
      map.current?.fitToCoordinates(line, {
        edgePadding: { top: 36, right: 36, bottom: 36, left: 36 },
        animated: false,
      });
    }, 150);
    return () => clearTimeout(t);
  }, [line]);

  return (
    // The map on the glass pane, inset in its own rounded frame.
    <GlassWidget padding={SPACE.sm}>
      {/* The map itself opens it full size — the thing a thumb reaches for
          first on a card that is mostly a map. */}
      {hasMap && (
        <PressableScale
          onPress={onOpenMap}
          scaleTo={0.99}
          accessibilityRole="button"
          accessibilityLabel={tr("ดูแผนที่เส้นทางแบบเต็มจอ", "Open route map full screen")}
          style={{ height: 220, borderRadius: RADIUS.lg, overflow: "hidden" }}
        >
          <View style={{ flex: 1 }} pointerEvents="none">
            <MapView
              ref={map}
              provider={PROVIDER_DEFAULT}
              style={{ flex: 1 }}
              initialRegion={{
                latitude: (here.latitude + to.latitude) / 2,
                longitude: (here.longitude + to.longitude) / 2,
                latitudeDelta: Math.abs(here.latitude - to.latitude) * 2 + 0.01,
                longitudeDelta:
                  Math.abs(here.longitude - to.longitude) * 2 + 0.01,
              }}
              showsUserLocation
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
            >
              <Polyline
                coordinates={line}
                strokeColor={PRIMARY_500}
                strokeWidth={route != null ? 5 : 3}
                lineDashPattern={route != null ? undefined : [8, 6]}
              />
              <Marker coordinate={to} anchor={pinAnchor(true)}>
                <MapPin initial={initialOf(task)} />
              </Marker>
            </MapView>
          </View>
        </PressableScale>
      )}

      {/* No map on this phone: the one line the card cannot do without,
          and the way to the full page. */}
      {!hasMap && (
        <PressableScale
          onPress={onOpenMap}
          accessibilityRole="button"
          style={{
            padding: SPACE.md,
            gap: 2,
            borderRadius: RADIUS.lg,
            backgroundColor: SURFACE,
          }}
        >
          <Text
            numberOfLines={1}
            style={{ ...TYPE.rowTitle, color: TEXT_PRIMARY }}
          >
            {tr(`เส้นทางไปบ้าน${task.name}`, `Route to ${task.name}'s home`)}
          </Text>
          <Text style={{ ...TYPE.detail, color: TEXT_MUTED }}>
            {route != null
              ? tr(
                  `${distanceLabel(route.metres)} · ประมาณ ${durationLabel(route.seconds)}`,
                  `${distanceLabel(route.metres)} · about ${durationLabel(route.seconds)}`,
                )
              : loading
                ? tr("กำลังหาเส้นทาง…", "Finding a route…")
                : tr("แตะเพื่อดูแผนที่", "Tap to view the map")}
          </Text>
        </PressableScale>
      )}
    </GlassWidget>
  );
}
