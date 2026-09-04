/**
 * Where a piece of film lives, from the link someone pasted. Pure string work
 * so it runs in a unit test and on either side of the network.
 */
import type { ClipSource } from "@/lib/types";

export type ParsedFilm = {
  source: ClipSource;
  /** the provider's own id when we can read one */
  id: string | null;
  /** a privacy-enhanced embed url, or null when the film cannot be embedded */
  embedUrl: string | null;
  /** the link we keep */
  canonical: string;
};

const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtube-nocookie.com"]);
const VEO_HOSTS = new Set(["app.veo.co", "veo.co", "www.veo.co"]);
const YT_ID = /^[A-Za-z0-9_-]{11}$/;

function youtubeId(u: URL): string | null {
  if (u.hostname === "youtu.be") {
    const id = u.pathname.split("/").filter(Boolean)[0] ?? "";
    return YT_ID.test(id) ? id : null;
  }
  const v = u.searchParams.get("v");
  if (v && YT_ID.test(v)) return v;
  const parts = u.pathname.split("/").filter(Boolean);
  // /shorts/<id>, /embed/<id>, /live/<id>
  if (parts.length >= 2 && ["shorts", "embed", "live"].includes(parts[0]) && YT_ID.test(parts[1])) return parts[1];
  return null;
}

function veoId(u: URL): string | null {
  const parts = u.pathname.split("/").filter(Boolean);
  // /matches/<id>/ and /matches/<id>/clips/<clipId>/
  const i = parts.indexOf("matches");
  if (i >= 0 && parts[i + 1]) return parts[i + 1];
  return null;
}

export function parseFilmUrl(raw: string): ParsedFilm | null {
  const text = raw.trim();
  if (!text) return null;
  let u: URL;
  try {
    u = new URL(text.startsWith("http") ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;

  if (YT_HOSTS.has(u.hostname)) {
    const id = youtubeId(u);
    if (!id) return null;
    return {
      source: "youtube",
      id,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&rel=0&modestbranding=1`,
      canonical: `https://www.youtube.com/watch?v=${id}`,
    };
  }
  if (VEO_HOSTS.has(u.hostname)) {
    return { source: "veo", id: veoId(u), embedUrl: null, canonical: u.toString() };
  }
  return { source: "other", id: null, embedUrl: null, canonical: u.toString() };
}

/** `312` -> `5:12`; `3725` -> `1:02:05`. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

/** `5:12` or `1:02:05` or `312` -> seconds; null when it is not a time. */
export function parseClock(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t);
  const parts = t.split(":").map((p) => p.trim());
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d{1,2}$/.test(p))) return null;
  const nums = parts.map(Number);
  return parts.length === 3 ? nums[0] * 3600 + nums[1] * 60 + nums[2] : nums[0] * 60 + nums[1];
}
