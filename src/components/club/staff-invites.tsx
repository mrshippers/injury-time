"use client";

/**
 * The manager brings the staff in: one single-use link per person, coach or
 * medical, seven days to live. The link is made on the server (0015) and shown
 * once here to send on WhatsApp; whoever opens it signs in and joins in that
 * role and nothing more.
 */
import { useState, useTransition } from "react";

import { mintInviteAction } from "@/lib/club/invites";

const PRIMARY =
  "pressable h-10 rounded-[2px] bg-mint px-4 text-[12px] font-bold uppercase tracking-[0.12em] text-mint-ink disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint";
const GHOST =
  "pressable h-10 rounded-[2px] border border-line-strong bg-pitch px-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-dim hover:text-ink disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint";

export type InviteRow = { role: "coach" | "medical"; created_at: string; expires_at: string; used_at: string | null };

export function StaffInvites({ allowed, reason, invites, clubName }: { allowed: boolean; reason: string | null; invites: InviteRow[]; clubName: string }) {
  const [link, setLink] = useState<{ role: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const mint = (role: "coach" | "medical") =>
    start(async () => {
      setError(null);
      setCopied(false);
      const r = await mintInviteAction(role);
      if (r.ok) setLink({ role, url: r.url });
      else setError(r.error);
    });

  const message = link ? `You're invited to ${clubName} on Injury Time as ${link.role === "medical" ? "medical staff" : "a coach"}: ${link.url}` : "";
  const now = new Date().toISOString();

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-3">
        <button type="button" className={PRIMARY} disabled={!allowed || pending} onClick={() => mint("coach")}>
          invite a coach
        </button>
        <button type="button" className={GHOST} disabled={!allowed || pending} onClick={() => mint("medical")}>
          invite medical
        </button>
      </div>
      {!allowed && reason ? <p className="mt-3 text-[13px] text-ink-dim">{reason}</p> : null}
      {error ? <p role="alert" className="mt-3 text-[13px] text-doubt">{error}</p> : null}
      {link ? (
        <div className="mt-4 border border-line bg-panel p-4" role="status">
          <p className="text-[13px] text-ink-dim">One person, one use, seven days. Send it to them directly.</p>
          <p className="num mt-2 break-all text-[13px] text-ink">{link.url}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              className={GHOST}
              onClick={() => navigator.clipboard?.writeText(link.url).then(() => setCopied(true)).catch(() => setCopied(false))}
            >
              {copied ? "copied" : "copy the link"}
            </button>
            <a className={`${GHOST} inline-flex items-center`} href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
              send on whatsapp
            </a>
          </div>
        </div>
      ) : null}
      {invites.length ? (
        <ul className="mt-5 border-t border-line" aria-label="staff invites">
          {invites.map((i) => (
            <li key={i.created_at} className="flex items-baseline justify-between gap-4 border-b border-line py-2 text-[13px]">
              <span className="text-ink">{i.role}</span>
              <span className="num text-[12px] text-ink-dim">
                {i.used_at ? "joined" : i.expires_at < now ? "expired" : "waiting"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
