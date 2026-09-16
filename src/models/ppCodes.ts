/**
 * งานส่งเสริมป้องกันโรค — the NHSO's "Special PP" codes a visit reports.
 *
 * The real list runs to hundreds and lives on the NHSO's own tables; what
 * is here is the set a community round writes most, kept in the exact
 * wording those tables use. Anything not here is added by its code and a
 * description, the way the picker offers, and reconciled at claim time.
 */
export type PpCode = { code: string; label: string; group: string };

export const PP_CODES: PpCode[] = [
  { code: "1B0030", label: "ตรวจคัดกรองได้ผลปกติ ผู้รับบริการเคยตรวจด้วยตนเองได้ผลปกติ", group: "การคัดกรองความเสี่ยง/โรคมะเร็งเต้านม" },
  { code: "1B0031", label: "ตรวจคัดกรองได้ผลปกติ ผู้รับบริการเคยตรวจด้วยตนเองได้ผลผิดปกติ", group: "การคัดกรองความเสี่ยง/โรคมะเร็งเต้านม" },
  { code: "1B0032", label: "ตรวจคัดกรองได้ผลปกติ ผู้รับบริการไม่เคยตรวจด้วยตนเอง", group: "การคัดกรองความเสี่ยง/โรคมะเร็งเต้านม" },
  { code: "1B0033", label: "ตรวจคัดกรองได้ผลปกติ ไม่ระบุว่าผู้รับบริการเคยตรวจด้วยตนเองหรือไม่", group: "การคัดกรองความเสี่ยง/โรคมะเร็งเต้านม" },
  { code: "1B0040", label: "ตรวจคัดกรองได้ผลผิดปกติ ผู้รับบริการเคยตรวจด้วยตนเองได้ผลปกติ", group: "การคัดกรองความเสี่ยง/โรคมะเร็งเต้านม" },
  { code: "1B0041", label: "ตรวจคัดกรองได้ผลผิดปกติ ผู้รับบริการเคยตรวจด้วยตนเองได้ผลผิดปกติ", group: "การคัดกรองความเสี่ยง/โรคมะเร็งเต้านม" },
  { code: "1B0042", label: "ตรวจคัดกรองได้ผลผิดปกติ ผู้รับบริการไม่เคยตรวจด้วยตนเอง", group: "การคัดกรองความเสี่ยง/โรคมะเร็งเต้านม" },
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
