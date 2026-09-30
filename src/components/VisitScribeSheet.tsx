import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Check,
  ChevronDown,
  ChevronRight,
  History,
  Pause,
  Play,
} from "lucide-react-native";

import { ActionBar, PrimaryAction, SecondaryAction } from "./ActionBar";
import { BlurStage } from "./BlurStage";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";

import { Aurora } from "./Aurora";
import { Chevron } from "./Chevron";
import { Glass } from "./Glass";
import { toast } from "./Toast";
import { UIcon } from "./UIcon";
import { thaiTime } from "../utils/thaiDate";
import { tr } from "../i18n";
import {
  LiveActivity,
  type ScribeActivityState,
} from "../../modules/live-activity";
import {
  SCRIBE_SECONDS,
  SCRIBE_TOPICS,
  SCRIBE_TRANSCRIPT,
  scribeDraft,
  type Turn,
  addScribeRecord,
  useScribeHistory,
  type ScribeRecord,
} from "../models/visitScribe";
import {
  FILL_SUBTLE,
  PANEL,
  PRIMARY_100,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  SUCCESS,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  SURFACE,
  RIM_LIT,
  GLASS_NEUTRAL,
  shadow,
} from "../theme/tokens";
import { GUTTER, useLayout } from "../theme/layout";

/** The widest the folded bar grows, on a tablet. */
const PILL_MAX = 560;

/** Where the assistant is. */
/** Where the sheet is: listening, reading a draft back, or looking through the past ones. */
type Stage = "listening" | "review" | "history";

/** The sections the draft is written into, in the order the form has them. */
const DRAFT_ORDER: { key: string; label: string }[] = [
  { key: "history", label: tr("การซักประวัติ", "History") },
  { key: "exam", label: tr("การตรวจร่างกายเบื้องต้น", "Basic physical examination") },
  { key: "psychosocial", label: tr("การประเมินด้านจิตใจและสังคม", "Psychosocial assessment") },
  { key: "problems", label: tr("ปัญหาที่พบ", "Problems found") },
  { key: "plan", label: tr("แผนการดูแล", "Care plan") },
  { key: "advice", label: tr("การให้ความรู้และข้อแนะนำ", "Education and advice") },
  { key: "summary", label: tr("สรุปผลการเยี่ยม", "Visit summary") },
];

/**
 * The assistant that listens to the visit and drafts the write-up.
 *
 * Two halves, one after the other. While the conversation is happening it
 * is a checklist: which of the subjects a visit must cover have come up —
 * the list is there for the one at the bottom that always gets forgotten,
 * and it ticks itself off rather than asking to be ticked, because a carer
 * tapping a checklist is a carer not looking at the patient.
 *
 * Then it is a draft. Every section the form has, written out, and a button
 * that fills them in. Nothing reaches the form before that button: a draft
 * that wrote itself into the boxes and left the carer to find the mistakes
 * afterwards would be worse than no draft, because the mistakes would be in
 * the record under their name.
 */
