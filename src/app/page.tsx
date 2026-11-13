import { daysBetweenISO, getDashboard, getSquadBoard } from "@/lib/data";
import { ClubStop } from "@/components/club/crest";
import { matchWeather } from "@/lib/weather/grounds";
import { LeagueTable } from "@/components/home/league-table";
import { HubPager, type HubPage } from "@/components/home/hub-pager";
import { seasonByCompetition } from "@/lib/home/competitions";
import { getHomeSeason } from "@/lib/home/data";

import { divisionLine } from "@/lib/league";
import { seasonContext } from "@/lib/home/season-context";
import { getViewer } from "@/lib/viewer";
import { AvailabilityStrip } from "@/components/home/availability-strip";
import { findCongestion } from "@/lib/home/congestion";
import { FirstWeek } from "@/components/home/first-week";
import { firstWeek } from "@/lib/signup/actions";
import { SeasonColumn } from "@/components/home/season-column";
import { SeasonBreakdown } from "@/components/home/season-breakdown";
import { lastResult } from "@/lib/home/cups";
import { NextMatchVital, ScorersVital, WatchVital } from "@/components/home/vitals";
import { longDate } from "@/components/squad/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "the hub - injury time." };

/**
 * The manager's homepage, as stages you swipe through. Home is the next game
 * and where the season stands, side by side; then the season by competition,
 * the table, the squad. Everything on it is a reading off real data or an
 * honest sentence saying there is none yet.
 */
export default async function Home() {
  const viewer = await getViewer();
  const week = await firstWeek();
  const [dash, board] = await Promise.all([getDashboard(), getSquadBoard()]);
  const { club, asOf, counts } = dash;
  const season = await getHomeSeason(viewer.club.id, asOf);
  const ctx = seasonContext({ results: season.results, standings: season.standings, progress: season.progress, fixtures: season.fixtures, asOf });

  const fixtures = season.fixtures.length > 0 ? season.fixtures : dash.fixtures;
  const next = fixtures[0] ?? null;
  const daysUntil = next ? daysBetweenISO(asOf, next.match_date) : null;
  const hasLoad = board.rows.some((r) => r.readiness.key !== "unknown");
  const clubName = viewer.club.name || club.name;
  const weather = next ? await matchWeather(clubName, next, asOf) : null;
  const byComp = seasonByCompetition({ results: season.results, fixtures: season.fixtures, standings: season.standings, asOf });
  const division = divisionLine(viewer.club.league, viewer.club.division);
  const congestion = findCongestion(
    fixtures,
    board.rows.map((r) => ({
      id: r.player.id,
      name: r.player.name,
      readiness: r.readiness.key,
      word: r.readiness.word,
      available: (r.availability?.status ?? "fit") === "fit" || r.availability?.status === "doubt",
    })),
    asOf,
  );


  const flat = "[&>section]:mt-0 [&>section]:border-t-0 [&>section]:pt-0";
  const pages: HubPage[] = [
    {
      key: "home",
      label: "home",
      content: (
        <div data-stagger className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div>
            <FirstWeek check={week} />
            <NextMatchVital next={next} daysUntil={daysUntil} fit={counts.fit} calls={season.calls} squadSize={dash.squadSize} last={lastResult(season.results)} weather={weather} />
          </div>
          <SeasonColumn ctx={ctx} s={byComp} fit={counts.fit} squadSize={dash.squadSize} />
        </div>
      ),
    },
    {
      key: "season",
      label: "season",
      content: <SeasonBreakdown ctx={ctx} s={byComp} season={season} asOf={asOf} congestion={congestion} />,
    },
    ...(season.standings.length
      ? [{ key: "table", label: "table", content: <div data-stagger className={flat}><LeagueTable standings={season.standings} asOf={season.standingsAsOf} /></div> }]
      : []),
    {
      key: "squad",
      label: "squad",
      content: (
        <div data-stagger className="flex flex-col gap-8">
          <AvailabilityStrip rows={board.rows} counts={counts} />
          <div className="grid gap-8 md:grid-cols-2">
            <ScorersVital feed={season.feedScorers} logged={dash.topScorers} feedAsOf={season.feedAsOf} />
            <WatchVital rows={dash.watchList} hasLoad={hasLoad} backSoon={dash.backSoon} />
          </div>
        </div>
      ),
    },
  ];

  return (
    <main className="mx-auto flex h-[calc(100dvh-49px)] w-full max-w-[1240px] flex-col overflow-hidden px-4 pt-5 max-sm:h-[calc(100dvh-49px-env(safe-area-inset-bottom)-64px)] sm:px-8 sm:pt-7">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h1 className="display text-[30px] leading-none sm:text-[40px]">
          {clubName}
          <ClubStop team={clubName} />
        </h1>
        <p className="num text-[11.5px] text-ink-dim">
          {division || club.league} · <time dateTime={asOf}>{longDate(asOf)}</time>
        </p>
      </header>
      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <HubPager pages={pages} />
      </div>
    </main>
  );
}
