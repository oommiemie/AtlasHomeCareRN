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
  DANGER_BG,
  FILL_SUBTLE,
  PRIMARY_500,
  RADIUS,
  SPACE,
  SURFACE,
  TEXT_DISABLED,
  TEXT_MUTED,
  TEXT_PRIMARY,
  WASH_SOFT,
} from "../theme/tokens";
import { FORM_MAX, readable, useLayout, GUTTER } from "../theme/layout";
import { isEn, tr } from "../i18n";

/** The ID reader's own geometry — Figma 291:31337. */
const ID_CARD = { height: 100, artWidth: 118, artHeight: 88, artTop: 23 } as const;

/**
 * A list whose answer is kept in Thai and shown in the app's language.
 *
 * The record holds the Thai: a title is the front of a Thai name and is
 * what `givenName` cuts off, the sex is the word the scores test for, and
 * the card reader hands back Thai for both. So the field shows the English
 * and hands the Thai back on a pick.
 */
function choice(pairs: readonly (readonly [string, string])[]) {
  return {
    options: pairs.map(([th, en]) => tr(th, en)),
    shown: (v: string) => tr(v, pairs.find(([th]) => th === v)?.[1] ?? v),
    stored: (label: string) =>
      isEn ? (pairs.find(([, en]) => en === label)?.[0] ?? label) : label,
  };
}

