import { daysBetweenISO, getLineupData } from "@/lib/data";
import { LineupBoard } from "@/components/lineup/lineup-board";
import { longDate } from "@/components/squad/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "the lineup - injury time." };

export default async function LineupPage() {
  const { club, asOf, nextFixture, rows } = await getLineupData();
  const daysUntil = nextFixture ? daysBetweenISO(asOf, nextFixture.match_date) : null;
  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-7 sm:px-8 sm:py-9">
      <header className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="annot">{"// the lineup"}</p>
          <h1 className="display mt-2 text-4xl sm:text-5xl">
            {nextFixture ? `v ${nextFixture.opponent}` : club.name}
            <span aria-hidden className="ml-[0.08em] inline-block h-[0.14em] w-[0.14em] bg-mint align-baseline" />
          </h1>
        </div>
        <p className="text-[13px] text-ink-dim">
          {nextFixture ? (
            <>
              <span className="num">{longDate(nextFixture.match_date)}</span>
              {nextFixture.kickoff ? <span className="num"> · {nextFixture.kickoff}</span> : null}
              {" · "}
              {nextFixture.venue === "H" ? "home" : "away"} · {nextFixture.competition}
              {daysUntil !== null ? <span className="num"> · {daysUntil === 0 ? "today" : daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`}</span> : null}
            </>
          ) : (
            "no fixture in the diary; picking on today's availability"
          )}
        </p>
      </header>
      <LineupBoard rows={rows} nextFixture={nextFixture} />
      <p className="annot mt-5 text-gold-dim">
        auto-picked on availability and load, steadiest first&ensp;·&ensp;click a shirt, then a name, to swap&ensp;·&ensp;gold ring = playing out of position
      </p>
    </main>
  );
}
