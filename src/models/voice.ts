import * as Speech from "expo-speech";
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from "expo-audio";
import { File, Paths } from "expo-file-system";

import { isEn, lang, locale } from "../i18n";

/**
 * The assistant's voice — its answers read aloud, on the phone.
 *
 * A neural Thai voice from the hospital's own speech server (VoxCPM, on
 * the same cluster the assistant's model runs on), so the answer is sent
 * nowhere the question was not already sent. It sounds like a person where
 * the phones' own engines sound like a phone reading.
 *
 * The system's text-to-speech stays underneath: where the server cannot be
 * reached — no signal at a house — each sentence it could not voice is
 * read by the phone's own engine instead, so the answer is always heard.
 */

/** The speech server, and the voice the assistant speaks in. */
const VOICE_HOST = "https://vox-cpm.bmscloud.in.th";
const NEURAL_VOICE = "female";

let fileSeq = 0;

/**
 * One sentence, voiced by the server, as a file ready to play — or null
 * where it could not be, for the phone's own voice to read instead.
 */
async function synthesise(
  text: string,
  signal: AbortSignal,
): Promise<string | null> {
  try {
    const res = await fetch(`${VOICE_HOST}/v1/audio/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "voxcpm-thai",
        input: text,
        voice: NEURAL_VOICE,
        response_format: "mp3",
      }),
      signal,
    });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length === 0) return null;
    const file = new File(Paths.cache, `answer-${Date.now()}-${fileSeq++}.mp3`);
    file.write(bytes);
    return file.uri;
  } catch {
    return null;
  }
}

/** Throw a spoken file away once it has been heard. */
function discard(uri: string) {
  try {
    new File(uri).delete();
  } catch {
    // A file left in the cache is the system's to clear.
  }
}

/*
  The server's voice is a Thai model and reads English as a Thai speaker
  spelling it out, so in English the phone's own engine speaks every
  sentence, in the phone's English voice. Nothing new leaves the device
  for it: on-device speech sends nothing anywhere.
*/
const LANG = locale;
const serverVoice = !isEn;

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
    // The voices of the language the app speaks — Thai, or English; for
    // English the US voices where there are any, so an answer is not read
    // in one accent today and another tomorrow.
    const ofLang = voices.filter((v) => v.language.toLowerCase().startsWith(lang));
    const exact = ofLang.filter(
      (v) => v.language.replace("_", "-").toLowerCase() === locale.toLowerCase(),
    );
    const thai = exact.length > 0 ? exact : ofLang;
    thai.sort((a, b) => rank(b) - rank(a));
    bestVoice = thai[0]?.identifier ?? null;
    // The server's voice speaks Thai whatever the phone carries; the
    // phone's own is only what it falls back to.
    return true;
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
  // The server's voice plays through the app's own audio session: out of
  // the speaker even with the switch on silent, and lowering music rather
  // than stopping it.
  void setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: "duckOthers",
  }).catch(() => {});

  const abort = new AbortController();
  // Each sentence is sent to be voiced the moment it is whole, so the next
  // is ready while this one plays; they are played strictly in order.
  const queue: { text: string; audio: Promise<string | null> }[] = [];
  let playing = false;
  let closed = false;
  let over = false;
  let failed = false;
  let player: AudioPlayer | null = null;

  const end = (how: "done" | "stopped" | "failed") => {
    if (over) return;
    over = true;
    onEnd(how);
  };
  const settle = () => {
    if (closed && !playing && queue.length === 0)
      end(failed ? "failed" : "done");
  };
  const next = () => {
    playing = false;
    void pump();
  };

  const pump = async () => {
    if (playing || over) return;
    const item = queue.shift();
    if (item == null) {
      settle();
      return;
    }
    playing = true;
    const uri = await item.audio;
    if (over) {
      if (uri != null) discard(uri);
      return;
    }
    if (uri == null) {
      // The server could not voice it: the phone reads this one.
      Speech.speak(item.text, {
        ...OPTIONS(),
        onDone: next,
        onStopped: () => end("stopped"),
        onError: () => {
          failed = true;
          next();
        },
      });
      return;
    }
    const p = createAudioPlayer({ uri });
    player = p;
    const sub = p.addListener("playbackStatusUpdate", (status) => {
      if (!status.didJustFinish) return;
      sub.remove();
      p.remove();
      if (player === p) player = null;
      discard(uri);
      next();
    });
    p.play();
  };

  return {
    say(text: string) {
      if (over) return;
      const words = speakable(text);
      if (words === "") return;
      queue.push({
        text: words,
        audio: serverVoice ? synthesise(words, abort.signal) : Promise.resolve(null),
      });
      void pump();
    },
    close() {
      closed = true;
      settle();
    },
    stop() {
      if (over) return;
      end("stopped");
      abort.abort();
      try {
        player?.pause();
        player?.remove();
      } catch {
        // Already gone.
      }
      player = null;
      queue.length = 0;
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
