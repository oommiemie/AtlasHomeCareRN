import { createElement, type ComponentType } from "react";
import { StyleSheet, type TextStyle } from "react-native";

import { currentDisplay, scaleOf } from "../models/display";

/**
 * Makes every `<Text>` render in Sarabun, at the weight it asked for and at
 * the size the carer has chosen.
 *
 * Two jobs, one hook, because both need to reach every piece of text in the
 * app and neither can be left to call sites:
 *
 * - React Native can't pick a weight variant off a base family the way the
 *   web can: `fontWeight: "600"` against a single registered family is
 *   ignored, and Thai glyphs fall back to a system face that sets the line
 *   differently. So each weight is registered as its own family and the
 *   requested weight is mapped onto the right one.
 * - Every size in this app is written at the place it is used, so the only
 *   thing that can move all of them at once is something that sees each one
 *   go past. The display page's text size is a multiplier applied here.
 *
 * The alternative — every component naming a family and a scale — means one
 * missed call site renders wrong, which is how the Flutter build's Thai text
 * drifted. Patching once at the root cannot be forgotten.
 *
 * HOW it patches matters, and this is the second attempt. The first replaced
 * `Text.render`, which worked while `Text` was a `forwardRef` object. React
 * 19 made it a plain function component: there is no `.render` to replace,
 * the patch's own guard turned it into a no-op, and both the font and the
 * text size silently did nothing. So the component itself is swapped on the
 * `react-native` module — the property is an ordinary getter, and Metro
 * compiles `import { Text }` to a lookup on that module at each use, so
 * every call site picks up the replacement.
 */
const familyFor = (weight?: string | number): string => {
  const w = String(weight ?? "400");
  if (w === "800" || w === "900") return "Sarabun_800ExtraBold";
  if (w === "700" || w === "bold") return "Sarabun_700Bold";
  if (w === "600") return "Sarabun_600SemiBold";
  if (w === "500") return "Sarabun_500Medium";
  return "Sarabun_400Regular";
};

type Styled = { style?: unknown; children?: unknown };

/**
 * Anything Thai. Not just the marks — this is measured, and the plain
 * consonants turned out to overrun too.
 */
const THAI = /[\u0E00-\u0E7F]/;

/** What a Text is actually going to render, as far as it can be read here. */
function textIn(children: unknown): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textIn).join("");
  return "";
}

/**
 * The shortest line Thai can be set on in Sarabun without losing ink.
 *
 * Measured off the font rather than guessed. Sarabun declares an ascent of
 * 1.068 em and a descent of 0.232, so iOS lays its lines out at 1.300 em —
 * but the 64 Thai characters this app actually uses run from -0.332 em (ู)
 * to +1.029 (็), which is 1.361 em of ink in a 1.300 em box. iOS treats
 * `lineHeight` as both the floor and the ceiling of the line, so the excess
 * is not overlapped onto the next line, it is CLIPPED — and the tails of ุ
 * and ู, and of ญ and ฐ, simply go missing.
 *
 * React Native centres the glyph box inside the line height, so each extra
 * point is split between the two ends: the descent needs 0.100 em more,
 * which takes 0.200 em of line height. 1.3 + 0.2 = 1.5, and 1.55 leaves a
 * hair of margin at every whole-point size.
 *
 * It is applied whether or not the caller set a line height, because the
 * font's own is already too short — the designs that set none were clipping
 * just as much as the ones that set 1.30. Text with no Thai in it is left
 * exactly as it was, so a row of figures set at 44/50 keeps its proportions.
 */
const THAI_LINE = 1.55;

/** The family and size to lay over what the caller asked for. */
function overrides(
  raw: unknown,
  children: unknown,
): { family: string; sized: TextStyle } {
  const flat = (StyleSheet.flatten(raw as never) ?? {}) as TextStyle;
  // A caller that names a family explicitly keeps it.
  const family = flat.fontFamily ?? familyFor(flat.fontWeight);

  const scale = scaleOf(currentDisplay().textSize);
  const sized: TextStyle = {};
  if (scale !== 1) {
    // Multiplied, not replaced, so the proportions the screens were drawn
    // at survive. Text with no size of its own is left alone: nested text
    // inherits its parent's size, and writing an explicit one here would
    // break that inheritance.
    if (typeof flat.fontSize === "number") sized.fontSize = Math.round(flat.fontSize * scale);
    if (typeof flat.lineHeight === "number") {
      sized.lineHeight = Math.round(flat.lineHeight * scale);
    }
  }

  // Room for the marks, on the line as it will actually be set — after the
  // carer's text size has been applied, not before.
  const size = sized.fontSize ?? flat.fontSize;
  const line = sized.lineHeight ?? flat.lineHeight;
  const floor = typeof size === "number" ? Math.ceil(size * THAI_LINE) : 0;
  if (
    typeof size === "number" &&
    (line == null || line < floor) &&
    THAI.test(textIn(children))
  ) {
    sized.lineHeight = floor;
  }

  return { family, sized };
}

/** Wraps one of React Native's text components with the two overrides. */
function wrap(Original: ComponentType<never>, name: string): ComponentType<never> {
  const Patched = (props: Styled) => {
    const { family, sized } = overrides(props.style, props.children);
    return createElement(Original as ComponentType<Styled>, {
      ...props,
      // The caller's own style sits in the middle: it beats the family
      // underneath it and is beaten by the size on top, which is the one
      // thing here that is not the caller's to decide.
      style: [{ fontFamily: family }, props.style, sized],
    });
  };
  Patched.displayName = name;
  return Patched as ComponentType<never>;
}

/**
 * Swap both text components on the module.
 *
 * Called at import time rather than from an effect: an effect runs after the
 * first paint, so the screen that triggered it would render once unpatched
 * and never be told to render again.
 */
export function patchText(): void {
  /*
    The module itself, fetched with a bare require.

    Not `import * as ReactNative`: Babel hands that a COPY of the exports
    of a CommonJS module, so defining a property on it changes nothing for
    anybody else. Every other file in the app writes `import { Text } from
    "react-native"`, which compiles to a lookup on the real exports object
    at each use — which is this one, and which is therefore the only object
    worth swapping anything on.
  */
  const RN = require("react-native") as Record<string, unknown>;
  if (RN.__atlasTextPatched === true) return;
  RN.__atlasTextPatched = true;

  const Text = wrap(RN.Text as ComponentType<never>, "Text");
  const TextInput = wrap(RN.TextInput as ComponentType<never>, "TextInput");

  Object.defineProperty(RN, "Text", { get: () => Text, configurable: true });
  Object.defineProperty(RN, "TextInput", { get: () => TextInput, configurable: true });
}
