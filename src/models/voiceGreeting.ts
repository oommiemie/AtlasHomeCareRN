import { currentSession, givenNameOf } from "./session";
import { givenName, isDone, todayTasks } from "./task";
import { isEn } from "../i18n";

/**
 * What the assistant says first when voice mode opens.
 *
 * A carer who turns the voice on is about to talk to it, and a silent bar
 * leaves them to find the first words. So it speaks first, the way a person
 * picking up would: a hello for the time of day, the one thing about the
 * day that is worth saying — what is left, and what is next — and a
 * question that hands the turn back.
 *
 * Written here rather than asked of the model: it has to be ready the
 * moment the bar opens, and every fact in it is already on the phone.
 */
export function voiceGreeting(now: Date = new Date()): string {
  if (isEn) return englishGreeting(now);
  const name = givenNameOf(currentSession().displayName);
  const you = name != null && name !== "" ? ` คุณ${name}` : "";
  const h = now.getHours();
  const hello =
    h < 11
      ? `สวัสดีตอนเช้าค่ะ${you}`
      : h < 16
        ? `สวัสดีตอนบ่ายค่ะ${you}`
        : `สวัสดีตอนเย็นค่ะ${you}`;

  const left = todayTasks()
    .filter((t) => !isDone(t))
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const nextUp = left.find((t) => t.dueAt.getTime() >= now.getTime()) ?? left[0];

  const day =
    left.length === 0
      ? "วันนี้เยี่ยมบ้านครบทุกรายแล้วนะคะ"
      : nextUp != null
        ? `วันนี้ยังเหลือเยี่ยมบ้านอีก ${left.length} ราย รายถัดไปคือคุณ${givenName(nextUp.name)} ตอน ${spokenTime(nextUp.dueAt)} ค่ะ`
        : `วันนี้ยังเหลือเยี่ยมบ้านอีก ${left.length} รายค่ะ`;

  return `${hello} ${day} มีอะไรให้ช่วยไหมคะ`;
}

/**
 * A time the way it is said aloud — "สิบโมงครึ่ง", "บ่ายสองโมง" — not the
 * way it is written: a voice reading "10:30 น." says the colon.
 */
function spokenTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const hour =
    h === 12
      ? "เที่ยง"
      : h === 13
        ? "บ่ายโมง"
        : h > 13 && h < 16
          ? `บ่าย ${h - 12} โมง`
          : h >= 16 && h < 19
            ? `${h - 12} โมงเย็น`
            : h >= 19
              ? `${h - 18} ทุ่ม`
              : `${h} โมง`;
  const min = m === 0 ? "" : m === 30 ? "ครึ่ง" : ` ${m} นาที`;
  return `${hour}${min}`;
}

/**
 * The same greeting in English. The carer's name and the patient's are
 * kept as they are written — Thai names — without the Thai honorific.
 */
function englishGreeting(now: Date): string {
  const name = givenNameOf(currentSession().displayName);
  const you = name != null && name !== "" ? `, ${name}` : "";
  const h = now.getHours();
  const hello =
    h < 12
      ? `Good morning${you}.`
      : h < 17
        ? `Good afternoon${you}.`
        : `Good evening${you}.`;

  const left = todayTasks()
    .filter((t) => !isDone(t))
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const nextUp = left.find((t) => t.dueAt.getTime() >= now.getTime()) ?? left[0];
  const visits = `${left.length} home visit${left.length === 1 ? "" : "s"}`;

  const day =
    left.length === 0
      ? "All of today's home visits are done."
      : nextUp != null
        ? `You have ${visits} left today. Next is ${givenName(nextUp.name)} at ${spokenTimeEn(nextUp.dueAt)}.`
        : `You have ${visits} left today.`;

  return `${hello} ${day} How can I help?`;
}

/** "10:30 AM", "2 PM" — the way an English voice reads a time well. */
function spokenTimeEn(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = m === 0 ? "" : `:${String(m).padStart(2, "0")}`;
  return `${h12}${mm} ${h < 12 ? "AM" : "PM"}`;
}
