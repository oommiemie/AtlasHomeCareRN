/**
 * แบบคัดกรองภาวะเสี่ยง เบาหวาน/ความดัน อายุ 35 ปีขึ้นไป — the real one.
 *
 * Three instruments, as the Ministry's 35+ screening actually runs:
 *
 *  1. The Thai Diabetes Risk Score (Aekplakorn et al., Diabetes Care 2006;
 *     the form the Diabetes Association of Thailand publishes). Six things
 *     that need no laboratory — age, sex, BMI, waist, hypertension, a parent
 *     or sibling with diabetes — scored to 17 and read as the chance of
 *     diabetes in the next twelve years. Points and bands are copied from
 *     the association's own calculator, not approximated.
 *  2. A blood sugar, sorted into the Ministry's three groups: normal, the
 *     risk group (Pre-DM: FBS 100–125 fasting, or RPG 140–199 not fasting),
 *     and the suspect group (≥126 / ≥200) that goes for confirmation.
 *  3. A blood pressure, sorted the same way: normal under 120/80, the risk
 *     group (Pre-HT) at 120–139 / 80–89, suspect at 140/90 and over.
 *
 * Around those, the history the paper form asks — what the person carries,
 * what the family carries, the extra risk factors and the symptoms — which
 * feed the score where they can and push the advice toward a blood test
 * where they cannot.
 */

import { isEn, tr } from "../i18n";
import type { AssessmentRecord, Tone } from "./assessments";

export type Tri = "มี" | "ไม่มี" | "ไม่เคยตรวจ";
export type YesNo = "มี" | "ไม่มี";
export type Sex = "ชาย" | "หญิง";

/** Diseases a person is asked whether they carry — three-state. */
export const PERSONAL_HISTORY = [
  "โรคเบาหวาน",
  "โรคความดันโลหิตสูง",
  "โรคตับ / มะเร็ง",
  "โรคอัมพาต",
  "โรคหัวใจ",
] as const;

/** The family checklist, asked once for parents and once for siblings. */
export const FAMILY_DISEASES = [
  "เบาหวาน",
  "ความดันโลหิตสูง",
  "โรคเก๊าท์",
  "ไตวายเรื้อรัง",
  "กล้ามเนื้อหัวใจตาย",
  "เส้นเลือดสมอง",
  "ถุงลมโป่งพอง",
  "ไม่ทราบ",
  "อื่น ๆ",
] as const;

/**
 * Risk factors the paper form asks that the score cannot compute — obesity,
 * family history and blood pressure are measured above and left out here.
 * Any one of these is a reason to draw blood whatever the score says.
 */
export const EXTRA_RISKS = [
  "มีรอยพับรอบคอหรือใต้รักแร้ดำ",
  "เคยเป็นเบาหวานขณะตั้งครรภ์ หรือคลอดบุตรน้ำหนัก > 4,000 กรัม",
  "ไขมันในเลือดผิดปกติ (HDL < 35 mg%)",
  "เคยตรวจพบน้ำตาลในเลือดสูง (IFG 100–125 หรือ IGT 140–199 mg%)",
] as const;

/** The symptoms that point at diabetes already present — yes/no. */
export const SYMPTOMS = [
  "แผลที่เท้า / ตัดขา (จากเบาหวาน)",
  "ดื่มน้ำบ่อยและมาก",
  "ปัสสาวะกลางคืน 3 ครั้งขึ้นไป",
  "กินจุแต่ผอมลง",
  "น้ำหนักลด / อ่อนเพลีย",
  "เป็นแผลที่ริมฝีปากบ่อยและหายยาก",
  "คันตามผิวหนังและอวัยวะสืบพันธุ์",
  "ตาพร่ามัว ต้องเปลี่ยนแว่นบ่อย",
  "ชาตามปลายมือปลายเท้าโดยไม่ทราบสาเหตุ",
] as const;

export const STEP_TITLES = tr(
  ["ข้อมูลพื้นฐานและวัดค่า", "ประวัติส่วนตัว", "ประวัติครอบครัว", "ปัจจัยเสี่ยงและอาการ", "สรุปผลการคัดกรอง"],
  ["Basics and measurements", "Personal history", "Family history", "Risk factors and symptoms", "Screening summary"],
);
/**
 * The Thai strings above are identities — answers are keyed by them and
 * compared against them — so they stay Thai whatever the language, and are
 * put into words for the screen here.
 */
