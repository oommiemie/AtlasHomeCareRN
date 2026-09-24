/**
 * Does the bulk vaccination flow do what the design says?
 *
 * Walks a whole session the way a carer would: open it, look at what the
 * checks stopped, try to record everybody, overrule the ones that can be
 * overruled, and record again. The figures printed here are the ones the
 * screens show, so a change that quietly lets a duplicate dose through
 * shows up as a number moving.
 *
 *     npx tsx scripts/probe-vaccination.ts
 */
import {
  ACTIVITIES,
  LOTS,
  checkTarget,
  closeSession,
  isOpen,
  openSession,
  override,
  record,
  restoreSession,
  rosterFor,
  setGrowth,
  setOutcome,
  snapshotSession,
  growthTally,
  openSessionNow,
  type SessionSnapshot,
} from "../src/models/vaccination";
import { ageBandOf, ageLabel, assess } from "../src/models/growth";
import { planToday } from "../src/models/clock";

const activity = ACTIVITIES[0];
const lot = LOTS[0];

const setup = {
  lot,
  provider: "พ.ญ. สุนิสา ก.",
  providerCode: "P-10428",
  at: planToday,
};
openSession(activity, setup);

const roster = rosterFor(activity);
const checks = roster.map((t) => ({ t, c: checkTarget(t, lot) }));
const warn = checks.filter((x) => x.c.level === "warn");
const review = checks.filter((x) => x.c.level === "review");

console.log(`activity: ${activity.title} · ${activity.place}`);
console.log(`lot ${lot.lot} · ${lot.kind} เข็ม ${lot.dose}`);
console.log(
  `roster ${roster.length} · warn ${warn.length} · review ${review.length}\n`,
);
for (const x of [...warn, ...review]) {
  console.log(`  ${x.c.level.padEnd(6)} ${x.t.name.padEnd(22)} ${x.c.reason}`);
}

const first = record(roster.map((t) => t.id));
console.log(
  `\nfirst save     -> saved ${first.saved} · blocked ${first.failed.length} · follow-ups ${first.followUps}`,
);
/*
  A warning is recorded, not refused — and it leaves a mark.

  A flagged row saves like any other: the person holding the vial is looking
  at the child and the parent while the app is looking at a register that is
  sometimes weeks out of date. What must survive is the record — a dose given
  over a warning with nobody asked why carries the finding itself, and one
  given after a reason was entered carries the reason instead.
*/
const flagged = snapshotSession()!.rows.filter((r) => r.flag != null);
console.log(`recorded over a warning -> ${flagged.length}`);
for (const f of flagged) console.log(`   ${f.flag}`);

if (first.failed.length > 0) {
  console.error("\nFAILED: a ticked row was refused");
  process.exit(1);
}
if (flagged.length !== warn.length) {
  console.error(
    "\nFAILED: a dose given over a warning was recorded as if nothing was wrong",
  );
  process.exit(1);
}

openSession(activity, setup);
override(warn[0].t.id, "แพทย์ผู้รับผิดชอบอนุมัติให้ฉีดได้");
record([warn[0].t.id]);
const asked = snapshotSession()!.rows.find((r) => r.id === warn[0].t.id);
console.log(
  `with a reason given -> flag ${asked?.flag ?? "(none)"} · override "${asked?.override}"`,
);
if (asked?.flag != null || asked?.override == null) {
  console.error("\nFAILED: a reason given was not what the record kept");
  process.exit(1);
}

console.log(
  "\nThe record holds: a warning never stops a save, and never goes unrecorded either.",
);

/* ------------------------------------------------------------------ *
 * Leaving in the middle and coming back
 * ------------------------------------------------------------------ */

console.log("\n--- a sitting left half-finished ---");

const ids = roster.map((t) => t.id);
openSession(activity, setup);
const morning = record(ids.slice(0, 10));
setOutcome(ids[10], "absent", "ลาป่วย");
setOutcome(ids[11], "refused", "ผู้ปกครองไม่ยินยอม");
console.log(`morning -> saved ${morning.saved} · open ${isOpen(activity.id)}`);

// What the store writes, through JSON, as it would reach the disk.
const onDisk = JSON.parse(JSON.stringify(snapshotSession())) as SessionSnapshot;
console.log(
  `kept on disk: ${onDisk.rows.length} decided rows of ${ids.length}`,
);

closeSession();
if (isOpen(activity.id)) {
  console.error("\nFAILED: the session survived being closed");
  process.exit(1);
}

