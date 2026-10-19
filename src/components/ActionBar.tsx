import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useLayoutEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { BlurView, type BlurViewProps } from "expo-blur";

import { useStageFloat } from "./BlurStage";
import { Glass } from "./Glass";
import {
  GLASS_OFF,
  LIQUID_GLASS,
  PLATE,
  PLATE_SHEER,
  PRIMARY_500,
  RADIUS,
  SURFACE,
  SURFACE_SUNK,
  SPACE,
  currentTheme,
  shadow,
  RIM_LIT,
  GLASS_LIFT,
} from "../theme/tokens";
import { FORM_MAX, IS_TABLET, useLayout } from "../theme/layout";
import { Check } from "lucide-react-native";
import { useHeaderSlot } from "./ScreenFrame";

/**
 * Set round a sheet on a tablet: the tray there is not a float over the
 * sheet's content but a plain footer under it, in the sheet's own flow.
 *
 * A floating tray is for a phone, whose page runs to the screen's foot and
 * has to keep scrolling under the buttons. A tablet's sheet is a card with
 * room to spare, and a float in it only covers the card's last lines for
 * nothing — the reading on the measure sheet was being cut off by one.
 */
const DockedContext = createContext(false);

export function DockedTray({ children }: { children: ReactNode }) {
  return (
    <DockedContext.Provider value>{children}</DockedContext.Provider>
  );
}

/**
 * The room a page leaves at its foot for the tray: `room` under a floating
 * one, and nothing where it is docked and takes its own.
 */
export function useTrayRoom(room: number): number {
  return useContext(DockedContext) ? 0 : room;
}

/**
 * The bar's own measurements — the accept-task bar's, which this now matches.
 *
 * 25 in from each side and 23 up from the foot: level with the tab bar's pill
 * on the tabbed screens. Not the safe-area inset — iOS 26 draws that pill
 * inset within a UITabBar frame running to the screen edge, and the margin it
 * leaves is smaller than the safe area.
 */
const BAR = {
  side: 25,
  bottom: 23,
  pad: SPACE.sm,
  radius: 36,
  button: 48,
} as const;

/**
 * What the tray's blur asks for, which is not one setting on both platforms.
 *
 * On iOS `intensity` is only the material: UIBlurEffect paints its own veil
 * and its own radius together, and 80 of it under the plate is the tray.
 *
 * On Android there is no material to ask. Left alone, expo-blur draws a flat
 * semi-transparent view and nothing else — which is why the bar arrived with
 * the page reading straight through it: nothing was ever blurred, only
 * dimmed. The blur is reached through `blurMethod`, and once it
 * is on, `intensity` drives BOTH the radius (`intensity / blurReductionFactor`)
 * and the veil over it (`intensity / 100 × k`, k fixed per tint) — so buying
 * a hard blur by raising the intensity buys a white slab with it. The two are
 * moved apart the only way they can be: the intensity kept low for a thin
 * veil, the divisor dropped to one to win the radius back. `Glass` reaches
 * its own frost by the same route, and these are that surface's numbers.
 *
 * The tint is the one surface in the app a token cannot reach — expo-blur
 * takes a word, not a colour — so it is told which ground it is on. Left at
 * the light one it stays a milky slab on a black page.
 */
export function trayBlur(dark: boolean): BlurViewProps {
  if (Platform.OS !== "android") {
    return { intensity: 80, tint: dark ? "dark" : "light" };
  }
  return {
    intensity: 40,
    /*
      The divisor at one, to win back every point of blur the low intensity
      gave up. It was raised to five while the blur read the whole window:
      forty points of radius reached the bar's own buttons and smeared the
      accept button's blue up across the tray. The bar now blurs only the
      page under it — see `BlurStage` — so the full radius is back.
    */
    blurReductionFactor: 1,
    tint: dark ? "systemUltraThinMaterialDark" : "default",
    // Android 12 and up: below it the library blurs through a software
    // canvas, which throws on the photographs a page may carry. See `Glass`.
    blurMethod: "dimezisBlurViewSdk31Plus",
  };
}

/**
 * Whether this build has a material to glaze with, or only paint.
 *
 * Read once, here, rather than asked at each control: the tray's blur, its
 * plate and its buttons are three answers to one question, and they were
 * drifting apart while each was decided on its own.
 */
/**
 * Whether the tray is itself Apple's Liquid Glass — iOS 26.
 *
 * Then the buttons standing on it are paint, not glass: a glass capsule on a
 * glass tray has only the tray to refract and comes out a smeared blob with
 * no edge. Below iOS 26 the tray stays the blurred plate and the buttons stay
 * glass, which is the arrangement the rest of this file describes.
 */
