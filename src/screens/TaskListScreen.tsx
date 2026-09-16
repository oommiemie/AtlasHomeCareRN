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
        title="ภารกิจใหม่"
        right={
          <ToolbarPill
            slots={[
              {
                icon: <Search size={20} color={searching ? PRIMARY_500 : TEXT_PRIMARY} />,
                label: searching ? "ปิดการค้นหา" : "ค้นหา",
                onPress: toggleSearch,
              },
              {
                icon: <History size={20} color={TEXT_PRIMARY} strokeWidth={2.2} />,
                label: "ประวัติการรับงาน",
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
                placeholder="ค้นหาชื่อผู้ป่วยหรืองาน"
                autoFocus
              />
            </View>
          ) : null
        }
      />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: SPACE.lg,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + SPACE.huge,
            gap: SPACE.md,
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
                textAlign: "center",
                fontSize: 14,
                color: TEXT_MUTED,
              }}
            >
              {query.trim() === ""
                ? "ยังไม่มีภารกิจใหม่"
                : `ไม่พบภารกิจที่ตรงกับ "${query.trim()}"`}
            </Text>
          ) : (
            results.map((t) => {
              // The card and its button lead to the same place, so they share
              // one handler rather than drifting apart.
              const open = () => openTask(nav, t);
              return <TaskPostingCard key={t.id} task={t} onPress={open} onAccept={open} />;
            })
          )}
        </ScrollView>
      </HeaderFade>
    </View>
  );
}
