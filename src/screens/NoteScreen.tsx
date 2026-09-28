import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, type RouteProp } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as DocumentPicker from "expo-document-picker";
import { useSpeechRecognitionEvent } from "expo-speech-recognition";
import {
  Bold,
  Camera,
  CaseSensitive,
  Check,
  ChevronDown,
  FileText,
  Highlighter,
  ImagePlus,
  Italic,
  List,
  ListTree,
  Mic,
  Minimize2,
  FileAudio,
  ScanText,
  Sparkles,
  SpellCheck,
  Square,
  Trash2,
  WandSparkles,
} from "lucide-react-native";

import { Glass } from "../components/Glass";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { PressableScale } from "../components/PressableScale";
import { ScreenHeader } from "../components/ScreenHeader";
import { ToolbarPill } from "../components/ToolbarPill";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  asText,
  BOX_OFF,
  BOX_ON,
  BULLET,
  diffOf,
  emptyPart,
  fitLines,
  fromText,
  lineAt,
  noteById,
  saveNote,
  segmentsOf,
  shiftSpans,
  spanCovers,
  toggleSpan,
  SIZES,
  SIZE_LABEL,
  type Emphasis,
  type LineKind,
  type Note,
  type Part,
} from "../models/notes";
import {
  readImage,
  tidy,
  TIDY_LABEL,
  TIDY_ON_SELECTION,
  type Tidy,
} from "../models/notesAi";
import {
  canDictate,
  startDictation,
  stopDictation,
  transcribeFile,
} from "../models/dictate";
import { currentDisplay } from "../models/display";
import { feel } from "../utils/haptics";
import {
  CANVAS,
  FILL_SUBTLE,
  GROUPED_BG,
  PRIMARY_500,
  RADIUS,
  SPACE,
  TEXT_DISABLED,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  shadow,
} from "../theme/tokens";

type R = RouteProp<RootStackParamList, "Note">;

/** How long after the last keystroke the page is written to the file. */
const SETTLE_MS = 600;

/**
 * Where a floating tray hangs, copied from the app's own.
 *
 * `ActionBar` keeps these numbers for the trays it draws, and this screen
 * cannot use that component — it needs Apple's glass rather than a blurred
 * plate — so it borrows the frame instead.
 */
const BAR = { side: 25, bottom: 23, height: 56, radius: 28 } as const;

/** The menu's geometry, taken from the app's own dropdown, `FilterSelect`. */
const MENU = { top: 52, pad: 8, row: 44, gap: 4, width: 220 };

/**
 * The four sizes, as type.
 *
 * Line heights are the Thai floor rather than the Latin one: a heading set
 * at 1.2 of its size clips the vowels that sit above the line and the tone
 * marks above those, which is a whole row of a Thai word gone.
 */
const SIZE_STYLE: Record<LineKind, TextStyle> = {
  title: { fontSize: 24, lineHeight: 38, fontWeight: "800" },
  heading: { fontSize: 20, lineHeight: 31, fontWeight: "700" },
  subheading: { fontSize: 17, lineHeight: 27, fontWeight: "700" },
  text: { fontSize: 16, lineHeight: 26, fontWeight: "400" },
};

/** A mark in front of each command, the way a chip carries its count. */
const TIDY_ICON: Record<Tidy, typeof Check> = {
  fix: SpellCheck,
  rewrite: WandSparkles,
  shorten: Minimize2,
  outline: ListTree,
};

/** The orange a recording is marked in, everywhere anybody has seen one. */
const RECORDING = "rgba(249,115,22,0.88)";

/** The header pill's own measurements — a two-slot `ToolbarPill`. */
const PILL = { width: 104, height: 44 } as const;

/** The highlighter — a wash, so the words stay the words. */
const MARKER = "rgba(250,204,21,0.38)";

/** The two shades a stretch alternates between while the model has it. */
const WORKING_ON = "rgba(7,125,215,0.26)";
const WORKING_OFF = "rgba(7,125,215,0.10)";

/**
 * One page of the notebook, open.
 *
 * A page is a run of writing, a picture, another run of writing. Each run
 * is ONE text field however many lines it holds — not a field per line,
 * which is what it was, and what made it impossible to drag a selection
 * across two lines of your own prose: a selection cannot leave the field
 * it started in.
 *
 * So the marks moved into the text. A bullet really begins with "• " and a
 * box with "☐ ": characters a carer can see, delete and type themselves.
 * Only the size of a line is held outside it, because a size is not
 * something a reader can see a mark for.
 *
 * Not a rich text editor. Bold in the middle of a sentence is not what a
 * carer standing at a school gate reaches for, and every control that
 * exists to offer it is a control between them and the sentence. What they
 * reach for is a list they can tick and a photograph of the form they were
 * handed.
 *
 * Nothing is saved by pressing anything. The page settles to the file six
 * hundred milliseconds after the last keystroke and again when the screen
 * closes, because the one thing a notebook must never do is lose the line
 * somebody was halfway through when they were called away.
 */
