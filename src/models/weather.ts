import { useEffect, useState } from "react";

import { tr } from "../i18n";

/**
 * The weather where the carer is, now — for the line on the home page's
 * map card, which used to say "clear skies" whatever the sky was doing.
 *
 * From Open-Meteo: free, no key, and nothing about anybody sent to it but
 * a position — the carer's, rounded to two decimal places (about a
 * kilometre), which is all a forecast needs and less than a street. No
 * patient, visit or house goes with it.
 *
 * Asked at most every fifteen minutes, and the last answer kept for the
 * launch, so the home page coming back into view does not ask again. With
 * no network the card simply says nothing about the weather rather than
 * something untrue.
 */

export type Sky =
  "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "storm";

export type Weather = {
  /** Degrees Celsius, rounded. */
  temp: number;
  sky: Sky;
  /** Daylight at the carer's position — the clear sky is a sun or a moon. */
  day: boolean;
};

/** WMO weather codes, as Open-Meteo reports them, folded into the few skies drawn. */
function skyOf(code: number): Sky {
  if (code <= 1) return "clear";
  if (code === 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code >= 95) return "storm";
  // Rain, freezing rain, showers — and snow, which is rain here.
  return "rain";
}

const FRESH_MS = 15 * 60 * 1000;
let last: { at: number; key: string; weather: Weather } | null = null;

export async function fetchWeather(
  lat: number,
  lng: number,
): Promise<Weather | null> {
  const la = lat.toFixed(2);
  const lo = lng.toFixed(2);
  const key = `${la},${lo}`;
  if (last != null && last.key === key && Date.now() - last.at < FRESH_MS) {
    return last.weather;
  }
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}` +
        "&current=temperature_2m,weather_code,is_day&timezone=auto",
    );
    if (!res.ok) return last?.weather ?? null;
    const body = (await res.json()) as {
      current?: {
        temperature_2m?: number;
        weather_code?: number;
        is_day?: number;
      };
    };
    const c = body.current;
    if (c?.temperature_2m == null || c.weather_code == null) {
      return last?.weather ?? null;
    }
    const weather: Weather = {
      temp: Math.round(c.temperature_2m),
      sky: skyOf(c.weather_code),
      day: c.is_day !== 0,
    };
    last = { at: Date.now(), key, weather };
    return weather;
  } catch {
    return last?.weather ?? null;
  }
}

/** The weather at a position, or null until it is known (or if it cannot be). */
export function useWeather(here: {
  latitude: number;
  longitude: number;
}): Weather | null {
  const [w, setW] = useState<Weather | null>(last?.weather ?? null);
  const la = here.latitude.toFixed(2);
  const lo = here.longitude.toFixed(2);
  useEffect(() => {
    let live = true;
    const ask = () =>
      fetchWeather(Number(la), Number(lo)).then((r) => {
        if (live && r != null) setW(r);
      });
    void ask();
    // And again as it goes stale, for a home page left open all morning.
    const id = setInterval(() => void ask(), FRESH_MS);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [la, lo]);
  return w;
}

/** What the sky is called. */
export function skyLabel(sky: Sky, day: boolean): string {
  switch (sky) {
    case "clear":
      return day ? tr("แจ่มใส", "Clear") : tr("ฟ้าโปร่ง", "Clear night");
    case "partly":
      return tr("มีเมฆบางส่วน", "Partly cloudy");
    case "cloudy":
      return tr("เมฆมาก", "Cloudy");
    case "fog":
      return tr("มีหมอก", "Foggy");
    case "drizzle":
      return tr("ฝนปรอย", "Drizzle");
    case "rain":
      return tr("ฝนตก", "Rain");
    case "storm":
      return tr("พายุฝนฟ้าคะนอง", "Thunderstorm");
  }
}

/**
 * A line of advice for the round, from the sky and the heat — what a carer
 * about to drive between houses would want told.
 */
export function roundAdvice(w: Weather): string {
  if (w.sky === "storm") {
    return tr(
      "มีพายุฝนฟ้าคะนอง ระวังการเดินทางและเลี่ยงที่โล่ง",
      "Thunderstorms — take care on the road and avoid open ground",
    );
  }
  if (w.sky === "rain") {
    return tr(
      "ฝนตก พกร่มและเก็บเวชภัณฑ์ให้พ้นน้ำ",
      "Raining — take an umbrella and keep supplies dry",
    );
  }
  if (w.sky === "drizzle") {
    return tr(
      "ฝนปรอย ๆ พกร่มติดตัวไว้",
      "Light drizzle — keep an umbrella with you",
    );
  }
  if (w.sky === "fog") {
    return tr(
      "มีหมอก ขับรถช้า ๆ และเปิดไฟ",
      "Foggy — drive slowly with your lights on",
    );
  }
  if (w.temp >= 35) {
    return tr(
      "อากาศร้อนจัด ดื่มน้ำบ่อย ๆ และระวังผู้ป่วยขาดน้ำ",
      "Very hot — drink often and watch patients for dehydration",
    );
  }
  if (!w.day) {
    return tr(
      "ออกเยี่ยมช่วงค่ำ ระวังการเดินทาง",
      "Visiting after dark — take care on the road",
    );
  }
  return tr(
    "อากาศดี เหมาะสำหรับออกเยี่ยมบ้าน",
    "Good weather for your home visits",
  );
}
