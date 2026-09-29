import { Pressable, ScrollView, Text, View } from "react-native";
import { MapPin as MapPinGlyph } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { Chevron } from "../components/Chevron";
import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { Card } from "../components/Card";
import { MapPreview } from "../components/MapPreview";
import { Avatar } from "../components/Avatar";
import { Glass } from "../components/Glass";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { UIcon } from "../components/UIcon";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import { addHouse, genderLabel } from "../models/household";
import { ageFrom, useHouseDraft, type DraftMember } from "../models/houseDraft";
import { placeSummary } from "../models/place";
import {
  CANVAS,
  PRIMARY_500,
  SEPARATOR,
  SPACE,
  TEXT_DISABLED,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";
import { FORM_MAX, readable, useLayout, GUTTER } from "../theme/layout";
import { tr } from "../i18n";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** The map, small: this is a picture of the answer, not somewhere to look. */
const MAP = { height: 160, delta: 0.003 } as const;

/**
 * The last step: everything collected, before any of it is written.
 *
 * Three screens contribute to one house and none of them shows the others, so
 * without this the first time the whole record is visible is after it has
 * been saved. Each block says which step it came from and goes back to it, so
 * a wrong digit is a tap away rather than a house to delete and redo.
 */
export function AddHouseSummaryScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const draft = useHouseDraft();
  const { regular } = useLayout();

  const village = draft.village;

  const save = () => {
    if (village == null) {
      toast(tr("บันทึกไม่ได้ ไม่พบหมู่บ้าน", "Couldn't save: village not found"), "error");
      return;
    }
    const house = addHouse(village, {
      registrationNo: draft.registrationNo.trim(),
      number: draft.number.trim(),
      addressDetail: [draft.project.trim(), draft.detail.trim()]
        .filter(Boolean)
        .join(" "),
      subdistrict: draft.place.subdistrict,
      district: draft.place.district,
      province: draft.place.province,
      postalCode: draft.place.postalCode,
      lat: draft.lat ?? 0,
      lng: draft.lng ?? 0,
      residents: draft.members.map((m) => ({
        name: `${m.title}${m.name}`.trim(),
        age: ageFrom(m.birthDate) ?? 0,
        gender: m.gender,
        phone: "",
      })),
    });
    toast(
      draft.members.length > 0
        ? tr(
            `บันทึก ${house.number} พร้อมสมาชิก ${draft.members.length} คนแล้ว`,
            `Saved ${house.number} with ${draft.members.length} ${draft.members.length === 1 ? "member" : "members"}`,
          )
        : tr(`บันทึก ${house.number} แล้ว`, `Saved ${house.number}`),
      "success",
    );
    // All the way out of the flow, back to the village's list of houses.
    nav.popTo("HouseList", { village });
  };

  const at =
    draft.lat != null && draft.lng != null
      ? { latitude: draft.lat, longitude: draft.lng }
      : null;

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <ScreenHeader title={tr("ตรวจสอบข้อมูล", "Review")} />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: GUTTER,
            // Clears the ramp — see the note on the same padding in the house
            // form.
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + 120,
            gap: SPACE.lg,
            ...(regular ? readable(FORM_MAX) : null),
          }}
        >
          {/* The record gets a face before it gets a list of fields: this is
              one house, and the number on the gate is what a carer calls it
              by. */}
          <Card style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
            <Glass
              tintColor="rgba(7,125,215,0.95)"
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <UIcon name="houseChimneyHeart" size={24} color="#FFFFFF" />
            </Glass>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{ fontSize: 20, lineHeight: 26, fontWeight: "800", color: TEXT_PRIMARY }}
              >
                {draft.number.trim().length > 0 ? draft.number : tr("บ้านใหม่", "New house")}
              </Text>
              <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 14, color: TEXT_MUTED }}>
                {[draft.project, village?.mooLabel].filter(Boolean).join(" · ")}
              </Text>
            </View>
          </Card>

          <Section
            title={tr("ข้อมูลบ้าน", "House details")}
            onEdit={() =>
              village != null && nav.popTo("AddHouse", { village })
            }
          >
            <Card style={{ gap: SPACE.lg }}>
              <Line
                label={tr("เลขทะเบียนบ้าน", "House registration no.")}
                value={draft.registrationNo}
              />
              <Line label={tr("หมู่บ้าน / โครงการ", "Village / project")} value={draft.project} />
              <Line label={tr("บ้านเลขที่", "House number")} value={draft.number} />
              {draft.detail.trim().length > 0 && (
                <Line label={tr("รายละเอียด", "Details")} value={draft.detail} />
              )}
            </Card>
          </Section>

          <Section
            title={tr("ตำแหน่ง", "Location")}
            onEdit={() =>
              village != null && nav.popTo("AddHouse", { village })
            }
          >
            <Card padded={false}>
              {at != null && (
                <MapPreview at={at} height={MAP.height} delta={MAP.delta} />
              )}
              {/* On the map's own foot, over a fade — the address and the
                  place it names read as one thing rather than a picture with
                  a caption bolted under it. */}
              <View style={{ padding: SPACE.lg, gap: SPACE.sm, flexDirection: "row" }}>
                <MapPinGlyph size={18} color={PRIMARY_500} />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 16,
                    lineHeight: 22,
                    fontWeight: "600",
                    color: TEXT_PRIMARY,
                  }}
                >
                  {placeSummary(draft.place)}
                </Text>
              </View>
            </Card>
          </Section>

          <Section
            title={tr(
              `สมาชิกในบ้าน (${draft.members.length})`,
              `Household members (${draft.members.length})`,
            )}
            onEdit={() => nav.goBack()}
          >
            <Card>
              {draft.members.length === 0 ? (
                <Text style={{ fontSize: 14, color: TEXT_DISABLED }}>
                  {tr(
                    "ยังไม่ได้เพิ่มสมาชิก — เพิ่มทีหลังได้จากหน้าบ้านหลังนี้",
                    "No members yet. You can add them later from this house's page.",
                  )}
                </Text>
              ) : (
                draft.members.map((m, i) => (
                  <MemberLine key={`${m.idCard}-${i}`} member={m} first={i === 0} />
                ))
              )}
            </Card>
          </Section>
        </ScrollView>
      </HeaderFade>

      <ActionBar>
        <PrimaryAction label={tr("บันทึกข้อมูล", "Save")} onPress={save} />
      </ActionBar>
    </View>
  );
}

