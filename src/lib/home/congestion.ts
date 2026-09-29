/**
 * Fixture pile-up: two games inside three days is where a non-league squad of
 * part-timers breaks. Find the first such pair in the next three weeks and name
 * the available players whose load already says "ease off", so the manager
 * rotates one of them before picking both sides. Pure, so it is tested once.
 */
import type { ReadinessKey } from "@/lib/readiness";

export type CongestionFixture = { match_date: string; opponent: string; venue: "H" | "A" };
export type CongestionPlayer = { id: string; name: string; readiness: ReadinessKey; word: string; available: boolean };

export type Congestion = {
  first: CongestionFixture;
  second: CongestionFixture;
  /** days between kick-offs */
  gap: number;
  /** available players already pushing it or in the red zone */
  rotate: { id: string; name: string; word: string }[];
  /** false when too few players have a load reading to judge anyone */
  judged: boolean;
};

const DAY_MS = 86_400_000;
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);

export function findCongestion(
  fixtures: readonly CongestionFixture[],
  players: readonly CongestionPlayer[],
  asOf: string,
  opts: { maxGap?: number; horizon?: number } = {},
): Congestion | null {
  const maxGap = opts.maxGap ?? 3;
  const horizon = opts.horizon ?? 21;
  const ahead = fixtures
    .filter((f) => days(asOf, f.match_date) >= 0 && days(asOf, f.match_date) <= horizon)
    .sort((a, b) => a.match_date.localeCompare(b.match_date));
  for (let i = 0; i + 1 < ahead.length; i++) {
    const gap = days(ahead[i].match_date, ahead[i + 1].match_date);
    if (gap >= 1 && gap <= maxGap) {
      const read = players.filter((p) => p.available && p.readiness !== "unknown");
      const rotate = read
        .filter((p) => p.readiness === "red" || p.readiness === "pushing")
        .sort((a, b) => (a.readiness === "red" ? 0 : 1) - (b.readiness === "red" ? 0 : 1) || a.name.localeCompare(b.name))
        .map(({ id, name, word }) => ({ id, name, word }));
      return { first: ahead[i], second: ahead[i + 1], gap, rotate, judged: read.length >= 5 };
    }
  }
  return null;
}
