/**
 * Keep the diary true. The feed is the truth about games still to play, but a
 * fixture row also carries things people did (calls, a saved side), so the feed
 * may move or drop a row and never bulldoze one that has people's work on it.
 *
 *   same date + opponent + competition   -> keep, refresh kickoff and venue
 *   same opponent + competition, new date -> a rescheduled game: move the row, calls follow it
 *   in the diary, gone from the feed      -> remove, unless a call or a side hangs off it
 *   in the feed, not in the diary         -> insert
 *
 * Games already played are history and are never touched. Pure: the caller does the I/O.
 */
export type DiaryRow = { id: string; match_date: string; opponent: string; competition: string; venue: "H" | "A"; kickoff: string | null };
export type FeedFixture = { match_date: string; opponent: string; competition: string; venue: "H" | "A"; kickoff: string | null };

export type Reconciled = {
  insert: FeedFixture[];
  move: { id: string; patch: Pick<FeedFixture, "match_date" | "kickoff" | "venue"> }[];
  /** ids to delete; every one has been checked against `hasWork` */
  remove: string[];
  /** a row the feed dropped that still has calls or a side on it: left alone, said out loud */
  keptWithWork: { id: string; match_date: string; opponent: string }[];
};

const key = (f: { opponent: string; competition: string }) => `${f.opponent}|${f.competition}`;

export function reconcileFixtures(diary: readonly DiaryRow[], feed: readonly FeedFixture[], today: string, hasWork: ReadonlySet<string> = new Set()): Reconciled {
  const out: Reconciled = { insert: [], move: [], remove: [], keptWithWork: [] };
  const future = diary.filter((d) => d.match_date >= today);
  const exact = new Set(future.map((d) => `${d.match_date}|${key(d)}`));
  const feedExact = new Set(feed.map((f) => `${f.match_date}|${key(f)}`));

  // refresh kickoff/venue where date, opponent and competition already agree
  for (const f of feed) {
    const row = future.find((d) => d.match_date === f.match_date && key(d) === key(f));
    if (row && (row.kickoff !== f.kickoff || row.venue !== f.venue) && f.kickoff !== null) out.move.push({ id: row.id, patch: { match_date: f.match_date, kickoff: f.kickoff, venue: f.venue } });
  }

  const orphans = future.filter((d) => !feedExact.has(`${d.match_date}|${key(d)}`));
  const unseen = feed.filter((f) => f.match_date >= today && !exact.has(`${f.match_date}|${key(f)}`));
  const claimed = new Set<FeedFixture>();

  for (const o of orphans) {
    const moved = unseen.find((f) => !claimed.has(f) && key(f) === key(o));
    if (moved) {
      claimed.add(moved);
      out.move.push({ id: o.id, patch: { match_date: moved.match_date, kickoff: moved.kickoff, venue: moved.venue } });
    } else if (hasWork.has(o.id)) {
      out.keptWithWork.push({ id: o.id, match_date: o.match_date, opponent: o.opponent });
    } else {
      out.remove.push(o.id);
    }
  }
  out.insert = unseen.filter((f) => !claimed.has(f));
  return out;
}
