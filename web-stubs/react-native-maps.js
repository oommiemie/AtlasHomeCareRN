// The web build's stand-in for react-native-maps, which is native only.
// The app's own Map component already draws a stand-in where there is no
// map; this only has to give it something to import.
import { forwardRef } from "react";
import { View } from "react-native";

const MapView = forwardRef(function MapView(props, _ref) {
  return <View style={props.style} />;
});
export default MapView;
export const Marker = () => null;
export const Polyline = () => null;
export const Callout = () => null;
export const Circle = () => null;
export const PROVIDER_DEFAULT = undefined;
export const PROVIDER_GOOGLE = "google";
