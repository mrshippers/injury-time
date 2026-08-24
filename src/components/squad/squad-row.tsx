import Link from "next/link";

import type { SquadRow as SquadRowData } from "@/lib/data";
import { READINESS_TEXT } from "@/lib/readiness";
import type { AvailabilityStatus } from "@/lib/types";

import { ConditionBar } from "./condition-bar";
import { FlagDot } from "./flag-dot";
import { StatusMenu } from "./status-menu";
import { StatusPill } from "./status-pill";

const CELL = "px-1.5 sm:px-3 align-middle";

/**
 * One player, one line. The whole row is the link to the profile - the name
 * anchor carries a full-row ::after overlay - and the SET button sits above it
 * on its own stacking level so it stays clickable.
 *
 * Load is a word, not a ratio. The ratio survives as the cell's title for
 * anyone who wants it; nobody has to know what it is to read the board.
 */
export function SquadRow({ row, maxLoad }: { row: SquadRowData; maxLoad: number }) {
  const { player, availability, weekLoad, readiness, flag, stats } = row;
  // No availability event yet means nobody has flagged a problem: in football
  // the default state of a registered player is available.
  const status: AvailabilityStatus = availability?.status ?? "fit";
  const loadTitle =
    readiness.ratio === null
      ? "needs 28 days of data"
      : `this week is ${readiness.ratio.toFixed(2)}x his usual week`;

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

      <td className={`${CELL} hidden sm:table-cell`} title={loadTitle}>
        <span className={`num block text-[11px] font-semibold tracking-[0.08em] ${READINESS_TEXT[readiness.key]}`}>
          {readiness.word.toUpperCase()}
        </span>
        <ConditionBar value={weekLoad} max={maxLoad} flag={flag} />
      </td>

      <td className={`${CELL} num hidden whitespace-nowrap text-right text-[12px] text-ink-dim md:table-cell`}>
        <span className="text-ink">{stats.apps}</span>
        <span className="text-ink-faint"> · </span>
        <span className={stats.goals > 0 ? "text-ink" : ""}>{stats.goals}</span>
        <span className="text-ink-faint"> · </span>
        <span className={stats.assists > 0 ? "text-ink" : ""}>{stats.assists}</span>
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
