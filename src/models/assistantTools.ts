/**
 * What the assistant may look up, and what it may offer to do.
 *
 * The model on the cluster is given these as tools and decides, question by
 * question, which records it needs — a patient's medicines, how her blood
 * sugar has run this month, what the last visit found — instead of the app
 * guessing from the wording which block of facts to hand over. That is what
 * lets it answer the questions nobody wrote a pattern for.
 *
 * The rule the rest of the assistant keeps is kept here too: the model
 * chooses what to look up, the app does the looking. Every count, average,
 * trend and date in a tool's answer is worked out on the phone from the same
 * records the screens draw, so a figure in a reply is a figure the carer can
 * find. Nothing here writes anything; the "action" tool only puts a button
 * under the answer, and nothing happens until the carer presses it.
 *
 * Pure: no navigation, no file system — the screen turns an action into a
 * route when it is pressed (see `AssistantScreen`).
 */
import { planToday } from "./clock";
import { treatmentHistory } from "./community";
import { followUpPatients, followUpStateOf, daysSinceAssessed } from "./followUp";
import { everyResident, residentById, houseOfResident, type Resident } from "./household";
import { DRUGS, SERVICES, allergyHit, dispensingHistory, searchDrugs } from "./medication";
import { currentNotes } from "./notes";
import { currentSupplies, DELIVERY_LABEL } from "./supplies";
import { searchEverything } from "./spotlight";
import { detailFor } from "./patientDetail";
import { assessmentsFor, visitsFor as recordVisits } from "./residentRecord";
import {
  hasLocation,
  isDone,
  visitStateOf,
  yearTasks,
  type Task,
} from "./task";
import { ACTIVITIES, openSessionNow, tally } from "./vaccination";
import {
  METRICS,
  abnormalNow,
  formatReading,
  latestVitals,
  metricOf,
  readingsFor,
  statusOf,
  summarise,
  type MetricKind,
} from "./vitals";
import {
  isSameDay,
  startOfDay,
  thaiFullDate,
  thaiShortDate,
  thaiTime,
} from "../utils/thaiDate";

/* ------------------------------------------------------------- actions */

/**
 * Something the answer offers to do, as a button under it.
 *
 * Held as ids, like everything else on a turn: the thread is written to
 * disk, and the patient or visit is looked up again when it is pressed.
 */
export type AssistantAction = {
  kind:
    | "open_patient"
    | "open_health"
    | "call"
    | "navigate"
    | "start_visit"
    | "plan_route"
    | "open_household"
    | "call_caregiver";
  residentId?: string;
  taskId?: string;
};

/** What a tool adds under the answer, beside the words. */
export type ToolEffects = {
  /**
   * Who the answer turned out to be about — what "and her medicines?" is
   * asked against next. Not a card on its own.
   */
  subject?: string;
  /** One person's latest readings, as the health card. */
  resident?: string;
  /** People listed, worst first. */
  residents?: string[];
  /** Visits to show as cards. */
  visits?: string[];
  actions?: AssistantAction[];
  /** Which tools were run — what the answer was looked up from. */
  used?: string[];
};

/**
 * The tools a question plainly needs, run before the model is asked.
 *
 * The model is offered every tool and usually picks well, but not always:
 * asked what a named man takes, it would sometimes answer from the round's
 * facts that there was nothing on file rather than look. So the obvious
 * look-ups are done up front — his medicines when medicines are asked
 * about, the last visit when that is — and handed over with the facts. It
 * can still call anything else it wants.
 */
export function prefetchFor(
  question: string,
  residentId: string | undefined,
): { name: string; args: Record<string, unknown> }[] {
  const q = question.toLowerCase();
  const out: { name: string; args: Record<string, unknown> }[] = [];
  const who = residentId != null ? { resident_id: residentId } : null;
  if (who != null) {
    // "ให้ยา X ได้ไหม", "แพ้ยา X ไหม": the drug named, against her allergies.
    const drug =
      /(?:ให้|กิน|ทาน|ใช้|แพ้)ยา\s*([^\s?]+?)(?:\s|กับ|ได้|ไหม|มั้ย|หรือ|$)/.exec(q)?.[1] ??
      /\b(?:give|take|allergic to)\s+([a-z][a-z-]+)/.exec(q)?.[1];
    if (drug != null && !/อะไร|ตัวไหน|ไหน/.test(drug))
      out.push({ name: "check_allergy", args: { ...who, drug } });
    else if (/ยา|medic|drug|prescri|tablet|pill/.test(q))
      out.push({ name: "medication_history", args: who });
    if (/ครั้งก่อน|ครั้งที่แล้ว|ครั้งล่าสุด|ประวัติการรักษา|แผนการ|วางแผน|แล็บ|ผลตรวจ|last visit|previous visit|history|plan|lab/.test(q))
      out.push({ name: "treatment_history", args: who });
    if (/แพ้|โรค|ประวัติ|สรุป|ผู้ดูแล|อุปกรณ์|adl|ข้อมูล|เบอร์|โทรศัพท์|ติดต่อ|ที่อยู่|อายุ|hn|allerg|condition|record|summar|caregiver|equipment|phone|number|contact|address|age/.test(q))
      out.push({ name: "patient_record", args: who });
    const metric = (
      [
        [/ความดัน|blood pressure|\bbp\b/, "bp"],
        [/cgm|น้ำตาลต่อเนื่อง/, "cgm"],
        [/น้ำตาล|sugar|glucose/, "glucose"],
        [/ออกซิเจน|oxygen|spo2/, "spo2"],
        [/ชีพจร|pulse|heart rate/, "pulse"],
        [/อุณหภูมิ|ไข้|temperature|fever/, "temp"],
        [/รอบเอว|waist/, "waist"],
      ] as const
    ).find(([re]) => re.test(q))?.[1];
    // "Call her caregiver": the caregiver's number is not hers, and the
    // model kept offering the patient's.
    if (/ผู้ดูแล|caregiver/.test(q) && /โทร|ติดต่อ|call|ring|phone/.test(q))
      out.push({ name: "offer_action", args: { ...who, kind: "call_caregiver" } });
    if (/เตรียม|ต้องเอาอะไร|เอาอะไรไป|ก่อนไป|ต้องระวังอะไร|prepare|bring|before (i|the) visit/.test(q))
      out.push({ name: "prepare_visit", args: who });
    if (/ในบ้าน|ครอบครัว|สมาชิก|อยู่กับใคร|household|family|lives with/.test(q))
      out.push({ name: "household", args: who });
    if (/แบบประเมิน|ผลประเมิน|ประเมิน|คะแนน|adl|assessment|score/.test(q))
      out.push({ name: "assessment_history", args: who });
    if (/ดีขึ้น|แย่ลง|เทียบ|เปรียบเทียบ|กว่าเดิม|improv|worse|better|compare/.test(q)) {
      const m2 = /ความดัน|bp|blood pressure/.test(q) ? "bp" : /น้ำตาล|sugar|glucose/.test(q) ? "glucose" : /ออกซิเจน|oxygen|spo2/.test(q) ? "spo2" : /ชีพจร|pulse/.test(q) ? "pulse" : null;
      if (m2 != null)
        out.push({ name: "compare_vitals", args: { ...who, metric: m2, days: /สัปดาห์|week/.test(q) ? 7 : 30 } });
    }
    if (metric != null && /ช่วงนี้|แนวโน้ม|เดือน|สัปดาห์|ย้อนหลัง|ที่ผ่านมา|เฉลี่ย|สูงสุด|ต่ำสุด|กี่ครั้ง|ล่าสุด|เท่าไหร่|เท่าไร|เป็นยังไง|เป็นอย่างไร|lately|trend|month|week|recent|past|average|highest|lowest|latest|how (has|is|much|many)|what (is|was)/.test(q)) {
      // "30 วันที่ผ่านมา", "two weeks": the span the question names.
      const n = Number(/(\d+)\s*(วัน|day)/.exec(q)?.[1]);
      const days = Number.isFinite(n) && n > 0
        ? n
        : /สองสัปดาห์|2 สัปดาห์|two weeks/.test(q) ? 14
        : /สัปดาห์|week/.test(q) ? 7
        : /สามเดือน|3 เดือน|three months/.test(q) ? 90
        : 30;
      out.push({ name: "vital_trend", args: { ...who, metric, days } });
    }
  }
  if (/วัคซีน|คลินิก|ทันต|พัฒนาการ|กิจกรรม|vaccin|clinic|dental|activit/.test(q))
    out.push({ name: "care_activities", args: {} });
  if (/ส่งเวร|สรุปงานวันนี้|สรุปวันนี้|เลิกงาน|handover|hand over|end of (the )?day|end of shift/.test(q))
    out.push({ name: "handover_summary", args: {} });
  if (/ของที่ต้องส่ง|ส่งของ|เวชภัณฑ์|ผ้าอ้อม|supplies|deliver/.test(q))
    out.push({ name: "supplies", args: residentId != null ? { resident_id: residentId } : {} });
  if (/ฉีดไปกี่|ทำไปกี่|คลินิกที่เปิด|กำลังฉีด|session|how many (have|are) (done|vaccinated)/.test(q))
    out.push({ name: "vaccine_session", args: {} });
  if (/กลุ่มติดตาม|ติดตาม|follow.?up/.test(q))
    out.push({ name: "follow_up_list", args: {} });
  if (/เริ่มจากใคร|เริ่มที่ใคร|ใครก่อน|ลำดับความสำคัญ|สรุปเช้า|สรุปภาพรวม|start with|prioriti|morning brief/.test(q))
    out.push({ name: "daily_brief", args: {} });
  return out;
}

