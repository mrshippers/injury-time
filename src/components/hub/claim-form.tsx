"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { sendMagicLink } from "@/app/login/actions";
import { claimAction } from "@/lib/hub/claim";

const FIELD =
  "h-11 w-full border border-line-strong bg-panel px-3 text-[15px] text-ink [color-scheme:dark] placeholder:text-ink-faint focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-mint";
const PRIMARY =
  "pressable h-11 rounded-[2px] bg-mint px-5 text-[12.5px] font-bold uppercase tracking-[0.12em] text-mint-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint";

export function ClaimForm({ token, signedInAs, firstName }: { token: string; signedInAs: string | null; firstName: string }) {
  const router = useRouter();
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (signedInAs)
    return (
      <div>
        <p className="text-[13px] text-ink-dim">
          signed in as <span className="num text-ink">{signedInAs}</span>
        </p>
        <button
          type="button"
          className={`${PRIMARY} mt-4`}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await claimAction(token);
              if (r.ok) router.push(`/player/${r.playerId}/hub`);
              else setError(r.error);
            })
          }
        >
          {pending ? "claiming" : `I'm ${firstName}, it's mine`}
        </button>
        {error ? <p role="alert" className="mt-3 text-[13px] text-doubt">{error}</p> : null}
      </div>
    );

  if (sent)
    return (
      <div className="border border-line bg-panel p-5" role="status">
        <p className="text-[14px] text-ink">
          Link sent to <span className="num text-mint">{sent}</span>.
        </p>
        <p className="mt-2 text-[13px] text-ink-dim">Open it on this phone. If you land somewhere else, open your manager&apos;s link again and it will say it&apos;s you.</p>
      </div>
    );

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
        if (!email) return;
        start(async () => {
          const r = await sendMagicLink(email, `/claim/${token}`);
          if (r.ok) setSent(email);
          else setError(r.error);
        });
      }}
    >
      <label htmlFor="claim-email" className="text-[11px] uppercase tracking-[0.12em] text-ink-dim">
        your email
      </label>
      <input id="claim-email" name="email" type="email" autoComplete="email" required className={FIELD} placeholder="you@example.com" />
      <button type="submit" className={PRIMARY} disabled={pending}>
        {pending ? "sending" : "send me a sign-in link"}
      </button>
      {error ? <p role="alert" className="text-[13px] text-doubt">{error}</p> : null}
    </form>
  );
}