if (!restoreSession(onDisk)) {
  console.error(
    "\nFAILED: a session written one launch would not restore the next",
  );
  process.exit(1);
}
const afternoon = record(ids.slice(13, 20));
const repeat = record(ids.slice(0, 10));
console.log(
  `after resuming -> saved ${afternoon.saved} more · re-saving the morning ten saved ${repeat.saved}`,
);

if (afternoon.saved === 0) {
  console.error("\nFAILED: a restored session would not take any more records");
  process.exit(1);
}
if (repeat.saved > 0) {
  console.error(
    "\nFAILED: a restored session offered names it had already recorded",
  );
  process.exit(1);
}
console.log(
  "\nA sitting survives being left: what was recorded stays recorded, and the rest carries on.",
);

/* ------------------------------------------------------------------ *
 * A weighing round
 * ------------------------------------------------------------------ */

/*
  The other kind of sitting, and the reason `records` exists.

  What is checked here is not the flow — that is the same session, the same
  snapshot and the same close — but the arithmetic the flow is for: that a
  child seeded at −2.1 deviations is read back at −2.1, that the three
  indices disagree where they should (thin now is not the same as short for
  years), and that a room comes out with a believable mix rather than a
  nursery where half the children are wasted.
*/
closeSession();

const weighing = ACTIVITIES.find((a) => a.records === "growth");
if (weighing == null) {
  console.error("\nFAILED: no weighing round in the activities");
  process.exit(1);
}

openSession(weighing, {
  provider: "พ.ญ. สุนิสา ก.",
  providerCode: "P-10428",
  at: new Date(),
});

console.log(`\n${weighing.title} — ${weighing.targets} คน`);

let abnormal = 0;
let watch = 0;
for (const t of rosterFor(weighing)) {
  const e = t.expected;
  if (e == null) {
    console.error(`\nFAILED: ${t.name} has no sample reading to weigh`);
    process.exit(1);
  }
  const verdict = assess({ sex: t.sex, months: t.months, kg: e.kg, cm: e.cm });
  if (verdict.level === "abnormal") abnormal += 1;
  if (verdict.level === "watch") watch += 1;

  setGrowth(t.id, {
    kg: e.kg,
    cm: e.cm,
    head: e.head,
    months: t.months,
    place: "ศพด.",
    feeding: ["อาหารตามวัยครบ 3 มื้อ"],
    bottle: "ไม่ใช้ขวดนม",
    development: "สมวัย",
    level: verdict.level,
    label: verdict.label,
    at: new Date().toISOString(),
  });

  console.log(
    `  ${ageBandOf(t.months).padEnd(16)} ${t.name.padEnd(20)} ${t.sex} ${ageLabel(t.months).padEnd(10)} ` +
      `${e.kg} กก. ${e.cm} ซม. -> ${verdict.label} (${verdict.verdicts.map((v) => v.sd.toFixed(1)).join(" / ")})`,
  );
}

const g = growthTally(openSessionNow()!);
console.log(
  `  => ชั่งแล้ว ${g.measured}/${g.targets} · ผิดปกติ ${g.abnormal} · เฝ้าระวัง ${g.watch}`,
);

if (g.measured !== weighing.targets) {
  console.error("\nFAILED: a weighing was written and the roster did not see it");
  process.exit(1);
}
if (g.abnormal !== abnormal || g.watch !== watch) {
  console.error("\nFAILED: the roster's counts disagree with the verdicts");
  process.exit(1);
}
/*
  A room where more than half the children are outside the bands is not a
  nursery, and a sample roster like that would teach a carer to skim past
  the red. The mix is the one thing about this seed worth guarding.
*/
if (abnormal + watch > weighing.targets / 2) {
  console.error(
    `\nFAILED: ${abnormal + watch} of ${weighing.targets} outside the bands — the sample room is an emergency ward`,
  );
  process.exit(1);
}

// And a weighing survives the phone being put down, the same as a dose.
const weighed = JSON.parse(
  JSON.stringify(snapshotSession()),
) as SessionSnapshot;
closeSession();
if (!restoreSession(weighed)) {
  console.error("\nFAILED: a weighing round would not restore");
  process.exit(1);
}
const back = growthTally(openSessionNow()!);
if (back.measured !== g.measured || back.abnormal !== g.abnormal) {
  console.error(
    `\nFAILED: ${g.measured} weighings went to disk and ${back.measured} came back`,
  );
  process.exit(1);
}

console.log(
  "\nA weighing round reads its own numbers back: the tables agree with the roster, and the roster survives the phone being put down.",
);
