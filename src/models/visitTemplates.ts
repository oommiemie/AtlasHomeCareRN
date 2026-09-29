/**
 * Templates for the home-visit note.
 *
 * A round repeats itself: the same kind of visit, on the same kind of
 * patient, produces much the same note with a few numbers changed. A
 * template carries everything that is typical — what kind of visit, how
 * dependent the patient is, what the house was like, and the paragraphs
 * of history, examination, problems, plan and advice — so the carer
 * writes over a draft instead of a blank page.
 *
 * What a template deliberately does NOT carry is anything that belongs to
 * this visit alone: the summary of what was found, the photographs, and
 * the signature. Those are the record of *this* house on *this* day, and
 * a template that filled them in would be putting words in the carer's
 * mouth and somebody else's name on a signature line.
 */
import { tr } from "../i18n";

/*
  The choices — `kind`, `dependency`, `adherence` — are the form's own values
  and stay Thai in both languages; the form translates them where it shows
  them. Everything written in prose is in the language on screen.
*/
export type VisitTemplate = {
  id: string;
  name: string;
  /** What kind of note this is, for the list. */
  detail: string;
  fields: {
    kind?: string;
    dependency?: string;
    adherence?: string;
    /** Keys from HOME_CHECKS to tick. */
    checks?: string[];
    caregiver?: string;
    history?: string;
    exam?: string;
    psychosocial?: string;
    problems?: string;
    plan?: string;
    advice?: string;
  };
};

