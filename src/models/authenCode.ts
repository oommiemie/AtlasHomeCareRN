/**
 * The units this carer may issue an Authen Code under.
 *
 * An Authen Code is what a service is authenticated against before it can
 * be claimed: it is issued by a หน่วยบริการ, and a carer whose Provider ID
 * is attached to more than one holds a right at each. Which one is in force
 * decides who the work is claimed by, so it is a setting rather than
 * something the app can infer — two of these can sit in the same tambon and
 * see the same patients on the same morning.
 *
 * Stood in for, like the rest of the sample data. The first is the same
 * ศูนย์บริการสาธารณสุข the session signs in under, so the page a carer
 * opens agrees with the card on their account.
 */
export type AuthenRight = {
  id: string;
  /** The unit's name as the register holds it. */
  name: string;
  /** The five digits the code is issued under. */
  code: string;
  /** The posting the register treats as this carer's own. */
  primary?: boolean;
};

export const AUTHEN_RIGHTS: AuthenRight[] = [
  {
    id: "ar1",
    name: "ศูนย์บริการสาธารณสุข 58 ล้อม-พิมเสน ฟักอุดม",
    code: "11477",
    primary: true,
  },
  {
    id: "ar2",
    name: "โรงพยาบาลส่งเสริมสุขภาพตำบลบ้านหนองแสง",
    code: "05821",
  },
  { id: "ar3", name: "คลินิกชุมชนอบอุ่น ทุ่งครุ", code: "22106" },
];

/** Where a carer who has never chosen starts: the register's own posting. */
export const DEFAULT_AUTHEN_RIGHT =
  AUTHEN_RIGHTS.find((r) => r.primary) ?? AUTHEN_RIGHTS[0];

export const authenRightById = (id: string | null): AuthenRight =>
  AUTHEN_RIGHTS.find((r) => r.id === id) ?? DEFAULT_AUTHEN_RIGHT;
