import { Fragment } from "react";

import { Crest } from "@/components/club/crest";
import type { Standing } from "@/lib/types";

/** Top two go up, top five make the play-offs: the same lines the hub's sentences count to. */
const CUTS: { after: number; label: string; tone: string }[] = [
  { after: 2, label: "promotion", tone: "border-gold" },
  { after: 5, label: "play-offs", tone: "border-ink-dim" },
];

/**
 * The whole league table, the one page every manager checks first. Tabular numbers, our row lit with a
 * mint bar and the word US (never colour alone), the promotion and play-off cuts drawn as dashed hairlines
 * with their names. Form is left out: the feed only gives form for us, and a column that is blank for 21
 * clubs is worse than none.
 */
export function LeagueTable({ standings, asOf }: { standings: Standing[]; asOf: string | null }) {
  if (standings.length === 0) return null;
  const rows = [...standings].sort((a, b) => a.position - b.position);
  const head = "num py-2 text-[10.5px] font-normal uppercase tracking-[0.12em] text-ink-dim";
  const th = `${head} px-1.5 text-right sm:px-2`;
  return (
    <section id="table" aria-labelledby="table-h" className="mt-14 scroll-mt-20">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-2">
        <p className="annot" id="table-h">
          {"// the league table"}
        </p>
        {asOf ? <p className="num text-[11.5px] text-ink-dim">as of {new Date(asOf).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p> : null}
      </div>
      <div className="max-w-[780px] overflow-x-auto">
        <table className="w-full min-w-[300px] border-collapse">
          <caption className="sr-only">League table, {rows.length} clubs, promotion for the top two and play-offs to fifth</caption>
          <thead>
            <tr className="border-b border-line-strong">
              <th scope="col" className={`${th} w-8`}>#</th>
              <th scope="col" className={`${head} pl-3 text-left`}>club</th>
              <th scope="col" className={th}>p</th>
              <th scope="col" className={`${th} max-sm:hidden`}>w</th>
              <th scope="col" className={`${th} max-sm:hidden`}>d</th>
              <th scope="col" className={`${th} max-sm:hidden`}>l</th>
              <th scope="col" className={`${th} max-md:hidden`}>gf-ga</th>
              <th scope="col" className={th}>gd</th>
              <th scope="col" className={`${th} pr-3`}>pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const cut = CUTS.find((c) => c.after === t.position);
              const td = "num px-1.5 py-2 text-right text-[13px] tabular-nums sm:px-2";
              return (
                <Fragment key={t.team}>
                <tr
                  aria-current={t.is_us ? "true" : undefined}
                  className={`border-b border-line ${t.is_us ? "bg-panel-2 shadow-[inset_3px_0_0_var(--mint)]" : ""}`}
                >
                  <td className={`${td} text-ink-dim`}>{t.position}</td>
                  <th scope="row" className={`py-2 pl-3 text-left text-[13px] ${t.is_us ? "font-bold text-ink" : "font-normal text-ink"}`}>
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <Crest team={t.team} size={18} />
                      <span className="truncate max-sm:max-w-[38vw]">{t.team}</span>
                      {t.is_us ? <span className="num text-[10px] tracking-[0.12em] text-mint">US</span> : null}
                    </span>
                  </th>
                  <td className={`${td} text-ink`}>{t.played}</td>
                  <td className={`${td} text-ink-dim max-sm:hidden`}>{t.won}</td>
                  <td className={`${td} text-ink-dim max-sm:hidden`}>{t.drawn}</td>
                  <td className={`${td} text-ink-dim max-sm:hidden`}>{t.lost}</td>
                  <td className={`${td} text-ink-dim max-md:hidden`}>
                    {t.gf}-{t.ga}
                  </td>
                  <td className={`${td} text-ink-dim`}>{t.gd > 0 ? `+${t.gd}` : t.gd}</td>
                  <td className={`${td} pr-3 font-semibold text-ink`}>{t.points}</td>
                </tr>
                {cut ? (
                  <tr aria-hidden>
                    <td colSpan={9} className={`border-b border-dashed ${cut.tone} pb-1 pl-3 pt-1.5`}>
                      <span className="num text-[9.5px] font-medium uppercase tracking-[0.14em] text-ink-dim">{cut.label} ↑</span>
                    </td>
                  </tr>
                ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
