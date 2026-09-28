import { useMemo, useRef, useState } from "react";
import {
  Modal,
  PanResponder,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { PenLine, RotateCw, Trash2, X } from "lucide-react-native";

import { ActionBar, PrimaryAction } from "./ActionBar";
import { BlurStage } from "./BlurStage";
import { ToolbarPill } from "./ToolbarPill";
import { toast } from "./Toast";
import { GlassIconButton } from "./GlassIconButton";
import {
  PRIMARY_100,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  SURFACE,
  TEXT_MUTED,
  TINT_BG,
  TEXT_PRIMARY,
} from "../theme/tokens";

/**
 * The box the ink actually occupies, with a little air — so the preview
 * shows the signature filling its frame, wherever on the big signing canvas
 * it happened to be drawn. Falls back to the given box for an empty set.
 */
function inkBox(strokes: string[], fallback: string): string {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const d of strokes) {
    const nums = d.match(/-?\d+(?:\.\d+)?/g);
    if (nums == null) continue;
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = parseFloat(nums[i]);
      const y = parseFloat(nums[i + 1]);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (!isFinite(minX)) return fallback;
  const pad = Math.max(12, (maxX - minX) * 0.08, (maxY - minY) * 0.08);
  const x = minX - pad;
  const y = minY - pad;
  const w = maxX - minX + pad * 2;
  const h = maxY - minY + pad * 2;
  return `${x} ${y} ${w} ${h}`;
}

/** Turn every stroke a quarter clockwise about the field's centre. */
function rotateStrokes(strokes: string[], w: number, h: number): string[] {
  const cx = w / 2;
  const cy = h / 2;
  return strokes.map((d) =>
    d.replace(/([ML])(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_m, cmd, xs, ys) => {
      const x = parseFloat(xs);
      const y = parseFloat(ys);
      // 90° clockwise on screen (y points down): (x,y) → (cx-(y-cy), cy+(x-cx)).
      const nx = cx - (y - cy);
      const ny = cy + (x - cx);
      return `${cmd}${nx.toFixed(1)},${ny.toFixed(1)}`;
    }),
  );
}

/** The stored value: the canvas it was signed on, then the strokes. */
function readSignature(value: string[]): { box: string; strokes: string[] } {
  if (value.length > 0 && /^\d+(\.\d+)?x\d+(\.\d+)?$/.test(value[0])) {
    const [w, h] = value[0].split("x");
    return { box: `0 0 ${w} ${h}`, strokes: value.slice(1) };
  }
  // An old value with no size: assume the box the sheet uses now is close.
  return { box: "0 0 400 700", strokes: value };
}

/**
 * The patient's signature: a preview on the form, signed full-screen.
 *
 * A signature box the size of a form field is the reason people sign these
 * four times — there is no room to move a finger in. So the form carries
 * only a *preview*: the finished signature drawn small where there is one,
 * a prompt where there is not, and a tap opens a sheet the size of the
 * phone to sign in. The sheet is landscape-minded — the widest run the
 * screen has — because a name is written along a line, not down a column.
 *
 * Strokes are SVG path data, as `SignaturePad`'s were: a few hundred bytes,
 * crisp at any size, and rendered straight back into the preview.
 */
export function SignatureField({
  value,
  onChange,
}: {
  /** The strokes, as SVG path data. */
  value: string[];
  onChange: (strokes: string[]) => void;
}) {
  const [signing, setSigning] = useState(false);
  const { box, strokes: shown } = readSignature(value);
  const has = shown.length > 0;
  const frame = inkBox(shown, box);

  return (
    <>
      <Pressable
        onPress={() => setSigning(true)}
        accessibilityRole="button"
        accessibilityLabel={has ? "แก้ไขลายเซ็น" : "เซ็นชื่อ"}
        style={({ pressed }) => ({
          height: 168,
          borderRadius: RADIUS.card,
          backgroundColor: SURFACE,
          borderWidth: 1,
          borderColor: has ? "rgba(7,125,215,0.18)" : SEPARATOR,
          overflow: "hidden",
          opacity: pressed ? 0.9 : 1,
        })}
      >
        {has ? (
          <View style={{ flex: 1 }}>
            {/* The signature, filling the card above its line. */}
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: SPACE.md }}>
              <Svg width="78%" height="76%" viewBox={frame} preserveAspectRatio="xMidYMid meet">
                {shown.map((d, i) => (
                  <Path
                    key={i}
                    d={d}
                    stroke={TEXT_PRIMARY}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                ))}
              </Svg>
            </View>

            {/* The signed line and, under it, who this is and a way to redo. */}
            <View
              style={{
                marginHorizontal: SPACE.lg,
                borderTopWidth: 1,
                borderTopColor: SEPARATOR,
                paddingTop: SPACE.sm,
                paddingBottom: SPACE.md,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Text style={{ flex: 1, fontSize: 12, color: TEXT_MUTED }}>
                ลงชื่อผู้ป่วยแล้ว
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <PenLine size={13} color={PRIMARY_500} strokeWidth={2.4} />
                <Text style={{ fontSize: 13, fontWeight: "600", color: PRIMARY_500 }}>
                  เซ็นใหม่
                </Text>
              </View>
            </View>
          </View>
        ) : (
          // Empty: a dashed field asking for a signature.
          <View
            style={{
              flex: 1,
              margin: SPACE.md,
              borderRadius: RADIUS.lg,
              borderWidth: 1.5,
              borderColor: "rgba(7,125,215,0.28)",
              borderStyle: "dashed",
              backgroundColor: TINT_BG,
              alignItems: "center",
              justifyContent: "center",
              gap: SPACE.sm,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: PRIMARY_100,
              }}
            >
              <PenLine size={22} color={PRIMARY_500} strokeWidth={2.2} />
            </View>
            <Text style={{ fontSize: 15, fontWeight: "600", color: TEXT_PRIMARY }}>
              แตะเพื่อเซ็นชื่อ
            </Text>
            <Text style={{ fontSize: 12, color: TEXT_MUTED }}>
              เซ็นได้เต็มหน้าจอ ง่ายและชัดเจน
            </Text>
          </View>
        )}
      </Pressable>

      <SignSheet
        visible={signing}
        initial={value}
        onCancel={() => setSigning(false)}
        onDone={(strokes) => {
          onChange(strokes);
          setSigning(false);
          if (strokes.length > 0) toast("บันทึกลายเซ็นแล้ว", "success");
          else toast("ล้างลายเซ็นแล้ว", "info");
        }}
      />
    </>
  );
}

/**
 * The full-screen sheet the signing happens in.
 *
 * The whole of the phone, in effect turned on its side: a wide field with a
 * line to sign above, the way a paper form gives its widest edge to a
 * signature. It keeps its own copy of the strokes until "เสร็จ", so backing
 * out with the cross leaves whatever was on the form untouched.
 */
function SignSheet({
  visible,
  initial,
  onCancel,
  onDone,
}: {
  visible: boolean;
  initial: string[];
  onCancel: () => void;
  onDone: (strokes: string[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const [strokes, setStrokes] = useState<string[]>(() => readSignature(initial).strokes);
  const [canvas, setCanvas] = useState({ w: 0, h: 0 });
  /** True between grant and release, so move appends to the open stroke. */
  const drawing = useRef(false);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const { locationX: x, locationY: y } = e.nativeEvent;
          drawing.current = true;
          setStrokes((sk) => [...sk, `M${x.toFixed(1)},${y.toFixed(1)}`]);
        },
        onPanResponderMove: (e) => {
          if (!drawing.current) return;
          const { locationX: x, locationY: y } = e.nativeEvent;
          setStrokes((sk) => {
            const next = sk.slice();
            next[next.length - 1] += ` L${x.toFixed(1)},${y.toFixed(1)}`;
            return next;
          });
        },
        onPanResponderRelease: () => {
          drawing.current = false;
          setStrokes((sk) =>
            sk.length > 0 && !sk[sk.length - 1].includes("L") ? sk.slice(0, -1) : sk,
          );
        },
        onPanResponderTerminate: () => {
          drawing.current = false;
        },
      }),
    [],
  );

  const empty = strokes.length === 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onShow={() => setStrokes(readSignature(initial).strokes)}
      onRequestClose={onCancel}
    >
      <BlurStage>
        <View style={{ flex: 1, backgroundColor: SURFACE, paddingTop: insets.top }}>
            {/* The toolbar: close, and the tools grouped on the right. */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: SPACE.lg,
                paddingTop: SPACE.sm,
                paddingBottom: SPACE.sm,
                gap: SPACE.sm,
              }}
            >
              <GlassIconButton onPress={onCancel} accessibilityLabel="ยกเลิก">
                <X size={22} color={TEXT_PRIMARY} strokeWidth={2.6} />
              </GlassIconButton>
              <Text
                style={{
                  flex: 1,
                  fontSize: 16,
                  fontWeight: "600",
                  color: TEXT_PRIMARY,
                  marginLeft: SPACE.xs,
                }}
              >
                ลายเซ็นผู้ป่วย
              </Text>

              {/* The tools, on the app's own glass toolbar pill. */}
              <ToolbarPill
                slots={[
                  {
                    icon: <RotateCw size={20} color={PRIMARY_500} strokeWidth={2.2} />,
                    label: "หมุนลายเซ็น",
                    onPress: empty
                      ? undefined
                      : () => setStrokes((sk) => rotateStrokes(sk, canvas.w, canvas.h)),
                  },
                  {
                    icon: <Trash2 size={20} color={empty ? TEXT_MUTED : PRIMARY_500} strokeWidth={2.2} />,
                    label: "ล้างลายเซ็น",
                    onPress: empty ? undefined : () => setStrokes([]),
                  },
                ]}
              />
            </View>

            {/* The field. */}
            <View
              style={{ flex: 1 }}
              onLayout={(e) =>
                setCanvas({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
              }
              {...responder.panHandlers}
            >
              {empty && (
                <View
                  pointerEvents="none"
                  style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ fontSize: 16, color: TEXT_MUTED }}>เซ็นชื่อในพื้นที่นี้</Text>
                </View>
              )}
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: SPACE.xxl,
                  right: SPACE.xxl,
                  bottom: 120,
                  height: 1,
                  backgroundColor: SEPARATOR,
                }}
              />
              <Svg style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}>
                {strokes.map((d, i) => (
                  <Path
                    key={i}
                    d={d}
                    stroke={TEXT_PRIMARY}
                    strokeWidth={2.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                ))}
              </Svg>
            </View>

        </View>

        {/* The app's floating tray, as every other sheet carries it. */}
        <ActionBar>
          <PrimaryAction
            label={empty ? "ยังไม่มีลายเซ็น" : "เสร็จ"}
            disabled={empty}
            onPress={() =>
              onDone(empty ? [] : [`${canvas.w.toFixed(0)}x${canvas.h.toFixed(0)}`, ...strokes])
            }
          />
        </ActionBar>
      </BlurStage>
    </Modal>
  );
}
