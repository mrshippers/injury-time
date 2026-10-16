import { daysBetweenISO, getDashboard, getSquadBoard } from "@/lib/data";
import { ClubStop } from "@/components/club/crest";
import { matchWeather } from "@/lib/weather/grounds";
import { LeagueTable } from "@/components/home/league-table";
import { HubPager, type HubPage } from "@/components/home/hub-pager";
import { QuickLinks } from "@/components/home/quick-links";
import { cupRuns } from "@/lib/home/cups";
import { getHomeSeason } from "@/lib/home/data";

import { divisionLine } from "@/lib/league";
import { ordinal, seasonContext } from "@/lib/home/season-context";
import { getViewer } from "@/lib/viewer";
import { AvailabilityStrip } from "@/components/home/availability-strip";
import { CongestionPanel } from "@/components/home/congestion-panel";
import { findCongestion } from "@/lib/home/congestion";
import { FirstWeek } from "@/components/home/first-week";
import { firstWeek } from "@/lib/signup/actions";
import { SeasonLine } from "@/components/home/season-line";
import { CupsSection } from "@/components/home/cups";
import { lastResult } from "@/lib/home/cups";
import { FormVital, NextMatchVital, ScorersVital, WatchVital } from "@/components/home/vitals";
import { StatReading } from "@/components/charts";
import { longDate } from "@/components/squad/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "the hub - injury time." };

/**
 * The manager's homepage. Three layers and no more: the season (one number,
 * one line), the vitals a gaffer checks on the way to training, and the
 * modules as a quiet row underneath. Everything on it is a reading off real
 * data or an honest sentence saying there is none yet.
 */
export default async function Home() {
  const viewer = await getViewer();
  const week = await firstWeek();
  const [dash, board] = await Promise.all([getDashboard(), getSquadBoard()]);
  const { club, asOf, counts, lastSession } = dash;
  const season = await getHomeSeason(viewer.club.id, asOf);
  const ctx = seasonContext({ results: season.results, standings: season.standings, progress: season.progress, fixtures: season.fixtures, asOf });

  const fixtures = season.fixtures.length > 0 ? season.fixtures : dash.fixtures;
  const next = fixtures[0] ?? null;
  const daysUntil = next ? daysBetweenISO(asOf, next.match_date) : null;
  const hasLoad = board.rows.some((r) => r.readiness.key !== "unknown");
  const sinceLast = lastSession ? daysBetweenISO(lastSession.date, asOf) : null;
  const clubName = viewer.club.name || club.name;
  const weather = next ? await matchWeather(clubName, next, asOf) : null;
  const cupsCount = cupRuns(season.results, season.fixtures, asOf).length;
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
      key: "next",
      label: "next game",
      content: (
        <div data-stagger className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div>
            <FirstWeek check={week} />
            <NextMatchVital next={next} daysUntil={daysUntil} fit={counts.fit} calls={season.calls} squadSize={dash.squadSize} last={lastResult(season.results)} weather={weather} />
          </div>
          <div className="flex flex-col gap-6">
            {congestion ? <CongestionPanel c={congestion} /> : null}
            <QuickLinks
              links={[
                { href: "/squad", label: "starting XI", detail: `${counts.fit} of ${dash.squadSize} available` },
                { href: "/team", label: "matchday", detail: season.calls.total === 0 ? "nobody has answered" : `${season.calls.in} in · ${season.calls.out} out` },
                { href: "/log", label: "log a session", detail: sinceLast === null ? "nothing logged yet" : sinceLast === 0 ? "last: today" : `last: ${sinceLast} days ago` },
              ]}
            />
          </div>
        </div>
      ),
    },
    ...(season.standings.length
      ? [{ key: "table", label: "table", content: <div data-stagger className={flat}><LeagueTable standings={season.standings} asOf={season.standingsAsOf} /></div> }]
      : []),
    {
      key: "season",
      label: "season",
      content: (
        <div data-stagger className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-end">
          <div>
            {ctx.hasSeason ? (
              <StatReading value={String(ctx.points)} unit="pts" label={ctx.position ? `${ordinal(ctx.position)} of ${ctx.teams} · ${ctx.played} played` : `${ctx.played} played`} size="xl" glow />
            ) : (
              <StatReading value={String(counts.fit)} unit={`of ${dash.squadSize}`} label="available for the next match" size="xl" glow tone={counts.fit >= 11 ? "ink" : "bad"} />
            )}
            <ul className="mt-4 flex max-w-[40ch] flex-col gap-1.5">
              {ctx.sentences.map((t) => (
                <li key={t} className="text-[14px] leading-snug text-ink">
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-0">
            {ctx.hasSeason ? <SeasonLine ctx={ctx} results={season.results} fixtures={season.fixtures} asOf={asOf} /> : null}
          </div>
          <div className="lg:col-span-2">
            <FormVital ctx={ctx} results={season.results} />
          </div>
        </div>
      ),
    },
    ...(cupsCount > 0 ? [{ key: "cups", label: "cups", content: <div data-stagger className={flat}><CupsSection results={season.results} fixtures={season.fixtures} asOf={asOf} /></div> }] : []),
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
