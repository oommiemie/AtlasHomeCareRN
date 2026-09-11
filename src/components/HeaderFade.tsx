import { useState, type ReactNode } from "react";
import { View } from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";

/**
 * Dissolves scrolling content as it rises behind a floating header.
 *
 * Screens here draw their header over the list rather than above it, so
 * without this the cards are simply cut off at the top of the screen — a
 * hard edge that reads as a rendering fault rather than as depth.
 *
 * Two things decide where the ramp goes, and both matter:
 *
 *   • it starts BELOW the title row, never at the status bar. The cards are
 *     what the glass buttons up there refract; faded to nothing behind the
 *     toolbar, the material has only a flat wash to work with and the
 *     buttons come out blank.
 *   • it ends where the content starts, so the first card is never drawn
 *     part way through the ramp.
 *
 * Eased across six stops rather than two: a straight ramp fades at a constant
 * rate and the eye reads the ends of it as edges — a band sliding over the
 * cards.
 *
 * `from` and `to` are measured from the top of this view, not the top of the
 * screen — so it works the same whether it is given the whole screen or only
 * the part of it below a header in flow.
 */
/**
 * How far a list takes to dissolve behind a header that sits in flow.
 *
 * The same on every sub-page: the ramp is a property of the header, not of
 * what happens to be under it.
 */
export const HEADER_FADE = 24;

export function HeaderFade({
  from,
  to,
  children,
}: {
  /** Where the dissolve begins, in points from the top of this view. */
  from: number;
  /** Where it finishes — the first fully opaque line of content. */
  to: number;
  children: ReactNode;
}) {
  const [height, setHeight] = useState(0);

  // Until it has been laid out there is no ramp to compute; the mask would
  // divide by zero and take the content with it.
  if (height <= 0) {
    return (
      <View style={{ flex: 1 }} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
        {children}
      </View>
    );
  }

  const top = from / height;
  const span = (to - from) / height;

  return (
    <MaskedView
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      style={{ flex: 1 }}
      maskElement={
        <LinearGradient
          colors={[
            "transparent",
            "rgba(0,0,0,0.10)",
            "rgba(0,0,0,0.45)",
            "rgba(0,0,0,0.80)",
            "rgba(0,0,0,0.96)",
            "#000000",
          ]}
          locations={[
            top,
            top + span * 0.28,
            top + span * 0.55,
            top + span * 0.76,
            top + span * 0.9,
            top + span,
          ]}
          style={{ flex: 1 }}
        />
      }
    >
      {children}
    </MaskedView>
  );
}
