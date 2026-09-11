import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";

import { MapPin, pinAnchor } from "./MapPin";
import type { UIconName } from "./UIcon";

/** How tight the frame sits around the point, in degrees. */
const DELTA = 0.003;

/**
 * A still map of one spot, with the pin on it.
 *
 * Dead: no scroll, no zoom, no touches. It is a picture of a place, and a
 * card that scrolls the page under a finger that meant to drag the map is
 * worse than no map at all — the card's own press handler takes the tap and
 * opens the real thing.
 *
 * The pin carries its own view, because a childless `<Marker>` draws nothing
 * under the New Architecture, and it is mounted unconditionally: a child that
 * comes and goes is how `AIRMap` ends up being handed a nil subview.
 */
export function MapPreview({
  at,
  height,
  glyph,
  delta = DELTA,
}: {
  at: { latitude: number; longitude: number };
  height: number;
  /** A mark on the balloon. Left off, it is Apple's own bare marker. */
  glyph?: UIconName;
  delta?: number;
}) {
  return (
    <MapView
      provider={PROVIDER_DEFAULT}
      style={{ height }}
      region={{ ...at, latitudeDelta: delta, longitudeDelta: delta }}
      scrollEnabled={false}
      zoomEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
      pointerEvents="none"
    >
      <Marker coordinate={at} anchor={pinAnchor()}>
        <MapPin glyph={glyph} />
      </Marker>
    </MapView>
  );
}
