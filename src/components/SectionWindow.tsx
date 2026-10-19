import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  Text,
  View,
} from "react-native";
import {
  AppWindow,
  Maximize2,
  Minimize2,
  Minus,
  PanelsTopLeft,
  X,
} from "lucide-react-native";

import { Glass } from "./Glass";
import { tr } from "../i18n";
import { feel } from "../utils/haptics";
import {
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  SURFACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TYPE,
} from "../theme/tokens";

/*
  Sections that behave like windows — iPadOS's own "•••" at the head of a
  window, and the Mac's traffic lights on one that floats.

  A section is docked as a column of the page, shown alone across the whole
  screen, floating over the page as a window that is dragged by its bar and
  sized from its corner, or put away to a pill at the foot of the screen.
  Its content is never rebuilt on the way between: the host is one view
  whose frame changes, with the content as a keyed child of it, so a form
  half filled in is still half filled in after it has floated, gone full
  screen and come back.
*/

export type WindowMode = "docked" | "full" | "floating" | "min";

export type Frame = { x: number; y: number; w: number; h: number };

/** How far down inside a docked section's card the "•••" sits. */
const DOTS_TOP = 5;
/** A floating window's bar: traffic lights, the "•••", and what it is dragged by. */
const BAR_H = 34;
const WIN_MIN_W = 320;
const WIN_MIN_H = 300;

/**
 * The three dots, as iPadOS draws them at the head of a window: small and
 * faint, there to be found rather than to be looked at.
 */
function Dots({ on }: { on: boolean }) {
  return (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: on ? "rgba(60,60,67,0.75)" : "rgba(60,60,67,0.3)",
          }}
        />
      ))}
    </View>
  );
}

/** One of a floating window's traffic lights. */
function Light({
  color,
  label,
  onPress,
}: {
  color: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: color,
        borderWidth: 0.5,
        borderColor: "rgba(0,0,0,0.15)",
        opacity: pressed ? 0.6 : 1,
      })}
    />
  );
}

/**
 * How every change of place goes: quick to start and long to settle, so a
 * section lifting out into a window, opening across the screen or tucking
 * itself into the dock reads as one movement, not a jump.
 */
const MOVE = { duration: 340, easing: Easing.bezier(0.22, 1, 0.36, 1) };

