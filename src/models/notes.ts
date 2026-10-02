import { useSyncExternalStore } from "react";
import { File, Paths } from "expo-file-system";

import { toast } from "../components/Toast";
import { tr } from "../i18n";
import {
  BOX_OFF,
  BOX_ON,
  BULLET,
  bare,
  writtenTitleOf,
  emptyPart,
  id,
  linesOf,
  type LineKind,
  type Note,
  type Part,
  type Span,
} from "./notesText";

/*
  Everything the editor reaches for comes through here.

  The text machinery lives next door so it can be run without a phone, and
  re-exporting it means no screen has to know that — there is one name for
  "the notebook" and it is this one.
*/
export * from "./notesText";

/*
  The two things the notebook says in words, said here in the language on
  screen rather than in `notesText`: the language module imports the file
  system, and the text half has to stay runnable under `npx tsx`.
*/
export const SIZE_LABEL: Record<LineKind, string> = {
  title: tr("หัวเรื่อง", "Title"),
  heading: tr("หัวข้อ", "Heading"),
  subheading: tr("หัวข้อย่อย", "Subheading"),
  text: tr("เนื้อความ", "Body"),
};

/** The first line of a page, as the list shows it (see `notesText`). */
export const titleOf = (n: Note): string =>
  writtenTitleOf(n) || tr("หน้าใหม่", "New page");

/**
 * "สมุดจด" — the carer's own notebook, a page at a time.
 *
 * Everything else in the app is a form: a roster with a column for each
 * thing the register wants, filled in the order the register wants it. A
 * round does not only produce register entries. It produces the thing the
 * teacher said at the gate, the four houses to come back to on Thursday,
 * the name of the grandmother who answers the door at number twelve —
 * and none of that has a field anywhere, so it goes on the back of the
 * consent forms and is lost by Friday.
 *
 * A page rather than one long scroll, because a carer keeps a page per
 * subject: this school, that family, next month's campaign. A page can be
 * carried into the meeting it is about.
 */

/* ----------------------------------------------------------- the store */

let notes: Note[] = [];
const watchers = new Set<() => void>();
let snapshot: Note[] = notes;
const store = () => new File(Paths.document, "notes.json");

/**
 * Newest first, with anything pinned above it.
 *
 * Sorted on the way out rather than kept sorted, so that typing into a
 * page does not move it under the finger — the order is settled once, when
 * something changes, and the list re-renders with it.
 */
function publish(): void {
  snapshot = [...notes].sort((a, b) => {
    if ((a.pinned === true) !== (b.pinned === true))
      return a.pinned === true ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
  for (const w of watchers) w();
}

function save(): void {
  try {
    const f = store();
    if (!f.exists) f.create({ intermediates: true });
    f.write(JSON.stringify(notes));
  } catch {
    // A notebook that cannot write itself down is still readable until the
    // app is closed, which is better than losing the page being typed.
    toast(tr("บันทึกลงเครื่องไม่สำเร็จ", "Couldn't save to this device"), "error");
  }
}

/**
 * A page written by the editor that kept a block per line, brought across.
 *
 * The pages are the carer's own and there is no version of this app in
 * which they are dropped because the shape changed underneath them. Lines
 * become lines, the list marks become the characters that now stand for
 * them, and a picture becomes a run of its own.
 */
type OldBlock = {
  kind: string;
  text?: string;
  done?: boolean;
  uri?: string;
  spans?: Span[];
};

function carried(n: Note & { blocks?: OldBlock[] }): Note {
  if (!Array.isArray(n.blocks)) return n;
  const parts: Part[] = [];
  let run: string[] = [];
  let lines: LineKind[] = [];
  const flush = () => {
    if (run.length === 0) return;
    parts.push({ kind: "text", id: id(), text: run.join("\n"), lines });
    run = [];
    lines = [];
  };
  for (const b of n.blocks) {
    if (b.kind === "image") {
      flush();
      if (b.uri != null) parts.push({ kind: "image", id: id(), uri: b.uri });
      continue;
    }
    const mark =
      b.kind === "bullet"
        ? BULLET
        : b.kind === "check"
          ? b.done === true
            ? BOX_ON
            : BOX_OFF
          : "";
    run.push(mark + (b.text ?? ""));
    lines.push(
      b.kind === "title" || b.kind === "heading" || b.kind === "subheading"
        ? b.kind
        : "text",
    );
  }
  flush();
  const { blocks: _gone, ...rest } = n;
  return { ...rest, parts: parts.length === 0 ? [emptyPart()] : parts };
}

/** Read the notebook back at launch. A missing file is an empty one. */
export async function hydrateNotes(): Promise<void> {
  try {
    const f = store();
    if (f.exists) {
      const saved = JSON.parse(await f.text()) as unknown;
      if (Array.isArray(saved)) notes = (saved as Note[]).map(carried);
    }
  } catch {
    notes = [];
  }
  publish();
}

/** The notebook as it is now, outside React — for the assistant's search. */
export function currentNotes(): Note[] {
  return snapshot;
}

export function useNotes(): Note[] {
  return useSyncExternalStore(
    (onChange) => {
      watchers.add(onChange);
      return () => {
        watchers.delete(onChange);
      };
    },
    () => snapshot,
  );
}

export const noteById = (noteId: string): Note | undefined =>
  notes.find((n) => n.id === noteId);

/** Start a page, and hand back its id so the caller can open it. */
export function newNote(): string {
  const now = Date.now();
  const note: Note = {
    id: id(),
    title: "",
    parts: [emptyPart()],
    createdAt: now,
    updatedAt: now,
  };
  notes = [note, ...notes];
  publish();
  save();
  return note.id;
}

/**
 * Write a page down.
 *
 * Takes the whole page rather than a field at a time: the editor holds the
 * page it is working on and hands it back, which is the only arrangement
 * in which a half-finished edit cannot be interleaved with a save.
 */
export function saveNote(next: Note): void {
  notes = notes.map((n) =>
    n.id === next.id ? { ...next, updatedAt: Date.now() } : n,
  );
  publish();
  save();
}

export function deleteNote(noteId: string): void {
  notes = notes.filter((n) => n.id !== noteId);
  publish();
  save();
}

export function pinNote(noteId: string, on: boolean): void {
  notes = notes.map((n) => (n.id === noteId ? { ...n, pinned: on } : n));
  publish();
  save();
}

/** Pages matching a query, by title or by anything written on them. */
export function searchNotes(list: Note[], query: string): Note[] {
  const q = query.trim().toLowerCase();
  if (q === "") return list;
  return list.filter(
    (n) =>
      titleOf(n).toLowerCase().includes(q) ||
      linesOf(n).some((l) => l.toLowerCase().includes(q)),
  );
}
