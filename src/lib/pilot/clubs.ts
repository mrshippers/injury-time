/**
 * The clubs a pilot page exists for. A page is a pitch to one gaffer, so a club is added here by hand
 * and nowhere else; an unknown slug is a 404, never a page that names a club we have not spoken to.
 */
export type PilotClub = { name: string; /** what the footer says the data runs to */ dataNote: string };

export const PILOT_CLUBS: Record<string, PilotClub> = {
  belstone: { name: "Belstone", dataNote: "10 Oct" },
};

/** The address links and share previews should point at: the production site, whatever deploy rendered them. */
export function pilotBaseUrl(): string {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "injury-time.vercel.app";
  return `https://${host}`;
}
