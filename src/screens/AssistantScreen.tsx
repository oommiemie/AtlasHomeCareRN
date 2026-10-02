/**
 * The assistant, as a conversation.
 *
 * The app already speaks to the same cluster in three places — the diagnosis
 * draft, the patient brief, the health brief — but each of those asks one
 * fixed question about one record and belongs over the page that asked, as a
 * sheet. This is the open one: a carer asks how the round is going, or what
 * the record says about somebody on it, in whatever words they would use out
 * loud. So it is a page of its own, pushed and backed out of like any other,
 * rather than a card held over the page behind it.
 *
 * It wears the surface the assistant sheets wear, because it marks the same
 * thing: this is the assistant speaking, not the app. The aurora sits BEHIND
 * the glass rather than on it — clear glass over nothing is clear glass over
 * nothing, and the material needs something to refract.
 *
 * The thread itself lives in the model, not here. A page is unmounted the
 * moment it is left, and a carer who stepped back to check a visit should
 * not come back to a blank conversation.
 */
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  Alert,
  Image,
  Pressable,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import {
  ArrowUp,
  AudioLines,
  ChevronLeft,
  History as HistoryGlyph,
  ImagePlus,
  SquarePen,
  X,
} from "lucide-react-native";

import { Aurora } from "../components/Aurora";
import { Glass } from "../components/Glass";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { Floating } from "../components/BlurStage";
import { GlassIconButton } from "../components/GlassIconButton";
import { ToolbarPill } from "../components/ToolbarPill";
import { VisitRow } from "../components/VisitCard";
import { RouteCard } from "../components/RouteCard";
import { TourCard } from "../components/TourCard";
import { HealthCard } from "../components/HealthCard";
import { HealthListCard } from "../components/HealthListCard";
import { VisitCounts } from "../components/VisitCounts";
import { VoiceBar } from "../components/VoiceBar";
import { ActionButtons, BriefCard } from "../components/AssistantExtras";
import { screenFocus } from "../models/assistantFocus";
import { UIcon } from "../components/UIcon";
import { toast } from "../components/Toast";
import { openTask } from "../navigation/openTask";
import { planToday } from "../models/clock";
import { givenName, hasLocation } from "../models/task";
import type { RootStackParamList } from "../navigation/RootStack";
import { thaiShortDate, thaiTime } from "../utils/thaiDate";
import { feel } from "../utils/haptics";
import { useHere } from "../utils/useHere";
import {
  visitsByIds,
  MAX_PHOTOS,
  someOpeners,
  type Attachment,
  type ChatTurn,
} from "../models/assistant";
import {
  forgetThread,
  newChat,
  openThread,
  send,
  titleOf,
  useChat,
  type Thread,
} from "../models/assistantChat";
import { currentDisplay } from "../models/display";
import { givenNameOf, useSession } from "../models/session";
import {
  CANVAS,
  FILL_SUBTLE,
  GLASS_OFF,
  PANEL,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  SURFACE,
  TEXT_MUTED,
  TEXT_PLACEHOLDER,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme/tokens";
import { readable, useLayout, GUTTER } from "../theme/layout";
import { tr } from "../i18n";

const ANDROID = Platform.OS === "android";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * The conversation's own width on a tablet: a reading column, not the
 * page's. The app's content cap was lifted for the iPad's split pages, and
 * with it this thread ran a foot across a landscape screen — sentences no
 * eye can follow from one end to the other.
 */
const CHAT_MAX = 760;

/** The composer's own height, so the scroll view can clear it. */
const BAR = 52;

/** The header row's, so the thread can start below it rather than under it. */
const HEADER_H = 44;

/**
 * A suggestion capsule's height, fixed.
 *
 * The words inside are swapped for others as the set turns, and a capsule
 * that resized itself to each new question would make the whole column jump
 * every five seconds.
 */
const OPENER_H = 48;

export function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { turns, thinking, threads } = useChat();
  // Asked for as the page opens, so "who is nearest" is measured from where
  // the carer is standing rather than from wherever a map last left it. The
  // value goes into the model layer's own store; nothing here reads it.
  useHere();
  const [history, setHistory] = useState(false);
  const [draft, setDraft] = useState("");
  /*
    On a tablet the conversation is a column down the middle, and the
    composer floats over that column rather than across the whole screen:
    its edges are the thread's edges, so the field sits under the words it
    is answering. On a phone the column is the screen and this is GUTTER.
  */
  const { width } = useLayout();
  const side = Math.max(GUTTER, (width - CHAT_MAX) / 2 + GUTTER);
  const scroll = useRef<ScrollView>(null);

  /*
    The composer follows the keyboard itself.

    KeyboardAvoidingView was doing this, and it cannot: it works by padding
    its own box, and this composer is positioned absolutely, which Yoga lays
    out against the parent's border box rather than its padding box. The bar
    sat exactly where it had been, under the keys. So the keyboard's own
    frame is read from the event that announces it, and the bar is moved by
    its height — animated over the duration iOS reports, so it travels with
    the keyboard rather than snapping once the keyboard has arrived.

    Animating `bottom` rather than a transform is deliberate: this bar is
    made of Apple's glass, and a transform on any ancestor stops
    UIVisualEffectView drawing its material at all.
  */
  const rest = insets.bottom + SPACE.sm;
  const [keyboard, setKeyboard] = useState(0);
  const lift = useRef(new Animated.Value(rest)).current;

  useEffect(() => {
    const travel = (to: number, duration: number) =>
      Animated.timing(lift, {
        toValue: to,
        duration: duration === 0 ? 250 : duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();

    const shown = Keyboard.addListener("keyboardWillShow", (e) => {
      setKeyboard(e.endCoordinates.height);
      travel(e.endCoordinates.height + SPACE.sm, e.duration);
    });
    const hidden = Keyboard.addListener("keyboardWillHide", (e) => {
      setKeyboard(0);
      travel(rest, e.duration);
    });
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [lift, rest]);

  const [photos, setPhotos] = useState<Attachment[]>([]);
  /*
    Whether there is anything to send, which is what the round button on the
    right is FOR at any moment.

    An empty composer has nothing to send, so a send button sitting there is
    a button that cannot be pressed. At rest it is the way in to voice
    instead, and the arrow appears only once there is something for it to
    carry. A picture counts: a photograph with no words is still a question.
  */
  const loaded = draft.trim() !== "" || photos.length > 0;
  const idle = !loaded || thinking;

  /*
    Voice mode: a spoken conversation, heard and answered on the phone
    (see `VoiceMode`). The model has no audio tower, so the words are
    recognised by the system and only the question goes to it, as a typed
    one would.
  */
  const [voice, setVoice] = useState(false);
  const startVoice = () => {
    feel("tick");
    Keyboard.dismiss();
    setVoice(true);
  };

  /**
   * Get one picked image down to something sendable.
   *
   * A photograph off this phone is twelve megapixels; as base64 that is a
   * couple of megabytes to push up a mobile connection from somebody's front
   * room — times however many were picked — and the model resizes them on
   * arrival anyway. Long edge capped at 1024 and recompressed, which is a
   * tenth of the bytes and no worse an answer.
   */
  const shrink = async (
    picked: ImagePicker.ImagePickerAsset,
  ): Promise<Attachment | null> => {
    const rendered = await ImageManipulator.ImageManipulator.manipulate(
      picked.uri,
    )
      // One dimension only: the other follows, so nothing is squashed.
      .resize(
        picked.width >= picked.height ? { width: 1024 } : { height: 1024 },
      )
      .renderAsync();
    const out = await rendered.saveAsync({
      base64: true,
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return out.base64 == null ? null : { uri: out.uri, base64: out.base64 };
  };

  /**
   * Take or choose pictures.
   *
   * The camera takes one at a time, as a camera does. The library takes as
   * many as there is still room for in one question.
   */
  const attach = () => {
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      toast(
        tr(
          `แนบได้สูงสุด ${MAX_PHOTOS} รูปต่อหนึ่งคำถาม`,
          `You can attach up to ${MAX_PHOTOS} photos per question`,
        ),
        "warning",
      );
      return;
    }

    const shoot = async (fromCamera: boolean) => {
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toast(
          fromCamera
            ? tr("ต้องอนุญาตให้ใช้กล้องก่อน", "Allow camera access first")
            : tr("ต้องอนุญาตให้เข้าคลังภาพก่อน", "Allow photo library access first"),
          "error",
        );
        return;
      }
      const shot = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({
            quality: 1,
            allowsMultipleSelection: true,
            // Only as many as there is room for, so the picker itself holds
            // the line rather than the app throwing half a choice away.
            selectionLimit: room,
          });
      if (shot.canceled) return;
      try {
        const shrunk = await Promise.all(
          shot.assets.slice(0, room).map(shrink),
        );
        const kept = shrunk.filter((a): a is Attachment => a != null);
        if (kept.length === 0) {
          toast(tr("อ่านรูปไม่สำเร็จ", "Couldn't read the photo"), "error");
          return;
        }
        setPhotos((prev) => [...prev, ...kept].slice(0, MAX_PHOTOS));
        feel("success");
        toast(tr("แนบรูปแล้ว", "Photo attached"), "success");
      } catch {
        toast(tr("อ่านรูปไม่สำเร็จ", "Couldn't read the photo"), "error");
      }
    };

    Alert.alert(tr("แนบรูป", "Attach photo"), undefined, [
      { text: tr("ถ่ายภาพ", "Take photo"), onPress: () => void shoot(true) },
      {
        text: tr("เลือกจากคลังภาพ", "Choose from library"),
        onPress: () => void shoot(false),
      },
      { text: tr("ยกเลิก", "Cancel"), style: "cancel" },
    ]);
  };

  const ask = (text: string) => {
    if ((text.trim() === "" && photos.length === 0) || thinking) return;
    const attached = photos;
    setDraft("");
    setPhotos([]);
    // Deliberately not awaited: the store publishes the question straight
    // away and the answer when it lands, so there is nothing for the press
    // handler to wait for.
    void send(text, attached);
  };

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      {/*
        The page's ground, and the only thing on it: the composer floats on
        top of this, and a floating piece of glass needs something with
        movement in it to refract. A full-bleed sheet of glass here — which
        is what this page used to be — left the composer with nothing but
        more glass to sample, and both flattened into one dull patch.
      */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "55%",
        }}
      >
        <Aurora
          colorStops={["#339FF3", "#46D8AD", "#7C5CFF"]}
          speed={0.45}
          blend={0.62}
          amplitude={0.9}
        />
      </View>

      {/*
        The thread runs the whole height of the screen and the header floats
        over it, the way the tabbed pages do it. A header sitting above the
        list in flow gives the glass capsule up there nothing but a flat
        wash to refract, and costs a band of empty page besides.

        HeaderFade dissolves the messages as they rise into the status bar,
        so a bubble is never cut off square at the top edge — which reads as
        a rendering fault rather than as depth.
      */}
      <HeaderFade from={insets.top} to={insets.top + HEADER_FADE}>
        <ScrollView
          ref={scroll}
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            ...readable(CHAT_MAX),
            paddingHorizontal: GUTTER,
            // Under the floating header, not below it.
            paddingTop: insets.top + HEADER_H + SPACE.md,
            // Clear of the floating composer, and of the keyboard when
            // that is up too, so the last answer is never under either.
            paddingBottom: BAR + rest + keyboard + SPACE.xl,
            gap: SPACE.md,
          }}
          onContentSizeChange={() =>
            scroll.current?.scrollToEnd({ animated: true })
          }
        >
          {turns.length === 0 ? <Welcome onPick={ask} /> : null}
          {turns.map((turn) => (
            <Bubble key={turn.id} turn={turn} />
          ))}
          {thinking ? <Thinking /> : null}
        </ScrollView>
      </HeaderFade>

      <Floating>
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: GUTTER,
            paddingTop: insets.top + SPACE.sm,
          }}
        >
          {/* The app's own round glass button, the same one every other
              screen's header carries — and it works here now: the thread runs
              under the header, so the material has the conversation behind it
              to refract rather than a flat page. */}
          <GlassIconButton
            onPress={() => nav.goBack()}
            accessibilityLabel={tr("ย้อนกลับ", "Back")}
          >
            <ChevronLeft size={24} color={TEXT_PRIMARY} strokeWidth={2.4} />
          </GlassIconButton>
          {/* No title over it. The page is one conversation and the way
                back and the two actions say everything a title would, so the
                words were a line of chrome above a thread that is already
                about itself. */}
          <View style={{ flex: 1 }} />
          {/*
              The two things a conversation needs beside it: a way to start
              another, and a way back to the ones already had. On the app's own
              header capsule, as every other screen's header actions are.
            */}
          <ToolbarPill
            slots={[
              {
                icon: (
                  <SquarePen
                    size={19}
                    color={turns.length === 0 ? TEXT_MUTED : TEXT_PRIMARY}
                    strokeWidth={2.4}
                  />
                ),
                label: tr("เริ่มบทสนทนาใหม่", "New chat"),
                onPress:
                  turns.length === 0 || thinking
                    ? undefined
                    : () => {
                        newChat();
                        toast(tr("เริ่มบทสนทนาใหม่แล้ว", "Started a new chat"));
                      },
              },
              {
                icon: (
                  <HistoryGlyph
                    size={19}
                    color={threads.length === 0 ? TEXT_MUTED : TEXT_PRIMARY}
                    strokeWidth={2.4}
                  />
                ),
                label: tr("ประวัติแชท", "Chat history"),
                onPress:
                  threads.length === 0 ? undefined : () => setHistory(true),
              },
            ]}
          />
        </View>
      </Floating>

      {/* Floating, not a bar at the foot of a column: the thread runs on
          underneath it. `lift` is what carries it over the keyboard. */}
      <Animated.View
        style={{
          position: "absolute",
          left: side,
          right: side,
          bottom: lift,
          gap: SPACE.sm,
        }}
      >
        {/*
          The attached picture, above the field it was attached to.

          Shown at a size that says what it is without taking the page: the
          carer is about to ask a question about it, not look at it.
        */}
        {photos.length > 0 ? (
          <Glass
            // The same frost as the field it is attached to — it sits a
            // few points above it and the two read as one thing.
            blurred
            frost="milky"
            style={{
              alignSelf: "flex-start",
              flexDirection: "row",
              gap: SPACE.sm,
              padding: SPACE.sm,
              borderRadius: RADIUS.lg,
              overflow: "hidden",
            }}
          >
            {photos.map((p) => (
              <View key={p.uri}>
                <Image
                  source={{ uri: p.uri }}
                  style={{ width: 72, height: 72, borderRadius: RADIUS.md }}
                />
                <Pressable
                  onPress={() =>
                    setPhotos((prev) => prev.filter((q) => q.uri !== p.uri))
                  }
                  accessibilityRole="button"
                  accessibilityLabel={tr("เอารูปออก", "Remove photo")}
                  hitSlop={8}
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: PANEL,
                  }}
                >
                  <X size={13} color={TEXT_PRIMARY} strokeWidth={3} />
                </Pressable>
              </View>
            ))}
          </Glass>
        ) : null}

        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            gap: SPACE.sm,
          }}
        >
          {/* Voice: the bar turns into the conversation's own, and the
              thread above goes on filling as it is spoken. */}
          {voice ? (
            <VoiceBar height={BAR} onExit={() => setVoice(false)} />
          ) : (
            <>
              {/*
              Apple's material, with the aurora moving behind it.

              `interactive` is what makes it track the finger rather than
              sit there, and `overflow: "hidden"` is what keeps the material
              inside the capsule instead of filling its square.
            */}
              <Glass
                interactive
                // Frosted rather than washed, like the toolbars: the field is a
                // surface the page shows through, not a painted capsule.
                blurred
                frost="milky"
                style={{
                  flex: 1,
                  minHeight: BAR,
                  flexDirection: "row",
                  // Both children centred on the capsule, and neither given a
                  // height of its own: the glyph and the line of text then share
                  // one centre line. Anything that stretches one of them to the
                  // capsule's full height puts the glyph's middle above the
                  // text's, which is the same mistake lineHeight made.
                  alignItems: "center",
                  gap: SPACE.sm,
                  paddingLeft: SPACE.md,
                  paddingRight: SPACE.lg,
                  paddingVertical: SPACE.sm,
                  borderRadius: RADIUS.capsule,
                  overflow: "hidden",
                }}
              >
                {/* Inside the field, where what it attaches ends up. It is the
                field's own affordance, not a third control standing beside
                it. */}
                <Pressable
                  onPress={attach}
                  accessibilityRole="button"
                  accessibilityLabel={tr("แนบรูป", "Attach photo")}
                  hitSlop={10}
                  style={{ width: 30, alignItems: "center" }}
                >
                  <ImagePlus
                    size={22}
                    color={TEXT_SECONDARY}
                    strokeWidth={2.2}
                  />
                </Pressable>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={
                    photos.length === 0
                      ? tr("ถามเรื่องงานหรือผู้ป่วย", "Ask about your tasks or patients")
                      : photos.length === 1
                        ? tr("ถามเกี่ยวกับรูปนี้", "Ask about this photo")
                        : tr("ถามเกี่ยวกับรูปเหล่านี้", "Ask about these photos")
                  }
                  placeholderTextColor={TEXT_PLACEHOLDER}
                  multiline
                  onSubmitEditing={() => ask(draft)}
                  style={{
                    // The field is the capsule's whole width less the clip: a
                    // row child without this takes the width of what is typed
                    // into it, which is nothing when it is empty.
                    flex: 1,
                    fontSize: 16,
                    color: TEXT_PRIMARY,
                    maxHeight: 120,
                    // No lineHeight, and no padding of its own. iOS lays the extra
                    // leading ABOVE the glyphs, so a line height set here pushes
                    // the text off the capsule's centre — and Thai, with its upper
                    // vowel marks, shows it plainly. The capsule does the
                    // centring; the field just holds the text.
                    paddingTop: 0,
                    paddingBottom: 0,
                  }}
                />
              </Glass>
              {/*
              A plain Pressable, never PressableScale: that animates a
              transform on an ancestor, and a transformed ancestor stops
              UIVisualEffectView drawing its material at all. The glass
              answers the touch itself, through `interactive`.
            */}
              <Pressable
                onPress={loaded ? () => ask(draft) : startVoice}
                disabled={thinking}
                accessibilityRole="button"
                accessibilityLabel={
                  loaded ? tr("ส่ง", "Send") : tr("โหมดเสียง", "Voice mode")
                }
                accessibilityState={{ disabled: thinking }}
              >
                <Glass
                  interactive={!thinking}
                  /*
                Painted in the two states that mean something, and frosted
                in the one that does not.

                Blue is what the button says when there is something to
                send, and grey is what it says when it cannot be pressed —
                both are the button's own colour and neither is a surface.
                Idle, it is asking for the voice, and there it is the same
                frosted capsule the field beside it is.

                A change of tint, never of opacity: an alpha below 1 on
                anything above the material strips it, so a faded button
                would be a flat one.
              */
                  blurred={!thinking && !loaded}
                  frost="milky"
                  tintColor={
                    thinking
                      ? GLASS_OFF
                      : loaded
                        ? "rgba(7,125,215,0.78)"
                        : undefined
                  }
                  style={{
                    width: BAR,
                    height: BAR,
                    borderRadius: BAR / 2,
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {loaded ? (
                    <ArrowUp
                      size={22}
                      color={thinking ? TEXT_MUTED : "#FFFFFF"}
                      strokeWidth={2.8}
                    />
                  ) : (
                    <AudioLines
                      size={22}
                      color={thinking ? TEXT_MUTED : TEXT_PRIMARY}
                      strokeWidth={2.4}
                    />
                  )}
                </Glass>
              </Pressable>
            </>
          )}
        </View>
      </Animated.View>

      <HistorySheet
        visible={history}
        threads={threads}
        onClose={() => setHistory(false)}
        onOpen={(id) => {
          openThread(id);
          setHistory(false);
        }}
      />
    </View>
  );
}

