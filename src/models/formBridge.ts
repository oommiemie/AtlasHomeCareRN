import { useEffect, useRef } from "react";

import { tr } from "../i18n";
import { SCREENING_FIELDS } from "./community";
import { toast } from "../components/Toast";

/**
 * What the assistant can write into the form that is open — and save.
 *
 * A carer with a cuff on somebody's arm says "ความดัน 120 ทับ 80 ชีพจร 88"
 * to the assistant — typed or aloud — and the numbers go into the boxes of
 * the form beside it, rather than being read back for her to type in
 * herself. "บันทึก" saves the form, as its own button would; said at the
 * end of the readings — "… แล้วบันทึกเลย" — it fills and saves in one go.
 * Said on the patient's page with no form open, the readings open the
 * health screening and go into that.
 *
 * Read on the phone, not by the model: a reading is a number the carer
 * said, and it goes in as she said it, at once, with or without a signal.
 */

export type FillKind = "number" | "pair" | "text";

export type FillField = {
  key: string;
  /** As the form labels the box — what the reply names. */
  label: string;
  /** The words a carer uses for it, either language. */
  aliases: string[];
  kind: FillKind;
  unit?: string;
  /**
   * The values a reading of this can take. A number outside it is not this
   * reading — "มีไข้มา 3 วัน" is three days, not a temperature of 3.
   * For a pair, the first number's range.
   */
  range?: [number, number];
};

/** How a save asked of the form went. */
export type SaveResult = "saved" | "empty" | "invalid";

export type FillableForm = {
  /** Which form — the key the patient's page opens it by. */
  kind: string;
  /** The form, as the reply names it ("คัดกรองสุขภาพ"). */
  name: string;
  fields: FillField[];
  set: (key: string, value: string) => void;
  /** Saves it, as its own button would. */
  save?: () => SaveResult;
};

/** The words a carer uses for each reading, for filling it by voice. */
const SCREENING_ALIASES: Record<string, string[]> = {
  bp: ["ความดันโลหิต", "ความดัน", "blood pressure", "bp"],
  temp: ["อุณหภูมิ", "ไข้", "temperature", "temp"],
  pulse: ["ชีพจร", "หัวใจเต้น", "pulse", "heart rate", "hr"],
  spo2: ["ออกซิเจนในเลือด", "ออกซิเจน", "spo2", "sat", "oxygen"],
  glucose: ["น้ำตาลในเลือด", "น้ำตาล", "dtx", "glucose", "sugar"],
  weight: ["น้ำหนัก", "weight"],
  height: ["ส่วนสูง", "height"],
  waist: ["รอบเอว", "waist"],
};

/** What each reading can be, so a number said about something else is not taken for it. */
const SCREENING_RANGE: Record<string, [number, number]> = {
  bp: [50, 260],
  temp: [30, 45],
  pulse: [20, 250],
  spo2: [50, 100],
  glucose: [20, 800],
  weight: [1, 300],
  height: [30, 250],
  waist: [20, 250],
};

/** The health screening's boxes, as the assistant reads words for them. */
export function screeningFields(): FillField[] {
  return [
    ...SCREENING_FIELDS.map((f) => ({
      key: f.key,
      label: f.label,
      unit: f.unit,
      kind: f.pair ? ("pair" as const) : ("number" as const),
      aliases: SCREENING_ALIASES[f.key] ?? [f.label],
      range: SCREENING_RANGE[f.key],
    })),
    {
      key: "complaint",
      label: tr("อาการสำคัญ", "Chief complaint"),
      kind: "text" as const,
      aliases: ["อาการสำคัญ", "chief complaint", "complaint"],
    },
    {
      key: "hpi",
      label: tr("ประวัติการเจ็บป่วยปัจจุบัน", "Present illness"),
      kind: "text" as const,
      aliases: [
        "ประวัติการเจ็บป่วยปัจจุบัน",
        "ประวัติปัจจุบัน",
        "present illness",
        "hpi",
      ],
    },
  ];
}

let open: FillableForm | null = null;
/**
 * How the patient's page answered being asked to open a record: opened,
 * not while another record is open with whatever is typed in it (asked
 * for implicitly, by readings), or not a record this visit has.
 */
export type OpenResult = "opened" | "busy" | "unavailable";

