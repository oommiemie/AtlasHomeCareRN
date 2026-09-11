import { Platform, Text, TextInput } from "react-native";

/**
 * Makes every `<Text>` render in Sarabun at the weight it asked for.
 *
 * React Native can't pick a weight variant off a base family the way the web
 * can: `fontWeight: "600"` against a single registered family is ignored, and
 * Thai glyphs fall back to a system face that sets the line differently. So
 * each weight is registered as its own family and `Text.render` is patched to
 * map the requested weight onto the right one.
 *
 * The alternative — every component naming a family — means one missed call
 * site renders in the wrong face, which is how the Flutter build's Thai text
 * drifted. Patching once at the root cannot be forgotten.
 */
const familyFor = (weight?: string | number): string => {
  const w = String(weight ?? "400");
  if (w === "800" || w === "900") return "Sarabun_800ExtraBold";
  if (w === "700" || w === "bold") return "Sarabun_700Bold";
  if (w === "600") return "Sarabun_600SemiBold";
  if (w === "500") return "Sarabun_500Medium";
  return "Sarabun_400Regular";
};

type Patchable = typeof Text & {
  render?: (...args: unknown[]) => { props: { style?: unknown } };
  __thaiPatched?: boolean;
};

export function applyThaiFont(): void {
  const T = Text as Patchable;
  if (T.__thaiPatched || !T.render) return;
  T.__thaiPatched = true;

  const original = T.render;
  T.render = function patched(...args: unknown[]) {
    const element = original.apply(this, args);
    const raw = element.props.style;
    const flat: Record<string, unknown> = Array.isArray(raw)
      ? Object.assign({}, ...raw.filter(Boolean))
      : { ...((raw as object) ?? {}) };

    // A caller that names a family explicitly keeps it.
    const family = (flat.fontFamily as string) ?? familyFor(flat.fontWeight as string);
    return {
      ...element,
      props: {
        ...element.props,
        style: [{ fontFamily: family }, raw],
      },
    };
  };

  // Placeholders and typed values need the Thai face too.
  const TI = TextInput as unknown as { defaultProps?: Record<string, unknown> };
  TI.defaultProps = {
    ...(TI.defaultProps ?? {}),
    style: [
      { fontFamily: "Sarabun_400Regular" },
      (TI.defaultProps?.style as object) ?? null,
    ],
  };

  if (Platform.OS === "web") {
    // Nothing further: the web build resolves weights off one family fine.
  }
}