const LABELS: Record<string, string> = {
  มี: "Yes",
  ไม่มี: "No",
  ไม่เคยตรวจ: "Never tested",
  ชาย: "Male",
  หญิง: "Female",
  โรคเบาหวาน: "Diabetes",
  โรคความดันโลหิตสูง: "Hypertension",
  "โรคตับ / มะเร็ง": "Liver disease / cancer",
  โรคอัมพาต: "Stroke / paralysis",
  โรคหัวใจ: "Heart disease",
  เบาหวาน: "Diabetes",
  ความดันโลหิตสูง: "Hypertension",
  โรคเก๊าท์: "Gout",
  ไตวายเรื้อรัง: "Chronic kidney failure",
  กล้ามเนื้อหัวใจตาย: "Myocardial infarction",
  เส้นเลือดสมอง: "Stroke",
  ถุงลมโป่งพอง: "Emphysema",
  ไม่ทราบ: "Unknown",
  "อื่น ๆ": "Other",
  มีรอยพับรอบคอหรือใต้รักแร้ดำ: "Dark skin folds around the neck or armpits (acanthosis nigricans)",
  "เคยเป็นเบาหวานขณะตั้งครรภ์ หรือคลอดบุตรน้ำหนัก > 4,000 กรัม":
    "Past gestational diabetes, or gave birth to a baby > 4,000 g",
  "ไขมันในเลือดผิดปกติ (HDL < 35 mg%)": "Abnormal blood lipids (HDL < 35 mg%)",
  "เคยตรวจพบน้ำตาลในเลือดสูง (IFG 100–125 หรือ IGT 140–199 mg%)":
    "Previously found high blood glucose (IFG 100–125 or IGT 140–199 mg%)",
  "แผลที่เท้า / ตัดขา (จากเบาหวาน)": "Foot ulcer / amputation (from diabetes)",
  ดื่มน้ำบ่อยและมาก: "Frequent, excessive thirst",
  "ปัสสาวะกลางคืน 3 ครั้งขึ้นไป": "Urinating 3 or more times at night",
  กินจุแต่ผอมลง: "Eating a lot but losing weight",
  "น้ำหนักลด / อ่อนเพลีย": "Weight loss / fatigue",
  เป็นแผลที่ริมฝีปากบ่อยและหายยาก: "Frequent lip sores that heal slowly",
  คันตามผิวหนังและอวัยวะสืบพันธุ์: "Itchy skin and genitals",
  "ตาพร่ามัว ต้องเปลี่ยนแว่นบ่อย": "Blurred vision, frequent change of glasses",
  ชาตามปลายมือปลายเท้าโดยไม่ทราบสาเหตุ: "Unexplained numbness in the hands and feet",
};

/** A Thai answer, disease, risk or symptom from this form, for the screen. */
export const label35 = (th: string): string => (isEn ? (LABELS[th] ?? th) : th);


/** What is measured — typed, as strings, so the boxes can be half-filled. */
export type Measures = {
  age: string;
  sex: Sex | "";
  weight: string;
  height: string;
  waist: string;
  sbp: string;
  dbp: string;
  glucose: string;
  /** true = fasted ≥8 h (FBS), false = not (RPG), null = not said. */
  fasting: boolean | null;
};

export type Risk35Answers = {
  m: Measures;
  personal: Record<string, Tri>;
  parent: string[];
  sibling: string[];
  extra: Record<string, YesNo>;
  symptom: Record<string, YesNo>;
};

/**
 * A blank form for this person. Age and sex are the card's and are not
 * typed; `seed` carries in whatever the visit's health screening already
 * measured, so a number is never asked for twice.
 */
export function emptyAnswers(
  age: number,
  sex: string,
  seed: Partial<Omit<Measures, "age" | "sex">> = {},
): Risk35Answers {
  return {
    m: {
      age: String(age),
      sex: sex === "ชาย" || sex === "หญิง" ? sex : "",
      weight: "",
      height: "",
      waist: "",
      sbp: "",
      dbp: "",
      glucose: "",
      fasting: null,
      ...seed,
    },
    personal: {},
    parent: [],
    sibling: [],
    extra: {},
    symptom: {},
  };
}