/**
 * The patient's page: opens a record by kind. `asked` is the carer naming
 * it ("เปิดบันทึกเยี่ยมบ้าน") — it opens whatever was open before; otherwise
 * it is readings needing their form, which never switch away from another.
 */
type Opener = (kind: string, asked: boolean) => OpenResult;
let opener: Opener | null = null;

/** The records the assistant can open by name, and the words for each. */
const RECORDS: { kind: string; name: () => string; aliases: string[] }[] = [
  {
    kind: "screening",
    name: () => tr("คัดกรองสุขภาพ", "Health screening"),
    aliases: ["คัดกรองสุขภาพ", "คัดกรอง", "สัญญาณชีพ", "screening", "vital signs", "vitals"],
  },
  {
    kind: "assessment",
    name: () => tr("ประเมินผู้ป่วย", "Assessment"),
    aliases: ["แบบประเมิน", "ประเมินผู้ป่วย", "ประเมิน", "assessment", "assess"],
  },
  {
    kind: "diagnosis",
    name: () => tr("วินิจฉัย", "Diagnosis"),
    aliases: ["การวินิจฉัย", "วินิจฉัย", "diagnosis", "icd"],
  },
  {
    kind: "homevisit",
    name: () => tr("บันทึกเยี่ยมบ้าน", "Home visit"),
    aliases: ["บันทึกเยี่ยมบ้าน", "เยี่ยมบ้าน", "บันทึกการเยี่ยม", "home visit", "visit note"],
  },
  {
    kind: "medication",
    name: () => tr("ยาและเวชภัณฑ์", "Medication"),
    aliases: ["ยาและเวชภัณฑ์", "เวชภัณฑ์", "จ่ายยา", "รายการยา", "ยา", "medication", "medicine", "drugs"],
  },
  {
    kind: "physio",
    name: () => tr("กายภาพบำบัด", "Physiotherapy"),
    aliases: ["กายภาพบำบัด", "กายภาพ", "physio", "physiotherapy"],
  },
];

/** "เปิด / เรียก / ไปที่ / เพิ่ม … <record>" — which record was named, if one was. */
function namedRecord(said: string): (typeof RECORDS)[number] | null {
  const verbs = "เปิด|เรียก|ไปที่|ไปหน้า|ขอ|เพิ่ม|เริ่ม|open|show|go to|start|add";
  for (const r of RECORDS) {
    const names = [...r.aliases].sort((a, b) => b.length - a.length).map(escape).join("|");
    const re = new RegExp(
      `(?:${verbs})\s*(?:แท็บ|แบบ|หน้า|ฟอร์ม|เมนู|บันทึก|the|a|new)?\s*(?:บันทึก)?\s*(?:${names})`,
      "i",
    );
    if (re.test(said)) return r;
  }
  return null;
}
/** Readings said before their form was open, for it to take when it is. */
let pending: {
  kind: string;
  values: Record<string, string>;
  save: boolean;
} | null = null;

/** A save asked for alongside a fill, once the form has drawn the values. */
function saveSoon(form: FillableForm) {
  setTimeout(() => {
    const r = form.save?.();
    if (r === "invalid")
      toast(
        tr(
          "มีค่าที่ไม่ถูกต้อง ตรวจแล้วกดบันทึกอีกครั้ง",
          "Some values are invalid. Check them and save again.",
        ),
        "warning",
      );
  }, 150);
}

/** The form on screen offers its boxes while it is up. */
export function useFillableForm(form: FillableForm): void {
  const live = useRef(form);
  live.current = form;
  useEffect(() => {
    const proxy: FillableForm = {
      get kind() {
        return live.current.kind;
      },
      get name() {
        return live.current.name;
      },
      get fields() {
        return live.current.fields;
      },
      set: (k, v) => live.current.set(k, v),
      save: () => live.current.save?.() ?? "invalid",
    };
    open = proxy;
    // Readings said before it opened go in now.
    if (pending != null && pending.kind === proxy.kind) {
      const p = pending;
      pending = null;
      for (const [k, v] of Object.entries(p.values)) proxy.set(k, v);
      if (p.save) saveSoon(proxy);
    }
    return () => {
      if (open === proxy) open = null;
    };
  }, []);
}

