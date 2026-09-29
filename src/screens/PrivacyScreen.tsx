import { Text } from "react-native";

import { Card } from "../components/Card";
import { PolicyClauses } from "../components/PolicyClauses";
import { SettingsGroup, SettingsScreen } from "../components/SettingsScreen";
import { APP } from "../models/appInfo";
import { TEXT_SECONDARY } from "../theme/tokens";
import { tr } from "../i18n";

/**
 * tr(
   "นโยบายความเป็นส่วนตัว",
   "Privacy policy",
 ) — what is kept, why, and who may see it.
 *
 * The page it is drawn from gives every clause an illustration the width of
 * its card and floats the seven of them down a coloured page. This is a
 * settings sub-page like the rest: the shell, a paragraph saying what
 * follows, and one card of clauses with a rule between them. Seven floating
 * cards is seven of something; a policy is one thing with parts.
 *
 * Each clause keeps the sign of what it is about, small and in its own
 * colour, because the page is read by looking for a clause rather than
 * reading down — and a mark is faster to find than a heading.
 */
export function PrivacyScreen() {
  return (
    <SettingsScreen
      title={tr("นโยบายความเป็นส่วนตัว", "Privacy policy")}
      footnote={tr(
        `${APP.name} เวอร์ชัน ${APP.version} · จัดเก็บและใช้ข้อมูลตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562`,
        `${APP.name} version ${APP.version} · Data is kept and used under Thailand's Personal Data Protection Act 2019`,
      )}
    >
      <Card>
        <Text style={{ fontSize: 15, lineHeight: 24, color: TEXT_SECONDARY }}>
          {tr(
            `${APP.name} ให้ความสำคัญกับความเป็นส่วนตัวและความปลอดภัยของข้อมูลสุขภาพอย่างสูงสุด โดยปกป้องข้อมูลส่วนบุคคลตามมาตรฐานความปลอดภัยขั้นสูง ด้านล่างคือวิธีที่เรารวบรวม ใช้ และคุ้มครองข้อมูลของคุณ`,
            `${APP.name} takes the privacy and security of health data extremely seriously, protecting personal data to high security standards. Below is how we collect, use and protect your data.`,
          )}
        </Text>
      </Card>

      <SettingsGroup title={tr("รายละเอียดนโยบาย", "Policy details")}>
        <PolicyClauses />
      </SettingsGroup>
    </SettingsScreen>
  );
}
