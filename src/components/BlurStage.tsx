import {
  Fragment,
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Platform, View } from "react-native";
import { BlurTargetView } from "expo-blur";

import { CANVAS } from "../theme/tokens";

/**
 * The page a floating bar blurs, kept apart from the bar itself.
 *
 * On Android a blur reads a snapshot of one `BlurTargetView`, and the view
 * doing the blurring may not sit inside the target it reads. The tray used
 * to read the whole window, its own buttons included, which is how the
 * accept button's blue came to be smeared up across the bar above it.
 *
 * So the stage is two layers: the page, wrapped as the target, and above it
 * whatever floats — drawn here rather than where it was written, so that it
 * is outside the thing it blurs. A bar written anywhere inside the page asks
 * `useStageFloat` to be lifted out.
 *
 * iOS blurs whatever is under it with no target to name, so there the stage
 * is nothing and the bar stays where it was written.
 */
type Stage = {
  target: RefObject<View | null>;
  /** The stage's own box, to measure against — the target cannot be. */
  origin: RefObject<View | null>;
  lift: (id: string, node: ReactNode | null) => void;
};

const StageContext = createContext<Stage | null>(null);

const STAGED = Platform.OS === "android";

/*
  The page the carer is looking at, as a blur target.

  For glass that floats over the whole app rather than over one page — the
  snackbar — and so has no stage of its own to ask. Each screen's stage
  claims it when its screen comes into focus (the navigator hands the
  stage its `navigation` for that), and gives it up when it goes.
*/
let focusedTarget: RefObject<View | null> | null = null;

/** The focused page's blur target, on Android; null where there is none. */
export const focusedPage = (): RefObject<View | null> | null => focusedTarget;

/** Just what a stage needs of a screen's navigation to follow its focus. */
type Focusable = {
  isFocused: () => boolean;
  addListener: (type: "focus", callback: () => void) => () => void;
};

export function BlurStage({
  children,
  target: given,
  navigation,
}: {
  children: ReactNode;
  /** The ref to name the page by, where something else needs it too. */
  target?: RefObject<View | null>;
  /** The screen this is the stage of, so it can claim `focusedPage`. */
  navigation?: Focusable;
}) {
  const own = useRef<View | null>(null);
  const target = given ?? own;

  useEffect(() => {
    if (!STAGED || navigation == null) return;
    const claim = () => {
      focusedTarget = target;
    };
    if (navigation.isFocused()) claim();
    const off = navigation.addListener("focus", claim);
    return () => {
      off();
      if (focusedTarget === target) focusedTarget = null;
    };
  }, [navigation, target]);
  const origin = useRef<View | null>(null);
  const [floats, setFloats] = useState<Record<string, ReactNode>>({});
  const stage = useMemo<Stage>(
    () => ({
      target,
      origin,
      lift: (id, node) =>
        setFloats((all) => {
          if (node !== null) return { ...all, [id]: node };
          const { [id]: _gone, ...rest } = all;
          return rest;
        }),
    }),
    [target],
  );

  if (!STAGED) return <>{children}</>;
  return (
    <StageContext.Provider value={stage}>
      <View ref={origin} collapsable={false} style={{ flex: 1 }}>
        {/* The page's own ground, so that the snapshot has it too: what is
            transparent here would otherwise be blurred as the window's. */}
        <BlurTargetView
          ref={target}
          style={{ flex: 1, backgroundColor: CANVAS }}
        >
          {children}
        </BlurTargetView>
        {Object.entries(floats).map(([id, node]) => (
          <Fragment key={id}>{node}</Fragment>
        ))}
      </View>
    </StageContext.Provider>
  );
}

/**
 * Lift what `build` draws out of the page onto the nearest stage.
 *
 * `build` is handed the target to blur. Where there is a stage, the result
 * is drawn there and this returns null, so nothing is left where it was
 * written; where there is none, the target is undefined and this returns
 * the result to be drawn in place, as it always was.
 */
export function useStageFloat(
  build: (target: RefObject<View | null> | undefined) => ReactNode,
): ReactNode {
  const stage = useContext(StageContext);
  const id = useId();
  const node = build(stage?.target);

  // Every render, so the lifted copy follows this one's props.
  useLayoutEffect(() => {
    stage?.lift(id, node);
  });
  useLayoutEffect(() => () => stage?.lift(id, null), [stage, id]);

  return stage ? null : node;
}

