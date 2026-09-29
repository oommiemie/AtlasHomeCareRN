import { Linking, Platform } from "react-native";

import { toast } from "../components/Toast";
import { tr } from "../i18n";

/**
 * Driving directions from the free OSRM demo server.
 *
 * Returns null on any failure — a timeout, an error status, an empty route —
 * so the map simply shows no line rather than an error the carer can do
 * nothing about.
 */
export type VisitRoute = {
  points: { latitude: number; longitude: number }[];
  metres: number;
  seconds: number;
  /**
   * Each stretch of a round, stop to stop — the first from where the carer
   * starts. Only on a round (`fetchTour`); one per stop, in order.
   */
  legs?: { metres: number; seconds: number }[];
};

/** Google's encoded-polyline format, which OSRM returns by default. */
function decodePolyline(
  encoded: string,
): { latitude: number; longitude: number }[] {
  const points: { latitude: number; longitude: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

export async function fetchRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<VisitRoute | null> {
  // OSRM takes lng,lat — swapped, the request comes back for the wrong
  // hemisphere with no visible error.
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?overview=full&geometries=polyline`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;

    const body = (await res.json()) as {
      routes?: { geometry: string; distance: number; duration: number }[];
    };
    const route = body.routes?.[0];
    if (!route) return null;

    return {
      points: decodePolyline(route.geometry),
      metres: route.distance,
      seconds: route.duration,
    };
  } catch {
    return null;
  }
}

/**
 * One road route through several stops in order — here, then each house.
 *
 * The same OSRM call as a single leg, with every stop as a waypoint, so the
 * line on the map is one continuous road rather than straight hops, and
 * the distance and time are the whole round's.
 */
export async function fetchTour(
  stops: { lat: number; lng: number }[],
): Promise<VisitRoute | null> {
  if (stops.length < 2) return null;
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    stops.map((p) => `${p.lng},${p.lat}`).join(";") +
    `?overview=full&geometries=polyline`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const body = (await res.json()) as {
      routes?: {
        geometry: string;
        distance: number;
        duration: number;
        legs?: { distance: number; duration: number }[];
      }[];
    };
    const route = body.routes?.[0];
    if (!route) return null;
    return {
      points: decodePolyline(route.geometry),
      metres: route.distance,
      seconds: route.duration,
      legs: route.legs?.map((l) => ({
        metres: l.distance,
        seconds: l.duration,
      })),
    };
  } catch {
    return null;
  }
}

/**
 * Each stop of a round with the stretch that reaches it and the running
 * total from the start — or null while the road through this order is
 * not known yet (or is for a different number of stops).
 */
export function stopLegs(
  route: VisitRoute | null,
  stops: number,
):
  | {
      metres: number;
      seconds: number;
      totalMetres: number;
      totalSeconds: number;
    }[]
  | null {
  const legs = route?.legs;
  if (legs == null || legs.length !== stops) return null;
  let m = 0;
  let s = 0;
  return legs.map((l) => {
    m += l.metres;
    s += l.seconds;
    return { ...l, totalMetres: m, totalSeconds: s };
  });
}

export const distanceLabel = (metres: number) =>
  metres < 1000
    ? tr(`${Math.round(metres)} ม.`, `${Math.round(metres)} m`)
    : tr(
        `${(metres / 1000).toFixed(1)} กม.`,
        `${(metres / 1000).toFixed(1)} km`,
      );

export function durationLabel(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return tr(`${mins} นาที`, `${mins} min`);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0
    ? tr(`${h} ชม.`, `${h} hr`)
    : tr(`${h} ชม. ${m} นาที`, `${h} hr ${m} min`);
}

/**
 * Driving directions to a place, in whichever maps app the phone has.
 *
 * On iOS, Google Maps where it is installed and Apple's otherwise. On Android,
 * Google Maps' own navigation, and a plain map pin for phones without it —
 * the Apple Maps web page this used to fall back to is not something an
 * Android phone should be sent to.
 */
export function openDirections(
  to: { lat: number; lng: number },
  label: string,
) {
  const at = `${to.lat},${to.lng}`;
  const name = encodeURIComponent(label);
  const [first, fallback] =
    Platform.OS === "android"
      ? [`google.navigation:q=${at}`, `geo:${at}?q=${at}(${name})`]
      : [
          `comgooglemaps://?daddr=${at}&directionsmode=driving`,
          `http://maps.apple.com/?daddr=${at}&q=${name}`,
        ];
  Linking.canOpenURL(first)
    .then((ok) => Linking.openURL(ok ? first : fallback))
    .catch(() =>
      toast(tr("เปิดแอพแผนที่ไม่ได้", "Couldn't open the maps app"), "error"),
    );
}
