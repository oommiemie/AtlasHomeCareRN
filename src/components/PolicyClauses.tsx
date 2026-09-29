import { Image, Linking, Text, View } from "react-native";

import { Card } from "./Card";
import { toast } from "./Toast";
import { APP } from "../models/appInfo";
import { tr } from "../i18n";
import {
  POLICY_EFFECTIVE,
  POLICY_NOTE,
  PRIVACY_POLICY,
  type PolicyBlock,
} from "../models/privacyPolicy";
import {
  PRIMARY_500,
  PRIMARY_700,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme/tokens";

/**
 * The privacy policy, set as the published document is set.
 *
 * A notice a carer signs, not a menu: the app's mark and name at the head,
 * numbered headings in the one ink, and the paragraphs
 * under them the full width of the card. The numbers used to hang in a
 * column of their own, which cost every line of Thai the width of "11." —
 * on a phone that is a word a line, and eleven sections of it — so they sit
 * in the heading instead, as the document has them.
 *
 * Shared by the consent page and the one under ตั้งค่า, so that what a carer
 * agreed to looks, as well as reads, like what they look up afterwards.
 */
export function PolicyClauses() {
  return (
    <Card padded={false} style={{ padding: SPACE.xl, gap: SPACE.xl }}>
      {/* Whose policy it is. The title is the page's own header, so it is
          not said a second time here — only the mark and the name. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.md,
          paddingBottom: SPACE.lg,
          borderBottomWidth: 1,
          borderBottomColor: SEPARATOR,
        }}
      >
        <Image
          source={require("../../assets/logo.png")}
          style={{ width: 40, height: 42 }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              fontSize: 16,
              lineHeight: 24,
              fontWeight: "600",
              color: TEXT_PRIMARY,
            }}
          >
            {APP.name}
          </Text>
          <Text style={{ fontSize: 13, lineHeight: 20, color: TEXT_MUTED }}>
            <Text style={{ fontWeight: "600", color: PRIMARY_500 }}>
              {tr("มีผลบังคับใช้:", "Effective:")}
            </Text>
            {` ${POLICY_EFFECTIVE}`}
          </Text>
        </View>
      </View>

      {PRIVACY_POLICY.map((c, i) => (
        <View key={c.title} style={{ gap: SPACE.sm }}>
          <Text
            accessibilityRole="header"
            style={{
              fontSize: 16,
              lineHeight: 24,
              fontWeight: "700",
              color: PRIMARY_700,
            }}
          >
            {`${i + 1}. ${c.title}`}
          </Text>
          {c.blocks.map((b, j) => (
            <Block key={j} block={b} />
          ))}
        </View>
      ))}

      <Text
        style={{
          paddingTop: SPACE.lg,
          borderTopWidth: 1,
          borderTopColor: SEPARATOR,
          fontSize: 13,
          lineHeight: 21,
          color: TEXT_MUTED,
        }}
      >
        {POLICY_NOTE}
      </Text>
    </Card>
  );
}

const BODY = { fontSize: 15, lineHeight: 26, color: TEXT_SECONDARY } as const;

function Block({ block }: { block: PolicyBlock }) {
  switch (block.kind) {
    case "text":
      return (
        <Text style={BODY}>
          <Linked text={block.text} />
        </Text>
      );
    case "lines":
      return (
        <View>
          {block.lines.map((line) => (
            <Text key={line} style={BODY}>
              <Linked text={line} />
            </Text>
          ))}
        </View>
      );
    case "list":
      return (
        <View style={{ gap: SPACE.xs }}>
          {block.items.map((item) => (
            // A hanging bullet, so a wrapped line comes back under the words
            // rather than under the dot.
            <View key={item} style={{ flexDirection: "row", gap: SPACE.sm }}>
              <Text style={BODY}>•</Text>
              <Text style={[BODY, { flex: 1 }]}>
                <Linked text={item} />
              </Text>
            </View>
          ))}
        </View>
      );
  }
}

/** An address or a web link anywhere in the policy's text. */
const LINK = /(https?:\/\/[^\s]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g;

/**
 * The text, with its addresses made into the things they are: a tap on an
 * email opens a message to it, a tap on a web address opens the page. A
 * policy that gives an address for deletion requests should not make the
 * reader copy it out by hand.
 */
function Linked({ text }: { text: string }) {
  return text.split(LINK).map((part, i) =>
    i % 2 === 1 ? (
      <Text
        key={i}
        accessibilityRole="link"
        onPress={() =>
          Linking.openURL(part.includes("@") ? `mailto:${part}` : part).catch(
            () => toast(tr("เปิดลิงก์ไม่ได้", "Couldn't open the link"), "error"),
          )
        }
        style={{ color: PRIMARY_500 }}
      >
        {part}
      </Text>
    ) : (
      part
    ),
  );
}
