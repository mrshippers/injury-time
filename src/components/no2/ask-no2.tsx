"use client";

import { useState, useTransition } from "react";

import { askNo2Action } from "@/lib/ai/actions";
import type { No2Answer } from "@/lib/ai/schemas";

const STARTERS = ["How do we do away after going behind at half time?", "Who scores when we win at home?", "Are we better in the cups than the league?", "What's our record against the top six?"];

/** Ask the analyst: a question about the season, answered from the results and the table with the numbers shown. */
export function AskNo2() {
  const [q, setQ] = useState("");
  const [a, setA] = useState<{ q: string; v: No2Answer } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ask = (question: string) =>
    start(async () => {
      setError(null);
      const res = await askNo2Action(question);
      if (res.ok) setA({ q: question, v: res.value });
      else setError(res.error);
    });
  return (
    <section aria-labelledby="no2-h" className="mt-10">
      <p className="annot" id="no2-h">{"// ask the analyst"}</p>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) ask(q.trim());
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="anything about the season, gaffer"
          aria-label="your question"
          maxLength={300}
          className="min-w-0 flex-1 border-0 border-b border-line-strong bg-transparent px-1 py-2 text-[15px] text-ink placeholder:text-ink-faint focus:border-mint focus:outline-none"
        />
        <button type="submit" disabled={pending || !q.trim()} className="plate pressable bg-mint py-2 text-[13px] font-semibold text-mint-ink disabled:opacity-50">
          {pending ? "thinking" : "ask"}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {STARTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setQ(s);
              ask(s);
            }}
            className="plate plate-sm pressable bg-panel py-1 text-[12px] text-ink-dim transition-colors duration-200 hover:text-ink"
          >
            {s}
          </button>
        ))}
      </div>
      {pending ? <span aria-hidden className="route-bar mt-4 block h-[3px] w-24 bg-mint" /> : null}
      {error ? <p className="mt-3 text-[12.5px] text-doubt">{error}</p> : null}
      {a && !pending ? (
        <div data-stagger className="mt-5 max-w-[68ch]" aria-live="polite">
          <p className="num text-[11px] uppercase tracking-[0.1em] text-ink-dim">{a.q}</p>
          <p className="mt-2 text-[16px] leading-relaxed text-ink">{a.v.answer}</p>
          {a.v.figures.length ? (
            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
              {a.v.figures.map((f) => (
                <div key={f.label}>
                  <dt className="num text-[10.5px] uppercase tracking-[0.12em] text-ink-dim">{f.label}</dt>
                  <dd className={`mt-1 font-semibold text-ink ${f.value.length > 14 ? "max-w-[44ch] text-[15px] leading-snug" : "num text-[20px]"}`}>{f.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
