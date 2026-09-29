/**
 * What a page is made of, and everything done to it — with no phone in it.
 *
 * Split from `notes`, which holds the file. This half is arithmetic over
 * strings: where a highlight goes when a character is typed in front of
 * it, which line the caret is on, how a model's reply becomes lines. It is
 * also the half where a carer's own words could be lost, so it is the half
 * that has to be checkable — and a module that imports the file system
 * cannot be run by `npx tsx`. The same split `growth` and `dspm` are kept
 * on, for the same reason.
 */

/**
 * How big one line of a page is set.
 *
 * Only the four sizes. Whether a line is a bullet or a box is carried by
 * the line itself — see `Part` — because those are marks a reader can see
 * and a size is not.
 */
export type LineKind = "title" | "heading" | "subheading" | "text";

/** The four sizes, in the order the size menu offers them. */
export const SIZES = ["title", "heading", "subheading", "text"] as const;

/* The sizes' names are words on screen, so they live in `notes`, beside
   the language module this file is kept free of. */

/** The marks a list line begins with, which are real characters in the text. */
export const BULLET = "• ";
export const BOX_OFF = "☐ ";
export const BOX_ON = "☑ ";

/**
 * A run of writing, or a picture.
 *
 * The whole run is ONE piece of text, newlines and all — not a line at a
 * time. Every line used to be its own input, which is what made bullets
 * and boxes and per-line sizes easy and made it impossible to drag a
 * selection across two lines of your own prose: a selection cannot leave
 * the input it started in.
 *
 * So the marks moved into the text. A bullet really begins with "• " and a
 * box with "☐ " — characters a carer can see, delete, and type themselves
 * — which leaves nothing about a line that has to be remembered outside
 * it except how big it is set, and that is what `lines` is for.
 *
 * A picture is the one thing that cannot live inside a text field, so it
 * breaks the page into runs either side of it. That is the one place a
 * selection still stops, and it stops there in every editor.
 */
export type Part =
  | {
      kind: "text";
      id: string;
      text: string;
      /** One entry per line of `text`, saying how big that line is set. */
      lines: LineKind[];
      /** Emphasis, over the characters of the whole run. */
      spans?: Span[];
    }
  | { kind: "image"; id: string; uri: string };

export type Note = {
  id: string;
  title: string;
  parts: Part[];
  createdAt: number;
  updatedAt: number;
  /** Held at the top of the list, whatever the dates say. */
  pinned?: boolean;
};

