import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Check, X } from "lucide-react-native";

import { GlassIconButton } from "../components/GlassIconButton";
import { SearchField } from "../components/SearchField";
import { optionDetail, optionRequest, optionValue } from "../models/optionPicker";
import {
  PRIMARY_500,
  SEPARATOR,
  SPACE,
  SURFACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";

/**
 * The list behind a `SelectField` — Apple's own sheet, not a view drawn to
 * look like one.
 *
 * It is a route with `presentation: "modal"`, so UIKit presents it: the page
 * behind insets and scales back, the grabber is the system's, and it can be
 * pulled down to dismiss. A React Native `Modal` gets none of that, and the
 * difference shows next to the address sheet, which has always been a real
 * one.
 */
export function SelectOptionScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  // Read once: the request is set immediately before this screen is pushed,
  // and nothing changes it while it is up.
  const [request] = useState(optionRequest);
  const [query, setQuery] = useState("");

  const options = request?.options ?? [];
  const q = query.trim().toLowerCase();
  // Matched on both lines: two villages of the same name are told apart by
  // where they are, so where they are has to be searchable too.
  const shown = useMemo(
    () =>
      q.length > 0
        ? options.filter((o) =>
            `${optionValue(o)} ${optionDetail(o)}`.toLowerCase().includes(q),
          )
        : options,
    [options, q],
  );

  const pick = (o: string) => {
    request?.onPick(o);
    nav.goBack();
  };

  return (
    <View style={{ flex: 1, backgroundColor: SURFACE }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.md,
          paddingHorizontal: SPACE.lg,
          paddingTop: SPACE.lg,
          paddingBottom: SPACE.md,
        }}
      >
        <GlassIconButton size={48} onPress={() => nav.goBack()} accessibilityLabel="ปิด">
          <X size={22} color={TEXT_PRIMARY} strokeWidth={2.6} />
        </GlassIconButton>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 20,
            lineHeight: 23,
            fontWeight: "800",
            color: TEXT_PRIMARY,
          }}
        >
          {request?.title ?? ""}
        </Text>
        {/* Balances the close button, so the title sits on the sheet's centre
            rather than the centre of what is left beside one button. */}
        <View style={{ width: 48 }} />
      </View>

      <Text
        style={{
          paddingHorizontal: SPACE.lg,
          paddingTop: SPACE.md,
          paddingBottom: SPACE.sm,
          fontSize: 14,
          color: TEXT_MUTED,
        }}
      >
        {shown.length === 0
          ? `ไม่พบ "${query.trim()}"`
          : `พบ ${shown.length} รายการ`}
      </Text>

      {request?.searchable === true && (
        <View style={{ paddingHorizontal: SPACE.lg, paddingBottom: SPACE.md }}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder={`ค้นหา${request.title}`}
            autoFocus
            // A plain fill: the sheet is opaque, and glass over it has
            // nothing to refract — the field comes out as a white patch.
            fill="rgba(120,120,128,0.16)"
          />
        </View>
      )}

      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACE.huge }}
      >
        {shown.map((o, i) => {
          const value = optionValue(o);
          const detail = optionDetail(o);
          const picked = value === request?.value;
          return (
            <Pressable
              key={value}
              onPress={() => pick(value)}
              accessibilityRole="button"
              accessibilityLabel={detail.length > 0 ? `${value} ${detail}` : value}
              accessibilityState={{ selected: picked }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.md,
                minHeight: 56,
                paddingHorizontal: SPACE.lg,
                paddingVertical: SPACE.md,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: SEPARATOR,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 16,
                    lineHeight: 22,
                    fontWeight: picked ? "700" : "400",
                    color: picked ? PRIMARY_500 : TEXT_PRIMARY,
                  }}
                >
                  {value}
                </Text>
                {detail.length > 0 && (
                  <Text
                    numberOfLines={1}
                    style={{ marginTop: 2, fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}
                  >
                    {detail}
                  </Text>
                )}
              </View>
              {picked && <Check size={20} color={PRIMARY_500} strokeWidth={2.6} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
