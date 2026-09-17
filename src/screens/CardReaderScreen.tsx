import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import {
  ActionBar,
  PrimaryAction,
  SecondaryAction,
} from "../components/ActionBar";
import { CardReader3D } from "../components/CardReader3D";
import { TiltHalo } from "../components/TiltHalo";
import { ScreenHeader } from "../components/ScreenHeader";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  readCard,
  readReader,
  READER_LABEL,
  type ReaderState,
} from "../models/community";
import {
  CANVAS,
  DANGER,
  PRIMARY_500,
  RADIUS,
  SPACE,
  SUCCESS,
  TEXT_MUTED,
  TEXT_PRIMARY,
  WARNING,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Figma 443:53573 gives the reader a white disc to stand on. That worked on
 * the artboard and not on the phone: a white circle on a near-white canvas is
 * only visible where the black of the reader happens to end, so the picture
 * read as cut out and dropped on the page.
 *
 * Rings of dots instead — the halo the pulse card already wears, at a size
 * that spreads past the picture. It gives the reader somewhere to stand
 * without drawing an edge, and reads as something radiating from the device,
 * which is what a card reader waiting for a card is doing.
 */
const D = {
  /*
    The reader and its card are drawn now rather than photographed — see
    `CardReaderSim`. What is left here is the halo they stand in.
  */
  /** The outermost ring, set wide enough to clear the picture's corners. */
  halo: 340,
  /**
   * The picture is taller than it is wide — a card standing on end over a
   * reader, with the lead running out below — and drawn in a square it sat
   * small in the middle with air either side. The scene's canvas runs past
   * the halo top and bottom instead; the camera's field is vertical, so the
   * same framing on a taller canvas is simply drawn larger.
   */
  scene: 480,
} as const;

/** The dot beside the status line takes the state's own colour. */
// Read as it renders: applyTheme runs inside App's render, after every
// screen module body, so a token in a module const keeps the light
// palette it was imported under.
const DOT = (): Record<ReaderState, string> => ({
  checking: WARNING,
  ready: SUCCESS,
  missing: DANGER,
  reading: PRIMARY_500,
});

/** What the page says it is waiting for, in each state. */
const TELL: Record<ReaderState, { title: string; detail: string }> = {
  checking: {
    title: "กำลังตรวจสอบเครื่องอ่านบัตร",
    detail: "รอสักครู่ ระบบกำลังเชื่อมต่อกับเครื่องอ่าน",
  },
  ready: {
    title: "กรุณาเสียบบัตรประชาชนเข้ากับเครื่องอ่าน",
    detail: "ให้ด้านที่มีชิปหันขึ้น แล้วดันเข้าจนสุด",
  },
  missing: {
    title: "ไม่พบเครื่องอ่านบัตร",
    detail: "ตรวจสอบว่าเสียบสายเครื่องอ่านกับอุปกรณ์แล้ว จากนั้นลองใหม่",
  },
  reading: {
    title: "กำลังอ่านข้อมูลจากบัตร",
    detail: "อย่าดึงบัตรออกจนกว่าจะอ่านเสร็จ",
  },
};

/**
 * "บริการงานชุมชน" — the way into a community visit, and the only way.
 *
 * A community clinic sees whoever turns up, so there is no list to pick a
 * patient from: the national ID card is the identity and the reader is the
 * door. The page therefore has one job before anything else, which is to say
 * whether that door works — a carer who inserts a card into a terminal that
 * was never enumerated gets no error, just nothing happening, and will try it
 * four or five times before suspecting the cable.
 *
 * Built like the add-member sheet rather than as a splash: a close button and
 * a centred title, the content running down from the top, and the action on
 * the floating bar. Centring the lot in the middle of the screen left a third
 * of the page empty above and below, and put the only way forward on the
 * illustration — which looks like a picture, not a button.
 */
export function CardReaderScreen() {
  const nav = useNavigation<Nav>();
  const [state, setState] = useState<ReaderState>("checking");

  useEffect(() => {
    let live = true;
    readReader().then((next) => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
  }, []);

  /*
    The phone's tilt, for the scene to lean with.

    Loaded lazily and allowed to fail, for the reason `TiltHalo` gives: the
    sensors package looks up every native module it has as it is imported,
    and a build without them must lose the lean, not the page.
  */
  const tilt = useRef({ x: 0, y: 0 });
  useEffect(() => {
    let Accelerometer: typeof import("expo-sensors").Accelerometer;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      Accelerometer = require("expo-sensors").Accelerometer;
      if (Accelerometer?.addListener == null) return;
    } catch {
      return;
    }
    Accelerometer.setUpdateInterval(33);
    const clamp = (n: number) => Math.min(1, Math.max(-1, n / 0.5));
    const sub = Accelerometer.addListener(({ x, y }) => {
      tilt.current = { x: clamp(x), y: clamp(y) };
    });
    return () => sub.remove();
  }, []);

  const insert = () => {
    setState("reading");
    readCard().then((holder) => nav.replace("ExamRoom", { holder }));
  };

  const retry = () => {
    setState("checking");
    readReader().then(setState);
  };

  const tell = TELL[state];
  const busy = state === "checking" || state === "reading";

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <ScreenHeader title="บริการงานชุมชน" />

      {/*
        The empty-state shape the add-house flow uses: the picture centred in
        what the header and the bar leave, the line that says what to do under
        it, and the line that says how under that. Nothing in a card — there is
        one thing on this page and a card around it would be a box drawn around
        the whole screen.
      */}
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: SPACE.lg,
          paddingBottom: 140,
        }}
      >
        <View
          style={{
            width: D.halo,
            height: D.scene,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Behind the picture and spreading past it. The dots shrink and
              fade as they go out so it reads as something dispersing, and the
              light across them follows the device — see `TiltHalo`. */}
          <View style={{ position: "absolute" }} pointerEvents="none">
            <TiltHalo
              size={D.halo}
              ink={PRIMARY_500}
              rings={6}
              spacing={18}
              dot={4}
            />
          </View>

          {/* The reader and the card, modelled — see `CardReader3D`. The
              dots behind are still the halo; the scene draws on nothing.

              Not faded when the reader is missing. It was, to 40%, and a
              solid object at 40% is a ghost with the halo showing through
              it — the lamp on its front already says "not found" in red,
              and the line under the picture says it in words. */}
          <CardReader3D state={state} tilt={tilt} width={D.halo} height={D.scene} />
        </View>

        <Text
          style={{
            marginTop: SPACE.lg,
            fontSize: 16,
            lineHeight: 21,
            fontWeight: "600",
            color: TEXT_PRIMARY,
            textAlign: "center",
          }}
        >
          {tell.title}
        </Text>
        <Text
          style={{
            marginTop: SPACE.xs,
            fontSize: 14,
            lineHeight: 20,
            color: TEXT_MUTED,
            textAlign: "center",
          }}
        >
          {tell.detail}
        </Text>

        {/* The reader's own state — a dot and a word, the way a terminal
            light says it. */}
        <View
          style={{
            marginTop: SPACE.md,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: SPACE.md,
            paddingVertical: 5,
            borderRadius: RADIUS.capsule,
            backgroundColor: `${DOT()[state]}14`,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: DOT()[state],
            }}
          />
          <Text
            style={{ fontSize: 12, lineHeight: 16, fontWeight: "600", color: DOT()[state] }}
          >
            {READER_LABEL[state]}
          </Text>
        </View>
      </View>

      <ActionBar>
        <PrimaryAction
          label={
            state === "missing"
              ? "ตรวจสอบอีกครั้ง"
              : state === "reading"
                ? "กำลังอ่านบัตร…"
                : "เสียบบัตรแล้ว"
          }
          disabled={busy}
          onPress={state === "missing" ? retry : insert}
        />
        <SecondaryAction label="ยกเลิก" onPress={() => nav.goBack()} />
      </ActionBar>
    </View>
  );
}
