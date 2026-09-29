import { File, Paths } from "expo-file-system";
import { getLocales } from "expo-localization";
import { reloadAppAsync } from "expo";

/**
 * Which language the app speaks — Thai or English.
 *
 * Settled once, as this module is first loaded, and never changed while
 * the app runs. Strings are written where they are used, many of them in
 * lists built at import time (a form's options, a filter's labels), and a
 * language that could change under them would leave half the screen in
 * the old one. So choosing another language saves the choice and restarts
 * the app's JavaScript, and everything is built again in the new one.
 *
 * Read synchronously from the file the choice is saved in, before anything
 * that imports this module gets to run: an async read would come back
 * after those import-time lists were already built in the wrong language.
 */

export type Lang = "th" | "en";
/** What the carer picked: a language, or whatever the phone is set to. */
export type LangChoice = Lang | "system";

const store = () => new File(Paths.document, "language.json");

function savedChoice(): LangChoice {
  try {
    const f = store();
    if (!f.exists) return "system";
    const c = JSON.parse(f.textSync()) as { choice?: LangChoice };
    return c.choice === "th" || c.choice === "en" ? c.choice : "system";
  } catch {
    return "system";
  }
}

/** The phone's own language: Thai where it is Thai, English otherwise. */
function deviceLang(): Lang {
  try {
    return getLocales()[0]?.languageCode === "th" ? "th" : "en";
  } catch {
    return "th";
  }
}

const choice: LangChoice = savedChoice();

/** The language this launch speaks. */
export const lang: Lang = choice === "system" ? deviceLang() : choice;
export const isEn = lang === "en";

/** The carer's saved choice, for the settings page to tick. */
export const languageChoice = (): LangChoice => choice;

/** The phone's language, for the settings page to name beside "system". */
export const systemLang = (): Lang => deviceLang();

/** BCP-47 tag for speech, recognition and anything else that asks. */
export const locale = isEn ? "en-US" : "th-TH";

/**
 * The Thai and the English, side by side where the text is used: the
 * Thai stays readable in the code it was written in, and each file carries
 * its own translation rather than a key into a table somewhere else.
 *
 *   tr("บันทึก", "Save")
 *   tr(`งาน ${n} รายการ`, `${n} tasks`)
 *
 * Generic, so a list or an object can be given in both languages too.
 */
export function tr<T>(th: T, en: T): T {
  return isEn ? en : th;
}

/**
 * Saves the choice and starts the app again in it. Nothing on screen
 * survives: the new language is built from the first line up.
 */
export async function setLanguage(next: LangChoice): Promise<void> {
  try {
    store().write(JSON.stringify({ choice: next }));
  } catch {
    return;
  }
  const nextLang = next === "system" ? deviceLang() : next;
  if (nextLang !== lang || next !== choice) {
    await reloadAppAsync(`language: ${next}`);
  }
}
