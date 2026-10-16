import { describe, expect, it } from "vitest";

import { kickoffWeather, skyWord, weatherLine, type Hourly } from "@/lib/weather/forecast";

const hours = Array.from({ length: 24 }, (_, i) => `2026-10-17T${String(i).padStart(2, "0")}:00`);
const h: Hourly = {
  time: hours,
  temperature_2m: hours.map((_, i) => 8 + i * 0.4),
  precipitation_probability: hours.map((_, i) => (i === 16 ? 70 : 20)),
  wind_speed_10m: hours.map((_, i) => (i === 15 ? 18.4 : 9)),
  weather_code: hours.map((_, i) => (i === 16 ? 80 : 3)),
};

describe("kick-off weather", () => {
  it("reads kick-off to the final whistle: worst sky, highest rain chance, strongest wind, kick-off temperature", () => {
    expect(kickoffWeather(h, "2026-10-17", "15:00")).toEqual({ tempC: 14, rainChance: 70, windMph: 18, sky: "showers", windFromDeg: null });
    expect(kickoffWeather({ ...h, wind_direction_10m: hours.map(() => 225) }, "2026-10-17", "15:00")?.windFromDeg).toBe(225);
  });
  it("assumes a 3pm kick-off when the diary has none", () => expect(kickoffWeather(h, "2026-10-17", null)?.tempC).toBe(14));
  it("an evening kick-off reads the evening", () => expect(kickoffWeather(h, "2026-10-17", "19:45")?.tempC).toBe(16));
  it("a date the forecast does not cover is nothing, not a guess", () => expect(kickoffWeather(h, "2026-10-18", "15:00")).toBeNull());
  it("words the WMO codes", () => {
    expect([0, 2, 45, 53, 63, 75, 81, 95].map(skyWord)).toEqual(["clear", "cloudy", "foggy", "drizzle", "rain", "snow", "showers", "thunderstorms"]);
  });
  it("one line", () => expect(weatherLine({ tempC: 14, rainChance: 70, windMph: 18, sky: "showers" })).toBe("14°, showers, 70% chance of rain, wind 18 mph"));
});
