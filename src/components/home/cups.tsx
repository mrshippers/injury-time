import { cupRuns, type CupRun, type CupTie } from "@/lib/home/cups";
import { Crest } from "@/components/club/crest";
import type { Fixture, Result } from "@/lib/types";
import { shortDate } from "@/components/squad/format";

const TONE_BOX: Record<NonNullable<CupTie["tone"]>, string> = {
  win: "bg-[var(--win)]/15 text-[var(--win)]",
  draw: "bg-panel-2 text-ink",
  loss: "bg-out/15 text-out",
};
const TONE_LETTER: Record<NonNullable<CupTie["tone"]>, string> = { win: "W", draw: "D", loss: "L" };
const STATE_WORD: Record<CupRun["state"], string> = { in: "still in", out: "out", waiting: "waiting on the draw" };

/**
 * Every cup the club is in, as a run of ties. A league table hides the cups
 * entirely; a gaffer's season is half cups by November, so they sit on the hub
 * with the same weight as the league line. Shape and a word carry the state,
 * colour only echoes it.
 */
export function CupsSection({ results, fixtures, asOf }: { results: Result[]; fixtures: Fixture[]; asOf: string }) {
  const runs = cupRuns(results, fixtures, asOf);
  if (runs.length === 0) return null;
  return (
    <section aria-labelledby="cups-heading" className="mt-12 border-t border-line pt-3">
      <p className="annot" id="cups-heading">{"// the cups"}</p>
      <ul className="mt-3 flex flex-col gap-6">
        {runs.map((run) => (
          <li key={run.name}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="display text-[22px] leading-none text-ink">
                {run.name}
                <span
                  className={`num ml-3 inline-flex items-center gap-1.5 align-middle text-[10.5px] font-semibold uppercase tracking-[0.12em] ${run.state === "out" ? "text-out" : "text-ink-dim"}`}
                >
                  <span aria-hidden className={`inline-block size-2 rounded-full ${run.state === "in" ? "bg-[var(--win)]" : "border-[1.5px] border-current"}`} />
                  {STATE_WORD[run.state]}
                </span>
              </h2>
              <p className="text-[12.5px] text-ink-dim">{run.line}</p>
            </div>
            <ol className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" aria-label={`${run.name} ties`}>
              {run.ties.map((t) => (
                <li
                  key={`${t.date}-${t.opponent}`}
                  className={`min-w-[148px] shrink-0 px-3 py-2.5 sm:min-w-[160px] ${t.tone ? "plate bg-panel [--slant:10px]" : "plate bg-panel/40 [--slant:10px] text-ink-dim bg-pitch"}`}
                >
                  <p className="annot text-[10px]">{t.round}</p>
                  {t.tone ? (
                    <p className="mt-1.5 flex items-center gap-2">
                      <span className={`plate plate-sm num flex h-6 min-w-8 items-center justify-center text-[11.5px] font-semibold ${TONE_BOX[t.tone]}`}>{TONE_LETTER[t.tone]}</span>
                      <span className="num text-[18px] font-semibold text-ink">{t.score}</span>
                    </p>
                  ) : (
                    <p className="num mt-1.5 text-[12px] font-semibold tracking-[0.1em] text-gold">NEXT · {shortDate(t.date).toUpperCase()}</p>
                  )}
                  <p className="mt-1 flex items-center gap-1.5 truncate text-[12.5px] text-ink">
                    <Crest team={t.opponent} size={16} />
                    <span className="truncate">
                      {t.venue === "A" ? "at " : "v "}
                      {t.opponent}
                    </span>
                  </p>
                  <p className="num text-[11px] text-ink-dim">
                    {t.tone ? shortDate(t.date) : `${t.venue === "H" ? "home" : "away"}${t.kickoff ? ` · ${t.kickoff}` : ""}`}
                  </p>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
    </section>
  );
}