const num = (s: string): number | null => {
  const v = Number(s.trim());
  return s.trim() === "" || !Number.isFinite(v) ? null : v;
};

/** kg/m², or nothing until both figures are in. */
export function bmiOf(m: Measures): number | null {
  const w = num(m.weight);
  const h = num(m.height);
  if (w == null || h == null || h <= 0) return null;
  return w / (h / 100) ** 2;
}

/* ---------------------------------------------------------------- score */

export type ScoreLevel = "low" | "moderate" | "high" | "veryHigh";

/** One line of the score — what was answered and what it cost. */
export type ScoreItem = {
  label: string;
  /** The answer as words, or "" while unknown. */
  value: string;
  points: number;
  known: boolean;
};

export type RiskScore = {
  total: number;
  max: 17;
  items: ScoreItem[];
  level: ScoreLevel;
  /** Every item answered — the total means what it says. */
  complete: boolean;
};

/**
 * The association's own reading of each band, verbatim.
 * ≤2 · 3–5 · 6–8 · ≥9.
 */
export const LEVEL: Record<
  ScoreLevel,
  { label: string; pct: string; chance: string; repeat: string }
> = {
  low: {
    label: tr("น้อย", "Low"),
    pct: tr("น้อยกว่าร้อยละ 5", "Less than 5%"),
    chance: "1/20",
    repeat: tr("ควรประเมินความเสี่ยงซ้ำทุก 3 ปี", "Reassess risk every 3 years"),
  },
  moderate: {
    label: tr("ปานกลาง", "Moderate"),
    pct: tr("ร้อยละ 5–10", "5–10%"),
    chance: "1/12",
    repeat: tr("ควรประเมินความเสี่ยงซ้ำทุก 1–3 ปี", "Reassess risk every 1–3 years"),
  },
  high: {
    label: tr("สูง", "High"),
    pct: tr("ร้อยละ 11–20", "11–20%"),
    chance: "1/7",
    repeat: tr("ควรประเมินความเสี่ยงซ้ำทุก 1–3 ปี", "Reassess risk every 1–3 years"),
  },
  veryHigh: {
    label: tr("สูงมาก", "Very high"),
    pct: tr("มากกว่าร้อยละ 20", "More than 20%"),
    chance: "1/3 – 1/4",
    repeat: tr("ควรประเมินความเสี่ยงซ้ำทุก 1 ปี", "Reassess risk every year"),
  },
};

export function levelOf(total: number): ScoreLevel {
  if (total <= 2) return "low";
  if (total <= 5) return "moderate";
  if (total <= 8) return "high";
  return "veryHigh";
}

/** The Thai Diabetes Risk Score, item by item. */
export function scoreOf(a: Risk35Answers): RiskScore {
  const { m } = a;
  const age = num(m.age);
  const bmi = bmiOf(m);
  const waist = num(m.waist);
  const sbp = num(m.sbp);
  const dbp = num(m.dbp);

  // Hypertension: diagnosed, or measured at 140/90 or over today.
  const htSaid = a.personal["โรคความดันโลหิตสูง"];
  const htMeasured = sbp != null && dbp != null ? sbp >= 140 || dbp >= 90 : null;
  const ht: boolean | null =
    htSaid === "มี" || htMeasured === true
      ? true
      : htSaid === "ไม่มี" || htSaid === "ไม่เคยตรวจ" || htMeasured === false
        ? false
        : null;

  const family =
    a.parent.includes("เบาหวาน") || a.sibling.includes("เบาหวาน")
      ? true
      : a.parent.length > 0 || a.sibling.length > 0
        ? false
        : null;

  const items: ScoreItem[] = [
    {
      label: tr("อายุ", "Age"),
      value: age == null ? "" : tr(`${age} ปี`, `${age} yrs`),
      points: age == null ? 0 : age >= 50 ? 2 : age >= 45 ? 1 : 0,
      known: age != null,
    },
    {
      label: tr("เพศ", "Sex"),
      value: m.sex === "" ? "" : label35(m.sex),
      points: m.sex === "ชาย" ? 2 : 0,
      known: m.sex !== "",
    },
    {
      label: tr("ดัชนีมวลกาย (BMI)", "Body mass index (BMI)"),
      value: bmi == null ? "" : `${bmi.toFixed(1)} ${tr("กก./ม.²", "kg/m²")}`,
      points: bmi == null ? 0 : bmi >= 27.5 ? 5 : bmi >= 23 ? 3 : 0,
      known: bmi != null,
    },
    {
      label: tr("รอบเอว", "Waist"),
      value: waist == null ? "" : `${waist} ${tr("ซม.", "cm")}`,
      points:
        waist == null || m.sex === ""
          ? 0
          : (m.sex === "ชาย" ? waist >= 90 : waist >= 80)
            ? 2
            : 0,
      known: waist != null && m.sex !== "",
    },
    {
      label: tr("โรคความดันโลหิตสูง", "Hypertension"),
      value: ht == null ? "" : ht ? tr("เป็น", "Yes") : tr("ไม่เป็น", "No"),
      points: ht === true ? 2 : 0,
      known: ht != null,
    },
    {
      label: tr("ญาติสายตรงเป็นเบาหวาน", "Parent or sibling with diabetes"),
      value: family == null ? "" : family ? tr("มี", "Yes") : tr("ไม่มี", "No"),
      points: family === true ? 4 : 0,
      known: family != null,
    },
  ];

  const total = items.reduce((s, i) => s + i.points, 0);
  return {
    total,
    max: 17,
    items,
    level: levelOf(total),
    complete: items.every((i) => i.known),
  };
}