/** A key for a run or a page — unique enough for one notebook. */
export const id = () =>
  `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

/** The three things that can be done to a run of characters. */
export type Emphasis = "bold" | "italic" | "mark";

/**
 * A stretch of a run carrying one emphasis.
 *
 * Half-open, `from` up to but not including `to`, which is how a text
 * field reports a selection — so a selection becomes a span without an
 * off-by-one at either end.
 *
 * Character positions rather than marks inside the string, because the
 * string is what the carer typed and nothing the app does should put
 * characters into it that they did not. The cost is that every position
 * has to move when the text does, which is what `shiftSpans` is for.
 */
export type Span = { from: number; to: number; kind: Emphasis };

/** What changed between two versions of a run: one edit in one place. */
export function diffOf(
  was: string,
  now: string,
): { start: number; removed: number; inserted: number } {
  let start = 0;
  const min = Math.min(was.length, now.length);
  while (start < min && was[start] === now[start]) start++;
  let endWas = was.length;
  let endNow = now.length;
  while (
    endWas > start &&
    endNow > start &&
    was[endWas - 1] === now[endNow - 1]
  ) {
    endWas--;
    endNow--;
  }
  return { start, removed: endWas - start, inserted: endNow - start };
}

/**
 * The spans, moved to where their characters have gone.
 *
 * A position before the edit stays; one after it moves by the difference;
 * one inside the deleted stretch collapses onto the point the deletion
 * left behind. Typing INSIDE a span therefore extends it — the start is
 * before the caret and the end after it, so the end moves and the start
 * does not — and typing at its far edge does not, which is what anybody
 * expects of a highlighter.
 */
export function shiftSpans(
  spans: Span[],
  start: number,
  removed: number,
  inserted: number,
): Span[] {
  const delta = inserted - removed;
  const end = start + removed;
  const move = (p: number) => (p <= start ? p : p >= end ? p + delta : start);
  return spans
    .map((s) => ({ ...s, from: move(s.from), to: move(s.to) }))
    .filter((s) => s.to > s.from);
}

/**
 * One emphasis turned on over a stretch, or off if the whole stretch has it.
 *
 * Worked out character by character rather than by cutting spans apart. A
 * page is a page long, the arithmetic of splitting and merging overlapping
 * ranges is where this kind of code goes wrong, and a set of positions
 * cannot be subtly inconsistent with itself.
 */
export function toggleSpan(
  spans: Span[],
  from: number,
  to: number,
  kind: Emphasis,
): Span[] {
  if (to <= from) return spans;
  const others = spans.filter((s) => s.kind !== kind);
  const on = new Set<number>();
  for (const s of spans) {
    if (s.kind !== kind) continue;
    for (let i = s.from; i < s.to; i++) on.add(i);
  }
  let all = true;
  for (let i = from; i < to; i++) if (!on.has(i)) all = false;
  for (let i = from; i < to; i++) {
    if (all) on.delete(i);
    else on.add(i);
  }

  const runs: Span[] = [];
  let open: number | null = null;
  let last = -2;
  for (const i of [...on].sort((a, b) => a - b)) {
    if (open == null) open = i;
    else if (i !== last + 1) {
      runs.push({ from: open, to: last + 1, kind });
      open = i;
    }
    last = i;
  }
  if (open != null) runs.push({ from: open, to: last + 1, kind });
  return [...others, ...runs];
}

/** Whether a whole stretch already carries an emphasis. */
export function spanCovers(
  spans: Span[],
  from: number,
  to: number,
  kind: Emphasis,
): boolean {
  if (to <= from) return false;
  for (let i = from; i < to; i++) {
    if (!spans.some((s) => s.kind === kind && i >= s.from && i < s.to)) {
      return false;
    }
  }
  return true;
}

export type Run = {
  text: string;
  size: LineKind;
  bold: boolean;
  italic: boolean;
  mark: boolean;
  /** Being rewritten by the assistant right now. */
  busy: boolean;
};

/** The run cut into stretches that are styled the same way all through. */
export function segmentsOf(
  text: string,
  spans: Span[] = [],
  /** One size per line, so a heading in the middle of a run is set as one. */
  lines: LineKind[] = [],
  /** The stretch the assistant has, while it has it. */
  busy?: { from: number; to: number },
): Run[] {
  let line = 0;
  const at = (i: number) => ({
    size: lines[line] ?? "text",
    bold: spans.some((s) => s.kind === "bold" && i >= s.from && i < s.to),
    italic: spans.some((s) => s.kind === "italic" && i >= s.from && i < s.to),
    mark: spans.some((s) => s.kind === "mark" && i >= s.from && i < s.to),
    busy: busy != null && i >= busy.from && i < busy.to,
  });
  const out: Run[] = [];
  for (let i = 0; i < text.length; i++) {
    const look = at(i);
    const last = out[out.length - 1];
    if (
      last != null &&
      last.size === look.size &&
      last.bold === look.bold &&
      last.italic === look.italic &&
      last.mark === look.mark &&
      last.busy === look.busy
    ) {
      last.text += text[i];
    } else {
      out.push({ text: text[i], ...look });
    }
    if (text[i] === "\n") line += 1;
  }
  return out;
}

/** A fresh run of writing, with one empty line in it. */
export const emptyPart = (): Part => ({
  kind: "text",
  id: id(),
  text: "",
  lines: ["text"],
});

/** Every line of a note, in order, whatever run it is in. */
export const linesOf = (n: Note): string[] =>
  n.parts.flatMap((p) => (p.kind === "text" ? p.text.split("\n") : []));

/** A line with its list mark taken off, for reading rather than editing. */
export const bare = (line: string): string =>
  line.startsWith(BULLET) || line.startsWith(BOX_OFF) || line.startsWith(BOX_ON)
    ? line.slice(2).trim()
    : line.trim();

/**
 * The first line of a page, as the list shows it.
 *
 * The title if it has been given one, and otherwise the first thing
 * written — a page a carer opened, typed into and closed without naming
 * is still their page, and "ไม่มีชื่อ" down a whole list is a list that
 * cannot be read.
 *
 * Empty for a page with nothing on it at all; `notes.titleOf` names that
 * one in the language on screen.
 */
export const writtenTitleOf = (n: Note): string => {
  const written = n.title.trim();
  if (written !== "") return written;
  const first = linesOf(n).find((l) => bare(l) !== "");
  return first == null ? "" : bare(first);
};

/** What the page says, under its own title, for the list. */
export const previewOf = (n: Note): string => {
  const named = n.title.trim() !== "";
  const said = linesOf(n)
    .map(bare)
    .filter((l) => l !== "");
  return (named ? said : said.slice(1)).join(" · ");
};

/** How many of a page's checklist lines are ticked, if it has any. */
export const tickedOf = (n: Note): { done: number; total: number } | null => {
  const boxes = linesOf(n).filter(
    (l) => l.startsWith(BOX_OFF) || l.startsWith(BOX_ON),
  );
  if (boxes.length === 0) return null;
  return {
    done: boxes.filter((l) => l.startsWith(BOX_ON)).length,
    total: boxes.length,
  };
};

/** How many pictures are on the page. */
export const shotsOf = (n: Note) =>
  n.parts.filter((p) => p.kind === "image").length;

/**
 * The page as plain text, which is what the model is given.
 *
 * Headings marked the way anybody would write them by hand, and the list
 * marks passed through as they already stand — they are real characters on
 * the page, so there is nothing to translate. A picture is named rather
 * than sent: what the page is for is the words around it.
 */
export const asText = (n: Note): string =>
  n.parts
    .map((p) => {
      if (p.kind === "image") return "(รูปภาพ)";
      return p.text
        .split("\n")
        .map((line, i) => {
          const size = p.lines[i] ?? "text";
          const hashes =
            size === "title"
              ? "# "
              : size === "heading"
                ? "## "
                : size === "subheading"
                  ? "### "
                  : "";
          return hashes + line;
        })
        .join("\n");
    })
    .join("\n");

/** Plain text back into a run, by the same marks `asText` writes. */
export const fromText = (text: string): Part => {
  const raw = text.split("\n").filter((l) => l.trim() !== "");
  if (raw.length === 0) return emptyPart();
  const lines: LineKind[] = [];
  const out = raw.map((one) => {
    const line = one.trimEnd();
    const hashes = /^(#{1,3})\s/.exec(line);
    if (hashes != null) {
      lines.push(
        hashes[1].length === 1
          ? "title"
          : hashes[1].length === 2
            ? "heading"
            : "subheading",
      );
      return line.replace(/^#+\s/, "");
    }
    lines.push("text");
    // A model asked for a list gives back dashes and brackets; the page
    // writes those as the marks it actually uses.
    const box = /^\[( |x|X)\]\s?/.exec(line);
    if (box != null) {
      return (
        (box[1].toLowerCase() === "x" ? BOX_ON : BOX_OFF) +
        line.slice(box[0].length)
      );
    }
    return /^[-•*]\s/.test(line) ? BULLET + line.replace(/^[-•*]\s/, "") : line;
  });
  return { kind: "text", id: id(), text: out.join("\n"), lines };
};

/**
 * The line a character position falls on, and where that line starts.
 *
 * Everything the toolbar does — set a size, put a bullet on, tick a box —
 * is done to the line the caret is in, and with the whole run in one field
 * the caret is a number rather than a row of a list.
 */
export const lineAt = (
  text: string,
  at: number,
): { index: number; from: number; to: number } => {
  let from = 0;
  let index = 0;
  const lines = text.split("\n");
  for (const line of lines) {
    const to = from + line.length;
    if (at <= to) return { index, from, to };
    from = to + 1;
    index += 1;
  }
  const last = lines[lines.length - 1] ?? "";
  return {
    index: lines.length - 1,
    from: text.length - last.length,
    to: text.length,
  };
};

/**
 * `lines` brought back into step with the text after an edit.
 *
 * A run holds one size per line, and typing changes how many lines there
 * are. Rather than tracking every insertion, the count is reconciled: a
 * line added takes the size of the one it was split from, and a line
 * removed takes its size with it. Anything the reconciliation cannot
 * account for falls back to ordinary text, which is the size a line is
 * when nobody has said otherwise.
 */
export const fitLines = (
  was: LineKind[],
  wasText: string,
  now: string,
): LineKind[] => {
  const before = wasText.split("\n").length;
  const after = now.split("\n").length;
  if (before === after) {
    return Array.from({ length: after }, (_, i) => was[i] ?? "text");
  }
  const d = diffOf(wasText, now);
  const at = lineAt(wasText, d.start).index;
  if (after > before) {
    const added = after - before;
    // A line split in two: the tail carries on at the same size, unless
    // the line it came out of was a heading — a heading is one line, and
    // what follows it is what it is a heading for.
    const carry: LineKind = was[at] === "text" ? "text" : "text";
    return [
      ...was.slice(0, at + 1),
      ...Array.from({ length: added }, () => carry),
      ...was.slice(at + 1),
    ].slice(0, after);
  }
  const gone = before - after;
  return [...was.slice(0, at + 1), ...was.slice(at + 1 + gone)].slice(0, after);
};
