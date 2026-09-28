import { Platform } from "react-native";
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionResultEvent,
} from "expo-speech-recognition";

/**
 * Speech, turned into writing — on the phone, not on a server.
 *
 * iOS does this itself, with the recogniser Dictation is built on. That
 * matters more here than it would in most apps: what a carer says into a
 * notebook at a house is about somebody's health, and the version of this
 * that posts a recording to a cluster would be sending exactly the thing
 * the rest of the app is careful never to send.
 *
 * The model behind the app cannot do it in any case — asked for audio it
 * answers that it "does not have an audio tower", and there is no
 * transcription endpoint beside it. On-device was the only road open, and
 * it is the one that should have been taken anyway.
 */

/** Thai first; the recogniser falls back to whatever it has for the locale. */
const LANG = "th-TH";

export type Heard = { text: string; final: boolean };

/** Whether this phone can do it at all, and whether it has been allowed to. */
export async function canDictate(): Promise<
  { ok: true } | { ok: false; why: string }
> {
  if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
    return { ok: false, why: "เครื่องนี้ไม่รองรับการถอดเสียง" };
  }
  const granted = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  if (!granted.granted) {
    return { ok: false, why: "ยังไม่ได้อนุญาตให้ใช้ไมโครโฟนและการรู้จำเสียง" };
  }
  return { ok: true };
}

/*
  Whether to insist on recognising on the phone.

  Wanted wherever it works — nothing leaves the phone, and it works with no
  signal. But on Android, asking for it without the Thai model downloaded is
  not a slower recogniser, it is none: the service answers
  "language-not-supported … not yet downloaded" and hears nothing at all,
  which is what an emulator and plenty of phones do. So on Android it is
  asked for only where Thai is among the installed languages, and the
  system's ordinary recogniser is used otherwise. iOS reports on-device
  support per recogniser, and is left to answer for itself.
*/
let thaiOnDevice: boolean | null = null;

export async function recogniseOnDevice(): Promise<boolean> {
  if (!ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) return false;
  if (Platform.OS !== "android") return true;
  if (thaiOnDevice != null) return thaiOnDevice;
  try {
    const { installedLocales } =
      await ExpoSpeechRecognitionModule.getSupportedLocales({});
    thaiOnDevice = installedLocales.some((l) =>
      l.toLowerCase().startsWith("th"),
    );
  } catch {
    thaiOnDevice = false;
  }
  return thaiOnDevice;
}

/**
 * Start listening, and keep listening.
 *
 * `continuous`, because a carer describing a visit stops to think and a
 * recogniser that ends at the first pause turns one account into six. The
 * interim results are what make it feel like writing rather than waiting:
 * the words appear as they are said and are corrected behind the cursor.
 */
export async function startDictation(): Promise<void> {
  const onDevice = await recogniseOnDevice();
  ExpoSpeechRecognitionModule.start({
    lang: LANG,
    interimResults: true,
    continuous: true,
    // The level of the voice, several times a second, so the bar on the
    // header can show that it is hearing something. Without it a carer
    // talking into a phone that has stopped listening has no way to know.
    volumeChangeEventOptions: { enabled: true, intervalMillis: 120 },
    // On device where the phone can: nothing leaves it, and it works in a
    // village with no signal — which is where half of these notes are made.
    requiresOnDeviceRecognition: onDevice,
  });
}

export function stopDictation(): void {
  ExpoSpeechRecognitionModule.stop();
}

/** What a spoken search can end in, for the field to say. */
export type HeardEnd = "done" | "stopped" | "silent" | "failed" | "denied";

/**
 * One thing said, for a search field: a name, a village, a job.
 *
 * Not `continuous` — a search is a few words and then a pause, and the
 * pause is the end of it; the recogniser stops itself there. Each guess is
 * handed over as it firms up, so the list narrows while the words are
 * still being said.
 *
 * Listened for through listeners of its own, added here and taken down
 * when it ends, rather than through the screen-wide event hooks: a search
 * field sits on pages that stay mounted under others, and a hook would
 * hear the notebook's dictation, or the assistant's, and type it into a
 * search box nobody is looking at.
 *
 * Returns `stop`, which ends the listening early and keeps what was heard,
 * and `cancel`, for a field that is going away and wants nothing more.
 */
