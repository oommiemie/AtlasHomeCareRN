import { useState, type ComponentType } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GripVertical, Minus, Pencil, Plus, X } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { Card } from "./Card";
import { toast } from "./Toast";
import { Glass } from "./Glass";
import { GlassIconButton } from "./GlassIconButton";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  DEFAULT_SHORTCUTS,
  SHORTCUTS,
  setShortcuts,
  shortcutOf,
  toggleShortcut,
  useShortcuts,
  type ShortcutKey,
} from "../models/shortcuts";
import { feel } from "../utils/haptics";
import {
  CANVAS,
  DANGER,
  GROUPED_BG,
  PRIMARY_100,
  PRIMARY_500,
  PRIMARY_700,
  RADIUS,
  SEPARATOR,
  SPACE,
  SUCCESS,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  SURFACE,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** The tile is a disc, the way a shortcut reads on a home screen. */
const TILE = 60;

/**
 * The carer's own row of shortcuts, under the greeting.
 *
 * Five to begin with and theirs to change: the work a round starts with is
 * not the same for a clinic morning and a village walk, and a home page
 * that opens on somebody else's first move costs a tap every time.
 *
 * The last tile is always the way to change the row, so adding one is
 * where removing one is, and neither is hidden behind a long press.
 */
export function ShortcutRow() {
  const nav = useNavigation<Nav>();
  const keys = useShortcuts();
  const [editing, setEditing] = useState(false);

  const go = (key: ShortcutKey) => {
    const shortcut = shortcutOf(key);
    if (shortcut == null) return;
    feel("tick");
    // A shortcut to a page that is not built yet says so rather than doing
    // nothing: it is on the list because the row is arranged now and the
    // pages arrive later.
    if (shortcut.target == null) {
      toast(`${shortcut.label}ยังไม่เปิดใช้งาน`);
      return;
    }
    if ("tab" in shortcut.target) {
      nav.navigate("Main", { screen: shortcut.target.tab } as never);
      return;
    }
    /*
      The params go with the route.

      Sending none to a page that reads one on its first line — which
      แผนงานชุมชน does, to know which of the three rounds it is showing —
      destructures undefined and takes the app down. This used to send the
      route alone, so the vaccination tile crashed the moment anybody put
      it on their row.

      Cast because the row is a list: a shortcut's route and its params are
      chosen from the catalogue at run time, and the navigator's own types
      can only pair them where both are literals at the call site. The
      catalogue is where the pairing is checked by eye.
    */
    const go = nav.navigate as (route: string, params?: object) => void;
    go(shortcut.target.route, shortcut.target.params);
  };

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: SPACE.lg, gap: SPACE.md }}
      >
        {keys.map((key) => {
          const shortcut = shortcutOf(key);
          if (shortcut == null) return null;
          return (
            <Pressable
              key={key}
              onPress={() => go(key)}
              accessibilityRole="button"
              accessibilityLabel={shortcut.label}
              style={({ pressed }) => ({
                width: 72,
                alignItems: "center",
                gap: 6,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Glass
                interactive
                style={{
                  width: TILE,
                  height: TILE,
                  borderRadius: TILE / 2,
                  overflow: "hidden",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {shortcut.image != null ? (
                  <Image
                    source={shortcut.image}
                    style={{ width: 34, height: 34 }}
                    resizeMode="contain"
                  />
                ) : shortcut.Icon != null ? (
                  <shortcut.Icon
                    size={24}
                    color={PRIMARY_700}
                    strokeWidth={2.2}
                  />
                ) : (
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "800",
                      color: PRIMARY_700,
                    }}
                  >
                    {shortcut.label.slice(0, 2)}
                  </Text>
                )}
              </Glass>
              {/* The row moved off the header's blue wash and onto the
                  page's pale ground, where white was invisible. */}
              <Text
                numberOfLines={1}
                style={{ fontSize: 12, fontWeight: "600", color: TEXT_PRIMARY }}
              >
                {shortcut.label}
              </Text>
            </Pressable>
          );
        })}

        {/* The way to change the row, at the end of it. */}
        <Pressable
          onPress={() => setEditing(true)}
          accessibilityRole="button"
          accessibilityLabel="แก้ไขเมนูลัด"
          style={({ pressed }) => ({
            width: 72,
            alignItems: "center",
            gap: 6,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Glass
            interactive
            style={{
              width: TILE,
              height: TILE,
              borderRadius: TILE / 2,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Pencil size={20} color={PRIMARY_700} strokeWidth={2.4} />
          </Glass>
          <Text
            numberOfLines={1}
            style={{ fontSize: 12, fontWeight: "600", color: TEXT_SECONDARY }}
          >
            แก้ไข
          </Text>
        </Pressable>
      </ScrollView>

      <EditSheet visible={editing} onClose={() => setEditing(false)} />
    </>
  );
}

/** The height a row is dragged in steps of. */
const ROW_H = 64;

/**
 * Which shortcuts are on the row, and in what order.
 *
 * Two lists: what is on the home page, dragged into the order the carer
 * wants it, and what else could be. No numbers down the side — the order
 * IS the order, and a figure saying "3" beside the third row is the list
 * explaining itself.
 */
function EditSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const keys = useShortcuts();
  const rest = SHORTCUTS.filter((s) => !keys.includes(s.key));
  /**
   * The drag in progress: which row was picked up, and where it would land.
   *
   * The list is NOT reordered while the finger is down — that was a state
   * update and a re-render for every row crossed, which is what made the
   * drag stutter. The row follows the finger on the UI thread, a line shows
   * where it will go, and the order changes once, on release.
   */
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: CANVAS }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: SPACE.lg,
            paddingTop: SPACE.lg,
          }}
        >
          <GlassIconButton onPress={onClose} accessibilityLabel="ปิด">
            <X size={22} color={TEXT_PRIMARY} strokeWidth={2.6} />
          </GlassIconButton>
          <Text
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 16,
              fontWeight: "600",
              color: TEXT_PRIMARY,
            }}
          >
            เมนูลัด
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          contentContainerStyle={{
            padding: SPACE.lg,
            gap: SPACE.md,
            paddingBottom: insets.bottom + SPACE.xl,
          }}
          showsVerticalScrollIndicator={false}
          // The list is dragged in place; letting the page move under the
          // finger at the same time fights it.
          scrollEnabled={drag == null}
        >
          <Text
            style={{
              fontSize: 13,
              lineHeight: 19,
              color: TEXT_MUTED,
              paddingHorizontal: SPACE.xs,
            }}
          >
            แตะปุ่มลบเพื่อเอาออก ปุ่มเขียวเพื่อเพิ่ม
            และลากปุ่มด้านขวาเพื่อจัดลำดับ
          </Text>

          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: TEXT_SECONDARY,
              paddingHorizontal: SPACE.xs,
            }}
          >
            {`อยู่บนหน้าแรก (${keys.length})`}
          </Text>
          <Card style={{ paddingVertical: 0 }}>
            {keys.length === 0 && (
              <Text
                style={{
                  paddingVertical: SPACE.lg,
                  fontSize: 14,
                  color: TEXT_MUTED,
                }}
              >
                ยังไม่มีเมนูลัดบนหน้าแรก
              </Text>
            )}
            {keys.map((key, i) => {
              const s = shortcutOf(key);
              if (s == null) return null;
              // Where the row would land, drawn on the row it would land
              // against: above it when moving up, below it when moving down.
              const before =
                drag != null && drag.to === i && drag.to <= drag.from;
              const after =
                drag != null && drag.to === i && drag.to > drag.from;
              return (
                <View key={key}>
                  {before && <DropLine />}
                  <DragRow
                    index={i}
                    count={keys.length}
                    rule={i > 0 && !before}
                    onDragStart={() => setDrag({ from: i, to: i })}
                    onDragTo={(to) => {
                      setDrag({ from: i, to });
                      feel("tick");
                    }}
                    onDrop={(to) => {
                      setDrag(null);
                      if (to === i) return;
                      const next = [...keys];
                      const [moved] = next.splice(i, 1);
                      if (moved == null) return;
                      next.splice(to, 0, moved);
                      setShortcuts(next);
                    }}
                  >
                    {/* The way off the row, in front of it — where iOS puts
                        it in an editable list, so the whole column of them is
                        one target the thumb can run down. */}
                    <RowButton
                      kind="remove"
                      label={`เอา ${s.label} ออกจากหน้าแรก`}
                      onPress={() => {
                        feel("tick");
                        toggleShortcut(key);
                      }}
                    />
                    <Mark image={s.image} Icon={s.Icon} label={s.label} />
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 15,
                        fontWeight: "600",
                        color: TEXT_PRIMARY,
                      }}
                    >
                      {s.label}
                    </Text>
                  </DragRow>
                  {after && <DropLine />}
                </View>
              );
            })}
          </Card>

          {/* What is not on the page yet, under its own heading rather than
              greyed out at the foot of the same list: a row that is off is
              a different thing from a row that is on, not a dimmer one. */}
          {rest.length > 0 && (
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: TEXT_SECONDARY,
                paddingHorizontal: SPACE.xs,
                marginTop: SPACE.sm,
              }}
            >
              เมนูอื่นที่เพิ่มได้
            </Text>
          )}
          {rest.length > 0 && (
            <Card style={{ paddingVertical: 0 }}>
              {rest.map((s, i) => (
                <View key={s.key}>
                  {i > 0 && (
                    <View style={{ height: 1, backgroundColor: SEPARATOR }} />
                  )}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: SPACE.md,
                      height: ROW_H,
                    }}
                  >
                    <RowButton
                      kind="add"
                      label={`เพิ่ม ${s.label} ไปหน้าแรก`}
                      onPress={() => {
                        feel("tick");
                        toggleShortcut(s.key);
                      }}
                    />
                    <Mark image={s.image} Icon={s.Icon} label={s.label} />
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 15,
                        fontWeight: "600",
                        color: TEXT_PRIMARY,
                      }}
                    >
                      {s.label}
                    </Text>
                    {/* Where the grip sits on a row above, so the rows line up. */}
                    <View style={{ width: 32 }} />
                  </View>
                </View>
              ))}
            </Card>
          )}

          <Pressable
            onPress={() => {
              feel("tick");
              setShortcuts([...DEFAULT_SHORTCUTS]);
            }}
            accessibilityRole="button"
            style={({ pressed }) => ({
              alignSelf: "center",
              opacity: pressed ? 0.6 : 1,
              paddingVertical: SPACE.sm,
            })}
          >
            <Text
              style={{ fontSize: 14, fontWeight: "600", color: PRIMARY_500 }}
            >
              คืนค่าเริ่มต้น
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

