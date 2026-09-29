import { Pressable, Text, View } from "react-native";
import {
  Accessibility,
  Apple,
  Check,
  ClipboardList,
  Droplets,
  HandHeart,
  HeartHandshake,
  HeartPulse,
  Home,
  LifeBuoy,
  ListChecks,
  Waves,
  Wind,
} from "lucide-react-native";

import { Card } from "./Card";
import { ASSESSMENTS } from "../models/community";
import {
  PRIMARY_500,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";

/**
 * The pieces every one-question-to-a-page assessment is built from.
 *
 * They grew up in the 35+ screening and are shared here so the asthma and
 * breathlessness forms are the same form to the thumb: a bar under the
 * header that fills as the pages turn, and a page that is one picture, one
 * line of guidance, one question, and a column of answers.
 */

/** A lucide glyph, as a component. */
export type Icon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/**
 * Each form's picture — lucide glyphs on the brand disc for now, in the slot
 * the drawn pictures will take when they arrive. One map, for the list the
 * forms are chosen from and the history they are read back in, so a form
 * wears the same mark in both.
 */
export const ASSESSMENT_ICON: Record<string, Icon> = {
  risk35: HeartPulse,
  asthma: Wind,
  dyspnea: Waves,
  barthel: Accessibility,
  adl: ListChecks,
  ncd: Droplets,
  palliative: HandHeart,
  inhomesss: Home,
  crisis: LifeBuoy,
  esas: ClipboardList,
  homecare: HeartHandshake,
  mna: Apple,
};

/** A form's mark, by its key or by the name it is listed under. */
export function assessmentIcon(keyOrName: string): Icon {
  const key =
    ASSESSMENT_ICON[keyOrName] != null
      ? keyOrName
      : ASSESSMENTS.find((a) => a.label === keyOrName)?.key;
  return (key != null ? ASSESSMENT_ICON[key] : undefined) ?? ClipboardList;
}

/** The page's picture: the glyph on a pale brand disc. */
/**
 * An assessment's mark: its glyph in the app's blue, on nothing — the pale
 * disc it used to stand on was taken away at the carer's asking, and the
 * glyph grown to fill more of the space the disc had.
 */
export function Glyph({ icon: Ic, size = 56 }: { icon: Icon; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ic size={Math.round(size * 0.66)} color={PRIMARY_500} strokeWidth={1.8} />
    </View>
  );
}

/** One bar under the header, filled as far as the form has got. */
export function Progress({ value, caption }: { value: number; caption: string }) {
  return (
    <View style={{ marginTop: SPACE.md, gap: 6 }}>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(7,125,215,0.15)" }}>
        <View
          style={{
            width: `${Math.round(Math.max(0.02, Math.min(1, value)) * 100)}%` as `${number}%`,
            height: 4,
            borderRadius: 2,
            backgroundColor: PRIMARY_500,
          }}
        />
      </View>
      {caption !== "" && (
        <Text style={{ fontSize: 12, lineHeight: 16, color: TEXT_MUTED, textAlign: "right" }}>
          {caption}
        </Text>
      )}
    </View>
  );
}

/**
 * One question, one page: the section's guidance in grey, the question in
 * the page's biggest type, and the answers as a column of rows — a radio
 * disc leading each, since only one can be true.
 */
export function Question({
  icon,
  lead,
  text,
  options,
  value,
  onChange,
}: {
  icon: Icon;
  lead: string;
  text: string;
  options: readonly string[];
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <Card style={{ gap: SPACE.lg }}>
      <Glyph icon={icon} />
      <Text style={{ fontSize: 13, lineHeight: 19, color: TEXT_MUTED, marginTop: -SPACE.sm }}>{lead}</Text>
      <Text style={{ fontSize: 20, lineHeight: 28, fontWeight: "700", color: TEXT_PRIMARY }}>
        {text}
      </Text>
      <View>
        {options.map((o, i) => {
          const on = value === o;
          return (
            <View key={o}>
              {i > 0 && <View style={{ height: 1, backgroundColor: SEPARATOR }} />}
              <Pressable
                onPress={() => onChange(o)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACE.md,
                  minHeight: 56,
                  paddingVertical: SPACE.sm,
                }}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: on ? PRIMARY_500 : "transparent",
                    borderWidth: on ? 0 : 1.5,
                    borderColor: SEPARATOR,
                  }}
                >
                  {on && <Check size={15} color="#FFFFFF" strokeWidth={3} />}
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 16,
                    lineHeight: 22,
                    fontWeight: on ? "600" : "400",
                    color: TEXT_PRIMARY,
                  }}
                >
                  {o}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </Card>
  );
}