/** The patient's page offers to open its records for the assistant. */
export function useFormOpener(fn: Opener | null): void {
  const live = useRef(fn);
  live.current = fn;
  const on = fn != null;
  useEffect(() => {
    if (!on) return;
    const proxy: Opener = (kind, asked) =>
      live.current?.(kind, asked) ?? "unavailable";
    opener = proxy;
    return () => {
      if (opener === proxy) opener = null;
    };
  }, [on]);
}

/** The form the assistant would write into, if one is open. */
export function fillableForm(): FillableForm | null {
  return open;
}

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

/** Numbers as a recogniser or a keyboard might give them, made plain. */
function plain(text: string): string {
  return (
    text
      .replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)))
      // "36 จุด 8", "36 point 8" — a decimal said aloud.
      .replace(/(\d+)\s*(?:จุด|point)\s*(\d+)/gi, "$1.$2")
      .replace(/(\d),(\d{3})/g, "$1$2")
  );
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const fits = (f: FillField, n: number) =>
  f.range == null || (n >= f.range[0] && n <= f.range[1]);

/** "บันทึก" on its own: save the form. */
const SAVE_ONLY =
  /^\s*(?:กด)?บันทึก(?:ข้อมูล|ฟอร์ม|แบบฟอร์ม)?\s*(?:เลย|ได้เลย|ด้วย|ให้หน่อย)?\s*(?:ค่ะ|คะ|ครับ|นะ)?\s*$|^\s*(?:please\s+)?save(?:\s+it|\s+now|\s+the\s+form)?\s*\.?\s*$/i;
/** "… แล้วบันทึกเลย" at the end of readings: fill, then save. */
const SAVE_AFTER =
  /\s*(?:แล้ว|และ|then|and)?\s*(?:กด)?บันทึก(?:ข้อมูล)?\s*(?:เลย|ได้เลย|ด้วย|ให้หน่อย)?\s*(?:ค่ะ|คะ|ครับ|นะ)?\s*$|\s*(?:,|and|then)\s*save(?:\s+it)?\s*\.?\s*$/i;

/** Which readings in the words go in which of these boxes. */
function read(fields: FillField[], words: string): Record<string, string> {
  const text = plain(words);
  const out: Record<string, string> = {};
  for (const f of fields) {
    const names = f.aliases.map(escape).join("|");
    if (f.kind === "pair") {
      const m = new RegExp(
        `(?:${names})\\D{0,16}?(\\d{2,3})\\s*(?:/|ทับ|ส่วน|over|on)\\s*(\\d{2,3})`,
        "i",
      ).exec(text);
      if (m != null && fits(f, Number(m[1]))) out[f.key] = `${m[1]}/${m[2]}`;
    } else if (f.kind === "number") {
      const m = new RegExp(`(?:${names})\\D{0,16}?(\\d+(?:\\.\\d+)?)`, "i").exec(
        text,
      );
      if (m != null && fits(f, Number(m[1]))) out[f.key] = m[1];
    } else {
      // A text box takes the rest of the sentence after its name, and only
      // when the sentence is about it: "อาการสำคัญ ไอมา 3 วัน".
      const m = new RegExp(
        `^\\s*(?:ลง|กรอก|บันทึก|ใส่|เพิ่ม|เติม|enter|put|set|add)?\\s*(?:${names})\\s*(?:ว่า|คือ|:|is)?\\s*(.+)$`,
        "i",
      ).exec(words);
      if (m != null && m[1].trim() !== "") out[f.key] = m[1].trim();
    }
  }
  return out;
}

const listed = (fields: FillField[], values: Record<string, string>) =>
  fields
    .filter((f) => values[f.key] != null)
    .map(
      (f) => `${f.label} ${values[f.key]}${f.unit != null ? ` ${f.unit}` : ""}`,
    )
    .join(" · ");

/**
 * Fill — and save — the open form from what was said, where what was said
 * is readings or "บันทึก". Returns the reply to give, or null when the words
 * were not for the form, and the assistant should answer them.
 */
