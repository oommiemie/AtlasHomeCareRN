import { Image, Text, View } from "react-native";

/**
 * A person, as a disc with their initial on it.
 *
 * One definition for every card and every record page. The app had two: the
 * posting card on the home page drew its own plain blue round, and
 * everywhere else — the visit rows, the house members, the readings, the
 * examination room — went through this, which put the same monogram on a
 * tinted piece of Apple's glass. Two people, two shapes, a tap apart.
 *
 * The plain round wins. It is the one that survives being small: a glass
 * disc is a material, and a material needs something behind it to be made
 * of, which at 32 points in the corner of a card is a few pixels of
 * whatever the card is standing on. It also needs the platform to have the
 * material at all, and where there is none the fallback had to paint the
 * tint flat anyway — so the glass was only ever real on one of the two
 * builds, and the avatar was one shape on an iPhone and another on
 * everything else.
 *
 * A photograph, where there is one, fills the disc instead of the initial.
 */

/**
 * The disc's blue.
 *
 * The posting card's, which is a step brighter than the app's `PRIMARY_500`
 * and is what a monogram on it was drawn against. Not a theme colour: a
 * person's disc is the same blue on a white page and a black one, the way a
 * status is.
 */
const DISC = "#0091FF";

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
  const shown = photo != null && photo.length > 0;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: DISC,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {shown ? (
        <Image source={{ uri: photo }} style={{ width: size, height: size }} />
      ) : (
        <Text
          style={{
            // The posting card's proportion — 14 points of letter in a
            // 32-point round — so the two are the same object at any size.
            fontSize: Math.round(size * 0.44),
            lineHeight: Math.round(size * 0.52),
            fontWeight: "600",
            color: "#FFFFFF",
          }}
        >
          {initial}
        </Text>
      )}
    </View>
  );
}
