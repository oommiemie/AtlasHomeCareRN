import { askModel } from "./aiHost";

/**
 * The help a notebook page can ask for.
 *
 * Three jobs, not a chat. A carer with a page of half-sentences typed at a
 * school gate wants one of three things done to it — say it properly, say
 * it shorter, or turn it into something to work through — and each of
 * those is a button rather than a conversation to be steered.
 *
 * What goes on the wire is the page and nothing else: no patient record,
 * no roster, no name the app holds about anybody. A notebook page is
 * whatever the carer typed, and they can see all of it before they press.
 */
export type Tidy = "rewrite" | "shorten" | "fix" | "outline";

export const TIDY_LABEL: Record<Tidy, string> = {
  rewrite: "เรียบเรียงใหม่",
  shorten: "สรุปให้สั้น",
  fix: "แก้คำผิดและวรรคตอน",
  outline: "จัดเป็นหัวข้อ",
};

/**
 * Which jobs make sense on a stretch of a line rather than on a page.
 *
 * Turning four words into headings and a checklist is not a thing that can
 * be done to four words — the job needs a page to find a shape in. Offered
 * anyway it would return something, and what it returned would be invented.
 */
export const TIDY_ON_SELECTION: Tidy[] = ["fix", "rewrite", "shorten"];

/**
 * The same jobs in two words, for the bar that sits under a selection.
 *
 * It stands beside the words it acts on and has a line's width to do it
 * in, so the label has to be the verb and nothing else — the explanation
 * belongs in the menu, where there is room for it.
 */
export const TIDY_SHORT: Record<Tidy, string> = {
  rewrite: "เรียบเรียง",
  shorten: "ย่อ",
  fix: "แก้คำผิด",
  outline: "จัดหัวข้อ",
};

const JOB: Record<Tidy, string> = {
  fix: "แก้คำผิด การเว้นวรรค และเครื่องหมายวรรคตอนในข้อความนี้ ห้ามเปลี่ยนสำนวนหรือเรียบเรียงใหม่ และห้ามเพิ่มข้อมูล",
  rewrite:
    "เรียบเรียงบันทึกนี้ใหม่ให้เป็นประโยคที่อ่านรู้เรื่อง โดยเก็บใจความเดิมไว้ครบทุกข้อ ห้ามเพิ่มข้อมูลที่ไม่ได้เขียนไว้",
  shorten:
    "สรุปบันทึกนี้ให้เหลือเฉพาะใจความสำคัญ ความยาวไม่เกิน 5 บรรทัด ห้ามเพิ่มข้อมูลที่ไม่ได้เขียนไว้",
  outline:
    "จัดบันทึกนี้เป็นหัวข้อ โดยขึ้นต้นบรรทัดหัวข้อด้วย # และสิ่งที่ต้องไปทำต่อให้เขียนเป็นเช็คลิสต์ โดยขึ้นต้นบรรทัดด้วย [ ] ห้ามเพิ่มข้อมูลที่ไม่ได้เขียนไว้",
};

/**
 * The page, tidied — or null, which the caller shows as "ลองใหม่อีกครั้ง".
 *
 * The marks it is asked for are the ones the notebook already writes: a
 * hash for a heading, a dash for a bullet, a box for a checklist line. So
 * whatever comes back reads straight into blocks, and a reply that ignores
 * the instruction still lands as plain lines rather than as one paragraph
 * with hashes in it.
 */
export async function tidy(
  kind: Tidy,
  text: string,
  /** True where the job is on a stretch of one line, which must stay one line. */
  inline = false,
): Promise<string | null> {
  const body = text.trim();
  if (body === "") return null;
  const reply = await askModel(
    [
      {
        role: "system",
        content:
          "คุณช่วยเรียบเรียงบันทึกงานของเจ้าหน้าที่สาธารณสุขไทย ตอบเป็นภาษาไทยและตอบเฉพาะเนื้อบันทึกที่จัดแล้วเท่านั้น ห้ามมีคำอธิบายหรือคำนำ " +
          "รูปแบบบรรทัด: หัวข้อขึ้นต้นด้วย '# ' รายการขึ้นต้นด้วย '- ' เช็คลิสต์ขึ้นต้นด้วย '[ ] '",
      },
      {
        role: "user",
        content:
          `${JOB[kind]}${inline ? " ตอบกลับเป็นข้อความบรรทัดเดียว ห้ามขึ้นบรรทัดใหม่ ห้ามใส่หัวข้อหรือรายการ" : ""}` +
          `\n\n${inline ? "ข้อความ" : "บันทึก"}:\n${body}`,
      },
    ],
    { maxTokens: 700 },
  );
  const out = reply?.trim();
  if (out == null || out === "") return null;
  // A stretch of a line goes back as a stretch of a line, whatever the
  // model decided to do with its newlines.
  return inline ? out.replace(/\s*\n+\s*/g, " ") : out;
}

/**
 * A photograph of something written down, turned back into text.
 *
 * The model behind the app is `gemma-4-31B-it`, which reads pictures as
 * well as words — so a form handed over at a school gate, a note on a
 * whiteboard or a page of somebody else's handwriting can go into the
 * notebook as text rather than as a picture of text, and be searched,
 * corrected and carried on from.
 *
 * Asked to transcribe rather than to describe. A model told to say what is
 * in a picture will summarise it, and a summary of a consent form is not a
 * consent form — what is wanted is the words that are there, in the order
 * they are in, and nothing that is not.
 *
 * The picture goes on the wire and nothing else. It is worth saying out
 * loud on a health worker's phone: this should be pointed at paperwork and
 * whiteboards, and the page it lands on is as private as the rest of the
 * notebook, which is to say it stays on the phone.
 */
export async function readImage(
  base64: string,
  mime = "image/jpeg",
): Promise<string | null> {
  const reply = await askModel(
    [
      {
        role: "system",
        content:
          "คุณถอดข้อความจากภาพให้เจ้าหน้าที่สาธารณสุขไทย ตอบเฉพาะข้อความที่อ่านได้ในภาพเท่านั้น " +
          "รักษาลำดับบรรทัดตามต้นฉบับ ห้ามสรุป ห้ามอธิบายภาพ ห้ามเติมข้อความที่ไม่มีในภาพ " +
          "ถ้าเป็นรายการให้ขึ้นต้นบรรทัดด้วย '- ' ถ้าเป็นหัวข้อให้ขึ้นต้นด้วย '# ' " +
          "ถ้าอ่านไม่ออกเลยให้ตอบว่า (อ่านไม่ออก)",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "ถอดข้อความทั้งหมดในภาพนี้" },
          {
            type: "image_url",
            image_url: { url: `data:${mime};base64,${base64}` },
          },
        ],
      },
    ],
    // A page of a form is a lot of lines, and a transcription that stops
    // halfway is worse than none: the carer cannot tell which half is
    // missing without the paper in front of them.
    { maxTokens: 1400, timeoutMs: 60_000 },
  );
  const out = reply?.trim();
  return out == null || out === "" || out === "(อ่านไม่ออก)" ? null : out;
}
