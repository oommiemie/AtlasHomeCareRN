import { useEffect, useRef, useState, type RefObject } from "react";
import { Animated, Platform, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, Info, TriangleAlert, X } from "lucide-react-native";

import { Glass } from "./Glass";
import { androidWash } from "./GlassIconButton";
import {
  DANGER,
  PRIMARY_500,
  RADIUS,
  SPACE,
  SUCCESS,
  TEXT_PRIMARY,
  WARNING,
  shadow,
} from "../theme/tokens";

/**
 * A word of confirmation, on glass, dropping down from the top of a page.
 *
 * From the top rather than the foot: the foot of most screens is where the
 * floating action bar and the tab bar are, so a word about what just
 * happened came up behind the very buttons that made it happen, or had to
 * be lifted over them by a different amount on every screen. At the top it
 * lands under the status bar and the camera, on every screen alike, and in
 * a sheet it lands under the sheet's own header.
 *
 * It travels by layout rather than by transform: Liquid Glass stops
 * rendering its material under an ancestor with a transform or an alpha,
 * so the capsule is moved by its `top` and never faded. The spring is what
 * gives it the drop in and the lift out.
 *
 * Shown while `message` is a string; the caller decides for how long.
 */
export type SnackTone = "success" | "info" | "warning" | "error";

/**
 * Each tone's disc and glyph — a tick for done, an i for said, a triangle
 * for done-but-look, a cross for did-not-happen. The glyph as well as the
 * colour, because colour is the one channel a reader can be missing.
 */
const TONES: Record<SnackTone, { ground: () => string; Glyph: typeof Check }> =
  {
    success: { ground: () => SUCCESS, Glyph: Check },
    info: { ground: () => PRIMARY_500, Glyph: Info },
    warning: { ground: () => WARNING, Glyph: TriangleAlert },
    error: { ground: () => DANGER, Glyph: X },
  };

export function SnackBar({
  message,
  tone = "success",
  /*
    Clear of the header row: every screen's header puts its 44pt row 8pt
    under the safe area, so 60 lands the bar 8pt under that row rather than
    over the back button and the title — which is where the eye already is
    after pressing something in the page.
  */
  offset = 60,
  blurTarget,
}: {
  message: string | null;
  /** See `TONES`. */
  tone?: SnackTone;
  /** How far below the top safe area it rests. */
  offset?: number;
  /**
   * The page under it, for Android to blur (see `BlurStage`). Without one
   * the capsule is the stand-in's flat frost there — which is what it was
   * everywhere, and read as a white pill pasted over the page.
   */
  blurTarget?: RefObject<View | null> | null;
}) {
  const insets = useSafeAreaInsets();
  const rest = insets.top + offset;
  const hidden = -96;
  const top = useRef(new Animated.Value(hidden)).current;
  // Kept while the bar goes back up — the text and its colour both — so
  // nothing changes mid-flight: a green tick that turned blue on the way
  // out read as a second bar appearing under the first.
  const [shown, setShown] = useState<{
    message: string;
    tone: SnackTone;
  } | null>(null);

  useEffect(() => {
    if (message != null) {
      setShown({ message, tone });
      Animated.spring(top, {
        toValue: rest,
        useNativeDriver: false,
        damping: 14,
        stiffness: 180,
        mass: 0.8,
      }).start();
      return;
    }
    Animated.spring(top, {
      toValue: hidden,
      useNativeDriver: false,
      damping: 18,
      stiffness: 220,
      mass: 0.8,
      overshootClamping: false,
    }).start(({ finished }) => {
      if (finished) setShown(null);
    });
  }, [message, tone, top, rest]);

  if (shown == null) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: SPACE.lg,
        right: SPACE.lg,
        top,
        alignItems: "center",
        // Over the header and anything floating on the page, which it
        // shares the top of the screen with.
        zIndex: 500,
      }}
    >
      {/*
        A light shadow under the capsule, on both platforms — enough to lift
        it off a page of the same pale ground, not so much that it reads as
        a card. On a view of its own with the capsule's shape: the glass
        clips to its corners, and the clip would take its own shadow with
        it. An outer shadow is drawn outside the box only, so Apple's glass
        has nothing of it to refract.
      */}
      <View
        style={{
          borderRadius: RADIUS.capsule,
          boxShadow: shadow({ blur: 10, y: 4, opacity: 0.14 }),
        }}
      >
        <Glass
          // On Android, blurred where there is a page to blur, with the
          // toolbar pill's coat of white over it so the words read off it;
          // iOS's own material needs none of this.
          blurred={blurTarget != null}
          blurTarget={blurTarget ?? undefined}
          frost="sheer"
          tintColor={
            Platform.OS === "android" && blurTarget != null
              ? androidWash(true)
              : undefined
          }
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: SPACE.sm,
            minHeight: 48,
            paddingVertical: SPACE.sm,
            paddingLeft: SPACE.md,
            paddingRight: SPACE.xl,
            borderRadius: RADIUS.capsule,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: TONES[shown.tone].ground(),
            }}
          >
            {(() => {
              const { Glyph } = TONES[shown.tone];
              return <Glyph size={15} color="#FFFFFF" strokeWidth={3} />;
            })()}
          </View>
          {/* Two lines at most: an error has to say what went wrong, and
            one line cut it off at the part that mattered. */}
          <Text
            numberOfLines={2}
            style={{
              flexShrink: 1,
              fontSize: 14,
              lineHeight: 20,
              fontWeight: "600",
              color: TEXT_PRIMARY,
            }}
          >
            {shown.message}
          </Text>
        </Glass>
      </View>
    </Animated.View>
  );
}
