/**
 * What stands between this app and Android.
 *
 * It was built for one phone and it shows — six native modules written in
 * Swift, a material that only exists on iOS 26, and a handful of React
 * Native APIs that are quietly iOS-only. None of that is a reason it
 * cannot run on Android; all of it is work, and this is the list of it.
 *
 * Run before and after a port: what it prints is the distance left.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const src = join(root, "src");

const files = [];
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name)) files.push(p);
  }
};
walk(src);
const read = (f) => readFileSync(f, "utf8");
const rel = (f) => f.slice(root.length);

/* ---- 1. local native modules with no Android side ---------------------- */
const modules = existsSync(join(root, "modules"))
  ? readdirSync(join(root, "modules"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => {
        const entry = join(root, "modules", e.name, "index.ts");
        const js = existsSync(entry) ? readFileSync(entry, "utf8") : "";
        /*
          Having no Android side is not the same as breaking on Android.

          Five of these already hand back null where the native half is
          missing — `requireOptionalNativeModule`, or a require in a
          try/catch — and every caller checks. What matters is not whether
          Swift exists but whether the JavaScript survives its absence.
        */
        return {
          name: e.name,
          android: existsSync(join(root, "modules", e.name, "android")),
          degrades:
            /requireOptionalNativeModule/.test(js) ||
            /try\s*\{[\s\S]{0,200}?require(Native|Optional)/.test(js),
        };
      })
  : [];

const usedBy = (name) =>
  files.filter((f) => read(f).includes(`modules/${name}`)).map(rel);

/* ---- 2. React Native APIs that only exist on iOS ------------------------ */
const IOS_ONLY = [
  ["Alert.prompt", "ไม่มีบน Android — ต้องใช้ Modal หรือฟิลด์ของตัวเอง"],
  ["InputAccessoryView", "iOS เท่านั้น"],
  ["ActionSheetIOS", "iOS เท่านั้น"],
  ["settings.get", "Settings เป็น iOS เท่านั้น"],
  ["shadowOpacity", "Android ใช้ elevation — เงาจะหายไปเฉย ๆ"],
];
const apiHits = [];
for (const f of files) {
  const lines = read(f).split("\n");
  lines.forEach((line, i) => {
      for (const [api, why] of IOS_ONLY) {
        if (!line.includes(api)) continue;
        /*
          A shadow is only a fault where nothing lifts the view instead.

          This reported every `shadowOpacity` in the app, including the
          ones that already carry an `elevation` a few lines down — which
          is the fix, not the fault. What it looks at now is the block the
          shadow is written in.
        */
        const near = lines.slice(Math.max(0, i - 6), i + 9).join("\n");
        const guarded =
          /Platform\.OS|\?\.|cardShadow/.test(line) ||
          (api === "shadowOpacity" && /elevation/.test(near));
        if (!guarded) apiHits.push({ at: `${rel(f)}:${i + 1}`, api, why });
      }
  });
}

/* ---- 3. the material, and whether anything falls back ------------------- */
const glass = read(join(src, "components/Glass.tsx"));
const glassHonest =
  /LIQUID_GLASS|Platform\.OS/.test(glass) &&
  !/export function hasGlass\(\): boolean \{\s*return true;/.test(glass);

/* ---- 4. what the manifest says ------------------------------------------ */
const app = JSON.parse(read(join(root, "app.json"))).expo;
const androidCfg = app.android ?? {};

console.log("โมดูล native ในโปรเจกต์");
for (const m of modules) {
  const users = usedBy(m.name);
  const ok = m.android || m.degrades;
  console.log(
    `  ${ok ? "✓" : "✗"} ${m.name.padEnd(20)} ${
      m.android
        ? "มีฝั่ง Android"
        : m.degrades
          ? `ไม่มีฝั่ง Android แต่คืนค่าว่างได้ · ใช้อยู่ ${users.length} ไฟล์`
          : `ไม่มีฝั่ง Android และจะพังเมื่อไม่มี · ใช้อยู่ ${users.length} ไฟล์`
    }`,
  );
  if (!ok) for (const u of users) console.log(`      ${u}`);
}

console.log("\nAPI ที่มีเฉพาะ iOS และไม่ได้กันไว้");
if (apiHits.length === 0) console.log("  ไม่พบ");
for (const h of apiHits.slice(0, 12)) {
  console.log(`  ✗ ${h.at} — ${h.api}: ${h.why}`);
}
if (apiHits.length > 12) console.log(`  … อีก ${apiHits.length - 12} จุด`);

console.log("\nวัสดุกระจก");
console.log(
  glassHonest
    ? "  ✓ Glass เลือกทางสำรองเมื่อไม่มี Liquid Glass"
    : "  ✗ Glass วาดวัสดุเสมอ และ hasGlass() คืนค่า true ตายตัว — บน Android ทุกพื้นผิวกระจกจะไม่มีพื้นหลังเลย",
);

console.log("\nการตั้งค่าแอปฝั่ง Android");
console.log(
  existsSync(join(root, "android"))
    ? "  ✓ มีโฟลเดอร์ android/"
    : "  ✗ ยังไม่เคย prebuild ฝั่ง Android",
);
console.log(
  androidCfg.package == null
    ? "  ✗ app.json ยังไม่ได้ตั้ง android.package"
    : `  ✓ package ${androidCfg.package}`,
);
console.log(
  androidCfg.permissions == null
    ? "  · ไม่ได้ระบุ permissions (ปลั๊กอินจะเติมให้เอง)"
    : `  ✓ permissions ${androidCfg.permissions.length} รายการ`,
);

const blocking =
  modules.filter((m) => !m.android && !m.degrades).length +
  (glassHonest ? 0 : 1);
console.log(
  blocking === 0
    ? "\nไม่มีอะไรขวางการรันบน Android แล้ว"
    : `\n${blocking} เรื่องที่ต้องแก้ก่อนแอปจะเปิดบน Android ได้`,
);
