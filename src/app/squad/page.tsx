import { getSquadBoard } from "@/lib/data";
import type { AvailabilityStatus } from "@/lib/types";

import { SquadTable } from "@/components/squad/squad-table";
import { SummaryChips } from "@/components/squad/summary-chips";
import { longDate } from "@/components/squad/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "the squad room - injury time.",
};

export default async function SquadPage() {
  const { club, asOf, rows } = await getSquadBoard();

  const counts: Record<AvailabilityStatus, number> = {
    fit: 0,
    doubt: 0,
    injured: 0,
    suspended: 0,
  };
  for (const row of rows) {
    counts[row.availability?.status ?? "fit"] += 1;
  }

  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-8 sm:px-8 sm:py-10">
      <header className="mb-6 flex flex-col gap-5 lg:mb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="annot">{"// the squad room"}</p>
          <h1 className="display mt-2.5 text-4xl sm:text-5xl">
            {club.name}
            <span
              aria-hidden
              className="ml-[0.08em] inline-block h-[0.14em] w-[0.14em] bg-mint align-baseline"
            />
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-dim">
            <span>{club.league}</span>
            <span aria-hidden className="text-line-strong">
              /
            </span>
            <span className="num">
              as of <time dateTime={asOf}>{longDate(asOf)}</time>
            </span>
          </p>
        </div>
        <SummaryChips counts={counts} />
      </header>

      <SquadTable rows={rows} />

      <p className="annot mt-5">
        acwr = 7-day load / 28-day weekly average&ensp;·&ensp;&mdash; means not
        enough history yet&ensp;·&ensp;click a row for the player
      </p>
    </main>
  );
}