/* --------------------------------------------------------------- tools */

type ToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

const tool = (
  name: string,
  description: string,
  properties: Record<string, unknown> = {},
  required: string[] = [],
): ToolDef => ({
  type: "function",
  function: {
    name,
    description,
    parameters: { type: "object", properties, required },
  },
});

const RID = {
  resident_id: {
    type: "string",
    description: "รหัสผู้ป่วย (resident id) ที่ได้จาก find_patient หรือจากข้อมูลที่ให้มา",
  },
};

/** The tools, as the chat-completions API takes them. */
export const TOOLS: ToolDef[] = [
  tool(
    "find_patient",
    "ค้นหาผู้ป่วยจากชื่อหรือบางส่วนของชื่อ ได้รหัสผู้ป่วยกลับมาเพื่อใช้กับเครื่องมืออื่น ใช้เมื่อคำถามเอ่ยชื่อคนที่ยังไม่รู้รหัส ชื่อในระบบเป็นอักษรไทยทั้งหมด",
    {
      name: {
        type: "string",
        description:
          "ชื่อ นามสกุล หรือชื่อเล่นที่ถูกถามถึง เป็นอักษรไทยเสมอ ถ้าคำถามเขียนชื่อเป็นอักษรโรมัน เช่น Manop Yingcharoen ให้ถอดกลับเป็นอักษรไทย (มานพ ยิ่งเจริญ) ก่อนค้นหา",
      },
    },
    ["name"],
  ),
  tool(
    "patient_record",
    "เวชระเบียนของผู้ป่วยหนึ่งคน: โรค การแพ้ยา หมายเหตุแพทย์ ADL ผู้ดูแล อุปกรณ์ ข้อควรระวัง ค่าสุขภาพล่าสุดพร้อมคำตัดสิน นัดที่จะถึงและที่ผ่านมา และสถานะการติดตาม",
    RID,
    ["resident_id"],
  ),
  tool(
    "vital_trend",
    "แนวโน้มค่าสุขภาพหนึ่งชนิดของผู้ป่วยย้อนหลัง: ค่าล่าสุด เฉลี่ย สูงสุด ต่ำสุด จำนวนครั้งที่ผิดปกติ และทิศทาง",
    {
      ...RID,
      metric: {
        type: "string",
        enum: ["bp", "pulse", "temp", "spo2", "glucose", "cgm", "waist"],
        description: "bp ความดัน, pulse ชีพจร, temp อุณหภูมิ, spo2 ออกซิเจน, glucose น้ำตาล, cgm น้ำตาลต่อเนื่อง, waist รอบเอว",
      },
      days: { type: "integer", description: "ย้อนหลังกี่วัน ค่าเริ่มต้น 30" },
    },
    ["resident_id", "metric"],
  ),
  tool(
    "medication_history",
    "ประวัติการจ่ายยาและบริการของผู้ป่วย: ชื่อยา ขนาด วิธีใช้ จำนวนวัน แต่ละครั้งที่จ่าย",
    RID,
    ["resident_id"],
  ),
  tool(
    "treatment_history",
    "ประวัติการรักษาย้อนหลังของผู้ป่วย: แต่ละครั้งที่มารับบริการ อาการ สรุป สัญญาณชีพ แบบประเมิน ผลแล็บ และบันทึกเยี่ยมบ้าน (ปัญหา แผน คำแนะนำ)",
    { ...RID, limit: { type: "integer", description: "กี่ครั้งล่าสุด ค่าเริ่มต้น 3" } },
    ["resident_id"],
  ),
  tool(
    "visits",
    "รายการนัดเยี่ยมของพยาบาล ตามช่วงเวลา หรือเฉพาะของผู้ป่วยหนึ่งคน",
    {
      when: {
        type: "string",
        enum: ["today", "week", "overdue", "done_recent", "upcoming", "past"],
        description: "today วันนี้, week เจ็ดวันข้างหน้า, overdue เกินกำหนด, done_recent ทำเสร็จในเจ็ดวัน, upcoming ที่จะถึง, past ที่ผ่านมา",
      },
      resident_id: { type: "string", description: "ถ้าต้องการเฉพาะของผู้ป่วยคนนี้" },
    },
    ["when"],
  ),
  tool(
    "who_needs_attention",
    "ผู้ป่วยในรอบงานของพยาบาล (คนที่มีนัดวันนี้ หรือสัปดาห์นี้ถ้าวันนี้ไม่มีนัด) ที่ค่าสุขภาพล่าสุดหลุดเกณฑ์ เรียงจากน่าห่วงที่สุด เลือกเฉพาะค่าหนึ่งชนิดได้",
    {
      metric: {
        type: "string",
        enum: ["bp", "pulse", "temp", "spo2", "glucose", "cgm", "waist"],
      },
      scope: {
        type: "string",
        enum: ["mine", "all"],
        description: "mine ผู้ป่วยในรอบงานของพยาบาล (ค่าเริ่มต้น), all ทุกคนในเขต ใช้เฉพาะเมื่อถูกถามถึงทั้งเขตหรือทั้งหมู่บ้าน",
      },
    },
  ),
  tool(
    "follow_up_list",
    "ผู้ป่วยกลุ่มติดตาม (NCD/เสี่ยง) พร้อมสถานะ ต้องดูแลด่วน/เฝ้าระวัง/คงที่ และกี่วันแล้วที่ไม่ได้ประเมิน",
  ),
  tool(
    "care_activities",
    "กิจกรรมบริการเชิงรุกที่จะถึง เช่น คลินิกวัคซีน งานทันตสุขภาพ ตรวจพัฒนาการ ตรวจสุขภาพนักเรียน พร้อมวัน เวลา สถานที่ จำนวนเป้าหมาย",
    { days: { type: "integer", description: "ข้างหน้ากี่วัน ค่าเริ่มต้น 14" } },
  ),
  tool(
    "daily_brief",
    "สรุปเช้านี้: งานวันนี้ งานเกินกำหนด ผู้ป่วยที่ค่าผิดปกติ ผู้ป่วยติดตามที่ต้องดูด่วน และลำดับความสำคัญพร้อมเหตุผล ใช้เมื่อถูกขอให้สรุปภาพรวม หรือถามว่าควรเริ่มจากใคร",
  ),
  tool(
    "offer_action",
    "เสนอปุ่มให้พยาบาลกดทำต่อใต้คำตอบ (ไม่ได้ทำเอง ต้องให้พยาบาลกดยืนยัน) ใช้เมื่อคำตอบนำไปสู่การทำบางอย่างกับผู้ป่วย เช่น เปิดหน้าผู้ป่วย โทร นำทาง เริ่มบันทึกเยี่ยม วางเส้นทางรอบวันนี้ เรียกได้หลายครั้ง",
    {
      kind: {
        type: "string",
        enum: ["open_patient", "open_health", "call", "call_caregiver", "navigate", "start_visit", "plan_route", "open_household"],
        description: "open_patient เปิดหน้าผู้ป่วย/นัด, open_health เปิดหน้าค่าสุขภาพ, call โทรหาผู้ป่วย, call_caregiver โทรหาผู้ดูแลของผู้ป่วย, navigate นำทางไปบ้าน, start_visit เริ่มบันทึกเยี่ยมบ้าน, plan_route วางเส้นทางรอบวันนี้ (ไม่ต้องใส่ผู้ป่วย), open_household เปิดหน้าบ้านและสมาชิกในบ้าน",
      },
      ...RID,
    },
    ["kind"],
  ),
  tool(
    "prepare_visit",
    "เตรียมตัวก่อนไปเยี่ยมผู้ป่วยหนึ่งคน: นัดและเรื่องที่จะไปทำ สิ่งที่ต้องระวัง แพ้ยา อุปกรณ์ที่ใช้ ค่าที่ควรวัดซ้ำ ปัญหาและแผนจากครั้งก่อน แบบประเมินที่ถึงเวลา และของที่ต้องเอาไปส่ง ใช้เมื่อถามว่าต้องเตรียมอะไร ต้องเอาอะไรไป หรือไปบ้านนี้ต้องระวังอะไร",
    RID,
    ["resident_id"],
  ),
  tool(
    "compare_vitals",
    "เทียบค่าสุขภาพหนึ่งชนิดของผู้ป่วย ช่วงล่าสุดกับช่วงก่อนหน้าที่ยาวเท่ากัน ว่าดีขึ้นหรือแย่ลง (ค่าเฉลี่ย และสัดส่วนครั้งที่ผิดปกติ) ใช้เมื่อถามว่าดีขึ้นไหม แย่ลงไหม หรือเทียบกับเดือนก่อน",
    {
      ...RID,
      metric: {
        type: "string",
        enum: ["bp", "pulse", "temp", "spo2", "glucose", "cgm", "waist"],
      },
      days: { type: "integer", description: "ความยาวของแต่ละช่วง ค่าเริ่มต้น 30 วัน" },
    },
    ["resident_id", "metric"],
  ),
  tool(
    "household",
    "บ้านและสมาชิกในบ้านของผู้ป่วย: ที่อยู่ ใครอยู่บ้าง อายุ ค่าที่ผิดปกติ และสถานะการติดตามของแต่ละคน",
    RID,
    ["resident_id"],
  ),
  tool(
    "assessment_history",
    "ประวัติแบบประเมินของผู้ป่วย (ADL, ซึมเศร้า, หกล้ม, สมองเสื่อม ฯลฯ) พร้อมคะแนน ผล และวันที่ทำ",
    RID,
    ["resident_id"],
  ),
  tool(
    "search_notes",
    "ค้นสมุดจดบันทึกของพยาบาลในเครื่อง ด้วยคำค้น ได้ชื่อโน้ตและข้อความที่ตรง",
    { query: { type: "string", description: "คำค้น เช่น ชื่อผู้ป่วย หรือเรื่องที่จดไว้" } },
    ["query"],
  ),
  tool(
    "check_allergy",
    "ตรวจว่ายาที่ระบุตรงกับประวัติแพ้ยาของผู้ป่วยหรือไม่ ตามรายการยาของโรงพยาบาล ใช้เมื่อถามว่าให้ยานี้ได้ไหม หรือแพ้ยานี้ไหม",
    { ...RID, drug: { type: "string", description: "ชื่อยา ชื่อสามัญ หรือรหัสยา" } },
    ["resident_id", "drug"],
  ),
  tool(
    "supplies",
    "ของ/เวชภัณฑ์ที่ต้องเอาไปส่งผู้ป่วย: รอส่ง กำลังไปส่ง ส่งแล้ว ส่งไม่สำเร็จ พร้อมรายการของและวันที่ต้องส่ง",
    {
      state: {
        type: "string",
        enum: ["pending", "missed", "delivered", "all"],
        description: "pending ที่ยังต้องส่ง (ค่าเริ่มต้น), missed ส่งไม่สำเร็จ, delivered ส่งแล้ว, all ทั้งหมด",
      },
      resident_id: { type: "string", description: "ถ้าต้องการเฉพาะของผู้ป่วยคนนี้" },
    },
  ),
  tool(
    "vaccine_session",
    "ความคืบหน้าของคลินิกวัคซีน/กิจกรรมที่กำลังเปิดทำอยู่ตอนนี้: กิจกรรมอะไร ที่ไหน ทำไปกี่คน ขาด ปฏิเสธ เหลือกี่คน",
  ),
  tool(
    "handover_summary",
    "สรุปส่งเวรของวันนี้: เยี่ยมใครไปแล้ว ใครยังค้าง งานเกินกำหนด และผู้ป่วยที่ค่าผิดปกติที่ควรส่งต่อ ใช้เมื่อขอสรุปส่งเวร สรุปงานวันนี้ หรือรายงานตอนเลิกงาน",
  ),
  tool(
    "search_app",
    "ค้นทุกอย่างในแอปด้วยคำค้น: ผู้ป่วย บ้าน หมู่บ้าน นัด ภารกิจ เจ้าหน้าที่ สถานพยาบาล ใช้เมื่อเครื่องมืออื่นไม่ตรง",
    { query: { type: "string" } },
    ["query"],
  ),
];