/**
 * A page's background, kept as something a glass surface on it can blur.
 *
 * `BlurStage` lifts a floating bar off the page so it can blur the page; a
 * glass panel that scrolls WITH the page cannot be lifted, and a blur may
 * not read a target it sits inside. What such a panel has behind it is not
 * the page's content anyway — the cards do not overlap — but the page's own
 * ground: the gradient under the home screen's header. So that ground alone
 * becomes the target, drawn behind everything else, and the page hands it
 * by name to the glass that stands on it (`Glass`'s `blurTarget`).
 *
 * By name, not through context. It was offered to every blurred glass under
 * the page, and a sheet opened from the home screen is under the page too —
 * so the sheet's close button blurred the sky behind the sheet and came out
 * blue on a white sheet.
 *
 * Only the ground, never the content: a snapshot with photographs in it is
 * where the Android blur has crashed on hardware bitmaps before.
 *
 * iOS has nothing to name — its blur reads whatever is under it — so there
 * the ground is drawn plainly and no target is offered.
 */
export function BlurBackdrop({
  ground,
  target,
  children,
}: {
  /** The page's background layers, drawn behind `children`. */
  ground: ReactNode;
  /** The ref the ground is named by, for the glass that blurs it. */
  target: RefObject<View | null>;
  children: ReactNode;
}) {
  if (!STAGED) {
    return (
      <View style={{ flex: 1 }}>
        {ground}
        {children}
      </View>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <BlurTargetView
        ref={target}
        style={{ position: "absolute", inset: 0, backgroundColor: CANVAS }}
      >
        {ground}
      </BlurTargetView>
      {children}
    </View>
  );
}

/**
 * One tab's page, as something the tab bar floating over it can blur.
 *
 * The tab bar cannot sit on a `BlurStage` — its host's own native view does
 * not survive being put inside a blur target, which is how the bar once went
 * missing altogether. So each tab's page is made a target on its own, and
 * the bar is handed the one that is showing (`useSceneTargets`). The bar is
 * drawn beside the pages, never inside one, which is the rule the blur needs.
 * Each page is a full stage, so what floats over it can be lifted as well.
 */
export function BlurScene({
  target,
  navigation,
  children,
}: {
  target: RefObject<View | null>;
  navigation?: Focusable;
  children: ReactNode;
}) {
  // A stage of its own too, so a control fixed over the tab's page — the
  // home screen's toolbar pill — can be lifted onto it (`Floating`).
  return (
    <BlurStage target={target} navigation={navigation}>
      {children}
    </BlurStage>
  );
}

/**
 * A ref per tab, made once and kept, so the page and the bar agree on which
 * view is which.
 */
export function useSceneTargets(): (key: string) => RefObject<View | null> {
  const scenes = useRef(new Map<string, RefObject<View | null>>()).current;
  return (key) => {
    let ref = scenes.get(key);
    if (ref == null) {
      ref = { current: null };
      scenes.set(key, ref);
    }
    return ref;
  };
}

/**
 * Glass fixed over a scrolling page, lifted off it so it can blur it.
 *
 * A control that stays put while the page scrolls under it — the home
 * screen's toolbar pill — has the page's content behind it, not just the
 * page's ground, so the ground alone is the wrong thing to blur: a white
 * card passing under the pill came out as the blue sky above it. Lifted
 * onto the stage like the floating action bar, it sits outside the page
 * and can read all of it. The wrapper's own position is kept, since the
 * stage covers the same box the screen did.
 */
const FloatContext = createContext<RefObject<View | null> | null>(null);

export function Floating({ children }: { children: ReactNode }) {
  return useStageFloat((target) =>
    target == null ? (
      children
    ) : (
      <FloatContext.Provider value={target}>{children}</FloatContext.Provider>
    ),
  );
}

/**
 * What a blurred glass surface here should read on Android: the page it
 * floats over (`Floating`), or nothing.
 */
export function useGlassTarget(): RefObject<View | null> | null {
  return useContext(FloatContext);
}

/**
 * The stage a control could be lifted onto: the page it would blur, and
 * the box to measure its position against. Null where there is none.
 */
export function useStage(): Pick<Stage, "target" | "origin"> | null {
  return useContext(StageContext);
}
