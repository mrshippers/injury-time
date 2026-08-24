import Link from "next/link";

import type { SquadRow } from "@/lib/data";
import { READINESS_TEXT } from "@/lib/readiness";
import type { Fixture } from "@/lib/types";
import { shortDate } from "@/components/squad/format";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** `2026-08-28` -> `Fri`. Date-only arithmetic in UTC, never a local Date. */
function weekday(iso: string): string {
  return DAY[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

function Panel({
  label,
  children,
  aside,
}: {
  label: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  const id = `panel-${label.replace(/[^a-z]+/gi, "-")}`;
  return (
    <section aria-labelledby={id} className="flex min-h-[172px] flex-col border border-line bg-panel px-5 py-4">
      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
        <p className="annot" id={id}>{`// ${label}`}</p>
        {aside}
      </div>
      <div className="mt-3 flex-1">{children}</div>
    </section>
  );
}

export function NextMatchPanel({
  fixtures,
  daysUntil,
  fitCount,
}: {
  fixtures: Fixture[];
  daysUntil: number | null;
  fitCount: number;
}) {
  const next = fixtures[0];
  return (
    <Panel
      label="next match"
      aside={
        next ? (
          <span className="num text-[11.5px] text-ink-dim">
            {daysUntil === 0 ? "today" : daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`}
          </span>
        ) : null
      }
    >
      {next ? (
        <div className="flex h-full flex-col justify-between gap-3">
          <div>
            <p className="num text-[12px] tracking-[0.1em] text-gold">
              {weekday(next.match_date).toUpperCase()} {shortDate(next.match_date).toUpperCase()}
              {next.kickoff ? ` · ${next.kickoff}` : ""}
            </p>
            <p className="display mt-1.5 text-[26px] leading-none text-ink">
              {next.opponent}
              <span className="ml-2 text-[15px] font-semibold tracking-[0.1em] text-ink-dim">
                ({next.venue})
              </span>
            </p>
            <p className="mt-1.5 text-[12.5px] text-ink-dim">{next.competition}</p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12.5px] text-ink-dim">
              <span className="num font-semibold text-ink">{fitCount}</span> available today
            </p>
            <Link href="/lineup" className="pressable text-[12.5px] font-semibold text-mint">
              pick the side →
            </Link>
          </div>
          {fixtures.length > 1 ? (
            <ul className="border-t border-line pt-2">
              {fixtures.slice(1).map((f) => (
                <li key={f.id} className="flex items-baseline justify-between text-[11.5px] text-ink-dim">
                  <span className="num">{weekday(f.match_date)} {shortDate(f.match_date)}</span>
                  <span className="truncate pl-3">
                    {f.opponent} ({f.venue})
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-ink-dim">No fixtures in the diary. Add the next match to see who is available for it.</p>
      )}
    </Panel>
  );
}

export function WatchListPanel({ rows }: { rows: SquadRow[] }) {
  return (
    <Panel label="watch before you pick">
      {rows.length === 0 ? (
        <p className="text-sm text-ink-dim">Nobody is carrying a load flag. Pick on form.</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((r) => (
            <li key={r.player.id} className="border-b border-line py-2 last:border-b-0">
              <Link href={`/player/${r.player.id}`} className="pressable group flex items-baseline gap-3">
                <span className="num w-5 shrink-0 text-right text-[11.5px] text-ink-dim">
                  {r.player.squad_number ?? ""}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink group-hover:text-mint">
                    {r.player.name}
                  </span>
                  <span className="block truncate text-[11.5px] leading-snug text-ink-dim">
                    {r.readiness.gloss}
                  </span>
                </span>
                <span className={`num shrink-0 text-[11px] font-semibold tracking-[0.08em] ${READINESS_TEXT[r.readiness.key]}`}>
                  {r.readiness.word.toUpperCase()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function BackSoonPanel({ rows, outCount }: { rows: SquadRow[]; outCount: number }) {
  return (
    <Panel
      label="treatment room"
      aside={<span className="num text-[11.5px] text-ink-dim">{outCount} unavailable</span>}
    >
      {rows.length === 0 ? (
        <p className="text-sm text-ink-dim">
          {outCount === 0 ? "Everyone is available." : "Nobody is due back this week."}
        </p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((r) => {
            const a = r.availability!;
            return (
              <li key={r.player.id} className="border-b border-line py-2 last:border-b-0">
                <Link href={`/player/${r.player.id}`} className="pressable group flex items-baseline gap-3">
                  <span className="num w-5 shrink-0 text-right text-[11.5px] text-ink-dim">
                    {r.player.squad_number ?? ""}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink group-hover:text-mint">
                    {r.player.name}
                  </span>
                  <span className="num shrink-0 text-[11.5px] text-ink-dim">
                    back {weekday(a.return_date!)} {shortDate(a.return_date!)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