/* ------------------------------------------------------------ helpers */

/**
 * A drug as a carer says it — what it is for, and the generic — rather
 * than the stock code the order carries ("MET500").
 */
function drugName(code: string): string {
  const d = DRUGS.find((x) => x.code === code);
  return d == null ? `ยา ${code}` : `${d.th} (${d.name})`;
}

function serviceName(code: string): string {
  const s = SERVICES.find((x) => x.code === code);
  return s == null ? code : s.name;
}

const nameOf = (r: Resident) => r.name;

/** The one visit an action about this person is about. */
function visitOf(residentId: string, now: Date): Task | undefined {
  const mine = yearTasks.filter((t) => t.residentId === residentId);
  const today = startOfDay(now).getTime();
  return (
    mine
      .filter((t) => !isDone(t) && t.dueAt.getTime() >= today)
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())[0] ??
    mine.sort((a, b) => b.dueAt.getTime() - a.dueAt.getTime())[0]
  );
}

function visitLine(t: Task, now: Date): string {
  const state = visitStateOf(t, now);
  const when = isSameDay(t.dueAt, now)
    ? `วันนี้ ${thaiTime(t.dueAt)}`
    : `${thaiShortDate(t.dueAt)} ${thaiTime(t.dueAt)}`;
  const label =
    state === "done" ? "เสร็จแล้ว" : state === "overdue" ? "เกินกำหนด" : "รอทำ";
  return `- [${t.id}] ${t.name} (รหัส ${t.residentId}) ${when} · ${t.detail} · ${label}`;
}

