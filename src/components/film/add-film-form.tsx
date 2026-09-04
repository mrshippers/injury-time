"use client";

import { useActionState, useId, useMemo, useState } from "react";

import { addFilmAction, type AddFilmResult } from "@/lib/film/actions";
import { parseFilmUrl } from "@/lib/film/urls";
import type { Fixture, Result } from "@/lib/types";

const FIELD =
  "w-full rounded-[2px] border border-line-strong bg-pitch px-2.5 py-2 text-[13px] text-ink [color-scheme:dark] placeholder:text-ink-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint focus-visible:-outline-offset-1";
const LABEL = "block text-[10.5px] tracking-[0.14em] uppercase text-ink-dim";

function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(d)} ${months[Number(m) - 1]} ${y.slice(2)}`;
}

/**
 * Paste a link, name it, say which game it was. The game picker carries both
 * fixtures to come and results already in, so film of last Saturday attaches
 * to the score and film of the next opponent attaches to the fixture.
 */
export function AddFilmForm({ fixtures, results }: { fixtures: Fixture[]; results: Result[] }) {
  const id = useId();
  const [state, action, pending] = useActionState<AddFilmResult | null, FormData>(addFilmAction, null);
  const [url, setUrl] = useState("");
  const [game, setGame] = useState("");
  const parsed = useMemo(() => parseFilmUrl(url), [url]);

  // "r:<index>" is a result, "f:<id>" a fixture; the hidden fields carry what the action needs
  const chosenResult = game.startsWith("r:") ? results[Number(game.slice(2))] : null;
  const chosenFixture = game.startsWith("f:") ? fixtures.find((f) => f.id === game.slice(2)) ?? null : null;

  return (
    <form action={action} className="border border-line bg-panel px-5 py-4" aria-labelledby={`${id}-h`}>
      <p className="annot" id={`${id}-h`}>{"// add film"}</p>

      <label className={`${LABEL} mt-4`} htmlFor={`${id}-url`}>link</label>
      <input
        id={`${id}-url`}
        name="url"
        type="url"
        required
        inputMode="url"
        autoComplete="off"
        placeholder="https://app.veo.co/matches/… or youtube.com/watch?v=…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className={`${FIELD} num mt-1`}
      />
      <p className="num mt-1 min-h-[16px] text-[11px] text-ink-dim" aria-live="polite">
        {url.trim() === "" ? "" : parsed ? `${parsed.source}${parsed.embedUrl ? ", plays here" : parsed.source === "veo" ? ", kept as a link" : ""}` : "not a link we can read"}
      </p>

      <label className={`${LABEL} mt-3`} htmlFor={`${id}-title`}>title</label>
      <input id={`${id}-title`} name="title" required maxLength={120} placeholder="second half v Wembley" className={`${FIELD} mt-1`} />

      <label className={`${LABEL} mt-3`} htmlFor={`${id}-game`}>game</label>
      <select id={`${id}-game`} value={game} onChange={(e) => setGame(e.target.value)} className={`${FIELD} num mt-1`}>
        <option value="">not attached</option>
        {results.length > 0 ? (
          <optgroup label="results">
            {results.map((r, i) => (
              <option key={r.id} value={`r:${i}`}>
                {shortDate(r.match_date)} · {r.goals_for}-{r.goals_against} v {r.opponent} ({r.venue})
              </option>
            ))}
          </optgroup>
        ) : null}
        {fixtures.length > 0 ? (
          <optgroup label="fixtures">
            {fixtures.map((f) => (
              <option key={f.id} value={`f:${f.id}`}>
                {shortDate(f.match_date)} · v {f.opponent} ({f.venue})
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>
      <input type="hidden" name="fixture_id" value={chosenFixture?.id ?? ""} />
      <input type="hidden" name="match_date" value={chosenResult?.match_date ?? chosenFixture?.match_date ?? ""} />
      <input type="hidden" name="opponent" value={chosenResult?.opponent ?? chosenFixture?.opponent ?? ""} />

      {state && !state.ok ? (
        <p role="alert" className="mt-3 text-[12.5px] text-out">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !parsed}
        className="pressable mt-4 h-9 w-full rounded-[2px] bg-mint text-[12px] font-bold uppercase tracking-[0.12em] text-mint-ink disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint"
      >
        {pending ? "adding" : "add to the room"}
      </button>
    </form>
  );
}
