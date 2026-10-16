/**
 * Kick-off weather from Open-Meteo (free, no key). Forecasts reach 16 days, so a fixture further out shows
 * nothing rather than a guess. The read covers kick-off to the final whistle: the worst sky, the highest
 * chance of rain, the strongest wind, the temperature at kick-off.
 */
export type Hourly = { time: string[]; temperature_2m: number[]; precipitation_probability: (number | null)[]; wind_speed_10m: number[]; weather_code: number[]; wind_direction_10m?: number[] };
/** windFromDeg: where the wind blows FROM at kick-off, degrees from north (null when the feed has none) */
export type KickoffWeather = { tempC: number; rainChance: number | null; windMph: number; sky: string; windFromDeg?: number | null };

/** WMO weather codes in a dressing room's words, worst last so "worst of the afternoon" is a max. */
const SKY: [number, string][] = [
  [0, "clear"],
  [3, "cloudy"],
  [48, "foggy"],
  [57, "drizzle"],
  [67, "rain"],
  [77, "snow"],
  [82, "showers"],
  [99, "thunderstorms"],
];
export function skyWord(code: number): string {
  return (SKY.find(([max]) => code <= max) ?? SKY[SKY.length - 1])[1];
}

/** The two hours from kick-off ("15:00"), read off Open-Meteo's hourly arrays for that date. */
export function kickoffWeather(h: Hourly, date: string, kickoff: string | null): KickoffWeather | null {
  const hour = Number((kickoff ?? "15:00").slice(0, 2));
  const idx = [0, 1].map((k) => h.time.indexOf(`${date}T${String(hour + k).padStart(2, "0")}:00`)).filter((i) => i >= 0);
  if (idx.length === 0) return null;
  const rain = idx.map((i) => h.precipitation_probability[i]).filter((v): v is number => v !== null);
  return {
    tempC: Math.round(h.temperature_2m[idx[0]]),
    rainChance: rain.length ? Math.max(...rain) : null,
    windMph: Math.round(Math.max(...idx.map((i) => h.wind_speed_10m[i]))),
    sky: skyWord(Math.max(...idx.map((i) => h.weather_code[i]))),
    windFromDeg: h.wind_direction_10m ? Math.round(h.wind_direction_10m[idx[0]]) : null,
  };
}

/** One line: "14°, showers, 70% chance of rain, wind 18 mph". */
export function weatherLine(w: KickoffWeather): string {
  return [`${w.tempC}°`, w.sky, w.rainChance !== null ? `${w.rainChance}% chance of rain` : null, `wind ${w.windMph} mph`].filter(Boolean).join(", ");
}

const DAY = 86_400_000;

export async function fetchKickoffWeather(lat: number, lon: number, date: string, kickoff: string | null, today: string): Promise<KickoffWeather | null> {
  const ahead = (Date.parse(date) - Date.parse(today)) / DAY;
  if (ahead < 0 || ahead > 15) return null;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,precipitation_probability,wind_speed_10m,wind_direction_10m,weather_code&wind_speed_unit=mph&timezone=Europe%2FLondon&start_date=${date}&end_date=${date}`;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const body = (await res.json()) as { hourly?: Hourly };
    return body.hourly ? kickoffWeather(body.hourly, date, kickoff) : null;
  } catch {
    // no forecast is a missing line on the page, never a broken page
    return null;
  }
}