export async function listenOnce(
  onText: (text: string) => void,
  onEnd: (how: HeardEnd, why?: string) => void,
): Promise<{ stop: () => void; cancel: () => void }> {
  const can = await canDictate();
  if (!can.ok) {
    onEnd("denied", can.why);
    return { stop: () => {}, cancel: () => {} };
  }

  let heard = false;
  let over = false;
  const finish = (how: HeardEnd | null) => {
    if (over) return;
    over = true;
    clearTimeout(guard);
    result.remove();
    ended.remove();
    failed.remove();
    if (how != null) onEnd(how);
  };
  // A recogniser that never says it has ended would hold the field in
  // "listening" for good. A search is said in seconds; past this it is over.
  const guard = setTimeout(() => {
    ExpoSpeechRecognitionModule.abort();
    finish(heard ? "done" : "silent");
  }, 15_000);

  const result = ExpoSpeechRecognitionModule.addListener(
    "result",
    (e: ExpoSpeechRecognitionResultEvent) => {
      // Tidied for a search: no closing full stop from recognisers that
      // punctuate, and no space at either end to miss a match by.
      const said = (e.results?.[0]?.transcript ?? "")
        .replace(/[.。!?]+$/u, "")
        .trim();
      if (said === "") return;
      heard = true;
      onText(said);
    },
  );
  const ended = ExpoSpeechRecognitionModule.addListener("end", () =>
    finish(heard ? "done" : "silent"),
  );
  const failed = ExpoSpeechRecognitionModule.addListener("error", (e) => {
    // Silence is not a failure: the carer tapped and said nothing, or too
    // quietly. Stopped on purpose is not one either — by `cancel`, which has
    // already finished and is ignored here, or by the system taking the
    // microphone away, which still has to let the field go.
    if (e.error === "aborted") return finish(heard ? "done" : "stopped");
    if (e.error === "no-speech" || e.error === "speech-timeout") {
      return finish(heard ? "done" : "silent");
    }
    finish(heard ? "done" : "failed");
  });

  try {
    const onDevice = await recogniseOnDevice();
    ExpoSpeechRecognitionModule.start({
      lang: LANG,
      interimResults: true,
      continuous: false,
      requiresOnDeviceRecognition: onDevice,
      // A search is short: a second of quiet after it is the end of it.
      androidIntentOptions: {
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1000,
      },
    });
  } catch {
    finish("failed");
  }

  return {
    stop: () => ExpoSpeechRecognitionModule.stop(),
    cancel: () => {
      finish(null);
      ExpoSpeechRecognitionModule.abort();
    },
  };
}

/**
 * A recording already on the phone, read through the same recogniser.
 *
 * The same engine, pointed at a file instead of the microphone, so a voice
 * memo taken during a visit — or a handover somebody sent — becomes text
 * on a page without being uploaded anywhere.
 *
 * Resolved from the events rather than returned: the recogniser reports as
 * it goes, and what is wanted is the last thing it said before it ended.
 * The listeners are torn down on every exit, including the error paths,
 * because a recogniser left listening holds the audio session and the next
 * attempt silently does nothing.
 */
export function transcribeFile(uri: string): Promise<string | null> {
  return new Promise((resolve) => {
    let best = "";
    let done = false;

    const finish = (text: string | null) => {
      if (done) return;
      done = true;
      result.remove();
      ended.remove();
      failed.remove();
      clearTimeout(guard);
      resolve(text);
    };

    const result = ExpoSpeechRecognitionModule.addListener(
      "result",
      (e: ExpoSpeechRecognitionResultEvent) => {
        const said = e.results?.[0]?.transcript ?? "";
        if (said.trim() !== "") best = said;
      },
    );
    const ended = ExpoSpeechRecognitionModule.addListener("end", () =>
      finish(best.trim() === "" ? null : best.trim()),
    );
    const failed = ExpoSpeechRecognitionModule.addListener("error", () =>
      finish(best.trim() === "" ? null : best.trim()),
    );

    // A file that never ends is a page that never comes back. Two minutes
    // is longer than any voice memo worth typing up by hand.
    const guard = setTimeout(
      () => finish(best.trim() === "" ? null : best.trim()),
      120_000,
    );

    try {
      ExpoSpeechRecognitionModule.start({
        lang: LANG,
        interimResults: true,
        continuous: true,
        audioSource: { uri },
      });
    } catch {
      finish(null);
    }
  });
}
