import { useMemo, useState } from "react";
import { LayoutAnimation, Platform, Text, UIManager, View } from "react-native";
import {
  Baby,
  ChevronDown,
  History,
  House,
  Inbox,
  NotebookPen,
  Pill,
  Scale,
  Settings2,
  ShieldCheck,
  Smile,
  Syringe,
} from "lucide-react-native";

import { Card } from "../components/Card";
import { PressableScale } from "../components/PressableScale";
import { SearchField } from "../components/SearchField";
import { SettingsScreen } from "../components/SettingsScreen";
import { currentDisplay } from "../models/display";
import { searchHelp, TOPICS, type Answer, type Topic } from "../models/help";
import { feel } from "../utils/haptics";
import {
  PRIMARY_500,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TONE_INK,
} from "../theme/tokens";
import { SERVICE_TONE } from "../theme/serviceTone";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * A mark and a colour for each topic.
 *
 * The four group services keep the colours they wear everywhere else in
 * the app (`SERVICE_TONE`), so a heading here is recognisably the same service
 * as the ring on the home page and the panel over its plan. A page of
 * eleven identical headings is a page somebody reads by counting down it;
 * this one can be found in by colour.
 */
const LOOK: Record<Topic, { Icon: typeof Inbox; ink: string }> = {
  งาน: { Icon: Inbox, ink: PRIMARY_500 },
  เยี่ยมบ้าน: { Icon: House, ink: PRIMARY_500 },
  วัคซีน: { Icon: Syringe, ink: TONE_INK[SERVICE_TONE.vaccination] },
  ตรวจสุขภาพ: { Icon: Scale, ink: TONE_INK[SERVICE_TONE.schoolHealth] },
  คัดกรอง: { Icon: Baby, ink: TONE_INK[SERVICE_TONE.screening] },
  ทันตกรรม: { Icon: Smile, ink: TONE_INK[SERVICE_TONE.dental] },
  ยาและเวชภัณฑ์: { Icon: Pill, ink: "#F59E0B" },
  สมุดจด: { Icon: NotebookPen, ink: "#F59E0B" },
  ประวัติและรายงาน: { Icon: History, ink: "#7C6BF5" },
  บัญชีและความปลอดภัย: { Icon: ShieldCheck, ink: "#7C6BF5" },
  การใช้งานทั่วไป: { Icon: Settings2, ink: "#7C6BF5" },
};

/**
 * "ศูนย์ช่วยเหลือ" — the questions carers actually ask, all of them.
 *
 * It covered three topics: taking a job, making a visit, and the account.
 * The app has since grown four group services, a notebook that dictates
 * and reads photographs, a delivery round and a page of settings — and a
 * help page that stops at a third of the app is a help page that teaches
 * people not to look.
 *
 * The field is above the list because a question is how somebody arrives:
 * they do not think "this is under บัญชีและความปลอดภัย", they think "PIN".
 * Searching matches the answers too, so a word that only appears in the
 * reply still finds it.
 */
export function HelpCenterScreen() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const found = useMemo(() => searchHelp(query), [query]);
  const searching = query.trim() !== "";

  const toggle = (q: string) => {
    feel("tick");
    if (!currentDisplay().reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setOpen((was) => (was === q ? null : q));
  };

  return (
    <SettingsScreen
      title="ศูนย์ช่วยเหลือ"
      footnote="ยังไม่เจอสิ่งที่ต้องการ ให้ถามผู้ช่วย หรือแจ้งทีมงานที่ ฉัน → รายงานปัญหา"
    >
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="ค้นหาวิธีใช้งาน เช่น ไฮไลต์ PIN งานค้าง"
      />

      {found.length === 0 ? (
        <Card>
          <Text style={{ fontSize: 15, lineHeight: 24, color: TEXT_SECONDARY }}>
            {`ไม่พบวิธีใช้งานที่ตรงกับ "${query.trim()}" — ลองคำอื่น หรือแจ้งทีมงานที่ ฉัน → รายงานปัญหา`}
          </Text>
        </Card>
      ) : searching ? (
        /* Matches run together while searching. A hit is a hit whichever
           heading it was filed under, and re-sorting them into topics
           would be the page filing the answer instead of giving it. */
        <Card padded={false}>
          {found.map((h, i) => (
            <Row
              key={h.q}
              answer={h}
              open={open === h.q}
              divider={i > 0}
              onPress={() => toggle(h.q)}
            />
          ))}
        </Card>
      ) : (
        TOPICS.map((t) => {
          const rows = found.filter((h) => h.topic === t);
          if (rows.length === 0) return null;
          return (
            <View key={t} style={{ gap: SPACE.md }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACE.sm,
                  paddingHorizontal: SPACE.xs,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: `${LOOK[t].ink}1F`,
                  }}
                >
                  <LookIcon topic={t} />
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 16,
                    lineHeight: 25,
                    fontWeight: "600",
                    color: TEXT_PRIMARY,
                  }}
                >
                  {t}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    lineHeight: 21,
                    color: TEXT_MUTED,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {rows.length}
                </Text>
              </View>
              <Card padded={false}>
                {rows.map((h, i) => (
                  <Row
                    key={h.q}
                    answer={h}
                    open={open === h.q}
                    divider={i > 0}
                    onPress={() => toggle(h.q)}
                  />
                ))}
              </Card>
            </View>
          );
        })
      )}
    </SettingsScreen>
  );
}

/** The topic's own mark, in its own colour. */
function LookIcon({ topic }: { topic: Topic }) {
  const { Icon, ink } = LOOK[topic];
  return <Icon size={15} color={ink} strokeWidth={2.2} />;
}

/** One question, and its answer when it is open. */
function Row({
  answer,
  open,
  divider,
  onPress,
}: {
  answer: Answer;
  open: boolean;
  divider: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      scaleTo={0.995}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={answer.q}
      style={{
        paddingHorizontal: SPACE.lg,
        paddingVertical: SPACE.lg,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: SEPARATOR,
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}
      >
        <Text
          style={{
            flex: 1,
            fontSize: 16,
            lineHeight: 25,
            fontWeight: "500",
            color: TEXT_PRIMARY,
          }}
        >
          {answer.q}
        </Text>
        <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
          <ChevronDown size={18} color={TEXT_MUTED} />
        </View>
      </View>

      {open && (
        <Text
          style={{
            marginTop: SPACE.sm,
            fontSize: 15,
            lineHeight: 24,
            color: TEXT_SECONDARY,
          }}
        >
          {answer.a}
        </Text>
      )}
    </PressableScale>
  );
}
