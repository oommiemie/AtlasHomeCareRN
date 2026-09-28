const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("@expo/config-plugins");

/**
 * The Android blur, without the grain laid over it.
 *
 * expo-blur blurs on Android through Dimezis' BlurView, and BlurView tiles a
 * "blue noise" texture over every blurred surface by default — a film grain
 * meant to hide banding in the gradient. On a frosted panel over the home
 * screen's sky it read as speckle: dirt on the glass, where iOS's material
 * is clear. The library can switch it off (`setupWith(…, applyNoise)`), but
 * expo-blur calls the overload that leaves it on and offers no prop for it.
 *
 * So the texture itself is replaced. Android lets an app's resource shadow a
 * library's of the same name, and the noise is drawn from
 * `R.drawable.blue_noise` as an alpha mask; an app-level `blue_noise` that is
 * a single fully transparent pixel makes that mask nothing, and the noise
 * pass draws nothing. No package is patched, and it survives a clean
 * prebuild, which rewrites `android/` from the config every time.
 */

// A 1×1 PNG, every channel 0.
const CLEAR_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABpfZFQAAAAABJRU5ErkJggg==",
  "base64",
);

module.exports = function withClearAndroidBlur(config) {
  return withDangerousMod(config, [
    "android",
    (cfg) => {
      const dir = path.join(
        cfg.modRequest.platformProjectRoot,
        "app/src/main/res/drawable-nodpi",
      );
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "blue_noise.png"), CLEAR_PIXEL);
      return cfg;
    },
  ]);
};
