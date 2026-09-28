import { Text } from "react-native";

import { Card } from "../components/Card";
import { PolicyClauses } from "../components/PolicyClauses";
import { SettingsGroup, SettingsScreen } from "../components/SettingsScreen";
import { APP } from "../models/appInfo";
import { TEXT_SECONDARY } from "../theme/tokens";

/**
 * "นโยบายความเป็นส่วนตัว" — what is kept, why, and who may see it.
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
      title="นโยบายความเป็นส่วนตัว"
      footnote={`${APP.name} เวอร์ชัน ${APP.version} · จัดเก็บและใช้ข้อมูลตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562`}
    >
      <Card>
        <Text style={{ fontSize: 15, lineHeight: 24, color: TEXT_SECONDARY }}>
          {`${APP.name} ให้ความสำคัญกับความเป็นส่วนตัวและความปลอดภัยของข้อมูลสุขภาพอย่างสูงสุด โดยปกป้องข้อมูลส่วนบุคคลตามมาตรฐานความปลอดภัยขั้นสูง ด้านล่างคือวิธีที่เรารวบรวม ใช้ และคุ้มครองข้อมูลของคุณ`}
        </Text>
      </Card>

      <SettingsGroup title="รายละเอียดนโยบาย">
        <PolicyClauses />
      </SettingsGroup>
    </SettingsScreen>
  );
}
