import { Text, View } from "react-native";

import { Card } from "../components/Card";
import { SettingsScreen } from "../components/SettingsScreen";
import { APP } from "../models/appInfo";
import {
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme/tokens";
import { tr } from "../i18n";

/** One numbered clause of the agreement. */
type Clause = { title: string; body: string };

/*
  The agreement, in whichever language the app speaks.

  It once carried an English column and a switch of its own above it, a
  choice that stopped at this screen. The English now comes the way the
  rest of the app's does — from the language chosen under ภาษา — so each
  clause is written once in each language, side by side.

  Clause five is written out rather than repeated. The page this was drawn
  from has the acceptance clause a second time under "การเปลี่ยนแปลง",
  which is a copy-and-paste left in — a section headed "changes" that says
  nothing about changes is worse than no section, because a reader who
  notices stops trusting the rest of it.
*/
const CLAUSES: Clause[] = [
  {
    title: tr("การยอมรับข้อตกลง", "Acceptance of terms"),
    body: tr(
      `การเข้าใช้งานแอปพลิเคชัน ${APP.name} ถือว่าคุณยอมรับข้อตกลงนี้โดยสมบูรณ์`,
      `By using the ${APP.name} application, you accept these terms in full.`,
    ),
  },
  {
    title: tr("วัตถุประสงค์", "Purpose"),
    body: tr(
      `${APP.name} เป็นเครื่องมือสำหรับเจ้าหน้าที่สาธารณสุขและ อสม. ใช้บันทึกการเยี่ยมบ้านและงานบริการในชุมชน`,
      `${APP.name} is a tool for public health staff and village health volunteers (VHVs) to record home visits and community services.`,
    ),
  },
  {
    title: tr("การเก็บข้อมูล", "Data collection"),
    body: tr(
      "ข้อมูลทั้งหมดจะถูกจัดเก็บอย่างปลอดภัย และต้องได้รับความยินยอมจากผู้ใช้งานตามนโยบายความเป็นส่วนตัว",
      "All data is stored securely and requires the user's consent under the privacy policy.",
    ),
  },
  {
    title: tr("ความปลอดภัย", "Security"),
    body: tr(
      "ข้อมูลของคุณจะถูกเข้ารหัสและไม่เปิดเผยแก่บุคคลที่สามโดยไม่ได้รับอนุญาต",
      "Your data is encrypted and is not disclosed to third parties without authorization.",
    ),
  },
  {
    title: tr("การเปลี่ยนแปลงข้อตกลง", "Changes to these terms"),
    body: tr(
      "บริษัทอาจปรับปรุงข้อตกลงนี้เมื่อใดก็ได้ และจะแจ้งให้ทราบในแอป การใช้งานต่อหลังการเปลี่ยนแปลงถือว่ายอมรับฉบับใหม่",
      "The company may update these terms at any time and will notify you in the app. Continuing to use the app after a change constitutes acceptance of the new version.",
    ),
  },
  {
    title: tr("ทรัพย์สินทางปัญญา", "Intellectual property"),
    body: tr(
      "ชื่อแอป โลโก้ เนื้อหา และเครื่องหมายการค้าทั้งหมด เป็นทรัพย์สินของบริษัท ห้ามคัดลอกหรือใช้ซ้ำโดยไม่ได้รับอนุญาตเป็นลายลักษณ์อักษร",
      "The app name, logo, content and all trademarks are the property of the company and may not be copied or reused without written permission.",
    ),
  },
  {
    title: tr("ความรับผิดชอบของผู้ใช้", "User responsibilities"),
    body: tr(
      "ผู้ใช้ต้องไม่ใช้แอปเพื่อวัตถุประสงค์ที่ผิดกฎหมาย หรือพยายามเข้าถึงข้อมูลของบุคคลอื่นโดยไม่ได้รับอนุญาต",
      "Users must not use the app for any unlawful purpose or attempt to access other people's data without authorization.",
    ),
  },
  {
    title: tr("ข้อจำกัดความรับผิด", "Limitation of liability"),
    body: tr(
      `${APP.name} ไม่ใช่เครื่องมือวินิจฉัยทางการแพทย์ ข้อมูลจาก AI ใช้เพื่อการแนะนำทั่วไปเท่านั้น การตัดสินใจทางคลินิกยังเป็นของผู้ประกอบวิชาชีพเสมอ`,
      `${APP.name} is not a medical diagnostic tool. AI-generated information is for general guidance only; clinical decisions always remain with the practitioner.`,
    ),
  },
  {
    title: tr("การยกเลิกการใช้งาน", "Termination"),
    body: tr(
      "บริษัทมีสิทธิ์ระงับการใช้งานของผู้ใช้ที่ละเมิดข้อตกลงนี้ โดยไม่ต้องแจ้งล่วงหน้า",
      "The company may suspend the account of any user who breaches these terms without prior notice.",
    ),
  },
  {
    title: tr("ติดต่อ", "Contact"),
    body: tr(
      "ติดต่อได้ที่ app.healthflow@gmail.com",
      "Contact us at app.healthflow@gmail.com",
    ),
  },
];

const UPDATED = tr("25 กันยายน 2569", "September 25, 2026");

/**
 * "ข้อกำหนดการใช้งาน" — the agreement, numbered.
 *
 * Laid out as the settings pages next door are: the page's shell, a card,
 * rows with a rule between them. A document is not a special kind of screen
 * and dressing it as one — coloured heads, badges, a rail down the margin —
 * made a page of plain text look like a feature, which is the one thing an
 * agreement should never look like.
 *
 * The numbers stay, set in front of each heading. Ten clauses on a page
 * nobody reads end to end: what people do is look for the one they have a
 * question about, and "ข้อ 8" is how somebody asks about it over the phone.
 */
export function TermsScreen() {
  return (
    <SettingsScreen
      title={tr("ข้อกำหนดการใช้งาน", "Terms of use")}
      footnote={tr(
        `${APP.name} เวอร์ชัน ${APP.version} · ปรับปรุงล่าสุด ${UPDATED}`,
        `${APP.name} version ${APP.version} · Last updated ${UPDATED}`,
      )}
    >
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
            <Text style={{ fontSize: 16, lineHeight: 25, fontWeight: "600" }}>
              <Text style={{ color: TEXT_MUTED }}>{`${i + 1}. `}</Text>
              <Text style={{ color: TEXT_PRIMARY }}>{c.title}</Text>
            </Text>
            <Text
              style={{ fontSize: 15, lineHeight: 24, color: TEXT_SECONDARY }}
            >
              {c.body}
            </Text>
          </View>
        ))}
      </Card>
    </SettingsScreen>
  );
}
