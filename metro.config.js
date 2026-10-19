// Expo's default Metro config, stated explicitly.
//
// Without this file the defaults still apply, but platform-specific
// resolution (`GlassView.ios.js` over `GlassView.js`) is what decides whether
// expo-glass-effect renders Apple's real material or a bare stand-in view —
// so the config it depends on is worth having in the repo rather than
// implied.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

/*
  `three` ships two builds and points `require` at the CommonJS one, which
  opens with `process.emitWarning(...)` — a Node function Hermes does not
  have, so the app died before the first frame. Metro resolves the package
  under the `require` condition, so it has to be steered by hand to the ES
  module build. Every import of "three" — ours and the ones inside
  three/examples/jsm — must land on the same file, or the scene ends up with
  two copies of the library that do not recognise each other's classes.
*/
/*
  The web build (GitHub Pages) has no native modules: each of these is
  swapped for a stand-in in web-stubs/ when bundling for the web, and only
  then. The phone and tablet builds are untouched.
*/
const WEB_STUBS = {
  "react-native-maps": "web-stubs/react-native-maps.js",
  "react-native-bottom-tabs": "web-stubs/react-native-bottom-tabs.js",
  "@bottom-tabs/react-navigation": "web-stubs/bottom-tabs-react-navigation.js",
  "@react-native-masked-view/masked-view": "web-stubs/masked-view.js",
};

const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && WEB_STUBS[moduleName] != null) {
    return {
      type: "sourceFile",
      filePath: require("path").join(__dirname, WEB_STUBS[moduleName]),
    };
  }
  if (moduleName === "three") {
    return context.resolveRequest(context, "three/build/three.module.js", platform);
  }
  return upstream
    ? upstream(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
