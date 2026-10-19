// The web build's stand-in for @react-native-masked-view/masked-view.
// react-native-web cannot mask one view by another, and drew the mask
// itself — a black gradient — over the content it was meant to shape.
// On the web the content is shown as it is, unmasked.
import { View } from "react-native";

export default function MaskedView({ maskElement: _mask, children, ...rest }) {
  return <View {...rest}>{children}</View>;
}
