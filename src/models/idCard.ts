import type { ScannedLine } from "../../modules/id-scanner";
import type { DraftMember } from "./houseDraft";

/**
 * The courtesy titles a Thai ID prints, with the sex each one carries.
 *
 * Longest first, because "นางสาว" starts with "นาง" — matched the other way
 * round, every young woman comes back as "นาง" with "สาว" left on the front
 * of her name.
 *
 * The sex is a table, not a reading of the word: "นางสาว" contains neither
 * "หญิง" nor "ชาย", and testing for those makes every นางสาว a man.
 */
const TITLES: readonly { title: string; gender: string }[] = [
  { title: "นางสาว", gender: "หญิง" },
  { title: "เด็กหญิง", gender: "หญิง" },
  { title: "เด็กชาย", gender: "ชาย" },
  { title: "นาง", gender: "หญิง" },
  { title: "นาย", gender: "ชาย" },
];

/** Thai month abbreviations as they appear on a card, in order. */
const MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

/** And in English, for the line printed under the Thai one. */
const MONTHS_EN = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

/** What could be read off the card. Anything absent is left to be typed. */
export type ScannedId = Partial<
  Pick<DraftMember, "idCard" | "title" | "name" | "birthDate" | "gender" | "religion">
>;

/**
 * The 13-digit citizen number.
 *
 * Printed in groups — "1 2345 67891 23 4" — and Vision returns the groups as
 * it finds them, so the digits are gathered from the whole line rather than
 * matched as one run. The checksum is what tells a real number from thirteen
 * digits that happened to be adjacent: each of the first twelve is weighted
 * 13 down to 2, and the last is what makes the total a multiple of eleven.
 */
export function citizenIdIn(text: string): string | null {
  const digits = text.replace(/\D/g, "");
  for (let i = 0; i + 13 <= digits.length; i += 1) {
    const candidate = digits.slice(i, i + 13);
    if (validCitizenId(candidate)) return candidate;
  }
  return null;
}

export function validCitizenId(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(id[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(id[12]);
}

/** The title a name starts with, and what is left of the line after it. */
function titleOf(line: string): { title: string; gender: string; rest: string } | null {
  for (const t of TITLES) {
    if (line.startsWith(t.title)) {
      return { title: t.title, gender: t.gender, rest: line.slice(t.title.length).trim() };
    }
  }
  return null;
}

/**
 * A date of birth as "dd/mm/yyyy" in the Buddhist era — how the form asks for
 * it, and how the card prints it.
 *
 * Both lines are tried. The Thai one is already in the Buddhist era; the
 * English one is common era and is converted, so whichever Vision read more
 * cleanly can answer.
 */
export function birthDateIn(line: string): string | null {
  const thai = line.match(/(\d{1,2})\s*(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)\s*(\d{4})/);
  if (thai) {
    const month = MONTHS.indexOf(thai[2]) + 1;
    return `${pad(thai[1])}/${pad(String(month))}/${thai[3]}`;
  }

  const english = line.toLowerCase().match(/(\d{1,2})\s+([a-z]{3})[a-z.]*\s+(\d{4})/);
  if (english) {
    const month = MONTHS_EN.indexOf(english[2]) + 1;
    if (month > 0) {
      // The English line is common era; the form is Buddhist.
      return `${pad(english[1])}/${pad(String(month))}/${Number(english[3]) + 543}`;
    }
  }
  return null;
}

const pad = (v: string) => v.padStart(2, "0");

/**
 * What a photograph of a card yields.
 *
 * Every field is found on its own terms and independently: a card read at an
 * angle, in poor light, or with a thumb over one corner gives some lines and
 * not others, and the useful thing is the ones it did give. Whatever comes
 * back empty is simply left for the carer to type.
 *
 * Lines are read top to bottom — Vision returns them in the order it found
 * them, which is not the order they are printed in.
 */
export function readIdCard(lines: ScannedLine[]): ScannedId {
  const ordered = [...lines].sort((a, b) => b.y - a.y);
  const found: ScannedId = {};

  const all = ordered.map((l) => l.text).join("\n");
  const id = citizenIdIn(all);
  if (id != null) found.idCard = id;

  for (const line of ordered) {
    const text = line.text.trim();

    if (found.title == null) {
      const named = titleOf(text);
      // A title on its own line is the label above the name, not the name.
      if (named != null && named.rest.length > 0) {
        found.title = named.title;
        found.name = named.rest;
        found.gender = named.gender;
      }
    }

    if (found.birthDate == null) {
      const born = birthDateIn(text);
      if (born != null) found.birthDate = born;
    }
  }

  return found;
}

/** How many of the form's fields a scan actually filled. */
export const scannedCount = (s: ScannedId) =>
  Object.values(s).filter((v) => typeof v === "string" && v.length > 0).length;
