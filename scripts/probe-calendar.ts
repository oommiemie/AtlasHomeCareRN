/**
 * The two-year calendar, and everything counted off it.
 *
 * The plan, the register and the day summary are all the same list read
 * three ways, which is the whole point of building it from rules — so the
 * thing to check is that the three still agree, and that a fortnight of it
 * looks like work somebody could actually do.
 */
import { schedule, SPAN } from "../src/models/calendar";
import { ACTIVITIES, isToday, daysLate, activitiesOf } from "../src/models/vaccination";
import { sampleVillages, everyResident, villagePopulation } from "../src/models/household";
import { todayTasks, planToday } from "../src/models/task";

let bad = 0;
const ok = (what: string, pass: boolean, saw?: unknown) => {
  if (!pass) bad++;
  console.log(`  ${pass ? "✓" : "✗"} ${what}${pass || saw === undefined ? "" : ` — ${JSON.stringify(saw)}`}`);
};

const now = new Date();
const day = (d: Date) => d.toISOString().slice(0, 10);
const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

console.log(`ปฏิทิน ${day(SPAN.from)} → ${day(SPAN.to)} · ${ACTIVITIES.length} รายการ`);
{
  ok("ทุกงานอยู่ในช่วงสองปี", ACTIVITIES.every((a) => a.at >= SPAN.from && a.at <= new Date(SPAN.to.getTime() + 86400000)));
  ok("ไม่มีงานตกเสาร์-อาทิตย์", ACTIVITIES.every((a) => a.at.getDay() !== 0 && a.at.getDay() !== 6));
  ok("ไม่มี id ซ้ำ", new Set(ACTIVITIES.map((a) => a.id)).size === ACTIVITIES.length);
  ok("เรียงตามเวลา", ACTIVITIES.every((a, i) => i === 0 || ACTIVITIES[i - 1].at <= a.at));
  ok("ทุกงานมีคนอย่างน้อย 1", ACTIVITIES.every((a) => a.targets >= 1), ACTIVITIES.filter((a) => a.targets < 1).length);
  ok("ไม่มีรอบไหนเกิน 60 คน", ACTIVITIES.every((a) => a.targets <= 60), Math.max(...ACTIVITIES.map((a) => a.targets)));
  ok("เดิมซ้ำสองครั้งได้ผลเท่ากัน", JSON.stringify(schedule(now).map((a) => a.id)) === JSON.stringify(schedule(now).map((a) => a.id)));
}

console.log("\nงานวันนี้");
{
  const today = ACTIVITIES.filter((a) => isToday(a, now));
  for (const k of ["vaccination", "schoolHealth", "screening", "dental"] as const) {
    const n = today.filter((a) => a.kind === k).length;
    ok(`${k} มีงานวันนี้ ≥ 3`, n >= 3, n);
  }
  /*
    One carer, one pair of legs.

    Two sittings ten minutes apart at two different places is not a day
    anybody could work — which is what the samples looked like until the
    fill-in hours came off a ladder instead of being written per sitting.
  */
  const inOrder = [...today].sort((a, b) => a.at.getTime() - b.at.getTime());
  let closest = Infinity;
  for (let i = 1; i < inOrder.length; i++) {
    if (inOrder[i].place === inOrder[i - 1].place) continue;
    closest = Math.min(
      closest,
      (inOrder[i].at.getTime() - inOrder[i - 1].at.getTime()) / 60000,
    );
  }
  ok("ย้ายสถานที่มีเวลาอย่างน้อย 30 นาที", closest >= 30, `${closest} นาที`);
  ok("ไม่มีสองรอบเวลาเดียวกันเป๊ะ", new Set(today.map((a) => a.at.getTime())).size === today.length);
  ok("ทุกงานวันนี้ยังไม่เกินกำหนด", today.every((a) => daysLate(a, now) === 0));
}

console.log("\nงานค้าง");
{
  for (const k of ["vaccination", "schoolHealth", "screening", "dental"] as const) {
    const late = activitiesOf(k).filter((a) => daysLate(a, now) > 0 && daysLate(a, now) <= 90);
    ok(`${k} มีงานย้อนหลัง 90 วันให้ปิด`, late.length > 0, late.length);
  }
}

console.log("\nทะเบียนบ้าน");
{
  ok("ไม่เกิน 5 หมู่บ้าน", sampleVillages.length <= 5, sampleVillages.length);
  ok("ทุกหมู่บ้านไม่เกิน 10 หลังคาเรือน", sampleVillages.every((v) => v.houses.length <= 10), sampleVillages.map((v) => v.houses.length));
  ok("ไม่มีหมู่บ้านที่ทุกบ้านมีคนเดียว", sampleVillages.every((v) => new Set(v.houses.map((h) => h.residents.length)).size > 1));
  ok("ทุกบ้านมีคนอย่างน้อยหนึ่ง", sampleVillages.every((v) => v.houses.every((h) => h.residents.length >= 1)));
  ok("id คนไม่ซ้ำกันทั้งทะเบียน", new Set(everyResident.map((r) => r.id)).size === everyResident.length);
  ok("ประชากรรวมตรงกับผลรวมรายหมู่บ้าน", everyResident.length === sampleVillages.reduce((n, v) => n + villagePopulation(v), 0));
}

console.log("\nแผนเยี่ยมบ้านวันนี้");
{
  const all = todayTasks();
  ok("มีภารกิจวันนี้", all.length > 0, all.length);
  ok("ทุกภารกิจลงวันนี้", all.every((t) => startOf(t.dueAt) === startOf(planToday)), all.length);
  ok("ทุกภารกิจมีชื่อคน", all.every((t) => t.name.trim() !== ""));
}

console.log(
  bad === 0
    ? "\nปฏิทิน ทะเบียน และแผนวันนี้ ตรงกันทั้งระบบ"
    : `\nล้มเหลว ${bad} ข้อ`,
);
if (bad > 0) process.exitCode = 1;
