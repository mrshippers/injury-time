import Link from "next/link";

import type { SquadRow } from "@/lib/data";
import type { HomeSeason } from "@/lib/home/data";
import type { SeasonContext } from "@/lib/home/season-context";
import { READINESS_TEXT } from "@/lib/readiness";
import type { AvailabilityStatus, Fixture } from "@/lib/types";
import { shortDate } from "@/components/squad/format";

import { HairlineLine, MarkRow, RungBars } from "@/components/charts";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function weekday(iso: string): string {
  return DAY[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

/** One quiet block: a mono label, then whatever the vital is. Spacing does the grouping, not boxes. */
function Vital({ label, aside, children }: { label: string; aside?: React.ReactNode; children: React.ReactNode }) {
  const id = `vital-${label.replace(/[^a-z]+/gi, "-")}`;
  return (
    <section aria-labelledby={id} className="min-w-0 border-t border-line pt-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="annot" id={id}>{`// ${label}`}</p>
        {aside}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function NextMatchVital({ next, daysUntil, fit, calls, squadSize }: { next: Fixture | null; daysUntil: number | null; fit: number; calls: HomeSeason["calls"]; squadSize: number }) {
  const when = daysUntil === null ? "" : daysUntil === 0 ? "today" : daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`;
  return (
    <Vital label="next match" aside={next ? <span className="num text-[11.5px] text-ink-dim">{when}</span> : null}>
      {next ? (
        <div className="flex flex-col gap-2">
          <p className="num text-[12px] tracking-[0.1em] text-gold">
            {weekday(next.match_date).toUpperCase()} {shortDate(next.match_date).toUpperCase()}
            {next.kickoff ? ` · ${next.kickoff}` : ""}
          </p>
          <p className="display text-[28px] leading-none text-ink">
            {next.opponent}
            <span className="ml-2 text-[14px] font-semibold tracking-[0.1em] text-ink-dim">({next.venue})</span>
          </p>
          <p className="text-[12.5px] text-ink-dim">{next.competition}</p>
          <p className="mt-1 text-[12.5px] text-ink-dim">
            <span className="num font-semibold text-ink">{fit}</span> available ·{" "}
            {calls.total === 0 ? (
              <>
                nobody has called yet.{" "}
                <Link href="/team" className="text-mint underline-offset-4 hover:underline">
                  ask the squad
                </Link>
              </>
            ) : (
              <>
                <span className="num font-semibold text-fit">{calls.in}</span> in · <span className="num font-semibold text-out">{calls.out}</span> out ·{" "}
                <span className="num font-semibold text-doubt">{calls.unsure}</span> unsure · {Math.max(0, squadSize - calls.total)} quiet
              </>
            )}
          </p>
          <Link href="/squad" className="pressable mt-1 self-start text-[12.5px] font-semibold text-mint">
            pick the side
          </Link>
        </div>
      ) : (
        <p className="text-[12.5px] text-ink-dim">No fixture in the diary. The next match is what everything on this page is for.</p>
      )}
    </Vital>
  );
}

export function FormVital({ ctx, results }: { ctx: SeasonContext; results: HomeSeason["results"] }) {
  const homeCrowds = results.filter((r) => r.venue === "H" && r.attendance !== null).map((r, i) => ({ x: i + 1, y: r.attendance as number, label: `${r.attendance} v ${r.opponent}, ${shortDate(r.match_date)}` }));
  const last = homeCrowds.at(-1);
  const prev = homeCrowds.at(-2);
  const against = Boolean(last && prev && last.y < prev.y);
  const maxCrowd = Math.max(1, ...homeCrowds.map((c) => c.y));
  return (
    <Vital label="form" aside={ctx.hasSeason ? <span className="num text-[11.5px] text-ink-dim">{`${ctx.won}w ${ctx.drawn}d ${ctx.lost}l · ${ctx.gf}:${ctx.ga}`}</span> : null}>
      <MarkRow label="last six league games, oldest first" marks={ctx.form.map((f) => ({ result: f.result, title: `${f.score} ${f.venue === "A" ? "at" : "v"} ${f.opponent}, ${shortDate(f.date)}` }))} />
      {homeCrowds.length >= 2 ? (
        <div className="mt-4">
          <p className="text-[10.5px] tracking-[0.14em] uppercase text-ink-dim">home crowd</p>
          <HairlineLine
            title={`home attendances, latest ${last?.y}`}
            series={[{ points: homeCrowds, rank: 1, reading: `${last?.y}`, against }]}
            xDomain={[1, Math.max(2, homeCrowds.length)]}
            yDomain={[0, Math.ceil(maxCrowd / 50) * 50 + 10]}
            yTicks={[Math.ceil(maxCrowd / 50) * 50]}
            width={300}
            height={80}
            readingWidth={54}
            className="mt-1"
          />
          <p className="mt-1 text-[11.5px] text-ink-dim">{against ? "down on the last home game" : "up on the last home game"} · {last?.label.split(",")[0]}</p>
        </div>
      ) : null}
    </Vital>
  );
}

export function ScorersVital({ feed, logged, feedAsOf }: { feed: HomeSeason["feedScorers"]; logged: SquadRow[]; feedAsOf: string | null }) {
  const rungs =
    feed.length > 0
      ? feed.map((f, i) => ({ label: f.player.name, value: f.goals, display: `${f.goals}`, tone: (i === 0 ? "lead" : "dim") as "lead" | "dim" }))
      : logged.map((r, i) => ({ label: r.player.name, value: r.stats.goals, display: `${r.stats.goals}`, tone: (i === 0 ? "lead" : "dim") as "lead" | "dim" }));
  return (
    <Vital label="goals" aside={<span className="num text-[11.5px] text-ink-dim">{feed.length > 0 ? `league feed${feedAsOf ? `, ${shortDate(feedAsOf)}` : ""}` : "match log"}</span>}>
      {rungs.length === 0 ? <p className="text-[12.5px] text-ink-dim">No goals on record yet.</p> : <RungBars label="top scorers" rungs={rungs} />}
    </Vital>
  );
}

const STATUS_LABEL: Record<AvailabilityStatus, string> = { fit: "available", doubt: "doubt", injured: "out", suspended: "suspended" };

export function WatchVital({ rows, hasLoad, backSoon }: { rows: SquadRow[]; hasLoad: boolean; backSoon: SquadRow[] }) {
  return (
    <Vital label="watch before you pick" aside={backSoon.length > 0 ? <span className="num text-[11.5px] text-ink-dim">{backSoon.length} back this week</span> : null}>
      {!hasLoad ? (
        <p className="max-w-[44ch] text-[12.5px] leading-snug text-ink-dim">
          No training logged yet, so nobody has a reading. Readiness starts four weeks after the first session.{" "}
          <Link href="/log" className="text-mint underline-offset-4 hover:underline">
            log tuesday
          </Link>
          .
        </p>
      ) : rows.length === 0 ? (
        <p className="text-[12.5px] text-ink-dim">Nobody is carrying a load flag. Pick on form.</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((r) => (
            <li key={r.player.id} className="border-b border-line py-2 last:border-b-0">
              <Link href={`/player/${r.player.id}`} className="pressable group flex items-baseline gap-3">
                <span className="num w-5 shrink-0 text-right text-[11.5px] text-ink-dim">{r.player.squad_number ?? ""}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink group-hover:text-mint">{r.player.name}</span>
                  <span className="block text-[11.5px] leading-snug text-ink-dim">{r.readiness.gloss}</span>
                </span>
                <span className={`num shrink-0 text-[11px] font-semibold tracking-[0.08em] ${READINESS_TEXT[r.readiness.key]}`}>{r.readiness.word.toUpperCase()}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {backSoon.length > 0 ? (
        <ul className="mt-3 flex flex-col border-t border-line pt-2">
          {backSoon.map((r) => (
            <li key={r.player.id} className="flex items-baseline justify-between gap-3 py-1 text-[12px]">
              <span className="truncate text-ink">{r.player.name}</span>
              <span className="num shrink-0 text-ink-dim">
                {STATUS_LABEL[r.availability!.status]} · back {shortDate(r.availability!.return_date!)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Vital>
  );
}