/** The mark at the head of an editable row: take it off, or put it on. */
function RowButton({
  kind,
  label,
  onPress,
}: {
  kind: "remove" | "add";
  label: string;
  onPress: () => void;
}) {
  const remove = kind === "remove";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        // Grey to take off, green to put on: removing a shortcut is not a
        // warning, and a red disc down the column made the list read as a
        // page of things going wrong.
        backgroundColor: remove ? GROUPED_BG : SUCCESS,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {remove ? (
        <Minus size={15} color={TEXT_SECONDARY} strokeWidth={3} />
      ) : (
        <Plus size={15} color="#FFFFFF" strokeWidth={3} />
      )}
    </Pressable>
  );
}

/** A shortcut's picture, its glyph, or the first letters of its name. */
function Mark({
  image,
  Icon,
  label,
}: {
  image?: ReturnType<typeof require>;
  Icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
}) {
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: PRIMARY_100,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {image != null ? (
        <Image
          source={image}
          style={{ width: 26, height: 26 }}
          resizeMode="contain"
        />
      ) : Icon != null ? (
        <Icon size={20} color={PRIMARY_700} strokeWidth={2.2} />
      ) : (
        <Text style={{ fontSize: 13, fontWeight: "800", color: PRIMARY_700 }}>
          {label.slice(0, 2)}
        </Text>
      )}
    </View>
  );
}

/** Where the row will land, drawn between the two it will sit between. */
function DropLine() {
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
function DragRow({
  index,
  count,
  rule,
  onDragStart,
  onDragTo,
  onDrop,
  children,
}: {
  index: number;
  count: number;
  /** Whether to draw the hairline above this row. */
  rule: boolean;
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
      const steps = Math.round(e.translationY / ROW_H);
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
    shadowOpacity: lifted.value * 0.16,
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
          shadowColor: "#0F172A",
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
        },
      ]}
    >
      {rule && <View style={{ height: 1, backgroundColor: SEPARATOR }} />}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.md,
          height: ROW_H,
        }}
      >
        {children}
        <GestureDetector gesture={pan}>
          <View
            accessibilityLabel="ลากเพื่อจัดลำดับ"
            hitSlop={12}
            style={{
              width: 32,
              height: ROW_H,
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
