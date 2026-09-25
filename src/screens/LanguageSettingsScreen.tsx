import { Text, View } from "react-native";
import { Check } from "lucide-react-native";

import { Card } from "../components/Card";
import { SettingsGroup, SettingsScreen } from "../components/SettingsScreen";
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

type Language = {
  /** The two letters on the badge — a language's own short name. */
  code: string;
  label: string;
  /** What it is called in itself, which is how a speaker recognises it. */
  endonym: string;
};

const SPOKEN: Language = { code: "TH", label: "ภาษาไทย", endonym: "ไทย" };

/*
  What is not here yet, named rather than hidden.

  A settings page with one row on it looks like a page somebody forgot to
  finish. Saying which language is coming turns the same fact into an
  answer: a carer who opens this looking for English learns that it is
  known about and not yet ready, which is what they came to find out.

  English alone, and no list of the languages a migrant health round might
  one day need. A language named here is a language the app is saying it
  is working on, and naming three when one is being worked on is a
  promise made on behalf of whoever has to keep it.
*/
const COMING: Language[] = [
  { code: "EN", label: "อังกฤษ", endonym: "English" },
];

/**
 * "ภาษา" — which language the app speaks.
 *
 * It used to offer two and refuse one of them. English was a row you could
 * press, and pressing it raised "ยังไม่รองรับภาษานี้" — a choice put in
 * front of somebody for the sole purpose of turning them down, which is
 * worse than not offering it, because they had to reach for it to find
 * out. Nothing here is tappable now: the language in use is ticked, the
 * ones being worked on are marked, and the page is read rather than
 * operated.
 *
 * There is no stored setting behind this either. The old page kept the
 * choice in a useState that lasted until the screen closed — a switch that
 * forgot itself, which is a promise the app was not keeping. When a second
 * language genuinely lands it belongs in the display store beside the
 * theme and the text size, where it will survive a launch.
 */
export function LanguageSettingsScreen() {
  return (
    <SettingsScreen
      title="ภาษา"
      footnote="แบบฟอร์มบันทึกในแอพอ้างอิงแบบบันทึกของกระทรวงสาธารณสุข (บัญชี 1–8) ซึ่งกำหนดถ้อยคำเป็นภาษาไทย การแปลเฉพาะเมนูโดยที่แบบฟอร์มยังเป็นไทยจะทำให้อ่านสลับไปมา จึงจะเปิดให้ใช้เมื่อแปลได้ทั้งชุด"
    >
      <SettingsGroup title="ภาษาที่ใช้อยู่">
        <Card padded={false}>
          <Row lang={SPOKEN} detail="ทั้งเมนูและแบบฟอร์มบันทึก" on />
        </Card>
      </SettingsGroup>

      <SettingsGroup title="กำลังแปล">
        <Card padded={false}>
          {COMING.map((l, i) => (
            <Row key={l.code} lang={l} detail="เร็ว ๆ นี้" divider={i > 0} />
          ))}
        </Card>
      </SettingsGroup>
    </SettingsScreen>
  );
}

/**
 * One language: its short name in a badge, what it is called, and where it
 * stands.
 *
 * The badge carries letters rather than a flag. A language is not a
 * country — English is not England's alone and Burmese is spoken on both
 * sides of a border this app works near — and a flag against a language a
 * migrant worker speaks says something about them that the app has no
 * business saying.
 */
function Row({
  lang,
  detail,
  on,
  divider,
}: {
  lang: Language;
  detail: string;
  on?: boolean;
  /** A rule above this row — every one but the first in its card. */
  divider?: boolean;
}) {
  return (
    <View
      accessibilityRole="radio"
      accessibilityState={{ selected: on === true, disabled: on !== true }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.md,
        minHeight: 60,
        paddingHorizontal: SPACE.lg,
        paddingVertical: SPACE.sm,
        borderTopWidth: divider === true ? 1 : 0,
        borderTopColor: SEPARATOR,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: on === true ? PRIMARY_100 : GROUPED_BG,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: "800",
            letterSpacing: 0.3,
            color: on === true ? PRIMARY_500 : TEXT_MUTED,
          }}
        >
          {lang.code}
        </Text>
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            fontSize: 16,
            lineHeight: 25,
            fontWeight: "600",
            color: on === true ? TEXT_PRIMARY : TEXT_MUTED,
          }}
        >
          {`${lang.label} · ${lang.endonym}`}
        </Text>
        <Text style={{ fontSize: 13, lineHeight: 21, color: TEXT_DISABLED }}>
          {detail}
        </Text>
      </View>

      {on === true && <Check size={20} color={PRIMARY_500} strokeWidth={2.6} />}
    </View>
  );
}
