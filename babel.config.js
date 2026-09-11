// Expo's own preset, stated explicitly, plus one transform it does not turn on.
//
// three.js from 0.170 or so declares its core classes with static
// initialiser blocks (`class Vector2 { static { … } }`), and Metro's Babel
// pipeline stops at the first one with "Static class blocks are not enabled".
// The plugin is already on disk as a dependency of the preset; it only has to
// be asked for. Everything else — the worklets plugin Reanimated needs, the
// platform-specific resolution the glass material depends on — the preset
// still adds on its own.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: ["@babel/plugin-transform-class-static-block"],
  };
};
