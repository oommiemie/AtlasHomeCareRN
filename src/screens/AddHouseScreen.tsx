import { useEffect, type ReactNode } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { Card } from "../components/Card";
import { MapPreview } from "../components/MapPreview";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { GlassIconButton } from "../components/GlassIconButton";
import { ScreenHeader } from "../components/ScreenHeader";
import { SelectField, TextField } from "../components/FormField";
import { UIcon } from "../components/UIcon";
import type { RootStackParamList } from "../navigation/RootStack";
import { sampleVillages } from "../models/household";
import {
  beginHouseDraft,
  houseStepDone,
  patchHouseDraft,
  registrationError,
  REGISTRATION_DIGITS,
  useHouseDraft,
} from "../models/houseDraft";
import { placeSummary } from "../models/place";
import { FALLBACK_HERE } from "../utils/useHere";
import {
  CANVAS,
  DANGER,
  PRIMARY_500,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";
import { FORM_MAX, readable, useLayout, GUTTER } from "../theme/layout";
import { tr } from "../i18n";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * The villages this app knows about, for the project field.
 *
 * Read off the registry rather than typed: a house belongs to one of them,
 * and a free-text name that almost matches an existing village is a record
 * that will not group with its neighbours.
 *
 * Each carries its หมู่ and its district, because two villages can share a
 * name and be nowhere near each other.
 */
const VILLAGE_OPTIONS = sampleVillages.map((v) => ({
  value: v.name,
  detail: `${v.mooLabel} · ${v.district}`,
}));

/** The location card's own geometry — Figma 102:15915 and 289:12519. */
const LOCATION = {
  /**
   * Before a place is picked — Figma 289:12585.
   *
   * The card is 100 tall and both pictures are far bigger than that; the
   * card's own clip is what makes them a corner of a picture rather than a
   * picture stuck on a card.
   */
  prompt: { height: 100, art: 176, artRight: -16, artTop: -41 },
  /** After: a still map of the spot, and the address under it. */
  preview: { height: 200, delta: 0.003 },
} as const;

/**
 * "เพิ่มบ้าน", step one — Figma 102:15915 / 289:12519.
 *
 * The house's own details and where it is. The flow's other two steps are
 * about the people in it, so this screen ends in "ถัดไป" rather than a save:
 * nothing is written until the last one.
 *
 * Everything typed here goes into the shared draft rather than local state.
 * The map sheet and the member sheets all write to the same object, and going
 * back a step has to find the answers still there.
 */
export function AddHouseScreen() {
  const { village } = useRoute<RouteProp<RootStackParamList, "AddHouse">>().params;
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const draft = useHouseDraft();
  const { regular } = useLayout();

  // A fresh draft whenever the flow is entered for a village — including
  // entering it again after finishing, which would otherwise reopen the form
  // with the last house still in it.
  useEffect(() => {
    if (draft.village?.id !== village.id) beginHouseDraft(village);
  }, [village, draft.village]);

  const first = village.houses[0];
  const start = {
    latitude: draft.lat ?? first?.lat ?? FALLBACK_HERE.latitude,
    longitude: draft.lng ?? first?.lng ?? FALLBACK_HERE.longitude,
  };
  const located = draft.lat != null && draft.place.province.length > 0;
  const ready = houseStepDone(draft);

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <ScreenHeader title={tr("เพิ่มบ้าน", "Add house")} />

      {/* The list dissolves into the header rather than being cut off at
          its lower edge — the header is in flow here, so the ramp is
          measured from the top of the scrolling area, not the screen. */}
      <HeaderFade from={0} to={HEADER_FADE}>
      {/* The keyboard insets the list; it does not move the screen. A
          KeyboardAvoidingView here would resize the page on top of the inset
          UIScrollView already applies, and the two stack. */}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: GUTTER,
          // Clears the ramp: the dissolve runs over the first FADE points
          // of the scrolling area, so content resting inside it would always
          // be drawn part faded.
          paddingTop: HEADER_FADE,
          paddingBottom: insets.bottom + 120,
          gap: SPACE.lg,
          ...(regular ? readable(FORM_MAX) : null),
        }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Section title={tr("ข้อมูลบ้าน", "House details")}>
          <Card style={{ gap: SPACE.lg }}>
            <TextField
              label={tr("เลขทะเบียนบ้าน", "House registration no.")}
              required
              value={draft.registrationNo}
              onChangeText={(v) => patchHouseDraft({ registrationNo: v })}
              placeholder={tr("11 หลักตามหน้าทะเบียนบ้าน", "11 digits, as on the house registration")}
              keyboardType="number-pad"
              // Stopped at eleven rather than trimmed afterwards: a field
              // that quietly drops what was typed is worse than one that
              // will not take it.
              maxLength={REGISTRATION_DIGITS}
              error={registrationError(draft.registrationNo)}
            />
            <SelectField
              label={tr("หมู่บ้าน/โครงการ", "Village / project")}
              value={draft.project}
              options={VILLAGE_OPTIONS}
              onChange={(v) => patchHouseDraft({ project: v })}
              placeholder={tr("เลือกหมู่บ้านหรือโครงการ", "Choose a village or project")}
              searchable
            />
            <TextField
              label={tr("บ้านเลขที่", "House number")}
              required
              value={draft.number}
              onChangeText={(v) => patchHouseDraft({ number: v })}
              placeholder={tr("เช่น 12/3", "e.g. 12/3")}
            />
            <TextField
              label={tr("รายละเอียด", "Details")}
              value={draft.detail}
              onChangeText={(v) => patchHouseDraft({ detail: v })}
              placeholder={tr("ซอย ถนน จุดสังเกต", "Soi, road, landmark")}
            />
          </Card>
        </Section>

        <Section title={tr("ตำแหน่ง", "Location")} required>
          {located ? (
            <Card padded={false}>
              {/*
                A still map, not a live one: this is a picture of where the
                house is, and panning it here would only lose the spot that
                was just chosen. Tapping opens the sheet, where moving the map
                is the whole point.
              */}
              <Pressable
                onPress={() =>
                  nav.navigate("PickLocation", { initial: start })
                }
                accessibilityRole="button"
                accessibilityLabel={tr("แก้ไขตำแหน่ง", "Edit location")}
              >
                <MapPreview
                  at={start}
                  height={LOCATION.preview.height}
                  delta={LOCATION.preview.delta}
                />
                <View style={{ padding: SPACE.lg, gap: SPACE.sm }}>
                  <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>
                    {tr("ที่อยู่", "Address")}
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      lineHeight: 24,
                      fontWeight: "600",
                      color: TEXT_PRIMARY,
                    }}
                  >
                    {placeSummary(draft.place)}
                  </Text>
                </View>
              </Pressable>
            </Card>
          ) : (
            <Card padded={false} style={{ height: LOCATION.prompt.height }}>
              {/* The street texture the design lays behind the row, already
                  carrying its own fade: the design washes it out to the left
                  with a white gradient, which on a white card is the same as
                  fading it, and as alpha it does not depend on the ground. */}
              <Image
                source={require("../../assets/images/house_location_map.png")}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  right: 0,
                  height: LOCATION.prompt.height,
                }}
                resizeMode="cover"
                accessibilityRole="none"
              />

              {/* Hanging past the card's trailing edge and its top, so the
                  clip trims it to a corner of the mark. */}
              <Image
                source={require("../../assets/images/house_location.png")}
                style={{
                  position: "absolute",
                  right: LOCATION.prompt.artRight,
                  top: LOCATION.prompt.artTop,
                  width: LOCATION.prompt.art,
                  height: LOCATION.prompt.art,
                }}
                resizeMode="contain"
                accessibilityRole="none"
              />

              <Pressable
                onPress={() => nav.navigate("PickLocation", { initial: start })}
                accessibilityRole="button"
                accessibilityLabel={tr("เพิ่มตำแหน่งที่อยู่", "Add location")}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACE.md,
                  paddingHorizontal: SPACE.lg,
                }}
              >
                <GlassIconButton size={48} accessibilityLabel={tr("แผนที่", "Map")}>
                  <UIcon name="map" size={20} color={PRIMARY_500} />
                </GlassIconButton>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      lineHeight: 21,
                      fontWeight: "600",
                      color: TEXT_PRIMARY,
                    }}
                  >
                    {tr("เพิ่มตำแหน่งที่อยู่", "Add location")}
                  </Text>
                  <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>
                    {tr("แตะเพื่อเปิดแผนที่", "Tap to open the map")}
                  </Text>
                </View>
              </Pressable>
            </Card>
          )}
        </Section>
      </ScrollView>
      </HeaderFade>

      <ActionBar>
        <PrimaryAction
          label={tr("ถัดไป", "Next")}
          disabled={!ready}
          onPress={() => nav.navigate("AddHouseMembers")}
        />
      </ActionBar>
    </View>
  );
}

/** A heading over one block of the form. */
function Section({
  title,
  required,
  children,
}: {
  title: string;
  /** For a block whose answer is not a field to star — the map row. */
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: SPACE.sm }}>
      <Text
        style={{
          paddingHorizontal: SPACE.xs,
          fontSize: 16,
          lineHeight: 21,
          fontWeight: "600",
          color: TEXT_PRIMARY,
        }}
      >
        {title}
        {required === true && <Text style={{ color: DANGER }}> *</Text>}
      </Text>
      {children}
    </View>
  );
}