const GLASS_TRAY = LIQUID_GLASS;

const PAINTED = Platform.OS === "android" || GLASS_TRAY;

/**
 * The floating tray at the foot of the add-house flow.
 *
 * The same frame the accept-task screen carries: a blurred white plate, not
 * Apple's glass.
 *
 * Both cannot be a material at once. UIGlassEffect refracts what is behind
 * it, so anything glass standing on a glass frame has only that frame to
 * sample and comes out as a smeared blob with no edge. A plate at 50% over a
 * blur is what the design specifies for the bar itself, and it gives what
 * sits on it real content to refract.
 *
 * The plate stays at that 50%, and the blur under it carries the weight.
 * Over a page of running text the design's own blur is too slight — it
 * softens the letters instead of dissolving them, and a paragraph goes on
 * reading through the buttons — but thickening the plate to stop it would
 * trade the glass for a white slab. A harder blur ends the words and keeps
 * the tray see-through, which is what the material is for. `trayBlur` is
 * how much, per platform.
 */
/** A capsule drawn for the header rather than the tray (see ActionBar). */
const CompactContext = createContext(false);

export function ActionBar({
  children,
  side = BAR.side,
  bottom = BAR.bottom,
  pad = BAR.pad,
  radius = BAR.radius,
  bottomRadius = radius,
}: {
  children: ReactNode;
  /**
   * How far in from each edge, overriding the standard frame.
   *
   * For a tray that is not just a row of capsules. The bar's own measurements
   * are the accept-task bar's, which sits where the tab bar's pill sits —
   * right for a tray that IS a button, and too narrow for one carrying a
   * readout above it, which wants the map sheet's 8pt instead.
   */
  side?: number;
  bottom?: number;
  /** The room inside. 8 holds a capsule; content needs the app's 16. */
  pad?: number;
  /** The top corners. */
  radius?: number;
  /**
   * The bottom corners, where they differ from the top.
   *
   * The map sheet's resting shape: 36 across the top and 58 along the
   * bottom, so the tray sits into the foot of the screen rather than being a
   * rectangle with equal corners parked near it. Left off, the corners match.
   */
  bottomRadius?: number;
}) {
  /*
    Up in the header, on a tablet held sideways.

    There the tray's buttons go beside the header's toolbar, as compact
    capsules, rather than floating over the foot of the form — a long way
    from the eye across a landscape screen, and over the form's last rows.
    Only a tray of plain buttons moves: one carrying a readout or a field
    stays where its layout was drawn. And only where the page has a header
    to take them.
  */
  const slot = useHeaderSlot();
  const window = useWindowDimensions();
  const headed = useSyncExternalStore(
    (l) => {
      if (slot == null) return () => {};
      slot.listeners.add(l);
      return () => {
        slot.listeners.delete(l);
      };
    },
    () => (slot?.headers ?? 0) > 0,
  );
  const plain = Children.toArray(children).every(
    (c) =>
      isValidElement(c) &&
      (c.type === PrimaryAction ||
        c.type === SecondaryAction ||
        c.type === ActionCapsule),
  );
  const up = IS_TABLET && window.width > window.height && headed && plain;
  useLayoutEffect(() => {
    if (slot == null) return;
    slot.set(
      up ? (
        <CompactContext.Provider value>{children}</CompactContext.Provider>
      ) : null,
    );
  });
  useEffect(() => () => slot?.set(null), [slot]);

  // The shadow is cast from this view, so it needs the same shape as the
  // plate inside it — a rounded plate in a square shadow reads as a card
  // lying on a rectangle of grey.
  const corners = {
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    borderBottomLeftRadius: bottomRadius,
    borderBottomRightRadius: bottomRadius,
  } as const;

  // Drawn on the page's stage where there is one, so that the blur under it
  // reads the page and never these buttons. See `BlurStage`.
  /*
    On a tablet the tray keeps to the width of the form it serves, centred,
    rather than stretching a capsule a foot long across the screen. Capped
    against whatever it stands in — a sheet or the whole window — not
    against a measured window, so a page sheet on an iPad centres it too.
    On a phone the cap is never reached and nothing moves.
  */
  const docked = useContext(DockedContext);
  const floating = useStageFloat((target) =>
    up || docked ? null : (
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: side,
          right: side,
          bottom,
          alignItems: "center",
        }}
      >
        <View
          pointerEvents="box-none"
          style={{
            width: "100%",
            maxWidth: FORM_MAX,
            ...corners,
            // Out here, not on the plate: that one clips to its rounded corners
            // with overflow "hidden", which would cut its own shadow away. Under
            // Apple's glass too: the bar floats, and the glass alone did not
            // lift it off the page.
            boxShadow: shadow({ blur: 16, y: 4, opacity: 0.16 }),
          }}
        >
          <View
            style={{
              ...corners,
              overflow: "hidden",
              padding: pad,
              gap: pad,
            }}
          >
            {GLASS_TRAY ? (
              // Apple's material is the whole of the surface: no blur of ours
              // under it and no plate over it, either of which it would only
              // refract as a flat patch.
              <Glass style={[StyleSheet.absoluteFill, corners]} />
            ) : (
              <>
                {/*
              The blur, and what it reads: the stage's page, where there is a
              stage. Nesting the buttons inside the BlurView was tried before
              this and settled nothing — expo-blur's Android view adds React's
              children beside its blur, not over it, so they were read too.
            */}
                <BlurView
                  {...trayBlur(currentTheme() === "dark")}
                  blurTarget={target}
                  style={StyleSheet.absoluteFill}
                />
                {/*
              The plate over the blur, and how much of it there is.

              Two coats of white is how a piece of glass becomes a panel. On
              iOS the blur under this is UIBlurEffect at 80 and paints almost
              no veil of its own, so the design's half-plate is the body of the
              surface. On Android the veil and the radius are the same number —
              see `trayBlur` — so a veil arrives whether it is wanted or not,
              and the plate laid over it at the same weight turned the tray
              into a slab with the page painted out behind it. Where that veil
              is already there, this steps back and lets the blur be what is
              seen.
            */}
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      backgroundColor:
                        Platform.OS === "android" ? PLATE_SHEER : PLATE,
                    },
                  ]}
                />
              </>
            )}
            {children}
          </View>
        </View>
      </View>
    ),
  );
  if (docked && !up) {
    return (
      <View
        style={{
          paddingHorizontal: side,
          paddingTop: SPACE.md,
          paddingBottom: SPACE.xl,
          alignItems: "center",
        }}
      >
        <View style={{ width: "100%", maxWidth: FORM_MAX, gap: pad }}>
          {children}
        </View>
      </View>
    );
  }
  return floating;
}

