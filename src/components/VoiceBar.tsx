import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useSharedValue, withTiming } from "react-native-reanimated";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { Mic, MicOff, X } from "lucide-react-native";

import { Aurora } from "./Aurora";
import { Glass } from "./Glass";
import { VoiceWave } from "./VoiceWave";
import { toast } from "./Toast";
import { send, speakFirst } from "../models/assistantChat";
import { canDictate, recogniseOnDevice } from "../models/dictate";
import { currentDisplay } from "../models/display";
import { hasThaiVoice, makeSpeaker, stopSpeaking } from "../models/voice";
import { voiceGreeting } from "../models/voiceGreeting";
import { feel } from "../utils/haptics";
import { locale, tr } from "../i18n";
import {
  RADIUS,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  shadow,
} from "../theme/tokens";

/**
 * The composer, turned into a voice — the chat's floating bar while the
 * carer is talking to the assistant rather than typing.
 *
 * In the bar and not on a page of its own: the thread stays where it is
 * above it, so a spoken question lands in it as a bubble, the answer comes
 * back as one — with its visit cards and widgets, which can be opened
 * mid-conversation — and nothing said is out of sight.
 *
 * The loop is the one a phone call has: it listens, and when the carer
 * stops talking it asks; while it thinks it says so; it reads the answer
 * out; and then it listens again, so a second question needs no tap. A tap
 * on the bar while it is talking stops it and hands the turn back.
 *
 * Both halves happen on the phone — the system recogniser hears it
 * (`dictate`), the system voice says it (`voice`) — and only the question
 * goes to the model, into the same thread a typed one would. It asks for an
 * answer fit to be heard (`askAssistant`'s `spoken`).
 */

type Phase = "idle" | "listening" | "thinking" | "speaking";

const LABEL: Record<Phase, string> = {
  idle: tr("ไมค์ปิดอยู่ · แตะเพื่อพูด", "Mic off · Tap to speak"),
  listening: tr("กำลังฟัง…", "Listening…"),
  thinking: tr("กำลังคิด…", "Thinking…"),
  speaking: tr("กำลังตอบ · แตะเพื่อพูดแทรก", "Answering · Tap to interrupt"),
};

/**
 * Whether the carer can talk over the answer, heard through iOS's voice
 * processing. Android's recogniser has no echo cancelling to ask for, and
 * would hear the phone's own voice as a question; there, a tap cuts in.
 */
const CUT_IN = Platform.OS === "ios";

/** The wave's height inside the bar (see `VoiceWave`). */
const WAVE_H = 28;

