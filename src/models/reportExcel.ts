import { unzipSync, zipSync } from "fflate";
import XLSX, { type CellObject, type WorkSheet } from "xlsx-js-style";

import { bmiOf, genderLabel, residentById } from "./household";
import { professionLabel } from "./providerAccount";
import { patientsOf, type Kpi, type Report } from "./report";
import type { Session } from "./session";
import { visitTypeLabel } from "./task";
import { ACTIVITY_NOUN } from "./vaccination";
import { latestVitals } from "./vitals";
import { tr } from "../i18n";
import {
  buddhistYear,
  thaiMonthYear,
  thaiShortDate,
  thaiTime,
} from "../utils/thaiDate";

/**
 * The report as a workbook a reviewer can open, filter and print.
 *
 * Four sheets, in the order a review reads them: the KPI summary, the
 * people visited, every visit, and the group rounds behind the coverage
 * figures. Dates are written as Thai text rather than Excel dates — a date
 * cell shows the Common Era whatever the sheet says, and the people
 * reading this file write the Buddhist one.
 */

/* ------------------------------------------------------------- style */

const FONT = "Tahoma";
const BLUE = "077DD7";
const NAVY = "044271";
const PALE = "E9F0F9";
const RULE = "D0D7E2";
const OK = { ink: "15803D", fill: "DCFCE7" };
const BAD = { ink: "B91C1C", fill: "FEE2E2" };
const SOON = { ink: "B45309", fill: "FEF3C7" };
const MUTED = { ink: "6B7280", fill: "F3F4F6" };

const border = {
  top: { style: "thin", color: { rgb: RULE } },
  bottom: { style: "thin", color: { rgb: RULE } },
  left: { style: "thin", color: { rgb: RULE } },
  right: { style: "thin", color: { rgb: RULE } },
} as const;

type Style = NonNullable<CellObject["s"]>;

const S = {
  title: {
    font: { name: FONT, sz: 16, bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: NAVY } },
    alignment: { vertical: "center", horizontal: "left", indent: 1 },
  },
  meta: {
    font: { name: FONT, sz: 11, color: { rgb: "374151" } },
    alignment: { vertical: "center", indent: 1 },
  },
  section: {
    font: { name: FONT, sz: 13, bold: true, color: { rgb: NAVY } },
    alignment: { vertical: "center" },
  },
  head: {
    font: { name: FONT, sz: 11, bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: BLUE } },
    alignment: { vertical: "center", horizontal: "center", wrapText: true },
    border,
  },
  cell: {
    font: { name: FONT, sz: 11 },
    alignment: { vertical: "center", wrapText: true },
    border,
  },
  big: {
    font: { name: FONT, sz: 20, bold: true, color: { rgb: NAVY } },
    fill: { fgColor: { rgb: PALE } },
    alignment: { vertical: "center", horizontal: "center" },
    border,
  },
  label: {
    font: { name: FONT, sz: 11, color: { rgb: "374151" } },
    fill: { fgColor: { rgb: PALE } },
    alignment: { vertical: "center", horizontal: "center", wrapText: true },
    border,
  },
  total: {
    font: { name: FONT, sz: 11, bold: true },
    fill: { fgColor: { rgb: PALE } },
    alignment: { vertical: "center" },
    border,
  },
} satisfies Record<string, Style>;

/** A plain cell, with any of the style overridden. */
function c(v: string | number | null | undefined, s: Style = S.cell, z?: string): CellObject {
  if (v == null || v === "") return { t: "s", v: "", s };
  return typeof v === "number" ? { t: "n", v, s, z } : { t: "s", v, s };
}

const num = (v: number | null | undefined, z = "#,##0") =>
  c(v, { ...S.cell, alignment: { ...S.cell.alignment, horizontal: "right" } }, z);
const centre = (v: string | number | null | undefined) =>
  c(v, { ...S.cell, alignment: { ...S.cell.alignment, horizontal: "center" } });
const rate = (v: number | null) =>
  v == null ? centre("–") : num(v, "0.0%");

