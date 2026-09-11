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
};

/** Google's encoded-polyline format, which OSRM returns by default. */
function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
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

export const distanceLabel = (metres: number) =>
  metres < 1000 ? `${Math.round(metres)} ม.` : `${(metres / 1000).toFixed(1)} กม.`;

export function durationLabel(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} นาที`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} ชม.` : `${h} ชม. ${m} นาที`;
}
