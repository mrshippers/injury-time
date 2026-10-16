import Link from "next/link";

import { cupRuns } from "@/lib/home/cups";
import { getHomeSeason } from "@/lib/home/data";
import { homeCrowds, leagueOnly, recordOf, type ReviewGame } from "@/lib/review/extras";

const KEY = "num text-[10.5px] uppercase tracking-[0.12em] text-ink-dim";

/**
 * What a committee asks first, on one strip: where we sit, the league record, the cups still alive, the
 * crowds through the gate. The full pack is the season review; this is the board's front page.
 */
export async function BoardSummary({ clubId, asOf }: { clubId: string; asOf: string }) {
  const season = await getHomeSeason(clubId, asOf);
  const games = season.results.map((r) => ({ ...r, venue: r.venue as "H" | "A" })) as unknown as ReviewGame[];
  const rec = recordOf(leagueOnly(games));
  const us = season.standings.find((t) => t.is_us) ?? null;
  const crowds = homeCrowds(games);
  const alive = cupRuns(season.results, season.fixtures, asOf).filter((r) => r.state !== "out");
  const items: [string, string][] = [
    ["position", us ? `${us.position} of ${season.standings.length}` : "-"],
    ["league", `${rec.won}-${rec.drawn}-${rec.lost} · ${rec.points} pts`],
    ["cups alive", alive.length ? alive.map((r) => r.name).join(", ") : "none"],
    ["home crowd", crowds.counted ? `${crowds.average} avg · best ${crowds.best?.attendance ?? "-"}` : "-"],
  ];
  return (
    <section aria-label="the board at a glance" className="mt-8">
      <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
        {items.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className={KEY}>{k}</dt>
            <dd className="num mt-1 truncate text-[17px] font-semibold text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <Link href="/review" className="plate group mt-6 inline-flex items-center gap-3 bg-panel py-2.5 text-[13px] font-semibold text-ink transition-transform duration-200 hover:translate-x-1">
        the season pack, ready to print
        <span aria-hidden className="text-mint">→</span>
      </Link>
    </section>
  );
}