export function NoteScreen() {
  const { noteId } = useRoute<R>().params;
  const insets = useSafeAreaInsets();

  const [note, setNote] = useState<Note | undefined>(() => noteById(noteId));
  /** Which run the toolbar acts on, and where the caret is inside it. */
  const [at, setAt] = useState(0);
  const [pick, setPick] = useState({ start: 0, end: 0 });
  const [asking, setAsking] = useState(false);
  const [aim, setAim] = useState<Aim | null>(null);
  const [sizing, setSizing] = useState(false);
  const [picturing, setPicturing] = useState(false);
  const [scanning, setScanning] = useState(false);
  /** Whether the microphone's menu is open under the header. */
  const [listening, setListening] = useState(false);
  /**
   * Where dictation is putting its words.
   *
   * The caret at the moment "พูดแล้วพิมพ์ให้" was pressed. Speech arrives
   * as a guess that is corrected several times before it settles, so each
   * update has to replace the last one rather than pile up behind it —
   * which means remembering where the last one started.
   */
  const saying = useRef<{ part: number; from: number; len: number } | null>(
    null,
  );
  const [dictating, setDictating] = useState(false);
  /** True while a recording is being read through the recogniser. */
  const [reading, setReading] = useState(false);
  /** The last dozen loudness readings, which is what the bar draws. */
  const [heard, setHeard] = useState<number[]>([]);
  /** The stretch the assistant is rewriting, while it is rewriting it. */
  const [busy, setBusy] = useState<{
    part: number;
    from: number;
    to: number;
  } | null>(null);
  const [pulse, setPulse] = useState(false);
  const [keyboard, setKeyboard] = useState(0);

  const inputs = useRef<Record<string, TextInput | null>>({});
  const written = useRef<string>("");
  const noteRef = useRef<Note | undefined>(note);
  noteRef.current = note;

  useEffect(() => {
    const up = Keyboard.addListener("keyboardWillShow", (e) =>
      setKeyboard(e.endCoordinates.height),
    );
    const down = Keyboard.addListener("keyboardWillHide", () => setKeyboard(0));
    return () => {
      up.remove();
      down.remove();
    };
  }, []);

  /*
    The words as they are said, written where the cursor was.

    A recogniser corrects itself: "เยี่ยม" becomes "เยี่ยมบ้าน" becomes
    "เยี่ยมบ้านคุณยาย" over a second or so. So each result overwrites the
    stretch the last one wrote rather than being appended to it, and what
    the carer sees is a sentence forming rather than three sentences.
  */
  useSpeechRecognitionEvent("volumechange", (e) => {
    // −2 to 10 from the recogniser; speech lives in the bottom half of it.
    const level = Math.max(0, Math.min(1, (e.value + 2) / 8));
    setHeard((was) => [...was.slice(-11), level]);
  });

  useSpeechRecognitionEvent("result", (e) => {
    const spot = saying.current;
    const said = e.results?.[0]?.transcript ?? "";
    if (spot == null || said === "") return;
    const p = noteRef.current?.parts[spot.part];
    if (p == null || p.kind !== "text") return;
    const text =
      p.text.slice(0, spot.from) +
      said +
      (e.isFinal ? " " : "") +
      p.text.slice(spot.from + spot.len);
    const d = diffOf(p.text, text);
    /*
      A finished sentence is left alone, and the next one starts after it.

      The recogniser hands back one utterance at a time: it corrects the
      sentence being spoken several times, marks it final, then starts
      again from nothing for the next. Overwriting the same stretch every
      time — which is right while a sentence is still forming — threw away
      every sentence before it, so dictating a paragraph left one line.

      When a sentence is final the anchor moves past it, with a space, and
      the next one is written after it.
    */
    saying.current = e.isFinal
      ? { part: spot.part, from: spot.from + said.length + 1, len: 0 }
      : { ...spot, len: said.length };
    setNote((was) =>
      was == null
        ? was
        : {
            ...was,
            parts: was.parts.map((x, j) =>
              j === spot.part && x.kind === "text"
                ? {
                    ...x,
                    text,
                    lines: fitLines(x.lines, p.text, text),
                    spans: shiftSpans(
                      x.spans ?? [],
                      d.start,
                      d.removed,
                      d.inserted,
                    ),
                  }
                : x,
            ),
          },
    );
  });

  useSpeechRecognitionEvent("end", () => {
    saying.current = null;
    setDictating(false);
    setHeard([]);
  });
  useSpeechRecognitionEvent("error", () => {
    // Only while dictating: a failed file transcription fires this too, and says so itself.
    if (saying.current != null)
      toast("ฟังเสียงไม่สำเร็จ ลองใหม่อีกครั้ง", "error");
    saying.current = null;
    setDictating(false);
    setHeard([]);
  });

  useEffect(() => {
    if (busy == null) return;
    const beat = setInterval(() => setPulse((was) => !was), 480);
    return () => {
      clearInterval(beat);
      setPulse(false);
    };
  }, [busy]);

  /*
    Settling, rather than saving on every keystroke.

    Each save serialises the whole notebook and writes a file. Doing that
    per character turns a sentence into forty file writes and the typing
    stutters on the phone that needs it most.
  */
  useEffect(() => {
    if (note == null) return;
    const stamp = JSON.stringify({ t: note.title, p: note.parts });
    if (stamp === written.current) return;
    const timer = setTimeout(() => {
      written.current = stamp;
      saveNote(note);
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [note]);

  // And once more on the way out, for the keystroke that had not settled.
  useEffect(
    () => () => {
      const last = noteRef.current;
      if (last != null) saveNote(last);
    },
    [],
  );

  if (note == null) {
    return (
      <View style={{ flex: 1, backgroundColor: CANVAS }}>
        <ScreenHeader title="สมุดจด" />
        <Text
          style={{ padding: SPACE.lg, fontSize: 15, color: TEXT_SECONDARY }}
        >
          ไม่พบหน้านี้ในสมุด
        </Text>
      </View>
    );
  }

  const parts = note.parts;
  const put = (next: Part[]) =>
    setNote({ ...note, parts: next.length === 0 ? [emptyPart()] : next });
  const here = parts[Math.min(at, parts.length - 1)];
  const run = here?.kind === "text" ? here : undefined;
  const focus = (id: string) =>
    setTimeout(() => inputs.current[id]?.focus(), 30);

  /** One run rewritten, with its sizes and emphasis brought along. */
  const write = (i: number, text: string) => {
    const was = parts[i];
    if (was.kind !== "text") return;
    const d = diffOf(was.text, text);
    put(
      parts.map((p, j) =>
        j === i && p.kind === "text"
          ? {
              ...p,
              text,
              lines: fitLines(p.lines, was.text, text),
              spans: shiftSpans(p.spans ?? [], d.start, d.removed, d.inserted),
            }
          : p,
      ),
    );
  };

  /** Set the size of the line the caret is in. */
  const turn = (size: LineKind) => {
    feel("tick");
    if (run == null) return;
    const { index } = lineAt(run.text, pick.start);
    put(
      parts.map((p, j) =>
        j === at && p.kind === "text"
          ? {
              ...p,
              lines: p.lines.map((k, i) =>
                i === index ? (k === size ? "text" : size) : k,
              ),
            }
          : p,
      ),
    );
  };

  /**
   * A list mark put on or taken off the line the caret is in.
   *
   * The mark is two real characters at the front of the line, so putting
   * one on moves everything after it — including every emphasis drawn
   * further down the run, which is why the spans are shifted by the same
   * two as if somebody had typed them.
   */
  const listMark = (mark: string) => {
    feel("tick");
    if (run == null) return;
    const { from, to } = lineAt(run.text, pick.start);
    const line = run.text.slice(from, to);
    const had = [BULLET, BOX_OFF, BOX_ON].find((m) => line.startsWith(m));
    const body = had == null ? line : line.slice(had.length);
    const next =
      had === mark || (mark === BOX_OFF && had === BOX_ON) ? body : mark + body;
    const text = run.text.slice(0, from) + next + run.text.slice(to);
    const d = diffOf(run.text, text);
    put(
      parts.map((p, j) =>
        j === at && p.kind === "text"
          ? {
              ...p,
              text,
              spans: shiftSpans(p.spans ?? [], d.start, d.removed, d.inserted),
            }
          : p,
      ),
    );
  };

  /** Tick or untick the box on the line that was tapped. */
  const tick = (i: number, from: number) => {
    const p = parts[i];
    if (p.kind !== "text") return;
    feel("tick");
    const on = p.text.startsWith(BOX_ON, from);
    const text =
      p.text.slice(0, from) + (on ? BOX_OFF : BOX_ON) + p.text.slice(from + 2);
    put(parts.map((x, j) => (j === i ? { ...p, text } : x)));
  };

  /**
   * Turn an emphasis on or off over what is selected.
   *
   * Over the selection, not the line. A highlighter marks the words that
   * matter and a line is rarely all of them — the point of reaching for
   * one is to say which part of the sentence to come back to.
   */
  const mark = (which: Emphasis) => {
    if (run == null) return;
    const from = Math.min(pick.start, pick.end);
    const to = Math.max(pick.start, pick.end);
    if (to <= from) {
      toast("ลากเลือกข้อความที่ต้องการก่อน", "warning");
      return;
    }
    feel("tick");
    put(
      parts.map((p, j) =>
        j === at && p.kind === "text"
          ? { ...p, spans: toggleSpan(p.spans ?? [], from, to, which) }
          : p,
      ),
    );
  };

  const carrying = (which: Emphasis) =>
    run != null &&
    spanCovers(
      run.spans ?? [],
      Math.min(pick.start, pick.end),
      Math.max(pick.start, pick.end),
      which,
    );

  /** A job on the words that are selected, applied the moment it lands. */
  const runOnPick = async (kind: Tidy, spot: Aim & { scope: "pick" }) => {
    const { part: i, from, to } = spot;
    feel("tick");
    setBusy({ part: i, from, to });
    const before = parts[i];
    const out =
      before.kind === "text"
        ? await tidy(kind, before.text.slice(from, to), true)
        : null;
    setBusy(null);
    if (out == null) {
      toast("ยังติดต่อผู้ช่วยไม่ได้ ลองใหม่อีกครั้ง", "error");
      return;
    }
    /*
      Read the run back rather than closing over the one we set off with:
      the carer may have gone on typing while the model was thinking, and
      writing the version we started from would throw those keystrokes
      away.
    */
    const now = noteRef.current?.parts[i];
    if (now == null || now.kind !== "text") return;
    const text = now.text.slice(0, from) + out + now.text.slice(to);
    const d = diffOf(now.text, text);
    put(
      (noteRef.current?.parts ?? parts).map((p, j) =>
        j === i && p.kind === "text"
          ? {
              ...p,
              text,
              lines: fitLines(p.lines, now.text, text),
              spans: shiftSpans(p.spans ?? [], d.start, d.removed, d.inserted),
            }
          : p,
      ),
    );
    feel("success");
    toast("แก้ข้อความแล้ว", "success");
  };

  /**
   * Start or stop dictating into the page.
   *
   * It writes at the caret, in the run the caret is in — so a carer can
   * put the cursor in the middle of a paragraph, say the sentence that
   * belongs there, and have it land there rather than at the end.
   */
  const dictate = async () => {
    if (dictating) {
      stopDictation();
      return;
    }
    const can = await canDictate();
    if (!can.ok) {
      toast(can.why, "error");
      return;
    }
    if (run == null) {
      toast("แตะในข้อความก่อนเริ่มพูด", "warning");
      return;
    }
    feel("tick");
    saying.current = { part: at, from: pick.start, len: 0 };
    setDictating(true);
    void startDictation();
  };

  /**
   * A recording already on the phone, read onto the page.
   *
   * Whatever comes back lands as ordinary lines the carer can edit. A
   * transcription is a first draft of what was said, and the person who
   * was there is the one who can tell where it went wrong.
   */
  const readAudio = async () => {
    const can = await canDictate();
    if (!can.ok) {
      toast(can.why, "error");
      return;
    }
    const got = await DocumentPicker.getDocumentAsync({
      type: "audio/*",
      copyToCacheDirectory: true,
    });
    const file = got.assets?.[0];
    if (got.canceled || file == null) return;
    feel("tick");
    setReading(true);
    try {
      const text = await transcribeFile(file.uri);
      if (text == null) {
        toast("ถอดเสียงจากไฟล์นี้ไม่ได้", "error");
        return;
      }
      const made = fromText(text);
      put([...parts.slice(0, at + 1), made, ...parts.slice(at + 1)]);
      focus(made.id);
      feel("success");
      toast("แปลงไฟล์เสียงเป็นข้อความแล้ว", "success");
    } finally {
      setReading(false);
    }
  };

  /** Pick a picture, or take one. */
  const attach = async (from: "library" | "camera") => {
    const ok =
      from === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!ok.granted) {
      toast(
        from === "camera"
          ? "ต้องอนุญาตให้ใช้กล้องก่อน"
          : "ต้องอนุญาตให้เข้าคลังภาพก่อน",
        "error",
      );
      return null;
    }
    const got =
      from === "camera"
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.7,
          });
    const picked = got.assets?.[0];
    return got.canceled || picked == null ? null : picked.uri;
  };

  const addImage = (from: "library" | "camera") => {
    void (async () => {
      const uri = await attach(from);
      if (uri == null) return;
      const tail = emptyPart();
      put([
        ...parts.slice(0, at + 1),
        { kind: "image", id: `${Date.now()}`, uri },
        tail,
        ...parts.slice(at + 1),
      ]);
      focus(tail.id);
      toast("แนบรูปแล้ว", "success");
    })();
  };

  /**
   * A photograph of paperwork, read into the page as text.
   *
   * Shrunk before it is sent. A photograph off a modern phone is four
   * megabytes, which is five and a half once it is base64, and a request
   * that size on a village connection does not arrive.
   *
   * What comes back lands as ordinary lines the carer can edit, not as a
   * block they have to accept: a transcription is a first draft of what
   * the paper says, and the person holding the paper is the one who can
   * tell where it went wrong.
   */
  const scanImage = (from: "library" | "camera") => {
    void (async () => {
      const uri = await attach(from);
      if (uri == null) return;
      feel("tick");
      setScanning(true);
      try {
        const small = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 1400 } }],
          {
            compress: 0.6,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          },
        );
        const text =
          small.base64 == null ? null : await readImage(small.base64);
        if (text == null) {
          toast("อ่านข้อความจากภาพนี้ไม่ได้", "error");
          return;
        }
        const made = fromText(text);
        put([...parts.slice(0, at + 1), made, ...parts.slice(at + 1)]);
        focus(made.id);
        feel("success");
        toast("เพิ่มข้อความจากภาพแล้ว", "success");
      } catch {
        toast("อ่านข้อความจากภาพนี้ไม่ได้", "error");
      } finally {
        setScanning(false);
      }
    })();
  };

  const PICTURE: {
    key: string;
    label: string;
    Icon: typeof Check;
    go: () => void;
  }[] = [
    {
      key: "lib",
      label: "แนบรูปจากคลัง",
      Icon: ImagePlus,
      go: () => addImage("library"),
    },
    {
      key: "cam",
      label: "ถ่ายรูปแนบ",
      Icon: Camera,
      go: () => addImage("camera"),
    },
    {
      key: "scan",
      label: "ถ่ายเอกสารเป็นข้อความ",
      Icon: ScanText,
      go: () => scanImage("camera"),
    },
    {
      key: "read",
      label: "อ่านข้อความจากภาพ",
      Icon: FileText,
      go: () => scanImage("library"),
    },
  ];

  const lineHere =
    run == null
      ? ""
      : (() => {
          const { from, to } = lineAt(run.text, pick.start);
          return run.text.slice(from, to);
        })();

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      {/*
        The page's name, in the place a page's name goes.

        It was a field at the top of the sheet, under a header that said
        "สมุดจด" — which is the name of the notebook, not of the page.
      */}
      <ScreenHeader
        title="สมุดจด"
        titleNode={
          <TextInput
            value={note.title}
            onChangeText={(t) => setNote({ ...note, title: t })}
            placeholder="ชื่อหน้า"
            placeholderTextColor={TEXT_DISABLED}
            returnKeyType="next"
            style={{
              flex: 1,
              marginLeft: SPACE.md,
              padding: 0,
              fontSize: 20,
              lineHeight: 31,
              fontWeight: "800",
              color: TEXT_PRIMARY,
            }}
          />
        }
        right={
          dictating ? (
            /*
              While it is listening, the header IS the recording.

              A microphone that has been pressed and a microphone that is
              hearing you look identical, and the difference is the whole
              question a carer has while they are talking. So the toolbar
              gives its place up: the orange says recording the way it does
              everywhere, the bar moves with the voice, and the only thing
              left to press is the one thing there is to do.
            */
            <Glass
              tintColor={RECORDING}
              style={{
                /*
                  The toolbar's own footprint, to the point.

                  It stands where the mic-and-sparkle pill stands, and a
                  control that changes size when it changes job makes the
                  header jump at the exact moment a carer has started
                  talking and is watching to see whether it heard them.
                */
                width: PILL.width,
                height: PILL.height,
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.xs,
                paddingLeft: SPACE.sm,
                paddingRight: 4,
                borderRadius: RADIUS.capsule,
                overflow: "hidden",
              }}
            >
              <Wave levels={heard} />
              <PressableScale
                onPress={() => {
                  feel("tick");
                  stopDictation();
                }}
                accessibilityRole="button"
                accessibilityLabel="หยุดพูด"
                hitSlop={8}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255,255,255,0.26)",
                }}
              >
                <Square
                  size={13}
                  color="#FFFFFF"
                  strokeWidth={2}
                  fill="#FFFFFF"
                />
              </PressableScale>
            </Glass>
          ) : (
            <ToolbarPill
              slots={[
                {
                  icon: (
                    <Mic
                      size={20}
                      color={listening ? PRIMARY_500 : TEXT_PRIMARY}
                      strokeWidth={2.2}
                    />
                  ),
                  label: "เสียงเป็นข้อความ",
                  onPress: () => {
                    feel("tick");
                    setAsking(false);
                    setListening((was) => !was);
                  },
                },
                {
                  icon: (
                    <Sparkles size={20} color={PRIMARY_500} strokeWidth={2.2} />
                  ),
                  label: "ให้ AI ช่วย",
                  onPress: () => {
                    feel("tick");
                    const from = Math.min(pick.start, pick.end);
                    const to = Math.max(pick.start, pick.end);
                    setAim(
                      run != null && to - from >= 2
                        ? {
                            scope: "pick",
                            part: at,
                            from,
                            to,
                            text: run.text.slice(from, to),
                          }
                        : { scope: "page", text: asText(note) },
                    );
                    setAsking(true);
                  },
                },
              ]}
            />
          )
        }
      />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: SPACE.lg,
            paddingTop: HEADER_FADE,
            paddingBottom: keyboard + insets.bottom + 96,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {parts.map((p, i) =>
            p.kind === "image" ? (
              <Shot
                key={p.id}
                uri={p.uri}
                onDrop={() => {
                  put(parts.filter((_, j) => j !== i));
                  toast("เอารูปออกแล้ว", "success");
                }}
              />
            ) : (
              <Writing
                key={p.id}
                part={p}
                hold={(el) => {
                  inputs.current[p.id] = el;
                }}
                onFocus={() => setAt(i)}
                onSelect={setPick}
                onChange={(t) => write(i, t)}
                onTick={(from) => tick(i, from)}
                busy={
                  busy != null && busy.part === i
                    ? { from: busy.from, to: busy.to }
                    : undefined
                }
                pulse={pulse}
              />
            ),
          )}

          {/*
            The rest of the page, which is also the page.

            Everything below the last line is writing room: tapping it puts
            the cursor at the end, the way tapping the blank half of a
            notebook page and starting to write does.
          */}
          <Pressable
            accessibilityLabel="เขียนต่อ"
            onPress={() => {
              const last = parts[parts.length - 1];
              if (last != null && last.kind === "text") {
                focus(last.id);
                return;
              }
              const made = emptyPart();
              put([...parts, made]);
              focus(made.id);
            }}
            style={{ flexGrow: 1, minHeight: 160 }}
          />
        </ScrollView>
      </HeaderFade>

      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: BAR.side,
          right: BAR.side,
          bottom: keyboard > 0 ? keyboard + SPACE.sm : BAR.bottom,
        }}
      >
        {/*
          Reading a photograph takes a moment, and the page cannot show it.

          Everything else the assistant does happens to words that are
          already there, so they can be lit up while it works. A
          transcription has nothing on the page yet.
        */}
        {(scanning || reading || dictating) && (
          <Glass
            style={{
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.sm,
              marginBottom: SPACE.sm,
              height: 40,
              paddingHorizontal: SPACE.lg,
              borderRadius: 20,
              overflow: "hidden",
            }}
          >
            <ActivityIndicator size="small" color={TEXT_PRIMARY} />
            <Text
              style={{
                fontSize: 14,
                lineHeight: 22,
                fontWeight: "600",
                color: TEXT_PRIMARY,
              }}
            >
              {dictating
                ? "กำลังฟัง… พูดได้เลย"
                : reading
                  ? "กำลังถอดเสียงจากไฟล์…"
                  : "กำลังอ่านข้อความจากภาพ…"}
            </Text>
          </Glass>
        )}

        {/*
          The sizes, over the bar rather than cycling through it.

          Four steps a carer picks between by looking, not by pressing one
          button four times to find the one they wanted — and each shown at
          the size it gives, because "หัวข้อย่อย" means nothing until you
          can see how big it is.
        */}
        <BarMenu open={sizing} width={216} align="flex-start">
          {SIZES.map((k) => (
            <MenuRow
              key={k}
              Icon={CaseSensitive}
              label={SIZE_LABEL[k]}
              on={
                run != null &&
                run.lines[lineAt(run.text, pick.start).index] === k
              }
              style={SIZE_STYLE[k]}
              onPress={() => {
                setSizing(false);
                turn(k);
              }}
            />
          ))}
        </BarMenu>

        {/* What the picture button does, in the same glass it sits in. */}
        <BarMenu open={picturing} width={256}>
          {PICTURE.map((one) => (
            <MenuRow
              key={one.key}
              Icon={one.Icon}
              label={one.label}
              onPress={() => {
                setPicturing(false);
                one.go();
              }}
            />
          ))}
        </BarMenu>

        {/*
        The tray, and a way out of the keyboard beside it.

        The button appears only while the keyboard is up, which is the only
        time it means anything — and it is a capsule of its own rather than
        an eighth tool, because putting the keyboard away is not something
        done to the writing. Seven tools and a dismiss in one bar would
        also be eight targets across a phone, which is how a thumb aiming
        for the highlighter turns the keyboard off instead.
      */}
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}
        >
          <Glass
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              height: BAR.height,
              paddingHorizontal: SPACE.xs,
              borderRadius: BAR.radius,
              overflow: "hidden",
            }}
          >
            <Tool
              Icon={CaseSensitive}
              label="ขนาดข้อความ"
              on={sizing}
              onPress={() => {
                feel("tick");
                setPicturing(false);
                setSizing((was) => !was);
              }}
            />
            <Tool
              Icon={Bold}
              label="ตัวหนา"
              on={carrying("bold")}
              onPress={() => mark("bold")}
            />
            <Tool
              Icon={Italic}
              label="ตัวเอียง"
              on={carrying("italic")}
              onPress={() => mark("italic")}
            />
            <Tool
              Icon={Highlighter}
              label="ไฮไลต์"
              on={carrying("mark")}
              onPress={() => mark("mark")}
            />
            <Tool
              Icon={List}
              label="รายการ"
              on={lineHere.startsWith(BULLET)}
              onPress={() => listMark(BULLET)}
            />
            <Tool
              Icon={Check}
              label="เช็คลิสต์"
              on={lineHere.startsWith(BOX_OFF) || lineHere.startsWith(BOX_ON)}
              onPress={() => listMark(BOX_OFF)}
            />
            <Tool
              Icon={ImagePlus}
              label="รูปภาพและเอกสาร"
              on={picturing}
              onPress={() => {
                feel("tick");
                setSizing(false);
                setPicturing((was) => !was);
              }}
            />
          </Glass>

          {keyboard > 0 && (
            <Glass
              style={{
                width: BAR.height,
                height: BAR.height,
                borderRadius: BAR.radius,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PressableScale
                onPress={() => {
                  feel("tick");
                  Keyboard.dismiss();
                }}
                accessibilityRole="button"
                accessibilityLabel="ปิดแป้นพิมพ์"
                style={{
                  width: BAR.height,
                  height: BAR.height,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChevronDown size={22} color={TEXT_PRIMARY} strokeWidth={2.4} />
              </PressableScale>
            </Glass>
          )}
        </View>
      </View>

      {/*
        What the microphone can do, hung from the microphone.

        Neither of them runs yet, and both say what they are waiting for
        rather than nothing: they are on the menu because the work is
        known, and a button that is missing is harder to ask about than a
        button that explains itself.
      */}
      <HeadMenu
        open={listening}
        onClose={() => setListening(false)}
        width={264}
      >
        <MenuRow
          Icon={Mic}
          label={dictating ? "หยุดพูด" : "พูดแล้วพิมพ์ให้"}
          on={dictating}
          onPress={() => {
            setListening(false);
            void dictate();
          }}
        />
        <MenuRow
          Icon={FileAudio}
          label="แปลงไฟล์เสียงเป็นข้อความ"
          onPress={() => {
            setListening(false);
            void readAudio();
          }}
        />
      </HeadMenu>

      <AiSheet
        open={asking}
        aim={aim}
        onPick={(kind) => {
          if (aim?.scope !== "pick") return;
          setAsking(false);
          void runOnPick(kind, aim);
        }}
        onClose={() => setAsking(false)}
        onUse={(reply, mode) => {
          setAsking(false);
          const made = fromText(reply);
          setNote({
            ...note,
            parts: mode === "replace" ? [made] : [...note.parts, made],
          });
          // Warning on replace: everything else on the page is gone.
          if (mode === "replace") toast("แทนที่ทั้งหน้าแล้ว", "warning");
          else toast("ใช้ข้อความจาก AI แล้ว", "success");
        }}
      />
    </View>
  );
}

/**
 * The voice, as a row of bars.
 *
 * Drawn from the loudness the recogniser reports several times a second,
 * newest at the right, so it runs the way a trace does. Heights rather
 * than scales: a transform over Apple's glass stops the material drawing,
 * and this sits inside a pane of it.
 *
 * A floor under every bar, so the row is still a row when nobody is
 * speaking — a line of nothing reads as broken, and the quiet between two
 * sentences is not broken.
 */
function Wave({ levels }: { levels: number[] }) {
  // Six, not twelve. The row has half a pill to live in, and bars packed
  // tighter than they are wide stop reading as bars at all.
  const bars = 6;
  const shown = [
    ...Array.from({ length: Math.max(0, bars - levels.length) }, () => 0),
    ...levels.slice(-bars),
  ];
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 3,
        height: 24,
      }}
    >
      {shown.map((v, i) => (
        <View
          key={i}
          style={{
            width: 3,
            height: 5 + Math.round(v * 19),
            borderRadius: 2,
            backgroundColor: "rgba(255,255,255,0.92)",
          }}
        />
      ))}
    </View>
  );
}

