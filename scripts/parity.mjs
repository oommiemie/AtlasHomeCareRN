/*
  Puts one screen's iOS layout next to its Android one, as numbers.

  Two screenshots side by side say that something is off; they do not say
  by how much, and at two different screen sizes the eye is a poor judge of
  it. Maestro can hand back the whole view tree with every element's box, so
  this asks both platforms for the same screen and compares what comes back:
  every piece of text, where it sits and how big it is, as a percentage of
  the screen rather than in pixels, so two devices of different sizes can be
  held to the same numbers.

  What it reports is text that is on one platform and not the other, and
  text that is on both but in a different place. What it cannot see is
  colour, shadow or shape — that is what the screenshots are for.

    node scripts/parity.mjs ios.json android.json
*/
import { readFileSync } from "node:fs";

/*
  What each device reports in, and what to divide by to get points.

  Maestro gives iOS boxes in points and Android boxes in pixels, so the
  Android numbers are brought back to density-independent ones first — the
  same unit the app is written in.
*/
const SIZE = {
  ios: { w: 402, scale: 1 },
  // The emulator is run at a density that puts it at the same 402 points
  // across as the iPhone (adb shell wm density 535), so that a fixed-size
  // thing — a floating bar, a card — takes the same share of both screens
  // and the two screenshots can be laid side by side without one of them
  // simply being a bigger phone.
  android: { w: 402, scale: 535 / 160 },
};

/*
  How far apart two boxes may sit before it is worth saying so.

  Across is a percentage of the width, because the two phones are different
  widths and the app's rows run edge to edge. Down is in points, because
  they are NOT different lengths in any way the layout cares about: a row
  200 points from the top is 200 points from the top on both, and measuring
  that as a percentage of a taller screen turns every row on the page into
  a mismatch that is only the screen being longer.
*/
const SLACK = { across: 4, down: 6, size: 2.5 };

/** Every node that carries words, with its box. */
function texts(node, out = []) {
  const a = node.attributes ?? {};
  const t = (a.text || a.accessibilityText || a.title || "").trim();
  const b = /\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/.exec(a.bounds ?? "");
  if (t && b) {
    const [, x1, y1, x2, y2] = b.map(Number);
    out.push({ t, x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
  }
  for (const c of node.children ?? []) texts(c, out);
  return out;
}

/*
  One box per piece of text: the smallest.

  Both trees wrap the words several times over — a pressable, a row, the
  label itself — and each wrapper repeats the text with its own larger box.
  The innermost is the one that is actually the size of the words, and it is
  the only one the two platforms describe the same way.
*/
function leaves(list) {
  const by = new Map();
  for (const n of list) {
    const held = by.get(n.t);
    if (held == null || n.w * n.h < held.w * held.h) by.set(n.t, n);
  }
  return by;
}

/** The status bar and the notification shade are the device's, not ours. */
const DEVICE = /^\d{1,2}:\d{2}$|signal|Wifi|Wi-?Fi|Battery|charging|SSID|notification|ไม่ได้ชาร์จ|ไม่มีสัญญาณ|Open debugger/i;

const [iosFile, andFile] = process.argv.slice(2);
const I = leaves(texts(JSON.parse(readFileSync(iosFile, "utf8"))));
const A = leaves(texts(JSON.parse(readFileSync(andFile, "utf8"))));

/*
  Across in points from the left, and also as a share of the width.

  Both are needed and neither alone is right: a row is inset by a fixed 16
  points on both phones, so its LEFT edge should be compared in points —
  but that same row then runs to the other margin, so its WIDTH is the
  screen's less 32 and differs between two phones of different widths. Held
  as a percentage, the width matches; held in points, the inset does.
*/
const box = (n, d) => ({
  x: n.x / d.scale,
  w: (n.w / d.scale / d.w) * 100,
  y: n.y / d.scale,
  h: n.h / d.scale,
});

const missing = [], extra = [], pairs = [];
for (const [t, n] of I) {
  if (DEVICE.test(t)) continue;
  const m = A.get(t);
  if (m == null) { missing.push(t); continue; }
  pairs.push({ t, a: box(n, SIZE.ios), b: box(m, SIZE.android) });
}

/*
  The whole page sits a little higher on one phone than the other, because
  the status bar it starts under is a different height — 59 points of
  Dynamic Island against 48 of Android's bar. That is each platform
  correctly respecting its own, and it moves EVERY row by the same amount.
  Reported once, and taken out of the rest, so the list below is the rows
  that are actually in the wrong place rather than all of them.
*/
const drops = pairs.map((p) => p.a.y - p.b.y).sort((x, y) => x - y);
const inset = drops.length ? drops[Math.floor(drops.length / 2)] : 0;

const moved = [];
for (const p of pairs) {
  const d = {
    x: Math.abs(p.a.x - p.b.x),
    y: Math.abs(p.a.y - p.b.y - inset),
    w: Math.abs(p.a.w - p.b.w),
    h: Math.abs(p.a.h - p.b.h),
  };
  if (d.x > SLACK.across || d.y > SLACK.down || d.w > SLACK.size || d.h > SLACK.size) {
    moved.push({ ...p, d });
  }
}
for (const t of A.keys()) if (!DEVICE.test(t) && !I.has(t)) extra.push(t);

const one = (n) =>
  `x${n.x.toFixed(0)}pt w${n.w.toFixed(1)}%  y${n.y.toFixed(0)}pt h${n.h.toFixed(0)}pt`;
console.log(`iOS ${I.size} · Android ${A.size}`);
console.log(`แถบสถานะต่างกัน ${inset.toFixed(0)}pt — หักออกจากแกนตั้งแล้ว\n`);
if (missing.length) console.log("ไม่มีบน Android:\n  " + missing.map((t) => JSON.stringify(t)).join("\n  ") + "\n");
if (extra.length) console.log("มีเฉพาะ Android:\n  " + extra.map((t) => JSON.stringify(t)).join("\n  ") + "\n");
if (moved.length) {
  console.log("วางไม่ตรงกัน (แกนนอน % ของความกว้าง · แกนตั้งเป็นพอยต์):");
  for (const m of moved.sort((p, q) => (q.d.x + q.d.y + q.d.w + q.d.h) - (p.d.x + p.d.y + p.d.w + p.d.h))) {
    console.log(`  ${JSON.stringify(m.t.slice(0, 40))}\n     ios  ${one(m.a)}\n     and  ${one(m.b)}`);
  }
} else if (!missing.length && !extra.length) {
  console.log("ทุกชิ้นตรงกัน");
}
