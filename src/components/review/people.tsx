"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { PlateTabs } from "@/components/ui/plate-tabs";
import { shortDate } from "@/components/squad/format";
import { tenureWord, type PlayerReviewRow, type StaffReviewRow } from "@/lib/review/people";
import type { Position } from "@/lib/types";

const KEY = "text-[11px] uppercase tracking-[0.12em] text-ink-dim";
const CELL = "num py-1.5 text-right text-[13px] tabular-nums";

type Who = "players" | "staff";

/**
 * Second page of the review: one row per person, using only what the club
 * logged. Columns sort. Where the data has no value the cell shows a dash and
 * the footnote says why.
 */
export function PeopleReview({ players, staff, asOf }: { players: PlayerReviewRow[]; staff: StaffReviewRow[]; asOf: string }) {
  const [who, setWho] = useState<Who>("players");
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PlateTabs label="who" items={[{ key: "players", label: `players · ${players.length}` }, { key: "staff", label: `staff · ${staff.length}` }]} active={who} onChange={setWho} size="sm" />
        <p className="num text-[11.5px] text-ink-dim">to {shortDate(asOf)}</p>
      </div>
      <div className="mt-4 overflow-x-auto">{who === "players" ? <Players rows={players} /> : <Staff rows={staff} />}</div>
    </div>
  );
}

type PKey = "name" | "position" | "apps" | "starts" | "minutes" | "goals" | "assists" | "yellow" | "red" | "injuries" | "daysOut";
const PCOLS: { key: PKey; label: string; title: string; left?: boolean }[] = [
  { key: "name", label: "name", title: "", left: true },
  { key: "position", label: "pos", title: "position", left: true },
  { key: "apps", label: "pl", title: "appearances" },
  { key: "starts", label: "st", title: "starts: 60 minutes or more, from the match log" },
  { key: "minutes", label: "min", title: "minutes, from the match log" },
  { key: "goals", label: "g", title: "goals" },
  { key: "assists", label: "a", title: "assists, from the match log" },
  { key: "yellow", label: "y", title: "yellow cards, from the match log" },
  { key: "red", label: "r", title: "red cards, from the match log" },
  { key: "injuries", label: "inj", title: "injury spells this season" },
  { key: "daysOut", label: "days out", title: "days injured this season, an open spell counted to today" },
];
const POS_ORDER: Record<Position, number> = { GK: 0, DF: 1, MF: 2, FW: 3 };

