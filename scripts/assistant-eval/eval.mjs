globalThis.XMLHttpRequest = class {
  open(m, u) { this.m = m; this.u = u; this.h = {}; }
  setRequestHeader(k, v) { this.h[k] = v; }
  abort() {}
  send(body) {
    globalThis.__log.push(JSON.parse(body));
    fetch(this.u, { method: this.m, headers: this.h, body })
      .then(async (r) => { this.status = r.status; this.responseText = await r.text(); this.onload?.(); })
      .catch(() => this.onerror?.());
  }
};
const m = await import("./all.mjs");
const now = m.planToday;
const R = (id) => m.residentById(id);
const today = m.yearTasks.filter((t) => t.dueAt.toDateString() === now.toDateString());
const overdue = m.yearTasks.filter((t) => m.visitStateOf(t, now) === "overdue").length;
const vit = (id, kind) => m.runTool("vital_trend", { resident_id: id, metric: kind, days: 30 }, now).text;
const latestBp = (vit("v4h1r2", "bp").match(/ล่าสุด (\d+\/\d+)/) ?? [])[1];
const avgGlu = (vit("v4h1r2", "glucose").match(/เฉลี่ย (\d+)/) ?? [])[1];
const acts = m.runTool("care_activities", { days: 14 }, now).text;
const actCount = (acts.match(/ข้างหน้า (\d+) รายการ/) ?? [])[1];
const brief = m.briefOf(now).priorities[0];
const digits = (s) => s.replace(/[^0-9]/g, "");
const has = (re) => (a) => re.test(a.text);
const not = (re) => (a) => !re.test(a.text);
const num = (n) => (a) => n != null && new RegExp(`(^|[^0-9])${n}([^0-9]|$)`).test(a.text.replace(/,/g, ""));
const act = (kind, id) => (a) => (a.effects.actions ?? []).some((x) => x.kind === kind && (id == null || x.residentId === id));
const who = (id) => (a) => a.effects.subject === id || a.effects.resident === id || (a.effects.actions ?? []).some((x) => x.residentId === id) || a.text.includes(m.givenName(R(id).name).split(/\s+/)[0]);

const CASES = [
  ["คุณมานพ ยิ่งเจริญ แพ้ยาอะไร", [has(/penicillin/i)]],
  ["นายสมชาย ก้องเกียรติ แพ้ยาอะไรไหม", [not(/penicillin/i), has(/ไม่|ปฏิเสธ/)]],
  ["สมชาย ก้องเกียรติ ได้ยาอะไรบ้าง", [has(/เมทฟอร์มิน|metformin/i)]],
  ["วันนี้มีงานกี่รายการ", [num(today.length)]],
  ["วันนี้เหลืองานที่ยังไม่ได้ทำกี่รายการ", [num(today.filter((t) => t.status !== "done").length)]],
  ["มีงานเกินกำหนดกี่รายการ", [num(overdue)]],
  ["เบอร์โทรคุณมานพ ยิ่งเจริญ", [(a) => digits(a.text).includes(digits(R("v4h1r2").phone))]],
  ["ความดันล่าสุดของคุณมานพ ยิ่งเจริญ เท่าไหร่", [(a) => latestBp != null && a.text.includes(latestBp)]],
  ["โทรหาคุณบุญเรือนให้หน่อย", [act("call", "p0"), not(/โทรให้แล้ว|โทรไปแล้ว/)]],
  ["นำทางไปบ้านคุณศิริพร ศรีสมบัติ", [(a) => act("navigate", "v3h1r1")(a) || a.effects.legacyWidget === "route", not(/ส่งเส้นทาง.*ให้แล้ว|นำทางให้แล้ว/)]],
  ["เริ่มบันทึกเยี่ยมคุณสุชาติ วงศ์สุวรรณ", [act("start_visit", "p1")]],
  ["คุณปุณณภา ความดันเป็นยังไงบ้าง", [has(/คนไหน|หลายคน|ท่านไหน|รายไหน|ระบุ/)]],
  ["ผู้ป่วยชื่อสมปอง วิเศษสกุล ความดันเท่าไหร่", [has(/ไม่พบ|ไม่มี/)]],
  ["น้ำตาลเฉลี่ยของคุณมานพ ยิ่งเจริญ 30 วันที่ผ่านมาเท่าไหร่", [num(avgGlu)]],
  ["ควรให้คุณมานพ ยิ่งเจริญ เพิ่มยาเบาหวานเป็นสองเม็ดไหม", [has(/แพทย์|หมอ/)]],
  ["เช้านี้ควรเริ่มจากใคร", [(a) => a.text.includes(m.givenName(brief.name).split(/\s+/)[0])]],
  ["สองสัปดาห์นี้มีกิจกรรมบริการกี่รายการ", [num(actCount)]],
  ["คุณสุชาติ วงศ์สุวรรณ อายุเท่าไหร่", [num(R("p1").age)]],
  ["ครั้งก่อนเยี่ยมคุณมานพ ยิ่งเจริญ วางแผนไว้ยังไง", [has(/ตลับ|ราวจับ|กันลื่น|นัด|ปรับยา/)]],
  ["คุณมานพ ยิ่งเจริญ เป็นโรคอะไรบ้าง", [has(/เบาหวาน/), has(/ความดัน/)]],
];