export function VisitScribeSheet({
  authenCode,
  patient,
  active,
  shown,
  onHide,
  onShow,
  onEnd,
  onFill,
  onInset,
}: {
  /** The visit this belongs to; its conversations are kept under it. */
  authenCode: string;
  /** Whose visit, for the island's banner. */
  patient: string;
  /** A session exists — it is listening or holding a draft. */
  active: boolean;
  /** The sheet is on screen. Off while minimised; the session runs on. */
  shown: boolean;
  /** Fold the sheet away and keep listening. */
  onHide: () => void;
  /** Bring it back from the pill. */
  onShow: () => void;
  /** The session is over, used or discarded. */
  onEnd: () => void;
  /** Hand the confirmed draft to the form, keyed by its own fields. */
  onFill: (values: Record<string, string>) => void;
  /**
   * How much of the top of the page the floating question card is taking,
   * in points — nought when there is none. The page pushes its content down
   * by this much so the card sits *over* the header's gap and not over the
   * first thing the carer was reading.
   */
  onInset?: (px: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState<Stage>("listening");
  const [at, setAt] = useState(0);
  const [paused, setPaused] = useState(false);
  /** The draft on the review page — this conversation's, or an older one's. */
  const [reading, setReading] = useState<ScribeRecord | null>(null);
  /** Where the history page was opened from, so "back" is back. */
  const [cameFrom, setCameFrom] = useState<Stage>("listening");
  const past = useScribeHistory(authenCode);
  const scroll = useRef<ScrollView>(null);
  /** How tall the floating checklist is, so the chat starts under it. */
  const [topH, setTopH] = useState(0);
  /** How tall the scroll is, so the fade can be placed in fractions of it. */
  const [scrollH, setScrollH] = useState(0);

  /*
    The clock the conversation arrives on.

    Tied to the *session*, not to the sheet: a carer who folds the sheet away
    to glance at the form has not stopped the patient talking, and a clock
    that reset every time the sheet came back would lose the conversation
    in the gap. It starts when a session starts and ends when one ends, and
    whether the sheet is showing is none of its business.

    It can be held. Held, it stops counting and the transcript stops
    arriving — which is what "stop listening" has to mean, or the button is
    a lie — and it picks up from where it was, not from the top.
  */
  const elapsed = useRef(0);
  const pausedRef = useRef(false);
  useEffect(() => {
    if (!active) return;
    setStage("listening");
    setReading(null);
    setPaused(false);
    pausedRef.current = false;
    elapsed.current = 0;
    setAt(0);
    let last = Date.now();
    const tick = setInterval(() => {
      const now = Date.now();
      if (!pausedRef.current) elapsed.current += (now - last) / 1000;
      last = now;
      setAt(elapsed.current);
      if (elapsed.current >= SCRIBE_SECONDS) {
        clearInterval(tick);
        finish(elapsed.current);
      }
    }, 250);
    return () => clearInterval(tick);
    // `finish` reads only refs and setters; the session is the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  /*
    The conversation is over: write it up and keep it.

    Kept *before* the carer sees it, not after they accept it. "ไม่ใช้" on
    the review page means "not into the form now", and a draft that
    vanished on that tap would make the carer keep it in the form to keep
    it at all. It goes into the history either way, and the review page
    is just the first look at it.
  */
  const finish = (seconds: number) => {
    pausedRef.current = true;
    const record = addScribeRecord(authenCode, seconds, scribeDraft());
    toast(
      tr(
        "สรุปการสนทนาแล้ว ตรวจสอบก่อนเติมลงฟอร์ม",
        "Conversation summarized. Review it before filling the form.",
      ),
      "info",
    );
    setReading(record);
    setCameFrom("listening");
    setStage("review");
  };

  const hold = (on: boolean) => {
    pausedRef.current = on;
    setPaused(on);
  };

  const cardShowing = active && !shown && stage === "listening";
  useEffect(() => {
    if (!cardShowing) onInset?.(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardShowing]);

  /* Reading an older draft, reached through the history page. */
  const fromHistory = stage === "review" && cameFrom === "history";
  const said = SCRIBE_TRANSCRIPT.filter((t) => t.at <= at);
  /* Whoever speaks next, so the gap between sentences has something in it. */
  const next = SCRIBE_TRANSCRIPT.find((t) => t.at > at) ?? null;
  const covered = new Set(said.map((t) => t.covers).filter(Boolean));

  /*
    The Dynamic Island, kept in step with the session.

    Up for as long as a session is running — whether the sheet is open or
    folded — and told about every change the pill would show: a hold, a
    resume, the draft being ready. It had been started only on folding,
    which meant leaving the app straight from the open sheet left nothing
    in the island; and the island is hidden by iOS while the app is in
    front anyway, so an activity that runs alongside the open sheet costs
    nothing and is there the moment the carer swipes away. The clock is
    not sent tick by tick; the island is given the moment listening
    started and counts by itself.
  */
  const island = useRef<ScribeActivityState | null>(null);
  const frame = (): ScribeActivityState => ({
    phase: stage !== "listening" ? "ready" : paused ? "paused" : "listening",
    startedAt: Date.now(),
    carried: elapsed.current,
    covered: covered.size,
    total: SCRIBE_TOPICS.length,
  });
  useEffect(() => {
    if (!active) {
      if (island.current != null) {
        island.current = null;
        void LiveActivity.end();
      }
      return;
    }
    const next = frame();
    if (island.current == null) {
      island.current = next;
      // Said in the console while this is new, so a phone that shows no
      // island can be told apart from an activity that never started.
      void LiveActivity.start(patient, next).then((ok) => {
        if (!__DEV__) return;
        console.log(
          `[island] start → ${ok ? "ok" : "refused"} (available: ${LiveActivity.isAvailable()})`,
        );
      });
      return;
    }
    // Only when something the island shows has changed — not on every tick.
    const was = island.current;
    if (was.phase !== next.phase || was.covered !== next.covered) {
      island.current = next;
      void LiveActivity.update(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stage, paused, covered.size]);

  return (
    <>
      {active && !shown && stage === "listening" && (
        <Prompt
          covered={covered}
          top={insets.top}
          paused={paused}
          onHeight={(h) => onInset?.(h + SPACE.md)}
        />
      )}
      {active && !shown && (
        <Pill
          stage={stage}
          at={at}
          paused={paused}
          onPress={onShow}
          onHold={() => hold(true)}
          onResume={() => hold(false)}
        />
      )}

      <Modal
        visible={active && shown}
        animationType="slide"
        presentationStyle="pageSheet"
        supportedOrientations={["portrait", "landscape"]}
        onRequestClose={onHide}
      >
        <BlurStage>
          {/*
          The assistant's own surface, not a page of the record.

          Every sheet in this app that is the assistant wears this and every
          sheet that is not wears the plain canvas: an aurora behind, Apple's
          glass in front of it, and white plates floating on the glass. It is
          what says — before a word is read — that what is on this sheet was
          written by a model and has to be checked. This one had been built on
          the reject sheet's chrome, which says the opposite.

          Nothing OPAQUE may sit behind the glass or it has only that colour
          to refract. The aurora is the exception and the reason: it is behind
          the material rather than on it, so the sheet refracts the light
          instead of merely showing it.
        */}
          <View style={{ flex: 1 }}>
            <View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                // The lower half only: the shader's band forms along the bottom
                // edge of whatever it is given and thins upward.
                height: "55%",
              }}
            >
              {/* Mounted with the sheet, not with the screen: it is a running
                render loop, and one behind a sheet nobody has opened is a
                warm phone for nothing. */}
              {active && shown && (
                <Aurora
                  colorStops={["#339FF3", "#46D8AD", "#7C5CFF"]}
                  speed={0.45}
                  blend={0.62}
                  amplitude={0.9}
                />
              )}
            </View>

            <Glass style={StyleSheet.absoluteFill}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: GUTTER,
                  paddingTop: SPACE.lg,
                  paddingBottom: SPACE.md,
                }}
              >
                {/*
                Fold, not close.

                An X on a sheet that is recording says "stop": the carer
                taps it to check the form and the conversation is gone. This
                tucks the sheet away and leaves the session running, with a
                pill on the form to come back by — the way a phone call
                minimises rather than hangs up. Ending the session is the
                secondary button at the foot, where it is a decision and not
                a reflex.

                Not a glass button: glass on glass has only the sheet to
                refract and both flatten. The design's field fill instead.
              */}
                <Pressable
                  onPress={onHide}
                  accessibilityRole="button"
                  accessibilityLabel={tr("ย่อหน้าต่าง", "Minimize")}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: FILL_SUBTLE,
                  }}
                >
                  <ChevronDown size={24} color={TEXT_PRIMARY} strokeWidth={2.6} />
                </Pressable>
                <Text
                  style={{
                    flex: 1,
                    textAlign: "center",
                    fontSize: 16,
                    fontWeight: "600",
                    color: TEXT_PRIMARY,
                  }}
                >
                  {stage === "listening"
                    ? tr("ผู้ช่วยบันทึกการเยี่ยม", "Visit scribe")
                    : stage === "history"
                      ? tr("ประวัติการสนทนา", "Conversation history")
                      : fromHistory && reading != null
                        ? tr(`สรุปสนทนาครั้งที่ ${reading.n}`, `Conversation ${reading.n} summary`)
                        : tr("ตรวจสอบก่อนบันทึก", "Review before saving")}
                </Text>
                {/*
                The past conversations, in the corner the close button's
                counterweight used to hold. Same shape as the fold button, so
                the header stays a pair; it goes quiet — not gone — while the
                history page itself is showing, because a button to the page
                you are on is a button that does nothing.
              */}
                <Pressable
                  onPress={() => {
                    if (stage === "history") return;
                    setCameFrom(stage);
                    setStage("history");
                  }}
                  disabled={stage === "history"}
                  accessibilityRole="button"
                  accessibilityLabel={tr(
                    `ประวัติการสนทนา ${past.length} รายการ`,
                    `Conversation history, ${past.length} item${past.length === 1 ? "" : "s"}`,
                  )}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: FILL_SUBTLE,
                    opacity: stage === "history" ? 0.4 : 1,
                  }}
                >
                  <History size={21} color={TEXT_PRIMARY} strokeWidth={2.4} />
                  {past.length > 0 && stage !== "history" && (
                    <View
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        minWidth: 16,
                        height: 16,
                        paddingHorizontal: 4,
                        borderRadius: 8,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: PRIMARY_500,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          lineHeight: 12,
                          fontWeight: "700",
                          color: "#FFFFFF",
                        }}
                      >
                        {past.length}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </View>

              {/*
            The questions, pinned.

            They were the first card in the scroll, and the transcript pushed
            them off the top within a minute — which is exactly when the carer
            needs them, because the one thing this list is for is the subject
            at the bottom that has not come up yet. Here they stay put and the
            conversation scrolls underneath. Compressed to one line a subject,
            with the prompt shown only for the next one to raise, so the pinned
            block is a glance and not half the screen.
          */}
              <View
                style={{ flex: 1 }}
                onLayout={(e) => setScrollH(e.nativeEvent.layout.height)}
              >
                {/*
            Floating, not stacked. The checklist sits *over* the conversation
            rather than above it: the scroll runs the full height of the sheet
            and starts its content below the box, so the first lines are clear
            of it and every line after that passes underneath on its way up.
            The box is measured rather than guessed at, because its height
            moves with whichever subject is carrying the prompt.
          */}
                {stage === "listening" && (
                  <View
                    pointerEvents="box-none"
                    onLayout={(e) => setTopH(e.nativeEvent.layout.height)}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      zIndex: 3,
                    }}
                  >
                    <Topics covered={covered} />
                  </View>
                )}

                {/*
            The conversation fades as it climbs into the box, rather than
            sliding under it. A mask on the scroll, clear where the box is
            and solid a short way beneath it, so a bubble on its way up thins
            to nothing in the last few points before the box's edge — the
            box then has nothing passing behind it, and the plate stays a
            plate. In fractions of the scroll's own height, which is why
            that height is measured.
          */}
                <MaskedView
                  style={{ flex: 1 }}
                  maskElement={
                    <LinearGradient
                      style={{ flex: 1 }}
                      colors={["transparent", "transparent", "#000", "#000"]}
                      locations={
                        stage === "listening" && scrollH > 0
                          ? [
                              0,
                              Math.max(0, (topH - SPACE.sm - 6) / scrollH),
                              Math.min(1, (topH + 30) / scrollH),
                              1,
                            ]
                          : [0, 0, 0, 1]
                      }
                    />
                  }
                >
                  <ScrollView
                    ref={scroll}
                    onContentSizeChange={() =>
                      stage === "listening" &&
                      scroll.current?.scrollToEnd({ animated: true })
                    }
                    contentContainerStyle={{
                      paddingVertical: SPACE.lg,
                      paddingHorizontal: GUTTER,
                      gap: SPACE.md,
                      paddingTop:
                        stage === "listening" ? topH + SPACE.xs : SPACE.lg,
                      paddingBottom: insets.bottom + 96,
                    }}
                    showsVerticalScrollIndicator={false}
                  >
                    {stage === "listening" ? (
                      <>
                        {/* What has been said, and who is about to say the next
                    thing. */}
                        <View style={{ marginTop: SPACE.xs }}>
                          {said.map((turn, i) => (
                            <Said
                              key={i}
                              turn={turn}
                              first={i === 0 || said[i - 1].who !== turn.who}
                              last={
                                i === said.length - 1 ||
                                said[i + 1].who !== turn.who
                              }
                              fresh={i === said.length - 1}
                            />
                          ))}
                          {next != null && !paused && <Typing who={next.who} />}
                        </View>
                      </>
                    ) : stage === "history" ? (
                      <>
                        {past.length === 0 ? (
                          <Panel>
                            <Text
                              style={{
                                fontSize: 14,
                                lineHeight: 22,
                                color: TEXT_MUTED,
                                textAlign: "center",
                              }}
                            >
                              {tr(
                                "ยังไม่มีการสนทนาที่สรุปไว้ในการเยี่ยมครั้งนี้",
                                "No conversations summarized for this visit yet",
                              )}
                            </Text>
                          </Panel>
                        ) : (
                          [...past].reverse().map((record) => {
                            const mm = Math.floor(record.seconds / 60);
                            const ss = Math.floor(record.seconds % 60);
                            return (
                              <Pressable
                                key={record.id}
                                onPress={() => {
                                  setReading(record);
                                  setCameFrom("history");
                                  setStage("review");
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={tr(`สรุปสนทนาครั้งที่ ${record.n}`, `Conversation ${record.n} summary`)}
                                style={({ pressed }) => ({
                                  opacity: pressed ? 0.7 : 1,
                                })}
                              >
                                <Panel style={{ gap: 6 }}>
                                  <View
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      gap: SPACE.sm,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        flex: 1,
                                        fontSize: 14,
                                        lineHeight: 20,
                                        fontWeight: "600",
                                        color: TEXT_PRIMARY,
                                      }}
                                    >
                                      {tr(`สนทนาครั้งที่ ${record.n}`, `Conversation ${record.n}`)}
                                    </Text>
                                    <Text
                                      style={{
                                        fontSize: 12,
                                        lineHeight: 18,
                                        color: TEXT_MUTED,
                                      }}
                                    >
                                      {`${thaiTime(record.endedAt)} · ${mm}:${String(ss).padStart(2, "0")}`}
                                    </Text>
                                    <Chevron />
                                  </View>
                                  <Text
                                    numberOfLines={2}
                                    style={{
                                      fontSize: 14,
                                      lineHeight: 21,
                                      color: TEXT_SECONDARY,
                                    }}
                                  >
                                    {record.draft.summary}
                                  </Text>
                                </Panel>
                              </Pressable>
                            );
                          })
                        )}
                      </>
                    ) : (
                      <>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: SPACE.sm,
                            paddingHorizontal: SPACE.xs,
                          }}
                        >
                          <UIcon name="sparkles" size={16} color={PRIMARY_500} />
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "700",
                              letterSpacing: 0.6,
                              color: TEXT_SECONDARY,
                              textTransform: "uppercase",
                            }}
                          >
                            {tr("ร่างโดยผู้ช่วย AI", "Drafted by AI assistant")}
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontSize: 12,
                            lineHeight: 18,
                            color: TEXT_MUTED,
                          }}
                        >
                          {fromHistory
                            ? tr(
                                "สรุปจากการสนทนาครั้งก่อน อ่านและยืนยันเพื่อนำมาเติมในแบบฟอร์มได้เช่นกัน",
                                "Summarized from an earlier conversation. Read and confirm to fill it into the form too.",
                              )
                            : tr(
                                "อ่านและแก้ไขได้ก่อนยืนยัน เมื่อยืนยันแล้วข้อความจะไปเติมในแบบฟอร์มให้อัตโนมัติ",
                                "Read and edit before confirming. Once confirmed, the text fills the form automatically.",
                              )}
                        </Text>
                        {DRAFT_ORDER.map((section) => (
                          <Panel key={section.key} style={{ gap: SPACE.sm }}>
                            <Text
                              style={{
                                fontSize: 12,
                                lineHeight: 18,
                                fontWeight: "600",
                                color: PRIMARY_500,
                              }}
                            >
                              {section.label}
                            </Text>
                            <Text
                              style={{
                                fontSize: 14,
                                lineHeight: 22,
                                color: TEXT_PRIMARY,
                              }}
                            >
                              {reading?.draft[section.key]}
                            </Text>
                          </Panel>
                        ))}
                      </>
                    )}

                    {/*
              Said on the screen, not only in the code: the carer is the one
              who signs the record, so they are the one who should know what
              the assistant did and did not do.
            */}
                    <Text
                      style={{
                        fontSize: 12,
                        lineHeight: 20,
                        color: TEXT_MUTED,
                        textAlign: "center",
                      }}
                    >
                      {tr(
                        "ผู้ช่วย AI ถอดเสียงและร่างข้อความจากการสนทนาเท่านั้น ไม่ใช่คำวินิจฉัย และไม่มีข้อความใดถูกบันทึกจนกว่าจะกดยืนยัน",
                        "The AI assistant only transcribes and drafts from the conversation. It is not a diagnosis, and nothing is saved until you confirm.",
                      )}
                    </Text>
                  </ScrollView>
                </MaskedView>
              </View>

              {stage === "listening" ? (
                paused ? (
                  /* Held: the two things that can happen next, and nothing moving. */
                  <ActionBar>
                    <PrimaryAction
                      label={tr("ให้ AI ฟังต่อ", "Resume listening")}
                      onPress={() => hold(false)}
                    />
                    <SecondaryAction
                      label={tr("จบการสนทนา", "End conversation")}
                      onPress={() => finish(elapsed.current)}
                    />
                  </ActionBar>
                ) : (
                  <VoiceBar onHold={() => hold(true)} />
                )
              ) : (
                <ActionBar>
                  {stage === "history" ? (
                    <SecondaryAction
                      label={tr("กลับ", "Back")}
                      onPress={() =>
                        setStage(cameFrom === "history" ? "listening" : cameFrom)
                      }
                    />
                  ) : (
                    <>
                      <PrimaryAction
                        label={tr("ยืนยันและเติมลงฟอร์ม", "Confirm and fill form")}
                        onPress={() => {
                          if (reading != null) onFill(reading.draft);
                          onEnd();
                        }}
                      />
                      <SecondaryAction
                        label={fromHistory ? tr("กลับ", "Back") : tr("ไม่ใช้", "Discard")}
                        onPress={() => {
                          if (fromHistory) {
                            setStage("history");
                            return;
                          }
                          onEnd();
                          toast(tr("ไม่ใช้ร่างนี้ · เก็บไว้ในประวัติแล้ว", "Draft discarded · Kept in history"), "info");
                        }}
                      />
                    </>
                  )}
                </ActionBar>
              )}
            </Glass>
          </View>
        </BlurStage>
      </Modal>
    </>
  );
}

