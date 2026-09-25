import { createElement, type ComponentType } from "react";

import { IosSpinner } from "../components/IosSpinner";
import { IosSwitch } from "../components/IosSwitch";
import { PageSheet } from "../components/PageSheet";

/**
 * The controls whose SHAPE differs between the platforms, made one shape.
 *
 * Most of this app is drawn rather than assembled, so most of it already
 * looks the same on both. What is left is the handful of places where a
 * React Native component is a thin cover over a different native control on
 * each side — a switch, a spinner — and the one place where the same prop
 * means different things.
 *
 * Swapped on the module rather than imported by name, for the reason the
 * text patch sets out at length next door: a rule that has to be remembered
 * at each call site is a rule that will be wrong at the next one somebody
 * writes. `import { Switch } from "react-native"` compiles to a lookup on
 * the module's exports at the point of use, so replacing the property
 * reaches every use in the app, including the ones not written yet.
 *
 * Everything here is Android-only and the whole function returns early on
 * iOS, where each of these already is what it is being replaced with.
 */
export function patchForAndroid(): void {
  const RN = require("react-native") as Record<string, unknown>;
  const Platform = RN.Platform as { OS: string };
  if (Platform.OS !== "android") return;
  if (RN.__atlasAndroidPatched === true) return;
  RN.__atlasAndroidPatched = true;

  swap(RN, "Switch", IosSwitch as ComponentType<never>);
  swap(RN, "ActivityIndicator", IosSpinner as ComponentType<never>);

  /*
    `behavior="padding"` on Android, which is a double count.

    The activity is `adjustResize`, so Android has already shortened the
    window by the height of the keyboard by the time React hears about it —
    the layout the app is given is the layout that fits. A
    KeyboardAvoidingView set to "padding" then adds that same height again
    as padding inside the already-shortened view, and the form ends up
    pushed off the top of itself by a keyboard's worth of nothing. iOS does
    not resize the window, which is why the prop exists and why every one of
    the dozen call sites in this app is right to pass it.

    So the prop is honoured where it means something and dropped where it
    does not, rather than the call sites each learning which platform they
    are on.
  */
  /*
    `presentationStyle="pageSheet"`, which Android's Modal does not have.

    It is not a style there, it is a whole presentation that does not
    exist: the prop is ignored and the modal opens full screen. Twenty
    sheets in this app are page sheets, and a sheet that fills the screen
    is a push — the thing each of those twenty chose not to be.

    So on Android the modal is made transparent and its children are put
    inside a drawn one. Everything else the caller passed — `visible`,
    `animationType`, `onRequestClose`, the hardware back it is wired to —
    goes through untouched.
  */
  const Modal = RN.Modal as ComponentType<never>;
  const Sheet = (props: Record<string, unknown>) => {
    if (props.presentationStyle !== "pageSheet") {
      return createElement(Modal as ComponentType<Record<string, unknown>>, props);
    }
    const { children, ...rest } = props;
    return createElement(
      Modal as ComponentType<Record<string, unknown>>,
      { ...rest, presentationStyle: undefined, transparent: true },
      createElement(PageSheet, null, children as never),
    );
  };
  Sheet.displayName = "Modal";
  swap(RN, "Modal", Sheet as ComponentType<never>);

  const KAV = RN.KeyboardAvoidingView as ComponentType<never>;
  const Resized = (props: Record<string, unknown>) =>
    createElement(KAV as ComponentType<Record<string, unknown>>, {
      ...props,
      behavior: undefined,
    });
  Resized.displayName = "KeyboardAvoidingView";
  swap(RN, "KeyboardAvoidingView", Resized as ComponentType<never>);
}

function swap(
  RN: Record<string, unknown>,
  name: string,
  replacement: ComponentType<never>,
): void {
  Object.defineProperty(RN, name, {
    get: () => replacement,
    configurable: true,
  });
}