/** A titled block with a way back to the step that filled it in. */
function Section({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: SPACE.sm }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: SPACE.xs,
        }}
      >
        <Text
          style={{
            flex: 1,
            fontSize: 16,
            lineHeight: 21,
            fontWeight: "600",
            color: TEXT_PRIMARY,
          }}
        >
          {title}
        </Text>
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={tr(`แก้ไข${title}`, `Edit ${title}`)}
          hitSlop={8}
          style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
        >
          <Text style={{ fontSize: 14, fontWeight: "500", color: PRIMARY_500 }}>
            {tr("แก้ไข", "Edit")}
          </Text>
          <Chevron ink={PRIMARY_500} />
        </Pressable>
      </View>
      {children}
    </View>
  );
}

/**
 * One answer: what was asked, over what was given.
 *
 * Stacked rather than set in two columns. A Thai address or a project name
 * does not fit beside its own label, and the right-aligned column it used to
 * sit in wrapped every long answer into a ragged block against the card's
 * edge.
 */
function Line({ label, value }: { label: string; value: string }) {
  const given = value.trim().length > 0;
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontSize: 12, lineHeight: 16, color: TEXT_MUTED }}>{label}</Text>
      <Text
        style={{
          fontSize: 16,
          lineHeight: 22,
          fontWeight: given ? "600" : "400",
          color: given ? TEXT_PRIMARY : TEXT_DISABLED,
        }}
      >
        {given ? value : tr("ไม่ได้ระบุ", "Not specified")}
      </Text>
    </View>
  );
}

/** One member, on the row the house record uses for its own household. */
function MemberLine({ member, first }: { member: DraftMember; first: boolean }) {
  const age = ageFrom(member.birthDate);
  const meta = [
    age != null && tr(`${age} ปี`, `${age} yrs`),
    member.gender && genderLabel(member.gender),
    member.bloodType && tr(`กรุ๊ป ${member.bloodType}`, `Blood type ${member.bloodType}`),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.md,
        paddingTop: first ? 0 : SPACE.md,
        marginTop: first ? 0 : SPACE.md,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: SEPARATOR,
      }}
    >
      <Avatar size={40} initial={member.name.trim()[0] ?? "?"} photo={member.photo} />

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 14, fontWeight: "600", color: TEXT_PRIMARY }}
        >
          {`${member.title}${member.name}`.trim()}
        </Text>
        {meta.length > 0 && (
          <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 12, color: TEXT_MUTED }}>
            {meta}
          </Text>
        )}
      </View>
    </View>
  );
}
