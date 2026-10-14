/**
 * What moved overnight, said the way a gaffer would say it. The refresh report
 * is machine-shaped (row counts, name lists, ISO dates); the notice board is for
 * people, so the words are made here and nowhere else. Nothing here touches I/O.
 */
import type { DriftResult, RefreshReport } from "./index";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${DAY[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`;
}

/** "Sat 10 Oct, FA Vase 1: won 4-2 v Baldock Town" */
export function resultSentence(r: DriftResult): string {
  const verb = r.goals_for > r.goals_against ? "won" : r.goals_for === r.goals_against ? "drew" : "lost";
  return `${dayLabel(r.match_date)}, ${r.competition}: ${verb} ${r.goals_for}-${r.goals_against} ${r.venue === "A" ? "at" : "v"} ${r.opponent}`;
}

/** null when nothing a person would care about moved. Unmatched names, rewritten rows, a fresher table and app counts are never news on their own. */
export function describeDrift(report: Pick<RefreshReport, "resultsDetail" | "fixturesAdded" | "tableNew" | "playersChanged"> & { fixturesChanged?: number }, club: string): { title: string; body: string } | null {
  const results = [...report.resultsDetail].sort((a, b) => a.match_date.localeCompare(b.match_date));
  // news is a result or a fixture; a fresher table or an app count alone is housekeeping
  const diary = report.fixturesAdded + (report.fixturesChanged ?? 0);
  if (results.length === 0 && diary === 0) return null;
  const lines: string[] = results.map(resultSentence);
  if (report.fixturesAdded > 0) lines.push(report.fixturesAdded === 1 ? "One new fixture in the diary." : `${report.fixturesAdded} new fixtures in the diary.`);
  if ((report.fixturesChanged ?? 0) > 0) lines.push((report.fixturesChanged ?? 0) === 1 ? "A fixture moved or came out of the diary." : `${report.fixturesChanged} fixtures moved or came out of the diary.`);
  if (report.tableNew) lines.push("The league table is up to date.");
  if (report.playersChanged.length > 0) lines.push("Appearances and goals are up to date.");

  const title =
    results.length === 1
      ? `${club}: ${resultSentence(results[0]).split(": ")[1]}`
      : results.length > 1
        ? `${club}: ${results.length} new results`
        : `${club}: the league feed moved`;
  return { title, body: lines.join("\n") };
}