function Players({ rows }: { rows: PlayerReviewRow[] }) {
  const [sort, setSort] = useState<{ key: PKey; dir: "asc" | "desc" }>({ key: "apps", dir: "desc" });
  const [pos, setPos] = useState<Position | "all">("all");
  const sorted = useMemo(() => {
    const list = rows.filter((r) => pos === "all" || r.position === pos);
    const val = (r: PlayerReviewRow) => {
      const v = r[sort.key];
      if (sort.key === "position") return v ? POS_ORDER[v as Position] : 9;
      if (typeof v === "string") return v.toLowerCase();
      return v ?? -1;
    };
    return list.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      const c = typeof x === "string" && typeof y === "string" ? x.localeCompare(y) : Number(x) - Number(y);
      return (sort.dir === "asc" ? c : -c) || a.name.localeCompare(b.name);
    });
  }, [rows, sort, pos]);
  const unlogged = rows.filter((r) => r.source !== "log").length;
  const toggle = (key: PKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" || key === "position" ? "asc" : "desc" }));
  const dash = <span className="text-ink-faint">–</span>;
  const n = (v: number | null, dim = false) => (v === null ? dash : <span className={v === 0 ? "text-ink-faint" : dim ? "text-ink-dim" : "text-ink"}>{v}</span>);
  return (
    <div>
      <div role="group" aria-label="position" className="mb-2 flex">
        {(["all", "GK", "DF", "MF", "FW"] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={pos === p}
            onClick={() => setPos(p)}
            className={`pressable plate plate-sm num h-7 text-[11px] font-semibold tracking-[0.06em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mint ${
              pos === p ? "bg-panel-2 text-ink shadow-[inset_0_-2px_0_var(--mint)]" : "text-ink-dim hover:text-ink"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <table className="w-full min-w-[640px] border-collapse">
        <caption className="sr-only">Every player&apos;s season: appearances, starts, minutes, goals, assists, cards and injuries</caption>
        <thead>
          <tr className="border-b border-line-strong">
            {PCOLS.map((c) => (
              <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={`${KEY} py-1.5 font-normal ${c.left ? "text-left" : "text-right"}`}>
                <button type="button" onClick={() => toggle(c.key)} title={c.title || undefined} className={`pressable inline-flex items-center gap-1 uppercase max-sm:min-h-0 max-sm:min-w-0 ${sort.key === c.key ? "text-ink" : ""}`}>
                  {c.label}
                  <span aria-hidden className="text-[9px]">{sort.key === c.key ? (sort.dir === "asc" ? "▲" : "▼") : "▵"}</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className="border-b border-line">
              <th scope="row" className="py-1.5 pr-3 text-left text-[13px] font-semibold text-ink">
                <Link href={`/player/${r.id}`} className="pressable inline-flex items-baseline gap-2 max-sm:min-h-0">
                  <span className="num w-5 text-right text-[11px] font-normal text-ink-dim">{r.number ?? ""}</span>
                  <span className="truncate">{r.name}</span>
                </Link>
              </th>
              <td className="num py-1.5 text-left text-[12px] tracking-[0.06em] text-ink-dim">{r.position ?? dash}</td>
              <td className={CELL}>{n(r.apps)}</td>
              <td className={CELL}>{n(r.starts)}</td>
              <td className={CELL}>{n(r.minutes, true)}</td>
              <td className={CELL}>{n(r.goals)}</td>
              <td className={CELL}>{n(r.assists)}</td>
              <td className={CELL}>{n(r.yellow)}</td>
              <td className={`${CELL} ${r.red ? "text-out" : ""}`}>{r.red ? r.red : n(r.red)}</td>
              <td className={CELL}>{n(r.injuries)}</td>
              <td className={CELL}>{n(r.daysOut, true)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11.5px] text-ink-dim">
        Pl and g use the match log, or the league feed where none is logged. St, min, a, y and r use the match log only
        {unlogged > 0 ? `; ${unlogged} of ${rows.length} players have no logged match and show a dash` : ""}. Inj counts recorded spells. Days out runs to the return date, or to today if the spell is open.
      </p>
    </div>
  );
}

const ROLE_WORD: Record<StaffReviewRow["role"], string> = { manager: "manager", coach: "coach", medical: "medical", other: "staff" };

function Staff({ rows }: { rows: StaffReviewRow[] }) {
  if (rows.length === 0) {
    return <p className="max-w-[52ch] text-[13.5px] leading-snug text-ink-dim">No staff recorded. Add them on the club page.</p>;
  }
  return (
    <div>
      <table className="w-full min-w-[480px] border-collapse">
        <caption className="sr-only">Every member of staff: title, role and time in post</caption>
        <thead>
          <tr className="border-b border-line-strong">
            <th scope="col" className={`${KEY} py-1.5 text-left font-normal`}>name</th>
            <th scope="col" className={`${KEY} py-1.5 text-left font-normal`}>title</th>
            <th scope="col" className={`${KEY} py-1.5 text-left font-normal`}>role</th>
            <th scope="col" className={`${KEY} py-1.5 text-right font-normal`}>since</th>
            <th scope="col" className={`${KEY} py-1.5 text-right font-normal`} title="time in post, to today or the day they left">in post</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={`border-b border-line ${r.left_on ? "text-ink-dim" : ""}`}>
              <th scope="row" className="py-1.5 pr-3 text-left text-[13px] font-semibold text-ink">
                {r.name}
                {r.left_on ? <span className="num ml-2 text-[10.5px] font-normal uppercase tracking-[0.1em] text-ink-dim">left {shortDate(r.left_on)}</span> : null}
              </th>
              <td className="py-1.5 pr-3 text-left text-[13px] text-ink">{r.title}</td>
              <td className="num py-1.5 pr-3 text-left text-[11.5px] uppercase tracking-[0.08em] text-ink-dim">{ROLE_WORD[r.role]}</td>
              <td className={`${CELL} text-ink-dim`}>{shortDate(r.joined_on)}</td>
              <td className={`${CELL} text-ink`}>{tenureWord(r.tenureDays)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11.5px] text-ink-dim">Time in post runs from the start date to today, or to the day they left.</p>
    </div>
  );
}
