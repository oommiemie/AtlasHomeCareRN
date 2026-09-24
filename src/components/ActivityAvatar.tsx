import { Baby, Scale, Stethoscope, Syringe } from "lucide-react-native";

import { Glass } from "./Glass";
import type { ActivityKind, Records } from "../models/vaccination";

/**
 * One glyph per kind of group work.
 *
 * Drawn, not photographed. The rendered artwork the Services page carries
 * is made to be looked at one tile at a time; down a column of fifteen
 * cards it is fifteen small pictures competing with the words beside them,
 * and it exists at one size only — past 48 points the needle and the tape
 * measure go soft. A glyph is the card's own ink at whatever size the row
 * needs.
 */
const GLYPH = {
  vaccination: Syringe,
  schoolHealth: Stethoscope,
  screening: Baby,
} as const;

/**
 * What kind of work a card is about, as the app's own avatar.
 *
 * Shared between the activities page and the history rather than drawn
 * twice: the two lists sit one tap apart and a round of vaccinations should
 * not change shape between them.
 *
 * Nearly opaque, like the visit card's own avatar. The material has a white
 * card behind it on both screens and nothing to refract, so a translucent
 * tint would come out as an empty circle.
 */
export function ActivityAvatar({
  kind,
  records,
  size = 32,
}: {
  kind: ActivityKind;
  /**
   * What the sitting writes down, where that is not the kind's usual.
   *
   * A weighing round belongs to the health-check service and is not a
   * stethoscope: it is a scale, and it is the one card in that column a
   * carer picks out by its glyph because it is the one that takes all
   * morning.
   */
  records?: Records;
  size?: number;
}) {
  const Glyph = records === "growth" ? Scale : GLYPH[kind];
  return (
    <Glass
      tintColor="rgba(7,125,215,0.95)"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Glyph size={Math.round(size * 0.53)} color="#FFFFFF" strokeWidth={2.4} />
    </Glass>
  );
}
