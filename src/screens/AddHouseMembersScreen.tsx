import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Plus } from "lucide-react-native";

import {
  ActionBar,
  PrimaryAction,
  SecondaryAction,
} from "../components/ActionBar";
import { Chevron } from "../components/Chevron";
import { Card } from "../components/Card";
import { Avatar } from "../components/Avatar";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { GlassIconButton } from "../components/GlassIconButton";
import { ScreenHeader } from "../components/ScreenHeader";
import type { RootStackParamList } from "../navigation/RootStack";
import { ageFrom, useHouseDraft, type DraftMember } from "../models/houseDraft";
import {
  CANVAS,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  SURFACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  WASH_SOFT,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * "เพิ่มสมาชิกในบ้าน", the flow's second step — Figma 289:12640 and 291:32985.
 *
 * One screen with two faces. Empty, it is an invitation with a way past it:
 * the house is worth saving without anyone in it, and a form that insisted
 * otherwise would be wrong about how this work happens — the house is
 * surveyed first and the household recorded on a later visit.
 *
 * With members, it becomes the list, headed by the row that adds the next one.
 */
export function AddHouseMembersScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const draft = useHouseDraft();

  // Nothing is written here: the flow ends on a summary, and that is where
  // the house is saved. Skipping the members is skipping a step, not
  // finishing early.
  const next = () => nav.navigate("AddHouseSummary");

  const empty = draft.members.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <ScreenHeader title="เพิ่มบ้าน" />

      {empty ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: SPACE.lg,
            paddingBottom: 140,
          }}
        >
          <Image
            source={require("../../assets/images/house_family.png")}
            style={{ width: 276, height: 276 }}
            resizeMode="contain"
            accessibilityRole="none"
          />
          <Text
            style={{
              marginTop: SPACE.lg,
              fontSize: 16,
              lineHeight: 21,
              fontWeight: "600",
              color: TEXT_PRIMARY,
            }}
          >
            เพิ่มสมาชิกในบ้าน
          </Text>
          <Text
            style={{
              marginTop: SPACE.xs,
              fontSize: 14,
              lineHeight: 20,
              color: TEXT_MUTED,
              textAlign: "center",
            }}
          >
            บันทึกผู้อยู่อาศัยตอนนี้ หรือกลับมาเพิ่มทีหลังก็ได้
          </Text>
        </View>
      ) : (
        <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: SPACE.lg,
            // Clears the ramp — see the note on the same padding in the
            // house form.
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + 120,
            gap: SPACE.sm,
          }}
        >
          <Text
            style={{
              paddingHorizontal: SPACE.xs,
              fontSize: 16,
              lineHeight: 21,
              fontWeight: "600",
              color: TEXT_PRIMARY,
            }}
          >
            เพิ่มสมาชิกในบ้าน
          </Text>

          {/* Padded, with the rows flush inside it: the design's rows run the
              full inner width and are spaced by 16, not by their own padding
              against a card edge. */}
          <Card style={{ gap: ROW.gap }}>
            <AddRow onPress={() => nav.navigate("AddMember")} />
            {draft.members.map((m, i) => (
              <MemberRow
                key={`${m.idCard}-${i}`}
                member={m}
                first={i === 0}
                onPress={() => nav.navigate("AddMember", { at: i })}
              />
            ))}
          </Card>
        </ScrollView>
        </HeaderFade>
      )}

      <ActionBar>
        {empty ? (
          <>
            <PrimaryAction label="เพิ่มเลย" onPress={() => nav.navigate("AddMember")} />
            <SecondaryAction label="ข้ามก่อน" onPress={next} />
          </>
        ) : (
          <PrimaryAction label="ถัดไป" onPress={next} />
        )}
      </ActionBar>
    </View>
  );
}

/** The rows' own measurements — Figma 291:33026. */
const ROW = {
  /** Between blocks, and above and below each rule. */
  gap: SPACE.lg,
  add: { height: 100, art: 101, artRight: 10, artTop: 6 },
  member: { height: 42, avatar: 36 },
} as const;

/** The row that heads the list — Figma 291:33026's `Frame 19`. */
function AddRow({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="เพิ่มสมาชิก"
      style={{
        height: ROW.add.height,
        borderRadius: RADIUS.card,
        overflow: "hidden",
        backgroundColor: SURFACE,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: SPACE.lg,
      }}
    >
      {/* The pale blue wash the design lays on this row — in daylight, white
          with `#88CFFF` to `#ADD9FF` at a fifth over it, left to right. It is
          what marks the row out inside a card of the same colour, and the same
          treatment the ID reader carries on the next screen. */}
      <LinearGradient
        colors={[WASH_SOFT[0], WASH_SOFT[1]]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <GlassIconButton size={48} accessibilityLabel="เพิ่ม">
        <Plus size={22} color={PRIMARY_500} strokeWidth={2.4} />
      </GlassIconButton>
      <View style={{ flex: 1, minWidth: 0 }}>
        {/* The pair the location card and the ID reader carry: 16/600 over
            14/400. The design draws this one at 14 over 10, and 10 in this
            app is the badge size, never a line of text — three cards of the
            same shape reading at three sizes is the thing you notice, not
            the two points. */}
        <Text style={{ fontSize: 16, lineHeight: 21, fontWeight: "600", color: TEXT_PRIMARY }}>
          เพิ่มสมาชิก
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>
          ถ่ายภาพบัตรประชาชน
        </Text>
      </View>
      <Image
        source={require("../../assets/images/house_family.png")}
        style={{
          position: "absolute",
          right: ROW.add.artRight,
          top: ROW.add.artTop,
          width: ROW.add.art,
          height: ROW.add.art,
        }}
        resizeMode="contain"
        accessibilityRole="none"
      />
    </Pressable>
  );
}

/**
 * One person already added.
 *
 * The row the house record uses for its own household — same avatar, same
 * two lines, same rule between them. A carer adding a house and a carer
 * reading one back are looking at the same list, so it is drawn once and the
 * same way in both places.
 */
function MemberRow({
  member,
  first,
  onPress,
}: {
  member: DraftMember;
  first: boolean;
  onPress: () => void;
}) {
  const age = ageFrom(member.birthDate);
  const initial = member.name.trim()[0] ?? "?";
  const meta = [
    age != null && `${age} ปี`,
    member.gender,
    member.bloodType && `กรุ๊ป ${member.bloodType}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    // A plain Pressable, not PressableScale: that one animates a transform,
    // and a transformed ancestor stops the glass avatar drawing its material.
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`แก้ไข ${`${member.title}${member.name}`.trim()}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.md,
        paddingVertical: SPACE.md,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: SEPARATOR,
      }}
    >
      <Avatar size={40} initial={initial} photo={member.photo} />

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

      <Chevron />
    </Pressable>
  );
}
