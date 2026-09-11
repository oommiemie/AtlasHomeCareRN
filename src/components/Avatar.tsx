import { Image, Text } from "react-native";

import { Glass } from "./Glass";

/**
 * A person, on Apple's glass.
 *
 * The tint is the accept-task hero's, which is where this treatment started:
 * the material is tinted rather than filled, because a solid disc over the
 * glass paints the material out. 0.95 is as saturated as it goes while the
 * glass still shows.
 *
 * A photograph, where there is one, fills the disc instead of the initial —
 * the glass then serves as the rim around it rather than the surface behind.
 */
export function Avatar({
  size,
  initial,
  photo,
}: {
  size: number;
  initial: string;
  /** A local file URI. */
  photo?: string;
}) {
  return (
    <Glass
      tintColor={photo == null || photo.length === 0 ? "rgba(7,125,215,0.95)" : undefined}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {photo != null && photo.length > 0 ? (
        <Image source={{ uri: photo }} style={{ width: size, height: size }} />
      ) : (
        <Text
          style={{
            // Two fifths of the disc.
            //
            // It was a quarter, which is the ratio the 80pt hero was drawn at
            // — and at the 40pt this is used at everywhere else that came out
            // as a 10pt letter sitting in the middle of a lot of blue. A
            // monogram is meant to fill its disc; this is the proportion the
            // system's own do.
            fontSize: Math.round(size * 0.4),
            lineHeight: Math.round(size * 0.48),
            fontWeight: "600",
            color: "#FFFFFF",
          }}
        >
          {initial}
        </Text>
      )}
    </Glass>
  );
}
