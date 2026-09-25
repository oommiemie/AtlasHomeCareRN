/**
 * The notebook's own arithmetic, checked without a keyboard.
 *
 * Everything the editor does to a page goes through these: a keystroke
 * moves the emphasis, a size is set on one line of several, a mark is put
 * on the front of a line, a model's reply comes back as lines. Each of
 * them is a place where a carer's own words could be lost, which is the
 * one thing this feature must never do.
 */
import {
  BOX_OFF,
  BOX_ON,
  BULLET,
  diffOf,
  fitLines,
  fromText,
  lineAt,
  segmentsOf,
  shiftSpans,
  spanCovers,
  toggleSpan,
  type LineKind,
  type Span,
} from "../src/models/notesText";

let bad = 0;
const ok = (what: string, pass: boolean, saw?: unknown) => {
  if (!pass) bad++;
  console.log(`  ${pass ? "✓" : "✗"} ${what}${pass || saw === undefined ? "" : ` — saw ${JSON.stringify(saw)}`}`);
};

console.log("การขยับช่วงเน้นข้อความเมื่อพิมพ์");
{
  const spans: Span[] = [{ from: 4, to: 9, kind: "mark" }];
  // typing before it
  let d = diffOf("หนึ่ง สองสาม", "ก หนึ่ง สองสาม");
  let out = shiftSpans(spans, d.start, d.removed, d.inserted);
  ok("พิมพ์ข้างหน้า → ช่วงเลื่อนตาม", out[0].from === 6 && out[0].to === 11, out);

  // typing inside it extends it
  d = diffOf("0123456789", "0123XX456789");
  out = shiftSpans(spans, d.start, d.removed, d.inserted);
  ok("พิมพ์แทรกกลางช่วง → ช่วงขยาย", out[0].from === 4 && out[0].to === 11, out);

  // typing at its far edge does not
  d = diffOf("0123456789", "012345678Z9");
  out = shiftSpans([{ from: 0, to: 4, kind: "bold" }], d.start, d.removed, d.inserted);
  ok("พิมพ์นอกช่วง → ช่วงไม่ขยาย", out[0].to === 4, out);

  // deleting the whole span drops it
  d = diffOf("0123456789", "0123");
  out = shiftSpans([{ from: 5, to: 8, kind: "mark" }], d.start, d.removed, d.inserted);
  ok("ลบข้อความที่ถูกเน้นทิ้ง → ช่วงหายไป", out.length === 0, out);
}

console.log("\nการเปิด/ปิดการเน้นข้อความ");
{
  let spans = toggleSpan([], 2, 6, "mark");
  ok("เปิดครั้งแรก", spanCovers(spans, 2, 6, "mark"));
  spans = toggleSpan(spans, 2, 6, "mark");
  ok("กดซ้ำ → ปิด", !spanCovers(spans, 2, 6, "mark") && spans.length === 0, spans);
  spans = toggleSpan(toggleSpan([], 0, 4, "bold"), 2, 8, "bold");
  ok("ช่วงซ้อนกันรวมเป็นช่วงเดียว", spans.length === 1 && spans[0].from === 0 && spans[0].to === 8, spans);
  spans = toggleSpan(toggleSpan([], 0, 9, "mark"), 3, 6, "mark");
  ok("ปิดตรงกลาง → แตกเป็นสองช่วง", spans.length === 2, spans);
}

console.log("\nขนาดบรรทัดตามจำนวนบรรทัดที่เปลี่ยน");
{
  const was: LineKind[] = ["title", "text", "text"];
  ok("จำนวนเท่าเดิม → คงเดิม", JSON.stringify(fitLines(was, "a\nb\nc", "a\nbb\nc")) === JSON.stringify(was));
  const more = fitLines(was, "a\nb\nc", "a\nb\nb2\nc");
  ok("เพิ่มบรรทัด → ขนาดยังครบทุกบรรทัด", more.length === 4 && more[0] === "title", more);
  const less = fitLines(was, "a\nb\nc", "a\nc");
  ok("ลบบรรทัด → เหลือเท่าจำนวนจริง", less.length === 2 && less[0] === "title", less);
}

console.log("\nการหาบรรทัดจากตำแหน่งเคอร์เซอร์");
{
  const text = "หนึ่ง\nสอง\nสาม";
  const first = lineAt(text, 0);
  const second = lineAt(text, 7);
  ok("ต้นข้อความ = บรรทัดแรก", first.index === 0 && first.from === 0);
  ok("กลางบรรทัดสอง = บรรทัดสอง", second.index === 1, second);
  ok("ตัดบรรทัดได้ตรง", text.slice(second.from, second.to) === "สอง", text.slice(second.from, second.to));
}

console.log("\nข้อความจากผู้ช่วย กลับมาเป็นหน้า");
{
  const p = fromText("# หัวเรื่อง\n- ข้อหนึ่ง\n[x] ทำแล้ว\n[ ] ยังไม่ทำ\nเนื้อความ");
  const lines = p.kind === "text" ? p.text.split("\n") : [];
  ok("หัวข้อถูกถอดเครื่องหมายออก", lines[0] === "หัวเรื่อง", lines[0]);
  ok("ขีดกลายเป็นบุลเล็ต", lines[1] === `${BULLET}ข้อหนึ่ง`, lines[1]);
  ok("[x] กลายเป็นกล่องติ๊กแล้ว", lines[2] === `${BOX_ON}ทำแล้ว`, lines[2]);
  ok("[ ] กลายเป็นกล่องว่าง", lines[3] === `${BOX_OFF}ยังไม่ทำ`, lines[3]);
  ok("ขนาดบรรทัดครบทุกบรรทัด", p.kind === "text" && p.lines.length === lines.length);
  ok("บรรทัดแรกเป็นหัวเรื่อง", p.kind === "text" && p.lines[0] === "title", p.kind === "text" ? p.lines[0] : null);
}

console.log("\nการตัดข้อความเป็นท่อนเพื่อวาด");
{
  const runs = segmentsOf(
    "หนึ่งสอง",
    [{ from: 0, to: 5, kind: "bold" }],
    ["heading"],
  );
  ok("แบ่งตามการเน้น", runs.length === 2 && runs[0].bold && !runs[1].bold, runs.map((r) => r.text));
  ok("ทุกท่อนได้ขนาดของบรรทัด", runs.every((r) => r.size === "heading"));
  const joined = runs.map((r) => r.text).join("");
  ok("ต่อกลับได้ข้อความเดิมเป๊ะ", joined === "หนึ่งสอง", joined);

  const two = segmentsOf("ab\ncd", [], ["title", "text"]);
  ok("บรรทัดต่างขนาดแยกท่อน", two.some((r) => r.size === "title") && two.some((r) => r.size === "text"));
  ok("ต่อกลับได้ข้อความเดิมแม้ข้ามบรรทัด", two.map((r) => r.text).join("") === "ab\ncd");
}

console.log(
  bad === 0
    ? "\nสมุดจดคืนข้อความเดิมได้ทุกเส้นทาง: พิมพ์ เน้น เปลี่ยนขนาด และรับคำตอบจากผู้ช่วย"
    : `\nล้มเหลว ${bad} ข้อ`,
);
if (bad > 0) process.exitCode = 1;
