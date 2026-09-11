import { useState } from "react";
import { Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { SearchListScreen } from "../components/SearchListScreen";
import { TaskPostingCard } from "../components/TaskPostingCard";
import type { RootStackParamList } from "../navigation/RootStack";
import { sampleTasks, searchVisits } from "../models/task";
import { SPACE, TEXT_MUTED } from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** "ภารกิจใหม่" — the open postings, newest first. */
export function TaskListScreen() {
  const [query, setQuery] = useState("");
  const nav = useNavigation<Nav>();

  const results = searchVisits(query, sampleTasks);

  return (
    <SearchListScreen
      title="ภารกิจใหม่"
      query={query}
      onQuery={setQuery}
      placeholder="ค้นหาชื่อผู้ป่วยหรืองาน"
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
          ไม่พบภารกิจที่ตรงกับ "{query.trim()}"
        </Text>
      ) : (
        results.map((t) => {
          // The card and its button lead to the same place, so they share one
          // handler rather than drifting apart.
          const open = () => nav.navigate("AcceptTask", { task: t });
          return <TaskPostingCard key={t.id} task={t} onPress={open} onAccept={open} />;
        })
      )}
    </SearchListScreen>
  );
}
