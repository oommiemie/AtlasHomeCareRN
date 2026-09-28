import type { ComponentType } from "react";
import { Text, View } from "react-native";

import { Glass } from "./Glass";
import { RADIUS, SPACE, TEXT_SECONDARY } from "../theme/tokens";

/** What a mark with no colour of its own is tinted. */
export const TAG_OFF = "rgba(120,120,128,0.18)";

type Props = {
  label: string;
  /** The word and the glyph. The wash is worked out from it. */
  ink?: string;
  /**
   * What the glass is tinted, where the ink cannot say it.
   *
   * The wash is normally the ink at about a sixth, which keeps a tag and its
   * text one colour and turns with the theme by itself. Pass this only for a
   * tint that is not a wash of the ink.
   */
  tint?: string;
  /**
   * The glyph.
   *
   * Not decoration. Most of these tags are Thai words of similar length in
   * one of three colours, and colour is the one channel a reader can be
   * missing — about one man in twelve cannot separate the red from the
   * amber, which is often the difference between "stop" and "look". Leave it
   * off only where the tag is the sole mark on its row and cannot be
   * confused with another.
   */
  Icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
};

/**
 * The tag's ground, from its ink: the ink at about a sixth — or, for a grey
 * ink, at half that.
 *
 * A sixth of a colour is a pastel; a sixth of a near-black grey is a grey,
 * and a dark one. The roster's "พร้อม" — the plain, nothing-to-see state,
 * which most of a class is in — came out as the heaviest mark on the row,
 * darker than the red of a warning beside it. A neutral ink gets the
 * lighter wash, which lands near the page's own grouped grey.
 */
function washOf(ink: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(ink)) return TAG_OFF;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(ink.slice(i, i + 2), 16));
  const neutral = Math.max(r, g, b) - Math.min(r, g, b) < 16;
  return `${ink}${neutral ? "14" : "29"}`;
}

/**
 * Where something stands, as a mark rather than a sentence.
 *
 * One component for every status mark in the app. They had drifted into
 * about a dozen hand-drawn capsules — 10pt and 11pt and 12pt, weights from
 * 500 to 700, some with a glyph and most without, half on flat fills and
 * half on Apple's material — so the same idea looked like a different thing
 * on each screen, and a carer moving between them had to re-learn what a
 * small coloured capsule meant.
 *
 * Tinted glass rather than a painted fill: the tint is mixed into the
 * material, so the tag carries whatever is behind it instead of sitting on
 * top of it — which is how every mark on the vaccination roster reads, and
 * the look this was standardised on.
 *
 * Nothing here is pressable and nothing should be made pressable. A tag is a
 * statement; the moment one answers a touch, every other tag on the page
 * looks like a control that is broken.
 */
export function StatusTag({ label, ink = TEXT_SECONDARY, tint, Icon }: Props) {
  // A wash of the ink, which keeps the pair one colour and follows the theme
  // without a second token. Only a plain hex can be washed this way; a tag
  // given an rgba ink takes the neutral unless it names its own tint.
  const wash = tint ?? washOf(ink);

  return (
    <Glass
      tintColor={wash}
      style={{
        // Never squeezed by whatever shares its row: it is the shortest
        // thing on the line and the one a reader scans down the column, so
        // the text beside it gives way rather than the other way about.
        flexShrink: 0,
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.xs,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: RADIUS.capsule,
        overflow: "hidden",
      }}
    >
      {Icon != null && <Icon size={12} color={ink} strokeWidth={2.4} />}
      <Text style={{ fontSize: 11, fontWeight: "700", color: ink }}>
        {label}
      </Text>
    </Glass>
  );
}

/**
 * The same mark, laid out as a row of them.
 *
 * Only so a caller never has to remember the gap.
 */
export function StatusTags({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.xs }}>
      {children}
    </View>
  );
}
