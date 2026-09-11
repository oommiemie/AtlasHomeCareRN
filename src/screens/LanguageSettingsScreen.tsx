import { useState } from "react";
import { Text, View } from "react-native";
import { Check } from "lucide-react-native";

import { Card } from "../components/Card";
import { PressableScale } from "../components/PressableScale";
import { SettingsScreen } from "../components/SettingsScreen";
import { toast } from "../components/Toast";
import { PRIMARY_500, SEPARATOR, SPACE, TEXT_MUTED, TEXT_PRIMARY } from "../theme/tokens";

const LANGUAGES = [
  { code: "th", label: "ภาษาไทย", note: "ไทย" },
  { code: "en", label: "อังกฤษ", note: "English" },
] as const;

/** "ภาษา" — which language the app speaks. */
export function LanguageSettingsScreen() {
  const [code, setCode] = useState<string>("th");

  return (
    <SettingsScreen
      title="ภาษา"
      footnote="ขณะนี้แอพรองรับภาษาไทยเท่านั้น ภาษาอื่นจะเปิดให้ใช้งานในเวอร์ชันถัดไป"
    >
      <Card padded={false}>
        {LANGUAGES.map((l, i) => {
          const selected = code === l.code;
          return (
            <PressableScale
              key={l.code}
              scaleTo={0.99}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={l.label}
              onPress={() => {
                if (l.code === "th") {
                  setCode(l.code);
                  return;
                }
                // Saying so beats switching to a language nothing is
                // translated into yet.
                toast("ยังไม่รองรับภาษานี้");
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                minHeight: 56,
                paddingHorizontal: SPACE.lg,
                borderTopWidth: i > 0 ? 1 : 0,
                borderTopColor: SEPARATOR,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: "500", color: TEXT_PRIMARY }}>
                  {l.label}
                </Text>
                <Text style={{ marginTop: 2, fontSize: 12, color: TEXT_MUTED }}>
                  {l.note}
                </Text>
              </View>
              {selected && <Check size={20} color={PRIMARY_500} strokeWidth={2.6} />}
            </PressableScale>
          );
        })}
      </Card>
    </SettingsScreen>
  );
}