function vitalsLines(r: Resident, now: Date): string[] {
  const latest = latestVitals(r, now);
  const out: string[] = [];
  for (const m of METRICS) {
    const reading = latest[m.kind];
    if (reading == null) continue;
    const s = statusOf(m.kind, reading.value, reading.value2);
    out.push(
      `- ${m.name}: ${formatReading(m, reading)} ${m.unit} (${s.label}) วัดเมื่อ ${thaiShortDate(reading.at)}`,
    );
  }
  return out.length === 0 ? ["- ยังไม่มีค่าที่วัด"] : out;
}

const FOLLOW_LABEL = {
  attention: "ต้องดูแลด่วน",
  watch: "เฝ้าระวัง",
  stable: "คงที่",
} as const;

/* ------------------------------------------------------------- running */

/** What a tool returns: text for the model, and anything shown under it. */
export type ToolResult = { text: string; effects: ToolEffects };

const none = (text: string): ToolResult => ({ text, effects: {} });

/**
 * Run one tool call. Never throws: a bad call comes back as a sentence the
 * model can read and correct itself from.
 */
export function runTool(
  name: string,
  args: Record<string, unknown>,
  now: Date = planToday,
): ToolResult {
  try {
    return run(name, args, now);
  } catch {
    return none("เรียกเครื่องมือไม่สำเร็จ ลองใหม่ด้วยค่าที่ถูกต้อง");
  }
}

function personFrom(args: Record<string, unknown>): Resident | undefined {
  const id = typeof args.resident_id === "string" ? args.resident_id : "";
  return residentById(id);
}

const NO_ONE =
  "ไม่พบผู้ป่วยรหัสนี้ ให้ใช้ find_patient ค้นหาจากชื่อก่อน";