/**
 * The conversations already had, newest first.
 *
 * A sheet rather than a page: the carer is choosing which thread to go back
 * to, and the one they are in should still be there behind the choice.
 * Swiping it away is the same as not choosing.
 */
function HistorySheet({
  visible,
  threads,
  onClose,
  onOpen,
}: {
  visible: boolean;
  threads: Thread[];
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const remove = (thread: Thread) => {
    Alert.alert(tr("ลบบทสนทนานี้", "Delete this chat?"), titleOf(thread), [
      {
        text: tr("ลบ", "Delete"),
        style: "destructive",
        onPress: () => {
          forgetThread(thread.id);
          feel("success");
          toast(tr("ลบบทสนทนาแล้ว", "Chat deleted"), "success");
        },
      },
      { text: tr("ยกเลิก", "Cancel"), style: "cancel" },
    ]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: CANVAS }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: GUTTER,
            paddingTop: SPACE.lg,
          }}
        >
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={tr("ปิด", "Close")}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: FILL_SUBTLE,
            }}
          >
            <X size={22} color={TEXT_PRIMARY} strokeWidth={2.6} />
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
            {tr("ประวัติแชท", "Chat history")}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          contentContainerStyle={{
            ...readable(CHAT_MAX),
            paddingVertical: SPACE.lg,
            paddingHorizontal: GUTTER,
            gap: SPACE.sm,
          }}
        >
          {threads.map((thread) => (
            <Pressable
              key={thread.id}
              onPress={() => onOpen(thread.id)}
              onLongPress={() => remove(thread)}
              accessibilityRole="button"
              accessibilityLabel={titleOf(thread)}
              accessibilityHint={tr("แตะค้างเพื่อลบ", "Touch and hold to delete")}
              style={({ pressed }) => ({
                padding: SPACE.lg,
                borderRadius: RADIUS.lg,
                gap: 2,
                backgroundColor: pressed ? PANEL : SURFACE,
              })}
            >
              <Text
                numberOfLines={1}
                style={{ fontSize: 16, fontWeight: "600", color: TEXT_PRIMARY }}
              >
                {titleOf(thread)}
              </Text>
              <Text style={{ fontSize: 13, color: TEXT_MUTED }}>
                {thaiShortDate(new Date(thread.startedAt))} ·{" "}
                {thaiTime(new Date(thread.startedAt))} ·{" "}
                {tr(
                  `${thread.turns.length} ข้อความ`,
                  `${thread.turns.length} message${thread.turns.length === 1 ? "" : "s"}`,
                )}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** What the assistant can be asked, before it has been asked anything. */
/**
 * How the assistant says hello.
 *
 * Written here rather than in the model because it is not an answer — it is
 * the page's own voice, and it should sound like somebody rather than like a
 * heading. Picked once when the page appears, not on a timer: a greeting
 * that changed while it was being read would be a different thing entirely.
 *
 * The hour decides which set it comes from. A carer opening this at six in
 * the morning and being told good evening is a small thing that makes the
 * whole app feel like it is not paying attention.
 */
function hello(name: string): string {
  const h = new Date().getHours();
  const you = name === "" ? "" : tr(`พี่${name}`, `, ${name}`);
  const set = tr(
    h < 12
      ? [
          `สวัสดีตอนเช้าค่ะ${you}`,
          `อรุณสวัสดิ์ค่ะ${you}`,
          `เช้านี้เป็นยังไงบ้างคะ${you}`,
        ]
      : h < 17
        ? [
            `สวัสดีตอนบ่ายค่ะ${you}`,
            `บ่ายนี้เป็นยังไงบ้างคะ${you}`,
            `พักบ้างนะคะ${you}`,
          ]
        : [
            `สวัสดีตอนเย็นค่ะ${you}`,
            `เย็นแล้วนะคะ${you}`,
            `วันนี้เหนื่อยไหมคะ${you}`,
          ],
    h < 12
      ? [`Good morning${you}`, `Morning${you}`, `How's your morning${you}?`]
      : h < 17
        ? [
            `Good afternoon${you}`,
            `How's your afternoon going${you}?`,
            `Remember to take a break${you}`,
          ]
        : [`Good evening${you}`, `Evening${you}`, `Long day${you}?`],
  );
  return set[Math.floor(Math.random() * set.length)] ?? set[0];
}

/** And what it offers, in a few different words. */
const INVITES = tr(
  [
    "ถามเรื่องงานวันนี้ หรือข้อมูลผู้ป่วยในรายการเยี่ยมได้เลยค่ะ",
    "อยากรู้อะไรเกี่ยวกับงานหรือผู้ป่วย ถามได้เลยนะคะ",
    "มีอะไรให้ช่วยดูไหมคะ ทั้งตารางงานและข้อมูลผู้ป่วย",
    "ถามได้ทั้งเรื่องงานที่ค้าง ตำแหน่งบ้าน และค่าตรวจของผู้ป่วยค่ะ",
  ],
  [
    "Ask about today's tasks, or any patient on your visit list.",
    "Want to know something about your tasks or patients? Just ask.",
    "Anything I can look up? Your schedule or your patients' records.",
    "Ask about tasks left to do, where a house is, or a patient's readings.",
  ],
);

/** What to ask about the patient whose page the assistant was opened on. */
function aboutOpeners(name: string): string[] {
  return tr(
    [
      `ต้องเตรียมอะไรก่อนไปบ้าน${name}`,
      `ความดันของ${name}ดีขึ้นไหมเมื่อเทียบกับเดือนก่อน`,
      `${name}ได้ยาอะไรอยู่บ้าง`,
      `ครั้งก่อนเยี่ยม${name}เจออะไร วางแผนไว้ว่ายังไง`,
    ],
    [
      `What should I prepare before visiting ${name}?`,
      `Is ${name}'s blood pressure better than last month?`,
      `What medicines is ${name} on?`,
      `What did the last visit to ${name} find, and what was the plan?`,
    ],
  );
}

/** How many suggestions are on screen, and how long each set stays. */
const SHOWN = 4;
const HOLD_MS = 5200;

function Welcome({ onPick }: { onPick: (q: string) => void }) {
  const still = currentDisplay().reduceMotion;
  const me = useSession();
  // Chosen once, when the page appears — see `hello`.
  const [greeting] = useState(() => hello(givenNameOf(me.displayName)));
  const [invite] = useState(
    () => INVITES[Math.floor(Math.random() * INVITES.length)] ?? INVITES[0],
  );
  /*
    Opened over somebody's page, the page is about them: the suggestions
    are questions about her, and the brief steps aside. Read once, when
    the page appears — the page under it does not change while it is up.
  */
  const [focus] = useState(() => screenFocus());
  // A tablet held sideways has the width for the brief and the suggestions
  // side by side, rather than one long column down the middle.
  const { wide, landscape } = useLayout();
  const about = focus?.resident != null ? givenName(focus.resident.name) : null;
  const [shown, setShown] = useState(() =>
    about != null ? aboutOpeners(about) : someOpeners(SHOWN),
  );
  // One per row, so they can be staggered rather than all turning together.
  const fades = useRef(
    Array.from({ length: SHOWN }, () => new Animated.Value(1)),
  ).current;

  useEffect(() => {
    // Reduce motion means the page does not move on its own: no rotation,
    // not just no animation. Content that changes while it is being read is
    // the thing the setting is there to stop.
    if (still || about != null) return;

    const turn = () => {
      const out = fades.map((f, i) =>
        Animated.timing(f, {
          toValue: 0,
          duration: 220,
          delay: i * 70,
          easing: Easing.in(Easing.quad),
          // The words are INSIDE the glass, so their opacity is the
          // material's business rather than an ancestor's — which is what
          // makes this the one thing here that can be faded at all.
          useNativeDriver: true,
        }),
      );
      Animated.parallel(out).start(({ finished }) => {
        if (!finished) return;
        setShown((was) => someOpeners(SHOWN, was));
        Animated.parallel(
          fades.map((f, i) =>
            Animated.timing(f, {
              toValue: 1,
              duration: 260,
              delay: i * 70,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ),
        ).start();
      });
    };

    const timer = setInterval(turn, HOLD_MS);
    return () => clearInterval(timer);
  }, [fades, still, about]);

  return (
    <View
      style={{
        gap: SPACE.md,
        paddingTop: SPACE.xl,
        alignItems: "center",
        // A suggestion is a line, not a banner: on a tablet the capsules stop
        // at a phone's width or so, centred under the greeting. No effect on
        // a phone, which is narrower than this already.
        width: "100%",
        maxWidth: wide && landscape ? CHAT_MAX : 560,
        alignSelf: "center",
      }}
    >
      <UIcon name="sparkles" size={40} color={PRIMARY_500} />
      <Text
        style={{
          fontSize: 18,
          fontWeight: "700",
          color: TEXT_PRIMARY,
          textAlign: "center",
        }}
      >
        {greeting}
      </Text>
      <Text
        style={{
          fontSize: 14,
          lineHeight: 20,
          color: TEXT_MUTED,
          textAlign: "center",
          marginBottom: SPACE.sm,
        }}
      >
        {about != null
          ? tr(
              `ถามเรื่อง${about}ได้เลยค่ะ ไม่ต้องพิมพ์ชื่อ`,
              `Ask about ${about} — no need to type the name.`,
            )
          : invite}
      </Text>
      <View
        style={
          wide && landscape && about == null
            ? {
                flexDirection: "row",
                alignItems: "flex-start",
                gap: SPACE.lg,
                alignSelf: "stretch",
              }
            : { alignSelf: "stretch", gap: SPACE.md }
        }
      >
        {about == null ? (
          <View style={wide && landscape ? { flex: 1 } : undefined}>
            <BriefCard onAsk={onPick} />
          </View>
        ) : null}
        <View
          style={{
            gap: SPACE.md,
            ...(wide && landscape && about == null ? { flex: 1 } : {}),
          }}
        >
          {shown.map((q, i) => (
            <Pressable
              key={i}
              onPress={() => onPick(q)}
              accessibilityRole="button"
              accessibilityLabel={q}
              style={{ alignSelf: "stretch" }}
            >
              {/*
                Capsules of the real material, and the thin one.

                "clear" is what Apple uses where what is behind the glass has to
                stay visible through it; "regular" is the frosted default, and a
                tint on top of that is what made these read as milky discs
                rather than as glass. No tint at all: every point of white mixed
                in is a point of the page underneath that stops coming through.

                A plain Pressable around it, never PressableScale — a transform
                on any ancestor stops UIVisualEffectView drawing at all, and
                `interactive` is what answers the finger instead.

                The capsule itself never moves or fades. Only the words in it
                do, which is why the set can change at all: the glass has to
                stay exactly where it is for the material to keep drawing.
              */}
              {/*
                On Android, the edge the material would have drawn.

                The clear stand-in is two fifths of white on a page that is
                itself nearly white, and with no rim and no depth of its own the
                four questions all but vanished — words floating on the page
                with nothing to say they could be tapped. A thin grey outline
                and the toolbar pill's whiteness inside it — no shadow: four
                lifted capsules in a stack read as a column of buttons shouting
                over the page, and an outline is enough to say "tap".
              */}
              {ANDROID && (
                <View
                  pointerEvents="none"
                  style={{
                    ...StyleSheet.absoluteFillObject,
                    borderRadius: RADIUS.capsule,
                    borderWidth: 1,
                    // The system's own subtle fill, as a line: a step past the
                    // separator grey, which vanished against a near-white page.
                    borderColor: "rgba(120,120,128,0.22)",
                  }}
                />
              )}
              <Glass
                effect="clear"
                interactive
                tintColor={ANDROID ? "rgba(255,255,255,0.62)" : undefined}
                style={{
                  height: OPENER_H,
                  justifyContent: "center",
                  paddingHorizontal: SPACE.lg,
                  borderRadius: RADIUS.capsule,
                  overflow: "hidden",
                }}
              >
                <Animated.Text
                  numberOfLines={1}
                  style={{ fontSize: 15, color: TEXT_PRIMARY, opacity: fades[i] }}
                >
                  {q}
                </Animated.Text>
              </Glass>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * One side of the conversation.
 *
 * Pictures stand on their own, outside the bubble. A photograph is already a
 * rectangle with its own edges; putting it on a coloured plate adds a second
 * border around the first and makes the thread look like a scrapbook. The
 * bubble is for words, and when a message is only a picture there are none,
 * so there is nothing for a bubble to hold.
 */
function Bubble({ turn }: { turn: ChatTurn }) {
  const nav = useNavigation<Nav>();
  const mine = turn.role === "user";
  // Looked up as the bubble draws rather than stored on it, so a visit that
  // has been carried out since the answer was given says so.
  const visits = visitsByIds(turn.visits ?? []);
  const shots = turn.images ?? [];
  // One picture gets the bubble's width; several share it two to a row, so a
  // message carrying four is a block rather than a column the thread has to
  // be scrolled past.
  const side = shots.length === 1 ? 200 : 98;

  return (
    <View
      style={{
        // An answer that carries visits takes the thread's whole width: the
        // cards are the app's own, drawn at the size the plan screen draws
        // them, not squeezed into a speech bubble's margin.
        maxWidth: visits.length > 0 || turn.widget != null ? "100%" : "88%",
        alignSelf: mine ? "flex-end" : "stretch",
        alignItems: mine ? "flex-end" : "flex-start",
        gap: SPACE.sm,
      }}
    >
      {shots.length > 0 ? (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: mine ? "flex-end" : "flex-start",
            gap: SPACE.xs,
          }}
        >
          {shots.map((uri) => (
            <Image
              key={uri}
              source={{ uri }}
              style={{ width: side, height: side, borderRadius: RADIUS.lg }}
            />
          ))}
        </View>
      ) : null}

      {turn.text === "" ? null : mine ? (
        <View
          style={{
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 20,
            // The corner nearest the speaker squares off, so the bubble
            // points at whoever said it.
            borderBottomRightRadius: 6,
            backgroundColor: "rgba(7,125,215,0.92)",
          }}
        >
          <Text style={{ fontSize: 15, lineHeight: 22, color: "#FFFFFF" }}>
            {turn.text}
          </Text>
        </View>
      ) : (
        /*
          The assistant's own words, with nothing round them.

          A bubble marks one side of a conversation against the other, and
          with the questions in blue on the right there is nothing left for
          it to distinguish — it only boxed in the one part of the thread
          that is meant to be read rather than glanced at. The panels and
          cards below carry their own edges; this is the page talking.
        */
        <Text
          style={{
            paddingHorizontal: 2,
            fontSize: 16,
            lineHeight: 24,
            color: TEXT_PRIMARY,
          }}
        >
          {turn.text}
        </Text>
      )}

      {turn.widget === "counts" && visits.length > 0 ? (
        <View style={{ alignSelf: "stretch" }}>
          <VisitCounts tasks={visits} now={planToday} />
        </View>
      ) : null}

      {/* Who is unwell, when that is what was asked: the people and the
          readings that are off, each opening their profile. */}
      {turn.widget === "healthList" && turn.residents != null ? (
        <HealthListCard
          residents={turn.residents}
          metric={turn.metric}
          onOpen={(resident) => nav.navigate("HealthTracking", { resident })}
        />
      ) : null}

      {/* How somebody is, when that is what was asked: their latest
          readings as figures and trends, opening their health profile. */}
      {turn.widget === "health" && turn.resident != null ? (
        <HealthCard
          residentId={turn.resident}
          onOpen={(resident) => nav.navigate("HealthTracking", { resident })}
        />
      ) : null}

      {/* The round planned: the stops numbered on one map, in order. */}
      {turn.widget === "tour" && visits.length > 0 ? (
        <TourCard
          stops={visits.filter(hasLocation)}
          onOpenMap={() => 
            nav.navigate("ExploreMap", { tour: visits.filter(hasLocation) })
          }
          onOpenStop={(t) => openTask(nav, t)}
        />
      ) : null}

      {/* The way there, when that is what was asked: a map with the road
          from here, how far, and a button to drive it. */}
      {turn.widget === "route" &&
      visits[0] != null &&
      hasLocation(visits[0]) ? (
        <RouteCard
          task={visits[0]}
          onOpenMap={() => nav.navigate("ExploreMap", { focus: visits[0] })}
        />
      ) : null}

      {/*
        The answer's own visits, as the cards they are everywhere else.

        The model is told the count and asked for a sentence; this is the
        list, and each row opens the visit. An answer about the round should
        be somewhere to work from, not a paragraph to read and then go and
        find the same thing on the plan screen.
      */}
      {/* Visit cards only where the answer is about visits: the route and
          the health cards already are the answer, and the visit they were
          drawn from under them was a card nobody asked for. */}
      {visits.length > 0 &&
      turn.widget !== "healthList" &&
      turn.widget !== "health" &&
      turn.widget !== "route" &&
      turn.widget !== "tour" ? (
        <View style={{ alignSelf: "stretch", gap: SPACE.sm }}>
          {visits.map((task) => (
            <VisitRow
              key={task.id}
              task={task}
              now={planToday}
              onPress={() => openTask(nav, task)}
            />
          ))}
        </View>
      ) : null}

      {/* What the answer offers to do — done only when pressed. */}
      {turn.actions != null && turn.actions.length > 0 ? (
        <ActionButtons actions={turn.actions} />
      ) : null}
    </View>
  );
}

/**
 * The wait, on the assistant's side of the conversation.
 *
 * A bubble with a pulse rather than a spinner in the middle of the sheet:
 * the answer is going to land here, and the wait should be where the answer
 * will be.
 */
function Thinking() {
  const pulse = useRef(new Animated.Value(0.4)).current;
  const still = currentDisplay().reduceMotion;

  useEffect(() => {
    if (still) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 620,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 620,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, still]);

  return (
    <View
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.sm,
        // No bubble, because the answer that lands here will not have one
        // either: the wait should look like the thing it is waiting for.
        paddingHorizontal: 2,
        paddingVertical: 4,
      }}
    >
      <ActivityIndicator size="small" color={PRIMARY_500} />
      <Animated.Text
        style={{ fontSize: 14, color: TEXT_MUTED, opacity: pulse }}
      >
        {tr("กำลังดูข้อมูล", "Looking it up")}
      </Animated.Text>
    </View>
  );
}
