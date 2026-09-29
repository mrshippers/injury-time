import { REGION_LABEL } from "@/components/player/labels";
import { PrintButton } from "@/components/review/print-button";
import { longDate } from "@/components/squad/format";
import { sourceLine } from "@/lib/club/source";
import { loadEntriesByPlayer, todayISO } from "@/lib/data";
import type { LoadFlag } from "@/lib/load-engine";
import { seasonReview, seasonWindow } from "@/lib/review/season";
import { createClient } from "@/lib/supabase/server";
import type { Injury } from "@/lib/types";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export const metadata = { title: "season review - injury time." };

const FLAG: Record<LoadFlag, { word: string; mark: string }> = {
  red: { word: "red zone", mark: "mark-out" },
  watch: { word: "off his usual", mark: "mark-doubt" },
  ok: { word: "steady", mark: "mark-fit" },
  cold: { word: "no reading", mark: "mark-cold" },
};

/**
 * The page the committee prints. Every number is counted from what the club
 * logged; the load question is only asked where a reading existed.
 */
export default async function ReviewPage() {
  const viewer = await getViewer();
  const club = viewer.club;
  const asOf = todayISO();
  const supabase = await createClient();
  const win = seasonWindow(club.season, asOf);
  const [{ data: results }, { data: injuries }, { data: players }, loads] = await Promise.all([
    supabase.from("results").select("match_date, competition, goals_for, goals_against").eq("club_id", club.id).gte("match_date", win.from).lte("match_date", win.to),
    supabase.from("injuries").select("*").eq("club_id", club.id).gte("occurred_on", win.from).lte("occurred_on", win.to),
    supabase.from("players").select("id, name").eq("club_id", club.id),
    loadEntriesByPlayer(club.id, 365),
  ]);
  const r = seasonReview(results ?? [], (injuries ?? []) as Injury[], loads, asOf);
  const name = new Map((players ?? []).map((p) => [p.id, p.name]));
  const tile = "border-t border-line pt-3";

  return (
    <main className="mx-auto w-full max-w-[900px] flex-1 px-4 py-7 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="annot">{`// season review · ${club.season ?? ""}`}</p>
          <h1 className="display mt-2 text-4xl sm:text-5xl">
            {club.name}
            <span aria-hidden className="ml-[0.08em] inline-block h-[0.14em] w-[0.14em] bg-mint align-baseline" />
          </h1>
          <p className="num mt-2 text-[12px] text-ink-dim">
            {longDate(win.from)} to {longDate(asOf < win.to ? asOf : win.to)} · {sourceLine(club).short}
          </p>
        </div>
        <PrintButton />
      </div>

      <section aria-labelledby="record-h" className="mt-10">
        <p className="annot" id="record-h">{"// the league"}</p>
        <dl className="mt-3 grid grid-cols-3 gap-4 sm:grid-cols-6">
          {(
            [
              ["played", r.record.played],
              ["won", r.record.won],
              ["drawn", r.record.drawn],
              ["lost", r.record.lost],
              ["goals", `${r.record.gf}-${r.record.ga}`],
              ["points", r.record.points],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className={tile}>
              <dt className="text-[11px] uppercase tracking-[0.12em] text-ink-dim">{k}</dt>
              <dd className="num mt-1 text-[26px] font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="inj-h" className="mt-10">
        <p className="annot" id="inj-h">{"// injuries"}</p>
        {r.injuries.count === 0 ? (
          <p className="mt-3 text-[14px] text-ink-dim">None logged. That is not the same as none happening.</p>
        ) : (
          <>
            <dl className="mt-3 grid grid-cols-3 gap-4">
              <div className={tile}>
                <dt className="text-[11px] uppercase tracking-[0.12em] text-ink-dim">logged</dt>
                <dd className="num mt-1 text-[26px] font-semibold text-ink">{r.injuries.count}</dd>
              </div>
              <div className={tile}>
                <dt className="text-[11px] uppercase tracking-[0.12em] text-ink-dim">still out</dt>
                <dd className="num mt-1 text-[26px] font-semibold text-ink">{r.injuries.ongoing}</dd>
              </div>
              <div className={tile}>
                <dt className="text-[11px] uppercase tracking-[0.12em] text-ink-dim">player-days lost</dt>
                <dd className="num mt-1 text-[26px] font-semibold text-ink">{r.injuries.daysLost}</dd>
              </div>
            </dl>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-1.5 text-[14px]">
              {r.injuries.byRegion.map((x) => (
                <li key={x.region} className="text-ink">
                  {REGION_LABEL[x.region]} <span className="num text-ink-dim">× {x.count}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="red-h" className="mt-10">
        <p className="annot" id="red-h">{"// did the load see it coming"}</p>
        {r.judged === 0 ? (
          <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-ink-dim">
            Not enough training was logged before any injury to say. Log four weeks of sessions and this answers the question honestly.
          </p>
        ) : (
          <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-ink">
            Of <span className="num">{r.judged}</span> injur{r.judged === 1 ? "y" : "ies"} with a load reading the day before,{" "}
            <span className="num font-semibold">{r.redCalled}</span> came straight after a red-zone week.
            <span className="text-ink-dim"> Injuries without a reading are listed, not counted.</span>
          </p>
        )}
        {r.before.length ? (
          <ul className="mt-4 border-t border-line">
            {r.before.map((b) => (
              <li key={b.injuryId} className="flex items-center gap-3 border-b border-line py-2 text-[14px]">
                <span aria-hidden className={`mark size-3 shrink-0 rounded-[1px] ${FLAG[b.flag].mark}`} />
                <span className="num w-24 shrink-0 text-[12px] text-ink-dim">{longDate(b.occurred_on)}</span>
                <span className="min-w-0 flex-1 truncate text-ink">
                  {name.get(b.playerId) ?? "a player"} <span className="text-ink-dim">· {REGION_LABEL[b.region]}</span>
                </span>
                <span className="num text-[11px] uppercase tracking-[0.1em] text-ink-dim">{FLAG[b.flag].word}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