function run(
  name: string,
  args: Record<string, unknown>,
  now: Date,
): ToolResult {
  switch (name) {
    case "find_patient": {
      const q = String(args.name ?? "").trim().toLowerCase();
      if (q === "") return none("ไม่ได้ระบุชื่อ");
      // Each word of the name on its own as well as the whole: "ป้าสมศรี"
      // and "สมศรี ใจดี" should both find สมศรี.
      const words = q
        .replace(/^(คุณ|ป้า|ลุง|ยาย|ตา|น้า|พี่|น้อง|นาง|นาย|นางสาว)/, "")
        .split(/\s+/)
        .filter((w) => w.length >= 2);
      // Ranked, best fit only: the whole name, then every word of it, then
      // any word. "มานพ ยิ่งเจริญ" is one man; listing the fifteen other
      // มานพs and ยิ่งเจริญs with him buried him past the cut.
      // Folded (no tone marks, no spaces) so a name that came through
      // speech recognition as "มา นพ ยิงเจริญ" still finds him.
      const fold = (x: string) => x.toLowerCase().replace(/[\u0E47-\u0E4E\s]/g, "");
      const fq = fold(q.replace(/^(คุณ|ป้า|ลุง|ยาย|ตา|น้า|พี่|น้อง|นาง|นาย|นางสาว)/, ""));
      const fw = words.map(fold).filter((w) => w.length >= 2);
      const fit = (r: Resident) => {
        const n = fold(r.name);
        if (fq.length >= 3 && n.includes(fq)) return 3;
        if (fw.length > 1 && fw.every((w) => n.includes(w))) return 2;
        return fw.some((w) => n.includes(w)) ? 1 : 0;
      };
      const scored = everyResident.map((r) => ({ r, s: fit(r) }));
      const top = Math.max(0, ...scored.map((x) => x.s));
      const hits = top === 0 ? [] : scored.filter((x) => x.s === top).map((x) => x.r);
      if (hits.length === 0) return none(`ไม่พบผู้ป่วยชื่อ "${args.name}" ในระบบ`);
      // Which of them the carer is actually seeing: a name shared with a
      // stranger in another village is still, nearly always, the one on
      // the carer's own round.
      const mine = new Set(yearTasks.map((t) => t.residentId));
      const onRound = hits.filter((r) => mine.has(r.id));
      return none(
        [
          `พบ ${hits.length} คน:`,
          ...hits.slice(0, 8).map((r) => {
            const house = houseOfResident(r.id);
            const next = visitOf(r.id, now);
            return `- ${nameOf(r)} รหัส ${r.id} อายุ ${r.age} ปี${house ? ` ${house.number}` : ""}${mine.has(r.id) ? ` · อยู่ในรอบงานของพยาบาล${next ? ` นัดถัดไป ${thaiShortDate(next.dueAt)}` : ""}` : ""}`;
          }),
          hits.length > 1 && onRound.length === 1
            ? `มีคนเดียวที่อยู่ในรอบงานของพยาบาล คือ ${nameOf(onRound[0])} รหัส ${onRound[0].id} ให้ถือว่าหมายถึงคนนี้`
            : hits.length > 1
              ? "หลายคนชื่อนี้ ให้ถามกลับว่าหมายถึงคนไหน"
              : "",
        ]
          .filter((l) => l !== "")
          .join("\n"),
      );
    }

    case "patient_record": {
      const r = personFrom(args);
      if (r == null) return none(NO_ONE);
      const d = detailFor(r);
      const { upcoming, past } = recordVisits(r, now);
      const since = daysSinceAssessed(r, now);
      const house = houseOfResident(r.id);
      return {
        text: [
          `${nameOf(r)} รหัส ${r.id} อายุ ${r.age} ปี HN ${d.hn}`,
          `เบอร์โทร: ${r.phone || "ไม่มี"} · ผู้ดูแล ${d.caregiverName} เบอร์ ${d.caregiverPhone || "ไม่มี"}`,
          house ? `ที่อยู่: ${house.address} ${house.number}` : "",
          `โรค/ภาวะ: ${d.condition}`,
          `แพ้ยา: ${d.allergies}`,
          `หมายเหตุแพทย์: ${d.medicalNote}`,
          `ADL: ${d.adl}`,
          `ผู้ดูแล: ${d.caregiverName} (${d.caregiverRelation}) ความพร้อม ${d.caregiverReadiness}`,
          `อุปกรณ์: ${d.equipment} · การกิน: ${d.feeding} · ขับถ่าย: ${d.excretion}`,
          `ข้อควรระวัง: ${d.precautions}`,
          `สุขภาพจิต: ${d.mentalHealth} · สภาพบ้าน: ${d.homeEnvironment}`,
          `สถานะติดตาม: ${FOLLOW_LABEL[followUpStateOf(r, now)]}${since != null ? ` (ประเมินล่าสุด ${since} วันก่อน)` : " (ยังไม่เคยประเมิน)"}`,
          "ค่าสุขภาพล่าสุด:",
          ...vitalsLines(r, now),
          `นัดที่จะถึง ${upcoming.length} ครั้ง:`,
          ...upcoming.slice(0, 3).map((t) => visitLine(t, now)),
          `นัดที่ผ่านมา ${past.length} ครั้ง ล่าสุด:`,
          ...past.slice(0, 2).map((t) => visitLine(t, now)),
        ]
          .filter((l) => l !== "")
          .join("\n"),
        effects: { subject: r.id },
      };
    }

    case "vital_trend": {
      const r = personFrom(args);
      if (r == null) return none(NO_ONE);
      const kind = String(args.metric) as MetricKind;
      const m = metricOf(kind);
      if (m == null) return none("ไม่รู้จักค่าชนิดนี้");
      const days = Math.max(1, Math.min(365, Number(args.days ?? 30) || 30));
      const readings = readingsFor(r, kind, now, days);
      const s = summarise(kind, readings);
      if (s == null) return none(`${nameOf(r)} ไม่มีค่า${m.name}ในช่วง ${days} วัน`);
      const second = s.average2 != null ? `/${Math.round(s.average2)}` : "";
      const trend = s.trend === "up" ? "สูงขึ้น" : s.trend === "down" ? "ลดลง" : "คงที่";
      return {
        text: [
          `${m.name}ของ ${nameOf(r)} ย้อนหลัง ${days} วัน วัด ${s.count} ครั้ง`,
          s.latest
            ? `ล่าสุด ${formatReading(m, s.latest)} ${m.unit} (${statusOf(kind, s.latest.value, s.latest.value2).label}) เมื่อ ${thaiShortDate(s.latest.at)}`
            : "",
          `เฉลี่ย ${Math.round(s.average)}${second} ${m.unit} สูงสุด ${s.high} ต่ำสุด ${s.low}`,
          `ผิดปกติ ${s.outOfRange} จาก ${s.count} ครั้ง แนวโน้ม${trend}`,
        ]
          .filter((l) => l !== "")
          .join("\n"),
        effects: { resident: r.id, subject: r.id },
      };
    }

    case "medication_history": {
      const r = personFrom(args);
      if (r == null) return none(NO_ONE);
      const d = detailFor(r);
      const orders = dispensingHistory(d.hn);
      if (orders.length === 0) return none(`${nameOf(r)} ไม่มีประวัติการจ่ายยา`);
      return {
        text: [
          `ประวัติจ่ายยาของ ${nameOf(r)} (แพ้ยา: ${d.allergies})`,
          ...orders.slice(0, 4).map((o) =>
            [
              `- ${o.daysAgo} วันก่อน ที่ ${o.clinic} โดย ${o.prescriber}:`,
              ...o.lines.map((l) =>
                l.kind === "drug"
                  ? `    ${drugName(l.code)} ${l.dose} ${l.doseUnit} ${l.frequency} ${l.timing} ${l.days} วัน จำนวน ${l.qty}`
                  : `    บริการ ${serviceName(l.code)} x${l.qty}`,
              ),
            ].join("\n"),
          ),
        ].join("\n"),
        effects: { subject: r.id },
      };
    }

    case "treatment_history": {
      const r = personFrom(args);
      if (r == null) return none(NO_ONE);
      const d = detailFor(r);
      const limit = Math.max(1, Math.min(10, Number(args.limit ?? 3) || 3));
      const visits = treatmentHistory(d.hn).slice(0, limit);
      if (visits.length === 0) return none(`${nameOf(r)} ไม่มีประวัติการรักษา`);
      return {
        text: [
          `ประวัติการรักษาของ ${nameOf(r)} ${visits.length} ครั้งล่าสุด`,
          ...visits.map((v) =>
            [
              `- ${v.daysAgo} วันก่อน ที่ ${v.clinic} (${v.staff}): ${v.summary}`,
              v.complaint ? `    อาการ: ${v.complaint}` : "",
              v.vitals.length > 0
                ? `    สัญญาณชีพ: ${v.vitals.map((x) => `${x.label} ${x.value} ${x.unit}${x.note ? ` (${x.note})` : ""}`).join(", ")}`
                : "",
              v.assessments.length > 0
                ? `    แบบประเมิน: ${v.assessments.map((a) => `${a.name} ${a.score} ${a.result}`).join(", ")}`
                : "",
              v.labs.length > 0
                ? `    แล็บ: ${v.labs.map((l) => `${l.name} ${l.value}${l.flag ? ` (${l.flag === "high" ? "สูง" : "ต่ำ"})` : ""} ปกติ ${l.ref}`).join(", ")}`
                : "",
              v.homeVisit
                ? `    เยี่ยมบ้าน: ปัญหา ${v.homeVisit.problems} · แผน ${v.homeVisit.plan} · คำแนะนำ ${v.homeVisit.advice} · กินยา ${v.homeVisit.adherence}`
                : "",
            ]
              .filter((l) => l !== "")
              .join("\n"),
          ),
        ].join("\n"),
        effects: { subject: r.id },
      };
    }

    case "visits": {
      const when = String(args.when ?? "today");
      const who = typeof args.resident_id === "string" ? args.resident_id : undefined;
      const today = startOfDay(now).getTime();
      const day = 86_400_000;
      let list = yearTasks.filter((t) => who == null || t.residentId === who);
      if (when === "today") list = list.filter((t) => isSameDay(t.dueAt, now));
      else if (when === "week")
        list = list.filter(
          (t) => t.dueAt.getTime() >= today && t.dueAt.getTime() < today + 7 * day,
        );
      else if (when === "overdue")
        list = list.filter((t) => visitStateOf(t, now) === "overdue");
      else if (when === "done_recent")
        list = list.filter(
          (t) => isDone(t) && t.dueAt.getTime() >= today - 7 * day && t.dueAt.getTime() < today + day,
        );
      else if (when === "upcoming")
        list = list.filter((t) => !isDone(t) && t.dueAt.getTime() >= today);
      else if (when === "past")
        list = list.filter((t) => isDone(t) || t.dueAt.getTime() < today);
      list = [...list].sort((a, b) =>
        when === "past" || when === "done_recent"
          ? b.dueAt.getTime() - a.dueAt.getTime()
          : a.dueAt.getTime() - b.dueAt.getTime(),
      );
      const shown = list.slice(0, 6);
      return {
        text: [
          `${list.length} รายการ${list.length > shown.length ? ` (แสดง ${shown.length} รายการแรก)` : ""}`,
          ...shown.map((t) => visitLine(t, now)),
        ].join("\n"),
        effects: { visits: shown.map((t) => t.id) },
      };
    }

    case "who_needs_attention": {
      const only = typeof args.metric === "string" ? args.metric : undefined;
      // The carer's own people unless the whole district is asked for: "who
      // has high sugar" from a carer is about their round, and the app's
      // own list under the answer is too — a hundred and forty-six names
      // from every village was a different answer to the one on screen.
      const pool =
        args.scope === "all"
          ? everyResident
          : [...roundPeople(now)]
              .map((id) => residentById(id))
              .filter((x): x is Resident => x != null);
      const rows = pool
        .map((r) => ({
          r,
          off: abnormalNow(r, now).filter((a) => only == null || a.metric.kind === only),
        }))
        .filter((x) => x.off.length > 0)
        // Worse first: an alarm before a warning, then more readings off.
        .sort(
          (a, b) =>
            b.off.filter((o) => o.tone === "alert").length -
              a.off.filter((o) => o.tone === "alert").length ||
            b.off.length - a.off.length,
        );
      if (rows.length === 0) return none("ไม่มีใครที่ค่าล่าสุดหลุดเกณฑ์");
      const shown = rows.slice(0, 8);
      return {
        text: [
          `${rows.length} คนที่ค่าล่าสุดหลุดเกณฑ์ เรียงจากน่าห่วงที่สุด:`,
          ...shown.map(
            ({ r, off }) =>
              `- ${nameOf(r)} รหัส ${r.id}: ${off.map((o) => `${o.metric.name} ${formatReading(o.metric, o.reading)} (${o.label})`).join(", ")}`,
          ),
        ].join("\n"),
        effects: { residents: shown.map((x) => x.r.id) },
      };
    }

    case "follow_up_list": {
      const rows = followUpPatients.map(({ resident }) => ({
        r: resident,
        state: followUpStateOf(resident, now),
        since: daysSinceAssessed(resident, now),
      }));
      const order = { attention: 0, watch: 1, stable: 2 } as const;
      rows.sort((a, b) => order[a.state] - order[b.state]);
      const count = (s: keyof typeof order) => rows.filter((x) => x.state === s).length;
      return none(
        [
          `กลุ่มติดตาม ${rows.length} คน: ต้องดูแลด่วน ${count("attention")} เฝ้าระวัง ${count("watch")} คงที่ ${count("stable")}`,
          ...rows
            .filter((x) => x.state !== "stable")
            .slice(0, 10)
            .map(
              (x) =>
                `- ${nameOf(x.r)} รหัส ${x.r.id}: ${FOLLOW_LABEL[x.state]}${x.since != null ? ` ไม่ได้ประเมิน ${x.since} วัน` : " ยังไม่เคยประเมิน"}`,
            ),
        ].join("\n"),
      );
    }

    case "care_activities": {
      const days = Math.max(1, Math.min(90, Number(args.days ?? 14) || 14));
      const from = startOfDay(now).getTime();
      const list = ACTIVITIES.filter(
        (a) => a.at.getTime() >= from && a.at.getTime() < from + days * 86_400_000,
      ).sort((a, b) => a.at.getTime() - b.at.getTime());
      if (list.length === 0) return none(`ไม่มีกิจกรรมใน ${days} วันข้างหน้า`);
      return none(
        [
          `กิจกรรมใน ${days} วันข้างหน้า ${list.length} รายการ:`,
          ...list
            .slice(0, 10)
            .map(
              (a) =>
                `- ${thaiShortDate(a.at)} ${thaiTime(a.at)} ${a.title} ที่ ${a.place} (${a.group}) เป้าหมาย ${a.targets} คน`,
            ),
        ].join("\n"),
      );
    }

    case "daily_brief": {
      const b = briefOf(now);
      return {
        text: [
          `วันนี้ ${thaiFullDate(now)}`,
          `งานวันนี้ ${b.today.length} รายการ (เสร็จ ${b.today.filter(isDone).length}) เกินกำหนด ${b.overdue.length} รายการ`,
          "ลำดับความสำคัญ:",
          ...b.priorities.map(
            (p, i) => `${i + 1}. ${p.name} รหัส ${p.residentId}: ${p.reasons.join(" · ")}`,
          ),
        ].join("\n"),
        effects: { residents: b.priorities.map((p) => p.residentId) },
      };
    }

    case "prepare_visit": {
      const r = personFrom(args);
      if (r == null) return none(NO_ONE);
      const d = detailFor(r);
      const task = visitOf(r.id, now);
      const off = abnormalNow(r, now);
      const last = treatmentHistory(d.hn).find((v) => v.homeVisit != null);
      const since = daysSinceAssessed(r, now);
      const bags = currentSupplies().filter(
        (x) => x.residentId === r.id && (x.state === "waiting" || x.state === "onRoad"),
      );
      return {
        text: [
          `เตรียมเยี่ยม ${nameOf(r)} รหัส ${r.id} อายุ ${r.age} ปี`,
          task ? `นัด: ${visitLine(task, now).slice(2)}` : "ยังไม่มีนัดที่จะถึง",
          `โรค: ${d.condition}`,
          `แพ้ยา: ${d.allergies}`,
          `ข้อควรระวัง: ${d.precautions}`,
          `อุปกรณ์ที่ผู้ป่วยใช้: ${d.equipment} · การกิน: ${d.feeding} · ขับถ่าย: ${d.excretion}`,
          off.length > 0
            ? `ค่าที่ควรวัดซ้ำ: ${off.map((o) => `${o.metric.name} ${formatReading(o.metric, o.reading)} (${o.label})`).join(", ")}`
            : "ค่าล่าสุดอยู่ในเกณฑ์ ไม่มีค่าที่ต้องวัดซ้ำเป็นพิเศษ",
          last?.homeVisit
            ? `เยี่ยมบ้านครั้งก่อน (${last.daysAgo} วันก่อน): ปัญหา ${last.homeVisit.problems} · แผน ${last.homeVisit.plan} · การกินยา ${last.homeVisit.adherence}`
            : "ไม่มีบันทึกเยี่ยมบ้านครั้งก่อน",
          since == null
            ? "ยังไม่เคยประเมิน ควรทำแบบประเมินในครั้งนี้"
            : since > 30
              ? `ไม่ได้ประเมินมา ${since} วัน ถึงเวลาประเมินซ้ำ`
              : `ประเมินล่าสุด ${since} วันก่อน`,
          bags.length > 0
            ? `ของที่ต้องเอาไปส่ง: ${bags.map((b) => b.items.join(", ")).join(" / ")}`
            : "ไม่มีของที่ต้องเอาไปส่ง",
          `ผู้ดูแล: ${d.caregiverName} (${d.caregiverRelation}) เบอร์ ${d.caregiverPhone}`,
        ].join("\n"),
        effects: { subject: r.id },
      };
    }

    case "compare_vitals": {
      const r = personFrom(args);
      if (r == null) return none(NO_ONE);
      const kind = String(args.metric) as MetricKind;
      const m = metricOf(kind);
      if (m == null) return none("ไม่รู้จักค่าชนิดนี้");
      const days = Math.max(3, Math.min(180, Number(args.days ?? 30) || 30));
      const cut = now.getTime() - days * 86_400_000;
      const all = readingsFor(r, kind, now, days * 2);
      const recent = all.filter((x) => x.at.getTime() >= cut);
      const earlier = all.filter((x) => x.at.getTime() < cut);
      const a = summarise(kind, earlier);
      const b = summarise(kind, recent);
      if (a == null || b == null)
        return none(`${nameOf(r)} มีค่า${m.name}ไม่พอจะเทียบสองช่วง`);
      const pct = (s: { outOfRange: number; count: number }) =>
        Math.round((s.outOfRange / s.count) * 100);
      const avg = (s: { average: number; average2?: number }) =>
        `${Math.round(s.average)}${s.average2 != null ? `/${Math.round(s.average2)}` : ""}`;
      // Better is fewer readings out of range — the direction of a number
      // means different things for oxygen and for sugar.
      const verdict =
        pct(b) < pct(a) - 5 ? "ดีขึ้น" : pct(b) > pct(a) + 5 ? "แย่ลง" : "ใกล้เคียงเดิม";
      return {
        text: [
          `${m.name}ของ ${nameOf(r)} เทียบ ${days} วันล่าสุด กับ ${days} วันก่อนหน้า`,
          `ช่วงก่อนหน้า: เฉลี่ย ${avg(a)} ${m.unit} ผิดปกติ ${a.outOfRange}/${a.count} ครั้ง (${pct(a)}%)`,
          `ช่วงล่าสุด: เฉลี่ย ${avg(b)} ${m.unit} ผิดปกติ ${b.outOfRange}/${b.count} ครั้ง (${pct(b)}%)`,
          `สรุป: ${verdict} (ตัดสินจากสัดส่วนครั้งที่ผิดปกติ)`,
        ].join("\n"),
        effects: { resident: r.id, subject: r.id },
      };
    }

    case "household": {
      const r = personFrom(args);
      if (r == null) return none(NO_ONE);
      const house = houseOfResident(r.id);
      if (house == null) return none(`ไม่พบข้อมูลบ้านของ ${nameOf(r)}`);
      return {
        text: [
          `${house.number} ${house.address} สมาชิก ${house.residents.length} คน`,
          ...house.residents.map((x) => {
            const off = abnormalNow(x, now);
            return `- ${x.name} รหัส ${x.id} อายุ ${x.age} ปี ติดตาม: ${FOLLOW_LABEL[followUpStateOf(x, now)]}${off.length > 0 ? ` · ค่าผิดปกติ: ${off.map((o) => `${o.metric.name} ${o.label}`).join(", ")}` : ""}`;
          }),
        ].join("\n"),
        effects: {
          subject: r.id,
          actions: [{ kind: "open_household", residentId: r.id }],
        },
      };
    }

    case "assessment_history": {
      const r = personFrom(args);
      if (r == null) return none(NO_ONE);
      const rows = assessmentsFor(r, now).slice(0, 8);
      if (rows.length === 0) return none(`${nameOf(r)} ยังไม่มีแบบประเมิน`);
      return {
        text: [
          `แบบประเมินของ ${nameOf(r)} ล่าสุด ${rows.length} รายการ:`,
          ...rows.map((a) => `- ${thaiShortDate(a.at)} ${a.name}: คะแนน ${a.score} ผล ${a.result}`),
        ].join("\n"),
        effects: { subject: r.id },
      };
    }

    case "search_notes": {
      const q = String(args.query ?? "").trim().toLowerCase();
      if (q === "") return none("ไม่ได้ระบุคำค้น");
      const textOf = (n: ReturnType<typeof currentNotes>[number]) =>
        n.parts
          .map((p) => ("text" in p && typeof p.text === "string" ? p.text : ""))
          .join(" ");
      const hits = currentNotes().filter((n) =>
        `${n.title} ${textOf(n)}`.toLowerCase().includes(q),
      );
      if (hits.length === 0) return none(`ไม่พบโน้ตที่มีคำว่า "${args.query}"`);
      return none(
        [
          `พบ ${hits.length} โน้ต:`,
          ...hits.slice(0, 5).map((n) => {
            const body = textOf(n).replace(/\s+/g, " ");
            const at = body.toLowerCase().indexOf(q);
            const around = body.slice(Math.max(0, at - 60), at + 140);
            return `- "${n.title || "ไม่มีชื่อ"}" (${thaiShortDate(new Date(n.updatedAt))}): ${around}`;
          }),
        ].join("\n"),
      );
    }

    case "check_allergy": {
      const r = personFrom(args);
      if (r == null) return none(NO_ONE);
      const d = detailFor(r);
      const drugs = searchDrugs(String(args.drug ?? ""));
      if (String(args.drug ?? "").trim() === "" || drugs.length === 0 || drugs.length === DRUGS.length)
        return none(`ไม่พบยา "${args.drug}" ในรายการยาของโรงพยาบาล`);
      const allergies = /ปฏิเสธ|ไม่มี|^none|^no known|denie/i.test(d.allergies)
        ? []
        : d.allergies.split(/[,،、/]|และ/).map((x) => x.trim()).filter(Boolean);
      return {
        text: [
          `ประวัติแพ้ยาของ ${nameOf(r)}: ${d.allergies}`,
          ...drugs.slice(0, 3).map((drug) => {
            const hit = allergyHit(drug, allergies);
            return hit != null
              ? `- ${drug.th} (${drug.name}): ตรงกับประวัติแพ้ ${hit} ห้ามให้ ต้องแจ้งแพทย์`
              : `- ${drug.th} (${drug.name}): ไม่ตรงกับประวัติแพ้ที่บันทึกไว้ (ไม่ได้แปลว่าให้ได้ ต้องเป็นไปตามคำสั่งแพทย์)`;
          }),
          "การตรวจนี้เทียบชื่อกับประวัติแพ้ที่บันทึกเท่านั้น การสั่งหรือให้ยาต้องเป็นไปตามแพทย์และเภสัชกร",
        ].join("\n"),
        effects: { subject: r.id },
      };
    }

    case "supplies": {
      const want = String(args.state ?? "pending");
      const who = typeof args.resident_id === "string" ? args.resident_id : undefined;
      const list = currentSupplies()
        .filter((x) => who == null || x.residentId === who)
        .filter((x) =>
          want === "all"
            ? true
            : want === "pending"
              ? x.state === "waiting" || x.state === "onRoad"
              : x.state === want,
        )
        .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
      if (list.length === 0) return none("ไม่มีรายการของที่ตรงเงื่อนไข");
      return none(
        [
          `${list.length} รายการ:`,
          ...list.slice(0, 8).map(
            (x) =>
              `- ${x.name} รหัส ${x.residentId} (${x.village}) ${thaiShortDate(x.dueAt)} · ${DELIVERY_LABEL[x.state]} · ${x.items.join(", ")}${x.note ? ` · หมายเหตุ ${x.note}` : ""}`,
          ),
        ].join("\n"),
      );
    }

    case "vaccine_session": {
      const sitting = openSessionNow();
      if (sitting == null) return none("ตอนนี้ไม่มีคลินิกหรือกิจกรรมที่เปิดทำอยู่");
      const t = tally(sitting);
      return none(
        [
          `กำลังทำ: ${sitting.activity.title} ที่ ${sitting.activity.place} (${sitting.activity.group})`,
          `เป้าหมาย ${t.targets} คน บันทึกแล้ว ${t.recorded} ขาด ${t.absent} ปฏิเสธ ${t.refused} เหลือ ${Math.max(0, t.targets - t.recorded - t.absent - t.refused)} คน`,
        ].join("\n"),
      );
    }

    case "handover_summary": {
      const today = yearTasks.filter((t) => isSameDay(t.dueAt, now));
      const done = today.filter(isDone);
      const left = today.filter((t) => !isDone(t));
      const overdue = yearTasks.filter((t) => visitStateOf(t, now) === "overdue");
      const seen = [...new Set(today.map((t) => t.residentId))]
        .map((id) => residentById(id))
        .filter((x): x is Resident => x != null)
        .map((x) => ({ x, off: abnormalNow(x, now) }))
        .filter((y) => y.off.length > 0);
      return {
        text: [
          `สรุปส่งเวร ${thaiFullDate(now)}`,
          `เยี่ยมแล้ว ${done.length} จาก ${today.length} นัด`,
          ...done.map((t) => visitLine(t, now)),
          `ยังค้าง ${left.length} นัด:`,
          ...left.map((t) => visitLine(t, now)),
          `งานเกินกำหนดสะสม ${overdue.length} รายการ`,
          seen.length > 0 ? "ผู้ป่วยวันนี้ที่ค่าผิดปกติ ควรส่งต่อ:" : "ผู้ป่วยวันนี้ค่าอยู่ในเกณฑ์ทั้งหมด",
          ...seen.map(
            ({ x, off }) =>
              `- ${x.name}: ${off.map((o) => `${o.metric.name} ${formatReading(o.metric, o.reading)} (${o.label})`).join(", ")}`,
          ),
        ].join("\n"),
        effects: { visits: today.map((t) => t.id).slice(0, 6) },
      };
    }

    case "search_app": {
      const query = String(args.query ?? "").trim();
      const groups = searchEverything(query);
      // The services' sittings are not in the app's search; a school or a
      // clinic is most often asked after as the place one is held.
      const k = query.toLowerCase();
      const sittings = ACTIVITIES.filter((a) =>
        `${a.title} ${a.place} ${a.group}`.toLowerCase().includes(k),
      ).sort((a, b) => {
        // What is coming first, soonest first; then what has been, latest first.
        const t = now.getTime();
        const fa = a.at.getTime() >= t;
        const fb = b.at.getTime() >= t;
        if (fa !== fb) return fa ? -1 : 1;
        return fa ? a.at.getTime() - b.at.getTime() : b.at.getTime() - a.at.getTime();
      });
      const sittingText =
        sittings.length === 0
          ? ""
          : `กิจกรรมบริการ (${sittings.length}):\n${sittings
              .slice(0, 5)
              .map((a) => `- ${thaiShortDate(a.at)} ${thaiTime(a.at)} ${a.title} ที่ ${a.place} (${a.group})`)
              .join("\n")}`;
      if (groups.length === 0 && sittings.length === 0)
        return none(`ไม่พบ "${args.query}" ในแอป`);
      if (groups.length === 0) return none(sittingText);
      return none(
        (sittingText === "" ? "" : `${sittingText}\n`) +
        groups
          .map(
            (g) =>
              `${g.label} (${g.total}):\n${g.hits
                .slice(0, 4)
                .map((h) => `- ${h.title}${h.subtitle ? ` · ${h.subtitle}` : ""}`)
                .join("\n")}`,
          )
          .join("\n"),
      );
    }

    case "offer_action": {
      const kind = String(args.kind) as AssistantAction["kind"];
      const kinds: AssistantAction["kind"][] = [
        "open_patient",
        "open_health",
        "call",
        "navigate",
        "start_visit",
        "plan_route",
        "open_household",
        "call_caregiver",
      ];
      if (!kinds.includes(kind)) return none("ไม่รู้จักการกระทำนี้");
      if (kind === "plan_route") {
        return { text: "เพิ่มปุ่มวางเส้นทางรอบวันนี้แล้ว", effects: { actions: [{ kind }] } };
      }
      const r = personFrom(args);
      if (r == null) return none(NO_ONE);
      const task = visitOf(r.id, now);
      if (kind === "navigate" && (task == null || !hasLocation(task)) && houseOfResident(r.id) == null)
        return none(`${nameOf(r)} ไม่มีพิกัดบ้าน นำทางไม่ได้`);
      if (kind === "start_visit" && task == null)
        return none(`${nameOf(r)} ไม่มีนัดเยี่ยม จึงเริ่มบันทึกเยี่ยมไม่ได้`);
      const say: Record<AssistantAction["kind"], string> = {
        open_patient: "เปิดหน้าผู้ป่วย",
        open_health: "ดูค่าสุขภาพ",
        call: "โทรหา",
        navigate: "นำทางไปบ้าน",
        start_visit: "เริ่มบันทึกเยี่ยม",
        plan_route: "วางเส้นทาง",
        open_household: "เปิดหน้าบ้านของ",
        call_caregiver: "โทรหาผู้ดูแลของ",
      };
      return {
        // The sentence the answer should carry, given rather than left to
        // be made up: once the button is offered the model has a way of
        // talking about something else entirely.
        text: `เพิ่มปุ่ม "${say[kind]}${nameOf(r)}" ใต้คำตอบแล้ว ยังไม่ได้ทำจนกว่าพยาบาลจะกด ตอบสิ่งที่ถูกถามให้ครบก่อน แล้วปิดท้ายสั้น ๆ ว่ากดปุ่ม${say[kind]}ด้านล่างได้ ห้ามบอกว่าทำให้แล้ว`,
        effects: {
          subject: r.id,
          actions: [{ kind, residentId: r.id, taskId: task?.id }],
        },
      };
    }
  }
  return none(`ไม่มีเครื่องมือชื่อ ${name}`);
}