/**
 * The floating bar while the assistant is listening.
 *
 * It was a single "end" button on the app's white tray, which said nothing
 * about what the sheet was doing. This is the microphone: a dark aurora —
 * the assistant's own light, turned down to the depth a recording light
 * has — with the voice moving across it and one button to hold it. Held,
 * the bar goes back to being the tray, with the two things that can
 * happen next as two ordinary buttons; the light and the movement belong
 * to *listening*, and a paused recorder that kept glowing would be
 * claiming to hear something.
 *
 * Same frame as `ActionBar` — 25 in, 23 up, 36 round, 64 tall — so it sits
 * exactly where the tray sits and swaps in place.
 */
function VoiceBar({ onHold }: { onHold: () => void }) {
  const BARS = 22;
  const wave = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(wave, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [wave]);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 25,
        right: 25,
        bottom: 23,
        // The bar's own corners: a shadow takes the shape of the view that
        // casts it, and this one's child is the rounded bar.
        borderRadius: 36,
        boxShadow: shadow({ blur: 18, y: 6, opacity: 0.28 }),
      }}
    >
      <View
        style={{
          height: 64,
          borderRadius: 36,
          overflow: "hidden",
          // The ground under the light: a deep blue, not black, so the gaps
          // between the aurora's folds are still colour.
          backgroundColor: "#16306B",
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: SPACE.xl,
          paddingRight: SPACE.sm,
          gap: SPACE.md,
        }}
      >
        {/*
          The aurora, drawn much taller than the bar and hung below it.

          The shader forms its band along the bottom edge of whatever box it
          is given and thins upward. In a box the height of the bar that put
          the bright part in the bottom few points and the dark base
          everywhere else, which read as a black bar with a glow at its
          foot. Given a box three times the height with its foot pushed
          under the bar, the bar looks through the *middle* of the band —
          the part that is all colour and all movement.
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
            // The assistant's three lights at full strength — the sheet's
            // own stops, brightened rather than darkened — because this is
            // the one place the light is the whole point of the surface.
            colorStops={["#3B9BFF", "#2EE6B6", "#9B6BFF"]}
            speed={0.9}
            blend={0.85}
            amplitude={1.5}
          />
        </View>

        {/* The voice, across the bar. */}
        <View
          pointerEvents="none"
          style={{
            flex: 1,
            height: 32,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {Array.from({ length: BARS }, (_, i) => {
            // Louder in the middle, the way a waveform display draws a
            // voice; the ends are what the room sounds like between words.
            const mid = 1 - Math.abs(i - (BARS - 1) / 2) / ((BARS - 1) / 2);
            const reach = 0.25 + mid * 0.75;
            return (
              <Animated.View
                key={i}
                style={{
                  width: 3,
                  height: 28,
                  borderRadius: 2,
                  backgroundColor: "rgba(255,255,255,0.9)",
                  transform: [
                    {
                      scaleY: phased(
                        wave,
                        (i * 0.37) % 1,
                        [0.18, 0.9, 0.35, 1, 0.5, 0.18],
                        reach,
                      ),
                    },
                  ],
                }}
              />
            );
          })}
        </View>

        {/* Hold. */}
        <Pressable
          onPress={onHold}
          accessibilityRole="button"
          accessibilityLabel={tr("หยุดฟังชั่วคราว", "Pause listening")}
          style={({ pressed }) => ({
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? "rgba(255,255,255,0.8)" : "#FFFFFF",
          })}
        >
          <Pause size={20} color="#0B1220" strokeWidth={2.6} fill="#0B1220" />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * The next thing to ask, on the form, one at a time.
 *
 * The sheet shows the whole list; the form, with the sheet folded, shows
 * only the subject that has not come up yet — the one the carer should be
 * steering toward now. One question is something a carer can hold in mind
 * while looking at a patient; six is a list they have to look down at.
 *
 * It does not simply jump when a subject is covered. The card first
 * *ticks* — the number becomes a check, the ink turns green, "คุยแล้ว" —
 * and holds like that for a moment before sliding away and the next one
 * sliding in. The tick is the reward, and a card that swapped the instant
 * the subject came up would never let the carer see they had got there.
 */
function Prompt({
  covered,
  top,
  paused,
  onHeight,
}: {
  covered: Set<string | undefined>;
  top: number;
  paused: boolean;
  /** Its laid-out height, so the page can make room under it. */
  onHeight: (px: number) => void;
}) {
  /* The latest `covered`, for a timer that fires a second after it was set. */
  const latest = useRef(covered);
  latest.current = covered;
  const nextOf = (skip?: string) =>
    SCRIBE_TOPICS.find((t) => !latest.current.has(t.key) && t.key !== skip) ??
    null;

  const [shown, setShown] = useState(() => nextOf());
  const [ticked, setTicked] = useState(false);
  const enter = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* The hold is cleared when the card goes away — and only then. */
  useEffect(
    () => () => {
      if (timer.current != null) clearTimeout(timer.current);
    },
    [],
  );

  /* Slide the card in from the right, fading up, at mount and at every change. */
  const arrive = () => {
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };
  useEffect(arrive, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* The subject on the card has just come up: tick, hold, then move on. */
  useEffect(() => {
    if (shown == null || ticked || !covered.has(shown.key)) return;
    setTicked(true);
    pop.setValue(0);
    Animated.spring(pop, {
      toValue: 1,
      damping: 9,
      stiffness: 260,
      useNativeDriver: true,
    }).start();
    /*
      The hold, then the change. Not cleared by this effect's own cleanup:
      setting `ticked` re-runs the effect, and a cleanup here would cancel
      the very timer it had just set — the card would tick and then sit
      ticked for ever. The timer belongs to the card, and is cleared with it.
    */
    timer.current = setTimeout(() => {
      Animated.timing(enter, {
        toValue: 2,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setShown(nextOf(shown.key));
        setTicked(false);
        arrive();
      });
    }, 1100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [covered.size, shown, ticked]);

  const done = SCRIBE_TOPICS.filter((t) => covered.has(t.key)).length;
  const index =
    shown == null ? SCRIBE_TOPICS.length : SCRIBE_TOPICS.indexOf(shown) + 1;
  const ink =
    ticked || shown == null ? SUCCESS : paused ? "#9AA3AF" : PRIMARY_500;

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: top + SPACE.sm + 44 + SPACE.sm,
        left: GUTTER,
        right: GUTTER,
        zIndex: 20,
      }}
    >
      <View
        onLayout={(e) => onHeight(e.nativeEvent.layout.height)}
        style={{
          // The shadow rides on this outer view, not on the glass: the
          // material refracts what is behind it, and a shadow painted *on*
          // it would be one more thing for it to sample. Out here it falls
          // on the page under the card, which is where a shadow goes.
          borderRadius: RADIUS.card,
          boxShadow: shadow({
            blur: 18,
            y: 10,
            color: "#0B2C47",
            opacity: 0.22,
          }),
        }}
      >
        <Glass
          // The veil the app's other floating glass wears, in every state: the
          // tick and the green badge say "done"; the ground does not change
          // colour under them.
          tintColor={GLASS_NEUTRAL}
          style={{
            borderRadius: RADIUS.card,
            overflow: "hidden",
          }}
        >
          {/*
        The slide and the fade happen to the *words*, inside the glass, and
        never to the glass. UIVisualEffectView will not draw its material
        under an ancestor that carries a transform or an alpha below one —
        which the card itself did, for the length of every change, and so it
        spent that time as a plain white plate. The pane stays put; what is
        written on it comes and goes.

        0 → 1 is arriving from the right; 1 → 2 is leaving to the left.
      */}
          <Animated.View
            style={{
              opacity: enter.interpolate({
                inputRange: [0, 1, 2],
                outputRange: [0, 1, 0],
              }),
              transform: [
                {
                  translateX: enter.interpolate({
                    inputRange: [0, 1, 2],
                    outputRange: [32, 0, -24],
                  }),
                },
              ],
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.md,
                paddingHorizontal: SPACE.lg,
                paddingVertical: SPACE.md,
              }}
            >
              {/* The number, which becomes the check. */}
              <Animated.View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor:
                    ticked || shown == null ? SUCCESS : `${ink}1A`,
                  transform: [
                    {
                      scale: pop.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [1, 1.18, 1],
                      }),
                    },
                  ],
                }}
              >
                {ticked || shown == null ? (
                  <Check size={18} color="#FFFFFF" strokeWidth={3} />
                ) : (
                  <Text
                    style={{
                      fontSize: 15,
                      lineHeight: 18,
                      fontWeight: "800",
                      color: ink,
                    }}
                  >
                    {index}
                  </Text>
                )}
              </Animated.View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.sm,
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 11,
                      lineHeight: 14,
                      fontWeight: "700",
                      letterSpacing: 0.4,
                      color: ticked ? SUCCESS : TEXT_MUTED,
                    }}
                  >
                    {shown == null
                      ? tr("คุยครบทุกเรื่องแล้ว", "All topics covered")
                      : ticked
                        ? tr("คุยแล้ว", "Covered")
                        : paused
                          ? tr("หยุดฟังอยู่ · เรื่องถัดไป", "Paused · Next topic")
                          : tr("เรื่องถัดไปที่ควรถาม", "Next topic to ask about")}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      lineHeight: 14,
                      fontWeight: "600",
                      color: TEXT_MUTED,
                    }}
                  >
                    {`${done}/${SCRIBE_TOPICS.length}`}
                  </Text>
                </View>
                {shown != null ? (
                  <>
                    <Text
                      numberOfLines={1}
                      style={{
                        marginTop: 2,
                        fontSize: 17,
                        lineHeight: 22,
                        fontWeight: "700",
                        color: TEXT_PRIMARY,
                      }}
                    >
                      {shown.label}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={{
                        marginTop: 1,
                        fontSize: 13,
                        lineHeight: 18,
                        color: ticked ? TEXT_MUTED : PRIMARY_500,
                      }}
                    >
                      {shown.ask}
                    </Text>
                  </>
                ) : (
                  <Text
                    style={{
                      marginTop: 2,
                      fontSize: 14,
                      lineHeight: 20,
                      color: TEXT_PRIMARY,
                    }}
                  >
                    {tr(
                      'กด "จบการสนทนา" เมื่อพร้อม ผู้ช่วยจะสรุปให้ตรวจสอบ',
                      'Tap "End conversation" when ready and the assistant will summarize it for review',
                    )}
                  </Text>
                )}
              </View>
            </View>
          </Animated.View>
        </Glass>
      </View>
    </View>
  );
}

