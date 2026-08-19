"use client";

import { useState, useTransition } from "react";

import { sendMagicLink } from "./actions";

export function LoginForm() {
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return (
      <div className="bg-panel border border-line p-5">
        <p className="text-sm text-ink">
          Magic link sent to <span className="num text-mint">{sent}</span>.
        </p>
        <p className="mt-2 text-sm text-ink-dim">
          Open it on this device and you land in the squad room.
        </p>
      </div>
    );
  }

  return (
    <form
      action={(fd) => {
        const email = String(fd.get("email") ?? "").trim();
        if (!email) return;
        startTransition(async () => {
          const res = await sendMagicLink(email);
          if (res.ok) setSent(email);
          else setError(res.error);
        });
      }}
      className="flex flex-col gap-3"
    >
      <label htmlFor="email" className="text-sm text-ink-dim">
        Club email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="gaffer@yourclub.co.uk"
        className="bg-panel border border-line-strong px-4 py-3 text-ink placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-mint"
      />
      <button
        type="submit"
        disabled={pending}
        className="pressable bg-mint text-mint-ink font-bold px-4 py-3 text-sm disabled:opacity-60"
      >
        {pending ? "sending…" : "send magic link"}
      </button>
      {error ? <p className="text-sm text-out">{error}</p> : null}
    </form>
  );
}