/** A cell that says a verdict in its own colour. */
function badge(text: string, tone: { ink: string; fill: string }): CellObject {
  return c(text, {
    ...S.cell,
    font: { name: FONT, sz: 11, bold: true, color: { rgb: tone.ink } },
    fill: { fgColor: { rgb: tone.fill } },
    alignment: { vertical: "center", horizontal: "center" },
  });
}

/**
 * A sheet out of rows of cells, with column widths and the merges given.
 *
 * Built by hand rather than with `aoa_to_sheet` because every cell carries
 * its style, and the helper would drop them.
 */
function sheet(
  rows: CellObject[][],
  widths: number[],
  opts: { merges?: XLSX.Range[]; heights?: Record<number, number>; filter?: XLSX.Range } = {},
): WorkSheet {
  const ws: WorkSheet = {};
  let maxC = 0;
  rows.forEach((row, r) => {
    row.forEach((cell, col) => {
      ws[XLSX.utils.encode_cell({ r, c: col })] = cell;
    });
    maxC = Math.max(maxC, row.length - 1);
  });
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, rows.length - 1), c: maxC } });
  ws["!cols"] = widths.map((wch) => ({ wch }));
  ws["!rows"] = rows.map((row, r) => ({
    hpt:
      opts.heights?.[r] ??
      fit(row, (col) => {
        // A merged cell is as wide as the columns it spans.
        const m = opts.merges?.find((x) => x.s.r === r && x.s.c === col);
        const to = m?.e.c ?? col;
        let w = 0;
        for (let k = col; k <= to; k++) w += widths[k] ?? 10;
        return w;
      }),
  }));
  if (opts.merges) ws["!merges"] = opts.merges;
  if (opts.filter) ws["!autofilter"] = { ref: XLSX.utils.encode_range(opts.filter) };
  return ws;
}

/**
 * A row tall enough for its longest wrapped cell.
 *
 * Excel will not size a row to its text when the file says nothing, and a
 * fixed height cut a two-line address at the first line. So each row is
 * measured here: characters over the column's width, Thai marks that sit
 * above or below a letter not counted, since they take no width of their own.
 */
function fit(row: CellObject[], widthOf: (col: number) => number): number {
  let lines = 1;
  row.forEach((cell, col) => {
    // Only a cell that wraps can need the room; one that runs on across a
    // merge is as long as the merge, not its first column.
    if (typeof cell.v !== "string" || cell.v === "" || cell.s?.alignment?.wrapText !== true) return;
    const wide = cell.v.replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, "").length;
    lines = Math.max(lines, Math.ceil(wide / Math.max(4, widthOf(col) - 2)));
  });
  return Math.max(22, lines * 16 + 6);
}

/** A banner across the top: the title, then a line or two about it. */
function banner(title: string, lines: string[], span: number) {
  const rows: CellObject[][] = [
    [c(title, S.title), ...Array.from({ length: span - 1 }, () => c("", S.title))],
    ...lines.map((l) => [c(l, S.meta)]),
    [],
  ];
  const merges: XLSX.Range[] = rows
    .slice(0, lines.length + 1)
    .map((_, r) => ({ s: { r, c: 0 }, e: { r, c: span - 1 } }));
  return { rows, merges, heights: { 0: 34 } as Record<number, number> };
}

/* -------------------------------------------------------------- sheets */

function verdict(k: Kpi): CellObject {
  if (k.pass == null) return badge(tr("ไม่มีงานถึงกำหนด", "No work due"), MUTED);
  return k.pass
    ? badge(tr("ผ่านเกณฑ์", "Met"), OK)
    : badge(tr("ต่ำกว่าเกณฑ์", "Below target"), BAD);
}

