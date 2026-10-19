// The web build's stand-in for @bottom-tabs/react-navigation: the same tab
// navigator, drawn in JavaScript, with the bar the page hands it — on the web
// as on Android, the app's own `IosTabBar`.
import { View } from "react-native";
import {
  createNavigatorFactory,
  TabRouter,
  useNavigationBuilder,
} from "@react-navigation/native";

function WebTabNavigator({
  id,
  initialRouteName,
  backBehavior,
  children,
  screenOptions,
  screenLayout,
  tabBar,
}) {
  const { state, descriptors, navigation, NavigationContent } =
    useNavigationBuilder(TabRouter, {
      id,
      initialRouteName,
      backBehavior,
      children,
      screenOptions,
      screenLayout,
    });
  return (
    <NavigationContent>
      <View style={{ flex: 1 }}>
        {state.routes.map((route, i) => (
          <View
            key={route.key}
            style={[{ flex: 1 }, i !== state.index && { display: "none" }]}
          >
            {descriptors[route.key].render()}
          </View>
        ))}
      </View>
      {tabBar != null ? tabBar({ state, descriptors, navigation }) : null}
    </NavigationContent>
  );
}

export const createNativeBottomTabNavigator =
  createNavigatorFactory(WebTabNavigator);