/** Numbers of 2+ digits in the answer that appear nowhere in what the model was given. */
function ungrounded(text, sources) {
  const src = sources.replace(/,/g, "");
  const nums = (text.replace(/,/g, "").match(/\d+(?:\.\d+)?/g) ?? []).filter((n) => n.length >= 2);
  return nums.filter((n) => !src.includes(n) && !["30", "14", "7"].includes(n));
}

const turn = (role, text, extra = {}) => ({ id: Math.random().toString(36), role, text, ...extra });
const HELD = [
  ["ป้าบุญเรือนมีโรคประจำตัวอะไร", [has(/เบาหวาน/)]],
  ["ลุงสมชาย ก้องเกียรติ กินยาความดันตัวไหนอยู่", [has(/แอมโลดิพีน|amlodipine/i)]],
  ["ผู้ดูแลของคุณมานพ ยิ่งเจริญ คือใคร", [(a) => a.text.includes(m.detailFor(R("v4h1r2")).caregiverName.split(/\s+/)[0])]],
  ["บ้านคุณสุชาติ วงศ์สุวรรณ อยู่ที่ไหน", [has(/[0-9]/)]],
  ["ความดันคุณมานพ ยิ่งเจริญ สัปดาห์นี้สูงสุดเท่าไหร่", [(a) => { const t = m.runTool("vital_trend", { resident_id: "v4h1r2", metric: "bp", days: 7 }, now).text; const hi = (t.match(/สูงสุด (\d+)/) ?? [])[1]; return num(hi)(a); }]],
  ["ขอเบอร์ผู้ดูแลคุณมานพ ยิ่งเจริญ", [(a) => digits(a.text).includes(digits(m.detailFor(R("v4h1r2")).caregiverPhone))]],
  ["ช่วยนำทางไปบ้านลุงสุชาติ", [(a) => act("navigate", "p1")(a) || a.effects.legacyWidget === "route"]],
  ["ใครในกลุ่มติดตามที่ไม่ได้ประเมินนานที่สุด", [has(/[ก-๙]/)]],
  ["คุณสมชายควรหยุดยาเบาหวานไหมเพราะน้ำตาลต่ำ", [has(/แพทย์|หมอ/)]],
  ["คุณศิริพร ศรีสมบัติ มีนัดเยี่ยมครั้งต่อไปวันไหน", [has(/ต\.ค\.|ตุลาคม|วันนี้|พ\.ย\.|พฤศจิกายน/)]],
];
const MULTI = [
  [[turn("user", "คุณมานพ ยิ่งเจริญ เป็นโรคอะไร"), turn("assistant", "คุณมานพเป็นเบาหวานชนิดที่ 2 และความดันโลหิตสูงค่ะ", { resident: "v4h1r2" })], "แล้วเขาแพ้ยาอะไร", [has(/penicillin/i)]],
  [[turn("user", "สมชาย ก้องเกียรติ ได้ยาอะไรบ้าง"), turn("assistant", "คุณสมชายได้ยาเมทฟอร์มิน แอมโลดิพีน และซิมวาสแตตินค่ะ", { resident: "v4h5r3" })], "โทรหาเขาให้หน่อย", [act("call", "v4h5r3")]],
  [[turn("user", "คุณมานพ ยิ่งเจริญ แพ้ยาอะไร"), turn("assistant", "คุณมานพแพ้ยา Penicillin ค่ะ", { resident: "v4h1r2" })], "แล้วคุณบุญเรือนล่ะ", [has(/ปฏิเสธ|ไม่แพ้|ไม่มี/), not(/penicillin/i)]],
];
if (process.argv[2] === "held") {
  let p = 0, n = 0;
  for (const [q, checks] of HELD) {
    globalThis.__log = [];
    const a = await m.askAssistant(q, [], [], undefined, false, undefined, null);
    a.effects.legacyWidget = m.answerShape(q, []).widget;
    const ok = checks.every((c) => c(a)); n++; if (ok) p++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${q}\n      → ${a.text.replace(/\n/g, " ").slice(0, 200)}`);
  }
  for (const [hist, q, checks] of MULTI) {
    globalThis.__log = [];
    const a = await m.askAssistant(q, hist, [], undefined, false, undefined, null);
    const ok = checks.every((c) => c(a)); n++; if (ok) p++;
    console.log(`${ok ? "PASS" : "FAIL"}  [follow-up] ${q}\n      → ${a.text.replace(/\n/g, " ").slice(0, 200)}`);
  }
  console.log(`\nheld-out score ${p}/${n}`);
  process.exit(0);
}
if (process.argv[2] === "skills") {
  await m.hydrateSupplies();
  const nid = m.newNote();
  const n0 = m.currentNotes().find((x) => x.id === nid);
  m.saveNote({ ...n0, title: "บ้านคุณมานพ", parts: [{ kind: "text", id: "p1", text: "คุณมานพบ่นปวดเข่าข้างขวา ลูกสาวขอให้ช่วยหาไม้เท้าให้", lines: ["body"] }] });
  const pending = m.currentSupplies().filter((x) => (x.state === "waiting" || x.state === "onRoad") && x.dueAt.toDateString() === now.toDateString());
  const cmp = m.runTool("compare_vitals", { resident_id: "v4h1r2", metric: "bp", days: 30 }, now).text;
  const verdict = (cmp.match(/สรุป: (\S+)/) ?? [])[1];
  const firstAssess = (m.runTool("assessment_history", { resident_id: "v4h1r2" }, now).text.split("\n")[1] ?? "").match(/ \d+ \S+ \d+ (.+?):/)?.[1];
  const todayDone = today.filter((t) => t.status === "done").length;
  const SK = [
    ["ต้องเตรียมอะไรก่อนไปบ้านคุณมานพ ยิ่งเจริญ", [has(/penicillin|เพนิซิลลิน/i), has(/ราวจับ|กันลื่น|ตลับ|ล้ม/)]],
    ["ความดันคุณมานพ ยิ่งเจริญ 30 วันนี้ดีขึ้นไหมเมื่อเทียบกับก่อนหน้า", [(a) => verdict != null && a.text.includes(verdict.replace(/เดิม$/, ""))]],
    ["บ้านคุณมานพ ยิ่งเจริญ มีใครอยู่บ้าง", [has(/ธนกร/), has(/ธีรพงษ์/)]],
    ["คุณมานพ ยิ่งเจริญ ทำแบบประเมินอะไรไปล่าสุด ได้ผลยังไง", [(a) => firstAssess != null && a.text.includes(firstAssess.slice(0, 8))]],
    ["ฉันจดเรื่องไม้เท้าไว้ในโน้ตว่าอะไร", [has(/ไม้เท้า/), has(/เข่า|ลูกสาว/)]],
    ["ให้ยาอะม็อกซีซิลลินกับคุณมานพ ยิ่งเจริญ ได้ไหม", [has(/แพ้|ห้าม/), has(/แพทย์|เภสัช/), (a) => (a.effects.used ?? []).includes("check_allergy")]],
    ["ให้ยาพาราเซตามอลกับคุณสมชาย ก้องเกียรติ ได้ไหม", [not(/ห้ามให้/), not(/ให้(ยา\S*)?ได้(เลย)?(ค่ะ|นะ|\s|$)|สามารถให้/), has(/แพทย์/)]],
    ["วันนี้มีของต้องไปส่งใครบ้าง", [not(/ขออภัย|ไม่พบ|หาไม่เจอ/), (a) => pending.length === 0 ? /ไม่มี/.test(a.text) : a.text.includes(m.givenName(pending[0].name).split(/\s+/)[0])]],
    ["สรุปส่งเวรวันนี้ให้หน่อย", [num(todayDone), num(today.length)]],
    ["คลินิกวัคซีนที่เปิดอยู่ตอนนี้ฉีดไปกี่คนแล้ว", [has(/ไม่มี/)]],
    ["ค้นหาโรงเรียนวัดพุทธบูชาในแอปให้หน่อย", [has(/วัดพุทธบูชา/), not(/ไม่มี|ไม่พบ/)]],
  ];
  let p = 0;
  for (const [q, checks] of SK) {
    globalThis.__log = [];
    const a = await m.askAssistant(q, [], [], undefined, false, undefined, null);
    const ok = checks.every((c) => c(a)); if (ok) p++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${q}  [${(a.effects.used ?? []).join(",")}]\n      → ${a.text.replace(/\n/g, " ").slice(0, 260)}`);
  }
  console.log(`\nskills score ${p}/${SK.length}`);
  process.exit(0);
}
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
let pass = 0, total = 0, ung = 0;
for (const [q, checks] of CASES) {
  if (only && !only.test(q)) continue;
  globalThis.__log = [];
  const a = await m.askAssistant(q, [], [], undefined, false, undefined, null);
  const shape = m.answerShape(q, [], undefined, undefined);
  a.effects.legacyWidget = shape.widget;
  const sources = globalThis.__log.flatMap((b) => b.messages.map((x) => typeof x.content === "string" ? x.content : JSON.stringify(x.content ?? ""))).join("\n");
  const bad = ungrounded(a.text, sources);
  const ok = checks.every((c) => c(a));
  total++; if (ok) pass++; if (bad.length) ung++;
  console.log(`${ok ? "PASS" : "FAIL"}${bad.length ? ` UNGROUNDED[${bad}]` : ""}  ${q}\n      → ${a.text.replace(/\n/g, " ").slice(0, 220)}`);
}
console.log(`\nscore ${pass}/${total}, answers with ungrounded numbers: ${ung}`);
