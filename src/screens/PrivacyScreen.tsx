import { Text, View } from "react-native";
import {
  FolderOpen,
  ListChecks,
  Megaphone,
  Share2,
  ShieldCheck,
  Target,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react-native";

import { Card } from "../components/Card";
import { SettingsGroup, SettingsScreen } from "../components/SettingsScreen";
import { APP } from "../models/appInfo";
import {
  SEPARATOR,
  SPACE,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme/tokens";

type Clause = {
  title: string;
  body: string;
  Icon: LucideIcon;
  /** What the clause's marker is drawn in, on the rail down the page. */
  ink: string;
};

/*
  The policy, as it was written — with one name put right.

  The clause on protection named "Care Vision+", which is a different
  product: the paragraph had been carried over from another app's policy
  and the find-and-replace missed a line. A privacy policy that names the
  wrong company is not a typo, it is a document that protects nobody, so
  this one says the name of the app the reader is holding. Every other
  mention comes from APP.name for the same reason — it cannot go stale.
*/
const CLAUSES: Clause[] = [
  {
    title: "คำเตือนและข้อจำกัด",
    body: "แอปนี้มีไว้เพื่อจุดประสงค์ในการให้ข้อมูลเท่านั้น ควรปรึกษาแพทย์เพื่อการวินิจฉัยและการรักษาเสมอ",
    Icon: TriangleAlert,
    ink: "#C2410C",
  },
  {
    title: "การเก็บรวบรวมข้อมูล",
    body: "เราอาจรวบรวมข้อมูลดังต่อไปนี้เพื่อให้บริการที่มีประสิทธิภาพแก่คุณ — ข้อมูลบัญชีผู้ใช้ ข้อมูลสุขภาพ ข้อมูลอุปกรณ์ และข้อมูลตำแหน่งที่ตั้ง",
    Icon: FolderOpen,
    ink: "#BE185D",
  },
  {
    title: "วัตถุประสงค์ในการใช้ข้อมูล",
    body: `${APP.name} ใช้ข้อมูลของคุณเพื่อติดตามและวิเคราะห์ข้อมูลสุขภาพ สำหรับให้คำแนะนำที่เหมาะสมกับผู้รับบริการแต่ละราย`,
    Icon: Target,
    ink: "#3730A3",
  },
  {
    title: "การแชร์ข้อมูล",
    body: "เราจะไม่เปิดเผยข้อมูลของคุณแก่บุคคลที่สามโดยไม่ได้รับความยินยอม เว้นแต่ในกรณีที่จำเป็นต้องปฏิบัติตามกฎหมาย หรือให้บริการทางการแพทย์ที่เกี่ยวข้องโดยได้รับความยินยอมจากคุณ",
    Icon: Share2,
    ink: "#0F766E",
  },
  {
    title: "การปกป้องข้อมูลของคุณ",
    body: `${APP.name} ใช้มาตรการความปลอดภัยขั้นสูง เช่น การเข้ารหัสข้อมูล และระบบยืนยันตัวตน เพื่อป้องกันการเข้าถึงข้อมูลโดยไม่ได้รับอนุญาต`,
    Icon: ShieldCheck,
    ink: "#6D28D9",
  },
  {
    title: "สิทธิของผู้ใช้",
    body: "คุณสามารถตรวจสอบ แก้ไข หรือลบข้อมูลส่วนบุคคลของคุณ ปรับเปลี่ยนการตั้งค่าความเป็นส่วนตัวได้ทุกเมื่อ และขอให้เราหยุดใช้หรือแชร์ข้อมูลของคุณในบางกรณี",
    Icon: ListChecks,
    ink: "#1D4ED8",
  },
  {
    title: "การเปลี่ยนแปลงนโยบาย",
    body: "เราขอสงวนสิทธิ์ในการปรับปรุงนโยบายนี้เป็นครั้งคราว หากมีการเปลี่ยนแปลงสำคัญ เราจะแจ้งให้คุณทราบผ่านแอปหรือช่องทางอื่น",
    Icon: Megaphone,
    ink: "#A16207",
  },
];

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
        <Card padded={false}>
          {CLAUSES.map((c, i) => (
            <View
              key={c.title}
              style={{
                gap: SPACE.xs,
                padding: SPACE.lg,
                borderTopWidth: i > 0 ? 1 : 0,
                borderTopColor: SEPARATOR,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACE.sm,
                }}
              >
                <c.Icon size={17} color={c.ink} strokeWidth={1.9} />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 16,
                    lineHeight: 25,
                    fontWeight: "600",
                    color: TEXT_PRIMARY,
                  }}
                >
                  {c.title}
                </Text>
              </View>
              <Text
                style={{ fontSize: 15, lineHeight: 24, color: TEXT_SECONDARY }}
              >
                {c.body}
              </Text>
            </View>
          ))}
        </Card>
      </SettingsGroup>
    </SettingsScreen>
  );
}
