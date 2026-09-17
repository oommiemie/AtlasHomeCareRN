/**
 * The account Provider ID hands back when a carer signs in.
 *
 * None of it is the app's to change: the citizen ID, the name, the date of
 * birth and the post all belong to the provider register at id.moph.go.th,
 * and a telephone or an address edited here would be true in this app and
 * nowhere else. So the profile page shows these and offers no field — the
 * one thing it does let a carer set is their photograph, which is the
 * app's own and never leaves the phone.
 *
 * Stood in for, like the rest of the sample data. The citizen ID below is
 * a deliberately sequential number that happens to satisfy the Thai check
 * digit: it has to look like an ID to lay out correctly, and it must not
 * be able to belong to anybody.
 */
export type ProviderAccount = {
  /** What they sign in as. */
  username: string;
  citizenId: string;
  /** ISO, yyyy-mm-dd. */
  birthDate: string;
  phone: string;
  email: string;
  /** "พยาบาลวิชาชีพ" — the post the register holds, not a job title we set. */
  profession: string;
};

export const STAND_IN_ACCOUNT: ProviderAccount = {
  username: "sukhaphapdee.j",
  citizenId: "1234567890121",
  birthDate: "1992-05-14",
  phone: "081-234-5678",
  email: "sukhaphapdee.j@moph.go.th",
  profession: "พยาบาลวิชาชีพ",
};

/** 081-234-5678 out of 0812345678, and anything else left alone. */
export function prettyPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 10) return phone;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * A citizen ID with its middle hidden — four digits open at each end.
 *
 * Shown rather than withheld, because a carer needs to know WHICH card the
 * account is tied to, and the ends are what they recognise it by: the
 * leading digits say where it was issued and the last four are what anyone
 * reads a number back from. The five in between are the part worth having
 * to somebody reading the screen over a shoulder, and they are the part
 * that goes. The bullets keep the number's length, so a masked ID still
 * reads as an ID.
 */
export function maskCitizenId(id: string): string {
  const digits = id.replace(/\D/g, "");
  // Nothing left to hide once the two open ends meet.
  if (digits.length <= 8) return digits;
  return digits.slice(0, 4) + "•".repeat(digits.length - 8) + digits.slice(-4);
}
