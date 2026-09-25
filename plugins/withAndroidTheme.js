const {
  AndroidConfig,
  withAndroidColors,
  withAndroidStyles,
} = require("@expo/config-plugins");

/**
 * The app's own colours in Android's theme, so the system's own dialogs
 * are this app's rather than Material's.
 *
 * A native picker takes its colours from the activity theme, not from
 * anything JavaScript can pass it. Untouched, `Theme.Material3.DayNight`
 * carries Material's baseline palette, and the date picker came up with a
 * purple banner and a purple selected day in an app that is blue —
 * the one screen in the whole build that looked like somebody else's.
 *
 * Written as a config plugin rather than by hand in `android/`, because
 * `android/` is generated: every `expo prebuild` rewrites styles.xml and
 * colors.xml from the config, and an edit made in the folder is an edit
 * that lasts until the next person runs it.
 *
 * The names are prefixed so they cannot collide with the ones prebuild
 * writes for the icon and the splash.
 */

/**
 * Theme items that are not colours.
 *
 * `android:editTextBackground` is the one that matters. React Native points
 * it at its own copy of Material's text-field background, which is
 * transparent when idle and a one-pixel underline when focused — and which
 * carries its own insets, so the text inside sits a few points in from the
 * left of where the same field puts it on iOS. Every field in this app is
 * already drawn: a capsule with its own height, its own padding and its own
 * focus ring. Material's line appeared underneath, inside the capsule,
 * along with the shift. Taken away, a field is what the app drew and
 * nothing else — which is what it is on the other platform.
 */
const ITEMS = {
  "android:editTextBackground": "@android:color/transparent",
};

/** M3 attribute -> the colour it should take. */
const THEME = {
  // The selected day, the header banner, the buttons.
  colorPrimary: "#077DD7",
  colorOnPrimary: "#FFFFFF",
  // What the M3 date picker paints its header from.
  colorSurfaceVariant: "#E6F4FE",
  colorOnSurfaceVariant: "#0B3C5D",
  // The pre-Material3 widgets that are still reached through AppCompat.
  colorAccent: "#077DD7",
};

const COLOR_NAME = {
  colorPrimary: "atlasPrimary",
  colorOnPrimary: "atlasOnPrimary",
  colorSurfaceVariant: "atlasSurfaceVariant",
  colorOnSurfaceVariant: "atlasOnSurfaceVariant",
  colorAccent: "atlasPrimary",
};

module.exports = function withAndroidTheme(config) {
  config = withAndroidColors(config, (cfg) => {
    for (const [attr, value] of Object.entries(THEME)) {
      cfg.modResults = AndroidConfig.Colors.assignColorValue(cfg.modResults, {
        name: COLOR_NAME[attr],
        value,
      });
    }
    return cfg;
  });

  config = withAndroidStyles(config, (cfg) => {
    for (const [name, value] of Object.entries(ITEMS)) {
      cfg.modResults = AndroidConfig.Styles.assignStylesValue(cfg.modResults, {
        add: true,
        name,
        value,
        parent: AndroidConfig.Styles.getAppThemeGroup(),
      });
    }
    for (const attr of Object.keys(THEME)) {
      cfg.modResults = AndroidConfig.Styles.assignStylesValue(cfg.modResults, {
        add: true,
        name: attr,
        value: `@color/${COLOR_NAME[attr]}`,
        parent: AndroidConfig.Styles.getAppThemeGroup(),
      });
    }
    return cfg;
  });

  return config;
};
