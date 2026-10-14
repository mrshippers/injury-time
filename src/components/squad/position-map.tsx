import type { Position } from "@/lib/types";

const GROUP_SPOT: Record<Position, { x: number; depth: number }> = {
  GK: { x: 0, depth: 0.05 },
  DF: { x: 0, depth: 0.25 },
  MF: { x: 0, depth: 0.5 },
  FW: { x: 0, depth: 0.8 },
};

/**
 * Where a player plays, as a dot on a pitch the size of a fingernail: the one idea worth taking from a
 * football manager's player screen. A dot from the slot he fills today when he is in the side, else from
 * his position; no position and no slot is an empty pitch, never a guessed dot. Own goal at the bottom.
 */
export function PositionMap({ spot, group, className = "" }: { spot?: { x: number; depth: number } | null; group?: Position | null; className?: string }) {
  const at = spot ?? (group ? GROUP_SPOT[group] : null);
  const W = 14;
  const H = 20;
  return (
    <svg aria-hidden viewBox={`0 0 ${W} ${H}`} width={W} height={H} className={`shrink-0 ${className}`}>
      <rect x="0.5" y="0.5" width={W - 1} height={H - 1} rx="1" fill="none" stroke="var(--line-strong)" strokeWidth="1" strokeDasharray={at ? undefined : "2 2"} />
      <line x1="0.5" x2={W - 0.5} y1={H / 2} y2={H / 2} stroke="var(--line)" strokeWidth="1" />
      {at ? <circle cx={W / 2 + at.x * (W / 2 - 2.5)} cy={H - 2 - at.depth * (H - 4)} r="2.1" fill="var(--ink)" /> : null}
    </svg>
  );
}
