import { RungBars } from "@/components/charts";
import { ClubStop, Crest } from "@/components/club/crest";
import { CupsSection } from "@/components/home/cups";
import { REGION_LABEL } from "@/components/player/labels";
import { PrintButton } from "@/components/review/print-button";
import { longDate, shortDate } from "@/components/squad/format";
import { sourceLine } from "@/lib/club/source";
import { loadEntriesByPlayer, todayISO } from "@/lib/data";
import { cupRuns } from "@/lib/home/cups";
import { matchPlayer } from "@/lib/league";
import type { LoadFlag } from "@/lib/load-engine";
import {
  cleanSheets,
  cupsOnly,
  extremes,
  halfTimeSwings,
  halves,
  homeCrowds,
  leagueOnly,
  monthly,
  recordOf,
  reviewSentences,
  runsOf,
  scorerRows,
  venueSplit,
  type Record3,
  type ReviewGame,
} from "@/lib/review/extras";
import { seasonReview, seasonWindow } from "@/lib/review/season";
import { createClient } from "@/lib/supabase/server";
import type { ExternalStats, Fixture, Injury, Result, Standing } from "@/lib/types";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export const metadata = { title: "season review - injury time." };

const FLAG: Record<LoadFlag, { word: string; mark: string }> = {
  red: { word: "red zone", mark: "mark-out" },
  watch: { word: "off his usual", mark: "mark-doubt" },
  ok: { word: "steady", mark: "mark-fit" },
  cold: { word: "no reading", mark: "mark-cold" },
};

