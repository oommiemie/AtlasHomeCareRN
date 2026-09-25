/**
 * Every way through the app, checked without opening it.
 *
 * The app is seventy screens reached by name: `nav.navigate("Foo", {...})`
 * with the name as a string. TypeScript catches a route that does not
 * exist, and catches nothing else — not a route with no screen behind it,
 * not a screen nothing reaches, and not a navigate that leaves out params
 * the screen reads on its first line. That last one took the app down when
 * the vaccination shortcut was pressed, and no check in the repository
 * would have found it.
 *
 * So: three lists, cross-referenced. What the param list declares, what
 * the navigator registers, and what the code actually calls.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const stack = readFileSync(join(root, "src/navigation/RootStack.tsx"), "utf8");

/** The routes the param list declares, and whether each needs params. */
const declared = new Map();
const block = stack.match(/export type RootStackParamList = \{([\s\S]*?)\n\};/);
for (const line of block[1].split("\n")) {
  const m = /^\s{2}([A-Za-z0-9_]+)\??:\s*(.+?);?\s*$/.exec(line);
  if (m == null) continue;
  const needs = !/undefined/.test(m[2]);
  declared.set(m[1], { needs, type: m[2].trim() });
}

/** The routes the navigator actually mounts. */
const mounted = new Set(
  [...stack.matchAll(/<Stack\.Screen\s+name="([^"]+)"/g)].map((m) => m[1]),
);

/** Every navigate/replace/push in the app, with whether params were given. */
const calls = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(path);
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    const src = readFileSync(path, "utf8");
    src.split("\n").forEach((line, i) => {
      /*
        Only a navigator's own calls.

        Matching any `.replace("…")` swept up every string substitution in
        the app — the notebook's own text handling among them — and
        reported them as navigations to routes that do not exist.
      */
      for (const m of line.matchAll(
        /\b(?:nav|navigation)\.(?:navigate|replace|push)\(\s*"([A-Za-z0-9_]+)"\s*(,)?/g,
      )) {
        calls.push({
          file: path.slice(root.length),
          line: i + 1,
          route: m[1],
          withParams: m[2] === ",",
        });
      }
      /*
        And the ones reached through a table rather than a call.

        The account page and the shortcut row both hold `route: "Foo"` in a
        list and navigate by looking it up — so the route is real and
        reachable while nothing in the source says `navigate("Foo")`.
        Without this they all read as orphans.
      */
      for (const m of line.matchAll(/\broute:\s*"([A-Za-z0-9_]+)"/g)) {
        // Only where the value names a real route. "route" is also how a
        // vaccine says subcutaneous, and a table of doses is not a map of
        // the app.
        if (!declared.has(m[1])) continue;
        // Reachability only. A table entry says the screen can be got to;
        // what it is given is settled where the table is read, which is
        // somewhere else entirely.
        calls.push({
          file: path.slice(root.length),
          line: i + 1,
          route: m[1],
          viaTable: true,
        });
      }
    });
  }
};
walk(join(root, "src"));

const fault = [];
const say = (what) => fault.push(what);

for (const [name, { needs, type }] of declared) {
  if (!mounted.has(name)) say(`route "${name}" is declared but never mounted`);
  else if (
    needs &&
    !calls.some((c) => c.route === name && (c.withParams || c.viaTable))
  ) {
    const reached = calls.some((c) => c.route === name);
    if (reached) say(`route "${name}" needs ${type} but every call omits params`);
  }
}
for (const name of mounted) {
  if (!declared.has(name)) say(`screen "${name}" is mounted but not declared`);
}
for (const c of calls) {
  if (!declared.has(c.route)) {
    say(`${c.file}:${c.line} navigates to "${c.route}", which does not exist`);
    continue;
  }
  if (c.viaTable === true) continue;
  if (declared.get(c.route).needs && !c.withParams) {
    say(
      `${c.file}:${c.line} navigates to "${c.route}" with no params, but it needs ${declared.get(c.route).type}`,
    );
  }
}

/** Screens nothing in the app navigates to — reachable only by tab or not at all. */
const TABS = new Set(["Main", "Home", "Plan", "Services", "Profile", "Login"]);
const orphans = [...declared.keys()].filter(
  (r) => !TABS.has(r) && !calls.some((c) => c.route === r),
);

console.log(`routes declared ${declared.size} · mounted ${mounted.size} · navigate calls ${calls.length}`);
console.log(`screens on disk ${readdirSync(join(root, "src/screens")).filter((f) => f.endsWith(".tsx")).length}`);
if (orphans.length > 0) {
  console.log(`\nnothing navigates to (${orphans.length}): ${orphans.join(", ")}`);
}
if (fault.length === 0) {
  console.log("\nEvery route is declared, mounted, and reached with what it needs.");
} else {
  console.log(`\n${fault.length} fault(s):`);
  for (const f of fault) console.log("  ✗", f);
  process.exitCode = 1;
}
