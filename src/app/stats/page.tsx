import Link from "next/link";

import { ClubStop, Crest } from "@/components/club/crest";
import { AskNo2 } from "@/components/no2/ask-no2";
import { AddFilmForm } from "@/components/film/add-film-form";
import { ClipList } from "@/components/film/clip-list";
import { shortDate } from "@/components/squad/format";
import { todayISO } from "@/lib/data";
import { analysisConfigured } from "@/lib/film/analyse";
import { listClips, listGames } from "@/lib/film/data";
import { matchPlayer } from "@/lib/league/normalise";
import { byCompetition, cleanSheets, competitionOf, filterGames, halfTimeSwings, halves, recordOf, scorerRows, type ReviewGame } from "@/lib/review/extras";
import { seasonWindow } from "@/lib/review/season";
import { createClient } from "@/lib/supabase/server";
import type { ExternalStats, Result } from "@/lib/types";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";
export const metadata = { title: "stats - injury time." };

const KEY = "num text-[10.5px] uppercase tracking-[0.12em] text-ink-dim";
const TONE = { W: "bg-[var(--win)]/15 text-[var(--win)]", D: "bg-panel-2 text-ink", L: "bg-out/15 text-out" } as const;

/**
 * Stats: every result this season, cut the way a manager asks ("how are we doing in the Vase?", "away from
 * home?"). Filters are links, so a filtered view is a URL the gaffer can send. Film analysis lives at the foot.
 */
