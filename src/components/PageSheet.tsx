import {
  createElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import { BlurTargetView } from "expo-blur";

import { SHEET_RADIUS, SHEET_TOP_GAP, SheetHandle } from "./SheetHandle";
import { ToastHost } from "./Toast";
import { currentDisplay } from "../models/display";
import { SHEET } from "../theme/tokens";

/**
 * A `presentationStyle="pageSheet"` modal, on the platform that has no such
 * thing — drawn to the same design as the navigator's bottom sheets.
 *
 * On iOS that one prop is a whole behaviour: the sheet rises to just below
 * the status bar and the page behind recedes under it. Android's Modal
 * ignores the prop and opens full screen, and twenty places in this app that
 * chose a sheet were saying something by not pushing. So the modal is made
 * transparent and the sheet is drawn in it (see `androidParity`).
 *
 * It was drawn as iOS draws one — 16pt corners, no handle, fixed in place,
 * and the whole modal, dimming and all, sliding up as one. The navigator's
 * sheets, meanwhile, had become Material's own: 28pt corners, a drag handle,
 * a scrim that fades while the sheet rises, and a drag down to close. Two
 * designs of one thing, on one form. This is that second design now, from
 * the same numbers (`SheetHandle`):
 *
 * - the top edge at `SHEET_TOP_GAP`, the corners at `SHEET_RADIUS`, the
 *   handle across the top;
 * - the scrim fades in and the sheet slides up on its own, and both go back
 *   the same way before the modal is taken down;
 * - a tap on the scrim, or a drag down from the top of the sheet, closes it
 *   through the caller's own `onRequestClose` — the same way the back
 *   button does.
 *
 * The drag is taken only from the sheet's top band — the handle and the
 * header row under it — so a list inside scrolls as it always did.
 */

/** The dimming over the page behind — a flat black, as Material's scrim is. */
const SCRIM = "rgba(0,0,0,0.4)";

/** How far down from the sheet's top edge a drag may start. */
const GRAB = 72;

type ModalProps = {
  visible?: boolean;
  onRequestClose?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
};

export function PageSheetModal({
  BaseModal,
  visible = true,
  onRequestClose,
  children,
  ...rest
}: ModalProps & { BaseModal: ComponentType<Record<string, unknown>> }) {
  const { height: screenH } = useWindowDimensions();
  const still = currentDisplay().reduceMotion;

  // Kept up through the closing slide, so the sheet is seen to go rather
  // than being cut away the instant the caller says so.
  const [mounted, setMounted] = useState(visible);
  const shown = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const contents = useRef<View | null>(null);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      drag.setValue(0);
      const anim = Animated.timing(shown, {
        toValue: 1,
        duration: still ? 0 : 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      anim.start();
      return () => anim.stop();
    }
    const anim = Animated.timing(shown, {
      toValue: 0,
      duration: still ? 0 : 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished) setMounted(false);
    });
    return () => anim.stop();
  }, [visible, still, shown, drag]);

  const close = () => onRequestClose?.();

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          onRequestClose != null &&
          g.y0 - SHEET_TOP_GAP < GRAB &&
          g.dy > 6 &&
          Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          // Far enough, or flicked: let it go the rest of the way, then
          // close as the caller closes.
          if (g.dy > 120 || g.vy > 1) {
            Animated.timing(drag, {
              toValue: screenH,
              duration: 180,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }).start(() => onRequestClose?.());
            return;
          }
          Animated.spring(drag, {
            toValue: 0,
            bounciness: 0,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () =>
          Animated.spring(drag, {
            toValue: 0,
            bounciness: 0,
            useNativeDriver: true,
          }).start(),
      }),
    [drag, onRequestClose, screenH],
  );

  const rise = shown.interpolate({
    inputRange: [0, 1],
    outputRange: [screenH, 0],
  });

  return createElement(
    BaseModal,
    {
      ...rest,
      visible: mounted,
      transparent: true,
      // The sheet does its own sliding; the modal only has to be there.
      animationType: "none",
      presentationStyle: undefined,
      // Drawn from the very top of the screen, so the sheet's top edge is
      // where `SHEET_TOP_GAP` says, as it is for the navigator's sheets.
      statusBarTranslucent: true,
      navigationBarTranslucent: true,
      onRequestClose,
    },
    <View style={{ flex: 1 }}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: SCRIM, opacity: shown },
        ]}
      >
        <Pressable
          accessibilityLabel="ปิด"
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View
        {...pan.panHandlers}
        style={{
          flex: 1,
          marginTop: SHEET_TOP_GAP,
          backgroundColor: SHEET,
          borderTopLeftRadius: SHEET_RADIUS,
          borderTopRightRadius: SHEET_RADIUS,
          // The corners are only corners if what is inside them is cut to
          // fit: these sheets open with a header and a scrolling list, both
          // of which run to the edge.
          overflow: "hidden",
          transform: [{ translateY: Animated.add(rise, drag) }],
        }}
      >
        {/* The sheet's contents as a blur target, for the snackbar that
            comes out over them (see the host below). */}
        <BlurTargetView
          ref={contents}
          style={{ flex: 1, backgroundColor: SHEET }}
        >
          {children}
        </BlurTargetView>
        <SheetHandle />
      </Animated.View>
      {/* A word said while this sheet is up comes out on it, not behind
          it on the page underneath; see `toast`. */}
      {mounted && <ToastHost blurTarget={contents} />}
    </View>,
  );
}
