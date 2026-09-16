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
    name: "เยี่ยมติดตามผู้ป่วยเบาหวาน/ความดัน",
    detail: "ติดตามอาการ · ติดสังคม · เน้นการกินยาและคุมอาหาร",
    fields: {
      kind: "ติดตามอาการ",
      dependency: "ติดสังคม",
      adherence: "กินยาสม่ำเสมอ",
      checks: ["clean", "safe", "water", "toilet", "caregiver"],
      history:
        "ผู้ป่วยโรคเรื้อรังรับยาต่อเนื่อง มาตามนัดติดตาม ไม่มีอาการเฉียบพลัน ปฏิเสธเจ็บแน่นหน้าอก ใจสั่น หน้ามืด ชาปลายมือปลายเท้า",
      exam:
        "รู้สึกตัวดี พูดคุยรู้เรื่อง ช่วยเหลือตัวเองได้ ไม่มีบวมกดบุ๋ม ผิวหนังปกติ ตรวจเท้าไม่พบแผลหรือรอยกดทับ",
      psychosocial: "อารมณ์ปกติ อยู่กับครอบครัว มีผู้ดูแลช่วยเตือนเรื่องยาและพาไปตามนัด",
      problems: "ควบคุมระดับน้ำตาลและความดันยังไม่ถึงเป้าหมาย เสี่ยงต่อภาวะแทรกซ้อนระยะยาว",
      plan: "ทบทวนการใช้ยาและเทคนิคการกินยา ตรวจน้ำตาลปลายนิ้ว วัดความดัน นัดติดตามซ้ำตามแผน",
      advice:
        "แนะนำลดหวาน มัน เค็ม ออกกำลังกายเบาๆ วันละ 30 นาที กินยาตรงเวลา และมาพบแพทย์ทันทีเมื่อมีอาการผิดปกติ",
    },
  },
  {
    id: "bedbound",
    name: "เยี่ยมผู้ป่วยติดเตียง",
    detail: "ติดตามอาการ · ติดเตียง · เน้นแผลกดทับและผู้ดูแล",
    fields: {
      kind: "ติดตามอาการ",
      dependency: "ติดเตียง",
      adherence: "กินยาสม่ำเสมอ",
      checks: ["clean", "safe", "caregiver"],
      history:
        "ผู้ป่วยนอนติดเตียง ช่วยเหลือตัวเองไม่ได้ ผู้ดูแลพลิกตะแคงตัวทุก 2 ชั่วโมง ให้อาหารและยาตามแผน ไม่มีไข้ ไม่มีสำลัก",
      exam:
        "รู้สึกตัว ตอบสนองต่อเสียงเรียก ผิวหนังบริเวณปุ่มกระดูกไม่แดง ไม่พบแผลกดทับใหม่ ปอดทั้งสองข้างเสียงหายใจปกติ",
      psychosocial: "ผู้ดูแลเป็นบุตรหลาน ดูแลต่อเนื่อง มีภาระงานมาก ควรประเมินความเหนื่อยล้าของผู้ดูแล",
      problems: "เสี่ยงต่อแผลกดทับ ปอดอักเสบจากการสำลัก และภาวะเครียดของผู้ดูแล",
      plan: "สอนและทบทวนการพลิกตะแคงตัว การดูแลผิวหนัง การให้อาหารทางสายยาง และนัดเยี่ยมซ้ำ",
      advice:
        "แนะนำพลิกตัวทุก 2 ชั่วโมง ดูแลที่นอนให้แห้งสะอาด ยกหัวเตียงขณะให้อาหาร และแจ้งทีมทันทีเมื่อมีไข้หรือแผลแดง",
    },
  },
  {
    id: "wound",
    name: "เยี่ยมทำแผลที่บ้าน",
    detail: "ติดตามอาการ · ติดบ้าน · เน้นการดูแลแผล",
    fields: {
      kind: "ติดตามอาการ",
      dependency: "ติดบ้าน",
      adherence: "กินยาสม่ำเสมอ",
      checks: ["clean", "safe", "water", "caregiver"],
      history: "มาทำแผลตามนัด ผู้ป่วยไม่มีไข้ ปวดแผลเล็กน้อย ไม่มีหนองหรือกลิ่นเหม็น",
      exam: "แผลขอบเรียบ พื้นแผลสีแดงดี มี granulation tissue ไม่มีเนื้อตาย รอบแผลไม่บวมแดง",
      psychosocial: "ผู้ป่วยและญาติให้ความร่วมมือในการดูแลแผลดี",
      problems: "แผลเรื้อรังต้องการการทำแผลต่อเนื่องและเฝ้าระวังการติดเชื้อ",
      plan: "ทำแผลด้วยเทคนิคปลอดเชื้อ ประเมินขนาดแผลทุกครั้ง และนัดทำแผลครั้งต่อไป",
      advice: "แนะนำให้แผลแห้งสะอาด ไม่แกะเกา กินอาหารโปรตีนสูง และแจ้งทันทีเมื่อแผลบวมแดงหรือมีไข้",
    },
  },
  {
    id: "psych",
    name: "เยี่ยมผู้ป่วยจิตเวชในชุมชน",
    detail: "ติดตามอาการ · ติดสังคม · เน้นอาการทางจิตและการกินยา",
    fields: {
      kind: "ติดตามอาการ",
      dependency: "ติดสังคม",
      adherence: "กินยาไม่สม่ำเสมอ",
      checks: ["clean", "safe", "caregiver"],
      history: "ติดตามการรักษาต่อเนื่อง ประเมินอาการทางจิตปัจจุบัน ปฏิเสธหูแว่ว หลงผิด หวาดระแวง",
      exam: "รูปร่างหน้าตาสะอาดเรียบร้อย พูดคุยรู้เรื่อง ความคิดเป็นระบบ ไม่มีความคิดทำร้ายตนเองหรือผู้อื่น",
      psychosocial: "สภาวะอารมณ์คงที่ อยู่กับครอบครัว ชุมชนยอมรับ มีกิจกรรมทำในบ้าน",
      problems: "เสี่ยงต่อการขาดยาและอาการกำเริบ",
      plan: "ทบทวนการกินยา นับเม็ดยาคงเหลือ ประสานแพทย์เมื่อพบอาการกำเริบ และนัดเยี่ยมซ้ำ",
      advice: "แนะนำกินยาต่อเนื่อง งดสุราและสารเสพติด นอนหลับให้เพียงพอ และติดต่อทีมเมื่ออาการเปลี่ยนแปลง",
    },
  },
  {
    id: "first",
    name: "เยี่ยมครั้งแรกหลังจำหน่ายจากโรงพยาบาล",
    detail: "เยี่ยมครั้งแรก · ประเมินบ้านและความพร้อมผู้ดูแล",
    fields: {
      kind: "เยี่ยมครั้งแรก",
      dependency: "ติดบ้าน",
      adherence: "กินยาสม่ำเสมอ",
      checks: ["clean", "safe", "water", "toilet", "caregiver"],
      history: "เยี่ยมครั้งแรกหลังจำหน่าย ประเมินอาการหลังกลับบ้าน ผู้ป่วยพักฟื้นได้ ไม่มีภาวะแทรกซ้อน",
      exam: "สัญญาณชีพอยู่ในเกณฑ์ ช่วยเหลือตัวเองได้บางส่วน ต้องการผู้ช่วยในกิจวัตรบางอย่าง",
      psychosocial: "ครอบครัวพร้อมดูแล เข้าใจแผนการรักษา มีคำถามเรื่องการใช้ยาและอุปกรณ์",
      problems: "ยังปรับตัวกับการดูแลที่บ้าน ต้องการความรู้และอุปกรณ์เพิ่มเติม",
      plan: "ประเมินบ้านและความพร้อมผู้ดูแล สอนการดูแลพื้นฐาน จัดหาอุปกรณ์ที่จำเป็น และวางแผนเยี่ยมครั้งถัดไป",
      advice: "แนะนำการจัดบ้านให้ปลอดภัย ป้องกันการล้ม กินยาตามแพทย์สั่ง และมาตามนัดทุกครั้ง",
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
      Object.values(t.fields).some((v) => typeof v === "string" && v.toLowerCase().includes(k)),
  );
}