/**
 * The session, folded: the voice bar, floating over the form.
 *
 * The same bar the sheet carries at its foot, lifted out and set just
 * above the form's own tray — so folding the sheet does not change what the
 * carer is looking at, only what is underneath it. Listening, it is the
 * aurora with the sound across it and the hold button, all of which still
 * work from here; held, the same bar gone dark with a play button; ready,
 * the app's blue with "ตรวจสอบ". Tapping the bar anywhere but its button
 * brings the sheet back.
 *
 * In the form's own tray's place, not above it: the form hides its save
 * button while the assistant is folded, and this takes the slot. Two
 * trays stacked at the foot was two things asking for the thumb at once,
 * and saving a form the assistant is still listening to is not the thing
 * anybody is about to do.
 */
function Pill({
  stage,
  at,
  paused,
  onPress,
  onHold,
  onResume,
}: {
  stage: Stage;
  at: number;
  paused: boolean;
  onPress: () => void;
  onHold: () => void;
  onResume: () => void;
}) {
  const listening = stage === "listening" && !paused;
  const held = stage === "listening" && paused;
  const mm = Math.floor(at / 60);
  const ss = Math.floor(at % 60);
  const wave = useRef(new Animated.Value(0)).current;
  // A bar, not a banner: on a tablet it stays the width it is on a phone's
  // form sheet, centred, rather than running the width of the screen.
  // The width of the page the bar floats over — the screen, or the card a
  // form stands in beside a patient — not the screen regardless: measured
  // against the screen inside that card, the bar's two insets met in the
  // middle and it came out a sliver.
  const { width: screenW } = useLayout();
  const side = screenW >= 600 ? Math.max(25, (screenW - PILL_MAX) / 2) : 25;

  useEffect(() => {
    if (!listening) {
      wave.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(wave, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [listening, wave]);

  const BARS = 18;
  const accent = listening ? "#FFFFFF" : held ? "#9AA3AF" : "#FFFFFF";

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: side,
        right: side,
        // The form's own tray's place — the tray steps aside for it.
        bottom: 23,
        zIndex: 20,
        // The bar's own corners: a shadow takes the shape of the view that
        // casts it, and this one's child is the rounded bar.
        borderRadius: 36,
        boxShadow: shadow({ blur: 18, y: 6, opacity: 0.28 }),
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={
          listening
            ? tr("กำลังฟังการสนทนา แตะเพื่อเปิดผู้ช่วย", "Listening to the conversation. Tap to open the scribe.")
            : held
              ? tr("หยุดฟังชั่วคราว แตะเพื่อเปิดผู้ช่วย", "Listening paused. Tap to open the scribe.")
              : tr("ร่างพร้อมแล้ว แตะเพื่อตรวจสอบ", "Draft ready. Tap to review.")
        }
        style={{
          height: 64,
          borderRadius: 36,
          overflow: "hidden",
          // Listening sits under the aurora; held is the dark plate; ready is
          // the app's own blue, plain — the light is for something happening.
          backgroundColor: listening
            ? "#16306B"
            : held
              ? "#0B1220"
              : PRIMARY_500,
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: SPACE.xl,
          paddingRight: SPACE.sm,
          gap: SPACE.md,
        }}
      >
        {listening && (
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
              speed={0.9}
              blend={0.85}
              amplitude={1.5}
            />
          </View>
        )}

        {/* Ready: the assistant's mark, on a disc of light. */}
        {stage === "review" && (
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              marginLeft: -SPACE.sm,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.18)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.35)",
            }}
          >
            <UIcon name="sparkles" size={18} color="#FFFFFF" />
          </View>
        )}

        {/* The clock, and what state it is the clock of. */}
        <View style={{ gap: 1, flexShrink: 1 }}>
          <Text
            style={{
              fontSize: 11,
              lineHeight: 14,
              fontWeight: "700",
              letterSpacing: 0.4,
              color: held ? accent : "rgba(255,255,255,0.85)",
            }}
          >
            {listening
              ? tr("กำลังฟัง", "Listening")
              : held
                ? tr("หยุดชั่วคราว", "Paused")
                : tr("ร่างโดยผู้ช่วย AI", "Drafted by AI")}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 20,
              lineHeight: 24,
              fontWeight: "700",
              fontVariant: ["tabular-nums"],
              color: "#FFFFFF",
            }}
          >
            {stage === "review"
              ? tr("สรุปพร้อมแล้ว", "Summary ready")
              : `${mm}:${String(ss).padStart(2, "0")}`}
          </Text>
        </View>

        {/* The sound, while there is any. */}
        {stage === "listening" ? (
          <View
            pointerEvents="none"
            style={{
              flex: 1,
              height: 32,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: SPACE.sm,
            }}
          >
            {Array.from({ length: BARS }, (_, i) => {
              const mid = 1 - Math.abs(i - (BARS - 1) / 2) / ((BARS - 1) / 2);
              return (
                <Animated.View
                  key={i}
                  style={{
                    width: 3,
                    height: 28,
                    borderRadius: 2,
                    backgroundColor: listening
                      ? "rgba(255,255,255,0.9)"
                      : accent,
                    transform: [
                      {
                        scaleY: listening
                          ? phased(
                              wave,
                              (i * 0.37) % 1,
                              [0.18, 0.9, 0.35, 1, 0.5, 0.18],
                              0.25 + mid * 0.75,
                            )
                          : 0.12,
                      },
                    ],
                  }}
                />
              );
            })}
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {/* The one control: hold, resume, or go and read. */}
        {stage === "listening" ? (
          <Pressable
            onPress={listening ? onHold : onResume}
            accessibilityRole="button"
            accessibilityLabel={listening ? tr("หยุดฟังชั่วคราว", "Pause listening") : tr("ให้ AI ฟังต่อ", "Resume listening")}
            style={({ pressed }) => ({
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? "rgba(255,255,255,0.8)" : "#FFFFFF",
            })}
          >
            {listening ? (
              <Pause
                size={20}
                color="#0B1220"
                strokeWidth={2.6}
                fill="#0B1220"
              />
            ) : (
              <Play
                size={20}
                color="#0B1220"
                strokeWidth={2.6}
                fill="#0B1220"
              />
            )}
          </Pressable>
        ) : (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 2,
              paddingLeft: 16,
              paddingRight: 10,
              height: 40,
              borderRadius: RADIUS.capsule,
              backgroundColor: SURFACE,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                lineHeight: 18,
                fontWeight: "700",
                color: PRIMARY_500,
              }}
            >
              {tr("ตรวจสอบ", "Review")}
            </Text>
            <ChevronRight size={16} color={PRIMARY_500} strokeWidth={2.6} />
          </View>
        )}
      </Pressable>
    </View>
  );
}

