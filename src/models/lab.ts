import { useSyncExternalStore } from "react";

import { tr } from "../i18n";
import { saveTask } from "./community";

/**
 * Lab orders — what a clinic morning sends to the hospital's lab.
 *
 * A community clinic is mostly the same few people every month: diabetes
 * and blood pressure, checked once a year for what those do to the
 * kidneys, the blood fats and the eyes. So the page opens on the sets a
 * nurse orders by name ("ตรวจประจำปีเบาหวาน") and lets single tests be
 * added or taken off, rather than a catalogue to search.
 *
 * Tests keep the names the lab prints on the slip — FBS, HbA1c, CBC — which
 * is what a nurse reads and writes in either language; the line under each
 * says what it is for.
 */
export type Specimen = "blood" | "urine" | "stool";

export type LabTest = {
  code: string;
  /** What it is for, in the language on screen. */
  detail: string;
  specimen: Specimen;
  /** Eight hours without food before the blood is drawn. */
  fasting?: boolean;
};

export type LabGroup = { title: string; tests: LabTest[] };

export const LAB_GROUPS: LabGroup[] = [
  {
    title: tr("เบาหวาน", "Diabetes"),
    tests: [
      { code: "FBS", detail: tr("น้ำตาลในเลือดหลังงดอาหาร", "Fasting blood sugar"), specimen: "blood", fasting: true },
      { code: "HbA1c", detail: tr("น้ำตาลสะสม 3 เดือน", "Average sugar over 3 months"), specimen: "blood" },
    ],
  },
  {
    title: tr("ไขมันในเลือด", "Blood fats"),
    tests: [
      { code: "Cholesterol", detail: tr("คอเลสเตอรอลรวม", "Total cholesterol"), specimen: "blood" },
      { code: "Triglyceride", detail: tr("ไตรกลีเซอไรด์", "Triglycerides"), specimen: "blood", fasting: true },
      { code: "HDL", detail: tr("ไขมันดี", "\"Good\" cholesterol"), specimen: "blood" },
      { code: "LDL", detail: tr("ไขมันเลว", "\"Bad\" cholesterol"), specimen: "blood" },
    ],
  },
  {
    title: tr("ไต", "Kidneys"),
    tests: [
      { code: "BUN", detail: tr("ของเสียในเลือด", "Blood urea nitrogen"), specimen: "blood" },
      { code: "Creatinine", detail: tr("การทำงานของไต พร้อมค่า eGFR", "Kidney function, with eGFR"), specimen: "blood" },
      { code: "Electrolytes", detail: tr("เกลือแร่ในเลือด", "Blood salts"), specimen: "blood" },
      { code: "Microalbumin", detail: tr("โปรตีนรั่วในปัสสาวะ", "Protein leaking into urine"), specimen: "urine" },
    ],
  },
  {
    title: tr("ทั่วไป", "General"),
    tests: [
      { code: "CBC", detail: tr("ความสมบูรณ์ของเม็ดเลือด", "Complete blood count"), specimen: "blood" },
      { code: "UA", detail: tr("ตรวจปัสสาวะทั่วไป", "Urinalysis"), specimen: "urine" },
      { code: "Uric acid", detail: tr("กรดยูริก", "Uric acid"), specimen: "blood" },
      { code: "AST/ALT", detail: tr("การทำงานของตับ", "Liver function"), specimen: "blood" },
      { code: "Stool exam", detail: tr("ตรวจอุจจาระ", "Stool examination"), specimen: "stool" },
    ],
  },
];

const ALL: LabTest[] = LAB_GROUPS.flatMap((g) => g.tests);
export const labTest = (code: string): LabTest | undefined =>
  ALL.find((t) => t.code === code);

/** The sets ordered by name. */
export const LAB_SETS: { id: string; label: string; codes: string[] }[] = [
  {
    id: "dm-annual",
    label: tr("ตรวจประจำปีเบาหวาน/ความดัน", "Annual diabetes / BP check"),
    codes: ["FBS", "HbA1c", "Cholesterol", "Triglyceride", "HDL", "LDL", "Creatinine", "UA", "Microalbumin"],
  },
  {
    id: "lipid",
    label: tr("ไขมันในเลือด", "Lipid profile"),
    codes: ["Cholesterol", "Triglyceride", "HDL", "LDL"],
  },
  {
    id: "kidney",
    label: tr("การทำงานของไต", "Kidney function"),
    codes: ["BUN", "Creatinine", "Electrolytes", "UA"],
  },
];

export const SPECIMEN_LABEL: Record<Specimen, string> = {
  blood: tr("เลือด", "Blood"),
  urine: tr("ปัสสาวะ", "Urine"),
  stool: tr("อุจจาระ", "Stool"),
};

/** Whether anything in the order needs the patient to have fasted. */
export const needsFasting = (codes: string[]): boolean =>
  codes.some((c) => labTest(c)?.fasting === true);

/** What is to be collected, once each: "เลือด · ปัสสาวะ". */
export const specimensOf = (codes: string[]): Specimen[] => [
  ...new Set(codes.map((c) => labTest(c)?.specimen).filter((s): s is Specimen => s != null)),
];

export type Urgency = "routine" | "urgent";
/** Taken here and now, or the patient is booked to come in for it. */
export type Collection = "now" | "booked";

export type LabOrder = {
  codes: string[];
  urgency: Urgency;
  collection: Collection;
  /** Fasted the eight hours the order asks for — asked only when it does. */
  fasted: boolean;
  note: string;
  orderedAt: number;
};

/* ----------------------------------------------------------- the store */

const store = new Map<string, LabOrder>();
const watchers = new Set<() => void>();

/** Write this visit's order, replacing any before it. */
export function saveLabOrder(authenCode: string, order: LabOrder): void {
  store.set(authenCode, order);
  saveTask(authenCode, "lab", {
    result: [
      tr(`${order.codes.length} รายการ`, `${order.codes.length} test${order.codes.length === 1 ? "" : "s"}`),
      order.collection === "now"
        ? tr("เก็บสิ่งส่งตรวจแล้ว", "Specimen taken")
        : tr("นัดมาเจาะ", "Booked to come in"),
      ...(order.urgency === "urgent" ? [tr("ด่วน", "Urgent")] : []),
    ].join(" · "),
  });
  for (const w of watchers) w();
}

/** This visit's order, live. Null until one is saved. */
export function useLabOrder(authenCode: string): LabOrder | null {
  return useSyncExternalStore(
    (onChange) => {
      watchers.add(onChange);
      return () => {
        watchers.delete(onChange);
      };
    },
    () => store.get(authenCode) ?? null,
  );
}
