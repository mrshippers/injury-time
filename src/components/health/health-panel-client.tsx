"use client";

import { useState, useTransition } from "react";

import { addMedicalNoteAction, consentLinkAction, deleteMedicalNoteAction, eraseHealthAction } from "@/lib/health/consent-actions";

const GHOST =
  "pressable h-10 rounded-[2px] border border-line-strong bg-pitch px-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-dim hover:text-ink disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint";
const PRIMARY =
  "pressable h-10 rounded-[2px] bg-mint px-4 text-[12px] font-bold uppercase tracking-[0.12em] text-mint-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint";

export function ConsentLinkButton({ playerId, firstName }: { playerId: string; firstName: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <button
        type="button"
        className={GHOST}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await consentLinkAction(playerId);
            if (r.ok) setUrl(r.url);
            else setError(r.error);
          })
        }
      >
        {`${firstName}'s consent link`}
      </button>
      {url ? (
        <p className="mt-2 text-[13px] text-ink-dim" role="status">
          Send this to {firstName} only: <span className="num break-all text-ink">{url}</span>{" "}
          <a className="text-mint underline underline-offset-4" href={`https://wa.me/?text=${encodeURIComponent(`Before we record anything about injuries or fitness, we need your say-so: ${url}`)}`} target="_blank" rel="noreferrer">
            whatsapp
          </a>
        </p>
      ) : null}
      {error ? <p role="alert" className="mt-2 text-[13px] text-doubt">{error}</p> : null}
    </div>
  );
}

export function NoteForm({ playerId, injuryId }: { playerId: string; injuryId: string | null }) {
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-3 flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addMedicalNoteAction({ playerId, injuryId, body });
          if (r.ok) {
            setBody("");
            setMsg({ ok: true, text: "note saved" });
          } else setMsg({ ok: false, text: r.error });
        });
      }}
    >
      <label htmlFor="med-note" className="text-[11px] uppercase tracking-[0.12em] text-ink-dim">
        a note (medical and the player only)
      </label>
      <textarea
        id="med-note"
        maxLength={280}
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="border-0 border-b border-line-strong bg-transparent p-2 text-[14px] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-mint"
      />
      <div className="flex items-center gap-3">
        <button type="submit" className={PRIMARY} disabled={pending || !body.trim()}>
          save note
        </button>
        <span className="num text-[11px] text-ink-faint">{body.length}/280</span>
      </div>
      {msg ? <p role={msg.ok ? "status" : "alert"} className={`text-[13px] ${msg.ok ? "text-ink" : "text-doubt"}`}>{msg.text}</p> : null}
    </form>
  );
}

export function DeleteNote({ noteId, playerId }: { noteId: string; playerId: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="text-[11px] uppercase tracking-[0.1em] text-ink-faint hover:text-ink" disabled={pending} onClick={() => start(async () => void (await deleteMedicalNoteAction(noteId, playerId)))}>
      delete
    </button>
  );
}

export function EraseButton({ playerId, firstName }: { playerId: string; firstName: string }) {
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!confirm)
    return (
      <div>
        <button type="button" className={GHOST} onClick={() => setConfirm(true)}>
          erase on request
        </button>
        {msg ? <p role="status" className="mt-2 text-[13px] text-ink">{msg}</p> : null}
      </div>
    );
  return (
    <div className=" border-out/60 p-3 bg-panel/50">
      <p className="text-[13.5px] text-ink">{`Only when ${firstName} has asked. Every injury, note, check-in and load about ${firstName} is deleted for good, and consent is withdrawn.`}</p>
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          className={`${GHOST} text-out`}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await eraseHealthAction(playerId);
              setConfirm(false);
              setMsg(r.ok ? `erased: ${r.removed} records` : r.error);
            })
          }
        >
          {`${firstName} asked: erase`}
        </button>
        <button type="button" className={GHOST} onClick={() => setConfirm(false)}>
          cancel
        </button>
      </div>
    </div>
  );
}
