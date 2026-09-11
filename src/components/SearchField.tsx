import { TextInput, View } from "react-native";
import { Mic, Search } from "lucide-react-native";

import { Glass } from "./Glass";
import { glassTint, RADIUS, SPACE, TEXT_PRIMARY } from "../theme/tokens";

/** The height every screen reserves for the field. */
export const SEARCH_FIELD_HEIGHT = 46;

/**
 * The app's search field, on Apple's own Liquid Glass.
 *
 * The tint stays translucent on purpose: an opaque fill hides the material
 * and the field reads as a plain grey box. Under the fallback the tint has to
 * be near-solid instead, or there is nothing behind the text at all.
 */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  autoFocus,
  fill,
  tintColor,
  colorScheme,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  /** A milkier tint than the default, for a field with a busy ground. */
  tintColor?: string;
  /**
   * Pins the material's appearance instead of letting it follow the device
   * theme. "light" is the frosted white.
   */
  colorScheme?: "auto" | "light" | "dark";
  /**
   * A plain fill instead of the glass, for surfaces the material cannot work
   * against. On an opaque sheet a glass field has nothing behind it to
   * refract and its white tint lands on near-white ground — the field
   * vanishes. The map sheet passes the design's `#787880` at 16%.
   */
  fill?: string;
}) {
  const Surface = fill == null ? Glass : View;
  const surfaceProps =
    fill == null
      ? {
          interactive: true,
          colorScheme,
          tintColor:
            tintColor ??
            glassTint("rgba(255,255,255,0.45)", "rgba(255,255,255,0.92)"),
        }
      : {};
  return (
    <Surface
      {...(surfaceProps as object)}
      style={{
        ...(fill != null ? { backgroundColor: fill } : null),
        height: SEARCH_FIELD_HEIGHT,
        borderRadius: RADIUS.capsule,
        overflow: "hidden",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: SPACE.md,
        gap: SPACE.sm,
      }}
    >
      <Search size={18} color="#4F4F50" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#4F4F50"
        autoFocus={autoFocus}
        returnKeyType="search"
        clearButtonMode="while-editing"
        style={{
          flex: 1,
          fontSize: 16,
          letterSpacing: -0.08,
          color: TEXT_PRIMARY,
        }}
      />
      {/* Decorative: dictation is the keyboard's own, not ours to trigger. */}
      <View pointerEvents="none">
        <Mic size={17} color="#4F4F50" />
      </View>
    </Surface>
  );
}
