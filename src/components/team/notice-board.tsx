"use client";

/**
 * Notices: staff write, the squad reads, and a new one lands at the top of
 * every open phone without a reload. The toast is one quiet line, not a
 * banner.
 */
import { useEffect, useState, useTransition } from "react";

import { postNoticeAction } from "@/lib/team/actions";
import { KIND_META, timeAgo } from "@/lib/team/format";
import { useTeamRealtime } from "@/lib/team/realtime";
import { CLUB_ROLES, NOTIFICATION_KINDS, type ClubRole, type Fixture, type Notification, type NotificationKind } from "@/lib/types";

export type NoticeBoardProps = {
  clubId: string;
  notices: Notification[];
  canPost: boolean;
  role: ClubRole;
  fixture: Fixture | null;
  /** server clock at render, so the first paint matches on both sides */
  now: number;
};

export function NoticeBoard({ clubId, notices, canPost, role, fixture, now }: NoticeBoardProps) {
  const [list, setList] = useState<Notification[]>(notices);
  const [clock, setClock] = useState(now);
  const [toast, setToast] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useTeamRealtime(clubId, null, {
    onNotice: (n) => {
      setList((l) => (l.some((x) => x.id === n.id) ? l : [n, ...l].slice(0, 20)));
      setToast(n.title);
      setClock(Date.now());
    },
  });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // only notices meant for this role, or for everyone
  const visible = list.filter((n) => n.audience.length === 0 || n.audience.includes(role));

  return (
    <section aria-labelledby="notices-heading" className="border border-line bg-panel">
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <p className="annot" id="notices-heading">{"// from the staff"}</p>
        {canPost ? (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="pressable rounded-[2px] border border-line-strong bg-pitch px-2.5 py-1 text-[11px] font-semibold tracking-[0.1em] uppercase text-ink hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint"
          >
            {open ? "close" : "post"}
          </button>
        ) : null}
      </div>

      {toast ? (
        <p
          role="status"
          className="hero-in border-b border-line bg-panel-2 px-4 py-2 text-[12.5px] text-ink sm:px-5"
        >
          <span className="text-mint">new notice</span> · {toast}
        </p>
      ) : null}

      {open && canPost ? (
        <Composer
          fixture={fixture}
          onPosted={(n) => {
            setList((l) => (l.some((x) => x.id === n.id) ? l : [n, ...l].slice(0, 20)));
            setOpen(false);
          }}
        />
      ) : null}

      {visible.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-ink-dim sm:px-5">Nothing posted yet. The first notice lands here for everyone at once.</p>
      ) : (
        <ul className="divide-y divide-line" data-testid="notice-feed">
          {visible.map((n) => (
            <li key={n.id} className="px-4 py-3 sm:px-5" data-testid="notice">
              <div className="flex items-baseline gap-3">
                <span className="num shrink-0 text-[10.5px] tracking-[0.14em] uppercase text-gold">{KIND_META[n.kind].label}</span>
                <p className="min-w-0 flex-1 text-[14px] font-semibold leading-snug text-ink">{n.title}</p>
                <span className="num shrink-0 text-[11px] text-ink-faint">{timeAgo(n.created_at, clock)}</span>
              </div>
              {n.body ? <p className="mt-1 max-w-[62ch] text-[12.5px] leading-snug text-ink-dim">{n.body}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Composer({ fixture, onPosted }: { fixture: Fixture | null; onPosted: (n: Notification) => void }) {
  const [kind, setKind] = useState<NotificationKind>("notice");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<ClubRole[]>([...CLUB_ROLES]);
  const [attach, setAttach] = useState(Boolean(fixture));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggleRole = (r: ClubRole) =>
    setAudience((a) => (a.includes(r) ? (a.length > 1 ? a.filter((x) => x !== r) : a) : [...a, r]));

  return (
    <form
      className="flex flex-col gap-3 border-b border-line bg-panel-2 px-4 py-4 sm:px-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await postNoticeAction({
            kind,
            title,
            body,
            audience,
            fixtureId: attach && fixture ? fixture.id : null,
          });
          if (!res.ok) {
            setError(res.error);
            return;
          }
          onPosted({
            id: res.id,
            club_id: "",
            kind,
            title: title.trim(),
            body: body.trim() || null,
            fixture_id: attach && fixture ? fixture.id : null,
            audience,
            created_by: null,
            created_at: new Date().toISOString(),
          });
          setTitle("");
          setBody("");
        });
      }}
    >
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="kind">
        {NOTIFICATION_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={`pressable rounded-[2px] border px-2.5 py-1 text-[10.5px] font-semibold tracking-[0.1em] uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint ${
              kind === k ? "border-transparent bg-mint text-mint-ink" : "border-line-strong bg-pitch text-ink-dim hover:text-ink"
            }`}
          >
            {KIND_META[k].label}
          </button>
        ))}
      </div>
      <input
        type="text"
        required
        maxLength={90}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="the one line they need"
        aria-label="title"
        className="w-full border border-line bg-pitch px-3 py-2 text-[14px] font-semibold text-ink placeholder:text-ink-faint focus:border-mint focus:outline-none"
      />
      <textarea
        rows={2}
        maxLength={600}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="anything else (optional)"
        aria-label="body"
        className="w-full resize-y border border-line bg-pitch px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-mint focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="who sees it">
          <span className="mr-1 text-[10.5px] tracking-[0.14em] uppercase text-ink-dim">to</span>
          {CLUB_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={audience.includes(r)}
              onClick={() => toggleRole(r)}
              className={`pressable rounded-[2px] border px-2 py-0.5 text-[10.5px] tracking-[0.08em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint ${
                audience.includes(r) ? "border-line-strong bg-panel text-ink" : "border-line bg-transparent text-ink-faint"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        {fixture ? (
          <label className="flex items-center gap-2 text-[12px] text-ink-dim">
            <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} className="accent-[var(--mint)]" />
            about {fixture.opponent} ({fixture.venue})
          </label>
        ) : null}
        <button
          type="submit"
          disabled={pending || title.trim().length === 0}
          className="pressable ml-auto rounded-[2px] bg-mint px-4 py-1.5 text-[11px] font-bold tracking-[0.12em] uppercase text-mint-ink disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          {pending ? "posting" : "post to squad"}
        </button>
      </div>
      {error ? <p role="alert" className="text-[12px] text-out">{error}</p> : null}
    </form>
  );
}
