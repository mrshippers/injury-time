"use client";

import { useState, useTransition } from "react";

import { writeReportAction } from "@/lib/ai/actions";
import type { MatchReport } from "@/lib/ai/schemas";

import { CopyButton } from "./copy-button";

/** The report, drafted on request and kept: website headline, the write-up, one post for socials. Never posted for you. */
export function ReportDraft({ resultId, initial }: { resultId: string; initial: MatchReport | null }) {
  const [r, setR] = useState<MatchReport | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!r)
    return (
      <div className="mt-6">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await writeReportAction(resultId);
              if (res.ok) setR(res.value);
              else setError(res.error);
            })
          }
          className="plate pressable bg-mint py-2.5 text-[13px] font-semibold text-mint-ink transition-transform duration-200 hover:translate-x-0.5 disabled:opacity-60"
        >
          {pending ? "writing it up" : "write the match report"}
        </button>
        {error ? <p className="mt-2 text-[12.5px] text-doubt">{error}</p> : null}
      </div>
    );
  return (
    <div data-stagger className="mt-8 flex flex-col gap-8">
      <article>
        <div className="flex items-center justify-between gap-3">
          <p className="annot">{"// for the website"}</p>
          <CopyButton text={`${r.headline}\n\n${r.report}`} />
        </div>
        <h2 className="display mt-3 text-[28px] leading-tight text-ink">{r.headline}</h2>
        <div className="mt-4 flex max-w-[64ch] flex-col gap-3 text-[15px] leading-relaxed text-ink">
          {r.report.split(/\n+/).map((para) => (
            <p key={para}>{para}</p>
          ))}
        </div>
      </article>
      <article className="plate max-w-[520px] bg-panel py-4 [--slant:10px]">
        <div className="flex items-center justify-between gap-3">
          <p className="annot">{"// for the socials"}</p>
          <CopyButton text={r.social} />
        </div>
        <p className="mt-3 text-[15px] leading-snug text-ink">{r.social}</p>
      </article>
    </div>
  );
}
