import type { ExternalStats, Player } from "@/lib/types";

/**
 * A position is only a position once somebody has said it. The league feed carries none, so a player
 * seeded from it is a placeholder MF with `position_confirmed: false`: showing "MF" for him would be
 * a claim nobody made, and treating him as a midfielder would drop him out of position everywhere.
 */
export function positionKnown(player: Pick<Player, "external_stats">): boolean {
  return (player.external_stats as (ExternalStats & { position_confirmed?: boolean }) | null)?.position_confirmed !== false;
}
