import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import { MapPin, Search, X } from "lucide-react-native";

import { GlassIconButton } from "../components/GlassIconButton";
import { SearchField } from "../components/SearchField";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  geocodeQuery,
  placeOfAddress,
  searchAddress,
  type ThaiAddress,
} from "../models/thaiAddress";
import {
  CANVAS,
  FILL_SUBTLE,
  PANEL,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  SURFACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";
import { FORM_MAX, readable, useLayout, GUTTER } from "../theme/layout";
import { tr } from "../i18n";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * "ค้นหาที่อยู่" — the address list, over the map picker.
 *
 * Its own sheet rather than a menu hanging off the field. The answer to
 * "10140" is four different sub-districts, and a list that long over a map
 * has to be a list you can read and scroll, not a dropdown squeezed into
 * whatever space is left under a search bar.
 *
 * The rows are the bundled registry, matched as the carer types — no network,
 * so it answers on the keystroke instead of a beat after it.
 */
export function AddressSearchScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const { regular } = useLayout();

  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const { hits, total } = useMemo(() => searchAddress(query), [query]);
  const typed = query.trim().length >= 2;

  /**
   * The registry has no coordinates, so the map still needs the geocoder —
   * but once, for the row that was chosen, rather than for every keystroke.
   */
  const choose = async (a: ThaiAddress) => {
    if (busy) return;
    setBusy(true);
    try {
      const [found] = await Location.geocodeAsync(geocodeQuery(a));
      if (!found) {
        toast(
          tr("หาตำแหน่งของที่อยู่นี้บนแผนที่ไม่ได้", "Couldn't find this address on the map"),
          "error",
        );
        return;
      }
      // Back to the map it was opened from, not a second one over this.
      nav.popTo("PickLocation", {
        initial: { latitude: found.latitude, longitude: found.longitude },
        chosen: {
          lat: found.latitude,
          lng: found.longitude,
          place: placeOfAddress(a),
        },
      });
    } catch {
      toast(
          tr("หาตำแหน่งของที่อยู่นี้บนแผนที่ไม่ได้", "Couldn't find this address on the map"),
          "error",
        );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: SURFACE }}>
      {/* A column down the middle of a tablet's sheet; the whole width on a phone. */}
      <View style={{ flex: 1, ...(regular ? readable(FORM_MAX) : null) }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.md,
          paddingHorizontal: GUTTER,
          paddingTop: SPACE.lg,
          paddingBottom: SPACE.md,
        }}
      >
        <GlassIconButton onPress={() => nav.goBack()} accessibilityLabel={tr("ปิด", "Close")}>
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
          {tr("ค้นหาที่อยู่", "Search address")}
        </Text>
        {/* Balances the close button, so the title sits on the sheet's centre
            rather than the centre of what is left beside one button. */}
        <View style={{ width: 44 }} />
      </View>

      <View style={{ paddingHorizontal: GUTTER }}>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={tr(
            "รหัสไปรษณีย์ จังหวัด อำเภอ หรือตำบล",
            "Postal code, province, district or subdistrict",
          )}
          autoFocus
          fill={FILL_SUBTLE}
        />
      </View>

      {typed && (
        <Text
          style={{
            paddingHorizontal: GUTTER,
            paddingTop: SPACE.md,
            paddingBottom: SPACE.sm,
            fontSize: 14,
            color: TEXT_MUTED,
          }}
        >
          {total === 0
            ? tr(`ไม่พบ "${query.trim()}"`, `No results for "${query.trim()}"`)
            : tr(
                `พบ ${total} รายการ${total > hits.length ? ` · แสดง ${hits.length} แรก` : ""}`,
                `${total} ${total === 1 ? "result" : "results"}${total > hits.length ? ` · showing the first ${hits.length}` : ""}`,
              )}
        </Text>
      )}

      <ScrollView
        // Scrolls before the sheet drags, on Android: without it a pull down
        // over scrolled content moves the whole sheet, and closes it.
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACE.huge }}
      >
        {!typed ? (
          <View style={{ alignItems: "center", paddingTop: SPACE.huge, gap: SPACE.md }}>
            <Search size={32} color={TEXT_MUTED} />
            <Text style={{ fontSize: 14, color: TEXT_MUTED, textAlign: "center" }}>
              {tr(
                "พิมพ์อย่างน้อย 2 ตัวอักษร\nเช่น 10140 หรือ ทุ่งครุ",
                // The registry is in Thai: a postcode is what an English
                // keyboard can find it by.
                "Type at least 2 characters\ne.g. a postal code such as 10140",
              )}
            </Text>
          </View>
        ) : (
          hits.map((a, i) => (
            <Pressable
              key={`${a.postalCode}-${a.subdistrict}-${a.district}-${i}`}
              onPress={() => void choose(a)}
              accessibilityRole="button"
              accessibilityLabel={`${a.postalCode} ${a.province} ${a.subdistrict} ${a.district}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.md,
                paddingHorizontal: GUTTER,
                paddingVertical: SPACE.md,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: SEPARATOR,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(7,125,215,0.10)",
                }}
              >
                <MapPin size={20} color={PRIMARY_500} />
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 16, color: TEXT_PRIMARY }}>
                  <Text style={{ fontWeight: "700", color: PRIMARY_500 }}>
                    {a.postalCode}
                  </Text>
                  {`  ${a.province}`}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ marginTop: 2, fontSize: 14, color: TEXT_MUTED }}
                >
                  {`${a.subdistrict}  ›  ${a.district}`}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
      </View>

      {busy && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: insets.bottom + SPACE.xl,
            alignItems: "center",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.sm,
              backgroundColor: PANEL,
              borderRadius: RADIUS.capsule,
              paddingHorizontal: SPACE.lg,
              paddingVertical: SPACE.sm,
            }}
          >
            <ActivityIndicator size="small" color={PRIMARY_500} />
            <Text style={{ fontSize: 12, color: TEXT_MUTED }}>
              {tr("กำลังหาตำแหน่ง", "Finding location")}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