function summarySheet(report: Report, who: string[]): WorkSheet {
  const SPAN = 9;
  const top = banner(
    tr(
      `รายงานผลการปฏิบัติงาน (KPI) ปี ${buddhistYear(new Date(report.year, 0, 1))}`,
      `Performance report (KPI) ${report.year}`,
    ),
    who,
    SPAN,
  );
  const rows = top.rows;
  const merges = [...top.merges];
  const heights = { ...top.heights };

  // The verdict, in two boxes.
  const v = rows.length;
  rows.push([
    c(tr("คะแนน KPI (เต็ม 100)", "KPI score (of 100)"), S.label),
    c("", S.label),
    c(tr("ตัวชี้วัดที่ผ่านเกณฑ์", "Indicators met"), S.label),
    c("", S.label),
  ]);
  rows.push([
    c(report.score ?? "–", S.big),
    c("", S.big),
    c(`${report.passed} / ${report.scored}`, S.big),
    c("", S.big),
  ]);
  merges.push(
    { s: { r: v, c: 0 }, e: { r: v, c: 1 } },
    { s: { r: v, c: 2 }, e: { r: v, c: 3 } },
    { s: { r: v + 1, c: 0 }, e: { r: v + 1, c: 1 } },
    { s: { r: v + 1, c: 2 }, e: { r: v + 1, c: 3 } },
  );
  heights[v + 1] = 40;
  rows.push([]);

  rows.push([c(tr("ตัวชี้วัด", "Indicators"), S.section)]);
  const h = rows.length;
  rows.push(
    [
      tr("ลำดับ", "No."),
      tr("ตัวชี้วัด", "Indicator"),
      tr("วิธีคิด", "Measure"),
      tr("ผลงาน", "Done"),
      tr("เป้าหมาย", "Target group"),
      tr("ร้อยละ", "Rate"),
      tr("เกณฑ์", "Pass mark"),
      tr("ผลการประเมิน", "Result"),
      tr("ขาดอีก", "Short by"),
    ].map((t) => c(t, S.head)),
  );
  heights[h] = 28;
  report.kpis.forEach((k, i) => {
    rows.push([
      centre(i + 1),
      c(k.title, { ...S.cell, font: { name: FONT, sz: 11, bold: true } }),
      c(k.measure),
      num(k.done),
      num(k.total),
      rate(k.rate),
      centre(`≥ ${Math.round(k.target * 100)}%`),
      verdict(k),
      k.pass === false ? num(k.short) : centre("–"),
    ]);
    if (k.note != null) {
      rows.push([c(""), c(`   ${k.note}`, { ...S.cell, alignment: { vertical: "center" }, font: { name: FONT, sz: 10, italic: true, color: { rgb: "6B7280" } } })]);
      merges.push({ s: { r: rows.length - 1, c: 1 }, e: { r: rows.length - 1, c: SPAN - 1 } });
    }
  });
  rows.push([]);

  // A month across the first two columns, people across the fourth and
  // fifth — the summary's columns are cut for the indicators above, and
  // the one narrow column folded "ผู้รับบริการงานกลุ่ม" onto two lines.
  const mergeMonthRow = (r: number) =>
    merges.push(
      { s: { r, c: 0 }, e: { r, c: 1 } },
      { s: { r, c: 3 }, e: { r, c: 4 } },
    );
  rows.push([c(tr("ผลงานรายเดือน", "By month"), S.section)]);
  rows.push(
    [tr("เดือน", "Month"), "", tr("เยี่ยมบ้าน (ครั้ง)", "Home visits"), tr("ผู้รับบริการงานกลุ่ม (คน)", "Group work served"), ""].map((t) =>
      c(t, S.head),
    ),
  );
  mergeMonthRow(rows.length - 1);
  report.months.forEach((m, i) => {
    rows.push([c(thaiMonthYear(new Date(report.year, i, 1))), c(""), num(m.visits), num(m.people), c("")]);
    mergeMonthRow(rows.length - 1);
  });
  const sum = (f: (m: Report["months"][number]) => number) =>
    report.months.reduce((n, m) => n + f(m), 0);
  rows.push([
    c(tr("รวม", "Total"), S.total),
    c("", S.total),
    c(sum((m) => m.visits), { ...S.total, alignment: { horizontal: "right" } }, "#,##0"),
    c(sum((m) => m.people), { ...S.total, alignment: { horizontal: "right" } }, "#,##0"),
    c("", S.total),
  ]);
  mergeMonthRow(rows.length - 1);
  rows.push([]);

  rows.push([c(tr("การเยี่ยมบ้านแยกตามประเภท", "Home visits by type"), S.section)]);
  rows.push(
    [tr("ประเภทการเยี่ยม", "Visit type"), "", tr("ถึงกำหนด", "Due"), tr("เยี่ยมแล้ว", "Made"), tr("ร้อยละ", "Rate")].map((t) =>
      c(t, S.head),
    ),
  );
  merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 1 } });
  for (const t of report.visits.byType) {
    rows.push([c(t.label), c(""), num(t.total), num(t.done), rate(t.total === 0 ? null : t.done / t.total)]);
    merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 1 } });
  }
  rows.push([]);
  rows.push([
    c(
      tr(
        "หมายเหตุ: นับเฉพาะงานที่ถึงกำหนดแล้ว รอบงานกลุ่มที่ยังไม่ปิดงานนับเป็นยังไม่ได้ให้บริการ คะแนน KPI คือค่าเฉลี่ยของสัดส่วนที่แต่ละตัวชี้วัดทำได้เทียบกับเกณฑ์ (สูงสุดตัวละ 100)",
        "Note: only work that has fallen due is counted; rounds not yet closed count as not served. The KPI score averages how far each indicator reached its target (at most 100 each).",
      ),
      { ...S.meta, font: { name: FONT, sz: 10, color: { rgb: "6B7280" } }, alignment: { wrapText: true, vertical: "top" } },
    ),
  ]);
  merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: SPAN - 1 } });
  heights[rows.length - 1] = 36;

  return sheet(rows, [7, 30, 38, 11, 11, 10, 10, 16, 10], { merges, heights });
}

