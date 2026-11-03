import { planToday } from "./clock";
import { SPAN } from "./calendar";
import { residentById, type Resident } from "./household";
import { visitsOfYear, VISIT_TYPES, visitTypeLabel, type Task } from "./task";
import { ACTIVITIES, type ActivityKind } from "./vaccination";
import {
  countsOf,
  dayKey,
  fromArchive,
  growthCountsOf,
  type Done,
} from "./vaccineHistory";
import { tr } from "../i18n";

/**
 * The year's work, as the carer's KPI is assessed from it.
 *
 * A report is read once a year by somebody deciding whether the work was
 * done, so every figure here is a share of what was planned rather than a
 * count of what happened: forty visits is a good year for a carer with
 * forty on the plan and a bad one for a carer with eighty. What has not
 * fallen due yet is left out of both sides — a December visit is not a
 * miss in November.
 */

export type KpiKey = "visits" | ActivityKind;

export type Kpi = {
  key: KpiKey;
  title: string;
  /** What is being divided by what, in the words a reviewer uses. */
  measure: string;
  done: number;
  total: number;
  /** The pass mark, as a share. */
  target: number;
  /** Null where nothing fell due, which is not a pass and not a fail. */
  rate: number | null;
  pass: boolean | null;
  /** How many more it would have taken to reach the mark; 0 once it is met. */
  short: number;
  /** One further line the indicator is read with, where it has one. */
  note?: string;
};

export type MonthFigures = {
  /** Home visits made. */
  visits: number;
  /** People served at group work — dosed, weighed, screened, examined. */
  people: number;
};

/** One sitting of group work in the year, as the export lists it. */
export type RoundRow = {
  at: Date;
  kind: ActivityKind;
  title: string;
  place: string;
  group: string;
  targets: number;
  /** Null where the round has not been served yet. */
  served: number | null;
  state: "closed" | "open" | "ahead";
};

export type Report = {
  year: number;
  /** Whether the year is still going, so its figures are to date. */
  partial: boolean;
  /** The last moment counted. */
  asOf: Date;
  kpis: Kpi[];
  passed: number;
  scored: number;
  /**
   * One figure for the year, out of 100: how far each indicator got toward
   * its own mark, averaged. An indicator at or past its mark gives its whole
   * share and no more, so a strong one cannot paper over a weak one.
   */
  score: number | null;
  visits: {
    planned: number;
    done: number;
    /** Due and not made. */
    missed: number;
    /** Still to come this year. */
    ahead: number;
    byType: { label: string; done: number; total: number }[];
  };
  rounds: {
    held: number;
    /** Fell due and has not been closed. */
    open: number;
    ahead: number;
    people: number;
  };
  months: MonthFigures[];
  /** Every visit planned in the year, due or not, in date order. */
  plan: Task[];
  /** Every group round in the year, in date order. */
  roundList: RoundRow[];
};

/*
  The pass marks.

  Ninety per cent is the line the ministry's own indicators draw for
  coverage — immunisation, developmental screening, the school checks — and
  the home-visit plan is held to the same. Dental is lower because a school
  round is commonly marked at eighty-five. One table, so a unit that marks
  differently changes it here and nowhere else.
*/
const TARGET: Record<KpiKey, number> = {
  visits: 0.9,
  vaccination: 0.9,
  schoolHealth: 0.9,
  screening: 0.9,
  dental: 0.85,
};

const KINDS: ActivityKind[] = [
  "vaccination",
  "schoolHealth",
  "screening",
  "dental",
];

const TITLE: Record<KpiKey, string> = {
  visits: tr("เยี่ยมบ้านตามแผน", "Home visits to plan"),
  vaccination: tr("ความครอบคลุมวัคซีน", "Immunisation coverage"),
  schoolHealth: tr("ตรวจสุขภาพนักเรียน", "Student health checks"),
  screening: tr("คัดกรองพัฒนาการเด็ก", "Child development screening"),
  dental: tr("ตรวจสุขภาพช่องปาก", "Oral health checks"),
};