/**
 * One 48pt capsule — Apple's glass, or paint.
 *
 * The accept-task screen's button, made shared: a plain Pressable around a
 * `Glass` — not PressableScale, which animates a transform on an ancestor,
 * and a transformed ancestor stops UIVisualEffectView drawing its material
 * at all. The glass answers the touch itself, through `interactive`.
 *
 * Disabled is a change of tint, never of opacity, for the same reason: an
 * alpha below 1 on any ancestor strips the material, so a faded button
 * would be a flat one.
 *
 * On Android it is not glass at all, and that is a decision rather than a
 * shortfall. Every tint in this file was chosen to be MIXED INTO a material
 * — translucent, so the page keeps moving under the button — and where
 * there is no material each one is just a thin colour over whatever the
 * tray happens to be: a white at half strength on a near-white tray came
 * out one unit from its own background, which is not a faint button, it is
 * no button. Painting them is the honest translation, the same choice this
 * file already makes for the blur and the plate.
 */
export function ActionCapsule({
  label,
  onPress,
  disabled,
  tint,
  disabledTint,
  paint,
  disabledPaint,
  color,
  icon,
}: {
  /**
   * What it shrinks to in a header too narrow for its words — a form in a
   * column beside the patient, or in a floating window: a round button with
   * this glyph, the words kept for VoiceOver.
   */
  icon?: React.ReactNode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** The colour mixed into the material. Keep it translucent. */
  tint: string;
  /** What it is mixed with while the action is unavailable. */
  disabledTint?: string;
  /** The same button, painted, for the platform that has no material. */
  paint: string;
  disabledPaint?: string;
  /** The label. */
  color: string;
}) {
  const off = disabled === true;
  // Beside a header's toolbar rather than across a tray: the toolbar's
  // height, and as wide as the words.
  const compact = useContext(CompactContext);
  // Docked in a tablet's sheet: no tray under it either.
  const docked = useContext(DockedContext);
  /*
    Painted on a glass tray, where glass on glass would be a smear; but up
    in the header, or docked at a sheet's foot, there is no tray under it,
    and there it is Apple's glass like the toolbar.
  */
  const painted =
    Platform.OS === "android" || (PAINTED && !compact && !docked);
  // In a header narrower than this, the words give way to the glyph.
  const { width } = useLayout();
  const round = compact && icon != null && width < ROUND_BELOW;
  const shape = {
    height: compact ? 44 : BAR.button,
    width: round ? 44 : undefined,
    paddingHorizontal: compact && !round ? SPACE.lg : 0,
    // At least the two-slot toolbar pill beside it, 104 across, so the
    // two read as a matched pair rather than a pill and a stub.
    minWidth: round ? 44 : compact ? 104 : undefined,
    borderRadius: RADIUS.capsule,
    alignItems: "center",
    justifyContent: "center",
  } as const;
  /*
    One line, across the whole capsule.

    Left to size itself, the label is measured by Android and then drawn,
    and for Thai the two disagree: "ไม่ยอมรับ" came back a hair narrower
    than it draws, and broke after its first word in a capsule with room
    to spare. Stretched to the capsule's width and centred inside it, the
    measure no longer decides where the line ends.
  */
  const word = round ? (
    <View style={{ opacity: off ? 0.7 : 1 }}>{icon}</View>
  ) : (
    <Text
      numberOfLines={1}
      style={{
        alignSelf: "stretch",
        textAlign: "center",
        fontSize: 16,
        fontWeight: "500",
        color,
        opacity: off ? 0.7 : 1,
      }}
    >
      {label}
    </Text>
  );
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off }}
    >
      {/* Standing on the page rather than a tray — in the header, or at a
          sheet's foot — the toolbar's own lift: a shadow cast from a
          hairline ring behind the glass, never laid over it. */}
      {(compact || docked) && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            borderRadius: RADIUS.capsule,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: RIM_LIT,
            boxShadow: shadow(GLASS_LIFT),
          }}
        />
      )}
      {painted ? (
        <View
          style={{
            ...shape,
            backgroundColor: off ? (disabledPaint ?? paint) : paint,
          }}
        >
          {word}
        </View>
      ) : (
        <Glass
          tintColor={off ? (disabledTint ?? tint) : tint}
          interactive={!off}
          style={shape}
        >
          {word}
        </Glass>
      )}
    </Pressable>
  );
}

