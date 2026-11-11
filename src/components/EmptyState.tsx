import { Image, Text, View, type ImageSourcePropType } from "react-native";

import { RADIUS, SPACE, SURFACE, TEXT_MUTED, TEXT_PRIMARY } from "../theme/tokens";

/**
 * A list with nothing in it, said with a picture.
 *
 * A grey glyph and one line of muted text read as a page that failed to load
 * rather than a day that is clear. The artwork is the same family as the
 * service tiles, so an empty list looks like part of the app, and the title
 * says what the state is before the line under it says why.
 */
export function EmptyState({
  art,
  title,
  detail,
  background = SURFACE,
  artSize = 120,
}: {
  art: ImageSourcePropType;
  title: string;
  detail?: string;
  /** The box behind it; transparent to stand on the page itself. */
  background?: string;
  artSize?: number;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        paddingVertical: SPACE.xl,
        paddingHorizontal: SPACE.lg,
        backgroundColor: background,
        borderRadius: RADIUS.card,
        gap: SPACE.xs,
      }}
    >
      <Image
        source={art}
        style={{ width: artSize, height: artSize * 0.8, marginBottom: SPACE.sm }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <Text
        style={{
          fontSize: 16,
          lineHeight: 24,
          fontWeight: "600",
          color: TEXT_PRIMARY,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      {detail != null && (
        <Text
          style={{
            fontSize: 14,
            lineHeight: 21,
            color: TEXT_MUTED,
            textAlign: "center",
          }}
        >
          {detail}
        </Text>
      )}
    </View>
  );
}
