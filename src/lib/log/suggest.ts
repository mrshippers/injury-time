/**
 * Open the logger on the session that most likely needs logging: a match played in the last three
 * days that nobody has logged yet. Otherwise it is a training night, and when the club's schedule has
 * a night waiting to be confirmed the logger opens on that date. Pure; the page does the reads.
 */
import type { TrainingNight } from "./training";

export type Played = { match_date: string; opponent: string };
export type SessionSuggestion = { kind: "match"; date: string; opponent: string } | { kind: "training"; night?: TrainingNight };

const DAY = 86_400_000;

/** `due` is newest first, as `dueNights` returns it. */
export function suggestSession(
  today: string,
  played: readonly Played[],
  loggedMatchDates: ReadonlySet<string>,
  due: readonly TrainingNight[] = [],
): SessionSuggestion {
  const t = Date.parse(today);
  const recent = [...played]
    .filter((p) => p.match_date <= today && t - Date.parse(p.match_date) <= 3 * DAY && !loggedMatchDates.has(p.match_date))
    .sort((a, b) => b.match_date.localeCompare(a.match_date));
  if (recent[0]) return { kind: "match", date: recent[0].match_date, opponent: recent[0].opponent };
  return due[0] ? { kind: "training", night: due[0] } : { kind: "training" };
}
