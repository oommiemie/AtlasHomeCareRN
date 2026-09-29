import { useState, type ComponentType } from "react";
import { Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Minus, Pencil, Plus, X } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { Card } from "./Card";
import { DragRow, DropLine } from "./DragRow";
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
import { isEn, tr } from "../i18n";
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
} from "../theme/tokens";
import { GUTTER } from "../theme/layout";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** The tile is a disc, the way a shortcut reads on a home screen. */
const TILE = 60;

/*
  The column each tile's name sits in. English names run longer than the
  Thai ("Health follow-up" against "ติดตามสุขภาพ"), so in English the column
  is a little wider and the name may take a second line rather than being
  cut off to "Health fol…".
*/
const TILE_COLUMN = isEn ? 80 : 72;
const LABEL_LINES = isEn ? 2 : 1;

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
export function ShortcutRow({
  wrap = false,
}: {
  /** Lay the tiles out in two rows rather than one row that scrolls. */
  wrap?: boolean;
} = {}) {
  const nav = useNavigation<Nav>();
  const keys = useShortcuts();
  const [editing, setEditing] = useState(false);

  // The width the tiles share when wrapped: six across, as the carer
  // asked for — fewer only where six would not fit.
  const [rowW, setRowW] = useState(0);
  const fit = Math.max(
    1,
    Math.floor((rowW + SPACE.md) / (TILE_COLUMN + SPACE.md)),
  );
  const across = Math.min(fit, 6);
  const cellWidth = wrap && rowW > 0 ? rowW / across : TILE_COLUMN;

  const go = (key: ShortcutKey) => {
    const shortcut = shortcutOf(key);
    if (shortcut == null) return;
    feel("tick");
    // A shortcut to a page that is not built yet says so rather than doing
    // nothing: it is on the list because the row is arranged now and the
    // pages arrive later.
    if (shortcut.target == null) {
      toast(
        tr(
          `${shortcut.label}ยังไม่เปิดใช้งาน`,
          `${shortcut.label} isn't available yet`,
        ),
      );
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

  const tiles = (
    <>
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
              width: cellWidth,
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
              numberOfLines={LABEL_LINES}
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: TEXT_PRIMARY,
                textAlign: "center",
              }}
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
        accessibilityLabel={tr("แก้ไขเมนูลัด", "Edit shortcuts")}
        style={({ pressed }) => ({
          width: cellWidth,
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
          {tr("แก้ไข", "Edit")}
        </Text>
      </Pressable>
    </>
  );

  return (
    <>
      {wrap ? (
        /*
          Rows of six instead of one row that scrolls, where there is the
          room — the half of a landscape iPad the home page gives it.
        */
        <View
          onLayout={(e) => setRowW(e.nativeEvent.layout.width - GUTTER * 2)}
          style={{
            paddingHorizontal: GUTTER,
            flexDirection: "row",
            flexWrap: "wrap",
            rowGap: SPACE.lg,
          }}
        >
          {tiles}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: GUTTER, gap: SPACE.md }}
        >
          {tiles}
        </ScrollView>
      )}

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
      supportedOrientations={["portrait", "landscape"]}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: CANVAS }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: GUTTER,
            paddingTop: SPACE.lg,
          }}
        >
          <GlassIconButton
            onPress={onClose}
            accessibilityLabel={tr("ปิด", "Close")}
          >
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
            {tr("เมนูลัด", "Shortcuts")}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingVertical: SPACE.lg,
            paddingHorizontal: GUTTER,
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
            {tr(
              "แตะปุ่มลบเพื่อเอาออก ปุ่มเขียวเพื่อเพิ่ม และลากปุ่มด้านขวาเพื่อจัดลำดับ",
              "Tap the red button to remove, the green one to add, and drag the handle on the right to reorder.",
            )}
          </Text>

          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: TEXT_SECONDARY,
              paddingHorizontal: SPACE.xs,
            }}
          >
            {tr(
              `อยู่บนหน้าแรก (${keys.length})`,
              `On the home page (${keys.length})`,
            )}
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
                {tr(
                  "ยังไม่มีเมนูลัดบนหน้าแรก",
                  "No shortcuts on the home page yet",
                )}
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
                      toast(
                        tr("จัดลำดับเมนูแล้ว", "Shortcuts reordered"),
                        "success",
                      );
                    }}
                  >
                    {/* The way off the row, in front of it — where iOS puts
                        it in an editable list, so the whole column of them is
                        one target the thumb can run down. */}
                    <RowButton
                      kind="remove"
                      label={tr(
                        `เอา ${s.label} ออกจากหน้าแรก`,
                        `Remove ${s.label} from the home page`,
                      )}
                      onPress={() => {
                        feel("tick");
                        toggleShortcut(key);
                        toast(
                          tr(
                            `เอา ${s.label} ออกจากหน้าแรกแล้ว`,
                            `Removed ${s.label} from the home page`,
                          ),
                          "success",
                        );
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
              {tr("เมนูอื่นที่เพิ่มได้", "More shortcuts to add")}
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
                      label={tr(
                        `เพิ่ม ${s.label} ไปหน้าแรก`,
                        `Add ${s.label} to the home page`,
                      )}
                      onPress={() => {
                        feel("tick");
                        toggleShortcut(s.key);
                        toast(
                          tr(
                            `เพิ่ม ${s.label} ไปหน้าแรกแล้ว`,
                            `Added ${s.label} to the home page`,
                          ),
                          "success",
                        );
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
              toast(
                tr("คืนค่าเมนูเริ่มต้นแล้ว", "Default shortcuts restored"),
                "success",
              );
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
              {tr("คืนค่าเริ่มต้น", "Restore defaults")}
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