const MEASURE: Record<KpiKey, string> = {
  visits: tr(
    "เยี่ยมแล้ว ÷ นัดเยี่ยมที่ถึงกำหนด",
    "Visits made ÷ visits due",
  ),
  vaccination: tr(
    "ได้รับวัคซีน ÷ เป้าหมายในรอบที่ถึงกำหนด",
    "Vaccinated ÷ targets of rounds due",
  ),
  schoolHealth: tr(
    "ได้รับการตรวจ ÷ นักเรียนเป้าหมาย",
    "Checked ÷ students targeted",
  ),
  screening: tr(
    "ได้รับการคัดกรอง ÷ เด็กเป้าหมาย",
    "Screened ÷ children targeted",
  ),
  dental: tr(
    "ได้รับการตรวจฟัน ÷ เด็กเป้าหมาย",
    "Examined ÷ children targeted",
  ),
};

/** The years there is a plan for, latest first. */
export function reportYears(): number[] {
  const out: number[] = [];
  for (let y = planToday.getFullYear(); y >= SPAN.from.getFullYear(); y--) {
    out.push(y);
  }
  return out;
}

const share = (done: number, total: number) =>
  total === 0 ? null : done / total;

function kpi(key: KpiKey, done: number, total: number, note?: string): Kpi {
  const rate = share(done, total);
  return {
    key,
    title: TITLE[key],
    measure: MEASURE[key],
    done,
    total,
    target: TARGET[key],
    rate,
    pass: rate == null ? null : rate >= TARGET[key],
    short: Math.max(0, Math.ceil(TARGET[key] * total - done - 1e-9)),
    note,
  };
}

/**
 * The report for one year.
 *
 * `history` is the phone's own register. A round still on the phone is
 * read from it — it holds what the carer actually wrote — and one older
 * than the phone keeps comes from the unit's records (`fromArchive`). A
 * round that fell due and is in neither has not been closed, and counts as
 * its whole roster not yet served.
 */
export function buildReport(year: number, history: Done[], now: Date): Report {
  const end = new Date(year + 1, 0, 1);
  const partial = now < end;
  const asOf = partial ? now : new Date(year, 11, 31, 23, 59);
  const months: MonthFigures[] = Array.from({ length: 12 }, () => ({
    visits: 0,
    people: 0,
  }));

  /* ---------------------------------------------------- home visits */

  const plan = visitsOfYear(year);
  const due = plan.filter((t) => t.dueAt <= asOf);
  const made = (t: Task) => t.status === "done";
  for (const t of due) if (made(t)) months[t.dueAt.getMonth()].visits++;
  const visitsDone = due.filter(made).length;

  const byType = VISIT_TYPES.map((v) => {
    const of = due.filter((t) => t.visitType === v);
    return {
      label: visitTypeLabel(v),
      done: of.filter(made).length,
      total: of.length,
    };
  }).filter((r) => r.total > 0);

  /* ----------------------------------------------------- group work */

  const filed = new Map(history.map((d) => [d.id, d]));
  const tally = Object.fromEntries(
    KINDS.map((k) => [k, { served: 0, targets: 0, flagged: 0 }]),
  ) as Record<ActivityKind, { served: number; targets: number; flagged: number }>;
  let held = 0;
  let open = 0;
  let ahead = 0;
  let people = 0;
  const roundList: RoundRow[] = [];

  for (const a of ACTIVITIES) {
    if (a.at.getFullYear() !== year) continue;
    const row = {
      at: a.at,
      kind: a.kind,
      title: a.title,
      place: a.place,
      group: a.group,
      targets: a.targets,
    };
    if (a.at > asOf) {
      ahead++;
      roundList.push({ ...row, served: null, state: "ahead" });
      continue;
    }
    const d = filed.get(dayKey(a.id, a.at)) ?? fromArchive(a, now);
    const t = tally[a.kind];
    if (d == null) {
      open++;
      t.targets += a.targets;
      roundList.push({ ...row, served: null, state: "open" });
      continue;
    }
    const c = countsOf(d);
    roundList.push({ ...row, targets: c.targets, served: c.recorded, state: "closed" });
    held++;
    t.served += c.recorded;
    t.targets += c.targets;
    people += c.recorded;
    months[a.at.getMonth()].people += c.recorded;
    if (a.kind === "screening") {
      const g = growthCountsOf(d);
      t.flagged += g.watch + g.abnormal;
    }
  }

  const screened = tally.screening;
  const kpis = [
    kpi("visits", visitsDone, due.length),
    ...KINDS.map((k) =>
      kpi(
        k,
        tally[k].served,
        tally[k].targets,
        k === "screening" && screened.served > 0
          ? tr(
              `พบสงสัยล่าช้า ${screened.flagged} คน (${pct(screened.flagged / screened.served)})`,
              `${screened.flagged} suspected delay (${pct(screened.flagged / screened.served)})`,
            )
          : undefined,
      ),
    ),
  ];
  const scored = kpis.filter((k) => k.pass != null);

  return {
    year,
    partial,
    asOf,
    kpis,
    passed: scored.filter((k) => k.pass).length,
    scored: scored.length,
    score:
      scored.length === 0
        ? null
        : Math.round(
            (scored.reduce(
              (n, k) => n + Math.min(1, (k.rate ?? 0) / k.target),
              0,
            ) /
              scored.length) *
              100,
          ),
    visits: {
      planned: plan.length,
      done: visitsDone,
      missed: due.length - visitsDone,
      ahead: plan.length - due.length,
      byType,
    },
    rounds: { held, open, ahead, people },
    months,
    plan: [...plan].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime()),
    roundList,
  };
}