export const VISIT_TEMPLATES: VisitTemplate[] = [
  {
    id: "ncd",
    name: tr(
      "เยี่ยมติดตามผู้ป่วยเบาหวาน/ความดัน",
      "Diabetes / hypertension follow-up visit",
    ),
    detail: tr(
      "ติดตามอาการ · ติดสังคม · เน้นการกินยาและคุมอาหาร",
      "Follow-up · Socially active · Focus on medication and diet",
    ),
    fields: {
      kind: "เยี่ยมต่อเนื่อง",
      dependency: "ติดสังคม",
      adherence: "กินยาสม่ำเสมอ",
      checks: ["clean", "safe", "water", "toilet", "caregiver"],
      history: tr(
        "ผู้ป่วยโรคเรื้อรังรับยาต่อเนื่อง มาตามนัดติดตาม ไม่มีอาการเฉียบพลัน ปฏิเสธเจ็บแน่นหน้าอก ใจสั่น หน้ามืด ชาปลายมือปลายเท้า",
        "Chronic disease patient on continuing medication, seen for scheduled follow-up. No acute symptoms. Denies chest pain or tightness, palpitations, presyncope, or numbness of hands and feet.",
      ),
      exam: tr(
        "รู้สึกตัวดี พูดคุยรู้เรื่อง ช่วยเหลือตัวเองได้ ไม่มีบวมกดบุ๋ม ผิวหนังปกติ ตรวจเท้าไม่พบแผลหรือรอยกดทับ",
        "Alert and oriented, communicates normally, independent in self-care. No pitting edema. Skin normal. Foot exam shows no wounds or pressure marks.",
      ),
      psychosocial: tr(
        "อารมณ์ปกติ อยู่กับครอบครัว มีผู้ดูแลช่วยเตือนเรื่องยาและพาไปตามนัด",
        "Mood normal. Lives with family; caregiver reminds about medication and brings the patient to appointments.",
      ),
      problems: tr(
        "ควบคุมระดับน้ำตาลและความดันยังไม่ถึงเป้าหมาย เสี่ยงต่อภาวะแทรกซ้อนระยะยาว",
        "Blood glucose and blood pressure not yet at target; at risk of long-term complications.",
      ),
      plan: tr(
        "ทบทวนการใช้ยาและเทคนิคการกินยา ตรวจน้ำตาลปลายนิ้ว วัดความดัน นัดติดตามซ้ำตามแผน",
        "Review medications and how they are taken, check capillary blood glucose, measure blood pressure, schedule follow-up as planned.",
      ),
      advice: tr(
        "แนะนำลดหวาน มัน เค็ม ออกกำลังกายเบาๆ วันละ 30 นาที กินยาตรงเวลา และมาพบแพทย์ทันทีเมื่อมีอาการผิดปกติ",
        "Advised to cut down on sugar, fat and salt, do light exercise 30 minutes a day, take medication on time, and see a doctor promptly if anything unusual occurs.",
      ),
    },
  },
  {
    id: "bedbound",
    name: tr("เยี่ยมผู้ป่วยติดเตียง", "Bedbound patient visit"),
    detail: tr(
      "ติดตามอาการ · ติดเตียง · เน้นแผลกดทับและผู้ดูแล",
      "Follow-up · Bedbound · Focus on pressure injuries and caregiver",
    ),
    fields: {
      kind: "เยี่ยมต่อเนื่อง",
      dependency: "ติดเตียง",
      adherence: "กินยาสม่ำเสมอ",
      checks: ["clean", "safe", "caregiver"],
      history: tr(
        "ผู้ป่วยนอนติดเตียง ช่วยเหลือตัวเองไม่ได้ ผู้ดูแลพลิกตะแคงตัวทุก 2 ชั่วโมง ให้อาหารและยาตามแผน ไม่มีไข้ ไม่มีสำลัก",
        "Bedbound, fully dependent. Caregiver repositions every 2 hours and gives feeds and medication as planned. No fever, no aspiration.",
      ),
      exam: tr(
        "รู้สึกตัว ตอบสนองต่อเสียงเรียก ผิวหนังบริเวณปุ่มกระดูกไม่แดง ไม่พบแผลกดทับใหม่ ปอดทั้งสองข้างเสียงหายใจปกติ",
        "Conscious, responds to voice. No redness over bony prominences, no new pressure injuries. Normal breath sounds in both lungs.",
      ),
      psychosocial: tr(
        "ผู้ดูแลเป็นบุตรหลาน ดูแลต่อเนื่อง มีภาระงานมาก ควรประเมินความเหนื่อยล้าของผู้ดูแล",
        "Caregiver is a child/grandchild providing continuous care with a heavy workload; caregiver burden should be assessed.",
      ),
      problems: tr(
        "เสี่ยงต่อแผลกดทับ ปอดอักเสบจากการสำลัก และภาวะเครียดของผู้ดูแล",
        "At risk of pressure injuries, aspiration pneumonia, and caregiver stress.",
      ),
      plan: tr(
        "สอนและทบทวนการพลิกตะแคงตัว การดูแลผิวหนัง การให้อาหารทางสายยาง และนัดเยี่ยมซ้ำ",
        "Teach and review repositioning, skin care and tube feeding; schedule a repeat visit.",
      ),
      advice: tr(
        "แนะนำพลิกตัวทุก 2 ชั่วโมง ดูแลที่นอนให้แห้งสะอาด ยกหัวเตียงขณะให้อาหาร และแจ้งทีมทันทีเมื่อมีไข้หรือแผลแดง",
        "Advised to reposition every 2 hours, keep bedding clean and dry, raise the head of the bed during feeds, and alert the team at once if there is fever or skin redness.",
      ),
    },
  },
  {
    id: "wound",
    name: tr("เยี่ยมทำแผลที่บ้าน", "Home wound care visit"),
    detail: tr(
      "ติดตามอาการ · ติดบ้าน · เน้นการดูแลแผล",
      "Follow-up · Homebound · Focus on wound care",
    ),
    fields: {
      kind: "เยี่ยมต่อเนื่อง",
      dependency: "ติดบ้าน",
      adherence: "กินยาสม่ำเสมอ",
      checks: ["clean", "safe", "water", "caregiver"],
      history: tr(
        "มาทำแผลตามนัด ผู้ป่วยไม่มีไข้ ปวดแผลเล็กน้อย ไม่มีหนองหรือกลิ่นเหม็น",
        "Scheduled wound dressing. No fever, mild wound pain, no pus or odor.",
      ),
      exam: tr(
        "แผลขอบเรียบ พื้นแผลสีแดงดี มี granulation tissue ไม่มีเนื้อตาย รอบแผลไม่บวมแดง",
        "Wound edges smooth, healthy red wound bed with granulation tissue, no necrotic tissue, no surrounding swelling or redness.",
      ),
      psychosocial: tr(
        "ผู้ป่วยและญาติให้ความร่วมมือในการดูแลแผลดี",
        "Patient and family cooperate well with wound care.",
      ),
      problems: tr(
        "แผลเรื้อรังต้องการการทำแผลต่อเนื่องและเฝ้าระวังการติดเชื้อ",
        "Chronic wound requiring ongoing dressing and monitoring for infection.",
      ),
      plan: tr(
        "ทำแผลด้วยเทคนิคปลอดเชื้อ ประเมินขนาดแผลทุกครั้ง และนัดทำแผลครั้งต่อไป",
        "Dress the wound using aseptic technique, measure the wound each visit, and schedule the next dressing.",
      ),
      advice: tr(
        "แนะนำให้แผลแห้งสะอาด ไม่แกะเกา กินอาหารโปรตีนสูง และแจ้งทันทีเมื่อแผลบวมแดงหรือมีไข้",
        "Advised to keep the wound clean and dry, not to pick or scratch it, eat a high-protein diet, and report at once if the wound becomes swollen or red or there is fever.",
      ),
    },
  },
  {
    id: "psych",
    name: tr("เยี่ยมผู้ป่วยจิตเวชในชุมชน", "Community mental health visit"),
    detail: tr(
      "ติดตามอาการ · ติดสังคม · เน้นอาการทางจิตและการกินยา",
      "Follow-up · Socially active · Focus on psychiatric symptoms and medication",
    ),
    fields: {
      kind: "เยี่ยมต่อเนื่อง",
      dependency: "ติดสังคม",
      adherence: "กินยาไม่สม่ำเสมอ",
      checks: ["clean", "safe", "caregiver"],
      history: tr(
        "ติดตามการรักษาต่อเนื่อง ประเมินอาการทางจิตปัจจุบัน ปฏิเสธหูแว่ว หลงผิด หวาดระแวง",
        "Continuing treatment follow-up; current psychiatric symptoms assessed. Denies auditory hallucinations, delusions or paranoia.",
      ),
      exam: tr(
        "รูปร่างหน้าตาสะอาดเรียบร้อย พูดคุยรู้เรื่อง ความคิดเป็นระบบ ไม่มีความคิดทำร้ายตนเองหรือผู้อื่น",
        "Clean and well groomed, communicates coherently, organized thought, no thoughts of harming self or others.",
      ),
      psychosocial: tr(
        "สภาวะอารมณ์คงที่ อยู่กับครอบครัว ชุมชนยอมรับ มีกิจกรรมทำในบ้าน",
        "Mood stable. Lives with family, accepted by the community, has activities at home.",
      ),
      problems: tr(
        "เสี่ยงต่อการขาดยาและอาการกำเริบ",
        "At risk of stopping medication and relapse.",
      ),
      plan: tr(
        "ทบทวนการกินยา นับเม็ดยาคงเหลือ ประสานแพทย์เมื่อพบอาการกำเริบ และนัดเยี่ยมซ้ำ",
        "Review medication taking, count remaining pills, contact the doctor if symptoms relapse, and schedule a repeat visit.",
      ),
      advice: tr(
        "แนะนำกินยาต่อเนื่อง งดสุราและสารเสพติด นอนหลับให้เพียงพอ และติดต่อทีมเมื่ออาการเปลี่ยนแปลง",
        "Advised to keep taking medication, avoid alcohol and drugs, get enough sleep, and contact the team if symptoms change.",
      ),
    },
  },
  {
    id: "first",
    name: tr(
      "เยี่ยมครั้งแรกหลังจำหน่ายจากโรงพยาบาล",
      "First visit after hospital discharge",
    ),
    detail: tr(
      "เยี่ยมครั้งแรก · ประเมินบ้านและความพร้อมผู้ดูแล",
      "First visit · Assess the home and caregiver readiness",
    ),
    fields: {
      kind: "เยี่ยมหลัง D/C",
      dependency: "ติดบ้าน",
      adherence: "กินยาสม่ำเสมอ",
      checks: ["clean", "safe", "water", "toilet", "caregiver"],
      history: tr(
        "เยี่ยมครั้งแรกหลังจำหน่าย ประเมินอาการหลังกลับบ้าน ผู้ป่วยพักฟื้นได้ ไม่มีภาวะแทรกซ้อน",
        "First visit after discharge; condition assessed since returning home. Recovering well, no complications.",
      ),
      exam: tr(
        "สัญญาณชีพอยู่ในเกณฑ์ ช่วยเหลือตัวเองได้บางส่วน ต้องการผู้ช่วยในกิจวัตรบางอย่าง",
        "Vital signs within normal limits. Partly independent; needs help with some daily activities.",
      ),
      psychosocial: tr(
        "ครอบครัวพร้อมดูแล เข้าใจแผนการรักษา มีคำถามเรื่องการใช้ยาและอุปกรณ์",
        "Family ready to provide care and understands the treatment plan; has questions about medications and equipment.",
      ),
      problems: tr(
        "ยังปรับตัวกับการดูแลที่บ้าน ต้องการความรู้และอุปกรณ์เพิ่มเติม",
        "Still adjusting to care at home; needs more information and equipment.",
      ),
      plan: tr(
        "ประเมินบ้านและความพร้อมผู้ดูแล สอนการดูแลพื้นฐาน จัดหาอุปกรณ์ที่จำเป็น และวางแผนเยี่ยมครั้งถัดไป",
        "Assess the home and caregiver readiness, teach basic care, arrange necessary equipment, and plan the next visit.",
      ),
      advice: tr(
        "แนะนำการจัดบ้านให้ปลอดภัย ป้องกันการล้ม กินยาตามแพทย์สั่ง และมาตามนัดทุกครั้ง",
        "Advised on making the home safe and preventing falls, taking medication as prescribed, and keeping every appointment.",
      ),
    },
  },
];

export function searchTemplates(q: string): VisitTemplate[] {
  const k = q.trim().toLowerCase();
  if (k === "") return VISIT_TEMPLATES;
  return VISIT_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(k) ||
      t.detail.toLowerCase().includes(k) ||
      Object.values(t.fields).some(
        (v) => typeof v === "string" && v.toLowerCase().includes(k),
      ),
  );
}
