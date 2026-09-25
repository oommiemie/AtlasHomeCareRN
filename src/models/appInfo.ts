import app from "../../app.json";
import pkg from "../../package.json";

/**
 * What the app is, read from the files that define it.
 *
 * The account page carried the version as the string "1.0.0", typed into a
 * settings row. A number written down in a second place is a number that
 * will be wrong: the release it names is set in app.json, nobody editing
 * app.json would think to look in a list of menu items, and a carer
 * reporting a fault would then quote a version the build is not.
 *
 * The library versions come along because the page they are shown on sits
 * next to "รายงานปัญหา" — the first thing anybody triaging a fault asks is
 * what it was running on, and a carer cannot be expected to know.
 */
export const APP = {
  name: app.expo.name,
  version: app.expo.version,
  bundleId: app.expo.ios.bundleIdentifier,
  expo: pkg.dependencies.expo.replace(/^[~^]/, ""),
  reactNative: pkg.dependencies["react-native"].replace(/^[~^]/, ""),
} as const;
