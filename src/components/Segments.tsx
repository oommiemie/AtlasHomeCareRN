import { SegmentedControlNative } from "../../modules/segmented-control";
import { PaintedSegments } from "./PaintedSegments";

/**
 * A segmented control: UIKit's own where the build has it, the drawn one
 * everywhere else (every Android build).
 */
export function Segments({
  labels,
  index,
  onChange,
}: {
  labels: string[];
  index: number;
  onChange: (i: number) => void;
}) {
  return SegmentedControlNative != null ? (
    <SegmentedControlNative
      style={{ height: 32 }}
      segments={labels}
      selectedIndex={index}
      onSegmentChange={(e) => onChange(e.nativeEvent.index)}
    />
  ) : (
    <PaintedSegments labels={labels} index={index} onChange={onChange} />
  );
}
