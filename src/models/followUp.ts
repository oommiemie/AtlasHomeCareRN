import type { House, Resident, Village } from "./household";
import { sampleVillages } from "./household";
import { planToday } from "./task";
import { startOfDay } from "../utils/thaiDate";

/** A patient on the register, with the house and village they belong to. */
export type FollowUpPatient = {
  resident: Resident;
  house: House;
  village: Village;
};

/**
 * How closely a patient needs watching. The order is the order of urgency,
 * and it is what the list sorts by.
 *
 * Three bands, not four. "เกินกำหนดประเมิน" used to be its own — but a
 * patient nobody has assessed inside six months needs following up now, which
 * is what "ต้องติดตามด่วน" already says, and splitting them left the carer
 * choosing between two words for one action.
 */
export type FollowUpState = "attention" | "watch" | "stable";

export const FOLLOW_UP_LABEL: Record<FollowUpState, string> = {
  attention: "ต้องติดตามด่วน",
  watch: "เฝ้าระวัง",
  stable: "ปกติ",
};

/** A screening older than this is no longer telling you anything current. */
const ASSESSMENT_VALID_DAYS = 180;

/** The age at which a resident is on routine surveillance regardless. */
const ELDERLY_FROM = 60;

const dayCount = (from: Date, to: Date) =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);

/** How many of the four screenings came back at risk. */
export const riskCount = (r: Resident) =>
  r.screenings.filter((s) => s.status === "atRisk").length;

/**
 * When this patient was last actually assessed.
 *
 * Only screenings with a result count: a panel of "ยังไม่ประเมิน" carries a
 * date — the day the record was opened — and reading that as an assessment
 * would show someone who has never been screened as freshly seen.
 */
export function lastAssessed(r: Resident): Date | undefined {
  const dates = r.screenings
    .filter((s) => s.status !== "unknown")
    .map((s) => s.takenAt.getTime());
  return dates.length === 0 ? undefined : new Date(Math.max(...dates));
}

/** Days since the last assessment; undefined where there has never been one. */
export function daysSinceAssessed(r: Resident, now: Date): number | undefined {
  const last = lastAssessed(r);
  return last == null ? undefined : dayCount(last, now);
}

/**
 * Whether this patient belongs on the health-follow-up register at all.
 *
 * Three ways on: something already flagged on the record, a screening that came back
 * at risk, or age. A register that held everyone would be the household
 * registry with a different title on it, and the carer would have to work out
 * for themselves who on it needed anything.
 */
export function onRegister(r: Resident): boolean {
  return r.needsAttention === true || riskCount(r) > 0 || r.age >= ELDERLY_FROM;
}

/** Where a patient stands today. */
export function followUpStateOf(r: Resident, now: Date): FollowUpState {
  if (r.needsAttention === true) return "attention";
  const since = daysSinceAssessed(r, now);
  // Never assessed is urgent, not stable: an empty panel is a question nobody
  // has asked yet, and a reading six months old has stopped being current.
  if (since == null || since > ASSESSMENT_VALID_DAYS) return "attention";
  return riskCount(r) > 0 ? "watch" : "stable";
}

/** Whether the reason they are urgent is an assessment nobody has done. */
export function isOverdue(r: Resident, now: Date): boolean {
  const since = daysSinceAssessed(r, now);
  return since == null || since > ASSESSMENT_VALID_DAYS;
}

const ORDER: Record<FollowUpState, number> = {
  attention: 0,
  watch: 1,
  stable: 2,
};

/**
 * The carer's own caseload, most urgent first.
 *
 * Built from `sampleVillages`, which is "บ้านที่ดูแล" — the villages this
 * carer is responsible for. There is no wider pool to filter out of: the
 * registry is already theirs.
 */
export const followUpPatients: FollowUpPatient[] = sampleVillages
  .flatMap((village) =>
    village.houses.flatMap((house) =>
      house.residents
        .filter(onRegister)
        .map((resident) => ({ resident, house, village })),
    ),
  )
  .sort((a, b) => {
    const byState =
      ORDER[followUpStateOf(a.resident, planToday)] -
      ORDER[followUpStateOf(b.resident, planToday)];
    if (byState !== 0) return byState;
    // Within a band the one seen longest ago comes first; never-assessed
    // sorts to the top of its band.
    const aDays = daysSinceAssessed(a.resident, planToday) ?? Infinity;
    const bDays = daysSinceAssessed(b.resident, planToday) ?? Infinity;
    return bDays - aDays;
  });

/** What the KPI card counts. */
export function followUpTotals(list: FollowUpPatient[], now: Date) {
  return list.reduce(
    (t, p) => {
      const state = followUpStateOf(p.resident, now);
      return {
        total: t.total + 1,
        attention: t.attention + (state === "attention" ? 1 : 0),
        watch: t.watch + (state === "watch" ? 1 : 0),
        stable: t.stable + (state === "stable" ? 1 : 0),
        // Counted separately from the bands, because it cuts across them: it
        // is the reason many of the urgent ones are urgent, and it is the one
        // thing on this card the three figures cannot say.
        overdue: t.overdue + (isOverdue(p.resident, now) ? 1 : 0),
      };
    },
    { total: 0, attention: 0, watch: 0, stable: 0, overdue: 0 },
  );
}

/**
 * Name, house number or village — the three things a carer knows a patient
 * by when they are looking for one.
 */
export function searchFollowUp(
  list: FollowUpPatient[],
  query: string,
): FollowUpPatient[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return list;
  return list.filter((p) =>
    `${p.resident.name} ${p.house.number} ${p.village.name} ${p.village.mooLabel}`
      .toLowerCase()
      .includes(q),
  );
}
