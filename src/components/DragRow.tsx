import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { GripVertical } from "lucide-react-native";

import { tr } from "../i18n";
import {
  PRIMARY_500,
  SEPARATOR,
  SPACE,
  SURFACE,
  TEXT_MUTED,
  shadow,
} from "../theme/tokens";

/*
  A list that is put in order by dragging: each row lifts by the grip at
  its end, follows the finger, and the list shows a line where it will
  land. Drawn first for the home page's shortcuts, and shared with the
  visit-route planner so the two reorder the same way.
*/

/** Where the row will land, drawn between the two it will sit between. */
export function DropLine() {
  return (
    <View
      style={{
        height: 2,
        borderRadius: 1,
        marginVertical: -1,
        backgroundColor: PRIMARY_500,
      }}
    />
  );
}

/**
 * One row of the chosen list, draggable by the grip at its end.
 *
 * The row follows the finger on the UI thread and nothing else moves: the
 * list is told where the row would land so it can draw a line there, and
 * is reordered once, when the finger lifts. Only the grip starts a drag —
 * a whole row that moves on any touch cannot also be tapped.
 */
export function DragRow({
  index,
  count,
  rule,
  height = 64,
  onDragStart,
  onDragTo,
  onDrop,
  children,
}: {
  index: number;
  count: number;
  /** Whether to draw the hairline above this row. */
  rule: boolean;
  /** The row's height — and the step a drag moves it by. */
  height?: number;
  onDragStart: () => void;
  onDragTo: (to: number) => void;
  onDrop: (to: number) => void;
  children: React.ReactNode;
}) {
  const y = useSharedValue(0);
  const lifted = useSharedValue(0);
  /** The landing slot, kept on the UI thread so only changes cross over. */
  const to = useSharedValue(index);

  const pan = Gesture.Pan()
    .activateAfterLongPress(0)
    .onStart(() => {
      lifted.value = withTiming(1, { duration: 120 });
      to.value = index;
      runOnJS(onDragStart)();
    })
    .onUpdate((e) => {
      y.value = e.translationY;
      const steps = Math.round(e.translationY / height);
      const next = Math.min(count - 1, Math.max(0, index + steps));
      if (next !== to.value) {
        to.value = next;
        runOnJS(onDragTo)(next);
      }
    })
    .onFinalize(() => {
      lifted.value = withTiming(0, { duration: 120 });
      y.value = 0;
      runOnJS(onDrop)(to.value);
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { scale: 1 + lifted.value * 0.02 }],
    // The whole shadow, not just its strength. It used to be split — the
    // opacity animated here, the colour, blur and offset sitting in the
    // static style below — which `boxShadow` cannot do: it is one value, so
    // the half that moves has to carry the half that does not.
    boxShadow: shadow({
      blur: 16,
      y: 8,
      color: "#0F172A",
      opacity: lifted.value * 0.16,
    }),
    zIndex: lifted.value > 0 ? 2 : 0,
  }));

  return (
    <Reanimated.View
      style={[
        style,
        {
          // Square, not rounded: the row is a slice of a list, and a lifted
          // slice with rounded corners reads as a card that fell out of one.
          backgroundColor: SURFACE,
        },
      ]}
    >
      {rule && <View style={{ height: 1, backgroundColor: SEPARATOR }} />}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.md,
          height,
        }}
      >
        {children}
        <GestureDetector gesture={pan}>
          <View
            accessibilityLabel={tr("ลากเพื่อจัดลำดับ", "Drag to reorder")}
            hitSlop={12}
            style={{
              width: 32,
              height,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GripVertical size={20} color={TEXT_MUTED} strokeWidth={2} />
          </View>
        </GestureDetector>
      </View>
    </Reanimated.View>
  );
}
