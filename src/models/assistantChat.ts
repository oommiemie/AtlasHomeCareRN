/**
 * The conversations themselves, and the file they live in.
 *
 * Split from `assistant`, which decides what an answer may contain: that
 * half is arithmetic over the app's own records and can be run and checked
 * anywhere, and it stopped being checkable the moment it imported a store
 * that reaches for the file system. Keeping them apart means the part that
 * must not be wrong is the part that can be tested.
 */
import { useSyncExternalStore } from "react";
import { File, Paths } from "expo-file-system";

import { toast } from "../components/Toast";
import { readHere } from "../utils/useHere";
import { tr } from "../i18n";

import {
  askAssistant,
  TELLING,
  type Attachment,
  type ChatTurn,
  answerShape,
} from "./assistant";
import { screenFocus } from "./assistantFocus";

/**
 * The conversations, kept out of the screen that draws them.
 *
 * The assistant is a page, and a page is unmounted the moment it is left.
 * Held in the screen, a carer who stepped back to check a visit and returned
 * would find the thread wiped — which is not what leaving a conversation
 * means anywhere else on a phone.
 *
 * Past threads are kept too, and written to disk: "what did it say about the
 * dressing on Tuesday" is a question the carer asks of their own phone, and
 * a history that emptied at every launch would not answer it. Only the words
 * are stored; the pictures are referenced by the file the picker left in the
 * cache, so a thread whose images iOS has since reclaimed still reads.
 */
export type Thread = {
  id: string;
  /** When the first question was asked, in milliseconds. */
  startedAt: number;
  turns: ChatTurn[];
};

let threads: Thread[] = [];
/** The thread on screen. Null between "new chat" and the first question. */
let currentId: string | null = null;
let asking = false;

const file = () => new File(Paths.document, "assistant.json");

/* One object per change, never per read: `useSyncExternalStore` compares
   snapshots by identity, and a fresh object on every read is an endless
   render loop. */
type Snapshot = { turns: ChatTurn[]; thinking: boolean; threads: Thread[] };
let snapshot: Snapshot = { turns: [], thinking: false, threads: [] };
const watchers = new Set<() => void>();

const current = (): Thread | undefined =>
  threads.find((t) => t.id === currentId);

/** An answer is on the page and still being written: no typing dots. */
let writing = false;

function publish(thinking = asking): void {
  asking = thinking;
  snapshot = {
    turns: current()?.turns ?? [],
    thinking: thinking && !writing,
    // Newest first, and never the empty one that a "new chat" has not been
    // used yet: a history listing a conversation with nothing in it is a
    // row that cannot be opened.
    threads: threads.filter((t) => t.turns.length > 0),
  };
  for (const w of watchers) w();
}

function save(): void {
  try {
    file().write(JSON.stringify({ threads: threads.filter((t) => t.turns.length > 0) }));
  } catch {
    // The next answer tries again; a failed write lasts the launch.
    toast(tr("บันทึกลงเครื่องไม่สำเร็จ", "Couldn't save to this device"), "error");
  }
}

/** Read the past conversations back at launch. A missing file is none. */
export async function hydrateChat(): Promise<void> {
  try {
    const f = file();
    if (!f.exists) return;
    const saved = JSON.parse(await f.text()) as { threads?: Thread[] };
    threads = Array.isArray(saved.threads) ? saved.threads : [];
  } catch {
    threads = [];
  }
  publish(false);
}

