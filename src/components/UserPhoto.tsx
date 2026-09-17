import { Image, View } from "react-native";

import { useSession } from "../models/session";

/** The portrait the app ships with, until a carer chooses their own. */
const STAND_IN = require("../../assets/images/user_avatar.png");

/**
 * The signed-in carer's own face, in a ring.
 *
 * One component rather than the three copies this had become — the home
 * greeting, the account card and the profile page were each building their
 * own ring and clip, and only one of them would have picked up a portrait
 * the carer had changed.
 *
 * Two boxes, and the reason is the ring: a border and `overflow: hidden` on
 * the same box put the photograph over its own stroke, because the image
 * fills to the outer edge and the border is drawn beneath it. The clip has
 * to live one layer in, which also leaves the gap between ring and face
 * that makes it read as a rim rather than as a outline drawn on the photo.
 */
export function UserPhoto({
  size,
  ring = "rgba(255,255,255,0.9)",
}: {
  size: number;
  /** The rim's colour — white on a wash, blue on the canvas. */
  ring?: string;
}) {
  const me = useSession();
  const inner = size - 10;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: ring,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View style={{ width: inner, height: inner, borderRadius: inner / 2, overflow: "hidden" }}>
        <Image
          source={me.photo != null ? { uri: me.photo } : STAND_IN}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
          accessibilityRole="image"
          accessibilityLabel="รูปโปรไฟล์"
        />
      </View>
    </View>
  );
}
