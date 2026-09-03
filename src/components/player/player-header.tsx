import type { CurrentAvailability, Player } from "@/lib/types";
import { STATUS_META, formatDate } from "./labels";

const POSITION_LABEL: Record<string, string> = {
  GK: "goalkeeper",
  DF: "defender",
  MF: "midfielder",
  FW: "forward",
};

export default function PlayerHeader({
  player,
  availability,
}: {
  player: Player;
  availability: CurrentAvailability | null;
}) {
  const status = availability ? STATUS_META[availability.status] : null;

  return (
    <header className="border-b border-line-strong pb-8">
      <p className="annot">{"// player profile"}</p>
      <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-4">
        <h1 className="display text-5xl sm:text-6xl lg:text-7xl">
          {player.name}
        </h1>
        {player.squad_number !== null ? (
          <span
            className="num text-gold text-5xl sm:text-6xl leading-none"
            aria-label={`squad number ${player.squad_number}`}
          >
            {player.squad_number}
          </span>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3">
        <span className="text-sm text-ink-dim tracking-[0.14em] uppercase">
          {POSITION_LABEL[player.position] ?? player.position}
        </span>

        <span className="flex items-baseline gap-2">
          <span
            className={`text-sm font-bold tracking-[0.1em] uppercase ${status?.text ?? "text-cold"}`}
          >
            {status?.label ?? "no status logged"}
          </span>
          {availability?.return_date ? (
            <span className="num text-sm text-ink-dim">
              back {formatDate(availability.return_date)}
            </span>
          ) : null}
        </span>
      </div>
    </header>
  );
}
