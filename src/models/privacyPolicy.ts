import { APP } from "./appInfo";
import { tr } from "../i18n";

/** A paragraph, a bulleted list, or lines set one under another (an address). */
export type PolicyBlock =
  | { kind: "text"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "lines"; lines: string[] };

export type PolicyClause = {
  title: string;
  blocks: PolicyBlock[];
};

/*
  The privacy policy, once — "Privacy Policy & Data Deletion", the document
  published for the app, in Thai.

  It is read from here by the consent page a new carer agrees to and by the
  page under ตั้งค่า where they read it again later: what was agreed to has
  to be what can be looked up afterwards. It follows the published document
  section for section, so the two can be checked against each other; a
  change to one is a change to both.

  Both addresses are the document's own, each where it puts it: deletion
  requests to one, general contact to the other.
*/
/** The date the policy took effect, as the published document states it. */
export const POLICY_EFFECTIVE = tr("1 สิงหาคม 2567", "August 1, 2024");

export const PRIVACY_POLICY: PolicyClause[] = [
  {
    title: tr("ข้อจำกัดความรับผิดชอบ", "Disclaimer"),
    blocks: [
      {
        kind: "text",
        text: tr(
          `${APP.name} ออกแบบมาสำหรับบุคลากรทางการแพทย์ที่มีใบอนุญาตเท่านั้น ไม่ได้มีไว้สำหรับประชาชนหรือผู้บริโภคทั่วไป การเข้าถึงข้อมูลสุขภาพที่มีความอ่อนไหวทั้งหมดต้องผ่านการยืนยันตัวตนและการกำหนดสิทธิ์ตามบทบาท`,
          `${APP.name} is designed for licensed healthcare professionals only. It is not intended for the general public or consumers. All access to sensitive health data requires authentication and role-based authorization.`,
        ),
      },
      {
        kind: "text",
        text: tr(
          "แอปให้ข้อมูลเพื่อประกอบการพิจารณาเท่านั้น ไม่สามารถใช้แทนคำแนะนำทางการแพทย์จากผู้เชี่ยวชาญได้ ผู้ใช้ควรปรึกษาผู้ให้บริการด้านสุขภาพที่มีคุณสมบัติก่อนตัดสินใจในเรื่องที่เกี่ยวกับสุขภาพ",
          "The app provides information for reference only and is not a substitute for professional medical advice. Users should consult a qualified healthcare provider before making any health-related decision.",
        ),
      },
    ],
  },
  {
    title: tr("การจัดการสิทธิ์การเข้าถึงของแอป", "App permissions"),
    blocks: [
      {
        kind: "list",
        items: [
          tr(
            "Bluetooth: สำหรับเชื่อมต่ออุปกรณ์ IoT ทางการแพทย์ที่ได้รับการรับรอง",
            "Bluetooth: to connect certified medical IoT devices",
          ),
          tr(
            "ตำแหน่งที่ตั้ง: สำหรับบันทึกการเยี่ยมทางการแพทย์และการติดตามสมรรถภาพ",
            "Location: to record medical visits and functional follow-up",
          ),
          tr(
            "กล้อง: สำหรับถ่ายภาพบันทึกข้อมูลผู้ป่วยและการประเมินสมรรถภาพ",
            "Camera: to take photos for patient records and functional assessments",
          ),
          tr(
            "การแจ้งเตือน: สำหรับเตือนนัดเยี่ยมและแจ้งเรื่องที่ต้องดำเนินการตามเวลา",
            "Notifications: to remind you of visit appointments and time-sensitive actions",
          ),
        ],
      },
      {
        kind: "text",
        text: tr(
          "แอปจะขอสิทธิ์ตามบริบทการใช้งานและทีละขั้นตอน ผู้ใช้สามารถเปลี่ยนแปลงหรือเพิกถอนสิทธิ์ได้ทุกเมื่อในการตั้งค่าของอุปกรณ์",
          "The app requests permissions in context and one step at a time. Users can change or revoke permissions at any time in the device settings.",
        ),
      },
    ],
  },
  {
    title: tr("ข้อมูลที่ใช้", "Data we use"),
    blocks: [
      {
        kind: "list",
        items: [
          tr(
            "Provider ID: ใช้ยืนยันตัวตนบุคลากรทางการแพทย์ผ่านกระทรวงสาธารณสุข",
            "Provider ID: used to verify healthcare professionals through the Ministry of Public Health",
          ),
          tr(
            "เวชระเบียนผู้ป่วย: รวมถึงประวัติการเยี่ยม ข้อมูลโรคเรื้อรัง ผลตรวจทางห้องปฏิบัติการ รายการยา และที่อยู่บ้าน",
            "Patient medical records: including visit history, chronic conditions, laboratory results, medications and home addresses",
          ),
          tr(
            "ข้อมูลตำแหน่งที่ตั้ง (ไม่บังคับ): ใช้เพื่อบันทึกการเยี่ยมบ้านและการกรอกข้อมูลตามบริบทเท่านั้น ไม่มีการติดตามตำแหน่งเบื้องหลัง",
            "Location data (optional): used only to record home visits and fill in contextual information. There is no background location tracking.",
          ),
          tr(
            "ข้อมูลการเยี่ยมบ้านและสัญญาณชีพ: บันทึกผลการเยี่ยม รายละเอียดการรักษา สัญญาณชีพจากอุปกรณ์ IoT (เช่น ความดันโลหิต O₂ อุณหภูมิ) และรูปภาพ",
            "Home visit and vital signs data: visit outcomes, treatment details, vital signs from IoT devices (such as blood pressure, O₂ and temperature) and photos",
          ),
          tr(
            "ข้อมูลเชิงลึกจาก AI: ให้คำแนะนำเพื่อประกอบการตัดสินใจเท่านั้น ไม่สามารถใช้แทนดุลยพินิจทางคลินิก",
            "AI insights: provide suggestions to support decisions only and do not replace clinical judgment",
          ),
          tr(
            "ข้อมูลอุปกรณ์: ใช้เพื่อรองรับการจับคู่และการเชื่อมต่อ Bluetooth เท่านั้น",
            "Device information: used only to support Bluetooth pairing and connection",
          ),
          tr(
            "รหัสยืนยันตัวตน: ใช้เพื่อเปิด Visit OPD และบันทึกรหัสวินิจฉัย ICD-10 อย่างปลอดภัย",
            "Authentication codes: used to open OPD visits and record ICD-10 diagnosis codes securely",
          ),
        ],
      },
    ],
  },
  {
    title: tr("วิธีที่เราใช้ข้อมูลของคุณ", "How we use your data"),
    blocks: [
      {
        kind: "list",
        items: [
          tr(
            "เพื่อยืนยันตัวตนบุคลากรทางการแพทย์ด้วย Provider ID",
            "To verify healthcare professionals with their Provider ID",
          ),
          tr(
            "เพื่อเรียกดูและแสดงข้อมูลผู้ป่วยตามการควบคุมการเข้าถึงตามบทบาท (RBAC)",
            "To retrieve and display patient data under role-based access control (RBAC)",
          ),
          tr(
            "เพื่อบันทึกการเยี่ยมบ้านและปรับปรุงข้อมูลการรักษาของผู้ป่วย",
            "To record home visits and update patients' treatment information",
          ),
          tr(
            "เพื่อให้บริการสรุปข้อมูลด้วย AI ซึ่งเลือกใช้หรือไม่ก็ได้ (เพื่อเป็นข้อมูลเท่านั้น)",
            "To provide optional AI summaries (for information only)",
          ),
          tr(
            "เพื่อให้การเปิด Visit OPD และการบันทึกการวินิจฉัยเป็นไปอย่างปลอดภัย",
            "To open OPD visits and record diagnoses securely",
          ),
        ],
      },
    ],
  },
  {
    title: tr("การแชร์ข้อมูลและความปลอดภัย", "Data sharing and security"),
    blocks: [
      {
        kind: "list",
        items: [
          tr(
            "เราไม่ขายหรือให้เช่าข้อมูลผู้ใช้ใด ๆ",
            "We do not sell or rent any user data.",
          ),
          tr(
            "การเข้าถึงข้อมูลทั้งหมดจำกัดเฉพาะบุคลากรทางการแพทย์ที่ได้รับอนุญาตภายในเครือข่ายสังกัดเดียวกัน",
            "All data access is limited to authorized healthcare professionals within the same affiliated network.",
          ),
          tr(
            "ข้อมูลผู้ป่วยและข้อมูลทางคลินิกทั้งหมดได้รับการเข้ารหัสด้วย TLS และมาตรฐานการเข้ารหัสสมัยใหม่",
            "All patient and clinical data is encrypted with TLS and modern encryption standards.",
          ),
          tr(
            "ข้อมูลจากอุปกรณ์ IoT จะไม่ถูกจัดเก็บหรือแชร์เกินกว่าการให้บริการทางการแพทย์ในครั้งนั้น",
            "Data from IoT devices is not stored or shared beyond the medical service it was collected for.",
          ),
        ],
      },
    ],
  },
  {
    title: tr(
      "การควบคุมของผู้ใช้และการลบข้อมูล",
      "User control and data deletion",
    ),
    blocks: [
      {
        kind: "list",
        items: [
          tr(
            "ผู้ใช้สามารถจัดการสิทธิ์ Bluetooth ตำแหน่งที่ตั้ง กล้อง และการแจ้งเตือนได้ในการตั้งค่าของอุปกรณ์",
            "Users can manage Bluetooth, location, camera and notification permissions in the device settings.",
          ),
          tr(
            "ผู้ใช้สามารถลบข้อมูลของตนผ่านส่วนความเป็นส่วนตัวในแอป หรือส่งอีเมลถึงเราที่ app.healthflow@gmail.com",
            "Users can delete their data through the privacy section of the app, or by emailing us at app.healthflow@gmail.com.",
          ),
          tr(
            "คำขอลบข้อมูลจะได้รับการดำเนินการภายใน 30 วัน และข้อมูลสุขภาพที่เกี่ยวข้องทั้งหมดจะถูกลบอย่างถาวร",
            "Deletion requests are processed within 30 days, and all related health data is permanently deleted.",
          ),
        ],
      },
    ],
  },
  {
    title: tr("ความเป็นส่วนตัวของเด็ก", "Children's privacy"),
    blocks: [
      {
        kind: "text",
        text: tr(
          "แอปนี้มีไว้สำหรับบุคลากรทางการแพทย์ที่เป็นผู้ใหญ่เท่านั้น ไม่ได้ออกแบบหรือมุ่งให้บริการแก่เด็ก หากมีการเก็บข้อมูลที่เกี่ยวข้องกับผู้เยาว์โดยไม่ได้ตั้งใจ ข้อมูลนั้นจะถูกลบโดยเร็ว",
          "This app is intended only for adult healthcare professionals and is not designed for or directed at children. If data relating to a minor is collected unintentionally, it will be deleted promptly.",
        ),
      },
    ],
  },
  {
    title: tr("การเชื่อมต่อกับบุคคลที่สาม", "Third-party integrations"),
    blocks: [
      {
        kind: "text",
        text: tr(
          "แอปเชื่อมต่ออย่างปลอดภัยกับฐานข้อมูลโรงพยาบาล HOSxP ระบบจัดเก็บข้อมูลบนคลาวด์ที่มีการเข้ารหัส และแพลตฟอร์มการแพทย์ทางไกลที่ได้รับอนุญาต ซึ่งแต่ละรายปฏิบัติตามมาตรฐานความเป็นส่วนตัวของตนเอง",
          "The app connects securely to HOSxP hospital databases, encrypted cloud storage and authorized telemedicine platforms, each of which follows its own privacy standards.",
        ),
      },
    ],
  },
  {
    title: tr(
      "การปฏิบัติตามกฎระเบียบและมาตรการคุ้มครอง",
      "Compliance and safeguards",
    ),
    blocks: [
      {
        kind: "text",
        text: tr(
          "เราปฏิบัติตามนโยบายล่าสุดของ Google Play ว่าด้วย Health Connect และสิทธิ์การเข้าถึงข้อมูลที่มีความอ่อนไหว",
          "We comply with the latest Google Play policies on Health Connect and sensitive data permissions.",
        ),
      },
      {
        kind: "text",
        text: tr(
          "การเข้าถึงข้อมูลเป็นไปอย่างโปร่งใส ทีละขั้นตอน และจำกัดตามวัตถุประสงค์ เราปฏิบัติตามกฎหมายคุ้มครองข้อมูลสุขภาพที่เกี่ยวข้อง รวมถึง HIPAA (หากเกี่ยวข้อง) และกฎหมายในประเทศ",
          "Data access is transparent, step by step and limited to its purpose. We comply with applicable health data protection laws, including HIPAA (where applicable) and local law.",
        ),
      },
    ],
  },
  {
    title: tr("การเปลี่ยนแปลงนโยบายนี้", "Changes to this policy"),
    blocks: [
      {
        kind: "text",
        text: tr(
          "เราอาจปรับปรุงนโยบายนี้ให้สอดคล้องกับข้อกำหนดที่เปลี่ยนแปลงไปหรือเพื่อการพัฒนา หากมีการเปลี่ยนแปลงที่สำคัญ ผู้ใช้จะได้รับแจ้งผ่านการแจ้งเตือนในแอปหรืออีเมล",
          "We may update this policy to reflect changing requirements or improvements. Users will be notified of significant changes through in-app notifications or email.",
        ),
      },
    ],
  },
  {
    title: tr("ติดต่อเรา", "Contact us"),
    blocks: [
      {
        kind: "lines",
        lines: [
          "atlasplatform.in.th",
          tr(
            "อีเมล: healthflowdevteam@gmail.com",
            "Email: healthflowdevteam@gmail.com",
          ),
          tr(
            "เว็บไซต์: https://atlasplatform.in.th",
            "Website: https://atlasplatform.in.th",
          ),
        ],
      },
    ],
  },
];

/** The document's closing statement, set below the last clause. */
export const POLICY_NOTE =
  tr(
    "แอปพลิเคชันนี้ปฏิบัติตามนโยบายแอปด้านสุขภาพของ Google Play และแนวทางด้านความเป็นส่วนตัวของ Apple App Store และมีไว้สำหรับบุคลากรทางการแพทย์เท่านั้น ไม่ได้เผยแพร่แก่ประชาชนทั่วไป",
    "This application complies with Google Play's health app policies and the Apple App Store's privacy guidelines. It is intended for healthcare professionals only and is not distributed to the general public.",
  );
