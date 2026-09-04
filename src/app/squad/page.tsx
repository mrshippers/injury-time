import { getLineupData } from "@/lib/data";
import { getSavedLineup } from "@/lib/squad/data";
import type { AvailabilityStatus } from "@/lib/types";
import { getViewer } from "@/lib/viewer";

import { SquadRoom } from "@/components/squad/squad-room";
import { SummaryChips } from "@/components/squad/summary-chips";
import { longDate } from "@/components/squad/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "the squad room - injury time.",
};

/**
 * The squad room: FM's squad screen and team selection on one page. The
 * list is the squad; the pitch is the side for the next match; a name goes
 * from one to the other by drag or by two taps.
 */
export default async function SquadPage() {
  const [{ club, asOf, nextFixture, rows: allRows }, viewer] = await Promise.all([getLineupData(), getViewer()]);
  const rows = allRows.filter((r) => !r.player.retired_on);
  const saved = await getSavedLineup(club.id, nextFixture?.id ?? null);

  const counts: Record<AvailabilityStatus, number> = { fit: 0, doubt: 0, injured: 0, suspended: 0 };
  for (const row of rows) counts[row.availability?.status ?? "fit"] += 1;

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-7 sm:px-6 sm:py-9">
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="annot">{"// the squad room"}</p>
          <h1 className="display mt-2.5 text-4xl sm:text-5xl">
            {club.name}
            <span aria-hidden className="ml-[0.08em] inline-block h-[0.14em] w-[0.14em] bg-mint align-baseline" />
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-dim">
            <span>{club.league}{club.division ? ` · ${club.division}` : ""}</span>
            <span aria-hidden className="text-line-strong">/</span>
            <span className="num">
              as of <time dateTime={asOf}>{longDate(asOf)}</time>
            </span>
          </p>
        </div>
        <SummaryChips counts={counts} />
      </header>

      <SquadRoom rows={rows} nextFixture={nextFixture} saved={saved} canManage={viewer.can("manage_squad")} canPick={viewer.can("pick_side")} />

      <p className="annot mt-5 text-gold-dim">
        training is this week against his usual: steady · pushing it · undercooked · red zone&ensp;·&ensp;no reading until four weeks are logged&ensp;·&ensp;gold ring = playing out of position
      </p>
    </main>
  );
}