function patientSheet(report: Report, who: string[]): WorkSheet {
  const head = [
    tr("ลำดับ", "No."),
    tr("ชื่อ-สกุล", "Name"),
    tr("เพศ", "Sex"),
    tr("อายุ (ปี)", "Age"),
    tr("โทรศัพท์", "Phone"),
    tr("ที่อยู่", "Address"),
    tr("ประเภทการเยี่ยม", "Visit type"),
    tr("ปัญหาสุขภาพ / เหตุที่เยี่ยม", "Reason for visits"),
    tr("ความเสี่ยงจากการคัดกรอง", "Screening risks"),
    "BMI",
    tr("นัดที่ถึงกำหนด", "Due"),
    tr("เยี่ยมแล้ว", "Made"),
    tr("ค้างเยี่ยม", "Missed"),
    tr("ร้อยละ", "Rate"),
    tr("เยี่ยมล่าสุด", "Last visit"),
    tr("นัดถัดไป", "Next visit"),
  ];
  const top = banner(
    tr("รายชื่อผู้ป่วยที่ดูแล", "Patients on the round"),
    who,
    head.length,
  );
  const rows = top.rows;
  const first = rows.length;
  rows.push(head.map((t) => c(t, S.head)));
  const heights = { ...top.heights, [first]: 30 };

  patientsOf(report).forEach((p, i) => {
    const r = p.resident;
    const risks =
      r?.screenings.filter((s) => s.status === "atRisk").map((s) => s.name).join(", ") ?? "";
    const bmi = r != null ? bmiOf(r) : 0;
    rows.push([
      centre(i + 1),
      c(p.name),
      centre(r != null ? genderLabel(r.gender) : ""),
      centre(p.age),
      c(r?.phone ?? ""),
      c(p.address),
      c(p.visitType),
      c(p.detail),
      risks === "" ? centre("–") : badge(risks, SOON),
      bmi > 0 ? num(Math.round(bmi * 10) / 10, "0.0") : centre("–"),
      num(p.due),
      num(p.done),
      p.missed > 0 ? badge(String(p.missed), BAD) : centre(0),
      rate(p.due === 0 ? null : p.done / p.due),
      centre(p.lastVisit != null ? thaiShortDate(p.lastVisit) : "–"),
      centre(p.nextVisit != null ? thaiShortDate(p.nextVisit) : "–"),
    ]);
  });

  return sheet(rows, [7, 26, 7, 8, 14, 44, 18, 32, 26, 7, 10, 10, 10, 9, 13, 13], {
    merges: top.merges,
    heights,
    filter: { s: { r: first, c: 0 }, e: { r: rows.length - 1, c: head.length - 1 } },
  });
}

