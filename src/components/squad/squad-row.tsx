import Link from "next/link";

import type { SquadRow as SquadRowData } from "@/lib/data";
import type { AvailabilityStatus } from "@/lib/types";

import { ConditionBar } from "./condition-bar";
import { FlagDot } from "./flag-dot";
import { StatusMenu } from "./status-menu";
import { StatusPill } from "./status-pill";
import { signedPct } from "./format";

const CELL = "px-1.5 sm:px-3 align-middle";

/**
 * One player, one line. The whole row is the link to the profile - the name
 * anchor carries a full-row ::after overlay - and the SET button sits above it
 * on its own stacking level so it stays clickable.
 */
export function SquadRow({ row, maxLoad }: { row: SquadRowData; maxLoad: number }) {
  const { player, availability, weekLoad, acwr, weekChange, flag } = row;
  // No availability event yet means nobody has flagged a problem: in football
  // the default state of a registered player is available.
  const status: AvailabilityStatus = availability?.status ?? "fit";

  return (
    <tr className="relative h-[42px] border-b border-line transition-colors duration-[190ms] ease-[var(--ease-out-strong)] hover:bg-panel-2">
      <td className={`${CELL} num text-right text-[12.5px] text-ink-dim`}>
        {player.squad_number ?? "-"}
      </td>

      <th scope="row" className={`${CELL} text-left font-normal`}>
        <Link
          href={`/player/${player.id}`}
          className="pressable block truncate text-[13.5px] font-semibold text-ink outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-mint focus-visible:after:-outline-offset-2"
        >
          {player.name}
        </Link>
      </th>

      <td className={`${CELL} num hidden text-[11.5px] tracking-[0.08em] text-ink-dim sm:table-cell`}>
        {player.position}
      </td>

      <td className={CELL}>
        <StatusPill status={status} returnDate={availability?.return_date} />
      </td>

      <td className={CELL}>
        <span className="num block text-right text-[12.5px] leading-none text-ink-dim tabular-nums">
          {Math.round(weekLoad)}
        </span>
        <ConditionBar value={weekLoad} max={maxLoad} flag={flag} />
      </td>

      <td className={`${CELL} num hidden text-right text-[12.5px] sm:table-cell`}>
        {acwr.kind === "ratio" ? (
          <span className={acwr.value > 1.4 ? "text-out" : "text-ink-dim"}>
            {acwr.value.toFixed(2)}
          </span>
        ) : (
          <span className="text-cold" title="needs 28 days of data">
            &mdash;<span className="sr-only"> needs 28 days of data</span>
          </span>
        )}
      </td>

      <td className={`${CELL} num hidden text-right text-[12.5px] text-ink-dim md:table-cell`}>
        {weekChange.kind === "pct" ? (
          signedPct(weekChange.value)
        ) : (
          <span className="text-cold" title="no previous week to compare">
            &mdash;<span className="sr-only"> no previous week to compare</span>
          </span>
        )}
      </td>

      <td className={`${CELL} text-center`}>
        <FlagDot flag={flag} />
      </td>

      <td className={`${CELL} text-right`}>
        <StatusMenu playerId={player.id} playerName={player.name} current={status} />
      </td>
    </tr>
  );
}
