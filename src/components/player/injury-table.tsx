"use client";

/**
 * Injury history. A table on a desk; on a phone each injury is a card with
 * the region as its title and the facts as label / value pairs, so nothing
 * gets clipped at the right edge and nothing scrolls sideways.
 */
import { wordFor } from "@/lib/health/language";
import { useHealthLanguage } from "@/lib/health/store";
import type { Injury } from "@/lib/types";
import { NO_VALUE, REGION_LABEL, daysOut, formatDate } from "./labels";

export default function InjuryTable({
  injuries,
  asOf,
}: {
  injuries: Injury[];
  asOf: string;
}) {
  const [mode] = useHealthLanguage();
  const words = {
    severity: wordFor(mode, "severity"),
    back: wordFor(mode, "back"),
    days: wordFor(mode, "days"),
  };
  const heads = ["region", "side", words.severity, "occurred", words.back, words.days];

  const backCell = (injury: Injury) =>
    injury.resolved_on ? (
      <span className="text-ink-dim">{formatDate(injury.resolved_on)}</span>
    ) : injury.expected_return ? (
      // expected, not banked: a different colour, so nobody reads a
      // projection as a date he actually returned.
      <span className="text-doubt" title={mode === "detailed" ? "expected return, not confirmed" : undefined}>
        {formatDate(injury.expected_return)}
      </span>
    ) : (
      <span className="text-cold">{NO_VALUE}</span>
    );

  return (
    <section aria-labelledby="injury-history-heading">
      <p className="annot border-b border-line pb-2" id="injury-history-heading">
        {"// injury history"}
      </p>

      {injuries.length === 0 ? (
        <p className="mt-4 text-sm text-ink-dim">
          {mode === "plain"
            ? "Nothing logged. Not the same as nothing happening - if he has been carrying something, it is not in here yet."
            : "No injury records. Absence of a record is not evidence of absence; unlogged niggles do not appear here."}
        </p>
      ) : (
        <>
          {/* phone: one card per injury */}
          <ul className="mt-2 flex flex-col gap-2 sm:hidden" data-testid="injury-cards">
            {injuries.map((injury) => {
              const current = injury.resolved_on === null;
              const facts: [string, React.ReactNode][] = [
                [words.severity, <span key="s" className={current ? "text-out" : "text-ink"}>{injury.severity}</span>],
                ["occurred", <span key="o" className="num text-ink">{formatDate(injury.occurred_on)}</span>],
                [words.back, <span key="b" className="num">{backCell(injury)}</span>],
                [
                  words.days,
                  <span key="d" className="num text-ink">
                    {daysOut(injury, asOf)}
                    {current ? <span className="text-out"> · ongoing</span> : null}
                  </span>,
                ],
              ];
              return (
                <li
                  key={injury.id}
                  className="border border-line bg-panel px-3 py-3"
                  style={current ? { boxShadow: "inset 3px 0 0 0 var(--out)" } : undefined}
                >
                  <p className="text-[14px] font-bold lowercase text-ink">
                    {REGION_LABEL[injury.body_region]}
                    <span className="ml-2 text-[12.5px] font-normal text-ink-dim">{injury.side}</span>
                  </p>
                  <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px]">
                    {facts.map(([label, value]) => (
                      <div key={label} className="contents">
                        <dt className="text-[11.5px] uppercase tracking-[0.12em] text-ink-dim">{label}</dt>
                        <dd className="text-right">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              );
            })}
          </ul>

          {/* desk: the table */}
          <div className="mt-2 hidden sm:block">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="text-left">
                  {heads.map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="whitespace-nowrap border-b border-line py-2 pr-3 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-dim"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {injuries.map((injury) => {
                  const current = injury.resolved_on === null;
                  return (
                    <tr
                      key={injury.id}
                      className="border-b border-line last:border-b-0"
                      style={current ? { boxShadow: "inset 2px 0 0 0 var(--out)" } : undefined}
                    >
                      <td className={`py-2.5 pr-3 ${current ? "pl-3 font-semibold text-ink" : "text-ink"}`}>
                        {REGION_LABEL[injury.body_region]}
                      </td>
                      <td className="py-2.5 pr-3 text-ink-dim">{injury.side}</td>
                      <td className={`py-2.5 pr-3 ${current ? "text-out" : "text-ink-dim"}`}>{injury.severity}</td>
                      <td className="num whitespace-nowrap py-2.5 pr-3 text-ink-dim">{formatDate(injury.occurred_on)}</td>
                      <td className="num whitespace-nowrap py-2.5 pr-3">{backCell(injury)}</td>
                      <td className="num whitespace-nowrap py-2.5 pr-3 text-ink">
                        {daysOut(injury, asOf)}
                        {current ? <span className="text-out"> · ongoing</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
