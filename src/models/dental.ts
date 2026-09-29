/**
 * The school dental check — บัญชี 3, ช่องปาก.
 *
 * What a carer records at a school dental round is not a diagnosis; it is
 * a count and a decision. How many teeth are decayed, whether the gums
 * are inflamed, whether fluoride varnish was applied, and whether this
 * child has to be seen by a dentist. The counting is what makes it a
 * survey; the referral is what makes it worth doing.
 *
 * No file system in here, so the arithmetic can be run and checked
 * without a phone — the same rule `growth` and `dspm` are kept on.
 */

import { tr } from "../i18n";

export type DentalLevel = "normal" | "watch" | "refer";

export const DENTAL_LEVEL_LABEL: Record<DentalLevel, string> = {
  normal: tr("ปกติ", "Normal"),
  watch: tr("เฝ้าระวัง", "Watch"),
  refer: tr("ส่งต่อทันตแพทย์", "Refer to dentist"),
};

export type DentalFinding = {
  /** Decayed deciduous teeth — the "ฟันน้ำนมผุ" column. */
  decayedMilk: number;
  /** Decayed permanent teeth. */
  decayedAdult: number;
  /** Teeth already filled or extracted, which the survey counts separately. */
  treated: number;
  gingivitis: boolean;
  calculus: boolean;
  /** Fluoride varnish applied at this sitting. */
  varnish: boolean;
  /** Fissure sealant on the first permanent molars. */
  sealant: boolean;
};

export const EMPTY_FINDING: DentalFinding = {
  decayedMilk: 0,
  decayedAdult: 0,
  treated: 0,
  gingivitis: false,
  calculus: false,
  varnish: false,
  sealant: false,
};

/**
 * Where a child stands, from what was counted.
 *
 * A decayed permanent tooth is a referral on its own: it does not come
 * back, and a child who loses one at eight has lost it for good. Decayed
 * milk teeth are counted and watched until there are enough of them to be
 * the same problem — three is the line the survey uses.
 *
 * Inflamed gums alone are a watch rather than a referral: they are what
 * brushing fixes, and sending every one of them to a dentist is how a
 * dental clinic stops being able to see the children who need it.
 */
export function assess(f: DentalFinding): {
  level: DentalLevel;
  label: string;
  why: string[];
} {
  const why: string[] = [];
  if (f.decayedAdult > 0)
    why.push(
      tr(
        `ฟันแท้ผุ ${f.decayedAdult} ซี่`,
        `${f.decayedAdult} decayed permanent teeth`,
      ),
    );
  if (f.decayedMilk > 0)
    why.push(
      tr(
        `ฟันน้ำนมผุ ${f.decayedMilk} ซี่`,
        `${f.decayedMilk} decayed primary teeth`,
      ),
    );
  if (f.gingivitis) why.push(tr("เหงือกอักเสบ", "Gingivitis"));
  if (f.calculus) why.push(tr("มีหินปูน", "Calculus"));

  const level: DentalLevel =
    f.decayedAdult > 0 || f.decayedMilk >= 3
      ? "refer"
      : f.decayedMilk > 0 || f.gingivitis || f.calculus
        ? "watch"
        : "normal";
  return { level, label: DENTAL_LEVEL_LABEL[level], why };
}

/** What to tell the family, from what was found. */
export function adviceFor(f: DentalFinding): string[] {
  const out = [
    tr(
      "แปรงฟันวันละ 2 ครั้ง เช้าและก่อนนอน ด้วยยาสีฟันผสมฟลูออไรด์",
      "Brush twice a day, morning and before bed, with fluoride toothpaste",
    ),
  ];
  if (f.decayedMilk > 0 || f.decayedAdult > 0) {
    out.push(
      tr(
        "ลดขนมหวานและน้ำอัดลมระหว่างมื้อ",
        "Cut down on sweets and soft drinks between meals",
      ),
    );
  }
  if (f.gingivitis || f.calculus) {
    out.push(
      tr(
        "แปรงให้ถึงขอบเหงือก และใช้ไหมขัดฟันวันละครั้ง",
        "Brush along the gum line and floss once a day",
      ),
    );
  }
  if (f.decayedAdult > 0 || f.decayedMilk >= 3) {
    out.push(
      tr(
        "นัดพบทันตแพทย์เพื่ออุดหรือรักษา ภายใน 1 เดือน",
        "Book a dentist for fillings or treatment within 1 month",
      ),
    );
  }
  if (!f.varnish)
    out.push(
      tr(
        "นัดเคลือบฟลูออไรด์ในรอบถัดไป",
        "Book fluoride varnish at the next round",
      ),
    );
  return out;
}

/** What is written into the register for one child. */
export type DentalRecord = DentalFinding & {
  level: DentalLevel;
  label: string;
  /** Where the sitting was held. */
  place: string;
  at: string;
};
