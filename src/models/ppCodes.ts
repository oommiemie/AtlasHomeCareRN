import { tr } from "../i18n";

/**
 * งานส่งเสริมป้องกันโรค — the NHSO's "Special PP" codes a visit reports.
 *
 * The real list runs to hundreds and lives on the NHSO's own tables; what
 * is here is the set a community round writes most, kept in the exact
 * wording those tables use. Anything not here is added by its code and a
 * description, the way the picker offers, and reconciled at claim time.
 */
const BREAST = tr("การคัดกรองความเสี่ยง/โรคมะเร็งเต้านม", "Breast cancer risk / disease screening");

export type PpCode = { code: string; label: string; group: string };

export const PP_CODES: PpCode[] = [
  { code: "1B0030", label: tr("ตรวจคัดกรองได้ผลปกติ ผู้รับบริการเคยตรวจด้วยตนเองได้ผลปกติ", "Screening normal; client's previous self-examination normal"), group: BREAST },
  { code: "1B0031", label: tr("ตรวจคัดกรองได้ผลปกติ ผู้รับบริการเคยตรวจด้วยตนเองได้ผลผิดปกติ", "Screening normal; client's previous self-examination abnormal"), group: BREAST },
  { code: "1B0032", label: tr("ตรวจคัดกรองได้ผลปกติ ผู้รับบริการไม่เคยตรวจด้วยตนเอง", "Screening normal; client has never self-examined"), group: BREAST },
  { code: "1B0033", label: tr("ตรวจคัดกรองได้ผลปกติ ไม่ระบุว่าผู้รับบริการเคยตรวจด้วยตนเองหรือไม่", "Screening normal; self-examination history not stated"), group: BREAST },
  { code: "1B0040", label: tr("ตรวจคัดกรองได้ผลผิดปกติ ผู้รับบริการเคยตรวจด้วยตนเองได้ผลปกติ", "Screening abnormal; client's previous self-examination normal"), group: BREAST },
  { code: "1B0041", label: tr("ตรวจคัดกรองได้ผลผิดปกติ ผู้รับบริการเคยตรวจด้วยตนเองได้ผลผิดปกติ", "Screening abnormal; client's previous self-examination abnormal"), group: BREAST },
  { code: "1B0042", label: tr("ตรวจคัดกรองได้ผลผิดปกติ ผู้รับบริการไม่เคยตรวจด้วยตนเอง", "Screening abnormal; client has never self-examined"), group: BREAST },
];

/** One code claimed on the visit. */
export type PpLine = { code: string; label: string };

export function searchPp(q: string): PpCode[] {
  const k = q.trim().toLowerCase();
  if (k === "") return PP_CODES;
  return PP_CODES.filter(
    (p) => p.code.toLowerCase().startsWith(k) || p.label.toLowerCase().includes(k) || p.group.toLowerCase().includes(k),
  );
}