export function fillFromWords(said: string): string | null {
  const form = open;

  // "บันทึก" on its own: the form's own save.
  if (SAVE_ONLY.test(said)) {
    if (form?.save == null) return null;
    const r = form.save();
    return r === "saved"
      ? tr(`บันทึกแบบ${form.name}แล้วค่ะ`, `${form.name} saved.`)
      : r === "empty"
        ? tr(
            `แบบ${form.name}ยังไม่มีข้อมูลให้บันทึกค่ะ บอกค่าที่วัดได้ก่อนนะคะ`,
            `${form.name} has nothing to save yet. Tell me the readings first.`,
          )
        : tr(
            `แบบ${form.name}มีค่าที่ไม่ถูกต้อง ตรวจดูก่อนบันทึกนะคะ`,
            `${form.name} has values that look wrong. Check them before saving.`,
          );
  }

  const thenSave = SAVE_AFTER.test(said);
  const words = thenSave ? said.replace(SAVE_AFTER, "") : said;

  // A record named — "เปิดบันทึกเยี่ยมบ้าน", "เปิดคัดกรองแล้วลงความดัน
  // 110/80" — is opened, and readings said with it go into it.
  const named = opener != null ? namedRecord(words) : null;
  if (named != null && opener != null && form?.kind !== named.kind) {
    const r = opener(named.kind, true);
    const name = named.name();
    if (r === "unavailable")
      return tr(
        `แบบ${name}ยังไม่เปิดใช้งานในการเยี่ยมนี้ค่ะ`,
        `${name} isn't available for this visit.`,
      );
    const values =
      named.kind === "screening" ? read(screeningFields(), words) : {};
    if (Object.keys(values).length > 0) {
      pending = { kind: named.kind, values, save: thenSave };
      return tr(
        `เปิดแบบ${name}และกรอกแล้ว: ${listed(screeningFields(), values)}${thenSave ? " บันทึกให้แล้วค่ะ" : ' ตรวจดูแล้วพูดว่า "บันทึก" ได้เลยค่ะ'}`,
        `Opened ${name} and filled in: ${listed(screeningFields(), values)}.${thenSave ? " Saved." : ' Check it, then say "save".'}`,
      );
    }
    return named.kind === "screening"
      ? tr(
          `เปิดแบบ${name}แล้วค่ะ บอกค่าที่วัดได้ เช่น ความดัน 120 ทับ 80 ได้เลย`,
          `Opened ${name}. Tell me the readings, like "blood pressure 120 over 80".`,
        )
      : tr(`เปิดแบบ${name}แล้วค่ะ`, `Opened ${name}.`);
  }

  // Into the form that is open.
  if (form != null) {
    const values = read(form.fields, words);
    if (Object.keys(values).length === 0) return null;
    for (const [k, v] of Object.entries(values)) form.set(k, v);
    if (thenSave && form.save != null) {
      saveSoon(form);
      return tr(
        `กรอกและบันทึกแบบ${form.name}แล้ว: ${listed(form.fields, values)}`,
        `Filled in and saved ${form.name}: ${listed(form.fields, values)}.`,
      );
    }
    return tr(
      `กรอกในแบบ${form.name}แล้ว: ${listed(form.fields, values)} ตรวจดูแล้วพูดว่า "บันทึก" หรือกดบันทึกได้เลยค่ะ`,
      `Filled in ${form.name}: ${listed(form.fields, values)}. Check it, then say "save" or press save.`,
    );
  }

  // None open: readings for the screening open it, on the patient's page.
  if (opener == null) return null;
  const fields = screeningFields();
  const values = read(fields, words);
  if (Object.keys(values).length === 0) return null;
  const name = tr("คัดกรองสุขภาพ", "Health screening");
  const opened = opener("screening", false);
  if (opened === "unavailable") return null;
  if (opened === "busy") {
    return tr(
      `ตอนนี้เปิดแบบบันทึกอื่นอยู่ เปิดแบบ${name}ทางซ้ายก่อน แล้วบอกค่าอีกครั้งนะคะ`,
      `Another record is open. Open ${name} on the left first, then tell me the readings again.`,
    );
  }
  pending = { kind: "screening", values, save: thenSave };
  return thenSave
    ? tr(
        `เปิดแบบ${name} กรอกและบันทึกแล้ว: ${listed(fields, values)}`,
        `Opened ${name}, filled in and saved: ${listed(fields, values)}.`,
      )
    : tr(
        `เปิดแบบ${name}และกรอกแล้ว: ${listed(fields, values)} ตรวจดูแล้วพูดว่า "บันทึก" ได้เลยค่ะ`,
        `Opened ${name} and filled in: ${listed(fields, values)}. Check it, then say "save".`,
      );
}