/** A share as the report prints it: "92.4%", or a dash where there is none. */
export function pct(rate: number | null): string {
  if (rate == null) return "–";
  const p = rate * 100;
  return `${p >= 99.95 || p === 0 ? p.toFixed(0) : p.toFixed(1)}%`;
}

/** One person on the year's round, with how their visits went. */
export type PatientRow = {
  residentId: string;
  name: string;
  age: number;
  resident: Resident | undefined;
  address: string;
  /** Why they are visited — the latest visit's reason. */
  detail: string;
  visitType: string;
  /** Visits that fell due. */
  due: number;
  done: number;
  missed: number;
  /** Still to come in the year. */
  ahead: number;
  lastVisit: Date | null;
  nextVisit: Date | null;
};

/**
 * The people the year's visits were for, one row each.
 *
 * Those with visits missed come first, most missed at the top — the list is
 * read to find who fell through — and then by name.
 */
export function patientsOf(report: Report): PatientRow[] {
  const rows = new Map<string, PatientRow>();
  for (const t of report.plan) {
    let r = rows.get(t.residentId);
    if (r == null) {
      r = {
        residentId: t.residentId,
        name: t.name,
        age: t.age,
        resident: residentById(t.residentId),
        address: t.address ?? "",
        detail: t.detail,
        visitType: visitTypeLabel(t.visitType ?? ""),
        due: 0,
        done: 0,
        missed: 0,
        ahead: 0,
        lastVisit: null,
        nextVisit: null,
      };
      rows.set(t.residentId, r);
    }
    if (t.dueAt > report.asOf) {
      r.ahead++;
      if (r.nextVisit == null) r.nextVisit = t.dueAt;
      continue;
    }
    r.due++;
    r.detail = t.detail;
    r.visitType = visitTypeLabel(t.visitType ?? "");
    if (t.status === "done") {
      r.done++;
      r.lastVisit = t.dueAt;
    } else {
      r.missed++;
    }
  }
  return [...rows.values()].sort(
    (a, b) => b.missed - a.missed || a.name.localeCompare(b.name, "th"),
  );
}
