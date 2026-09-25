import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CheckSquare, ImageIcon, Pin } from "lucide-react-native";

import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { Card } from "../components/Card";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { PressableScale } from "../components/PressableScale";
import { ScreenHeader } from "../components/ScreenHeader";
import { SearchField } from "../components/SearchField";
import { SectionHeader } from "../components/SectionHeader";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  deleteNote,
  newNote,
  pinNote,
  previewOf,
  searchNotes,
  shotsOf,
  tickedOf,
  titleOf,
  useNotes,
  type Note,
} from "../models/notes";
import { feel } from "../utils/haptics";
import { isSameDay, thaiShortDate, thaiTime } from "../utils/thaiDate";
import {
  CANVAS,
  PRIMARY_500,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * "สมุดจด" — every page the carer has kept, newest first.
 *
 * A list rather than one long note. What a carer keeps is a page per
 * subject — this school, that family, next month's campaign — and a page
 * can be opened at the meeting it is about, which a single running journal
 * cannot.
 *
 * The button says เขียนหน้าใหม่ and opens straight into a page with the
 * cursor already in it. Nothing is asked first: not a title, not a kind,
 * not a folder. A notebook that wants three answers before it will take a
 * sentence is a notebook somebody writes on their hand instead.
 */
export function NotesScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const notes = useNotes();
  const [query, setQuery] = useState("");

  const found = searchNotes(notes, query);
  const pinned = found.filter((n) => n.pinned === true);
  const rest = found.filter((n) => n.pinned !== true);

  const hold = (n: Note) => {
    feel("tick");
    Alert.alert(titleOf(n), undefined, [
      {
        text: n.pinned === true ? "เลิกปักหมุด" : "ปักหมุดไว้บนสุด",
        onPress: () => pinNote(n.id, n.pinned !== true),
      },
      {
        text: "ลบหน้านี้",
        style: "destructive",
        onPress: () => deleteNote(n.id),
      },
      { text: "ยกเลิก", style: "cancel" },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <ScreenHeader
        title="สมุดจด"
        below={
          notes.length === 0 ? undefined : (
            <View style={{ marginTop: SPACE.md }}>
              <SearchField
                value={query}
                onChangeText={setQuery}
                placeholder="ค้นหาในสมุดจด"
              />
            </View>
          )
        }
      />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: SPACE.lg,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + 100,
            gap: SPACE.md,
          }}
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {notes.length === 0 ? (
            <Card>
              <Text
                style={{ fontSize: 15, lineHeight: 24, color: TEXT_SECONDARY }}
              >
                ยังไม่มีหน้าในสมุด — กดปุ่มด้านล่างเพื่อเขียนหน้าแรก
                จดอะไรก็ได้ที่ไม่มีช่องให้กรอกในแบบฟอร์ม
              </Text>
            </Card>
          ) : found.length === 0 ? (
            <Text
              style={{
                paddingHorizontal: SPACE.xs,
                fontSize: 13,
                lineHeight: 21,
                color: TEXT_MUTED,
              }}
            >
              {`ไม่พบหน้าที่ตรงกับ "${query.trim()}"`}
            </Text>
          ) : (
            <>
              {pinned.length > 0 && (
                <>
                  <SectionHeader
                    title="ปักหมุดไว้"
                    count={pinned.length}
                    flush
                  />
                  <Card padded={false}>
                    {pinned.map((n, i) => (
                      <Row
                        key={n.id}
                        note={n}
                        divider={i > 0}
                        onPress={() => nav.navigate("Note", { noteId: n.id })}
                        onHold={() => hold(n)}
                      />
                    ))}
                  </Card>
                </>
              )}

              {rest.length > 0 && (
                <>
                  {pinned.length > 0 && (
                    <SectionHeader title="หน้าอื่น" count={rest.length} flush />
                  )}
                  <Card padded={false}>
                    {rest.map((n, i) => (
                      <Row
                        key={n.id}
                        note={n}
                        divider={i > 0}
                        onPress={() => nav.navigate("Note", { noteId: n.id })}
                        onHold={() => hold(n)}
                      />
                    ))}
                  </Card>
                </>
              )}
            </>
          )}
        </ScrollView>
      </HeaderFade>

      <ActionBar>
        <PrimaryAction
          label="เขียนหน้าใหม่"
          onPress={() => {
            feel("tick");
            nav.navigate("Note", { noteId: newNote() });
          }}
        />
      </ActionBar>
    </View>
  );
}

/** When it was last written to — the hour today, the date before that. */
const whenOf = (at: number) => {
  const d = new Date(at);
  return isSameDay(d, new Date()) ? thaiTime(d) : thaiShortDate(d);
};

/** One page in the list: what it is called, what it says, and what is on it. */
function Row({
  note,
  divider,
  onPress,
  onHold,
}: {
  note: Note;
  divider: boolean;
  onPress: () => void;
  onHold: () => void;
}) {
  const ticked = tickedOf(note);
  const shots = shotsOf(note);
  const preview = previewOf(note);

  return (
    <PressableScale
      scaleTo={0.995}
      onPress={onPress}
      onLongPress={onHold}
      accessibilityRole="button"
      accessibilityLabel={titleOf(note)}
      style={{
        gap: 3,
        paddingHorizontal: SPACE.lg,
        paddingVertical: SPACE.lg,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: SEPARATOR,
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}
      >
        {note.pinned === true && <Pin size={13} color={PRIMARY_500} />}
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: 16,
            lineHeight: 25,
            fontWeight: "600",
            color: TEXT_PRIMARY,
          }}
        >
          {titleOf(note)}
        </Text>
        <Text style={{ fontSize: 12, lineHeight: 19, color: TEXT_MUTED }}>
          {whenOf(note.updatedAt)}
        </Text>
      </View>

      {preview !== "" && (
        <Text
          numberOfLines={1}
          style={{ fontSize: 14, lineHeight: 22, color: TEXT_SECONDARY }}
        >
          {preview}
        </Text>
      )}

      {/* What is ON the page, which is how a carer recognises it across a
          list — the page with the checklist, the page with the photographs. */}
      {(ticked != null || shots > 0) && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: SPACE.md,
            marginTop: 2,
          }}
        >
          {ticked != null && (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <CheckSquare size={13} color={TEXT_MUTED} />
              <Text
                style={{
                  fontSize: 12,
                  lineHeight: 19,
                  color: TEXT_MUTED,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {`${ticked.done}/${ticked.total}`}
              </Text>
            </View>
          )}
          {shots > 0 && (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <ImageIcon size={13} color={TEXT_MUTED} />
              <Text
                style={{
                  fontSize: 12,
                  lineHeight: 19,
                  color: TEXT_MUTED,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {shots}
              </Text>
            </View>
          )}
        </View>
      )}
    </PressableScale>
  );
}