/**
 * A looping keyframe curve, sampled with a phase offset.
 *
 * `Animated.interpolate` insists its input range climb, so a phase cannot
 * be put on the *input* side — `(k + phase) % 1` wraps and the range stops
 * climbing, which is a crash, not a warning. The phase goes on the output
 * side instead: the input is a plain climbing grid, and each grid point is
 * given the curve's value a phase further along. Same picture, legal range.
 */
function phased(
  value: Animated.Value,
  phase: number,
  keys: number[],
  scale = 1,
  steps = 24,
): Animated.AnimatedInterpolation<number> {
  const curve = (u: number) => {
    const t = ((u % 1) + 1) % 1;
    const span = keys.length - 1;
    const i = Math.min(span - 1, Math.floor(t * span));
    const f = t * span - i;
    return keys[i] + (keys[i + 1] - keys[i]) * f;
  };
  const inputRange = Array.from({ length: steps + 1 }, (_, k) => k / steps);
  const outputRange = inputRange.map((t) => curve(t + phase) * scale);
  return value.interpolate({ inputRange, outputRange, extrapolate: "clamp" });
}

/**
 * One section's plate, floating on the glass.
 *
 * The translucent panel token rather than a solid fill: over glass a solid
 * plate cuts the material out of the middle of the sheet and leaves it
 * showing only around the edges.
 */
