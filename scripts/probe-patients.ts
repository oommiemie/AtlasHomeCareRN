/**
 * Is every visit about a real person, and does every person read differently?
 *
 * The app used to carry two populations — the patients a carer visits and the
 * people living in the registry's villages — with nothing crossing between
 * them, and one clinical record shared by all of them. This is the check that
 * it stays joined up: a visit that cannot find its patient, or two patients
 * reading identically, is the old bug coming back.
 *
 *     npx tsx scripts/probe-patients.ts
 */
import { visitPatients, residentById } from "../src/models/household";
import { detailOf } from "../src/models/patientDetail";
import { yearTasks, isDone } from "../src/models/task";
import { latestVitals, abnormalNow, metricOf, formatReading, statusOf } from "../src/models/vitals";
import type { MetricKind } from "../src/models/vitals";

const linked = yearTasks.filter((t) => residentById(t.residentId) != null);
console.log(`visits: ${yearTasks.length}, linked to a real person: ${linked.length}`);
console.log(`visit patients in the registry: ${visitPatients.length}`);

const seen = new Map<string, string>();
for (const p of visitPatients) {
  const d = detailOf({ residentId: p.resident.id });
  const key = `${d.condition}|${d.allergies}|${d.bloodPressure}|${d.adl}`;
  seen.set(p.resident.name, key);
}
console.log(`\ndistinct records across ${seen.size} patients: ${new Set(seen.values()).size}`);
for (const [name, key] of [...seen].slice(0, 4)) console.log(`  ${name}\n     ${key}`);

const who = visitPatients[3].resident;
const latest = latestVitals(who);
console.log(`\nreadings for ${who.name}:`);
for (const k of Object.keys(latest) as MetricKind[]) {
  const r = latest[k]!; const m = metricOf(k);
  console.log(`  ${m.name} ${formatReading(m, r)} ${m.unit} -> ${statusOf(k, r.value, r.value2).label}`);
}
console.log(`  abnormal now: ${abnormalNow(who).map((a) => a.metric.name).join(", ") || "none"}`);

const orphans = yearTasks.length - linked.length;
const shared = seen.size - new Set(seen.values()).size;
if (orphans > 0 || shared > 0) {
  console.error(
    `\nFAILED: ${orphans} visits with no person, ${shared} patients sharing a record`,
  );
  process.exit(1);
}
console.log("\nEvery visit names a real person, and every person reads as themselves.");
