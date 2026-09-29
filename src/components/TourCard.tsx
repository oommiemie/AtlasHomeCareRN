import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";

import { GlassWidget } from "./GlassWidget";
import { MapView, Marker, Polyline, PROVIDER_DEFAULT, hasMap } from "./Map";
import { MapPin, pinAnchor } from "./MapPin";
import { PressableScale } from "./PressableScale";
import { TourList } from "./TourList";
import { type Task } from "../models/task";
import { useHere } from "../utils/useHere";
import { fetchTour, type VisitRoute } from "../utils/routing";
import { PRIMARY_500, RADIUS, SPACE } from "../theme/tokens";
import { tr } from "../i18n";

/**
 * The round, planned: every house to visit pinned and numbered in the order
 * to drive them, one road line from where the carer is through each in
 * turn, and the stops listed under it with their times. The map opens the
 * visit map full size; a stop opens that visit.
 */
export function TourCard({
  stops,
  onOpenMap,
  onOpenStop,
}: {
  stops: Task[];
  onOpenMap: () => void;
  onOpenStop: (t: Task) => void;
}) {
  const { here } = useHere();
  const [route, setRoute] = useState<VisitRoute | null>(null);
  const map = useRef<MapView>(null);
  const key = stops.map((s) => s.id).join(",");

  useEffect(() => {
    let live = true;
    fetchTour([
      { lat: here.latitude, lng: here.longitude },
      ...stops.map((s) => ({ lat: s.lat!, lng: s.lng! })),
    ]).then((r) => {
      if (live) setRoute(r);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, here.latitude, here.longitude]);

  const line = useMemo(
    () =>
      route?.points ?? [
        here,
        ...stops.map((s) => ({ latitude: s.lat!, longitude: s.lng! })),
      ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [route, key, here.latitude, here.longitude],
  );

  // Every stop and the start in view.
  useEffect(() => {
    const t = setTimeout(() => {
      map.current?.fitToCoordinates(line, {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
        animated: false,
      });
    }, 150);
    return () => clearTimeout(t);
  }, [line]);

  return (
    <GlassWidget padding={SPACE.sm}>
      {hasMap && (
        <PressableScale
          onPress={onOpenMap}
          scaleTo={0.99}
          accessibilityRole="button"
          accessibilityLabel={tr("ดูแผนที่เส้นทางเยี่ยมแบบเต็มจอ", "Open visit route map full screen")}
          style={{ height: 240, borderRadius: RADIUS.lg, overflow: "hidden" }}
        >
          <View style={{ flex: 1 }} pointerEvents="none">
            <MapView
              ref={map}
              provider={PROVIDER_DEFAULT}
              style={{ flex: 1 }}
              initialRegion={{
                ...here,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
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
              {stops.map((s, i) => (
                <Marker
                  key={s.id}
                  coordinate={{ latitude: s.lat!, longitude: s.lng! }}
                  anchor={pinAnchor(true)}
                >
                  {/* The order to go in, on the pin. */}
                  <MapPin initial={String(i + 1)} />
                </Marker>
              ))}
            </MapView>
          </View>
        </PressableScale>
      )}

      {/* The round in words: how far and how long, then each stop. */}
      <TourList stops={stops} route={route} onOpenStop={onOpenStop} />
    </GlassWidget>
  );
}