function Panel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: PANEL,
          borderRadius: RADIUS.card,
          borderWidth: 1,
          borderColor: RIM_LIT,
          padding: SPACE.lg,
          boxShadow: shadow({
            blur: 10,
            y: 3,
            color: TEXT_PRIMARY,
            opacity: 0.08,
          }),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * The subjects, pinned over the conversation, ticking themselves off.
 *
 * As plain as it can be: six lines, a small mark before each, and the next
 * one to raise set apart by its weight and its prompt. No bar, no count,
 * no rail — the list is short enough to be its own progress, and anything
 * drawn around it competes with the person the carer is looking at.
 */
function Topics({ covered }: { covered: Set<string | undefined> }) {
  const pending = SCRIBE_TOPICS.find((t) => !covered.has(t.key));
  return (
    <View
      style={{
        paddingHorizontal: GUTTER,
        paddingBottom: SPACE.sm,
        zIndex: 2,
      }}
    >
      <Panel
        style={{
          paddingVertical: SPACE.md,
          gap: 0,
          backgroundColor: PANEL,
          boxShadow: shadow({ blur: 16, y: 8, opacity: 0.16 }),
        }}
      >
        <Text
          style={{
            marginBottom: 6,
            fontSize: 12,
            lineHeight: 16,
            fontWeight: "600",
            color: TEXT_MUTED,
          }}
        >
          {tr("เรื่องที่ต้องคุย", "Topics to cover")}
        </Text>
        {SCRIBE_TOPICS.map((topic) => {
          const isDone = covered.has(topic.key);
          const now = pending?.key === topic.key;
          return (
            <View
              key={topic.key}
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: SPACE.sm,
                paddingVertical: 4,
              }}
            >
              <View
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  marginTop: 2,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isDone ? SUCCESS : "transparent",
                  borderWidth: isDone ? 0 : 1.5,
                  borderColor: now ? PRIMARY_500 : SEPARATOR,
                }}
              >
                {isDone && (
                  <Check size={10} color="#FFFFFF" strokeWidth={3.2} />
                )}
              </View>
              {/* The one being asked sits on a pale blue plate; the rest
                  sit on nothing. That plate is the only ornament here. */}
              <View
                style={{
                  flex: 1,
                  minWidth: 0,
                  marginTop: now ? -4 : 0,
                  paddingHorizontal: now ? SPACE.md : 0,
                  paddingVertical: now ? 6 : 0,
                  borderRadius: RADIUS.md,
                  backgroundColor: now ? PRIMARY_100 : "transparent",
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 14,
                    lineHeight: 20,
                    fontWeight: now ? "700" : "400",
                    color: isDone ? TEXT_MUTED : TEXT_PRIMARY,
                  }}
                >
                  {topic.label}
                </Text>
                {now && (
                  <Text
                    style={{ fontSize: 12, lineHeight: 18, color: PRIMARY_500 }}
                  >
                    {topic.ask}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </Panel>
    </View>
  );
}

/**
 * One line of the conversation.
 *
 * A chat bubble, and built like one rather than like a card: the carer's
 * own words on the app's blue and to the right, the patient's on white and
 * to the left, each with the corner nearest its speaker squared off — which
 * is the thing that makes a column of bubbles read as a conversation with
 * two sides rather than as a list of quotations. Consecutive lines from the
 * same speaker close up and drop the name, because a name repeated every
 * two seconds is noise; the tail is only drawn where the speaker changes.
 *
 * The newest line arrives with a small lift rather than appearing, so the
 * eye is taken to it — this is a transcript that is being written while
 * somebody is talking, and the carer is not reading it, they are glancing
 * at it.
 */
function Said({
  turn,
  first,
  last,
  fresh,
}: {
  turn: Turn;
  /** First of a run from this speaker — the one that carries the name. */
  first: boolean;
  /** Last of the run — the one that carries the tail. */
  last: boolean;
  /** The line that has just arrived. */
  fresh: boolean;
}) {
  const mine = turn.who === "carer";
  const rise = useRef(new Animated.Value(fresh ? 1 : 0)).current;

  useEffect(() => {
    if (!fresh) return;
    rise.setValue(1);
    Animated.timing(rise, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [fresh, rise]);

  return (
    <Animated.View
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "82%",
        marginTop: first ? SPACE.md : 3,
        opacity: rise.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [
          {
            translateY: rise.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 8],
            }),
          },
        ],
      }}
    >
      {first && (
        <Text
          style={{
            marginBottom: 4,
            marginHorizontal: SPACE.md,
            fontSize: 11,
            lineHeight: 14,
            fontWeight: "600",
            color: TEXT_MUTED,
            textAlign: mine ? "right" : "left",
          }}
        >
          {mine ? tr("เจ้าหน้าที่", "Staff") : tr("ผู้ป่วย", "Patient")}
        </Text>
      )}
      <View
        style={{
          paddingHorizontal: 14,
          paddingVertical: 10,
          // The corner nearest the speaker squares off on the last of a
          // run; the rest stay round, so a run reads as one utterance.
          borderRadius: 20,
          borderBottomRightRadius: mine && last ? 6 : 20,
          borderBottomLeftRadius: !mine && last ? 6 : 20,
          backgroundColor: mine ? "rgba(7,125,215,0.92)" : PANEL,
          borderWidth: mine ? 0 : 1,
          borderColor: RIM_LIT,
          boxShadow: shadow({
            blur: 6,
            y: 2,
            color: TEXT_PRIMARY,
            opacity: 0.06,
          }),
        }}
      >
        <Text
          style={{
            fontSize: 15,
            lineHeight: 22,
            color: mine ? "#FFFFFF" : TEXT_PRIMARY,
          }}
        >
          {turn.text}
        </Text>
      </View>
    </Animated.View>
  );
}

/**
 * The line that is being said right now, before it has been said.
 *
 * Three dots on a bubble, on the side of whoever speaks next. A transcript
 * that only moves when a sentence lands looks stalled between sentences,
 * and the gaps in a real conversation are seconds long.
 */
function Typing({ who }: { who: "carer" | "patient" }) {
  const mine = who === "carer";
  const beat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(beat, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [beat]);

  return (
    <View
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        marginTop: SPACE.md,
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderRadius: 20,
        backgroundColor: mine ? "rgba(7,125,215,0.18)" : PANEL,
      }}
    >
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: mine ? PRIMARY_500 : TEXT_MUTED,
            // Each dot peaks a third of a beat after the one before it.
            opacity: phased(beat, -i / 3, [1, 0.3, 0.3, 1]),
          }}
        />
      ))}
    </View>
  );
}
