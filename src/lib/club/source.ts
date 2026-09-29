/**
 * Where the season on screen came from, in words. The hub and the club page
 * both say it, so a copy is never passed off as a live feed.
 */
import type { Club } from "@/lib/types";

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });

export function sourceLine(club: Pick<Club, "season_source" | "season_synced_at" | "is_demo">): { short: string; long: string } {
  const when = club.season_synced_at ? DAY.format(new Date(club.season_synced_at)) : null;
  switch (club.season_source) {
    case "feed":
      return {
        short: `league feed: the club's Football Web Pages key${when ? `, synced ${when}` : ""}`,
        long: `Pulled nightly from Football Web Pages with this club's own key${when ? `; last synced ${when}` : ""}.`,
      };
    case "snapshot":
      return {
        short: `league data: a copy of the public league pages${when ? ` from ${when}` : ""}, not live`,
        long: `A copy of the club's public league pages${when ? ` taken ${when}` : ""}. It does not update until the club connects its own key.`,
      };
    default:
      return {
        short: club.is_demo ? "results: entered by the club (a fictional demo side)" : "results: entered by the club",
        long: "Results are entered here by the club's staff. Connect the club's league feed to pull fixtures and the table as well.",
      };
  }
}
