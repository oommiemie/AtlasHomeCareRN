/**
 * What the assistant would be told, for the questions a carer actually asks.
 *
 * Prints the facts block rather than the answer: the model only writes, and
 * everything it can say has to be in here first. If a question comes back
 * with nothing to answer from, this is where it shows.
 *
 *     npx tsx scripts/probe-assistant.ts
 */
import { visitsFor, widgetFor } from "../src/models/assistant";

const ASKED = [
  "วันนี้มีงานอะไรบ้าง",
  "ใครอยู่ใกล้ฉันมากที่สุด",
  "เรียงตามระยะทางให้หน่อย",
  "วันนี้ใครมีค่าผิดปกติบ้าง",
  "ใครน่าห่วงที่สุด",
  "จันทร์เพ็ญแพ้ยาอะไร บ้านอยู่ไหน",
];

for (const q of ASKED) {
  const cards = visitsFor(q);
  console.log(`\n"${q}"`);
  console.log(`   cards: ${cards.length}   widget: ${widgetFor(q) ?? "none"}`);
  for (const t of cards.slice(0, 3)) {
    console.log(`     ${t.name} · ${t.address?.slice(0, 40) ?? "no address"}`);
  }
}