function visitSheet(report: Report, who: string[]): WorkSheet {
  const head = [
    tr("ลำดับ", "No."),
    tr("วันที่", "Date"),
    tr("เวลา", "Time"),
    tr("ชื่อ-สกุล", "Name"),
    tr("อายุ", "Age"),
    tr("ประเภทการเยี่ยม", "Visit type"),
    tr("เหตุที่เยี่ยม", "Reason"),
    tr("ที่อยู่", "Address"),
    tr("สถานะ", "Status"),
    tr("ความดัน (mmHg)", "BP (mmHg)"),
    tr("ชีพจร (ครั้ง/นาที)", "Pulse (bpm)"),
    tr("อุณหภูมิ (°C)", "Temp (°C)"),
    "SpO₂ (%)",
    tr("น้ำตาล (mg/dL)", "Glucose (mg/dL)"),
  ];
  const top = banner(tr("ข้อมูลการเยี่ยมบ้าน", "Home visits"), who, head.length);
  const rows = top.rows;
  const first = rows.length;
  rows.push(head.map((t) => c(t, S.head)));
  const heights = { ...top.heights, [first]: 30 };

  report.plan.forEach((t, i) => {
    const made = t.status === "done";
    const ahead = t.dueAt > report.asOf;
    const status = made
      ? badge(tr("เยี่ยมแล้ว", "Made"), OK)
      : ahead
        ? badge(tr("ยังไม่ถึงกำหนด", "Upcoming"), MUTED)
        : badge(tr("ค้างเยี่ยม", "Missed"), BAD);

    /*
      What was measured at the visit: the readings on record up to the end
      of that day. Only for a visit that was made — a reading against a
      visit nobody went to would be a measurement taken somewhere else.
    */
    let vitals: CellObject[] = Array.from({ length: 5 }, () => centre("–"));
    const r = made ? residentById(t.residentId) : undefined;
    if (r != null) {
      const end = new Date(t.dueAt.getFullYear(), t.dueAt.getMonth(), t.dueAt.getDate(), 23, 59);
      const v = latestVitals(r, end);
      vitals = [
        centre(v.bp != null ? `${Math.round(v.bp.value)}/${Math.round(v.bp.value2 ?? 0)}` : "–"),
        v.pulse != null ? num(Math.round(v.pulse.value)) : centre("–"),
        v.temp != null ? num(Math.round(v.temp.value * 10) / 10, "0.0") : centre("–"),
        v.spo2 != null ? num(Math.round(v.spo2.value)) : centre("–"),
        v.glucose != null ? num(Math.round(v.glucose.value)) : centre("–"),
      ];
    }

    rows.push([
      centre(i + 1),
      centre(thaiShortDate(t.dueAt)),
      centre(thaiTime(t.dueAt)),
      c(t.name),
      centre(t.age),
      c(visitTypeLabel(t.visitType ?? "")),
      c(t.detail),
      c(t.address ?? ""),
      status,
      ...vitals,
    ]);
  });

  return sheet(rows, [7, 13, 10, 26, 7, 18, 30, 44, 15, 14, 12, 12, 10, 13], {
    merges: top.merges,
    heights,
    filter: { s: { r: first, c: 0 }, e: { r: rows.length - 1, c: head.length - 1 } },
  });
}

