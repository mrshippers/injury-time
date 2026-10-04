"use client";

/**
 * The squad from the league's appearance list. New names come in; names
 * already in the squad are left as the manager set them; a near miss
 * ("Daniel Flynn" in the feed, "Danny Flynn" in the squad) waits here for a
 * person to say same player or new, because no rule can tell a typo from a
 * different man (scripts/grid-squad-match.ts).
 */
import { useState, useTransition } from "react";

import { importSquadFromFeedAction, resolveImportAction, type ImportOutcome } from "@/lib/squad/feed-import";

const PRIMARY =
  "pressable h-10 rounded-[2px] bg-mint px-4 text-[12px] font-bold uppercase tracking-[0.12em] text-mint-ink disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint";
const GHOST =
  "pressable h-9 rounded-[2px] border border-line-strong bg-pitch px-3 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink-dim hover:text-ink disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint";

type Held = Extract<ImportOutcome, { ok: true }>["review"][number];

export function FeedSquad({ allowed, reason }: { allowed: boolean; reason: string | null }) {
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [held, setHeld] = useState<Held[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [pending, start] = useTransition();

  const settle = (h: Held, samePlayerId: string | null) =>
    start(async () => {
      const r = await resolveImportAction({ feedName: h.feedName, apps: h.apps, samePlayerId });
      setNotes((n) => [...n, r.message]);
      if (r.ok) setHeld((list) => list.filter((x) => x.feedName !== h.feedName));
    });

  return (
    <div className="mt-4">
      <button
        type="button"
        className={PRIMARY}
        disabled={!allowed || pending}
        onClick={() =>
          start(async () => {
            const r = await importSquadFromFeedAction();
            setOutcome(r);
            setHeld(r.ok ? r.review : []);
            setNotes([]);
          })
        }
      >
        {pending ? "reading the feed" : "build the squad from the feed"}
      </button>
      {!allowed && reason ? <p className="mt-3 text-[13px] text-ink-dim">{reason}</p> : null}
      {outcome ? (
        <p role="status" className={`mt-3 text-[13px] ${outcome.ok ? "text-ink" : "text-doubt"}`}>
          {outcome.message}
        </p>
      ) : null}
      {held.length ? (
        <ul className="mt-4 border-t border-line" aria-label="names to check">
          {held.map((h) => (
            <li key={h.feedName} className="flex flex-wrap items-center gap-3 border-b border-line py-3 text-[14px]">
              <span className="min-w-[10rem] flex-1 text-ink">
                {h.feedName}
                <span className="num ml-2 text-[12px] text-ink-dim">{h.apps} apps in the feed</span>
              </span>
              {h.looksLike.map((p) => (
                <button key={p.id} type="button" className={GHOST} disabled={pending} onClick={() => settle(h, p.id)}>
                  same as {p.name}
                </button>
              ))}
              <button type="button" className={GHOST} disabled={pending} onClick={() => settle(h, null)}>
                a new player
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {notes.length ? <p className="mt-3 text-[12.5px] text-ink-dim">{notes.join(" · ")}</p> : null}
    </div>
  );
}
