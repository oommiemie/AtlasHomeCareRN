import { Text, View } from "react-native";
import Svg, { FeDropShadow, Filter, G, Path } from "react-native-svg";

import { AppleMarkerNative } from "../../modules/apple-marker";
import { UIcon, uiconUri, type UIconName } from "./UIcon";
import {
  PRIMARY_500,
  TEXT_PRIMARY,
  HALO,
} from "../theme/tokens";

/**
 * The box the balloon is drawn in, and where in it the point sits.
 *
 * Fixed rather than measured: a marker is anchored as a fraction of the view it
 * carries, so the anchor and the layout have to agree, and MapKit sizes its own
 * view — larger when selected — after the fact. The box is cut wide enough for
 * the grown state and for the shadow to fall outside the balloon.
 */
const BOX_W = 64;
const BOX_H = 72;
const TIP_Y = 56;

/** The name under the pin: one 14pt line, plus the gap above it. */
const LABEL_BLOCK = 15;

/**
 * The anchor that puts the pin's *point* on the coordinate.
 *
 * Worked out here so that no map carries a hand-tuned constant that quietly
 * goes wrong the next time the pin changes.
 */
export function pinAnchor(label: boolean = false) {
  return { x: 0.5, y: TIP_Y / (BOX_H + (label ? LABEL_BLOCK : 0)) };
}

/** The SF Symbol to fall back on when a bundled glyph cannot be read. */
const SYMBOL: Partial<Record<UIconName, string>> = {
  houseChimneyHeart: "house.fill",
};

/**
 * A map pin.
 *
 * The balloon is MapKit's own `MKMarkerAnnotationView`, hosted by the
 * `apple-marker` module — not a drawing of one. Everything about it, down to
 * how it grows when selected, is whatever the installed version of iOS draws,
 * so it matches Maps without being re-matched by hand each release.
 *
 * It is handed to the marker as a child because a childless `<Marker>`, which
 * is supposed to give us exactly this view, renders nothing under the New
 * Architecture's interop layer. The child also buys the name under the pin:
 * MapKit's own title only appears in a callout, which is to say after you have
 * tapped the thing you were trying to identify.
 */
export function MapPin({
  color = PRIMARY_500,
  glyph,
  symbol,
  initial,
  label,
  selected = false,
}: {
  color?: string;
  /** A mark from the app's icon set, in white on the balloon. */
  glyph?: UIconName;
  /**
   * An SF Symbol instead — "mappin", say. For marks the app's own set has no
   * answer for, and for the ones MapKit draws better than a bundled image
   * would: the system's glyphs are cut for this balloon.
   */
  symbol?: string;
  /** A letter instead of a glyph — a person, rather than a place. */
  initial?: string;
  /** Shown under the pin, always. */
  label?: string;
  /** Selected pins grow, as they do in Maps. */
  selected?: boolean;
}) {
  return (
    <View style={{ alignItems: "center" }}>
      {AppleMarkerNative != null ? (
        <AppleMarkerNative
          style={{ width: BOX_W, height: BOX_H }}
          tint={color}
          glyphText={glyph == null && symbol == null ? initial : undefined}
          glyphImageUri={glyph == null ? undefined : uiconUri(glyph)}
          glyphSystemImage={symbol ?? (glyph == null ? undefined : SYMBOL[glyph])}
          selected={selected}
          tipY={TIP_Y}
        />
      ) : (
        <DrawnPin color={color} glyph={glyph} initial={initial} />
      )}

      {label != null && label.length > 0 && (
        <Text
          numberOfLines={1}
          style={{
            marginTop: 1,
            maxWidth: 132,
            fontSize: 12,
            lineHeight: 14,
            fontWeight: "600",
            color: TEXT_PRIMARY,
            textShadowColor: HALO,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 3,
          }}
        >
          {label}
        </Text>
      )}
    </View>
  );
}

/** Where the drawn stand-in sits so that its point lands on `TIP_Y` too. */
const R = 14.5;
const L = 24;
const PAD = 4;

/**
 * The balloon MapKit draws: a disc closed off by two straight sides meeting at
 * a point. The sides are the circle's own tangents from the point, which is
 * what separates this outline from the fat teardrop drawn by every map library
 * that is not MapKit.
 */
function balloon(cx: number, cy: number, r: number, l: number): string {
  const a = Math.acos(r / l);
  const px = r * Math.sin(a);
  const py = r * Math.cos(a);
  const tip = cy + l;
  const e = r * 0.1;

  return [
    `M ${cx - px} ${cy + py}`,
    `A ${r} ${r} 0 1 1 ${cx + px} ${cy + py}`,
    `L ${cx + e * 0.55} ${tip - e}`,
    `Q ${cx} ${tip} ${cx - e * 0.55} ${tip - e}`,
    "Z",
  ].join(" ");
}

/**
 * A stand-in for the system's marker, drawn to the same shape.
 *
 * Only reached if the native module is missing from the build. It exists so a
 * missing module costs the exact pin rather than every pin on the map.
 */
function DrawnPin({
  color,
  glyph,
  initial,
}: {
  color: string;
  glyph?: UIconName;
  initial?: string;
}) {
  const cx = R + PAD;
  const cy = R + PAD;
  const width = cx * 2;
  const height = cy + L + PAD;
  const d = balloon(cx, cy, R, L);

  return (
    <View
      style={{
        width: BOX_W,
        height: BOX_H,
        alignItems: "center",
        paddingTop: TIP_Y - (cy + L),
      }}
    >
      <View style={{ width, height }}>
        <Svg width={width} height={height}>
          <Filter id="pinShadow" x="-50%" y="-50%" width="200%" height="200%">
            <FeDropShadow
              dx="0"
              dy="1.5"
              stdDeviation="1.6"
              floodColor="#0F172A"
              floodOpacity="0.35"
            />
          </Filter>
          {/* The shadow is its own group so that a filter this renderer
              declines to apply costs a shadow, never the pin. */}
          <G filter="url(#pinShadow)">
            <Path d={d} fill={color} />
          </G>
          <Path d={d} fill={color} />
        </Svg>

        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: cy - R * 0.58,
            alignItems: "center",
          }}
        >
          {glyph != null ? (
            <UIcon name={glyph} size={R * 1.1} color="#FFFFFF" />
          ) : (
            <Text
              style={{
                fontSize: Math.round(R),
                lineHeight: Math.round(R * 1.16),
                fontWeight: "700",
                color: "#FFFFFF",
              }}
            >
              {initial ?? ""}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}
