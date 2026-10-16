"use client";

/**
 * The club's two data forms: connect its own league feed, and enter a result
 * by hand. Both are server actions that re-check every field and every role.
 */
import { useState, useTransition } from "react";

import { addResultAction, removeFeedKeyAction, saveFeedKeyAction, type ActionState } from "@/lib/club/actions";

const FIELD =
  "num h-10 border border-line-strong bg-panel px-2 text-[13px] text-ink [color-scheme:dark] placeholder:text-ink-faint focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-mint disabled:opacity-50";
const LABEL = "text-[11px] tracking-[0.12em] uppercase text-ink-dim";
const PRIMARY =
  "pressable h-10 rounded-[2px] bg-mint px-4 text-[12px] font-bold uppercase tracking-[0.12em] text-mint-ink disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint";
const GHOST =
  "pressable h-10 rounded-[2px] border border-line-strong bg-pitch px-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-dim hover:text-ink disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint";

function Outcome({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <p role="status" className={`mt-3 text-[13px] ${state.ok ? "text-ink" : "text-doubt"}`}>
      <span className="num mr-2 text-[11px] tracking-[0.12em] uppercase">{state.ok ? "done" : "not done"}</span>
      {state.message}
    </p>
  );
}

export function FeedKeyForm({ connected, allowed, reason }: { connected: boolean; allowed: boolean; reason: string | null }) {
  const [apiKey, setApiKey] = useState("");
  const [teamId, setTeamId] = useState("");
  const [state, setState] = useState<ActionState>(null);
  const [pending, start] = useTransition();

  return (
    <form
      aria-label="connect the league feed"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveFeedKeyAction({ apiKey, teamId });
          setState(res);
          if (res?.ok) setApiKey("");
        });
      }}
      className="mt-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className={LABEL}>the club&apos;s api key</span>
          <input
            className={`${FIELD} w-full min-w-[220px]`}
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={!allowed || pending}
            placeholder={connected ? "connected; paste a new key to replace it" : "from Football Web Pages"}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>team id</span>
          <input className={`${FIELD} w-28`} inputMode="numeric" value={teamId} onChange={(e) => setTeamId(e.target.value)} disabled={!allowed || pending} placeholder="e.g. 1234" />
        </label>
        <button type="submit" className={PRIMARY} disabled={!allowed || pending || !apiKey || !teamId}>
          {pending ? "checking" : "connect"}
        </button>
        {connected && allowed ? (
          <button type="button" className={GHOST} disabled={pending} onClick={() => start(async () => setState(await removeFeedKeyAction()))}>
            disconnect
          </button>
        ) : null}
      </div>
      {!allowed && reason ? <p className="mt-3 text-[13px] text-ink-dim">{reason}</p> : null}
      <Outcome state={state} />
    </form>
  );
}

export type Awaiting = { match_date: string; opponent: string; venue: "H" | "A"; competition: string };

export function ResultForm({ allowed, reason, today, awaiting = [] }: { allowed: boolean; reason: string | null; today: string; awaiting?: Awaiting[] }) {
  // the game that is waiting for its score is already in the diary: the form opens on it
  const first = awaiting[0];
  const [f, setF] = useState({ matchDate: first?.match_date ?? today, opponent: first?.opponent ?? "", venue: first?.venue ?? "H", competition: first?.competition ?? "", goalsFor: "", goalsAgainst: "", scorers: "" });
  const [state, setState] = useState<ActionState>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  return (
    <form
      aria-label="enter a result"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await addResultAction(f);
          setState(res);
          if (res?.ok) setF((s) => ({ ...s, opponent: "", goalsFor: "", goalsAgainst: "", scorers: "" }));
        });
      }}
      className="mt-4"
    >
      {awaiting.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="games waiting for a result">
          <span className={LABEL}>waiting for a score</span>
          {awaiting.map((a) => {
            const on = f.matchDate === a.match_date && f.opponent === a.opponent;
            return (
              <button
                key={`${a.match_date}-${a.opponent}`}
                type="button"
                aria-pressed={on}
                disabled={!allowed || pending}
                onClick={() => setF((s) => ({ ...s, matchDate: a.match_date, opponent: a.opponent, venue: a.venue, competition: a.competition, goalsFor: "", goalsAgainst: "" }))}
                className={`pressable num h-9 plate plate-sm px-3 text-[12px] ${on ? "border-mint text-mint" : "border-line-strong text-ink-dim hover:text-ink"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint`}
              >
                {a.venue === "A" ? "at" : "v"} {a.opponent} · {a.match_date.slice(5)}
              </button>
            );
          })}
        </div>
      ) : null}
      <fieldset disabled={!allowed || pending} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>date</span>
          <input className={`${FIELD} w-40`} type="date" max={today} value={f.matchDate} onChange={set("matchDate")} required />
        </label>
        <label className="flex min-w-[180px] flex-1 flex-col gap-1.5">
          <span className={LABEL}>opposition</span>
          <input className={FIELD} value={f.opponent} onChange={set("opponent")} required minLength={2} maxLength={80} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>where</span>
          <select className={`${FIELD} w-24`} value={f.venue} onChange={set("venue")}>
            <option value="H">home</option>
            <option value="A">away</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>us</span>
          <input className={`${FIELD} w-16 text-center`} inputMode="numeric" value={f.goalsFor} onChange={set("goalsFor")} required />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>them</span>
          <input className={`${FIELD} w-16 text-center`} inputMode="numeric" value={f.goalsAgainst} onChange={set("goalsAgainst")} required />
        </label>
        <label className="flex min-w-[160px] flex-1 flex-col gap-1.5">
          <span className={LABEL}>competition</span>
          <input className={FIELD} value={f.competition} onChange={set("competition")} placeholder="league" maxLength={80} />
        </label>
        <label className="flex w-full flex-col gap-1.5">
          <span className={LABEL}>scorers</span>
          <input className={FIELD} value={f.scorers} onChange={set("scorers")} placeholder="Ashworth 2, Lindqvist" />
        </label>
        <button type="submit" className={PRIMARY}>
          {pending ? "saving" : "save the result"}
        </button>
      </fieldset>
      {!allowed && reason ? <p className="mt-3 text-[13px] text-ink-dim">{reason}</p> : null}
      <Outcome state={state} />
    </form>
  );
}