/* --------------------------------------------------- measured groupings */

export type Group = "normal" | "risk" | "suspect";

export const GROUP_LABEL: Record<Group, string> = {
  normal: tr("ปกติ", "Normal"),
  risk: tr("กลุ่มเสี่ยง", "Risk group"),
  suspect: tr("กลุ่มสงสัยป่วย", "Suspected case"),
};

/** Blood sugar → the Ministry's group. Needs to know whether they fasted. */
export function sugarGroup(m: Measures): Group | null {
  const g = num(m.glucose);
  if (g == null || m.fasting == null) return null;
  if (m.fasting) return g >= 126 ? "suspect" : g >= 100 ? "risk" : "normal";
  return g >= 200 ? "suspect" : g >= 140 ? "risk" : "normal";
}

/** Blood pressure → the Ministry's group. */
export function bpGroup(m: Measures): Group | null {
  const s = num(m.sbp);
  const d = num(m.dbp);
  if (s == null || d == null) return null;
  if (s >= 140 || d >= 90) return "suspect";
  if (s >= 120 || d >= 80) return "risk";
  return "normal";
}

/* ------------------------------------------------------------- summary */

export type Risk35Result = {
  score: RiskScore;
  sugar: Group | null;
  bp: Group | null;
  bmi: number | null;
  /** The one line of what to do. */
  advice: string;
  /** Already a diabetic / hypertensive by their own account. */
  known: string[];
  extraRisks: string[];
  symptoms: string[];
};

/**
 * Put the three readings together into advice.
 *
 * Suspect readings outrank everything: a sugar at 126 fasting is not "at
 * risk", it is a diagnosis waiting for its second test. Below that, the
 * score's own band sets the interval — with a blood test added whenever the
 * band is high, the sugar is in the risk group, or the history carries a
 * symptom or an extra risk factor.
 */
