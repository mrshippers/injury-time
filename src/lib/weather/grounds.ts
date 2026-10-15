/**
 * Where each club plays, from scripts/grounds/grounds.json (a source per row, null where nobody could
 * confirm the ground). Matched by the same key as the crests, so "Staines & Lammas (Middlesex)" finds
 * "Staines and Lammas". A club with no confirmed ground gets no forecast, never a guessed town.
 */
import grounds from "../../../scripts/grounds/grounds.json";
import { crestKey } from "@/lib/crests";
import type { Fixture } from "@/lib/types";

import { fetchKickoffWeather, weatherLine } from "./forecast";

export type Ground = { ground: string; town: string; lat: number; lon: number; source: string };

const BY_KEY = new Map<string, Ground>(
  Object.entries(grounds as Record<string, unknown>)
    .filter((e): e is [string, Ground] => typeof e[1] === "object" && e[1] !== null && typeof (e[1] as Ground).lat === "number")
    .map(([name, g]) => [crestKey(name), g]),
);

export function groundFor(team: string | null | undefined): Ground | null {
  return team ? (BY_KEY.get(crestKey(team)) ?? null) : null;
}

/** Home is our ground, away is theirs. */
export function matchGround(clubName: string, fixture: Pick<Fixture, "venue" | "opponent">): Ground | null {
  return groundFor(fixture.venue === "H" ? clubName : fixture.opponent);
}

/** The kick-off forecast for a match as one line and the ground it's for, or null (too far out, no ground, no forecast). */
export async function matchWeather(clubName: string, fixture: Pick<Fixture, "venue" | "opponent" | "match_date" | "kickoff">, today: string): Promise<{ line: string; ground: string } | null> {
  const g = matchGround(clubName, fixture);
  if (!g) return null;
  const w = await fetchKickoffWeather(g.lat, g.lon, fixture.match_date, fixture.kickoff, today);
  return w ? { line: weatherLine(w), ground: g.ground } : null;
}
