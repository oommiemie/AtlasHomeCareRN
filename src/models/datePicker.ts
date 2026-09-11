/** The Buddhist era runs 543 years ahead of the common one. */
export const BE_OFFSET = 543;

const pad = (n: number) => String(n).padStart(2, "0");

/** A date as the form writes it: "dd/mm/yyyy", Buddhist era. */
export const toThaiDate = (d: Date) =>
  `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear() + BE_OFFSET}`;

/**
 * Back to a Date, or null if it is not one.
 *
 * A year under 2200 is taken as already common-era: nobody types 1480 for
 * 2023, and a half-typed Buddhist year should not open the picker in the
 * fifteenth century.
 */
export function fromThaiDate(v: string): Date | null {
  const parts = v.split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map((p) => Number(p.trim()));
  if (!d || !m || !y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const year = y > 2200 ? y - BE_OFFSET : y;
  const date = new Date(year, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}
