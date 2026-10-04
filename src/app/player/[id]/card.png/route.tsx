import { ImageResponse } from "next/og";

import { seasonCard } from "@/lib/card/season-card";
import { CARD } from "@/lib/card/fit";
import { getHub } from "@/lib/hub/data";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The season card PNG. The player or their club's staff on a real club; anyone
 * on a demo club. Football numbers only (lib/card/season-card.tsx).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response("not found", { status: 404 });
  const [hub, viewer] = await Promise.all([getHub(id), getViewer()]);
  if (!hub) return new Response("not found", { status: 404 });
  const allowed = hub.club.is_demo || viewer.playerId === id || (!viewer.guest && viewer.role !== "player");
  if (!allowed) return new Response("only the player or their club's staff make this card", { status: 403 });

  const s = hub.stats;
  const stats = [
    { label: "apps", value: s.apps },
    { label: "goals", value: s.goals },
    ...(s.source === "log" ? [{ label: "assists", value: s.assists }, { label: "minutes", value: s.minutes }] : []),
  ];
  const card = seasonCard({
    name: hub.player.name,
    club: hub.club.name,
    season: hub.club.season,
    number: hub.player.squad_number,
    accent: hub.club.colours?.accent ?? hub.club.colours?.home ?? null,
    stats,
  });
  if (!card.fitted) return new Response("this card would not fit; the name or the numbers are too long", { status: 500 });
  return new ImageResponse(card.element, {
    width: CARD.width,
    height: CARD.height,
    headers: { "cache-control": "private, max-age=300", "content-disposition": `inline; filename="${hub.player.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-season.png"` },
  });
}
