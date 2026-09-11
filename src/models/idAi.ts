import type { ScannedId } from "./idCard";
import { validCitizenId } from "./idCard";
import { askModel, jsonIn } from "./aiHost";

/**
 * Reading a card with the vision model on the hospital's own cluster.
 *
 * WHAT LEAVES THE DEVICE: the photograph of the card, in full, to the host in
 * `aiHost`. Nothing is stored by this app and nothing else is sent — and the
 * whole thing is a fallback path: on-device recognition runs regardless and
 * answers on its own if this is unreachable, refused, or slow.
 */

/** Long enough for a cold model, short enough not to hold up the form. */
const TIMEOUT_MS = 20_000;

/**
 * What the model is asked for.
 *
 * Named fields and an explicit empty string for what it cannot read, because
 * the alternative — letting it describe the card — produces prose that has to
 * be parsed all over again, and a model that is unsure will happily invent a
 * plausible ID number to fill a sentence.
 */
const PROMPT = [
  "อ่านบัตรประชาชนไทยในภาพ แล้วตอบเป็น JSON อย่างเดียว ห้ามมีคำอธิบายหรือ markdown",
  'รูปแบบ: {"idCard":"","title":"","name":"","birthDate":"","gender":"","religion":""}',
  "idCard = เลข 13 หลัก ไม่มีเว้นวรรคหรือขีด",
  "title = คำนำหน้า เช่น นาย นาง นางสาว เด็กชาย เด็กหญิง",
  "name = ชื่อและนามสกุลภาษาไทย ไม่รวมคำนำหน้า",
  "birthDate = วันเกิดรูปแบบ วว/ดด/ปปปป เป็น พ.ศ. (ถ้าบัตรพิมพ์เป็น ค.ศ. ให้บวก 543)",
  "gender = ชาย หรือ หญิง",
  "ช่องที่อ่านไม่ได้หรือไม่มีบนบัตร ให้เป็นสตริงว่าง ห้ามเดา",
].join(" ");

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * The card as the model read it, or an empty result.
 *
 * Never throws: this runs beside the on-device pass, and a network that is
 * down is not a reason for the scanner to fail — it is a reason to fall back
 * to what the phone could read by itself.
 */
export async function readIdWithAi(base64Jpeg: string): Promise<ScannedId> {
  const reply = await askModel(
    [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${base64Jpeg}` },
          },
        ],
      },
    ],
    { timeoutMs: TIMEOUT_MS, maxTokens: 400 },
  );
  if (reply == null) return {};

  const parsed = jsonIn(reply);
  if (parsed == null) return {};

  try {
    const found: ScannedId = {};
    // Checked, not trusted: a model asked for thirteen digits will produce
    // thirteen digits whether or not it could read them.
    const id = str(parsed.idCard).replace(/\D/g, "");
    if (validCitizenId(id)) found.idCard = id;

    const title = str(parsed.title);
    if (title.length > 0) found.title = title;

    const name = str(parsed.name);
    if (name.length > 0) found.name = name;

    const born = str(parsed.birthDate);
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(born)) found.birthDate = born;

    const gender = str(parsed.gender);
    if (gender === "ชาย" || gender === "หญิง") found.gender = gender;

    const religion = str(parsed.religion);
    if (religion.length > 0) found.religion = religion;

    return found;
  } catch {
    // A field the model shaped differently than asked is not a reason to lose
    // the ones it got right; the caller merges what came back.
    return {};
  }
}
