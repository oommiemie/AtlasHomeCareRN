/**
 * The map, and what stands where there is no map.
 *
 * Every screen with a map goes through here rather than importing
 * react-native-maps directly, because on Android the library needs a
 * Google Maps key and, without one, does not degrade — it throws out of
 * `MapView`'s constructor and takes the screen down with it:
 *
 *   API key not found. Check that <meta-data
 *   android:name="com.google.android.geo.API_KEY" …/> is in the
 *   <application> element of AndroidManifest.xml
 *
 * iOS has no such requirement; MapKit is the system's and is simply there.
 * So a build that runs perfectly on the phone loses the household map, the
 * round, the task card and the home page's own preview the moment it is
 * opened on Android, and a carer sees a red screen rather than a map.
 *
 * To turn the real map on, put the key in app.json under
 * `expo.android.config.googleMaps.apiKey` and prebuild again. The key is
 * read from there rather than from the manifest because JavaScript cannot
 * see the manifest; the same config field is what writes it, so the two
 * cannot drift apart.
 */
import { forwardRef, useImperativeHandle, useState } from "react";
import { Platform, Text, View } from "react-native";
import Constants from "expo-constants";
import RNMapView from "react-native-maps";

import { MapPinOff } from "lucide-react-native";

import { GROUPED_BG, SPACE, TEXT_DISABLED, TEXT_MUTED } from "../theme/tokens";

export { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";

/**
 * Whether this build can draw a map at all.
 *
 * True everywhere but an Android build with no key. Exported so a screen
 * whose whole point is the map can say so in its own words — the stand-in
 * below is what a map-shaped hole becomes when nobody does.
 */
export const hasMap: boolean =
  Platform.OS !== "android" ||
  typeof Constants.expoConfig?.android?.config?.googleMaps?.apiKey === "string";

/**
 * How tall the hole has to be before it explains itself.
 *
 * A map is two different things in this app. On the round and the house it
 * is the screen, and a carer looking at an empty rectangle deserves to be
 * told why. On the home page it is a hundred points of street behind a
 * label — decoration — and a notice there lands across the card's own
 * words to announce the absence of something nobody was reading.
 */
const SAYS_SO_ABOVE = 140;

/**
 * A map-shaped hole that says what it is.
 *
 * It answers to the same handle the real one does. Two screens call
 * `map.current.fitToCoordinates(…)` without a guard — correctly, because a
 * ref to a mounted view is not null — and a stand-in that left those
 * undefined would trade a red screen at mount for a red screen on the
 * first route drawn.
 *
 * Children are dropped. They are `Marker`s and `Polyline`s, which have
 * nothing to sit on and, under the New Architecture, are exactly what
 * `AIRMap` is unhappy to be handed when there is no map.
 */
const MapStandIn = forwardRef<RNMapView, { style?: unknown }>(
  function MapStandIn({ style }, ref) {
    const [tall, setTall] = useState(false);

    useImperativeHandle(
      ref,
      () =>
        ({
          fitToCoordinates: () => {},
          fitToElements: () => {},
          fitToSuppliedMarkers: () => {},
          animateToRegion: () => {},
          animateCamera: () => {},
          setCamera: () => {},
          getCamera: () => Promise.resolve(undefined),
          getMapBoundaries: () => Promise.resolve(undefined),
        }) as unknown as RNMapView,
      [],
    );

    return (
      <View
        onLayout={(e) => setTall(e.nativeEvent.layout.height >= SAYS_SO_ABOVE)}
        style={[
          {
            backgroundColor: GROUPED_BG,
            alignItems: "center",
            justifyContent: "center",
            gap: SPACE.sm,
            padding: SPACE.lg,
          },
          style as never,
        ]}
      >
        {tall && (
          <>
            <MapPinOff size={22} color={TEXT_DISABLED} strokeWidth={1.8} />
            <Text
              style={{
                fontSize: 13,
                lineHeight: 21,
                textAlign: "center",
                color: TEXT_MUTED,
              }}
            >
              แผนที่ยังไม่พร้อมใช้งานบนเครื่องนี้
            </Text>
          </>
        )}
      </View>
    );
  },
);

/**
 * `MapView`, whichever one this build has.
 *
 * A named export rather than a default one so that the name carries both
 * its meanings: screens hold the map in a `useRef<MapView>`, and a default
 * import would bring across the value and leave the type behind.
 */
export const MapView = (hasMap ? RNMapView : MapStandIn) as typeof RNMapView;
export type MapView = RNMapView;
