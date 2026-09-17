/**
 * Does any Thai in this app get its ink clipped?
 *
 * Not a style-guide check — a measurement. It reads Sarabun's own metrics
 * out of the .ttf, works out how much ink the Thai characters the app
 * actually uses need, then walks every text style in `src` and asks whether
 * the line it will be set on has room for them. It does that at each of the
 * five text sizes the display page offers, because the size a carer chooses
 * multiplies the line as well as the letters.
 *
 *     node scripts/check-thai-lines.mjs
 *
 * Exits non-zero when anything would clip, so it can be a gate.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const FONT =
  "node_modules/@expo-google-fonts/sarabun/400Regular/Sarabun_400Regular.ttf";

/* ---------- the font, read straight out of the file ---------- */

function openFont(path) {
  const d = readFileSync(path);
  const tables = {};
  const count = d.readUInt16BE(4);
  for (let i = 0; i < count; i++) {
    const o = 12 + i * 16;
    tables[d.toString("latin1", o, o + 4)] = d.subarray(
      d.readUInt32BE(o + 8),
      d.readUInt32BE(o + 8) + d.readUInt32BE(o + 12),
    );
  }
  const head = tables.head;
  const upem = head.readUInt16BE(18);
  const longLoca = head.readInt16BE(50) === 1;
  const glyphs = tables.maxp.readUInt16BE(4);
  const loca = [];
  for (let i = 0; i <= glyphs; i++) {
    loca.push(longLoca ? tables.loca.readUInt32BE(i * 4) : tables.loca.readUInt16BE(i * 2) * 2);
  }

  // cmap format 4 — the Unicode BMP table every desktop font carries.
  const cmap = tables.cmap;
  let sub = null;
  for (let i = 0; i < cmap.readUInt16BE(2); i++) {
    const p = cmap.readUInt16BE(4 + i * 8);
    const e = cmap.readUInt16BE(6 + i * 8);
    if ((p === 3 && e === 1) || (p === 0 && e <= 4)) {
      sub = cmap.subarray(cmap.readUInt32BE(8 + i * 8));
    }
  }
  const segX2 = sub.readUInt16BE(6);
  const segs = segX2 / 2;
  const endAt = (i) => sub.readUInt16BE(14 + i * 2);
  const startAt = (i) => sub.readUInt16BE(16 + segX2 + i * 2);
  const deltaAt = (i) => sub.readInt16BE(16 + segX2 * 2 + i * 2);
  const rangeBase = 16 + segX2 * 3;
  const rangeAt = (i) => sub.readUInt16BE(rangeBase + i * 2);

  const gidOf = (code) => {
    for (let i = 0; i < segs; i++) {
      if (code < startAt(i) || code > endAt(i)) continue;
      if (rangeAt(i) === 0) return (code + deltaAt(i)) & 0xffff;
      const at = rangeBase + i * 2 + rangeAt(i) + (code - startAt(i)) * 2;
      const g = sub.readUInt16BE(at);
      return g === 0 ? 0 : (g + deltaAt(i)) & 0xffff;
    }
    return 0;
  };

  const inkOf = (ch) => {
    const g = gidOf(ch.codePointAt(0));
    if (g === 0 || loca[g] === loca[g + 1]) return null;
    const at = loca[g];
    return {
      bottom: tables.glyf.readInt16BE(at + 4) / upem,
      top: tables.glyf.readInt16BE(at + 8) / upem,
    };
  };

  const os2 = tables["OS/2"];
  return {
    ascent: os2.readInt16BE(68) / upem,
    descent: -os2.readInt16BE(70) / upem,
    inkOf,
  };
}

/* ---------- the app ---------- */

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const files = walk("src");
const source = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));

/** Every Thai character the app's own strings contain. */
const used = new Set();
for (const text of source.values()) {
  for (const m of text.matchAll(/"([^"\\]*)"|`([^`]*)`/g)) {
    for (const ch of (m[1] ?? "") + (m[2] ?? "")) {
      if (ch >= "\u0E00" && ch <= "\u0E7F") used.add(ch);
    }
  }
}

/** The rule under test, read from the app rather than restated here. */
const patch = readFileSync("src/theme/thaiFont.ts", "utf8");
const THAI_LINE = Number(/const THAI_LINE = ([\d.]+);/.exec(patch)[1]);
const SCALES = [...readFileSync("src/models/display.ts", "utf8").matchAll(/scale: ([\d.]+)/g)].map(
  (m) => Number(m[1]),
);

/* ---------- the measurement ---------- */

const font = openFont(FONT);
let top = -Infinity;
let bottom = Infinity;
let tallest = "";
let deepest = "";
for (const ch of used) {
  const ink = font.inkOf(ch);
  if (ink == null) continue;
  if (ink.top > top) [top, tallest] = [ink.top, ch];
  if (ink.bottom < bottom) [bottom, deepest] = [ink.bottom, ch];
}
const natural = font.ascent + font.descent;

/** Whether a line of `line` points has room for `size`-point Thai. */
const clips = (size, line) => {
  const spare = (line / size - natural) / 2;
  return font.ascent + spare < top || font.descent + spare < -bottom;
};

console.log(`Sarabun: line ${natural.toFixed(3)} em (ascent ${font.ascent.toFixed(3)},`
  + ` descent ${font.descent.toFixed(3)})`);
console.log(`Thai used by the app: ${used.size} characters,`
  + ` ink ${bottom.toFixed(3)}..${top.toFixed(3)} em (${(top - bottom).toFixed(3)} em of it)`);
console.log(`Rule under test: lineHeight >= ceil(fontSize x ${THAI_LINE}) on any text with Thai in it`);
console.log(`Text sizes: ${SCALES.join(", ")}\n`);

/* ---------- every text style in the app, at every text size ---------- */

let checked = 0;
const bad = [];
for (const [file, text] of source) {
  for (const m of text.matchAll(/\{[^{}]*\bfontSize:\s*(\d+)[^{}]*\}/gs)) {
    const declared = Number(m[1]);
    const lh = /\blineHeight:\s*(\d+)/.exec(m[0]);
    const line = m.index === undefined ? 0 : text.slice(0, m.index).split("\n").length;
    for (const scale of SCALES) {
      const size = Math.round(declared * scale);
      // What the patch will actually hand to iOS.
      const asked = lh ? Math.round(Number(lh[1]) * scale) : null;
      const floor = Math.ceil(size * THAI_LINE);
      const final = asked == null || asked < floor ? floor : asked;
      checked++;
      if (clips(size, final)) {
        bad.push(`${file}:${line}  fontSize ${declared} at x${scale} -> ${size}/${final}`);
      }
    }
  }
}

console.log(`${checked} style/size combinations checked.`);
if (bad.length === 0) {
  console.log("No Thai is clipped anywhere in the app.");
  process.exit(0);
}
console.log(`\n${bad.length} would still clip:\n`);
for (const b of bad.slice(0, 40)) console.log("  " + b);
process.exit(1);
