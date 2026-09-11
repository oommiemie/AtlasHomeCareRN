import type { Place } from "./place";

/**
 * Every Thai sub-district, with its district, province and postcode.
 *
 * Bundled rather than looked up. Apple's geocoder answers a postcode with a
 * coordinate and no names at all, so "10140" could only ever jump the map
 * somewhere — there was nothing to put in a list of choices. Four of Bangkok's
 * sub-districts share 10140, and choosing between them is the whole point.
 *
 * Source: thailand-geography-data/thailand-geography-json (MIT). 7,436 rows,
 * with the province and district names interned — they repeat across rows and
 * storing them once takes the file from about half a megabyte to 320KB.
 */
type Bundle = {
  provinces: string[];
  districts: string[];
  /** [sub-district, district index, province index, postcode]. */
  rows: [string, number, number, number][];
};

/** One row, resolved. */
export type ThaiAddress = {
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
};

let bundle: Bundle | null = null;

/**
 * Loaded on the first search, not on import.
 *
 * 320KB of JSON is a few tens of milliseconds to parse, and nothing outside
 * the address sheet ever needs it — paying for it at launch would be paying
 * for it on every launch that never opens the sheet.
 */
function load(): Bundle {
  if (bundle == null) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    bundle = require("./data/thaiAddress.json") as Bundle;
  }
  return bundle;
}

const resolve = (b: Bundle, i: number): ThaiAddress => {
  const [sub, d, p, code] = b.rows[i];
  return {
    subdistrict: sub,
    district: b.districts[d],
    province: b.provinces[p],
    postalCode: String(code),
  };
};

/** How many hits are worth drawing. Past this the list is not being read. */
const LIMIT = 60;

/**
 * Addresses matching anything the carer might type: a postcode, a province,
 * a district, a sub-district.
 *
 * Ranked by where the match landed — a postcode that starts with the query
 * first, then a name that starts with it, then a name that merely contains
 * it. Somebody typing "บางมด" wants บางมด before ห้วยบางมด.
 */
export function searchAddress(query: string): { hits: ThaiAddress[]; total: number } {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return { hits: [], total: 0 };

  const b = load();
  const scored: { i: number; rank: number }[] = [];

  for (let i = 0; i < b.rows.length; i += 1) {
    const [sub, d, p, code] = b.rows[i];
    const postcode = String(code);
    const district = b.districts[d];
    const province = b.provinces[p];

    let rank = -1;
    if (postcode.startsWith(q)) rank = 0;
    else if (sub.startsWith(q)) rank = 1;
    else if (district.startsWith(q) || province.startsWith(q)) rank = 2;
    else if (sub.includes(q)) rank = 3;
    else if (district.includes(q) || province.includes(q)) rank = 4;

    if (rank >= 0) scored.push({ i, rank });
  }

  scored.sort((a, c) => a.rank - c.rank || a.i - c.i);
  return {
    hits: scored.slice(0, LIMIT).map((s) => resolve(b, s.i)),
    total: scored.length,
  };
}

/** The address as a `Place`, which is what the rest of the app passes about. */
export const placeOfAddress = (a: ThaiAddress): Place => ({
  subdistrict: a.subdistrict,
  district: a.district,
  province: a.province,
  postalCode: a.postalCode,
});

/**
 * What to hand a geocoder to find this address on the map.
 *
 * Written the way a Thai address is, with the prefixes — "แขวง" and "เขต" in
 * Bangkok, "ตำบล" and "อำเภอ" everywhere else. Without them the geocoder
 * takes a bare sub-district name as a road or a landmark.
 */
export function geocodeQuery(a: ThaiAddress): string {
  const bangkok = a.province === "กรุงเทพมหานคร";
  return [
    `${bangkok ? "แขวง" : "ตำบล"}${a.subdistrict}`,
    `${bangkok ? "เขต" : "อำเภอ"}${a.district}`,
    a.province,
    a.postalCode,
    "ประเทศไทย",
  ].join(" ");
}
