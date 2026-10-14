/**
 * Open the logger on the session that most likely needs logging: a match played in the last three
 * days that nobody has logged yet. Otherwise it is a training night. Pure; the page does the reads.
 */
export type Played = { match_date: string; opponent: string };
export type SessionSuggestion = { kind: "match"; date: string; opponent: string } | { kind: "training" };

const DAY = 86_400_000;

export function suggestSession(today: string, played: readonly Played[], loggedMatchDates: ReadonlySet<string>): SessionSuggestion {
  const t = Date.parse(today);
  const recent = [...played]
    .filter((p) => p.match_date <= today && t - Date.parse(p.match_date) <= 3 * DAY && !loggedMatchDates.has(p.match_date))
    .sort((a, b) => b.match_date.localeCompare(a.match_date));
  return recent[0] ? { kind: "match", date: recent[0].match_date, opponent: recent[0].opponent } : { kind: "training" };
}