export default async function StatsPage({ searchParams }: { searchParams: Promise<{ c?: string; v?: string }> }) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const club = viewer.club;
  const asOf = todayISO();
  const win = seasonWindow(club.season, asOf);
  const supabase = await createClient();
  const [{ data: results }, { data: players }, clips, games] = await Promise.all([
    supabase.from("results").select("*").eq("club_id", club.id).gte("match_date", win.from).lte("match_date", win.to).order("match_date", { ascending: false }),
    supabase.from("players").select("id, name, external_stats").eq("club_id", club.id),
    listClips(club.id),
    listGames(club.id),
  ]);

  const all = ((results ?? []) as Result[]).map((r) => ({ ...r, venue: r.venue as "H" | "A" })) as ReviewGame[];
  const comps = byCompetition(all);
  const competition = sp.c && (sp.c === "all" || comps.some((c) => c.competition === sp.c)) ? sp.c : "all";
  const venue = sp.v === "H" || sp.v === "A" ? sp.v : "all";
  const shown = filterGames(all, { competition, venue });
  const rec = recordOf(shown);
  const sheets = cleanSheets(shown);
  const half = halves(shown);
  const swing = halfTimeSwings(shown);
  const squad = (players ?? []) as { id: string; name: string; external_stats: ExternalStats | null }[];
  const scorers = scorerRows(shown, (n) => {
    const p = matchPlayer(n, squad);
    return p ? { name: p.name, apps: p.external_stats?.apps ?? null } : null;
  }).slice(0, 8);
  const href = (c: string, v: string) => {
    const q = new URLSearchParams();
    if (c !== "all") q.set("c", c);
    if (v !== "all") q.set("v", v);
    const s = q.toString();
    return s ? `/stats?${s}` : "/stats";
  };

  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-7 sm:px-8 sm:py-9">
      <header>
        <p className="annot">{"// stats"}</p>
        <h1 className="display mt-2 text-4xl sm:text-5xl">
          {club.name}
          <ClubStop team={club.name} />
        </h1>
      </header>

      {/* filters: links, so a filtered view is a url */}
      <nav aria-label="filter results" className="mt-6 flex flex-col gap-2">
        <div className="flex flex-wrap gap-1">
          {[{ competition: "all" }, ...comps].map((c) => (
            <FilterLink key={c.competition} href={href(c.competition, venue)} on={competition === c.competition}>
              {c.competition === "all" ? "every game" : c.competition}
            </FilterLink>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {(["all", "H", "A"] as const).map((v) => (
            <FilterLink key={v} href={href(competition, v)} on={venue === v}>
              {v === "all" ? "home and away" : v === "H" ? "home" : "away"}
            </FilterLink>
          ))}
        </div>
      </nav>

      <AskNo2 />

      {/* the record for what's selected */}
      <section aria-label="record" className="mt-8 flex flex-wrap items-end gap-x-8 gap-y-4">
        {(
          [
            ["played", rec.played],
            ["won", rec.won],
            ["drawn", rec.drawn],
            ["lost", rec.lost],
            ["goals", `${rec.gf}-${rec.ga}`],
            ["clean sheets", sheets.kept],
            ["pts a game", rec.played ? (rec.points / rec.played).toFixed(2) : "-"],
          ] as const
        ).map(([k, v]) => (
          <div key={k}>
            <p className={KEY}>{k}</p>
            <p className="num mt-1 text-[30px] font-semibold leading-none text-ink tabular-nums">{v}</p>
          </div>
        ))}
      </section>

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* every result */}
        <section aria-labelledby="results-h" className="min-w-0">
          <p className="annot" id="results-h">{`// results · ${shown.length}`}</p>
          {shown.length === 0 ? <p className="mt-3 text-[14px] text-ink-dim">No games for that filter yet.</p> : null}
          <ol className="mt-3">
            {shown.map((g) => {
              const t = g.goals_for > g.goals_against ? "W" : g.goals_for === g.goals_against ? "D" : "L";
              return (
                <li key={`${g.match_date}-${g.opponent}`} className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line py-2.5">
                  <span className="num text-[11.5px] text-ink-dim">{shortDate(g.match_date)}</span>
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-2 text-[14px] text-ink">
                      <Crest team={g.opponent} size={18} />
                      <span className="truncate">{g.opponent}</span>
                      <span className="num text-[11px] text-ink-dim">({g.venue})</span>
                    </span>
                    <span className="num mt-0.5 block truncate text-[11px] text-ink-dim">
                      {competitionOf(g) === "league" ? "league" : g.competition}
                      {g.ht_for !== null && g.ht_against !== null ? ` · ht ${g.ht_for}-${g.ht_against}` : ""}
                      {g.scorers.length ? ` · ${g.scorers.join(", ")}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {"id" in g ? (
                      <Link href={`/report/${(g as ReviewGame & { id: string }).id}`} className="num text-[10.5px] uppercase tracking-[0.1em] text-ink-dim hover:text-mint">
                        report
                      </Link>
                    ) : null}
                    <span className="num text-[15px] font-semibold text-ink tabular-nums">
                      {g.goals_for}-{g.goals_against}
                    </span>
                    <span className={`plate plate-sm num flex h-6 min-w-8 items-center justify-center text-[11px] font-semibold ${TONE[t]}`}>{t}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="flex min-w-0 flex-col gap-12">
          {/* by competition */}
          <section aria-labelledby="comp-h">
            <p className="annot" id="comp-h">{"// by competition"}</p>
            <table className="mt-3 w-full border-collapse">
              <thead>
                <tr className="border-b border-line-strong">
                  {["", "p", "w", "d", "l", "goals"].map((h) => (
                    <th key={h} scope="col" className={`${KEY} py-2 font-normal ${h ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comps.map((c) => (
                  <tr key={c.competition} className="border-b border-line">
                    <th scope="row" className="py-2 text-left text-[13px] font-normal text-ink">
                      <Link href={href(c.competition, venue)} className="hover:text-mint">
                        {c.competition}
                      </Link>
                    </th>
                    <td className="num py-2 text-right text-[13px] tabular-nums text-ink">{c.played}</td>
                    <td className="num py-2 text-right text-[13px] tabular-nums text-ink-dim">{c.won}</td>
                    <td className="num py-2 text-right text-[13px] tabular-nums text-ink-dim">{c.drawn}</td>
                    <td className="num py-2 text-right text-[13px] tabular-nums text-ink-dim">{c.lost}</td>
                    <td className="num py-2 text-right text-[13px] tabular-nums text-ink-dim">
                      {c.gf}-{c.ga}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* the halves */}
          {half.counted > 0 ? (
            <section aria-labelledby="half-h">
              <p className="annot" id="half-h">{"// by half"}</p>
              <div className="mt-3 grid grid-cols-2 gap-6">
                <Pair label="scored" first={half.scoredFirst} second={half.scoredSecond} />
                <Pair label="conceded" first={half.concededFirst} second={half.concededSecond} />
              </div>
              <p className="num mt-4 text-[12px] text-ink">
                after half time: <span className="font-semibold">{swing.wonFromBehind ? `+${swing.wonFromBehind}` : "none"}</span> won from behind
                {" · "}
                <span className="font-semibold">{swing.droppedFromAhead ? `−${swing.droppedFromAhead}` : "none"}</span> dropped from ahead
              </p>
            </section>
          ) : null}

          {/* scorers for what's selected */}
          {scorers.length ? (
            <section aria-labelledby="scorers-h">
              <p className="annot" id="scorers-h">{"// scorers"}</p>
              <ol className="mt-3">
                {scorers.map((s) => (
                  <li key={s.name} className="flex items-baseline justify-between gap-3 border-b border-line py-2">
                    <span className="truncate text-[14px] text-ink">{s.name}</span>
                    <span className="num text-[13px] tabular-nums text-ink">
                      <span className="font-semibold">{s.goals}</span>
                      {s.hatTricks ? <span className="ml-2 text-[11px] text-ink-dim">{s.hatTricks} hat-trick{s.hatTricks > 1 ? "s" : ""}</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      </div>

      {/* film analysis, a section of stats */}
      <section id="film" aria-labelledby="film-h" className="mt-16 scroll-mt-20 border-t border-line pt-6">
        <p className="annot" id="film-h">{"// film analysis"}</p>
        <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <ClipList clips={clips} />
          <aside>
            {viewer.can("manage_film") ? <AddFilmForm fixtures={games.fixtures} results={games.results} /> : null}
            {analysisConfigured() ? <p className="annot mt-4 text-gold-dim">analyst ready</p> : null}
          </aside>
        </div>
      </section>
    </main>
  );
}

function FilterLink({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={on ? "true" : undefined}
      className={`plate plate-sm num py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint ${
        on ? "bg-panel-2 text-ink shadow-[inset_0_-2px_0_var(--mint)]" : "text-ink-dim hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

function Pair({ label, first, second }: { label: string; first: number; second: number }) {
  const max = Math.max(1, first, second);
  return (
    <div>
      <p className={KEY}>{label}</p>
      {(
        [
          ["1st half", first],
          ["2nd half", second],
        ] as const
      ).map(([k, v]) => (
        <div key={k} className="mt-2">
          <div className="flex justify-between text-[12.5px] text-ink">
            <span>{k}</span>
            <span className="num font-semibold tabular-nums">{v}</span>
          </div>
          <div className="mt-1 h-[3px] bg-line">
            <div className="h-full bg-ink transition-[width] duration-500 ease-[var(--ease-out-strong)]" style={{ width: `${(v / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
