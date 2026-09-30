"use client";

/**
 * The hub's three interactive bits: the player's own edit form, their call
 * for the next match, and a copy-the-link share. The call's state is carried
 * by the word and a filled square, never by colour alone.
 */
import { useState, useTransition } from "react";

import { saveHubAction, type HubState } from "@/lib/hub/actions";
import { mintClaimAction } from "@/lib/hub/claim";
import { POSITION_WORD, type Moment } from "@/lib/hub/hub";
import { setCallAction } from "@/lib/team/actions";
import { CALL_STATUSES, FEET, HUB_POSITIONS, type CallStatus, type HubProfile } from "@/lib/types";

const FIELD =
  "h-10 w-full border border-line-strong bg-panel px-2.5 text-[14px] text-ink [color-scheme:dark] placeholder:text-ink-faint focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-mint";
const LABEL = "text-[11px] tracking-[0.12em] uppercase text-ink-dim";
const PRIMARY =
  "pressable h-10 rounded-[2px] bg-mint px-4 text-[12px] font-bold uppercase tracking-[0.12em] text-mint-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint";
const GHOST =
  "pressable h-10 rounded-[2px] border border-line-strong px-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-dim hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint";


function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className={LABEL}>{label}</span>
      {children}
      {hint ? <span className="text-[11.5px] text-ink-faint">{hint}</span> : null}
    </label>
  );
}

export function HubEditor({ playerId, profile, moments, startOpen }: { playerId: string; profile: HubProfile | null; moments: Moment[]; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const [state, setState] = useState<HubState>(null);
  const [pending, start] = useTransition();
  const [v, setV] = useState({
    nickname: profile?.nickname ?? "",
    shirtName: profile?.shirt_name ?? "",
    foot: profile?.preferred_foot ?? "",
    position: profile?.best_position ?? "",
    song: profile?.walkout_song ?? "",
    boots: profile?.boots ?? "",
    hero: profile?.hero ?? "",
    previousClubs: (profile?.previous_clubs ?? []).join(", "),
    bio: profile?.bio ?? "",
    pinned: profile?.pinned ? `${profile.pinned.clip_id}@${profile.pinned.t}` : "",
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  if (!open)
    return (
      <button type="button" className={GHOST} onClick={() => setOpen(true)}>
        edit my page
      </button>
    );

  return (
    <form
      aria-label="edit my page"
      className="border border-line-strong bg-panel/60 p-4 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => setState(await saveHubAction(playerId, v)));
      }}
    >
      <p className="annot">{"// your page, your words. football only: injuries live with the physio, not here"}</p>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="what the lads call you">
          <input className={FIELD} maxLength={24} value={v.nickname} onChange={set("nickname")} placeholder="Jonno" />
        </Field>
        <Field label="name on the back of the shirt">
          <input className={`${FIELD} uppercase`} maxLength={14} value={v.shirtName} onChange={set("shirtName")} placeholder="JONNO" />
        </Field>
        <Field label="where you want to play">
          <select className={FIELD} value={v.position} onChange={set("position")}>
            <option value="">not saying</option>
            {HUB_POSITIONS.map((p) => (
              <option key={p} value={p}>
                {POSITION_WORD[p]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="stronger foot">
          <select className={FIELD} value={v.foot} onChange={set("foot")}>
            <option value="">not saying</option>
            {FEET.map((f) => (
              <option key={f} value={f}>
                {f === "both" ? "both, honestly" : f}
              </option>
            ))}
          </select>
        </Field>
        <Field label="walk-out song">
          <input className={FIELD} maxLength={60} value={v.song} onChange={set("song")} placeholder="artist, track" />
        </Field>
        <Field label="boots">
          <input className={FIELD} maxLength={40} value={v.boots} onChange={set("boots")} placeholder="the pair you swear by" />
        </Field>
        <Field label="the player you grew up on">
          <input className={FIELD} maxLength={40} value={v.hero} onChange={set("hero")} />
        </Field>
        <Field label="clubs before this one" hint="oldest first, commas between, up to eight">
          <input className={FIELD} maxLength={400} value={v.previousClubs} onChange={set("previousClubs")} placeholder="Sunday side, youth club, last season's" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="about you" hint={`${v.bio.length} of 200`}>
            <textarea className={`${FIELD} h-24 py-2`} maxLength={200} value={v.bio} onChange={set("bio")} placeholder="how you play, in a line or two" />
          </Field>
        </div>
        {moments.length ? (
          <div className="sm:col-span-2">
            <Field label="the moment at the top of your page">
              <select className={FIELD} value={v.pinned} onChange={set("pinned")}>
                <option value="">none</option>
                {moments.map((m) => (
                  <option key={`${m.clipId}@${m.t}`} value={`${m.clipId}@${m.t}`}>
                    {`${m.kind.replace("_", " ")} · ${m.title}`}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : null}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" className={PRIMARY} disabled={pending}>
          {pending ? "saving" : "save my page"}
        </button>
        <button type="button" className={GHOST} onClick={() => setOpen(false)}>
          close
        </button>
        {state ? (
          <p role="status" className={`text-[13px] ${state.ok ? "text-ink" : "text-doubt"}`}>
            <span className="num mr-2 text-[11px] tracking-[0.12em] uppercase">{state.ok ? "saved" : "not saved"}</span>
            {state.ok ? null : state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function HubCall({ fixtureId, playerId, initial }: { fixtureId: string; playerId: string; initial: CallStatus | null }) {
  const [call, setCall] = useState<CallStatus | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <div role="group" aria-label="your call for this match" className="grid grid-cols-3 gap-2">
        {CALL_STATUSES.map((s) => {
          const on = call === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const prev = call;
                  setCall(s);
                  const r = await setCallAction({ fixtureId, playerId, status: s });
                  if (!r.ok) {
                    setCall(prev);
                    setError(r.error);
                  } else setError(null);
                })
              }
              className={`pressable flex h-12 items-center justify-center gap-2 rounded-[2px] border text-[13px] font-bold uppercase tracking-[0.12em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint ${
                on ? "border-ink bg-ink text-pitch" : "border-line-strong text-ink-dim hover:text-ink"
              }`}
            >
              <span aria-hidden className={`inline-block h-2.5 w-2.5 ${on ? "bg-pitch" : "border border-current"}`} />
              {s}
            </button>
          );
        })}
      </div>
      {error ? <p role="alert" className="mt-2 text-[13px] text-doubt">{error}</p> : null}
    </div>
  );
}

export function ShareLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={GHOST}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "link copied" : "copy my link"}
    </button>
  );
}

/** Manager or coach: make the link that hands this page to the player. A new link kills the old one. */
export function HandOver({ playerId, firstName }: { playerId: string; firstName: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={PRIMARY}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await mintClaimAction(playerId);
              if (r.ok) {
                setLink(new URL(r.path, window.location.origin).toString());
                setError(null);
              } else setError(r.error);
            })
          }
        >
          {pending ? "making it" : link ? "make a new link" : `hand it to ${firstName}`}
        </button>
        {link ? (
          <button
            type="button"
            className={GHOST}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "copied" : "copy the link"}
          </button>
        ) : null}
      </div>
      {link ? <p className="num mt-3 break-all text-[12.5px] text-ink-dim">{link}</p> : null}
      {link ? <p className="mt-2 text-[12.5px] text-ink-faint">{`send it to ${firstName} however you talk: the team chat is fine. a new link stops this one working.`}</p> : null}
      {error ? <p role="alert" className="mt-3 text-[13px] text-doubt">{error}</p> : null}
    </div>
  );
}
