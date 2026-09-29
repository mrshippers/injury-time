/**
 * Minutes played from the touchline log: the XI start at 0, a sub swaps one
 * player off for one on at a minute, the whistle ends everyone's clock.
 * Pure, so the arithmetic is tested and the dugout screen only records taps.
 */
export type SubEvent = { minute: number; off: string; on: string };

export function minutesPlayed(xi: readonly string[], subs: readonly SubEvent[], fullTime: number): Record<string, number> {
  const onAt = new Map<string, number>();
  const played = new Map<string, number>();
  for (const id of xi) onAt.set(id, 0);
  const ordered = [...subs].sort((a, b) => a.minute - b.minute);
  for (const s of ordered) {
    const m = Math.max(0, Math.min(s.minute, fullTime));
    const start = onAt.get(s.off);
    if (start === undefined) continue; // subbing off someone not on the pitch: ignore the tap
    played.set(s.off, (played.get(s.off) ?? 0) + (m - start));
    onAt.delete(s.off);
    if (!onAt.has(s.on)) onAt.set(s.on, m);
  }
  for (const [id, start] of onAt) played.set(id, (played.get(id) ?? 0) + (fullTime - start));
  // anyone who got on the pitch counts at least one minute (the log's floor)
  const out: Record<string, number> = {};
  for (const [id, m] of played) out[id] = Math.max(1, Math.round(m));
  return out;
}

/** The handoff the logger reads once: kind match, minutes filled, RPE left to the players. */
export type MatchdayHandoff = {
  fixtureId: string;
  date: string;
  opponent: string;
  minutes: Record<string, number>;
};

export const MATCHDAY_HANDOFF_KEY = "injury-time.matchday-handoff";
