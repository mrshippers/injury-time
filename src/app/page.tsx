import { daysBetweenISO, getDashboard, getSquadBoard } from "@/lib/data";
import { getHomeSeason } from "@/lib/home/data";
import { ordinal, seasonContext } from "@/lib/home/season-context";
import { getViewer } from "@/lib/viewer";
import { AvailabilityStrip } from "@/components/home/availability-strip";
import { HubTiles, type Tile } from "@/components/home/hub-tiles";
import { SeasonLine } from "@/components/home/season-line";
import { FormVital, NextMatchVital, ScorersVital, WatchVital } from "@/components/home/vitals";
import { StatReading } from "@/components/charts";
import { longDate, shortDate } from "@/components/squad/format";

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
  const [dash, board] = await Promise.all([getDashboard(), getSquadBoard()]);
  const { club, asOf, counts, lastSession } = dash;
  const season = await getHomeSeason(viewer.club.id, asOf);
  const ctx = seasonContext({ results: season.results, standings: season.standings, progress: season.progress, fixtures: season.fixtures, asOf });

  const fixtures = season.fixtures.length > 0 ? season.fixtures : dash.fixtures;
  const next = fixtures[0] ?? null;
  const daysUntil = next ? daysBetweenISO(asOf, next.match_date) : null;
  const unavailable = counts.injured + counts.suspended;
  const hasLoad = board.rows.some((r) => r.readiness.key !== "unknown");
  const sinceLast = lastSession ? daysBetweenISO(lastSession.date, asOf) : null;
  const clubName = viewer.club.name || club.name;
  const division = [viewer.club.league, viewer.club.division].filter(Boolean).join(" ");

  const tiles: Tile[] = [
    { href: "/squad", label: "squad", headline: `${counts.fit} of ${dash.squadSize}`, detail: "available, pick the side", tone: counts.fit >= 14 ? "ok" : counts.fit >= 11 ? "warn" : "bad" },
    { href: "/team", label: "team", headline: season.calls.total === 0 ? "no calls" : `${season.calls.in} in`, detail: next ? `for ${next.opponent}` : "next match", tone: season.calls.total === 0 ? "neutral" : "ok" },
    {
      href: "/log",
      label: "log",
      headline: sinceLast === null ? "nothing yet" : sinceLast === 0 ? "today" : sinceLast === 1 ? "yesterday" : `${sinceLast} days ago`,
      detail: lastSession ? `${lastSession.kind === "match" ? "match" : "training"} · ${lastSession.logged} players` : "one tap per player",
      tone: sinceLast !== null && sinceLast > 4 ? "warn" : "neutral",
    },
    { href: "/squad", label: "treatment", headline: unavailable === 0 ? "nobody out" : `${unavailable} out`, detail: dash.backSoon[0] ? `${dash.backSoon[0].player.name.split(" ").at(-1)} back ${shortDate(dash.backSoon[0].availability!.return_date!)}` : counts.doubt > 0 ? `${counts.doubt} carrying a doubt` : "no return dates this week", tone: unavailable >= 3 ? "bad" : unavailable > 0 ? "warn" : "ok" },
    { href: "/film", label: "film", headline: "the film room", detail: "clip in, tuesday out" },
    { href: "/team", label: "fixtures", headline: `${fixtures.length} in the diary`, detail: fixtures[1] ? `then ${fixtures[1].opponent} (${fixtures[1].venue}) ${shortDate(fixtures[1].match_date)}` : "add the next match", tone: "neutral" },
  ];

  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-7 sm:px-8 sm:py-9">
      <header className="flex flex-col gap-2">
        <p className="annot">{"// the hub"}</p>
        <h1 className="display text-4xl sm:text-5xl">
          {clubName}
          <span aria-hidden className="ml-[0.08em] inline-block h-[0.14em] w-[0.14em] bg-mint align-baseline" />
        </h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-dim">
          <span>{division || club.league}</span>
          <span aria-hidden className="text-line-strong">/</span>
          <span className="num">
            as of <time dateTime={asOf}>{longDate(asOf)}</time>
          </span>
          {viewer.guest ? (
            <>
              <span aria-hidden className="text-line-strong">/</span>
              <span>looking as a guest manager</span>
            </>
          ) : null}
        </p>
      </header>

      {/* primary: the season, one number and one line */}
      <section aria-labelledby="season-heading" className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-end">
        <div>
          <p className="annot" id="season-heading">{"// the season"}</p>
          {ctx.hasSeason ? (
            <StatReading
              value={String(ctx.points)}
              unit="pts"
              label={ctx.position ? `${ordinal(ctx.position)} of ${ctx.teams} · ${ctx.played} played` : `${ctx.played} played · no table on the feed yet`}
              size="xl"
              glow
              className="mt-2"
            />
          ) : (
            <StatReading value={String(counts.fit)} unit={`of ${dash.squadSize}`} label="available for the next match" size="xl" glow className="mt-2" tone={counts.fit >= 11 ? "ink" : "bad"} />
          )}
          <ul className="mt-4 flex max-w-[40ch] flex-col gap-1.5">
            {ctx.sentences.map((s) => (
              <li key={s} className="text-[14px] leading-snug text-ink">
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0">
          {ctx.hasSeason ? (
            <SeasonLine ctx={ctx} results={season.results} fixtures={season.fixtures} asOf={asOf} />
          ) : (
            <AvailabilityStrip rows={board.rows} counts={counts} />
          )}
          <p className="annot mt-2 text-gold-dim">
            {ctx.hasSeason
              ? `points after each league game · pace lines from the origin · christmas where the diary puts it${season.standingsAsOf ? ` · table ${shortDate(season.standingsAsOf)}` : ""}`
              : "one block per player, in squad-number order"}
          </p>
        </div>
      </section>

      {/* secondary: the vitals */}
      <div className="mt-12 grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-2 xl:grid-cols-[1.1fr_1fr_1fr_1.2fr]">
        <NextMatchVital next={next} daysUntil={daysUntil} fit={counts.fit} calls={season.calls} squadSize={dash.squadSize} />
        <FormVital ctx={ctx} results={season.results} />
        <ScorersVital feed={season.feedScorers} logged={dash.topScorers} feedAsOf={season.feedAsOf} />
        <WatchVital rows={dash.watchList} hasLoad={hasLoad} backSoon={dash.backSoon} />
      </div>

      {ctx.hasSeason ? (
        <div className="mt-10">
          <p className="annot mb-3">{"// the squad today"}</p>
          <AvailabilityStrip rows={board.rows} counts={counts} />
        </div>
      ) : null}

      {/* the modules, one quiet row */}
      <div className="mt-12">
        <HubTiles tiles={tiles} />
      </div>

      {/* tertiary */}
      <p className="annot mt-6 text-gold-dim">
        {ctx.hasSeason ? "league feed: footballwebpages.co.uk" : "readiness words: steady · pushing it · undercooked · red zone, this week against his usual"}
        {season.standingsAsOf ? ` · updated ${shortDate(season.standingsAsOf)}` : ""}
        &ensp;·&ensp;red zone is the week a hamstring goes
      </p>
    </main>
  );
}