export function SectionWindow({
  mode,
  frame,
  inset,
  hidden,
  awayTo,
  enterFrom,
  highlighted,
  front,
  title,
  onDots,
  onFrame,
  onDock,
  onMinimize,
  onFull,
  onTouch,
  onDrop,
  children,
}: {
  mode: WindowMode;
  /** Where the section stands, in the page's own coordinates. */
  frame: Frame;
  /** Docked or full: how far its card stands in from the frame. */
  inset: { top: number; left: number; right: number };
  /** Out of sight but kept — another is full screen, or this is put away. */
  hidden: boolean;
  /**
   * Where it goes as it is hidden — the dock's pill when it is put away,
   * off the edge when it is closed — shrinking and fading on the way.
   */
  awayTo?: Frame;
  /** Where it comes in from as it first appears. */
  enterFrom?: Frame;
  /** Its "•••" is open: the section is ringed so the carer sees which. */
  highlighted: boolean;
  /** A floating window on top of the others. */
  front: boolean;
  title: string;
  onDots: () => void;
  /** A floating window dragged or sized. */
  onFrame: (f: Frame) => void;
  /** 🔴 — back into the page (or, for one that can be, closed). */
  onDock: () => void;
  /** 🟡 */
  onMinimize: () => void;
  /** 🟢 */
  onFull: () => void;
  /** Touched anywhere: brought to the front. */
  onTouch: () => void;
  /**
   * A docked section dragged by its "•••" and let go, with where its middle
   * ended up — the page decides whether that is past the other section.
   */
  onDrop?: (centreX: number) => void;
  children: ReactNode;
}) {
  const floating = mode === "floating";

  /*
    Its place, animated. Frame, not transform: a transform on anything
    above Apple's glass stops the material drawing, and the page's columns
    have to reflow around it anyway. While a finger is dragging or sizing
    it, the place follows the finger with no easing at all.
  */
  const start = enterFrom ?? frame;
  const ax = useRef(new Animated.Value(start.x)).current;
  const ay = useRef(new Animated.Value(start.y)).current;
  const aw = useRef(new Animated.Value(start.w)).current;
  const ah = useRef(new Animated.Value(start.h)).current;
  /*
    Out of sight once it has finished going — moved off the page rather
    than `display: none`, and never faded. Apple's glass inside it (the
    card's ground, the header's buttons) stops drawing under an ancestor
    with any opacity below one, and a glass view switched back from
    `display: none` does not always draw again: both left a section with
    its glass missing until something else made it redraw.
  */
  const [gone, setGone] = useState(hidden);
  const dragging = useRef(false);
  const target = hidden ? (awayTo ?? frame) : frame;
  useEffect(() => {
    if (dragging.current) {
      ax.setValue(target.x);
      ay.setValue(target.y);
      aw.setValue(target.w);
      ah.setValue(target.h);
      return;
    }
    if (!hidden) setGone(false);
    const to = (v: Animated.Value, n: number) =>
      Animated.timing(v, { toValue: n, ...MOVE, useNativeDriver: false });
    const anim = Animated.parallel([
      to(ax, target.x),
      to(ay, target.y),
      to(aw, target.w),
      to(ah, target.h),
    ]);
    anim.start(({ finished }) => {
      if (finished && hidden) setGone(true);
    });
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.x, target.y, target.w, target.h, hidden]);

  // The latest frame and callback, for responders made once.
  const live = useRef({ frame, onFrame });
  live.current = { frame, onFrame };
  const from = useRef(frame);

  const move = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) + Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        from.current = live.current.frame;
        dragging.current = true;
      },
      onPanResponderRelease: () => {
        dragging.current = false;
      },
      onPanResponderTerminate: () => {
        dragging.current = false;
      },
      onPanResponderMove: (_e, g) => {
        const f = from.current;
        live.current.onFrame({ ...f, x: f.x + g.dx, y: f.y + g.dy });
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  const size = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        from.current = live.current.frame;
        dragging.current = true;
        feel("tick");
      },
      onPanResponderRelease: () => {
        dragging.current = false;
      },
      onPanResponderTerminate: () => {
        dragging.current = false;
      },
      onPanResponderMove: (_e, g) => {
        const f = from.current;
        live.current.onFrame({
          ...f,
          w: Math.max(WIN_MIN_W, f.w + g.dx),
          h: Math.max(WIN_MIN_H, f.h + g.dy),
        });
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  /*
    A docked section is moved by its "•••": held and dragged sideways, it
    follows the finger, lifted over the page; let go past the middle of the
    one beside it, the two change places, and otherwise it goes back. A tap
    that does not move opens the menu, as before.
  */
  const [lifted, setLifted] = useState(false);
  const liveDrop = useRef({ onDrop, onDots });
  liveDrop.current = { onDrop, onDots };
  const handle = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        from.current = live.current.frame;
      },
      onPanResponderMove: (_e, g) => {
        if (!dragging.current && Math.abs(g.dx) + Math.abs(g.dy) < 6) return;
        if (!dragging.current) {
          dragging.current = true;
          setLifted(true);
          feel("tick");
        }
        ax.setValue(from.current.x + g.dx);
      },
      onPanResponderRelease: (_e, g) => {
        if (!dragging.current) {
          liveDrop.current.onDots();
          return;
        }
        dragging.current = false;
        setLifted(false);
        const f = from.current;
        // Back to its place unless the page swaps it — a swap moves the
        // target, and the new place's animation takes over from this one.
        Animated.timing(ax, {
          toValue: live.current.frame.x,
          ...MOVE,
          useNativeDriver: false,
        }).start();
        liveDrop.current.onDrop?.(f.x + g.dx + f.w / 2);
      },
      onPanResponderTerminate: () => {
        if (!dragging.current) return;
        dragging.current = false;
        setLifted(false);
        Animated.timing(ax, {
          toValue: live.current.frame.x,
          ...MOVE,
          useNativeDriver: false,
        }).start();
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  // The card the content runs in: inset from the frame when docked, the
  // window's body under its bar when floating.
  const card = floating
    ? { top: BAR_H, left: 0, right: 0, bottom: 0 }
    : { top: inset.top, left: inset.left, right: inset.right, bottom: 0 };

  return (
    <Animated.View
      onTouchStart={onTouch}
      pointerEvents={hidden ? "none" : "auto"}
      style={[
        {
          position: "absolute",
          left: ax,
          top: ay,
          width: aw,
          height: ah,
          zIndex: floating ? (front ? 31 : 30) : lifted ? 20 : hidden ? 0 : 1,
        },
        gone && { left: -100000 },
      ]}
    >
      {/* A floating window's own ground and shadow. */}
      {floating && (
        <View
          key="shadow"
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 22,
            backgroundColor: SURFACE,
            boxShadow: "0 18px 48px rgba(4,18,40,0.28)",
          }}
        />
      )}

      <View
        key="content"
        style={{
          position: "absolute",
          ...card,
          borderTopLeftRadius: floating ? 0 : 28,
          borderTopRightRadius: floating ? 0 : 28,
          borderBottomLeftRadius: floating ? 22 : 0,
          borderBottomRightRadius: floating ? 22 : 0,
          overflow: "hidden",
        }}
      >
        {children}
      </View>

      {/* Lifted by its handle: a shadow under the card, off the page. */}
      {lifted && (
        <View
          key="lift"
          pointerEvents="none"
          style={{
            position: "absolute",
            top: card.top,
            left: card.left,
            right: card.right,
            bottom: 0,
            borderRadius: 28,
            boxShadow: "0 18px 48px rgba(4,18,40,0.28)",
          }}
        />
      )}

      {/* Which section the "•••" is open on: a ring around its card. */}
      {highlighted && (
        <View
          key="ring"
          pointerEvents="none"
          style={{
            position: "absolute",
            top: floating ? 0 : card.top,
            left: card.left,
            right: card.right,
            bottom: 0,
            borderRadius: floating ? 22 : 28,
            borderWidth: 3,
            borderColor: "#FFFFFF",
            boxShadow:
              "0 0 0 1px rgba(4,18,40,0.06), 0 6px 22px rgba(4,18,40,0.18)",
          }}
        />
      )}

      {floating ? (
        /* The window's bar: traffic lights at the left, the "•••" in the
           middle, its name under them — dragged anywhere along it. */
        <View
          key="bar"
          {...move.panHandlers}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: BAR_H,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: SPACE.md,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            borderBottomWidth: 0.5,
            borderBottomColor: SEPARATOR,
          }}
        >
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Light
              color="#FF5F57"
              label={tr("กลับเข้าที่", "Put back")}
              onPress={onDock}
            />
            <Light
              color="#FEBC2E"
              label={tr("ย่อเก็บ", "Minimise")}
              onPress={onMinimize}
            />
            <Light
              color="#28C840"
              label={tr("เต็มจอ", "Full screen")}
              onPress={onFull}
            />
          </View>
          <Text
            numberOfLines={1}
            style={{
              ...TYPE.footnote,
              flex: 1,
              textAlign: "center",
              fontWeight: "600",
              color: TEXT_MUTED,
            }}
          >
            {title}
          </Text>
          <Pressable
            onPress={onDots}
            accessibilityRole="button"
            accessibilityLabel={tr("ตัวเลือกหน้าต่าง", "Window options")}
            hitSlop={10}
            style={{ paddingHorizontal: 6, paddingVertical: 8 }}
          >
            <Dots on={highlighted} />
          </Pressable>
        </View>
      ) : (
        /* Docked or full: the "•••" inside the card, centred on its top
           edge. */
        <View
          key="dots"
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: card.top,
            left: card.left,
            right: card.right,
            height: 24,
            alignItems: "center",
          }}
        >
          {/* A strip wide enough to take hold of, centred on the dots. */}
          <View
            {...handle.panHandlers}
            accessibilityRole="button"
            accessibilityLabel={tr(
              "ตัวเลือกส่วนนี้ แตะเพื่อเปิดเมนู ลากเพื่อย้าย",
              "Section options — tap for the menu, drag to move",
            )}
            accessibilityActions={[{ name: "activate" }]}
            onAccessibilityAction={() => onDots()}
            style={{
              width: 88,
              height: 24,
              alignItems: "center",
              paddingTop: DOTS_TOP,
            }}
          >
            <Dots on={highlighted || lifted} />
          </View>
        </View>
      )}

      {/* A floating window is sized from its corner. */}
      {floating && (
        <View
          key="corner"
          {...size.panHandlers}
          accessibilityRole="adjustable"
          accessibilityLabel={tr("ปรับขนาดหน้าต่าง", "Resize the window")}
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: 32,
            height: 32,
            alignItems: "flex-end",
            justifyContent: "flex-end",
            padding: 7,
          }}
        >
          <View
            style={{
              width: 12,
              height: 12,
              borderRightWidth: 3,
              borderBottomWidth: 3,
              borderColor: "rgba(60,60,67,0.35)",
              borderBottomRightRadius: 4,
            }}
          />
        </View>
      )}
    </Animated.View>
  );
}

