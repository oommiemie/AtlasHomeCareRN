import { ChevronRight } from "lucide-react-native";

import { TEXT_MUTED } from "../theme/tokens";

/**
 * The one arrow the app uses to say "this opens something".
 *
 * A bare chevron, one size, one weight. It used to be seventeen arrows in
 * two glyphs, three sizes and six colours, drawn afresh on each screen, and
 * no two rows across the app pointed the same way. This is the only one
 * now: every card that opens a page, every row in a list and every "see
 * all" at the end of a line carries this and nothing else, so the eye
 * learns it once.
 *
 * Colour is the one thing that may vary, and it follows the text it sits
 * beside: grey on a row or a card, where the arrow is a hint and not the
 * subject; the link's own colour after "แก้ไข" or "รับงาน", where the arrow
 * is part of the link.
 */
export function Chevron({ ink = TEXT_MUTED }: { ink?: string }) {
  return <ChevronRight size={18} color={ink} strokeWidth={2.2} />;
}
