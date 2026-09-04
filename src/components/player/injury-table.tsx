"use client";

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
  const heads = ["region", "side", wordFor(mode, "severity"), "occurred", wordFor(mode, "back"), wordFor(mode, "days")];
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
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-[12.5px] border-collapse">
            <thead>
              <tr className="text-left">
                {heads.map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="py-2 pr-3 text-[10px] font-medium tracking-[0.12em] uppercase text-ink-dim border-b border-line whitespace-nowrap"
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
                    <td className={`py-2.5 pr-3 ${current ? "pl-3 text-ink font-semibold" : "text-ink"}`}>
                      {REGION_LABEL[injury.body_region]}
                    </td>
                    <td className="py-2.5 pr-3 text-ink-dim">{injury.side}</td>
                    <td className={`py-2.5 pr-3 ${current ? "text-out" : "text-ink-dim"}`}>{injury.severity}</td>
                    <td className="num py-2.5 pr-3 text-ink-dim whitespace-nowrap">{formatDate(injury.occurred_on)}</td>
                    <td className="num py-2.5 pr-3 whitespace-nowrap">
                      {injury.resolved_on ? (
                        <span className="text-ink-dim">{formatDate(injury.resolved_on)}</span>
                      ) : injury.expected_return ? (
                        // expected, not banked: a different colour, so nobody
                        // reads a projection as a date he actually returned.
                        <span className="text-doubt" title={mode === "detailed" ? "expected return, not confirmed" : undefined}>
                          {formatDate(injury.expected_return)}
                        </span>
                      ) : (
                        <span className="text-cold">{NO_VALUE}</span>
                      )}
                    </td>
                    <td className="num py-2.5 pr-3 text-ink whitespace-nowrap">
                      {daysOut(injury, asOf)}
                      {current ? <span className="text-out"> · ongoing</span> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