/** The answers each list offers — Figma 291:31045. */
const TITLES = choice([
  ["นาย", "Mr."],
  ["นาง", "Mrs."],
  ["นางสาว", "Miss"],
  ["เด็กชาย", "Master (boy)"],
  ["เด็กหญิง", "Miss (girl)"],
]);
const GENDERS = choice([
  ["ชาย", "Male"],
  ["หญิง", "Female"],
]);
// Not kept in Thai: a blood group is only ever shown, never tested for.
const BLOOD = ["A", "B", "AB", "O", tr("ไม่ทราบ", "Unknown")] as const;
const RELIGIONS = choice([
  ["พุทธ", "Buddhism"],
  ["อิสลาม", "Islam"],
  ["คริสต์", "Christianity"],
  ["ฮินดู", "Hinduism"],
  ["ซิกข์", "Sikhism"],
  ["ไม่ระบุ", "Not specified"],
]);
const ETHNICITIES = choice([
  ["ไทย", "Thai"],
  ["จีน", "Chinese"],
  ["ลาว", "Lao"],
  ["เขมร", "Khmer"],
  ["มอญ", "Mon"],
  ["อื่นๆ", "Other"],
]);
const NATIONALITIES = choice([
  ["ไทย", "Thai"],
  ["ลาว", "Lao"],
  ["เมียนมา", "Myanmar"],
  ["กัมพูชา", "Cambodian"],
  ["อื่นๆ", "Other"],
]);
const MARITAL = choice([
  ["โสด", "Single"],
  ["สมรส", "Married"],
  ["หม้าย", "Widowed"],
  ["หย่าร้าง", "Divorced"],
  ["แยกกันอยู่", "Separated"],
]);
const EDUCATION = choice([
  ["ไม่ได้เรียน", "No formal education"],
  ["ประถมศึกษา", "Primary school"],
  ["มัธยมศึกษาตอนต้น", "Lower secondary"],
  ["มัธยมศึกษาตอนปลาย / ปวช.", "Upper secondary / vocational certificate"],
  ["อนุปริญญา / ปวส.", "Diploma / higher vocational certificate"],
  ["ปริญญาตรี", "Bachelor's degree"],
  ["สูงกว่าปริญญาตรี", "Postgraduate degree"],
]);
const OCCUPATIONS = choice([
  ["ไม่ได้ประกอบอาชีพ", "Not employed"],
  ["เกษตรกร", "Farmer"],
  ["รับจ้างทั่วไป", "General laborer"],
  ["ค้าขาย", "Trader"],
  ["พนักงานบริษัท", "Company employee"],
  ["รับราชการ / รัฐวิสาหกิจ", "Civil servant / state enterprise"],
  ["นักเรียน / นักศึกษา", "Student"],
  ["อื่นๆ", "Other"],
]);

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
  const { regular } = useLayout();

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
        toast(tr("ข้อมูลจากบัตรมีอยู่แล้วทุกช่อง", "Every field from the card is already filled"));
        return;
      }
      set(fill);
      toast(
        tr(
          `เติมข้อมูลให้ ${filled} ช่อง ที่เหลือกรอกเองได้`,
          `Filled ${filled} ${filled === 1 ? "field" : "fields"}. You can fill in the rest.`,
        ),
        "success",
      );
    });
    nav.navigate("ScanId" as never);
  };

  const add = () => {
    const who = `${m.title}${m.name}`.trim();
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
      toast(tr(`เพิ่ม ${who} เข้าบ้านแล้ว`, `Added ${who} to the household`), "success");
    } else if (at != null) {
      updateDraftMember(at, m);
      toast(tr(`แก้ไขข้อมูล ${who} แล้ว`, `Updated ${who}`), "success");
    } else {
      addDraftMember(m);
      toast(tr(`เพิ่ม ${who} แล้ว`, `Added ${who}`), "success");
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
        toast(
          fromCamera
            ? tr("ต้องอนุญาตให้ใช้กล้องก่อน", "Allow camera access first")
            : tr("ต้องอนุญาตให้เข้าคลังภาพก่อน", "Allow photo library access first"),
          "error",
        );
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
      if (!shot.canceled) {
        set({ photo: shot.assets[0].uri });
        toast(tr("เพิ่มภาพประจำตัวแล้ว", "Photo added"), "success");
      }
    };

    Alert.alert(tr("ภาพประจำตัว", "Photo"), undefined, [
      { text: tr("ถ่ายภาพ", "Take photo"), onPress: () => void shoot(true) },
      { text: tr("เลือกจากคลังภาพ", "Choose from library"), onPress: () => void shoot(false) },
      { text: tr("ยกเลิก", "Cancel"), style: "cancel" as const },
    ]);
  };

  const remove = () => {
    if (at == null) return;
    Alert.alert(
      tr("ลบสมาชิก", "Remove member"),
      tr(
        `ลบ ${`${m.title}${m.name}`.trim() || "สมาชิกคนนี้"} ออกจากบ้านหลังนี้`,
        `Remove ${`${m.title}${m.name}`.trim() || "this member"} from this house?`,
      ),
      [
        { text: tr("ยกเลิก", "Cancel"), style: "cancel" },
        {
          text: tr("ลบ", "Remove"),
          style: "destructive",
          onPress: () => {
            removeDraftMember(at);
            toast(
              tr(
                `ลบ ${`${m.title}${m.name}`.trim() || "สมาชิก"} ออกจากบ้านแล้ว`,
                `Removed ${`${m.title}${m.name}`.trim() || "member"} from the house`,
              ),
              "success",
            );
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
            fontSize: 16,
            fontWeight: "600",
            color: TEXT_PRIMARY,
          }}
        >
          {editing
            ? tr("แก้ไขสมาชิก", "Edit member")
            : tr("เพิ่มสมาชิกในบ้าน", "Add household member")}
        </Text>
        <PressableScale
          onPress={ready ? add : undefined}
          accessibilityRole="button"
          accessibilityLabel={tr("บันทึกสมาชิก", "Save member")}
          accessibilityState={{ disabled: !ready }}
          style={{
            width: 44,
            height: 44,
            borderRadius: RADIUS.capsule,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: ready ? PRIMARY_500 : FILL_SUBTLE,
          }}
        >
          {/* White on the blue; the page's own dim grey on the disabled
              disc, which on a dark ground a white tick would still read as
              live against. */}
          <Check
            size={22}
            color={ready ? "#FFFFFF" : TEXT_DISABLED}
            strokeWidth={2.6}
          />
        </PressableScale>
      </View>

      <ScrollView
        // Scrolls before the sheet drags, on Android: without it a pull down
        // over scrolled content moves the whole sheet, and closes it.
        nestedScrollEnabled
        contentContainerStyle={{
          paddingHorizontal: GUTTER,
          // Clears the floating bar below.
          paddingBottom: insets.bottom + 120,
          gap: SPACE.lg,
          ...(regular ? readable(FORM_MAX) : null),
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
              onPress={
                hasPhoto
                  ? () => {
                      set({ photo: "" });
                      toast(tr("ลบภาพประจำตัวแล้ว", "Photo removed"), "success");
                    }
                  : pickPhoto
              }
              accessibilityRole="button"
              accessibilityLabel={
                hasPhoto ? tr("ลบภาพประจำตัว", "Remove photo") : tr("เพิ่มภาพประจำตัว", "Add photo")
              }
              hitSlop={8}
              style={{
                position: "absolute",
                right: 0,
                bottom: 0,
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: SURFACE,
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
            label={tr("เลขบัตรประชาชน", "Citizen ID")}
            required
            value={m.idCard}
            onChangeText={(v) => set({ idCard: v })}
            placeholder={tr("13 หลัก", "13 digits")}
            // Stopped at thirteen rather than trimmed afterwards: a field
            // that quietly drops what was typed is worse than one that will
            // not take it.
            maxLength={CITIZEN_ID_DIGITS}
            error={citizenIdError(m.idCard)}
            keyboardType="number-pad"
          />
          <SelectField
            label={tr("คำนำหน้า", "Title")}
            placeholder={tr("เลือกคำนำหน้า", "Choose a title")}
            value={TITLES.shown(m.title)}
            options={TITLES.options}
            onChange={(v) => set({ title: TITLES.stored(v) })}
          />
          <TextField
            label={tr("ชื่อ-นามสกุล", "Full name")}
            required
            value={m.name}
            onChangeText={(v) => set({ name: v })}
            placeholder={tr("เช่น สมศรี ใจดี", "e.g. Somsri Jaidee")}
          />
          <DateField
            label={tr("วันเกิด", "Date of birth")}
            required
            value={m.birthDate}
            onChange={(v) => set({ birthDate: v })}
          />
          <View style={{ flexDirection: "row", gap: SPACE.md }}>
            <View style={{ flex: 1 }}>
              <SelectField
                label={tr("เพศ", "Sex")}
                placeholder={tr("เลือกเพศ", "Choose")}
                value={GENDERS.shown(m.gender)}
                options={GENDERS.options}
                onChange={(v) => set({ gender: GENDERS.stored(v) })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <SelectField
                label={tr("หมู่เลือด", "Blood type")}
                placeholder={tr("เลือกหมู่เลือด", "Choose")}
                value={m.bloodType}
                options={BLOOD}
                onChange={(v) => set({ bloodType: v })}
              />
            </View>
          </View>
          <SelectField
            label={tr("ศาสนา", "Religion")}
            placeholder={tr("เลือกศาสนา", "Choose a religion")}
            value={RELIGIONS.shown(m.religion)}
            options={RELIGIONS.options}
            onChange={(v) => set({ religion: RELIGIONS.stored(v) })}
          />
          <View style={{ flexDirection: "row", gap: SPACE.md }}>
            <View style={{ flex: 1 }}>
              <SelectField
                label={tr("เชื้อชาติ", "Ethnicity")}
                placeholder={tr("เลือกเชื้อชาติ", "Choose")}
                value={ETHNICITIES.shown(m.ethnicity)}
                options={ETHNICITIES.options}
                onChange={(v) => set({ ethnicity: ETHNICITIES.stored(v) })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <SelectField
                label={tr("สัญชาติ", "Nationality")}
                placeholder={tr("เลือกสัญชาติ", "Choose")}
                value={NATIONALITIES.shown(m.nationality)}
                options={NATIONALITIES.options}
                onChange={(v) => set({ nationality: NATIONALITIES.stored(v) })}
              />
            </View>
          </View>
        </Card>

        <Card style={{ gap: SPACE.lg }}>
          <SelectField
            label={tr("สถานะภาพ", "Marital status")}
            placeholder={tr("เลือกสถานะภาพ", "Choose marital status")}
            value={MARITAL.shown(m.maritalStatus)}
            options={MARITAL.options}
            onChange={(v) => set({ maritalStatus: MARITAL.stored(v) })}
          />
          <SelectField
            label={tr("การศึกษา", "Education")}
            placeholder={tr("เลือกระดับการศึกษา", "Choose education level")}
            value={EDUCATION.shown(m.education)}
            options={EDUCATION.options}
            onChange={(v) => set({ education: EDUCATION.stored(v) })}
          />
          <SelectField
            label={tr("อาชีพ", "Occupation")}
            placeholder={tr("เลือกอาชีพ", "Choose an occupation")}
            value={OCCUPATIONS.shown(m.occupation)}
            options={OCCUPATIONS.options}
            onChange={(v) => set({ occupation: OCCUPATIONS.stored(v) })}
          />
        </Card>

        {!ready && (
          <Text style={{ fontSize: 12, color: TEXT_MUTED, textAlign: "center" }}>
            {tr(
              "ต้องมีเลขบัตรประชาชน ชื่อ-นามสกุล และวันเกิด",
              "Citizen ID, full name and date of birth are required",
            )}
          </Text>
        )}

        {editing && (
          <PressableScale
            onPress={remove}
            accessibilityRole="button"
            accessibilityLabel={tr("ลบสมาชิกคนนี้", "Remove this member")}
            style={{
              height: 48,
              borderRadius: RADIUS.capsule,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: DANGER_BG,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: DANGER }}>
              {tr("ลบสมาชิกคนนี้", "Remove this member")}
            </Text>
          </PressableScale>
        )}
      </ScrollView>

      <ActionBar>
        <PrimaryAction
          label={editing ? tr("บันทึกการแก้ไข", "Save changes") : tr("บันทึกสมาชิก", "Save member")}
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
        colors={[WASH_SOFT[0], WASH_SOFT[1]]}
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
        accessibilityLabel={tr("อ่านข้อมูลจากบัตร", "Read from ID card")}
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
        <GlassIconButton size={48} accessibilityLabel={tr("สแกน", "Scan")}>
          <ScanLine size={22} color={PRIMARY_500} />
        </GlassIconButton>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            // The size the location card uses, which is the app's menu-row
            // pair: 16/600 over 14/400. The design draws this one at 14 over
            // 10, and 10 in this app is the badge size, never a line of text
            // — three cards of the same shape reading at three sizes is the
            // thing you notice, not the two points.
            style={{ fontSize: 16, lineHeight: 21, fontWeight: "600", color: TEXT_PRIMARY }}
          >
            {tr("อ่านข้อมูลจากบัตร", "Read from ID card")}
          </Text>
          <Text
            numberOfLines={1}
            style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}
          >
            {tr("ถ่ายภาพบัตรประชาชน", "Photograph the ID card")}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