function roundSheet(report: Report, who: string[]): WorkSheet {
  const head = [
    tr("ลำดับ", "No."),
    tr("วันที่", "Date"),
    tr("งาน", "Service"),
    tr("ชื่องาน", "Activity"),
    tr("สถานที่", "Place"),
    tr("กลุ่มเป้าหมาย", "Group"),
    tr("เป้าหมาย (คน)", "Targets"),
    tr("ได้รับบริการ (คน)", "Served"),
    tr("ร้อยละ", "Rate"),
    tr("สถานะ", "Status"),
  ];
  const top = banner(tr("งานกลุ่มในชุมชน", "Group work"), who, head.length);
  const rows = top.rows;
  const first = rows.length;
  rows.push(head.map((t) => c(t, S.head)));
  const heights = { ...top.heights, [first]: 30 };

  report.roundList.forEach((r, i) => {
    rows.push([
      centre(i + 1),
      centre(thaiShortDate(r.at)),
      c(ACTIVITY_NOUN[r.kind]),
      c(r.title),
      c(r.place),
      c(r.group),
      num(r.targets),
      r.served == null ? centre("–") : num(r.served),
      rate(r.served == null || r.targets === 0 ? null : r.served / r.targets),
      r.state === "closed"
        ? badge(tr("ปิดงานแล้ว", "Closed"), OK)
        : r.state === "open"
          ? badge(tr("ยังไม่ปิดงาน", "Not closed"), BAD)
          : badge(tr("ยังไม่ถึงกำหนด", "Upcoming"), MUTED),
    ]);
  });

  return sheet(rows, [7, 13, 14, 34, 36, 34, 12, 14, 9, 15], {
    merges: top.merges,
    heights,
    filter: { s: { r: first, c: 0 }, e: { r: rows.length - 1, c: head.length - 1 } },
  });
}

/* ------------------------------------------------------------ the book */

/** The whole workbook, as the bytes of an .xlsx file. */
export function reportWorkbook(report: Report, me: Session, now: Date): Uint8Array {
  const who = [
    tr(
      `ผู้ปฏิบัติงาน: ${me.displayName}${me.account != null ? ` (${professionLabel(me.account.profession)})` : ""}`,
      `Staff: ${me.displayName}${me.account != null ? ` (${professionLabel(me.account.profession)})` : ""}`,
    ),
    ...(me.facility != null ? [tr(`หน่วยบริการ: ${me.facility.name}`, `Unit: ${me.facility.name}`)] : []),
    tr(
      `ข้อมูล${report.partial ? `ถึงวันที่ ${thaiShortDate(report.asOf)}` : "ทั้งปี"} · ส่งออกเมื่อ ${thaiShortDate(now)} ${thaiTime(now)}`,
      `Data ${report.partial ? `to ${thaiShortDate(report.asOf)}` : "for the full year"} · exported ${thaiShortDate(now)} ${thaiTime(now)}`,
    ),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, summarySheet(report, who), tr("สรุป KPI", "KPI summary"));
  XLSX.utils.book_append_sheet(wb, patientSheet(report, who), tr("รายชื่อผู้ป่วย", "Patients"));
  XLSX.utils.book_append_sheet(wb, visitSheet(report, who), tr("ข้อมูลการเยี่ยม", "Visits"));
  XLSX.utils.book_append_sheet(wb, roundSheet(report, who), tr("งานกลุ่ม", "Group work"));
  // SheetJS stores the zip uncompressed (~500 KB), and its own deflate only
  // gets that to ~190 KB; repacking at full strength brings it to ~55 KB,
  // small enough to send over LINE without a second thought.
  const raw = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return zipSync(unzipSync(new Uint8Array(raw)), { level: 9 });
}

/** "รายงาน-KPI-2569-สุขภาพดี.xlsx" */
export function reportFileName(report: Report, me: Session): string {
  const given = me.displayName.trim().split(/\s+/)[0] ?? "";
  return tr(
    `รายงาน-KPI-${buddhistYear(new Date(report.year, 0, 1))}-${given}.xlsx`,
    `KPI-report-${report.year}-${given}.xlsx`,
  ).replace(/[\\/:*?"<>|]/g, "");
}

