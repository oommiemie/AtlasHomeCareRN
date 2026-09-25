/**
 * The things that make this app stutter, looked for by name.
 *
 * Not a profiler — it cannot say what the frame rate is. What it can do is
 * find the patterns this codebase has already been bitten by and written
 * notes about, so a new one does not go in unnoticed:
 *
 *  - an animation driven off the UI thread, which crosses to JavaScript
 *    every frame;
 *  - an alpha or a transform over Apple's glass, which stops the material
 *    rendering at all;
 *  - a long list in a ScrollView, which builds every row before the first
 *    one is seen;
 *  - a `.map` in JSX with no key, which re-creates rows on every render;
 *  - logging left in a hot path.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const files = [];
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name)) files.push(p);
  }
};
walk(join(root, "src"));

const found = { jank: [], glass: [], list: [], key: [], noise: [] };
const at = (f, i) => `${f.slice(root.length)}:${i + 1}`;

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");

  lines.forEach((line, i) => {
    /*
      An animation that has to cross to JavaScript every frame.

      Layout props — height, top, width — have no choice: the native driver
      cannot animate them, and this app uses them deliberately where glass
      is involved. A transform or an opacity is the other case, and there
      it is a mistake.
    */
    if (/useNativeDriver:\s*false/.test(line)) {
      const near = lines.slice(Math.max(0, i - 24), i + 4).join("\n");
      const moves = /transform:|translateX|translateY|scale:|opacity:/.test(near);
      const layout = /height:|width:|top:|bottom:|left:|right:|strokeDashoffset/.test(near);
      if (moves && !layout) found.jank.push(at(file, i));
    }

    /*
      Logging that is not somebody's instrument.

      Three of the four this used to report were a perf harness the app
      keeps on purpose — `utils/perf` and two `<Profiler>`s — which is a
      tool rather than litter. What matters is that none of it costs
      anything on a phone in the field, so what is looked for now is a
      report with no `__DEV__` guard above it.
    */
    if (/console\.(log|warn)\(/.test(line) && !/eslint|\/\//.test(line)) {
      const guarded = /__DEV__/.test(
        lines.slice(Math.max(0, i - 4), i + 1).join("\n"),
      );
      if (!guarded) found.noise.push(at(file, i));
    }

    // A row built in a loop with nothing to identify it by.
    if (/\.map\(\s*\(/.test(line) && /</.test(lines[i + 1] ?? "")) {
      const body = lines.slice(i, i + 6).join("\n");
      if (/<[A-Z]/.test(body) && !/key=/.test(body)) found.key.push(at(file, i));
    }
  });

  /*
    Glass under something that fades or moves.

    UIVisualEffectView refuses to draw its material under an alpha below 1
    or a transform on any ancestor — so this is not a slow screen, it is a
    blank one. Reported where an Animated.View carrying either wraps a
    <Glass> in the same file.
  */
  if (/<Glass\b/.test(src)) {
    const animated = /<Animated\.View[\s\S]{0,400}?<Glass\b/.test(src);
    const fades = /<Animated\.View[\s\S]{0,400}?(opacity|transform)[\s\S]{0,400}?<Glass\b/.test(src);
    if (animated && fades) found.glass.push(file.slice(root.length));
  }

  /*
    A list long enough to be worth windowing, in a ScrollView.

    Only where the source is a whole collection rather than a handful of
    sections — a page of six cards in a ScrollView is right, and a roster
    of fifty rows is not.
  */
  if (/<ScrollView/.test(src) && !/FlatList|FlashList/.test(src)) {
    for (const m of src.matchAll(/(\w+)\.map\(/g)) {
      if (/(rows|people|residents|roster|targets|history|everyone|list)$/i.test(m[1])) {
        found.list.push(`${file.slice(root.length)} — ${m[1]}.map in a ScrollView`);
        break;
      }
    }
  }
}

const say = (title, rows, note) => {
  console.log(`\n${title}: ${rows.length}`);
  if (note != null && rows.length > 0) console.log(`  ${note}`);
  for (const r of [...new Set(rows)].slice(0, 12)) console.log("   ·", r);
  if (rows.length > 12) console.log(`   … and ${rows.length - 12} more`);
};

console.log(`scanned ${files.length} files`);
say("animations off the UI thread", found.jank, "a transform or an alpha that has to cross to JS every frame");
say("glass under a fade or a move", found.glass, "the material will not draw at all — not slow, blank");
say("whole collections inside a ScrollView", found.list, "every row is built before the first is seen");
say("rows built with no key", found.key);
say("logging with no __DEV__ guard", found.noise);

const total = found.jank.length + found.glass.length + found.list.length + found.key.length;
console.log(
  total === 0
    ? "\nNothing found that this app has been bitten by before."
    : `\n${total} thing(s) worth a look.`,
);