/** A picture on the page, and the way to take it off again. */
function Shot({ uri, onDrop }: { uri: string; onDrop: () => void }) {
  return (
    <View style={{ marginVertical: SPACE.sm }}>
      <Image
        source={{ uri }}
        style={{
          width: "100%",
          height: 200,
          borderRadius: RADIUS.md,
          backgroundColor: GROUPED_BG,
        }}
        resizeMode="cover"
      />
      <Pressable
        onPress={onDrop}
        accessibilityRole="button"
        accessibilityLabel="เอารูปนี้ออก"
        hitSlop={8}
        style={{
          position: "absolute",
          top: SPACE.sm,
          right: SPACE.sm,
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.45)",
        }}
      >
        <Trash2 size={15} color="#FFFFFF" strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

/**
 * One run of writing: many lines, one field.
 *
 * The field takes styled Text children in place of a value — which is how
 * React Native draws part of a line differently from the rest of it, and
 * the only way a heading, a highlight and a plain sentence can share one
 * field. What is typed still arrives through onChangeText; the children
 * are only what it is drawn as.
 *
 * The box at the head of a checklist line is one of those children with a
 * press on it. It is a real character in the text, so it can be deleted
 * like any other — tapping it swaps ☐ for ☑ rather than doing something
 * the text does not say.
 */
function Writing({
  part,
  hold,
  onFocus,
  onSelect,
  onChange,
  onTick,
  busy,
  pulse,
}: {
  part: Part & { kind: "text" };
  hold: (el: TextInput | null) => void;
  onFocus: () => void;
  onSelect: (at: { start: number; end: number }) => void;
  onChange: (text: string) => void;
  onTick: (from: number) => void;
  busy?: { from: number; to: number };
  pulse?: boolean;
}) {
  const runs = segmentsOf(part.text, part.spans, part.lines, busy);
  let seen = 0;

  return (
    <TextInput
      ref={hold}
      multiline
      onChangeText={onChange}
      onFocus={onFocus}
      onSelectionChange={(e) => onSelect(e.nativeEvent.selection)}
      placeholder=""
      placeholderTextColor={TEXT_DISABLED}
      style={{
        paddingVertical: 0,
        fontSize: SIZE_STYLE.text.fontSize,
        lineHeight: SIZE_STYLE.text.lineHeight,
        color: TEXT_PRIMARY,
      }}
    >
      {runs.map((r, i) => {
        const size = SIZE_STYLE[r.size];
        const at = seen;
        seen += r.text.length;
        const box =
          r.text.startsWith(BOX_OFF) || r.text.startsWith(BOX_ON) ? at : null;
        return (
          <Text
            key={i}
            onPress={box == null ? undefined : () => onTick(box)}
            style={{
              fontSize: size.fontSize,
              lineHeight: size.lineHeight,
              fontWeight: r.bold ? "800" : size.fontWeight,
              fontStyle: r.italic ? "italic" : "normal",
              // Breathing, while the model has it. A stretch that changes
              // shade twice a second is the only way to say "this, here,
              // is what is being worked on" inside a field that cannot
              // hold a spinner.
              backgroundColor: r.busy
                ? pulse === true
                  ? WORKING_ON
                  : WORKING_OFF
                : r.mark
                  ? MARKER
                  : "transparent",
              color: TEXT_PRIMARY,
            }}
          >
            {r.text}
          </Text>
        );
      })}
    </TextInput>
  );
}

/**
 * One tool: a mark on the glass, and what it does to the line.
 *
 * No fill behind it. A tinted tile on Liquid Glass is a sticker stuck to
 * the material rather than a control cut into it.
 */
function Tool({
  Icon,
  label,
  on,
  onPress,
}: {
  Icon: typeof Check;
  label: string;
  /** True where the line the cursor is in already carries this. */
  on?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon
        size={20}
        color={on === true ? PRIMARY_500 : TEXT_PRIMARY}
        strokeWidth={on === true ? 2.6 : 2.1}
      />
    </PressableScale>
  );
}
/**
 * A menu that opens over the floating tray, from the button that raised it.
 *
 * The same movement as the header's dropdown and for the same reason: it
 * is the panel's SIZE that grows, never a scale or a fade, because either
 * of those puts a transform or an alpha over the glass and
 * UIVisualEffectView will not draw its material under them.
 *
 * Pinned to the bottom corner it hangs from, so it unfolds upward and away
 * from the finger, and the rows hold still while the box opens around
 * them. Two layers again: the clip that makes it unfold would cut away the
 * shadow that lifts it off the page.
 */
function BarMenu({
  open,
  width,
  align = "flex-end",
  children,
}: {
  open: boolean;
  width: number;
  align?: "flex-start" | "flex-end";
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const grow = useRef(new Animated.Value(0)).current;
  /*
    Measured rather than counted.

    It was worked out from a row count times a fixed row height, which was
    wrong the moment a row carried a heading set at twenty-four point: the
    panel stayed the height of four ordinary rows and cut the type off top
    and bottom. What the rows actually come to is what the box opens to.
  */
  const [full, setFull] = useState(0);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    const still = currentDisplay().reduceMotion;
    const anim = Animated.timing(grow, {
      toValue: open ? 1 : 0,
      duration: still ? 0 : open ? 220 : 150,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
    return () => anim.stop();
  }, [open, full, grow]);

  if (!mounted) return null;

  return (
    <View
      style={{
        alignSelf: align,
        marginBottom: SPACE.sm,
        borderRadius: 24,
        boxShadow: shadow({ blur: 20, y: 8, opacity: 0.18 }),
      }}
    >
      <Animated.View
        style={{
          width: grow.interpolate({
            inputRange: [0, 0.7, 1],
            outputRange: [0, width, width],
          }),
          height: grow.interpolate({
            inputRange: [0, 1],
            outputRange: [0, full],
          }),
          overflow: "hidden",
          borderRadius: 24,
          alignItems: align,
          justifyContent: "flex-end",
        }}
      >
        <Glass
          onLayout={(e) => setFull(e.nativeEvent.layout.height)}
          style={{
            position: "absolute",
            bottom: 0,
            [align === "flex-end" ? "right" : "left"]: 0,
            width,
            borderRadius: 24,
            overflow: "hidden",
            padding: MENU.pad,
            gap: MENU.gap,
          }}
        >
          {children}
        </Glass>
      </Animated.View>
    </View>
  );
}

/** One row of a menu over the tray — the shape `FilterSelect` gives its own. */
function MenuRow({
  Icon,
  label,
  on,
  style,
  onPress,
}: {
  Icon: typeof Check;
  label: string;
  /** Ticked, where the menu is a choice rather than a set of actions. */
  on?: boolean;
  style?: TextStyle;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="menuitem"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.sm,
        minHeight: MENU.row,
        paddingVertical: SPACE.xs,
        paddingHorizontal: SPACE.sm,
        borderRadius: RADIUS.capsule,
        // A fill, never an opacity: an alpha below 1 over the glass stops
        // the panel drawing its material.
        backgroundColor: pressed || on === true ? FILL_SUBTLE : "transparent",
      })}
    >
      <Icon size={20} color={TEXT_PRIMARY} />
      {/*
        A line height that clears Thai, whatever size the row is set at.

        Left to the font's own, the vowels above the line and the tone
        marks above those are cut off — which is what happened to the size
        menu, where a row is set at twenty-four point inside a row built
        for sixteen.
      */}
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          fontSize: 16,
          lineHeight: 25,
          color: TEXT_PRIMARY,
          ...style,
        }}
      >
        {label}
      </Text>
      {on === true && <Check size={16} color={TEXT_PRIMARY} strokeWidth={3} />}
    </Pressable>
  );
}