export function summarise35(a: Risk35Answers): Risk35Result {
  const score = scoreOf(a);
  const sugar = sugarGroup(a.m);
  const bp = bpGroup(a.m);
  const known = PERSONAL_HISTORY.filter((d) => a.personal[d] === "มี");
  const extraRisks = EXTRA_RISKS.filter((r) => a.extra[r] === "มี");
  const symptoms = SYMPTOMS.filter((s) => a.symptom[s] === "มี");

  const dm = known.includes("โรคเบาหวาน");
  const needsBlood =
    score.level === "high" ||
    score.level === "veryHigh" ||
    sugar === "risk" ||
    extraRisks.length > 0 ||
    symptoms.length > 0;

  let advice: string;
  if (dm) {
    advice = tr("เป็นผู้ป่วยเบาหวานอยู่แล้ว ติดตามการรักษาต่อเนื่องและตรวจภาวะแทรกซ้อนตามนัด", "Already has diabetes. Continue treatment follow-up and complication screening as scheduled.");
  } else if (sugar === "suspect") {
    advice =
      tr("ระดับน้ำตาลเข้าเกณฑ์สงสัยป่วยเบาหวาน ส่งต่อพบแพทย์เพื่อตรวจ FPG ซ้ำและยืนยันการวินิจฉัย", "Blood glucose meets the suspected-diabetes threshold. Refer to a physician for a repeat FPG to confirm the diagnosis.");
  } else if (bp === "suspect") {
    advice =
      tr("ความดันโลหิตเข้าเกณฑ์สงสัยป่วย วัดซ้ำที่บ้าน (HBPM) 7 วัน และส่งต่อพบแพทย์เพื่อยืนยันการวินิจฉัย", "Blood pressure meets the suspected-hypertension threshold. Do home BP monitoring (HBPM) for 7 days and refer to a physician to confirm the diagnosis.");
  } else if (needsBlood) {
    advice = tr(
      `ควรตรวจระดับน้ำตาลในเลือดหลังงดอาหาร (FPG) และปรับพฤติกรรม · ${LEVEL[score.level].repeat}`,
      `Check fasting plasma glucose (FPG) and adjust lifestyle · ${LEVEL[score.level].repeat}`,
    );
  } else if (bp === "risk") {
    advice = tr(
      `ความดันอยู่ในกลุ่มเสี่ยง ลดเค็ม ออกกำลังกาย วัดซ้ำใน 1 ปี · ${LEVEL[score.level].repeat}`,
      `Blood pressure in the risk group: cut salt, exercise, recheck in 1 year · ${LEVEL[score.level].repeat}`,
    );
  } else {
    advice = LEVEL[score.level].repeat;
  }

  return { score, sugar, bp, bmi: bmiOf(a.m), advice, known, extraRisks, symptoms };
}

/** Flatten into the strings the session store keeps; `result` is the preview line. */
export function toRecord(a: Risk35Answers, r: Risk35Result): AssessmentRecord {
  const parts = [
    tr(
      `คะแนนเสี่ยง ${r.score.total}/17 (${LEVEL[r.score.level].label})`,
      `Risk score ${r.score.total}/17 (${LEVEL[r.score.level].label})`,
    ),
  ];
  if (r.sugar) parts.push(`${tr("น้ำตาล", "Glucose")} ${GROUP_LABEL[r.sugar]}`);
  if (r.bp) parts.push(`${tr("ความดัน", "BP")} ${GROUP_LABEL[r.bp]}`);
  const tone: Tone =
    r.score.level === "low" ? "good" : r.score.level === "moderate" ? "warn" : "bad";
  const rec: AssessmentRecord = {
    form: "risk35",
    badge: tr(`เสี่ยง${LEVEL[r.score.level].label}`, `${LEVEL[r.score.level].label} risk`),
    tone,
    result: parts.join(" · "),
    advice: r.advice,
    score: String(r.score.total),
    level: r.score.level,
    // The two groups on their own, so a row can colour them without
    // parsing the line above.
    sugar: r.sugar ?? "",
    bp: r.bp ?? "",
  };
  const { m } = a;
  if (m.weight) rec["น้ำหนัก"] = m.weight;
  if (m.height) rec["ส่วนสูง"] = m.height;
  if (r.bmi != null) rec["BMI"] = r.bmi.toFixed(1);
  if (m.waist) rec["รอบเอว"] = m.waist;
  if (m.sbp && m.dbp) rec["ความดัน"] = `${m.sbp}/${m.dbp}`;
  if (m.glucose) rec["น้ำตาล"] = `${m.glucose} (${m.fasting ? "งดอาหาร" : "ไม่งด"})`;
  for (const d of PERSONAL_HISTORY) if (a.personal[d]) rec[`ประวัติ:${d}`] = a.personal[d];
  if (a.parent.length) rec["ครอบครัว:บิดามารดา"] = a.parent.join(", ");
  if (a.sibling.length) rec["ครอบครัว:พี่น้อง"] = a.sibling.join(", ");
  if (r.extraRisks.length) rec["ปัจจัยเสี่ยงเพิ่มเติม"] = r.extraRisks.join(", ");
  if (r.symptoms.length) rec["อาการ"] = r.symptoms.join(", ");
  return rec;
}