/**
 * Below this width a header's action is a round button with its glyph: the
 * capsule with its words, beside the title and the toolbar, would push the
 * title down to a couple of letters.
 */
const ROUND_BELOW = 560;

/** The tray's primary action — the design's blue, as glass. */
export function PrimaryAction({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <ActionCapsule
      label={label}
      onPress={onPress}
      disabled={disabled}
      /*
        Translucent, on both platforms, and the tray is why.

        The alpha is here for Apple's material — it is the opacity the
        glass can still refract the page through — and the obvious reading
        of that is that it means nothing off the material and the blue
        should simply be itself. Painted solid on Android it measured
        (7,125,215) against the (47,146,221) the same button has always
        shown on both platforms, and the difference is not subtle: a
        deeper, harder blue on one side of a build meant to look like one
        app.

        What the alpha is doing there is not refraction, it is the tray
        showing through — and the tray is nearly white on both, so the
        colour it mixes to is the colour the design was approved at. It
        stays.
      */
      tint="rgba(7,125,215,0.78)"
      disabledTint={GLASS_OFF}
      icon={<Check size={22} color="#FFFFFF" strokeWidth={2.8} />}
      // Painted, the brand blue itself — there is nothing behind it to mix
      // with and nothing for a material to refract.
      paint={PRIMARY_500}
      disabledPaint={SURFACE_SUNK}
      color="#FFFFFF"
    />
  );
}

/**
 * The way past a step, under the action that completes it.
 *
 * Tinted with the tray's own plate, so it reads as cut from the thing it is
 * standing on rather than laid on top of it.
 */
export function SecondaryAction({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <ActionCapsule
      label={label}
      onPress={onPress}
      /*
        Cut from the tray, which is not the same colour on both platforms.

        The plate tint is the right answer on Apple's material: UIGlassEffect
        mixes it in and draws the capsule's own rim and inner shadow around
        it, so a white tint on a white tray still arrives as a shape. The
        stand-in has no rim to draw — it is the tint and nothing else — and
        half a white on a tray that is already nearly white measured one
        unit apart from its own background on the device. The capsule was
        not faint, it was absent: a word in blue floating on the bar.

        So off the material it is the app's own surface, solid white — a
        flat colour, and deliberately not another translucent one. A wash
        over a tray that is itself a wash over a blur is three sheets of
        nearly nothing stacked up, and what comes out the other side is a
        haze where a button should be. The tray is sheer here, so a solid
        white stands up off it as a shape.
      */
      tint={PLATE}
      // Solid white, one step up from the sheer tray — a card standing on
      // it rather than a well cut into it.
      paint={SURFACE}
      color={PRIMARY_500}
    />
  );
}
