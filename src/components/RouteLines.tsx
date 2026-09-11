import { Image, View } from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient as Fade } from "expo-linear-gradient";

/**
 * An isometric city behind the address card.
 *
 * A rendered model rather than drawn geometry: the earlier SVG built its
 * blocks from a projected grid, which held the projection exactly but could
 * only ever look like flat shapes on a card. This has real light on it, so
 * it reads as a physical thing the card is sitting on.
 *
 * It fades out to the left, where the address sits, and is held well back in
 * opacity — the plate is scenery behind the map button, and text over a busy
 * photograph is what would make the address hard to read.
 */
export function RouteLines() {
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
    >
      <MaskedView
        style={{ flex: 1 }}
        maskElement={
          <Fade
            colors={[
              "transparent",
              "rgba(0,0,0,0.12)",
              "rgba(0,0,0,0.55)",
              "rgba(0,0,0,1)",
            ]}
            locations={[0, 0.38, 0.68, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        }
      >
        <Image
          source={require("../../assets/images/address_city.png")}
          resizeMode="cover"
          style={{ width: "100%", height: "100%", opacity: 0.5 }}
        />
      </MaskedView>
    </View>
  );
}
