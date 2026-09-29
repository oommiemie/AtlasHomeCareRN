import { Pressable, Text, View } from "react-native";
import { Check } from "lucide-react-native";

import { Card } from "../components/Card";
import { SettingsGroup, SettingsScreen } from "../components/SettingsScreen";
import {
  languageChoice,
  setLanguage,
  systemLang,
  tr,
  type LangChoice,
} from "../i18n";
import {
  GROUPED_BG,
  PRIMARY_100,
  PRIMARY_500,
  SEPARATOR,
  SPACE,
  TEXT_DISABLED,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";

type Option = {
  choice: LangChoice;
  /** The letters on the badge — a language's own short name. */
  code: string;
  label: string;
  /** What it is called in itself, which is how a speaker recognises it. */
  endonym: string;
  detail: string;
};

/**
 * "ภาษา" — which language the app speaks.
 *
 * Three rows: follow the phone, or hold Thai or English whatever the phone
 * says. Picking one restarts the app in it (see `setLanguage`): the forms'
 * wording is built as the app starts, and a switch that changed the menus
 * and left a form half in the old language would be worse than a restart.
 */
export function LanguageSettingsScreen() {
  const current = languageChoice();
  const phone = systemLang() === "th" ? "ไทย" : "English";
  const options: Option[] = [
    {
      choice: "system",
      code: "OS",
      label: tr("ตามภาษาของเครื่อง", "Use device language"),
      endonym: phone,
      detail: tr(
        "เปลี่ยนตามการตั้งค่าภาษาของโทรศัพท์",
        "Follows your phone's language setting",
      ),
    },
    {
      choice: "th",
      code: "TH",
      label: tr("ภาษาไทย", "Thai"),
      endonym: "ไทย",
      detail: tr("ทั้งเมนูและแบบฟอร์มบันทึก", "Menus and record forms"),
    },
    {
      choice: "en",
      code: "EN",
      label: tr("ภาษาอังกฤษ", "English"),
      endonym: "English",
      detail: tr("ทั้งเมนูและแบบฟอร์มบันทึก", "Menus and record forms"),
    },
  ];

  return (
    <SettingsScreen
      title={tr("ภาษา", "Language")}
      footnote={tr(
        "เมื่อเปลี่ยนภาษา แอพจะเริ่มใหม่เพื่อแสดงผลเป็นภาษาที่เลือก ข้อมูลผู้ป่วย เช่น ชื่อและที่อยู่ จะแสดงตามที่บันทึกไว้",
        "The app restarts to show the language you choose. Patient details such as names and addresses appear as they were recorded.",
      )}
    >
      <SettingsGroup title={tr("ภาษาของแอพ", "App language")}>
        <Card padded={false}>
          {options.map((o, i) => (
            <Row
              key={o.choice}
              option={o}
              on={o.choice === current}
              divider={i > 0}
              onPress={() => {
                if (o.choice !== current) void setLanguage(o.choice);
              }}
            />
          ))}
        </Card>
      </SettingsGroup>
    </SettingsScreen>
  );
}

/**
 * One language: its short name in a badge, what it is called, and a tick
 * on the one in use.
 *
 * The badge carries letters rather than a flag. A language is not a
 * country, and a flag against a language says something the app has no
 * business saying.
 */
function Row({
  option,
  on,
  divider,
  onPress,
}: {
  option: Option;
  on: boolean;
  /** A rule above this row — every one but the first in its card. */
  divider: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.md,
        minHeight: 60,
        paddingHorizontal: SPACE.lg,
        paddingVertical: SPACE.sm,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: SEPARATOR,
        backgroundColor: pressed ? GROUPED_BG : undefined,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: on ? PRIMARY_100 : GROUPED_BG,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: "800",
            letterSpacing: 0.3,
            color: on ? PRIMARY_500 : TEXT_MUTED,
          }}
        >
          {option.code}
        </Text>
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            fontSize: 16,
            lineHeight: 25,
            fontWeight: "600",
            color: TEXT_PRIMARY,
          }}
        >
          {`${option.label} · ${option.endonym}`}
        </Text>
        <Text style={{ fontSize: 13, lineHeight: 21, color: TEXT_DISABLED }}>
          {option.detail}
        </Text>
      </View>

      {on && <Check size={20} color={PRIMARY_500} strokeWidth={2.6} />}
    </Pressable>
  );
}
