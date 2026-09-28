import * as Speech from "expo-speech";

/**
 * The assistant's voice — its answers read aloud, on the phone.
 *
 * The system's own text-to-speech, in Thai: on iOS the voice Siri's
 * reading uses, on Android whatever engine the phone carries (Google's
 * speaks Thai). Nothing is sent anywhere to be spoken, for the same reason
 * `dictate` listens on the phone: what is said here is about a patient.
 */

const LANG = "th-TH";

/**
 * An answer as it should be heard rather than read.
 *
 * The model writes for a screen — asterisks for bold, a hyphen at the head
 * of a list, the odd link or emoji — and a speech engine reads every one of
 * them out, or stumbles over them. So the marks go, list items become
 * pauses, and lines run on as sentences.
 */
export function speakable(text: string): string {
  return (
    text
      // Links: the words, never the address.
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/https?:\/\/\S+/g, "")
      // Emphasis, code and headings: the marks, not the words inside.
      .replace(/[*_`#>]+/g, "")
      // List heads at the start of a line.
      .replace(/^\s*(?:[-•·]|\d+[.)])\s+/gm, "")
      // Pictographs a voice can only spell out.
      .replace(/[\p{Extended_Pictographic}️]/gu, "")
      // Lines into sentences: a pause, not a stop the engine reads as "จุด".
      .replace(/\s*\n+\s*/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

/*
  The best Thai voice this phone has, chosen once.

  The difference between voices is most of the difference between an app
  reading and somebody talking. iOS ships Thai as a compact voice and lets
  the user download "Enhanced" and "Premium" ones (Settings → Accessibility
  → Spoken Content → Voices → Thai), which are neural and sound it;
  Android's Google engine has on-device voices and network ones, the network
  ones the more natural. The finest one installed is used, and the system's
  default only when there is no choice to make.
*/
let bestVoice: string | null | undefined;

function rank(v: Speech.Voice): number {
  const id = v.identifier.toLowerCase();
  let score = v.quality === Speech.VoiceQuality.Enhanced ? 2 : 0;
  if (id.includes("premium")) score += 3;
  if (id.includes("enhanced")) score += 1;
  if (id.includes("network")) score += 1;
  return score;
}

/** Whether this phone has a Thai voice to speak with at all. */
export async function hasThaiVoice(): Promise<boolean> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    // An empty list is what some Android engines answer before they have
    // loaded; that is not the same as having no Thai, so it is let through.
    if (voices.length === 0) {
      bestVoice = null;
      return true;
    }
    const thai = voices.filter((v) => v.language.toLowerCase().startsWith("th"));
    thai.sort((a, b) => rank(b) - rank(a));
    bestVoice = thai[0]?.identifier ?? null;
    return thai.length > 0;
  } catch {
    bestVoice = null;
    return true;
  }
}

/** Whether the voice in use is the plain one (see the note on `bestVoice`). */
export const plainVoice = () =>
  bestVoice == null || !/premium|enhanced|network/i.test(bestVoice);

const OPTIONS = (): Speech.SpeechOptions => ({
  language: LANG,
  voice: bestVoice ?? undefined,
  // Normal speed: a neural voice at its own pace sounds like a person, and
  // one pushed faster sounds like a machine in a hurry.
  rate: 1,
  // iOS: the system's own session for speech, so the answer comes out of
  // the speaker at full volume whatever the recogniser left the app's
  // session set to, and ducks other audio while it talks.
  useApplicationAudioSession: false,
});

/**
 * A voice for an answer that is still being written.
 *
 * The answer streams in; each sentence is handed to `say` as soon as it is
 * whole, and the engine queues them, so the first words are heard while the
 * rest are still arriving — the gap between asking and hearing is one
 * sentence's writing, not the whole answer's. `close` says nothing more is
 * coming; `onEnd` fires once, when the last sentence has been said, or when
 * `stop` cut it short.
 */
export function makeSpeaker(onEnd: (how: "done" | "stopped" | "failed") => void) {
  let pending = 0;
  let closed = false;
  let over = false;
  let failed = false;
  const end = (how: "done" | "stopped" | "failed") => {
    if (over) return;
    over = true;
    onEnd(how);
  };
  const settle = () => {
    if (closed && pending === 0) end(failed ? "failed" : "done");
  };
  return {
    say(text: string) {
      if (over) return;
      const words = speakable(text);
      if (words === "") return;
      pending += 1;
      Speech.speak(words, {
        ...OPTIONS(),
        onDone: () => {
          pending -= 1;
          settle();
        },
        onStopped: () => end("stopped"),
        onError: () => {
          failed = true;
          pending -= 1;
          settle();
        },
      });
    },
    close() {
      closed = true;
      settle();
    },
    stop() {
      if (over) return;
      end("stopped");
      void Speech.stop();
    },
  };
}

/**
 * Read `text` aloud, and say when it is over.
 *
 * `onDone` fires once however it ends — finished, stopped, or failed — so a
 * caller waiting to listen again is never left waiting. For a whole answer
 * at once; one still streaming in goes through `makeSpeaker`.
 */
export function speak(text: string, onDone: (how: "done" | "stopped" | "failed") => void): void {
  const words = speakable(text);
  if (words === "") {
    onDone("done");
    return;
  }
  let over = false;
  const end = (how: "done" | "stopped" | "failed") => {
    if (over) return;
    over = true;
    onDone(how);
  };
  Speech.speak(words, {
    ...OPTIONS(),
    onDone: () => end("done"),
    onStopped: () => end("stopped"),
    onError: () => end("failed"),
  });
}

/** Stop talking — a carer who starts to speak over it should win. */
export function stopSpeaking(): void {
  void Speech.stop();
}