/**
 * A menu hung under a control in the header.
 *
 * BarMenu's twin, upside down: the same growing box for the same reason —
 * it is the panel's SIZE that moves, never a scale or a fade, because
 * either of those puts a transform or an alpha over the glass and
 * UIVisualEffectView will not draw its material under them. Pinned to the
 * top right, so it spreads down and to the left, away from the finger.
 *
 * Nothing is drawn behind it. The material shows what is BEHIND it, so a
 * wash over the page would be all it had left to sample and the panel
 * would come out a flat slab.
 */
function HeadMenu({
  open,
  width,
  onClose,
  children,
}: {
  open: boolean;
  width: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(false);
  const [full, setFull] = useState(0);
  const grow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    const still = currentDisplay().reduceMotion;
    const anim = Animated.timing(grow, {
      toValue: open ? 1 : 0,
      duration: still ? 0 : open ? 220 : 150,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
    return () => anim.stop();
  }, [open, full, grow]);

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable
        onPress={onClose}
        style={StyleSheet.absoluteFill}
        accessibilityLabel="ปิดเมนู"
      />
      {/* Two layers: the clip that makes the panel unfold would cut away
          the shadow that lifts it off the page. */}
      <View
        style={{
          position: "absolute",
          top: insets.top + SPACE.sm + MENU.top,
          right: SPACE.lg,
          borderRadius: 24,
          boxShadow: shadow({ blur: 20, y: 8, opacity: 0.18 }),
        }}
      >
        <Animated.View
          style={{
            width: grow.interpolate({
              inputRange: [0, 0.7, 1],
              outputRange: [0, width, width],
            }),
            height: grow.interpolate({
              inputRange: [0, 1],
              outputRange: [0, full],
            }),
            overflow: "hidden",
            borderRadius: 24,
            alignItems: "flex-end",
          }}
        >
          <Glass
            onLayout={(e) => setFull(e.nativeEvent.layout.height)}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width,
              borderRadius: 24,
              overflow: "hidden",
              padding: MENU.pad,
              gap: MENU.gap,
            }}
          >
            {children}
          </Glass>
        </Animated.View>
      </View>
    </View>
  );
}

