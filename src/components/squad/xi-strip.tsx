"use client";

/**
 * The eleven as a list under the pitch: the keyboard route onto the pitch,
 * the screen-reader route, and where the count of who is spare lives.
 */
import type { SquadRow } from "@/lib/data";
import type { Formation } from "@/lib/lineup";
import { READINESS_TEXT } from "@/lib/readiness";

export function XiStrip({
  formation,
  xiIds,
  byId,
  bench,
  selectedSlot,
  hovered,
  onHover,
  onSelectSlot,
  onRemove,
}: {
  formation: Formation;
  xiIds: (string | null)[];
  byId: Map<string, SquadRow>;
  bench: SquadRow[];
  selectedSlot: number | null;
  hovered: number | null;
  onHover: (i: number | null) => void;
  onSelectSlot: (i: number) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <section aria-labelledby="xi-heading" className="mt-3 border border-line bg-panel">
      <p className="annot flex items-baseline justify-between border-b border-line px-3 py-2" id="xi-heading">
        <span>{"// the eleven"}</span>
        <span className="num text-gold-dim">
          {bench.length} spare
        </span>
      </p>
      <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {formation.slots.map((slot, i) => {
          const row = xiIds[i] ? byId.get(xiIds[i]!) : null;
          const outOfPosition = !!row && row.player.position !== slot.role;
          return (
            <li key={i} className="flex items-stretch border-b border-line">
              <button
                type="button"
                aria-pressed={selectedSlot === i}
                onClick={() => onSelectSlot(i)}
                onMouseEnter={() => onHover(i)}
                onMouseLeave={() => onHover(null)}
                className={`pressable flex min-w-0 flex-1 items-center gap-2.5 px-3 py-1.5 text-left transition-colors duration-[190ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mint ${
                  selectedSlot === i ? "bg-panel-2" : hovered === i ? "bg-panel-2/60" : "hover:bg-panel-2/60"
                }`}
              >
                <span className="num w-6 shrink-0 text-[10.5px] tracking-[0.08em] text-ink-dim">{slot.role}</span>
                <span className="num w-5 shrink-0 text-right text-[12px] text-ink-dim">{row?.player.squad_number ?? ""}</span>
                <span className={`min-w-0 flex-1 truncate text-[13px] ${row ? "text-ink" : "text-out"}`}>
                  {row ? row.player.name : "empty"}
                  {outOfPosition ? <span className="annot ml-2 text-[10px]">{row!.player.position}</span> : null}
                </span>
                {row ? (
                  <span className={`num shrink-0 text-[10px] font-semibold tracking-[0.08em] ${READINESS_TEXT[row.readiness.key]}`}>
                    {row.readiness.word.toUpperCase()}
                  </span>
                ) : null}
              </button>
              {row ? (
                <button
                  type="button"
                  aria-label={`take ${row.player.name} out of the eleven`}
                  onClick={() => onRemove(i)}
                  className="pressable shrink-0 border-l border-line px-2.5 text-[12px] text-ink-faint hover:text-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mint"
                >
                  ×
                </button>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
