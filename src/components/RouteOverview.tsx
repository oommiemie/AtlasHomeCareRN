import { View } from "react-native";
import { Pencil, X } from "lucide-react-native";

import { SheetButton } from "./SheetButton";
import { TourList } from "./TourList";
import type { Task } from "../models/task";
import type { VisitRoute } from "../utils/routing";
import { tr } from "../i18n";
import { SPACE, TEXT_SECONDARY } from "../theme/tokens";

/**
 * A planned round on the map page: the same widget the assistant sends
 * with a planned round — the round's name and its distance and drive time,
 * where it starts, then each stop numbered down the dashed road with the
 * leg to it — so a round reads the same wherever it is shown. A stop opens
 * that visit.
 *
 * Under it, the ways on: back into the planner to change the order, or
 * the round put away and the day's list back.
 */
export function RouteOverview({
  stops,
  route,
  onOpenStop,
  onEdit,
  onCancel,
}: {
  stops: Task[];
  route: VisitRoute | null;
  onOpenStop: (t: Task) => void;
  onEdit: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={{ gap: SPACE.lg, paddingTop: SPACE.sm }}>
      <TourList stops={stops} route={route} onOpenStop={onOpenStop} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <SheetButton
          icon={<Pencil size={16} color={TEXT_SECONDARY} strokeWidth={2.4} />}
          label={tr("แก้ไขลำดับ", "Edit order")}
          onPress={onEdit}
        />
        <SheetButton
          icon={<X size={16} color={TEXT_SECONDARY} strokeWidth={2.6} />}
          label={tr("ยกเลิกเส้นทาง", "Clear route")}
          onPress={onCancel}
        />
      </View>
    </View>
  );
}
