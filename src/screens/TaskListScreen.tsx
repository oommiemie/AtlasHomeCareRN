import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { History, Search } from "lucide-react-native";

import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { SearchField } from "../components/SearchField";
import { TaskPostingCard } from "../components/TaskPostingCard";
import { ToolbarPill } from "../components/ToolbarPill";
import type { RootStackParamList } from "../navigation/RootStack";
import { sampleTasks, searchVisits } from "../models/task";
import { openTask } from "../navigation/openTask";
import { CANVAS, PRIMARY_500, SPACE, TEXT_MUTED, TEXT_PRIMARY } from "../theme/tokens";
import { cardWidth, columnsFor, useLayout, GUTTER } from "../theme/layout";
import { tr } from "../i18n";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * "ภารกิจใหม่" — the open postings, newest first.
 *
 * Search is a toolbar slot rather than a field standing over the list: the
 * two things a carer reaches for up here are the same size and sit in the
 * same capsule, and the field only takes room once it is asked for.
 */
export function TaskListScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const { width } = useLayout();
  // One card a row on a phone; two or three across a tablet.
  const columns = columnsFor(width);
  const cardW = cardWidth(width - GUTTER * 2, columns, SPACE.md);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  // Closing search clears the query: a filter the carer can no longer see
  // would look like missing data.
  const toggleSearch = () =>
    setSearching((was) => {
      if (was) setQuery("");
      return !was;
    });

  const results = searchVisits(query, sampleTasks);

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <ScreenHeader
        title={tr("ภารกิจใหม่", "New tasks")}
        right={
          <ToolbarPill
            slots={[
              {
                icon: <Search size={20} color={searching ? PRIMARY_500 : TEXT_PRIMARY} />,
                label: searching ? tr("ปิดการค้นหา", "Close search") : tr("ค้นหา", "Search"),
                onPress: toggleSearch,
              },
              {
                icon: <History size={20} color={TEXT_PRIMARY} strokeWidth={2.2} />,
                label: tr("ประวัติการรับงาน", "Task history"),
                onPress: () => nav.navigate("PostingLog"),
              },
            ]}
          />
        }
        below={
          searching ? (
            <View style={{ marginTop: SPACE.lg }}>
              <SearchField
                value={query}
                onChangeText={setQuery}
                placeholder={tr("ค้นหาชื่อผู้ป่วยหรืองาน", "Search patients or tasks")}
                autoFocus
              />
            </View>
          ) : null
        }
      />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: GUTTER,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + SPACE.huge,
            gap: SPACE.md,
            ...(columns > 1 && { flexDirection: "row", flexWrap: "wrap" }),
          }}
          keyboardDismissMode="on-drag"
          // A tap while the keyboard is up would otherwise be spent closing
          // it, leaving the card underneath unopened.
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {results.length === 0 ? (
            <Text
              style={{
                marginTop: SPACE.huge,
                width: "100%",
                textAlign: "center",
                fontSize: 14,
                color: TEXT_MUTED,
              }}
            >
              {query.trim() === ""
                ? tr("ยังไม่มีภารกิจใหม่", "No new tasks yet")
                : tr(
                    `ไม่พบภารกิจที่ตรงกับ "${query.trim()}"`,
                    `No tasks match "${query.trim()}"`,
                  )}
            </Text>
          ) : (
            results.map((t) => {
              // The card and its button lead to the same place, so they share
              // one handler rather than drifting apart.
              const open = () => openTask(nav, t);
              const card = <TaskPostingCard task={t} onPress={open} onAccept={open} />;
              return columns > 1 ? (
                <View key={t.id} style={{ width: cardW }}>
                  {card}
                </View>
              ) : (
                <View key={t.id}>{card}</View>
              );
            })
          )}
        </ScrollView>
      </HeaderFade>
    </View>
  );
}