/** The thread on screen, whether an answer is coming, and what came before. */
export function useChat(): Snapshot {
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

let seq = 0;
const nextId = () => `t${Date.now().toString(36)}-${++seq}`;

/** What a thread is called in the history: the words it opened with. */
export function titleOf(thread: Thread): string {
  const first = thread.turns.find((t) => t.role === "user");
  const words = first?.text.trim() ?? "";
  if (words !== "") return words;
  return (first?.images?.length ?? 0) > 0
    ? tr("คำถามจากรูปภาพ", "Question about a photo")
    : tr("บทสนทนา", "Conversation");
}

/**
 * Put a question to the assistant and record both sides of it.
 *
 * Returns the answer, for the voice mode to read aloud; null where nothing
 * was asked. `spoken` asks for an answer fit to be heard (`askAssistant`).
 */
export async function send(
  text: string,
  photos: Attachment[] = [],
  spoken = false,
  /**
   * The answer so far, as it streams — the voice mode speaks from it. The
   * thread shows the same words growing, so what is heard is what is read.
   */
  onText?: (soFar: string) => void,
): Promise<string | null> {
  const question = text.trim();
  // A picture on its own is a question — "what is this?" — so an empty line
  // with one attached still goes.
  if ((question === "" && photos.length === 0) || asking) return null;
  const asked =
    question !== ""
      ? question
      : photos.length === 1
        ? tr("ในรูปนี้คืออะไร ช่วยดูให้หน่อย", "What is in this photo? Please take a look.")
        : tr(
            "ในรูปเหล่านี้คืออะไร ช่วยดูให้หน่อย",
            "What is in these photos? Please take a look.",
          );

  let thread = current();
  if (thread == null) {
    thread = { id: nextId(), startedAt: Date.now(), turns: [] };
    threads = [thread, ...threads];
    currentId = thread.id;
  }

  // The history is read before the question joins it: the question is
  // already in the prompt on its own, and sending it twice reads to the
  // model as if it had been asked twice.
  const history = thread.turns;
  thread.turns = [
    ...history,
    {
      id: nextId(),
      role: "user",
      text: question,
      images: photos.length === 0 ? undefined : photos.map((p) => p.uri),
    },
  ];
  publish(true);

  // The position is refreshed here, not in the screen: a question asked in
  // the first second after the page opened would otherwise be answered from
  // whatever fix a map last left behind, or from none at all. The wait is
  // hidden inside the one the question already has.
  await readHere();
  // Who is on the page under the assistant, read once per question: the
  // carer may have gone back and opened somebody else since the last one.
  const focus = screenFocus();
  // The streamed answer's bubble, once its first words are in.
  const on = thread;
  // A holder rather than a `let`: it is set inside the callback, and a
  // plain variable would read as still null once the await is over.
  const growing: { turn: ChatTurn | null } = { turn: null };
  const reply = await askAssistant(
    asked,
    history,
    photos,
    undefined,
    spoken,
    onText == null
      ? undefined
      : (soFar) => {
          const turn: ChatTurn = {
            id: growing.turn?.id ?? nextId(),
            role: "assistant",
            text: soFar,
          };
          on.turns = growing.turn
            ? [...on.turns.slice(0, -1), turn]
            : [...on.turns, turn];
          growing.turn = turn;
          writing = true;
          publish(true);
          onText(soFar);
        },
    focus,
  );
  const answer = reply.text;
  const fx = reply.effects;
  writing = false;
  const done: ChatTurn = {
    id: growing.turn?.id ?? nextId(),
    role: "assistant",
    text: answer,
    // Held as ids, not as whole records: the thread is written to disk,
    // and a copy of every visit frozen into it would go stale the moment
    // one of them was marked done.
    ...(() => {
      const shape = answerShape(asked, history, undefined, focus?.resident?.id);
      /*
        What the model looked up decides the cards, where it looked
        anything up — it knows which person and which list the answer is
        about better than the wording does. The map cards stay the
        question's: a route or a planned round is never a tool's to draw.
      */
      const spatial =
        shape.widget === "route" ||
        shape.widget === "tour" ||
        shape.widget === "counts";
      // Looked up with a tool that tells its own story — the clinics, the
      // medicines, the last visit — the visits the wording matched are not
      // what the answer is about, and are not put under it.
      const told = (fx.used ?? []).some((n) => TELLING.includes(n));
      const looked =
        fx.resident != null ||
        fx.residents != null ||
        fx.visits != null ||
        told;
      if (spatial || !looked) {
        return {
          visits: shape.visits.map((t) => t.id),
          widget: shape.widget,
          resident: fx.subject ?? shape.resident,
          residents: shape.residents,
          metric: shape.metric,
          actions: fx.actions,
        };
      }
      return {
        visits: fx.visits ?? [],
        widget:
          fx.resident != null
            ? ("health" as const)
            : fx.residents != null
              ? ("healthList" as const)
              : undefined,
        resident: fx.resident ?? fx.subject ?? shape.resident,
        residents: fx.residents,
        actions: fx.actions,
      };
    })(),
  };
  thread.turns = growing.turn
    ? [...thread.turns.slice(0, -1), done]
    : [...thread.turns, done];
  publish(false);
  save();
  return answer;
}

/**
 * Put the current thread away and start on a blank one.
 *
 * Nothing is thrown out: the old thread stays in the history, and a "new
 * chat" pressed on an already-blank one does nothing rather than stacking
 * up empty conversations.
 */
/**
 * Something the assistant says first, unasked — the greeting voice mode
 * opens with. Into the thread like any answer, so what was heard can be
 * read back, and into the history the next question is asked against.
 */
export function speakFirst(text: string): void {
  let thread = current();
  if (thread == null) {
    thread = { id: nextId(), startedAt: Date.now(), turns: [] };
    threads = [thread, ...threads];
    currentId = thread.id;
  }
  thread.turns = [
    ...thread.turns,
    { id: nextId(), role: "assistant", text },
  ];
  publish();
  save();
}

export function newChat(): void {
  if (asking || current() == null) return;
  currentId = null;
  publish();
}

/** Bring a past conversation back to the page. */
export function openThread(id: string): void {
  if (asking) return;
  currentId = threads.some((t) => t.id === id) ? id : null;
  publish();
}

/** Drop one conversation for good. */
export function forgetThread(id: string): void {
  if (asking) return;
  threads = threads.filter((t) => t.id !== id);
  if (currentId === id) currentId = null;
  publish();
  save();
}
