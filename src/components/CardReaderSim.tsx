import { useEffect } from "react";
import { Image, View } from "react-native";
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import type { ReaderState } from "../models/community";
import { shadow } from "../theme/tokens";

/**
 * The reader and a card, as two pictures that move against each other.
 *
 * The design shipped one photograph of the pair already joined, which is a
 * picture of the end of the story: it cannot show the card going in, and the
 * card going in is the whole of what this screen is about. The two objects
 * exist in the file separately — the reader as "Smart Card" and the card as
 * "CID" — so they are pulled apart here and driven independently. They are
 * the real artwork, not a drawing of it.
 *
 * Stacking order is what sells it: the card sits *under* the reader, so a
 * card travelling down is not passing over the machine, it is going into it.
 * Everything that has entered is simply behind the front panel and gone.
 */
const SIM = {
  /*
    The two objects, in the proportion the real ones stand in.

    A card is 85.6mm across and this reader's case is about 65, so the card is
    a third wider than the machine — not the four fifths wider it was drawn at
    first, which is what made it read as a card resting *behind* a reader
    rather than going into one.

    The reader is a third over what its own file holds at 3x. These are
    product photographs with soft shading and no fine detail, so it survives
    that; the card, being smaller, comes out under 1:1 and is dead sharp.
  */
  reader: { width: 118, height: 173 },
  card: { width: 155, height: 97 },
  /**
   * Where the slot's mouth is, measured down from the top of the reader's
   * picture — the strip that stands proud of the case, at 14 of the file's
   * 393 rows.
   */
  mouth: 6,
  /*
    How far the card travels, and where it waits.

    A card seats about 37mm of its 54 and leaves the rest proud, which is a
    little over two thirds. It waits a few points clear of the mouth so the
    gap reads as "not yet in" rather than as a bad join.
  */
  travel: 66,
  lift: 178,
} as const;

export function CardReaderSim({ state }: { state: ReaderState }) {
  /** 0 waiting above the slot, 1 seated inside. */
  const seat = useSharedValue(0);
  /** The nudge that says "push it down", while nothing has happened yet. */
  const hint = useSharedValue(0);

  useEffect(() => {
    if (state === "ready") {
      seat.value = withTiming(0, { duration: 260 });
      /*
        A small rise and fall, forever, while the machine waits. It is the
        card that moves rather than the reader, because the card is the thing
        the carer has in their hand and has to do something with.
      */
      hint.value = withRepeat(
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
      return;
    }

    hint.value = withTiming(0, { duration: 200 });

    if (state === "reading") {
      /*
        Pushed home, then a little back.

        A card driven to its stop and left there reads as a cursor arriving;
        a real one seats with a knock and settles a hair. The overshoot is
        three per cent over 90 milliseconds — under a blink, and the whole
        difference between an object and a value being set.
      */
      seat.value = withSequence(
        withTiming(1.03, { duration: 430, easing: Easing.in(Easing.cubic) }),
        withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }),
      );
      return;
    }

    seat.value = withTiming(0, { duration: 260 });
  }, [state, seat, hint]);

  const card = useAnimatedStyle(() => ({
    transform: [
      { translateY: seat.value * SIM.travel - hint.value * 7 },
      // Leaning in while it is still out, standing straight once it is home:
      // the travel then reads as a push rather than a slide down a rail.
      { rotateZ: `${(1 - seat.value) * -1.6}deg` },
    ],
  }));

  return (
    <View
      style={{
        width: SIM.card.width,
        height: SIM.lift + SIM.card.height,
        alignItems: "center",
        justifyContent: "flex-end",
      }}
    >
      {/* Under the reader, so the slot swallows it. */}
      <Reanimated.View
        style={[
          {
            position: "absolute",
            bottom: SIM.lift,
            boxShadow: shadow({
              blur: 12,
              y: 8,
              color: "#0B2C47",
              opacity: 0.2,
            }),
          },
          card,
        ]}
      >
        <Image
          source={require("../../assets/images/id_card.png")}
          style={{ width: SIM.card.width, height: SIM.card.height }}
          resizeMode="contain"
          accessibilityRole="none"
        />
      </Reanimated.View>

      <Image
        source={require("../../assets/images/reader_front.png")}
        style={{ width: SIM.reader.width, height: SIM.reader.height }}
        resizeMode="contain"
        accessibilityRole="none"
      />
    </View>
  );
}
