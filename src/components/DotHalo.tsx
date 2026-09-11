import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";

/**
 * Rings of dots spreading out from a centre.
 *
 * Ornament, and built to stay behind whatever it sits under: the dots shrink
 * and fade as they go out, which is what makes it read as something
 * dispersing rather than as a pattern printed on the page.
 *
 * The rings are worked out rather than listed. They used to be three, with
 * ten, sixteen and twenty-two dots in them whatever size the halo was drawn
 * at — which fixed the *count* and let the spacing fall where it may: at 340
 * points the dots sat forty-five apart and the thing read as three sparse
 * rings rather than as a field. Apple's own version of this — the arrows on
 * the Cash card — keeps the distance between neighbouring dots the same
 * everywhere and lets the count climb with the circumference, which is what
 * makes it look like one surface instead of a set of orbits.
 *
 * So: `spacing` is the gap along the arc and the count follows from it.
 */
export function DotHalo({
  size = 170,
  ink,
  rings = 3,
  spacing = 26,
  dot = 2.4,
  fade = [0.34, 0.1],
}: {
  size?: number;
  ink: string;
  /** How many rings between the centre and the edge. */
  rings?: number;
  /** The distance between two neighbouring dots, along their own ring. */
  spacing?: number;
  /**
   * The innermost ring's dot radius. The rings outside it taper to under half
   * of this, which is what reads as distance.
   */
  dot?: number;
  /**
   * How solid the innermost ring is, and the outermost — the taper between
   * them is what reads as distance.
   *
   * Given as a pair so a caller that is using the halo as a *mask* can ask
   * for something close to solid: a mask's alpha decides what shows through,
   * so a halo drawn at a tenth there does not fade the dots, it deletes them.
   */
  fade?: [number, number];
}) {
  const c = size / 2;
  /**
   * Where the outermost ring sits.
   *
   * Just inside the edge: a ring on the boundary has half of every dot
   * outside the drawing, and the SVG clips them into half-moons.
   */
  const outer = 0.94;

  const dots: { x: number; y: number; r: number; o: number }[] = [];
  for (let i = 1; i <= rings; i++) {
    // 0 at the middle ring's start, 1 at the outermost.
    const t = rings === 1 ? 1 : (i - 1) / (rings - 1);
    const radius = c * outer * (i / rings);
    const count = Math.max(4, Math.round((2 * Math.PI * radius) / spacing));
    // Smaller and fainter the further out, which is the whole of the effect.
    const r = dot - t * (dot - dot * 0.45);
    const o = fade[0] - t * (fade[0] - fade[1]);
    /*
      Each ring turned against the one inside it.

      By an irrational-ish fraction rather than a neat one: at a half or a
      third the dots on successive rings line up and the halo grows spokes,
      which is the one thing a field of dots must not have.
    */
    const turn = i * 0.382;
    for (let k = 0; k < count; k++) {
      const angle = ((k + turn) / count) * Math.PI * 2;
      dots.push({
        x: c + Math.cos(angle) * radius,
        y: c + Math.sin(angle) * radius,
        r,
        o,
      });
    }
  }

  return (
    <View pointerEvents="none">
      <Svg width={size} height={size}>
        {dots.map((d, i) => (
          <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill={ink} opacity={d.o} />
        ))}
      </Svg>
    </View>
  );
}
