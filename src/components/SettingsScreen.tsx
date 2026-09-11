import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HeaderFade, HEADER_FADE } from "./HeaderFade";
import { ScreenHeader } from "./ScreenHeader";
import { CANVAS, SPACE, TEXT_MUTED } from "../theme/tokens";

/**
 * The shell every settings sub-page shares: a plain header with no wash
 * behind it, then a scrolling body.
 *
 * The tab-level screens carry the drifting gradient; these do not — a
 * detail page under a coloured header read as another top-level destination
 * rather than somewhere you had drilled into.
 */
export function SettingsScreen({
  title,
  children,
  footnote,
}: {
  title: string;
  children: ReactNode;
  footnote?: string;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <ScreenHeader title={title} />
      {/* The content dissolves into the header rather than being cut off at
          its lower edge — the same ramp every sub-page carries. */}
      <HeaderFade from={0} to={HEADER_FADE}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: SPACE.lg,
          // Clears the ramp, so nothing rests inside it half faded.
          paddingTop: HEADER_FADE,
          paddingBottom: insets.bottom + SPACE.huge,
          gap: SPACE.md,
        }}
        keyboardDismissMode="on-drag"
      >
        {children}
        {footnote != null && (
          <Text
            style={{
              marginTop: SPACE.sm,
              fontSize: 12,
              lineHeight: 18,
              color: TEXT_MUTED,
            }}
          >
            {footnote}
          </Text>
        )}
      </ScrollView>
      </HeaderFade>
    </View>
  );
}

/** A titled group of rows in one card. */
export function SettingsGroup({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: SPACE.md }}>
      {title != null && (
        <Text style={{ fontSize: 16, fontWeight: "500", marginTop: SPACE.xs }}>
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}
