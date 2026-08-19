import type { SquadRow as SquadRowData } from "@/lib/data";

import { SquadRow } from "./squad-row";

const HEAD =
  "annot sticky top-0 z-20 border-b border-line-strong bg-panel px-2 py-2 text-left font-normal sm:px-3";

/**
 * The board. Column widths are fixed so 22 rows scan as columns rather than as
 * ragged text, and the three widest columns fall away below `sm`/`md` so the
 * table never needs a horizontal scroller on a phone.
 */
export function SquadTable({ rows }: { rows: SquadRowData[] }) {
  const maxLoad = rows.reduce((max, row) => Math.max(max, row.weekLoad), 0);

  return (
    <div className="border border-line bg-panel">
      <table className="w-full table-fixed border-collapse">
        <caption className="sr-only">
          Squad availability and training load, one row per player.
        </caption>
        <colgroup>
          <col className="w-8 sm:w-12" />
          <col />
          <col className="hidden sm:table-column sm:w-14" />
          <col className="w-[78px] sm:w-[186px]" />
          <col className="w-[64px] sm:w-[136px]" />
          <col className="hidden sm:table-column sm:w-[76px]" />
          <col className="hidden md:table-column md:w-[86px]" />
          <col className="w-11 sm:w-12" />
          <col className="w-9 sm:w-14" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className={`${HEAD} text-right`}>
              #
            </th>
            <th scope="col" className={HEAD}>
              name
            </th>
            <th scope="col" className={`${HEAD} hidden sm:table-cell`}>
              pos
            </th>
            <th scope="col" className={HEAD}>
              status
            </th>
            <th scope="col" className={`${HEAD} text-right`}>
              7d load
            </th>
            <th scope="col" className={`${HEAD} hidden text-right sm:table-cell`}>
              acwr
            </th>
            <th scope="col" className={`${HEAD} hidden text-right md:table-cell`}>
              &Delta; wk
            </th>
            <th scope="col" className={`${HEAD} text-center`}>
              flag
            </th>
            <th scope="col" className={`${HEAD} text-right`}>
              <span className="sr-only">change availability</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <SquadRow key={row.player.id} row={row} maxLoad={maxLoad} />
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-ink-dim">
          No players registered yet. Add a squad to start tracking availability.
        </p>
      ) : null}
    </div>
  );
}