const TILE = "border-t border-line pt-3";
const KEY = "text-[11px] uppercase tracking-[0.12em] text-ink-dim";
const BIG = "num mt-1 text-[26px] font-semibold text-ink";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-12 break-inside-avoid">
      <p className="annot" id={id}>{`// ${title}`}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Tiles({ items, cols = "grid-cols-3 sm:grid-cols-6" }: { items: readonly (readonly [string, string | number])[]; cols?: string }) {
  return (
    <dl className={`grid gap-4 ${cols}`}>
      {items.map(([k, v]) => (
        <div key={k} className={TILE}>
          <dt className={KEY}>{k}</dt>
          <dd className={BIG}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** "3-1 v Spelthorne Sports, 29 Aug" */
const gameLine = (g: ReviewGame) => `${g.goals_for}-${g.goals_against} ${g.venue === "A" ? "at" : "v"} ${g.opponent}, ${shortDate(g.match_date)}`;

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4) % 4]}`;

/**
 * The page the committee prints. Every number is counted from what the club
 * logged or its league feed holds; a figure the data cannot support says how
 * many games it could count, never a guess. The load question is only asked
 * where a reading existed.
 */
export default async function ReviewPage() {
  const viewer = await getViewer();
  const club = viewer.club;
  const asOf = todayISO();
  const supabase = await createClient();
  const win = seasonWindow(club.season, asOf);
  const [{ data: results }, { data: fixtures }, { data: injuries }, { data: players }, { data: latest }, loads] = await Promise.all([
    supabase.from("results").select("*").eq("club_id", club.id).gte("match_date", win.from).lte("match_date", win.to).order("match_date", { ascending: true }),
    supabase.from("fixtures").select("*").eq("club_id", club.id).gte("match_date", asOf).order("match_date", { ascending: true }),
    supabase.from("injuries").select("*").eq("club_id", club.id).gte("occurred_on", win.from).lte("occurred_on", win.to),
    supabase.from("players").select("id, name, external_stats").eq("club_id", club.id),
    supabase.from("league_standings").select("as_of").eq("club_id", club.id).order("as_of", { ascending: false }).limit(1).maybeSingle(),
    loadEntriesByPlayer(club.id, 365),
  ]);
  let table: Standing[] = [];
  if (latest?.as_of) {
    const { data } = await supabase.from("league_standings").select("*").eq("club_id", club.id).eq("as_of", latest.as_of).order("position", { ascending: true });
    table = (data ?? []) as Standing[];
  }

  const all = ((results ?? []) as Result[]).map((r) => ({ ...r, venue: r.venue as "H" | "A" })) as ReviewGame[];
  const league = leagueOnly(all);
  const cups = cupsOnly(all);
  const rec = recordOf(league);
  const cupRec = recordOf(cups);
  const split = venueSplit(league);
  const sheets = cleanSheets(league);
  const half = halves(all);
  const swing = halfTimeSwings(all);
  const ext = extremes(all);
  const crowds = homeCrowds(all);
  const months = monthly(league);
  const runs = runsOf(league);
  const runsList = cupRuns((results ?? []) as Result[], (fixtures ?? []) as Fixture[], asOf);
  const stillIn = runsList.filter((r) => r.state === "in").map((r) => r.name);

  const squad = (players ?? []) as { id: string; name: string; external_stats: ExternalStats | null }[];
  const resolve = (feedName: string) => {
    const p = matchPlayer(feedName, squad);
    return p ? { name: p.name, apps: p.external_stats?.apps ?? null } : null;
  };
  const scorers = scorerRows(all, resolve).slice(0, 8);
  const mostPlayed = squad
    .filter((p) => (p.external_stats?.apps ?? 0) > 0)
    .sort((a, b) => (b.external_stats?.apps ?? 0) - (a.external_stats?.apps ?? 0) || a.name.localeCompare(b.name))
    .slice(0, 8);

  const us = table.find((t) => t.is_us) ?? null;
  const around = us ? table.filter((t) => Math.abs(t.position - us.position) <= 3) : [];
  const sentences = reviewSentences({ split, cups: cupRec, cupsStillIn: stillIn, cleanSheets: sheets.kept, leaguePlayed: league.length });

  const r = seasonReview(
    ((results ?? []) as Result[]).map((x) => ({ match_date: x.match_date, competition: x.competition, goals_for: x.goals_for, goals_against: x.goals_against })),
    (injuries ?? []) as Injury[],
    loads,
    asOf,
  );
  const name = new Map(squad.map((p) => [p.id, p.name]));

  const ledger = (label: string, x: Record3) => (
    <tr key={label} className="border-b border-line">
      <th scope="row" className="py-2 pr-3 text-left text-[13px] font-semibold text-ink">{label}</th>
      {[x.played, x.won, x.drawn, x.lost, x.gf, x.ga, x.points].map((v, i) => (
        <td key={i} className="num py-2 text-right text-[13px] text-ink tabular-nums">{v}</td>
      ))}
      <td className="num py-2 pl-3 text-right text-[13px] text-ink-dim tabular-nums">{x.played ? (x.points / x.played).toFixed(2) : "-"}</td>
    </tr>
  );

  return (
    <main className="mx-auto w-full max-w-[960px] flex-1 px-4 py-7 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="annot">{`// season review · ${club.season ?? ""}`}</p>
          <h1 className="display mt-2 text-4xl sm:text-5xl">
            {club.name}
            <ClubStop team={club.name} />
          </h1>
          <p className="num mt-2 text-[12px] text-ink-dim">
            {longDate(win.from)} to {longDate(asOf < win.to ? asOf : win.to)} · {sourceLine(club).short}
          </p>
        </div>
        <PrintButton />
      </div>

      {sentences.length > 0 ? (
        <ul className="mt-8 flex max-w-[64ch] flex-col gap-1.5 border-l-2 border-line-strong pl-4">
          {sentences.map((s) => (
            <li key={s} className="text-[15px] leading-snug text-ink">{s}</li>
          ))}
        </ul>
      ) : null}

      <Section id="league-h" title="the league">
        <Tiles items={[["played", rec.played], ["won", rec.won], ["drawn", rec.drawn], ["lost", rec.lost], ["goals", `${rec.gf}-${rec.ga}`], ["points", rec.points]]} />
        {us ? (
          <p className="mt-4 text-[14px] text-ink">
            <span className="num font-semibold">{ordinal(us.position)}</span> of {table.length}, {us.points} points from {us.played}
            <span className="text-ink-dim"> · table of {shortDate(us.as_of)}</span>
          </p>
        ) : null}
      </Section>

      {split.home.played + split.away.played > 0 ? (
        <Section id="venue-h" title="home and away">
          <table className="w-full max-w-[640px] border-collapse">
            <caption className="sr-only">League record at home and away</caption>
            <thead>
              <tr className="border-b border-line-strong">
                <th scope="col" className="py-1.5 text-left"><span className="sr-only">venue</span></th>
                {["p", "w", "d", "l", "f", "a", "pts"].map((h) => (
                  <th key={h} scope="col" className={`${KEY} py-1.5 text-right font-normal`}>{h}</th>
                ))}
                <th scope="col" className={`${KEY} py-1.5 pl-3 text-right font-normal`}>ppg</th>
              </tr>
            </thead>
            <tbody>
              {ledger("home", split.home)}
              {ledger("away", split.away)}
            </tbody>
          </table>
        </Section>
      ) : null}

      {around.length > 0 ? (
        <Section id="table-h" title="the table around us">
          <table className="w-full max-w-[640px] border-collapse">
            <caption className="sr-only">Rows of the league table either side of the club</caption>
            <thead>
              <tr className="border-b border-line-strong">
                <th scope="col" className={`${KEY} w-10 py-1.5 text-right font-normal`}>#</th>
                <th scope="col" className={`${KEY} py-1.5 pl-3 text-left font-normal`}>club</th>
                {["p", "gd", "pts"].map((h) => (
                  <th key={h} scope="col" className={`${KEY} py-1.5 text-right font-normal`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {around.map((t) => (
                <tr key={t.team} className={`border-b border-line ${t.is_us ? "bg-panel-2" : ""}`} aria-current={t.is_us ? "true" : undefined}>
                  <td className="num py-2 text-right text-[13px] text-ink-dim tabular-nums">{t.position}</td>
                  <th scope="row" className={`py-2 pl-3 text-left text-[13px] ${t.is_us ? "font-bold text-ink" : "font-normal text-ink"}`}>
                    <span className="inline-flex items-center gap-2">
                      <Crest team={t.team} size={18} />
                      {t.team}
                    </span>
                    {t.is_us ? <span className="num ml-2 text-[10px] tracking-[0.12em] text-mint">US</span> : null}
                  </th>
                  <td className="num py-2 text-right text-[13px] text-ink tabular-nums">{t.played}</td>
                  <td className="num py-2 text-right text-[13px] text-ink-dim tabular-nums">{t.gd > 0 ? `+${t.gd}` : t.gd}</td>
                  <td className="num py-2 text-right text-[13px] font-semibold text-ink tabular-nums">{t.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      <Section id="goals-h" title="goals">
        <Tiles cols="grid-cols-2 sm:grid-cols-4" items={[["scored", all.reduce((n, x) => n + x.goals_for, 0)], ["conceded", all.reduce((n, x) => n + x.goals_against, 0)], ["clean sheets", sheets.kept], ["failed to score", sheets.failedToScore]]} />
        <p className="num mt-2 text-[11.5px] text-ink-dim">every competition, {all.length} games</p>
        {half.counted > 0 ? (
          <div className="mt-6 grid gap-8 sm:grid-cols-2">
            <div>
              <p className={KEY}>scored, by half</p>
              <RungBars
                className="mt-3"
                label="goals scored in each half"
                rungs={[
                  { label: "first half", value: half.scoredFirst, display: String(half.scoredFirst) },
                  { label: "second half", value: half.scoredSecond, display: String(half.scoredSecond), tone: "dim" },
                ]}
                max={Math.max(1, half.scoredFirst, half.scoredSecond, half.concededFirst, half.concededSecond)}
              />
            </div>
            <div>
              <p className={KEY}>conceded, by half</p>
              <RungBars
                className="mt-3"
                label="goals conceded in each half"
                rungs={[
                  { label: "first half", value: half.concededFirst, display: String(half.concededFirst), tone: "warn" },
                  { label: "second half", value: half.concededSecond, display: String(half.concededSecond), tone: "dim" },
                ]}
                max={Math.max(1, half.scoredFirst, half.scoredSecond, half.concededFirst, half.concededSecond)}
              />
            </div>
            <p className="num text-[11.5px] text-ink-dim sm:col-span-2">from {half.counted} of {all.length} games that have a half-time score</p>
          </div>
        ) : null}
        {swing.counted > 0 ? (
          <div className="mt-6 border-t border-line pt-4">
            <p className={KEY}>after half time</p>
            <Tiles
              cols="grid-cols-2"
              items={[
                [`won from behind (${swing.behindAtHt} games)`, `+${swing.wonFromBehind} pts`],
                [`dropped from ahead (${swing.aheadAtHt} games)`, `−${swing.droppedFromAhead} pts`],
              ]}
            />
            <p className="num mt-2 text-[11.5px] text-ink-dim">points the second half won or cost, from {swing.counted} games with a half-time score</p>
          </div>
        ) : null}
        <ul className="mt-6 flex flex-col gap-1 text-[14px] text-ink">
          {ext.biggestWin ? <li><span className="mr-2 text-ink-dim">biggest win</span>{gameLine(ext.biggestWin)}</li> : null}
          {ext.heaviestDefeat ? <li><span className="mr-2 text-ink-dim">heaviest defeat</span>{gameLine(ext.heaviestDefeat)}</li> : null}
        </ul>
      </Section>

      {months.length > 0 ? (
        <Section id="months-h" title="league points a game, month by month">
          <RungBars
            label="league points a game by month"
            max={3}
            rungs={months.map((m) => ({ label: `${m.label} · ${m.played} game${m.played === 1 ? "" : "s"}`, value: m.ppg, display: m.ppg.toFixed(2), tone: m.ppg >= 2 ? "lead" : m.ppg >= 1.3 ? "dim" : "warn" }))}
          />
          <p className="num mt-2 text-[11.5px] text-ink-dim">promotion pace is about 2.00, mid-table about 1.30</p>
        </Section>
      ) : null}

      {league.length > 0 ? (
        <Section id="runs-h" title="runs">
          <Tiles cols="grid-cols-3" items={[["longest unbeaten", runs.unbeaten], ["longest winning", runs.winning], ["longest without a win", runs.winless]]} />
          {runs.current ? (
            <p className="mt-4 text-[14px] text-ink">
              Right now: {runs.current.kind === "unbeaten" ? "unbeaten" : "without a win"} in <span className="num font-semibold">{runs.current.games}</span> league game{runs.current.games === 1 ? "" : "s"}.
            </p>
          ) : null}
        </Section>
      ) : null}

      {scorers.length > 0 ? (
        <Section id="scorers-h" title="scorers">
          <table className="w-full max-w-[640px] border-collapse">
            <caption className="sr-only">Scorers this season, every competition</caption>
            <thead>
              <tr className="border-b border-line-strong">
                <th scope="col" className={`${KEY} py-1.5 text-left font-normal`}>player</th>
                {["goals", "braces", "hat-tricks", "apps", "a game"].map((h) => (
                  <th key={h} scope="col" className={`${KEY} py-1.5 text-right font-normal`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scorers.map((s) => (
                <tr key={s.name} className="border-b border-line">
                  <th scope="row" className="py-2 text-left text-[13px] font-semibold text-ink">{s.name}</th>
                  <td className="num py-2 text-right text-[13px] font-semibold text-ink tabular-nums">{s.goals}</td>
                  <td className="num py-2 text-right text-[13px] text-ink-dim tabular-nums">{s.braces || "-"}</td>
                  <td className="num py-2 text-right text-[13px] text-ink-dim tabular-nums">{s.hatTricks || "-"}</td>
                  <td className="num py-2 text-right text-[13px] text-ink tabular-nums">{s.apps ?? "-"}</td>
                  <td className="num py-2 text-right text-[13px] text-ink-dim tabular-nums">{s.perGame !== null ? s.perGame.toFixed(2) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="num mt-2 text-[11.5px] text-ink-dim">counted from the result sheets; assists are not on them, so none are shown</p>
        </Section>
      ) : null}

      {mostPlayed.length > 0 ? (
        <Section id="apps-h" title="who has played most">
          <RungBars
            label="appearances"
            rungs={mostPlayed.map((p, i) => ({ label: p.name, value: p.external_stats?.apps ?? 0, display: String(p.external_stats?.apps ?? 0), tone: i === 0 ? "lead" : "dim" }))}
          />
        </Section>
      ) : null}

      {crowds.counted > 0 ? (
        <Section id="crowds-h" title="home crowds">
          <Tiles cols="grid-cols-3" items={[["average", crowds.average], ["best", crowds.best?.attendance ?? "-"], ["lowest", crowds.lowest?.attendance ?? "-"]]} />
          <p className="num mt-2 text-[11.5px] text-ink-dim">
            from {crowds.counted} home games · best v {crowds.best?.opponent}, {crowds.best ? shortDate(crowds.best.match_date) : ""}
          </p>
        </Section>
      ) : null}

      <div className="break-inside-avoid">
        <CupsSection results={(results ?? []) as Result[]} fixtures={(fixtures ?? []) as Fixture[]} asOf={asOf} />
      </div>

      <Section id="inj-h" title="injuries">
        {r.injuries.count === 0 ? (
          <p className="text-[14px] text-ink-dim">None logged. That is not the same as none happening.</p>
        ) : (
          <>
            <Tiles cols="grid-cols-3" items={[["logged", r.injuries.count], ["still out", r.injuries.ongoing], ["player-days lost", r.injuries.daysLost]]} />
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-1.5 text-[14px]">
              {r.injuries.byRegion.map((x) => (
                <li key={x.region} className="text-ink">
                  {REGION_LABEL[x.region]} <span className="num text-ink-dim">× {x.count}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section id="red-h" title="did the load see it coming">
        {r.judged === 0 ? (
          <p className="max-w-[62ch] text-[14px] leading-relaxed text-ink-dim">
            Not enough training was logged before any injury to say. Log four weeks of sessions and this answers the question honestly.
          </p>
        ) : (
          <p className="max-w-[62ch] text-[15px] leading-relaxed text-ink">
            Of <span className="num">{r.judged}</span> injur{r.judged === 1 ? "y" : "ies"} with a load reading the day before, <span className="num font-semibold">{r.redCalled}</span> came straight after a red-zone week.
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
      </Section>
    </main>
  );
}
