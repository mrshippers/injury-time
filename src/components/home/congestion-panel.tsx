import Link from "next/link";

import { shortDate } from "@/components/squad/format";
import type { Congestion } from "@/lib/home/congestion";

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Europe/London" });
const day = (d: string) => WEEKDAY.format(new Date(`${d}T12:00:00Z`)).toLowerCase();

/**
 * Two games inside three days. Only drawn when there is one; says who is
 * already carrying load, or says plainly that nobody can be judged yet.
 */
export function CongestionPanel({ c }: { c: Congestion }) {
  const fx = (f: Congestion["first"]) => `${day(f.match_date)} ${shortDate(f.match_date)} ${f.venue === "H" ? "v" : "at"} ${f.opponent}`;
  return (
    <section aria-labelledby="congestion-h" className="bg-panel border border-line border-l-2 border-l-doubt px-4 py-4 sm:px-5">
      <p className="annot" id="congestion-h">{`// two games in ${c.gap} days`}</p>
      <p className="mt-2 text-[15px] leading-snug text-ink">
        <span className="font-semibold">{fx(c.first)}</span>
        <span className="text-ink-dim"> then </span>
        <span className="font-semibold">{fx(c.second)}</span>
      </p>
      {!c.judged ? (
        <p className="mt-2 text-[13.5px] leading-snug text-ink-dim">Not enough training logged to say who is carrying load. Log the sessions and this names them.</p>
      ) : c.rotate.length === 0 ? (
        <p className="mt-2 text-[13.5px] leading-snug text-ink-dim">Nobody available is over their usual load. Both games as picked.</p>
      ) : (
        <>
          <p className="mt-2 text-[13.5px] leading-snug text-ink-dim">Already over their usual load, so start them in one, not both:</p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            {c.rotate.map((p) => (
              <li key={p.id} className="text-[14px]">
                <Link href={`/player/${p.id}`} className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                  {p.name}
                </Link>
                <span className="num ml-1.5 text-[11px] uppercase tracking-[0.1em] text-doubt">{p.word}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
