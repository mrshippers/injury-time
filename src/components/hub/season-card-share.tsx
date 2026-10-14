"use client";

import { useState } from "react";

/**
 * Share the season card: the phone's own share sheet with the image attached
 * (Instagram, WhatsApp) where the browser can share files, a download where it
 * cannot. The image is made on the server (app/player/[id]/card.png).
 */
export function SeasonCardShare({ playerId, fileName, firstName }: { playerId: string; fileName: string; firstName: string }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const href = `/player/${playerId}/card.png`;

  async function share() {
    setState("working");
    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error(await res.text());
      const file = new File([await res.blob()], `${fileName}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${firstName}'s season` });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(a.href);
      }
      setState("done");
    } catch (e) {
      // the person closing the share sheet is not an error
      setState((e as Error).name === "AbortError" ? "idle" : "error");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={share}
        disabled={state === "working"}
        className="pressable inline-flex min-h-11 items-center gap-2 border border-mint/60 px-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-mint hover:border-mint disabled:opacity-50 sm:min-h-9"
      >
        {state === "working" ? "making the card" : "share the season card"}
      </button>
      <a href={href} target="_blank" rel="noreferrer" className="text-[12px] text-ink-dim underline underline-offset-4 hover:text-ink">
        see it
      </a>
      {state === "error" ? <span role="alert" className="text-[12px] text-doubt">the card did not come; try see it</span> : null}
    </div>
  );
}