/* --------------------------------------------------------------- brief */

/**
 * The round, as the app's own lists draw it: today's people, or this
 * week's where today has nobody. What the unwell list under an answer
 * shows, so the tool and the card count the same people.
 */
function roundPeople(now: Date): Set<string> {
  const day = 86_400_000;
  const t0 = startOfDay(now).getTime();
  const today = yearTasks.filter((t) => isSameDay(t.dueAt, now));
  const list =
    today.length > 0
      ? today
      : yearTasks.filter((t) => t.dueAt.getTime() >= t0 && t.dueAt.getTime() < t0 + 7 * day);
  return new Set(list.map((t) => t.residentId));
}

/** The people on the carer's books: anyone with a visit this fortnight. */
function mineNow(now: Date): Set<string> {
  return new Set(
    yearTasks
      .filter((t) => Math.abs(t.dueAt.getTime() - now.getTime()) < 14 * 86_400_000)
      .map((t) => t.residentId),
  );
}

/** One person the brief says to look at, and why. */
export type BriefItem = {
  residentId: string;
  name: string;
  reasons: string[];
  /** Higher first. */
  weight: number;
  /** Their visit today, if there is one. */
  taskId?: string;
};

export type Brief = {
  today: Task[];
  overdue: Task[];
  priorities: BriefItem[];
};

