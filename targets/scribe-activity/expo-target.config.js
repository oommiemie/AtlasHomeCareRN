/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  // A widget target is where a Live Activity lives: the Dynamic Island and
  // the lock-screen banner are drawn by this extension, not by the app.
  type: "widget",
  name: "ScribeActivity",
  displayName: "ผู้ช่วยบันทึกการเยี่ยม",
  // The island itself is 16.1+; the app can stay lower and simply not offer
  // the activity on older phones.
  deploymentTarget: "16.2",
  bundleIdentifier: ".scribe-activity",
  colors: {
    $accent: "#077DD7",
    $widgetBackground: "#0B1220",
  },
};
