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

/**
 * Start listening, and keep listening.
 *
 * `continuous`, because a carer describing a visit stops to think and a
 * recogniser that ends at the first pause turns one account into six. The
 * interim results are what make it feel like writing rather than waiting:
 * the words appear as they are said and are corrected behind the cursor.
 */
export function startDictation(): void {
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
    requiresOnDeviceRecognition:
      ExpoSpeechRecognitionModule.supportsOnDeviceRecognition(),
  });
}

export function stopDictation(): void {
  ExpoSpeechRecognitionModule.stop();
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
