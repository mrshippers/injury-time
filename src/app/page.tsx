import { daysBetweenISO, getDashboard, getSquadBoard } from "@/lib/data";
import { AvailabilityStrip } from "@/components/home/availability-strip";
import { BackSoonPanel, NextMatchPanel, WatchListPanel } from "@/components/home/hub-panels";
import { HubTiles, type Tile } from "@/components/home/hub-tiles";
import { longDate, shortDate } from "@/components/squad/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "the hub - injury time." };

/**
 * The hub. FM's squad overview for a club with no analyst: every module is a
 * tile that already carries its answer, and the three things a gaffer asks
 * on the way to training (who's next, who's a risk, who's back) sit above.
 */
export default async function Home() {
  const [dash, board] = await Promise.all([getDashboard(), getSquadBoard()]);
  const { club, asOf, counts, fixtures, lastSession, topScorers, topAssists, fitByPosition } = dash;

  const next = fixtures[0] ?? null;
  const daysUntil = next ? daysBetweenISO(asOf, next.match_date) : null;
  const unavailable = counts.injured + counts.suspended;

  // A side needs a keeper, three at the back, three in the middle, one up top
  // before it is a side at all. Anything short of that is the headline.
  const short: string[] = [];
  if (fitByPosition.GK < 1) short.push("a keeper");
  if (fitByPosition.DF < 3) short.push("defenders");
  if (fitByPosition.MF < 3) short.push("midfielders");
  if (fitByPosition.FW < 1) short.push("a striker");
  const canFieldXI = counts.fit >= 11 && short.length === 0;

  const sinceLast = lastSession ? daysBetweenISO(lastSession.date, asOf) : null;
  const scorer = topScorers[0];
  const creator = topAssists[0];

  const tiles: Tile[] = [
    {
      href: "/squad",
      label: "squad room",
      headline: `${counts.fit} of ${dash.squadSize} available`,
      detail: `${counts.doubt} doubt · ${counts.injured} out · ${counts.suspended} suspended`,
      tone: counts.fit >= 14 ? "ok" : counts.fit >= 11 ? "warn" : "bad",
    },
    {
      href: "/lineup",
      label: "lineup",
      headline: canFieldXI ? "XI ready" : counts.fit < 11 ? `${counts.fit} fit, need 11` : `short of ${short.join(", ")}`,
      detail: next
        ? `${next.opponent} (${next.venue}) · ${shortDate(next.match_date)} · pick on the 3D pitch`
        : "no fixture in the diary yet",
      tone: canFieldXI ? "ok" : "warn",
    },
    {
      href: "/log",
      label: "log a session",
      headline:
        sinceLast === null ? "nothing logged" : sinceLast === 0 ? "logged today" : sinceLast === 1 ? "last: yesterday" : `last: ${sinceLast} days ago`,
      detail: lastSession
        ? `${lastSession.kind === "match" ? `match v ${lastSession.opponent?.split(" (")[0] ?? "?"}` : "training"} · ${lastSession.logged} players`
        : "one tap per player, two on a bad night",
      tone: sinceLast !== null && sinceLast > 4 ? "warn" : "neutral",
    },
    {
      href: "/squad",
      label: "treatment room",
      headline: unavailable === 0 ? "nobody out" : `${unavailable} out`,
      detail:
        dash.backSoon.length > 0
          ? `${dash.backSoon[0].player.name} back ${shortDate(dash.backSoon[0].availability!.return_date!)}`
          : counts.doubt > 0
            ? `${counts.doubt} carrying a doubt into the week`
            : "no return dates this week",
      tone: unavailable >= 3 ? "bad" : unavailable > 0 ? "warn" : "ok",
    },
    {
      href: "/lineup",
      label: "fixtures",
      headline: next ? `${next.opponent} (${next.venue})` : "diary empty",
      detail: next
        ? `${longDate(next.match_date)}${next.kickoff ? ` · ${next.kickoff}` : ""} · ${fixtures.length} in the diary`
        : "add the next match to plan around it",
    },
    {
      href: "/squad",
      label: "season stats",
      headline: scorer ? `${scorer.player.name.split(" ").at(-1)} ${scorer.stats.goals}` : "no goals yet",
      detail: scorer
        ? `top scorer · ${creator ? `${creator.player.name.split(" ").at(-1)} ${creator.stats.assists} assists` : "no assists logged"}`
        : "goals and assists come off the match log",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-7 sm:px-8 sm:py-9">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="annot">{"// the hub"}</p>
          <h1 className="display mt-2 text-4xl sm:text-5xl">
            {club.name}
            <span aria-hidden className="ml-[0.08em] inline-block h-[0.14em] w-[0.14em] bg-mint align-baseline" />
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-dim">
            <span>{club.league}</span>
            <span aria-hidden className="text-line-strong">/</span>
            <span className="num">
              as of <time dateTime={asOf}>{longDate(asOf)}</time>
            </span>
          </p>
        </div>
        <div className="w-full lg:w-[440px]">
          <AvailabilityStrip rows={board.rows} counts={counts} />
        </div>
      </header>

      <div className="mt-7 grid grid-cols-1 gap-3 md:grid-cols-3">
        <NextMatchPanel fixtures={fixtures} daysUntil={daysUntil} fitCount={counts.fit} />
        <WatchListPanel rows={dash.watchList} />
        <BackSoonPanel rows={dash.backSoon} outCount={unavailable} />
      </div>

      <div className="mt-7">
        <HubTiles tiles={tiles} />
      </div>

      <p className="annot mt-6 text-gold-dim">
        load words: steady · pushing it · undercooked · red zone&ensp;·&ensp;a red zone is the week a hamstring goes
      </p>
    </main>
  );
}