export function VoiceBar({
  height,
  onExit,
}: {
  /** The composer's own height, so the bar takes its place exactly. */
  height: number;
  /** Out of the voice mode, back to the keyboard. */
  onExit: () => void;
}) {
  const still = currentDisplay().reduceMotion;

  const [phase, setPhase] = useState<Phase>("idle");
  const [heard, setHeard] = useState("");
  // The microphone switch in the bar: off, it neither listens nor picks the
  // turn back up after an answer — the answer is still read out.
  const [muted, setMuted] = useState(false);

  const phaseRef = useRef<Phase>("idle");
  const heardRef = useRef("");
  const mutedRef = useRef(false);
  const live = useRef(true);
  const voiced = useRef(true);

  const go = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  // The microphone's level, 0 to 1, for the wave to follow while listening.
  const level = useSharedValue(0);

  // The answer being spoken: its voice, all of it so far, and how much of it
  // has been handed to the voice.
  const speaker = useRef<ReturnType<typeof makeSpeaker> | null>(null);
  const answerRef = useRef("");
  const spokenTo = useRef(0);
  // A recogniser running under the answer, for the carer to cut in.
  const underneath = useRef(false);
  // A recogniser being stopped on purpose, whose "end" is not a question.
  const aborting = useRef(false);
  // The quiet after the last word that ends a question.
  const hush = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Failures in a row that another try might fix. Reset by anything heard.
  const strikes = useRef(0);

  const clearHush = () => {
    if (hush.current != null) clearTimeout(hush.current);
    hush.current = null;
  };

  const abortRecognising = () => {
    aborting.current = true;
    underneath.current = false;
    clearHush();
    ExpoSpeechRecognitionModule.abort();
  };

  /**
   * Start the recogniser. Continuous, both ways: it is the silence after the
   * last word that ends a question (`hush`), decided here, rather than the
   * system's own guess at when somebody has finished — which waited two or
   * three seconds, long enough to feel like not being listened to.
   *
   * `under`: while the answer is still being spoken, to hear the carer cut
   * in. iOS's voice processing takes the phone's own speech out of what the
   * microphone hears — without it, the assistant would interrupt itself.
   */
  const recognise = async (under: boolean) => {
    const onDevice = await recogniseOnDevice();
    if (!live.current) return;
    aborting.current = false;
    underneath.current = under;
    ExpoSpeechRecognitionModule.start({
      // The app's language: an English carer is heard in English.
      lang: locale,
      interimResults: true,
      continuous: true,
      volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
      requiresOnDeviceRecognition: onDevice,
      iosVoiceProcessingEnabled: under,
      androidIntentOptions: {
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1000,
      },
    });
  };

  const listen = () => {
    if (!live.current) return;
    clearHush();
    heardRef.current = "";
    setHeard("");
    go("listening");
    void recognise(false);
  };

  /*
    Hands-free: with the microphone on, silence is not the end of the
    conversation. When the recogniser gives up with nothing heard, it is
    started again, so the carer can speak whenever they are ready without
    touching the phone. Only the switch, the way out, or a failure another
    try cannot fix stops it.
  */
  const again = (wait = 250) => {
    if (!live.current || mutedRef.current) {
      go("idle");
      return;
    }
    // A breath between one recogniser and the next, so the old one has let
    // go of the microphone before the new one asks for it.
    setTimeout(() => {
      if (live.current && !mutedRef.current && phaseRef.current === "listening")
        listen();
    }, wait);
  };

  /** After an answer: the carer's turn, unless the microphone is off. */
  const afterAnswer = () => {
    // The recogniser that ran under the answer heard the answer too; the
    // carer's turn starts on a clean one.
    if (underneath.current) abortRecognising();
    if (mutedRef.current) {
      go("idle");
      return;
    }
    go("listening");
    again();
  };

  /** Where the whole sentences in `text` end — what can be said already. */
  const sentenceEnd = (text: string) => {
    for (let i = text.length - 1; i >= 0; i--) {
      const c = text[i];
      if (".!?…\n".includes(c)) return i + 1;
      // Thai ends a sentence with a space, and uses spaces between clauses
      // too; a space far enough in is a place to breathe either way.
      if (c === " " && i >= 24) return i + 1;
    }
    return 0;
  };

  const ask = async (question: string) => {
    go("thinking");
    answerRef.current = "";
    spokenTo.current = 0;
    const voice = voiced.current
      ? makeSpeaker((how) => {
          if (!live.current || how === "stopped") return;
          if (how === "failed") toast(tr("อ่านคำตอบออกเสียงไม่สำเร็จ", "Couldn't read the answer aloud"), "warning");
          afterAnswer();
        })
      : null;
    speaker.current = voice;

    // Speaking starts with the first whole sentence, not the last.
    let started = false;
    const begin = () => {
      if (started) return;
      started = true;
      go("speaking");
      if (CUT_IN && !mutedRef.current) void recognise(true);
    };

    const answer = await send(question, [], true, (soFar) => {
      answerRef.current = soFar;
      if (voice == null) return;
      const rest = soFar.slice(spokenTo.current);
      const cut = sentenceEnd(rest);
      if (cut > 0) {
        voice.say(rest.slice(0, cut));
        spokenTo.current += cut;
        begin();
      }
    });
    if (!live.current) return;
    if (answer == null) {
      go("idle");
      return;
    }
    if (voice == null) {
      // No voice to speak with: the answer is in the thread, and the turn
      // goes straight back to the carer.
      afterAnswer();
      return;
    }
    // What is left of it — or all of it, where nothing streamed and the
    // answer came from the phone's own records instead.
    const source = spokenTo.current > 0 ? answerRef.current : answer;
    const tail = source.slice(spokenTo.current);
    if (tail.trim() !== "") voice.say(tail);
    begin();
    voice.close();
  };

  /*
    It speaks first. A bar that opens silent leaves the carer to find the
    opening words; this says hello, what is left of the day, and asks what
    it can do — into the thread as well as aloud, so it can be read back —
    and then listens. It can be talked over like any answer.
  */
  const greet = () => {
    const text = voiceGreeting();
    speakFirst(text);
    if (!voiced.current) {
      listen();
      return;
    }
    const voice = makeSpeaker((how) => {
      if (!live.current || how === "stopped") return;
      afterAnswer();
    });
    speaker.current = voice;
    answerRef.current = text;
    spokenTo.current = 0;
    go("speaking");
    if (CUT_IN && !mutedRef.current) void recognise(true);
    voice.say(text);
    voice.close();
  };

  /** The carer spoke over the answer: stop it, and hear them out. */
  const cutIn = (words: string) => {
    speaker.current?.stop();
    underneath.current = false;
    heardRef.current = words;
    setHeard(words);
    go("listening");
    armHush(words);
  };

  // A question is over one second after its last word.
  const armHush = (words: string) => {
    clearHush();
    if (words.trim() === "") return;
    hush.current = setTimeout(() => {
      if (phaseRef.current === "listening") ExpoSpeechRecognitionModule.stop();
    }, 1000);
  };

  // Letters only: what the voice said, and what the recogniser heard of it,
  // spaced and punctuated differently.
  const bare = (t: string) => t.replace(/[\s.,!?…"'“”()-]/g, "");

  useSpeechRecognitionEvent("result", (e) => {
    const words = e.results[0]?.transcript ?? "";
    if (phaseRef.current === "speaking" && underneath.current) {
      /*
        Heard under the answer. It counts as the carer only if it is not
        the answer coming back through the microphone — voice processing
        takes most of that out, and this catches what it leaves.
      */
      const said = bare(words);
      if (said.length >= 3 && !bare(answerRef.current).includes(said))
        cutIn(words);
      return;
    }
    if (phaseRef.current !== "listening") return;
    strikes.current = 0;
    heardRef.current = words;
    setHeard(words);
    armHush(words);
  });

  useSpeechRecognitionEvent("volumechange", (e) => {
    if (phaseRef.current !== "listening") return;
    // -2 is silence and 10 is loud.
    const v = Math.max(0, Math.min(1, (e.value + 2) / 12));
    level.value = withTiming(v, { duration: 90 });
  });

  useSpeechRecognitionEvent("end", () => {
    if (!live.current) return;
    if (aborting.current) {
      aborting.current = false;
      return;
    }
    if (phaseRef.current === "speaking" && underneath.current) {
      // The recogniser under the answer ran out; start another while the
      // answer goes on, so cutting in keeps working to the end of it.
      underneath.current = false;
      setTimeout(() => {
        if (
          live.current &&
          phaseRef.current === "speaking" &&
          !mutedRef.current
        )
          void recognise(true);
      }, 300);
      return;
    }
    if (phaseRef.current !== "listening") return;
    clearHush();
    const question = heardRef.current.trim();
    if (question !== "") void ask(question);
    else again();
  });

  useSpeechRecognitionEvent("error", (e) => {
    if (!live.current) return;
    // Stopped on purpose: whoever stopped it has already decided what next.
    if (e.error === "aborted" || aborting.current) return;
    // Under the answer, a failure only costs the cutting in; "end" follows.
    if (phaseRef.current === "speaking") return;
    if (phaseRef.current !== "listening") return;
    // Nothing said yet: the ordinary silence between questions.
    if (e.error === "no-speech" || e.error === "speech-timeout") {
      again();
      return;
    }
    /*
      A hiccup another try may get past: the last recogniser still holding
      the microphone, the service busy, the signal dropping for a moment.
      Tried again with a longer breath each time — but three in a row is
      not a hiccup, and the switch goes off rather than trying forever.
    */
    if (
      (e.error === "audio-capture" ||
        e.error === "busy" ||
        e.error === "network") &&
      strikes.current < 3
    ) {
      strikes.current += 1;
      again(400 * strikes.current + 250);
      return;
    }
    strikes.current = 0;
    // Anything else — no permission, no microphone, no Thai — another try
    // would fail the same way, so the microphone is switched off and says so.
    toast(tr("ฟังเสียงไม่สำเร็จ ลองใหม่อีกครั้ง", "Couldn't listen. Try again."), "error");
    setMic(false);
    go("idle");
  });

  // On: ask for the microphone, find the best Thai voice, and listen. Off
  // (back to the keyboard, or the page going away): stop both halves.
  useEffect(() => {
    live.current = true;
    void (async () => {
      const can = await canDictate();
      if (!live.current) return;
      if (!can.ok) {
        toast(can.why, "error");
        go("idle");
        return;
      }
      voiced.current = await hasThaiVoice();
      if (!voiced.current)
        toast(
          tr(
            "เครื่องนี้ไม่มีเสียงอ่านภาษาไทย จะแสดงคำตอบเป็นข้อความ",
            "This device has no English voice installed. Answers will be shown as text.",
          ),
          "warning",
        );
      greet();
    })();
    return () => {
      live.current = false;
      clearHush();
      speaker.current?.stop();
      ExpoSpeechRecognitionModule.abort();
      stopSpeaking();
    };
    // `listen` reads only refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Out of listening, the voice's level falls away with it.
  useEffect(() => {
    if (phase !== "listening") level.value = withTiming(0, { duration: 200 });
  }, [phase, level]);

  /** The bar: interrupt the answer, or take a turn. */
  const tapBar = () => {
    if (phaseRef.current !== "speaking" && phaseRef.current !== "idle") return;
    feel("tick");
    if (phaseRef.current === "speaking") {
      speaker.current?.stop();
      if (underneath.current) abortRecognising();
    }
    setMic(true);
    go("listening");
    again();
  };

  const setMic = (on: boolean) => {
    mutedRef.current = !on;
    setMuted(!on);
  };

  /**
   * The microphone switch. Off: stop listening now, and do not start again
   * after the next answer. On: listen now — over the answer, if it is
   * still being read, since a carer turning the microphone on means to talk.
   */
  const toggleMic = () => {
    feel("tick");
    if (!mutedRef.current && phaseRef.current !== "idle") {
      setMic(false);
      if (phaseRef.current === "listening") {
        abortRecognising();
        go("idle");
      } else if (underneath.current) {
        abortRecognising();
      }
      return;
    }
    setMic(true);
    if (phaseRef.current === "speaking") {
      speaker.current?.stop();
      if (underneath.current) abortRecognising();
    }
    if (phaseRef.current === "speaking" || phaseRef.current === "idle") {
      go("listening");
      again();
    }
  };

  /*
    What the switch shows is what the microphone is doing: on while it
    listens, or will listen again once the answer is in; off while the bar
    waits for a tap — after a silence as much as after the carer turned it
    off — so a switch that looks on is never one that is not hearing.
  */
  const micOn = !muted && phase !== "idle";

  const exit = () => {
    feel("tick");
    live.current = false;
    clearHush();
    speaker.current?.stop();
    ExpoSpeechRecognitionModule.abort();
    stopSpeaking();
    onExit();
  };

  // What the bar says: the words as they are heard, else where it is.
  const line = phase === "listening" && heard !== "" ? heard : LABEL[phase];
  const saying = phase === "listening" && heard !== "";

  /*
    Lit while the conversation is live — listening, thinking, answering —
    and plain glass while it waits for a tap. The light belongs to a
    microphone that is open, as the home-visit scribe's does: a waiting bar
    that kept glowing would be claiming to hear something.
  */
  const lit = phase !== "idle";
  // The light moves with what is happening: brisk while it hears or
  // speaks, slow while it thinks.
  const drift = phase === "thinking" ? 0.4 : phase === "speaking" ? 1.2 : 0.9;

  const wave = (
    <VoiceWave
      mode={phase}
      level={level}
      color={lit ? "rgba(255,255,255,0.95)" : TEXT_MUTED}
      height={WAVE_H}
      still={still}
    />
  );

  /*
    The words, over the bar rather than in it — the wave has the bar to
    itself — and only while there are words: what is being heard, as it is
    said. No status line: the wave and the microphone button already show
    whether it is listening, thinking or talking, and a caption saying so
    as well was one more thing to read.
  */
  const words = saying && (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        right: 2 * (height + SPACE.sm),
        bottom: height + SPACE.sm,
        alignItems: "center",
      }}
    >
      <Glass
        blurred
        frost="milky"
        style={{
          maxWidth: "100%",
          paddingHorizontal: SPACE.md,
          paddingVertical: 6,
          borderRadius: RADIUS.capsule,
          overflow: "hidden",
        }}
      >
        <Text
          // Two lines for what is being said, one for where the talk is.
          numberOfLines={saying ? 2 : 1}
          // The newest words are the ones to see as a sentence grows.
          ellipsizeMode={saying ? "head" : "tail"}
          // Android measures a line of Thai a hair narrower than it draws it
          // under its default "highQuality" breaking, and a pill sized to
          // that measure cut the last word off ("…แตะเพื่อ"). The simple
          // strategy measures what it draws.
          textBreakStrategy="simple"
          style={{
            // A few points of slack each side: even measured "simple", a
            // Thai line can draw a touch wider than its box and wrap or
            // clip its last syllable.
            paddingHorizontal: 3,
            fontSize: saying ? 15 : 13,
            lineHeight: saying ? 21 : 18,
            fontWeight: "600",
            color: saying ? TEXT_PRIMARY : TEXT_SECONDARY,
            textAlign: "center",
          }}
        >
          {line}
        </Text>
      </Glass>
    </View>
  );

  /*
    The microphone switch, a round button of its own beside the bar, in
    the same frost as the way-out button next to it whichever way it is
    set: the glyph says on or off, and the bar beside it already lights up
    while it listens — a button changing colour as well said it twice.
  */
  const mic = (
    <Pressable
      onPress={toggleMic}
      accessibilityRole="switch"
      accessibilityLabel={tr("ไมโครโฟน", "Microphone")}
      accessibilityState={{ checked: micOn }}
    >
      <Glass
        interactive
        blurred
        frost="milky"
        style={{
          width: height,
          height,
          borderRadius: height / 2,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {micOn ? (
          <Mic size={22} color={TEXT_PRIMARY} strokeWidth={2.2} />
        ) : (
          <MicOff size={22} color={TEXT_PRIMARY} strokeWidth={2.2} />
        )}
      </Glass>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, flexDirection: "row", gap: SPACE.sm }}>
      {words}
      {/* The conversation: the wave, across the whole bar. */}
      <Pressable
        onPress={tapBar}
        accessibilityRole="button"
        accessibilityLabel={line}
        style={{ flex: 1 }}
      >
        {lit ? (
          <View
            style={{
              borderRadius: height / 2,
              // Out here, not on the capsule: that one clips to its corners.
              boxShadow: shadow({ blur: 18, y: 6, opacity: 0.28 }),
            }}
          >
            <View
              style={{
                height,
                borderRadius: height / 2,
                overflow: "hidden",
                // The ground under the light: a deep blue, not black, so
                // the gaps between the aurora's folds are still colour.
                backgroundColor: "#16306B",
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.md,
                paddingLeft: SPACE.lg,
                paddingRight: SPACE.lg,
              }}
            >
              {/*
                The aurora, drawn much taller than the bar and hung below it,
                so the bar looks through the middle of the band — all colour
                and movement — rather than its dark top edge. The scribe's
                bar, and the reason, are the same.
              */}
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: -40,
                  right: -40,
                  bottom: -60,
                  height: 200,
                }}
              >
                <Aurora
                  colorStops={["#3B9BFF", "#2EE6B6", "#9B6BFF"]}
                  speed={drift}
                  blend={0.85}
                  amplitude={1.5}
                />
              </View>
              {wave}
            </View>
          </View>
        ) : (
          <Glass
            interactive
            blurred
            frost="milky"
            style={{
              height,
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.md,
              paddingLeft: SPACE.lg,
              paddingRight: SPACE.lg,
              borderRadius: RADIUS.capsule,
              overflow: "hidden",
            }}
          >
            {wave}
          </Glass>
        )}
      </Pressable>

      {mic}

      {/* Out of the voice mode, back to the keyboard — a button of its own,
          beside the bar rather than in it. */}
      <Pressable
        onPress={exit}
        accessibilityRole="button"
        accessibilityLabel={tr("ออกจากโหมดเสียง", "Exit voice mode")}
      >
        <Glass
          interactive
          blurred
          frost="milky"
          style={{
            width: height,
            height,
            borderRadius: height / 2,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <X size={22} color={TEXT_PRIMARY} strokeWidth={2.6} />
        </Glass>
      </Pressable>
    </View>
  );
}
