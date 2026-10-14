/**
 * Club crests, by name. The files live in public/crests and the map in
 * scripts/crests/manifest.json (where each one came from is recorded there). A
 * club with no crest returns null and the caller shows a monogram: a crest is
 * never invented, and never hotlinked from somebody else's server.
 */
import manifest from "../../scripts/crests/manifest.json";

type Entry = { file: string | null };

/** "Staines & Lammas (Middlesex)" and "Staines and Lammas" are the same club. */
export function crestKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\(.*?\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const BY_KEY = new Map<string, string>(
  Object.entries(manifest as Record<string, Entry>)
    .filter(([, v]) => v.file)
    .map(([name, v]) => [crestKey(name), `/crests/${v.file}`]),
);

/** The URL of a club's crest, or null. */
export function crestFor(team: string | null | undefined): string | null {
  return team ? (BY_KEY.get(crestKey(team)) ?? null) : null;
}

/** "AFC Wimbledon" -> "AW"; "Belstone" -> "BE": two letters for the monogram fallback. */
export function monogram(team: string): string {
  const words = team.replace(/\(.*?\)/g, " ").split(/[^A-Za-z0-9]+/).filter(Boolean);
  const letters = words.length >= 2 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}