export type WindowAction =
  "left" | "right" | "full" | "unfull" | "float" | "dock" | "min" | "close";

/**
 * What the "•••" offers, as iPadOS draws it: a capsule of glass hanging
 * from the dots, one icon per thing the section can be — in the page, a
 * window, the whole screen, put away — and closed, where it can be. The
 * one it is now is lit; the menu settles in from the dots as it opens.
 */
export function WindowMenu({
  at,
  mode,
  canClose,
  canDock = true,
  onPick,
  onDismiss,
}: {
  /** The dots, in page coordinates — the menu hangs from them. */
  at: { x: number; y: number };
  /** What the section is now: that button is lit. */
  mode: WindowMode;
  /** The section can be closed — the AI — rather than only put away. */
  canClose: boolean;
  /** It has a place in the page to go back to (a child's record has not). */
  canDock?: boolean;
  onPick: (a: WindowAction) => void;
  onDismiss: () => void;
}) {
  const buttons: {
    action: WindowAction;
    on: boolean;
    label: string;
    Icon: typeof X;
    danger?: boolean;
  }[] = [
    ...(canDock
      ? [
          {
            action: "dock" as const,
            on: mode === "docked",
            label: tr("วางในหน้า", "In the page"),
            Icon: PanelsTopLeft,
          },
        ]
      : []),
    {
      action: "float",
      on: mode === "floating",
      label: tr("หน้าต่างลอย", "Floating window"),
      Icon: AppWindow,
    },
    {
      action: mode === "full" ? "unfull" : "full",
      on: mode === "full",
      label:
        mode === "full"
          ? tr("ออกจากเต็มจอ", "Exit full screen")
          : tr("เต็มจอ", "Full screen"),
      Icon: mode === "full" ? Minimize2 : Maximize2,
    },
    {
      action: "min",
      on: false,
      label: tr("ย่อเก็บ", "Minimise"),
      Icon: Minus,
    },
    ...(canClose
      ? [
          {
            action: "close" as const,
            on: false,
            label: tr("ปิด", "Close"),
            Icon: X,
            danger: true,
          },
        ]
      : []),
  ];

  // Settling in from the dots: down a few points and up from clear.
  // `top` and opacity, never a transform — the capsule is Apple's glass.
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, {
      toValue: 1,
      duration: 240,
      easing: MOVE.easing,
      useNativeDriver: false,
    }).start();
  }, [t]);

  const W = buttons.length * 46 + 12;
  return (
    <>
      {/* Anywhere else closes it. */}
      <Pressable
        onPress={onDismiss}
        accessibilityLabel={tr("ปิดเมนู", "Close the menu")}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 40,
        }}
      />
      <Animated.View
        style={{
          position: "absolute",
          top: t.interpolate({
            inputRange: [0, 1],
            outputRange: [at.y - 8, at.y],
          }),
          left: at.x - W / 2,
          zIndex: 41,
        }}
      >
        {/* The toolbar's own lift, cast from a ring behind the glass. */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: RADIUS.capsule,
            borderWidth: 0.5,
            borderColor: "rgba(255,255,255,0.7)",
            boxShadow: "0 10px 28px rgba(4,18,40,0.20)",
          }}
        />
        <Glass
          blurred
          frost="milky"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 2,
            padding: 6,
            borderRadius: RADIUS.capsule,
            overflow: "hidden",
          }}
        >
          {buttons.map((b) => (
            // The icons fade in, inside the glass: the material itself is
            // never faded, or it stops drawing.
            <Animated.View key={b.action} style={{ opacity: t }}>
              <Pressable
                onPress={() => {
                  feel("tick");
                  onPick(b.action);
                }}
                accessibilityRole="button"
                accessibilityLabel={b.label}
                accessibilityState={{ selected: b.on }}
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: b.on
                    ? PRIMARY_500
                    : pressed
                      ? "rgba(60,60,67,0.14)"
                      : "transparent",
                })}
              >
                <b.Icon
                  size={20}
                  color={b.on ? "#FFFFFF" : b.danger ? "#D92D20" : TEXT_PRIMARY}
                  strokeWidth={2.2}
                />
              </Pressable>
            </Animated.View>
          ))}
        </Glass>
      </Animated.View>
    </>
  );
}

/** The sections put away, as pills at the foot of the screen — a tap brings one back. */
export function MinimizedDock({
  items,
  bottom,
}: {
  items: {
    key: string;
    label: string;
    icon: ReactNode;
    onRestore: () => void;
  }[];
  bottom: number;
}) {
  if (items.length === 0) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom,
        zIndex: 35,
        alignItems: "center",
      }}
    >
      <View style={{ flexDirection: "row", gap: SPACE.sm }}>
        {items.map((it) => (
          <Pressable
            key={it.key}
            onPress={() => {
              feel("tick");
              it.onRestore();
            }}
            accessibilityRole="button"
            accessibilityLabel={tr(`เปิด ${it.label}`, `Open ${it.label}`)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.sm,
              height: 44,
              paddingHorizontal: SPACE.lg,
              borderRadius: RADIUS.capsule,
              backgroundColor: SURFACE,
              boxShadow: "0 6px 20px rgba(4,18,40,0.18)",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            {it.icon}
            <Text
              numberOfLines={1}
              style={{
                ...TYPE.subheadline,
                fontWeight: "600",
                color: TEXT_PRIMARY,
              }}
            >
              {it.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
