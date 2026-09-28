import type { ActivityKind } from "../models/vaccination";
import type { PanelTone } from "./tokens";

/**
 * Which colour each group service wears, wherever it appears.
 *
 * The ring on the home page, the panel over the service's own plan and the
 * heading in the help centre are one service drawn three times, and a
 * carer finds their way between them by colour. They used to keep a copy
 * of this each, which is how a change to one service's colour lands on one
 * page and not the next.
 *
 * Sky for the immunisation rounds; mint for the weighing and the health
 * checks, after the greens in their own drawing; peach for the nursery
 * screening, the warmest of the four and the only one entirely about the
 * under-fives; violet for dental, which vaccination wore until it took the
 * blue, so no two services share a colour.
 */
export const SERVICE_TONE: Record<ActivityKind, PanelTone> = {
  vaccination: "sky",
  schoolHealth: "mint",
  screening: "peach",
  dental: "violet",
};