/**
 * Where the carer should start, and why — worked out on the phone.
 *
 * Weighted, not ordered by one thing: a reading in the red outweighs a
 * reading in the amber, a visit already overdue outweighs one due today,
 * and someone in the follow-up group flagged for attention adds to either.
 * Each reason is kept as a phrase so the card and the model can both say
 * WHY someone is near the top, which is what makes an ordering trusted.
 */
export function briefOf(now: Date = planToday): Brief {
  const today = yearTasks.filter((t) => isSameDay(t.dueAt, now));
  const overdue = yearTasks.filter((t) => visitStateOf(t, now) === "overdue");
  const items = new Map<string, BriefItem>();
  const add = (
    r: Resident,
    weight: number,
    reason: string,
    taskId?: string,
  ) => {
    const it = items.get(r.id) ?? {
      residentId: r.id,
      name: r.name,
      reasons: [],
      weight: 0,
    };
    it.weight += weight;
    it.reasons.push(reason);
    if (taskId != null && it.taskId == null) it.taskId = taskId;
    items.set(r.id, it);
  };

  // Overdue, once a person however many visits they have missed: four
  // lines saying the same thing is a reason repeated, not four reasons.
  const missed = new Map<string, Task[]>();
  for (const t of overdue) missed.set(t.residentId, [...(missed.get(t.residentId) ?? []), t]);
  for (const [id, list] of missed) {
    const r = residentById(id);
    if (r == null) continue;
    const latest = list.reduce((a, b) => (b.dueAt > a.dueAt ? b : a));
    add(
      r,
      4 + Math.min(list.length - 1, 2),
      list.length === 1
        ? `นัดเกินกำหนดตั้งแต่ ${thaiShortDate(latest.dueAt)}`
        : `นัดเกินกำหนด ${list.length} ครั้ง ล่าสุด ${thaiShortDate(latest.dueAt)}`,
      latest.id,
    );
  }
  for (const t of today.filter((x) => !isDone(x))) {
    const r = residentById(t.residentId);
    if (r) add(r, 2, `นัดวันนี้ ${thaiTime(t.dueAt)}`, t.id);
  }
  // Readings only for the people on the carer's books this fortnight —
  // the whole district's alarms are somebody else's round.
  const near = mineNow(now);
  for (const id of near) {
    const r = residentById(id);
    if (r == null) continue;
    for (const a of abnormalNow(r, now)) {
      add(
        r,
        a.tone === "alert" ? 5 : 2,
        `${a.metric.name} ${formatReading(a.metric, a.reading)} ${a.label}`,
      );
    }
  }
  for (const { resident } of followUpPatients) {
    if (followUpStateOf(resident, now) === "attention")
      add(resident, 3, "กลุ่มติดตามที่ต้องดูแลด่วน");
  }

  const priorities = [...items.values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);
  return { today, overdue, priorities };
}
