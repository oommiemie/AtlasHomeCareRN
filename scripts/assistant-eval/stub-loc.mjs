export function getLocales(){ const c = process.env.LANG_CODE || "th"; return [{ languageCode: c, languageTag: c === "th" ? "th-TH" : "en-US" }]; }
export function getCalendars(){ return [{}]; }
