import { useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { Check, ScanLine, X } from "lucide-react-native";

import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { Card } from "../components/Card";
import { Avatar } from "../components/Avatar";
import { UIcon } from "../components/UIcon";
import { Glass } from "../components/Glass";
import { GlassIconButton } from "../components/GlassIconButton";
import { DateField, SelectField, TextField } from "../components/FormField";
import { PressableScale } from "../components/PressableScale";
import { toast } from "../components/Toast";
import { setIdScanHandler } from "../models/idScan";
import type { RootStackParamList } from "../navigation/RootStack";
import { addResident } from "../models/household";
import {
  addDraftMember,
  ageFrom,
  removeDraftMember,
  updateDraftMember,
  useHouseDraft,
  citizenIdError,
  CITIZEN_ID_DIGITS,
  blankMember,
  memberReady,
  type DraftMember,
} from "../models/houseDraft";
import {
  CANVAS,
  DANGER,
  PRIMARY_500,
  SURFACE,
  RADIUS,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";

/** The ID reader's own geometry — Figma 291:31337. */
const ID_CARD = { height: 100, artWidth: 118, artHeight: 88, artTop: 23 } as const;

/** The answers each list offers — Figma 291:31045. */
const TITLES = ["นาย", "นาง", "นางสาว", "เด็กชาย", "เด็กหญิง"] as const;
const GENDERS = ["ชาย", "หญิง"] as const;
const BLOOD = ["A", "B", "AB", "O", "ไม่ทราบ"] as const;
const RELIGIONS = ["พุทธ", "อิสลาม", "คริสต์", "ฮินดู", "ซิกข์", "ไม่ระบุ"] as const;
const ETHNICITIES = ["ไทย", "จีน", "ลาว", "เขมร", "มอญ", "อื่นๆ"] as const;
const NATIONALITIES = ["ไทย", "ลาว", "เมียนมา", "กัมพูชา", "อื่นๆ"] as const;
const MARITAL = ["โสด", "สมรส", "หม้าย", "หย่าร้าง", "แยกกันอยู่"] as const;
const EDUCATION = [
  "ไม่ได้เรียน",
  "ประถมศึกษา",
  "มัธยมศึกษาตอนต้น",
  "มัธยมศึกษาตอนปลาย / ปวช.",
  "อนุปริญญา / ปวส.",
  "ปริญญาตรี",
  "สูงกว่าปริญญาตรี",
] as const;
const OCCUPATIONS = [
  "ไม่ได้ประกอบอาชีพ",
  "เกษตรกร",
  "รับจ้างทั่วไป",
  "ค้าขาย",
  "พนักงานบริษัท",
  "รับราชการ / รัฐวิสาหกิจ",
  "นักเรียน / นักศึกษา",
  "อื่นๆ",
] as const;

/**
 * "เพิ่มสมาชิกในบ้าน" — one person's record — Figma 291:31045.
 *
 * A sheet over the list rather than another step: a member is added to the
 * house being built, and the flow's own progress does not move while it is
 * open. Confirming is the tick in the corner, as the design draws it.
 *
 * The card at the top offers to read a Thai ID. That is a camera and an OCR
 * model neither of which this app has yet, so it says so rather than
 * pretending: the fields underneath are what fills the record today, and the
 * card is where the scanner will land when there is one.
 */
export function AddMemberScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const params = useRoute<RouteProp<RootStackParamList, "AddMember">>().params;
  const at = params?.at;
  const house = params?.house;
  const draft = useHouseDraft();
  const editing = at != null;

  // Seeded once from the row being edited. Held locally rather than written
  // through on every keystroke, so backing out of the sheet leaves the
  // member as it was.
  const [m, setM] = useState<DraftMember>(
    () => (at != null ? draft.members[at] : undefined) ?? blankMember(),
  );

  const set = (part: Partial<DraftMember>) => setM((was) => ({ ...was, ...part }));
  const ready = memberReady(m);

  /**
   * Photograph the card and fill in what can be read off it.
   *
   * Only the blanks: anything already typed is left alone, so a scan after a
   * correction cannot undo the correction. Whatever the card did not give up
   * — a name obscured, a date out of focus — stays empty for the carer, which
   * is the normal case rather than a failure.
   */
  const scanCard = () => {
    setIdScanHandler((found) => {
      const fill: Partial<DraftMember> = {};
      for (const [key, value] of Object.entries(found)) {
        const field = key as keyof DraftMember;
        if (typeof value === "string" && value.length > 0 && m[field].length === 0) {
          fill[field] = value;
        }
      }
      const filled = Object.keys(fill).length;
      if (filled === 0) {
        toast("ข้อมูลจากบัตรมีอยู่แล้วทุกช่อง");
        return;
      }
      set(fill);
      toast(`เติมข้อมูลให้ ${filled} ช่อง ที่เหลือกรอกเองได้`);
    });
    nav.navigate("ScanId" as never);
  };

  const add = () => {
    if (house != null) {
      // Straight onto the house's own household — this form was opened from
      // a record that already exists, not from the add-house flow.
      addResident(house, {
        name: `${m.title}${m.name}`.trim(),
        age: ageFrom(m.birthDate) ?? 0,
        gender: m.gender,
        phone: "",
        bloodType: m.bloodType,
        photo: m.photo,
      });
      toast(`เพิ่ม ${`${m.title}${m.name}`.trim()} เข้าบ้านแล้ว`);
    } else if (at != null) {
      updateDraftMember(at, m);
    } else {
      addDraftMember(m);
    }
    nav.goBack();
  };

  /**
   * A photograph for the record — taken now or chosen from the library.
   *
   * Both, because both happen: a carer standing in front of somebody takes
   * one, and a carer writing up a visit afterwards has one already. Square
   * and cropped on the way in, since every place it is shown is a circle.
   */
  const hasPhoto = m.photo.length > 0;

  const pickPhoto = () => {
    const shoot = async (fromCamera: boolean) => {
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toast(fromCamera ? "ต้องอนุญาตให้ใช้กล้องก่อน" : "ต้องอนุญาตให้เข้าคลังภาพก่อน");
        return;
      }
      const options: ImagePicker.ImagePickerOptions = {
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      };
      const shot = fromCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (!shot.canceled) set({ photo: shot.assets[0].uri });
    };

    Alert.alert("ภาพประจำตัว", undefined, [
      { text: "ถ่ายภาพ", onPress: () => void shoot(true) },
      { text: "เลือกจากคลังภาพ", onPress: () => void shoot(false) },
      { text: "ยกเลิก", style: "cancel" as const },
    ]);
  };

  const remove = () => {
    if (at == null) return;
    Alert.alert(
      "ลบสมาชิก",
      `ลบ ${`${m.title}${m.name}`.trim() || "สมาชิกคนนี้"} ออกจากบ้านหลังนี้`,
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ลบ",
          style: "destructive",
          onPress: () => {
            removeDraftMember(at);
            nav.goBack();
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
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
        <GlassIconButton onPress={() => nav.goBack()} accessibilityLabel="ปิด">
          <X size={22} color="#1A1A1A" strokeWidth={2.6} />
        </GlassIconButton>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 16,
            fontWeight: "600",
            color: TEXT_PRIMARY,
          }}
        >
          {editing ? "แก้ไขสมาชิก" : "เพิ่มสมาชิกในบ้าน"}
        </Text>
        <PressableScale
          onPress={ready ? add : undefined}
          accessibilityRole="button"
          accessibilityLabel="บันทึกสมาชิก"
          accessibilityState={{ disabled: !ready }}
          style={{
            width: 44,
            height: 44,
            borderRadius: RADIUS.capsule,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: ready ? PRIMARY_500 : "#C7CDD4",
          }}
        >
          <Check size={22} color="#FFFFFF" strokeWidth={2.6} />
        </PressableScale>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: SPACE.lg,
          // Clears the floating bar below.
          paddingBottom: insets.bottom + 120,
          gap: SPACE.lg,
        }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={{ alignItems: "center", paddingVertical: SPACE.sm }}>
          <View>
            {/* The accept-task hero's avatar, to the point: 80 on Apple's
                glass at the same tint. One person should not be a different
                size on the screen that records them than on the screen that
                hands them over. */}
            <Avatar size={80} initial={m.name.trim()[0] ?? "?"} photo={hasPhoto ? m.photo : undefined} />

            {/* The badge says what the tap does: a plus while there is no
                photograph, a minus once there is one. */}
            <Pressable
              onPress={hasPhoto ? () => set({ photo: "" }) : pickPhoto}
              accessibilityRole="button"
              accessibilityLabel={hasPhoto ? "ลบภาพประจำตัว" : "เพิ่มภาพประจำตัว"}
              hitSlop={8}
              style={{
                position: "absolute",
                right: 0,
                bottom: 0,
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: "#FFFFFF",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <UIcon
                name={hasPhoto ? "minusSmall" : "plusSmall"}
                size={16}
                color={hasPhoto ? DANGER : PRIMARY_500}
              />
            </Pressable>
          </View>
        </View>

        <Card style={{ gap: SPACE.lg }}>
          <IdReader onPress={scanCard} />
          <TextField
            label="เลขบัตรประชาชน"
            required
            value={m.idCard}
            onChangeText={(v) => set({ idCard: v })}
            placeholder="13 หลัก"
            // Stopped at thirteen rather than trimmed afterwards: a field
            // that quietly drops what was typed is worse than one that will
            // not take it.
            maxLength={CITIZEN_ID_DIGITS}
            error={citizenIdError(m.idCard)}
            keyboardType="number-pad"
          />
          <SelectField
            label="คำนำหน้า"
            placeholder="เลือกคำนำหน้า"
            value={m.title}
            options={TITLES}
            onChange={(v) => set({ title: v })}
          />
          <TextField
            label="ชื่อ-นามสกุล"
            required
            value={m.name}
            onChangeText={(v) => set({ name: v })}
            placeholder="เช่น สมศรี ใจดี"
          />
          <DateField
            label="วันเกิด"
            required
            value={m.birthDate}
            onChange={(v) => set({ birthDate: v })}
          />
          <View style={{ flexDirection: "row", gap: SPACE.md }}>
            <View style={{ flex: 1 }}>
              <SelectField
                label="เพศ"
                placeholder="เลือกเพศ"
                value={m.gender}
                options={GENDERS}
                onChange={(v) => set({ gender: v })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <SelectField
                label="หมู่เลือด"
                placeholder="เลือกหมู่เลือด"
                value={m.bloodType}
                options={BLOOD}
                onChange={(v) => set({ bloodType: v })}
              />
            </View>
          </View>
          <SelectField
            label="ศาสนา"
            placeholder="เลือกศาสนา"
            value={m.religion}
            options={RELIGIONS}
            onChange={(v) => set({ religion: v })}
          />
          <View style={{ flexDirection: "row", gap: SPACE.md }}>
            <View style={{ flex: 1 }}>
              <SelectField
                label="เชื้อชาติ"
                placeholder="เลือกเชื้อชาติ"
                value={m.ethnicity}
                options={ETHNICITIES}
                onChange={(v) => set({ ethnicity: v })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <SelectField
                label="สัญชาติ"
                placeholder="เลือกสัญชาติ"
                value={m.nationality}
                options={NATIONALITIES}
                onChange={(v) => set({ nationality: v })}
              />
            </View>
          </View>
        </Card>

        <Card style={{ gap: SPACE.lg }}>
          <SelectField
            label="สถานะภาพ"
            placeholder="เลือกสถานะภาพ"
            value={m.maritalStatus}
            options={MARITAL}
            onChange={(v) => set({ maritalStatus: v })}
          />
          <SelectField
            label="การศึกษา"
            placeholder="เลือกระดับการศึกษา"
            value={m.education}
            options={EDUCATION}
            onChange={(v) => set({ education: v })}
          />
          <SelectField
            label="อาชีพ"
            placeholder="เลือกอาชีพ"
            value={m.occupation}
            options={OCCUPATIONS}
            onChange={(v) => set({ occupation: v })}
          />
        </Card>

        {!ready && (
          <Text style={{ fontSize: 12, color: TEXT_MUTED, textAlign: "center" }}>
            ต้องมีเลขบัตรประชาชน ชื่อ-นามสกุล และวันเกิด
          </Text>
        )}

        {editing && (
          <PressableScale
            onPress={remove}
            accessibilityRole="button"
            accessibilityLabel="ลบสมาชิกคนนี้"
            style={{
              height: 48,
              borderRadius: RADIUS.capsule,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#FFEDED",
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: DANGER }}>
              ลบสมาชิกคนนี้
            </Text>
          </PressableScale>
        )}
      </ScrollView>

      <ActionBar>
        <PrimaryAction
          label={editing ? "บันทึกการแก้ไข" : "บันทึกสมาชิก"}
          disabled={!ready}
          onPress={add}
        />
      </ActionBar>
    </View>
  );
}

/**
 * The ID reader — Figma 291:31337, inside the record's own card (291:31245).
 *
 * Not a card of its own above the fields: it belongs to the first of them.
 * It is the other way of filling in the ID number, and standing it apart made
 * it read as a separate offer that happened to be nearby.
 *
 * Left to right: a glass button carrying the scan mark, the two lines, then
 * the card artwork flush to the trailing edge. The pale blue wash at a fifth
 * is what keeps the artwork from sitting on bare white with nothing tying it
 * to the row — and what marks the block out inside a card of the same colour.
 *
 * Tapping it opens the camera, runs Vision over the photograph and fills in
 * what it could read. See `scanCard` for what happens to the answers, and
 * `models/idCard` for how a card's lines become fields.
 */
function IdReader({ onPress }: { onPress: () => void }) {
  return (
    <View
      style={{
        height: ID_CARD.height,
        borderRadius: RADIUS.card,
        overflow: "hidden",
        backgroundColor: SURFACE,
      }}
    >
      <LinearGradient
        colors={["rgba(136,207,255,0.2)", "rgba(173,217,255,0.2)"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <Image
        source={require("../../assets/images/id_card.png")}
        style={{
          position: "absolute",
          right: 0,
          top: ID_CARD.artTop,
          width: ID_CARD.artWidth,
          height: ID_CARD.artHeight,
        }}
        // The artwork's own aspect is within a percent of the slot's, so
        // nothing is cropped either way — `contain` keeps it that way if the
        // picture is ever replaced with one that is not.
        resizeMode="contain"
        accessibilityRole="none"
      />

      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="อ่านข้อมูลจากบัตร"
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.md,
          paddingHorizontal: SPACE.lg,
          // Clear of the artwork, so a long line never runs under it.
          paddingRight: ID_CARD.artWidth,
        }}
      >
        <GlassIconButton size={48} accessibilityLabel="สแกน">
          <ScanLine size={22} color="#0088FF" />
        </GlassIconButton>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            // The size the location card uses, which is the app's menu-row
            // pair: 16/600 over 14/400. The design draws this one at 14 over
            // 10, and 10 in this app is the badge size, never a line of text
            // — three cards of the same shape reading at three sizes is the
            // thing you notice, not the two points.
            style={{ fontSize: 16, lineHeight: 21, fontWeight: "600", color: "#111111" }}
          >
            อ่านข้อมูลจากบัตร
          </Text>
          <Text
            numberOfLines={1}
            style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}
          >
            ถ่ายภาพบัตรประชาชน
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