/** What the assistant has been pointed at. */
type Aim =
  | { scope: "page"; text: string }
  | { scope: "pick"; part: number; from: number; to: number; text: string };

/**
 * The jobs the model will do, as a menu hung from the sparkle.
 *
 * It opens the way `FilterSelect` opens, and for the reason written there:
 * it is the panel's SIZE that moves, not a scale and not a fade. Either of
 * those would put a transform or an alpha above the glass, and
 * UIVisualEffectView refuses to draw its material under both — the panel
 * would be an empty outline for as long as the animation ran. Both axes
 * open at once from nothing, width a touch ahead of height, and because
 * the box is pinned to its top right the panel spreads down and to the
 * left, away from the finger.
 *
 * Nothing is drawn behind it. The material shows what is BEHIND it, so a
 * wash over the page would be all it had left to sample and the panel
 * would come out a flat slab — which is what a dimming sheet here did.
 * The filter chips say the same thing about themselves.
 *
 * A stretch of a line is worked on the moment a job is chosen. A whole
 * page waits to be read first: replacing everything somebody wrote is not
 * undone by looking at it afterwards.
 */
function AiSheet({
  open,
  aim,
  onPick,
  onClose,
  onUse,
}: {
  open: boolean;
  aim: Aim | null;
  /** A job for a stretch of a line — run and applied by the caller at once. */
  onPick: (kind: Tidy) => void;
  onClose: () => void;
  onUse: (text: string, mode: "replace" | "append") => void;
}) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<Tidy | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  // Kept in the tree through the closing animation, so the panel is not
  // yanked away the instant it starts folding.
  const [mounted, setMounted] = useState(false);
  const grow = useRef(new Animated.Value(0)).current;

  const onSome = aim?.scope === "pick";
  const jobs: Tidy[] = onSome
    ? TIDY_ON_SELECTION
    : ["fix", "rewrite", "shorten", "outline"];
  const full =
    MENU.pad * 2 + jobs.length * MENU.row + (jobs.length - 1) * MENU.gap;

  useEffect(() => {
    if (open) {
      setMounted(true);
      setReply(null);
    }
  }, [open, aim]);

  useEffect(() => {
    const still = currentDisplay().reduceMotion;
    const anim = Animated.timing(grow, {
      toValue: open ? 1 : 0,
      duration: still ? 0 : open ? 220 : 150,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
    return () => anim.stop();
  }, [open, full, grow]);

  const run = async (kind: Tidy) => {
    if (aim == null) return;
    if (aim.scope === "pick") {
      onPick(kind);
      return;
    }
    feel("tick");
    setBusy(kind);
    setReply(null);
    const out = await tidy(kind, aim.text, false);
    setBusy(null);
    if (out == null) {
      toast("ยังติดต่อผู้ช่วยไม่ได้ ลองใหม่อีกครั้ง", "error");
      return;
    }
    setReply(out);
  };

  if (!mounted) return null;

  const height = grow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, full],
  });
  // Width opens a touch ahead of height, so the panel reads as a shape
  // spreading rather than as a box being dragged out by its corner.
  const width = grow.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0, MENU.width, MENU.width],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Catches the tap that puts the menu away, and paints nothing. */}
      <Pressable
        onPress={onClose}
        style={StyleSheet.absoluteFill}
        accessibilityLabel="ปิดเมนู"
      />

      {/* Two layers: the clip that makes the panel unfold would cut away
          the shadow that lifts it off the page. The outer casts, the inner
          clips. */}
      <View
        style={{
          position: "absolute",
          top: insets.top + SPACE.sm + MENU.top,
          right: SPACE.lg,
          borderRadius: 24,
          boxShadow: shadow({ blur: 20, y: 8, opacity: 0.18 }),
        }}
      >
        <Animated.View
          style={{
            width,
            height,
            overflow: "hidden",
            borderRadius: 24,
            alignItems: "flex-end",
          }}
        >
          {/* Pinned to the corner it grows from, so the rows hold still
              while the box opens around them. */}
          <Glass
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: MENU.width,
              borderRadius: 24,
              overflow: "hidden",
              padding: MENU.pad,
              gap: MENU.gap,
            }}
          >
            {jobs.map((k) => {
              const Mark = TIDY_ICON[k];
              return (
                <Pressable
                  key={k}
                  onPress={() => void run(k)}
                  disabled={busy != null}
                  accessibilityRole="menuitem"
                  accessibilityLabel={TIDY_LABEL[k]}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.sm,
                    height: MENU.row,
                    paddingHorizontal: SPACE.sm,
                    borderRadius: RADIUS.capsule,
                    // A fill, never an opacity: an alpha below 1 anywhere
                    // above the glass stops the panel drawing its material.
                    backgroundColor: pressed ? FILL_SUBTLE : "transparent",
                  })}
                >
                  <Mark size={20} color={TEXT_PRIMARY} />
                  <Text
                    numberOfLines={1}
                    style={{ flex: 1, fontSize: 16, color: TEXT_PRIMARY }}
                  >
                    {TIDY_LABEL[k]}
                  </Text>
                  {busy === k && (
                    <ActivityIndicator size="small" color={TEXT_PRIMARY} />
                  )}
                </Pressable>
              );
            })}
          </Glass>
        </Animated.View>
      </View>

      {/* What a whole-page job gave back, under the menu it came from. */}
      {reply != null && (
        <View
          style={{
            position: "absolute",
            top: insets.top + SPACE.sm + MENU.top + full + SPACE.sm,
            right: SPACE.lg,
            width: MENU.width + 72,
            gap: SPACE.sm,
          }}
        >
          <Glass
            style={{
              padding: SPACE.lg,
              borderRadius: 24,
              overflow: "hidden",
            }}
          >
            <ScrollView style={{ maxHeight: 180 }}>
              <Text
                style={{ fontSize: 15, lineHeight: 24, color: TEXT_SECONDARY }}
              >
                {reply}
              </Text>
            </ScrollView>
          </Glass>

          <View style={{ flexDirection: "row", gap: SPACE.sm }}>
            <Pressable
              onPress={() => onUse(reply, "append")}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flex: 1,
                height: 44,
                borderRadius: RADIUS.md,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: pressed ? FILL_SUBTLE : GROUPED_BG,
              })}
            >
              <Text
                style={{ fontSize: 15, fontWeight: "600", color: TEXT_PRIMARY }}
              >
                เพิ่มต่อท้าย
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onUse(reply, "replace")}
              accessibilityRole="button"
              style={{
                flex: 1,
                height: 44,
                borderRadius: RADIUS.md,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: PRIMARY_500,
              }}
            >
              <Text
                style={{ fontSize: 15, fontWeight: "700", color: "#FFFFFF" }}
              >
                ใช้แทนของเดิม
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
